import hljs from 'highlight.js/lib/common';
import matlab from 'highlight.js/lib/languages/matlab';
import r from 'highlight.js/lib/languages/r';
import powershell from 'highlight.js/lib/languages/powershell';
hljs.registerLanguage('matlab', matlab);
hljs.registerLanguage('r', r);
hljs.registerLanguage('powershell', powershell);

const aliases = {
  python3: 'python',
  py3: 'python',
  'c++': 'cpp',
  'c#': 'csharp',
  javascriptreact: 'javascript',
  typescriptreact: 'typescript',
  shellscript: 'bash',
  console: 'shell',
  ps1: 'powershell',
};
export function codeLanguage(value = '') {
  const name = value.trim().toLowerCase();
  return aliases[name] || name;
}
export function highlightCode(code, text = code.textContent, language = '') {
  const name = codeLanguage(language);
  code.textContent = text;
  code.classList.remove('hljs');
  if (!name || !hljs.getLanguage(name)) return false;
  try {
    code.innerHTML = hljs.highlight(text, {
      language: name,
      ignoreIllegals: true,
    }).value;
    code.classList.add('hljs');
    return true;
  } catch {
    // A failed highlighter must never erase the code or stop the rest of a page.
    code.textContent = text;
    return false;
  }
}
