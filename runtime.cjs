// The client's name (BRAND_NAME) where users see one, and its logo where the web app shows one
// before the workspace's is loaded, written in from the templates brand.mjs left in the image
// build: required first thing by Twenty's server, worker and commands, so each container has them
// before anything reads those files. Without them they're ours (brand.json, our icon). It never
// stops Twenty from starting: on any problem it says so and keeps what it has.
// The logo is a file of the client's (logo.png, .svg, .jpg or .webp in ./client, which the
// client-logo component mounts), put among the web app's assets under a name of its content: the
// instance serves it, browsers keep it, nothing outside is asked. Without one, BRAND_LOGO (an https
// address) stands in.
const { createHash } = require('node:crypto');
const { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } = require('node:fs');
const { extname, join } = require('node:path');

// safe in HTML, JSON and every kind of JavaScript string
const VALID = /^[\p{L}\p{N}][\p{L}\p{N} .-]{0,39}$/u;
const VALID_LOGO = /^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9._~%\/-]*)?$/;

// the client's logo file, put among the assets once (its name is its content): its address, or ''
function clientLogo(manifest) {
  try {
    const folder = join(__dirname, 'client');
    if (!existsSync(folder)) return '';
    const file = readdirSync(folder).find((entry) => /^logo\.(png|svg|jpe?g|webp)$/i.test(entry));
    if (!file) return '';
    const bytes = readFileSync(join(folder, file));
    const asset = `client-logo-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}${extname(file).toLowerCase()}`;
    const target = join(manifest.root, manifest.assets ?? 'twenty-server/dist/front/assets', asset);
    if (!existsSync(target)) {
      const temporary = `${target}.brand-${process.pid}`;
      writeFileSync(temporary, bytes);
      renameSync(temporary, target);
    }
    // the page's own origin when SERVER_URL isn't set (a relative address is enough for <img>)
    return `${(process.env.SERVER_URL ?? '').trim().replace(/\/$/, '')}/assets/${asset}`;
  } catch (error) {
    console.error(`brand: the client's logo file is not served: ${error instanceof Error ? error.message : error}`);
    return '';
  }
}

try {
  const templates = join(__dirname, 'templates');
  const manifest = JSON.parse(readFileSync(join(templates, 'manifest.json'), 'utf8'));
  const wanted = (process.env.BRAND_NAME ?? '').trim();
  if (wanted && !VALID.test(wanted)) {
    console.warn(`BRAND_NAME ignored: up to 40 letters, digits, spaces, dots and hyphens, got ${JSON.stringify(wanted)}`);
  }
  const name = wanted && VALID.test(wanted) ? wanted : manifest.name;
  const address = (process.env.BRAND_LOGO ?? '').trim();
  if (address && !VALID_LOGO.test(address)) console.warn(`BRAND_LOGO ignored: an https address without a query, got ${JSON.stringify(address)}`);
  const logo = clientLogo(manifest) || (VALID_LOGO.test(address) ? address : '');
  let written = 0;
  for (const file of manifest.files) {
    const content = readFileSync(join(templates, file), 'utf8')
      .split(manifest.placeholder).join(name)
      .split(manifest.logoPlaceholder ?? '__BRAND_LOGO__').join(logo)
      .split(manifest.iconPlaceholder ?? '__BRAND_ICON__').join(logo || manifest.icon);
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
