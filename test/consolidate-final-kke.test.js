// ════════════════════════════════════════════════════════════════════════════
// Consolidate follows the EFFECTIVE KKE (Final_KKE wins)
//
// Run with `npm test`. Same sandbox approach as sankey.test.js — see
// docs/dev/TESTING.md for why renderer.js is lifted by source text.
//
// WHAT THIS GUARDS. rowIsConsolidate() used to OR KKE_Recommendation with
// Final_KKE, so a client who overrode an auditor's "Consolidate" with "Keep" was
// silently ignored — the page kept its target, its consolidation redirect and
// its place in the consolidate worklists. Everything else in the engine already
// read Final_KKE first; this was the one consumer that didn't.
//
// The review worklist (consolidateReviewKind) is the other half: the cases where
// the client changed a consolidation and a person should look.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

const EXTRACTED = [
  'effectiveKke', 'rowIsConsolidate', 'rowMentionsConsolidate', 'rowHasInactiveConsolidateTarget',
  'rowConsolidateNeedsTarget', 'consolidateTargetAddr',
  'consolidateReviewSignature', 'consolidateReviewKindRaw', 'consolidateReviewKind',
  'markConsolidateReviewed', 'countConsolidateReview',
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
const CONSOLIDATE_COL = 'Consolidate_Into';
const CONSOLIDATE_ID_COL = '_ConsolidateTargetId';
function kkeCol() { return 'KKE_Recommendation'; }
function finalKkeCol() { return 'Final_KKE'; }
function smeNotesCol() { return 'SME_Notes'; }
var state = null;
`;

vm.runInThisContext(PRELUDE + '\n' + EXTRACTED.map(extract).join('\n\n'));

const T = 'https://example.edu/master';

function row(over) {
  return Object.assign({
    Address: 'https://example.edu/page', KKE_Recommendation: '', Final_KKE: '',
    SME_Notes: '', Consolidate_Into: '', _ConsolidateTargetId: '',
  }, over);
}
function setState(rows) {
  state = { editedRows: rows, urlColumn: 'Address', projectSettings: {} };
}

describe('extraction', () => {
  test('every lifted function is present', () => {
    for (const n of EXTRACTED) assert.equal(typeof globalThis[n], 'function', n);
  });
});

describe('rowIsConsolidate follows Final_KKE', () => {
  beforeEach(() => setState([]));

  test('recommendation alone still counts', () => {
    assert.equal(rowIsConsolidate(row({ KKE_Recommendation: 'Consolidate' })), true);
  });
  test('a client Keep overrides the recommendation', () => {
    const r = row({ KKE_Recommendation: 'Consolidate', Final_KKE: 'Keep', _ConsolidateTargetId: T });
    assert.equal(rowIsConsolidate(r), false);
    assert.equal(rowConsolidateNeedsTarget(r), false, 'an overridden consolidation is not a to-do');
    assert.equal(rowHasInactiveConsolidateTarget(r), true);
  });
  test('a client Consolidate over a Keep recommendation counts, and needs a target', () => {
    const r = row({ KKE_Recommendation: 'Keep', Final_KKE: 'Consolidate' });
    assert.equal(rowIsConsolidate(r), true);
    assert.equal(rowConsolidateNeedsTarget(r), true);
  });
  test('rowMentionsConsolidate still sees either column (for data migration)', () => {
    assert.equal(rowMentionsConsolidate(row({ KKE_Recommendation: 'Consolidate', Final_KKE: 'Keep' })), true);
  });
});

describe('consolidation review worklist', () => {
  test('client-consolidate: Final says Consolidate, recommendation did not', () => {
    const r = row({ KKE_Recommendation: 'Evolve', Final_KKE: 'Consolidate' });
    setState([r]);
    assert.equal(consolidateReviewKind(r), 'client-consolidate');
  });
  test('client-override only when an inactive target is left behind', () => {
    const withTarget = row({ KKE_Recommendation: 'Consolidate', Final_KKE: 'Keep', _ConsolidateTargetId: T });
    const without = row({ Address: 'https://example.edu/b', KKE_Recommendation: 'Consolidate', Final_KKE: 'Keep' });
    setState([withTarget, without]);
    assert.equal(consolidateReviewKind(withTarget), 'client-override');
    assert.equal(consolidateReviewKind(without), '');
  });
  test('client-notes: both agree but the SME commented', () => {
    const r = row({ KKE_Recommendation: 'Consolidate', Final_KKE: 'Consolidate', _ConsolidateTargetId: T, SME_Notes: 'merge into /about instead' });
    setState([r]);
    assert.equal(consolidateReviewKind(r), 'client-notes');
  });
  test('no Final_KKE means the client has not spoken — nothing to review', () => {
    const r = row({ KKE_Recommendation: 'Consolidate', SME_Notes: 'hm' });
    setState([r]);
    assert.equal(consolidateReviewKind(r), '');
  });
  test('reviewing clears a row until its decision changes', () => {
    const r = row({ KKE_Recommendation: 'Keep', Final_KKE: 'Consolidate', _ConsolidateTargetId: T });
    setState([r]);
    assert.equal(countConsolidateReview(), 1);
    markConsolidateReviewed(r);
    assert.equal(countConsolidateReview(), 0);
    r._ConsolidateTargetId = 'https://example.edu/other';
    assert.equal(consolidateReviewKind(r), 'client-consolidate', 'a new target is a new decision');
  });
});
