// get_page_text (mcp/lib/page-text.js + Project.getPageText): main-content
// extraction, and the page_text cache inside the project file.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { extractPageText } = require('../mcp/lib/page-text');
const mcp = require('../mcp/lib/project');
const { DatabaseSync } = mcp.sqlite();

const ROOT = path.join(__dirname, '..');
const P = n => `<p>${'This sentence is here to be long enough to count as a real paragraph. '.repeat(n)}</p>`;

test('finds <main>, drops chrome, counts real paragraphs only', () => {
  const html = `<html><head><title>Minor in Music &amp; Theory</title><script>var x = "<p>not me</p>";</script></head>
    <body><header><nav><p>Menu menu menu menu menu menu menu menu</p></nav></header>
    <main><h1>Music Minor</h1>${P(1)}${P(2)}<p>Short.</p><ul><li>One</li><li>Two</li></ul>
      <h2>Requirements</h2>${P(1)}<aside>${P(3)}</aside></main>
    <footer>${P(4)}</footer></body></html>`;
  const r = extractPageText(html);
  assert.equal(r.title, 'Minor in Music & Theory');
  assert.equal(r.h1, 'Music Minor');
  assert.equal(r.region, 'main');
  assert.equal(r.paragraphs, 3);          // the aside's and footer's don't count
  assert.equal(r.shortParagraphs, 1);
  assert.equal(r.listItems, 2);
  assert.deepEqual(r.headings, ['h2: Requirements']);
  assert.doesNotMatch(r.text, /not me|Menu menu/);
  assert.match(r.text, /• One/);
});

test('role="main" on a div is sliced whole, nested divs and all', () => {
  const html = `<body><div class="nav">${P(5)}</div><div role="main"><div><div>${P(1)}</div></div>${P(1)}</div><div class="foot">${P(5)}</div></body>`;
  const r = extractPageText(html);
  assert.equal(r.region, 'role=main');
  assert.equal(r.paragraphs, 2);
});

test('without a main region, the body minus header/nav/footer/aside is used and says so', () => {
  const r = extractPageText(`<body><header>${P(2)}</header>${P(1)}<footer>${P(2)}</footer></body>`);
  assert.equal(r.region, 'body without header/nav/footer/aside');
  assert.equal(r.paragraphs, 1);
});

test('text is capped and flagged', () => {
  const r = extractPageText(`<main>${P(200)}</main>`, { maxChars: 1000 });
  assert.equal(r.text.length, 1000);
  assert.equal(r.truncated, true);
});

// ── getPageText against a real project file ──

function liftSchemaSql() {
  const src = fs.readFileSync(path.join(ROOT, 'project-store.js'), 'utf8');
  const open = src.indexOf('this.db.exec(`', src.indexOf('_createSchema() {'));
  const close = src.indexOf('`);', open);
  const pStart = src.indexOf('const PROPOSALS_DDL = `');
  const pEnd = src.indexOf('`;', pStart);
  return src.slice(open + 'this.db.exec(`'.length, close) + '\n' + src.slice(pStart + 'const PROPOSALS_DDL = `'.length, pEnd);
}

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-text-'));
  const file = path.join(dir, 'a.transmission');
  const db = new DatabaseSync(file);
  db.exec(liftSchemaSql());
  db.exec('PRAGMA user_version = 2;');
  const headers = ['Address', 'Title 1', 'Status Code'];
  headers.forEach((h, i) => db.prepare('INSERT INTO headers (pos, name) VALUES (?, ?)').run(i, h));
  ['https://a.edu/', 'https://a.edu/minor', 'https://a.edu/blocked', 'https://a.edu/gone'].forEach((u, i) =>
    db.prepare('INSERT INTO rows (idx, data) VALUES (?, ?)').run(i, JSON.stringify({ Address: u, 'Title 1': '', 'Status Code': '200' })));
  db.close();
  return { dir, file };
}

function fakeFetch(calls) {
  return async (url) => {
    calls.push(url);
    if (url.endsWith('/blocked')) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } });
    const status = url.endsWith('/gone') ? 404 : 200;
    return {
      ok: status < 400, status, url,
      headers: { get: k => (k === 'content-type' ? 'text/html; charset=utf-8' : null) },
      text: async () => `<title>T</title><main><h1>Minor</h1>${P(1)}${P(1)}</main>`
    };
  };
}

const dump = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  const out = {};
  for (const t of ['headers', 'rows', 'nav_nodes', 'settings', 'changelog', 'meta', 'proposals']) out[t] = JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all());
  out.version = db.prepare('PRAGMA user_version').get().user_version;
  db.close();
  return crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex');
};

test('fetches, caches in the project, serves the cache next time, and touches nothing else', async () => {
  const { dir, file } = makeProject();
  const before = dump(file);
  const calls = [];
  const p = mcp.loadProject(file);
  const r1 = await p.getPageText({ urls: ['https://a.edu/minor', 'https://a.edu/blocked', 'https://a.edu/gone', 'https://elsewhere.com/x'], fetchImpl: fakeFetch(calls) });
  assert.deepEqual(r1.pages.map(x => [x.url, x.cached, x.paragraphs]), [['https://a.edu/minor', false, 2]]);
  assert.deepEqual(r1.failed.map(f => [f.url, f.error]).sort(), [
    ['https://a.edu/blocked', 'ECONNRESET'], ['https://a.edu/gone', 'HTTP 404'], ['https://elsewhere.com/x', 'not a page in this audit']
  ]);
  assert.equal(calls.includes('https://elsewhere.com/x'), false, 'never fetches a URL outside the audit');
  assert.equal(dump(file), before, 'the audit tables and schema version are untouched');

  const calls2 = [];
  const r2 = await mcp.loadProject(file).getPageText({ urls: ['https://a.edu/minor/', 'https://a.edu/gone'], fetchImpl: fakeFetch(calls2) });
  assert.deepEqual(r2.pages.map(x => [x.url, x.cached]), [['https://a.edu/minor', true]]);
  assert.deepEqual(calls2, ['https://a.edu/gone'], 'cached pages are not refetched; failures were never cached');

  const calls3 = [];
  await mcp.loadProject(file).getPageText({ urls: ['https://a.edu/minor'], refresh: true, fetchImpl: fakeFetch(calls3) });
  assert.deepEqual(calls3, ['https://a.edu/minor']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('batch limit is enforced before anything is fetched', async () => {
  const { dir, file } = makeProject();
  const p = mcp.loadProject(file);
  await assert.rejects(() => p.getPageText({ urls: Array(11).fill('https://a.edu/minor') }), /At most 10/);
  fs.rmSync(dir, { recursive: true, force: true });
});
