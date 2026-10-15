import assert from 'node:assert/strict';
import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import { normalizeMath } from '../src/math-input.js';

const md = new Marked(
  { gfm: true },
  markedKatex({ throwOnError: false, nonStandard: true }),
);
const formula = String.raw`\frac{(\mathbf w^{\mathsf T}\boldsymbol\delta)^2}{\mathbf w^{\mathsf T}S_w\mathbf w}
\le\boldsymbol\delta^{\mathsf T}S_w^{-1}\boldsymbol\delta.`;
const displayCount = (text) =>
  (md.parse(normalizeMath(text)).match(/class="katex-display"/g) || []).length;
for (const newline of ['\n', '\r\n']) {
  const body = formula.replaceAll('\n', newline);
  assert.equal(displayCount('$$' + body + '$$'), 1, 'issue #1 renders');
  const normalized = normalizeMath('$$' + body + '$$');
  assert.equal(
    normalizeMath(normalized),
    normalized,
    'normalization is idempotent',
  );
}
assert.equal(displayCount('Before\n\n$$' + formula + '$$\n\nAfter'), 1);
assert.equal(displayCount('$$x=1$$\n\n$$' + formula + '$$'), 2);
assert.equal(displayCount('$$\n' + formula + '\n$$'), 1);
const matrix = String.raw`\begin{pmatrix}1&2\\
3&4\end{pmatrix}`;
assert.ok(normalizeMath('$$' + matrix + '$$').includes(matrix));
assert.equal(displayCount('$$' + matrix + '$$'), 1);
for (const code of [
  '```text\n$$' + formula + '$$\n```',
  '~~~~\n$$' + formula + '$$\n~~~~',
  '`$$x=1$$`',
  '```text\n$$' + formula + '$$',
]) {
  assert.equal(normalizeMath(code), code, 'code remains literal');
  assert.equal(displayCount(code), 0, 'code is not rendered as math');
}
for (const literal of ['$$x=1$$', '$$unclosed\nbody', '$5\n$10', '\\$$x\ny$$'])
  assert.equal(normalizeMath(literal), literal);
console.log(
  'PASS multiline dollar display math, LF/CRLF, matrix rows and protected code',
);
