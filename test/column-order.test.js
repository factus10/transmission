// ════════════════════════════════════════════════════════════════════════════
// Column order (issue #2) — where the columns Transmission adds end up.
//
// Run with `npm test`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { orderAuditColumns, WORK_AFTER_URL, TAIL_GROUPS } = require('../column-order');

const MAP = {
  kke: 'MRA_Recommendation', finalKke: 'Final_MRA', tags: 'Tags', notes: 'Notes',
  group: 'Group', primaryTag: 'Primary Tag', smeDecision: 'SME_Decision',
  smeNotes: 'SME_Notes', contentOwner: 'Content_Owner',
};

// A trimmed Screaming Frog header row with the app's columns appended in the
// order they used to land: the way a real file looked before this change.
const CRAWL = ['Address', 'Content Type', 'Status Code', 'Status', 'Indexability', 'Title 1', 'Meta Description 1', 'H1-1', 'Word Count', 'Crawl Timestamp'];
const APP = ['MRA_Recommendation', 'Tags', 'Notes', 'Group', 'Primary Tag', 'SME_Decision', 'SME_Notes',
  'Content_Owner', 'Final_MRA', '_Flagged', '_AssessedAt', '_AssessmentResult', 'Redirect_Destination',
  'Consolidate_Into', 'Published_Status', 'Page_Type', 'Content_Theme', 'Content_Nature', 'Migration_Track',
  'Suggested_MRA', 'Suggested_MRA_Sources', 'Source_CMS_URL', 'New_CMS_URL', 'Target_Content_Type',
  'Design_Patterns', 'Audiences', 'Primary_Audience', 'Jobs_Served', 'Source_Site', 'Page_Breadcrumb',
  '_ConsolidateTargetId', '_Suggested_Audiences', '_RedirectSource', 'Client_Review',
  'Client_Review_Priority', 'Client_Review_Reason', 'Sitemap_ID', 'Sitemap_Destination', 'Computed Path',
  'Sitemap_SortID', 'GA_MRA_Recommendation', 'GA_Score'];

function ordered(headers, map = MAP, url = 'Address') {
  return orderAuditColumns(headers.slice(), map, url);
}

describe('orderAuditColumns', () => {
  const out = ordered([...CRAWL, ...APP]);

  test('keeps every column exactly once', () => {
    assert.equal(out.length, CRAWL.length + APP.length);
    assert.deepEqual([...out].sort(), [...CRAWL, ...APP].sort());
  });

  test('the decision leads, Final first', () => {
    assert.deepEqual(out.slice(0, 3), ['Final_MRA', 'MRA_Recommendation', 'Address']);
  });

  test('the auditor\'s working columns follow the URL, then the crawl columns', () => {
    const work = out.slice(3, 3 + WORK_AFTER_URL.length);
    assert.deepEqual(work, ['Tags', 'Notes', 'Group', 'Primary Tag', 'Consolidate_Into',
      'Redirect_Destination', 'SME_Decision', 'SME_Notes', 'Content_Owner',
      'Client_Review', 'Client_Review_Priority', 'Client_Review_Reason']);
    const crawl = out.slice(3 + work.length, 3 + work.length + CRAWL.length - 1);
    assert.deepEqual(crawl, CRAWL.slice(1));
  });

  test('the rest follow the crawl columns in their groups, internal columns last', () => {
    const tail = out.slice(3 + WORK_AFTER_URL.length + CRAWL.length - 1);
    const expected = [].concat(...TAIL_GROUPS);
    assert.deepEqual(tail.slice(0, expected.length), expected);
    assert.ok(tail.slice(expected.length).every(h => h.startsWith('_')));
  });

  test('is idempotent', () => {
    assert.deepEqual(ordered(out), out);
  });

  test('crawl columns before the URL stay before it', () => {
    const r = ordered(['Row', 'Address', 'Title 1', 'Notes', 'MRA_Recommendation']);
    assert.deepEqual(r, ['MRA_Recommendation', 'Row', 'Address', 'Notes', 'Title 1']);
  });

  test('follows a custom mapped header', () => {
    const r = ordered(['Address', 'Title 1', 'Recommendation', 'Rationale'],
      { ...MAP, kke: 'Recommendation', notes: 'Rationale' });
    assert.deepEqual(r, ['Recommendation', 'Address', 'Rationale', 'Title 1']);
  });

  test('works with no URL column', () => {
    const r = ordered(['Title 1', 'Notes', 'Page_Type', 'MRA_Recommendation'], MAP, null);
    assert.deepEqual(r, ['MRA_Recommendation', 'Notes', 'Title 1', 'Page_Type']);
  });

  test('imported and computed columns stay among the crawl columns', () => {
    const r = ordered(['Address', 'Title 1', 'Client Priority', 'Page_Type', 'MRA_Recommendation']);
    assert.deepEqual(r, ['MRA_Recommendation', 'Address', 'Title 1', 'Client Priority', 'Page_Type']);
  });
});

describe('every injected column has a place', () => {
  test('nothing main.js injects is left among the crawl columns by accident', () => {
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    const fn = main.slice(main.indexOf('function injectAndOrderAuditColumns('));
    const list = fn.slice(0, fn.indexOf('auditCols.forEach'));
    const code = list.replace(/\/\/.*$/gm, '');
    const literals = [...code.matchAll(/'([^']+)'/g)].map(m => m[1]);
    const placed = new Set([...WORK_AFTER_URL, ...[].concat(...TAIL_GROUPS)]);
    for (const col of literals) {
      assert.ok(col.startsWith('_') || placed.has(col), `${col} has no place in column-order.js`);
    }
  });
});
