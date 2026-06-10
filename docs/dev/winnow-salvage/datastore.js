// ─── DataStore: SQLite wrapper for Winnow projects ──────────────────────────
// Each .winnow file is a SQLite database. This class is the single source of
// truth for all reads/writes. All renderer data access goes through IPC →
// DataStore methods.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DataStore {
  constructor() {
    this.db = null;
    this.filePath = null;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /** Create a new .winnow project file */
  create(filePath) {
    this.close();
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.filePath = filePath;
    this._enableWAL();
    this._createSchema();
    this._recordHistory('create', filePath, 0);
    return this;
  }

  /** Open an existing .winnow project file */
  open(filePath) {
    this.close();
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    this.db = new Database(filePath);
    this.filePath = filePath;
    this._enableWAL();
    this._migrate(); // ensure schema is up-to-date
    return this;
  }

  /** Close the database */
  close() {
    if (this.db) {
      try { this.db.close(); } catch (e) { /* ignore */ }
      this.db = null;
      this.filePath = null;
    }
  }

  get isOpen() {
    return this.db !== null;
  }

  _enableWAL() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  // ─── Schema ─────────────────────────────────────────────────────────────────

  _createSchema() {
    this.db.exec(`
      -- Core page data (crawled or imported)
      CREATE TABLE IF NOT EXISTS pages (
        -- Identity
        url                       TEXT PRIMARY KEY,
        crawled_at                TEXT,

        -- HTTP
        status_code               INTEGER,
        status                    TEXT,
        content_type              TEXT,
        reported_content_type     TEXT,
        actual_content_type       TEXT,
        content_type_mismatch     INTEGER DEFAULT 0,
        response_ms               INTEGER,
        redirect_url              TEXT,
        redirect_type             TEXT,
        redirect_chain            TEXT,
        last_modified             TEXT,
        language                  TEXT,

        -- Indexability
        indexable                 INTEGER,
        indexability_status       TEXT,
        meta_robots               TEXT,
        robots_status             TEXT,
        canonical                 TEXT,

        -- Content: crawled
        title                     TEXT,
        title_length              INTEGER,
        meta_description          TEXT,
        meta_description_length   INTEGER,
        h1                        TEXT,
        h2                        TEXT,
        h2_2                      TEXT,

        -- Content: computed from extracted text
        word_count                INTEGER,
        sentence_count            INTEGER,
        avg_words_per_sentence    REAL,
        text_ratio                REAL,
        flesch_score              REAL,
        readability               TEXT,

        -- IA signals
        depth                     INTEGER,
        folder_depth              INTEGER,
        parent_url                TEXT,

        -- Link signals (computed post-crawl from links table)
        inlinks                   INTEGER,
        unique_inlinks            INTEGER,
        outlinks                  INTEGER,
        unique_outlinks           INTEGER,
        external_outlinks         INTEGER,

        -- Discovery
        discovered_via            TEXT,
        sitemap_orphan            INTEGER DEFAULT 0,
        sitemap_lastmod           TEXT,
        sitemap_priority          REAL,

        -- KKE audit fields
        kke_recommendation        TEXT DEFAULT '',
        tags                      TEXT DEFAULT '',
        notes                     TEXT DEFAULT '',
        "group"                   TEXT DEFAULT '',
        primary_tag               TEXT DEFAULT '',
        flagged                   INTEGER DEFAULT 0,
        assessed_at               TEXT,
        assessment_result         TEXT,

        -- Nav assignment
        nav_id                    TEXT,
        nav_destination           TEXT,
        computed_path             TEXT,
        nav_sort_id               TEXT,

        -- Redirect
        redirect_destination      TEXT,

        -- GA4 data (populated in separate pass)
        ga4_sessions              INTEGER,
        ga4_pageviews             INTEGER,
        ga4_bounce_rate           REAL,
        ga4_avg_engagement_time   REAL,

        -- AI assessment (populated in separate pass, HTML only)
        ai_assessment             TEXT,
        ai_assessed_at            TEXT,

        -- Screenshot
        screenshot_path           TEXT,

        -- Query string analysis
        query_param_class         TEXT,       -- 'unique', 'pagination', 'tracking', 'likely-duplicate', 'filter-variant', 'essential'

        -- Row ordering (preserves import/crawl order)
        row_order                 INTEGER
      );

      -- Extra columns from imported spreadsheets (dynamic schema)
      CREATE TABLE IF NOT EXISTS page_extra (
        url         TEXT NOT NULL,
        field_name  TEXT NOT NULL,
        field_value TEXT DEFAULT '',
        PRIMARY KEY (url, field_name)
      );

      -- Column definitions for the current project
      CREATE TABLE IF NOT EXISTS columns (
        name        TEXT PRIMARY KEY,
        source      TEXT NOT NULL DEFAULT 'import',  -- 'core', 'import', 'computed', 'crawl'
        display_order INTEGER,
        visible     INTEGER DEFAULT 1
      );

      -- Link graph (for orphan detection, internal linking analysis)
      CREATE TABLE IF NOT EXISTS links (
        source_url  TEXT NOT NULL,
        target_url  TEXT NOT NULL,
        anchor_text TEXT,
        is_internal INTEGER,
        UNIQUE(source_url, target_url)
      );

      -- Sitemaps found during crawl
      CREATE TABLE IF NOT EXISTS sitemaps (
        url         TEXT PRIMARY KEY,
        type        TEXT,
        url_count   INTEGER,
        fetched_at  TEXT
      );

      -- Nav structure (replaces NavStructure sheet)
      CREATE TABLE IF NOT EXISTS nav_nodes (
        id              TEXT PRIMARY KEY,
        number          TEXT,
        parent_number   TEXT,
        label           TEXT,
        path            TEXT,
        sort_id         TEXT,
        computed_path   TEXT,
        breadcrumb      TEXT,
        ref_node_id     TEXT
      );

      -- Project settings (replaces KKE_Settings sheet)
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      -- Computed column definitions
      CREATE TABLE IF NOT EXISTS computed_columns (
        name    TEXT PRIMARY KEY,
        formula TEXT,
        "order" INTEGER
      );

      -- Crawl log (errors, sitemaps, events)
      CREATE TABLE IF NOT EXISTS crawl_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        type        TEXT NOT NULL,    -- 'error', 'sitemap', 'info', 'warning'
        url         TEXT,
        message     TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
      );

      -- Import/export metadata
      CREATE TABLE IF NOT EXISTS file_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        action      TEXT,
        file_path   TEXT,
        row_count   INTEGER,
        created_at  TEXT DEFAULT (datetime('now'))
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_pages_kke ON pages(kke_recommendation);
      CREATE INDEX IF NOT EXISTS idx_pages_discovered ON pages(discovered_via);
      CREATE INDEX IF NOT EXISTS idx_pages_sitemap_orphan ON pages(sitemap_orphan);
      CREATE INDEX IF NOT EXISTS idx_pages_nav_id ON pages(nav_id);
      CREATE INDEX IF NOT EXISTS idx_pages_row_order ON pages(row_order);
      CREATE INDEX IF NOT EXISTS idx_pages_group ON pages("group");
      CREATE INDEX IF NOT EXISTS idx_pages_flagged ON pages(flagged);
      CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_url);
      CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_url);
      CREATE INDEX IF NOT EXISTS idx_page_extra_url ON page_extra(url);
      CREATE INDEX IF NOT EXISTS idx_page_extra_field ON page_extra(field_name);
      CREATE INDEX IF NOT EXISTS idx_columns_order ON columns(display_order);
    `);
  }

  /** Run migrations for databases created by older versions */
  _migrate() {
    // Ensure all tables exist (idempotent due to IF NOT EXISTS)
    this._createSchema();
  }

  // ─── Pages: CRUD ────────────────────────────────────────────────────────────

  // Core page columns that map to the pages table
  static CORE_COLUMNS = new Set([
    'url', 'crawled_at',
    'status_code', 'status', 'content_type', 'reported_content_type',
    'actual_content_type', 'content_type_mismatch', 'response_ms',
    'redirect_url', 'redirect_type', 'redirect_chain', 'last_modified', 'language',
    'indexable', 'indexability_status', 'meta_robots', 'robots_status', 'canonical',
    'title', 'title_length', 'meta_description', 'meta_description_length',
    'h1', 'h2', 'h2_2',
    'word_count', 'sentence_count', 'avg_words_per_sentence',
    'text_ratio', 'flesch_score', 'readability',
    'depth', 'folder_depth', 'parent_url',
    'inlinks', 'unique_inlinks', 'outlinks', 'unique_outlinks', 'external_outlinks',
    'discovered_via', 'sitemap_orphan', 'sitemap_lastmod', 'sitemap_priority',
    'kke_recommendation', 'tags', 'notes', 'group', 'primary_tag',
    'flagged', 'assessed_at', 'assessment_result',
    'nav_id', 'nav_destination', 'computed_path', 'nav_sort_id',
    'redirect_destination',
    'ga4_sessions', 'ga4_pageviews', 'ga4_bounce_rate', 'ga4_avg_engagement_time',
    'ai_assessment', 'ai_assessed_at', 'screenshot_path',
    'query_param_class', 'row_order'
  ]);

  /**
   * Insert or replace a page row. Splits data between `pages` (core columns)
   * and `page_extra` (any additional imported columns).
   */
  insertPage(data) {
    const core = {};
    const extra = {};
    for (const [key, val] of Object.entries(data)) {
      if (DataStore.CORE_COLUMNS.has(key)) {
        core[key] = val;
      } else {
        extra[key] = val;
      }
    }

    if (!core.url) throw new Error('Page must have a url');

    const cols = Object.keys(core);
    const placeholders = cols.map(() => '?').join(', ');
    const colNames = cols.map(c => c === 'group' ? '"group"' : c).join(', ');
    const values = cols.map(c => core[c] ?? null);

    this.db.prepare(
      `INSERT OR REPLACE INTO pages (${colNames}) VALUES (${placeholders})`
    ).run(...values);

    // Insert extra columns
    if (Object.keys(extra).length > 0) {
      const stmt = this.db.prepare(
        'INSERT OR REPLACE INTO page_extra (url, field_name, field_value) VALUES (?, ?, ?)'
      );
      for (const [field, val] of Object.entries(extra)) {
        stmt.run(core.url, field, val ?? '');
      }
    }
  }

  /** Bulk-insert pages in a transaction (much faster) */
  insertPages(rows) {
    const insert = this.db.transaction((rows) => {
      for (const row of rows) {
        this.insertPage(row);
      }
    });
    insert(rows);
  }

  /** Register columns in the columns table */
  registerColumns(names, source = 'import') {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO columns (name, source, display_order) VALUES (?, ?, ?)'
    );
    const txn = this.db.transaction((names) => {
      const maxOrder = this.db.prepare('SELECT MAX(display_order) as m FROM columns').get().m || 0;
      names.forEach((name, i) => {
        stmt.run(name, source, maxOrder + i + 1);
      });
    });
    txn(names);
  }

  /** Get ordered column definitions */
  getColumns() {
    return this.db.prepare('SELECT * FROM columns ORDER BY display_order').all();
  }

  /**
   * Query pages with filtering, sorting, and pagination.
   * Returns { rows, totalCount, filteredCount }.
   *
   * @param {Object} opts
   * @param {string} opts.search - text search across url, title, h1
   * @param {string} opts.kkeFilter - KKE status filter
   * @param {string} opts.groupFilter - group filter
   * @param {string} opts.sortColumn - column to sort by
   * @param {string} opts.sortDirection - 'asc' or 'desc'
   * @param {number} opts.limit - rows per page
   * @param {number} opts.offset - starting row
   * @param {string[]} opts.extraFields - extra field names to include
   */
  getPages(opts = {}) {
    const {
      search = '',
      kkeFilter = '',
      groupFilter = '',
      discoveredVia = '',
      sitemapOrphan = null,
      sortColumn = 'row_order',
      sortDirection = 'asc',
      limit = 100,
      offset = 0,
      extraFields = []
    } = opts;

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(p.url LIKE ? OR p.title LIKE ? OR p.h1 LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (kkeFilter === 'unreviewed') {
      conditions.push("(p.kke_recommendation IS NULL OR p.kke_recommendation = '')");
    } else if (kkeFilter === 'reviewed') {
      conditions.push("(p.kke_recommendation IS NOT NULL AND p.kke_recommendation != '')");
    } else if (kkeFilter === 'flagged') {
      conditions.push('p.flagged = 1');
    } else if (kkeFilter === 'keep+evolve') {
      conditions.push("p.kke_recommendation IN ('Keep', 'Evolve')");
    } else if (kkeFilter) {
      conditions.push('p.kke_recommendation = ?');
      params.push(kkeFilter);
    }

    if (groupFilter) {
      conditions.push('p."group" = ?');
      params.push(groupFilter);
    }

    if (discoveredVia) {
      conditions.push('p.discovered_via = ?');
      params.push(discoveredVia);
    }

    if (sitemapOrphan !== null) {
      conditions.push('p.sitemap_orphan = ?');
      params.push(sitemapOrphan ? 1 : 0);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Validate sort column (prevent SQL injection)
    const allowedSortCols = new Set([...DataStore.CORE_COLUMNS, 'row_order']);
    const safeSort = allowedSortCols.has(sortColumn) ? sortColumn : 'row_order';
    const safeSortCol = safeSort === 'group' ? '"group"' : safeSort;
    const safeDir = sortDirection === 'desc' ? 'DESC' : 'ASC';

    // Total count (unfiltered)
    const totalCount = this.db.prepare('SELECT COUNT(*) as c FROM pages').get().c;

    // Filtered count
    const filteredCount = this.db.prepare(
      `SELECT COUNT(*) as c FROM pages p ${where}`
    ).get(...params).c;

    // Fetch rows
    const rows = this.db.prepare(
      `SELECT p.* FROM pages p ${where} ORDER BY ${safeSortCol} ${safeDir} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    // Fetch extra fields for these rows if requested
    if (extraFields.length > 0 && rows.length > 0) {
      const urls = rows.map(r => r.url);
      const placeholders = urls.map(() => '?').join(',');
      const fieldPlaceholders = extraFields.map(() => '?').join(',');
      const extras = this.db.prepare(
        `SELECT url, field_name, field_value FROM page_extra
         WHERE url IN (${placeholders}) AND field_name IN (${fieldPlaceholders})`
      ).all(...urls, ...extraFields);

      // Build lookup
      const extraMap = {};
      for (const e of extras) {
        if (!extraMap[e.url]) extraMap[e.url] = {};
        extraMap[e.url][e.field_name] = e.field_value;
      }

      // Merge into rows
      for (const row of rows) {
        const ex = extraMap[row.url] || {};
        for (const f of extraFields) {
          row[f] = ex[f] ?? '';
        }
      }
    }

    return { rows, totalCount, filteredCount };
  }

  /** Get a single page by URL, including extra fields */
  getPage(url) {
    const page = this.db.prepare('SELECT * FROM pages WHERE url = ?').get(url);
    if (!page) return null;

    const extras = this.db.prepare(
      'SELECT field_name, field_value FROM page_extra WHERE url = ?'
    ).all(url);
    for (const e of extras) {
      page[e.field_name] = e.field_value;
    }
    return page;
  }

  /** Update specific fields on a page */
  updatePage(url, updates) {
    const core = {};
    const extra = {};
    for (const [key, val] of Object.entries(updates)) {
      if (DataStore.CORE_COLUMNS.has(key)) {
        core[key] = val;
      } else {
        extra[key] = val;
      }
    }

    if (Object.keys(core).length > 0) {
      const sets = Object.keys(core).map(c => {
        const col = c === 'group' ? '"group"' : c;
        return `${col} = ?`;
      }).join(', ');
      const values = Object.values(core);
      this.db.prepare(`UPDATE pages SET ${sets} WHERE url = ?`).run(...values, url);
    }

    if (Object.keys(extra).length > 0) {
      const stmt = this.db.prepare(
        'INSERT OR REPLACE INTO page_extra (url, field_name, field_value) VALUES (?, ?, ?)'
      );
      for (const [field, val] of Object.entries(extra)) {
        stmt.run(url, field, val ?? '');
      }
    }
  }

  /** Bulk-update a single field on multiple pages */
  bulkUpdateField(urls, field, value) {
    const isCore = DataStore.CORE_COLUMNS.has(field);
    const txn = this.db.transaction(() => {
      if (isCore) {
        const col = field === 'group' ? '"group"' : field;
        const stmt = this.db.prepare(`UPDATE pages SET ${col} = ? WHERE url = ?`);
        for (const url of urls) {
          stmt.run(value, url);
        }
      } else {
        const stmt = this.db.prepare(
          'INSERT OR REPLACE INTO page_extra (url, field_name, field_value) VALUES (?, ?, ?)'
        );
        for (const url of urls) {
          stmt.run(url, field, value);
        }
      }
    });
    txn();
  }

  /** Get all distinct values for a field (for filter dropdowns) */
  getDistinctValues(field) {
    if (DataStore.CORE_COLUMNS.has(field)) {
      const col = field === 'group' ? '"group"' : field;
      return this.db.prepare(
        `SELECT DISTINCT ${col} as val FROM pages WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY ${col}`
      ).all().map(r => r.val);
    } else {
      return this.db.prepare(
        `SELECT DISTINCT field_value as val FROM page_extra WHERE field_name = ? AND field_value != '' ORDER BY field_value`
      ).all(field).map(r => r.val);
    }
  }

  /** Get all URLs (for lookups, matching, etc.) */
  getAllUrls() {
    return this.db.prepare('SELECT url FROM pages ORDER BY row_order').all().map(r => r.url);
  }

  /** Get count summary for KKE statuses */
  getKkeSummary() {
    return this.db.prepare(`
      SELECT kke_recommendation as status, COUNT(*) as count
      FROM pages
      GROUP BY kke_recommendation
      ORDER BY count DESC
    `).all();
  }

  /** Get count summary for groups */
  getGroupSummary() {
    return this.db.prepare(`
      SELECT "group" as name, COUNT(*) as count
      FROM pages
      WHERE "group" IS NOT NULL AND "group" != ''
      GROUP BY "group"
      ORDER BY count DESC
    `).all();
  }

  // ─── Nav Nodes ──────────────────────────────────────────────────────────────

  /** Get all nav nodes, reconstructed as a tree */
  getNavNodes() {
    return this.db.prepare('SELECT * FROM nav_nodes ORDER BY number').all();
  }

  /** Get nav tree as roots with children */
  getNavTree() {
    const nodes = this.getNavNodes();
    const nodeMap = {};
    for (const n of nodes) {
      n.children = [];
      nodeMap[n.number] = n;
    }
    const roots = [];
    for (const n of nodes) {
      if (n.parent_number && nodeMap[n.parent_number]) {
        nodeMap[n.parent_number].children.push(n);
      } else {
        roots.push(n);
      }
    }
    return { roots, nodes };
  }

  /** Replace all nav nodes (full rewrite from nav editor) */
  setNavNodes(nodes) {
    const txn = this.db.transaction(() => {
      this.db.prepare('DELETE FROM nav_nodes').run();
      const stmt = this.db.prepare(`
        INSERT INTO nav_nodes (id, number, parent_number, label, path, sort_id, computed_path, breadcrumb, ref_node_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const n of nodes) {
        stmt.run(
          n.id, n.number, n.parent_number || n.parentNumber || '',
          n.label, n.path || '', n.sort_id || n.sortID || '',
          n.computed_path || n.computedPath || '',
          n.breadcrumb || '', n.ref_node_id || n.refNodeId || ''
        );
      }
    });
    txn();
  }

  // ─── Settings ───────────────────────────────────────────────────────────────

  /** Get all settings as a key/value object */
  getSettings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    return settings;
  }

  /** Set a single setting */
  setSetting(key, value) {
    this.db.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
    ).run(key, value);
  }

  /** Set multiple settings at once */
  setSettings(obj) {
    const txn = this.db.transaction(() => {
      const stmt = this.db.prepare(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
      );
      for (const [key, val] of Object.entries(obj)) {
        stmt.run(key, val ?? '');
      }
    });
    txn();
  }

  // ─── Computed Columns ───────────────────────────────────────────────────────

  /** Get all computed column definitions */
  getComputedColumns() {
    return this.db.prepare('SELECT * FROM computed_columns ORDER BY "order"').all();
  }

  /** Set computed columns (full replace) */
  setComputedColumns(definitions) {
    const txn = this.db.transaction(() => {
      this.db.prepare('DELETE FROM computed_columns').run();
      const stmt = this.db.prepare(
        'INSERT INTO computed_columns (name, formula, "order") VALUES (?, ?, ?)'
      );
      definitions.forEach((def, i) => {
        stmt.run(def.name, def.formula, i);
      });
    });
    txn();
  }

  // ─── Links ──────────────────────────────────────────────────────────────────

  /** Insert a link edge */
  insertLink(sourceUrl, targetUrl, anchorText, isInternal) {
    this.db.prepare(
      'INSERT OR IGNORE INTO links (source_url, target_url, anchor_text, is_internal) VALUES (?, ?, ?, ?)'
    ).run(sourceUrl, targetUrl, anchorText || '', isInternal ? 1 : 0);
  }

  /** Get inlinks for a URL */
  getInlinks(url) {
    return this.db.prepare(
      'SELECT source_url, anchor_text FROM links WHERE target_url = ?'
    ).all(url);
  }

  /** Get outlinks for a URL */
  getOutlinks(url) {
    return this.db.prepare(
      'SELECT target_url, anchor_text FROM links WHERE source_url = ?'
    ).all(url);
  }

  /** Compute and store link counts for all pages from the links table */
  computeLinkCounts() {
    this.db.exec(`
      UPDATE pages SET
        inlinks = (SELECT COUNT(*) FROM links WHERE target_url = pages.url),
        unique_inlinks = (SELECT COUNT(DISTINCT source_url) FROM links WHERE target_url = pages.url),
        outlinks = (SELECT COUNT(*) FROM links WHERE source_url = pages.url),
        unique_outlinks = (SELECT COUNT(DISTINCT target_url) FROM links WHERE source_url = pages.url AND is_internal = 1),
        external_outlinks = (SELECT COUNT(*) FROM links WHERE source_url = pages.url AND is_internal = 0)
    `);
  }

  // ─── Sitemaps ───────────────────────────────────────────────────────────────

  insertSitemap(url, type, urlCount) {
    this.db.prepare(
      `INSERT OR REPLACE INTO sitemaps (url, type, url_count, fetched_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run(url, type, urlCount);
  }

  getSitemaps() {
    return this.db.prepare('SELECT * FROM sitemaps').all();
  }

  // ─── Crawl Log ──────────────────────────────────────────────────────────────

  /** Add an entry to the crawl log */
  addCrawlLog(type, url, message) {
    this.db.prepare(
      'INSERT INTO crawl_log (type, url, message) VALUES (?, ?, ?)'
    ).run(type, url || '', message || '');
  }

  /** Get crawl log entries, newest first */
  getCrawlLog(limit = 500) {
    return this.db.prepare(
      'SELECT * FROM crawl_log ORDER BY id DESC LIMIT ?'
    ).all(limit);
  }

  /** Clear the crawl log */
  clearCrawlLog() {
    this.db.exec('DELETE FROM crawl_log');
  }

  // ─── File History ───────────────────────────────────────────────────────────

  _recordHistory(action, filePath, rowCount) {
    this.db.prepare(
      'INSERT INTO file_history (action, file_path, row_count) VALUES (?, ?, ?)'
    ).run(action, filePath || '', rowCount || 0);
  }

  getHistory() {
    return this.db.prepare(
      'SELECT * FROM file_history ORDER BY created_at DESC'
    ).all();
  }

  // ─── Utility ────────────────────────────────────────────────────────────────

  /** Get total page count */
  getPageCount() {
    return this.db.prepare('SELECT COUNT(*) as c FROM pages').get().c;
  }

  /** Clear all crawl/page data (keeps settings, nav nodes, computed columns) */
  clearPages() {
    this.db.exec(`
      DELETE FROM pages;
      DELETE FROM page_extra;
      DELETE FROM links;
      DELETE FROM sitemaps;
      DELETE FROM columns;
      DELETE FROM crawl_log;
    `);
    this._recordHistory('clear', '', 0);
  }

  /** Get list of all extra field names in use */
  getExtraFieldNames() {
    return this.db.prepare(
      'SELECT DISTINCT field_name FROM page_extra ORDER BY field_name'
    ).all().map(r => r.field_name);
  }

  /** Run a raw SQL query (for debugging / computed columns) */
  rawQuery(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }
}

module.exports = DataStore;
