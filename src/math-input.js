// Repair copied delimiter escaping only inside math, never across code blocks.
function mathBody(body, doubled) {
  const copied =
    doubled &&
    /\\\\(?:frac|sqrt|sum|int|mu|sigma|theta|alpha|beta|mathcal|mathbb|begin|end|text|left|right|sim)\b/.test(
      body,
    ) &&
    !/(^|[^\\])\\[a-zA-Z]/.test(body);
  return copied ? body.replace(/\\\\/g, '\\') : body;
}
function proseMath(text) {
  return text
    .replace(
      // The KaTeX extension accepts multiline display bodies only when the
      // delimiters occupy their own lines. Preserve TeX, including matrix rows.
      /^ {0,3}\$\$(?!\$)([\s\S]*?)\$\$[\t ]*(?=\r?$)/gm,
      (match, body) =>
        body.includes('\n') ? '$$\n' + body.trim() + '\n$$' : match,
    )
    .replace(
      // Match doubled TeX delimiters first so Markdown cannot escape them.
      /(\\{1,2})(\[|\()([\s\S]*?)\1(\]|\))/g,
      (match, slash, open, body, close) => {
        if ((open === '[' && close !== ']') || (open === '(' && close !== ')'))
          return match;
        const value = mathBody(body, slash.length === 2);
        return open === '['
          ? '\n\n$$\n' + value + '\n$$\n\n'
          : '$' + value + '$';
      },
    );
}
export function normalizeMath(text) {
  const lines = String(text).split(/(?<=\n)/);
  let fence = null,
    prose = '',
    output = '';
  const flush = () => {
    output += prose
      .split(/(`+[^`\n]*`+)/g)
      .map((s, i) => (i % 2 ? s : proseMath(s)))
      .join('');
    prose = '';
  };
  for (const line of lines) {
    const mark = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (!fence && mark) {
      flush();
      fence = mark[1];
      output += line;
    } else if (fence) {
      output += line;
      if (
        mark &&
        mark[1][0] === fence[0] &&
        mark[1].length >= fence.length &&
        /^ {0,3}(?:`+|~+)\s*$/.test(line.trimEnd())
      )
        fence = null;
    } else prose += line;
  }
  flush();
  return output;
}
