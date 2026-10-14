const { moveFile, copyFileSafe } = require('./file-ops.cjs');
const { spawn } = require('node:child_process');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const revision = (text) => createHash('sha256').update(text).digest('hex');
exports.createWordHost = function ({ win, data, helper, converter }) {
  let child,
    session,
    sequence = 0,
    buffer = '',
    stderr = '',
    queue = Promise.resolve();
  const pending = new Map();
  function start() {
    child = spawn(
      'powershell.exe',
      [
        '-STA',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        helper,
      ],
      { windowsHide: true },
    );
    buffer = '';
    stderr = '';
    child.stderr.on('data', (bytes) => {
      stderr = (stderr + bytes.toString()).slice(-4000);
    });
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!line.startsWith('PAGE_NOTES_WORD ')) continue;
        try {
          const reply = JSON.parse(line.slice(16)),
            task = pending.get(reply.cid);
          pending.delete(reply.cid);
          if (task) {
            clearTimeout(task.timer);
            reply.error
              ? task.reject(Error(reply.error))
              : task.resolve(reply.value);
          }
        } catch {}
      }
    });
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.on('exit', () =>
      fail(
        Error('Word 编辑器已关闭' + (stderr ? '：' + stderr.slice(-1500) : '')),
      ),
    );
  }
  function fail(error) {
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      task.reject(error);
    }
    pending.clear();
  }
  function send(action, args = {}) {
    const cid = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(cid);
        reject(Error('Word 操作超时，请检查 Word 是否有待关闭的对话框'));
      }, 120000);
      pending.set(cid, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ cid, action, ...args }) + '\n');
    });
  }
  async function rect(value) {
    const scale = Number(value.scale) || 1,
      menu = Math.max(
        0,
        win.getContentSize()[1] -
          (await win.webContents.executeJavaScript('innerHeight')),
      );
    return Object.fromEntries(
      ['x', 'y', 'width', 'height'].map((key) => [
        key,
        Math.round((Number(value[key]) + (key === 'y' ? menu : 0)) * scale),
      ]),
    );
  }
  async function perform(action, args = {}) {
    if (action === 'open') {
      if (session) throw Error('请先保存并结束当前 Word 编辑');
      if (!/^[a-f0-9]{64}$/.test(args.documentId)) throw Error('文档无效');
      const dir = path.join(data, 'documents', args.documentId),
        meta = JSON.parse(
          await fs.readFile(path.join(dir, 'meta.json'), 'utf8'),
        );
      if (!['.doc', '.docx'].includes(meta.ext))
        throw Error('此入口用于 Word 文档的实际内容编辑');
      const editDir = path.join(dir, `edit-session-${randomUUID()}`);
      await fs.mkdir(editDir, { recursive: true });
      const work = path.join(
        editDir,
        path.basename(meta.name).replace(/[<>:"|?*\x00-\x1f]/g, '_'),
      );
      await copyFileSafe(path.join(dir, 'original' + meta.ext), work);
      start();
      try {
        const parent = win.getNativeWindowHandle().readBigUInt64LE().toString(),
          result = await send('open', {
            file: work,
            parent,
            rect: await rect(args.rect),
          });
        if (result.parent !== parent)
          throw Error('当前 Word 未能嵌入pagenote窗口');
        session = { id: args.documentId, dir, meta, work, editDir };
        return { ...result, revision: revision(result.text) };
      } catch (error) {
        child.stdin.end();
        throw error;
      }
    }
    if (!session) throw Error('Word 编辑器尚未打开');
    if (args.documentId && args.documentId !== session.id)
      throw Error('编辑中的 Word 与指定文档不同');
    if (action === 'status')
      return child.exitCode !== null ? { alive: false } : send('status');
    if (action === 'resize')
      return send('resize', { rect: await rect(args.rect) });
    if (action === 'save') return send('save');
    if (action === 'command') return send('command', { command: args.command });
    if (action === 'visibility')
      return send('visibility', { visible: args.visible === true });
    if (action === 'screenshot') {
      const folder = path.join(data, 'screenshots');
      await fs.mkdir(folder, { recursive: true });
      const file = path.join(folder, `${Date.now()}-word-${randomUUID()}.png`),
        result = await send('screenshot', { file });
      return {
        ...result,
        path: file,
        documentId: session.id,
        mimeType: 'image/png',
        imageBase64: (await fs.readFile(file)).toString('base64'),
      };
    }
    if (action === 'read' || action === 'selection') {
      const result = await send(action);
      return {
        ...result,
        documentId: session.id,
        ...(result.text !== undefined
          ? { revision: revision(result.text) }
          : {}),
      };
    }
    if (action === 'replace') {
      const current = await send('read');
      if (
        !args.expectedRevision ||
        revision(current.text) !== args.expectedRevision
      )
        throw Error('Word 内容已变化，请重新读取并提供当前 revision');
      if (!args.search || typeof args.replacement !== 'string')
        throw Error('需要原文和替换内容');
      if (args.start !== undefined) {
        if (
          !Number.isInteger(args.start) ||
          args.start < current.rangeStart ||
          args.start + args.search.length > current.rangeEnd
        )
          throw Error('Word 选区超出范围，请重新读取');
      } else if (current.text.split(args.search).length !== 2)
        throw Error('原文多处出现，请提供选区 start 或扩大原文范围');
      const result = await send('replace', {
        search: args.search,
        replacement: args.replacement,
        start: args.start,
      });
      return { ...result, revision: revision(result.text) };
    }
    if (action === 'close') {
      const active = session,
        status =
          child.exitCode !== null ? { alive: false } : await send('status');
      if (args.save !== false) {
        const history = path.join(active.dir, 'source-history');
        await fs.mkdir(history, { recursive: true });
        await copyFileSafe(
          path.join(active.dir, 'original' + active.meta.ext),
          path.join(history, `${Date.now()}-${randomUUID()}${active.meta.ext}`),
        );
        const view = path.join(active.dir, `view-${randomUUID()}.pdf`);
        let exported;
        if (status.alive) {
          exported = await send('export', { file: view });
          await send('close', { save: true });
        } else {
          child.stdin.end();
          await promisify(execFile)(
            'powershell.exe',
            [
              '-NoProfile',
              '-NonInteractive',
              '-ExecutionPolicy',
              'Bypass',
              '-File',
              converter,
              '-InputFile',
              active.work,
              '-OutputFile',
              view,
            ],
            { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 },
          );
          exported = { source: active.work };
        }
        await copyFileSafe(
          exported.source || active.work,
          path.join(active.dir, 'original' + active.meta.ext),
        );
        await moveFile(view, path.join(active.dir, 'view.pdf'));
        active.meta.modified = new Date().toISOString();
        await fs.writeFile(
          path.join(active.dir, 'meta.json'),
          JSON.stringify(active.meta, null, 2),
        );
      } else if (status.alive) await send('close', { save: false });
      session = null;
      if (!child.stdin.destroyed) child.stdin.end();
      await fs.unlink(active.work).catch(() => {});
      await fs.rmdir(active.editDir).catch(() => {});
      return {
        saved: args.save !== false,
        documentId: active.id,
        recovered: !status.alive,
      };
    }
    throw Error('不支持的 Word 操作');
  }
  return {
    call: (action, args) => {
      const task = queue.then(() => perform(action, args));
      queue = task.catch(() => {});
      return task;
    },
    get active() {
      return session?.id;
    },
  };
};
