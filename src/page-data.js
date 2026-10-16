import { Marked } from 'marked';
import { renderMarkdown } from './markdown';

// Preparation runs in the hidden document window, independent of reader zoom.
export async function preparePageData({ pdf, pdfjs, markdown, page }) {
  if (!pdf) {
    const tokens = new Marked().lexer(markdown);
    const tables = tokens
      .filter((t) => t.type === 'table')
      .map((t) => ({
        source: t.raw,
        headers: t.header.map((cell) => cell.text),
        rows: t.rows.map((row) => row.map((cell) => cell.text)),
      }));
    const diagrams = [];
    for (const token of tokens.filter(
      (t) => t.type === 'code' && t.lang?.trim().toLowerCase() === 'mermaid',
    )) {
      const host = document.createElement('div');
      host.style.cssText =
        'position:absolute;left:-100000px;top:0;width:1000px;';
      document.body.append(host);
      try {
        renderMarkdown(token.raw, host);
        const start = Date.now();
        while (
          !host.querySelector('.diagram-ready,.diagram-error,.diagram-empty')
        ) {
          if (Date.now() - start > 20000) throw Error('Mermaid 渲染超时');
          await new Promise((r) => setTimeout(r, 50));
        }
        const svg = host.querySelector('svg')?.outerHTML;
        diagrams.push({
          source: token.text,
          ...(svg ? { svg } : { error: 'Mermaid 未生成图片，请检查源码' }),
        });
      } catch (e) {
        diagrams.push({ source: token.text, error: e.message });
      } finally {
        host.remove();
      }
    }
    return {
      kind: 'markdown',
      nativeText: markdown,
      nativeBlocks: [],
      tables,
      diagrams,
    };
  }
  const source = await pdf.getPage(page);
  const base = source.getViewport({ scale: 1 });
  const scale = Math.min(2, Math.sqrt(16000000 / (base.width * base.height)));
  const viewport = source.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  try {
    await source.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
      background: '#ffffff',
    }).promise;
    const content = await source.getTextContent();
    const operators = await source.getOperatorList();
    const imageOps = new Set([
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageMaskXObject,
      pdfjs.OPS.paintImageXObjectRepeat,
    ]);
    const rasterImageCount = operators.fnArray.filter((op) =>
      imageOps.has(op),
    ).length;
    const nativeBlocks = content.items
      .filter((item) => typeof item.str === 'string')
      .map((item) => {
        const t = pdfjs.Util.transform(viewport.transform, item.transform);
        const length = Math.hypot(t[0], t[1]) || 1;
        const dx = (t[0] / length) * item.width * scale;
        const dy = (t[1] / length) * item.width * scale;
        const corners = [
          [t[4], t[5]],
          [t[4] + dx, t[5] + dy],
          [t[4] + t[2], t[5] + t[3]],
          [t[4] + dx + t[2], t[5] + dy + t[3]],
        ];
        const xs = corners.map((p) => p[0]),
          ys = corners.map((p) => p[1]);
        return {
          type: 'native-text',
          text: item.str,
          hasEOL: !!item.hasEOL,
          bbox: {
            x: (Math.min(...xs) / canvas.width) * 1000,
            y: (Math.min(...ys) / canvas.height) * 1000,
            width: ((Math.max(...xs) - Math.min(...xs)) / canvas.width) * 1000,
            height:
              ((Math.max(...ys) - Math.min(...ys)) / canvas.height) * 1000,
          },
        };
      });
    return {
      kind: 'pdf',
      rasterImageCount,
      width: canvas.width,
      height: canvas.height,
      scale,
      nativeText: nativeBlocks
        .map((b) => b.text + (b.hasEOL ? '\n' : ' '))
        .join(''),
      nativeBlocks,
      imageBase64: canvas.toDataURL('image/png').split(',')[1],
    };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
