import fileOps from './desktop/file-ops.cjs';
const { moveFile, copyFileSafe } = fileOps;
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export function splitPageNotes(text) {
  return text.split(
    /(?:\r?\n){2}<!--[ \t]*pagebreak[ \t]*-->(?:\r?\n){2}|^[ \t]*<!--[ \t]*pagebreak[ \t]*-->[ \t]*\r?$/gm,
  );
}
export function createProjectStore({ app, data, convertOffice }) {
  const metaPath = (id) => path.join(data, 'documents', id, 'meta.json'),
    valid = (id) => /^[a-f0-9]{64}$/.test(id);
  const readMeta = async (id) => {
    if (!valid(id)) throw Error('项目 ID 无效');
    return JSON.parse(await fs.readFile(metaPath(id), 'utf8'));
  };
  const resolveLink = (root, link) => {
    if (typeof link !== 'string' || path.isAbsolute(link))
      throw Error('项目链接必须使用相对路径');
    const result = path.resolve(root, link),
      src = path.join(root, 'src');
    if (result !== src && !result.startsWith(src + path.sep))
      throw Error('项目文件必须放在 src 文件夹中');
    return result;
  };
  const atomic = async (file, text) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.' + randomUUID() + '.tmp';
    await fs.writeFile(temp, text);
    await moveFile(temp, file);
  };
  async function exportAssets(text, projectRoot) {
    for (const name of new Set(
      [...text.matchAll(/\/attachments\/([a-f0-9-]+\.[a-z0-9]+)/gi)].map(
        (m) => m[1],
      ),
    )) {
      const destination = path.join(projectRoot, 'src', 'assets', name);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      try {
        await copyFileSafe(path.join(data, 'uploads', name), destination);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    return text.replace(
      /\/attachments\/([a-f0-9-]+\.[a-z0-9]+)/gi,
      'assets/$1',
    );
  }
  async function importAssets(text, projectRoot) {
    for (const name of new Set(
      [...text.matchAll(/assets\/([a-f0-9-]+\.[a-z0-9]+)/gi)].map((m) => m[1]),
    )) {
      await fs.mkdir(path.join(data, 'uploads'), { recursive: true });
      try {
        await copyFileSafe(
          resolveLink(projectRoot, 'src/assets/' + name),
          path.join(data, 'uploads', name),
        );
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    return text.replace(/assets\/([a-f0-9-]+\.[a-z0-9]+)/gi, '/attachments/$1');
  }
  let writes = Promise.resolve();
  async function persist(id, source = false, writeRight = false) {
    const job = writes
      .catch(() => {})
      .then(async () => {
        const meta = await readMeta(id);
        if (!meta.projectRoot) return;
        const manifestFile =
            meta.projectFile ||
            path.join(meta.projectRoot, 'project.page-notes.json'),
          manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8')),
          dir = path.dirname(metaPath(id));
        if (source) {
          if (meta.kind === 'markdown')
            await atomic(
              resolveLink(meta.projectRoot, manifest.left),
              await exportAssets(
                await fs.readFile(
                  path.join(dir, 'original' + meta.ext),
                  'utf8',
                ),
                meta.projectRoot,
              ),
            );
          else
            await copyFileSafe(
              path.join(dir, 'original' + meta.ext),
              resolveLink(meta.projectRoot, manifest.left),
            );
          if (meta.kind === 'pdf' && meta.ext !== '.pdf') {
            manifest.preview ||= 'src/view.pdf';
            await copyFileSafe(
              path.join(dir, 'view.pdf'),
              resolveLink(meta.projectRoot, manifest.preview),
            );
          }
        }
        let notes = {};
        try {
          notes = JSON.parse(
            await fs.readFile(path.join(dir, 'notes.json'), 'utf8'),
          );
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        const count = Math.max(1, ...Object.keys(notes).map(Number));
        if (writeRight)
          await atomic(
            resolveLink(meta.projectRoot, manifest.right),
            await exportAssets(
              Array.from({ length: count }, (_, i) => notes[i + 1] || '').join(
                '\n\n<!-- pagebreak -->\n\n',
              ),
              meta.projectRoot,
            ),
          );
        for (const name of [
          'notes.json',
          'annotations.json',
          'ai-reviews.json',
          'ai-handoffs.json',
        ]) {
          try {
            await atomic(
              path.join(meta.projectRoot, 'src', name),
              await exportAssets(
                await fs.readFile(path.join(dir, name), 'utf8'),
                meta.projectRoot,
              ),
            );
          } catch (e) {
            if (e.code !== 'ENOENT') throw e;
          }
        }
        manifest.modified = new Date().toISOString();
        await atomic(manifestFile, JSON.stringify(manifest, null, 2));
      });
    writes = job;
    await job;
  }
  async function open(file) {
    const root = path.dirname(path.resolve(file)),
      manifest = JSON.parse(await fs.readFile(file, 'utf8'));
    if (
      !['page-notes-project', 'pagenote-project'].includes(manifest.format) ||
      !valid(manifest.id)
    )
      throw Error('不是有效的 pagenote 项目');
    const left = resolveLink(root, manifest.left),
      right = resolveLink(root, manifest.right),
      ext = path.extname(left).toLowerCase();
    if (
      !['.md', '.markdown', '.pdf', '.doc', '.docx', '.ppt', '.pptx'].includes(
        ext,
      )
    )
      throw Error('项目左侧文件格式不支持');
    const dir = path.dirname(metaPath(manifest.id));
    await fs.mkdir(dir, { recursive: true });
    if (['.md', '.markdown'].includes(ext))
      await atomic(
        path.join(dir, 'original' + ext),
        await importAssets(await fs.readFile(left, 'utf8'), root),
      );
    else await copyFileSafe(left, path.join(dir, 'original' + ext));
    const kind = ['.md', '.markdown'].includes(ext) ? 'markdown' : 'pdf';
    if (kind === 'pdf') {
      if (ext === '.pdf') await copyFileSafe(left, path.join(dir, 'view.pdf'));
      else {
        const preview = resolveLink(root, manifest.preview || 'src/view.pdf');
        let rebuild = false;
        try {
          rebuild =
            (await fs.stat(left)).mtimeMs > (await fs.stat(preview)).mtimeMs;
        } catch (e) {
          if (e.code === 'ENOENT') rebuild = true;
          else throw e;
        }
        if (rebuild) {
          if (!convertOffice) throw Error('Office 转换不可用');
          await convertOffice(left, preview);
        }
        await copyFileSafe(preview, path.join(dir, 'view.pdf'));
      }
    }
    const notes = Object.fromEntries(
      splitPageNotes(
        await importAssets(await fs.readFile(right, 'utf8'), root),
      ).map((text, i) => [i + 1, text]),
    );
    await atomic(path.join(dir, 'notes.json'), JSON.stringify(notes));
    for (const name of [
      'annotations.json',
      'ai-reviews.json',
      'ai-handoffs.json',
    ]) {
      try {
        await atomic(
          path.join(dir, name),
          await importAssets(
            await fs.readFile(path.join(root, 'src', name), 'utf8'),
            root,
          ),
        );
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        if (name === 'ai-handoffs.json')
          await atomic(path.join(dir, name), '{}');
      }
    }
    const meta = {
      id: manifest.id,
      name: manifest.name,
      ext,
      kind,
      projectRoot: root,
      projectFile: path.resolve(file),
      created: manifest.created,
      url:
        '/files/' +
        manifest.id +
        '/' +
        (kind === 'pdf' ? 'view.pdf' : 'original' + ext),
      modified: new Date().toISOString(),
    };
    await atomic(metaPath(meta.id), JSON.stringify(meta, null, 2));
    return meta;
  }
  async function bindLeft(meta, id) {
    if (!id) return meta;
    const project = await readMeta(id);
    if (!project.projectRoot) throw Error('当前文档不是项目');
    const file = project.projectFile,
      manifest = JSON.parse(await fs.readFile(file, 'utf8')),
      from = path.dirname(metaPath(meta.id)),
      to = path.dirname(metaPath(id));
    manifest.left = 'src/left' + meta.ext;
    manifest.leftName = meta.name;
    await copyFileSafe(
      path.join(from, 'original' + meta.ext),
      resolveLink(project.projectRoot, manifest.left),
    );
    await copyFileSafe(
      path.join(from, 'original' + meta.ext),
      path.join(to, 'original' + meta.ext),
    );
    if (meta.kind === 'pdf') {
      await copyFileSafe(
        path.join(from, 'view.pdf'),
        path.join(to, 'view.pdf'),
      );
      manifest.preview = 'src/view.pdf';
      await copyFileSafe(
        path.join(from, 'view.pdf'),
        resolveLink(project.projectRoot, manifest.preview),
      );
    }
    const updated = {
      ...project,
      ext: meta.ext,
      kind: meta.kind,
      url:
        '/files/' +
        id +
        '/' +
        (meta.kind === 'pdf' ? 'view.pdf' : 'original' + meta.ext),
      modified: new Date().toISOString(),
    };
    await atomic(file, JSON.stringify(manifest, null, 2));
    await atomic(metaPath(id), JSON.stringify(updated, null, 2));
    return updated;
  }
  app.post('/api/projects', async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim();
      if (!name || /[<>:"/\\|?*]/.test(name))
        throw Error('请输入有效的项目名称');
      const parent = req.body.parent
        ? path.resolve(req.body.parent)
        : path.join(data, 'projects');
      await fs.mkdir(parent, { recursive: true });
      const root = path.join(parent, name);
      await fs.mkdir(root);
      await fs.mkdir(path.join(root, 'src'));
      const id = createHash('sha256').update(randomUUID()).digest('hex'),
        manifest = {
          format: 'pagenote-project',
          version: 1,
          id,
          name,
          created: new Date().toISOString(),
          left: 'src/left.md',
          right: 'src/right.md',
        };
      await atomic(path.join(root, 'src', 'left.md'), '# ' + name + '\n');
      await atomic(path.join(root, 'src', 'right.md'), '');
      const file = path.join(root, 'project.pagenote');
      await atomic(file, JSON.stringify(manifest, null, 2));
      res.json(await open(file));
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/projects/open', async (req, res, next) => {
    try {
      await writes;
      res.json(await open(String(req.body.filePath)));
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/projects/:id/sync', async (req, res, next) => {
    try {
      await persist(
        req.params.id,
        req.body?.source !== false,
        req.body?.right !== false,
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  return {
    persist,
    bindLeft,
    open,
    sourceFile: async (meta) => {
      if (!meta.projectRoot)
        return path.join(
          path.dirname(metaPath(meta.id)),
          'original' + meta.ext,
        );
      const manifest = JSON.parse(
        await fs.readFile(
          meta.projectFile ||
            path.join(meta.projectRoot, 'project.page-notes.json'),
          'utf8',
        ),
      );
      return resolveLink(meta.projectRoot, manifest.left);
    },
  };
}
