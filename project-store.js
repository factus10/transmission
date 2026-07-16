// ─── ProjectStore: SQLite persistence for .transmission project files ────────
// A .transmission file is a SQLite database holding everything that previously
// lived in the xlsx workbook: the data rows, headers, nav tree, project
// settings, and the change log. XLSX becomes import/export only.
//
// Design notes:
// - Rows are stored as one JSON object per row (data column), preserving
//   arbitrary spreadsheet columns losslessly. Transmission's data model is
//   "whatever columns the crawl export had, plus our audit columns" — a fixed
//   column schema would fight that.
// - The renderer keeps its in-memory state model; this store is a persistence
//   swap, not a query layer. saveAll() replaces tables in one transaction —
//   even at 50k rows this is far faster than rebuilding a compressed xlsx.
// - Schema is versioned via PRAGMA user_version; bump SCHEMA_VERSION and add
//   a migration step in _migrate() for any future schema change.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCHEMA_VERSION = 1;
const PROJECT_EXT = '.transmission';

class ProjectStore {
  /**
   * @param {{appVersion?: string}} [opts] — the version stamped into each saved
   *   project's meta. Injected rather than read here so this module keeps its
   *   independence from electron (see the design notes above); main.js passes
   *   app.getVersion(), which is the only accessor correct in a packaged build.
   */
  constructor(opts = {}) {
    this.db = null;
    this.filePath = null;
    this.appVersion = opts.appVersion || '';
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /** Create a new .transmission project file (overwrites an existing one). */
  create(filePath) {
    this.close();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // A half-written previous file at this path would confuse open-as-create;
    // the save dialog has already confirmed overwrite intent.
    for (const p of [filePath, filePath + '-wal', filePath + '-shm']) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    this.db = new Database(filePath);
    this.filePath = filePath;
    this._pragmas();
    this._createSchema();
    this._setMeta('createdAt', new Date().toISOString());
    return this;
  }

  /** Open an existing .transmission project file. */
  open(filePath) {
    this.close();
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    this.db = new Database(filePath);
    this.filePath = filePath;
    this._pragmas();
    this._migrate();
    return this;
  }

  close() {
    if (this.db) {
      try { this.db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { /* best effort */ }
      try { this.db.close(); } catch (e) { /* best effort */ }
    }
    this.db = null;
    this.filePath = null;
  }

  get isOpen() { return !!this.db; }

  _pragmas() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');
  }

  _createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS headers (
        pos  INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rows (
        idx  INTEGER PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS nav_nodes (
        idx  INTEGER PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS changelog (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        auditor   TEXT,
        row       INTEGER,
        url       TEXT,
        field     TEXT,
        old_value TEXT,
        new_value TEXT
      );
    `);
    this.db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  _migrate() {
    const v = this.db.pragma('user_version', { simple: true });
    if (v > SCHEMA_VERSION) {
      throw new Error(
        `This project was created by a newer version of Transmission (schema v${v}; this app supports v${SCHEMA_VERSION}). Update the app to open it.`
      );
    }
    if (v < 1) {
      // v0 → v1: file predates versioning (shouldn't happen in practice) —
      // ensure all tables exist.
      this._createSchema();
    }
    // Future migrations: if (v < 2) { ...alter...; }
    this.db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  _setMeta(key, value) {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value == null ? null : String(value));
  }

  _getMeta(key) {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  // ─── Write ──────────────────────────────────────────────────────────────────

  /**
   * Persist the full project state. Mirrors the save-file IPC payload:
   * { headers, rows, allNavNodes?, projectSettings?, changeLog?, sheetName? }
   * Nav nodes and settings are only replaced when provided (same semantics as
   * the xlsx writer: an unchanged nav tree isn't resent by the renderer).
   */
  saveAll({ headers, rows, allNavNodes, projectSettings, changeLog, sheetName }) {
    const db = this.db;
    const insHeader = db.prepare('INSERT INTO headers (pos, name) VALUES (?, ?)');
    const upsertRow = db.prepare(
      'INSERT INTO rows (idx, data) VALUES (?, ?) ON CONFLICT(idx) DO UPDATE SET data = excluded.data'
    );
    const delRow = db.prepare('DELETE FROM rows WHERE idx = ?');
    const insNav = db.prepare('INSERT INTO nav_nodes (idx, data) VALUES (?, ?)');
    const insSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    const insLog = db.prepare(
      'INSERT INTO changelog (timestamp, auditor, row, url, field, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const auditor = os.userInfo().username || '';

    const txn = db.transaction(() => {
      db.exec('DELETE FROM headers;');
      headers.forEach((h, i) => insHeader.run(i, String(h)));

      // Diff against what's already stored instead of a blanket delete+reinsert —
      // at 4k rows a full rewrite re-stringifies/re-writes every row on every
      // autosave even for a single-cell edit. Only rows whose serialized content
      // actually changed hit a write; the rest are untouched.
      const stale = new Map(db.prepare('SELECT idx, data FROM rows').all().map(r => [r.idx, r.data]));
      rows.forEach((r, i) => {
        const json = JSON.stringify(r);
        if (stale.get(i) !== json) upsertRow.run(i, json);
        stale.delete(i);
      });
      for (const idx of stale.keys()) delRow.run(idx); // rows.length shrank

      if (allNavNodes) {
        db.exec('DELETE FROM nav_nodes;');
        allNavNodes.forEach((n, i) => insNav.run(i, JSON.stringify(n)));
      }

      if (projectSettings) {
        db.exec('DELETE FROM settings;');
        for (const [key, value] of Object.entries(projectSettings)) {
          if (value === undefined) continue;
          insSetting.run(key, JSON.stringify(value));
        }
      }

      if (changeLog && changeLog.length > 0) {
        for (const e of changeLog) {
          // Entries imported from an xlsx KKE_ChangeLog carry their own auditor
          // ('' = unknown); entries logged in this session get the current user.
          insLog.run(e.timestamp || '', e.auditor !== undefined ? e.auditor : auditor,
                     e.row ?? null, e.url || '', e.field || '', e.from ?? '', e.to ?? '');
        }
      }

      if (sheetName) this._setMeta('sheetName', sheetName);
      this._setMeta('savedAt', new Date().toISOString());
      this._setMeta('appVersion', this.appVersion);
    });
    txn();
    return { success: true };
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  /** Load the full project. Returns raw stored data (no audit-column post-processing). */
  readAll() {
    const headers = this.db.prepare('SELECT name FROM headers ORDER BY pos').all().map(r => r.name);
    const rows = this.db.prepare('SELECT data FROM rows ORDER BY idx').all().map(r => JSON.parse(r.data));
    const navNodes = this.db.prepare('SELECT data FROM nav_nodes ORDER BY idx').all().map(r => JSON.parse(r.data));
    const projectSettings = {};
    for (const { key, value } of this.db.prepare('SELECT key, value FROM settings').all()) {
      try { projectSettings[key] = JSON.parse(value); } catch (e) { projectSettings[key] = value; }
    }
    return {
      headers,
      rows,
      navNodes,
      projectSettings,
      sheetName: this._getMeta('sheetName') || 'Data'
    };
  }

  /** Full change log, oldest first — for xlsx export round-trips. */
  readChangeLog() {
    return this.db.prepare('SELECT timestamp, auditor, row, url, field, old_value, new_value FROM changelog ORDER BY id').all()
      .map(e => ({ timestamp: e.timestamp, auditor: e.auditor, row: e.row, url: e.url, field: e.field, from: e.old_value, to: e.new_value }));
  }

  /** Fold the WAL into the main DB file so it's a complete standalone snapshot
   *  (used before zipping for handoff). Safe to call while the DB stays open. */
  checkpoint() {
    if (this.db) this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  // ─── Backup ─────────────────────────────────────────────────────────────────

  /**
   * Rolling single backup into destDir (async, fire-and-forget safe).
   * Uses SQLite's online backup API, so it's consistent even mid-session.
   */
  backupTo(destDir) {
    if (!this.db) return Promise.resolve(null);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, path.basename(this.filePath) + '.backup');
    return this.db.backup(dest).then(() => dest);
  }
}

module.exports = { ProjectStore, PROJECT_EXT, SCHEMA_VERSION };
