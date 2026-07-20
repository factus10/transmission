#!/usr/bin/env node
// Renders CHANGELOG.md into the changelog.html published at
// https://factus10.github.io/transmission-updates/changelog.html — the page the
// in-app "What's New" button opens.
//
// This existed as an ad-hoc snippet for earlier releases and was never checked
// in, which meant reconstructing it each time and risking drift in the page
// shell. It is checked in now.
//
//   node scripts/gen-changelog-html.js [outPath]
//
// Default outPath is ../transmission-updates/changelog.html relative to the repo
// root. Verify a change by regenerating a PREVIOUS release's CHANGELOG.md and
// diffing against the published file — it should come out byte-identical.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const repoRoot = path.resolve(__dirname, '..');
const mdPath = path.join(repoRoot, 'CHANGELOG.md');

// The sibling repo is a sibling of the MAIN clone, which is not the same as a
// sibling of `repoRoot` when this runs from a git worktree — worktrees live
// under .claude/worktrees/, so `../transmission-updates` resolves to a path
// that does not exist. Derive the main clone from the shared git dir instead.
function defaultOutPath() {
  try {
    const common = require('child_process')
      .execSync('git rev-parse --path-format=absolute --git-common-dir', { cwd: repoRoot })
      .toString().trim();
    const mainClone = path.dirname(common);           // .../transmission/.git -> .../transmission
    return path.resolve(mainClone, '..', 'transmission-updates', 'changelog.html');
  } catch (e) {
    return path.resolve(repoRoot, '..', 'transmission-updates', 'changelog.html');
  }
}

const outPath = process.argv[2] || defaultOutPath();
if (!fs.existsSync(path.dirname(outPath))) {
  console.error(`Target directory does not exist: ${path.dirname(outPath)}\n` +
    'Pass an explicit output path, e.g.\n' +
    '  node scripts/gen-changelog-html.js ~/path/to/transmission-updates/changelog.html');
  process.exit(1);
}

const HEAD = `<!doctype html>
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
`;

const TAIL = `</div>
</body>
</html>
`;

const md = fs.readFileSync(mdPath, 'utf8');
const html = marked.parse(md, { mangle: false, headerIds: true });

fs.writeFileSync(outPath, HEAD + html + TAIL);
console.log(`wrote ${outPath} (${(HEAD + html + TAIL).length} bytes)`);
