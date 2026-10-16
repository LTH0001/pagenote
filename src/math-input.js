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
  text = text.replace(
    /(?<![\\$])\$\$(?!\$)([\s\S]*?)(?<!\\)\$\$(?!\$)/g,
    (match, body, offset, source) => {
      if (!body.includes('\n')) return match;
      const before = source.slice(0, offset),
        after = source.slice(offset + match.length);
      const prefix =
        !before || /(?:\r?\n){2}$/.test(before)
          ? ''
          : before.endsWith('\n')
            ? '\n'
            : '\n\n';
      const suffix =
        !after || /^(?:\r?\n){2}/.test(after)
          ? ''
          : /^\r?\n/.test(after)
            ? '\n'
            : '\n\n';
      return prefix + '$$\n' + body.trim() + '\n$$' + suffix;
    },
  );
  // Match doubled delimiters first, so their extra slash cannot escape Markdown.
  return text.replace(
    /(\\{1,2})(\[|\()([\s\S]*?)\1(\]|\))/g,
    (match, slash, open, body, close) => {
      if ((open === '[' && close !== ']') || (open === '(' && close !== ')'))
        return match;
      const value = mathBody(body, slash.length === 2);
      return open === '[' ? '\n\n$$\n' + value + '\n$$\n\n' : '$' + value + '$';
    },
  );
}
export function normalizeMath(text) {
  const lines = String(text).split(/(?<=\n)/);
  let fence = null,
    prose = '',
    output = '';
  const flush = () => {
    let offset = 0;
    for (const match of prose.matchAll(/(?<!`)(`+)(?!`)([\s\S]*?)\1(?!`)/g)) {
      output += proseMath(prose.slice(offset, match.index)) + match[0];
      offset = match.index + match[0].length;
    }
    output += proseMath(prose.slice(offset));
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
