// ════════════════════════════════════════════════════════════════════════════
// Read-only view of a .transmission project, and the query engine over it.
//
// See docs/dev/MCP_SERVER_PROPOSAL.md. Two things about this file are
// deliberate and easy to "fix" by mistake:
//
// 1. It does NOT use ../../project-store.js. That module loads better-sqlite3,
//    and this server ships as a bare extraResource with no node_modules, so
//    the binding isn't there to load. And ProjectStore.open() runs _migrate(), which stamps
//    user_version: an observer has no business migrating someone's project.
//    This reads the same tables through node:sqlite, opened readOnly, and holds
//    the connection only for the duration of a load.
//
// 2. It never writes. The app keeps the whole project in memory and rewrites the
//    rows table from that copy on a 2s autosave, without ever re-reading the
//    file — so anything written here would be silently overwritten. Writes are
//    Phase 2 and go through the app as proposals.
//
// Where a function here mirrors one in src/renderer.js or main.js it says which.
// The filter operators are additionally held to the original by a drift test
// (test/mcp-server.test.js), since "almost the same filter" is the failure that
// would be hardest to notice.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const rubricsLib = require('./rubrics');
const Terminology = require('./terminology');
const pageText = require('./page-text');
const fs = require('node:fs');
const path = require('node:path');

const SUPPORTED_SCHEMA_VERSION = 2;

// ─── Proposals ───────────────────────────────────────────────────────────────
//
// The one thing this server writes, and the only table it may write to. A
// proposal is a REQUEST — "set this field on this page to this value, because…"
// — that a person accepts or rejects in the app, which then writes the value
// through its own paths (change log, undo, Suggested_MRA refresh). Nothing here
// ever touches `rows`, so the app's in-memory copy stays the truth and its
// autosave can never collide with us.
//
// The DDL must match PROPOSALS_DDL in project-store.js (the test lifts that one
// and compares). CREATE IF NOT EXISTS and NO user_version bump: the app stamps
// v2 itself on open; an observer locking older app builds out of a file would
// be the wrong trade.
const PROPOSALS_DDL = `
  CREATE TABLE IF NOT EXISTS proposals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT,
    batch       TEXT,
    source      TEXT,
    url         TEXT,
    field       TEXT,
    value       TEXT,
    rationale   TEXT,
    status      TEXT DEFAULT 'pending',
    resolved_at TEXT,
    resolved_by TEXT
  );
  CREATE INDEX IF NOT EXISTS proposals_status ON proposals (status);`;
const PROPOSAL_COLUMNS = ['id', 'created_at', 'batch', 'source', 'url', 'field', 'value', 'rationale', 'status', 'resolved_at', 'resolved_by'];

// Fields a proposal may name. Keyed by the canonical column name; `map` keys
// resolve through the project's column map (a file may call the decision column "Recommendation").
// `kind` decides how the app applies it: 'set' replaces the cell; 'add' merges
// into a comma-separated cell (a proposal can add a tag or an audience, never
// remove one); 'note' appends to a non-blank Notes cell rather than overwriting
// what a person wrote. Deliberately absent: Final_MRA (the SME's call), every
// `_`-prefixed column, the Sitemap_* / Computed Path / Redirect_Destination /
// Consolidate_Into family (the engine derives those from decisions, and a
// proposal must not fake one), and Suggested_* (machine columns already).
const CONSOLIDATE_ID_COLUMN = '_ConsolidateTargetId';

const PROPOSAL_FIELDS = {
  MRA_Recommendation: { map: 'kke', kind: 'set', vocab: 'kke' },
  Notes:              { map: 'notes', kind: 'note' },
  Tags:               { map: 'tags', kind: 'add' },
  Group:              { map: 'group', kind: 'set' },
  'Primary Tag':      { map: 'primaryTag', kind: 'set' },
  Page_Type:          { kind: 'set' },
  Content_Theme:      { kind: 'set' },
  Content_Nature:     { kind: 'set', vocab: ['Page', 'Content Object', 'Fragment', 'Generated'] },
  Migration_Track:    { kind: 'set', vocab: ['Scripted', 'Migrate Records', 'Configure', 'Manual Rebuild', 'Merge', 'Archive/Redirect'] },
  Published_Status:   { kind: 'set', vocab: ['Published', 'Unpublished', 'Draft', '404'] },
  Audiences:          { kind: 'add', vocab: 'audiences' },
  Primary_Audience:   { kind: 'set', vocab: 'audiences-one' },
  Jobs_Served:        { kind: 'add', vocab: 'jobs' },
  // Consolidate, with its target: the value is the URL of the page the content
  // merges into. Accepting it in the app runs the same path as the Consolidate
  // picker (identity + display columns, cycle guards, the Revise nudge).
  Consolidate_Into:   { kind: 'consolidate' },
  // Client review: a question for the client. Proposing one is the most useful
  // thing a session can do with a page it cannot call. The status says what is
  // asked; priority and reason only mean something beside a status, so they are
  // skipped on a page with no request (unless the same batch asks one).
  Client_Review:          { kind: 'set', vocab: ['Needs decision', 'Please confirm'], clientReview: 'status' },
  Client_Review_Priority: { kind: 'set', vocab: ['Normal', 'Urgent'], clientReview: 'priority' },
  Client_Review_Reason:   { kind: 'set', vocab: 'client-review-reasons', clientReview: 'reason' }
};
// The app's DEFAULT_CLIENT_REVIEW_REASONS, used until a project edits its list.
const DEFAULT_CLIENT_REVIEW_REASONS = ['Accuracy', 'Compliance/legal', 'Ownership', 'Consolidate target', 'Domain knowledge', 'Other'];
const PROPOSAL_MAX_BATCH = 2000;

// ─── node:sqlite ─────────────────────────────────────────────────────────────

let _sqlite = null;
function sqlite() {
  if (_sqlite) return _sqlite;
  // node:sqlite announces itself as experimental on stderr at load. Harmless,
  // but an MCP client shows server stderr to the user as if something were
  // wrong — swallow that one warning and nothing else.
  const orig = process.emitWarning;
  process.emitWarning = function (warning, ...rest) {
    const type = typeof rest[0] === 'string' ? rest[0] : (rest[0] && rest[0].type);
    if (type === 'ExperimentalWarning' && /sqlite/i.test(String(warning))) return;
    return orig.call(process, warning, ...rest);
  };
  try {
    _sqlite = require('node:sqlite');
  } catch (e) {
    throw new Error(`The Transmission MCP server needs Node 22.13 or newer (for node:sqlite); this is ${process.version}.`);
  } finally {
    process.emitWarning = orig;
  }
  return _sqlite;
}

// ─── Column detection (mirrors main.js) ──────────────────────────────────────

const URL_CANDIDATES = ['address', 'url', 'link', 'website', 'href', 'uri'];

const AUDIT_COL_CANDIDATES = {
  kke:          ['MRA_Recommendation', 'MRA Recommendation', 'MRA', 'KKE_Recommendation', 'KKE Rec', 'KKE Recommendation', 'KKE', 'Recommendation'],
  tags:         ['Tags', 'KKE Tags', 'Audit Tags'],
  notes:        ['Notes', 'Notes/Rationale', 'Rationale', 'Audit Notes'],
  group:        ['Group', 'Audit Group', 'Page Group'],
  primaryTag:   ['Primary Tag', 'Primary_Tag', 'Main Tag'],
  smeDecision:  ['SME_Decision', 'SME Decision', 'SME Rec'],
  smeNotes:     ['SME_Notes', 'SME Notes'],
  contentOwner: ['Content_Owner', 'Content Owner', 'Owner', 'SME'],
  finalKke:     ['Final_MRA', 'Final MRA', 'Final_KKE', 'Final KKE', 'Final Recommendation']
};
const AUDIT_COL_DEFAULTS = {
  kke: 'MRA_Recommendation', tags: 'Tags', notes: 'Notes', group: 'Group', primaryTag: 'Primary Tag',
  smeDecision: 'SME_Decision', smeNotes: 'SME_Notes', contentOwner: 'Content_Owner', finalKke: 'Final_MRA'
};

// Columns the app injects on open (injectAndOrderAuditColumns + NAV_COLUMNS in
// main.js). A project last saved by an older build may lack some; the app would
// add them blank, so a filter naming one is valid and simply reads blank — not
// an "unknown field" error.
const KNOWN_AUDIT_COLUMNS = [
  '_Flagged', '_AssessedAt', '_AssessmentResult', 'Redirect_Destination', 'Consolidate_Into',
  'Published_Status', 'Page_Type', 'Content_Theme', 'Content_Nature', 'Migration_Track',
  'Suggested_MRA', 'Suggested_MRA_Sources', 'Source_CMS_URL', 'New_CMS_URL', 'Target_Content_Type',
  'Design_Patterns', 'Audiences', 'Primary_Audience', 'Jobs_Served', 'Source_Site', 'Page_Breadcrumb',
  '_ConsolidateTargetId', '_Suggested_Audiences', '_RedirectSource',
  'Client_Review', 'Client_Review_Priority', 'Client_Review_Reason',
  'Sitemap_ID', 'Sitemap_Destination', 'Computed Path', 'Sitemap_SortID',
  'GA_MRA_Recommendation', 'GA_Score'
];

const LEGACY_NAV_COLUMN_RENAMES = [
  ['NavID', 'Sitemap_ID'],
  ['Nav Destination', 'Sitemap_Destination'],
  ['Nav_SortID', 'Sitemap_SortID']
];

const BUILTIN_KKE = ['Migrate', 'Revise', 'Archive', 'Consolidate', 'Exclude'];
const AUDIENCE_NONE = '— None (no target audience)';

function detectUrlColumn(headers) {
  for (const h of headers) {
    if (URL_CANDIDATES.includes(h.toLowerCase().trim())) return h;
  }
  return null;
}

function detectAuditCol(headers, candidates) {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i >= 0) return headers[i];
  }
  return null;
}

/** computeColumnMap() minus its per-user prefs tier — see the proposal, §4:
 *  the two tiers honored here are the ones that travel with the file. */
function computeColumnMap(headers, projectMap) {
  const map = {};
  for (const key of Object.keys(AUDIT_COL_CANDIDATES)) {
    const saved = projectMap && projectMap[key];
    map[key] = (saved && headers.includes(saved) ? saved : null)
      || detectAuditCol(headers, AUDIT_COL_CANDIDATES[key])
      || AUDIT_COL_DEFAULTS[key];
  }
  return map;
}

// ─── Small mirrors of renderer.js helpers ────────────────────────────────────

function statusCodeCategory(code) {
  const n = parseInt(code, 10);
  if (n >= 300 && n < 400) return '3xx';
  if (n >= 400 && n < 500) return '4xx';
  if (n >= 500 && n < 600) return '5xx';
  return null;
}

function normalizeSourceHost(host) {
  return String(host || '').toLowerCase().replace(/^www\./, '');
}

function parseCsvCell(raw) {
  return String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
}

function fieldFilterNumber(s) {
  const t = String(s).trim().replace(/,/g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

function fieldFilterCompare(cell, needle) {
  if (cell === '') return null;
  const a = fieldFilterNumber(cell);
  const b = fieldFilterNumber(needle);
  if (a !== null && b !== null) return a < b ? -1 : a > b ? 1 : 0;
  return cell < needle ? -1 : cell > needle ? 1 : 0;
}

const FIELD_FILTER_OPERATORS = [
  'is-not-blank', 'is-blank', 'contains', 'not-contains', 'equals', 'not-equals',
  'starts-with', 'ends-with', 'greater-than', 'less-than'
];

/** renderer.js fieldFilterMatches(), with one addition: `getValue` lets a filter
 *  read a virtual (@) field. With it omitted this is the original, line for
 *  line, which is what the drift test compares. */
function fieldFilterMatches(row, ff, getValue) {
  const raw = String((getValue ? getValue(row, ff.field) : row[ff.field]) ?? '');
  const v = raw.trim();
  const isBlank = v === '';
  const rawNeedle = String(ff.value ?? '').trim();
  const needle = rawNeedle.toLowerCase();
  const hay = v.toLowerCase();
  switch (ff.operator) {
    case 'is-blank':     return isBlank;
    case 'is-not-blank': return !isBlank;
    case 'contains':     return hay.includes(needle);
    case 'not-contains': return !hay.includes(needle);
    case 'equals':       return hay === needle;
    case 'not-equals':   return hay !== needle;
    case 'starts-with':  return hay.startsWith(needle);
    case 'ends-with':    return hay.endsWith(needle);
    case 'greater-than': { const c = fieldFilterCompare(v, rawNeedle); return c !== null && c > 0; }
    case 'less-than':    { const c = fieldFilterCompare(v, rawNeedle); return c !== null && c < 0; }
    default:             return true;
  }
}

// ─── Virtual fields ──────────────────────────────────────────────────────────

const VIRTUAL_FIELDS = {
  '@effective_decision': 'Final_MRA when set, else the MRA recommendation. Blank = unreviewed.',
  '@content_kind':    'content | redirect (3xx) | gone (4xx), from the crawl Status Code. 5xx is content.',
  '@redirect_state':  'none (blank, undecided) | 404 (deliberately no redirect) | set',
  '@host':            'URL host with www. removed',
  '@path_1':          'First URL path segment, e.g. /news. Raw — no shared-prefix or locale handling.',
  '@path_2':          'First two URL path segments, e.g. /news/2024',
  '@in_scope':        'yes | no — whether the row\'s source site is in scope for the audit',
  '@url_parent':      'URL of the nearest ancestor page that exists in the inventory (same host, walking up the path; a top-level page\'s parent is the homepage when it was crawled). Blank when none. The CURRENT site\'s hierarchy — the new sitemap\'s parent is get_sitemap.'
};

// The sidebar's special filters that need nothing the renderer computes. Every
// other one (_duplicates, _url-variant, _redirect-needs-review, …) depends on
// state this server doesn't have, and is refused by name rather than ignored:
// dropping a filter silently returns a confidently wrong row set.
const SUPPORTED_SPECIAL_FILTERS = new Set([
  '_unreviewed', '_flagged', '_sme-pending', '_needs-placement', '_shared-nav',
  '_suggested-disagree', '_suggested-mismatch', '_needs-audience', '_audience-suggested',
  '_needs-job', '_non-content', '_inherited-redirect',
  '_client-review-open', '_client-review-urgent', '_client-review-undecided'
]);

const CSV_COLUMNS_FIXED = ['Audiences', 'Jobs_Served', 'Design_Patterns'];

// ─── Loading ─────────────────────────────────────────────────────────────────

function fileStamp(filePath) {
  const part = p => { try { const s = fs.statSync(p); return `${s.mtimeMs}:${s.size}`; } catch (_) { return '-'; } };
  return part(filePath) + '|' + part(filePath + '-wal');
}

function withDb(filePath, fn) {
  const { DatabaseSync } = sqlite();
  let db;
  try {
    db = new DatabaseSync(filePath, { readOnly: true });
  } catch (e) {
    throw new Error(`Could not open ${filePath}: ${e.message}`);
  }
  try {
    return fn(db);
  } catch (e) {
    if (/not a database|file is encrypted/i.test(e.message)) {
      throw new Error(`${path.basename(filePath)} is not a Transmission project (not a SQLite database). Spreadsheets must be converted first: open in Transmission, then File → Save As Project.`);
    }
    throw e;
  } finally {
    try { db.close(); } catch (_) { /* already closed */ }
  }
}

function loadProject(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  if (fs.statSync(abs).isDirectory()) throw new Error(`${abs} is a folder, not a .transmission project file.`);
  const stamp = fileStamp(abs);

  const raw = withDb(abs, db => {
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > SUPPORTED_SCHEMA_VERSION) {
      throw new Error(`This project uses schema v${version}; this MCP server reads up to v${SUPPORTED_SCHEMA_VERSION}. Update the server (it lives in the Transmission repo under mcp/).`);
    }
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name));
    for (const t of ['headers', 'rows', 'settings', 'meta']) {
      if (!tables.has(t)) throw new Error(`${path.basename(abs)} is a SQLite database but not a Transmission project (no "${t}" table).`);
    }

    // Same quarantine as ProjectStore.readAll(): one unreadable blob must not
    // cost the whole project, and must not shift the rows after it.
    const parseErrors = [];
    const parseBlob = (text, kind, idx) => {
      try { return JSON.parse(text); }
      catch (e) { parseErrors.push({ kind, idx, error: e.message }); return { _parseError: e.message }; }
    };
    const meta = {};
    for (const r of db.prepare('SELECT key, value FROM meta').all()) meta[r.key] = r.value;
    const settings = {};
    for (const r of db.prepare('SELECT key, value FROM settings').all()) {
      try { settings[r.key] = JSON.parse(r.value); } catch (_) { settings[r.key] = r.value; }
    }
    return {
      version, meta, settings, parseErrors,
      headers: db.prepare('SELECT name FROM headers ORDER BY pos').all().map(r => r.name),
      rows: db.prepare('SELECT idx, data FROM rows ORDER BY idx').all().map(r => parseBlob(r.data, 'row', r.idx)),
      navNodes: tables.has('nav_nodes')
        ? db.prepare('SELECT idx, data FROM nav_nodes ORDER BY idx').all().map(r => parseBlob(r.data, 'nav node', r.idx))
        : [],
      changelogCount: tables.has('changelog') ? db.prepare('SELECT count(*) AS c FROM changelog').get().c : 0
    };
  });

  if (raw.headers.length === 0) throw new Error('Project file contains no data.');
  return new Project(abs, stamp, raw);
}

/** Changelog byField rows with KKE_* and MRA_* spellings folded together (a
 *  project saved under both vocabularies has both in its log). */
function mergeFieldCounts(rows) {
  const by = new Map();
  for (const r of rows) {
    const f = Terminology.header(r.field, 'mra');
    by.set(f, (by.get(f) || 0) + r.count);
  }
  return [...by].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count);
}

// ─── Project ─────────────────────────────────────────────────────────────────

class Project {
  constructor(filePath, stamp, raw) {
    this.filePath = filePath;
    this.stamp = stamp;
    this.meta = raw.meta;
    this.settings = raw.settings;
    this.parseErrors = raw.parseErrors;
    this.changelogCount = raw.changelogCount;
    this.headers = raw.headers.slice();
    this.rows = raw.rows;

    // In-memory only — the file is never touched. Mirrors renameLegacyNavColumns().
    for (const [oldName, newName] of LEGACY_NAV_COLUMN_RENAMES) {
      if (!this.headers.includes(oldName) || this.headers.includes(newName)) continue;
      this.headers[this.headers.indexOf(oldName)] = newName;
      for (const r of this.rows) { r[newName] = r[oldName]; delete r[oldName]; }
    }

    // The file may be in either vocabulary (the app writes the auditor's
    // preference); everything below reads MRA. Mirrors main.js readProject():
    // convert, resolve the column map, then convert any custom-mapped columns.
    this.settings = Terminology.convertSettings(this.settings || {}, 'mra');
    Terminology.convertTableInPlace(this.headers, this.rows, 'mra', null);
    const projectMap = (this.settings.columnMap && typeof this.settings.columnMap === 'object') ? this.settings.columnMap : null;
    this.columnMap = computeColumnMap(this.headers, projectMap);
    Terminology.convertTableInPlace(this.headers, this.rows, 'mra', this.columnMap);
    this.urlColumn = detectUrlColumn(this.headers) || 'Address';
    this.statusCodeColumn = this.headers.find(h => h.toLowerCase() === 'status code') || '';
    this.titleColumn = this.headers.includes('Title 1') ? 'Title 1' : (this.headers.includes('Title') ? 'Title' : '');

    this._headerByLower = new Map(this.headers.map(h => [h.toLowerCase(), h]));
    for (const h of KNOWN_AUDIT_COLUMNS) if (!this._headerByLower.has(h.toLowerCase())) this._headerByLower.set(h.toLowerCase(), h);

    this.siteLibrary = Array.isArray(this.settings.siteLibrary) ? this.settings.siteLibrary : [];
    this._siteByHost = new Map();
    for (const s of this.siteLibrary) for (const h of (s.hosts || [])) this._siteByHost.set(h, s);
    this._hasOutOfScope = this.siteLibrary.some(s => s.inScope === false);

    this.jobLibrary = Array.isArray(this.settings.jobLibrary) ? this.settings.jobLibrary : [];

    this._buildNav(raw.navNodes);
    this._urlIndex = null;
    this._sharedNavIds = null;
  }

  // ── Row facts ──

  url(row) { return String(row[this.urlColumn] || ''); }

  _parsedUrl(row) {
    try { return new URL(this.url(row)); } catch (_) { return null; }
  }

  host(row) {
    const u = this._parsedUrl(row);
    return u ? normalizeSourceHost(u.host) : '';
  }

  pathSegments(row) {
    const u = this._parsedUrl(row);
    return u ? u.pathname.split('/').filter(Boolean) : [];
  }

  /** renderer.js clientReviewStatus() */
  clientReviewStatus(row) {
    const raw = String((row && row.Client_Review) || '').trim();
    const v = raw.toLowerCase();
    if (v === 'needs decision') return 'Needs decision';
    if (v === 'please confirm') return 'Please confirm';
    return raw;
  }

  /** renderer.js clientReviewIsUrgent() */
  clientReviewIsUrgent(row) {
    return !!this.clientReviewStatus(row) && String(row.Client_Review_Priority || '').trim().toLowerCase() === 'urgent';
  }

  /** renderer.js clientReviewIsOpen(): a request with no SME answer yet. Any
   *  non-blank SME_Decision is an answer (parseSmeDecision's `reviewed`). */
  clientReviewIsOpen(row) {
    return !!this.clientReviewStatus(row) && !String(row[this.columnMap.smeDecision] || '').trim();
  }

  /** renderer.js effectiveKke() */
  effectiveKke(row) {
    return String(row[this.columnMap.finalKke] || row[this.columnMap.kke] || '').trim();
  }

  /** renderer.js nonContentKind(), spelled out: '' there is 'content' here, since
   *  a group labelled "(blank)" would be unreadable in an aggregate. */
  contentKind(row) {
    if (!this.statusCodeColumn) return 'content';
    const cat = statusCodeCategory(parseInt(row[this.statusCodeColumn] || '', 10));
    return cat === '3xx' ? 'redirect' : cat === '4xx' ? 'gone' : 'content';
  }

  /** renderer.js rowSiteInScope(): anything not explicitly opted out counts. */
  inScope(row) {
    if (!this._hasOutOfScope) return true;
    const site = this._siteByHost.get(this.host(row));
    return !site || site.inScope !== false;
  }

  /** renderer.js isFragmentRow(). `Content Object` means a Record (a page with
   *  its own URL) since the app split the two values; only `Fragment` has none. */
  isFragment(row) {
    return String(row['Content_Nature'] || '').trim() === 'Fragment';
  }

  /** The nearest ancestor URL that is itself a row: walk the path up one segment
   *  at a time on the same origin, ending at the homepage. Matching is loose
   *  (trailing slash, case) — lookup latitude only, as everywhere here. Query
   *  strings are dropped: `/a?b=1`'s parent is `/`, not `/a`. */
  urlParent(row) {
    if (!this._urlParentCache) this._urlParentCache = new WeakMap();
    if (this._urlParentCache.has(row)) return this._urlParentCache.get(row);
    let out = '';
    const u = this._parsedUrl(row);
    if (u) {
      const segs = u.pathname.split('/').filter(Boolean);
      for (let i = segs.length - 1; i >= 0 && !out; i--) {
        const cand = u.origin + '/' + segs.slice(0, i).join('/');
        const hit = this.findRows(cand)[0];
        if (hit && hit !== row) out = this.url(hit);
      }
    }
    this._urlParentCache.set(row, out);
    return out;
  }

  redirectState(row) {
    const d = String(row['Redirect_Destination'] || '').trim();
    return d === '' ? 'none' : d === '404' ? '404' : 'set';
  }

  // ── Fields ──

  /** Resolve a caller-supplied field name to a real one. Case-insensitive,
   *  because a model will write "status code". Throws on an unknown name: a
   *  typo'd field reads blank on every row, which turns "is-blank" into
   *  "matches everything" with no hint that anything went wrong. */
  resolveField(name) {
    const n = String(name || '').trim();
    if (!n) throw new Error('A field name is required.');
    if (n[0] === '@') {
      // @effective_kke is the pre-MRA spelling; keep it working for old prompts.
      const v = n.toLowerCase() === '@effective_kke' ? '@effective_decision' : n.toLowerCase();
      if (!VIRTUAL_FIELDS[v]) throw new Error(`Unknown virtual field "${n}". Available: ${Object.keys(VIRTUAL_FIELDS).join(', ')}`);
      return v;
    }
    if (this.headers.includes(n)) return n;
    const hit = this._headerByLower.get(n.toLowerCase()) || this._headerByLower.get(Terminology.header(n, 'mra').toLowerCase());
    if (hit) return hit;
    const needle = n.toLowerCase().replace(/[^a-z0-9]/g, '');
    const near = this.headers.filter(h => {
      const k = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return k.includes(needle) || needle.includes(k);
    }).slice(0, 5);
    throw new Error(`Unknown field "${n}".` + (near.length ? ` Did you mean: ${near.join(', ')}?` : ' Call describe_columns to list the fields in this project.'));
  }

  value(row, field) {
    if (field[0] !== '@') return row[field] ?? '';
    switch (field) {
      case '@effective_decision': return this.effectiveKke(row);
      case '@content_kind':   return this.contentKind(row);
      case '@redirect_state': return this.redirectState(row);
      case '@host':           return this.host(row);
      case '@path_1':         { const s = this.pathSegments(row); return s.length ? '/' + s[0] : '/'; }
      case '@path_2':         { const s = this.pathSegments(row); return s.length ? '/' + s.slice(0, 2).join('/') : '/'; }
      case '@in_scope':       return this.inScope(row) ? 'yes' : 'no';
      case '@url_parent':     return this.urlParent(row);
      default:                return '';
    }
  }

  csvColumns() {
    return new Set([this.columnMap.tags, ...CSV_COLUMNS_FIXED]);
  }

  // ── Row selection ──

  _normalizeFilters(filters) {
    if (filters == null) return [];
    if (!Array.isArray(filters)) throw new Error('`filters` must be an array of {field, operator, value}.');
    return filters.map(ff => {
      if (!ff || typeof ff !== 'object') throw new Error('Each filter must be an object: {field, operator, value}.');
      if (!FIELD_FILTER_OPERATORS.includes(ff.operator)) {
        throw new Error(`Unknown operator "${ff.operator}". Available: ${FIELD_FILTER_OPERATORS.join(', ')}`);
      }
      const field = this.resolveField(ff.field);
      // A legacy decision word (Keep / Kill / Evolve) filters for the same decision.
      const decision = field === '@effective_decision' || [this.columnMap.kke, this.columnMap.finalKke, 'Suggested_MRA', 'GA_MRA_Recommendation'].includes(field);
      const value = decision && typeof ff.value === 'string' ? Terminology.value(ff.value, 'mra') : ff.value;
      return { field, operator: ff.operator, value };
    });
  }

  savedFilters() {
    return Array.isArray(this.settings.savedFilters) ? this.settings.savedFilters : [];
  }

  /** The part of renderer.js applyFilter() a saved filter exercises: text search
   *  (scope "all" — saved filters don't record a scope), field filters, the decision
   *  checkbox set (statuses OR specials), and the group filter. */
  _savedFilterPredicate(name) {
    const saved = this.savedFilters().find(f => String(f.name || '').toLowerCase() === String(name).toLowerCase());
    if (!saved) {
      const names = this.savedFilters().map(f => f.name);
      throw new Error(`No saved filter named "${name}".` + (names.length ? ` This project has: ${names.join(', ')}` : ' This project has no saved filters.'));
    }
    const q = String(saved.filterText || '').toLowerCase();
    const ffs = this._normalizeFilters(Array.isArray(saved.fieldFilters) ? saved.fieldFilters : []);
    // Backward compatible with the old single-select string value.
    const kf = Array.isArray(saved.kkeFilter) ? saved.kkeFilter : (saved.kkeFilter ? [saved.kkeFilter] : []);
    const specials = kf.filter(v => String(v).startsWith('_'));
    const statuses = kf.filter(v => !String(v).startsWith('_'));
    const unsupported = specials.filter(s => !SUPPORTED_SPECIAL_FILTERS.has(s));
    if (unsupported.length) {
      throw new Error(`Saved filter "${saved.name}" uses ${unsupported.join(', ')}, which only the app can compute. Refusing rather than returning rows with that condition silently dropped.`);
    }
    const gf = String(saved.groupFilter || '');
    const m = this.columnMap;

    return row => {
      if (q && !Object.values(row).some(v => String(v).toLowerCase().includes(q))) return false;
      if (ffs.length && !ffs.every(ff => fieldFilterMatches(row, ff, (r, f) => this.value(r, f)))) return false;
      if (kf.length) {
        const kke = String(row[m.kke] || '').trim();
        const ok = (statuses.length && statuses.includes(kke)) || specials.some(s => this._specialMatches(s, row, kke));
        if (!ok) return false;
      }
      if (gf && String(row[m.group] || '').trim() !== gf) return false;
      return true;
    };
  }

  _specialMatches(s, row, kke) {
    const m = this.columnMap;
    const eff = () => String(row[m.finalKke] || row[m.kke] || '').trim();
    const carried = () => { const e = eff(); return e === 'Migrate' || e === 'Revise'; };
    switch (s) {
      case '_unreviewed':        return !kke;
      case '_flagged':           return String(row['_Flagged'] || '').trim() === '1';
      case '_sme-pending':       return !!kke && !String(row[m.finalKke] || '').trim();
      case '_needs-placement':   return !String(row['Sitemap_ID'] || '').trim() && !this.isFragment(row) && carried();
      case '_shared-nav': {
        const id = String(row['Sitemap_ID'] || '').trim();
        return !!id && this._sharedIds().has(id);
      }
      case '_suggested-disagree':
        try { const p = JSON.parse(row['Suggested_MRA_Sources'] || ''); return !!(p && p.disagreement); } catch (_) { return false; }
      case '_suggested-mismatch': {
        const sug = String(row['Suggested_MRA'] || '').trim();
        return !!sug && !!kke && sug !== kke;
      }
      case '_needs-audience':    return !parseCsvCell(row['Audiences']).length && carried();
      case '_audience-suggested': return !parseCsvCell(row['Audiences']).length && !!row['_Suggested_Audiences'];
      case '_needs-job':         return this.jobLibrary.length > 0 && !parseCsvCell(row['Jobs_Served']).length && carried();
      case '_non-content':       return this.contentKind(row) !== 'content';
      case '_inherited-redirect': return this.contentKind(row) === 'redirect';
      case '_client-review-open':      return this.clientReviewIsOpen(row);
      case '_client-review-urgent':    return this.clientReviewIsOpen(row) && this.clientReviewIsUrgent(row);
      case '_client-review-undecided': return this.clientReviewStatus(row) === 'Needs decision' && !this.effectiveKke(row);
      default:                   return false;
    }
  }

  _sharedIds() {
    if (this._sharedNavIds) return this._sharedNavIds;
    const counts = new Map();
    for (const r of this.rows) {
      const id = String(r['Sitemap_ID'] || '').trim();
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
    this._sharedNavIds = new Set([...counts].filter(([, n]) => n > 1).map(([id]) => id));
    return this._sharedNavIds;
  }

  /** The shared row selector behind aggregate / query_rows / get_redirects. */
  select({ filters, savedFilter, search, searchScope, scope } = {}) {
    const sc = scope || 'in-scope';
    if (sc !== 'in-scope' && sc !== 'all') throw new Error('`scope` must be "in-scope" (default) or "all".');
    const ffs = this._normalizeFilters(filters);
    const saved = savedFilter ? this._savedFilterPredicate(savedFilter) : null;
    const q = String(search || '').toLowerCase();
    const ss = searchScope || 'all';
    if (!['all', 'url', 'title'].includes(ss)) throw new Error('`searchScope` must be "all", "url" or "title".');
    const get = (r, f) => this.value(r, f);

    const out = [];
    for (const row of this.rows) {
      if (sc === 'in-scope' && !this.inScope(row)) continue;
      if (saved && !saved(row)) continue;
      if (q) {
        const hit = ss === 'url' ? this.url(row).toLowerCase().includes(q)
          : (ss === 'title' && this.titleColumn) ? String(row[this.titleColumn] || '').toLowerCase().includes(q)
          : Object.values(row).some(v => String(v).toLowerCase().includes(q));
        if (!hit) continue;
      }
      if (ffs.length && !ffs.every(ff => fieldFilterMatches(row, ff, get))) continue;
      out.push(row);
    }
    return out;
  }

  // ── Tools ──

  overview() {
    const inScopeRows = this.select({});
    const tally = rows => {
      const t = {};
      for (const r of rows) { const k = this.effectiveKke(r) || '(unreviewed)'; t[k] = (t[k] || 0) + 1; }
      return t;
    };
    const content = inScopeRows.filter(r => this.contentKind(r) === 'content');
    const kinds = { content: 0, redirect: 0, gone: 0 };
    for (const r of inScopeRows) kinds[this.contentKind(r)]++;
    const reviewed = rows => rows.filter(r => this.effectiveKke(r)).length;
    const pct = (n, d) => d ? Math.round((n / d) * 1000) / 10 : 0;
    const libSize = key => Array.isArray(this.settings[key]) ? this.settings[key].length : 0;

    const placedCarried = content.filter(r => ['Migrate', 'Revise'].includes(this.effectiveKke(r)) && !this.isFragment(r));

    return {
      file: this.filePath,
      client: this.settings.clientName || '',
      project: this.settings.projectName || '',
      siteDomain: this.settings.siteDomain || '',
      savedAt: this.meta.savedAt || '',
      savedByAppVersion: this.meta.appVersion || '',
      rows: {
        total: this.rows.length,
        inScope: inScopeRows.length,
        outOfScope: this.rows.length - inScopeRows.length,
        note: this._hasOutOfScope ? 'Rows from out-of-scope source sites are excluded from every figure below and from tool results unless scope:"all".' : undefined
      },
      contentSplit: {
        ...kinds,
        note: this.statusCodeColumn ? undefined : 'No Status Code column — every row is counted as content.'
      },
      auditorProgress: { reviewed: reviewed(inScopeRows), of: inScopeRows.length, pct: pct(reviewed(inScopeRows), inScopeRows.length), basis: 'all in-scope rows — a redirect still has to be triaged' },
      contentInventory: { reviewed: reviewed(content), of: content.length, pct: pct(reviewed(content), content.length), basis: 'content pages only — the figure to quote to a client' },
      effectiveKke: { allRows: tally(inScopeRows), contentOnly: tally(content) },
      placement: {
        migrateReviseContentPages: placedCarried.length,
        placedInSitemap: placedCarried.filter(r => String(r['Sitemap_ID'] || '').trim()).length
      },
      sitemap: { nodes: this.navNodes.length, topLevel: this.navRoots.length },
      sites: this.siteLibrary.map(s => ({ label: s.label, hosts: s.hosts || [], inScope: s.inScope !== false })),
      libraries: {
        audiences: libSize('audienceLibrary'), jobs: libSize('jobLibrary'), sites: this.siteLibrary.length,
        contentTypes: libSize('contentTypeRegistry'), targetSpecs: libSize('patternLibrary'),
        pageStatuses: libSize('pageStatusLibrary'), assignees: libSize('assigneeLibrary'),
        menus: libSize('menus')
      },
      savedFilters: this.savedFilters().map(f => f.name),
      columns: { count: this.headers.length, url: this.urlColumn, title: this.titleColumn, statusCode: this.statusCodeColumn, ...this.columnMap },
      changelogEntries: this.changelogCount,
      damagedEntries: this.parseErrors.length ? this.parseErrors.slice(0, 10) : undefined
    };
  }

  describeColumns({ columns, topN, scope } = {}) {
    const rows = this.select({ scope });
    const n = Math.min(Math.max(parseInt(topN, 10) || 10, 1), 50);
    const detailed = Array.isArray(columns) && columns.length > 0;
    const fields = detailed ? columns.map(c => this.resolveField(c)) : this.headers.filter(h => h !== '_rowIndex');
    const csv = this.csvColumns();

    const out = fields.map(f => {
      const counts = new Map();
      let filled = 0;
      for (const r of rows) {
        const v = String(this.value(r, f) ?? '').trim();
        if (!v) continue;
        filled++;
        if (csv.has(f)) for (const part of parseCsvCell(v)) counts.set(part, (counts.get(part) || 0) + 1);
        else counts.set(v, (counts.get(v) || 0) + 1);
      }
      const d = { field: f, filled, blank: rows.length - filled, distinct: counts.size };
      if (csv.has(f)) d.commaSeparated = true;
      if (detailed) {
        d.topValues = [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
          .slice(0, n).map(([value, count]) => ({ value: clip(value, 120), count }));
      }
      return d;
    });
    return {
      rows: rows.length,
      columns: out,
      virtualFields: detailed ? undefined : VIRTUAL_FIELDS,
      hint: detailed ? undefined : 'Pass `columns` to see the top values of specific fields. A low `distinct` count marks a field worth grouping by.'
    };
  }

  aggregate({ groupBy, splitCsv, limit, ...sel } = {}) {
    const gb = (Array.isArray(groupBy) ? groupBy : [groupBy]).filter(Boolean).map(f => this.resolveField(f));
    if (gb.length < 1 || gb.length > 3) throw new Error('`groupBy` takes one to three field names.');
    const rows = this.select(sel);
    const csv = splitCsv === false ? new Set() : this.csvColumns();
    const split = gb.filter(f => csv.has(f));
    const cap = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);

    const counts = new Map();
    for (const r of rows) {
      let combos = [[]];
      for (const f of gb) {
        const v = String(this.value(r, f) ?? '').trim();
        let vals = csv.has(f) ? parseCsvCell(v) : [v];
        if (!vals.length) vals = [''];
        const next = [];
        for (const c of combos) for (const val of vals) next.push([...c, val]);
        combos = next;
      }
      for (const c of combos) {
        const k = JSON.stringify(c);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    const groups = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
      matchedRows: rows.length,
      groupBy: gb,
      groupCount: groups.length,
      truncated: groups.length > cap ? `showing the ${cap} largest of ${groups.length} groups` : undefined,
      note: split.length ? `${split.join(', ')} hold several values per cell and were split, so counts can sum to more than matchedRows.` : undefined,
      groups: groups.slice(0, cap).map(([k, count]) => {
        const vals = JSON.parse(k);
        const values = {};
        gb.forEach((f, i) => { values[f] = vals[i] === '' ? '(blank)' : vals[i]; });
        return { values, count, pct: rows.length ? Math.round((count / rows.length) * 1000) / 10 : 0 };
      })
    };
  }

  queryRows({ columns, sortBy, sortDir, limit, offset, ...sel } = {}) {
    const rows = this.select(sel);
    const defaults = [this.urlColumn, this.titleColumn, this.statusCodeColumn, '@effective_decision'].filter(Boolean);
    const cols = (Array.isArray(columns) && columns.length ? columns : defaults).map(c => this.resolveField(c));
    if (!cols.includes(this.urlColumn)) cols.unshift(this.urlColumn);   // URL is the row's identity

    if (sortBy) {
      const f = this.resolveField(sortBy);
      const dir = String(sortDir || 'asc').toLowerCase() === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        const av = String(this.value(a, f) ?? '').trim();
        const bv = String(this.value(b, f) ?? '').trim();
        if (av === '' || bv === '') return (av === '' ? 1 : 0) - (bv === '' ? 1 : 0);   // blanks last, either direction
        return dir * (fieldFilterCompare(av, bv) || 0);
      });
    }
    const cap = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 200);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    const page = rows.slice(off, off + cap);
    return {
      total: rows.length,
      offset: off,
      returned: page.length,
      nextOffset: off + page.length < rows.length ? off + page.length : undefined,
      columns: cols,
      rows: page.map(r => {
        const o = {};
        for (const c of cols) o[c] = clip(this.value(r, c), 300);
        return o;
      })
    };
  }

  _urlLookup() {
    if (this._urlIndex) return this._urlIndex;
    const exact = new Map(), loose = new Map();
    this.rows.forEach(r => {
      const u = this.url(r);
      if (!u) return;
      if (!exact.has(u)) exact.set(u, []);
      exact.get(u).push(r);
      const k = looseUrl(u);
      if (!loose.has(k)) loose.set(k, []);
      loose.get(k).push(r);
    });
    this._urlIndex = { exact, loose };
    return this._urlIndex;
  }

  findRows(url) {
    const { exact, loose } = this._urlLookup();
    return exact.get(String(url)) || loose.get(looseUrl(url)) || [];
  }

  getRow({ url, includeInternal, historyLimit } = {}) {
    if (!url) throw new Error('`url` is required — rows are addressed by URL, not position.');
    const hits = this.findRows(url);
    if (!hits.length) throw new Error(`No row with URL ${url}. Try query_rows with search + searchScope:"url".`);
    const row = hits[0];
    const fields = {};
    for (const h of this.headers) {
      if (h === '_rowIndex') continue;
      if (h[0] === '_' && !includeInternal) continue;
      const v = row[h];
      if (v === undefined || v === null || String(v).trim() === '') continue;
      fields[h] = clip(v, 2000);
    }
    const id = String(row['Sitemap_ID'] || '').trim();
    const node = id ? this.nodeById.get(id) : null;
    const address = this.url(row);
    const consolidatedFrom = this.rows
      .filter(r => r !== row && String(r['_ConsolidateTargetId'] || '') === address)
      .map(r => this.url(r));

    return {
      url: address,
      duplicateUrlRows: hits.length > 1 ? hits.length : undefined,
      derived: {
        effectiveKke: this.effectiveKke(row) || '(unreviewed)',
        contentKind: this.contentKind(row),
        redirectState: this.redirectState(row),
        inScope: this.inScope(row),
        isFragment: this.isFragment(row) || undefined
      },
      sitemapNode: node ? compact({ id: node.id, number: node.number, label: node.label, breadcrumb: node.breadcrumb, computedPath: node.computedPath, nodeType: node.nodeType, phase: node.phase, pageStatus: node.pageStatus }) : (id ? { id, missing: true } : undefined),
      consolidatedFrom: consolidatedFrom.length ? consolidatedFrom : undefined,
      fields,
      history: this.changelog({ url: address, limit: historyLimit || 50 }).entries
    };
  }

  // ── Sitemap ──

  /** Same assembly as main.js parseNavSheet(): children attach by ParentNumber,
   *  and a node whose parent is missing becomes a root. */
  _buildNav(flat) {
    this.navNodes = [];
    const byNumber = new Map();
    for (const n of flat) {
      const number = String(n.number || '');
      if (!number) continue;
      const node = { ...n, number, id: String(n.id || ''), children: [] };
      this.navNodes.push(node);
      byNumber.set(number, node);
    }
    this.navRoots = [];
    for (const node of this.navNodes) {
      const parent = node.parentNumber && byNumber.get(String(node.parentNumber));
      if (parent) parent.children.push(node); else this.navRoots.push(node);
    }
    this.nodeById = new Map(this.navNodes.map(n => [n.id, n]));
    this._navCounts = null;
  }

  /** `live` mirrors navPageCounts() (behind _navPageCountsCache()) — direct pages, Archive/Consolidate
   *  excluded, since those Sitemap_IDs are redirect hints rather than pages that
   *  will live there. `subtree` mirrors computeSubtreePageCounts() — every row
   *  anywhere beneath, whatever its decision: how much content is under here. */
  _counts() {
    if (this._navCounts) return this._navCounts;
    const live = new Map(), all = new Map();
    for (const r of this.rows) {
      const id = String(r['Sitemap_ID'] || '').trim();
      if (!id) continue;
      all.set(id, (all.get(id) || 0) + 1);
      const eff = this.effectiveKke(r).toLowerCase();
      if (eff !== 'archive' && eff !== 'consolidate') live.set(id, (live.get(id) || 0) + 1);
    }
    const subtree = new Map(), liveBelow = new Map();
    const walk = node => {
      let s = all.get(node.id) || 0, l = 0;
      for (const c of node.children) { const [cs, cl] = walk(c); s += cs; l += cl + (live.get(c.id) || 0); }
      subtree.set(node.id, s);
      liveBelow.set(node.id, l);
      return [s, l];
    };
    this.navRoots.forEach(walk);
    this._navCounts = { live, subtree, liveBelow };
    return this._navCounts;
  }

  getSitemap({ rootId, depth, maxNodes } = {}) {
    if (!this.navNodes.length) return { nodes: 0, note: 'This project has no sitemap yet.' };
    let roots = this.navRoots;
    if (rootId) {
      const root = this.nodeById.get(String(rootId));
      if (!root) throw new Error(`No sitemap node with id ${rootId}.`);
      roots = [root];
    }
    const maxDepth = depth === 0 || depth === 'all' ? Infinity : Math.min(Math.max(parseInt(depth, 10) || 2, 1), 50);
    const cap = Math.min(Math.max(parseInt(maxNodes, 10) || 300, 1), 2000);
    const { live, subtree, liveBelow } = this._counts();
    let emitted = 0, truncated = false;

    const render = (node, d) => {
      if (emitted >= cap) { truncated = true; return null; }
      emitted++;
      const direct = live.get(node.id) || 0;
      const type = String(node.nodeType || '');
      // renderer.js isHub: a real, current-build page node with no page of its
      // own but live pages beneath it — content somebody has to write.
      const netNew = !type && !String(node.phase || '').trim() && direct === 0 && node.children.length > 0 && (liveBelow.get(node.id) || 0) > 0;
      const o = compact({
        id: node.id, number: node.number, label: node.label, path: node.computedPath,
        nodeType: type, phase: node.phase, pageStatus: node.pageStatus, externalUrl: node.url,
        refNodeId: node.refNodeId, builder: node.buildAssignee, writer: node.writeAssignee, migrator: node.migrateAssignee,
        audiences: node.audiences,  // who the section is for (CSV), set on the node itself
        // Left out of the Visual Sitemap diagram only; still a real node.
        hiddenInDiagram: node.hideInVisual === 'Y' || node.hideInVisual === true
      });
      o.livePages = direct;
      o.subtreeRows = subtree.get(node.id) || 0;
      if (netNew) o.netNew = true;
      if (node.children.length) {
        if (d < maxDepth) o.children = node.children.map(c => render(c, d + 1)).filter(Boolean);
        else o.childrenNotShown = node.children.length;
      }
      return o;
    };
    const tree = roots.map(r => render(r, 1)).filter(Boolean);
    return {
      totalNodes: this.navNodes.length,
      shown: emitted,
      truncated: truncated ? `stopped at ${cap} nodes — narrow with rootId or a smaller depth` : undefined,
      counts: 'livePages = pages assigned directly to the node, Archive/Consolidate excluded. subtreeRows = every row assigned anywhere beneath it, any decision. netNew = no page of its own but live pages below.',
      tree
    };
  }

  // ── Redirects ──

  getRedirects({ mode, provenance, state, limit, offset, ...sel } = {}) {
    let rows = this.select(sel).filter(r => {
      if (this.isFragment(r)) return false;           // no public URL, so no redirect
      if (this.redirectState(r) !== 'none') return true;
      const eff = this.effectiveKke(r);
      return eff === 'Archive' || eff === 'Consolidate';  // owes one, hasn't got one
    });
    const prov = r => String(r['_RedirectSource'] || '').trim() || (this.redirectState(r) === 'none' ? '' : 'unknown');
    if (provenance) rows = rows.filter(r => prov(r) === provenance);
    if (state) {
      if (!['none', '404', 'set'].includes(state)) throw new Error('`state` must be "none", "404" or "set".');
      rows = rows.filter(r => this.redirectState(r) === state);
    }

    if ((mode || 'summary') === 'summary') {
      const bySite = new Map();
      for (const r of rows) {
        const site = String(r['Source_Site'] || '').trim() || this.host(r) || '(unknown)';
        if (!bySite.has(site)) bySite.set(site, { site, set: 0, deliberate404: 0, owedButBlank: 0, provenance: {} });
        const b = bySite.get(site);
        const st = this.redirectState(r);
        if (st === 'set') b.set++; else if (st === '404') b.deliberate404++; else b.owedButBlank++;
        const p = prov(r);
        if (p) b.provenance[p] = (b.provenance[p] || 0) + 1;
      }
      return {
        rows: rows.length,
        notes: 'owedButBlank = Archive/Consolidate pages with no destination yet. provenance "unknown" = written before provenance was recorded; do not assume a person chose it. Fragments are excluded.',
        bySite: [...bySite.values()].sort((a, b) => (b.set + b.owedButBlank) - (a.set + a.owedButBlank))
      };
    }
    const cap = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    const page = rows.slice(off, off + cap);
    return {
      total: rows.length, offset: off, returned: page.length,
      nextOffset: off + page.length < rows.length ? off + page.length : undefined,
      redirects: page.map(r => compact({
        from: this.url(r), to: String(r['Redirect_Destination'] || '').trim() || '(none yet)',
        decision: this.effectiveKke(r) || '(unreviewed)', provenance: prov(r),
        consolidateInto: r['Consolidate_Into'], site: r['Source_Site']
      }))
    };
  }

  // ── Changelog (read on demand — it can be large and is rarely wanted) ──

  changelog({ url, field, auditor, since, until, limit, offset, summary } = {}) {
    const where = [], args = [];
    if (url)     { where.push('url = ?'); args.push(String(url)); }
    // The log holds whichever vocabulary the file was saved in; match both.
    if (field)   { where.push('(field = ? COLLATE NOCASE OR field = ? COLLATE NOCASE)'); args.push(Terminology.header(String(field), 'mra'), Terminology.header(String(field), 'kke')); }
    if (auditor) { where.push('auditor = ? COLLATE NOCASE'); args.push(String(auditor)); }
    if (since)   { where.push('timestamp >= ?'); args.push(String(since)); }
    if (until)   { where.push('timestamp <= ?'); args.push(String(until)); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const cap = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    return withDb(this.filePath, db => {
      const hasTable = db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'changelog'").get();
      if (!hasTable) return { total: 0, entries: [] };
      const total = db.prepare(`SELECT count(*) AS c FROM changelog ${w}`).get(...args).c;
      if (summary) {
        return {
          total,
          byField: mergeFieldCounts(db.prepare(`SELECT field, count(*) AS count FROM changelog ${w} GROUP BY field ORDER BY count DESC LIMIT 50`).all(...args).map(plain)),
          byAuditor: db.prepare(`SELECT auditor, count(*) AS count, min(timestamp) AS first, max(timestamp) AS last FROM changelog ${w} GROUP BY auditor ORDER BY count DESC`).all(...args).map(plain)
        };
      }
      const entries = db.prepare(`SELECT timestamp, auditor, url, field, old_value, new_value FROM changelog ${w} ORDER BY id DESC LIMIT ? OFFSET ?`)
        .all(...args, cap, off)
        .map(e => ({ timestamp: e.timestamp, auditor: e.auditor, url: e.url, field: e.field, from: e.old_value, to: e.new_value }));
      const mra = Terminology.convertChangeLog(entries, 'mra').map(e => ({ ...e, from: clip(e.from, 300), to: clip(e.to, 300) }));
      return { total, offset: off, returned: mra.length, order: 'newest first', entries: mra };
    });
  }

  // ── Libraries ──

  /** The project's own rubrics, parsed. Rubrics in an auditor's personal library
   *  are deliberately not read: they live on one machine, and a finding based on
   *  them couldn't be reproduced by anyone else on the engagement. */
  getRubrics({ statuses } = {}) {
    const texts = this.settings.rubrics && typeof this.settings.rubrics === 'object' ? this.settings.rubrics : {};
    const has = Object.values(texts).some(t => String(t || '').trim());
    if (!has) {
      return {
        source: 'none',
        note: 'This project has no rubrics of its own. The auditor may have a personal rubric library on their machine, but it is not part of the project. Ask them to copy it in: Project → Rubrics… → Copy from my library, then Save.'
      };
    }
    const want = Array.isArray(statuses) && statuses.length
      ? statuses.map(x => Terminology.rubricKey(String(x).toLowerCase(), 'mra')).filter(x => rubricsLib.RUBRIC_STATUSES.includes(x))
      : rubricsLib.RUBRIC_STATUSES;
    const out = {};
    for (const st of want) {
      const text = String(texts[st] || '');
      if (!text.trim()) continue;
      const p = rubricsLib.parseRubricText(text);
      out[st] = {
        fieldRules: p.fieldRules.map(r => ({ raw: r.raw, ...rubricsLib.ruleToFilters(r) })),
        contentRules: p.contentRules,
        patterns: p.patterns
      };
    }
    return {
      source: 'project',
      updatedAt: this.settings.rubricsUpdatedAt || null,
      rubrics: out,
      howToRead: 'Field rules and content rules are the per-page assessment the app runs. Patterns are for whole-audit work: run each pattern\'s appliesWhen filters (all must hold) and drop rows matching any unless filter, then apply the judgment to what is left. A condition with filters:null uses >= or <=, which has no filter operator; restate it with greater-than / less-than.'
    };
  }

  getLibraries({ which } = {}) {
    const s = this.settings;
    const all = {
      identity: () => compact({ clientName: s.clientName, projectName: s.projectName, siteDomain: s.siteDomain, defaultRedirectUrl: s.defaultRedirectUrl, breadcrumbHomeLabel: s.breadcrumbHomeLabel }),
      kkeStates: () => ({ builtIn: BUILTIN_KKE, custom: (Array.isArray(s.customKkeStates) ? s.customKkeStates : []).map(k => k.label || k), blank: 'unreviewed' }),
      audiences: () => s.audienceLibrary || [],
      jobs: () => s.jobLibrary || [],
      sites: () => this.siteLibrary,
      contentTypes: () => s.contentTypeRegistry || [],
      targetSpecs: () => s.patternLibrary || [],
      pageStatuses: () => s.pageStatusLibrary || [],
      assignees: () => s.assigneeLibrary || [],
      contentThemes: () => s.contentThemeLibrary || [],
      glossary: () => s.glossary || { tags: {}, groups: {} },
      savedFilters: () => this.savedFilters().map(f => {
        const kf = Array.isArray(f.kkeFilter) ? f.kkeFilter : (f.kkeFilter ? [f.kkeFilter] : []);
        const unsupported = kf.filter(v => String(v).startsWith('_') && !SUPPORTED_SPECIAL_FILTERS.has(v));
        return compact({ name: f.name, search: f.filterText, kke: kf, group: f.groupFilter, fieldFilters: f.fieldFilters, usableHere: unsupported.length ? `no — uses ${unsupported.join(', ')}` : 'yes' });
      }),
      menus: () => (Array.isArray(s.menus) ? s.menus : []).map(m => ({ id: m.id, name: m.name, placement: m.placement, items: (m.items || []).length }))
    };
    const names = Array.isArray(which) ? which : (which ? [which] : []);
    if (!names.length) {
      const sizes = {};
      for (const [k, fn] of Object.entries(all)) {
        const v = fn();
        sizes[k] = Array.isArray(v) ? v.length : (k === 'glossary' ? Object.keys(v.tags || {}).length + Object.keys(v.groups || {}).length : 1);
      }
      return { available: sizes, hint: 'Pass `which` (one or more of these names) to read a library.' };
    }
    const out = {};
    for (const n of names) {
      if (!all[n]) throw new Error(`Unknown library "${n}". Available: ${Object.keys(all).join(', ')}`);
      out[n] = all[n]();
    }
    return out;
  }
}

// ─── Proposals (the only write path) ─────────────────────────────────────────

Project.prototype.proposalFieldInfo = function () {
  const out = {};
  for (const [canon, def] of Object.entries(PROPOSAL_FIELDS)) {
    const col = def.map ? this.columnMap[def.map] : canon;
    out[col] = { kind: def.kind, canonical: canon, vocab: this._proposalVocab(def), clientReview: def.clientReview };
  }
  return out;
};

/** The allowed values for a controlled field, read from THIS project's own
 *  libraries, or null for free text. */
Project.prototype._proposalVocab = function (def) {
  const v = def.vocab;
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (v === 'kke') {
    const custom = (Array.isArray(this.settings.customKkeStates) ? this.settings.customKkeStates : []).map(k => String(k.label || k)).filter(Boolean);
    // Consolidate needs a target page, which only the app's picker can set —
    // a proposal to consolidate without saying into what is not a decision.
    return [...BUILTIN_KKE.filter(k => k !== 'Consolidate'), ...custom];
  }
  if (v === 'audiences' || v === 'audiences-one') {
    const names = (Array.isArray(this.settings.audienceLibrary) ? this.settings.audienceLibrary : []).map(a => a.name).filter(Boolean);
    return v === 'audiences' ? names : names.filter(n => n !== AUDIENCE_NONE);
  }
  if (v === 'jobs') return this.jobLibrary.map(j => j.label).filter(Boolean);
  if (v === 'client-review-reasons') {
    const lib = this.settings.clientReviewReasons;
    return Array.isArray(lib) ? lib.map(String).filter(Boolean) : DEFAULT_CLIENT_REVIEW_REASONS.slice();
  }
  return null;
};

/** Resolve a proposed field name to a real column + its rules, or throw. */
Project.prototype._resolveProposalField = function (name) {
  const info = this.proposalFieldInfo();
  const n = String(name || '').trim();
  const hit = Object.keys(info).find(c => c === n) || Object.keys(info).find(c => c.toLowerCase() === n.toLowerCase())
    || Object.keys(info).find(c => info[c].canonical.toLowerCase() === n.toLowerCase())
    // Legacy KKE spellings (KKE_Recommendation) name the same field.
    || Object.keys(info).find(c => info[c].canonical.toLowerCase() === Terminology.header(n, 'mra').toLowerCase());
  if (!hit) throw new Error(`"${n}" is not a field proposals may change. Allowed: ${Object.keys(info).join(', ')}. Final_MRA, sitemap placement, redirects and consolidation targets can only be set in the app.`);
  return { column: hit, ...info[hit] };
};

/** Validate one proposal against the live project. Returns {ok, column, value,
 *  current, reason} — `reason` set when it should be skipped rather than queued. */
/** Consolidate_Into: the target must be another page in the audit, not one that
 *  already consolidates back into this page (directly or along a chain), and not
 *  one that is itself being removed — the content would have nowhere to land. */
Project.prototype._checkConsolidateProposal = function (row, targetRaw, rationale) {
  const pageUrl = this.url(row);
  const target = this.findRows(targetRaw)[0];
  if (!target) return { ok: false, reason: `the target ${targetRaw} is not a page in this audit` };
  const targetUrl = this.url(target);
  if (target === row || looseUrl(targetUrl) === looseUrl(pageUrl)) {
    throw new Error(`${pageUrl}: a page cannot consolidate into itself.`);
  }
  const idOf = r => String(r._ConsolidateTargetId || r[CONSOLIDATE_ID_COLUMN] || '').trim();
  if (this.effectiveKke(row) === 'Consolidate' && looseUrl(idOf(row)) === looseUrl(targetUrl)) {
    return { ok: false, reason: 'already consolidating into that page' };
  }
  // Walk the target's own chain: reaching this page means a loop.
  const seen = new Set([looseUrl(targetUrl)]);
  let cur = target;
  while (cur && this.effectiveKke(cur) === 'Consolidate') {
    const next = idOf(cur);
    if (!next) break;
    if (looseUrl(next) === looseUrl(pageUrl)) return { ok: false, reason: 'the target already consolidates back into this page' };
    if (seen.has(looseUrl(next))) break;
    seen.add(looseUrl(next));
    cur = this.findRows(next)[0];
  }
  const tk = this.effectiveKke(target);
  if (tk === 'Archive' || tk === 'Exclude') return { ok: false, reason: `the target is marked ${tk}, so the content would have nowhere to land` };
  return { ok: true, column: 'Consolidate_Into', value: targetUrl, current: String(row.Consolidate_Into || '').trim(), url: pageUrl, rationale };
};

Project.prototype._checkProposal = function (c) {
  if (!c || typeof c !== 'object') throw new Error('Each change must be an object {url, field, value, rationale}.');
  const url = String(c.url || '').trim();
  if (!url) throw new Error('A change needs a `url`.');
  const rationale = String(c.rationale || '').trim();
  if (!rationale) throw new Error(`${url}: a change needs a \`rationale\` — the auditor reads it before accepting.`);
  const f = this._resolveProposalField(c.field);
  // A legacy value (Keep / Kill/Redirect) is the same decision in the old words.
  const toMra = v => f.canonical === 'Migration_Track' ? Terminology.track(v, 'mra') : Terminology.value(v, 'mra');
  const decisionish = f.canonical === 'MRA_Recommendation' || f.canonical === 'Migration_Track';
  const raw = !decisionish ? c.value : (Array.isArray(c.value) ? c.value.map(toMra) : toMra(c.value));
  const values = Array.isArray(raw) ? raw.map(v => String(v).trim()).filter(Boolean) : String(raw ?? '').split(f.kind === 'add' ? ',' : '\u0000').map(v => v.trim()).filter(Boolean);
  if (!values.length) throw new Error(`${url}: ${f.column} needs a non-empty value; proposals cannot clear a field.`);
  if (f.kind !== 'add' && f.kind !== 'note' && values.length > 1 && !Array.isArray(raw)) values.splice(1);
  if (f.vocab) {
    const bad = values.filter(v => !f.vocab.some(o => o.toLowerCase() === v.toLowerCase()));
    if (bad.length) throw new Error(`${url}: ${f.column} cannot be "${bad.join('", "')}". This project allows: ${f.vocab.join(' · ')}`);
    // Normalise case to the project's own spelling.
    values.forEach((v, i) => { values[i] = f.vocab.find(o => o.toLowerCase() === v.toLowerCase()); });
  }
  const rows = this.findRows(url);
  if (!rows.length) return { ok: false, reason: 'no row with that URL' };
  const row = rows[0];
  if (f.kind === 'consolidate') return this._checkConsolidateProposal(row, values[0], rationale);
  if (f.clientReview) {
    const batch = this._batchClientReview || { status: new Set(), decision: new Set() };
    const key = looseUrl(this.url(row));
    if (f.clientReview !== 'status' && !this.clientReviewStatus(row) && !batch.status.has(key)) {
      return { ok: false, reason: 'no client-review request on this page; propose a Client_Review status with it' };
    }
    if (f.clientReview === 'status' && values[0] === 'Please confirm' && !this.effectiveKke(row) && !batch.decision.has(key)) {
      return { ok: false, reason: 'Please confirm needs a decision to confirm; propose Needs decision, or a decision with it' };
    }
  }
  const current = String(row[f.column] ?? '').trim();
  const value = f.kind === 'add' ? values.join(', ') : values.join('\n');
  if (f.kind === 'set' && current.toLowerCase() === value.toLowerCase()) return { ok: false, reason: `already "${current}"` };
  if (f.kind === 'add') {
    const have = parseCsvCell(current).map(x => x.toLowerCase());
    const fresh = values.filter(v => !have.includes(v.toLowerCase()));
    if (!fresh.length) return { ok: false, reason: `already has ${values.join(', ')}` };
    return { ok: true, column: f.column, value: fresh.join(', '), current, url: this.url(row), rationale };
  }
  return { ok: true, column: f.column, value, current, url: this.url(row), rationale };
};

/**
 * Queue proposals. Validates EVERY change before writing ANY — a batch with one
 * bad field name fails whole, so a half-queued batch never has to be explained.
 * A pending proposal for the same page + field is replaced, not stacked: the
 * newer rationale wins, and the auditor sees one line per decision.
 */
Project.prototype.proposeChanges = function ({ changes, source, batch } = {}) {
  if (!Array.isArray(changes) || !changes.length) throw new Error('`changes` must be a non-empty array of {url, field, value, rationale}.');
  if (changes.length > PROPOSAL_MAX_BATCH) throw new Error(`At most ${PROPOSAL_MAX_BATCH} changes per call.`);
  const src = String(source || 'mcp').trim().slice(0, 80);
  const batchId = String(batch || '').trim() || (new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6));
  // A batch may ask the client a question and set its priority in one go, so
  // the client-review checks look at what else the batch proposes per page.
  const batchCr = { status: new Set(), decision: new Set() };
  for (const c of changes) {
    if (!c || typeof c !== 'object') continue;
    const fld = String(c.field || '').trim().toLowerCase();
    const key = looseUrl(String(c.url || '').trim());
    if (fld === 'client_review') batchCr.status.add(key);
    if (fld === 'mra_recommendation' || fld === 'kke_recommendation') batchCr.decision.add(key);
  }
  this._batchClientReview = batchCr;
  let checked;
  try { checked = changes.map(c => this._checkProposal(c)); }   // throws on the first invalid one
  finally { this._batchClientReview = null; }
  const skipped = [], queued = [];
  checked.forEach((r, i) => { if (r.ok) queued.push(r); else skipped.push({ url: String(changes[i].url), field: String(changes[i].field), reason: r.reason }); });
  let inserted = 0, replaced = 0;
  if (queued.length) {
    const { DatabaseSync } = sqlite();
    const db = new DatabaseSync(this.filePath);
    try {
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec(PROPOSALS_DDL);
      const find = db.prepare("SELECT id FROM proposals WHERE status = 'pending' AND url = ? AND field = ?");
      const upd = db.prepare('UPDATE proposals SET created_at = ?, batch = ?, source = ?, value = ?, rationale = ? WHERE id = ?');
      const ins = db.prepare('INSERT INTO proposals (created_at, batch, source, url, field, value, rationale, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const now = new Date().toISOString();
      db.exec('BEGIN');
      try {
        for (const q of queued) {
          const prev = find.get(q.url, q.column);
          if (prev) { upd.run(now, batchId, src, q.value, q.rationale, prev.id); replaced++; }
          else { ins.run(now, batchId, src, q.url, q.column, q.value, q.rationale, 'pending'); inserted++; }
        }
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    } finally {
      try { db.close(); } catch (_) { /* closed */ }
    }
  }
  return {
    batch: batchId,
    queued: inserted + replaced,
    inserted,
    replacedPending: replaced,
    skipped: skipped.length ? skipped : undefined,
    note: 'Queued for the auditor to accept or reject in Transmission (sidebar "Proposals" button, or Project → Review Proposals). Nothing has been changed yet.'
  };
};

const PAGE_TEXT_MAX_BATCH = 10;
const PAGE_TEXT_CONCURRENCY = 3;
const PAGE_TEXT_CACHE_CHARS = 40000;   // what's stored; maxChars trims what's returned

/**
 * Main-content text for up to ten pages, from the project's cache when present,
 * otherwise fetched live (three at a time) and cached. Only pages in the
 * inventory can be fetched: the cache is part of the project, and a tool that
 * fetches any URL it's handed is a tool for something other than this audit.
 * Failures (blocked, timed out, 4xx/5xx, not HTML) are reported per page and
 * never cached, so a retry can succeed.
 */
Project.prototype.getPageText = async function ({ urls, url, refresh, maxChars, fetchImpl } = {}) {
  const asked = (Array.isArray(urls) ? urls : (url ? [url] : [])).map(u => String(u || '').trim()).filter(Boolean);
  if (!asked.length) throw new Error('Pass `urls` (up to ' + PAGE_TEXT_MAX_BATCH + ' page URLs from the audit).');
  if (asked.length > PAGE_TEXT_MAX_BATCH) throw new Error(`At most ${PAGE_TEXT_MAX_BATCH} pages per call — narrow the candidates with filters first, then read them in batches.`);
  const cap = Math.max(500, Math.min(parseInt(maxChars, 10) || pageText.DEFAULT_MAX_CHARS, PAGE_TEXT_CACHE_CHARS));

  const failed = [];
  const targets = [];
  for (const u of asked) {
    const row = this.findRows(u)[0];
    if (!row) { failed.push({ url: u, error: 'not a page in this audit' }); continue; }
    targets.push(this.url(row));
  }
  const { DatabaseSync } = sqlite();
  const cache = refresh ? new Map() : pageText.readCache(DatabaseSync, this.filePath, targets);
  const shape = (u, d, cached) => {
    const text = String(d.text || '');
    return {
      url: u, cached, fetchedAt: d.fetchedAt, httpStatus: d.httpStatus, finalUrl: d.finalUrl !== u ? d.finalUrl : undefined,
      title: d.title, h1: d.h1, region: d.region,
      paragraphs: d.paragraphs, shortParagraphs: d.shortParagraphs, listItems: d.listItems, words: d.words,
      headings: d.headings,
      text: text.length > cap ? text.slice(0, cap) : text,
      truncated: d.truncated || text.length > cap
    };
  };
  const pages = [];
  const toFetch = [];
  for (const u of targets) {
    if (cache.has(u)) pages.push(shape(u, cache.get(u), true));
    else toFetch.push(u);
  }
  const fresh = [];
  await pageText.pool(toFetch, PAGE_TEXT_CONCURRENCY, async u => {
    try {
      const r = await pageText.fetchHtml(u, fetchImpl ? { fetchImpl } : {});
      if (r.status >= 400) { failed.push({ url: u, httpStatus: r.status, error: `HTTP ${r.status}` }); return; }
      const data = pageText.extractPageText(r.html, { maxChars: PAGE_TEXT_CACHE_CHARS });
      const entry = { url: u, fetchedAt: new Date().toISOString(), httpStatus: r.status, finalUrl: r.finalUrl, data };
      fresh.push(entry);
      pages.push(shape(u, { ...data, fetchedAt: entry.fetchedAt, httpStatus: r.status, finalUrl: r.finalUrl }, false));
    } catch (e) {
      const msg = e && e.name === 'TimeoutError' ? 'timed out' : (e && e.cause && e.cause.code) || (e && e.message) || String(e);
      failed.push({ url: u, error: msg });
    }
  });
  let cacheError;
  try { pageText.writeCache(DatabaseSync, this.filePath, fresh); }
  catch (e) { cacheError = `fetched, but could not cache: ${e.message}`; }
  const order = new Map(asked.map((u, i) => [looseUrl(u), i]));
  pages.sort((a, b) => (order.get(looseUrl(a.url)) ?? 0) - (order.get(looseUrl(b.url)) ?? 0));
  return {
    pages,
    failed: failed.length ? failed : undefined,
    cacheError,
    note: 'Main content only (see `region` for how it was found). `paragraphs` counts paragraphs of a sentence or more; `shortParagraphs` the rest. Text is a live fetch of the current site — cite it as such.'
  };
};

Project.prototype.listProposals = function ({ status, batch, limit, offset } = {}) {
  const st = status || 'pending';
  if (!['pending', 'accepted', 'rejected', 'all'].includes(st)) throw new Error('`status` must be pending, accepted, rejected or all.');
  const cap = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  return withDb(this.filePath, db => {
    const has = db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'proposals'").get();
    if (!has) return { total: 0, proposals: [], note: 'No proposals have been queued for this project.' };
    const where = [], args = [];
    if (st !== 'all') { where.push('status = ?'); args.push(st); }
    if (batch) { where.push('batch = ?'); args.push(String(batch)); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = db.prepare(`SELECT count(*) AS c FROM proposals ${w}`).get(...args).c;
    const byStatus = {};
    for (const r of db.prepare('SELECT status, count(*) AS c FROM proposals GROUP BY status').all()) byStatus[r.status] = r.c;
    const list = db.prepare(`SELECT ${PROPOSAL_COLUMNS.join(', ')} FROM proposals ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, cap, off)
      .map(p => {
        const rows = this.findRows(p.url);
        const current = rows.length ? String(rows[0][p.field] ?? '') : undefined;
        const o = compact({ id: p.id, status: p.status, createdAt: p.created_at, batch: p.batch, source: p.source, url: p.url, field: p.field, value: p.value, rationale: p.rationale, resolvedAt: p.resolved_at, resolvedBy: p.resolved_by });
        // Set after compact(): a blank current value is the informative case
        // ("nothing there yet"), and compact() would drop it.
        o.current = rows.length ? current : '(row no longer exists)';
        return o;
      });
    return { total, byStatus, offset: off, returned: list.length, nextOffset: off + list.length < total ? off + list.length : undefined, proposals: list };
  });
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function clip(v, max) {
  const s = typeof v === 'string' ? v : (v === null || v === undefined ? '' : String(v));
  return s.length > max ? s.slice(0, max) + `… [+${s.length - max} chars]` : s;
}

/** Drop blank/undefined keys so a 500-node tree doesn't spend its tokens on "". */
function compact(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    out[k] = v;
  }
  return out;
}

/** node:sqlite returns null-prototype rows, which JSON-serialize fine but fail
 *  deepStrictEqual against a literal in tests. */
function plain(o) { return { ...o }; }

/** Forgiving URL match for lookups only (trailing slash, case) — the same
 *  latitude renderer.js sameConsolidateUrl() allows. Never used as identity. */
function looseUrl(u) {
  return String(u || '').trim().toLowerCase().replace(/\/+$/, '');
}

module.exports = {
  loadProject, fileStamp, Project, sqlite,
  fieldFilterMatches, fieldFilterCompare, fieldFilterNumber, statusCodeCategory,
  FIELD_FILTER_OPERATORS, VIRTUAL_FIELDS, SUPPORTED_SPECIAL_FILTERS, SUPPORTED_SCHEMA_VERSION,
  PROPOSAL_FIELDS, PROPOSAL_COLUMNS, PROPOSALS_DDL
};
