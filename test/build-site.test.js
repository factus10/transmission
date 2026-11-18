// scripts/build-site.js: which release the update manifest announces.
//
// The manifest is what every running copy checks, so the rules for what may go
// in it are the ones worth pinning: never a draft, a prerelease, a release
// missing either dmg, or one without its release-notes file.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildManifest, announceBlocker, checkChangelog } = require('../scripts/build-site');

function notesDir(versions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-'));
  for (const v of versions) fs.writeFileSync(path.join(dir, `${v}.txt`), `Notes for ${v}.\n`);
  return dir;
}

function release(version, extra = {}) {
  return {
    tag_name: `v${version}`, draft: false, prerelease: false,
    published_at: '2026-11-16T12:00:00Z',
    assets: [
      { name: `Transmission-${version}-arm64.dmg` }, { name: `Transmission-${version}-x64.dmg` },
      { name: `Transmission-${version}-windows-x64-setup.exe` },
    ],
    ...extra,
  };
}

const macOnly = v => [{ name: `Transmission-${v}-arm64.dmg` }, { name: `Transmission-${v}-x64.dmg` }];

test('announces the newest qualifying release, compared numerically', () => {
  const dir = notesDir(['2.9.0', '2.10.0']);
  const m = buildManifest([release('2.9.0'), release('2.10.0')], dir);
  assert.strictEqual(m.version, '2.10.0');
  assert.strictEqual(m.notes, 'Notes for 2.10.0.');
  assert.strictEqual(m.publishedAt, '2026-11-16');
  assert.strictEqual(m.downloadUrl, 'https://github.com/factus10/transmission/releases/tag/v2.10.0');
  assert.strictEqual(m.changelogUrl, 'https://factus10.github.io/transmission/changelog.html');
});

test('a release without its notes file is published but not announced', () => {
  const dir = notesDir(['2.26.0']);
  const m = buildManifest([release('2.26.0'), release('2.27.0')], dir);
  assert.strictEqual(m.version, '2.26.0');
  assert.match(announceBlocker(release('2.27.0'), dir), /release-notes\/2\.27\.0\.txt/);
});

test('drafts, prereleases, odd tags and missing dmgs are never announced', () => {
  const dir = notesDir(['3.0.0', '2.26.0']);
  const cases = [
    release('3.0.0', { draft: true }),
    release('3.0.0', { prerelease: true }),
    release('3.0.0', { assets: [{ name: 'Transmission-3.0.0-arm64.dmg' }] }),
    { ...release('3.0.0'), tag_name: 'v3.0.0-beta' },
  ];
  for (const r of cases) {
    assert.ok(announceBlocker(r, dir), JSON.stringify(r));
    assert.strictEqual(buildManifest([r, release('2.26.0')], dir).version, '2.26.0');
  }
});

test('from 2.27.0 a release needs its Windows installer; earlier ones do not', () => {
  const dir = notesDir(['2.26.0', '2.27.0']);
  assert.strictEqual(announceBlocker(release('2.26.0', { assets: macOnly('2.26.0') }), dir), '');
  assert.strictEqual(announceBlocker(release('2.27.0', { assets: macOnly('2.27.0') }), dir), 'no Windows installer');
  const m = buildManifest([release('2.26.0', { assets: macOnly('2.26.0') }), release('2.27.0', { assets: macOnly('2.27.0') })], dir);
  assert.strictEqual(m.version, '2.26.0');
  assert.strictEqual(buildManifest([release('2.27.0')], dir).version, '2.27.0');
});

test('no qualifying release yields null, not an empty manifest', () => {
  assert.strictEqual(buildManifest([release('2.26.0', { draft: true })], notesDir(['2.26.0'])), null);
});

test('the changelog check counts release sections, ignoring Unreleased', () => {
  const md = '## [Unreleased]\n\n## [2.26.0] — x\n\n## [2.25.0] — y\n';
  checkChangelog(md, '<h2 id="unreleased">[Unreleased]</h2><h2 id="2260--x"></h2><h2 id="2250--y"></h2>');
  assert.throws(() => checkChangelog(md, '<h2 id="2260--x"></h2>'), /1 release sections; CHANGELOG\.md has 2/);
});
