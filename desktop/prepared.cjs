const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Worker } = require('node:worker_threads');
const { moveFile } = require('./file-ops.cjs');
const ENGINE = 'Guten OCR 1.4.9 / PP-OCRv4 / models 1.4.2';
let worker;
async function recognize(image) {
  if (!worker) {
    worker = new Worker(path.join(__dirname, 'ocr-worker.cjs'));
    const created = worker;
    created.on('error', () => {
      if (worker === created) worker = null;
    });
    created.on('exit', () => {
      if (worker === created) worker = null;
    });
    worker.unref();
  }
  const active = worker;
  return new Promise((resolve, reject) => {
    const clean = () => {
      clearTimeout(timer);
      active.off('message', message);
      active.off('error', failed);
      active.off('exit', exited);
    };
    const failed = (e) => {
      clean();
      if (worker === active) worker = null;
      reject(e);
    };
    const exited = (code) => failed(Error(`OCR进程退出：${code}`));
    const message = (value) => {
      clean();
      value.error ? reject(Error(value.error)) : resolve(value.result);
    };
    const timer = setTimeout(() => {
      failed(Error('本地OCR超时，原图已保留'));
      active.terminate();
    }, 90000);
    active.once('message', message);
    active.once('error', failed);
    active.once('exit', exited);
    active.postMessage(image);
  });
}
const atomic = async (file, value) => {
  const temp = file + '.' + randomUUID() + '.tmp';
  await fs.writeFile(temp, value);
  await moveFile(temp, file);
};
function overlap(a, b) {
  return (
    a.x + a.width > b.x &&
    b.x + b.width > a.x &&
    a.y + a.height > b.y &&
    b.y + b.height > a.y
  );
}
exports.createPagePreparer =
  ({ data, describe, snapshot }) =>
  async (id, page, args = {}) => {
    const description = await describe(id, page);
    const mode = args.ocr || 'auto';
    const region = args.region || { x: 0, y: 0, width: 1000, height: 1000 };
    if (
      ![region.x, region.y, region.width, region.height].every(
        Number.isFinite,
      ) ||
      region.x < 0 ||
      region.y < 0 ||
      region.width <= 0 ||
      region.height <= 0 ||
      region.x + region.width > 1000 ||
      region.y + region.height > 1000
    )
      throw Error('区域坐标必须在页面1000×1000范围内');
    const key = createHash('sha256')
      .update(
        JSON.stringify({
          version: 2,
          source: description.sourceRevision,
          mode,
          region,
          engine: ENGINE,
        }),
      )
      .digest('hex');
    const base = description.projectRoot
      ? path.join(description.projectRoot, 'src', 'prepared')
      : path.join(data, 'documents', id, 'prepared');
    const folder = path.join(base, `${page}-${key.slice(0, 24)}`);
    const manifestFile = path.join(folder, 'manifest.json');
    let manifest,
      cached = false;
    if (!args.refresh) {
      try {
        manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
        if (
          manifest.version !== 2 ||
          manifest.cacheKey !== key ||
          manifest.sourceRevision !== description.sourceRevision ||
          !Array.isArray(manifest.visuals)
        )
          throw Error('预处理缓存无效，请使用refresh重新生成');
        cached = true;
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    if (!manifest) {
      const source = await snapshot(id, page);
      if (source.sourceRevision !== description.sourceRevision)
        throw Error('准备期间原文发生变化，请重试');
      const sharp = require('sharp');
      await fs.mkdir(folder, { recursive: true });
      await atomic(path.join(folder, 'native-full.txt'), source.nativeText);
      await atomic(
        path.join(folder, 'native-blocks.json'),
        JSON.stringify(source.nativeBlocks),
      );
      const blocks = source.nativeBlocks.filter((b) => overlap(b.bbox, region));
      const nativeText =
        args.region && source.kind === 'pdf'
          ? blocks.map((b) => b.text + (b.hasEOL ? '\n' : ' ')).join('')
          : source.nativeText;
      const visuals = [],
        warnings = [];
      let ocr = { status: 'not-needed', engine: ENGINE },
        ocrText = '',
        ocrBlocks = [];
      if (source.imageBase64) {
        const fullImage = Buffer.from(source.imageBase64, 'base64');
        await atomic(path.join(folder, 'page.png'), fullImage);
        const left = Math.floor((region.x / 1000) * source.width);
        const top = Math.floor((region.y / 1000) * source.height);
        const width = Math.min(
          source.width - left,
          Math.max(1, Math.ceil((region.width / 1000) * source.width)),
        );
        const height = Math.min(
          source.height - top,
          Math.max(1, Math.ceil((region.height / 1000) * source.height)),
        );
        const cropped = await sharp(fullImage)
          .extract({ left, top, width, height })
          .png()
          .toBuffer();
        await atomic(path.join(folder, 'region.png'), cropped);
        visuals.push({
          type: args.region ? 'page-region' : 'page',
          file: 'region.png',
          fullPage: 'page.png',
          width,
          height,
        });
        const sparse = nativeText.replace(/\s/g, '').length < 200;
        const suspicious = /[\uFFFD\uE000-\uF8FF]/.test(nativeText);
        if (
          mode === 'always' ||
          (mode === 'auto' &&
            (sparse || source.rasterImageCount > 0 || suspicious))
        ) {
          try {
            const raw = await recognize(path.join(folder, 'region.png'));
            await atomic(
              path.join(folder, 'ocr-raw.json'),
              JSON.stringify(raw),
            );
            const lines = Array.isArray(raw) ? raw : raw.texts;
            const rw = raw.resizedImageWidth || width,
              rh = raw.resizedImageHeight || height;
            const ratio = Math.min(rw / width, rh / height);
            const padX = (rw - width * ratio) / 2,
              padY = (rh - height * ratio) / 2;
            ocrBlocks = lines.map((line) => {
              const points = (line.box || []).map(([x, y]) => [
                left + (x - padX) / ratio,
                top + (y - padY) / ratio,
              ]);
              const xs = points.map((p) =>
                Math.max(0, Math.min(source.width, p[0])),
              );
              const ys = points.map((p) =>
                Math.max(0, Math.min(source.height, p[1])),
              );
              return {
                type: 'ocr-text',
                text: line.text,
                confidence: line.mean ?? line.score ?? null,
                bbox: points.length
                  ? {
                      x: (Math.min(...xs) / source.width) * 1000,
                      y: (Math.min(...ys) / source.height) * 1000,
                      width:
                        ((Math.max(...xs) - Math.min(...xs)) / source.width) *
                        1000,
                      height:
                        ((Math.max(...ys) - Math.min(...ys)) / source.height) *
                        1000,
                    }
                  : null,
              };
            });
            ocrText = ocrBlocks.map((b) => b.text).join('\n');
            ocr = {
              status: ocrBlocks.length ? 'completed' : 'empty',
              engine: ENGINE,
              blockCount: ocrBlocks.length,
              lowConfidenceCount: ocrBlocks.filter(
                (b) => b.confidence === null || b.confidence < 0.8,
              ).length,
            };
            warnings.push(
              'OCR可能漏字或误认，识别器会过滤部分低置信度候选；务必保留并按需核对原图。',
            );
          } catch (e) {
            ocr = { status: 'failed', engine: ENGINE, error: e.message };
            warnings.push(
              'OCR失败，原图和原文已保留；可用多模态查看或refresh重试。',
            );
          }
        } else if (mode === 'never') ocr.status = 'disabled';
        else
          warnings.push(
            '已优先读取PDF文字层；图片内文字若仍需识别，可指定region并使用ocr=always。',
          );
      } else {
        ocr.status = 'native-markdown';
        for (const [index, diagram] of (source.diagrams || []).entries()) {
          await atomic(
            path.join(folder, `diagram-${index}.mmd`),
            diagram.source,
          );
          if (diagram.svg) {
            await atomic(
              path.join(folder, `diagram-${index}.svg`),
              diagram.svg,
            );
            try {
              await atomic(
                path.join(folder, `diagram-${index}.png`),
                await sharp(Buffer.from(diagram.svg)).png().toBuffer(),
              );
              visuals.push({
                type: 'mermaid',
                file: `diagram-${index}.png`,
                vector: `diagram-${index}.svg`,
                source: `diagram-${index}.mmd`,
              });
            } catch (e) {
              warnings.push(
                `图表${index}的PNG生成失败，SVG与源码保留：${e.message}`,
              );
            }
          } else
            warnings.push(`图表${index}渲染失败，源码保留：${diagram.error}`);
        }
        if (args.region)
          warnings.push('Markdown提供原文及独立图表，不使用PDF区域裁剪坐标。');
      }
      await atomic(path.join(folder, 'native.txt'), nativeText);
      await atomic(path.join(folder, 'ocr.txt'), ocrText);
      await atomic(
        path.join(folder, 'blocks.json'),
        JSON.stringify([...blocks, ...ocrBlocks]),
      );
      await atomic(
        path.join(folder, 'tables.json'),
        JSON.stringify(source.tables || []),
      );
      // OCR is supplementary: never replace or discard the original text channel.
      const text =
        nativeText && ocrText
          ? `[PDF/Markdown 原文]\n${nativeText}\n\n[OCR 补充，需核对原图]\n${ocrText}`
          : nativeText || ocrText;
      await atomic(path.join(folder, 'text.txt'), text);
      warnings.push(
        '未自动恢复PDF表格结构、公式LaTeX或图表数值；原文件不变，页面图/图表源码用于多模态复核，提取结果不保证无损。',
      );
      manifest = {
        version: 2,
        documentId: id,
        page,
        sourceRevision: description.sourceRevision,
        kind: source.kind,
        originalPreserved: true,
        region,
        created: new Date().toISOString(),
        cacheKey: key,
        width: source.width,
        height: source.height,
        scale: source.scale,
        nativeCharacters: nativeText.length,
        rasterImageCount: source.rasterImageCount || 0,
        ocrCharacters: ocrText.length,
        textCharacters: text.length,
        blockCount: blocks.length + ocrBlocks.length,
        tableCount: (source.tables || []).length,
        ocr,
        visuals,
        warnings,
        visualReviewRequired: true,
        files: [
          'native-full.txt',
          'native-blocks.json',
          'native.txt',
          'ocr.txt',
          'text.txt',
          'blocks.json',
          'tables.json',
        ],
      };
      await atomic(manifestFile, JSON.stringify(manifest, null, 2));
    }
    const common = {
      documentId: id,
      page,
      sourceRevision: manifest.sourceRevision,
      cached,
      manifestPath: manifestFile,
      visualReviewRequired: true,
    };
    const output = args.output || 'summary';
    if (output === 'image') {
      const visual = manifest.visuals[args.imageIndex || 0];
      if (!visual)
        throw Error(
          '本页没有可用的预处理图片，请读取manifest中的警告或使用截图工具',
        );
      if (!/^(?:page|region|diagram-\d+)\.png$/.test(visual.file))
        throw Error('预处理图片路径无效，请使用refresh重新生成');
      const imageFile = path.join(folder, visual.file);
      if ((await fs.stat(imageFile)).size > 64000000)
        throw Error('预处理图片过大');
      const image = await fs.readFile(imageFile);
      if (
        !image
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw Error('预处理图片格式无效');
      return {
        ...common,
        visual,
        imageBase64: image.toString('base64'),
      };
    }
    if (output === 'text') {
      const text = await fs.readFile(path.join(folder, 'text.txt'), 'utf8');
      const start = Math.min(args.start || 0, text.length);
      const end = Math.min(start + (args.maxChars || 8000), text.length);
      return {
        ...common,
        ocr: manifest.ocr,
        warnings: manifest.warnings,
        text: text.slice(start, end),
        range: { start, end, totalChars: text.length },
        hasMore: end < text.length,
        nextOffset: end < text.length ? end : null,
      };
    }
    if (output === 'blocks' || output === 'tables') {
      const items = JSON.parse(
        await fs.readFile(path.join(folder, output + '.json'), 'utf8'),
      );
      const start = Math.min(args.start || 0, items.length);
      const end = Math.min(start + 100, items.length);
      return {
        ...common,
        items: items.slice(start, end),
        total: items.length,
        nextOffset: end < items.length ? end : null,
      };
    }
    return { ...manifest, ...common };
  };
