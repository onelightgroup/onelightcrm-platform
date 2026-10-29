// The client's name (BRAND_NAME) where users see one, and its logo (BRAND_LOGO) where the web app
// shows one before the workspace's is loaded, written in from the templates brand.mjs left in the
// image build: required first thing by Twenty's server, worker and commands, so each container has
// them before anything reads those files. Without them they're ours (brand.json, our icon). It
// never stops Twenty from starting: on any problem it says so and keeps what it has.
const { readFileSync, renameSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

// safe in HTML, JSON and every kind of JavaScript string
const VALID = /^[\p{L}\p{N}][\p{L}\p{N} .-]{0,39}$/u;
const VALID_LOGO = /^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9._~%\/-]*)?$/;

try {
  const templates = join(__dirname, 'templates');
  const manifest = JSON.parse(readFileSync(join(templates, 'manifest.json'), 'utf8'));
  const wanted = (process.env.BRAND_NAME ?? '').trim();
  if (wanted && !VALID.test(wanted)) {
    console.warn(`BRAND_NAME ignored: up to 40 letters, digits, spaces, dots and hyphens, got ${JSON.stringify(wanted)}`);
  }
  const name = wanted && VALID.test(wanted) ? wanted : manifest.name;
  const logo = (process.env.BRAND_LOGO ?? '').trim();
  if (logo && !VALID_LOGO.test(logo)) console.warn(`BRAND_LOGO ignored: an https address without a query, got ${JSON.stringify(logo)}`);
  let written = 0;
  for (const file of manifest.files) {
    const content = readFileSync(join(templates, file), 'utf8')
      .split(manifest.placeholder).join(name)
      .split(manifest.logoPlaceholder ?? '__BRAND_LOGO__').join(VALID_LOGO.test(logo) ? logo : '');
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
