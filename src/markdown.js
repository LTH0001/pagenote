import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import katex from 'katex';
import DOMPurify from 'dompurify';
import { codeLanguage, highlightCode } from './code-highlight';
import 'highlight.js/styles/github.css';

const md = new Marked(
  { gfm: true },
  markedKatex({ throwOnError: false, nonStandard: true }),
);
let mermaidPromise,
  diagramSequence = 0,
  diagramQueue = Promise.resolve();
const renderTimers = new WeakMap();
function getMermaid() {
  if (!mermaidPromise)
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: 'default',
        look: 'classic',
        htmlLabels: false,
        fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
        flowchart: { htmlLabels: false },
        maxTextSize: 100000,
      });
      return mermaid;
    });
  return mermaidPromise;
}
function normalizeMath(text) {
  return text
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(
              /\\\[([\s\S]*?)\\\]/g,
              (_, x) => '\n\n$$\n' + x + '\n$$\n\n',
            )
            .replace(/\\\(([\s\S]*?)\\\)/g, (_, x) => '$' + x + '$'),
    )
    .join('');
}
function diagramError(block, source, error) {
  block.replaceChildren();
  block.classList.add('diagram-error');
  const message = document.createElement('p');
  message.textContent = '图表语法暂时无法解析，请检查 Mermaid 代码。';
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '查看代码和错误';
  const pre = document.createElement('pre');
  pre.textContent =
    source + '\n\n' + String(error.message || error).slice(0, 1200);
  details.append(summary, pre);
  block.append(message, details);
}
function scheduleDiagrams(target) {
  [...target.querySelectorAll('pre > code.language-mermaid')].forEach(
    (code) => {
      const block = document.createElement('figure');
      block.className = 'mermaid-diagram';
      block.setAttribute('aria-label', 'Mermaid 图表');
      block.textContent = '正在绘制图表…';
      const source = code.textContent;
      block.dataset.source = source;
      if (code.parentElement.dataset.richId)
        block.dataset.richId = code.parentElement.dataset.richId;
      code.parentElement.replaceWith(block);
    },
  );
  target.querySelectorAll('.mermaid-diagram[data-source]').forEach((block) => {
    if (!block.dataset.source.trim()) {
      block.classList.remove('diagram-error', 'diagram-ready');
      block.classList.add('diagram-empty');
      block.replaceChildren();
      delete block.dataset.running;
    } else block.classList.remove('diagram-empty');
  });
  const blocks = [
    ...target.querySelectorAll(
      '.mermaid-diagram[data-source]:not(.diagram-ready):not(.diagram-error)',
    ),
  ]
    .filter((block) => block.dataset.source.trim() && !block.dataset.running)
    .map((block) => ({ block, source: block.dataset.source }));
  if (!blocks.length) return;
  clearTimeout(renderTimers.get(target));
  renderTimers.set(
    target,
    setTimeout(() => {
      for (const { block, source } of blocks) {
        const job = diagramQueue.then(async () => {
          if (!block.isConnected) return;
          block.dataset.running = 'true';
          try {
            const mermaid = await getMermaid();
            await document.fonts.ready;
            if (!block.isConnected) return;
            const { svg } = await mermaid.render(
              'page-diagram-' + ++diagramSequence,
              source,
            );
            if (!block.isConnected || block.dataset.source !== source) return;
            block.innerHTML = DOMPurify.sanitize(svg, {
              USE_PROFILES: { svg: true, svgFilters: true },
            });
            block.classList.add('diagram-ready');
          } catch (error) {
            if (block.isConnected && block.dataset.source === source)
              diagramError(block, source, error);
          }
        });
        diagramQueue = job.catch(() => {});
      }
    }, 160),
  );
}
export function renderDiagrams(target) {
  scheduleDiagrams(target);
}
export function renderMarkdown(text, target, depth = 0) {
  target.innerHTML = DOMPurify.sanitize(md.parse(normalizeMath(text)), {
    ADD_TAGS: ['annotation'],
    ADD_ATTR: ['target', 'encoding'],
  });
  target.querySelectorAll('a').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
  target.querySelectorAll('pre > code').forEach((code) => {
    const language = codeLanguage(
      [...code.classList].find((c) => c.startsWith('language-'))?.slice(9),
    );
    if (language) {
      for (const name of [...code.classList])
        if (name.startsWith('language-')) code.classList.remove(name);
      code.classList.add('language-' + language);
    }
    if (language === 'mermaid') return;
    if (['math', 'latex', 'tex'].includes(language)) {
      const block = document.createElement('div');
      block.className = 'math-block';
      block.innerHTML = DOMPurify.sanitize(
        katex.renderToString(code.textContent, {
          displayMode: true,
          throwOnError: false,
        }),
        { ADD_TAGS: ['annotation'], ADD_ATTR: ['encoding'] },
      );
      code.parentElement.replaceWith(block);
    } else highlightCode(code, code.textContent, language);
  });
  scheduleDiagrams(target);
  target.querySelectorAll('a,img').forEach((node) => {
    const url = node.getAttribute(node.tagName === 'IMG' ? 'src' : 'href');
    if (!/^\/attachments\/[a-f0-9-]+\.pdf(?:#.*)?$/i.test(url || '')) return;
    const frame = document.createElement('iframe');
    frame.className = 'embed-pdf';
    frame.src = url;
    frame.title = node.textContent || node.alt || 'PDF 附件';
    frame.loading = 'lazy';
    node.replaceWith(frame);
  });
  if (depth >= 2) return;
  target.querySelectorAll('img').forEach((node) => {
    const url = node.getAttribute('src');
    if (!/^\/attachments\/[a-f0-9-]+\.(md|markdown)$/i.test(url || '')) return;
    const block = document.createElement('div');
    block.className = 'markdown-embed';
    block.dataset.url = url;
    block.textContent = '加载 Markdown 附件…';
    node.replaceWith(block);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw Error('附件不存在');
        return r.text();
      })
      .then((text) => {
        if (block.isConnected) renderMarkdown(text, block, depth + 1);
      })
      .catch(() => (block.textContent = 'Markdown 附件加载失败'));
  });
}
