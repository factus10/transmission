// ════════════════════════════════════════════════════════════════════════════
// Permanent row deletion — index bookkeeping and blast-radius reporting
//
// Run with `npm test`.
//
// This is the only destructive operation in the app, and the thing that makes
// it dangerous is not the splice — it's that EVERYTHING else addresses a row by
// its index into state.editedRows. These tests pin the bookkeeping: the two
// parallel arrays stay aligned, the selection follows the row it was on, and
// the index-addressed caches (undo, multi-select) are cleared rather than left
// pointing at whatever now occupies those slots.
//
// Uses the same source-lifting sandbox as the other suites — see the header of
// test/sankey.test.js for why renderer.js cannot be require()d.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

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
const CONSOLIDATE_COL = 'Consolidate_Into';
const CONSOLIDATE_ID_COL = '_ConsolidateTargetId';
var state = {};
var _undoStack = [];
var _redoStack = [];
var _sessionChangeLog = [];
var _globalSearchMatches = [];
var _globalSearchCurrent = -1;
var _tableViewOpen = false;
var _navEditorOpen = false;
var _calls = {};
function _note(k) { _calls[k] = (_calls[k] || 0) + 1; }
function logChange(origIndex, field, oldValue, newValue) {
  if (oldValue === newValue) return;
  _sessionChangeLog.push({ row: origIndex + 1, field, from: String(oldValue || ''), to: String(newValue || '') });
}
function effectiveKke(row) { return String(row['Final_KKE'] || row['KKE_Recommendation'] || '').trim(); }
function invalidateNavPageCountsCache() { _note('invalidateNav'); }
function detectDuplicates() { _note('detectDuplicates'); }
function setDirty(v) { _note('setDirty'); }
function applyFilter() { _note('applyFilter'); }
function updateMultiBar() { _note('updateMultiBar'); }
function showNoSelection() { _note('showNoSelection'); }
function renderTableView() { _note('renderTableView'); }
function renderNavEditor() { _note('renderNavEditor'); }
`;

vm.runInThisContext(PRELUDE + extract('consolidateTargetAddr') + extract('deleteRowsImpact') + extract('deleteRows'));

/** Build a project of N rows whose Address is https://x/p0 … p{N-1}. */
function seed(n, decorate) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = { Address: `https://x/p${i}`, 'Title 1': `Page ${i}` };
    if (decorate) decorate(r, i);
    rows.push(r);
  }
  state = {
    urlColumn: 'Address',
    rows: rows.map(r => ({ ...r })),
    editedRows: rows,
    selectedIndex: null,
    multiSelected: new Set(),
    filteredRows: [],
  };
  _undoStack = []; _redoStack = []; _sessionChangeLog = [];
  _globalSearchMatches = []; _globalSearchCurrent = -1;
  _calls = {};
  // The lifted code closes over the module-scope bindings, so re-point them.
  globalThis.state = state;
}

const addrs = () => state.editedRows.map(r => r.Address);

describe('deleteRows — which rows actually go', () => {
  test('removes exactly the named rows', () => {
    seed(5);
    assert.equal(deleteRows([1, 3]), 2);
    assert.deepEqual(addrs(), ['https://x/p0', 'https://x/p2', 'https://x/p4']);
  });

  test('non-contiguous indices in ASCENDING order still remove the right rows', () => {
    // The splice must run high-to-low. Low-to-high would shift the later
    // indices and take a neighbour instead.
    seed(6);
    deleteRows([0, 2, 4]);
    assert.deepEqual(addrs(), ['https://x/p1', 'https://x/p3', 'https://x/p5']);
  });

  test('state.rows stays index-parallel with state.editedRows', () => {
    seed(6);
    deleteRows([1, 4]);
    assert.deepEqual(state.rows.map(r => r.Address), addrs());
  });

  test('duplicate and out-of-range indices are ignored, not double-spliced', () => {
    seed(4);
    assert.equal(deleteRows([1, 1, 99, -1]), 1);
    assert.deepEqual(addrs(), ['https://x/p0', 'https://x/p2', 'https://x/p3']);
  });

  test('deleting nothing is a no-op', () => {
    seed(3);
    assert.equal(deleteRows([]), 0);
    assert.equal(state.editedRows.length, 3);
  });

  test('every row can be deleted', () => {
    seed(3);
    assert.equal(deleteRows([0, 1, 2]), 3);
    assert.deepEqual(addrs(), []);
    assert.deepEqual(state.rows, []);
  });
});

describe('deleteRows — the selection follows its row', () => {
  test('a surviving selection shifts down by the deletions above it', () => {
    seed(6);
    state.selectedIndex = 4;
    deleteRows([0, 2]);
    assert.equal(state.selectedIndex, 2);            // p4 moved from 4 to 2
    assert.equal(state.editedRows[2].Address, 'https://x/p4');
  });

  test('a selection below every deletion is untouched', () => {
    seed(6);
    state.selectedIndex = 1;
    deleteRows([3, 5]);
    assert.equal(state.selectedIndex, 1);
    assert.equal(state.editedRows[1].Address, 'https://x/p1');
  });

  test('deleting the selected row clears the selection rather than sliding it', () => {
    // Sliding would silently show a DIFFERENT page in the audit bar.
    seed(5);
    state.selectedIndex = 2;
    deleteRows([2]);
    assert.equal(state.selectedIndex, null);
    assert.equal(_calls.showNoSelection, 1);
  });
});

describe('deleteRows — index-addressed state is cleared, never left stale', () => {
  test('undo and redo stacks are dropped', () => {
    // A surviving entry would write its old value into whatever row now sits
    // at that index — silent corruption, and it would report success.
    seed(5);
    _undoStack.push({ origIndex: 4, field: 'KKE_Recommendation', oldValue: '', newValue: 'Kill' });
    _redoStack.push({ origIndex: 3, field: 'KKE_Recommendation', oldValue: '', newValue: 'Keep' });
    deleteRows([0]);
    assert.equal(_undoStack.length, 0);
    assert.equal(_redoStack.length, 0);
  });

  test('multi-selection and global-search matches are dropped', () => {
    seed(5);
    state.multiSelected = new Set([1, 2, 4]);
    _globalSearchMatches = [{ origIndex: 4 }];
    _globalSearchCurrent = 0;
    deleteRows([1]);
    assert.equal(state.multiSelected.size, 0);
    assert.deepEqual(_globalSearchMatches, []);
    assert.equal(_globalSearchCurrent, -1);
  });

  test('derived caches are invalidated and the file is marked dirty', () => {
    seed(4);
    deleteRows([0]);
    assert.equal(_calls.invalidateNav, 1);
    assert.equal(_calls.detectDuplicates, 1);
    assert.equal(_calls.setDirty, 1);
    assert.equal(_calls.applyFilter, 1);
  });
});

describe('deleteRows — the change log', () => {
  test('records one entry per deleted row, carrying its URL', () => {
    seed(4);
    deleteRows([2, 0]);
    assert.equal(_sessionChangeLog.length, 2);
    assert.deepEqual(_sessionChangeLog.map(e => e.from), ['https://x/p0', 'https://x/p2']);
    assert.ok(_sessionChangeLog.every(e => e.field === '(row deleted)'));
  });

  test('the URL is read BEFORE the splice, so it is never blank', () => {
    // logChange() reads the row out of state.editedRows by index; logging after
    // the splice would record the wrong URL or none at all.
    seed(3);
    deleteRows([0, 1, 2]);
    assert.deepEqual(_sessionChangeLog.map(e => e.from),
      ['https://x/p0', 'https://x/p1', 'https://x/p2']);
  });
});

describe('deleteRowsImpact — what the deletion breaks', () => {
  test('a survivor consolidating into a doomed row is reported as orphaned', () => {
    seed(4, (r, i) => {
      if (i === 1) { r._ConsolidateTargetId = 'https://x/p0'; r.KKE_Recommendation = 'Consolidate'; }
    });
    const impact = deleteRowsImpact([0]);
    assert.equal(impact.orphanedConsolidations.length, 1);
    assert.equal(impact.orphanedConsolidations[0].url, 'https://x/p1');
  });

  test('a target deleted TOGETHER with its sources is not an orphan', () => {
    // A whole section going away is not a dangling reference.
    seed(4, (r, i) => { if (i === 1) r._ConsolidateTargetId = 'https://x/p0'; });
    assert.equal(deleteRowsImpact([0, 1]).orphanedConsolidations.length, 0);
  });

  test('matching is case- and whitespace-tolerant on the Address', () => {
    seed(3, (r, i) => { if (i === 2) r._ConsolidateTargetId = '  HTTPS://X/P0 '; });
    assert.equal(deleteRowsImpact([0]).orphanedConsolidations.length, 1);
  });

  test('the legacy Consolidate_Into literal is honored when no identity is set', () => {
    seed(3, (r, i) => { if (i === 2) r.Consolidate_Into = 'https://x/p1'; });
    assert.equal(deleteRowsImpact([1]).orphanedConsolidations.length, 1);
  });

  test('counts placed, decided and redirect-carrying rows among the doomed', () => {
    seed(5, (r, i) => {
      if (i < 3) r.Sitemap_ID = 'N00' + i;
      if (i < 2) r.KKE_Recommendation = 'Keep';
      if (i === 0) r.Redirect_Destination = 'https://x/elsewhere';
    });
    const impact = deleteRowsImpact([0, 1, 2, 3]);
    assert.equal(impact.placed, 3);
    assert.equal(impact.decided, 2);
    assert.equal(impact.withRedirect, 1);
  });

  test('Final_KKE counts as a decision even when KKE_Recommendation is blank', () => {
    seed(2, (r, i) => { if (i === 0) r.Final_KKE = 'Evolve'; });
    assert.equal(deleteRowsImpact([0, 1]).decided, 1);
  });

  test('a clean deletion reports nothing to warn about', () => {
    seed(3);
    const impact = deleteRowsImpact([0, 1]);
    assert.equal(impact.orphanedConsolidations.length, 0);
    assert.equal(impact.placed, 0);
    assert.equal(impact.decided, 0);
    assert.equal(impact.withRedirect, 0);
  });
});

describe('the confirmation phrase', () => {
  test('is exactly what the dialog tells the user to type', () => {
    const m = source.match(/const DELETE_ROWS_PHRASE = '([^']+)'/);
    assert.ok(m, 'DELETE_ROWS_PHRASE is no longer declared');
    assert.equal(m[1], 'PERMANENTLY DELETE');
    // The dialog must interpolate the constant, never a hardcoded copy that
    // could drift from the string the handler compares against.
    assert.ok(source.includes('${DELETE_ROWS_PHRASE}</code> to confirm'),
      'the dialog no longer interpolates DELETE_ROWS_PHRASE into its instructions');
  });
});
