#!/usr/bin/env node
//
// Renders CHANGELOG.md into the standalone changelog.html served at
// https://factus10.github.io/transmission-updates/changelog.html — the page the
// app's "What's New" button opens (see UPDATE_MANIFEST_URL / openChangelogWindow
// in main.js).
//
// This lived nowhere for several releases and was hand-rebuilt each time, which
// is how the page's markup drifted from whatever produced it. It is checked in
// so a release is a command, not a reconstruction.
//
// Usage, from the repo root:
//   npm run changelog:html                    # writes dist/changelog.html
//   node scripts/generate-changelog-html.js CHANGELOG.md out.html
//
// Then copy the result over changelog.html in the transmission-updates repo and
// push. ALWAYS diff against the live page first:
//   curl -s https://factus10.github.io/transmission-updates/changelog.html > /tmp/live.html
//   diff /tmp/live.html out.html
// The only differences should be the new release's section, plus marked's
// "-1"/"-2" renumbering of the repeated Added/Fixed/Changed anchors below it —
// that shift is inherent to inserting a section and happens every release.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const mdPath = process.argv[2] || path.join(__dirname, '..', 'CHANGELOG.md');
const outPath = process.argv[3] || path.join(__dirname, '..', 'dist', 'changelog.html');

// CHANGELOG.md keeps an empty `## [Unreleased]` heading between releases, so
// entries have somewhere to land. On the published page — which is what the
// app's What's New button opens — that renders as an empty section above the
// newest release, which reads as though something is missing. Drop it when it
// has no content; leave it alone the moment it does, because then it is real
// news about what is coming.
//
// Done on the MARKDOWN, not the HTML: an empty section by definition contains
// no ### headings, so removing it cannot disturb marked's "-1"/"-2" dedupe of
// the repeated Added/Fixed anchors below it. Every other id on the page stays
// exactly as it was.
function dropEmptyUnreleased(md) {
  return md.replace(/^## \[Unreleased\]\s*\n\s*(?=^## )/ms, '');
}

// marked's DEFAULT options, deliberately. Its own slugger produced every anchor
// on the live page (including the repeat-heading dedupe); substituting a
// hand-rolled one silently rewrites every id on the page and breaks any link
// anyone has kept to a specific release.
const body = marked(dropEmptyUnreleased(fs.readFileSync(mdPath, 'utf8')), { gfm: true });

// Standalone by necessity: GitHub Pages serves this file on its own, and the
// app opens it in a bare BrowserWindow with no stylesheet of its own.
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transmission — What's New</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f5f5f5; --fg: #1a1a1a; --muted: #6b7280; --border: #e2e2e2;
    --code-bg: #eceef1; --link: #2563eb;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #1a1a1a; --fg: #f0f0f0; --muted: #9ca3af; --border: #333; --code-bg: #2a2a2a; --link: #6ea8fe; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 20px 80px;
    background: var(--bg); color: var(--fg);
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .subtitle { color: var(--muted); font-size: 14px; margin: 0 0 32px; }
  h2 {
    font-size: 19px; margin: 40px 0 8px; padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  h2:first-of-type { margin-top: 0; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 20px 0 8px; }
  ul { padding-left: 22px; margin: 8px 0; }
  li { margin: 8px 0; }
  p { margin: 8px 0; }
  code {
    background: var(--code-bg); border-radius: 4px; padding: 1px 5px;
    font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  a { color: var(--link); }
  strong { color: var(--fg); }
</style>
</head>
<body>
<div class="wrap">
<p class="subtitle">Transmission · what's changed, release by release</p>
${body}</div>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${html.length} bytes) from ${mdPath}`);
