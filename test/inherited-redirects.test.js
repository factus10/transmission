// ════════════════════════════════════════════════════════════════════════════
// Inherited (3xx) redirects — carry-forward resolution and classification
//
// Run with `npm test`.
//
// A 3xx in the crawl is a redirect rule that already exists on the live site.
// Copying its destination verbatim ships a rule pointing at the OLD site's
// answer; these tests pin that the destination is re-derived against what the
// target is actually becoming, and that the cases the app cannot resolve are
// separated from each other rather than lumped into one "unknown".
//
// Same source-lifting sandbox as the other suites — see test/sankey.test.js.
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
  if (start < 0) throw new Error(`renderer.js has no top-level "function ${name}("`);
  const end = source.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`could not find the closing brace of ${name}()`);
  return source.slice(start + 1, end + 3);
}
function extractConstArray(name) {
  const start = source.indexOf('const ' + name + ' = [');
  if (start < 0) throw new Error(`${name} is no longer a top-level const array`);
  const end = source.indexOf('\n];\n', start);
  return source.slice(start, end + 4);
}

const PRELUDE = String.raw`
const REDIRECT_DEST_COL = 'Redirect_Destination';
const REDIRECT_SRC_COL = '_RedirectSource';
const CONSOLIDATE_COL = 'Consolidate_Into';
const CONSOLIDATE_ID_COL = '_ConsolidateTargetId';
var state = null;
function kkeCol() { return 'KKE_Recommendation'; }
function finalKkeCol() { return 'Final_KKE'; }
function consolidateTargetAddr(row) {
  return String(row['_ConsolidateTargetId'] || '').trim() || String(row['Consolidate_Into'] || '').trim();
}
function isFragmentRow(row) { return String(row['Content_Nature'] || '') === 'Fragment'; }
function getRedirectBaseUrl() { return 'https://example.edu'; }
function reportRows() { return state.editedRows; }
function normalizeSourceHost(h) { return String(h || '').toLowerCase().replace(/^www\./, ''); }
function siteOfRow(row) {
  const h = (() => { try { return normalizeSourceHost(new URL(String(row['Address'] || '')).host); } catch (_) { return ''; } })();
  return (state.siteLibrary || []).find(s => (s.hosts || []).includes(h)) || null;
}
function logChange() {}
function setDirty() {}
function showToast() {}
function renderRedirectEditor() {}
`;

vm.runInThisContext(
  PRELUDE +
  extractConstArray('INHERITED_REDIRECT_CLASSES') +
  extract('redirectPathOf') + extract('isSelfRedirect') +
  extract('statusCodeCategory') + extract('statusCodeCol') + extract('nonContentKind') +
  extract('redirectUrlCol') + extract('crawlRedirectUrl') +
  extract('knownSourceHosts') + extract('hostOfUrl') + extract('effectiveKke') +
  extract('writeRedirectDestination') +
  extract('buildRedirectResolverContext') + extract('resolveRedirectDestinations') +
  extract('classifyInheritedRedirect') + extract('inheritedRedirectFindings') +
  extract('resyncNavBasedRedirects') + extract('validateSiteDomain')
);

const HOST = 'https://example.edu';

/** rows: [{url, sc, kke, redirectUrl, computedPath, dest, src, consolidateTo}] */
function seed(rows, opts = {}) {
  state = {
    urlColumn: 'Address',
    headers: ['Address', 'Status Code', 'Redirect URL', 'KKE_Recommendation', 'Computed Path',
              'Redirect_Destination', '_RedirectSource', '_ConsolidateTargetId', 'Final_KKE'],
    editedRows: rows.map(r => ({
      Address: r.url,
      'Status Code': r.sc || '200',
      'Redirect URL': r.redirectUrl || '',
      KKE_Recommendation: r.kke || '',
      'Computed Path': r.computedPath || '',
      Redirect_Destination: r.dest || '',
      _RedirectSource: r.src || '',
      _ConsolidateTargetId: r.consolidateTo || '',
      Final_KKE: '',
    })),
    navNodes: [],
    siteLibrary: opts.siteLibrary || [{ label: 'Example', hosts: ['example.edu'], inScope: true }],
    projectSettings: opts.projectSettings || {},
  };
  globalThis.state = state;
}
const rowFor = (url) => state.editedRows.find(r => r.Address === url);
const destOf = (url) => rowFor(url).Redirect_Destination;
const srcOf = (url) => rowFor(url)._RedirectSource;

describe('carry-forward — the destination follows what the target becomes', () => {
  test('an inherited redirect re-points when its target moves via the sitemap', () => {
    // The whole bug: /old 301s to /programs/nursing today; that page is moving
    // to /academics/nursing. Freezing the crawl value ships a rule to a URL
    // that will not exist.
    seed([
      { url: `${HOST}/old`, sc: '301', redirectUrl: `${HOST}/programs/nursing`,
        kke: 'Kill', dest: `${HOST}/programs/nursing`, src: 'inherited' },
      { url: `${HOST}/programs/nursing`, kke: 'Keep', computedPath: 'academics/nursing' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/old`), `${HOST}/academics/nursing`);
    assert.equal(srcOf(`${HOST}/old`), 'inherited', 'provenance must survive the re-derive');
  });

  test('it follows the target through a consolidation to the surviving page', () => {
    seed([
      { url: `${HOST}/old`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', src: 'inherited' },
      { url: `${HOST}/b`, kke: 'Consolidate', consolidateTo: `${HOST}/c` },
      { url: `${HOST}/c`, kke: 'Keep', computedPath: 'merged' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/old`), `${HOST}/merged`);
  });

  test('it collapses a live-site chain into one hop', () => {
    // A → B → C on the live site, B untriaged. Shipping a rule to B sends the
    // visitor through a URL that is itself being retired.
    seed([
      { url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', src: 'inherited' },
      { url: `${HOST}/b`, sc: '301', redirectUrl: `${HOST}/c` },
      { url: `${HOST}/c`, kke: 'Keep', computedPath: 'final' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/a`), `${HOST}/final`);
  });

  test('a live-site redirect loop terminates instead of hanging', () => {
    seed([
      { url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', src: 'inherited' },
      { url: `${HOST}/b`, sc: '301', redirectUrl: `${HOST}/a` },
    ]);
    resolveRedirectDestinations();               // must not blow the stack
    assert.equal(destOf(`${HOST}/a`), '');       // a loop is not a destination
  });

  test('an intentional 404 on the target propagates', () => {
    seed([
      { url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', src: 'inherited' },
      { url: `${HOST}/b`, kke: 'Kill', dest: '404', src: 'manual' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/a`), '404');
  });

  test('an off-site destination is carried verbatim', () => {
    seed([
      { url: `${HOST}/a`, sc: '301', redirectUrl: 'https://other.org/page', kke: 'Kill', src: 'inherited' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/a`), 'https://other.org/page');
  });
});

describe('carry-forward — what still outranks the inherited hop', () => {
  test('a sitemap placement wins over the live site’s answer', () => {
    // Someone placed this URL deliberately; that is a decision, the 301 is not.
    seed([
      { url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', src: 'inherited' },
      { url: `${HOST}/b`, kke: 'Keep' },
    ]);
    state.editedRows[0]['Sitemap_ID'] = 'N001';
    state.navNodes = [{ id: 'N001', computedPath: 'chosen/by/hand' }];
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/a`), `${HOST}/chosen/by/hand`);
  });

  test('a consolidation target wins too', () => {
    seed([
      { url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill',
        src: 'inherited', consolidateTo: `${HOST}/c` },
      { url: `${HOST}/b`, kke: 'Keep' },
      { url: `${HOST}/c`, kke: 'Keep', computedPath: 'master' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/a`), `${HOST}/master`);
  });

  test('the inherited hop beats the blanket project default', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', src: 'inherited' },
          { url: `${HOST}/b`, kke: 'Keep' }],
         { projectSettings: { defaultRedirectUrl: `${HOST}/` } });
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/a`), `${HOST}/b`);
  });

  test('a hand-typed destination is still never touched', () => {
    seed([
      { url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill',
        dest: `${HOST}/deliberate`, src: 'manual' },
      { url: `${HOST}/b`, kke: 'Keep', computedPath: 'moved' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/a`), `${HOST}/deliberate`);
  });

  test('a pre-provenance file (blank source) keeps the cautious old behavior', () => {
    // Every project written before _RedirectSource existed reads back blank.
    seed([
      { url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', dest: `${HOST}/b`, src: '' },
      { url: `${HOST}/b`, kke: 'Keep', computedPath: 'moved' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/a`), `${HOST}/b`, 'an ambiguous existing value must not be rewritten');
  });
});

describe('a migration that preserves URLs (no sitemap at all)', () => {
  // The workflow that ruled out "warn when the destination isn't placed on the
  // sitemap": plenty of projects re-use every existing URL in the new CMS and
  // never build a tree. Placement-based warnings would fire on every single row.
  const preserved = () => {
    seed([
      { url: `${HOST}/old-a`, sc: '301', redirectUrl: `${HOST}/keeper`, kke: 'Kill', src: 'inherited',
        dest: `${HOST}/keeper` },
      { url: `${HOST}/keeper`, kke: 'Keep' },   // decided, no Computed Path, no node
    ]);
  };

  test('destinations are left exactly as the live site has them', () => {
    preserved();
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/old-a`), `${HOST}/keeper`);
  });

  test('nothing is flagged for review', () => {
    preserved();
    const f = inheritedRedirectFindings();
    const actionable = INHERITED_REDIRECT_CLASSES.filter(c => c.actionable)
      .reduce((n, c) => n + f.byClass[c.key].length, 0);
    assert.equal(actionable, 0);
    assert.equal(f.byClass.ok.length, 1);
  });

  test('the SAME project with the destination still undecided IS flagged', () => {
    // Proves the signal comes from the decision, not from having a sitemap.
    preserved();
    rowFor(`${HOST}/keeper`).KKE_Recommendation = '';
    assert.equal(inheritedRedirectFindings().byClass.undecided.length, 1);
  });
});

describe('classification — the cases the app cannot resolve alone', () => {
  const classOf = (url) => {
    const f = inheritedRedirectFindings();
    for (const c of INHERITED_REDIRECT_CLASSES) {
      if (f.byClass[c.key].some(x => x.url === url)) return c.key;
    }
    return null;
  };

  test('destination is a page in the audit → ok', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill' },
          { url: `${HOST}/b`, kke: 'Keep' }]);
    assert.equal(classOf(`${HOST}/a`), 'ok');
  });

  test('destination on our own site but NOT in the crawl → uncrawled, not external', () => {
    // The distinction that matters: a hole in the data, not an off-site link.
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/never-crawled`, kke: 'Kill' }]);
    assert.equal(classOf(`${HOST}/a`), 'uncrawled');
  });

  test('destination on another domain → external', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: 'https://elsewhere.com/x', kke: 'Kill' }]);
    assert.equal(classOf(`${HOST}/a`), 'external');
  });

  test('destination returns 4xx → dead', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/gone`, kke: 'Kill' },
          { url: `${HOST}/gone`, sc: '404' }]);
    assert.equal(classOf(`${HOST}/a`), 'dead');
  });

  test('destination is on an out-of-scope site → out-of-scope', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: 'https://legacy.edu/x', kke: 'Kill' },
          { url: 'https://legacy.edu/x', kke: 'Keep' }],
         { siteLibrary: [
             { label: 'Example', hosts: ['example.edu'], inScope: true },
             { label: 'Legacy', hosts: ['legacy.edu'], inScope: false }] });
    assert.equal(classOf(`${HOST}/a`), 'out-of-scope');
  });

  test('a 3xx with no destination recorded → no-target', () => {
    seed([{ url: `${HOST}/a`, sc: '301', kke: 'Kill' }]);
    assert.equal(classOf(`${HOST}/a`), 'no-target');
  });

  test('a redirect to itself → loop', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/a`, kke: 'Kill' }]);
    assert.equal(classOf(`${HOST}/a`), 'loop');
  });

  test('destination has no KKE decision yet → undecided', () => {
    // The risk that survives every workflow: that page may turn out to be Kill,
    // and then this rule points at nothing.
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill' },
          { url: `${HOST}/b`, kke: '' }]);
    assert.equal(classOf(`${HOST}/a`), 'undecided');
  });

  test('destination is Kill with no redirect of its own → target-retired', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill' },
          { url: `${HOST}/b`, kke: 'Kill' }]);
    assert.equal(classOf(`${HOST}/a`), 'target-retired');
  });

  test('destination is Consolidate with no master picked → target-retired', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill' },
          { url: `${HOST}/b`, kke: 'Consolidate' }]);
    assert.equal(classOf(`${HOST}/a`), 'target-retired');
  });

  test('a Kill destination that HAS its own redirect is fine — the walk passes through', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill' },
          { url: `${HOST}/b`, kke: 'Kill', dest: `${HOST}/c` },
          { url: `${HOST}/c`, kke: 'Keep' }]);
    assert.equal(classOf(`${HOST}/a`), 'ok');
  });

  test('a Consolidate destination with a master is fine', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill' },
          { url: `${HOST}/b`, kke: 'Consolidate', consolidateTo: `${HOST}/c` },
          { url: `${HOST}/c`, kke: 'Keep' }]);
    assert.equal(classOf(`${HOST}/a`), 'ok');
  });

  test('an Excluded destination is not flagged — Exclude is a decision, and the page still exists', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill' },
          { url: `${HOST}/b`, kke: 'Exclude' }]);
    assert.equal(classOf(`${HOST}/a`), 'ok');
  });

  test('a Final_KKE counts as the decision when KKE_Recommendation is blank', () => {
    seed([{ url: `${HOST}/a`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill' },
          { url: `${HOST}/b`, kke: '' }]);
    rowFor(`${HOST}/b`).Final_KKE = 'Keep';
    assert.equal(classOf(`${HOST}/a`), 'ok');
  });

  test('only 3xx rows are classified at all', () => {
    seed([{ url: `${HOST}/a`, kke: 'Keep' }, { url: `${HOST}/b`, sc: '404', kke: 'Kill' }]);
    assert.equal(inheritedRedirectFindings().total, 0);
  });

  test('every class in the table is reachable and exactly one applies per row', () => {
    seed([
      { url: `${HOST}/ok`, sc: '301', redirectUrl: `${HOST}/live` },
      { url: `${HOST}/live`, kke: 'Keep' },
      { url: `${HOST}/ext`, sc: '301', redirectUrl: 'https://elsewhere.com/x' },
      { url: `${HOST}/none`, sc: '301' },
      { url: `${HOST}/self`, sc: '302', redirectUrl: `${HOST}/self` },
    ]);
    const f = inheritedRedirectFindings();
    assert.equal(f.total, 4);
    const seen = Object.values(f.byClass).flat().map(x => x.origIndex);
    assert.equal(new Set(seen).size, seen.length, 'a row landed in two classes');
    assert.equal(seen.length, 4, 'a row landed in no class');
  });
});

// ─── App-derived Kill/Consolidate destinations follow their inputs ──────────
// Found on a real two-site audit: Site Domain had been set to both source
// domains joined by ";", so every derived destination was malformed. Fixing
// the setting repaired Keep/Evolve rows on save but not Kill/Consolidate —
// their branch only re-derived values that "looked" auto-derived, and a stale
// value never matches the new derivation.

describe('recorded auto provenance re-derives on Kill and Consolidate', () => {
  const BAD = 'https://a.edu; https://b.edu';

  test('a Kill 301 with a stale auto destination is corrected on save', () => {
    seed([
      { url: `${HOST}/old`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill',
        dest: `${BAD}/new-b`, src: 'auto' },
      { url: `${HOST}/b`, kke: 'Keep', computedPath: 'new-b' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/old`), `${HOST}/new-b`);
    assert.equal(srcOf(`${HOST}/old`), 'auto');
  });

  test('a Consolidate row with a stale auto destination is corrected on save', () => {
    seed([
      { url: `${HOST}/a`, kke: 'Consolidate', consolidateTo: `${HOST}/b`, dest: `${BAD}/new-b`, src: 'auto' },
      { url: `${HOST}/b`, kke: 'Keep', computedPath: 'new-b' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/a`), `${HOST}/new-b`);
  });

  test('a manual Kill destination is still never touched', () => {
    seed([
      { url: `${HOST}/old`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill',
        dest: `${HOST}/hand-picked`, src: 'manual' },
      { url: `${HOST}/b`, kke: 'Keep', computedPath: 'new-b' },
    ]);
    resolveRedirectDestinations();
    assert.equal(destOf(`${HOST}/old`), `${HOST}/hand-picked`);
  });
});

describe('Re-derive from sitemap covers unplaced Kill/Consolidate rows', () => {
  const withNav = () => { state.navNodes = [{ id: 'n1', computedPath: 'x' }]; };

  test('an unplaced Kill 301 with an auto destination is re-derived', () => {
    seed([
      { url: `${HOST}/old`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', dest: 'https://a.edu; https://b.edu/new-b', src: 'auto' },
      { url: `${HOST}/b`, kke: 'Keep', computedPath: 'new-b' },
    ]);
    withNav();
    resyncNavBasedRedirects();
    assert.equal(destOf(`${HOST}/old`), `${HOST}/new-b`);
  });

  test('inherited provenance is kept; manual and unknown-origin values are left alone', () => {
    seed([
      { url: `${HOST}/i`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', dest: `${HOST}/b`, src: 'inherited' },
      { url: `${HOST}/m`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', dest: `${HOST}/mine`, src: 'manual' },
      { url: `${HOST}/u`, sc: '301', redirectUrl: `${HOST}/b`, kke: 'Kill', dest: `${HOST}/legacy`, src: '' },
      { url: `${HOST}/b`, kke: 'Keep', computedPath: 'new-b' },
    ]);
    withNav();
    resyncNavBasedRedirects();
    assert.equal(destOf(`${HOST}/i`), `${HOST}/new-b`);
    assert.equal(srcOf(`${HOST}/i`), 'inherited');
    assert.equal(destOf(`${HOST}/m`), `${HOST}/mine`);
    assert.equal(destOf(`${HOST}/u`), `${HOST}/legacy`);
  });
});

describe('validateSiteDomain', () => {
  test('accepts one URL, with or without a path, and normalizes the trailing slash', () => {
    assert.deepEqual(validateSiteDomain('https://business.pitt.edu/'), { ok: true, value: 'https://business.pitt.edu', error: '' });
    assert.equal(validateSiteDomain('https://pitt.edu/business').ok, true);
    assert.equal(validateSiteDomain('').ok, true, 'blank means auto-detect');
  });
  test('rejects a list of domains, whatever the separator', () => {
    for (const v of ['https://a.edu; https://b.edu', 'https://a.edu, https://b.edu',
                     'https://a.edu https://b.edu', 'https://a.eduhttps://b.edu']) {
      assert.equal(validateSiteDomain(v).ok, false, v);
    }
  });
  test('rejects a missing scheme, a query, or garbage', () => {
    assert.equal(validateSiteDomain('business.pitt.edu').ok, false);
    assert.equal(validateSiteDomain('https://a.edu/?x=1').ok, false);
    assert.equal(validateSiteDomain('https://').ok, false);
    assert.equal(validateSiteDomain('ftp://a.edu').ok, false);
  });
});
