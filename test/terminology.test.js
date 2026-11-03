'use strict';
// The decision vocabulary: Migrate / Revise / Archive is canonical everywhere in
// the code, and Keep / Evolve / Kill is a translation applied at the edges (file
// read and write, and the display layer when the auditor prefers the old words).
// Run with `npm test`.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'src', 'terminology.js'));

test('DRIFT: the MCP server ships a byte-identical copy', () => {
  // mcp/ is an extraResource that runs on its own, so it can't require src/.
  assert.equal(
    fs.readFileSync(path.join(ROOT, 'mcp', 'lib', 'terminology.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'src', 'terminology.js'), 'utf8'),
    'copy src/terminology.js over mcp/lib/terminology.js');
});

test('MRA is the default, and an unknown preference falls back to it', () => {
  assert.equal(T.DEFAULT_TERM, 'mra');
  assert.equal(T.normTerm('kke'), 'kke');
  assert.equal(T.normTerm('KKE'), 'kke');
  assert.equal(T.normTerm(undefined), 'mra');
  assert.equal(T.normTerm('nonsense'), 'mra');
});

test('values map both ways; Consolidate, Exclude and custom states pass through', () => {
  for (const [m, k] of [['Migrate', 'Keep'], ['Revise', 'Evolve'], ['Archive', 'Kill']]) {
    assert.equal(T.value(k, 'mra'), m);
    assert.equal(T.value(m, 'kke'), k);
    assert.equal(T.value(m, 'mra'), m, 'idempotent');
    assert.equal(T.value(k.toLowerCase(), 'mra'), m, 'case-insensitive');
  }
  for (const v of ['Consolidate', 'Exclude', 'On Hold', '', 'Archive Pages']) {
    assert.equal(T.value(v, 'kke'), v);
    assert.equal(T.value(v, 'mra'), v);
  }
  assert.equal(T.value(null, 'kke'), null);
});

test('headers, sheets, tracks and rubric keys', () => {
  assert.equal(T.header('KKE_Recommendation', 'mra'), 'MRA_Recommendation');
  assert.equal(T.header('Final_MRA', 'kke'), 'Final_KKE');
  assert.equal(T.header('Suggested_KKE_Sources', 'mra'), 'Suggested_MRA_Sources');
  assert.equal(T.header('Address', 'kke'), 'Address');
  assert.equal(T.sheet('MRA_Settings', 'kke'), 'KKE_Settings');
  assert.equal(T.sheet('KKE_ChangeLog', 'mra'), 'MRA_ChangeLog');
  assert.deepEqual(T.sheetAliases('MRA_Glossary'), ['mra_glossary', 'kke_glossary']);
  assert.equal(T.track('Kill/Redirect', 'mra'), 'Archive/Redirect');
  assert.equal(T.track('Migrate Records', 'kke'), 'Migrate Records', 'not a decision word');
  assert.equal(T.rubricKey('keep', 'mra'), 'migrate');
  assert.equal(T.rubricKey('archive', 'kke'), 'kill');
  assert.equal(T.rubricKey('consolidate', 'kke'), 'consolidate');
  assert.equal(T.abbr('mra'), 'MRA');
  assert.equal(T.abbr('kke'), 'KKE');
});

test('SME decisions keep their shape', () => {
  assert.equal(T.smeDecision('Change: Keep', 'mra'), 'Change: Migrate');
  assert.equal(T.smeDecision('change:kill', 'mra'), 'change:Archive');
  assert.equal(T.smeDecision('Approve', 'kke'), 'Approve');
  assert.equal(T.smeDecision('Revise', 'kke'), 'Evolve');
});

test('Suggested sources JSON: recs and tally keys, never the source names', () => {
  const src = JSON.stringify({ winner: 'ga', winningRec: 'Kill', sources: [{ name: 'ga', rec: 'Kill' }, { name: 'rubric', rec: 'Keep' }], tally: { Kill: 1, Keep: 1 }, disagreement: true });
  const out = JSON.parse(T.sourcesJson(src, 'mra'));
  assert.equal(out.winner, 'ga');
  assert.equal(out.winningRec, 'Archive');
  assert.deepEqual(out.sources.map(s => s.rec), ['Archive', 'Migrate']);
  assert.deepEqual(out.tally, { Archive: 1, Migrate: 1 });
  assert.equal(T.sourcesJson('not json', 'mra'), 'not json');
});

test('a table round-trips KKE → MRA → KKE without loss', () => {
  const headers = ['Address', 'KKE_Recommendation', 'Final_KKE', 'SME_Decision', 'Migration_Track', 'Notes', 'Suggested_KKE'];
  const rows = [
    { Address: '/a', KKE_Recommendation: 'Keep', Final_KKE: 'Kill', SME_Decision: 'Change: Kill', Migration_Track: 'Kill/Redirect', Notes: 'Keep the hero', Suggested_KKE: 'Evolve' },
    { Address: '/b', KKE_Recommendation: '', Final_KKE: 'Consolidate', SME_Decision: 'Approve', Migration_Track: 'Scripted', Notes: '', Suggested_KKE: '' }
  ];
  const mra = T.convertTable(headers, rows, 'mra', null);
  assert.deepEqual(mra.headers, ['Address', 'MRA_Recommendation', 'Final_MRA', 'SME_Decision', 'Migration_Track', 'Notes', 'Suggested_MRA']);
  assert.deepEqual(mra.rows[0], { Address: '/a', MRA_Recommendation: 'Migrate', Final_MRA: 'Archive', SME_Decision: 'Change: Archive', Migration_Track: 'Archive/Redirect', Notes: 'Keep the hero', Suggested_MRA: 'Revise' });
  assert.equal(rows[0].KKE_Recommendation, 'Keep', 'convertTable copies; the input is untouched');
  const back = T.convertTable(mra.headers, mra.rows, 'kke', null);
  assert.deepEqual(back.headers, headers);
  assert.deepEqual(back.rows, rows);
});

test('a custom-mapped decision column converts its values, and an existing target column is never clobbered', () => {
  const headers = ['Address', 'Verdict'];
  const rows = [{ Address: '/a', Verdict: 'Kill' }];
  T.convertTableInPlace(headers, rows, 'mra', { kke: 'Verdict' });
  assert.equal(rows[0].Verdict, 'Archive');

  const both = ['KKE_Recommendation', 'MRA_Recommendation'];
  const r2 = [{ KKE_Recommendation: 'Keep', MRA_Recommendation: 'Revise' }];
  T.convertTableInPlace(both, r2, 'mra', null);
  assert.deepEqual(both, ['KKE_Recommendation', 'MRA_Recommendation']);
  assert.equal(r2[0].MRA_Recommendation, 'Revise');
});

test('change log entries convert field and values for decision fields only', () => {
  const out = T.convertChangeLog([
    { field: 'KKE_Recommendation', from: 'Keep', to: 'Kill' },
    { field: 'Notes', from: 'Keep', to: 'Kill' },
    { field: 'Migration_Track', from: '', to: 'Kill/Redirect' }
  ], 'mra');
  assert.deepEqual(out[0], { field: 'MRA_Recommendation', from: 'Migrate', to: 'Archive' });
  assert.deepEqual(out[1], { field: 'Notes', from: 'Keep', to: 'Kill' }, 'free text is left alone');
  assert.equal(out[2].to, 'Archive/Redirect');
});

test('settings: saved filters, the KKE filter, rubrics and review signatures', () => {
  const ps = T.convertSettings({
    kkeFilter: ['Keep', '_unreviewed'],
    savedFilters: [{ name: 'x', kkeFilter: ['Kill'], fieldFilters: [{ field: 'Final_KKE', operator: 'equals', value: 'Evolve' }] }],
    columnMap: { kke: 'KKE_Recommendation' },
    rubrics: { keep: '# Keep', kill: '# Kill', consolidate: '# C' },
    consolidateReviewed: { '/a': ['Keep', 'Consolidate', '/b'].join('\u0000') },
    clientName: 'Alpha'
  }, 'mra');
  assert.deepEqual(ps.kkeFilter, ['Migrate', '_unreviewed']);
  assert.deepEqual(ps.savedFilters[0].kkeFilter, ['Archive']);
  assert.deepEqual(ps.savedFilters[0].fieldFilters[0], { field: 'Final_MRA', operator: 'equals', value: 'Revise' });
  assert.equal(ps.columnMap.kke, 'MRA_Recommendation');
  assert.deepEqual(Object.keys(ps.rubrics).sort(), ['archive', 'consolidate', 'migrate']);
  assert.equal(ps.consolidateReviewed['/a'], ['Migrate', 'Consolidate', '/b'].join('\u0000'));
  assert.equal(ps.clientName, 'Alpha');
});

test('settings rubrics: an existing non-blank MRA rubric wins over its legacy twin', () => {
  const ps = T.convertSettings({ rubrics: { migrate: '# new', keep: '# old' } }, 'mra');
  assert.equal(ps.rubrics.migrate, '# new');
});

// ─── Inbound worksheets: an SME round sent out before the rename ─────────────
// The app is MRA-only, but worksheets already with clients come back in
// Keep / Kill / Evolve. The SME parser reads them as the decisions they name.
{
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'renderer.js'), 'utf8');
  const start = src.indexOf('\nfunction parseSmeDecision(');
  const end = src.indexOf('\n}\n', start);
  const ctx = { window: { Terminology: T } };
  vm.createContext(ctx);
  vm.runInContext(src.slice(start + 1, end + 3), ctx);
  const parse = ctx.parseSmeDecision;

  test('SME parser: legacy "Change: Kill" is a change to Archive', () => {
    const r = parse('Change: Kill', 'Migrate');
    assert.equal(r.changed, true);
    assert.equal(r.value, 'Archive');
  });

  test('SME parser: a bare legacy word matching the recommendation is agreement', () => {
    const r = parse('Keep', 'Migrate');
    assert.equal(r.agree, true);
    assert.equal(r.changed, false);
  });

  test('SME parser: a bare legacy word that differs is a change, in MRA', () => {
    const r = parse('evolve', 'Migrate');
    assert.equal(r.changed, true);
    assert.equal(r.value, 'Revise');
  });

  test('SME parser: MRA input, Approve and an SME\'s own wording are unchanged', () => {
    assert.equal(parse('Change: Archive', 'Migrate').value, 'Archive');
    assert.equal(parse('Approve', 'Migrate').agree, true);
    assert.equal(parse('Rewrite the intro', 'Migrate').value, 'Rewrite the intro');
  });
}
