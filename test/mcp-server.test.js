// ════════════════════════════════════════════════════════════════════════════
// MCP server — read-only project access (mcp/)
//
// Run with `npm test`. See docs/dev/MCP_SERVER_PROPOSAL.md.
//
// Two couplings here are deliberate, and both exist to turn silent drift into a
// failing test:
//
// 1. The fixture database is built from the CREATE TABLE text LIFTED OUT OF
//    project-store.js, not from a copy of it. The server doesn't load
//    ProjectStore (it ships with no node_modules, and opening migrates), so
//    it reads the same tables through node:sqlite — two readers of one schema.
//    If the schema changes and the server hasn't followed, this suite is what
//    notices.
//
// 2. The filter operators are a port of renderer.js fieldFilterMatches(). The
//    drift test lifts the original (same source-lifting approach as the other
//    suites — see docs/dev/TESTING.md) and asserts the two agree over a matrix.
//    "Almost the same filter" is the failure nobody would notice by eye.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const mcp = require(path.join(ROOT, 'mcp', 'lib', 'project.js'));
const { DatabaseSync } = mcp.sqlite();   // the server's own loader, which swallows node:sqlite's experimental warning

// ─── Fixture ─────────────────────────────────────────────────────────────────

function liftSchemaSql() {
  const src = fs.readFileSync(path.join(ROOT, 'project-store.js'), 'utf8');
  const start = src.indexOf('_createSchema() {');
  if (start < 0) throw new Error('project-store.js no longer has _createSchema() — the MCP fixture lifts its SQL from there');
  const open = src.indexOf('this.db.exec(`', start);
  const close = src.indexOf('`);', open);
  if (open < 0 || close < 0) throw new Error('could not find the CREATE TABLE template in _createSchema()');
  // The proposals table is declared separately (PROPOSALS_DDL), because the
  // migration step reuses it; lift that too so the fixture is the real v2 schema.
  const pStart = src.indexOf('const PROPOSALS_DDL = `');
  const pEnd = pStart < 0 ? -1 : src.indexOf('`;', pStart);
  if (pStart < 0 || pEnd < 0) throw new Error('project-store.js no longer declares PROPOSALS_DDL');
  return src.slice(open + 'this.db.exec(`'.length, close) + '\n' + src.slice(pStart + 'const PROPOSALS_DDL = `'.length, pEnd);
}

const HEADERS = [
  'Address', 'Title 1', 'Status Code', 'Word Count', 'MRA_Recommendation', 'Final_MRA', 'Tags', 'Notes', 'Group',
  'Audiences', 'Redirect_Destination', '_RedirectSource', 'Sitemap_ID', 'Source_Site', 'Content_Nature',
  'Consolidate_Into', '_ConsolidateTargetId'
];

function row(o) {
  const r = {};
  for (const h of HEADERS) r[h] = '';
  return Object.assign(r, o);
}

const ROWS = [
  row({ Address: 'https://www.alpha.edu/', 'Title 1': 'Alpha Home', 'Status Code': '200', 'Word Count': '1,250', MRA_Recommendation: 'Migrate', Sitemap_ID: 'n1', Source_Site: 'Alpha', Audiences: 'Prospective Students, Alumni' }),
  row({ Address: 'https://www.alpha.edu/news/a', 'Title 1': 'News A', 'Status Code': '200', 'Word Count': '300', MRA_Recommendation: 'Migrate', Final_MRA: 'Archive', Sitemap_ID: 'n3', Source_Site: 'Alpha', Tags: 'outdated, thin-content', Redirect_Destination: 'https://new.alpha.edu/news', _RedirectSource: 'auto' }),
  row({ Address: 'https://www.alpha.edu/news/b', 'Title 1': 'News B', 'Status Code': '200', 'Word Count': '90', MRA_Recommendation: 'Revise', Sitemap_ID: 'n3', Source_Site: 'Alpha', Tags: 'thin-content', Audiences: 'Alumni' }),
  row({ Address: 'https://www.alpha.edu/news/c', 'Title 1': 'News C', 'Status Code': '200', MRA_Recommendation: 'Consolidate', Source_Site: 'Alpha', Consolidate_Into: 'news/b', _ConsolidateTargetId: 'https://www.alpha.edu/news/b' }),
  row({ Address: 'https://www.alpha.edu/old', 'Title 1': '', 'Status Code': '301', MRA_Recommendation: 'Archive', Source_Site: 'Alpha', Redirect_Destination: 'https://new.alpha.edu/', _RedirectSource: 'inherited' }),
  row({ Address: 'https://www.alpha.edu/gone', 'Status Code': '404', MRA_Recommendation: 'Archive', Source_Site: 'Alpha', Redirect_Destination: '404', _RedirectSource: 'manual' }),
  row({ Address: 'https://www.alpha.edu/broken', 'Title 1': 'Broken', 'Status Code': '500', Source_Site: 'Alpha' }),
  row({ Address: 'https://www.alpha.edu/about', 'Title 1': 'About', 'Status Code': '200', Source_Site: 'Alpha' }),
  row({ Address: 'https://www.alpha.edu/snippet', 'Title 1': 'Footer snippet', 'Status Code': '200', MRA_Recommendation: 'Migrate', Source_Site: 'Alpha', Content_Nature: 'Fragment' }),
  row({ Address: 'https://legacy.alpha.edu/page', 'Title 1': 'Legacy', 'Status Code': '200', MRA_Recommendation: 'Migrate', Source_Site: 'Legacy' })
];

const NAV = [
  { number: '1', id: 'n1', label: 'Home', parentNumber: '', computedPath: '', breadcrumb: 'Home' },
  { number: '1.1', id: 'n2', label: 'Newsroom', parentNumber: '1', computedPath: 'newsroom', breadcrumb: 'Home > Newsroom' },
  { number: '1.1.1', id: 'n3', label: 'Articles', parentNumber: '1.1', computedPath: 'newsroom/articles', breadcrumb: 'Home > Newsroom > Articles', pageStatus: 'In Progress' },
  { number: '1.2', id: 'n4', label: 'Later', parentNumber: '1', computedPath: 'later', phase: 'Future', audiences: 'Alumni, Donors' }
];

const SETTINGS = {
  clientName: 'Alpha University',
  projectName: 'Web consolidation',
  siteLibrary: [
    { label: 'Alpha', hosts: ['alpha.edu'], inScope: true },
    { label: 'Legacy', hosts: ['legacy.alpha.edu'], inScope: false }
  ],
  savedFilters: [
    { name: 'Thin news', filterText: '', kkeFilter: ['Migrate', '_unreviewed'], groupFilter: '', fieldFilters: [{ field: 'Address', operator: 'contains', value: '/news/' }] },
    { name: 'Dupes', filterText: '', kkeFilter: ['_duplicates'], groupFilter: '', fieldFilters: [] }
  ],
  glossary: { tags: { 'thin-content': 'Under 150 words.' }, groups: {} }
};

const CHANGELOG = [
  ['2026-09-01T10:00:00.000Z', 'david', 1, 'https://www.alpha.edu/news/a', 'MRA_Recommendation', '', 'Migrate'],
  ['2026-09-05T10:00:00.000Z', 'sme-import', 1, 'https://www.alpha.edu/news/a', 'Final_MRA', '', 'Archive'],
  ['2026-09-06T10:00:00.000Z', 'david', 2, 'https://www.alpha.edu/news/b', 'MRA_Recommendation', 'Migrate', 'Revise']
];

function buildFixture(file, { userVersion = 1, headers = HEADERS, rows = ROWS, settings = SETTINGS, changelog = CHANGELOG } = {}) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(liftSchemaSql());
  db.exec(`PRAGMA user_version = ${userVersion};`);
  const ins = (sql, list) => { const st = db.prepare(sql); list.forEach(args => st.run(...args)); };
  ins('INSERT INTO headers (pos, name) VALUES (?, ?)', headers.map((h, i) => [i, h]));
  ins('INSERT INTO rows (idx, data) VALUES (?, ?)', rows.map((r, i) => [i, JSON.stringify(r)]));
  ins('INSERT INTO nav_nodes (idx, data) VALUES (?, ?)', NAV.map((n, i) => [i, JSON.stringify(n)]));
  ins('INSERT INTO settings (key, value) VALUES (?, ?)', Object.entries(settings).map(([k, v]) => [k, JSON.stringify(v)]));
  ins('INSERT INTO meta (key, value) VALUES (?, ?)', [['savedAt', '2026-09-10T12:00:00.000Z'], ['appVersion', '2.18.0']]);
  ins('INSERT INTO changelog (timestamp, auditor, row, url, field, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)', changelog);
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  db.close();
}

let dir, file;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transmission-mcp-'));
  file = path.join(dir, 'audit.transmission');
  buildFixture(file);
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const group = (res, ...vals) => {
  const g = res.groups.find(x => Object.values(x.values).every((v, i) => v === vals[i]));
  return g ? g.count : 0;
};

// ─── Loader ──────────────────────────────────────────────────────────────────

describe('loader', () => {
  test('the schema still lifts out of project-store.js with every table the server reads', () => {
    const sql = liftSchemaSql();
    for (const t of ['meta', 'headers', 'rows', 'nav_nodes', 'settings', 'changelog', 'proposals']) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${t} \\(`), `${t} table`);
    }
  });

  test('reads rows, detects columns, and honors the scope registry', () => {
    const p = mcp.loadProject(file);
    assert.equal(p.rows.length, 10);
    assert.equal(p.urlColumn, 'Address');
    assert.equal(p.columnMap.kke, 'MRA_Recommendation');
    assert.equal(p.columnMap.finalKke, 'Final_MRA');
    assert.equal(p.statusCodeColumn, 'Status Code');
    assert.equal(p.select({}).length, 9, 'the out-of-scope Legacy row is excluded by default');
    assert.equal(p.select({ scope: 'all' }).length, 10);
  });

  test('a saved column mapping wins over auto-detection, but only while the column exists', () => {
    const f = path.join(dir, 'mapped.transmission');
    buildFixture(f, { headers: [...HEADERS, 'Verdict'] });
    const db = new DatabaseSync(f);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('columnMap', JSON.stringify({ kke: 'Verdict', finalKke: 'No Such Column' }));
    db.close();
    const p = mcp.loadProject(f);
    assert.equal(p.columnMap.kke, 'Verdict');
    assert.equal(p.columnMap.finalKke, 'Final_MRA', 'a stale saved name falls through to detection');
  });

  test('DRIFT: the proposals table the app creates has exactly the columns the server writes', () => {
    const sql = liftSchemaSql();
    const m = /CREATE TABLE IF NOT EXISTS proposals \(([\s\S]*?)\);/.exec(sql);
    assert.ok(m, 'project-store.js declares a proposals table');
    const appCols = m[1].split('\n').map(l => l.trim().split(/\s+/)[0]).filter(c => c && !/^(PRIMARY|UNIQUE|CHECK)/.test(c));
    assert.deepEqual(appCols, mcp.PROPOSAL_COLUMNS);
    const sm = /CREATE TABLE IF NOT EXISTS proposals \(([\s\S]*?)\);/.exec(mcp.PROPOSALS_DDL);
    const srvCols = sm[1].split('\n').map(l => l.trim().split(/\s+/)[0]).filter(c => c && !/^(PRIMARY|UNIQUE|CHECK)/.test(c));
    assert.deepEqual(srvCols, appCols);
  });

  test('refuses a project from a newer schema rather than misreading it', () => {
    const f = path.join(dir, 'newer.transmission');
    buildFixture(f, { userVersion: mcp.SUPPORTED_SCHEMA_VERSION + 1 });
    assert.throws(() => mcp.loadProject(f), /schema v\d+.*Update the server/s);
  });

  test('a file that is not a project fails with a message a person can act on', () => {
    const f = path.join(dir, 'crawl.xlsx');
    fs.writeFileSync(f, 'PK not sqlite at all, padded out so sqlite reads a full header '.repeat(4));
    assert.throws(() => mcp.loadProject(f), /not a Transmission project.*Save As Project/s);
    assert.throws(() => mcp.loadProject(path.join(dir, 'missing.transmission')), /File not found/);
  });

  test('legacy nav column names are read as their current names, in memory only', () => {
    const f = path.join(dir, 'legacy.transmission');
    const headers = HEADERS.map(h => h === 'Sitemap_ID' ? 'NavID' : h);
    const rows = ROWS.map(r => { const c = { ...r, NavID: r.Sitemap_ID }; delete c.Sitemap_ID; return c; });
    buildFixture(f, { headers, rows });
    const before_ = sha(f);
    const p = mcp.loadProject(f);
    assert.ok(p.headers.includes('Sitemap_ID') && !p.headers.includes('NavID'));
    assert.equal(p.getSitemap({ depth: 0 }).tree[0].livePages, 1);
    assert.equal(sha(f), before_);
  });

  test('one unreadable row is quarantined, not fatal, and does not shift the rows after it', () => {
    const f = path.join(dir, 'damaged.transmission');
    buildFixture(f);
    const db = new DatabaseSync(f);
    db.prepare('UPDATE rows SET data = ? WHERE idx = 2').run('{"Address": "https://trunc');
    db.close();
    const p = mcp.loadProject(f);
    assert.equal(p.rows.length, 10);
    assert.equal(p.parseErrors.length, 1);
    assert.equal(p.url(p.rows[3]), 'https://www.alpha.edu/news/c');
    assert.equal(p.overview().damagedEntries.length, 1);
  });
});

// ─── Read-only guarantee ─────────────────────────────────────────────────────

describe('read-only', () => {
  test('a full battery of tool calls leaves the project file byte-identical', () => {
    const f = path.join(dir, 'untouched.transmission');
    buildFixture(f);
    const before_ = sha(f);
    const p = mcp.loadProject(f);
    p.overview();
    p.describeColumns({});
    p.describeColumns({ columns: ['Tags', '@effective_decision'] });
    p.aggregate({ groupBy: ['@effective_decision', 'Tags'] });
    p.queryRows({ sortBy: 'Word Count', sortDir: 'desc' });
    p.getRow({ url: 'https://www.alpha.edu/news/a', includeInternal: true });
    p.getSitemap({ depth: 0 });
    p.getRedirects({});
    p.getRedirects({ mode: 'list' });
    p.changelog({});
    p.changelog({ summary: true });
    p.getLibraries({});
    p.getLibraries({ which: ['savedFilters', 'sites', 'glossary'] });
    assert.equal(sha(f), before_);

    const db = new DatabaseSync(f, { readOnly: true });
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1, 'never migrated');
    db.close();
  });
});

// ─── Counting rules ──────────────────────────────────────────────────────────

describe('overview', () => {
  test('separates content from inherited redirects and dead URLs — and keeps 5xx as content', () => {
    const o = mcp.loadProject(file).overview();
    assert.deepEqual({ ...o.contentSplit, note: undefined }, { content: 7, redirect: 1, gone: 1, note: undefined });
    assert.equal(o.rows.outOfScope, 1);
  });

  test('reports both readings of progress: every row for the auditor, content only for the client', () => {
    const o = mcp.loadProject(file).overview();
    assert.deepEqual([o.auditorProgress.reviewed, o.auditorProgress.of], [7, 9]);
    assert.deepEqual([o.contentInventory.reviewed, o.contentInventory.of], [5, 7]);
  });

  test('Final_MRA wins over the recommendation, and blank is unreviewed — never Keep', () => {
    const k = mcp.loadProject(file).overview().effectiveKke.contentOnly;
    assert.deepEqual(k, { Migrate: 2, Archive: 1, Revise: 1, Consolidate: 1, '(unreviewed)': 2 });
  });

  test('placement counts only Keep/Evolve content pages that are owed a home (fragments are not)', () => {
    const o = mcp.loadProject(file).overview();
    assert.deepEqual(o.placement, { migrateReviseContentPages: 2, placedInSitemap: 2 });
  });
});

describe('aggregate', () => {
  test('groups by a virtual field and labels blank as (blank)', () => {
    const p = mcp.loadProject(file);
    const res = p.aggregate({ groupBy: ['@effective_decision'] });
    assert.equal(res.matchedRows, 9);
    assert.equal(group(res, 'Archive'), 3);
    assert.equal(group(res, '(blank)'), 2);
  });

  test('splits comma-separated cells, says so, and can be told not to', () => {
    const p = mcp.loadProject(file);
    const split = p.aggregate({ groupBy: ['Tags'], filters: [{ field: 'Tags', operator: 'is-not-blank' }] });
    assert.equal(group(split, 'thin-content'), 2);
    assert.equal(group(split, 'outdated'), 1);
    assert.match(split.note, /can sum to more than matchedRows/);

    const whole = p.aggregate({ groupBy: ['Tags'], splitCsv: false, filters: [{ field: 'Tags', operator: 'is-not-blank' }] });
    assert.equal(group(whole, 'outdated, thin-content'), 1);
    assert.equal(whole.note, undefined);
  });

  test('crosses two fields', () => {
    const res = mcp.loadProject(file).aggregate({ groupBy: ['@path_1', '@content_kind'] });
    assert.equal(group(res, '/news', 'content'), 3);
    assert.equal(group(res, '/old', 'redirect'), 1);
    assert.equal(group(res, '/', 'content'), 1);
  });

  test('field names are case-insensitive; an unknown one is an error with a suggestion, not a column of blanks', () => {
    const p = mcp.loadProject(file);
    assert.equal(p.aggregate({ groupBy: ['status code'] }).groupBy[0], 'Status Code');
    assert.throws(() => p.aggregate({ groupBy: ['Wordcount'] }), /Unknown field "Wordcount".*Word Count/s);
    assert.throws(() => p.aggregate({ groupBy: ['@nope'] }), /Unknown virtual field/);
    assert.throws(() => p.select({ filters: [{ field: 'Tags', operator: 'like', value: 'x' }] }), /Unknown operator "like"/);
  });

  test('an audit column the project predates reads blank instead of erroring', () => {
    const res = mcp.loadProject(file).aggregate({ groupBy: ['Jobs_Served'] });
    assert.equal(group(res, '(blank)'), 9);
  });
});

// ─── Filters ─────────────────────────────────────────────────────────────────

describe('filters', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'renderer.js'), 'utf8');
  function extract(name) {
    const start = source.indexOf('\nfunction ' + name + '(');
    if (start < 0) throw new Error(`renderer.js has no top-level "function ${name}(" — renamed, or no longer declared at column 0?`);
    const end = source.indexOf('\n}\n', start);
    return source.slice(start + 1, end + 3);
  }

  test('DRIFT: the ported operators agree with renderer.js on every operator × cell shape', () => {
    const original = vm.runInNewContext(
      ['fieldFilterNumber', 'fieldFilterCompare', 'fieldFilterMatches', 'statusCodeCategory'].map(extract).join('\n')
      + '\n({ fieldFilterMatches, statusCodeCategory })'
    );
    const cells = ['', '  ', 'Migrate', 'keep', 'KEEPER', '1,234', '1234', '99', '-5', '.5', '5.', 'abc', 'ABC', 'Zebra', 'a b', undefined, null, 0, 1234];
    const needles = ['', 'keep', 'Migrate', '1,000', '100', 'abc', 'b', '5', undefined];
    let compared = 0;
    for (const operator of [...mcp.FIELD_FILTER_OPERATORS, 'not-an-operator']) {
      for (const cell of cells) for (const value of needles) {
        const row = { F: cell }, ff = { field: 'F', operator, value };
        assert.equal(mcp.fieldFilterMatches(row, ff), original.fieldFilterMatches(row, ff),
          `${operator}: cell ${JSON.stringify(cell)} vs ${JSON.stringify(value)}`);
        compared++;
      }
    }
    assert.ok(compared > 1500, 'the matrix actually ran');
    for (const code of ['200', '301', '399', '404', '500', '', 'abc', 600, 299]) {
      assert.equal(mcp.statusCodeCategory(code), original.statusCodeCategory(code), `status ${code}`);
    }
  });

  test('DRIFT: every operator the app offers is one the server accepts', () => {
    const start = source.indexOf('const FIELD_FILTER_OPERATORS = [');
    const table = source.slice(start, source.indexOf('\n];\n', start));
    const appOps = [...table.matchAll(/value: '([^']+)'/g)].map(m => m[1]);
    assert.ok(appOps.length >= 10);
    assert.deepEqual([...mcp.FIELD_FILTER_OPERATORS].sort(), appOps.sort());
  });

  test('ordering is numeric when both sides are numbers, and blank matches neither direction', () => {
    const p = mcp.loadProject(file);
    const over = p.select({ filters: [{ field: 'Word Count', operator: 'greater-than', value: '100' }] });
    assert.deepEqual(over.map(r => r['Word Count']), ['1,250', '300']);
    const under = p.select({ filters: [{ field: 'Word Count', operator: 'less-than', value: '100' }] });
    assert.deepEqual(under.map(r => r['Word Count']), ['90']);
  });

  test('filters can read virtual fields', () => {
    const p = mcp.loadProject(file);
    const rows = p.select({ filters: [
      { field: '@effective_decision', operator: 'equals', value: 'kill' },
      { field: '@content_kind', operator: 'equals', value: 'content' }
    ] });
    assert.deepEqual(rows.map(r => p.url(r)), ['https://www.alpha.edu/news/a']);
  });

  test('a saved filter applies the way the sidebar would: statuses OR specials, on the recommendation column', () => {
    const p = mcp.loadProject(file);
    // News A is Keep by recommendation (Final_MRA Kill is irrelevant to the sidebar's
    // status match); News C is Consolidate, so it is out; nothing under /news/ is unreviewed.
    assert.deepEqual(p.select({ savedFilter: 'thin news' }).map(r => r['Title 1']), ['News A']);
  });

  test('a saved filter that needs app-only state is refused by name, not quietly half-applied', () => {
    const p = mcp.loadProject(file);
    assert.throws(() => p.select({ savedFilter: 'Dupes' }), /_duplicates.*only the app can compute/s);
    assert.throws(() => p.select({ savedFilter: 'Nope' }), /No saved filter named "Nope".*Thin news, Dupes/s);
    const listed = p.getLibraries({ which: ['savedFilters'] }).savedFilters;
    assert.equal(listed.find(f => f.name === 'Dupes').usableHere, 'no — uses _duplicates');
    assert.equal(listed.find(f => f.name === 'Thin news').usableHere, 'yes');
  });
});

// ─── Rows, sitemap, redirects, changelog ─────────────────────────────────────

describe('rows', () => {
  test('query_rows always carries the URL, pages, and sorts numerically with blanks last', () => {
    const p = mcp.loadProject(file);
    const res = p.queryRows({ columns: ['Word Count'], sortBy: 'Word Count', sortDir: 'desc', limit: 2 });
    assert.deepEqual(res.columns, ['Address', 'Word Count']);
    assert.deepEqual(res.rows.map(r => r['Word Count']), ['1,250', '300']);
    assert.equal(res.total, 9);
    assert.equal(res.nextOffset, 2);
    const asc = p.queryRows({ columns: ['Word Count'], sortBy: 'Word Count' });
    assert.deepEqual(asc.rows.slice(0, 3).map(r => r['Word Count']), ['90', '300', '1,250']);
  });

  test('get_row forgives a trailing slash, hides internal columns by default, and carries history', () => {
    const p = mcp.loadProject(file);
    const r = p.getRow({ url: 'https://www.alpha.edu/news/a/' });
    assert.equal(r.url, 'https://www.alpha.edu/news/a');
    assert.equal(r.derived.effectiveKke, 'Archive');
    assert.equal(r.fields._RedirectSource, undefined);
    assert.equal(p.getRow({ url: r.url, includeInternal: true }).fields._RedirectSource, 'auto');
    assert.equal(r.sitemapNode.label, 'Articles');
    assert.deepEqual(r.history.map(h => h.field), ['Final_MRA', 'MRA_Recommendation'], 'newest first');
    assert.throws(() => p.getRow({ url: 'https://www.alpha.edu/nope' }), /No row with URL/);
  });

  test('get_row reports what consolidates INTO a page, via the identity column', () => {
    const r = mcp.loadProject(file).getRow({ url: 'https://www.alpha.edu/news/b' });
    assert.deepEqual(r.consolidatedFrom, ['https://www.alpha.edu/news/c']);
  });
});

describe('sitemap', () => {
  test('live pages exclude Archive; subtree rows count everything; a pageless parent of live pages is net new', () => {
    const tree = mcp.loadProject(file).getSitemap({ depth: 0 }).tree;
    const home = tree[0], newsroom = home.children[0], articles = newsroom.children[0], later = home.children[1];
    assert.deepEqual([home.livePages, home.subtreeRows], [1, 3]);
    assert.deepEqual([articles.livePages, articles.subtreeRows], [1, 2], 'News A is Final_MRA Archive — assigned, but not live');
    assert.equal(newsroom.netNew, true);
    assert.equal(home.netNew, undefined, 'has a page of its own');
    assert.equal(later.netNew, undefined);
    assert.equal(later.phase, 'Future');
    assert.equal(later.audiences, 'Alumni, Donors', 'node-level audiences (2.19.0) are exposed');
  });

  test('depth limits the tree and says what it left out; rootId drills in', () => {
    const p = mcp.loadProject(file);
    const shallow = p.getSitemap({ depth: 1 }).tree[0];
    assert.equal(shallow.children, undefined);
    assert.equal(shallow.childrenNotShown, 2);
    assert.equal(p.getSitemap({ rootId: 'n2' }).tree[0].label, 'Newsroom');
    assert.throws(() => p.getSitemap({ rootId: 'zzz' }), /No sitemap node/);
  });
});

describe('redirects', () => {
  test('summary separates set / deliberate 404 / owed-but-blank, and never counts a fragment', () => {
    const s = mcp.loadProject(file).getRedirects({});
    const alpha = s.bySite.find(b => b.site === 'Alpha');
    assert.deepEqual(
      { set: alpha.set, deliberate404: alpha.deliberate404, owedButBlank: alpha.owedButBlank, provenance: alpha.provenance },
      { set: 2, deliberate404: 1, owedButBlank: 1, provenance: { auto: 1, inherited: 1, manual: 1 } }
    );
  });

  test('list mode filters by provenance and state', () => {
    const p = mcp.loadProject(file);
    assert.deepEqual(p.getRedirects({ mode: 'list', provenance: 'inherited' }).redirects.map(r => r.from), ['https://www.alpha.edu/old']);
    const owed = p.getRedirects({ mode: 'list', state: 'none' }).redirects;
    assert.deepEqual(owed.map(r => [r.from, r.to, r.decision]), [['https://www.alpha.edu/news/c', '(none yet)', 'Consolidate']]);
  });
});

describe('changelog', () => {
  test('filters by field and date, and summarizes by auditor', () => {
    const p = mcp.loadProject(file);
    assert.equal(p.changelog({}).total, 3);
    assert.equal(p.changelog({ field: 'final_kke' }).entries[0].to, 'Archive');
    assert.equal(p.changelog({ since: '2026-09-05T00:00:00.000Z' }).total, 2);
    const s = p.changelog({ summary: true });
    assert.deepEqual(s.byAuditor.map(a => [a.auditor, a.count]), [['david', 2], ['sme-import', 1]]);
  });
});

// ─── Proposals: the one write ────────────────────────────────────────────────

describe('proposals', () => {
  const dumpOthers = f => {
    const db = new DatabaseSync(f, { readOnly: true });
    const out = {};
    for (const t of ['headers', 'rows', 'nav_nodes', 'settings', 'changelog', 'meta']) out[t] = JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all());
    out.version = db.prepare('PRAGMA user_version').get().user_version;
    db.close();
    return out;
  };

  test('queues valid changes, touches no other table, and never bumps user_version', () => {
    const f = path.join(dir, 'propose.transmission');
    buildFixture(f);
    const before_ = dumpOthers(f);
    const p = mcp.loadProject(f);
    const r = p.proposeChanges({ source: 'test', changes: [
      { url: 'https://www.alpha.edu/about', field: 'MRA_Recommendation', value: 'keep', rationale: 'Core page' },
      { url: 'https://www.alpha.edu/about', field: 'Tags', value: 'landing, evergreen', rationale: 'Hub' },
      { url: 'https://www.alpha.edu/news/b', field: 'Notes', value: 'Thin; merge candidates nearby.', rationale: 'Thin content' }
    ] });
    assert.equal(r.queued, 3);
    assert.equal(r.inserted, 3);
    assert.deepEqual(dumpOthers(f), before_, 'rows/settings/nav/changelog/meta untouched and schema version unchanged');
    const list = p.listProposals({});
    assert.equal(list.total, 3);
    assert.equal(list.proposals.find(x => x.field === 'MRA_Recommendation').value, 'Migrate', 'case normalised to the project vocabulary');
    assert.equal(list.proposals.find(x => x.field === 'MRA_Recommendation').current, '', 'joined with the live current value');
  });

  test('validates the whole batch before writing any of it', () => {
    const f = path.join(dir, 'propose-atomic.transmission');
    buildFixture(f);
    const p = mcp.loadProject(f);
    assert.throws(() => p.proposeChanges({ changes: [
      { url: 'https://www.alpha.edu/about', field: 'MRA_Recommendation', value: 'Migrate', rationale: 'ok' },
      { url: 'https://www.alpha.edu/about', field: 'Final_MRA', value: 'Migrate', rationale: 'not allowed' }
    ] }), /Final_MRA.*not a field proposals may change|is not a field proposals may change/);
    assert.equal(p.listProposals({}).total, 0, 'the valid first change was not written either');
  });

  test('refuses what a proposal must not do: unknown fields, bad vocabulary, Consolidate, blanks, no rationale', () => {
    const p = mcp.loadProject(file);
    const one = c => () => p.proposeChanges({ changes: [c] });
    assert.throws(one({ url: 'https://www.alpha.edu/about', field: 'Sitemap_ID', value: 'n1', rationale: 'x' }), /not a field proposals may change/);
    assert.throws(one({ url: 'https://www.alpha.edu/about', field: '_RedirectSource', value: 'auto', rationale: 'x' }), /not a field proposals may change/);
    assert.throws(one({ url: 'https://www.alpha.edu/about', field: 'MRA_Recommendation', value: 'Delete', rationale: 'x' }), /cannot be "Delete".*Migrate · Revise · Archive · Exclude/s);
    assert.throws(one({ url: 'https://www.alpha.edu/about', field: 'MRA_Recommendation', value: 'Consolidate', rationale: 'x' }), /cannot be "Consolidate"/);
    assert.throws(one({ url: 'https://www.alpha.edu/about', field: 'Audiences', value: 'Donors', rationale: 'x' }), /Audiences cannot be "Donors"/);
    assert.throws(one({ url: 'https://www.alpha.edu/about', field: 'MRA_Recommendation', value: '', rationale: 'x' }), /cannot clear a field/);
    assert.throws(one({ url: 'https://www.alpha.edu/about', field: 'MRA_Recommendation', value: 'Migrate', rationale: '' }), /needs a `rationale`/);
  });

  test('skips what is already true, adds only what is new, and replaces a pending duplicate instead of stacking', () => {
    const f = path.join(dir, 'propose-dupe.transmission');
    buildFixture(f);
    const p = mcp.loadProject(f);
    const r1 = p.proposeChanges({ changes: [
      { url: 'https://www.alpha.edu/news/a', field: 'MRA_Recommendation', value: 'Migrate', rationale: 'already Keep' },
      { url: 'https://www.alpha.edu/news/a', field: 'Tags', value: 'outdated, stale', rationale: 'one of these is new' },
      { url: 'https://www.alpha.edu/nowhere', field: 'MRA_Recommendation', value: 'Archive', rationale: 'no such page' },
      { url: 'https://www.alpha.edu/about', field: 'MRA_Recommendation', value: 'Migrate', rationale: 'first thought' }
    ] });
    assert.equal(r1.queued, 2);
    assert.deepEqual(r1.skipped.map(x => x.reason), ['already "Migrate"', 'no row with that URL']);
    assert.equal(p.listProposals({}).proposals.find(x => x.field === 'Tags').value, 'stale', 'only the tag the page lacks');
    const r2 = p.proposeChanges({ changes: [{ url: 'https://www.alpha.edu/about', field: 'MRA_Recommendation', value: 'Revise', rationale: 'second thought' }] });
    assert.equal(r2.replacedPending, 1);
    const kke = p.listProposals({}).proposals.filter(x => x.url === 'https://www.alpha.edu/about' && x.field === 'MRA_Recommendation');
    assert.equal(kke.length, 1);
    assert.equal(kke[0].value, 'Revise');
    assert.equal(kke[0].rationale, 'second thought');
  });

  test('reads a v2 project and lists resolved proposals by status', () => {
    const f = path.join(dir, 'v2.transmission');
    buildFixture(f, { userVersion: 2 });
    const db = new DatabaseSync(f);
    db.prepare("INSERT INTO proposals (created_at, batch, source, url, field, value, rationale, status, resolved_at, resolved_by) VALUES ('t','b','x','https://www.alpha.edu/about','MRA_Recommendation','Migrate','r','accepted','t2','david')").run();
    db.close();
    const p = mcp.loadProject(f);
    assert.equal(p.listProposals({}).total, 0);
    const acc = p.listProposals({ status: 'accepted' });
    assert.equal(acc.total, 1);
    assert.equal(acc.proposals[0].resolvedBy, 'david');
    assert.deepEqual(acc.byStatus, { accepted: 1 });
  });
});

// ─── The server itself, over stdio ───────────────────────────────────────────

// Takes the test context so the child is killed when the test ends HOWEVER it
// ends. Without that, a failed assertion skips the test's own close() and the
// orphaned server keeps the runner alive: a red test presents as a hang.
function startServer(t, args = []) {
  const child = spawn(process.execPath, [path.join(ROOT, 'mcp', 'server.js'), ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let buf = '', stderr = '';
  const waiting = new Map();
  const lines = [];
  child.stderr.on('data', d => { stderr += d; });
  child.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      lines.push(line);
      const msg = JSON.parse(line);              // anything non-JSON on stdout fails the test right here
      const w = waiting.get(msg.id);
      if (w) { waiting.delete(msg.id); w(msg); }
    }
  });
  let nextId = 1;
  return {
    request(method, params) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`no response to ${method}; stderr: ${stderr}`)), 5000);
        waiting.set(id, m => { clearTimeout(t); resolve(m); });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    notify(method, params) { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); },
    raw(text) { child.stdin.write(text + '\n'); },
    lines,
    stderr: () => stderr,
    close() { return new Promise(r => { child.on('exit', r); child.stdin.end(); }); }
  };
}

const callTool = async (s, name, args) => {
  const m = await s.request('tools/call', { name, arguments: args || {} });
  const text = m.result.content[0].text;
  return { isError: !!m.result.isError, text, data: m.result.isError ? null : JSON.parse(text) };
};

describe('stdio server', () => {
  test('handshake, tool listing, and a tool call against --project', async t => {
    const s = startServer(t, ['--project', file]);
    const init = await s.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.equal(init.result.serverInfo.name, 'transmission');
    assert.match(init.result.instructions, /BLANK MEANS UNREVIEWED/);
    s.notify('notifications/initialized');

    const tools = (await s.request('tools/list')).result.tools;
    assert.deepEqual(tools.map(t => t.name), ['open_project', 'project_overview', 'describe_columns', 'aggregate', 'query_rows', 'get_row', 'get_sitemap', 'get_redirects', 'get_changelog', 'propose_changes', 'list_proposals', 'get_libraries', 'get_rubrics', 'get_page_text']);
    assert.ok(tools.every(t => t.inputSchema.type === 'object'));
    // Two tools write, each only to its own table: propose_changes (proposals) and
    // get_page_text (its page_text cache). Neither touches what the app saves.
    const WRITERS = ['propose_changes', 'get_page_text'];
    assert.ok(tools.filter(t => !WRITERS.includes(t.name)).every(t => t.annotations.readOnlyHint === true), 'every other tool is read-only');
    for (const w of WRITERS) assert.equal(tools.find(t => t.name === w).annotations.readOnlyHint, false);

    const o = await callTool(s, 'project_overview');
    assert.equal(o.data.client, 'Alpha University');
    assert.equal(o.data.rows.inScope, 9);

    const agg = await callTool(s, 'aggregate', { groupBy: ['@content_kind'] });
    assert.equal(group(agg.data, 'content'), 7);

    await s.close();
    assert.equal(s.stderr(), '', 'nothing on stderr — including node:sqlite\'s experimental warning');
    assert.equal(s.lines.length, 4, 'one response per request, none for the notification');
  });

  test('an unknown protocol version is answered with one the server does speak', async t => {
    const s = startServer(t);
    const init = await s.request('initialize', { protocolVersion: '1999-01-01' });
    assert.equal(init.result.protocolVersion, '2025-06-18');
    await s.close();
  });

  test('tool failures come back as readable results; protocol failures as JSON-RPC errors', async t => {
    const s = startServer(t);
    const none = await callTool(s, 'project_overview');
    assert.ok(none.isError);
    assert.match(none.text, /No project is open/);

    const bad = await callTool(s, 'open_project', { path: path.join(dir, 'missing.transmission') });
    assert.match(bad.text, /File not found/);

    assert.equal((await s.request('tools/call', { name: 'drop_table' })).error.code, -32602);
    assert.equal((await s.request('no/such/method')).error.code, -32601);

    s.raw('this is not json');
    await new Promise(r => setTimeout(r, 100));
    assert.equal(JSON.parse(s.lines[s.lines.length - 1]).error.code, -32700);
    await s.close();
  });

  test('a failed open_project keeps the project that was already open', async t => {
    const s = startServer(t, ['--project', file]);
    assert.ok((await callTool(s, 'open_project', { path: path.join(dir, 'missing.transmission') })).isError);
    assert.equal((await callTool(s, 'project_overview')).data.client, 'Alpha University');
    await s.close();
  });

  test('picks up what the app saves, without being told', async t => {
    const f = path.join(dir, 'live.transmission');
    buildFixture(f);
    const s = startServer(t, ['--project', f]);
    assert.equal(group((await callTool(s, 'aggregate', { groupBy: ['@effective_decision'] })).data, 'Revise'), 1);

    // What an autosave looks like from outside: a row rewritten through a second
    // connection, landing in the WAL while the main file's mtime stays put.
    const db = new DatabaseSync(f);
    t.after(() => { try { db.close(); } catch (_) { /* closed below on the happy path */ } });
    const edited = { ...ROWS[7], MRA_Recommendation: 'Revise' };
    db.prepare('UPDATE rows SET data = ? WHERE idx = 7').run(JSON.stringify(edited));
    assert.equal(group((await callTool(s, 'aggregate', { groupBy: ['@effective_decision'] })).data, 'Revise'), 2);
    db.close();
    await s.close();
  });

  test('with no project given, follows the one Transmission has open (current-project.json)', async t => {
    // The app writes <userData>/current-project.json; the server reads it under
    // $HOME/Library/Application Support/{Transmission,transmission}. Point HOME
    // at a scratch dir so the test never touches the real one.
    const home = path.join(dir, 'home');
    const appDir = path.join(home, 'Library', 'Application Support', 'transmission');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'current-project.json'), JSON.stringify({ filePath: file, openedAt: 't', pid: 1 }));
    const child = spawn(process.execPath, [path.join(ROOT, 'mcp', 'server.js')], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, HOME: home, TRANSMISSION_PROJECT: '' } });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let buf = ''; const waiting = new Map(); let nextId = 1;
    child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); const m = JSON.parse(l); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } } });
    const request = (method, params) => new Promise(r => { const id = nextId++; waiting.set(id, r); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
    const m = await request('tools/call', { name: 'project_overview', arguments: {} });
    assert.ok(!m.result.isError, m.result.content[0].text);
    assert.equal(JSON.parse(m.result.content[0].text).client, 'Alpha University');
    child.stdin.end();
  });

  test('resources: the semantics guide and the project glossary', async t => {
    const s = startServer(t, ['--project', file]);
    const list = (await s.request('resources/list')).result.resources.map(r => r.uri);
    assert.deepEqual(list, ['transmission://semantics', 'transmission://project/glossary']);
    const sem = (await s.request('resources/read', { uri: 'transmission://semantics' })).result.contents[0];
    assert.match(sem.text, /Unreviewed/);
    const glo = (await s.request('resources/read', { uri: 'transmission://project/glossary' })).result.contents[0];
    assert.match(glo.text, /### thin-content\n\nUnder 150 words\./);
    assert.equal((await s.request('resources/read', { uri: 'transmission://nope' })).error.code, -32002);
    await s.close();
  });
});

// A project saved under the legacy Keep/Kill/Evolve preference stores KKE_*
// columns and KKE words. The server reads it as MRA, and accepts either
// spelling as input, so a session never has to know which the auditor chose.
describe('legacy KKE vocabulary', () => {
  const T = require(path.join(ROOT, 'mcp', 'lib', 'terminology.js'));
  let ldir, lfile;
  before(() => {
    ldir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-kke-'));
    lfile = path.join(ldir, 'legacy.transmission');
    const t = T.convertTable(HEADERS, ROWS, 'kke', null);
    buildFixture(lfile, {
      headers: t.headers, rows: t.rows,
      settings: { ...SETTINGS, savedFilters: SETTINGS.savedFilters.map(f => ({ ...f, kkeFilter: f.kkeFilter.map(v => T.value(v, 'kke')) })) },
      changelog: CHANGELOG.map(e => [e[0], e[1], e[2], e[3], T.header(e[4], 'kke'), T.value(e[5], 'kke'), T.value(e[6], 'kke')])
    });
  });
  after(() => fs.rmSync(ldir, { recursive: true, force: true }));

  test('the fixture really is in the old words', () => {
    const db = new DatabaseSync(lfile, { readOnly: true });
    const names = db.prepare('SELECT name FROM headers').all().map(r => r.name);
    db.close();
    assert.ok(names.includes('KKE_Recommendation') && names.includes('Final_KKE'));
    assert.ok(!names.includes('MRA_Recommendation'));
  });

  test('columns, values and the decision mix read as MRA', () => {
    const p = mcp.loadProject(lfile);
    assert.equal(p.columnMap.kke, 'MRA_Recommendation');
    assert.equal(p.columnMap.finalKke, 'Final_MRA');
    assert.equal(p.effectiveKke(p.findRows('https://www.alpha.edu/news/a')[0]), 'Archive');
    const res = p.aggregate({ groupBy: ['@effective_decision'], scope: 'all' });
    assert.equal(group(res, 'Migrate'), 3);
    assert.equal(group(res, 'Archive'), 3);
    assert.ok(!group(res, 'Keep') && !group(res, 'Kill'));
  });

  test('old field names and old words still filter', () => {
    const p = mcp.loadProject(lfile);
    const byOld = p.select({ filters: [{ field: 'KKE_Recommendation', operator: 'equals', value: 'Keep' }] }).length;
    const byNew = p.select({ filters: [{ field: 'MRA_Recommendation', operator: 'equals', value: 'Migrate' }] }).length;
    assert.ok(byNew > 0);
    assert.equal(byOld, byNew);
    assert.equal(p.select({ filters: [{ field: '@effective_kke', operator: 'equals', value: 'Kill' }] }).length,
      p.select({ filters: [{ field: '@effective_decision', operator: 'equals', value: 'Archive' }] }).length);
  });

  test('a saved filter written with Keep still matches', () => {
    const rows = mcp.loadProject(lfile).select({ savedFilter: 'Thin news' });
    assert.ok(rows.length > 0);
  });

  test('the change log is reported in MRA, and a field filter matches either spelling', () => {
    const p = mcp.loadProject(lfile);
    const all = p.changelog({});
    assert.ok(all.entries.every(e => !/KKE/.test(e.field)));
    assert.ok(all.entries.some(e => e.field === 'Final_MRA' && e.to === 'Archive'));
    assert.equal(p.changelog({ field: 'Final_MRA' }).total, 1);
    assert.equal(p.changelog({ field: 'Final_KKE' }).total, 1);
  });

  test('a proposal in the old words is queued in the new ones', () => {
    const f = path.join(ldir, 'propose.transmission');
    fs.copyFileSync(lfile, f);
    const p = mcp.loadProject(f);
    const r = p.proposeChanges({ changes: [{ url: 'https://www.alpha.edu/about', field: 'KKE_Recommendation', value: 'Evolve', rationale: 'needs work' }] });
    assert.equal(r.queued, 1);
    const list = mcp.loadProject(f).listProposals({});
    assert.equal(list.proposals[0].field, 'MRA_Recommendation');
    assert.equal(list.proposals[0].value, 'Revise');
  });
});
