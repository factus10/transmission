// ════════════════════════════════════════════════════════════════════════════
// Content Flow (Sankey) — host-side logic tests
//
// Run with `npm test`.
//
// WHY THE SANDBOX. renderer.js is a single ~28k-line browser script with no
// module system and no exports — it cannot be require()d, and wrapping it would
// mean loading the whole app (DOM, electronAPI, webviews) to test a dozen pure
// functions. So this file lifts just those functions out by source text and
// evaluates them in a vm context with the few app helpers they call stubbed.
//
// The trade-off is that extraction is coupled to how the source is FORMATTED,
// not just what it does: a function must be declared at column 0 as
// `function name(` and closed by a `}` at column 0. That is the house style for
// every function here, and a rename or reformat fails loudly in the first test
// below rather than silently skipping coverage.
//
// It runs the lifted code in THIS realm (vm.runInThisContext), not a fresh
// context, for two reasons learned the hard way:
//   * A fresh context has no globals at all — not even URL. Because the
//     resolvers wrap URL parsing in try/catch, a missing global degraded into
//     "every row silently skipped" instead of an error.
//   * Objects built inside another realm have that realm's prototypes, so
//     assert.deepStrictEqual reports two identical-looking arrays as unequal.
// The cost is that the lifted declarations become globals of the test process,
// which is harmless here and much easier to reason about.
//
// One trap remains: PRELUDE is a String.raw literal on purpose. It was once an
// ordinary template literal, in which `\s` collapses to a bare `s` — so a
// stubbed /\s+/g quietly evaluated as /s+/g and ate the "s" out of
// "University". Keep String.raw, or write every backslash doubled.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC_DIR = path.join(__dirname, '..', 'src');
const source = fs.readFileSync(path.join(SRC_DIR, 'renderer.js'), 'utf8');

/** Functions under test, lifted from renderer.js by source text. */
const EXTRACTED = [
  // shared helpers the sankey code builds on
  'sharedPrefixDepth', 'hostUsesLocalePrefixes', 'normalizeSourceHost', 'titleCaseFromSlug',
  'recomputeAllSourceSites',
  // source-site registry
  'renameSourceSite', 'sourceSitesNeedingLabels',
  // the sankey itself
  'makeSourceSectionResolver', 'navSectionLabelMap', 'sankeyTargetOf',
  'computeSankeyFlows', 'sankeyCapSources', 'sankeySectionColors', 'sankeyDecisionColor',
  'buildSankeySankeyGraph', 'buildSankeyViews',
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

// Constants and app helpers the extracted code closes over. Stubs mirror the
// real behaviour; where the real one is unavailable in Node (treemapKkeColor
// reads CSS custom properties off :root) the stub says so.
const PRELUDE = String.raw`
const LOCALE_SEGMENT_RE = /^[a-z]{2,3}(-[a-z0-9]{2,4})?$/i;
const SITEMAP_DEFAULT_PALETTE = ['#2d6a9f','#1e7a4e','#7a3a9f','#9f6a1e','#2d7a7a','#7a2d2d','#3a5a8f','#5a7a2d'];
const SOURCE_SITE_COL = 'Source_Site';
const SANKEY_RETIRED = '— Retired';
const SANKEY_OUT_OF_SCOPE = '— Out of scope';
const SANKEY_UNPLACED = '— Not yet placed';
const SANKEY_UNREVIEWED = '(unreviewed)';
const SANKEY_TERMINAL_COLORS = {
  [SANKEY_RETIRED]: '#b91c1c', [SANKEY_OUT_OF_SCOPE]: '#636363', [SANKEY_UNPLACED]: '#8890a0',
};
const SANKEY_MAX_SOURCES = 20;
const SANKEY_SHAPES = [
  { key: 'dec',  label: '→ Decision',            layers: ['decision'] },
  { key: 'new',  label: '→ New sitemap',         layers: ['target'] },
  { key: 'both', label: '→ Decision → New', layers: ['decision', 'target'] },
];

function reportRows() { return state.editedRows; }
function effectiveKke(row) { return String(row['Final_MRA'] || row['MRA_Recommendation'] || '').trim(); }
function allKkeStates() {
  return ['Migrate', 'Revise', 'Archive', 'Consolidate', 'Exclude'].concat((state.customKkeStates || []).map(s => s.label));
}
function findConsolidateTargetRow(row) {
  const id = String(row['_ConsolidateTargetId'] || '').trim();
  if (!id) return null;
  return state.editedRows.find(r => String(r['Address'] || '').trim() === id) || null;
}
function navSectionRoots() {
  const t = state.navTree || [];
  return (t.length === 1 && (t[0].children || []).length) ? t[0].children : t;
}
function rowHost(row) {
  try { return normalizeSourceHost(new URL(String(row['Address'] || '')).host); } catch (_) { return ''; }
}
function siteOfRow(row) {
  const h = rowHost(row);
  return (state.siteLibrary || []).find(s => (s.hosts || []).includes(h)) || null;
}
function computeRowSourceSite(row) { const s = siteOfRow(row); return s ? s.label : rowHost(row); }
function outOfScopeSiteInfo() { return null; }
function sanitizeText(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); }
function setDirty() { state._dirty = true; }
// The real one resolves builtins from :root custom properties, which do not
// exist here; the hexes below are those same values from styles.css. The custom
// -state branch is the real logic and is what the tests exercise.
function treemapKkeColor(label) {
  const builtin = ({ Migrate: '#15703a', Archive: '#b91c1c', Revise: '#854d0e', Consolidate: '#4338ca', Exclude: '#636363' })[label];
  if (builtin) return builtin;
  const custom = (state.customKkeStates || []).find(s => s.label === label);
  return custom ? custom.color : '#9aa0ab';
}
`;

const RETIRED = '— Retired';
const OUT_OF_SCOPE = '— Out of scope';
const UNPLACED = '— Not yet placed';

let API;

before(() => {
  const code = EXTRACTED.map(extract).join('\n');
  const exposed = EXTRACTED.concat(['SANKEY_SHAPES']).join(', ');
  // Same realm on purpose — see the header. `state` is read as a global by the
  // lifted code, and setState() below assigns it.
  vm.runInThisContext(`${PRELUDE}\n${code}\nthis.__sankeyAPI = { ${exposed} };`);
  API = globalThis.__sankeyAPI;
});

// ── Fixture ──────────────────────────────────────────────────────────────────
const node = (id, label, children) => ({ id, label, children: children || [] });
const TREE = [node('n1', 'Home', [
  node('n10', 'Academics', [node('n11', 'Programs')]),
  node('n20', 'Admissions'),
  node('n30', 'News'),
])];

const row = (addr, kke, sitemapId, extra) =>
  Object.assign({ Address: addr, MRA_Recommendation: kke, Sitemap_ID: sitemapId || '' }, extra || {});

function setState(rows, over) {
  globalThis.state = Object.assign({
    editedRows: rows, navTree: TREE, urlColumn: 'Address',
    headers: ['Address', 'Source_Site'], projectSettings: {},
    customKkeStates: [], siteLibrary: [],
  }, over || {});
}

/** Flows as sorted [section, decision, target, value] tuples, for readable asserts. */
const flowsOf = (depth) => API.computeSankeyFlows(depth || 1).flows
  .map(f => [f.section, f.decision, f.target, f.value]).sort();

const sumLinks = (links, prefix, end) =>
  links.filter(l => l[end].startsWith(prefix)).reduce((a, l) => a + l.value, 0);

// ═════════════════════════════════════════════════════════════════════════════

describe('harness', () => {
  test('every function under test is still where the sandbox expects it', () => {
    for (const name of EXTRACTED) assert.doesNotThrow(() => extract(name), `extracting ${name}`);
  });

  test('the sandbox has the globals the extracted code needs', () => {
    // Regression guard for trap 1: without URL, every row is silently skipped
    // because the resolvers swallow the ReferenceError.
    setState([row('https://x.edu/academics/a', 'Migrate', 'n11')]);
    assert.equal(API.computeSankeyFlows(1).flows.length, 1);
    assert.equal(API.computeSankeyFlows(1).skipped, 0);
  });
});

describe('source axis', () => {
  test('a placed page still flows FROM its URL section, not its breadcrumb', () => {
    // The trap this whole axis exists to avoid: makeSectionResolver() prefers a
    // placed row's breadcrumb (the TARGET IA), which would make every placed
    // page flow Academics -> Academics and show nothing.
    setState([
      row('https://x.edu/academics/biology', 'Migrate', 'n11'),
      row('https://x.edu/admissions/apply', 'Migrate', 'n20'),
    ]);
    assert.deepEqual(flowsOf(1), [
      ['Academics', 'Migrate', 'Academics', 1],
      ['Admissions', 'Migrate', 'Admissions', 1],
    ]);
  });

  test('a shared path prefix is stripped, not turned into one bucket', () => {
    setState([
      row('https://alpha.edu/college/academics/bio', 'Migrate', 'n11'),
      row('https://alpha.edu/college/admissions/apply', 'Migrate', 'n20'),
      row('https://alpha.edu/college/news/story', 'Archive'),
    ]);
    assert.deepEqual(flowsOf(1), [
      ['Academics', 'Migrate', 'Academics', 1],
      ['Admissions', 'Migrate', 'Admissions', 1],
      ['News', 'Archive', RETIRED, 1],
    ]);
  });

  test('a locale prefix is stepped past, so columns are topics not languages', () => {
    setState(['en', 'es', 'de'].flatMap(loc => [
      row(`https://x.edu/${loc}/academics/bio`, 'Migrate', 'n11'),
      row(`https://x.edu/${loc}/admissions/apply`, 'Migrate', 'n20'),
    ]));
    assert.deepEqual(flowsOf(1), [
      ['Academics', 'Migrate', 'Academics', 3],
      ['Admissions', 'Migrate', 'Admissions', 3],
    ]);
  });

  test('depth splits deeper sections apart', () => {
    setState([
      row('https://x.edu/academics/programs/bio', 'Migrate', 'n11'),
      row('https://x.edu/academics/advising/faq', 'Migrate', 'n11'),
      row('https://x.edu/admissions/apply', 'Migrate', 'n20'),
    ]);
    assert.deepEqual(flowsOf(1), [
      ['Academics', 'Migrate', 'Academics', 2],
      ['Admissions', 'Migrate', 'Admissions', 1],
    ]);
    assert.deepEqual(flowsOf(2), [
      ['Academics / Advising', 'Migrate', 'Academics', 1],
      ['Academics / Programs', 'Migrate', 'Academics', 1],
      ['Admissions', 'Migrate', 'Admissions', 1],
    ]);
  });

  test('labels holding spaces and separators still tally apart', () => {
    // The tally key is NUL-joined precisely because these labels exist.
    setState([
      row('https://x.edu/news-and-events/gala', 'Archive'),
      row('https://x.edu/news-and-events/talk', 'Migrate', 'n30'),
      row('https://x.edu/admissions/apply', 'Migrate', 'n20'),
    ]);
    assert.deepEqual(flowsOf(1), [
      ['Admissions', 'Migrate', 'Admissions', 1],
      ['News And Events', 'Archive', RETIRED, 1],
      ['News And Events', 'Migrate', 'News', 1],
    ]);
  });
});

describe('terminal buckets', () => {
  test('Kill / Exclude / unplaced / unreviewed each land in the right endpoint', () => {
    setState([
      row('https://x.edu/news/2019-gala', 'Archive'),
      row('https://x.edu/athletics/roster', 'Exclude'),
      row('https://x.edu/about/history', 'Migrate'),   // decided, but not placed
      row('https://x.edu/about/staff', ''),         // never reviewed
    ]);
    assert.deepEqual(flowsOf(1), [
      ['About', '(unreviewed)', UNPLACED, 1],
      ['About', 'Migrate', UNPLACED, 1],
      ['Athletics', 'Exclude', OUT_OF_SCOPE, 1],
      ['News', 'Archive', RETIRED, 1],
    ]);
  });
});

describe('consolidation', () => {
  test('resolves through a chain to the final master\'s section', () => {
    setState([
      row('https://x.edu/a/one', 'Consolidate', '', { _ConsolidateTargetId: 'https://x.edu/a/two' }),
      row('https://x.edu/a/two', 'Consolidate', '', { _ConsolidateTargetId: 'https://x.edu/b/master' }),
      row('https://x.edu/b/master', 'Migrate', 'n11'),
    ]);
    assert.deepEqual(flowsOf(1), [
      ['A', 'Consolidate', 'Academics', 2],
      ['B', 'Migrate', 'Academics', 1],
    ]);
  });

  test('a cycle terminates instead of hanging', () => {
    setState([
      row('https://x.edu/a/one', 'Consolidate', '', { _ConsolidateTargetId: 'https://x.edu/a/two' }),
      row('https://x.edu/a/two', 'Consolidate', '', { _ConsolidateTargetId: 'https://x.edu/a/one' }),
      row('https://x.edu/other/z', 'Migrate', 'n20'),   // keeps /a/ from reading as a site-wide prefix
    ]);
    assert.deepEqual(flowsOf(1), [
      ['A', 'Consolidate', UNPLACED, 2],
      ['Other', 'Migrate', 'Admissions', 1],
    ]);
  });

  test('an off-inventory master falls to unplaced rather than vanishing', () => {
    setState([
      row('https://x.edu/a/one', 'Consolidate', '', { _ConsolidateTargetId: 'https://gone.example/x' }),
      row('https://x.edu/other/z', 'Migrate', 'n20'),
    ]);
    assert.deepEqual(flowsOf(1), [
      ['A', 'Consolidate', UNPLACED, 1],
      ['Other', 'Migrate', 'Admissions', 1],
    ]);
  });
});

describe('graph shapes', () => {
  test('every page leaves the source column and arrives somewhere, in both shapes', () => {
    setState([
      row('https://x.edu/academics/a', 'Migrate', 'n11'),
      row('https://x.edu/academics/b', 'Revise', 'n11'),
      row('https://x.edu/news/c', 'Archive'),
      row('https://x.edu/athletics/d', 'Exclude'),
      row('https://x.edu/about/e', 'Consolidate', '', { _ConsolidateTargetId: 'https://x.edu/academics/a' }),
    ]);
    const { flows } = API.computeSankeyFlows(1);
    const total = flows.reduce((a, f) => a + f.value, 0);
    const { views } = API.buildSankeyViews(flows, { axes: ['section'] });

    assert.ok(total > 0, 'fixture must not be empty or conservation passes trivially');
    assert.ok(views['section|new'].links.length > 0);

    assert.equal(sumLinks(views['section|new'].links, '0|', 's'), total);
    assert.equal(sumLinks(views['section|new'].links, '1|', 't'), total);

    assert.equal(sumLinks(views['section|both'].links, '0|', 's'), total);
    assert.equal(sumLinks(views['section|both'].links, '1|', 't'), total);
    assert.equal(sumLinks(views['section|both'].links, '2|', 't'), total);
  });

  test('no zero-width bands, and every endpoint resolves to a declared node', () => {
    setState([
      row('https://x.edu/academics/a', 'Migrate', 'n11'),
      row('https://x.edu/news/c', 'Archive'),
    ]);
    const { views } = API.buildSankeyViews(API.computeSankeyFlows(1).flows, { axes: ['section'] });
    for (const key of Object.keys(views)) {
      const v = views[key];
      assert.ok(v.links.every(l => l.value > 0), `${key} has a zero/negative band`);
      const ids = new Set(v.nodes.map(n => n.id));
      assert.ok(v.links.every(l => ids.has(l.s) && ids.has(l.t)), `${key} has a dangling endpoint`);
    }
  });
});

describe('decision shape (incl. user-added KKE states)', () => {
  function decisionFixture() {
    setState([
      row('https://x.edu/news/a', 'Archive'),
      row('https://x.edu/news/b', 'On Hold'),        // a state the user added
      row('https://x.edu/about/c', 'Migrate', 'n11'),
      row('https://x.edu/about/d', ''),
    ], { customKkeStates: [{ label: 'On Hold', color: '#00aaaa' }] });
    return API.buildSankeyViews(API.computeSankeyFlows(1).flows, { axes: ['section'] });
  }

  test('has exactly two columns', () => {
    assert.deepEqual(decisionFixture().views['section|dec'].columns, ['Current section', 'Decision']);
  });

  test('every decision gets a block, including custom states and unreviewed', () => {
    const dec = decisionFixture().views['section|dec'];
    assert.deepEqual(
      dec.nodes.filter(n => n.layer === 1).map(n => n.label).sort(),
      ['(unreviewed)', 'Archive', 'Migrate', 'On Hold']);
  });

  test('a custom state keeps the color configured for it', () => {
    const dec = decisionFixture().views['section|dec'];
    assert.equal(dec.nodes.find(n => n.label === 'On Hold').color, '#00aaaa');
  });

  test('conserves', () => {
    assert.equal(decisionFixture().views['section|dec'].links.reduce((a, l) => a + l.value, 0), 4);
  });

  test('legend follows the project KKE vocabulary, with unreviewed last', () => {
    assert.deepEqual(decisionFixture().legends.decision.map(e => e.label),
      ['Migrate', 'Archive', 'On Hold', '(unreviewed)']);
  });
});

describe('multi-site consolidation', () => {
  test('with no registry, two sites\' /about stay apart', () => {
    setState([
      row('https://a.com/about/x', 'Migrate', 'n20'),
      row('https://b.com/about/x', 'Migrate', 'n20'),
    ]);
    assert.deepEqual(flowsOf(1), [
      ['a.com › About', 'Migrate', 'Admissions', 1],
      ['b.com › About', 'Migrate', 'Admissions', 1],
    ]);
  });

  test('several hosts of one registered site fold into one site label', () => {
    setState([
      row('https://www.alpha.edu/about/a', 'Migrate', 'n11'),
      row('https://news.alpha.edu/x/b', 'Migrate', 'n11'),
      row('https://beta.org/about/c', 'Archive'),
    ], {
      siteLibrary: [
        { label: 'Alpha University', hosts: ['alpha.edu', 'news.alpha.edu'] },
        { label: 'Beta College', hosts: ['beta.org'] },
      ],
    });
    const { flows } = API.computeSankeyFlows(1);
    assert.deepEqual([...new Set(flows.map(f => f.site))].sort(), ['Alpha University', 'Beta College']);
    // …and the section axis is qualified by the site LABEL, not the raw host.
    assert.ok(flows.every(f => !/\.(edu|org)\s›/.test(f.section)), 'section labels must not use raw hosts');
  });

  test('both axes produce every shape, and the site axis conserves', () => {
    setState([
      row('https://alpha.edu/about/a', 'Migrate', 'n11'),
      row('https://beta.org/about/c', 'Archive'),
    ], {
      siteLibrary: [
        { label: 'Alpha University', hosts: ['alpha.edu'] },
        { label: 'Beta College', hosts: ['beta.org'] },
      ],
    });
    const { views } = API.buildSankeyViews(API.computeSankeyFlows(1).flows, { axes: ['section', 'site'] });
    assert.deepEqual(Object.keys(views).sort(),
      ['section|both', 'section|dec', 'section|new', 'site|both', 'site|dec', 'site|new']);
    assert.deepEqual(
      views['site|new'].nodes.filter(n => n.layer === 0).map(n => n.label).sort(),
      ['Alpha University', 'Beta College']);
    assert.equal(sumLinks(views['site|both'].links, '0|', 's'), 2);
  });
});

describe('source cap', () => {
  // 5 sites x 12 sections = 60 blocks in one column. Uncapped, the engine's
  // height budget leaves ~22px for every band put together.
  function bigFixture() {
    const hosts = ['a.edu', 'b.edu', 'c.edu', 'd.edu', 'e.edu'];
    const secs = ['academics', 'admissions', 'about', 'news', 'athletics', 'research',
      'student-life', 'alumni', 'library', 'giving', 'events', 'directory'];
    const rows = [];
    hosts.forEach(h => secs.forEach(sec => {
      for (let i = 0; i < 20; i++) {
        rows.push(row(`https://${h}/${sec}/p${i}`, ['Migrate', 'Revise', 'Archive', 'Exclude'][i % 4], i % 4 < 2 ? 'n11' : ''));
      }
    }));
    setState(rows);
    return API.computeSankeyFlows(1).flows;
  }

  test('folds the tail into one Other block, conserving every page', () => {
    const flows = bigFixture();
    const before = new Set(flows.map(f => f.section)).size;
    const beforeTotal = flows.reduce((a, f) => a + f.value, 0);
    assert.equal(before, 60, 'fixture should be the pathological shape');

    const capped = API.sankeyCapSources(flows, 'section', 20);
    assert.ok(new Set(capped.flows.map(f => f.section)).size <= 20);
    assert.equal(capped.folded, 41);
    assert.equal(capped.flows.reduce((a, f) => a + f.value, 0), beforeTotal, 'cap must not lose pages');
    assert.ok(capped.flows.some(f => /^Other \(\d+ sections\)$/.test(f.section)));
  });

  test('is a no-op when the column is already small enough', () => {
    setState([row('https://x.edu/academics/a', 'Migrate', 'n11'), row('https://x.edu/news/b', 'Archive')]);
    const flows = API.computeSankeyFlows(1).flows;
    const capped = API.sankeyCapSources(flows, 'section', 20);
    assert.equal(capped.folded, 0);
    assert.equal(capped.flows, flows, 'should return the same array, not a copy');
  });

  test('the engine still has room to draw at and beyond the cap', () => {
    // Mirrors layout()'s budget in sankey-template.js. Kept here because the
    // cap and the adaptive padding are two halves of one fix.
    const H = 660, PAD_T = 34, PAD_B = 14, NODE_PAD = 10, usable = H - PAD_T - PAD_B;
    const padFor = n => (n > 1 ? Math.max(1, Math.min(NODE_PAD, (usable * 0.35) / (n - 1))) : NODE_PAD);
    const band = n => usable - (n - 1) * padFor(n);
    assert.ok(band(20) > 350, 'at the cap');
    assert.ok(band(60) > 350, 'and even uncapped, thanks to adaptive padding');
  });
});

describe('source site labels', () => {
  test('flags only in-scope sites still named after one of their hosts', () => {
    setState([], {
      siteLibrary: [
        { label: 'alpha.edu', hosts: ['alpha.edu', 'news.alpha.edu'], inScope: true },
        { label: 'Beta College', hosts: ['beta.edu'], inScope: true },
        { label: 'gamma.org', hosts: ['gamma.org'], inScope: false },
      ],
    });
    assert.deepEqual(API.sourceSitesNeedingLabels().map(x => x.site.label), ['alpha.edu']);
  });

  test('renaming trims, cascades to Source_Site, and dirties the project', () => {
    setState(
      [{ Address: 'https://alpha.edu/a/1', Source_Site: 'alpha.edu' },
       { Address: 'https://beta.edu/b/1', Source_Site: 'Beta College' }],
      { siteLibrary: [
          { label: 'alpha.edu', hosts: ['alpha.edu'], inScope: true },
          { label: 'Beta College', hosts: ['beta.edu'], inScope: true }] });

    const r = API.renameSourceSite(0, '  Alpha University  ');
    assert.equal(r.ok, true);
    assert.equal(r.label, 'Alpha University');
    assert.deepEqual(globalThis.state.editedRows.map(x => x.Source_Site), ['Alpha University', 'Beta College']);
    assert.equal(globalThis.state._dirty, true);
    assert.equal(API.sourceSitesNeedingLabels().length, 0);
  });

  test('rejects duplicates, blanks and bad indices; an unchanged label is a no-op', () => {
    setState([], { siteLibrary: [
      { label: 'Alpha University', hosts: ['alpha.edu'], inScope: true },
      { label: 'Beta College', hosts: ['beta.edu'], inScope: true }] });

    assert.equal(API.renameSourceSite(0, 'Beta College').error, 'That label is already in use');
    assert.equal(API.renameSourceSite(0, '   ').error, 'A site needs a label');
    assert.equal(API.renameSourceSite(99, 'X').error, 'No such site');

    const same = API.renameSourceSite(0, 'Alpha University');
    assert.equal(same.ok, false);
    assert.equal(same.error, undefined, 'unchanged is not an error');
    assert.equal(same.unchanged, true);
  });

  test('allows a rename that differs only in capitalization', () => {
    // Regression: the Sites tab's own check compared against every entry
    // INCLUDING self, so "alpha.edu" -> "Alpha.edu" was refused as a duplicate.
    setState([], { siteLibrary: [{ label: 'alpha.edu', hosts: ['alpha.edu'], inScope: true }] });
    assert.equal(API.renameSourceSite(0, 'Alpha.edu').ok, true);
    assert.equal(globalThis.state.siteLibrary[0].label, 'Alpha.edu');
  });
});

describe('engine template', () => {
  let SankeyTemplate;
  const view = {
    columns: ['Current section', 'Decision'],
    nodes: [{ id: '0|A', label: 'A', layer: 0, color: '#111' },
            { id: '1|Keep', label: 'Migrate', layer: 1, color: '#15703a' }],
    links: [{ s: '0|A', t: '1|Keep', value: 5, decision: 'Migrate', colors: { decision: '#15703a', source: '#111' } }],
  };
  const data = {
    title: 'T', views: { 'section|dec': view },
    legends: { decision: [{ color: '#15703a', label: 'Migrate' }], section: [] },
    froms: [{ key: 'section', label: 'Current section' }],
    shapes: [{ key: 'dec', label: '→ Decision' }],
    defaultFrom: 'section', defaultShape: 'dec',
  };

  before(() => {
    // The template registers itself on window, browser-style.
    global.window = {};
    delete require.cache[require.resolve(path.join(SRC_DIR, 'sankey-template.js'))];
    require(path.join(SRC_DIR, 'sankey-template.js'));
    SankeyTemplate = global.window.SankeyTemplate;
  });

  test('builds a self-contained document carrying its data and engine', () => {
    const html = SankeyTemplate.build(Object.assign({ mode: 'app' }, data));
    assert.match(html, /^<!DOCTYPE html>/);
    assert.ok(html.includes('window.__SANKEY_DATA__='), 'data blob');
    assert.ok(html.includes('sankeyEngine') || html.includes('function ('), 'inlined engine');
    assert.ok(!/<script[^>]+src=/.test(html), 'must not reference any external script');
  });

  test('app mode offers export; client mode does not', () => {
    // Match the TOOLBAR MARKUP (id="..."), not the bare id: the engine source is
    // inlined into every mode and always mentions $('btn-export-pdf').
    assert.ok(SankeyTemplate.build(Object.assign({ mode: 'app' }, data)).includes('id="btn-export-pdf"'));
    assert.ok(!SankeyTemplate.build(Object.assign({ mode: 'client' }, data)).includes('id="btn-export-pdf"'));
  });

  test('print mode drops the chrome the PDF must not contain', () => {
    const html = SankeyTemplate.build(Object.assign({ mode: 'print' }, data));
    assert.ok(!html.includes('id="toolbar"'));
    assert.ok(!html.includes('id="hint"'));
    assert.ok(html.includes('class="printing"'));
  });

  test('the From select is omitted when there is only one axis to choose', () => {
    const one = SankeyTemplate.build(Object.assign({ mode: 'app' }, data));
    assert.ok(!one.includes('id="fromsel"'));
    const two = SankeyTemplate.build(Object.assign({ mode: 'app' }, data, {
      froms: [{ key: 'section', label: 'Current section' }, { key: 'site', label: 'Source site' }],
    }));
    assert.ok(two.includes('id="fromsel"'));
  });

  // Regression: the Fit/Legend/Export listeners were once wired inside
  // syncColorByLabels(), which re-runs on every axis change — so each switch
  // stacked another listener. Two toggles per Legend click meant the panel
  // never opened, and Export fired twice. Anything called repeatedly must stay
  // free of side effects.
  test('per-render helpers do not wire persistent chrome', () => {
    const src = fs.readFileSync(path.join(SRC_DIR, 'sankey-template.js'), 'utf8');
    const bodyOf = (fn) => {
      const start = src.indexOf('function ' + fn + '(');
      assert.ok(start > 0, `${fn}() not found — renamed?`);
      const end = src.indexOf('\n    }\n', start);
      assert.ok(end > start, `could not delimit ${fn}()`);
      return src.slice(start, end);
    };

    // These touch only long-lived elements, so ANY listener they add stacks.
    for (const fn of ['syncColorByLabels', 'fillLegend']) {
      assert.ok(!bodyOf(fn).includes('addEventListener'),
        `${fn}() registers a listener; it re-runs, so listeners would stack. Wire it in wireToolbar() instead.`);
    }

    // render() may bind nodes and links — it creates and destroys those each
    // pass, so their listeners go with them. What it must never bind is
    // something that outlives the render: document, or a toolbar control.
    const render = bodyOf('render');
    assert.ok(!/document\.addEventListener/.test(render),
      'render() binds document; that listener outlives the render and would stack');
    assert.ok(!/\$\('(btn-|legend-btn|colorby|fromsel)[^']*'\)\.addEventListener/.test(render),
      'render() binds a toolbar control; those persist across renders and would stack');
  });

  test('the legend panel escapes the toolbar\'s overflow clip', () => {
    // #toolbar sets overflow-x:auto, which per spec forces overflow-y to auto —
    // an absolutely-positioned panel hanging below the bar gets clipped to a sliver.
    const html = SankeyTemplate.build(Object.assign({ mode: 'app' }, data));
    const rule = /#legend-panel\{([^}]*)\}/.exec(html);
    assert.ok(rule, '#legend-panel rule missing');
    assert.match(rule[1], /position:fixed/, 'must be fixed, not absolute');
    const z = /z-index:(\d+)/.exec(rule[1]);
    assert.ok(z && Number(z[1]) > 100, 'must sit above the toolbar (z-index 100)');
  });
});
