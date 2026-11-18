#!/usr/bin/env node
//
// Renders the user-facing documentation into a standalone HTML site for
// https://factus10.github.io/transmission/docs/ — the docs for people who USE
// Transmission, as opposed to the repo's own markdown.
//
// Usage, from the repo root:
//   npm run docs:html                       # writes dist/docs-site/
//   node scripts/generate-docs-site.js OUT   # writes OUT/
//
// Publishing is automatic: scripts/build-site.js calls this, and
// .github/workflows/pages.yml deploys the result.
//
// WHY GENERATED HTML RATHER THAN SERVING THE MARKDOWN: the site carries a
// .nojekyll file, so GitHub Pages would serve a .md as plain text rather than
// rendering it. Anyone following a docs URL from the app would get raw
// markdown. This mirrors what generate-changelog-html.js already does
// for CHANGELOG.md, and shares its styling so the two pages look like one site.
//
// PUBLISH is an explicit allow-list, never a directory walk. docs/ also holds
// the dev notes, the UI contract and the screenshot scripts — none
// of which belong on a public site, and a walk would ship them the moment
// someone adds a file.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = process.argv[2] || path.join(ROOT, 'dist', 'docs-site');

// Each entry: source path relative to docs/, the section it appears under on
// the index, and the one-line description shown there.
const PUBLISH = [
  { src: 'QUICK_START.md', section: 'Start here', blurb: 'The five-minute tour of the core loop.' },
  { src: 'RUNNING_AN_AUDIT.md', section: 'Start here', blurb: 'The opinionated engagement sequence — what to do in what order, and why the order matters.' },
  { src: 'USER_GUIDE.md', section: 'Start here', blurb: 'The full manual, feature by feature.' },
  { src: 'CONTENT_AUDIT_FRAMEWORK.md', section: 'Background', blurb: 'The thinking behind Migrate / Revise / Archive (formerly Keep / Kill / Evolve), and where the framework strains.' },
];
for (const f of fs.readdirSync(path.join(DOCS, 'walkthroughs')).filter(f => f.endsWith('.md')).sort()) {
  PUBLISH.push({ src: `walkthroughs/${f}`, section: 'Walkthroughs' });
}
for (const f of fs.readdirSync(path.join(DOCS, 'methodology')).filter(f => f.endsWith('.md')).sort()) {
  PUBLISH.push({ src: `methodology/${f}`, section: 'Methodology' });
}
for (const f of fs.readdirSync(path.join(DOCS, 'report-templates')).filter(f => f.endsWith('.md')).sort()) {
  PUBLISH.push({ src: `report-templates/${f}`, section: 'Report templates' });
}
// Non-markdown companions copied verbatim.
const ASSETS = ['methodology/kke-rubric-baseline.pdf'];

// SCREAMING_SNAKE filenames are fine in a repo and ugly in a URL, so each doc
// gets a kebab-case slug. README.md becomes the directory's index, which is
// what a link to `walkthroughs/` should land on.
function outPathFor(src) {
  const dir = path.dirname(src) === '.' ? '' : path.dirname(src) + '/';
  const base = path.basename(src, '.md');
  const name = base === 'README' ? 'index' : base.toLowerCase().replace(/_/g, '-');
  return `${dir}${name}.html`;
}

const bySrc = new Map(PUBLISH.map(d => [d.src, d]));
const dropped = [];   // links that pointed outside the published set

// Rewrite one href, resolved relative to the page it appears on. Returns null
// when the target is not published — the caller then keeps the link TEXT and
// throws the anchor away, because a public site should not advertise a 404.
function rewriteHref(href, fromSrc) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [target, hash] = href.split('#');
  const fromDir = path.dirname(fromSrc);
  const resolved = path.posix.normalize(path.posix.join(fromDir === '.' ? '' : fromDir, target || '.'));
  const suffix = hash ? '#' + hash : '';

  if (!target) return suffix;                       // bare "#anchor"
  if (ASSETS.includes(resolved)) return relative(fromSrc, resolved) + suffix;

  // A link to a directory ("walkthroughs/") means that directory's index.
  const asIndex = path.posix.join(resolved, 'README.md');
  const key = bySrc.has(resolved) ? resolved : (bySrc.has(asIndex) ? asIndex : null);
  if (!key) return null;
  return relative(fromSrc, outPathFor(key)) + suffix;
}

function relative(fromSrc, toOut) {
  const fromDir = path.dirname(outPathFor(fromSrc));
  const rel = path.posix.relative(fromDir === '.' ? '' : fromDir, toOut);
  return rel || path.posix.basename(toOut);
}

function rewriteLinks(html, fromSrc) {
  return html.replace(/<a href="([^"]+)">([\s\S]*?)<\/a>/g, (whole, href, text) => {
    const next = rewriteHref(href.replace(/&amp;/g, '&'), fromSrc);
    if (next === null) { dropped.push(`${fromSrc} → ${href}`); return text; }
    return `<a href="${next}">${text}</a>`;
  });
}

const CSS = `
  :root {
    color-scheme: light dark;
    --bg: #f5f5f5; --fg: #1a1a1a; --muted: #6b7280; --border: #e2e2e2;
    --code-bg: #eceef1; --link: #2563eb; --quote: #dfe3e8;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #1a1a1a; --fg: #f0f0f0; --muted: #9ca3af; --border: #333; --code-bg: #2a2a2a; --link: #6ea8fe; --quote: #2f2f2f; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px 96px;
    background: var(--bg); color: var(--fg);
    font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .wrap { max-width: 780px; margin: 0 auto; }
  nav.crumbs { font-size: 13px; color: var(--muted); margin: 0 0 28px; }
  nav.crumbs a { color: var(--muted); }
  h1 { font-size: 26px; margin: 0 0 18px; line-height: 1.25; }
  h2 { font-size: 20px; margin: 38px 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
  h3 { font-size: 16px; margin: 26px 0 6px; }
  h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 20px 0 6px; }
  p, li { margin: 8px 0; }
  ul, ol { padding-left: 22px; margin: 8px 0; }
  code { background: var(--code-bg); border-radius: 4px; padding: 1px 5px; font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre { background: var(--code-bg); border-radius: 6px; padding: 12px 14px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 14px 0; padding: 2px 16px; border-left: 3px solid var(--quote); color: var(--fg); }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; display: block; overflow-x: auto; }
  th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; vertical-align: top; font-size: 14px; }
  th { background: var(--code-bg); }
  hr { border: 0; border-top: 1px solid var(--border); margin: 32px 0; }
  a { color: var(--link); }
  img { max-width: 100%; }
  .index-section { margin: 30px 0 0; }
  .index-section h2 { margin-bottom: 12px; }
  .index-list { list-style: none; padding: 0; }
  .index-list li { margin: 10px 0; }
  .index-list .blurb { color: var(--muted); display: block; font-size: 14px; }
  footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid var(--border); color: var(--muted); font-size: 13px; }
`;

function page({ title, body, depth, crumbs }) {
  const up = depth ? '../'.repeat(depth) : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${/transmission/i.test(title) ? title : title + " — Transmission"}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
${crumbs === false ? '' : `<nav class="crumbs"><a href="${up}index.html">Transmission documentation</a></nav>`}
${body}
<footer>Transmission — content audit and migration platform. <a href="${up}../changelog.html">What's new</a></footer>
</div>
</body>
</html>
`;
}

// --- render ---------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
for (const doc of PUBLISH) {
  const md = fs.readFileSync(path.join(DOCS, doc.src), 'utf8');
  const body = rewriteLinks(marked(md, { gfm: true }), doc.src);
  const rel = outPathFor(doc.src);
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // The first heading is the page's own title; the <title> reuses it.
  const h1 = (md.match(/^#\s+(.+)$/m) || [null, doc.src])[1].replace(/[*`]/g, '');
  fs.writeFileSync(dest, page({ title: h1, body, depth: rel.includes('/') ? 1 : 0 }));
  doc.out = rel;
  doc.title = h1;
}
for (const a of ASSETS) {
  const dest = path.join(OUT, a);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(DOCS, a), dest);
}

// --- index ----------------------------------------------------------------
const SECTION_ORDER = ['Start here', 'Walkthroughs', 'Methodology', 'Report templates', 'Background'];
const SECTION_NOTE = {
  'Walkthroughs': 'One-page checklists for each stage of the lifecycle — the terse version of the User Guide.',
  'Methodology': 'Practice-level guidance behind the tool: the frameworks, the vocabulary, and how the decisions are meant to be made.',
  'Report templates': 'For customizing the briefs Transmission generates.',
};
let indexBody = `<h1>Transmission documentation</h1>
<p>Everything you need to run a content audit and migration in Transmission. New here? Start with the <a href="quick-start.html">Quick Start</a>, then <a href="running-an-audit.html">Running an Audit</a>.</p>
<p>Many examples come from higher education, but Transmission isn't specific to it: it works the same for any industry's site.</p>`;
for (const section of SECTION_ORDER) {
  // A section's own README is its overview, so it leads — alphabetically it
  // would sort behind the numbered walkthroughs and read as an afterthought.
  const items = PUBLISH.filter(d => d.section === section)
    .sort((a, b) => (path.basename(a.src) === 'README.md' ? -1 : 0) - (path.basename(b.src) === 'README.md' ? -1 : 0));
  if (!items.length) continue;
  indexBody += `\n<div class="index-section">\n<h2>${section}</h2>`;
  if (SECTION_NOTE[section]) indexBody += `\n<p>${SECTION_NOTE[section]}</p>`;
  indexBody += `\n<ul class="index-list">`;
  for (const d of items) {
    indexBody += `\n  <li><a href="${d.out}">${d.title}</a>${d.blurb ? `<span class="blurb">${d.blurb}</span>` : ''}</li>`;
  }
  indexBody += `\n</ul>\n</div>`;
}
fs.writeFileSync(path.join(OUT, 'index.html'), page({ title: 'Documentation', body: indexBody, depth: 0, crumbs: false }));

console.log(`Wrote ${PUBLISH.length} pages + ${ASSETS.length} asset(s) to ${OUT}`);
if (dropped.length) {
  console.log(`\nLinks to unpublished documents, kept as plain text:`);
  for (const d of dropped) console.log(`  ${d}`);
}
