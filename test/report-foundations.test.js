// ════════════════════════════════════════════════════════════════════════════
// Report foundations — the shared definitions the reports now read
//
// Run with `npm test`. Same sandbox approach as the other suites — see
// docs/dev/TESTING.md. Background: docs/dev/REPORT_REVIEW.md.
//
// WHAT THIS GUARDS. Several reports used to re-derive these for themselves and
// drifted: the Redirect Map Report listed different rules from the CSV that got
// deployed, and three reports each had their own idea of a "net new" page. Each
// test pins one shared definition so a report can't quietly grow its own again.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

const EXTRACTED = [
  'effectiveKke', 'redirectEntryForRow', 'redirectRuleForRow', 'computeRedirectChains',
  'hasDescendantPages', 'navNodeContentStatus', 'navPageCounts',
];

function extract(name) {
  const start = source.indexOf('\nfunction ' + name + '(');
  if (start < 0) throw new Error(`renderer.js has no top-level "function ${name}(" — renamed, or no longer declared at column 0?`);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start + 1, end + 3);
}

const PRELUDE = String.raw`
const REDIRECT_DEST_COL = 'Redirect_Destination';
const SOURCE_SITE_COL = 'Source_Site';
function kkeCol() { return 'MRA_Recommendation'; }
function finalKkeCol() { return 'Final_MRA'; }
function decisionLabel(v) { return v; }   // display layer: MRA is the identity
function termAbbr() { return 'MRA'; }
function isFragmentRow(row) { return String(row.Content_Nature || '') === 'Fragment'; }
function reportRows() { return state.editedRows.filter(r => !r._outOfScope); }
var state = null;
`;
vm.runInThisContext(PRELUDE + '\n' + EXTRACTED.map(extract).join('\n\n'));

const U = (p) => 'https://old.edu' + p;
const row = (over) => Object.assign({ Address: '', MRA_Recommendation: '', Final_MRA: '', Redirect_Destination: '', Source_Site: '' }, over);
const setRows = (rows) => { state = { editedRows: rows, urlColumn: 'Address' }; };

describe('extraction', () => {
  test('every lifted function is present', () => {
    for (const n of EXTRACTED) assert.equal(typeof globalThis[n], 'function', n);
  });
});

describe('redirectEntryForRow — the one definition of a redirect rule', () => {
  setRows([]);
  test('the client\'s Final_MRA wins over the recommendation', () => {
    const kept = redirectEntryForRow(row({ Address: U('/a'), MRA_Recommendation: 'Archive', Final_MRA: 'Migrate' }));
    assert.equal(kept, null, 'recommended Kill, client kept it, nothing moves → no rule');
    const killed = redirectEntryForRow(row({ Address: U('/b'), MRA_Recommendation: 'Migrate', Final_MRA: 'Archive', Redirect_Destination: U('/x') }));
    assert.equal(killed.kind, 'archive');
  });
  test('the STORED destination is the rule (hand-typed or inherited), never Computed Path', () => {
    const e = redirectEntryForRow(row({ Address: U('/a'), MRA_Recommendation: 'Revise', Redirect_Destination: U('/typed'), 'Computed Path': 'elsewhere' }));
    assert.equal(e.dest, U('/typed'));
    assert.equal(e.kind, 'moved');
  });
  test('Consolidate is its own kind — and without a destination it is a TBD, not dropped', () => {
    assert.equal(redirectEntryForRow(row({ Address: U('/a'), MRA_Recommendation: 'Consolidate', Redirect_Destination: U('/m') })).kind, 'consolidate');
    const tbd = redirectEntryForRow(row({ Address: U('/b'), MRA_Recommendation: 'Consolidate' }));
    assert.equal(tbd.kind, 'tbd');
    assert.equal(tbd.status, '(TBD)');
  });
  test('404 sentinel, fragments, and pages that stay put', () => {
    assert.equal(redirectEntryForRow(row({ Address: U('/a'), MRA_Recommendation: 'Archive', Redirect_Destination: '404' })).kind, '404');
    assert.equal(redirectEntryForRow(row({ Address: U('/a'), MRA_Recommendation: 'Revise', Redirect_Destination: '404' })).kind, '404');
    assert.equal(redirectEntryForRow(row({ Address: U('/a'), MRA_Recommendation: 'Archive', Content_Nature: 'Fragment' })), null);
    assert.equal(redirectEntryForRow(row({ Address: U('/a'), MRA_Recommendation: 'Migrate' })), null);
  });
  test('the Tracker row shape is derived from the same entry', () => {
    assert.deepEqual(redirectRuleForRow(row({ Address: U('/a'), MRA_Recommendation: 'Archive' })), [U('/a'), '', '(TBD)', 'Archive, no destination set']);
    assert.deepEqual(redirectRuleForRow(row({ Address: U('/a'), MRA_Recommendation: 'Archive', Redirect_Destination: '404' }))[1], '(404)');
  });
});

describe('computeRedirectChains', () => {
  test('any 301 pointing at a page that is itself redirected, or going away with no destination', () => {
    setRows([
      row({ Address: U('/a'), MRA_Recommendation: 'Archive', Redirect_Destination: U('/b') }),
      row({ Address: U('/b'), MRA_Recommendation: 'Consolidate', Redirect_Destination: U('/c') }),   // a chain via Consolidate
      row({ Address: U('/c'), MRA_Recommendation: 'Migrate' }),
      row({ Address: U('/d'), MRA_Recommendation: 'Revise', Redirect_Destination: U('/e') }),
      row({ Address: U('/e'), MRA_Recommendation: 'Archive' }),                                          // going away, no destination
    ]);
    const chains = computeRedirectChains().map(c => [c.sourceUrl, c.destUrl]);
    assert.deepEqual(chains, [[U('/a'), U('/b')], [U('/d'), U('/e')]]);
  });
  test('out-of-scope sites are not checked', () => {
    setRows([
      row({ Address: U('/a'), MRA_Recommendation: 'Archive', Redirect_Destination: U('/b'), _outOfScope: true }),
      row({ Address: U('/b'), MRA_Recommendation: 'Archive', Redirect_Destination: U('/c') }),
    ]);
    assert.equal(computeRedirectChains().length, 0);
  });
});

describe('navNodeContentStatus — one definition of net new / empty', () => {
  const leaf = (id, extra) => Object.assign({ id, children: [] }, extra);
  const hub = { id: 'h', children: [leaf('c1')] };
  const counts = navPageCounts([
    row({ Sitemap_ID: 'c1', MRA_Recommendation: 'Migrate' }),
    row({ Sitemap_ID: 'k', MRA_Recommendation: 'Archive' }),          // being removed — doesn't count
  ]);
  test('hub, empty, and has-pages', () => {
    assert.equal(navNodeContentStatus(hub, counts), 'hub');
    assert.equal(navNodeContentStatus(leaf('c1'), counts), '');
    assert.equal(navNodeContentStatus(leaf('k'), counts), 'empty', 'a node whose only page is Kill is empty');
    assert.equal(navNodeContentStatus({ id: 'b', children: [leaf('x')] }, counts), 'empty', 'an empty branch is empty, like the tree\'s ○');
  });
  test('Header, Fragment, phased, external-link and alias nodes are never net new or empty', () => {
    for (const extra of [{ nodeType: 'Header' }, { nodeType: 'Fragment' }, { phase: 'Future' }, { url: 'https://x' }, { refNodeId: 'h' }]) {
      assert.equal(navNodeContentStatus(Object.assign({}, hub, extra), counts), '', JSON.stringify(extra));
      assert.equal(navNodeContentStatus(leaf('z', extra), counts), '', JSON.stringify(extra));
    }
  });
});
