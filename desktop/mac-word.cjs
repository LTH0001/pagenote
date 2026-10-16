const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { moveFile, copyFileSafe } = require('./file-ops.cjs');

const revision = (value) => createHash('sha256').update(value).digest('hex');
const signature = async (file) => revision(await fs.readFile(file));

exports.createMacWordHost = function ({ data, office }) {
  office ||= require('./mac-office.cjs').createMacOffice({ data });
  let session;
  let queue = Promise.resolve();

  async function writeMeta(active) {
    const file = path.join(active.dir, 'meta.json');
    const temp = file + '.' + randomUUID() + '.tmp';
    active.meta.modified = new Date().toISOString();
    await fs.writeFile(temp, JSON.stringify(active.meta, null, 2));
    await moveFile(temp, file);
  }
  async function projectSource(meta) {
    if (!meta.projectFile || !meta.projectRoot) return null;
    const manifest = JSON.parse(await fs.readFile(meta.projectFile, 'utf8'));
    if (typeof manifest.left !== 'string' || path.isAbsolute(manifest.left))
      throw Error('项目链接必须使用相对路径');
    const file = path.resolve(meta.projectRoot, manifest.left);
    if (!file.startsWith(path.join(meta.projectRoot, 'src') + path.sep))
      throw Error('项目文件必须放在 src 文件夹中');
    return { file, signature: await signature(file) };
  }
  async function exportPreview(active, status) {
    const file = path.join(active.dir, `view-${randomUUID()}.pdf`);
    try {
      if (status.alive) {
        await office.saveWord(active.work);
        await office.exportWord(active.work, file);
      } else await office.convert(active.work, file);
      return file;
    } catch (error) {
      await fs.unlink(file).catch(() => {});
      throw error;
    }
  }
  async function stageCopy(source, destination) {
    const temporary = path.join(
      path.dirname(destination),
      `.pagenote-${randomUUID()}.tmp`,
    );
    try {
      await copyFileSafe(source, temporary);
      await moveFile(temporary, destination);
    } finally {
      await fs.unlink(temporary).catch(() => {});
    }
  }
  async function checkSource(active) {
    const meta = JSON.parse(
      await fs.readFile(path.join(active.dir, 'meta.json'), 'utf8'),
    );
    const project = await projectSource(active.meta);
    if (
      meta.projectFile !== active.meta.projectFile ||
      meta.projectRoot !== active.meta.projectRoot ||
      (await signature(active.original)) !== active.signature ||
      (active.project &&
        (project.file !== active.project.file ||
          project.signature !== active.project.signature))
    )
      throw Error(
        'Word 源文件已被其他操作修改。编辑副本已保留，请先解决冲突再保存。',
      );
  }
  async function commitProject(active, preview) {
    if (!active.project) return;
    const manifest = JSON.parse(
      await fs.readFile(active.meta.projectFile, 'utf8'),
    );
    const relative = manifest.preview || 'src/view.pdf';
    if (typeof relative !== 'string' || path.isAbsolute(relative))
      throw Error('项目预览必须使用相对路径');
    const destination = path.resolve(active.meta.projectRoot, relative);
    if (
      !destination.startsWith(
        path.join(active.meta.projectRoot, 'src') + path.sep,
      )
    )
      throw Error('项目预览必须放在 src 文件夹中');
    await stageCopy(active.work, active.project.file);
    // Keep retries valid even when the next preview write fails.
    active.project.signature = await signature(active.project.file);
    await stageCopy(preview, destination);
  }
  function result(value, active = session) {
    return {
      ...value,
      documentId: active.id,
      ...(value.text !== undefined ? { revision: revision(value.text) } : {}),
    };
  }
  async function perform(action, args = {}) {
    if (action === 'open') {
      if (session) throw Error('请先保存并结束当前 Word 编辑');
      if (!/^[a-f0-9]{64}$/.test(args.documentId || ''))
        throw Error('文档无效');
      const dir = path.join(data, 'documents', args.documentId);
      const meta = JSON.parse(
        await fs.readFile(path.join(dir, 'meta.json'), 'utf8'),
      );
      if (!['.doc', '.docx'].includes(meta.ext))
        throw Error('此入口用于 Word 文档的实际内容编辑');
      const original = path.join(dir, 'original' + meta.ext);
      const sourceSignature = await signature(original);
      const project = await projectSource(meta);
      if (project && project.signature !== sourceSignature)
        throw Error('项目源文件已修改，请先刷新或重新打开项目后再编辑 Word。');
      const editDir = path.join(dir, `edit-session-${randomUUID()}`);
      await fs.mkdir(editDir, { recursive: true });
      const work = path.join(editDir, `pagenote-${randomUUID()}${meta.ext}`);
      const active = {
        id: args.documentId,
        dir,
        meta,
        editDir,
        work,
        original,
        signature: sourceSignature,
        project,
      };
      await copyFileSafe(original, work);
      try {
        const state = await office.readWord(work);
        session = active;
        return result({ ...state, embedded: false, external: true });
      } catch (error) {
        await office.closeWord(work, { save: false }).catch(() => {});
        await fs.rm(editDir, { recursive: true, force: true });
        throw error;
      }
    }
    if (!session) {
      if (action === 'close') return { closed: true, saved: false };
      throw Error('Word 编辑器尚未打开');
    }
    const active = session;
    if (args.documentId && args.documentId !== active.id)
      throw Error('编辑中的 Word 与指定文档不同');
    if (action === 'resize' || action === 'visibility')
      return { embedded: false };
    if (action === 'status') return office.statusWord(active.work);
    if (action === 'read') return result(await office.readWord(active.work));
    if (action === 'selection')
      return result(await office.selectionWord(active.work));
    if (action === 'save') return result(await office.saveWord(active.work));
    if (action === 'replace') {
      const current = await office.readWord(active.work);
      if (
        !args.expectedRevision ||
        revision(current.text) !== args.expectedRevision
      )
        throw Error('Word 内容已变化，请重新读取并提供当前 revision');
      if (
        !args.search ||
        typeof args.search !== 'string' ||
        typeof args.replacement !== 'string'
      )
        throw Error('需要原文和替换内容');
      if (args.search.includes('\u0007') || args.replacement.includes('\u0007'))
        throw Error('选区跨越了表格结构');
      if (args.start !== undefined) {
        if (
          !Number.isInteger(args.start) ||
          args.start < current.rangeStart ||
          args.start + args.search.length > current.rangeEnd ||
          current.text.slice(
            args.start - current.rangeStart,
            args.start - current.rangeStart + args.search.length,
          ) !== args.search
        )
          throw Error('Word 选区已变化，请重新读取');
      } else if (current.text.split(args.search).length !== 2)
        throw Error('原文多处出现或不存在，请提供选区 start 或扩大原文范围');
      return result(
        await office.replaceWord(active.work, {
          ...args,
          expectedText: current.text,
        }),
      );
    }
    if (action === 'export-preview') {
      const file = await exportPreview(
        active,
        await office.statusWord(active.work),
      );
      const name = `capture-${randomUUID()}.pdf`;
      await moveFile(file, path.join(active.editDir, name));
      return {
        documentId: active.id,
        url: `/files/${active.id}/${path.basename(active.editDir)}/${name}`,
      };
    }
    if (action === 'close') {
      const status = await office.statusWord(active.work);
      if (args.save !== false) {
        await checkSource(active);
        // Export before replacing the original: a failed conversion keeps the
        // source and the recoverable edit session intact.
        const preview = await exportPreview(active, status);
        // Export can take seconds while the user's default editor stays open.
        // Recheck the source after automation before committing the working copy.
        try {
          await checkSource(active);
        } catch (error) {
          await fs.unlink(preview).catch(() => {});
          throw error;
        }
        const history = path.join(active.dir, 'source-history');
        await fs.mkdir(history, { recursive: true });
        await copyFileSafe(
          active.original,
          path.join(history, `${Date.now()}-${randomUUID()}${active.meta.ext}`),
        );
        await commitProject(active, preview);
        await stageCopy(active.work, active.original);
        active.signature = await signature(active.original);
        await moveFile(preview, path.join(active.dir, 'view.pdf'));
        await writeMeta(active);
      }
      await office.closeWord(active.work, { save: false });
      session = undefined;
      await fs.rm(active.editDir, { recursive: true, force: true });
      return {
        documentId: active.id,
        saved: args.save !== false,
        recovered: !status.alive,
        projectPersisted: !!active.project && args.save !== false,
      };
    }
    throw Error('请在独立的 Word 窗口中执行此编辑操作');
  }
  return {
    call(action, args) {
      const task = queue.then(() => perform(action, args));
      queue = task.catch(() => {});
      return task;
    },
    get active() {
      return session?.id;
    },
    captureKind: 'pdf',
  };
};
