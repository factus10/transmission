# Winnow salvage (2026-06-10)

Reference material salvaged from the cancelled **Winnow** project (`~/Documents/winnow/`, trashed 2026-06-10) before Transmission's own SQLite persistence layer was built. Winnow was a planned ground-up rewrite (SQLite + built-in crawler + GA4 + AI); the crawler/GA4/AI scope was dropped — too large a target. Only the data-layer work was worth keeping.

**These files are reference, not live code.** Transmission's persistence layer (`project-store.js`) is its own implementation suited to Transmission's document-style data model (arbitrary spreadsheet columns), not Winnow's fixed crawler schema.

| File | What it's good for |
|------|--------------------|
| `datastore.js` | better-sqlite3 patterns: WAL setup, `user_version` migrations, transaction batching, history table, backup |
| `import-service.js` | XLSX → SQLite import; the `HEADER_MAP` of Screaming Frog header names → canonical columns |
| `export-service.js` | The reverse `DB_TO_HEADER` map — useful when building client-facing export profiles |
| `CRAWLER-SCHEMA.md` | Fixed-column `pages` table design (reference only; Transmission stores rows as JSON to preserve arbitrary columns) |
| `CRAWLER-FIELDS.md` | Catalog of crawl fields — useful when mapping alternative crawler exports (see below) |
| `winnow-main.js` | Winnow's main process — DataStore IPC wiring, new/open project dialog flows |
| `package.json` | Dependency versions that worked: better-sqlite3, electron-rebuild script |

## Crawler strategy going forward

Transmission will **not** grow a built-in crawler. Crawl data comes from external tools; Screaming Frog is the primary source. Alternatives to evaluate (tracked in `TEST_PLAN.md`):

- **SiteOne Crawler** — https://github.com/janreges/siteone-crawler — free/open-source, CLI + desktop. Untested as of 2026-06-10. If its export differs from SF's column names, the import header map is where the adaptation happens.
