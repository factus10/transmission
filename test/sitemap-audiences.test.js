// ════════════════════════════════════════════════════════════════════════════
// Audiences on the sitemap — inheritance and the page fill
//
// Run with `npm test`. Same sandbox approach as the other suites — see
// docs/dev/TESTING.md.
//
// WHAT THIS GUARDS. A node's audiences are IA intent that fill UNTAGGED pages
// placed under it. The rules that matter are the ones that keep this from
// overstepping: blanks only, the same eligibility as every other audience fill
// (in scope, Keep/Evolve/Consolidate/unreviewed), inheritance through the LIVE
// tree with the nearest setting winning, and "— None" never propagating.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

const EXTRACTED = [
  'parseAudienceCsv', 'rowAudiences', 'audienceFillTargets',
  'nodeOwnAudiences', 'navEffectiveAudienceMap', 'sitemapAudienceFillPlan', 'navSubtreeIds',
  'navNodeFieldValue',
];

function extract(name) {
  const start = source.indexOf('\nfunction ' + name + '(');
  if (start < 0) throw new Error(`renderer.js has no top-level "function ${name}(" — renamed, or no longer declared at column 0?`);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start + 1, end + 3);
}

const PRELUDE = String.raw`
const AUDIENCES_COL = 'Audiences';
const AUDIENCE_NONE = '— None (no target audience)';
function rowSiteInScope(row) { return row._outOfScope !== true; }
function rowAudienceSuggestion() { return null; }
function audEffectiveKke(row) { return String(row.Final_KKE || row.KKE_Recommendation || '').trim(); }
var state = null;
`;
vm.runInThisContext(PRELUDE + '\n' + EXTRACTED.map(extract).join('\n\n'));

const LIB = [{ name: 'Students' }, { name: 'Faculty' }, { name: 'Alumni' }, { name: '— None (no target audience)' }];

function tree() {
  // Academics (Students) ─┬─ Biology (—) ── Faculty-pages (Faculty)
  //                       └─ Chemistry (—)
  // About (—)
  const fac = { id: 'n4', label: 'Faculty pages', audiences: 'Faculty', children: [] };
  const bio = { id: 'n2', label: 'Biology', audiences: '', children: [fac] };
  const chem = { id: 'n3', label: 'Chemistry', audiences: '', children: [] };
  const acad = { id: 'n1', label: 'Academics', audiences: 'Students', children: [bio, chem] };
  const about = { id: 'n5', label: 'About', audiences: '', children: [] };
  return [acad, about];
}
function flat(nodes, out = []) { nodes.forEach(n => { out.push(n); flat(n.children, out); }); return out; }
function setState(rows, navTree = tree()) {
  state = { editedRows: rows, filteredRows: [], navTree, navNodes: flat(navTree), audienceLibrary: LIB };
}
const row = (over) => Object.assign({ Address: 'https://x.edu/p', KKE_Recommendation: '', Audiences: '', Sitemap_ID: '' }, over);

describe('extraction', () => {
  test('every lifted function is present', () => {
    for (const n of EXTRACTED) assert.equal(typeof globalThis[n], 'function', n);
  });
});

describe('inheritance', () => {
  test('nearest setting wins; unset nodes inherit', () => {
    setState([]);
    const m = navEffectiveAudienceMap();
    assert.deepEqual(m.get('n1').audiences, ['Students']);
    assert.equal(m.get('n1').own, true);
    assert.deepEqual(m.get('n2').audiences, ['Students'], 'Biology inherits Academics');
    assert.equal(m.get('n2').fromLabel, 'Academics');
    assert.deepEqual(m.get('n4').audiences, ['Faculty'], 'a child override wins for its subtree');
    assert.deepEqual(m.get('n5').audiences, [], 'an untagged branch inherits nothing');
  });
  test('— None and names not in the library are ignored on nodes', () => {
    const t = tree();
    t[1].audiences = '— None (no target audience), Ghosts';
    setState([], t);
    assert.deepEqual(nodeOwnAudiences(t[1]), []);
  });
  test('the colorable field reads the EFFECTIVE value', () => {
    setState([]);
    const m = navEffectiveAudienceMap();
    assert.equal(navNodeFieldValue({ id: 'n3', audiences: '' }, 'audiences', m), 'Students');
    assert.equal(navNodeFieldValue({ id: 'n3', phase: 'Future' }, 'phase', m), 'Future');
  });
});

describe('fill plan', () => {
  test('fills blank, eligible, placed rows with the effective audiences', () => {
    setState([
      row({ Sitemap_ID: 'n3', KKE_Recommendation: 'Keep' }),                       // inherits Students
      row({ Sitemap_ID: 'n4' }),                                                    // unreviewed, Faculty
      row({ Sitemap_ID: 'n3', KKE_Recommendation: 'Keep', Audiences: 'Alumni' }),  // already tagged
      row({ Sitemap_ID: 'n3', KKE_Recommendation: 'Kill' }),                       // not carried forward
      row({ Sitemap_ID: 'n5', KKE_Recommendation: 'Keep' }),                       // node has none
      row({ KKE_Recommendation: 'Keep' }),                                         // unplaced
      row({ Sitemap_ID: 'n1', KKE_Recommendation: 'Keep', _outOfScope: true }),    // out of scope
    ]);
    const plan = sitemapAudienceFillPlan();
    assert.deepEqual(plan.map(p => [p.origIndex, p.audiences]), [[0, ['Students']], [1, ['Faculty']]]);
  });
  test('narrowed to a branch', () => {
    setState([row({ Sitemap_ID: 'n4' }), row({ Sitemap_ID: 'n3' })]);
    const bio = state.navNodes.find(n => n.id === 'n2');
    const plan = sitemapAudienceFillPlan({ nodeIds: navSubtreeIds(bio) });
    assert.deepEqual(plan.map(p => p.origIndex), [0]);
  });
  test('narrowed to specific rows', () => {
    setState([row({ Sitemap_ID: 'n4' }), row({ Sitemap_ID: 'n3' })]);
    assert.deepEqual(sitemapAudienceFillPlan({ origIndexes: new Set([1]) }).map(p => p.origIndex), [1]);
  });
});
