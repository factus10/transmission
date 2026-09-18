// ════════════════════════════════════════════════════════════════════════════
// Read-only view of a .transmission project, and the query engine over it.
//
// See docs/dev/MCP_SERVER_PROPOSAL.md. Two things about this file are
// deliberate and easy to "fix" by mistake:
//
// 1. It does NOT use ../../project-store.js. That module loads better-sqlite3,
//    which postinstall rebuilds against Electron's ABI — it will not load in a
//    plain node process. And ProjectStore.open() runs _migrate(), which stamps
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

const fs = require('node:fs');
const path = require('node:path');

const SUPPORTED_SCHEMA_VERSION = 1;

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
  kke:          ['KKE_Recommendation', 'KKE Rec', 'KKE Recommendation', 'KKE', 'Recommendation'],
  tags:         ['Tags', 'KKE Tags', 'Audit Tags'],
  notes:        ['Notes', 'Notes/Rationale', 'Rationale', 'Audit Notes'],
  group:        ['Group', 'Audit Group', 'Page Group'],
  primaryTag:   ['Primary Tag', 'Primary_Tag', 'Main Tag'],
  smeDecision:  ['SME_Decision', 'SME Decision', 'SME Rec'],
  smeNotes:     ['SME_Notes', 'SME Notes'],
  contentOwner: ['Content_Owner', 'Content Owner', 'Owner', 'SME'],
  finalKke:     ['Final_KKE', 'Final KKE', 'Final Recommendation']
};
const AUDIT_COL_DEFAULTS = {
  kke: 'KKE_Recommendation', tags: 'Tags', notes: 'Notes', group: 'Group', primaryTag: 'Primary Tag',
  smeDecision: 'SME_Decision', smeNotes: 'SME_Notes', contentOwner: 'Content_Owner', finalKke: 'Final_KKE'
};

// Columns the app injects on open (injectAndOrderAuditColumns + NAV_COLUMNS in
// main.js). A project last saved by an older build may lack some; the app would
// add them blank, so a filter naming one is valid and simply reads blank — not
// an "unknown field" error.
const KNOWN_AUDIT_COLUMNS = [
  '_Flagged', '_AssessedAt', '_AssessmentResult', 'Redirect_Destination', 'Consolidate_Into',
  'Published_Status', 'Page_Type', 'Content_Theme', 'Content_Nature', 'Migration_Track',
  'Suggested_KKE', 'Suggested_KKE_Sources', 'Source_CMS_URL', 'New_CMS_URL', 'Target_Content_Type',
  'Design_Patterns', 'Audiences', 'Primary_Audience', 'Jobs_Served', 'Source_Site', 'Page_Breadcrumb',
  '_ConsolidateTargetId', '_Suggested_Audiences', '_RedirectSource',
  'Sitemap_ID', 'Sitemap_Destination', 'Computed Path', 'Sitemap_SortID',
  'GA_KKE_Recommendation', 'GA_Score'
];

const LEGACY_NAV_COLUMN_RENAMES = [
  ['NavID', 'Sitemap_ID'],
  ['Nav Destination', 'Sitemap_Destination'],
  ['Nav_SortID', 'Sitemap_SortID']
];

const BUILTIN_KKE = ['Keep', 'Kill', 'Evolve', 'Consolidate', 'Exclude'];

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
  '@effective_kke':   'Final_KKE when set, else the KKE recommendation. Blank = unreviewed.',
  '@content_kind':    'content | redirect (3xx) | gone (4xx), from the crawl Status Code. 5xx is content.',
  '@redirect_state':  'none (blank, undecided) | 404 (deliberately no redirect) | set',
  '@host':            'URL host with www. removed',
  '@path_1':          'First URL path segment, e.g. /news. Raw — no shared-prefix or locale handling.',
  '@path_2':          'First two URL path segments, e.g. /news/2024',
  '@in_scope':        'yes | no — whether the row\'s source site is in scope for the audit'
};

// The sidebar's special filters that need nothing the renderer computes. Every
// other one (_duplicates, _url-variant, _redirect-needs-review, …) depends on
// state this server doesn't have, and is refused by name rather than ignored:
// dropping a filter silently returns a confidently wrong row set.
const SUPPORTED_SPECIAL_FILTERS = new Set([
  '_unreviewed', '_flagged', '_sme-pending', '_needs-placement', '_shared-nav',
  '_suggested-disagree', '_suggested-mismatch', '_needs-audience', '_audience-suggested',
  '_needs-job', '_non-content', '_inherited-redirect'
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

    const projectMap = (this.settings.columnMap && typeof this.settings.columnMap === 'object') ? this.settings.columnMap : null;
    this.columnMap = computeColumnMap(this.headers, projectMap);
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

  isFragment(row) {
    return String(row['Content_Nature'] || '').trim() === 'Content Object';
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
      const v = n.toLowerCase();
      if (!VIRTUAL_FIELDS[v]) throw new Error(`Unknown virtual field "${n}". Available: ${Object.keys(VIRTUAL_FIELDS).join(', ')}`);
      return v;
    }
    if (this.headers.includes(n)) return n;
    const hit = this._headerByLower.get(n.toLowerCase());
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
      case '@effective_kke':  return this.effectiveKke(row);
      case '@content_kind':   return this.contentKind(row);
      case '@redirect_state': return this.redirectState(row);
      case '@host':           return this.host(row);
      case '@path_1':         { const s = this.pathSegments(row); return s.length ? '/' + s[0] : '/'; }
      case '@path_2':         { const s = this.pathSegments(row); return s.length ? '/' + s.slice(0, 2).join('/') : '/'; }
      case '@in_scope':       return this.inScope(row) ? 'yes' : 'no';
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
      return { field: this.resolveField(ff.field), operator: ff.operator, value: ff.value };
    });
  }

  savedFilters() {
    return Array.isArray(this.settings.savedFilters) ? this.settings.savedFilters : [];
  }

  /** The part of renderer.js applyFilter() a saved filter exercises: text search
   *  (scope "all" — saved filters don't record a scope), field filters, the KKE
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
    const carried = () => { const e = eff(); return e === 'Keep' || e === 'Evolve'; };
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
        try { const p = JSON.parse(row['Suggested_KKE_Sources'] || ''); return !!(p && p.disagreement); } catch (_) { return false; }
      case '_suggested-mismatch': {
        const sug = String(row['Suggested_KKE'] || '').trim();
        return !!sug && !!kke && sug !== kke;
      }
      case '_needs-audience':    return !parseCsvCell(row['Audiences']).length && carried();
      case '_audience-suggested': return !parseCsvCell(row['Audiences']).length && !!row['_Suggested_Audiences'];
      case '_needs-job':         return this.jobLibrary.length > 0 && !parseCsvCell(row['Jobs_Served']).length && carried();
      case '_non-content':       return this.contentKind(row) !== 'content';
      case '_inherited-redirect': return this.contentKind(row) === 'redirect';
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

    const placedCarried = content.filter(r => ['Keep', 'Evolve'].includes(this.effectiveKke(r)) && !this.isFragment(r));

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
        keepEvolveContentPages: placedCarried.length,
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
    const defaults = [this.urlColumn, this.titleColumn, this.statusCodeColumn, '@effective_kke'].filter(Boolean);
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

  /** `live` mirrors _navPageCountsCache() — direct pages, Kill/Consolidate
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
      if (eff !== 'kill' && eff !== 'consolidate') live.set(id, (live.get(id) || 0) + 1);
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
        refNodeId: node.refNodeId, builder: node.buildAssignee, writer: node.writeAssignee, migrator: node.migrateAssignee
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
      counts: 'livePages = pages assigned directly to the node, Kill/Consolidate excluded. subtreeRows = every row assigned anywhere beneath it, any decision. netNew = no page of its own but live pages below.',
      tree
    };
  }

  // ── Redirects ──

  getRedirects({ mode, provenance, state, limit, offset, ...sel } = {}) {
    let rows = this.select(sel).filter(r => {
      if (this.isFragment(r)) return false;           // no public URL, so no redirect
      if (this.redirectState(r) !== 'none') return true;
      const eff = this.effectiveKke(r);
      return eff === 'Kill' || eff === 'Consolidate';  // owes one, hasn't got one
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
        notes: 'owedButBlank = Kill/Consolidate pages with no destination yet. provenance "unknown" = written before provenance was recorded; do not assume a person chose it. Fragments are excluded.',
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
    if (field)   { where.push('field = ? COLLATE NOCASE'); args.push(String(field)); }
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
          byField: db.prepare(`SELECT field, count(*) AS count FROM changelog ${w} GROUP BY field ORDER BY count DESC LIMIT 50`).all(...args).map(plain),
          byAuditor: db.prepare(`SELECT auditor, count(*) AS count, min(timestamp) AS first, max(timestamp) AS last FROM changelog ${w} GROUP BY auditor ORDER BY count DESC`).all(...args).map(plain)
        };
      }
      const entries = db.prepare(`SELECT timestamp, auditor, url, field, old_value, new_value FROM changelog ${w} ORDER BY id DESC LIMIT ? OFFSET ?`)
        .all(...args, cap, off)
        .map(e => ({ timestamp: e.timestamp, auditor: e.auditor, url: e.url, field: e.field, from: clip(e.old_value, 300), to: clip(e.new_value, 300) }));
      return { total, offset: off, returned: entries.length, order: 'newest first', entries };
    });
  }

  // ── Libraries ──

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
  FIELD_FILTER_OPERATORS, VIRTUAL_FIELDS, SUPPORTED_SPECIAL_FILTERS, SUPPORTED_SCHEMA_VERSION
};
