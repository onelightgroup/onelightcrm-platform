// The web app's icons (favicon, installed app, tiles) redrawn from assets/logo.svg, each at the size and
// path of Twenty's own: iOS ones full-bleed (iOS rounds them itself), other square ones the rounded
// logo, wide ones the logo centred on transparency.
// Usage: node icons.mjs <Twenty's images/icons> <output directory>
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import sharp from 'sharp';

const [from, to] = process.argv.slice(2);
const rounded = readFileSync(new URL('./assets/logo.svg', import.meta.url), 'utf8');
// the same mark on a square with no corners
const fullBleed = rounded.replace(/<path d="M0 16C[^"]*"/, '<path d="M0 0H64V64H0Z"');

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
const render = (svg, size) => sharp(Buffer.from(svg), { density: Math.max(72, (72 * size) / 64) }).resize(size, size).png().toBuffer();

let count = 0;
for (const path of walk(from).filter((file) => file.endsWith('.png'))) {
  const { width, height } = await sharp(path).metadata();
  const name = relative(from, path);
  const out = join(to, name);
  mkdirSync(dirname(out), { recursive: true });
  if (width === height) {
    const svg = name.startsWith('ios/') ? fullBleed : rounded;
    await sharp(await render(svg, width)).toFile(out);
  } else {
    const size = Math.round(Math.min(width, height) * 0.6);
    await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await render(rounded, size), gravity: 'center' }])
      .png()
      .toFile(out);
  }
  count += 1;
}
console.log(`${count} icons drawn`);
