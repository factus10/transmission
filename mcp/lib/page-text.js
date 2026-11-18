'use strict';
// Page text for whole-audit judgments: fetch a page, pull out its main content,
// and cache the result inside the project file.
//
// Why it exists: a crawl export carries Word Count, which counts navigation and
// footer text too, so "is this page 1–3 paragraphs?" can't be answered from the
// spreadsheet. A rubric pattern narrows thousands of pages to the few worth
// reading with filters first; only those are fetched here.
//
// Why the cache lives in the project: every auditor on the engagement (and every
// later session) reads the same text the finding was based on, and nobody pays
// to fetch a page twice. The table is the server's own, like `proposals`:
// CREATE IF NOT EXISTS, written through a short-lived connection, never the
// tables the app's autosave rewrites, and no user_version bump.
//
// Extraction is deliberately plain — regular expressions over the HTML, no DOM,
// no dependencies (the server ships with none). It looks for <main>, then
// <article>, then role="main", then the body minus header/nav/footer/aside, and
// says which it used, so a reader knows how much to trust a paragraph count.

const PAGE_TEXT_DDL = `
  CREATE TABLE IF NOT EXISTS page_text (
    url         TEXT PRIMARY KEY,
    fetched_at  TEXT,
    http_status INTEGER,
    final_url   TEXT,
    data        TEXT
  );`;

const FETCH_TIMEOUT_MS = 15000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_CHARS = 6000;
const USER_AGENT = 'Mozilla/5.0 (compatible; Transmission-content-audit; +https://github.com/factus10/transmission)';

// A paragraph worth counting: a sentence or more, not a caption or a button.
const PARA_MIN_CHARS = 40;
const PARA_MIN_WORDS = 6;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™' };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return Number.isFinite(n) ? String.fromCodePoint(n) : m; } catch (_) { return m; }
    }
    const v = ENTITIES[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

function textOf(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Remove whole elements (and their content) by tag name. Not nesting-aware,
 *  which is fine for these: none of them nest inside themselves in practice. */
function stripElements(html, tags) {
  let out = html;
  for (const t of tags) out = out.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}\\s*>`, 'gi'), ' ');
  return out;
}

/** The element whose start tag begins at `start`, balancing same-name tags so a
 *  <div role="main"> containing other divs comes back whole. */
function sliceBalanced(html, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].endsWith('/>')) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  return html.slice(start);
}

function findRegion(html) {
  const tryTag = (tag, label) => {
    const i = html.search(new RegExp(`<${tag}\\b`, 'i'));
    return i < 0 ? null : { html: sliceBalanced(html, i, tag), region: label };
  };
  const main = tryTag('main', 'main');
  if (main && textOf(main.html).length > 80) return main;
  const article = tryTag('article', 'article');
  if (article && textOf(article.html).length > 80) return article;
  const rm = /<([a-z][a-z0-9]*)\b[^>]*\brole\s*=\s*["']?main["']?[^>]*>/i.exec(html);
  if (rm) {
    const el = sliceBalanced(html, rm.index, rm[1]);
    if (textOf(el).length > 80) return { html: el, region: 'role=main' };
  }
  const body = /<body\b[\s\S]*$/i.exec(html);
  return { html: stripElements(body ? body[0] : html, ['header', 'nav', 'footer', 'aside']), region: 'body without header/nav/footer/aside' };
}

/**
 * HTML → the facts a rubric judgment needs.
 * @returns {{title, h1, region, paragraphs, shortParagraphs, listItems, words, headings, text, truncated}}
 */
function extractPageText(rawHtml, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  let html = String(rawHtml || '').replace(/<!--[\s\S]*?-->/g, ' ');
  const title = (/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1];
  html = stripElements(html, ['script', 'style', 'noscript', 'svg', 'template', 'iframe', 'select', 'button']);
  const h1 = (/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1];

  const { html: regionHtml0, region } = findRegion(html);
  const regionHtml = stripElements(regionHtml0, ['nav', 'aside', 'form']);

  const paras = [];
  for (const m of regionHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)) {
    const t = textOf(m[1]);
    if (t) paras.push(t);
  }
  const substantial = paras.filter(t => t.length >= PARA_MIN_CHARS && t.split(/\s+/).length >= PARA_MIN_WORDS);
  const listItems = (regionHtml.match(/<li\b/gi) || []).length;
  const headings = [];
  for (const m of regionHtml.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)) {
    const t = textOf(m[2]);
    if (t) headings.push(`h${m[1]}: ${t}`);
    if (headings.length >= 30) break;
  }

  // Readable text: block boundaries become line breaks before tags are dropped.
  // Source line breaks are formatting, not content: fold them first, or a
  // paragraph written across lines comes back as several.
  const blocky = regionHtml
    .replace(/\s+/g, ' ')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|section|li|h[1-6]|tr|blockquote|pre|dd|dt|figcaption)\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ');
  const text = decodeEntities(blocky.replace(/<[^>]+>/g, ' '))
    .split('\n').map(l => l.replace(/[ \t\f\v ]+/g, ' ').trim()).filter(Boolean).join('\n');
  const words = text ? text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length : 0;
  const cap = Math.max(500, Math.min(parseInt(maxChars, 10) || DEFAULT_MAX_CHARS, 40000));

  return {
    title: title ? textOf(title) : '',
    h1: h1 ? textOf(h1) : '',
    region,
    paragraphs: substantial.length,
    shortParagraphs: paras.length - substantial.length,
    listItems,
    words,
    headings,
    text: text.length > cap ? text.slice(0, cap) : text,
    truncated: text.length > cap
  };
}

/** Fetch one page's HTML. Resolves {status, finalUrl, html} or throws. */
async function fetchHtml(url, { timeoutMs = FETCH_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  let u;
  try { u = new URL(url); } catch (_) { throw new Error('not a valid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('only http(s) pages can be fetched');
  const res = await fetchImpl(u.href, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' }
  });
  const type = String(res.headers.get('content-type') || '');
  const len = parseInt(res.headers.get('content-length') || '0', 10);
  if (len > MAX_HTML_BYTES) throw new Error(`page is ${Math.round(len / 1024 / 1024)} MB; too large to read`);
  if (res.ok && type && !/html|xml/i.test(type)) throw new Error(`not an HTML page (${type.split(';')[0]})`);
  const html = res.ok ? (await res.text()).slice(0, MAX_HTML_BYTES) : '';
  return { status: res.status, finalUrl: res.url || u.href, html };
}

// ── Cache ──

function readCache(DatabaseSync, filePath, urls) {
  const out = new Map();
  let db;
  try {
    db = new DatabaseSync(filePath, { readOnly: true });
    const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'page_text'").get();
    if (!has) return out;
    const st = db.prepare('SELECT url, fetched_at, http_status, final_url, data FROM page_text WHERE url = ?');
    for (const u of urls) {
      const r = st.get(u);
      if (r) { try { out.set(u, { fetchedAt: r.fetched_at, httpStatus: r.http_status, finalUrl: r.final_url, ...JSON.parse(r.data) }); } catch (_) { /* unreadable entry: refetch */ } }
    }
  } finally {
    try { db && db.close(); } catch (_) { /* closed */ }
  }
  return out;
}

function writeCache(DatabaseSync, filePath, entries) {
  if (!entries.length) return;
  const db = new DatabaseSync(filePath);
  try {
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec(PAGE_TEXT_DDL);
    const up = db.prepare('INSERT INTO page_text (url, fetched_at, http_status, final_url, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(url) DO UPDATE SET fetched_at = excluded.fetched_at, http_status = excluded.http_status, final_url = excluded.final_url, data = excluded.data');
    db.exec('BEGIN');
    try {
      for (const e of entries) up.run(e.url, e.fetchedAt, e.httpStatus, e.finalUrl, JSON.stringify(e.data));
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
  } finally {
    try { db.close(); } catch (_) { /* closed */ }
  }
}

/** Run `fn` over `items` with at most `n` in flight. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

module.exports = {
  PAGE_TEXT_DDL, DEFAULT_MAX_CHARS, USER_AGENT,
  extractPageText, fetchHtml, readCache, writeCache, pool
};
