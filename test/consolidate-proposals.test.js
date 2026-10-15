// propose_changes with field Consolidate_Into: a consolidation always carries
// its target, and the server refuses the shapes the app's picker refuses.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mcp = require('../mcp/lib/project');
const { DatabaseSync } = mcp.sqlite();

const ROOT = path.join(__dirname, '..');

function liftSchemaSql() {
  const src = fs.readFileSync(path.join(ROOT, 'project-store.js'), 'utf8');
  const open = src.indexOf('this.db.exec(`', src.indexOf('_createSchema() {'));
  const close = src.indexOf('`);', open);
  const pStart = src.indexOf('const PROPOSALS_DDL = `');
  const pEnd = src.indexOf('`;', pStart);
  return src.slice(open + 'this.db.exec(`'.length, close) + '\n' + src.slice(pStart + 'const PROPOSALS_DDL = `'.length, pEnd);
}

const HEADERS = ['Address', 'Title 1', 'KKE_Recommendation', 'Final_KKE', 'Consolidate_Into', '_ConsolidateTargetId'];
const r = o => Object.assign(Object.fromEntries(HEADERS.map(h => [h, ''])), o);
const ROWS = [
  r({ Address: 'https://a.edu/programs', KKE_Recommendation: 'Keep' }),
  r({ Address: 'https://a.edu/programs/minor', KKE_Recommendation: '' }),
  r({ Address: 'https://a.edu/programs/old', KKE_Recommendation: 'Kill' }),
  // b consolidates into c, so proposing c → b is a loop.
  r({ Address: 'https://a.edu/b', KKE_Recommendation: 'Consolidate', _ConsolidateTargetId: 'https://a.edu/c' }),
  r({ Address: 'https://a.edu/c', KKE_Recommendation: 'Keep' }),
  r({ Address: 'https://a.edu/done', KKE_Recommendation: 'Consolidate', _ConsolidateTargetId: 'https://a.edu/programs' })
];

let dir, file;
test.before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cons-prop-'));
  file = path.join(dir, 'a.transmission');
  const db = new DatabaseSync(file);
  db.exec(liftSchemaSql());
  db.exec('PRAGMA user_version = 2;');
  HEADERS.forEach((h, i) => db.prepare('INSERT INTO headers (pos, name) VALUES (?, ?)').run(i, h));
  ROWS.forEach((x, i) => db.prepare('INSERT INTO rows (idx, data) VALUES (?, ?)').run(i, JSON.stringify(x)));
  db.close();
});
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const propose = changes => mcp.loadProject(file).proposeChanges({ changes, source: 'test' });
const ch = (url, target) => ({ url, field: 'Consolidate_Into', value: target, rationale: 'thin page; reads as a section of its parent' });

test('a valid consolidation is queued with the target normalised to its Address', () => {
  const res = propose([ch('https://a.edu/programs/minor', 'https://A.edu/programs/')]);
  assert.equal(res.queued, 1);
  const db = new DatabaseSync(file, { readOnly: true });
  const row = db.prepare("SELECT url, field, value FROM proposals WHERE url = 'https://a.edu/programs/minor'").get();
  db.close();
  assert.deepEqual({ ...row }, { url: 'https://a.edu/programs/minor', field: 'Consolidate_Into', value: 'https://a.edu/programs' });
});

test('self-consolidation fails the whole batch; nothing is written', () => {
  assert.throws(() => propose([ch('https://a.edu/c', 'https://a.edu/programs'), ch('https://a.edu/c', 'https://a.edu/c/')]), /cannot consolidate into itself/);
});

test('loops, dying targets, unknown targets and no-ops are skipped with a reason', () => {
  const res = propose([
    ch('https://a.edu/c', 'https://a.edu/b'),                 // b already → c
    ch('https://a.edu/programs/minor', 'https://a.edu/programs/old'),   // target is Kill
    ch('https://a.edu/programs/minor', 'https://elsewhere.org/x'),
    ch('https://a.edu/done', 'https://a.edu/programs')        // already there
  ]);
  assert.equal(res.queued, 0);
  assert.deepEqual(res.skipped.map(s => s.reason), [
    'the target already consolidates back into this page',
    'the target is marked Kill, so the content would have nowhere to land',
    'the target https://elsewhere.org/x is not a page in this audit',
    'already consolidating into that page'
  ]);
});

test('Consolidate without a target is still refused on the decision field', () => {
  assert.throws(() => propose([{ url: 'https://a.edu/programs/minor', field: 'KKE_Recommendation', value: 'Consolidate', rationale: 'x' }]), /cannot be "Consolidate"/);
});
