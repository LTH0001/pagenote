import assert from 'node:assert/strict';
import { normalizeMath } from '../src/math-input.js';
assert.equal(normalizeMath(String.raw`均值 \(\mu\)`), '均值 $\\mu$');
assert.equal(normalizeMath(String.raw`均值 \\(\mu\\)`), '均值 $\\mu$');
assert.equal(normalizeMath(String.raw`均值 \\(\\mu\\)`), '均值 $\\mu$');
assert.equal(
  normalizeMath(String.raw`\\[\\frac{1}{2}\\]`),
  '\n\n$$\n\\frac{1}{2}\n$$\n\n',
);
const matrix = String.raw`\begin{pmatrix}1&2\\3&4\end{pmatrix}`;
assert.ok(normalizeMath('\\[' + matrix + '\\]').includes(matrix));
assert.ok(normalizeMath('\\\\[' + matrix + '\\\\]').includes(matrix));
const code =
  '````markdown\n```\n' + String.raw`\\[\\frac{1}{2}\\]` + '\n```\n````\n';
assert.equal(normalizeMath(code), code);
const inline = '`' + String.raw`\(\mu\)` + '`';
assert.equal(normalizeMath(inline), inline);
const incomplete = '```python\n' + String.raw`\[\mu\]`;
assert.equal(normalizeMath(incomplete), incomplete);
assert.equal(
  normalizeMath(String.raw`$$\begin{pmatrix}1\\2\end{pmatrix}$$`),
  String.raw`$$\begin{pmatrix}1\\2\end{pmatrix}$$`,
);
console.log(
  'PASS normal/doubled math delimiters, copied TeX commands, matrix row separators and protected code',
);
const inequality =
  String.raw`\frac{(\mathbf w^{\mathsf T}\boldsymbol\delta)^2}{\mathbf w^{\mathsf T}S_w\mathbf w}` +
  '\n' +
  String.raw`\le\boldsymbol\delta^{\mathsf T}S_w^{-1}\boldsymbol\delta.`;
assert.equal(
  normalizeMath('$$' + inequality + '$$'),
  '$$\n' + inequality + '\n$$',
);
assert.equal(
  normalizeMath('正文$$' + inequality + '$$后文'),
  '正文\n\n$$\n' + inequality + '\n$$\n\n后文',
);
assert.equal(
  normalizeMath(normalizeMath('$$' + inequality + '$$')),
  normalizeMath('$$' + inequality + '$$'),
);
for (const fence of ['```', '````', '~~~']) {
  const sample = fence + 'text\n$$' + inequality + '$$\n' + fence;
  assert.equal(normalizeMath(sample), sample);
}
assert.equal(normalizeMath('`$$a\nb$$`'), '`$$a\nb$$`');
assert.equal(
  normalizeMath('正文\n$$\n\\theta=1\n$$\n后文'),
  '正文\n\n$$\n\\theta=1\n$$\n\n后文',
);
assert.equal(
  normalizeMath('正文\r\n$$\r\n\\theta=1\r\n$$\r\n后文').replaceAll(
    '\r\n',
    '\n',
  ),
  '正文\n\n$$\n\\theta=1\n$$\n\n后文',
);
assert.equal(
  normalizeMath(String.raw`\$\$ a` + '\nb' + String.raw`\$\$`),
  String.raw`\$\$ a` + '\nb' + String.raw`\$\$`,
);
console.log(
  'PASS issue #1 adjacent multiline dollar delimiters, paragraph separation, idempotence and code preservation',
);
