import fs from 'node:fs/promises';
import { PNG } from 'pngjs';
// A source page flows into structured knowledge on the facing page.
const shapes = [];
const rect = (x, y, w, h, r, fill) =>
  shapes.push({ x, y, w, h, r, fill, kind: 'rect' });
const circle = (x, y, r, fill) =>
  shapes.push({ x, y, r, fill, kind: 'circle' });
rect(0, 0, 256, 256, 48, '#24465d');
rect(35, 47, 88, 162, 10, '#f4f8fb');
rect(133, 47, 88, 162, 10, '#ffffff');
rect(50, 70, 55, 9, 4.5, '#567b94');
for (const [y, w] of [
  [96, 55],
  [113, 44],
  [151, 55],
  [168, 44],
])
  rect(50, y, w, 6, 3, '#94adbd');
rect(149, 84, 3, 87, 1.5, '#a8d3d2');
for (const [y, w] of [
  [87, 43],
  [126, 34],
  [165, 43],
]) {
  circle(150.5, y, 5.5, '#218b8b');
  rect(163, y - 4, w, 8, 4, '#218b8b');
}
rect(109, 127, 33, 7, 3.5, '#218b8b');
shapes.push({
  kind: 'polygon',
  points: [
    [134, 120],
    [145, 130.5],
    [134, 141],
  ],
  fill: '#218b8b',
});
function contains(p, x, y) {
  if (p.kind === 'circle') return (x - p.x) ** 2 + (y - p.y) ** 2 <= p.r ** 2;
  if (p.kind === 'polygon') {
    const signs = p.points.map(([ax, ay], i) => {
      const [bx, by] = p.points[(i + 1) % 3];
      return (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    });
    return signs.every((v) => v >= 0) || signs.every((v) => v <= 0);
  }
  const cx = Math.max(p.x + p.r, Math.min(p.x + p.w - p.r, x)),
    cy = Math.max(p.y + p.r, Math.min(p.y + p.h - p.r, y));
  return (
    x >= p.x &&
    x <= p.x + p.w &&
    y >= p.y &&
    y <= p.y + p.h &&
    (x - cx) ** 2 + (y - cy) ** 2 <= p.r ** 2
  );
}
for (const p of shapes)
  p.rgb = p.fill.match(/\w\w/g).map((v) => parseInt(v, 16));
function raster(size) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let alpha = 0,
        rgb = [0, 0, 0];
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const px = ((x + (sx + 0.5) / 4) * 256) / size,
            py = ((y + (sy + 0.5) / 4) * 256) / size;
          const p = shapes.findLast((p) => contains(p, px, py));
          if (p) {
            alpha++;
            for (let c = 0; c < 3; c++) rgb[c] += p.rgb[c];
          }
        }
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++)
        png.data[i + c] = alpha ? Math.round(rgb[c] / alpha) : 0;
      png.data[i + 3] = Math.round((alpha * 255) / 16);
    }
  return PNG.sync.write(png);
}
const sizes = [16, 32, 48, 64, 128, 256],
  images = sizes.map(raster),
  header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const e = 6 + i * 16;
  header[e] = header[e + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(images[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">' +
  shapes
    .map((p) =>
      p.kind === 'rect'
        ? `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r}" fill="${p.fill}"/>`
        : p.kind === 'circle'
          ? `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.fill}"/>`
          : `<polygon points="${p.points.map((a) => a.join(',')).join(' ')}" fill="${p.fill}"/>`,
    )
    .join('') +
  '</svg>';
await fs.mkdir('build', { recursive: true });
await fs.writeFile('build/icon.ico', Buffer.concat([header, ...images]));
await fs.writeFile('build/icon.png', images.at(-1));
await fs.writeFile('build/icon.svg', svg);
