#!/usr/bin/env node
//
// Builds the public GitHub Pages site, https://factus10.github.io/transmission/,
// into one folder. .github/workflows/pages.yml runs it and deploys the result.
//
//   site/                      static files, copied as-is (landing page, .nojekyll)
//   docs/                      the user docs, via generate-docs-site.js
//   changelog.html             CHANGELOG.md, via generate-changelog-html.js
//   update-manifest.json       what every running copy checks for updates
//
// Usage, from the repo root:
//   gh api --paginate repos/factus10/transmission/releases > releases.json
//   node scripts/build-site.js --releases releases.json [OUT]   # default dist/site
//
// The site used to live in a separate public repo (factus10/transmission-updates)
// because this one was private. Copies of the app at 2.26.0 and earlier still
// check that repo's manifest; see "Update check" in CLAUDE.md.
//
// THE MANIFEST IS DERIVED, NEVER HAND-EDITED. It announces the newest release
// that is (a) published, not a draft or prerelease, (b) carries a dmg for
// both architectures, and (c) has a release-notes/<version>.txt on this branch.
// (c) is the "announce" switch: publish a release without its notes file and
// running copies are not told about it until the file lands on main. Every
// deploy (a docs edit, a release, a manual run) recomputes the manifest from
// GitHub's own release list, so it cannot drift from what is downloadable.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REPO = 'factus10/transmission';
const SITE_URL = 'https://factus10.github.io/transmission/';
const ARCHES = ['arm64', 'x64'];

function parseVersion(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(tag || ''));
  return m ? m.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Why a release can't be announced, or '' when it can. */
function announceBlocker(release, notesDir) {
  if (release.draft) return 'draft';
  if (release.prerelease) return 'prerelease';
  const v = parseVersion(release.tag_name);
  if (!v) return 'tag is not vX.Y.Z';
  const version = v.join('.');
  const names = (release.assets || []).map(a => a.name);
  for (const arch of ARCHES) {
    if (!names.includes(`Transmission-${version}-${arch}.dmg`)) return `no ${arch} dmg`;
  }
  if (!fs.existsSync(path.join(notesDir, `${version}.txt`))) return `no release-notes/${version}.txt`;
  return '';
}

/**
 * The manifest for the newest announceable release, or null when there is none.
 * `releases` is the GitHub API's release list (any order).
 */
function buildManifest(releases, notesDir) {
  const ok = releases
    .filter(r => !announceBlocker(r, notesDir))
    .sort((a, b) => compareVersions(parseVersion(b.tag_name), parseVersion(a.tag_name)));
  const r = ok[0];
  if (!r) return null;
  const version = parseVersion(r.tag_name).join('.');
  return {
    version,
    publishedAt: String(r.published_at || '').slice(0, 10),
    notes: fs.readFileSync(path.join(notesDir, `${version}.txt`), 'utf8').trim(),
    changelogUrl: `${SITE_URL}changelog.html`,
    downloadUrl: `https://github.com/${REPO}/releases/tag/${r.tag_name}`,
  };
}

/** Every `## [x.y.z]` section in CHANGELOG.md must reach the page, and nothing else. */
function checkChangelog(md, html) {
  const want = (md.match(/^## \[\d+\.\d+\.\d+\]/gm) || []).length;
  const got = (html.match(/<h2 id="\d+--/g) || []).length;
  if (want !== got) throw new Error(`changelog.html has ${got} release sections; CHANGELOG.md has ${want}`);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function main(argv) {
  let releasesFile = null, out = path.join(ROOT, 'dist', 'site');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--releases') releasesFile = argv[++i];
    else out = path.resolve(argv[i]);
  }
  if (!releasesFile) throw new Error('--releases <file> is required (gh api --paginate repos/' + REPO + '/releases)');

  fs.rmSync(out, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'site'), out);

  const node = process.execPath;
  execFileSync(node, [path.join(__dirname, 'generate-docs-site.js'), path.join(out, 'docs')], { stdio: 'inherit' });
  const md = path.join(ROOT, 'CHANGELOG.md');
  const changelog = path.join(out, 'changelog.html');
  execFileSync(node, [path.join(__dirname, 'generate-changelog-html.js'), md, changelog], { stdio: 'inherit' });
  checkChangelog(fs.readFileSync(md, 'utf8'), fs.readFileSync(changelog, 'utf8'));

  const releases = JSON.parse(fs.readFileSync(releasesFile, 'utf8'));
  const notesDir = path.join(ROOT, 'release-notes');
  const manifest = buildManifest(releases, notesDir);
  // Better no deploy than a site that tells every copy there is nothing new.
  if (!manifest) throw new Error('no release qualifies for the update manifest');
  // Say why anything NEWER than what's announced was passed over: that is the
  // release someone expected to see.
  const announced = parseVersion(manifest.version);
  for (const r of releases) {
    const v = parseVersion(r.tag_name);
    if (v && compareVersions(v, announced) > 0) console.log(`   not announcing ${r.tag_name}: ${announceBlocker(r, notesDir)}`);
  }
  if (!changelogHasVersion(fs.readFileSync(changelog, 'utf8'), manifest.version)) {
    throw new Error(`changelog.html has no section for ${manifest.version}`);
  }
  fs.writeFileSync(path.join(out, 'update-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`   manifest -> ${manifest.version}`);
  console.log(`   site written to ${out}`);
}

function changelogHasVersion(html, version) {
  return html.includes(`id="${version.replace(/\./g, '')}--`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { console.error(`build-site: ${e.message}`); process.exit(1); }
}

module.exports = { buildManifest, announceBlocker, checkChangelog, parseVersion, SITE_URL };
