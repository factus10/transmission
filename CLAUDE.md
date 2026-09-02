# CLAUDE.md — Excel Browser

Electron app for macOS (universal ARM + Intel). Designed primarily for **Screaming Frog crawl exports** (`.xlsx`). Shows rows in a left sidebar, loads each row's URL in an embedded webview, and provides a persistent **field bar above the browser** for reading metadata and recording content audit decisions.

---

## Commands

```bash
npm install          # first-time setup (postinstall runs electron-rebuild for better-sqlite3)
npm run rebuild      # rebuild better-sqlite3 against Electron (after Electron version bumps)
npm test             # unit tests (node:test, no deps) — see docs/dev/TESTING.md
npm run dev          # run with DevTools open
npm start            # run normally
npm run build        # universal .dmg → dist/
npm run build:arm    # Apple Silicon only
npm run build:intel  # Intel only
```

---

## Layout

```
┌─ titlebar (file name, save status, [?]) ──────────────────────┐
├─ view switcher  [Audit] [Table] [Sitemap] [Redirects] ──────┤
├─ sidebar ──┬─ main panel ──────────────────────────────────── ┤
│            │  ┌─ field-bar-top ──────────────────────────── ┐ │
│  row list  │  │  [← 3/47 →]  [meta fields...]          [⚙] │ │
│  (with N/R │  ├─ field-bar-audit ───────────────────────── ┤ │
│  indicators│  │  [KKE ▼]  [Tags: chip chip +]  [Notes]    │ │
│  & KKE     │  ├─ webview-toolbar ──────────────────────── ┤  │
│   badges)  │  │  [←][→][↺] [url bar] [↗]                  │ │
│            │  └─ webview ─────────────────────────────── ┘  │
└────────────┴───────────────────────────────────────────────── ┘
```

Note: **Table View** (Cmd+T), **Sitemap** (Cmd+Shift+T), and **Redirect Editor** (Cmd+Shift+R) all hide the sidebar and go full-width. The `.tv-active` class on `#app` controls this layout switch and is used by all three views.

**View switcher** (`#view-switcher`) sits between the OS titlebar and the app shell. Always visible. Five tabs: Audit · Table · Sitemap · Redirects · Menus. `setupViewSwitcher()` wires the clicks; `refreshViewSwitcher()` keeps the active state in sync with the underlying `_tableViewOpen` / `_navEditorOpen` / `_redirectEditorOpen` / `_menusViewOpen` flags and is called from each view's open/close functions. The four full-panel views (Table/Sitemap/Redirects/Menus) no longer carry their own **"Back to Audit"** buttons — they were vestigial once the view switcher became always-visible (its Audit tab is the way back). The `close*`/`returnToAuditView` functions remain (called by the switcher and menus); only the per-view button + its wiring were removed.

**Menu organization (post-reorg):**
- **App menu (macOS) / File (Win/Linux)** — Preferences (Cmd+,)
- **File** — Open · Open Recent · Save · Save As Project… (Cmd+Shift+S) · Import/Merge · Merge Auditor · Save/Load Template · Export… (unified dialog `openUnifiedExportDialog()`) · Export Full Workbook (.xlsx)… · Package for Handoff…
- **Edit** — standard
- **View** — Audit (Cmd+1) · Table (Cmd+T) · Sitemap (Cmd+Shift+T) · Redirects (Cmd+Shift+R) · Menus (Cmd+Shift+M) · Audit Progress (Cmd+P) · zoom · fullscreen · (dev items in source builds)
- **Project** — Project Settings · Triage Non-200 Pages · Triage URL Variants · Create Sitemap from Audit · Glossary · Audience Library · Fill Audiences from Section · Suggest Audiences with AI · Content Type Registry · Target Spec Library · Component Library · AI Suggest for Unreviewed · Run Rubric · Refresh GA KKE · Recompute Suggested KKE
- **Migration** — Pre-Handoff Check · Migration Tracker · Export Redirect Map (CSV) · Redirect Chain Check · Redirect Health Check
- **Reports** — Executive Summary · Content Inventory by Section · SME Review Status · Menu Report · Sitemap Coverage Report · Component Inventory · Content Type Crosswalk · Audience Coverage · Audience × Section Matrix · Audience Debt · Site Consolidation Overview · Cross-Site Duplicate Overlap · Migration Direction Brief · Migration Checklist · Net New Content Brief · Redirect Map Report
- **SME** — Export / Import / Compare KKE vs SME / Resolve
- **Help** — Getting Started · Product Tour · Keyboard Shortcuts · Transmission Help · Online Documentation (`DOCS_SITE_URL` → the published docs site, opened in the system browser via `openDocsSite()`; gated by `isTrustedUpdateUrl`) · Check for Updates…

Platform-conditional Preferences placement: `process.platform === 'darwin'` → app menu; otherwise → File menu. `buildMenu()` uses a `send(channel)` factory to reduce boilerplate.

The unified Export dialog (`File → Export…`, Cmd+Shift+E) opens via `menu-export-dialog` and offers five destinations: Filtered Rows (xlsx) · Audit Decisions (CSV/JSON) · Redirect Map (CSV) · Migration Tracker (xlsx multi-sheet) · Client Export (column profiles, xlsx).

**Removed in Chunk iii:** the `Tree` and `Redirects` buttons that lived in the audit bar's Decide cluster. Those views are now reached via the view switcher. Lingering references to `#btn-navtree` / `#btn-redirects` in renderer code are null-safe.

The **sidebar KKE filter** is a checkbox dropdown (replaces the old single-select). Multiple statuses can be checked simultaneously; all checked items are OR'd. The button label updates dynamically. Saved filters store an array of checked values; backward compatible with old string filter values.

The **sidebar toolbar** is two rows: Row 1 is a full-width search input with clear button. Row 2 has the KKE filter dropdown, Group filter, row count, and Saved filters dropdown. The "+" save button (`btn-save-filter`) is hidden; instead, "+ Save current filter..." is the last option in the saved filters dropdown (same pattern as groups).

**Search scope selector** (`#search-scope`): a `<select>` attached to the left side of `#search-input` inside `#search-wrap`. Options: "All fields" / "URL" / "Title". `applyFilter()` reads its value: `url` → matches only `row[state.urlColumn]`; `title` → matches only `row['Title 1']` (with `'Title'` fallback); `all` → the existing `Object.values(row).some(...)` behavior. A `change` listener on `#search-scope` updates `els.searchInput.placeholder` and re-runs `applyFilter()` when `state.filterText` is non-empty. The select is enabled alongside `#search-input` when a file is open.

**Extra KKE columns** in the sidebar: A "+" button in the column header strip lets users add extra KKE-type columns (SME Decision, Final KKE, etc.) as badge columns in sidebar rows. Stored in `state.extraKkeCols` and persisted in prefs. A gear icon next to "KKE" opens App Settings for column mapping. URL cells in sidebar rows are horizontally scrollable on hover.

---

## File structure

```
main.js          — Main process: file I/O, IPC, menus, prefs
project-store.js — SQLite persistence for .transmission project files (better-sqlite3)
miro.js          — Miro integration: encrypted token storage, REST client, sitemap exporter
server/miro-auth — Cloudflare Worker holding the Miro client secret (OAuth code→token exchange)
preload.js       — contextBridge: exposes window.electronAPI
src/
  index.html     — DOM structure (no inline scripts/styles)
  help.html      — Help window (separate BrowserWindow)
  renderer.js    — All UI logic (no Node APIs)
  sitemap-layout.js — Pure box-tree geometry + colour/style resolution, shared by the webview engine AND host-side callers (the Miro exporter). Loaded BEFORE sitemap-template.js.
  sitemap-template.js — Visual Sitemap engine: window.SitemapTemplate.build(data) → standalone HTML (app/client/print). Loaded before renderer.js.
  treemap-template.js — Treemap engine: window.TreemapTemplate.build(data) → standalone HTML (same three modes).
  sankey-template.js — Content Flow engine: window.SankeyTemplate.build(data) → standalone HTML (same three modes). Current site → new sitemap, as a Sankey.
  styles.css     — All styling via CSS custom properties
assets/
  icon.icns      — App icon (provide before building)
package.json     — Dependencies + Electron Builder config
```

---

## Project files (.transmission)

A `.transmission` file is a **SQLite database** (better-sqlite3, WAL mode) that replaces xlsx as the working format. XLSX remains import/export only. `ProjectStore` in `project-store.js` is the only module that touches the DB.

- **Schema v1** (versioned via `PRAGMA user_version`; bump `SCHEMA_VERSION` + add a `_migrate()` step for changes): `meta` (key/value: sheetName, createdAt, savedAt), `headers` (pos, name), `rows` (idx, JSON per row — preserves arbitrary crawl columns losslessly), `nav_nodes` (idx, JSON per flat node in renderer save shape), `settings` (key, JSON value — the whole `projectSettings` object), `changelog` (timestamp, **auditor** = `os.userInfo().username`, row, url, field, old/new value).
- **The renderer is unchanged architecturally** — `state.editedRows` stays in memory; only persistence is swapped. `save-file` IPC routes by extension: `.transmission` → `projectStore.saveAll()` (one transaction, ~5ms at 4k rows); anything else → legacy `writeWorkbook`. The existing 2s debounced autosave therefore becomes effectively instant for projects.
- **Open** routes through `openAnyPath(filePath)` (open dialog, recents, `get-last-file`, macOS `open-file` event for Finder double-click — `fileAssociations` registered in package.json). `readProject()` loads the DB, then runs the same post-processing as the xlsx path via shared helpers `computeColumnMap()` + `injectAndOrderAuditColumns()` (extracted from `readWorkbook`) — so audit columns added by app updates get injected into old projects on open. The nav tree is rebuilt by `navTreeFromFlatNodes()`, which renders the flat nodes into an in-memory sheet and feeds the real `parseNavSheet()` (identical tree semantics, zero duplicated logic).
- **File → Save As Project…** (Cmd+Shift+S, `menu-save-as-project` → renderer `saveAsProject()` → `save-as-project` IPC) converts the open spreadsheet + in-session edits into a project and switches the session to it. This is the migration path: "open spreadsheet → Save As Project."
- **File → Export Full Workbook (.xlsx)…** (`menu-export-workbook` → `exportFullWorkbook()` → `export-workbook` IPC) writes a complete xlsx (data + all structural sheets) to a chosen path. For projects it exports the **full** changelog from the DB with `opts.replaceChangeLog` so re-exports don't duplicate entries. The from-scratch Sitemap branch in `writeWorkbook` now writes the full column set (Notes/Phase/Node_Type/build metadata), since projects always export from scratch (`navSheetInfo = null`).
- **Safety:** `before-quit` checkpoints + closes the DB (no stale `-wal`/`-shm` sidecars); a rolling backup per project is written to `userData/backups/` on open via SQLite's online backup API. Opening a project created by a newer schema version fails with a clear "update the app" error.
- `buildSavePayload({ fullNav, drainLog })` in renderer.js builds the save/export payload; `fullNav` forces the complete nav tree (Save As Project, exports), `drainLog:false` leaves `_sessionChangeLog` intact (exports). Failed saves restore drained changelog entries.
- **Export profiles:** `openProfileExportDialog()` (unified Export dialog → "Client Export") exports a chosen column subset over filtered/all rows via the generic `export-migration-tracker` IPC (which accepts an optional `title`). Built-ins (`builtinExportProfiles()`: Client Summary, Full) are computed from current headers; user profiles persist in `projectSettings.exportProfiles` = `[{name, columns}]` (travels with the project).
- **Package for Handoff:** File → Package for Handoff… (`menu-package-handoff` → renderer `packageForHandoff()` saves if dirty → `package-handoff` IPC). Main checkpoints the WAL (`ProjectStore.checkpoint()`), zips the `.transmission` + a README.txt via JSZip, writes to a chosen path, and reveals in Finder.

---

## Process model

**Main process** (`main.js`) owns:
- All file system access (SheetJS read/write, ExcelJS for SME export, JSZip for xlsx post-processing)
- Visual Sitemap PDF export (`export-sitemap-pdf`): loads a print-mode sitemap HTML in a hidden window and `printToPDF`s it (the live/client sitemap rendering is renderer-side via a `<webview>` — see `src/sitemap-template.js`)
- `prefs.json` in `app.getPath('userData')` — visibleFields + tagLibrary
- Native dialogs and menus
- All `ipcMain.handle()` endpoints

**Renderer** (`src/renderer.js`) owns:
- All DOM and UI state
- Calls `window.electronAPI.*` exclusively — no Node APIs
- Custom `showPrompt(title, placeholder, defaultValue)` → Promise (replaces native `prompt()` which is blocked in Electron)

**Preload** (`preload.js`) is the only bridge via `contextBridge`. New main↔renderer communication always requires changes to both `main.js` AND `preload.js`.

---

## IPC channels

| Direction       | Channel            | Payload / Return                              |
|-----------------|--------------------|-----------------------------------------------|
| renderer → main | `open-file-dialog` | none                                          |
| renderer → main | `get-last-file`    | → `FileData \| null`                          |
| renderer → main | `save-file`        | `{ headers, rows, allNavNodes?, projectSettings? }` → `{ success, error? }` — routes to SQLite for `.transmission`, SheetJS otherwise  |
| renderer → main | `save-as-project`  | same payload as `save-file` (+ full nav) → `{ success, filePath?, error? }` — creates a `.transmission` project, switches session to it |
| renderer → main | `export-workbook`  | same payload as `save-file` (+ full nav) → `{ success, filePath?, error? }` — writes a complete xlsx to a chosen path |
| main → renderer | `menu-save-as-project` | none — File → Save As Project… (Cmd+Shift+S) |
| main → renderer | `menu-export-workbook` | none — File → Export Full Workbook (.xlsx)… |
| renderer → main | `package-handoff`  | none → `{ success, filePath?, error? }` — checkpoint + zip the open project for handoff |
| main → renderer | `menu-package-handoff` | none — File → Package for Handoff… |
| renderer → main | `open-external`    | url string                                    |
| renderer → main | `get-prefs`        | → `{ visibleFields, tagLibrary, autoAdvance, groupLibrary, sidebarWidth, sortOrder, filterText, rubricDir, claudeApiKey, sidebarColumns, customKkeStates, tableColumns, extraKkeCols, kkeFilter, showSmeFields }` |
| renderer → main | `save-prefs`       | `{ ...partial prefs }` — merges into saved prefs |
| main → renderer | `file-opened`      | `FileData`                                    |
| main → renderer | `menu-save`        | none                                          |
| main → renderer | `save-success`     | filePath string                               |
| renderer → main | `export-progress-pdf` | `{ html, defaultName }` → `{ success, filePath?, error? }` |
| main → renderer | `menu-audit-view` | none — switch to default audit view (Cmd+1)   |
| main → renderer | `menu-table-view` | none                                          |
| main → renderer | `menu-nav-tree`  | none — switch to navigation tree (Cmd+Shift+T) |
| main → renderer | `menu-redirect-editor` | none — switch to redirect editor (Cmd+Shift+R) |
| main → renderer | `menu-menus` | none — switch to the Menus view (Cmd+Shift+M) |
| main → renderer | `menu-sme-export` | none                                          |
| main → renderer | `menu-sme-import` | none                                          |
| main → renderer | `menu-sme-resolve` | none                                         |
| renderer → main | `sme-export`       | `{ headers, rows, settings }` → `{ success, filePath?, error? }` — uses ExcelJS for xlsx with data validation |
| renderer → main | `import-audit-merge-open` | none → `{ filePath, sheetNames }` — opens file picker, returns available sheets |
| renderer → main | `import-audit-merge-read-sheet` | `{ filePath, sheetName }` → `{ headers, rows }` — reads a specific sheet for merge |
| renderer → main | `save-audit-template` | `{ config }` → `{ success, filePath?, error? }` — exports audit config as `.kke-template.json` |
| renderer → main | `load-audit-template` | none → `{ success, config?, error? }` — imports a `.kke-template.json` file |
| renderer → main | `sme-export-multi` | `{ groups }` → `{ success, error? }` — split SME export by Content Owner into separate files |
| main → renderer | `menu-merge-auditor` | none — triggers multi-auditor merge dialog |
| main → renderer | `menu-report-executive-summary` | none — opens Executive Summary report |
| main → renderer | `menu-report-content-inventory` | none — opens Content Inventory by Section report |
| main → renderer | `menu-report-sme-status` | none — opens SME Review Status report |
| main → renderer | `menu-report-redirect-map` | none — opens Redirect Map Report |
| main → renderer | `menu-report-net-new` | none — opens Net New Content Brief |
| main → renderer | `menu-report-migration-checklist` | none — opens Migration Checklist |
| main → renderer | `menu-import-merge` | none — opens import/merge dialog |
| main → renderer | `menu-settings` | none — opens App Settings |
| main → renderer | `menu-project-settings` | none — opens Project Settings |
| main → renderer | `menu-save-template` | none — triggers save audit template |
| main → renderer | `menu-load-template` | none — triggers load audit template |
| main → renderer | `menu-progress` | none — opens progress dashboard |
| main → renderer | `menu-export-redirects` | none — export redirect map CSV |
| main → renderer | `menu-redirect-chain-check` | none — run redirect chain check |
| main → renderer | `menu-redirect-health-check` | none — opens the Redirect Health Check |
| main → renderer | `menu-nav-coverage` | none — run nav coverage report |
| main → renderer | `menu-glossary` | none — opens tag/group glossary editor |
| main → renderer | `menu-content-type-registry` | none — opens ContentTypeRegistry editor |
| main → renderer | `menu-pattern-library` | none — opens PatternLibrary editor |
| main → renderer | `menu-design-pattern-library` | none — opens DesignPatternLibrary editor |
| main → renderer | `menu-report-design-patterns` | none — opens Component Inventory report |
| main → renderer | `menu-report-content-crosswalk` | none — opens Content Type Crosswalk report (`reportContentTypeCrosswalk()`) |
| main → renderer | `menu-ga-kke-refresh` | none — re-runs GA KKE computation with current config |
| main → renderer | `menu-suggested-kke-recompute` | none — recomputes Suggested_KKE orchestrator |
| main → renderer | `menu-rubric-batch` | none — runs rubric assessment on filtered rows |
| main → renderer | `menu-export-migration-tracker` | none — opens Migration Tracker Export dialog |
| main → renderer | `menu-export-dialog` | none — opens unified Export chooser modal |
| renderer → main | `export-migration-tracker` | `{ defaultName, sheets }` → `{ success, filePath?, error? }` — writes multi-sheet xlsx |
| renderer → main | `get-default-content-type-registry` | none → `Array<{contentType, defaultContentNature, defaultMigrationTrack, notes}>` |
| renderer → main | `get-default-pattern-library` | none → `Array<{patternName, description, buildGuidanceDefault, writerBriefDefault, defaultMigrationTrack, notes}>` |
| renderer → main | `get-default-design-pattern-library` | none → `Array<{name, category, complexity, description, dsUrl, aliases, notes}>` — the 57-entry `DEFAULT_DESIGN_PATTERN_LIBRARY` |
| renderer → main | `get-default-audience-library` | `{kind}` → `Array<{name, tier, color, description, notes}>` — one of the `AUDIENCE_STARTER_SETS` (`higher-ed` \| `general`), each with `AUDIENCE_NONE_ENTRY` appended |
| renderer → main | `get-audience-starter-sets` | none → `Array<{kind, label, hint, count}>` — drives the seed chooser |
| main → renderer | `menu-audience-library` | none — opens Project Settings on the Audience tab |
| main → renderer | `menu-audience-inherit` | none — opens Fill Audiences from Section |
| main → renderer | `menu-audience-ai` | none — opens Suggest Audiences with AI (or the review queue when one is pending) |
| renderer → main | `get-claude-models` | none → `Array<{id, label, hint, effort}>` — the model picker's single source of truth |
| renderer → main | `suggest-audiences-llm` | `{pages, audiences, jobs, apiKey, model}` → `{results[], usage} \| {error}` — one batched, schema-constrained audience-tagging request |
| main → renderer | `menu-report-audience-coverage` | none — opens the Audience Coverage report |
| main → renderer | `menu-report-audience-matrix` | none — opens the Audience × Section Matrix report |
| main → renderer | `menu-report-audience-debt` | none — opens the Audience Debt report |
| main → renderer | `menu-report-jobs-coverage` | none — opens the Jobs Coverage report |
| main → renderer | `menu-report-site-consolidation` | none — opens the Site Consolidation Overview |
| main → renderer | `menu-report-cross-site-dupes` | none — opens the Cross-Site Duplicate Overlap report |
| renderer → main | `export-redirects-multi` | `{files:[{fileName, rows}]}` → `{success, dir?, files?, count?, error?}` — folder picker, one redirect CSV per source site (mirrors `sme-export-multi`) |
| renderer → main | `export-report-html` | `{ html, defaultName }` → `{ success, filePath?, error? }` — saves HTML report file |
| renderer → main | `export-sitemap-pdf` | `{ html, defaultName }` → `{ success, filePath?, error? }` — loads a print-mode sitemap HTML (from `SitemapTemplate.build`) in a hidden window, waits for `document.title==='READY'`, then `printToPDF({ preferCSSPageSize:true })` to one page sized to the tree |
| renderer → main | `export-viz-png` | `{ html, defaultName }` → `{ success, filePath?, error? }` — same hidden-window print-mode HTML, screenshotted instead of printed (`capturePage`); sizes the window to `window.__EXPORT_SIZE__` and re-fits if the OS clamps it |
| main → renderer | `menu-non200-triage` | none — opens non-200 triage dialog |
| main → renderer | `menu-url-variant-triage` | none — opens the URL Variant Triage dialog |
| main → renderer | `menu-create-sitemap-from-audit` | none — opens the Create Sitemap from Audit dialog |
| renderer → main | `check-for-updates` | none → `{ available, current, latest, notes, changelogUrl, downloadUrl, publishedAt } \| { error }` — fetches `update-manifest.json` and compares to `app.getVersion()` |
| renderer → main | `open-changelog-window` | url string — opens the changelog URL in a small internal `BrowserWindow` (rejects untrusted hosts; loaded with `Cache-Control: no-cache`, since Pages serves the page with `max-age=600` and a cached copy would show the *previous* release to someone who just got an update prompt) |
| main → renderer | `menu-check-updates` | none — Help → Check for Updates… |
| renderer → main | `miro-status`      | none → `{ hasToken, encryptionAvailable, connectAvailable }` |
| renderer → main | `miro-connect`     | none → `{ success, teamId?, scope?, expiring?, error? }` — opens the browser, polls the auth worker, stores the token in main |
| renderer → main | `miro-cancel-connect` | none — aborts an in-flight connect |
| renderer → main | `miro-set-token`   | token string → `{ success, error? }` — the paste fallback |
| renderer → main | `miro-clear-token` | none → `{ success }` |
| renderer → main | `miro-test-connection` | none → `{ success, boards[], total, error? }` — delegates to `searchBoards({limit:50})`; the lightweight "is the token alive" probe |
| renderer → main | `miro-search-boards` | `{ query?, limit?, offset?, sort? }` → `{ success, boards[], total, offset, limit, error? }` — **server-side** board search (name/description via Miro's `query`, paged via `offset`); the workable path when a token sees thousands of boards. Each board carries `modifiedAt` for recency display |
| renderer → main | `miro-get-board` | `{ boardId }` → `{ success, board?, error? }` — resolves one board by id: used for a pasted board link AND to re-read a remembered board's *current* name before offering a re-export (rename-safe) |
| renderer → main | `miro-token-info`  | none → `{ success, type, scopes[], team, organization, user, error? }` — answers "connected but I see no boards" (wrong team) |
| renderer → main | `miro-create-board` | `{ name, description }` → `{ success, board?, error? }` |
| renderer → main | `miro-create-frame` / `miro-create-items-bulk` / `miro-create-connector` / `miro-list-items` | board-writing primitives used by the exporter |
| renderer → main | `miro-delete-board` | `{ boardId }` → `{ success, error? }` — deletes a whole board (Miro moves it to the team's trash). Requires an explicit id; **confirms nothing itself** — the caller must ask the user first, since only the renderer knows which board and what's on it. Caller: the export-result toast's **Delete board** action |
| renderer → main | `miro-probe-write` | `{ boardId }` → creates one off-palette shape, reports what Miro stored, deletes it — proves `boards:write` (which `miro-test-connection` cannot) |
| renderer → main | `miro-export-sitemap` | `{ boardId, plan }` → `{ success, frameId, shapes, connectors, edgeFailures, skippedEdges, error? }` |
| renderer → main | `miro-cancel-export` | none → `{ success }` |
| main → renderer | `miro-export-progress` | `{ phase, done, total }` — pushed during export; a 400-node board takes ~a minute and silence reads as a hang |
| main → renderer | `update-check-result` | update-check result object — pushed once, ~3s after launch, only when `available` is true |

`FileData` = `{ filePath, headers, rows, urlColumn, navTree?, projectSettings? }`

---

## State object (renderer.js)

```js
{
  filePath:      null,       // absolute path to open file
  headers:       [],         // all column names (audit cols appended if missing)
  rows:          [],         // original rows — never mutated
  editedRows:    [],         // deep-cloned working copy — all edits go here
  urlColumn:     null,       // auto-detected header for URL (default: 'Address')
  selectedIndex: null,       // origIndex of selected row in editedRows
  filteredRows:  [],         // [{ row, origIndex }] after search filter
  filterText:    '',
  isDirty:       false,

  visibleFields: [],         // headers shown in field-bar-top (from prefs)
  tagLibrary:    [],         // full vocabulary of available tags (from prefs)
  groupLibrary:  [],         // global group vocabulary (from prefs)
  pageTypeLibrary: [],       // global page-type vocabulary (from prefs, seeded with defaults on first run)
  contentThemeLibrary: [],   // per-project content-theme vocabulary (mirrors state.projectSettings.contentThemeLibrary)
  fieldFilters:  [],         // active arbitrary-field filters: [{field, operator, value}]

  pickerVisible:   [],       // working copy during field picker editing
  pickerSelected:  { available: null, visible: null },

  navTreeDirty:  false,      // true when nav editor has unsaved changes
  projectSettings: {},       // key/value pairs from KKE_Settings sheet (includes savedFilters, contentThemeLibrary, glossary, gaKkeConfig)
  navFoldState:  {},         // nodeId → boolean, persists fold across re-renders
  tableColumns:  [],         // column config for Table View (persisted in prefs)
  extraKkeCols:  [],         // extra KKE-type columns shown as badge columns in sidebar rows (persisted in prefs)
  showSmeFields: false,      // whether SME Decision / Final KKE / Content Owner are visible in audit bar (persisted in prefs)
  showMigrationFields: false,// whether Content_Nature / Migration_Track are visible in audit bar (persisted in prefs)
  showDesignPatterns: false, // whether Design Patterns cluster is visible in audit bar (persisted in prefs)
  showAudienceFields: false, // whether the Audience cluster is visible (prefs; auto-reveals once a library exists)
  audienceLibrary: [],       // per-project { name, tier, color, description, notes }[]; Audiences sheet + projectSettings
  siteLibrary: [],           // per-project { label, hosts[], cms, owner, inScope, color, notes }[]; Sites sheet + projectSettings
  jobLibrary: [],            // per-project { label, statement, audiences[], notes }[]; Jobs sheet + projectSettings
  hideBlankMetadata: true,   // whether blank read-only meta fields are hidden in field-bar-top (persisted in prefs)
  collapsedClusters: {},     // per-cluster collapsed state {decide, classify, tag, review, migrate, cms, patterns} (persisted in prefs)
  pageStatusLibrary: [],     // Phase 2 — { name, color }[] per-project Page_Status vocabulary
  assigneeLibrary: [],       // Phase 2 — string[] per-project assignee names (unified pool for builder + writer)
  patternLibrary: [],        // Phase 2 — per-project page patterns; structural sheet PatternLibrary
  designPatternLibrary: [],  // per-project UI/design patterns { name, category, complexity, description, dsUrl, aliases, notes }[]; structural sheet DesignPatternLibrary
}
```

**Not on `state` — module-level variables in renderer.js.** These three are plain
module-scope bindings, *not* keys on `state`. `state` is a plain object with no
guard, so `state._sessionChangeLog.push(…)` would throw on undefined (or, if you
initialized it first, silently write to a dead property that nothing reads or
persists). Always use the bare name:

| Variable | Where | What |
|----------|-------|------|
| `_sessionChangeLog` | `const`, renderer.js:119 | Audit-trail entries `[{timestamp, row, url, field, from, to}]`. Written by `logChange()`; drained into the save payload by `buildSavePayload()`. |
| `_globalSearchMatches` | `let`, renderer.js:1281 | Cmd+F matches — `[{origIndex, row}]` in audit view; `[{nodeId}]` when the Sitemap is open. |
| `_globalSearchCurrent` | `let`, renderer.js:1282 | Index into `_globalSearchMatches` for the current match. |

Column mapping entries in `state.columnMap` include: `smeDecision`, `smeNotes`, `contentOwner`, `finalKke` (in addition to existing mappings).

**Column mapping persistence:** `computeColumnMap(headers, filePath, projectMap)` resolves per key: `projectSettings.columnMap` (file-level — travels with the project/workbook between auditors) > `prefs.columnMappings[basename]` (per-user, legacy) > auto-detect; saved names are honored only if still present in headers. Applying a mapping in App Settings writes BOTH tiers and saves the file before reloading (so the reload can't discard unsaved edits).

`state.projectSettings.glossary` = `{ tags: { name: markdownNotes }, groups: { name: markdownNotes } }` — persisted in the `KKE_Glossary` sheet.

`state.projectSettings.contentThemeLibrary` = array of theme strings — persisted in the `KKE_Settings` sheet as JSON.

`state.projectSettings.savedFilters` = array of `{name, filterText, kkeFilter, groupFilter, fieldFilters}` — persisted in `KKE_Settings`. Field filters travel with saved filter combos.

`state.projectSettings.gaKkeConfig` = `{ columnMap: {sessions, engagementRate, avgSessionDuration, viewsPerSession}, weights: {...}, thresholds: {keep, evolve}, missingPolicy: 'skip'|'zero', computedAt: ISO, lastRun: {computed, skipped, total} }` — or `{ dismissed: true }` if the user declined setup. Serialized into `KKE_Settings` sheet as JSON under `gaKkeConfig`.

**Nav node objects** (`state.navNodes`) include extension fields: `refNodeId` (alias to another node), `inMenu` ('Y' / '' — **legacy**: round-tripped but no longer edited in the UI; its controls were repurposed to `collapse`), `collapse` ('Y' / '' — collapse this node's subtree in the Visual Sitemap), `url` (external URL), `urlOverride` (URL-path override — see below), `breadcrumbParentId` (breadcrumb re-root — see below), `notes` (markdown), `phase` ('Future' / 'Stretch' / 'Archived' / custom / ''). Each is read from / written to a column on the Sitemap sheet (added on save if missing).

**URL override (decouples URL from hierarchy):** `node.urlOverride` (Sitemap `Url_Path` column) lets a page's URL diverge from where it sits in the menu. The IA — tree position, breadcrumb (labels), sortID, page counts — is unaffected; only `computedPath` (the URL) changes. `recalcDerivedFields()` builds `computedPath` via `computeNodeUrlPath(node)`: a node's own (normalized) override IS its path verbatim; otherwise it climbs ancestors collecting slugs **until the nearest ancestor override**, which becomes the new root and **re-roots the whole subtree** below it (descendants append their slugs to the override base). With no overrides in the chain this is identical to the old ancestor-slug join. Because every downstream URL consumer (redirects, `effectiveConsolidateUrl`, Migration Tracker target, URL-change detection, `cascadeNavChangesToRows`) reads `computedPath`, no consumer needed changes — only the derivation did. `normalizeUrlOverride(s)` strips leading/trailing slashes so overrides match the stored no-leading-slash convention. Edited in the modal node editor (`#_nne-urlpath`, routed through `onNavNodeEdit('urlOverride', …)` so the subtree recalcs and assigned-page URLs cascade); the tree path cell prefixes an overridden path with `↪` in accent color; the nav stats bar tallies `N URL overrides`. Round-trips in both xlsx (`Url_Path` column) and `.transmission` (flat-node JSON via `NAV_HEADER_TO_KEY`).

**Breadcrumb override (decouples the on-page breadcrumb from hierarchy):** `node.breadcrumbParentId` (Sitemap `Breadcrumb_Parent` column) sets an **arbitrary breadcrumb top**, independent of both physical containment AND the URL. `node.breadcrumb` stays the full physical label chain (IA context / row `Sitemap_Destination`); the *page* breadcrumb is computed live by `computePageBreadcrumbLabels(node)` / `pageBreadcrumbOf(node)`, which walk the breadcrumb-parent chain: `''` = inherit the physical parent (default), `'__root__'` (`BREADCRUMB_ROOT`) = the trail starts here, `<nodeId>` = re-root onto that node (continuing up *its* chain). The walk is cycle-safe (visited Set) and falls back to the physical parent if a `breadcrumbParentId` dangles. Descendants inherit the re-root automatically (they hit the override while climbing), so you only set it at the re-root point. Two **optional per-project cosmetics** in `projectSettings` (Project Settings → Identity): `breadcrumbHomeLabel` (prepended to every trail unless already the first crumb) and `breadcrumbMaxDepth` (advisory — `breadcrumbExceedsCap()` flags longer trails; never enforced). This is **display-only** — it does NOT affect `computedPath`, rows, or menus — so the editor select (`#_nne-bcparent`: inherit / root / pick-a-node via the reused `showMenuNodePicker`) commits the value directly in `commitEdits` (no cascade). Tree breadcrumb cell marks overrides with `↰` (accent) and over-cap with `⚠` (red); stats bar tallies `N breadcrumb overrides` / `⚠ N over depth`. `hasBreadcrumbOverride()` is the predicate. Round-trips in xlsx (`Breadcrumb_Parent` column) and `.transmission`.

**Phase 2, Chunk α — nav node build/write metadata:** nav nodes carry build + write annotations for the migration delivery deliverable. Six new fields, read/written via Sitemap columns (auto-added on save):
- `buildPattern` — selected pattern name (free-text for α; library lands in β)
- `buildGuidance` — markdown notes for the page builder
- `writerBrief` — markdown notes for the content writer
- `pageStatus` — controlled vocab from `state.pageStatusLibrary` (per-project, seeded with `DEFAULT_PAGE_STATUSES`)
- `buildAssignee` — controlled vocab from `state.assigneeLibrary` (per-project, starts empty)
- `writeAssignee` — same library as `buildAssignee` (unified pool)
- `migrateAssignee` — same library; the **Migrator** role (Sitemap `Migrate_Assignee` column). Owns mapping source content into the new CMS; the mapping reference itself lives on the target spec, not per node. Surfaced in the Migrate section of the node editor, the build filter, assignee usage/cascade, the Migration Tracker Sitemap Plan column, and the Migration Direction Brief report.

**Libraries persisted in `projectSettings`:**
- `pageStatusLibrary` = `[{ name, color }]` — seeded on first open with 6 defaults (Not Started, In Progress, Built, In Review, Published, Blocked); user can add inline via `+ New…` (auto-colored from `PAGE_STATUS_AUTO_COLORS` cycle).
- `assigneeLibrary` = `string[]` — alphabetically sorted; inline `+ New…` adds + persists. Unified pool for all three roles (builder / writer / migrator). `computeAssigneeUsage()` returns `{build, write, migrate}` per name; rename/delete cascade across all three node fields.

**`openNavNodeEditor()`** is structured as a stack of labeled, color-pilled blocks (the `.nne-section` / `.nne-section-header` / `.nne-section-pill` pattern) so the long form is scannable rather than a flat field list: a tinted read-only **Context** panel (`.nne-context-panel` — Parent / Breadcrumb / Computed Path / Page breadcrumb), then **Identity** (slate pill — Label, Slug, Collapse, Node type `#_nne-node-type` Page/Header/Fragment with live `#_nne-node-type-hint`, Phase), **Addressing & breadcrumb** (teal pill — External URL, URL override, Breadcrumb parent, Reference), **Notes** (gray pill — "Migration notes"), then **Build** (blue — pattern + status + builder + guidance), **Write** (violet — writer + brief), and **Migrate** (amber — migrator assignee `#_nne-massignee`; the mapping reference itself lives on the target spec, not the node). Section pills use inline hex backgrounds (matching the existing Build/Write/Migrate pills). Inline-add behavior implemented via the reusable `buildInlineAddSelect({ wrapEl, selectId, options, currentValue, placeholder, newPromptTitle, onNewValue, decorator })` helper. The `decorator` callback (used for Page_Status) renders a color swatch next to the select.

Pattern picker (Chunk β): `Build_Pattern` is now an inline-add select over `state.patternLibrary`. On selection, `applyPatternToNode(pattern, dialog)` fills any blank `Build_Guidance` / `Writer_Brief` fields from the pattern's defaults. For any field that already has content, `showApplyPatternDialog(pattern, conflicts)` opens a two-column diff modal letting the user choose Keep / Append / Replace per field (decision D from planning — never silently clobbers).

**Phase 2, Chunk ε — Migration Tracker Export:** File → Export Migration Tracker… opens `openMigrationTrackerExportDialog()` with sheet/option toggles. `runMigrationTrackerExport(opts)` assembles four sheets via `buildNavPlanSheet`, `buildSourcePagesSheet`, `buildRedirectsSheet`, `buildArchiveSheet`, then ships them to main via `exportMigrationTracker` IPC which writes the xlsx with SheetJS.
- **Sitemap Plan** — one row per sitemap node (filterable by phase / refs): Sort, Number, Breadcrumb, Label, URL, Page Status, Build Pattern, Builder, Writer, Migrator, Build Guidance, Writer Brief, Migration Notes, Source Page Count, **Source Page URL(s)** (the assigned live page URLs, ` | `-joined; same Kill/Consolidate exclusion as the count), **Consolidated-In URL(s)** (URLs of pages consolidating into one of the node's assigned pages — matched on each assigned page's current Address against the consolidation identity `_ConsolidateTargetId`, deduped, ` | `-joined), Net New, Phase, In Menu, External URL, Readiness Warnings.
- **Source Pages** — audit rows joined to their nav node (KKE, Final KKE, Suggested KKE, Page Type, Group, Primary Tag, target breadcrumb / path / pattern / status). Kill/Exclude inclusion toggled by user.
- **Redirects** — Kill rows + non-Kill URL changes. `404` sentinel surfaces as "(404)" with disposition "404 — intentional deindex".
- **Archive** — Kill rows with notes + tags, for client reference.

Default file name: `{project-slug}-migration-tracker-YYYY-MM-DD.xlsx`. Header row is frozen on each sheet; column widths are pre-tuned.

**Nav-node export column control + Build-filter scope (shared engine):** the Sitemap Plan columns are defined once in `navExportColumnDefs()` (`{key,label,wch,get(node,ctx)}`; `navExportDefaultColumnKeys()` = all keys in order). `navExportContext()` supplies page counts / URL builder / net-new test to the getters; `buildNavNodesSheet(nodes, colKeys, sheetName)` renders the `{name,aoa,cols}` sheet for any node list + chosen column keys (empty/omitted keys → all columns). `getNavNodesForExport({includePhased,includeRefs,respectBuildFilter,buildFilter,phaseFilter})` returns the export node set in `sortNodesForNavigation` order; `respectBuildFilter` keeps only nodes that **directly** match `buildFilter` via `matchesNavBuildFilter` (same predicate as the on-screen Build-filter match count). `buildNavPlanSheet(planOpts)` now delegates to these (accepts `respectBuildFilter`, `buildFilter`, `columns`).
- The **Migration Tracker dialog** adds an *Only nodes matching the active Build filter* toggle (reads `#nav-build-filter`; disabled + labelled "no Build filter set" when none active, else shows the filter label + match count) and a **Sitemap Plan columns** checkbox grid (`navExportColumnsHtml('_mte', …)` / `readNavExportColumns(modal,'_mte')`, with All/None buttons).
- The **Sitemap toolbar** Export ▾ menu gains *Filtered nodes → Excel (choose columns)…* → `openNavNodesExportDialog()`: a Rows scope (current Build+Phase filters vs all, pre-selecting "filtered" when a filter is active) + the same column grid (`_nne` prefix), then `runNavNodesExport(nodes, colKeys)` ships a single-sheet xlsx (`{slug}-sitemap-nodes-YYYY-MM-DD.xlsx`) via the `exportMigrationTracker` IPC. Reuses `navExportColumnsHtml` / `readNavExportColumns`.

**Migration Direction Brief — source pages + consolidation flag:** `gatherAssigneeBriefData(role, person)` (Reports → Migration Direction Brief…) now attaches per nav-node `sourcePages` = the live source rows assigned to it (`Sitemap_ID == node.id`, excluding Kill/Consolidate) as `{url, title, mergeCount}`, plus a node-level `mergeTotal`. `mergeCount` is the number of distinct pages being **consolidated into** that source page — computed from a `_ConsolidateTargetId → rows` map (`rowIsConsolidate` + `consolidateTargetAddr`), matched against the page's current Address (the consolidation identity). `summary.consolidatedIn` totals merges across the person's pages. The built-in HTML (`assigneeBriefBuiltinHtml`) lists each node's source page(s) under its row, each with a **merges N** pill when `mergeCount > 0` (no expansion of which pages — "list pages, flag consolidations"); the node count cell shows `(+N)`. The template context (`assigneeBriefContext`) exposes `sourcePages` + `mergeTotal` per page and `summary.consolidatedIn`.

**Phase 2, Chunk δ — Nav editor build indicators + filters:**
- `buildNavRowBuildIndicators(node)` adds inline chips to every nav row when build metadata is present (positive-only signal — no warnings):
  - `.ne-status-pill` — colored status pill (color from `pageStatusLibrary` entry, ~13% opacity background)
  - `.ne-build-badge` — small letter circle: `P` (pattern), `G` (build guidance), `W` (writer brief)
  - `.ne-assignee-chip` — builder (🔧) / writer (✎) chip with `assigneeShort()` name
- `computeNodeReadinessWarnings(node)` exists but returns `[]` intentionally — readiness warnings were dropped because build/writer guidance is often the exception rather than the rule on a large site. Function kept in place so callers (stats bar, export column, filter predicate) continue to work without raising warnings. Re-enable by adding rules back to the function.
- Stats bar adds: per-status tallies. (Readiness count line is inert.)
- "Build:" filter dropdown in the nav toolbar (`#nav-build-filter`) with options grouped: any/no status, any/no assignee, any/no pattern, has/no guidance content (build guidance OR writer brief). `matchesNavBuildFilter(node, filter)` is the predicate. Also supports `status:NAME` / `assignee:NAME` forms (not yet exposed in UI, reserved for future per-value filters).
- Page-count cache (`_navPageCountsCacheMap`) invalidated on each `renderNavEditor()` call.

Modal is draggable via `makeModalDraggable()`. Each markdown textarea has a toolbar via `attachMarkdownToolbar(textarea)`. Prev/Next navigation in the editor header uses `sortNodesForNavigation(state.navNodes)` for sortID-based ordering.

The node row's label is **static text** (`.ne-label-text`), not an editable input — single-click does nothing, double-click opens the editor. The pencil button (`.ne-edit-btn`) is the explicit affordance. Renaming a node happens only via the editor.
```

---

## Audit columns

Columns are injected into every file if not already present:

| Column               | Type         | UI               |
|----------------------|--------------|------------------|
| `KKE_Recommendation` | Controlled   | Buttons (4+ states) |
| `Tags`               | Free (CSV)   | Chip input       |
| `Notes`              | Free text    | Notes popover    |
| `Redirect_Destination` | URL        | Redirect editor  |
| `SME_Decision`       | Controlled   | Dropdown (Approve, Change: Keep/Kill/Evolve/Exclude) |
| `SME_Notes`          | Free text    | Notes field      |
| `Content_Owner`      | Free text    | Text field       |
| `Final_KKE`          | Controlled   | Dropdown (same values as KKE, includes Consolidate) |
| `Consolidate_Into`   | Path (display) | **Derived display** — the master (consolidated-into) page's clean *relative new path*, recomputed from the identity column. Set via Consolidate picker. Backed by `_ConsolidateTargetId` |
| `_ConsolidateTargetId` | URL (internal) | **Stable identity** — the master page's current Address. The source of truth every engine consumer keys off; survives the master later gaining/overriding its new-site path. `_`-prefixed: hidden from Table View, never user-edited |
| `_RedirectSource` | Controlled (internal) | **Redirect provenance** — `auto` (the app derived the destination from the sitemap), `manual` (a person typed or picked it), or blank (unknown — every file predating the column). The fact whose absence causes the stale-redirect family of bugs; see the Redirect provenance section. `_`-prefixed: hidden from Table View, never user-edited |
| `Published_Status`   | Controlled   | Dropdown (Published / Unpublished / Draft / 404); for CMS-export workflows |
| `Page_Type`          | Controlled   | UI label **Content Type**. Dropdown with global library (`state.pageTypeLibrary`, prefs) + custom add. Key into the registry crosswalk |
| `Content_Theme`      | Controlled   | Dropdown with per-project library (`state.contentThemeLibrary`, projectSettings) |
| `Target_Content_Type` | Free text   | New-CMS content type; auto-filled (blanks only) from the registry crosswalk via `applyContentTypeRegistryDefaults()`; `#target-ct-hint` `→ Target` readout |
| `GA_KKE_Recommendation` | Controlled (computed) | GA-derived recommendation; rolled into Suggested_KKE (Chunk D). Standalone audit-bar badge is hidden when Suggested_KKE is populated. |
| `GA_Score`           | Numeric (computed) | 0–1 composite score backing GA_KKE_Recommendation |
| `Content_Nature`     | Controlled   | UI label **Renders as**: Page / Content Object (shown as "Fragment (embeddable)") / Generated; default blank. Hidden behind "Show Migration fields" toggle. `isFragmentRow()` keys on the `Content Object` value for nature-aware downstream |
| `Migration_Track`    | Controlled (Phase 1) | Scripted / Migrate Records / Configure / Manual Rebuild / Merge / Kill/Redirect; ghost suggestion derived from KKE + Content_Nature |
| `Suggested_KKE`      | Controlled (computed, Phase 1) | Unified suggestion from GA + Rubric (Chunk D); replaces standalone GA_KKE badge |
| `Suggested_KKE_Sources` | JSON sidecar | Per-source breakdown for the Suggested_KKE badge tooltip |
| `Source_CMS_URL`     | URL          | Admin/edit URL in source CMS — audit bar CMS link cluster, sidebar dot indicator |
| `New_CMS_URL`        | URL          | Admin/edit URL in new CMS — audit bar CMS link cluster, sidebar dot indicator |
| `Design_Patterns`    | Free (CSV)   | Comma-separated design pattern names (UI components on the page); chip input in `.cluster-patterns` |
| `Audiences`          | Free (CSV)   | Every audience this page serves; chip input in `.cluster-audience` (tier-grouped picker) |
| `Source_Site`        | Derived (display) | Which source site the page came from — the matching `siteLibrary` label, else the normalized host. Read-only; recomputed by `recomputeAllSourceSites()` |
| `Jobs_Served`        | Free (CSV)   | Which jobs-to-be-done this page does work for; chip input in `.cluster-audience`, hidden until the project has a job library |
| `Primary_Audience`   | Controlled   | Who it's *mainly* for. Auto-filled when exactly one audience is tagged; the single-value key every downstream consumer reads |
| `Page_Breadcrumb`    | Derived (display) | The page's **on-page breadcrumb** for its assigned sitemap node — `pageBreadcrumbOf(node)`, honoring the breadcrumb-parent axis + Home prefix (e.g. `Home > Departments > Chemistry`). Distinct from `Sitemap_Destination` (the physical IA label chain). Read-only; recomputed by `recomputeAllPageBreadcrumbs()` |

**`Page_Breadcrumb` (derived breadcrumb column):** because the breadcrumb axis is decoupled from the sitemap hierarchy (`breadcrumbParentId`), a row's `Sitemap_Destination` no longer reflects the actual on-page breadcrumb. `Page_Breadcrumb` carries it. `computeRowPageBreadcrumb(row)` resolves the row's `Sitemap_ID` → node → `pageBreadcrumbOf(node)`. It's written wherever `Sitemap_Destination` is (assign direct/child, `createFirstNavNodeFromPage`, `cascadeNavChangesToRows`, node delete/reassign) and cleared on unassign. `recomputeAllPageBreadcrumbs()` refreshes every placed row for edits that don't cascade — breadcrumb-parent overrides + the `breadcrumbHomeLabel` — and backfills once on file open (idempotent, un-dirtied). Shows in Table View by default; read-only in the field bar.

**Schema additions:** `Content_Nature`, `Migration_Track`, `Target_Content_Type`, `Suggested_KKE`, `Suggested_KKE_Sources`, `Source_CMS_URL`, `New_CMS_URL`, `Audiences`, `Primary_Audience`, `Jobs_Served`, `Source_Site`, `Page_Breadcrumb`, `_ConsolidateTargetId`, `_Suggested_Audiences`, `_RedirectSource` are appended to the `auditCols` injection list inside `injectAndOrderAuditColumns()` in `main.js` — the single source of truth for which columns get added to every file on open.

**Phase 1, Chunk D — Suggested_KKE unified badge + sidebar filters + settings:** thin orchestrator over the existing GA + Rubric pipelines.
- **Sidebar filters** (`renderKkeFilterOptions()`): two special filters — `_suggested-disagree` (sources internally disagreed; reads `Suggested_KKE_Sources.disagreement`) and `_suggested-mismatch` (Suggested_KKE differs from the user's KKE call). Both registered in the `specialFilters` Set in `applyFilter()`.
- **Settings dialog:** the standalone File → Suggested KKE Settings… dialog was retired — per-source weight tuning (GA + Rubric, 0–5 each, with "Save weights & recompute") now lives inline in Project Settings' Suggestions tab (`refreshSuggestionsTab()`). Persists to `state.projectSettings.suggestedKkeConfig.weights`.
- **Rubric folded under Suggested:** File → Run Rubric on filtered rows… (`menu-rubric-batch`) calls `runBatchAssessment()`, which already chains into `computeSuggestedKke()` automatically. The per-row Assess button + in-popover Batch Assess button stay (the latter retitled to indicate it feeds Suggested_KKE).
- **Orchestrator architecture:** writes two columns — `Suggested_KKE` (the winning rec) and `Suggested_KKE_Sources` (JSON sidecar with per-source breakdown). Does NOT refactor GA or Rubric; reads their outputs (`GA_KKE_Recommendation`, `GA_Score`, `_AssessmentResult`) and consolidates them.
- `computeSuggestedKke()` runs automatically after a GA compute pass and after a rubric batch assessment. Also triggerable via File → Recompute Suggested KKE.
- `pickWinner(sources, weights)` uses weighted-tally voting; ties resolve to the first source's rec deterministically. Source weights live in `state.projectSettings.suggestedKkeConfig.weights` (default `{ ga: 1.0, rubric: 1.0 }`).
- **Disagreement detection:** when sources produce distinct recs, the badge gets `.suggested-kke-disagree` class (dashed amber border + ⚠ glyph). The popover highlights the disagreement banner.
- **Audit-bar badge** (`#suggested-kke-badge`) renders `"GA: Kill"` / `"Rubric: Evolve"` with ⚠ on disagreement. Click opens a `.suggested-kke-popover` showing all sources with their recs + winner. Hides the legacy `#ga-kke-badge` automatically when populated.
- **One-time migration on file open:** rows with `GA_KKE_Recommendation` or `_AssessmentResult` populated but blank `Suggested_KKE` get seeded via `pickWinner()`. Toast confirms the count. Dirty flag set so the seeded values persist on save.

**Audit-bar space-saving UX (post Chunk C):**
- **Blank metadata fields are hidden by default** in `#field-bar-top` (controlled by `state.hideBlankMetadata`, persisted in app prefs). Title and editable fields always show; blank read-only fields are skipped in `renderMetaFields()`. A `#btn-toggle-blank-meta` icon button (⊘/◉) in the field-bar-top toggles.
- **Clusters are click-to-collapse.** Each `.audit-cluster[data-cluster]` has a clickable `.cluster-pill` with a chevron (`.cluster-chev`); clicking adds/removes `.collapsed` on the cluster. Collapsed clusters hide all children except the pill and a `.cluster-summary` span that shows a short inline readout (e.g., `"Article / blog post · Published · News"`). State persists per-cluster in `state.collapsedClusters` (object keyed by cluster name, in app prefs). `refreshClusterSummaries(row)` rebuilds the summary text on row selection. Per-cluster summary builders: `summarizeDecide/Classify/Tag/Review/Migrate/Cms`.

**Audit-bar cluster system (Phase 1 Chunk C UX pass):** the audit bar is structured as a vertical flow of labeled cluster cards rather than a flat field list. Each cluster is a `.audit-cluster` with a `.cluster-pill` label on the left edge:
- `.cluster-decide` — KKE buttons + Notes/Nav/Tree/Redirects buttons (blue pill)
- `.cluster-classify` — Page Type / Theme / Published / Group (slate pill)
- `.cluster-tag` — Primary Tag / Tags (violet pill)
- `.cluster-patterns` — Component chip input (label: "Components"), hidden behind `state.showDesignPatterns` (violet pill); `#design-pattern-fields-wrap`; toggled by `#qt-patterns` quick-chip ("Components") and `#pref-show-design-patterns`
- `.cluster-audience` — Primary audience + audience chips (rose pill), hidden behind `state.showAudienceFields`; `#audience-fields-wrap`; toggled by `#qt-audience` ("Audience") or `#pref-show-audience-fields`. **Auto-reveals** the first time a project's audience library is non-empty — otherwise the feature hides behind a toggle nobody has a reason to find
- `.cluster-review` — SME workflow, hidden behind `state.showSmeFields` (teal pill); reuses `#sme-fields-wrap` ID
- `.cluster-migrate` — Content Nature / Track + ghost, hidden behind `state.showMigrationFields` (amber pill); reuses `#migration-fields-wrap` ID
- `.cluster-cms` — Source / New CMS links, 50/50 split, stacks under 900px (green pill)

`.audit-cluster` is `flex: 1 1 100%` so each cluster occupies its own row in `#field-bar-audit` (which is `flex-direction: column; gap: 6px`). Fields wrap freely inside a cluster. Old `.audit-divider` and `.audit-row-break` separators are hidden inside `#field-bar-audit` since clusters provide structure. Per-field `.audit-label` text is preserved but lighter (10px, slate-500); the cluster pill carries the higher-order framing.

**Phase 1 Chunk C — Migration classification UI:** `Content_Nature` and `Migration_Track` dropdowns live in `#migration-fields-wrap` (the `.cluster-migrate` cluster). Hidden by default behind `state.showMigrationFields` (App Settings → "Show Migration fields"; per-user pref). `applyMigrationFieldsVisibility()` toggles via `.hidden` class. `populateMigrationFields(row)` syncs both dropdowns and the ghost suggestion. The ghost (`#migration-track-suggestion`) appears next to the Track dropdown when its value is blank; click to accept. Suggestion derivation: `deriveMigrationTrackSuggestion(row)` uses Final_KKE (or KKE_Recommendation), Content_Nature (or registry-default-by-Page_Type as fallback). Mapping: Kill→Kill/Redirect, Consolidate→Merge, Evolve→Manual Rebuild, Keep+Page→Scripted, Keep+Content Object→Migrate Records, Keep+Generated→Configure, Exclude→blank. Setup wired via `setupMigrationFieldsHandlers()` in init. The KKE click handler also calls `populateMigrationFields()` so the ghost refreshes when KKE changes.

**ContentTypeRegistry default flow:** when a row's `Page_Type` changes, `applyContentTypeRegistryDefaults(origIndex, forUI)` looks up the registry via `lookupContentTypeRegistry()`. Primary lookup is case-insensitive exact match; fallback splits the page type on common separators (` / `, `,`, ` | `) and tries each token. Handles cases like `"Article / blog post"` matching the registry's `"Article"` or `"Blog Post"` entry without forcing the user to add every compound variant. If the matched entry has a default, it fills the row's `Content_Nature` and/or `Migration_Track` only when those fields are blank — never overwriting human input. Each filled field is logged via `logChange()`.

**Audience tagging (who each page serves):** turns audience-prioritization / JTBD workshop output into an actual audit input rather than a deck nobody consults. Two columns — `Audiences` (CSV set, chip input) and `Primary_Audience` (single "mainly for" call) — over a **per-project** library `state.audienceLibrary` = `[{name, tier, color, description, notes}]`, persisted BOTH in `projectSettings.audienceLibrary` and as its own visible **`Audiences` structural sheet** (`parseAudienceLibrarySheet` / `writeAudienceLibrarySheet` in main.js; excluded from the `KKE_Settings` JSON blob like the other sheet-backed libraries). Per-project, *not* global prefs — unlike components, an audience list doesn't transfer between clients. Seeded opt-in from `AUDIENCE_STARTER_SETS` — **two** lists (`higher-ed`, `general`) picked explicitly in `openAudienceSeedChooser()`, since "who is this site for" has no universal answer and quietly loading higher-ed audiences into a company audit is worse than no seed at all. Both come in entirely at `Secondary` — deliberately NOT pre-tiered, since a guessed ranking would feed a fabricated number into the KKE vote. Entries are re-coloured through `nextAudienceColor()` on the way in, because the two sets share a base palette and stacking them would otherwise hand out a duplicate.

- **Tiers** (`AUDIENCE_TIERS`): Primary / Secondary / Tertiary / Not a target. The picker (`renderAudienceList`) groups by tier rather than alphabetically so the workshop's ranking stays in front of the auditor at the moment of tagging.
- **`AUDIENCE_NONE` (`'— None (no target audience)'`) is load-bearing.** A **blank** `Audiences` cell means *unreviewed*; this reserved entry means *reviewed and serves nobody*. Only the latter argues Kill. `toggleAudience()` keeps the two mutually exclusive in both directions. Collapsing them would make the suggestion engine read every untouched row in a fresh project as a Kill call.
- **`Primary_Audience` is its own column, not "first in the list"** — deriving it would make sitemap colours depend on chip insertion order. `syncPrimaryAudience()` auto-fills it when exactly one audience is tagged and clears it when the named primary is un-tagged; it only repaints the audit bar for `state.selectedIndex`, since it also runs per-row inside bulk loops.
- **Audience votes in `Suggested_KKE`** (`audienceSourceVote()` inside `gatherRowSources()`, weight `audience` in `defaultSourceWeights()`, tunable in Project Settings → Suggestions): Primary-tier → **Keep**; all-Tertiary/Not-a-target → **Evolve**; `— None` → **Kill**; **untagged and Secondary-only abstain**. Abstention is the important half — an untagged project is completely unaffected. `refreshSuggestedKkeForRow(origIndex)` (over the extracted `writeSuggestedKkeForRow`) updates one row after a chip click instead of re-running the whole file through `computeSuggestedKke()`.
- **Bulk tagging is the adoption path**, so it shipped with Phase 1: `add-audience` / `remove-audience` / `primary-audience` in `applyMultiAction()`. Setting a primary in bulk also adds it to the row's set — otherwise the set-based and primary-based reports disagree.
- **Filters:** `_needs-audience` (Keep/Evolve, untagged — the tagging worklist), `_audience-orphan` (reviewed, everything it serves is off-priority — the Kill worklist), and `_audience-suggested` (an AI suggestion is waiting — the review queue), all in the `specialFilters` set.
- **Sitemap/treemap colouring:** only `Primary_Audience` is exposed via `SITEMAP_ROW_FIELDS`, with `valueColors` from the library. The multi-value `Audiences` column is deliberately absent — `computeNavRowFieldAggregates()` treats each cell as ONE value, so a CSV cell would aggregate as its own opaque `"Alumni, Donors"` pseudo-value.
- **Multi-site (consolidation) awareness:** `makeSectionResolver()` groups report sections by breadcrumb where a row is placed and by URL path otherwise, stripping the shared leading prefix on BOTH axes (`sharedPrefixDepth`) — a crawl rooted below the domain (`alpha.edu/college/…`) and a sitemap with a single site-root node each collapse every page into one bucket otherwise. Path prefixes are computed **per host**, and when the crawl spans more than one source site (`normalizeSourceHost`, which folds away `www.` only) unplaced rows are labelled `domain › Section` so two sites' `/about` pages can't silently merge. `sharedPrefixDepth` requires **two** paths to call something a prefix, or a lone page's own parent directory gets stripped as if it were site-wide.
- **Reports:** `reportAudienceCoverage()` (per audience in tier order: pages, primary count, KKE mix, top sections, under-served-Primary flag, untagged tail), `reportAudienceMatrix()` (audience × top-level section cross-tab, cells shaded by share), `reportAudienceDebt()` (serves-only-non-priority · priority-content-marked-Kill · tagged-with-4+). All three measure coverage against `audienceScopeRows()` — Keep/Evolve/Consolidate/unreviewed — **not** the whole crawl, or a fully-tagged audit would report ~15% coverage.
**Jobs-to-be-done (Phase 3):** the other half of the workshop output — audiences answer *who*, jobs answer *what they came to do*. `Jobs_Served` (CSV) over `state.jobLibrary` on the `Jobs` sheet.
- **A job's `audiences` is a LIST, not one owner.** Most jobs are audience-specific, but some ("find who to contact") genuinely aren't, and forcing those onto one audience would distort the coverage gap.
- **The picker hoists the row's own audiences' jobs to the top** (`renderJobList`) — on a library of any size that's the difference between picking from three relevant jobs and scrolling forty. Cross-cutting jobs group under "Any audience".
- **The Jobs field is hidden until the library is non-empty** (`applyJobsFieldVisibility()`), since most projects never run a JTBD workshop and an always-empty chip input is noise.
- **The payoff is the inverse question.** `reportJobsCoverage()` leads with *jobs nothing answers* — the strongest brief for net-new content available, because it traces back to the client's own words. The same list is appended to the **Net New Content Brief**, which otherwise only finds gaps in the sitemap you drew.
- `_needs-job` filter (Keep/Evolve, untagged) is the tagging worklist; `add-job` / `remove-job` in `applyMultiAction()` are the bulk path.

- Audience columns also flow into the Migration Tracker **Source Pages** sheet and the **SME export** (SMEs are frequently the only people who know who actually reads a page).

**Audience at scale (Phase 4):** Phases 1–3 made audience taggable and made it pay off; nothing made it *affordable*. Two volume tools, deliberately different in how much they're trusted. Both share `writeAudienceDecision(origIndex, {audiences, primary, jobs}, undoItems)` — the single write path behind inherit, the review dialog, and the per-row Accept, so all three change-log, land in one `pushBulkEditUndo()` entry, and re-run the row's `Suggested_KKE` vote identically. `audienceFillTargets({onlyFiltered, skipSuggested})` is the shared eligibility set (in scope, Keep/Evolve/Consolidate/unreviewed, untagged).

- **Inherit from section** (`Project → Fill Audiences from Section…`) is free, deterministic and needs no API key, so it **writes `Audiences` directly** — the dialog *is* the review, and it's one `Cmd+Z`. `computeSectionAudienceProfiles({minEvidence:3, minShare:0.5})` runs over `makeSectionResolver()` and only ever propagates a decision the auditor already made in the same section: an audience must appear on ≥50% of the section's tagged pages, and a section needs ≥3 tagged pages before it may speak for its untagged ones. Both bars are load-bearing — without `minEvidence` two tagged pages would fill two hundred. **`AUDIENCE_NONE` is never inherited**: propagating it would assert "serves nobody" (a Kill vote) onto pages no one has looked at, collapsing the blank-means-unreviewed distinction the whole feature rests on. Only blanks are filled; an existing tag is never overwritten.
- **AI suggestion** (`Project → Suggest Audiences with AI…`) costs credits and can be wrong in novel ways, so it **never writes `Audiences`**. Results land in `_Suggested_Audiences` (internal JSON, `_`-prefixed, hidden from Table View, round-trips through save so the queue survives a session) and the auditor accepts or rejects — the same "never touches your human column" contract `Suggested_KKE` has. Two review surfaces: `openAudienceSuggestionReview()` groups pending suggestions **by the suggested set**, which is what makes thousands reviewable (a few dozen distinct answers, each judged once from its sample paths and confidence mix), and `renderAudienceSuggestionGhost()` offers the same suggestion inline in the audience cluster for page-by-page work. `_audience-suggested` filter finds the queue.
- **Batching is the whole point.** The rubric path's one-row-per-request (~1s/row) is an hour for 3,600 pages. `AUDIENCE_AI_BATCH_SIZE = 20` pages share one prompt so the audience library — the bulk of the tokens — is sent once per batch rather than once per page, and `AUDIENCE_AI_CONCURRENCY = 3` workers pull from a shared cursor. Esc sets `_audienceAiAbort`; everything suggested up to that point is kept. `skipSuggested` keeps a second run from paying to re-answer pages already in the queue.
- **Structured outputs constrain the answer to the library.** `suggest-audiences-llm` sends a JSON Schema whose `audiences`/`primary` items are an **enum of this project's audience names**, so the model cannot invent an audience — no fence-stripping, no fuzzy matching. `ingestAudienceSuggestions()` still filters against the live library (a library edited between request and response would otherwise slip through) and drops empty-audience results, which are the model's honest abstention on metadata too thin to judge.

**Claude API surface (main.js):** every call goes through `callClaudeMessages({apiKey, model, system, prompt, schema, maxTokens, effort})` — raw HTTPS rather than `@anthropic-ai/sdk`, because this is the only Claude call surface in the app and an npm dependency in a signed/notarized universal build costs more than the helper does. It checks `stop_reason === 'refusal'` before reading `content` (safety classifiers decline with a 200 and an empty content array, which otherwise looks like a parse failure) and unwraps the API's JSON error envelope. `CLAUDE_MODELS` is the single source of truth for the model picker — Opus 5 (default) / Sonnet 5 / Haiku 4.5, with an `effort` flag because Haiku 4.5 rejects `output_config.effort`; the renderer reads it over `get-claude-models` rather than keeping a second copy. The per-project choice persists in `projectSettings.audienceAiModel`. `assess-row-llm` was migrated onto the same helper (it pinned the long-retired `claude-sonnet-4-20250514`).

**Source sites (consolidation audits):** Transmission otherwise models an audit as *one site becoming one site*; in a merger the unit of work is often the **site**, which has an owner, a CMS to export from, its own redirect configuration, and its own in-scope decision. See `docs/dev/SOURCE_SITE_PROPOSAL.md`.

- **A registry, not host-parsing.** `state.siteLibrary` = `[{label, hosts[], cms, owner, inScope, color, notes}]` on the `Sites` sheet. `hosts` is a **list** because host ≠ site: `normalizeSourceHost()` folds away `www.` only (always the same site), while `careers.example.com` may be the same site or a separate property being retired — the auditor decides, by moving hosts between entries in Project Settings → Sites. `seedSiteLibraryFromData()` auto-creates one entry per un-covered host on open.
- **`Source_Site` is derived-but-stored** (`computeRowSourceSite()` / `recomputeAllSourceSites()`), following the `Page_Breadcrumb` precedent: materializing it means filtering, Table View, saved filters, `SITEMAP_ROW_FIELDS` colouring and every export get the dimension for free instead of each re-parsing hosts. Recomputed on open and after any registry edit (rename, host move) — the column stores the *label*, so a rename must cascade.
- **`reportRows()` is the canonical report row set** and excludes rows whose site is marked out of scope. It returns `state.editedRows` **by reference** when nothing is out of scope, so single-site projects are provably unchanged. Applied across Executive Summary, Content Inventory, SME Status, Redirect Map, Migration Checklist, Net New, Component Inventory, Content Type Crosswalk, the tracker sheets, `audienceScopeRows()`, and **`gatherProgressStats()`** — which had counted `state.editedRows` directly, so the progress dashboard, its PDF, the Executive Summary and SME Review Status all measured against the whole crawl while `scopeDisclosureHtml()` printed "N pages are excluded from every figure below" above them. The banner was simply false, and completion percentages could never reach 100% on a project with a retired property. The dashboard and the progress PDF get their own inline disclosure, since neither routes through `showReport()`. The `'No data loaded'` guards deliberately still read `state.editedRows` — an all-out-of-scope project isn't an empty file.
- **Redirect maps split per source domain** (`buildRedirectsSheets()` returns an ARRAY; `redirectRuleForRow()` is the shared per-row rule so sheets and CSV can't drift). Each retiring domain deploys its own redirect config, so a merged list has to be split by hand downstream. `redirectSheetName()` handles Excel's 31-char cap, its forbidden characters, and collisions between long domains. Single-site projects get one sheet named `Redirects`, unchanged.
- **Reports:** `reportSiteConsolidation()` (per site: pages, KKE mix, audiences served, cross-site overlap, redirect rules required — counted via `redirectRuleForRow()` so rules still awaiting a destination are included, else it reports zero on exactly the project that hasn't written its redirects yet) and `reportCrossSiteDuplicates()` (`crossSiteDuplicateGroups()` reuses the Title/H1/Meta fingerprints `detectDuplicates()` already computes, grouped by site). `_crossSiteDupSet` backs the `_cross-site-duplicate` sidebar filter.
- **`maybeWarnMissingSiteDomain()`** fires when 2+ sites are in scope and `siteDomain` is unset, because `getRedirectBaseUrl()`'s fallback is *the first row that parses* — fine on one domain, arbitrary across several.

**URL variant triage (canonical-driven):** a crawl is not a content inventory — much of it is alternate views of the same page. `classifyUrlVariants()` groups rows by their declared `rel=canonical` (`canonicalCol()` finds the column; Screaming Frog's `Canonical Link Element 1`), which the app ingested for years and never read. The declaration is **authoritative** where a parameter-name rule would be a guess about someone else's CMS — see `docs/dev/URL_VARIANT_TRIAGE_PROPOSAL.md`.

- **The default action differs by kind, and this is the crux.** `defaultVariantAction()` returns `exclude` for a group whose variants differ from the canonical **by query string alone** (same path → the canonical's own redirect already covers them; a rule each would bury the ones that matter) and `consolidate` for **different-path** variants (that URL genuinely dies, so it needs a rule). Consolidate writes `_ConsolidateTargetId` = the canonical's Address — the same identity `applyConsolidateTarget()` uses — so `resolveRedirectDestinations()` needs no changes.
- **Skips out-of-scope sites** (reads `reportRows()`): a property nobody is migrating never gets decisions written into it by a bulk action.
- **Records, never hides.** Every affected row keeps its place and gets a logged KKE value; `openUrlVariantTriageDialog()` has the same skip-already-decided toggle Non-200 triage has, and `maybeOfferUrlVariantTriage()` only *offers* on open.
- **Dominant-canonical guard:** if one target absorbs >50% of a 200+ row triage, confirm first — that shape is equally a huge paginated list (legitimate) and a CMS pointing every canonical at one URL (catastrophic), and the shape alone can't tell them apart.
- Filters `_url-variant` and `_variant-target-missing` are populated inside `detectDuplicates()` so they can't drift from what the dialog would show.

**Bulk-edit undo (`'bulk-edit'` actions):** `pushBulkEditUndo(items, label)` records `[{origIndex, field, oldValue, newValue}]` as ONE undo entry — a triage touching thousands of rows must reverse in one Cmd+Z, not blow the 100-action stack. `applyBulkEditUndo()` replays in reverse on undo so a row written twice in one action unwinds to its genuine starting value. Used by URL variant triage and (retro-fitted) Non-200 triage.

**`detectDuplicates()` skips Kill/Exclude rows.** The duplicates filter is a worklist of duplicate content still needing a decision; counting already-dispositioned rows made it match 68% of a real crawl (~9,000 of ~13,000) and answer nothing. Same reasoning as `_navPageCountsCache()` excluding Kill/Consolidate.

**Sidebar "Unclassified" filter:** `#btn-unclassified-filter` toggles a `Content_Nature is-blank` field filter. `refreshUnclassifiedButton()` syncs the button's `.active` class with current `state.fieldFilters` (called after chip removal, saved-filter restore, etc.). Composable with KKE filter and other field filters. Source/New CMS URL fields are wired through `populateCmsLinks()` and `setupCmsLinkHandlers()` in renderer; clicking the ↗ icon opens via `open-external`. Sidebar `.row-ind-cms` indicator (◐ source only / ◑ new only / ⊜ both) appears when either CMS URL is populated. Table View hides `Suggested_KKE_Sources`, `Source_CMS_URL`, `New_CMS_URL`, and `Design_Patterns` by default (`TV_HIDDEN_BY_DEFAULT` set); user reveals via column picker.

**Design Pattern inventory:** `Design_Patterns` column stores comma-separated pattern names per page (same storage pattern as `Tags`). Pattern vocabulary lives in `state.designPatternLibrary` = `[{name, category, complexity, description, dsUrl, aliases, notes}]` — **app-level (global), stored in `prefs.json`** (same tier as `tagLibrary` and `pageTypeLibrary`). Self-seeds from `DEFAULT_DESIGN_PATTERN_LIBRARY` (57 entries) on first run via async `getDefaultDesignPatternLibrary()` IPC call. Returns immediately with `[]` while async resolves; populated in seconds. The `DesignPatternLibrary` xlsx structural sheet is still read/written for backward compat and per-project additions — any names in the sheet not already in the prefs library are merged in on file open. Visibility controlled by `state.showDesignPatterns` (per-user app pref); `applyDesignPatternsVisibility()` adds/removes `.hidden` from `#design-pattern-fields-wrap` (`.cluster-patterns`, violet pill). Toggle via the `Components` quick-chip in `#cluster-quick-toggles` (`#qt-patterns`) or App Settings `#pref-show-design-patterns`. Core functions: `getRowDesignPatterns()` / `setRowDesignPatterns(patterns)` / `renderDesignPatternChips(patterns)` / `populateDesignPatterns(row)` — called from `populateAuditFields()`. Dropdown (`#design-pattern-dropdown`) is opened by `#btn-add-design-pattern`; `renderDesignPatternList(filter)` groups entries by `.category` with `.dp-category-header` sticky headers, shows `.dp-option-complexity` badge (Low/Medium/High), highlights already-selected entries; typing opens a "Create [name]" option. `setupDesignPatternHandlers()` wires the button, search input, create button, and outside-click-to-close. Library editor: `openDesignPatternLibraryEditor()` — two-pane master/detail using `.pl-modal` styles. **Seed defaults** calls `getDefaultDesignPatternLibrary` IPC (returns `DEFAULT_DESIGN_PATTERN_LIBRARY`, 57 entries across 12 categories). Cluster summary: `summarizePatterns(row)` → first 2 names + count overflow. Report: `reportDesignPatterns()` — per-component frequency table with KKE breakdown, one-off flag (≤2 pages), top 15 co-occurring pairs. Accessible via Reports → Component Inventory… (`menu-report-design-patterns` IPC). Sidebar filter for patterns uses existing field-filter system (`Design_Patterns contains X`).

**Sitemap `Node_Type`:** active, three values — `''` (Page), `'Header'` (structural grouping), `'Fragment'` (shared/embedded content). Set via the node editor's Node type select. **Fragment** nodes keep their computed path as a repository location but have no menu/breadcrumb/redirect; they render as their own layer (`.ne-fragment-badge` `FRAG` + `.ne-row-fragment`), are excluded from hub/empty/net-new counts (tree render + stats buckets), get a stats tally, and (being not-in-menu) are absent from the in-menu IA. `Nav_Layer` remains reserved (recognized in `parseNavSheet()`, preserved on rewrite, no UI). Existing files round-trip cleanly.

**Nature-aware downstream (`isFragmentRow(row)` = `Content_Nature === 'Content Object'`):** rows that render as a Fragment have no public URL, so they're skipped in `resolveRedirectDestinations()`, the Redirect Editor list (`renderRedirectEditor`), the tracker `buildRedirectsSheet()`, the need-placement count + `_needs-placement` filter, and Sitemap Coverage (`showNavCoverageReport()` also skips Header/Fragment nodes). `isFragmentRow` is a hoisted function declaration so earlier call sites resolve.

**Content type crosswalk:** `Page_Type` (UI label **Content Type**) is the key into `state.projectSettings.contentTypeRegistry` (entries: `{contentType, defaultContentNature, targetContentType, targetSpec, defaultMigrationTrack, notes}`). `applyContentTypeRegistryDefaults()` fills blank `Content_Nature` (UI **Renders as**), `Migration_Track`, and `Target_Content_Type`; `updateTargetContentTypeHint(row)` drives the `#target-ct-hint` `→ Target` readout in the audit bar. `Content_Nature` UI label is **Renders as** (Page / "Fragment (embeddable)" = stored `Content Object` / Generated). Crosswalk report: `reportContentTypeCrosswalk()` (`menu-report-content-crosswalk`).

**Redirect provenance (`_RedirectSource`, `writeRedirectDestination()`):** records who wrote each `Redirect_Destination` — `'auto'` (derived from the sitemap), `'manual'` (typed or picked by a person), blank (unknown). Without it `resolveRedirectDestinations()` must guess from the value alone whether it may re-derive, and on Keep/Evolve pages it guesses "human, never touch" — which is why a redirect derived from a since-deleted sitemap survives forever.

`writeRedirectDestination(row, value, source)` is the **single write path**; all 19 sites that used to assign the column directly now go through it, so value and provenance cannot drift. `source` is `'auto'`, `'manual'`, `'inherited'`, or `'keep'` (rewrite the value, leave provenance alone — used where a changed site domain or default destination rewrites every destination in place, which edits an existing decision rather than making a new one). Clearing a destination clears its provenance: an empty cell has no author. The helper deliberately does NOT log, dirty, or re-render — call sites keep doing that their own way, so slotting it in changed no behavior.

Classification worth knowing: the Redirect Editor's **nav picker** counts as `'manual'`, not `'auto'`. It derives the URL from a node, but the *person* chose which node, and it need not be the row's own assigned node — marking it auto would let a later re-derive silently overwrite their pick. Non-200 triage copying the crawl's `Redirect URL` is likewise `'manual'`: it is a triage decision, not something the sitemap can reproduce.

**What reads it (B and C).** `resolveRedirectDestinations()` checks provenance before every heuristic: `'manual'` returns immediately in *all* branches (so a hand-typed Kill destination that happens to equal the project default is no longer overwritten), and on the non-Kill branch `'auto'` re-derives unconditionally — including **clearing** the destination when the page stops moving (unplaced, or placed on a node whose path is already its URL). That asymmetric `if (existing) return;` was the bug: Kill/Consolidate self-healed and Keep/Evolve froze forever. `clearNavAssignment()` likewise clears an `'auto'` destination along with the five Sitemap fields, since a redirect derived from an assignment is meaningless once the assignment is gone; it takes `opts.keepRedirect` for `promptKillCleanup`/`promptBulkKillCleanup`, which ask about the redirect **separately** and run *before* the row's KKE is written — without the flag the Kill exemption hasn't taken effect yet and an explicit "keep the redirect" would be silently overridden.

**`'inherited'` — a 3xx the live site already redirects (carry-forward).** Screaming Frog reports a `Redirect URL` for every 3xx it crawls, and Non-200 triage copies it in. That value used to be recorded as `'manual'`, which froze it: the resolver treats manual as untouchable, so a rule written on day one still pointed at the target's **old** URL on day ninety, after the target moved. It is not a decision anybody made — it is the old site's answer — so it gets its own provenance and is re-derived on every save exactly as `'auto'` is.

- **`crawlRedirectUrl(row)`** reads the hop (blank unless the row is 3xx). `deriveAutoDestination`'s Kill branch consults it at priority **consolidation master > sitemap node > inherited hop > project default** — below the two a person chose, above a blanket fallback.
- **It is resolved, never copied**: `resolveFinalUrl()` already followed a target's `Computed Path`, consolidate chain and explicit 404, so an inherited rule inherits its target's fate for free. One addition was needed — `resolveFinalUrl` now follows a target that is *itself* an untriaged 3xx via its own `crawlRedirectUrl`, collapsing a live-site A→B→C into one hop instead of shipping a rule to B (a URL being retired). Cycle-safe via the existing visited Set, which matters because a live redirect loop is exactly where it bites.
- **The `looksAutoDerived` test cannot be reused here** — the moment the target moves, the new destination differs from the copied one, isn't the project default and isn't a loop, so it would fail the test and freeze. `src === 'inherited'` therefore re-derives unconditionally, keeping its provenance so classification can still tell where the value came from.

**Inherited-redirect classification (`classifyInheritedRedirect()` / `inheritedRedirectFindings()`):** resolution handles the tractable cases silently; this names the ones needing a person. `INHERITED_REDIRECT_CLASSES` is the ordered table (each with an `actionable` flag): `no-target`, `loop`, `dead` (target is 4xx), `undecided`, `target-retired`, `uncrawled`, `out-of-scope`, `external`, `retired` (explicit 404), `ok`.
- **`undecided` is keyed on the KKE decision, NOT on sitemap placement, and that choice is the point.** The obvious version of this check — *warn when the destination isn't placed in the new sitemap* — is wrong for a migration that preserves URLs 1:1 in the new CMS: such a project has no tree at all, and the warning would fire on every row. Whether a page is *placed* depends on how you work; whether it has been *decided* does not. An undecided target may turn out to be Kill, at which point the rule points at nothing. Two tests pin this by asserting the same URL-preserving project reports zero findings, and one finding once its destination's KKE is cleared.
- **`target-retired`** covers the decided-but-doomed case: a Kill target with no destination of its own, or a Consolidate target with no master. The test is *did resolution move past the target* (`isSelfRedirect(targetUrl, resolved)`) — if the target had somewhere to go, `resolveFinalUrl()` would already have followed it, so stopping on it is the whole signal. A Kill target that *does* carry a redirect is therefore `ok`, not a finding.
- **`Exclude` on a destination is not a finding.** Exclude means "not part of this inventory" (an alternate view, an internal tool) — the page generally still exists, and it is a decision someone made.
- **`uncrawled` vs `external` is the load-bearing split.** `resolveFinalUrl` returns a URL verbatim when it isn't in `rowByUrl`, which conflates "off somebody else's domain — normal, carry it" with "on a site we're migrating but never crawled — a hole in the data". `knownSourceHosts()` (the union of `siteLibrary` hosts) separates them; an unparseable/relative destination degrades to `uncrawled` rather than being claimed as off-site.
- Surfaced by the `_redirect-needs-review` sidebar filter (the actionable classes; builds the resolver context once, and only when the filter is on) and counted in `runPreHandoffCheck()` under *Inherited redirects resolve to pages that will exist* — the right home for "don't ship yet", since inherited redirects re-derive on every save and deciding the destination pages repairs most findings without touching a redirect. Also by `checkRedirectChains()`, which was upgraded from an `alertDialog` list into a real `showReport()` covering both inherited classes and chains. `ok`/`retired` are counted but not listed — on a real crawl `ok` is thousands of rows and printing them buries the groups that need work.

**Blank is not `'manual'`.** Every existing project reads back blank, so any consumer must fall back to the value-shape heuristics (see the health check) rather than treating unknown as human-authored. Concretely: unknown + a non-blank value keeps the old cautious behavior (fill blanks only, never rewrite), so **no existing file changes behavior** — silently rewriting ambiguous values is the failure being repaired, and the health check is where a human confirms those.

**Redirect Health Check (`computeRedirectHealth()` / `openRedirectHealthCheck()`, Migration menu):** the recovery tool for redirects that contradict the sitemap. It exists because nothing records *who wrote a redirect* — so `resolveRedirectDestinations()` treats any existing value on a Keep/Evolve page as a human decision and never revisits it (unlike its Kill/Consolidate branches, which re-derive anything `looksAutoDerived`). A sitemap that is built, used, and deleted therefore leaves its derived redirects behind to contradict the tree that replaces it; `clearNavAssignment()` clears the five Sitemap fields but not `Redirect_Destination`. The pattern that produces this at scale is building a **current-state** sitemap in the working file (see `docs/RUNNING_AN_AUDIT.md`). Found on a real 3k-row audit: roughly three-quarters of ~1,300 redirect values were fossils of a deleted tree, including 22 pages redirecting to themselves.

- Five buckets, one row each, in `REDIRECT_HEALTH_CATEGORIES` order: `self` (destination = the page's own URL — a loop, checked first and for **every** decision including Kill/Consolidate, where it means a consolidate target resolved back to its own page), `orphan` (Keep/Evolve, unplaced, still carrying a redirect), `stale` (placed, destination ≠ the node's URL), `settled` (placed on a node whose path already *is* the page's URL — nothing is moving), and `review` (**not fixable**).
- **`isSelfRedirect(pageUrl, dest)` is the shared definition of a loop**, used by BOTH `computeRedirectHealth()`'s `self` bucket and `computeAutoDestination()`. It has to be shared: when the two disagreed, they undid each other — the check cleared a loop and the next `resolveRedirectDestinations()` derived it straight back, so the loop was unfixable from the UI (and on a 2-page consolidate cycle the fix turned one loop into two, because clearing row A let the resolver derive a fresh loop on row B). `resolveFinalUrl()` bails out of a cycle by returning the last URL it saw, which is seeded to the row's own Address — so a self-redirect is a *normal* output of the derivation, not an edge case. `computeAutoDestination()` therefore nulls it (a derivation landing on its own page is not a destination), and the Kill/Consolidate branches count an existing loop as auto-derived garbage so files already carrying one self-heal on save. Hosts are compared only when both sides have one — path-only made `alpha.edu/about` → `beta.edu/about` a false loop on a consolidation.
- **The confidence heuristic is the whole design.** A destination that still resolves to a live node might be a deliberate "send this to the parent" call, so it goes to `review` and is never auto-changed; only values that resolve to nothing — or point at the page itself — are treated as machine-written. This is a stand-in for provenance: once `_RedirectSource` exists the guessing goes away and this stays useful only for legacy files.
- **Check order is load-bearing:** `dest === want` must be tested *before* `livePaths.has(dp)`, because a correct destination is by definition a live node path — testing the other way round reported every healthy row as needing review (190 of them on the file above).
- Skips out-of-scope sites (`reportRows()`) and fragments; blank means undecided and `'404'` is deliberate, so neither is touched. `applyRedirectHealthFixes()` writes the chosen groups as ONE `pushBulkEditUndo` entry, so a thousand-row repair is a single Cmd+Z. Also reported (counts only, no fixing) as a check inside `runPreHandoffCheck()`.

**Redirect_Destination = "404" sentinel:** literal string `"404"` means "let this URL return 404 — do not write a redirect rule." Distinct from blank (TBD). Recognized by:
- `resolveRedirectDestinations()` — propagates 404 through consolidate chains; preserves explicit 404 values
- Redirect Editor — `redirect-dest-404` CSS class on the input + a `re-404-btn` toggle button next to nav picker
- Redirect Map Report — three sections: Kill redirects, URL-changed redirects, Intentional 404s
- Migration Checklist — excludes 404 rows from the redirect manifest table

**Kill cleanup flow:** switching to Kill on a row with existing nav assignment (`Sitemap_ID` populated) or redirect destination (`Redirect_Destination` populated) triggers `promptKillCleanup(origIndex)` — a modal asking whether to clear either/both. Helpers `clearNavAssignment(row, origIndex)` and `clearRedirectDestination(row, origIndex)` log each cleared field to the change log. `clearNavAssignment` also calls `updateNavBadge(row)` when the affected row is the currently-selected one, so the audit-bar Sitemap button refreshes immediately. Applies to: single-row KKE button, Final KKE select, the Multi-bar's `kke` → `Kill` action (aggregate modal via `promptBulkKillCleanup`, from `setupMultiBar()`'s Apply handler — rows already Kill are skipped, and cancelling the cleanup cancels the whole action), and Table View `tvStartInlineEdit` for KKE-type columns.

**Consolidate flow:** `Consolidate` is a 5th built-in KKE state. Clicking the button or selecting it via keyboard opens `openConsolidatePicker(origIndex)` — a virtual-scrolled list of every page in the inventory with filter input and sortable headers. `applyConsolidateTarget(origIndex, targetUrl)` sets KKE=Consolidate (only if no Consolidate intent already exists — preserves SME-imposed Final_KKE) plus the **two-column target model** (see below). `clearConsolidateTarget(origIndex)` is the inverse. The redirect resolver in `resolveRedirectDestinations()` and the redirect editor's group-builder both chase the consolidate target (via its identity) through the master's `Computed Path`, chained Consolidates, and explicit redirects (cycle-safe via a visited Set seeded with the source URL).

**Consolidate target = identity + derived display (two columns, issue #1):** the consolidation target is stored as **two columns** to decouple a stable reference from a readable display:
- `_ConsolidateTargetId` (internal, `_`-prefixed) = the master page's **current Address** — the stable *identity*. This is what every engine consumer keys off (`consolidateTargetAddr(row)` reads it, falling back to a legacy `Consolidate_Into` literal for pre-migration / off-inventory rows; `findConsolidateTargetRow(row)` resolves it to the master row). It never changes when the master later gains or overrides its new-site path, so the link survives nav assignment and URL overrides — **no retroactive sweep needed.**
- `Consolidate_Into` (user-facing) = the master's clean **relative new path** — a *derived display* (`consolidateDisplayPath(master)` = master's `Computed Path`, or its current path as a stand-in until placed in the nav tree). `refreshConsolidateDisplay(row)` / `refreshAllConsolidateDisplays()` recompute it from the identity; `resolveConsolidateIntoUrls()` (run before every save) and `cascadeNavChangesToRows()` (once, post-cascade) keep it fresh. **Never authoritative.**

**Consolidate guardrails.** `Consolidate` is the one KKE value that isn't a
finished decision — it says the page goes away without saying where its content
and its redirect go — so three checks sit on the write path:
- **Self-consolidation and cycles are blocked** in `applyConsolidateTarget()`.
  `sameConsolidateUrl(a,b)` is a loose compare (trailing slash / case) used *only*
  by the guards — the stored identity stays the Address verbatim.
  `consolidateChainReaches(startUrl, backToUrl)` walks the chain (cycle-safe) so
  `A→B→A` is refused as well: it is the same defect one step removed, a redirect
  loop plus content that lands nowhere. `openConsolidatePicker()` also excludes
  candidates **by URL**, not just by index, since a crawl can list one Address
  twice and picking the twin would consolidate a page into itself.
- **The target is nudged to Evolve** (`maybeUpgradeConsolidateTargetToEvolve()`,
  run *after* the source row is written so declining leaves the consolidation
  exactly as asked). Receiving another page's content is work, and Evolve is how
  this audit signals work; `Keep` claims the page is unchanged when it no longer
  is, and `Kill`/`Exclude` is a destination being removed. Overridable — an
  auditor may have a reason. It writes `Final_KKE` too when one is already set,
  or "Set to Evolve" would silently do nothing on an SME-resolved row. Skipped
  when the target is already `Evolve`, or is itself `Consolidate` (a chain — the
  cycle and dead-target checks already speak to that).
- **Finding the unfinished ones**: the `_consolidate-no-target` filter and the
  Pre-Handoff Check's "Consolidate pages point to a target" check both predate
  this, but a filter buried in a checkbox list is only found by someone who
  already suspects the problem — so `refreshConsolidateTodoButton()` puts the
  live count in the sidebar (`#btn-consolidate-todo`, hidden at zero, click to
  toggle the filter; same active-state contract as `refreshUnclassifiedButton`).

`effectiveConsolidateUrl(master)` resolves the master's **absolute new-site URL** — used only to write `Redirect_Destination` (redirects always stay absolute). One-time migration in `loadData()` converts legacy projects: for consolidating rows with a `Consolidate_Into` value but no identity, it resolves the stored URL back to its inventory master, stores that master's Address as `_ConsolidateTargetId`, and rewrites `Consolidate_Into` to the relative path (toast + dirty flag; idempotent; off-inventory targets keep their legacy literal). Table View shows a plain-language `COLUMN_HELP` tooltip explaining the `Consolidate_Into` column.

**Consolidation Candidates workflow:** `openConsolidationCandidates()` is a Nav Editor toolbar action (`btn-nav-consolidate-candidates`) that opens a modal listing every nav node with 2+ assigned pages. `buildConsolidationCandidates()` groups rows by `Sitemap_ID`, returns groups sorted by size desc. Each group renders with radio buttons; `applyConsolidationGroup(group, targetOrigIndex)` sets the target to Evolve (preserving Keep/Evolve), the rest to Consolidate pointing at the master (identity `_ConsolidateTargetId` = master Address + derived `Consolidate_Into` display) and clears their nav + explicit redirect. Skipped groups are session-only (a `Set` inside the modal closure).

**Duplicate-destination guard (proactive, single-row):** complements the bulk Consolidation Candidates workflow above by catching the same mistake the moment it happens, rather than requiring the user to run that workflow. `findEvolveDestinationConflicts(origIndex)` returns other rows sharing this row's `Sitemap_ID` that are also Keep/Evolve (empty if this row isn't Keep/Evolve or has no `Sitemap_ID`). `maybeWarnDuplicateDestination(origIndex)` calls it and, if there's a conflict, opens a `confirmDialog` — "Did you mean to Consolidate?" — naming the other page(s); confirming calls `applyConsolidateTarget(origIndex, otherUrl)` (single conflict) or opens `openConsolidatePicker(origIndex)` (2+ conflicts, so the user picks). Hooked from two call sites: the main KKE button click handler (after setting KKE to Keep/Evolve) and `assignNav()`'s direct-assign branch (after assigning an existing row to a node that already has a page — the create-child branch can't conflict since it makes a new Sitemap_ID).

**Consolidate picker "Go to page →":** when the picker (`openConsolidatePicker`) has a `currentTarget`, the "Currently consolidating to" panel includes a button that resolves the target row by URL, closes the picker, closes whichever full-panel view is open (Table/Nav/Redirects/Menus), and calls `selectRow(targetIdx)` — same navigate-to-row pattern the Redirect Editor's clickable title uses.

**Duplicate Sitemap_ID detection:** `detectDuplicateNavIds()` returns `[{ id, nodes[] }]` for IDs assigned to 2+ nodes. `fixDuplicateNavIds()` keeps the first node's ID and renumbers the rest using next-available padded numbers. `renderNavEditor()` shows a red ⚠ link in the toolbar stats when duplicates exist.

**Multi-bar (unified action bar):** `setupMultiBar()` wires the single bottom-of-sidebar action bar that replaces the old `batch-bar` (filtered) and `bulk-bar` (selected). `getMultiBarTargets()` returns the target rows: multi-selected wins; otherwise filtered rows when filters are narrowing the list; otherwise empty. `applyMultiAction(row, origIndex, action, value)` handles each value-driven action (`kke`, `published`, `page-type`, `content-theme`, `group`, `primary-tag`, `add-tag`). Two actions are **not** value-driven and are special-cased in both the `#multi-action` change handler and the Apply click handler — `assign-nav` opens `openBulkNavAssignDialog()`, `delete-rows` opens `openDeleteRowsDialog()` (ahead of the generic confirm, since routing a permanent deletion through "apply value to N rows" would understate it). `updateMultiBar()` shows/hides the bar and updates the label between "Apply to N selected:" and "Apply to N filtered:". The legacy `updateBulkBar` / `updateBatchBar` names are kept as shims so existing call sites keep working.

**Content vs non-content rows (`isNonContentRow()` / `nonContentKind()`):** a crawl is a list of URLs that responded, not a list of pages, and the headline number in a client report has to say which it counts. A stakeholder reading *"~13,000 pages audited"* asks whether they are really migrating ~13,000 pages; the honest answer subtracts the inherited redirects and the dead URLs.

- **Derived from the crawl's `Status Code`, not stored** — so it is correct retroactively in every existing project and needs no decision from the user. A file with no Status Code column reports everything as content, i.e. exactly the pre-existing behavior. `nonContentKind()` returns `'redirect'` (3xx), `'gone'` (4xx) or `''`.
- **5xx is deliberately CONTENT.** A 500 is a page that exists and is broken — Triage Non-200 defaults it to `Evolve` for that reason — so dropping it would hide real work rather than reveal padding. Only 3xx (a signpost to somewhere else) and 4xx (gone) are non-content.
- **Orthogonal to KKE.** `Exclude` is a person's decision about scope; this is a fact about what the URL returned. Keeping the axes separate is what lets a report say "~6,500 content pages, 2,000 of them being killed, *plus* ~4,100 inherited redirects" instead of blurring them into one inflated total.
- **`gatherProgressStats()` returns BOTH readings** — the existing all-rows keys are untouched (`total`, `reviewed`, `pct`, `kkeCounts`) and content-only ones are added (`contentTotal`, `contentKkeCounts`, `contentReviewed`, `contentUnreviewed`, `contentPct`, `nonContent`, `nonContentRedirects`, `nonContentGone`). Both are legitimate and answer different questions: **auditor progress covers every row** (a redirect still has to be triaged), **the client's inventory is content only**. Consumers pick the one they mean rather than one number silently standing for both.
- **Sections are tallied twice on purpose** — `groups` (all rows) backs the progress dashboard's *By group*, which must agree with the auditor's own all-rows total; `contentGroups` backs the Executive Summary's *By Section*, which says "N pages" to a client and must agree with the content-page figure above it. A single tally would contradict whichever surface it wasn't built for.
- **`reportExecutiveSummary()` is entirely content-only** — headline, KKE bar, `kkeStatsRows`, the findings percentages, and *By Section*. It leads with `URLs crawled` → `— existing redirects (3xx)` → `— not found / gone (4xx)` → `Content pages audited`, plus a note explaining the exclusion, and all of that appears **only when non-content rows exist** so a clean 200-only inventory renders exactly as before. Without this the Kill percentage on a real higher-ed crawl reported 66% when the content answer was 31%.
- The progress dashboard shows the split beneath its (unchanged) all-rows total. Sidebar filters `_inherited-redirect` and `_non-content` are how you check a reported figure against the rows. Covered by `test/content-counts.test.js`.

**Permanent row deletion (`delete-rows` Multi-bar action):** the only destructive operation in the app — everything else edits a cell, and a crawl export otherwise round-trips losslessly. It exists because a crawl arrives with rows that aren't pages (a stray export, a merge that doubled a section) and the alternative is round-tripping through Excel, which loses the audit columns and the change log.

- **`deleteRows(origIndexes)`** splices BOTH `state.rows` and `state.editedRows` (index-parallel — `editedRows` is a clone of `rows` and `addNewRow()` pushes to both), **descending**, since splicing low-to-high shifts the indices still to be removed.
- **The undo stack is CLEARED, not remapped, and that is the load-bearing decision.** Every undo entry addresses its row by `origIndex` — the field-edit actions directly, and the `'bulk-edit'` / `'nav-delete'` snapshots inside their `items` lists. A splice silently re-points all of them, so undoing afterwards would write an old value into a *different* row and report success. Remapping means reaching into three action shapes and dropping entries for deleted rows; getting it subtly wrong is silent corruption in a client audit. `state.multiSelected` and `_globalSearchMatches` are cleared for the same reason; `state.selectedIndex` is shifted down by the count of deletions above it, or nulled if its own row went.
- **Each deletion is change-logged** (`field: '(row deleted)'`, `from`: the URL) **before** the splice — `logChange()` reads the row out of `state.editedRows` by index and has nothing to read afterwards.
- **`deleteRowsImpact()` reports what the deletion BREAKS**, which is the part a row count can't convey: survivors whose `_ConsolidateTargetId` points at a doomed row (computed against survivors only — a target deleted *alongside* its sources is a section going away, not a dangling reference), plus counts of doomed rows that are sitemap-placed, carry a KKE decision, or carry a redirect destination.
- **`openDeleteRowsDialog()`** gates on typing `DELETE_ROWS_PHRASE` (`'PERMANENTLY DELETE'`); the `.btn-danger` primary stays `disabled` until it matches, so the modal-stack's Enter-to-primary can't fire it early. The dialog states whether the target set is the selection or the current filter — the Multi-bar's "filtered rows when nothing is selected" default is a much bigger deal for deletion than for setting a field. Covered by `test/delete-rows.test.js`.

**Bulk sitemap assignment (`assign-nav` Multi-bar action):** unlike the other actions, this one has no value dropdown — picking it and clicking Apply opens `openBulkNavAssignDialog(targets, onDone)` directly (special-cased in both the `#multi-action` change handler and the Apply click handler). Eligibility defaults to `effectiveKke(row)` (`Final_KKE || KKE_Recommendation`) being `Keep`/`Evolve` — mirroring `createSitemapFromAudit`'s own gate — with an `_bna-include-all` checkbox ("Include Kill / Exclude / unreviewed pages too") to opt into everything else; this is the path for building a "current state" sitemap snapshot that intentionally includes killed/consolidated pages. Regardless of that checkbox, if any eligible row's effective KKE is `Consolidate`, one batched `confirmDialog` ("Include Consolidate pages?") asks before they're swept in — declining drops just those rows from the run. The dialog opens with an optional **Suggested** banner (only shown when found) computed by `suggestBulkNavTarget(eligibleTargets)` — the bulk equivalent of the per-row Sitemap picker's auto-suggestion: it runs `suggestNavFromUrl()` (walk each page's URL up to the nearest ancestor page that's already assigned to a node) across every eligible target and offers whichever node the most of them agree on, with a `(N of M pages…)` count; **Use this** one-click-accepts it via the same `pickExistingNode()` path as manually picking. Below that, the dialog offers two ways to choose a destination: **pick an existing node** (reuses `showMenuNodePicker()` verbatim) or **create a new bucket** (a label input + optional parent picker, also via `showMenuNodePicker()`; blank parent = a fresh top-level node). `createBucketNode(label, parentNode)` makes the bucket — a child via the existing `createNavChildForPage()` when a parent is given, or a hand-built root node (mirroring `addNavRootNode()`'s shape) when not — deduping its slug against its siblings either way (`uniqueSiblingSlug()`, case-insensitive, alias/ref nodes excluded from the collision check, appends `-2`/`-3`/…). A placement-mode radio then picks how pages land under that destination: **Direct children** (default, unchanged) calls `bulkAssignRowsToBucket(targets, bucketNode)`, which creates one child node per target row under the bucket via `createNavChildForPage()`, deriving each child's slug from `extractSlug()` on the row's URL (deduped the same way) and its label from `extractPageTitle()` on `Title 1`/`Title` (falling back to the slug when blank) — the same URL-suggestion building blocks `suggestNavFromUrl()`/`createNavChildForPage()` already used for the single-row case, just looped. **Preserve URL structure** instead calls the new `bulkAssignRowsPreservingUrlStructure(targets, rootParent, maxDepth)` — mirrors `createSitemapFromAudit()`'s per-row segment-walk (`urlPathSegments` → nested `findOrCreateBucketNode()` calls → `assignRowToNodeDirect` or overflow into `bulkAssignRowsToBucketCore`), but seeded from the chosen destination (`rootParent`) instead of always starting at the true top level. Rows that already carry a `Sitemap_ID` are skipped (reported in the completion toast) — this is about fast initial placement of unplaced pages, not reorganizing existing ones; reorganize afterward with the Sitemap editor's drag-and-drop. No per-row `logChange()`, matching `assignNav()`'s existing single-row assignment (Sitemap fields aren't change-logged there either).

**Create Sitemap from Audit (Project → Create Sitemap from Audit…, `menu-create-sitemap-from-audit` IPC):** auto-generates a starter sitemap tree from the audit's own URL structure — a thin automation layer over the bulk-assign primitives above, not a second placement engine. `openCreateSitemapFromAuditDialog()` shows the eligible-row count (reactive to the include-all checkbox), a **Bucket depth** select (1–4, default 2), and an **Include Kill/Exclude/unreviewed pages too** checkbox (default off — same Keep/Evolve gate as the `_needs-placement` filter); if a sitemap already exists it shows a banner clarifying the tool only merges, never replaces. It also asks **what the tree is for** — *where pages are going* (default) or *where pages are today* — because that answer, not the tree's shape, is what decides whether deriving redirects from it means anything. Choosing the snapshot reveals a note explaining that placing a page writes its `Computed Path` and the resolver derives a redirect from it, plus a **Save a copy first…** button routed straight to `saveAsProject()` (which switches the session to the copy — exactly the intent: build the snapshot there, export from it, reopen the original). Asking the purpose beats warning about the mechanism: a warning nobody can act on is noise, and this one has a button. The flag is **not** persisted and does not change what `createSitemapFromAudit()` does — with provenance in place (B/C) the fossils are already prevented; this is about not manufacturing meaningless redirects in the first place. `createSitemapFromAudit({maxDepth, includeAllRows})` does the work: for each eligible row (unplaced, has a URL, KKE-gated unless `includeAllRows`), walks up to `maxDepth` of `urlPathSegments(url)` as nested buckets via `findOrCreateBucketNode(titleCaseFromSlug(seg), parent)` — find-or-create by label (case-insensitive), so pages sharing a path prefix land under the same section on repeated runs instead of duplicating it. If the row's full path fits within `maxDepth`, it's assigned **directly** to the deepest bucket reached via `assignRowToNodeDirect(row, node)` (no synthetic child) — this is what makes a landing page like `/about` merge into the very node that `/about/team` also nests under, regardless of which row is processed first: `findOrCreateBucketNode` returns the same node either way, and a node can be both a page and a container for its children like anywhere else in this data model. Rows whose path exceeds `maxDepth` fold the remaining depth into one leaf child instead — collected per deepest-bucket-reached into an `overflowByNode` map and run once each through `bulkAssignRowsToBucketCore()` (the refresh-free half of `bulkAssignRowsToBucket`, split out for exactly this — batching many buckets in one pass without a UI refresh per bucket).

The dialog also **predicts the tree before building it** (`predict(includeAll)` — tallies distinct first URL segments over the eligible rows, live on the include-all toggle). This is the cheapest place to catch a flat site, and it surfaces the one thing a user cannot infer: **bucket depth does not change the section count**, because sections come from the *first* segment. When the prediction trips `SITEMAP_MANY_ROOTS` it offers "put single-page sections under one section named …", which runs `groupNavRootsUnderBucket()` in the same step so what lands is a tree that opens. Whatever the outcome, a post-run `sitemapShapeNeedsAttention()` check opens the shape check rather than leaving the discovery for the moment they click Visual Sitemap.

**Hub node → content workflow:** hub nodes (children have assigned pages, node itself has none — the `isHub` "NEW" badge) already had visualization/reporting; two additions close the loop from "review" to "content in the pipeline." **Mark content status:** `openNavNodeEditor()` shows an amber "Net New" banner (only when `isHubNode` — same predicate as the tree's `isHub`, computed via `hasDescendantPages(node, _navPageCountsCache())`) pointing at the existing Build section's `Page_Status` field rather than duplicating a second bound control — one source of truth for the status. **Promote to a real page:** the banner's **Create Page** button, and a `.ne-net-new-badge` tooltip hint in the tree, both call `promoteHubNodeToRow(node)` — builds a blank row from `state.headers`, sets the URL to `getRedirectBaseUrl() + '/' + node.computedPath` (guards against an existing row at that URL), `Title 1`/`Title` = the node's label, `KKE_Recommendation = 'Keep'`, tags it `net-new` (added to `state.tagLibrary` if new), pushes to **both** `state.rows` and `state.editedRows` (the same pattern the existing "New Page" sidebar button — `addNewRow()` — already uses; `state.rows` isn't actually immutable, just never *edited* in place), then `assignRowToNodeDirect()`s it to the node. No new "promoted" flag is needed — once the node has a direct page, `isHub`/`hasDescendantPages` naturally stop flagging it as net-new on the next render, in the tree and in every report/export that already computes hub status live (Net New Content Brief, Migration Tracker's Net New column).

**Field filter (arbitrary-column sidebar filter):** `state.fieldFilters = [{field, operator, value}, ...]`. `applyFilter()` AND-applies them to rows after the existing text/KKE/group filters. `openFieldFilterPopup()` builds the field/operator/value picker; operators include `is-blank`, `is-not-blank`, `contains`, `not-contains`, `equals`, `not-equals`, `starts-with`, `ends-with`, `greater-than`, `less-than` (`fieldFilterMatches(row, ff)` does the comparison). The two **ordering** operators are the only ones that aren't a case-insensitive text test: `fieldFilterCompare()` compares numerically when BOTH sides parse as numbers (`fieldFilterNumber()` strips comma grouping, since crawl and analytics exports write `1,234`) and otherwise falls back to a raw code-unit — i.e. ASCII-order, case-**sensitive** — string compare; folding case there would put `'Z'` on either side of `'a'` depending which got folded. A blank cell matches **neither** direction (blank is unreviewed throughout this app, not "smaller than everything"). Covered by `test/field-filter.test.js`. Active filters render as removable chips via `renderFieldFilterChips()`. Saved filters serialize fieldFilters alongside text/KKE/group.

**Non-200 Status Code Triage** (`Project → Triage Non-200 Pages…`, `menu-non200-triage` IPC): `openNon200TriageDialog()` groups `state.editedRows` by HTTP status code using `statusCodeCategory()` (returns `'3xx'`, `'4xx'`, `'5xx'`, or `null`) and `STATUS_CODE_LABELS` (maps common codes to human-readable labels). Renders a table: one row per code group with code + label, row count, and a KKE action dropdown pre-populated by `defaultTriageAction(code)` (sensible defaults: 3xx → Kill, 404 → Kill, 5xx → Exclude, etc.). "Apply" batch-sets KKE for all rows in each group that have a non-blank action selected. `maybeOfferNon200Triage()` is called at the end of `loadData()` and auto-offers the dialog when non-200 rows are present. Sidebar rows render a `.row-sc-badge` span with class `.row-sc-3xx` (amber) or `.row-sc-4xx` / `.row-sc-5xx` (red) when the row has a non-200 status code. Wired in `main.js` Project menu; `preload.js` exposes `onMenuNon200Triage: (cb) => ipcRenderer.on('menu-non200-triage', () => cb())`.

**Modal node editor:** `openNavNodeEditor(node)` opens a full property editor (Label, Slug, In Menu, External URL, **Phase**, **Notes**) with read-only context (Number, ID, parent, breadcrumb, computed path, page count). Save calls `onNavNodeEdit` for label/slug (so paths cascade through `recalcDerivedFields`), then directly assigns `inMenu` / `url` / `notes` / `phase` and triggers `state.navTreeDirty + setDirty(true)`. Live preview updates breadcrumb/computedPath as user types. Delete uses `executeDeleteNavNode` with reassignment options.

**Phase property on nav nodes:** `node.phase` is a string (empty = current build, otherwise `'Future'`, `'Stretch'`, `'Archived'`, or any custom value). Stored in Sitemap's `Phase` column (added on first save if missing). The render path adds `ne-row-phase` class + `data-phase` attribute for styling, and prepends a `ne-phase-badge` pill in the count cell. Phase filter `#nav-phase-filter` ('__current__' = empty phase only, '__nonblank__' = phased only) hides nodes via `return document.createDocumentFragment()` from `renderNavEditorNode`. On export, `showPhaseExportPrompt(phasedCount)` asks whether to include phased nodes; the user's choice is passed to main as `includePhase`.

**Node notes:** `node.notes` is markdown stored in Sitemap's `Notes` column. Surfaced as a hover `title` on the label input, and `ne-cell-has-notes` class drops a small `·` indicator. Edited only via the modal node editor.

**Sanitizer:** `sanitizeText(s)` strips multi-character mojibake (curated `_MOJIBAKE_MAP`), HTML entities (curated `_ENTITY_MAP`), control whitespace (VT/FF/NEL/LSEP/PSEP), NBSP, zero-width chars + soft hyphen, then collapses whitespace and trims. `attachSanitizer(el, onCommit)` wires paste + blur on text inputs/textareas. Used on nav editor label/slug inline inputs, and the modal node editor's Label/Slug/Notes textareas. Single-character accented Latin chars (`é`, `ü`) are deliberately not touched — only multi-character mojibake patterns get rewritten.

**Page Type / Content Theme libraries:** `state.pageTypeLibrary` (global, prefs-persisted, seeded with ~20 defaults on first run) and `state.contentThemeLibrary` (per-project, in `state.projectSettings.contentThemeLibrary`). Both populate via `populatePageTypeSelect` / `populateContentThemeSelect` with a `+ New …` option that runs `showPrompt`, sanitizes the value, and adds it to the appropriate library. **Content Type ↔ Registry two-way sync:** the dropdown vocabulary is global but the crosswalk is per-project, so `+ New content type…` *also* seeds a blank `ContentTypeRegistry` stub into `state.projectSettings.contentTypeRegistry` — guarded by `lookupContentTypeRegistry(val)` so it never duplicates a name already covered (exact or split). Keeps the dropdown and the crosswalk from drifting apart.

SME audit fields (SME_Decision, Final_KKE, Content_Owner) are wrapped in `#sme-fields-wrap` which uses `display: contents` when visible. Hidden by default; toggled via `state.showSmeFields` (persisted in app prefs).

KKE states: `''` (blank = not reviewed), `'Keep'`, `'Kill'`, `'Evolve'`, `'Consolidate'`, `'Exclude'` plus any user-defined custom states.

Tags are stored as a comma-separated string in the cell, e.g. `thin-content, outdated`.

---

## Preferences (prefs.json)

Stored in `app.getPath('userData')/prefs.json`:

```json
{
  "lastFile": "/path/to/file.xlsx",
  "visibleFields": ["Title 1", "Status Code", "Indexability Status", "Redirect URL"],
  "tagLibrary": ["thin-content", "outdated", "evergreen", ...],
  "showSmeFields": false,
  "customKkeStates": []
}
```

`visibleFields` — controls which headers appear in `#field-bar-top`. Excludes audit columns (KKE/Tags/Notes) which always appear in `#field-bar-audit`.

`tagLibrary` — the full vocabulary shown in the tag dropdown. User can create new tags on the fly; they are appended and persisted.

---

## URL auto-detection

`detectUrlColumn()` in `main.js` checks header names against:
```
['address', 'url', 'link', 'website', 'href', 'uri']
```
`Address` is listed first — it's the default in Screaming Frog exports. If no match is found, the renderer shows a column picker.

---

## Editable vs read-only fields

In `renderMetaFields()` (renderer.js), the `editableFields` Set controls which fields render as editable `<input>` vs read-only display:

```js
const editableFields = new Set([
  'Title 1', 'Meta Description 1', 'H1-1', 'H1-2', 'H2-1', 'H2-2'
]);
```

Add headers to this set to make them editable. Everything else is read-only.

---

## Data flow

### Open file
1. `openFileDialog()` in main → SheetJS reads file → injects audit cols if missing
2. `file-opened` event → `loadData()` in renderer
3. `visibleFields` filtered to only headers present in this file
4. `applyFilter()` → `renderRows()` → `renderColHeaders()`

### Select row
1. `selectRow(origIndex)` → shows `#content-area`
2. `renderMetaFields()` populates `#field-bar-top`
3. `populateAuditFields()` populates KKE select + tag chips + notes textarea
4. `loadUrl()` sets `webview.src`
5. `updateNavControls()` updates ← position / total →

### Navigate prev/next
1. `navigateRow(±1)` finds current position in `filteredRows`
2. Calls `selectRow(filteredRows[newPos].origIndex)`

### Edit a field
- Meta fields: `input` event → `editedRows[origIndex][field] = value` → `setDirty(true)`
- KKE: `change` event on `#kke-select`
- Tags: add via dropdown → `setRowTags()` → `renderTagChips()`
- Notes: `input` event on `#notes-textarea` (in popover)

### Save
1. `resolveRedirectDestinations()` populates `Redirect_Destination` for all Kill/URL-changed pages
2. `saveFile()` → `electronAPI.saveFile({ headers, editedRows, changeLog? })`
3. Main strips `_rowIndex`, writes xlsx via SheetJS, appends `_sessionChangeLog` entries to `KKE_ChangeLog` sheet
4. `save-success` event → `setDirty(false)` + toast

### Change logging
`logChange(origIndex, field, oldVal, newVal)` pushes an entry to `_sessionChangeLog` (a module-level `const` in renderer.js — **not** `state._sessionChangeLog`; see the State object section). Called automatically when KKE_Recommendation, SME_Decision, or Final_KKE changes. On save, entries are appended to the `KKE_ChangeLog` sheet and `_sessionChangeLog` is cleared.

---

## Full-panel views

Three full-panel views replace `#content-area` in `#main-panel`. All three hide the sidebar and go full-width using the `.tv-active` class on `#app`. All views are accessible via the View menu: Audit View (Cmd+1), Table View (Cmd+T), Sitemap (Cmd+Shift+T), Redirect Editor (Cmd+Shift+R).

### Sitemap editor (`#nav-editor`)
**Cmd+F in the Sitemap** searches nav nodes instead of audit rows: when `_navEditorOpen`, `globalSearchUpdate()` calls `navSearchMatches(query)` (matches label / breadcrumb / number / computedPath / path / url / notes / buildPattern / pageStatus / assignees, in `sortNodesForNavigation` order; only nodes currently present in `#nav-editor-body` so active Phase/Build/Depth filters are honored) and stores `[{nodeId}]`. `globalSearchNavigate(±1)` routes to `scrollToNavNode(id)`, which expands collapsed ancestors (re-render if needed), scrolls the row into view, and applies `.ne-row-search-current` (+ flash `.ne-row-highlight`); `clearNavSearchHighlight()` clears it on close/empty query.

Toggled via the **Tree** button. Hides sidebar via `.tv-active` class. Full tree with inline editing of labels and slugs, drag-and-drop reorder/reparent, add/delete nodes. Changes cascade to audit rows (`Sitemap_Destination`, `Computed Path`, `Sitemap_SortID`). On save, sends `allNavNodes` for full `Sitemap` sheet rewrite. Column widths are resizable via drag handles. The Node column (`.ne-left`) uses `flex:1` to absorb extra window width. **Clone branch** (⧉ button) deep-clones a node and all children as a sibling (structure only, no page assignments; top-level clone gets "(copy)" suffix). **Fold state** (`state.navFoldState`) persists collapsed/expanded state across re-renders. Nav changes snapshot old paths before recalculation to preserve page suffixes during moves. Supports a **Collapse** column (per-node sitemap collapse flag — the legacy InMenu checkbox/column + Set/Clear-Menu buttons + node-editor toggle were all repurposed to `node.collapse`; `inMenu` data is preserved for round-trip but no longer edited in the UI) and **duplicate slug detection** via `buildDuplicateSlugSet()`, `refreshDuplicateSlugHighlights()`, and `navSlugExistsInBranch()` which highlight conflicting slugs within the same branch. **Net new badge**: nodes with child pages assigned but no direct pages show a yellow "NEW" badge (`.ne-net-new-badge`) in the Pages column; row has a subtle yellow tint. Stats bar shows "X net new" count. **External URL**: nodes can have an external URL assigned (stored in `URL` column of Sitemap sheet); shows link icon in Pages column and URL in blue italic in Computed Path. **Depth filter**: dropdown filters tree to a specific depth; the **"Collapse"/"Expand"** buttons set/clear `node.collapse` on all visible nodes. **Pages column indicators**: link icon (external URL), arrow (reference to another node), NEW (net new), empty circle (empty leaf), or numeric count (clickable). **Reference picker**: 880px wide dialog with hierarchical sort by sortID, depth indentation, bold top-level nodes; number search matches from start, text search matches anywhere.

**Bulk multi-select + delete:** each row gets a checkbox (`.ne-col-select`, in `leftSection` right after the collapse `.ne-toggle`, before the number cell) bound to `state.navMultiSelected` (a `Set` of node ids). Plain click toggles one node via `setNavNodeSelected(nodeId, selected)`, which updates the Set and syncs that row's checkbox + a `.ne-row-selected` highlight directly in the DOM — no full `renderNavEditor()`, so scroll position and collapse state survive repeated clicks. Shift-click range-selects using `Array.from(document.querySelectorAll('#nav-editor-body [data-node-id]')).filter(el => el.offsetParent !== null)` — the `offsetParent !== null` filter is required: `renderNavEditorNode` always builds a collapsed branch's DOM (collapse is CSS-only, `.ne-children{display:none}`), so an unfiltered query would silently sweep hidden descendants into the range. A header checkbox (`#nav-select-all-visible`, inside the existing `.ne-col-hdr.ne-left` span) toggles every currently-visible id via `toggleNavSelectAllVisible()`. `renderNavEditor()` prunes `navMultiSelected` of any id no longer in `state.navNodes` on every render and calls `updateNavMultiBar()`, which shows/hides `#nav-multi-bar` (mirrors the sidebar's `#multi-bar`) with a live count + **Delete Selected…** / **Clear Selection**. **Select Empty Branches** (toolbar) walks `state.navTree` top-down via `_navPageCountsCache()` + `hasDescendantPages()`, selecting the topmost node of every branch with zero pages anywhere in its subtree without recursing into an already-selected empty branch's children. `bulkDeleteNavNodes(nodeIds)` prunes the selection to top-level-only (`isNavDescendantOf(n, other)` with an explicit `other !== n` guard — `isNavDescendantOf(X,X)` returns `true`, so omitting the guard would prune the whole selection to nothing), shows one `confirmDialog` covering the total node/page count, then runs `'delete-all'` + `'clear'` per pruned node, folding every node's undo snapshot into ONE combined `pushUndo` call.

**Delete undo (`'nav-delete'` actions):** `executeDeleteNavNode(node, mode, assignAction, reassignTarget)` — the shared wrapper behind the tree-row ✕, the node editor's own Delete button, and the "clear assignment + delete now-empty node" checkbox flow (all three funnel here; there is no other delete path) — captures a snapshot via `captureNavDeleteUndoSnapshot(node, mode)` before calling `executeDeleteNavNodeCore(...)` (the same logic, minus the final `renderNavEditor()`) and pushes one `{type:'nav-delete', items:[...]}` action. Each item keeps a **real reference** to the deleted node (not a clone — `cloneNavBranch()`'s hardcoded-field clone is a known way to silently drop extension fields, so cloning here would reintroduce that bug class) plus `parentId`/`wasRoot`/`index`/`mode`/`promotedCount` and the pre-mutation values of the 5 Sitemap fields on every affected row. `applyUndoAction()` branches on `action.type` before falling into the pre-existing KKE-only field-edit path. Undoing runs three preconditions per item before touching the tree — abort-with-toast (not silent corruption) if any fails: **(1)** no live node already has this id or (for delete-all) any descendant's id, since every id allocator scans current `state.navNodes` for its max with no persistent high-water mark, so a deleted id can be reused immediately by an unrelated create; **(2)** the parent still exists (`wasRoot` disambiguates "legitimately root" from "parent since deleted" — the latter must abort, never silently fall back to top-level); **(3)**, promote-mode only, every promoted child is still exactly where the delete left it (`_findNavNodeLocation` against the expected siblings array + index) — an ordinary drag/edit/delete on a promoted child in the meantime doesn't know or care about a pending undo snapshot, so splicing at a stale remembered index without this check risks displacing or deleting an unrelated node. Redo re-invokes `executeDeleteNavNodeCore` per **successfully-restored** item only and replaces `action.items` with fresh snapshots in place (the generic `redo()` already re-pushed the same action object onto `_undoStack`; mutating its `items` — rather than pushing a new stack entry — is what keeps that one slot accurate across repeated undo/redo cycles).

**Visual Sitemap (engine in `src/sitemap-template.js`):** the D3-in-a-hidden-window renderer is **retired**. Both sitemaps now share one interactive box-tree engine. `window.SitemapTemplate.build(data)` returns a **complete, self-contained HTML document** (CSS + an engine authored as a real function and inlined via `Function.toString()`, plus a JSON data blob on `window.__SITEMAP_DATA__`). It is reused for three surfaces by a `mode` flag:
- `'app'` — the live in-app view. Runs inside an Electron **`<webview src="data:…">`** in a `94vw` `openModal` (a webview is its own context, free of the app's `script-src 'self'` CSP — which forbids the inline scripts/eval an in-document render would need). The webview reports state/export/saveDefaults back to the host as tagged `console.log` lines (prefix `@@SITEMAP@@`) caught on the webview's `console-message` event.
- `'client'` — the client-shareable export: same engine, view/explore controls only (no settings panel, context menu, or export buttons), persists the viewer's collapse/numbers to `localStorage`. Written via `save-text-file`.
- `'print'` — static, lays out flush at 0,0, injects a dynamic `@page { size: … }` sized to the canvas, then flips `document.title='READY'`. The `export-sitemap-pdf` IPC loads it in a hidden window and `printToPDF({ preferCSSPageSize:true })` → one page sized to the tree.

The engine ports the `visual-sitemap-v15` prototype: per-node **horizontal vs vertical** auto-layout driven by two thresholds (**Vertical from depth** `vertDepth`, **or if children ≥** `childThresh`; whichever fires first; `99` = off), with a per-node right-click **context menu** to force horiz/vert or set a node color. Collapse/expand per node (stacked "has sub-pages" shadow), pan/zoom/fit, numbering toggle. **Color** resolves as: per-node override > first matching **color rule** > fallback. Rules (`{condition:{type:'depth'|'depthRange'|'parentId'|'value'|'external'|'field'|'always'}, color}`) are edited in the Settings panel's **Colors** tab (drag-reorder, add/delete, generators "by depth" / "by top-level section" / **"Mark external links"** / **"Color by field"**; each nav node carries `colorValue` = its top-level section label so value-rules tint whole subtrees — `navSectionRoots()` decides what counts as a section, see below). The `external` condition type matches `node.external` — stamped `true` for nav nodes with an external `url` set and for menu items of `kind:'link'` — so links pointing off-site can be colored distinctly regardless of section/depth. The **"Mark external links"** button (`renderColorsTab()`/`wireColorsTab()` in `src/sitemap-template.js`) inserts a single `{type:'external'}` rule at the very top of `colorRules` (so it wins over any existing depth/section scheme) rather than replacing the whole rule set like the other two generators; a duplicate-guard skips re-adding if one's already present.

**Sitemap shape check (`computeSitemapShape()` / `projectSitemapShape()` / `openSitemapShapeCheck()`):** a sitemap can be structurally valid and still be undrawable, and the tree that produces it is the *normal* output of `createSitemapFromAudit()` on a flat site. Deriving hierarchy from URL segments only yields an IA if the URLs carry one; a flat WordPress site (every article at `/some-long-slug`) yields one top-level section per page. A real audit: ~1,900 rows → **548 top-level sections**, 549 distinct first URL segments of which 461 held a single page. That is an IA *finding*, not a bug — but the app used to report it as a blank viewport.

- **`measureSitemapLayout(roots, collapsedIds)` runs the REAL engine** (`window.SitemapLayout`, the pure module the webview and Miro exporter share) rather than estimating, so the size quoted is the size that renders — verified against a live DOM at ~38,000 × 105,000. It returns **`fitScale: null` when it cannot measure**, never `1`: a missing layout module reporting "fits at 100%" would make the check confidently declare a 105,000px tree healthy. `sitemapFitVerdict(null)` is `null`, and `sitemapShapeNeedsAttention()` falls back to `SITEMAP_MANY_ROOTS` (40).
- **Three buckets, each with a repair**: `singletons` (childless roots with ≤1 page — counted over *all* assigned rows including Kill/Consolidate, since this is a question about the tree's shape, not about what survives), `artifacts` (roots whose slug is in `SITEMAP_ARTIFACT_SLUGS` — tag/category/author/wp-*), `wide` (≥12 direct children, not already collapsed).
- **`projectSitemapShape(shape, keys)` is the load-bearing half.** It measures the hypothetical result of the ticked repairs **without mutating anything**, and the modal re-renders it on every checkbox change. On the audit above, all three repairs together still left 88 sections at 2.4% — so a dialog that only *offered* fixes would have implied a cure it cannot deliver. The check says so explicitly and always offers "Open the diagram anyway".
- **The grouping bucket is created collapsed (`bucket.collapse = 'Y'`), and this is not cosmetic.** A depth-0 node lays its children out in ONE horizontal row (the engine's vertical flip needs `depth >= 1`), so an *expanded* bucket of 456 sections produced an ~86,000px-wide canvas — moving the problem from height to width and improving the fit from 0.7% to 1.7%, i.e. not at all. Guarded by a test.
- **`withSiteRoot` answers "did we forget a root node?" by measuring it**, because the answer varies: on the audit above a site root gave ~106,000 × 17,000 (1.4% vs 0.7%) — a better aspect ratio, still unreadable. The modal reports the real numbers and only claims it helps when the measured fit clears `SITEMAP_FIT_CROWDED`.
- **Surfaces**: the nav stats bar (`computeSitemapShape({measure:false})` — the cheap path, because `renderNavEditor()` runs on every edit), a preflight in `generateNavSitemap()` (skippable via `{skipShapeCheck:true}`), and a live prediction inside `openCreateSitemapFromAuditDialog()`.

**Grouping undo (`'nav-group'` actions):** `groupNavRootsUnderBucket(nodes, label)` moves top-level sections under one new bucket as ONE undoable step — restructuring hundreds of sections by hand is not a thing anyone will do, so it has to be reversible. The reversal is exact because the source is always known: every moved node came from the top level at a recorded index (read *before* any mutation; `createBucketNode` appends at the end, so creating the bucket first doesn't disturb them), and the bucket is a node this function created. Following the `'nav-delete'` precedent the undo item holds a **real reference** to the bucket, not a clone. `undoNavGroup()` re-splices ascending (so each recorded index is valid as earlier ones refill), skips any node the user has since moved elsewhere, and only removes the bucket if it is empty again. `applyGroupNavRoots()` is shared by the forward op and redo so the two can't drift. `navStructuralRecalc(oldPaths)` is `moveNavNode()`'s tail extracted verbatim.

**Generic "color by field" rule (`type:'field'`):** the engine has **zero built-in knowledge** of which node fields are colorable — the host declares them via `DATA.fieldDefs = [{key, label, valueLabels?, valueColors?}]`, and every node carries its raw values on `node.fields` (stamped by `navToSitemap()` in renderer.js: `phase`, `nodeType`, `pageStatus`, `buildPattern`, `buildAssignee`, `writeAssignee`, `migrateAssignee` — see `navSitemapFieldDefs()`). Adding a new colorable dimension is a one-line change in `navSitemapFieldDefs()` + `navToSitemap()`'s `fields` object; nothing in `src/sitemap-template.js` needs to change. `matchesRule` checks `node.fields[c.field] === c.value`; `distinctFieldValues(key)` scans the live tree for every value actually present (including blank, so coverage gaps like "no Page Status set" are visible) to drive both the **Colors tab**'s field-select + "Color by field" button and the **+ Add rule** dialog's "A specific field value" option. `valueLabels` overrides display text for a raw value (e.g. blank `nodeType` → "Page"); `valueColors` lets a field reuse colors already assigned elsewhere in the app instead of cycling the generic palette — `pageStatus` uses this to pull each status's color straight from `state.pageStatusLibrary`, so the sitemap and the rest of the app agree on what "Published" looks like. Menus don't carry any of these fields, so `generateMenuSitemap()` simply omits `fieldDefs` and the engine hides the field-select UI entirely whenever the host declares none.

Settings panel also has **Layout** (card/gap px) and **Legend** (editable labels) tabs, plus **Save as my defaults** / **Reset to defaults**.

**Fit-to-screen must never centre an axis that overflows.** `fitToScreen()` clamps the fit scale to `MIN_FIT = 0.02` (not the old `0.10`) and centres **per axis only where the content fits**, anchoring at `margin` otherwise. Both halves are load-bearing and the bug they fix was silent: a 548-root tree lays out ~38,000 × 105,000 px, the fit was clamped *up* to 0.10, and the canvas was then centred horizontally (`tx = (vw − canvasW·scale) / 2 = −1255`), which pushed every card off the left edge. Measured against a live render: **0 of 1,755 cards inside the viewport** — the diagram read as "never built". The y-axis always had the `Math.max(margin, …)` guard; x never did. `zoomFloor()` (wheel zoom) is `max(MIN_FIT, min(0.10, fitScale))` so scrolling out can always reach what Fit shows — a fixed 0.10 floor would strand a tree that fits at 2%. See `computeSitemapShape()` for the host-side half.

**Card sub-label — `countMode` (supersedes the `showCounts` boolean).** The line under a card's label answers one of several questions, chosen in the toolbar's **Counts** select and persisted per project (and per app default) alongside the layout settings:
- `'collapsed'` (**default**) — nothing on an expanded card; a collapsed one reports its **descendant node count** (`"6 pages hidden"`). This is the question a folded diagram actually raises, and the answer is a *node* count, not an audit-row count — the sitemap's own boxes are what's hidden.
- `'subpages'` — that same descendant count on every parent, collapsed or not (`"15 sub-pages"`).
- `'pages'` — the legacy behavior: the host-provided `node.sub`, i.e. the node's **directly-assigned audit rows** (`_navPageCountsCache()`, Kill/Consolidate excluded). Kept because some auditors work that way.
- `'off'` — no sub-label at all.

A collapsed card reports what it hides in *every* mode but `'off'` — matching the Miro exporter, which has done this since it shipped (`countMiroDescendants`). Engine-side, `subTextFor(node)` resolves the text and `descendantCount()` memoizes the walk for the life of the view (ROOTS never changes; collapse only changes what's drawn). `buildMiroSitemapPlan()` reads the same mode so a board matches the screen.

**Reading the mode is deliberately two-step (`sitemapCountMode(...tiers)` in renderer.js, `normalizeCountMode()` in the engine).** Both take the RAW stored tiers, never a defaults-merged object: `S`/`sitemapAppDefaults()` carry `showCounts: true`, which would mask a project's stored `false`. A stored `countMode` wins; failing that, only an explicit `showCounts === false` is honored (→ `'off'`), because *every* project that has ever opened the sitemap has `showCounts: true` persisted — treating that as "assigned pages" would pin every existing project to the legacy mode forever. `showCounts` is still written on save so an older build can still read the file.

`generateNavSitemap()` can wrap the tree in **one synthetic site root** (label = siteDomain/client) whose children are the nav top-levels; each nav node → `{id,label,sub:"N pages",colorValue:topSection,menu:!phase(→dashed),collapsible,stacked,children}`; `collapse:'Y'` nodes seed `initialCollapsed`. The synthetic root is **off by default** and opt-in: only `projectSettings.sitemapShowSiteRoot === true` (Project Settings → Identity, "Show a site root box in the Visual Sitemap") adds it; otherwise the sitemap's own top-level node(s) are the root(s) — the engine lays out N stacked roots, so this works for one or many top-levels. The flag is **always persisted** as an explicit boolean; `writeSettingsSheet`/`parseSettingsSheet` JSON-encode booleans so `false` survives the xlsx round-trip (a bare boolean cell reads back as the string `"FALSE"`, which silently dropped a stored `false` — the bug that made this setting not stick for `.xlsx` projects). `generateMenuSitemap()` builds **one root per menu** (`rootHeadings:true` stacks them with headings; neutral `isMenuRoot`; items colored by kind Page/Link/Header, `header` dashed). Both call the shared **`openSitemapView({context,title,roots,defaultColorRules,palette,rootColor,…})`**.

**What counts as a "top-level section" (`navSectionRoots()`) — shared by the Visual Sitemap and the Treemap.** Color-by-section keys off `colorValue`, which the host stamps onto a section's entire subtree. Normally the sections are the nav tree's own top level, but a tree rooted at a **single site node** (every section nested under one "Home") would stamp one identical label onto every node in the file — collapsing color-by-section into color-everything-alike and leaving the dimension with exactly one value. This is the same single-bucket problem `makeSectionResolver()` strips a shared prefix to avoid on the reporting side. `navSectionRoots()` therefore treats a lone root's **children** as the sections (the root keeps its own label, and its own depth-0 rule); `navToSitemap()` and `buildTreemapNode()` both re-stamp `topLabel` when they hit one of those ids, and `computeSectionColorMap()` reads the same list. Engine-side, the rule editor's section dropdown is built by **`sectionValues()`** — the distinct `colorValue`s actually present in the tree, in tree order. It is deliberately *not* "the depth-1 nodes": which depth carries distinct values depends on whether a synthetic site root sits above the sections, and reading the values themselves is correct either way. (Taking depth-1 nodes gave every option in a single-rooted tree the same underlying value — their shared ancestor's label — so picking any section silently saved, and then re-displayed, a different one.) A stored value no longer present in the tree stays in the list as its own option rather than falling back to the first, so a rule pointing at a renamed section can't be silently re-pointed on the next save.

**Settings tiers:** app defaults live in `prefs.sitemapDefaults` (returned by `get-prefs`); per-project, per-context overrides live in `projectSettings.sitemapSettings.{nav,menus}` (layout consts, `colorRules`, `legendLabels`, `nodeOverrides`, and — **menus only** — a `collapsed` view-state) — persisted free via the existing `projectSettings` → KKE_Settings/.transmission JSON plumbing. `sitemapEffectiveSettings(context, defaultColorRules)` = appDefaults < project overrides; `openSitemapView` persists each reported state into `projectSettings.sitemapSettings[context]` and `setDirty(true)`. Both sitemaps prefer `projectSettings.brandPalette` when set.

**Collapse is two-way bound to `node.collapse` (nav only).** `node.collapse` (the Sitemap's **Collapse** checkbox / Sitemap column) is the *single source of truth* for which nav nodes start collapsed in the sitemap — `generateNavSitemap` seeds `initialCollapsed` from it on every open, and `openSitemapView` is called with `collapseToNavNodes:true`, which (a) ignores any saved `sitemapSettings.nav.collapsed` so a stale view-state can't shadow a checkbox change, and (b) on each reported state writes the view's collapse set back onto the nav nodes via **`applySitemapCollapseToNav(ids)`** (sets `node.collapse` `'Y'`/`''` for nodes with children, `state.navTreeDirty=true`, re-renders the open nav editor). Menus keep their own persisted `collapsed` view-state (menu items have no collapse flag).

**Drag-and-drop (shared engine):** the nav tree and the menu item tree share ONE drag/drop engine (defined near the Menus section in renderer.js): `makeTreeDragHandle(grip, row, mime, id, {dragImage})` wires the grip's dragstart/dragend; `attachTreeRowDropTarget(row, {mime, onReorder(draggedId, zone), foreign?})` wires dragover/dragleave/drop; `_treeDragOver = {el, zone}` tracks the active target and `clearTreeDropIndicators()` clears it; `_setTreeDropZone` paints the indicator. Tree mutation stays per-view in the `onReorder` callback (`moveNavNode` / `moveMenuItem`). 30% top/bottom zones → before/after, middle → into; the `dragleave` guard (`row.contains(e.relatedTarget)`) prevents flicker. Indicators are the shared `.tree-drop-before/after/into` (inset-shadow edges + into-tint) + `.tree-row-dragging` (opacity 0.35). The `foreign` hook is available for a row to accept other drag types but is currently unused (the old sidebar-row→node drag-assign was removed — the Sitemap hides the sidebar, so it was unreachable; assign via the audit bar **Sitemap** button/picker).

**`_findNavNodeLocation(target, nodes)`** — helper that walks the nav tree by object reference (not by `parentNumber`) to locate a node's parent array and index. Used by `deleteNavNodeFromEditor` to fix a bug where "also delete this node" wasn't working after tree reorganizations that left stale `parentNumber` values.

**Treemap (engine in `src/treemap-template.js`):** the content inventory as a squarified treemap (Bruls/Huizing/van Wijk), boxes sized by page count and colored by KKE composition, top-level section, or a tracked build field — reached via the Sitemap toolbar's **Treemap** button (`#btn-nav-treemap`), next to Visual Sitemap. `window.TreemapTemplate.build(data)` follows the exact same standalone-HTML / `app`-`client`-`print` three-mode contract as `SitemapTemplate.build()` (same CSP/webview rationale — see that engine's header comment), but is a deliberately smaller, separate module: **no in-webview Settings panel, no collapse, no per-node overrides.** Depth and coloring are chosen once, host-side, in a small pre-render dialog (`openTreemapConfigDialog()`) before the view opens; changing either means reopening that dialog and regenerating — there's no live round-trip like the box-tree engine's `pushState()`/`persist()`.

- **Rollup, not a separate URL-folder treemap:** built from the *existing* sitemap tree (`state.navTree`), not from re-parsed URL paths. `buildTreemapNode(node, topLabel, depthLimit, currentDepth, ctx)` recurses normally below the chosen depth; at the limit it stops and reports the node's *subtree* totals instead of its children, so a depth-2 box's size/color reflects everything rolled up beneath it, not just its direct count.
- **Sizing (`computeSubtreePageCounts()`):** counts *every* audit row assigned to a node's subtree via `Sitemap_ID`, regardless of KKE outcome — deliberately not `_navPageCountsCache()` (which excludes Kill/Consolidate for the Sitemap editor's "how many pages will still be live" badge). A section that's entirely being killed should still show up sized by how much content is there, not shrink to nothing. This also keeps the KKE-breakdown subtitle's percentage from exceeding 100% — box size and breakdown total are the same row count.
- **KKE composition (`computeSubtreeKkeBreakdown()`):** bottom-up tally of every row's effective KKE (`Final_KKE` else `KKE_Recommendation`) per subtree; `dominantKke()` picks the most frequent value for a box's fill color (`treemapKkeColor()`, resolved via `getComputedStyle` since the webview has no access to the host's `:root` custom properties — includes Consolidate, which the older `kkeColor()`/`resolvedKkeColor()` helpers omit) and its subtitle (e.g. "62% Keep").
- **Color-by-field constraint:** the full field registry (`navSitemapFieldDefs()` — Phase, Node Type, Page Status, Build Pattern, and the three assignee roles, the same registry the Visual Sitemap's generic field-coloring uses) is only offered when depth is **Unlimited** — a rolled-up box has no single field value to report, so limited depths only offer **Top-level section** and **KKE composition**, both of which have well-defined "dominant value across a subtree" semantics. `openTreemapConfigDialog()` enforces this by re-populating the color-by `<select>` on the depth `<select>`'s `change` event.
- **Export reuse:** `sitemapExportClient`/`sitemapExportPdf`/`sitemapExportPng` take an optional 4th `templateModule` param (default `window.SitemapTemplate`) so the treemap and Sankey paths pass `window.TreemapTemplate` / `window.SankeyTemplate` through the exact same export IPC plumbing without forking it. Existing box-tree call sites are unchanged (still 3 args).
- **Only leaves carry a semantic fill color** — a container (has visible children) box renders as neutral structural chrome (border + label strip) in the engine; only leaf/rolled-up boxes get the resolved KKE/section/field color, so "what does a two-tone nested box mean" is never ambiguous. It's also why only leaves accept a right-click color override.
- **Colors ARE in the engine, unlike depth/color-by.** What is drawn stays host-side (changing it re-rolls the aggregation); *which colors* are used is pure presentation and round-trips like the box-tree engine's settings. Two layers, resolved by `colorOf(node)` as `nodeOverrides[node.id]` > `colorOverrides[node.colorKey]` > `node.color`. **`node.colorKey`** is the join: `treemapColorKey()` stamps each box with its legend category (section label / dominant KKE / raw field value) and must stay in lockstep with `resolveTreemapNodeColor()`'s branches and `buildTreemapLegend()`'s `key`s, or recoloring a legend entry silently repaints nothing. A blank key (`''` — no Page Status set) is a real category, so both maps are probed with `hasOwnProperty`, never truthiness. Persisted in `projectSettings.treemapSettings[colorBy]` — **keyed by color-by mode**, because the same key space means different things in each ("Keep" the decision vs a section named Keep) and a palette chosen for one view has no bearing on the other.

**Content Flow / Sankey (engine in `src/treemap-template.js`'s sibling `src/sankey-template.js`):** how pages move from the **current site's** organization into the **new sitemap** — reached via the Sitemap toolbar's **Content Flow** button (`#btn-nav-sankey`), next to Treemap. Same standalone-HTML / `app`-`client`-`print` contract as the other two engines, and reuses `sitemapExportClient`/`sitemapExportPdf`'s optional `templateModule` param for export. Layered Sankey layout (barycentre relaxation for crossing reduction), written from scratch — d3-sankey is not an option, see the Dependencies table.

- **All toggles live in the ENGINE, not the host** — unlike the treemap, where depth/color-by are host-side because changing them re-rolls the aggregation, these are pure re-reads of data already sent. The host ships every graph up front and the **client export keeps every reading** — the person handed the file gets what you had, with no app. Only the source-axis depth (which changes the tally) is chosen host-side in `openSankeyConfigDialog()`.
- **Because the engine owns the toggles, it owns the only record of what's on screen** — so every export emit carries `currentState()` (`{from, shape, colorBy}`) and the host folds it back through **`sankeyDataForState()`** before rebuilding the document. Without that step each export renders `baseData`'s `default*` keys, i.e. whatever view the config dialog opened with, and a PDF silently shows a different reading than the one the user meant to hand over. `build()` must therefore also honor `defaultColorBy` when emitting the `#colorby` select's `selected` attribute (the From select and Shape buttons already did).
- **Two orthogonal controls, keyed `from|shape` in `DATA.views`.** `from` is what the LEFT column is — `section` (URL-derived current-site section) or `site` (which source site, offered only when the audit spans more than one). `shape` is what follows, from `SANKEY_SHAPES`: `dec` (→ Decision), `new` (→ New sitemap), `both` (→ Decision → New). `buildSankeySankeyGraph()` is generic over layer count and the engine derives layer count from the data, so **adding a shape is one entry in `SANKEY_SHAPES`** — no engine change. Links are always split by decision even in the `new` shape, so a band keeps its decision color and its tooltip can still say why that content moved.
- **Every KKE value reaches the diagram verbatim** — `effectiveKke()` is read as-is, so user-added states (and even a rogue value typed into the sheet) each get their own block; `treemapKkeColor()` already resolves custom states from `state.customKkeStates`. Only the synthetic `(unreviewed)` bucket needs its own neutral. Legend order follows `allKkeStates()` so custom states sit where the user put them, with `(unreviewed)` last — it's the absence of a decision, not one of them.
- **Multi-site is the case that breaks a naive build, in two ways.** (1) The **section axis explodes**: 5 sites × 12 sections = 60 blocks, at which point the engine's height budget leaves ~22px for every band put together (measured, not estimated). Two defenses — `sankeyCapSources()` folds the tail past `SANKEY_MAX_SOURCES` (20) into one `Other (N sections)` block, re-tallying so totals still conserve, and the engine caps total inter-node gap at 35% of the column instead of a fixed 10px. Each axis is capped independently, since the site axis is naturally small and capping globally would fold the one that was fine. (2) The **Source-site axis** exists because in a consolidation the unit of work IS the site — "which site contributes what, and where does it go" is the question, and it's 4 blocks instead of 60. It leads by default whenever it's offered.
- **Site labels are a pre-existing feature the Content Flow made client-visible.** `siteLibrary[].label` and its Project Settings → Sites **Rename** have existed since the source-site work; `seedSiteLibraryFromData()` seeds it to the bare host, which was fine while the label only reached reports and is not fine now that it names a column of a client-facing diagram. So `openSankeyConfigDialog()` offers inline rename fields for in-scope sites still named after a host (`sourceSitesNeedingLabels()`), applied before the tally because `Source_Site` is derived from the label. **Only shown with 2+ in-scope sites** — a single-site audit never renders the site as a block, so asking would be busywork; that project's name comes from Identity, which titles the diagram. `renameSourceSite(index, label)` owns the validation and the `recomputeAllSourceSites()` cascade and is shared by BOTH callers so they can't drift — it also fixed a latent bug in the Sites tab, whose duplicate check compared against every entry *including self* and so refused a case-only rename.
- **The section axis qualifies by SITE LABEL, not host** (`Beta College › About`, not `beta.edu › About`) via `computeRowSourceSite()`, and *whether* to qualify is decided by the count of distinct **sites**, not hosts — one site served from `www.` plus a subdomain is still one site and shouldn't have every section prefixed. Prefix stripping stays per **host**, since separate subdomains genuinely have separate path roots.
- **Labels are dropped, never overlapped.** A block can be a few pixels tall while its label is two lines, so `render()` walks each column top-down and gives each label only the room left below the previous one: full, name-only, or nothing. The block, its color and its tooltip always remain — nothing becomes unreachable, only unlabelled. Gutters are sized per render from the longest label (estimated from character count, not measured) so `Alpha University › Academics` isn't clipped.
- **The source axis is URL-only — it deliberately does NOT use `makeSectionResolver()`.** That resolver prefers a placed row's *breadcrumb*, which is the TARGET IA; every placed page would then flow `Academics → Academics` by construction and the diagram would show nothing. `makeSourceSectionResolver(depth)` re-implements the URL branch, keeping the two corrections that matter just as much here: the **per-host** `sharedPrefixDepth` strip (a crawl rooted at `alpha.edu/college/…` otherwise lands entirely in one bucket) and the `hostUsesLocalePrefixes` step-past (else the columns read `Es / De / Zh-Hans` — language, not organization). Multi-site crawls stay host-qualified for the same reason reports do.
- **`navSectionLabelMap()` stamps nodeId → top-level section by walking `state.navTree`**, not by following `parentNumber` — the same approach `navToSitemap()`/`buildTreemapNode()` use for `topLabel`, side-stepping the stale-parent bug class `_findNavNodeLocation()` exists to work around. Sections come from `navSectionRoots()`, so a tree rooted at one site node reports its children rather than one label for the whole file.
- **The three terminal buckets are the point of the diagram** as much as the flows: `SANKEY_RETIRED` (Kill), `SANKEY_OUT_OF_SCOPE` (Exclude), `SANKEY_UNPLACED` (no `Sitemap_ID`, incl. unreviewed rows). On a real audit one of them is the largest block; a flow chart that shows only what lands somewhere is hiding the biggest number.
- **Consolidate resolves THROUGH to the master's destination** (`sankeyTargetOf`, recursive, cycle-safe via a `seen` Set seeded with the row's own Address — same guard `resolveRedirectDestinations()` uses), because consolidation kills the URL but preserves the content. The band stays colored as Consolidate so the merge is still legible. A missing/off-inventory master falls to `SANKEY_UNPLACED` rather than silently vanishing.
- **The flow tally is NUL-keyed and carries its triple as the value** — section labels contain spaces (`News & Events`), ` / ` at depth 2+, and `›` when multi-site, so no printable separator is safe to split back out. Reads `reportRows()`, so out-of-scope sites are excluded like every other report.
- **Covered by `npm test`** (`test/sankey.test.js`) — the source axis, terminal buckets, consolidation chains/cycles, both source axes, the cap, site renaming, and the engine's three run modes. See `docs/dev/TESTING.md` for how the sandbox lifts functions out of renderer.js and what that constrains.
- Section colors are shared across **both** horizontal axes (`sankeySectionColors(flows, axis)`), so a section that survives the migration keeps its identity left-to-right.

### Redirect editor (`#redirect-editor`)
Toggled via the **Redirects** button. Hides sidebar via `.tv-active` class. Shows all pages needing redirects (Kill pages + URL-changed pages). Each row has: KKE badge, title (clickable — navigates to that row in audit view), current URL, editable destination URL, and a nav picker button (600px wide, anchored to right edge). Destination priority: custom per-row > nav node path > default destination > blank (no more homepage fallback). `resolveRedirectDestinations()` is called before save to populate `Redirect_Destination` for all Kill/URL-changed pages. Site domain and default destination are configured in **Project Settings (▤)**, not in the redirect toolbar. The editor has its own status filter dropdown, text search, and sortable column headers (Status, Title, Current URL, Destination URL — each cycles asc → desc → none). **Find/Replace** (`#redirect-find-replace-bar`): toolbar button toggles a bar with Find/Replace fields; Find/Replace **filters** the list (shows only matching rows, not just highlights). Exact match checkbox available. Respects status filter and text search. Live match count shown. "Replace All" applies substitution to all matching destination URLs. **Scroll to current page**: when opened from audit view, auto-scrolls to the currently selected page's row with a brief highlight.

**`resyncNavBasedRedirects()`** — wired to the "Re-derive from sitemap" button (`#btn-redirect-resync-nav`) in the redirect editor toolbar. Iterates all rows with a non-empty `Sitemap_ID`: for Kill/Consolidate rows, sets `Redirect_Destination` to the resolved nav path (skips if destination is literal `'404'`); for other KKE values, updates destination only when `Computed Path` differs from the current URL (URL is changing), also skipping `'404'` values. Calls `setDirty(true)` and refreshes the redirect editor. Distinct from `resolveRedirectDestinations()` (which runs automatically on save for all Kill/URL-changed rows) — this function is a manual on-demand sync.

### Table View (`#table-view`)
Toggled via **Cmd+T** (or View menu). Hides the sidebar by adding `.tv-active` to `#app` and replaces the main panel with a full-width spreadsheet-style table. Has its own independent sort state (`_tableSort`) and per-column filter state (`_tableColFilters`), separate from the sidebar's sort/filter. Virtual scrolling uses `TV_ROW_HEIGHT=28` and `TV_OVERSCAN=15`. Column configuration is persisted in prefs as `tableColumns`. Core rendering functions: `renderTableView()` builds the table structure, `renderTableVisibleRows()` handles the virtual-scrolled row rendering. The **# column is frozen** (position: sticky) when scrolling horizontally. **Inline editing**: double-click audit columns to edit in-place (dropdown for KKE-type columns, text input for others; commit on blur/Enter, cancel on Escape). **Keyboard navigation**: Arrow Up/Down and j/k navigate rows when no input is focused.

### Menus view (`#menus-view`) — Phase 1

Toggled via **Cmd+Shift+M**, the **Menus** view-switcher tab, or View → Menus (`menu-menus` IPC → `toggleMenusView()`). Full-panel view (`.tv-active`) for building **independent navigation structures** that *reference* content-tree nodes — decoupled from the containment hierarchy (see [[nav-axes-decoupling-design]] in memory for the full rationale). The content tree stays the canonical backbone (page homes, URL, breadcrumb); menus are a separate, arbitrary, user-defined collection.

**Data model** (canonical, lives in `state.projectSettings.menus` + `state.projectSettings.menuPlacementLibrary` — so persistence is **free** via the existing `projectSettings` plumbing: KKE_Settings JSON for `.xlsx`, settings table for `.transmission`; no new structural sheet in Phase 1):
- `menu = { id, name, placement, description, items: [] }` — `placement` is a controlled-vocab string from `menuPlacementLibrary` (per-project, seeded with `DEFAULT_MENU_PLACEMENTS`: Top bar / Mega (hover) / Utility / Footer / Overlay / Fly-out / Sidebar / In-page); `description` is free text.
- `MenuItem = { id, parentId, kind: 'ref'|'link'|'header', nodeId, externalUrl, label }` — `kind` **ref** points at a content node (`nodeId`; `label` blank = inherit the node's label live), **link** is an external URL, **header** is a label-only grouping row. Hierarchy by `parentId`; sibling order is array order. A node may be referenced by any number of items across any menus, at any depth (many-to-many; the content node tracks nothing).

**Layout:** `#menus-list` (left, draggable menu list — flat reorder) + `#menus-detail` (right: name / placement inline-add select / description, then the item tree). `renderMenusView()` → `renderMenusList()` + `renderMenuDetail()` → `renderMenuItemTree()` (DFS by `parentId`, indented) → `buildMenuItemRow()`.

**Item DnD** (`attachMenuItemDnD` → the shared `attachTreeRowDropTarget`; `moveMenuItem` does the array-splice reparent with a subtree-cycle guard): grip (`.mi-grip`) drag, 30%-zone before/after/into. Uses the shared tree DnD engine (same one the nav tree uses — the backport is done). **Menu-list DnD** (`reorderMenus` / `clearMenuListDropIndicators`, `_menuListDragOver`) reorders the menu array (before/after only) and is still its own small handler.

**Item kind is changeable in place** via a `<select>` on the kind badge → `changeMenuItemKind(menu, item, newKind)`: leaving `ref` materializes the inherited label first; → `ref` opens the node picker if there's no target yet; → `link`/`header` clears `nodeId` (and `externalUrl` for header).

**Add-as-child (`.mi-add-child`) and clone-with-subtree (`.mi-clone`)**, both per-row: the toolbar's **+ Page** / **+ Link** / **+ Header** always append at root (`parentId: ''`), which meant reaching a specific nested spot required adding at the bottom then dragging up. Each row now has its own **+** button (a small popover — Page / Link / Header) that calls `addMenuItemRef`/`addMenuItemLink`/`addMenuItemHeader` with that row's item id as `parentId` (all three gained an optional `parentId = ''` param; existing 3-arg call sites are unaffected). A new item is simply `.push()`ed — sibling order comes from `childrenOf()`'s array-order filter, not push position, so it renders correctly as the parent's last child regardless of where in the flat array it landed. The popover is a `.open` class toggle with one document-level outside-click listener wired once in `setupMenusView()` (not per-row, to avoid stacking listeners across re-renders). **`cloneMenuItem(menu, item)`** deep-clones an item and its full subtree as a sibling immediately after the original's own subtree (mirrors `duplicateMenu()`/`cloneNavBranch()`'s "duplicate to edit independently" pattern) — fresh IDs computed from the current max (not repeated `genMenuItemId()` calls, which would return the same id until each clone is actually pushed), `parentId` remapped to the clone's own tree, and only the top item gets a " (copy)" label suffix, and only when it has a real label (a blank `ref` label means "inherit the page's label" — appending "(copy)" to that would wrongly materialize a literal label). **`.menu-items-head`** (the toolbar row) is `position: sticky` against `#menus-detail`'s scroll so it stays visible while scrolling a long item list. `top: -14px` (not `0`) — sticky's `top` offset is always measured from the scrollport's *padding* edge regardless of the sticky element's own margin, and `#menus-detail` has `padding: 14px 18px`, so `top: 0` alone leaves a 14px band where scrolled rows show through above the header; negative side margins (`-18px`, re-added as padding) additionally bleed it edge-to-edge, and `will-change: transform` promotes it to its own compositor layer so it repaints cleanly instead of briefly showing a stale frame of the row underneath during fast scroll.

**Other ops:** `addMenu` / `deleteMenu` / `duplicateMenu` (deep-clones a menu — name gets a " (copy)" suffix, item IDs are freshly minted and `parentId` remapped to the clone's own items so the hierarchy round-trips; items still reference the same content nodes/links as the source, for editing into a divergent variant — e.g. an alternate mega-menu path to review with a client — without touching the original; selects the new copy and defaults the Export dialog's "just this menu" scope to it), `addMenuItemRef` (→ `showMenuNodePicker`, a searchable content-node picker) / `addMenuItemLink` / `addMenuItemHeader`, `removeMenuItem` (reparents orphans to the removed item's parent), `seedMenuFromContentTree` (builds a menu mirroring in-menu nav nodes, falls back to all nodes). Setup in `setupMenusView()`; the other views' open functions call `closeMenusView()` and vice-versa.

**Export (`btn-menu-export` → `openMenuExportDialog()` → `runMenuExport(list, format)`):** CMS-agnostic — a neutral structured representation any CMS import maps from; **no vendor's nav model is baked in** (CMS-native files would be optional opt-in adapters layered on top). Two formats: **xlsx** (`buildMenuExportSheet()` → a flat `Menus` sheet via the existing `export-migration-tracker` IPC; columns Menu/Placement/Description/Depth/Trail/Label/Kind/Target URL/Target Page/Node ID/Item ID/Parent Item ID) and **JSON** (`menuToJsonTree()` → nested per-menu items via the `save-text-file` IPC, which now takes optional `filters`). `menuExportTargetUrl()` resolves a `ref` to its node's `computedPath` (domain-prefixed) and a `link` to its external URL. Dialog scope = all menus / the selected one.

**Reference integrity:** `findMenuOrphans()` returns `{menu,item}` for every `ref` item whose `nodeId` no longer matches a live node (deleted/renumbered). `renderMenusView()` shows a red `⚠ N broken refs` toolbar button (`#btn-menu-check`, hidden at 0) → `openMenuOrphansDialog()` lists each broken item with **Re-pick…** (reuses `showMenuNodePicker`) and **Remove** (`removeMenuItem`); the list re-renders live as you resolve them. Each broken item also shows `(missing page)` inline in the tree.

**Page breadcrumb in exports:** the breadcrumb axis surfaces in deliverables via a `pageBreadcrumb` column (`pageBreadcrumbOf(node)`) — added to `navExportColumnDefs()` (so it flows into the Migration Tracker **Sitemap Plan** sheet and the Sitemap's *Filtered nodes → Excel* column picker) and to the menu export (xlsx `Page Breadcrumb` column + JSON `pageBreadcrumb` on `ref` items).

**Per-menu sitemap (`btn-menu-sitemap` → `generateMenuSitemap()`):** uses the same shared engine as the nav sitemap (see **Visual Sitemap** above) via `openSitemapView({ context:'menus', rootHeadings:true, … })`. One root per menu, stacked with an uppercase heading; menu-root cards are neutral (`isMenuRoot`); items colored by kind (Page/Link/Header) with `header` items dashed. The old per-menu `outline`/`tree`/`columns` layout picker is gone — layout is now the engine's unified threshold-based horiz/vert model (with per-node right-click overrides), shared by both sitemaps. Per-menu settings (incl. node overrides) persist under `projectSettings.sitemapSettings.menus`.

**Node ids are namespaced per menu (`menu.id + ':' + it.id`), not the raw item id.** Menu item ids are only meant to be unique *within* their own menu (`genMenuItemId(menu)` scans just that menu's `items`) — two different menus routinely reuse the same item id (e.g. both have a `mi-0105`). `generateMenuSitemap()` merges every menu's tree into ONE shared engine instance whose `INDEX`/`positions` maps key nodes by `id` globally across the whole combined diagram — an un-namespaced id collision silently overwrote one colliding node's computed position with the other's, rendering it detached/in the wrong spot (found via a real client file where a "Departments & Faculty" item in one menu collided with an unrelated item of the same local id in another menu). The nav sitemap doesn't need this — `state.navNodes` ids are already globally unique.

---

## Miro export

**`src/sitemap-layout.js` is the reason this is possible.** The box-tree geometry
was extracted out of `sitemap-template.js`'s engine so the webview and host-side
callers share ONE implementation: the exporter needs every node's x/y *without
rendering anything*. That only works because the module is genuinely pure — no
`getBoundingClientRect`, no `offsetWidth`, no `getComputedStyle`, no canvas text
measurement. Card size is a settings constant and the two-line label clamp is CSS
that never feeds back into geometry. **Keep it that way**: the moment this file
measures a DOM node, the exporter breaks and the two surfaces silently drift.
It's authored as a real function and exposed twice — `window.SitemapLayout` for
direct calls, and `__source` (via `Function.toString()`) which `build()` inlines
ahead of the engine, the same trick the engine itself uses.

Colour/style resolution lives there too, so the exporter resolves a node to
exactly the style the webview draws. Verified behaviour-preserving against the
pre-extraction code across 9 scenarios on a 408-node tree — byte-identical
positions — and host-side output verified position-identical to the rendered
webview.

**Style rules.** Two shapes are accepted. Legacy `{condition, color}` (what every
existing project has persisted in `projectSettings.sitemapSettings.*.colorRules`)
still works untouched — it means "set the top band to this colour". The generic
form is `{ when: [{source, key, op, value}], style: {...} }`, conditions ANDed,
where `source` is `tree` (depth/colorValue/external/parentId), `node`
(`node.fields[key]`), or `row` (`node.rowFields[key]` — the DOMINANT value across
audit rows assigned to that node, with `node.rowFieldSets[key]` holding every
distinct value so the `any-is` operator can ask "does this section CONTAIN one").
Row aggregates are computed once per sitemap build by
`computeNavRowFieldAggregates()`; `SITEMAP_ROW_FIELDS` is the curated list of
audit columns exposed (deliberately curated — a crawl export has 100+ columns and
offering them all would bury the useful ones).

`resolveStyle()` cascades **per property**, not first-rule-wins: each style
property is claimed by the first matching rule that actually sets it, so colour
and line style can live in separate rules without needing a rule per combination.
This is backward compatible because legacy rules only ever set `band`.

Style properties: `fill`, `border`, `borderWidth`, `borderStyle`, `band`, `text`,
merged over `settings.baseCardStyle`. Corner radius and inner padding are
deliberately NOT per-rule — they describe how a card is drawn rather than what it
means, so they're global Layout settings (`cardRadius`/`cardPadX`/`cardPadY`,
clamped in `wireLayoutTab` so padding can't squeeze the label out).

**Connector styling (`connectorColor` / `connectorWidthFor` / `maxVolume`)** also
lives in `sitemap-layout.js`, for exactly the reason the geometry does: the
webview draws the lines and `buildMiroSitemapPlan` re-derives them, so a single
shared implementation is what makes the board match the screen. Four settings,
edited in the Settings panel's **Layout** tab under *Connectors* and persisted
through the usual tiers: `connectorColor` (was a hardcoded `#9aa0ab` in the
engine CSS *and* in the Miro plan), `connectorWeight` (`'uniform'` | `'volume'`),
`connectorWidth` (base px, default `1.5` = the long-standing CSS value), and
`connectorMaxWidth` (the cap in volume mode).

- **Volume = `node.vol`**, stamped by `navToSitemap()` from
  `computeSubtreePageCounts().totals` — every audit row assigned anywhere in the
  subtree. Deliberately NOT `_navPageCountsCache()` (which excludes
  Kill/Consolidate): the badge answers "how many pages will still be live", the
  line answers "how much content is under here". `node.sub` can't serve — it's
  display text (`"6 pages"`), which is why a separate number exists.
- **The scale is sqrt, not linear.** Sitemap volumes are wildly skewed (a
  400-page section beside a 3-page leaf); a linear map spends its whole range on
  the big branch and leaves everything else an indistinguishable hairline.
- **`maxVolume()` walks ALL nodes, not just visible ones**, and memoizes. If it
  used the visible set, collapsing a section would silently re-scale every
  remaining line and change what the diagram claims.
- **The app's connectors are a shared bus, not a line per edge** — a stub down
  from the parent, a span across the siblings, a drop into each child. In volume
  mode the shared parts carry the parent's whole-branch total and each drop
  carries that child's share, so it reads as a trunk splitting into proportional
  branches. (Miro genuinely does get one connector per parent→child, so its
  widths come straight from `connectorWidthFor(child)`.)
- **Per-path width is an inline style, never a `stroke-width` attribute.**
  Presentation attributes sit below author CSS in the cascade, so the
  `#connector-svg path` rule would win and every line would draw at the base
  width — which is exactly what happened first time.
- **Uniform mode stamps nothing**: no inline widths at all, colour and base width
  come from CSS custom properties (`--conn`, `--conn-w`), so an untouched project
  renders byte-identically to before this existed.
- Menus carry no `vol`, so volume mode degrades to the base width rather than
  drawing everything at the cap.

**`miro.js` (main process)** owns the token and the REST client. The token is
encrypted with `safeStorage` into its own file and **never crosses IPC** — the
renderer can set/clear/test it and ask main to act, but cannot read it back.
Deliberately not `prefs.json`, which is cleartext and whose entire contents ship
to the renderer on every `get-prefs` (see `claudeApiKey`).

**Auth: two paths.** Miro requires the OAuth authorization-code flow and has **no
PKCE** (`code_challenge` appears nowhere in their spec), so the code→token
exchange needs the client secret. Shipping that in the bundle would let anyone
impersonate the app, so it lives in `server/miro-auth` (a Cloudflare Worker) and
`connectViaBrowser()` drives a one-click flow against it: app registers
`{sid, secretHash}`, opens the browser, worker exchanges the code and stashes the
token briefly, app claims it with `{sid, secret}`. `sid` travels through the
browser and so leaks into history; only `secret` (never in the browser) can claim
the token. Paste-a-token remains as a fallback and for power users.

The Miro app must be created with **non-expiring tokens** (the "Expire user
authorization token" checkbox left UNTICKED — immutable after creation). There is
no refresh plumbing by design; refreshing also needs the client secret, which
would make the worker permanent infrastructure every user depends on hourly
rather than something touched once per user.

**Export.** `buildMiroSitemapPlan(baseData, st, opts)` (renderer) computes layout
host-side and emits `{frame, shapes, edges}`; shape coordinates are the layout's
own top-left-origin values converted to centres, sent verbatim as frame-relative
positions — **verified against a live board: Miro stores and returns child
coordinates in exactly that space, so no translation is needed.** `exportSitemap`
(main) creates the frame, bulk-creates shapes 20 at a time (response order
matches request order, which is what maps node ids to Miro item ids), then
connectors at concurrency 5.

**Board picker (`pickMiroBoard` in renderer).** A real work token sees thousands
of boards, so a single 50-item dropdown is useless — the picker offers three
routes: **create new** (default; appending 400 shapes to a live board is rarely
the intent), **use an existing board** via `attachMiroBoardSearch()` (a live,
debounced, server-side `miroSearchBoards` list — empty query = most-recently-
modified — plus an "or paste a board link / ID" field routed through
`extractMiroBoardId()` → `miroGetBoard`), or **export again to the last board**.
Both existing-board methods feed one `chosenBoard`; either action ticks the
"existing" radio. `attachMiroBoardSearch(container, onSelect)` is the reusable
search component (also used by `openMiroBoardSelectDialog()`, which backs the
App-Settings write-access probe — the old capped `<select id="miro-board-select">`
is gone). **Remembered board:** after a successful export, `sitemapExportMiro`
stores `projectSettings.miroExport.lastBoard = {id,name,viewLink}` (travels with
the project via KKE_Settings JSON) and `setDirty(true)`. On reopen the picker
re-reads that board's *current* name by id via `miroGetBoard` — so a board
created "Untitled" and renamed later still resolves and shows its real name, and
a since-deleted board drops the option (falls back to "new") instead of failing
mid-export. This is why identity is the board **id**, never the name.

**Deleting a scratch board.** The picker steers people to "create a new board"
— review it, then tidy up — so the export-result toast carries a **Delete
board** action (`miroDeleteBoardToastAction`, over the `miro-delete-board` IPC),
shared by all three diagrams' result toasts. It is offered **only when this
export created the board** (`isNewBoard`, set on the `'new'` branch of
`pickMiroBoard` / `pickMiroBoardSimple`): deleting a board the user already had,
carrying whatever else was on it, is a much larger action than discarding a
scratch one, and a toast has no room to draw that distinction. Clicking it opens
a `confirmDialog` — a toast button can be hit by someone who hasn't read it. On
success it clears `miroExport.lastBoard` when that's the board being deleted,
since the remembered board is keyed by id and would otherwise offer "export
again to &lt;deleted board&gt;". This is the one sanctioned use of `showToast`'s
optional `action` param — see **docs/UI_STANDARDS.md §5a** for when that's
allowed at all.

Rate limiting is proactive, not reactive: Miro bills **Level 2 per ITEM even
inside a bulk call**, so batching buys round trips and atomicity, never
throughput — the ceiling is ~1,000 items/minute however you batch. A 429
mid-export leaves a half-drawn board, hence the credit limiter at 85k/min with
429 retry reading `X-RateLimit-Reset`. ~409 nodes + 408 connectors ≈ 68s.

**Export appearance is user-chosen in the dialog.** The Export-to-Miro dialog has
an **Appearance** section: **Connector style** (Right-angle→`elbowed` (default,
matches the app) / Curved / Straight), **Connector thickness** (**Match sitemap** —
the default — plus Thin/Medium/Heavy/Extra heavy = 1/2/3/5px as an explicit
per-board override; `'match'` is a string sentinel, not a number, so it has to
survive the dialog read intact. Match defers to the sitemap's own
`connectorWeight`/`connectorWidth`, which means a volume-weighted sitemap
exports volume-weighted connectors. A project that already stored a numeric
width keeps it, so nothing from 2.15.0 regresses; an unset project now resolves
to `round(1.5) = 2` rather than the old hardcoded 1, because "match" has to
actually match the 1.5px line on screen), **Card corners** (Rounded /
Sharp; default derived from the app's Layout `cardRadius`), **Border thickness**
(Thin/Medium/Heavy = 2/3/5px; overrides the per-node derived width), and
**Include a color key** (a legend built from the color rules). Including
collapsed/hidden nodes is now **opt-in** (the "Include them" box defaults OFF).
Every one of these persists per project in
`projectSettings.miroExport.{connectorStyle,connectorWidth,cornerStyle,borderWidth,
includeLegend,expandAll,hiddenLabel}` and is restored when the dialog reopens.
`buildMiroSitemapPlan` maps `connectorStyle`→`plan.connectorShape`, stamps
`connectorWidth` onto every plan edge as `strokeWidth`, picks the shape
TYPE (`rectangle`/`round_rectangle`) from `cornerStyle`, applies `borderWidth` to
every card (and legend chip), and — when `includeLegend !== false` — appends a
**color key** BELOW the tree (one white chip per color rule, border = the rule's
color via `ruleColorOf`, text = `rule.label`; placed below so no tree coordinate
shifts, frame height grown to fit). `exportSitemap` passes `connectorShape` to
every `createConnector`. Miro has no numeric corner radius for shapes — only the
type — so `round_rectangle`'s own rounding shows even though Miro's separate
numeric "Rounded corners" field reads 0 (not a bug).

**Render fidelity vs the native view:**
- **Connector routing is orientation-aware (elbowed only).** Miro does no obstacle
  avoidance, so a `snapTo:'bottom'→'top'` elbow between a parent and a vertically-
  stacked child (shared centreline) runs straight *through* the cards between them.
  Each plan edge carries `vertical` = `layout.shouldBeVert(parent, parentDepth)`
  (the exact predicate the layout drew with; parent depth = child depth − 1), and
  for **elbowed** connectors `exportSitemap` snaps vertical-column edges to the
  **left** edge of both cards so they run down the gutter beside the column like
  the app's left-spine; horizontal rows (and all curved/straight edges) keep the
  clean bottom→top attach. Plan edge shape is `{from, to, vertical}`, not `[a, b]`.
  Because `snapTo:'left'` is unverified against Miro's enum, a rejected side-snap
  is retried once with the default attach — the edge still draws rather than
  vanishing.
- **Border width is rounded to an integer ≥2.** The app's default band style is
  1.5px; passed verbatim, Miro's integer-stepped thickness slider can't place a
  handle on `1.5` and renders it hair-thin (a phantom ~80% position that only
  "takes" once clicked). `Math.max(2, Math.round(...))` keeps it on a real slider
  stop. **Connector width is subject to the same trap**, so `miroConnectorWidth()`
  (renderer) rounds+clamps the dialog's choice to 1–24 and `createConnector`
  (miro.js) rounds again at the choke point — every caller's width is an integer
  by the time it reaches the API, whatever it passed.
- **Full labels are kept, not truncated, at a constant 12px.** The app clamps card
  text to 2 lines via CSS; Miro can't, but the cards are tall enough for the ~3
  lines a long name needs at 12px, so full names show without truncation. Do NOT
  pre-shrink the font to "fit" long labels: Miro rejects any shape whose fontSize
  is below its (undocumented) minimum with a generic `"invalid parameters"`, and a
  9–11px experiment broke every export until it was reverted to a flat 12.
- **Collapsed marker carries a count.** The compact `hiddenLabel:'plus'` option
  renders `+N` (e.g. `+3`), not a bare `+` — a lone `+` is cryptic on a static
  board where nothing expands. `'count'` still gives the full "N pages hidden".

**The treemap and Content Flow export to Miro too**, reusing the whole pipeline —
`miroBoardChooserHtml()` / `wireMiroBoardChooser()` / `miroResolveChosenBoard()`
(the board-choosing half, extracted out of `pickMiroBoard` so the three dialogs
can't drift on remembered/new/search/paste), the `{frame, shapes, edges}` plan
shape, `miro.js`'s `exportSitemap`, and one shared `runMiroExport()` for the
progress modal / result toast / remembering the board. Only plan-building
differs: `buildMiroTreemapPlan()` and `buildMiroSankeyPlan()`. Their lighter
dialog is `pickMiroBoardSimple()` — board choice plus a colour-key toggle;
the sitemap keeps its extra appearance controls because those describe a box
*tree* and have no counterpart in either of the others.

**Neither re-implements its engine's layout.** The engines emit the geometry
they just drew alongside the export message — the treemap's `exportBoxes()`
(`{boxes:[{id,label,subtitle,color,container,x,y,w,h}], width, height, legend}`)
and the Sankey's `exportGraph()` (`{nodes:[{id,label,value,color,layer,order}],
links, columns, legend}`). This is the same principle `src/sitemap-layout.js`
achieves by being shared: the board matches the screen by construction. It also
means a plan is only buildable **after** a render, hence `miroExportPreflight()`.

**The Sankey's board is an approximation, and deliberately so.** Miro has no
ribbon primitive, so a band becomes a **connector whose stroke width is the page
count** — clamped into Miro's 1–24 range (`createConnector` gained an optional
`strokeWidth`), which is a scaled clamp, not the proportion drawn on screen.
Block *heights* are recomputed host-side rather than scaled from the engine's,
because a Miro shape must be tall enough to hold its label while the engine
routinely draws a 3px block and simply omits the text; enforcing that floor
means re-stacking each column, which is exactly why `exportGraph()` ships each
node's settled `order` (the crossing-minimised one) instead of its `y`. Columns
run left→right, so plan edges may set `startSnap`/`endSnap` themselves — the
sitemap's own vertical-gutter routing only applies when they don't.

**Treemap shapes carry a `nodeId` even though a treemap has no connectors**:
`exportSitemap` reports its item count as the number of nodeId-bearing shapes it
mapped, so an all-null plan would report "0 blocks exported" on a full board.

**Miro constraints worth knowing before extending this:**
- **No collapse for shapes.** Only mind maps collapse, and `MindmapCreateRequest`
  has no `style` at all (`type` can only be `text`), so using them would lose the
  entire colour system. Collapsed sections export as a stacked block instead —
  two offset backing shapes, matching the app's own CSS box-shadow offsets and
  fitting inside the `SHADOW` allowance `subtreeBox` already reserves.
- **No corner radius.** Only `shape: rectangle` vs `round_rectangle`, so a
  continuous radius collapses to a binary on export.
- **No padding.** Miro centres shape text itself.
- `borderStyle` is exactly `normal | dotted | dashed`, which is why the app offers
  only those three line styles — anything else would render in-app and silently
  flatten on export.
- Shape `fillColor` accepts arbitrary hex despite documenting a 16-value palette
  (verified live). Sticky notes, by contrast, are a hard enum.

## SME workflow

The Subject Matter Expert (SME) workflow enables external reviewers to validate KKE recommendations without needing the app.

### Export (File > SME Export, or `menu-sme-export`)
Generates a standalone `.xlsx` file for SME review. Uses **ExcelJS** (not SheetJS) to produce xlsx files with embedded data validation dropdowns (e.g., SME_Decision options). After ExcelJS generates the file, a post-processing step via **JSZip** replaces `&quot;` with literal quote characters in the xlsx XML to work around an ExcelJS encoding issue. The export is handled by the `sme-export` IPC channel in the main process.

### Import (File > SME Import, or `menu-sme-import`)
Reads back the SME-completed spreadsheet and merges SME columns (`SME_Decision`, `SME_Notes`, `Content_Owner`) into the working data. Uses a two-step IPC flow: `import-audit-merge-open` opens a file picker and returns available sheet names, then `import-audit-merge-read-sheet` reads the selected sheet. This replaced the earlier single `import-audit-merge` channel.

### Resolve (File > SME Resolve, or `menu-sme-resolve`)
Reconciles SME decisions with original KKE recommendations to produce `Final_KKE` values. Where SME approved the original recommendation, `Final_KKE` matches `KKE_Recommendation`. Where SME chose "Change: X", `Final_KKE` is set to the SME's override.

**`parseSmeDecision(smeRaw, currentKke)`** is the single shared parser behind every SME_Decision read site (conflict filters, resolve dialog, progress dashboard, SME Review Status report, `openKkeVsSmeView`) — returns `{ reviewed, agree, changed, value }`. It recognizes three input shapes, not just the documented `Change: X` form: `Approve`/`Accept` (case-insensitive) → `agree`; `Change: X` → `changed` with `value = X`; and a **bare value with no prefix at all** (SMEs don't reliably follow the `Change:` convention) → `changed` with `value` = the raw text, *unless* that bare text case-insensitively matches the row's own `KKE_Recommendation`, in which case it's treated as an implicit `agree` rather than a no-op "change to the same thing." Critically, `value` is never checked against `allKkeStates()` — an SME's own wording is accepted whatever it is, known project state or not, and threaded through as-is into `Final_KKE`. The two dropdowns that let a user act on a suggested value (the resolve dialog's per-row Final KKE select, and Table View's inline-edit select for `SME_Decision`/`Final_KKE`) both inject the current/suggested value as an extra `<option>` when it isn't already one of `allKkeStates()`, so an out-of-vocabulary SME decision stays visible and pre-selected instead of silently losing its pre-selection.

---

## Client reports

Six client-facing reports accessible from the Reports menu, all using shared infrastructure:

- `buildReportShell(title, bodyHtml)` — wraps body HTML in a full standalone HTML document with embedded styles
- `showReport(title, bodyHtml, exporterFn)` — renders report in the progress modal and wires up the exporter callback
- `exportReport(title, bodyHtml, defaultName, format)` — exports as PDF (via `export-progress-pdf`) or HTML (via `export-report-html`)
- `_progressModalExporter` — callback stored globally; called with `'pdf'` or `'html'` when the user clicks the export buttons in the progress modal

Reports: Executive Summary, Content Inventory by Section, SME Review Status, Redirect Map Report, Net New Content Brief, Migration Checklist. Each is triggered by a `menu-report-*` IPC channel from the Reports menu.

**Menu Report (`reportMenus`, formerly the nav "IA Report"):** the polished section-card + tree report — once the in-menu nav IA, now **fed by the independent menus** (this retired the parked `inMenu`/IA-report question). `_menuToReportSection(menu)` converts each menu's item tree into the pseudo-node shape the existing builders consume (`ref` → referenced node's id so page counts resolve; `header` → `nodeType:'Header'`; `link` → `_link` URL; broken ref → `_missing`), and `reportMenus()` feeds `menus.map(_menuToReportSection)` to `_navIaPreviewHtml` / `_navIaExportHtml`. The shared item builders (`_navIaPreviewSubtree` / `_navIaExportL2` / `_navIaExportItem`) render per-item badges: page-count `Np` on refs, `↗` on `_link`, `≡` on headers, red **missing** on `_missing` (the old empty/redirect node-states still exist for ref-to-empty-node leaves). Reached via **Menus → Report** (`#btn-menu-report`) and **Reports → Menu Report…** (`menu-report-nav-ia` IPC, kept). The old nav-editor IA-Report button was removed.

Page counts in both `renderNavEditor()` and `_navPageCountsCache()` exclude Kill/Consolidate rows so those pages do not inflate live-page tallies.

**Default redirect URL propagation**: when `defaultRedirectUrl` is changed in Project Settings, the app checks for existing redirect destinations matching the old value and offers to update them all via a confirmation dialog showing the count of affected pages.

---

## Update check

Manual, notify-and-link — **not** silent auto-download/install. On launch (main.js `app.whenReady()`, ~3s after `createWindow()`) and via **Help → Check for Updates…**, main fetches the update manifest, compares `manifest.version` to `app.getVersion()` (`compareVersions()`, dotted-numeric — no external semver dep), and returns `{ available, current, latest, notes, changelogUrl, downloadUrl, publishedAt }` (or `{ error }`).

- **Why a separate repo**: the main source repo (`factus10/transmission`) is **private**, so `raw.githubusercontent.com` / `github.com` URLs into it 404 for anyone not authenticated as a collaborator — and GitHub Pages can't be enabled on a private repo without a paid plan. The manifest + changelog instead live in **[`factus10/transmission-updates`](https://github.com/factus10/transmission-updates)**, a small dedicated **public** repo — no app source, no client data — published via GitHub Pages at `https://factus10.github.io/transmission-updates/`. As of 2.6.2 it also carries a **mirrored GitHub Release per version** (same dmg/zip built for the private repo's release, re-uploaded here) purely so `downloadUrl` resolves publicly; the private repo's own per-version Releases remain the primary/canonical ones.
- **Manifest**: `UPDATE_MANIFEST_URL` in main.js points at `https://factus10.github.io/transmission-updates/update-manifest.json`. `changelogUrl` and `downloadUrl` inside it must resolve to a trusted host (`isTrustedUpdateUrl()` allowlists `factus10.github.io` / `github.com`, https-only) — `performUpdateCheck()` throws if either isn't, and `openChangelogWindow()` silently no-ops on an untrusted URL. `downloadUrl` = `https://github.com/factus10/transmission-updates/releases/latest` (the public mirror, not the private source repo).
- **Release step — `scripts/publish-release.sh` does steps 3–5.** Do 1–2 by hand, then run it:
  1. Bump `version` in `package.json` **and** `package-lock.json` (they have drifted before — the script now refuses if they disagree) and move the `[Unreleased]` CHANGELOG entries under the new version heading, so the published changelog never describes shipped features as unreleased.
  2. `rm -f dist/*.dmg dist/*.zip`, then `npm run build:signed:sandboxed` with the four `APPLE_*` env vars set (see `docs/dev/BUILD_SIGNED_BINARIES.md`; credentials live in `~/Documents/Apple Dev/`). Clearing `dist/` first matters: the script's notarization loop globs `dist/*.dmg`, so leftovers from earlier versions get re-notarized, wasting a round trip each.
  3. `npm run release:publish -- --manifest-notes <file>` — creates both releases, verifies them, and publishes the manifest. Omit `--manifest-notes` to do the releases only and stop; re-running is safe (existing releases are reused and re-verified). `--dry-run` runs every check and publishes nothing.

  **Why a script rather than the four commands it replaces.** Both of its non-obvious guards come from releases that actually broke:
  - **`gh release create` with assets creates a DRAFT, uploads, then publishes.** A 10-minute tool timeout killed it mid-upload on the mirror, leaving a drafted release with zero assets. A draft is not eligible to be `latest`, so `releases/latest` kept resolving to the *previous* version — while the manifest advertised the new one. Every user would have been told to update and handed the old build. The script therefore creates an explicit draft, uploads each asset **on its own** (a combined upload that dies partway gives no signal about which asset survived), verifies every byte count against the local file, publishes only then, and asserts `repos/<repo>/releases/latest` equals the tag.
  - **The manifest is written LAST**, and only after both repos pass all of that — it is what tells every running copy an update exists, and its Download button resolves through `releases/latest`.

  It also refuses to run on artifacts that are not shippable: dmg and inner `.app` both stapled, Gatekeeper `source=Notarized Developer ID`, `CFBundleShortVersionString` matching the version being released (catches a stale dmg renamed to look current), universal slices present, and `dist/` free of other versions' artifacts. The changelog regeneration is gated on the section count going up by exactly one, so a generator that drops history can't publish.

- **Startup path**: `performUpdateCheck()` runs once; if `available`, main pushes the result to the renderer via `update-check-result` (`mainWindow.webContents.send`). Any failure (offline, bad manifest, untrusted host) is swallowed — a startup check should never interrupt the user with an error.
- **Manual path**: Help → Check for Updates… sends `menu-check-updates`; the renderer calls `window.electronAPI.checkForUpdates()` (invoke/handle over `check-for-updates`) and always shows feedback — a toast either way (`"You're up to date (vX.Y.Z)"` / an error toast) or, when available, `showUpdateModal()`.
- **`showUpdateModal(result)`** (renderer.js) is the shared UI for both paths: an `openModal()` dialog with **Later** (dismiss), **What's New** (`window.electronAPI.openChangelogWindow(result.changelogUrl)` — loads the changelog page in a small internal `BrowserWindow`, not the system browser), and **Download vX.Y.Z** (`openExternal(result.downloadUrl)` → the GitHub Releases page, opened in the system browser since installs are still manual drag-to-Applications — no `electron-updater`/Squirrel wiring).
- **No changelog packaging**: the "what's new" viewer just points at the live, separately-hosted changelog page — nothing changelog-related ships inside the `.dmg`.

---

## Dependencies

| Package | Used for |
|---------|----------|
| SheetJS (`xlsx`) | Reading and writing xlsx files (all general file I/O) |
| ExcelJS | SME export only — needed for data validation dropdowns in xlsx |
| JSZip | Transitive from ExcelJS; also used directly for post-processing xlsx (`&quot;` fix) |
| ~~D3~~ / ~~mermaid~~ | **Both fully removed (2026-06-29).** The Visual Sitemap was rewritten as a self-contained engine (`src/sitemap-template.js`), retiring D3. The direct `d3` dep was uninstalled; `mermaid` (the only thing transitively pulling in d3) turned out to be dead weight — its sole reference was a vestigial `renderMermaid` preload bridge with no `ipcMain` handler and no caller — so it was uninstalled too (also dropping `d3` and `dagre-d3-es` from node_modules), and the dead bridge line was removed from preload.js. |

---

## Structural sheets

Sheets hidden from the data sheet picker:

| Sheet | Purpose |
|-------|---------|
| `Sitemap` | Navigation tree nodes (Number, Label, Path, ID, URL, `Url_Path` URL override, etc.). Legacy name `NavStructure` (and legacy data-row columns `NavID`/`Nav Destination`/`Nav_SortID`) are auto-detected and renamed in place on open — see `renameLegacyNavColumns()` and the sheet-rename step in `writeWorkbook()`, both in main.js. |
| `KKE_Settings` | Project-level key/value store (clientName, projectName, siteDomain, defaultRedirectUrl, customKkeStates, savedFilters, kkeFilter). Arrays like kkeFilter and savedFilters are JSON-serialized when written and parsed back on load. |
| `KKE_ChangeLog` | Audit trail: Timestamp, Row, URL, Field, Old Value, New Value. Written on save from `_sessionChangeLog`; accumulates across sessions. |
| `KKE_Glossary` | Tag/group descriptions: Type, Name, Notes (markdown). Parsed by `parseGlossarySheet()` and written by `writeGlossarySheet()`. Empty-notes entries pruned on save. |
| `ContentTypeRegistry` | The current→target **crosswalk**. Per current content type: `{ contentType, defaultContentNature, targetContentType, targetSpec, defaultMigrationTrack, notes }` (sheet columns `Content_Type`, `Default_Content_Nature`, `Target_Content_Type`, `Target_Spec`, `Default_Migration_Track`, `Notes`). Parsed by `parseContentTypeRegistrySheet()`; written by `writeContentTypeRegistrySheet()`. Sorted alphabetically on save. Curated default registry (`DEFAULT_CONTENT_TYPE_REGISTRY` in main.js, ~20 entries) offered via opt-in seed banner + "Seed with defaults". Editor: `openContentTypeRegistryEditor()` (Project → Content Type Registry…) — columns Content Type (current) · Renders as · Target Content Type · → Target Spec · Migration Track · Notes. **Gap surfacing (like the glossary):** the editor's working list is the registry rows *plus* stub rows for content types that are **in use** in the data but uncovered (split-aware via `lookupContentTypeRegistry`), each tagged with a non-persisted `_origin` (`'registry'`/`'inuse'`/`'picklist'`) and flagged "● in use · N pages · no crosswalk". A **"Show all pick-list types"** toggle (`#_ctr-show-picklist`) adds uncovered global `pageTypeLibrary` values as `'picklist'` stubs. **Save persists** registry rows (always, if named) plus any stub the user actually mapped (`isMapped` = any of nature/target/spec/track/notes non-blank); untouched `inuse`/`picklist` stubs are dropped and `_origin` is stripped — so browsing/toggling never bloats the sheet. Footer reads `N types · M mapped · K need crosswalk`. `applyContentTypeRegistryDefaults()` fills blank `Content_Nature`/`Migration_Track`/`Target_Content_Type` only — never overwrites. `seedDismissed` flag: `projectSettings.contentTypeRegistrySeedDismissed`. |
| `PatternLibrary` | (UI label: **Target Spec Library**) Per-project specs each target content type is built from. Per spec: `{ patternName, description, buildGuidanceDefault, writerBriefDefault, defaultMigrationTrack, notes, kind, migrationMappingDefault, fields }` (sheet columns add `Kind`, `Migration_Mapping_Default`, `Fields`). `kind` ∈ {`Page Template`, `Content Model`}; `fields` (schema) shown in the editor only for Content Models. `migrationMappingDefault` is the third direction kind (for the migration engineer) and is what the Migration Direction Brief's **migrator** role reads as its type-level reference. Parsed by `parsePatternLibrarySheet()`; written by `writePatternLibrarySheet()` (clamped vs 32767). Curated default (`DEFAULT_PATTERN_LIBRARY`, 12 entries) seeded opt-in when a nav tree exists. Editor: `openPatternLibraryEditor()` — two-pane master-detail with a Kind dropdown. Menu: Project → Target Spec Library…. Banner flag: `projectSettings.patternLibrarySeedDismissed`. |
| `Sites` | Source sites a consolidation audit is merging. Per site: `{ label, hosts[], cms, owner, inScope, color, notes }` (columns `Label`, `Hosts`, `CMS`, `Owner`, `In_Scope`, `Color`, `Notes`). Parsed by `parseSiteLibrarySheet()`; written by `writeSiteLibrarySheet()`. `In_Scope` blank means **in** scope — only an explicit no opts a site out, so a hand-edited sheet can't silently drop a site from every report. Auto-seeds one entry per normalized host found in the data, so a single-domain project is a one-entry registry that changes nothing. Editor: **Project Settings → Sites**. |
| `Jobs` | Jobs-to-be-done workshop output. Per job: `{ label, statement, audiences[], notes }` (columns `Job`, `Statement`, `Audiences`, `Notes`). Parsed by `parseJobLibrarySheet()`; written by `writeJobLibrarySheet()` (grouped by first audience, then label). `label` is what goes in the row cell so the sheet stays readable — `sanitizeJobLabel()` replaces commas with `;` because commas separate values in `Jobs_Served`. Editor: **Project Settings → Audience → Jobs to be done**. |
| `Audiences` | Audience prioritization workshop output. Per audience: `{ name, tier, color, description, notes }` (columns `Name`, `Tier`, `Color`, `Description`, `Notes`). Parsed by `parseAudienceLibrarySheet()`; written by `writeAudienceLibrarySheet()` (tier order, then alphabetical — the sheet should read like the workshop output it came from). A hand-typed tier that doesn't match `AUDIENCE_TIERS` falls back to `Secondary` rather than becoming an unmatchable value. Seeded opt-in from either of the two `AUDIENCE_STARTER_SETS`. Editor: **Project Settings → Audience** (`renderAudienceTab()`), also reachable via Project → Audience Library…. |
| `DesignPatternLibrary` | (UI label: **Component Library**) App-level library of UI components that appear on pages (hero banners, card collections, etc.). Columns: `Name`, `Category`, `Complexity`, `Description`, `DS_URL`, `Aliases`, `Notes`. Parsed by `parseDesignPatternLibrarySheet()`; written by `writeDesignPatternLibrarySheet()` (sorted by category then name). Primary storage: `prefs.json` (global). Default: `DEFAULT_DESIGN_PATTERN_LIBRARY` in main.js — 57 entries across 12 categories. Exposed via `get-default-design-pattern-library` IPC. Editor: `openDesignPatternLibraryEditor()`. Menu: Project → Component Library…. Stored in `state.designPatternLibrary`. Distinct from `PatternLibrary` which is for nav node page-build templates. |

`KKE_Settings` is read on file open (`parseSettingsSheet()`) and written on save (`writeSettingsSheet()`). `writeSettingsSheet()` JSON-stringifies arrays and objects before writing cells; `parseSettingsSheet()` auto-detects and parses JSON values (strings starting with `[` or `{`). Settings travel with the file. Add new keys by setting them in `state.projectSettings` and collecting them in `saveFile()`.

The **Project Settings** modal (File → Project Settings) is a tabbed dialog with five tabs:
- **Identity** — client name, project name, site domain, default redirect destination
- **KKE States** — custom KKE states (with color picker) and rogue-value cleanup
- **Suggestions** — GA Analytics source (button opens `openGaKkeConfigDialog()` for column mapping + metric weights), Rubric source (button runs `runBatchAssessment()`), and source weights inline (`ps-weight-ga`, `ps-weight-rubric`) with "Save weights & recompute" action
- **Migration** (Phase 2, Chunk γ) — Page Statuses library (color, rename, reorder, delete with cascade-clear) and Assignees library (rename, delete with cascade-clear across `buildAssignee`/`writeAssignee`/`migrateAssignee` on nav nodes). Usage counts (`{build, write, migrate}`) shown per entry. `renderMigrationTab()`, `renderPageStatusList()`, `renderAssigneeList()`, `computePageStatusUsage()`, `computeAssigneeUsage()`.
- **Saved Filters** — list of named saved filter bundles with Apply / Delete per row

Implemented as a proper `.modal-overlay` + `.modal-dialog` (replaced the earlier draggable popover). All modals are draggable from their header via the reusable `makeModalDraggable(modalEl, { handleSelector? })` utility. `resetModalPosition(modalEl)` clears positioning on close so reopen returns to center. Modals using this utility: Project Settings, ContentTypeRegistry editor, Computed Columns, Glossary editor, GA KKE config dialog. Handle defaults to `.modal-header`; older dialogs that use a custom first-child header div pass `handleSelector: ':scope > div:first-child'`. The utility skips drag when the mousedown target is a button/input/select/textarea/link. `toggleProjectSettingsPopover()` opens it; `switchProjectSettingsTab(tab)` handles tab switching. `refreshSuggestionsTab()` populates the Suggestions tab from `state.projectSettings.gaKkeConfig` and `suggestedKkeConfig()`. `renderSavedFiltersList()` populates Saved Filters. Standalone GA KKE Settings and Suggested KKE Settings menu items are removed; their UIs live inside the Suggestions tab. The **App Settings** popover (⚙ button, or File → App Settings) handles application-wide prefs (auto-advance, show SME fields, rubric dir, API key, sidebar columns, column mapping). Custom KKE states are stored BOTH per-project (KKE_Settings sheet, travels with file) AND globally (app prefs, so new files inherit them).

**Site domain** (`siteDomain`): sets the target domain for redirect URLs and nav paths. Overrides auto-detected domain from spreadsheet URLs. When changed, existing redirect destinations using the old domain are rewritten to use the new one.

---

## Common extension patterns

### Add a new IPC call
1. `ipcMain.handle('name', ...)` in `main.js`
2. `name: () => ipcRenderer.invoke('name')` in `preload.js`
3. `window.electronAPI.name()` in `renderer.js`

### Make a read-only field editable
Add the header name to `editableFields` in `renderMetaFields()` in `renderer.js`.

### Add a new KKE state
1. Add `<option>` in `#kke-select` in `index.html`
2. Add CSS class + color vars in `styles.css` (follow `.kke-keep` pattern)
3. Add `kke-badge` CSS class for the row list badge

### Change default visible fields
Edit `DEFAULT_VISIBLE_FIELDS` in `main.js`.

### Change default tag library
Edit `DEFAULT_TAG_LIBRARY` in `main.js`.

### Show more columns in the row list
Change `.slice(0, 3)` in `renderRows()` and `renderColHeaders()` in `renderer.js`.

### Add a new SME Decision option
1. Add the option value in the SME export logic in `main.js` (ExcelJS data validation list)
2. Add a matching entry in the SME resolve logic in `renderer.js`
3. If the option maps to a new KKE state, also follow "Add a new KKE state" above

### Add a new full-panel view
1. Add a container `<div id="your-view">` in `index.html` (inside `#main-panel`, hidden by default)
2. Add a toggle function in `renderer.js` that hides `#content-area` / other views and shows the new view
3. If the view should hide the sidebar, add a CSS class toggle (follow `.tv-active` pattern)
4. Add a menu item and/or keyboard shortcut in `main.js`, with a corresponding IPC channel
5. Wire the IPC in `preload.js` and handle in `renderer.js`

### Add a new structural sheet (like KKE_Glossary)
1. Add the lowercase sheet name to `structuralNames` in `main.js` `readWorkbook()` so it's hidden from the data-sheet picker
2. Write a `parseYourSheet(worksheet)` function mirroring `parseGlossarySheet()`
3. Write a `writeYourSheet(workbook, data)` function mirroring `writeGlossarySheet()`
4. In `readWorkbook`: detect the sheet by lowercase name and attach its data to `projectSettings` (so it travels through the `file-opened` IPC payload)
5. In `writeWorkbook`: call `writeYourSheet()`. Nothing else is needed to preserve other sheets — `writeWorkbook` mutates the workbook parsed from the existing file, so any sheet it doesn't overwrite survives as-is. If the library can be *emptied*, route the empty case through `writeEmptyStructuralSheet()` so the deletion persists (see `writeContentTypeRegistrySheet`)
6. In renderer: read from `state.projectSettings.yourData` on load; mutate and `setDirty(true)` on edit; save flow picks it up automatically because `saveFile()` spreads `state.projectSettings` into the payload

### Add a new computed/derived column (like GA KKE)
1. Choose column names (e.g. `X_Recommendation`, `X_Score`) — these are written as plain values, no formulas
2. Define a config object shape and store under `state.projectSettings.xConfig` (auto-serialized as JSON via KKE_Settings sheet)
3. Write a detection helper that checks `state.headers` for required source columns
4. Write a compute helper that: parses source values, ranks/aggregates, inserts output columns via `state.headers.splice()` (add to `state.editedRows` + `state.rows` too), writes results, updates `config.computedAt`, calls `setDirty(true)`, refreshes UI via `applyFilter()`
5. Add a settings dialog following the `openGaKkeConfigDialog()` pattern (overlay + modal, form fields, Save + Save&amp;Compute buttons)
6. Add a refresh menu item + handler that just calls the compute helper
7. If a banner prompt on file open makes sense, call a `maybeOfferXSetup()` from the end of `loadData()`
8. Optionally surface in the audit bar as a read-only badge (element cached in `els`, class toggled by a small update function called from `populateAuditFields()`)

---

## CSS custom properties

All colors and key dimensions are in `:root` in `styles.css`. Edit there before touching component rules.

Key tokens:
- `--kke-keep/kill/evolve` + `--kke-*-bg` — KKE state colors
- `--bg-field-bar` / `--bg-audit-bar` — the two field bar rows
- `--sidebar-w` — initial sidebar width (resizable at runtime)
- `--font-sans` / `--font-mono` — IBM Plex Sans / Mono

---

## UI / UX standards (read before building any UI)

**`docs/UI_STANDARDS.md` is the contract for all interaction and presentation.** Before adding a dialog, button, toast, or any UI, follow it. The essentials:
- Never use `window.confirm/alert/prompt` → use `confirmDialog` / `alertDialog` / `showPrompt`.
- Never hand-build a modal → use `openModal()` (or `registerModalDismiss()` to retrofit a legacy one). It owns Esc, backdrop-close, z-index stacking, and the `.modal-close ×` header.
- Footers: `btn btn-sm`; one green `btn-primary`, rightmost; `Cancel` ghost to its left; utilities/count on the left via a `flex:1` span. Destructive primary = `.btn-danger`.
- No hardcoded colors/fonts/sizes — use the `:root` custom properties. Feedback via `showToast`.
- There's a pre-merge checklist at the end of `docs/UI_STANDARDS.md`.

## Documentation

When adding features or making user-facing changes, update **all four** documentation sources:

| File | What it is |
|------|------------|
| `README.md` | Project overview, feature list, setup instructions |
| `docs/RUNNING_AN_AUDIT.md` | **The opinionated engagement sequence** — what to do in what order, why the order matters, and the semantic decisions the tool bakes in (blank = unreviewed, Kill vs Exclude, canonical over inference). The onboarding doc for new auditors; update it whenever a step's *ordering* or a baked-in assumption changes, not for every feature |
| `docs/USER_GUIDE.md` | Full user manual — assumes an intelligent reader new to KKE audits and the app |
| `docs/PITCH.md` | Client-facing pitch (written + conversational versions) — describes the audit process and its competitive advantages |
| `src/help.html` | Help window — concise feature documentation opened as a separate window |

### Publishing the public docs site

The user-facing subset is published to `https://factus10.github.io/transmission-updates/docs/` — the public home for people who have the app but not this repo. `npm run docs:html` renders it into `dist/docs-site/` via `scripts/generate-docs-site.js`; copy that over `docs/` in the `transmission-updates` repo and push (same repo, and same reasoning, as the changelog page).

**The published set is an explicit allow-list in that script, never a directory walk** — `docs/` also holds the pitch, the dev notes, the UI contract and the screenshot scripts, and a walk would ship them the moment someone adds a file. Currently published: Quick Start · Running an Audit · User Guide · Content Audit Framework · `walkthroughs/` · `methodology/` · `report-templates/`. A link from a published doc to an unpublished one is degraded to plain text (and reported on stdout) rather than shipped as a 404.

Generated HTML rather than committed markdown because the updates repo carries `.nojekyll`, so Pages serves a committed `.md` as plain text.

For UI/interaction changes, also keep **`docs/UI_STANDARDS.md`** current (the interaction contract) and **`docs/dev/REVIEW_FINDINGS.md`** (the audit backlog) up to date. If a change alters the design tokens (`:root` in `styles.css`), the button specs, or the dialog/toast conventions, also update **`docs/SHARED_STYLE_GUIDE.md`** — the portable style contract handed to the sibling **Tauri** app to keep both apps visually consistent (it mirrors §1 tokens + §2 button CSS verbatim).

---

## Bug fixes (logged here for reference)

- **Phased nodes and NEW badge:** `isHub` and `isOrphanLeaf` logic both gate on `!isPhased` before applying the `.ne-net-new-badge`, so nodes with a non-empty `node.phase` never show the NEW badge.
- **`deleteNavNodeFromEditor` object-reference lookup:** now uses `_findNavNodeLocation()` by object reference rather than `parentNumber` to find the target in the tree, fixing "also delete this node" failing silently after nav reorganizations that left stale `parentNumber` values.
- **`clearNavAssignment()` live tree refresh:** now calls `invalidateNavPageCountsCache()` and, if `_navEditorOpen` is true, `renderNavEditor()` so the nav tree immediately reflects the cleared page assignment without requiring a manual re-open.
- **`undoNavDelete()` re-cascades to survivor rows:** the delete and bulk-delete tails run `recalcAllNumbers → recalcDerivedFields → resolveNavReferences → cascadeNavChangesToRows`, but undo's tail stopped at `resolveNavReferences` and never cascaded. So undoing a nav-node delete restored the deleted node and its own rows correctly, yet rows assigned to *renumbered survivors* kept the stale `Sitemap_SortID` / `Computed Path` / `Sitemap_Destination` the delete's cascade had written. Undo now snapshots survivor paths before re-inserting (post-delete state) and calls `cascadeNavChangesToRows(oldPaths)` in its `restoredAny` tail — mirroring the forward delete exactly, so an undone delete is now a true round-trip (verified on a 580-node/4020-row fixture: deleting a top-level section renumbers 3437 survivor rows; old undo left all 3437 with wrong derived fields, the fix brings it to 0). `redoNavDelete()` already cascaded (it re-invokes `executeDeleteNavNodeCore`), so only undo needed it.
- **Triage Non-200 dialog painted under its own overlay:** `openNon200TriageDialog()` appended its dialog to `<body>` as a *sibling* of the overlay. `.modal-overlay` is `position:fixed` + z-indexed (a stacking context) while `.modal-dialog` is not positioned — and z-index is ignored on a static-position element — so the dialog painted **beneath** the dim mask and sat in normal document flow in the corner, unreachable. `registerModalDismiss()`'s stacked z-indices couldn't help for the same reason. Fixed by `overlay.appendChild(modal)`, the rule `openModal()` already documents and follows. Every other hand-built dialog in renderer.js escapes this by setting `position:fixed` in its own inline `cssText`; this one and no other omitted it. `docs/UI_STANDARDS.md` §1.5 now states the rule (its example previously showed the sibling form).
- **Field filter chips clipped their own remove button:** `.field-filter-chip` carried `max-width:240px; overflow:hidden`, and `#field-filter-chips` was an ordinary flex item in `#toolbar-row2`. A second chip squeezed the container below one chip's content width, chips shrank (flex items shrink before their `max-width` matters), and `overflow:hidden` clipped the trailing `×` — measured at 181px outside the pill on a 300px sidebar. So a filter that was hiding rows could not be removed. Fixed on both axes: `#field-filter-chips:not(:empty)` takes `flex:1 1 100%` (chips get their own row; `:empty` collapses so nothing changes with no filters), and inside a chip only `.ff-chip-field`/`.ff-chip-value` truncate while the `×` is `flex-shrink:0`.
- **`redoNavDelete()` replays the original page disposition:** redo hardcoded `executeDeleteNavNodeCore(item.node, item.mode, 'clear', null)`, so redoing a single-node delete that had reassigned its pages to the parent (`assignAction:'parent'`) or another node (`'other'`) instead **cleared** those pages — diverging from the original delete (bulk deletes always clear, so they were unaffected). `captureNavDeleteUndoSnapshot()` now records `assignAction`/`reassignTarget` on the undo item, and `redoNavDelete()` replays them; the `'other'` target is re-checked against `state.navNodes` first (falls back to `'clear'` if it was removed between undo and redo, rather than assigning pages to a ghost node). Verified live: delete a leaf reassigning its 7 pages to another node → undo → redo; old code cleared all 7, the fix reassigns them to the original target.

---

## Known limitations / future work

- Single sheet only — reads `workbook.SheetNames[0]`
- Virtual scrolling in sidebar — tested to ~4,000+ rows (ROW_HEIGHT=34px, OVERSCAN=10)
- Undo/redo: Cmd+Z / Cmd+Shift+Z for KKE changes and sitemap node deletions (single or bulk), 100-action stack per session
- Tag library is global (shared across all files); visibleFields is also global
- `new-window` events from webview open in system browser — intentional
- Webview cannot load `localhost` URLs in production without CSP adjustment
