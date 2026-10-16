const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
// Office's AppleScript object models share process-wide state, including selection.
let queue = Promise.resolve();
const serialize = (operation) => {
  const task = queue.then(operation);
  queue = task.catch(() => {});
  return task;
};

exports.createMacOffice = function ({
  data,
  scriptPath,
  timeoutMs = 120000,
} = {}) {
  if (!data) throw Error('Mac Office bridge requires a data directory');
  const workRoot = path.join(path.resolve(data), 'mac-office');
  const wordScript =
    scriptPath ||
    process.env.PAGE_NOTES_MAC_OFFICE_SCRIPT ||
    path.join(__dirname, 'mac-office.applescript');
  const pptScript =
    process.env.PAGE_NOTES_MAC_POWERPOINT_SCRIPT ||
    path.join(path.dirname(wordScript), 'mac-powerpoint.applescript');
  const scratchName = `pagenote-${randomUUID()}.pdf`;
  const checkedApps = new Set();

  function explain(error, app) {
    const details = String(error.stderr || error.message || error).trim();
    if (error.killed || /-1712|timed? ?out/i.test(details))
      return Error(
        `${app} 操作超时，请检查 Office 中待关闭的对话框后重试。${details ? '\n' + details.slice(-600) : ''}`,
      );
    if (
      /-1743|not authorized|not permitted to send|不允许.*Apple|无权/i.test(
        details,
      )
    )
      return Error(
        `macOS 尚未允许自动控制 ${app}。请在“系统设置 → 隐私与安全性 → 自动化”允许 pagenote 控制 ${app}，然后重试。`,
      );
    if (
      /-10814|-600|can't get application|application.*not found|找不到应用|无法找到应用/i.test(
        details,
      )
    )
      return Error(
        `未找到 Microsoft ${app}，请先安装并打开 Microsoft Office。`,
      );
    return Error(`${app}：${details || '操作失败'}`);
  }
  async function available(ppt) {
    if (process.platform !== 'darwin')
      throw Error('Mac Office bridge requires macOS');
    const app = ppt ? 'PowerPoint' : 'Word';
    if (checkedApps.has(app)) return;
    try {
      const bundleId = ppt ? 'com.microsoft.Powerpoint' : 'com.microsoft.Word';
      await run(
        '/usr/bin/osascript',
        [
          '-l',
          'JavaScript',
          '-e',
          `ObjC.import('AppKit'); if ($.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier('${bundleId}').isNil()) throw Error('application not found');`,
        ],
        { timeout: 10000 },
      );
      checkedApps.add(app);
    } catch (error) {
      throw explain(error, app);
    }
  }
  async function canonical(file, missing = false) {
    if (typeof file !== 'string' || !file || file.includes('\0'))
      throw Error('Office 文件路径无效');
    try {
      return await fs.realpath(path.resolve(file));
    } catch (error) {
      if (missing && error.code === 'ENOENT') return path.resolve(file);
      throw error;
    }
  }
  async function script(action, file, values = {}, ppt = false) {
    await available(ppt);
    await fs.mkdir(workRoot, { recursive: true });
    const request = path.join(workRoot, `request-${randomUUID()}.json`);
    try {
      await fs.writeFile(
        request,
        JSON.stringify({
          action,
          file,
          scratchName,
          waitForOpen: false,
          closeAfter: false,
          save: false,
          timeoutSeconds: Math.max(1, Math.floor(timeoutMs / 1000) - 5),
          ...values,
        }),
        { mode: 0o600 },
      );
      const { stdout } = await run(
        '/usr/bin/osascript',
        [ppt ? pptScript : wordScript, request],
        {
          timeout: timeoutMs,
          maxBuffer: 256 * 1024 * 1024,
          encoding: 'utf8',
        },
      );
      if (action === 'export') {
        const match = /^«data (?:rdat|data)([\da-f]+)»\s*$/i.exec(
          stdout.trim(),
        );
        if (!match || match[1].length % 2)
          throw Error('Office 未返回有效 PDF 数据');
        const bytes = Buffer.from(match[1], 'hex');
        if (bytes.length < 100 || bytes.subarray(0, 5).toString() !== '%PDF-')
          throw Error('Office 导出的 PDF 无效');
        return bytes;
      }
      return JSON.parse(stdout);
    } catch (error) {
      throw explain(error, ppt ? 'PowerPoint' : 'Word');
    } finally {
      await fs.unlink(request).catch(() => {});
    }
  }
  async function launch(file, ppt = false) {
    await available(ppt);
    try {
      // LaunchServices supplies the sandbox extension that direct AppleScript open lacks.
      await run(
        '/usr/bin/open',
        [
          '-g',
          '-b',
          ppt ? 'com.microsoft.Powerpoint' : 'com.microsoft.Word',
          file,
        ],
        { timeout: 10000 },
      );
    } catch (error) {
      throw explain(error, ppt ? 'PowerPoint' : 'Word');
    }
  }
  async function pdfTarget(output, source) {
    if (typeof output !== 'string' || !output || output.includes('\0'))
      throw Error('PDF 输出路径无效');
    const requested = path.resolve(output);
    if ((await canonical(requested, true)) === source)
      throw Error('PDF 输出不能覆盖 Office 源文件');
    await fs.mkdir(path.dirname(requested), { recursive: true });
    const target = path.join(
      await fs.realpath(path.dirname(requested)),
      path.basename(requested),
    );
    if (target === source) throw Error('PDF 输出不能覆盖 Office 源文件');
    return target;
  }
  async function outputPdf(bytes, output, input) {
    const target = await pdfTarget(output, input);
    const temporary = path.join(
      path.dirname(target),
      `.pagenote-${randomUUID()}.pdf`,
    );
    try {
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, target);
    } finally {
      await fs.unlink(temporary).catch(() => {});
    }
    return { output: target, size: bytes.length };
  }
  return {
    convert: (input, output) =>
      serialize(async () => {
        const source = await canonical(input);
        const ext = path.extname(source).toLowerCase();
        if (!['.doc', '.docx', '.ppt', '.pptx'].includes(ext))
          throw Error('不支持的 Office 文件格式');
        const target = await pdfTarget(output, source);
        await fs.mkdir(workRoot, { recursive: true });
        const directory = await fs.mkdtemp(path.join(workRoot, 'convert-'));
        const copy = path.join(directory, `pagenote-${randomUUID()}${ext}`);
        const ppt = ext === '.ppt' || ext === '.pptx';
        let opened = false;
        try {
          await fs.copyFile(source, copy);
          const file = await canonical(copy);
          await launch(file, ppt);
          opened = true;
          const bytes = await script(
            'export',
            file,
            { waitForOpen: true, closeAfter: true },
            ppt,
          );
          opened = false;
          return await outputPdf(bytes, target, source);
        } finally {
          if (opened)
            await script(
              'close',
              await canonical(copy, true),
              { save: false },
              ppt,
            ).catch(() => {});
          await fs
            .rm(directory, { recursive: true, force: true })
            .catch(() => {});
        }
      }),
    readWord: (file) =>
      serialize(async () => {
        const target = await canonical(file);
        await launch(target);
        return script('read', target, { waitForOpen: true });
      }),
    selectionWord: (file) =>
      serialize(async () => script('selection', await canonical(file, true))),
    replaceWord: (file, { search, replacement, start, expectedText } = {}) =>
      serialize(async () => {
        if (
          typeof search !== 'string' ||
          !search ||
          typeof replacement !== 'string'
        )
          throw Error('需要原文和替换内容');
        if (expectedText !== undefined && typeof expectedText !== 'string')
          throw Error('Word 内容校验需要完整的原文');
        if (start !== undefined && (!Number.isSafeInteger(start) || start < 0))
          throw Error('Word 选区超出范围，请重新读取');
        return script('replace', await canonical(file, true), {
          search,
          replacement,
          ...(start === undefined ? {} : { start }),
          ...(expectedText === undefined ? {} : { expectedText }),
        });
      }),
    saveWord: (file) =>
      serialize(async () => script('save', await canonical(file, true))),
    closeWord: (file, { save = false } = {}) =>
      serialize(async () =>
        script('close', await canonical(file, true), { save: save === true }),
      ),
    statusWord: (file) =>
      serialize(async () => script('status', await canonical(file, true))),
    exportWord: (file, output) =>
      serialize(async () => {
        const target = await canonical(file, true);
        const destination = await pdfTarget(output, target);
        const bytes = await script('export', target);
        return outputPdf(bytes, destination, target);
      }),
  };
};
