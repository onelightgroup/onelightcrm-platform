// The client's name (BRAND_NAME) where users see one, written in from the templates brand.mjs left
// in the image build: required first thing by Twenty's server, worker and commands, so each
// container has it before anything reads those files. Without BRAND_NAME it's ours (brand.json).
// It never stops Twenty from starting: on any problem it says so and keeps the name it has.
const { readFileSync, renameSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

// safe in HTML, JSON and every kind of JavaScript string
const VALID = /^[\p{L}\p{N}][\p{L}\p{N} .-]{0,39}$/u;

try {
  const templates = join(__dirname, 'templates');
  const manifest = JSON.parse(readFileSync(join(templates, 'manifest.json'), 'utf8'));
  const wanted = (process.env.BRAND_NAME ?? '').trim();
  if (wanted && !VALID.test(wanted)) {
    console.warn(`BRAND_NAME ignored: up to 40 letters, digits, spaces, dots and hyphens, got ${JSON.stringify(wanted)}`);
  }
  const name = wanted && VALID.test(wanted) ? wanted : manifest.name;
  let written = 0;
  for (const file of manifest.files) {
    const content = readFileSync(join(templates, file), 'utf8').split(manifest.placeholder).join(name);
    const target = join(manifest.root, file);
    if (readFileSync(target, 'utf8') === content) continue;
    // whole files only: another process may be reading them
    const temporary = `${target}.brand-${process.pid}`;
    writeFileSync(temporary, content);
    renameSync(temporary, target);
    written += 1;
  }
  if (written) console.log(`brand: ${name} in ${written} files`);
} catch (error) {
  console.error(`brand: the client's name is not applied: ${error instanceof Error ? error.message : error}`);
}
