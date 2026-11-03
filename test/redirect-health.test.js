// ════════════════════════════════════════════════════════════════════════════
// Redirect health check ↔ redirect resolver — the loop that could not be fixed
//
// Run with `npm test`. Same sandbox approach as sankey.test.js — see that
// file's header for why renderer.js is lifted by source text rather than
// require()d, and for the extraction constraints that come with it.
//
// WHAT THIS GUARDS. The health check and the resolver are two halves of one
// contract: the check decides a redirect is wrong, the resolver decides what a
// redirect should be. When they disagreed about what counts as a loop, they
// undid each other — the check cleared a self-redirect, the very next autosave
// derived it straight back, and the loop looked unfixable from the UI. Worse,
// on a two-page consolidate cycle the "fix" turned one loop into two.
//
// So these tests always run the pair TOGETHER: classify → fix → save → classify
// again. A test that only asserts on computeRedirectHealth() would have passed
// throughout the entire period the bug existed.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

const EXTRACTED = [
  'redirectPathOf', 'isSelfRedirect',
  // Inherited (3xx) redirect carry-forward — the resolver now follows a target
  // that is itself an untriaged redirect, so these are real, not stubbed.
  'statusCodeCategory', 'statusCodeCol', 'nonContentKind', 'redirectUrlCol', 'crawlRedirectUrl',
  'buildRedirectResolverContext', 'resolveRedirectDestinations',
  'computeRedirectHealth', 'applyRedirectHealthFixes', 'writeRedirectDestination',
];

function extract(name) {
  const decl = '\nfunction ' + name + '(';
  const start = source.indexOf(decl);
  if (start < 0) {
    throw new Error(`renderer.js has no top-level "function ${name}(" — renamed, or no longer declared at column 0?`);
  }
  const end = source.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`could not find the closing brace of ${name}()`);
  return source.slice(start + 1, end + 3);
}

const PRELUDE = String.raw`
const REDIRECT_DEST_COL = 'Redirect_Destination';
const REDIRECT_SRC_COL = '_RedirectSource';
const CONSOLIDATE_COL = 'Consolidate_Into';
const CONSOLIDATE_ID_COL = '_ConsolidateTargetId';
function kkeCol() { return 'MRA_Recommendation'; }
function finalKkeCol() { return 'Final_MRA'; }
function consolidateTargetAddr(row) {
  return String(row['_ConsolidateTargetId'] || '').trim() || String(row['Consolidate_Into'] || '').trim();
}
function isFragmentRow(row) { return String(row['Content_Nature'] || '') === 'Fragment'; }
function getRedirectBaseUrl() { return 'https://example.edu'; }
function reportRows() { return state.editedRows; }
function logChange() {}
function setDirty() {}
function applyFilter() {}
function pushBulkEditUndo() {}
function escapeHtml(s) { return String(s); }
function showToast() {}
var _redirectEditorOpen = false;
var state = null;
`;

vm.runInThisContext(PRELUDE + '\n' + EXTRACTED.map(extract).join('\n\n'));

const A = 'https://example.edu/kines/alumni';
const B = 'https://example.edu/alumni';

function row(over) {
  return Object.assign({
    Address: '', MRA_Recommendation: '', Final_MRA: '',
    Redirect_Destination: '', _RedirectSource: '',
    _ConsolidateTargetId: '', Consolidate_Into: '', Content_Nature: '', 'Sitemap_ID': '',
  }, over);
}
function setState(rows, navNodes) {
  state = {
    editedRows: rows, rows, urlColumn: 'Address',
    navNodes: navNodes || [], projectSettings: {}, headers: [],
  };
}

/** The full user gesture: open the check, tick every fixable group, apply,
 *  then let the next autosave run. Returns the loops still standing. */
function fixAndSave() {
  const found = computeRedirectHealth();
  const before = found.self.length;
  applyRedirectHealthFixes(
    ['self', 'orphan', 'stale', 'settled'].map(k => ({ key: k, rows: found[k] })).filter(c => c.rows.length)
  );
  resolveRedirectDestinations();
  return { before, after: computeRedirectHealth().self.length };
}

describe('isSelfRedirect', () => {
  test('matches the same page however it is written', () => {
    assert.equal(isSelfRedirect(A, A), true);
    assert.equal(isSelfRedirect(A, A + '/'), true);
    assert.equal(isSelfRedirect(A, '/kines/alumni'), true, 'a relative destination means the same site');
    assert.equal(isSelfRedirect('https://www.example.edu/x', 'https://example.edu/x'), true, 'www. is the same host');
  });

  test('does not match a different page', () => {
    assert.equal(isSelfRedirect(A, B), false);
  });

  test('does not match the same path on another site', () => {
    // The case a path-only comparison gets wrong: on a consolidation this is a
    // real redirect between two properties, not a loop.
    assert.equal(isSelfRedirect('https://alpha.edu/about', 'https://beta.edu/about'), false);
  });

  test('a blank or an intentional 404 is not a loop', () => {
    assert.equal(isSelfRedirect(A, ''), false);
    assert.equal(isSelfRedirect(A, '404'), false);
  });
});

describe('a cleared loop stays cleared', () => {
  test('consolidate cycle — the case that turned one loop into two', () => {
    // A consolidates into B, B consolidates back into A. resolveFinalUrl bails
    // out of the cycle by returning the last URL it saw — which is the row's
    // own URL, i.e. a self-redirect.
    setState([
      row({ Address: A, MRA_Recommendation: 'Consolidate', _ConsolidateTargetId: B, Redirect_Destination: A, _RedirectSource: 'auto' }),
      row({ Address: B, MRA_Recommendation: 'Consolidate', _ConsolidateTargetId: A }),
    ]);
    const r = fixAndSave();
    assert.equal(r.before, 1, 'the loop should be found');
    assert.equal(r.after, 0, 'and must not come back on the next save');
    assert.equal(state.editedRows[0].Redirect_Destination, '');
  });

  test('kill page whose consolidate target chains back to it', () => {
    setState([
      row({ Address: A, MRA_Recommendation: 'Archive', _ConsolidateTargetId: B, Redirect_Destination: A, _RedirectSource: 'auto' }),
      row({ Address: B, MRA_Recommendation: 'Consolidate', _ConsolidateTargetId: A }),
    ]);
    const r = fixAndSave();
    assert.equal(r.before, 1);
    assert.equal(r.after, 0);
  });

  test('a loop already in the file self-heals on save, with no health check run', () => {
    // Unknown provenance — every file written before _RedirectSource existed.
    setState([
      row({ Address: A, MRA_Recommendation: 'Consolidate', _ConsolidateTargetId: B, Redirect_Destination: A, _RedirectSource: '' }),
      row({ Address: B, MRA_Recommendation: 'Consolidate', _ConsolidateTargetId: A }),
    ]);
    resolveRedirectDestinations();
    assert.equal(computeRedirectHealth().self.length, 0);
  });
});

describe('the fix does not overreach', () => {
  test('a real consolidate redirect is still derived', () => {
    setState([
      row({ Address: A, MRA_Recommendation: 'Consolidate', _ConsolidateTargetId: B }),
      row({ Address: B, MRA_Recommendation: 'Migrate' }),
    ]);
    resolveRedirectDestinations();
    assert.equal(state.editedRows[0].Redirect_Destination, B, 'A should still redirect to B');
    assert.equal(computeRedirectHealth().self.length, 0);
  });

  test('a hand-typed destination is never touched', () => {
    setState([
      row({ Address: A, MRA_Recommendation: 'Archive', Redirect_Destination: B, _RedirectSource: 'manual' }),
      row({ Address: B, MRA_Recommendation: 'Migrate' }),
    ]);
    resolveRedirectDestinations();
    assert.equal(state.editedRows[0].Redirect_Destination, B);
  });

  test('an intentional 404 survives', () => {
    setState([row({ Address: A, MRA_Recommendation: 'Archive', Redirect_Destination: '404', _RedirectSource: 'manual' })]);
    resolveRedirectDestinations();
    assert.equal(state.editedRows[0].Redirect_Destination, '404');
  });

  test('a cross-site redirect sharing a path is not treated as a loop', () => {
    setState([
      row({ Address: 'https://alpha.edu/about', MRA_Recommendation: 'Archive', Redirect_Destination: 'https://beta.edu/about', _RedirectSource: 'manual' }),
    ]);
    assert.equal(computeRedirectHealth().self.length, 0);
    resolveRedirectDestinations();
    assert.equal(state.editedRows[0].Redirect_Destination, 'https://beta.edu/about');
  });
});
