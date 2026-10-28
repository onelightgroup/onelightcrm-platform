// Our branding (brand.json) on a built Twenty (the image's /app/packages), run once in the image
// build: nothing goes to Twenty's own services, and users see a name where Twenty named itself (the
// web app and its translations, emails, the AI chat). That name is the client's: the files keep a
// placeholder in a copy (the templates directory) that runtime.cjs fills from BRAND_NAME when Twenty
// starts, and ours until then. Links, the logo and the email footer stay ours. Every rule expects
// its matches, so when an upgrade moves or rewords something the build fails naming the rule
// instead of shipping half of it. Settings pages only workspace admins see (that's us) are left
// as they are.
// Usage: node brand.mjs [packages directory] [templates directory]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';

const brand = JSON.parse(readFileSync(new URL('./brand.json', import.meta.url), 'utf8'));
const root = process.argv[2] ?? '/app/packages';
const templates = process.argv[3] ?? '/app/brand/templates';
// where the client's name goes; runtime.cjs writes it in, brand.name until then
const NAME = '__BRAND_NAME__';
const server = `${root}/twenty-server/dist`;
const front = `${server}/front`;
const emails = `${root}/twenty-emails/dist`;
const shared = `${root}/twenty-shared/dist`;

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
const code = (path) => /\.(m?js|html|json)$/.test(path) && !path.endsWith('.d.ts');
const files = [...walk(server), ...walk(emails), ...walk(shared)].filter(code);

const contents = new Map();
const read = (path) => contents.get(path) ?? readFileSync(path, 'utf8');
const failures = [];
const report = [];

// replaces `from` (a string, or a global regex) in `paths`; `expected` is the total number of
// matches, or 'some' for at least one
const rule = (name, paths, from, to, expected) => {
  const pattern = typeof from === 'string' ? new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : from;
  let count = 0;
  for (const path of paths) {
    const before = read(path);
    const after = before.replace(pattern, (...match) => {
      count += 1;
      return typeof to === 'function' ? to(...match) : to;
    });
    if (after !== before) contents.set(path, after);
  }
  const ok = expected === 'some' ? count > 0 : count === expected;
  report.push(`${ok ? '✓' : '✗'} ${name}: ${count}${ok ? '' : ` (expected ${expected})`}`);
  if (!ok) failures.push(name);
};

const inDir = (dir, test = () => true) => files.filter((path) => path.startsWith(`${dir}/`) && test(path));
const named = (dir, pattern) => inDir(dir, (path) => pattern.test(relative(dir, path)));
const word = /\bTwenty\b/g;
// an image of ours, from the instance itself: the web app's origin, or SERVER_URL in emails
const icon = '/images/icons/android/android-launchericon-192-192.png';
const webIcon = `(window.location.origin+"${icon}")`;
const mailIcon = (path) => `((process.env.SERVER_URL||"").replace(/\\/$/,"")+"${path}")`;

// the page itself: title, link previews, the installed app
rule('page title', [`${front}/index.html`], '<title>Twenty</title>', `<title>${NAME}</title>`, 1);
rule('page previews', [`${front}/index.html`], 'content="Twenty"', `content="${NAME}"`, 2);
rule('page description', [`${front}/index.html`], 'A modern open-source CRM', brand.description, 3);
rule('preview images (Twenty\'s)', [`${front}/index.html`], /\n\s*<meta\s+(?:property="og:image"|name="twitter:image")\s+content="[^"]*"\s*\/>/g, '', 2);
rule('app manifest', [`${front}/manifest.json`], /"(short_name|name)": "Twenty"/g, (_, key) => `"${key}": "${NAME}"`, 2);

// the web app's translations (every language writes the name in Latin letters)
const catalogs = inDir(front, (path) => /^var \w+=JSON\.parse\(`\{"/.test(read(path).slice(0, 40)));
rule('web app translations', catalogs, word, NAME, 'some');

// the web app's own strings and links
const assets = inDir(`${front}/assets`);
rule('page title fallback', assets, 'default:return"Twenty"}', `default:return"${NAME}"}`, 1);
rule('timeline: changes without a person', assets, '.lastName}`:"Twenty"', `.lastName}\`:"${NAME}"`, 1);
rule('sign-in legal links', assets, 'lo="https://twenty.com"', `lo="${brand.legal}"`, 1);
rule('sign-in legal links, without a language', assets, 'return new URL(a?`/${n}/${t}`:`/${t}`,lo).toString()', 'return new URL(`/${t}`,lo).toString()', 1);
rule('workspace logo placeholder', assets, '"https://twentyhq.github.io/placeholder-images/workspaces/twenty-logo.png"', webIcon, 10);
rule('people placeholders (email sync)', assets, /`https:\/\/twentyhq\.github\.io\/placeholder-images\/people\/image-\$\{\w+\}\.png`/g, webIcon, 1);
rule('data processing agreement link', assets, '"https://twenty.com/legal/dpa"', `"${brand.legal}/legal/dpa"`, 1);
rule('help links', [...assets, ...inDir(shared)], /"https:\/\/docs\.twenty\.com(?:\/[^"]*)?"/g, `"${brand.help}"`, 3);
// company logos from the instance itself (the enrichment module's icons route), not Twenty's service
rule('company logos', [...assets, ...inDir(shared)], 'https://twenty-icons.com', brand.icons, 5);

// emails: logo, footer and text
const emailCode = named(emails, /^index\.m?js$/);
rule('email logo', emailCode, '"https://app.twenty.com/images/icons/windows11/Square150x150Logo.scale-100.png"', mailIcon('/images/icons/windows11/Square150x150Logo.scale-100.png'), 2);
rule('email workspace placeholder', emailCode, '"https://twentyhq.github.io/placeholder-images/workspaces/twenty-logo.png"', mailIcon(icon), 2);
rule('email footer: website', emailCode, 'href: "https://twenty.com/"', `href: "${brand.website}"`, 2);
rule('email footer: source', emailCode, 'href: "https://github.com/twentyhq/twenty"', `href: "${brand.source || brand.website}"`, 2);
rule('email footer: guides', emailCode, /href: "https:\/\/docs\.twenty\.com\/[^"]*"/g, `href: "${brand.help}"`, 4);
rule('email footer: operator', emailCode, 'i18n._("Twenty.com, Public Benefit Corporation")', JSON.stringify(brand.operator), 2);
rule('email footer: place', emailCode, 'i18n._("San Francisco / Paris")', JSON.stringify(brand.website.replace(/^https:\/\//, '')), 2);
rule('email text', emailCode, word, NAME, 26);
rule('email translations', named(emails, /^locales\/generated\/[^/]+\.m?js$/), word, NAME, 'some');

// the server: its messages (email subjects among them), the AI chat and agents
const serverCode = inDir(server, (path) => !path.startsWith(`${front}/`));
rule('server translations', named(server, /^engine\/core-modules\/i18n\/locales\/generated\/[^/]+\.js$/), word, NAME, 'some');
rule('server messages', serverCode, /message: "[^"\n]*\bTwenty\b[^"\n]*"/g, (match) => match.replace(word, NAME), 8);
const prompts = named(server, /^engine\/metadata-modules\/ai\/(ai-chat\/constants\/(chat-system-prompts\.const|workspace-setup(-alternative)?-system-prompt\.constant)|ai-agent\/constants\/agent-run-base-system-prompt\.const|ai-agent-trigger\/constants\/agent-trigger-base-system-prompt\.const)\.js$/);
rule('AI prompts', prompts, word, NAME, 22);
// the chat's help search sends the question to Twenty's documentation server: not offered, not
// callable by name, not preloaded (the chat and MCP clients)
const actionTools = named(server, /^engine\/core-modules\/tool-provider\/providers\/action-tool\.provider\.js$/);
rule('AI help search (off)', actionTools, /\n\s*descriptors\.push\(this\.buildDescriptor\('search_help_center', [^\n]*\);/g, '', 1);
rule('AI help search, by name (off)', actionTools, /\n\s*\[\n\s*'search_help_center',\n\s*this\.searchHelpCenterTool\n\s*\],/g, '', 1);
rule('AI help search, preloaded (off)', named(server, /^engine\/core-modules\/tool-provider\/constants\/common-preload-tools\.const\.js$/),
  /const COMMON_PRELOAD_TOOLS = \[\n\s*'search_help_center'\n\];/g, 'const COMMON_PRELOAD_TOOLS = [];', 1);

// the MCP server: its name, its instructions to the client's model, its card for directories
rule('MCP server name', named(server, /^engine\/api\/mcp\/constants\/mcp-server-info\.const\.js$/), "name: 'Twenty MCP Server'", `name: '${NAME} MCP Server'`, 1);
rule('MCP instructions', named(server, /^engine\/api\/mcp\/utils\/build-mcp-server-instructions\.util\.js$/), word, NAME, 3);
const mcpCard = named(server, /^engine\/core-modules\/well-known\/utils\/build-mcp-server-card\.util\.js$/);
rule('MCP card: website', mcpCard, "'https://twenty.com'", `'${brand.website}'`, 1);
rule('MCP card: name', mcpCard, /\bTwenty CRM\b/g, NAME, 2);
// a registry name is reverse DNS: our website's host, then the product
const host = new URL(brand.website).hostname.split('.').reverse().join('.');
const registryName = `${host}/${brand.name.toLowerCase()}`;
rule('MCP card: registry name', mcpCard, "name: 'com.twenty/twenty'", `name: '${registryName}'`, 1);
rule('MCP card: source', mcpCard, "url: 'https://github.com/twentyhq/twenty'", `url: '${brand.source || brand.website}'`, 1);

// the client's name goes in before anything reads those files: first thing in Twenty's server, its
// worker and its commands
const entries = ['main.js', 'queue-worker/queue-worker.js', 'command/command.js'].map((path) => `${server}/${path}`);
const runtime = join(dirname(templates), 'runtime.cjs');
rule('client name at start', entries, /^"use strict";\n/g, `"use strict";\nrequire(${JSON.stringify(runtime)});\n`, 3);

// translations are data: the name must be gone from all of them
for (const [name, paths] of [['web app', catalogs], ['emails', named(emails, /^locales\/generated\/[^/]+\.m?js$/)], ['server', named(server, /^engine\/core-modules\/i18n\/locales\/generated\/[^/]+\.js$/)]]) {
  const left = paths.filter((path) => /\bTwenty\b/.test(read(path)));
  report.push(`${left.length ? '✗' : '✓'} no Twenty left in ${name} translations${left.length ? `: ${left.map((path) => basename(path)).join(', ')}` : ''}`);
  if (left.length) failures.push(`${name} translations`);
}

console.log(report.join('\n'));
if (failures.length) {
  console.error(`\n${failures.length} rule(s) found something else than expected: Twenty changed there.`);
  process.exit(1);
}

// write (a file with the client's name also as its template, for runtime.cjs), then make sure every
// changed script still parses
const scratch = mkdtempSync(join(tmpdir(), 'brand-'));
const withName = [];
for (const [path, template] of contents) {
  const content = template.split(NAME).join(brand.name);
  if (content !== template) {
    const copy = join(templates, relative(root, path));
    mkdirSync(dirname(copy), { recursive: true });
    writeFileSync(copy, template);
    withName.push(relative(root, path));
  }
  writeFileSync(path, content);
  if (!/\.m?js$/.test(path)) continue;
  // the web app's chunks are ES modules whatever their extension says
  const checked = path.startsWith(`${front}/`) ? join(scratch, `${basename(path)}.mjs`) : path;
  if (checked !== path) copyFileSync(path, checked);
  execFileSync(process.execPath, ['--check', checked], { stdio: 'inherit' });
}
mkdirSync(templates, { recursive: true });
writeFileSync(join(templates, 'manifest.json'), `${JSON.stringify({ root, placeholder: NAME, name: brand.name, files: withName }, null, 2)}\n`);
console.log(`\n${contents.size} files branded and checked, ${withName.length} of them name the client`);

// what still names Twenty's sites in the web app (admin settings, by design)
const left = new Map();
for (const path of assets) {
  for (const [url] of read(path).matchAll(/https?:\/\/[a-z0-9.-]*twenty[a-z0-9.-]*\.[a-z]+[^"'`\s)]*/gi)) {
    left.set(url, [...(left.get(url) ?? []), basename(path)]);
  }
}
if (left.size) console.log(`still in the web app:\n${[...left].map(([url, where]) => `  ${url}  (${[...new Set(where)].join(', ')})`).join('\n')}`);
