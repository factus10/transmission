'use strict';
// ─── Column order for the columns Transmission adds (issue #2) ───────────────
// A Screaming Frog export arrives with dozens of crawl columns, and the app adds
// ~40 of its own. They used to be appended in whatever order each feature was
// built, so an exported workbook read as crawl data with the audit scattered
// through and after it. Every column now goes to one of three places:
//
//   LEAD — the decision, before everything: Final_MRA, then MRA_Recommendation.
//          Final is first because once an SME round has happened it is the
//          answer; the recommendation sits beside it so a difference shows.
//   WORK — directly after the URL column: what the auditor writes about a page
//          (tags, notes, grouping), where it goes (consolidation target,
//          redirect), and the loop that answers it (SME, client review).
//   TAIL — after every crawl column, in groups: classification, audience,
//          sitemap placement, source site / CMS, suggestions, and last the
//          internal `_` columns nobody edits by hand.
//
// Any other column (the crawl's own, an imported or computed one) keeps its
// relative order between the URL block and the tail; crawl columns that came
// before the URL stay before it. Pure: reorders `headers` in place and never
// touches rows, which are keyed by name.

// Lower-case entries are columnMap keys, because the header may be a custom
// name the auditor mapped (e.g. "Recommendation"); the rest are literal headers.
const LEAD = ['finalKke', 'kke'];

const WORK_AFTER_URL = [
  'tags', 'notes', 'group', 'primaryTag',
  'Consolidate_Into', 'Redirect_Destination',
  'smeDecision', 'smeNotes', 'contentOwner',
  'Client_Review', 'Client_Review_Priority', 'Client_Review_Reason',
];

const TAIL_GROUPS = [
  // classification
  ['Page_Type', 'Content_Theme', 'Published_Status', 'Content_Nature', 'Migration_Track',
   'Target_Content_Type', 'Design_Patterns'],
  // audience
  ['Audiences', 'Primary_Audience', 'Jobs_Served'],
  // sitemap placement
  ['Sitemap_ID', 'Sitemap_Destination', 'Page_Breadcrumb', 'Computed Path', 'Sitemap_SortID'],
  // source site and CMS links
  ['Source_Site', 'Source_CMS_URL', 'New_CMS_URL'],
  // machine suggestions
  ['Suggested_MRA', 'Suggested_MRA_Sources', 'GA_MRA_Recommendation', 'GA_Score'],
];

function resolveNames(names, columnMap) {
  return names.map(n => (columnMap && Object.prototype.hasOwnProperty.call(columnMap, n) && columnMap[n]) || n);
}

function orderAuditColumns(headers, columnMap, urlCol) {
  const present = new Set(headers);
  const placed = new Set();
  const take = list => {
    const out = [];
    for (const h of list) {
      if (h && present.has(h) && !placed.has(h)) { placed.add(h); out.push(h); }
    }
    return out;
  };

  const lead = take(resolveNames(LEAD, columnMap));
  const url = take([urlCol]);
  const work = take(resolveNames(WORK_AFTER_URL, columnMap));
  const tail = [].concat(...TAIL_GROUPS.map(take));
  const internal = take(headers.filter(h => typeof h === 'string' && h.startsWith('_')));

  // Unlisted columns keep their order; those that preceded the URL stay before it.
  const urlIdx = url.length ? headers.indexOf(url[0]) : -1;
  const before = [], after = [];
  headers.forEach((h, i) => {
    if (placed.has(h)) return;
    (i < urlIdx ? before : after).push(h);
  });

  const next = [...lead, ...before, ...url, ...work, ...after, ...tail, ...internal];
  headers.splice(0, headers.length, ...next);
  return headers;
}

module.exports = { orderAuditColumns, LEAD, WORK_AFTER_URL, TAIL_GROUPS };
