import fileOps from './desktop/file-ops.cjs';
const { moveFile, copyFileSafe } = fileOps;
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function registerExternalDocuments({
  app,
  data,
  projects,
  desktop,
  convertOffice,
}) {
  const sessions = new Map(),
    jobs = new Map();
  const signature = async (file) => {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 200 * 1024 * 1024)
      throw Error('文件无效或超过 200MB');
    return `${stat.size}:${stat.mtimeMs}`;
  };
  async function meta(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error('文档 ID 无效');
    const value = JSON.parse(
      await fs.readFile(path.join(data, 'documents', id, 'meta.json'), 'utf8'),
    );
    if (!['.doc', '.docx', '.pdf', '.ppt', '.pptx'].includes(value.ext))
      throw Error('此格式请使用内置 Markdown 编辑器');
    return value;
  }
  app.post('/api/documents/:id/open-external', async (req, res, next) => {
    try {
      const value = await meta(req.params.id),
        file = await projects.sourceFile(value),
        version = await signature(file);
      const history = path.join(data, 'documents', value.id, 'source-history');
      await fs.mkdir(history, { recursive: true });
      await copyFileSafe(
        file,
        path.join(history, `${Date.now()}-${randomUUID()}${value.ext}`),
      );
      await desktop()('open-external', { filePath: file });
      sessions.set(value.id, { file, version });
      res.json({ opened: true });
    } catch (error) {
      next(error);
    }
  });
  async function refresh(id) {
    const session = sessions.get(id);
    if (!session) return { changed: false };
    const version = await signature(session.file);
    if (version === session.version) return { changed: false };
    let value = await meta(id);
    if (value.projectRoot) value = await projects.open(value.projectFile);
    else {
      const directory = path.join(data, 'documents', id),
        token = randomUUID(),
        snapshot = path.join(directory, `external-${token}${value.ext}`),
        preview = path.join(directory, `external-${token}.pdf`);
      try {
        await copyFileSafe(session.file, snapshot);
        if (value.ext === '.pdf') await copyFileSafe(snapshot, preview);
        else await convertOffice(snapshot, preview);
        if ((await signature(session.file)) !== version)
          throw Error('文件仍在保存，请稍后重试刷新');
        await moveFile(preview, path.join(directory, 'view.pdf'));
        value.modified = new Date().toISOString();
        await fs.writeFile(
          path.join(directory, 'meta.json'),
          JSON.stringify(value, null, 2),
        );
      } finally {
        await fs.unlink(snapshot).catch(() => {});
        await fs.unlink(preview).catch(() => {});
      }
    }
    session.version = version;
    return { changed: true, document: value };
  }
  app.post('/api/documents/:id/refresh-external', async (req, res, next) => {
    const id = req.params.id;
    try {
      if (!jobs.has(id))
        jobs.set(
          id,
          refresh(id).finally(() => jobs.delete(id)),
        );
      res.json(await jobs.get(id));
    } catch (error) {
      next(error);
    }
  });
}
