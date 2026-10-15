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
