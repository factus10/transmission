// ════════════════════════════════════════════════════════════════════════════
// Content vs non-content rows — the inventory numbers a client reads
//
// Run with `npm test`.
//
// A crawl is a list of URLs that responded, not a list of pages. These tests
// pin the distinction that keeps "N pages audited" from quietly counting
// redirects and dead URLs as content to be migrated.
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
var state = {};
const BUILTIN_KKE = ['Keep', 'Kill', 'Evolve', 'Consolidate', 'Exclude'];
function kkeCol() { return 'KKE_Recommendation'; }
function tagsCol() { return 'Tags'; }
function notesCol() { return 'Notes'; }
function groupCol() { return 'Group'; }
function finalKkeCol() { return 'Final_KKE'; }
function smeDecisionCol() { return 'SME_Decision'; }
function parseSmeDecision() { return { reviewed: false, agree: false, changed: false, value: '' }; }
`;

vm.runInThisContext(
  PRELUDE +
  extract('statusCodeCategory') +
  extract('statusCodeCol') +
  extract('nonContentKind') +
  extract('isNonContentRow') +
  // Real, not stubbed: gatherProgressStats() now measures against reportRows(),
  // so out-of-scope exclusion is part of what these tests cover.
  extract('normalizeSourceHost') +
  extract('rowHost') +
  extract('siteOfRow') +
  extract('rowSiteInScope') +
  extract('reportRows') +
  // Decision counts read the effective KKE (Final_KKE wins) — real, not stubbed.
  extract('effectiveKke') +
  // Sections come from the shared tally that Content Inventory and the
  // Executive Summary also read.
  extract('sectionTally') +
  extract('gatherProgressStats')
);

/** rows: array of [statusCode, kke] pairs. */
function seed(rows, { withStatusCol = true, siteLibrary = [], host = 'x.test' } = {}) {
  state = {
    urlColumn: 'Address',
    headers: withStatusCol
      ? ['Address', 'Status Code', 'KKE_Recommendation', 'Group']
      : ['Address', 'KKE_Recommendation', 'Group'],
    editedRows: rows.map(([sc, kke, group, rowHostName], i) => {
      const r = {
        Address: `https://${rowHostName || host}/p${i}`,
        KKE_Recommendation: kke || '',
        Group: group || '',
      };
      if (withStatusCol) r['Status Code'] = sc;
      return r;
    }),
    customKkeStates: [],
    siteLibrary,
  };
  globalThis.state = state;
}

describe('nonContentKind — what the status code says the URL was', () => {
  test('3xx is a redirect, 4xx is gone', () => {
    seed([]);
    assert.equal(nonContentKind({ 'Status Code': '301' }), 'redirect');
    assert.equal(nonContentKind({ 'Status Code': '302' }), 'redirect');
    assert.equal(nonContentKind({ 'Status Code': '404' }), 'gone');
    assert.equal(nonContentKind({ 'Status Code': '410' }), 'gone');
  });

  test('200 and a blank status code are content', () => {
    seed([]);
    assert.equal(nonContentKind({ 'Status Code': '200' }), '');
    assert.equal(nonContentKind({ 'Status Code': '' }), '');
    assert.equal(nonContentKind({}), '');
  });

  test('5xx is CONTENT — a broken page is still a page', () => {
    // Triage Non-200 defaults 5xx to Evolve for this reason. Dropping them from
    // the inventory would hide real work rather than reveal padding.
    seed([]);
    assert.equal(nonContentKind({ 'Status Code': '500' }), '');
    assert.equal(nonContentKind({ 'Status Code': '503' }), '');
    assert.equal(isNonContentRow({ 'Status Code': '500' }), false);
  });

  test('a crawl with no Status Code column reports everything as content', () => {
    // Degrades to exactly the pre-existing behavior rather than guessing.
    seed([], { withStatusCol: false });
    assert.equal(nonContentKind({ 'Status Code': '301' }), '');
    assert.equal(isNonContentRow({ 'Status Code': '404' }), false);
  });

  test('the Status Code column is matched case-insensitively', () => {
    state = { headers: ['Address', 'STATUS CODE'], editedRows: [], customKkeStates: [] };
    globalThis.state = state;
    assert.equal(statusCodeCol(), 'STATUS CODE');
    assert.equal(nonContentKind({ 'STATUS CODE': '301' }), 'redirect');
  });
});

describe('gatherProgressStats — both readings, side by side', () => {
  test('splits the crawl into content and non-content', () => {
    seed([
      ['200', 'Keep'], ['200', 'Kill'], ['200', ''],
      ['301', 'Kill'], ['301', 'Kill'],
      ['404', 'Kill'],
    ]);
    const s = gatherProgressStats();
    assert.equal(s.total, 6);              // every crawled URL
    assert.equal(s.contentTotal, 3);       // only the pages
    assert.equal(s.nonContentRedirects, 2);
    assert.equal(s.nonContentGone, 1);
    assert.equal(s.nonContent, 3);
  });

  test('the content KKE mix excludes redirects triaged to Kill', () => {
    // The bug this exists to prevent: 3 Kills reported when only 1 is a page.
    seed([['200', 'Keep'], ['200', 'Kill'], ['301', 'Kill'], ['301', 'Kill']]);
    const s = gatherProgressStats();
    assert.equal(s.kkeCounts['Kill'], 3);          // all-rows reading, unchanged
    assert.equal(s.contentKkeCounts['Kill'], 1);   // what a client should be told
    assert.equal(s.contentKkeCounts['Keep'], 1);
  });

  test('the all-rows numbers are untouched, so auditor progress still covers every row', () => {
    seed([['200', 'Keep'], ['301', 'Kill'], ['404', '']]);
    const s = gatherProgressStats();
    assert.equal(s.total, 3);
    assert.equal(s.reviewed, 2);
    assert.equal(s.unreviewed, 1);
  });

  test('content review progress is measured against content pages only', () => {
    seed([['200', 'Keep'], ['200', ''], ['301', 'Kill'], ['301', 'Kill']]);
    const s = gatherProgressStats();
    assert.equal(s.contentTotal, 2);
    assert.equal(s.contentReviewed, 1);
    assert.equal(s.contentUnreviewed, 1);
    assert.equal(s.contentPct, 50);
  });

  test('an all-200 crawl reports content numbers identical to the totals', () => {
    // No behavior change for a clean inventory.
    seed([['200', 'Keep'], ['200', 'Kill'], ['200', '']]);
    const s = gatherProgressStats();
    assert.equal(s.nonContent, 0);
    assert.equal(s.contentTotal, s.total);
    assert.equal(s.contentReviewed, s.reviewed);
    assert.equal(s.contentPct, s.pct);
    assert.deepEqual(s.contentKkeCounts, s.kkeCounts);
  });

  test('a crawl of nothing but redirects reports zero content pages, not a divide-by-zero', () => {
    seed([['301', 'Kill'], ['302', 'Kill']]);
    const s = gatherProgressStats();
    assert.equal(s.contentTotal, 0);
    assert.equal(s.contentPct, 0);
    assert.equal(s.nonContentRedirects, 2);
  });

  test('custom KKE states are tallied in the content mix too', () => {
    seed([['200', 'Archive'], ['301', 'Archive']]);
    state.customKkeStates = [{ label: 'Archive', color: '#000' }];
    const s = gatherProgressStats();
    assert.equal(s.contentKkeCounts['Archive'], 1);
    assert.equal(s.kkeCounts['Archive'], 2);
  });
});

describe('out-of-scope sites are excluded from the figures', () => {
  const LIB = [
    { label: 'Main', hosts: ['main.test'], inScope: true },
    { label: 'Retired', hosts: ['old.test'], inScope: false },
  ];

  test('an out-of-scope site drops out of the totals and the KKE mix', () => {
    // reportRows()'s own contract: excluded from every report denominator,
    // "otherwise a site that isn't being migrated still drags down every
    // completion percentage".
    seed([
      ['200', 'Keep', '', 'main.test'],
      ['200', '', '', 'main.test'],
      ['200', '', '', 'old.test'],
      ['200', '', '', 'old.test'],
    ], { siteLibrary: LIB });
    const s = gatherProgressStats();
    assert.equal(s.total, 2);
    assert.equal(s.unreviewed, 1);
    assert.equal(s.pct, 50, 'an out-of-scope site must not drag the percentage down');
    assert.equal(s.kkeCounts['Keep'], 1);
  });

  test('out-of-scope rows are excluded from the content split too', () => {
    seed([
      ['200', 'Keep', '', 'main.test'],
      ['301', 'Kill', '', 'main.test'],
      ['301', 'Kill', '', 'old.test'],
    ], { siteLibrary: LIB });
    const s = gatherProgressStats();
    assert.equal(s.contentTotal, 1);
    assert.equal(s.nonContentRedirects, 1, 'the out-of-scope redirect must not be counted');
  });

  test('a project with nothing out of scope is completely unaffected', () => {
    seed([['200', 'Keep', '', 'main.test'], ['200', '', '', 'main.test']],
         { siteLibrary: [{ label: 'Main', hosts: ['main.test'], inScope: true }] });
    const s = gatherProgressStats();
    assert.equal(s.total, 2);
    assert.equal(s.reviewed, 1);
  });

  test('a row on a host the registry does not cover is still counted', () => {
    // rowSiteInScope() treats "no matching entry" as in scope; only an explicit
    // no opts a site out, so an unregistered host can never vanish silently.
    seed([['200', 'Keep', '', 'unknown.test']], { siteLibrary: LIB });
    assert.equal(gatherProgressStats().total, 1);
  });
});

describe('section tallies', () => {
  test('contentGroups excludes non-content rows; groups keeps them', () => {
    // The dashboard's "By group" matches its all-rows total; the Executive
    // Summary's "By Section" must match its content-page total. One tally
    // cannot be right for both.
    seed([
      ['200', 'Keep', 'Academics'],
      ['200', 'Kill', 'Academics'],
      ['301', 'Kill', 'Academics'],
      ['404', 'Kill', 'News'],
    ]);
    const s = gatherProgressStats();
    assert.deepEqual(s.groups, [['Academics', 3], ['News', 1]]);
    assert.deepEqual(s.contentGroups, [['Academics', 2]]);
  });

  test('content section counts sum to the content total', () => {
    seed([
      ['200', 'Keep', 'A'], ['200', 'Keep', 'B'], ['200', '', 'B'],
      ['301', 'Kill', 'A'],
    ]);
    const s = gatherProgressStats();
    const summed = s.contentGroups.reduce((n, [, c]) => n + c, 0);
    assert.equal(summed, s.contentTotal);
  });

  test('ungrouped rows simply do not appear, in either tally', () => {
    seed([['200', 'Keep', ''], ['200', 'Keep', 'A']]);
    const s = gatherProgressStats();
    assert.deepEqual(s.contentGroups, [['A', 1]]);
  });
});

describe('the Executive Summary reports the content figures', () => {
  test('its headline row and KKE bar read the content stats, not the crawl total', () => {
    // Guards the actual defect: a client asking "are we really migrating N
    // pages?" when N counted redirects. Pinned by source text because the
    // report body is a template literal that needs the whole DOM to render.
    const i = source.indexOf('function reportExecutiveSummary(');
    const body = source.slice(i, source.indexOf('\n}\n', i));
    assert.ok(body.includes('Content pages audited'),
      'the Overview no longer leads with the content-page count');
    assert.ok(body.includes('kkeBarHtml(cCounts, cTotal)'),
      'the KKE bar is no longer computed over content pages');
    assert.ok(!/stat-label">Total pages audited/.test(body),
      'the old crawl-total headline is back');
    assert.ok(body.includes('stats.sectionsContent'),
      'By Section is back to counting non-content rows');
  });
});

describe('gatherProgressStats — the decision that counts is the effective one', () => {
  test('a client Final_KKE is counted instead of the recommendation', () => {
    seed([['200', 'Kill'], ['200', 'Keep'], ['200', '']]);
    state.editedRows[0].Final_KKE = 'Keep';        // client overrode Kill
    state.editedRows[2].Final_KKE = 'Evolve';      // client decided an unreviewed page
    const s = gatherProgressStats();
    assert.equal(s.kkeCounts.Kill, 0);
    assert.equal(s.kkeCounts.Keep, 2);
    assert.equal(s.kkeCounts.Evolve, 1);
    assert.equal(s.unreviewed, 0);
  });

  test('SME percentages stay within their own denominator', () => {
    // A Final value on a row with no recommendation used to count toward
    // finalResolved but not smeTotal, pushing "resolved" past 100%.
    seed([['200', 'Keep'], ['200', ''], ['200', '']]);
    state.editedRows[1].Final_KKE = 'Kill';
    state.editedRows[2].Final_KKE = 'Keep';
    state.editedRows[0].Final_KKE = 'Keep';
    const s = gatherProgressStats();
    assert.equal(s.smeTotal, 1);
    assert.equal(s.finalResolved, 1);
    assert.ok(s.finalPct <= 100);
  });
});

describe('sectionTally — one section count for every report', () => {
  test('sections plus the no-section bucket add up to the total', () => {
    seed([['200', 'Keep', 'News'], ['200', 'Kill', 'News'], ['200', '', 'About'], ['200', 'Keep', ''], ['301', 'Kill', 'News']]);
    const t = sectionTally(state.editedRows);
    assert.equal(t.total, 5);
    assert.equal(t.sections[0].name, 'News');
    assert.equal(t.sections[0].total, 3);
    assert.equal(t.sections.reduce((n, x) => n + x.total, 0) + t.ungrouped.total, t.total);
  });
  test('content-only drops 3xx/4xx, and decisions are the effective KKE', () => {
    seed([['200', 'Kill', 'News'], ['301', 'Kill', 'News'], ['404', 'Kill', 'News']]);
    state.editedRows[0].Final_KKE = 'Keep';
    const t = sectionTally(state.editedRows, { contentOnly: true });
    assert.equal(t.total, 1);
    assert.deepEqual(t.sections[0].kke, { Keep: 1 });
  });
  test('gatherProgressStats reads its section counts from the same tally', () => {
    seed([['200', 'Keep', 'News'], ['301', 'Kill', 'News'], ['200', 'Kill', 'About']]);
    const s = gatherProgressStats();
    assert.deepEqual(s.groups, [['News', 2], ['About', 1]]);
    assert.deepEqual(s.contentGroups, [['About', 1], ['News', 1]]);
    assert.equal(s.sectionsContent.total, s.contentTotal);
  });
});
