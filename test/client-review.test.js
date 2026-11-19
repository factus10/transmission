// ════════════════════════════════════════════════════════════════════════════
// Client review — the auditor's question to the client
//
// Run with `npm test`.
//
// Pins the rules from docs/dev/CLIENT_REVIEW_PROPOSAL.md: an item is OPEN until
// the SME answers (worked out, never stored), "Reviewed, undecided" means a
// Needs-decision row nobody has decided since, priority and reason only mean
// something beside a status, and the progress numbers keep "nobody looked"
// apart from "looked, waiting on the client".
//
// Uses the same source-lifting sandbox as the other suites — see the header of
// test/sankey.test.js.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');

function extract(name) {
  const decl = '\nfunction ' + name + '(';
  const start = source.indexOf(decl);
  if (start < 0) throw new Error(`renderer.js has no top-level "function ${name}("`);
  const end = source.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`could not find the closing brace of ${name}()`);
  return source.slice(start + 1, end + 3);
}

function extractConst(name) {
  const decl = '\nconst ' + name + ' ';
  const start = source.indexOf(decl);
  if (start < 0) throw new Error(`renderer.js has no top-level "const ${name}"`);
  const end = source.indexOf(';\n', start);
  return source.slice(start + 1, end + 2);
}

const PRELUDE = String.raw`
var state = {};
var _log = [];
var _undo = [];
var _dirty = false;
const BUILTIN_KKE = ['Migrate', 'Archive', 'Revise', 'Consolidate', 'Exclude'];
function kkeCol() { return 'MRA_Recommendation'; }
function tagsCol() { return 'Tags'; }
function notesCol() { return 'Notes'; }
function groupCol() { return 'Group'; }
function finalKkeCol() { return 'Final_MRA'; }
function smeDecisionCol() { return 'SME_Decision'; }
function logChange(i, field, from, to) { if (from !== to) _log.push({ i, field, from, to }); }
function pushBulkEditUndo(items, label) { if (items.length) _undo.push({ label, items }); }
function setDirty(v) { _dirty = v; }
`;

vm.runInThisContext(
  PRELUDE +
  ['CLIENT_REVIEW_COL', 'CLIENT_REVIEW_PRIORITY_COL', 'CLIENT_REVIEW_REASON_COL',
   'CLIENT_REVIEW_STATUSES', 'DEFAULT_CLIENT_REVIEW_REASONS'].map(extractConst).join('') +
  extract('parseSmeDecision') +
  extract('effectiveKke') +
  extract('clientReviewStatus') +
  extract('clientReviewIsUrgent') +
  extract('clientReviewIsOpen') +
  extract('clientReviewAwaitingDecision') +
  extract('clientReviewSortRank') +
  extract('clientReviewReasons') +
  extract('setClientReview') +
  // Progress counts, with their real dependencies
  extract('statusCodeCategory') +
  extract('statusCodeCol') +
  extract('nonContentKind') +
  extract('normalizeSourceHost') +
  extract('rowHost') +
  extract('siteOfRow') +
  extract('rowSiteInScope') +
  extract('reportRows') +
  extract('sectionTally') +
  extract('gatherProgressStats')
);

function row(fields = {}) {
  return Object.assign({
    Address: 'https://x.test/p', MRA_Recommendation: '', Final_MRA: '', SME_Decision: '',
    Client_Review: '', Client_Review_Priority: '', Client_Review_Reason: '',
    Tags: '', Notes: '', Group: '', _Flagged: '',
  }, fields);
}

function seed(rows, projectSettings = {}) {
  state = {
    urlColumn: 'Address',
    headers: Object.keys(rows[0] || row()),
    editedRows: rows,
    customKkeStates: [],
    siteLibrary: [],
    projectSettings,
  };
  _log = []; _undo = []; _dirty = false;
}

describe('status and open', () => {
  test('status is normalized; blank means no request', () => {
    assert.equal(clientReviewStatus(row()), '');
    assert.equal(clientReviewStatus(row({ Client_Review: '  needs DECISION ' })), 'Needs decision');
    assert.equal(clientReviewStatus(row({ Client_Review: 'please confirm' })), 'Please confirm');
    // A value typed elsewhere is still a request to the client
    assert.equal(clientReviewStatus(row({ Client_Review: 'Ask Dana' })), 'Ask Dana');
  });

  test('an item is open until the SME answers, in any form', () => {
    assert.equal(clientReviewIsOpen(row({ Client_Review: 'Needs decision' })), true);
    assert.equal(clientReviewIsOpen(row({ Client_Review: 'Needs decision', SME_Decision: 'Change: Archive' })), false);
    assert.equal(clientReviewIsOpen(row({ Client_Review: 'Please confirm', MRA_Recommendation: 'Migrate', SME_Decision: 'Approve' })), false);
    // A bare value is an answer too
    assert.equal(clientReviewIsOpen(row({ Client_Review: 'Needs decision', SME_Decision: 'Revise' })), false);
    assert.equal(clientReviewIsOpen(row({ SME_Decision: '' })), false, 'no request, nothing open');
  });

  test('priority only counts beside a status', () => {
    assert.equal(clientReviewIsUrgent(row({ Client_Review: 'Needs decision', Client_Review_Priority: 'urgent' })), true);
    assert.equal(clientReviewIsUrgent(row({ Client_Review: 'Needs decision', Client_Review_Priority: 'Normal' })), false);
    assert.equal(clientReviewIsUrgent(row({ Client_Review_Priority: 'Urgent' })), false);
  });

  test('"reviewed, undecided" is Needs decision with no decision yet, Final included', () => {
    assert.equal(clientReviewAwaitingDecision(row({ Client_Review: 'Needs decision' })), true);
    assert.equal(clientReviewAwaitingDecision(row({ Client_Review: 'Needs decision', MRA_Recommendation: 'Archive' })), false);
    assert.equal(clientReviewAwaitingDecision(row({ Client_Review: 'Needs decision', Final_MRA: 'Migrate' })), false);
    assert.equal(clientReviewAwaitingDecision(row({ Client_Review: 'Please confirm' })), false);
  });
});

describe('SME worksheet order', () => {
  test('open Urgent first, then Needs decision, then Please confirm, then the rest', () => {
    const rows = [
      row({ Address: 'none' }),
      row({ Address: 'confirm', Client_Review: 'Please confirm', MRA_Recommendation: 'Migrate' }),
      row({ Address: 'answered', Client_Review: 'Needs decision', Client_Review_Priority: 'Urgent', SME_Decision: 'Approve' }),
      row({ Address: 'decide', Client_Review: 'Needs decision' }),
      row({ Address: 'urgent-confirm', Client_Review: 'Please confirm', Client_Review_Priority: 'Urgent', MRA_Recommendation: 'Revise' }),
    ];
    const sorted = rows.slice().sort((a, b) => clientReviewSortRank(a) - clientReviewSortRank(b));
    assert.deepEqual(sorted.map(r => r.Address), ['urgent-confirm', 'decide', 'confirm', 'none', 'answered']);
  });
});

describe('setClientReview', () => {
  test('setting a status defaults the priority to Normal, as one logged undo entry', () => {
    seed([row()]);
    assert.equal(setClientReview(0, { status: 'Needs decision', reason: 'Ownership' }), true);
    const r = state.editedRows[0];
    assert.equal(r.Client_Review, 'Needs decision');
    assert.equal(r.Client_Review_Priority, 'Normal');
    assert.equal(r.Client_Review_Reason, 'Ownership');
    assert.equal(_undo.length, 1);
    assert.equal(_undo[0].items.length, 3);
    assert.equal(_log.length, 3);
    assert.equal(_dirty, true);
  });

  test('clearing the status clears priority and reason too', () => {
    seed([row({ Client_Review: 'Please confirm', Client_Review_Priority: 'Urgent', Client_Review_Reason: 'Accuracy' })]);
    setClientReview(0, { status: '', priority: 'Urgent', reason: 'Accuracy' });
    const r = state.editedRows[0];
    assert.deepEqual([r.Client_Review, r.Client_Review_Priority, r.Client_Review_Reason], ['', '', '']);
  });

  test('no change writes nothing and pushes no undo', () => {
    seed([row({ Client_Review: 'Needs decision', Client_Review_Priority: 'Normal' })]);
    assert.equal(setClientReview(0, { status: 'Needs decision', priority: 'Normal' }), false);
    assert.equal(_undo.length, 0);
    assert.equal(_log.length, 0);
  });
});

describe('reason vocabulary', () => {
  test('defaults until the project has its own list', () => {
    seed([row()]);
    assert.deepEqual(clientReviewReasons(), DEFAULT_CLIENT_REVIEW_REASONS);
    // An emptied list is the project's choice, not a reason to fall back
    seed([row()], { clientReviewReasons: [] });
    assert.deepEqual(clientReviewReasons(), []);
    seed([row()], { clientReviewReasons: ['Legal hold'] });
    assert.deepEqual(clientReviewReasons(), ['Legal hold']);
  });
});

describe('progress counts', () => {
  test('waiting on the client is split out of Unreviewed, not removed from it', () => {
    seed([
      row({ Address: 'https://x.test/a' }),                                       // nobody looked
      row({ Address: 'https://x.test/b', Client_Review: 'Needs decision' }),       // looked, waiting
      row({ Address: 'https://x.test/c', Client_Review: 'Needs decision', Client_Review_Priority: 'Urgent' }),
      row({ Address: 'https://x.test/d', MRA_Recommendation: 'Migrate', Client_Review: 'Please confirm' }),
      row({ Address: 'https://x.test/e', MRA_Recommendation: 'Archive', Client_Review: 'Please confirm', SME_Decision: 'Approve' }),
    ]);
    const s = gatherProgressStats();
    assert.equal(s.unreviewed, 3, 'Unreviewed keeps matching the sidebar filter');
    assert.equal(s.awaitingClient, 2);
    assert.equal(s.clientReviewOpen, 3);
    assert.equal(s.clientReviewUrgent, 1);
    assert.equal(s.clientReviewNeedsDecision, 2);
    assert.equal(s.clientReviewPleaseConfirm, 1);
    assert.equal(s.clientReviewAnswered, 1);
  });
});

describe('every project gains the columns', () => {
  test('main.js injects all three on open', () => {
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
    const fn = main.slice(main.indexOf('function injectAndOrderAuditColumns('));
    const list = fn.slice(0, fn.indexOf('auditCols.forEach'));
    for (const col of ['Client_Review', 'Client_Review_Priority', 'Client_Review_Reason']) {
      assert.ok(list.includes(`'${col}'`), `${col} is missing from auditCols`);
    }
  });
});
