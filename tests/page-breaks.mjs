import assert from 'node:assert/strict';
import { splitPageNotes } from '../projects.mjs';
const separator = '\n\n<!-- pagebreak -->\n\n';
assert.deepEqual(
  splitPageNotes(Array(52).fill('').join(separator)),
  Array(52).fill(''),
);
const partiallyGenerated = Array(52).fill('');
partiallyGenerated[0] = '# 封面\n\n第一段。';
partiallyGenerated[5] = '# 第6页\n\n$$\np(x)=1\n$$';
partiallyGenerated[51] = '# 附录\n\n末页讲解。';
assert.deepEqual(
  splitPageNotes(partiallyGenerated.join(separator)),
  partiallyGenerated,
  'empty pages preserve exact page alignment around generated notes',
);
assert.deepEqual(
  splitPageNotes('前页\n<!-- pagebreak -->\n后页').map((s) => s.trim()),
  ['前页', '后页'],
);
assert.deepEqual(
  splitPageNotes(partiallyGenerated.join(separator).replaceAll('\n', '\r\n')),
  partiallyGenerated.map((s) => s.replaceAll('\n', '\r\n')),
);
console.log(
  'PASS 52 empty pages, partial generation, single-line markers and Windows newlines',
);
