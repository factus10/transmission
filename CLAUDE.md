# CLAUDE.md — Excel Browser

Electron app for macOS (universal ARM + Intel). Designed primarily for **Screaming Frog crawl exports** (`.xlsx`). Shows rows in a left sidebar, loads each row's URL in an embedded webview, and provides a persistent **field bar above the browser** for reading metadata and recording content audit decisions.

---

## Commands

```bash
npm install          # first-time setup (postinstall runs electron-rebuild for better-sqlite3)
npm run rebuild      # rebuild better-sqlite3 against Electron (after Electron version bumps)
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

**View switcher** (`#view-switcher`) sits between the OS titlebar and the app shell. Always visible. Five tabs: Audit · Table · Sitemap · Redirects · Menus. `setupViewSwitcher()` wires the clicks; `refreshViewSwitcher()` keeps the active state in sync with the underlying `_tableViewOpen` / `_navEditorOpen` / `_redirectEditorOpen` / `_menusViewOpen` flags and is called from each view's open/close functions.

**Menu organization (post-reorg):**
- **App menu (macOS) / File (Win/Linux)** — Preferences (Cmd+,)
- **File** — Open · Open Recent · Save · Save As Project… (Cmd+Shift+S) · Import/Merge · Merge Auditor · Save/Load Template · Export… (unified dialog `openUnifiedExportDialog()`) · Export Full Workbook (.xlsx)… · Package for Handoff…
- **Edit** — standard
- **View** — Audit (Cmd+1) · Table (Cmd+T) · Sitemap (Cmd+Shift+T) · Redirects (Cmd+Shift+R) · Menus (Cmd+Shift+M) · Audit Progress (Cmd+P) · zoom · fullscreen · (dev items in source builds)
- **Project** — Project Settings · Triage Non-200 Pages · Create Sitemap from Audit · Glossary · Content Type Registry · Target Spec Library · Component Library · AI Suggest for Unreviewed · Run Rubric · Refresh GA KKE · Recompute Suggested KKE
- **Migration** — Pre-Handoff Check · Migration Tracker · Export Redirect Map (CSV) · Redirect Chain Check
- **Reports** — Executive Summary · Content Inventory by Section · SME Review Status · Menu Report · Sitemap Coverage Report · Component Inventory · Content Type Crosswalk · Migration Direction Brief · Migration Checklist · Net New Content Brief · Redirect Map Report
- **SME** — Export / Import / Compare KKE vs SME / Resolve
- **Help** — Getting Started · Product Tour · Keyboard Shortcuts · Transmission Help · Check for Updates…

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
preload.js       — contextBridge: exposes window.electronAPI
src/
  index.html     — DOM structure (no inline scripts/styles)
  help.html      — Help window (separate BrowserWindow)
  renderer.js    — All UI logic (no Node APIs)
  sitemap-template.js — Visual Sitemap engine: window.SitemapTemplate.build(data) → standalone HTML (app/client/print). Loaded before renderer.js.
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
| renderer → main | `export-report-html` | `{ html, defaultName }` → `{ success, filePath?, error? }` — saves HTML report file |
| renderer → main | `export-sitemap-pdf` | `{ html, defaultName }` → `{ success, filePath?, error? }` — loads a print-mode sitemap HTML (from `SitemapTemplate.build`) in a hidden window, waits for `document.title==='READY'`, then `printToPDF({ preferCSSPageSize:true })` to one page sized to the tree |
| main → renderer | `menu-non200-triage` | none — opens non-200 triage dialog |
| main → renderer | `menu-create-sitemap-from-audit` | none — opens the Create Sitemap from Audit dialog |
| renderer → main | `check-for-updates` | none → `{ available, current, latest, notes, changelogUrl, downloadUrl, publishedAt } \| { error }` — fetches `update-manifest.json` and compares to `app.getVersion()` |
| renderer → main | `open-changelog-window` | url string — opens the changelog URL in a small internal `BrowserWindow` (rejects untrusted hosts) |
| main → renderer | `menu-check-updates` | none — Help → Check for Updates… |
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

**`openNavNodeEditor()`** is structured as a stack of labeled, color-pilled blocks (the `.nne-section` / `.nne-section-header` / `.nne-section-pill` pattern) so the long form is scannable rather than a flat field list: a tinted read-only **Context** panel (`.nne-context-panel` — Parent / Breadcrumb / Computed Path / Page breadcrumb), then **Identity** (slate pill — Label, Slug, In menu, Node type `#_nne-node-type` Page/Header/Fragment with live `#_nne-node-type-hint`, Phase), **Addressing & breadcrumb** (teal pill — External URL, URL override, Breadcrumb parent, Reference), **Notes** (gray pill — "Migration notes"), then **Build** (blue — pattern + status + builder + guidance), **Write** (violet — writer + brief), and **Migrate** (amber — migrator assignee `#_nne-massignee`; the mapping reference itself lives on the target spec, not the node). Section pills use inline hex backgrounds (matching the existing Build/Write/Migrate pills). Inline-add behavior implemented via the reusable `buildInlineAddSelect({ wrapEl, selectId, options, currentValue, placeholder, newPromptTitle, onNewValue, decorator })` helper. The `decorator` callback (used for Page_Status) renders a color swatch next to the select.

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
| `Page_Breadcrumb`    | Derived (display) | The page's **on-page breadcrumb** for its assigned sitemap node — `pageBreadcrumbOf(node)`, honoring the breadcrumb-parent axis + Home prefix (e.g. `Home > Departments > Chemistry`). Distinct from `Sitemap_Destination` (the physical IA label chain). Read-only; recomputed by `recomputeAllPageBreadcrumbs()` |

**`Page_Breadcrumb` (derived breadcrumb column):** because the breadcrumb axis is decoupled from the sitemap hierarchy (`breadcrumbParentId`), a row's `Sitemap_Destination` no longer reflects the actual on-page breadcrumb. `Page_Breadcrumb` carries it. `computeRowPageBreadcrumb(row)` resolves the row's `Sitemap_ID` → node → `pageBreadcrumbOf(node)`. It's written wherever `Sitemap_Destination` is (assign direct/child, `createFirstNavNodeFromPage`, `cascadeNavChangesToRows`, node delete/reassign) and cleared on unassign. `recomputeAllPageBreadcrumbs()` refreshes every placed row for edits that don't cascade — breadcrumb-parent overrides + the `breadcrumbHomeLabel` — and backfills once on file open (idempotent, un-dirtied). Shows in Table View by default; read-only in the field bar.

**Schema additions:** `Content_Nature`, `Migration_Track`, `Target_Content_Type`, `Suggested_KKE`, `Suggested_KKE_Sources`, `Source_CMS_URL`, `New_CMS_URL`, `Page_Breadcrumb`, `_ConsolidateTargetId` are appended to the `auditCols` injection list inside `injectAndOrderAuditColumns()` in `main.js` — the single source of truth for which columns get added to every file on open.

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
- **Clusters are click-to-collapse.** Each `.audit-cluster[data-cluster]` has a clickable `.cluster-pill` with a chevron (`.cluster-chev`); clicking adds/removes `.collapsed` on the cluster. Collapsed clusters hide all children except the pill and a `.cluster-summary` span that shows a short inline readout (e.g., `"Article / blog post · Published · CSCR-M"`). State persists per-cluster in `state.collapsedClusters` (object keyed by cluster name, in app prefs). `refreshClusterSummaries(row)` rebuilds the summary text on row selection. Per-cluster summary builders: `summarizeDecide/Classify/Tag/Review/Migrate/Cms`.

**Audit-bar cluster system (Phase 1 Chunk C UX pass):** the audit bar is structured as a vertical flow of labeled cluster cards rather than a flat field list. Each cluster is a `.audit-cluster` with a `.cluster-pill` label on the left edge:
- `.cluster-decide` — KKE buttons + Notes/Nav/Tree/Redirects buttons (blue pill)
- `.cluster-classify` — Page Type / Theme / Published / Group (slate pill)
- `.cluster-tag` — Primary Tag / Tags (violet pill)
- `.cluster-patterns` — Component chip input (label: "Components"), hidden behind `state.showDesignPatterns` (violet pill); `#design-pattern-fields-wrap`; toggled by `#qt-patterns` quick-chip ("Components") and `#pref-show-design-patterns`
- `.cluster-review` — SME workflow, hidden behind `state.showSmeFields` (teal pill); reuses `#sme-fields-wrap` ID
- `.cluster-migrate` — Content Nature / Track + ghost, hidden behind `state.showMigrationFields` (amber pill); reuses `#migration-fields-wrap` ID
- `.cluster-cms` — Source / New CMS links, 50/50 split, stacks under 900px (green pill)

`.audit-cluster` is `flex: 1 1 100%` so each cluster occupies its own row in `#field-bar-audit` (which is `flex-direction: column; gap: 6px`). Fields wrap freely inside a cluster. Old `.audit-divider` and `.audit-row-break` separators are hidden inside `#field-bar-audit` since clusters provide structure. Per-field `.audit-label` text is preserved but lighter (10px, slate-500); the cluster pill carries the higher-order framing.

**Phase 1 Chunk C — Migration classification UI:** `Content_Nature` and `Migration_Track` dropdowns live in `#migration-fields-wrap` (the `.cluster-migrate` cluster). Hidden by default behind `state.showMigrationFields` (App Settings → "Show Migration fields"; per-user pref). `applyMigrationFieldsVisibility()` toggles via `.hidden` class. `populateMigrationFields(row)` syncs both dropdowns and the ghost suggestion. The ghost (`#migration-track-suggestion`) appears next to the Track dropdown when its value is blank; click to accept. Suggestion derivation: `deriveMigrationTrackSuggestion(row)` uses Final_KKE (or KKE_Recommendation), Content_Nature (or registry-default-by-Page_Type as fallback). Mapping: Kill→Kill/Redirect, Consolidate→Merge, Evolve→Manual Rebuild, Keep+Page→Scripted, Keep+Content Object→Migrate Records, Keep+Generated→Configure, Exclude→blank. Setup wired via `setupMigrationFieldsHandlers()` in init. The KKE click handler also calls `populateMigrationFields()` so the ghost refreshes when KKE changes.

**ContentTypeRegistry default flow:** when a row's `Page_Type` changes, `applyContentTypeRegistryDefaults(origIndex, forUI)` looks up the registry via `lookupContentTypeRegistry()`. Primary lookup is case-insensitive exact match; fallback splits the page type on common separators (` / `, `,`, ` | `) and tries each token. Handles cases like `"Article / blog post"` matching the registry's `"Article"` or `"Blog Post"` entry without forcing the user to add every compound variant. If the matched entry has a default, it fills the row's `Content_Nature` and/or `Migration_Track` only when those fields are blank — never overwriting human input. Each filled field is logged via `logChange()`.

**Sidebar "Unclassified" filter:** `#btn-unclassified-filter` toggles a `Content_Nature is-blank` field filter. `refreshUnclassifiedButton()` syncs the button's `.active` class with current `state.fieldFilters` (called after chip removal, saved-filter restore, etc.). Composable with KKE filter and other field filters. Source/New CMS URL fields are wired through `populateCmsLinks()` and `setupCmsLinkHandlers()` in renderer; clicking the ↗ icon opens via `open-external`. Sidebar `.row-ind-cms` indicator (◐ source only / ◑ new only / ⊜ both) appears when either CMS URL is populated. Table View hides `Suggested_KKE_Sources`, `Source_CMS_URL`, `New_CMS_URL`, and `Design_Patterns` by default (`TV_HIDDEN_BY_DEFAULT` set); user reveals via column picker.

**Design Pattern inventory:** `Design_Patterns` column stores comma-separated pattern names per page (same storage pattern as `Tags`). Pattern vocabulary lives in `state.designPatternLibrary` = `[{name, category, complexity, description, dsUrl, aliases, notes}]` — **app-level (global), stored in `prefs.json`** (same tier as `tagLibrary` and `pageTypeLibrary`). Self-seeds from `DEFAULT_DESIGN_PATTERN_LIBRARY` (57 entries) on first run via async `getDefaultDesignPatternLibrary()` IPC call. Returns immediately with `[]` while async resolves; populated in seconds. The `DesignPatternLibrary` xlsx structural sheet is still read/written for backward compat and per-project additions — any names in the sheet not already in the prefs library are merged in on file open. Visibility controlled by `state.showDesignPatterns` (per-user app pref); `applyDesignPatternsVisibility()` adds/removes `.hidden` from `#design-pattern-fields-wrap` (`.cluster-patterns`, violet pill). Toggle via the `Components` quick-chip in `#cluster-quick-toggles` (`#qt-patterns`) or App Settings `#pref-show-design-patterns`. Core functions: `getRowDesignPatterns()` / `setRowDesignPatterns(patterns)` / `renderDesignPatternChips(patterns)` / `populateDesignPatterns(row)` — called from `populateAuditFields()`. Dropdown (`#design-pattern-dropdown`) is opened by `#btn-add-design-pattern`; `renderDesignPatternList(filter)` groups entries by `.category` with `.dp-category-header` sticky headers, shows `.dp-option-complexity` badge (Low/Medium/High), highlights already-selected entries; typing opens a "Create [name]" option. `setupDesignPatternHandlers()` wires the button, search input, create button, and outside-click-to-close. Library editor: `openDesignPatternLibraryEditor()` — two-pane master/detail using `.pl-modal` styles. **Seed defaults** calls `getDefaultDesignPatternLibrary` IPC (returns `DEFAULT_DESIGN_PATTERN_LIBRARY`, 57 entries across 12 categories). Cluster summary: `summarizePatterns(row)` → first 2 names + count overflow. Report: `reportDesignPatterns()` — per-component frequency table with KKE breakdown, one-off flag (≤2 pages), top 15 co-occurring pairs. Accessible via Reports → Component Inventory… (`menu-report-design-patterns` IPC). Sidebar filter for patterns uses existing field-filter system (`Design_Patterns contains X`).

**Sitemap `Node_Type`:** active, three values — `''` (Page), `'Header'` (structural grouping), `'Fragment'` (shared/embedded content). Set via the node editor's Node type select. **Fragment** nodes keep their computed path as a repository location but have no menu/breadcrumb/redirect; they render as their own layer (`.ne-fragment-badge` `FRAG` + `.ne-row-fragment`), are excluded from hub/empty/net-new counts (tree render + stats buckets), get a stats tally, and (being not-in-menu) are absent from the in-menu IA. `Nav_Layer` remains reserved (recognized in `parseNavSheet()`, preserved on rewrite, no UI). Existing files round-trip cleanly.

**Nature-aware downstream (`isFragmentRow(row)` = `Content_Nature === 'Content Object'`):** rows that render as a Fragment have no public URL, so they're skipped in `resolveRedirectDestinations()`, the Redirect Editor list (`renderRedirectEditor`), the tracker `buildRedirectsSheet()`, the need-placement count + `_needs-placement` filter, and Sitemap Coverage (`showNavCoverageReport()` also skips Header/Fragment nodes). `isFragmentRow` is a hoisted function declaration so earlier call sites resolve.

**Content type crosswalk:** `Page_Type` (UI label **Content Type**) is the key into `state.projectSettings.contentTypeRegistry` (entries: `{contentType, defaultContentNature, targetContentType, targetSpec, defaultMigrationTrack, notes}`). `applyContentTypeRegistryDefaults()` fills blank `Content_Nature` (UI **Renders as**), `Migration_Track`, and `Target_Content_Type`; `updateTargetContentTypeHint(row)` drives the `#target-ct-hint` `→ Target` readout in the audit bar. `Content_Nature` UI label is **Renders as** (Page / "Fragment (embeddable)" = stored `Content Object` / Generated). Crosswalk report: `reportContentTypeCrosswalk()` (`menu-report-content-crosswalk`).

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

`effectiveConsolidateUrl(master)` resolves the master's **absolute new-site URL** — used only to write `Redirect_Destination` (redirects always stay absolute). One-time migration in `loadData()` converts legacy projects: for consolidating rows with a `Consolidate_Into` value but no identity, it resolves the stored URL back to its inventory master, stores that master's Address as `_ConsolidateTargetId`, and rewrites `Consolidate_Into` to the relative path (toast + dirty flag; idempotent; off-inventory targets keep their legacy literal). Table View shows a plain-language `COLUMN_HELP` tooltip explaining the `Consolidate_Into` column.

**Consolidation Candidates workflow:** `openConsolidationCandidates()` is a Nav Editor toolbar action (`btn-nav-consolidate-candidates`) that opens a modal listing every nav node with 2+ assigned pages. `buildConsolidationCandidates()` groups rows by `Sitemap_ID`, returns groups sorted by size desc. Each group renders with radio buttons; `applyConsolidationGroup(group, targetOrigIndex)` sets the target to Evolve (preserving Keep/Evolve), the rest to Consolidate pointing at the master (identity `_ConsolidateTargetId` = master Address + derived `Consolidate_Into` display) and clears their nav + explicit redirect. Skipped groups are session-only (a `Set` inside the modal closure).

**Duplicate-destination guard (proactive, single-row):** complements the bulk Consolidation Candidates workflow above by catching the same mistake the moment it happens, rather than requiring the user to run that workflow. `findEvolveDestinationConflicts(origIndex)` returns other rows sharing this row's `Sitemap_ID` that are also Keep/Evolve (empty if this row isn't Keep/Evolve or has no `Sitemap_ID`). `maybeWarnDuplicateDestination(origIndex)` calls it and, if there's a conflict, opens a `confirmDialog` — "Did you mean to Consolidate?" — naming the other page(s); confirming calls `applyConsolidateTarget(origIndex, otherUrl)` (single conflict) or opens `openConsolidatePicker(origIndex)` (2+ conflicts, so the user picks). Hooked from two call sites: the main KKE button click handler (after setting KKE to Keep/Evolve) and `assignNav()`'s direct-assign branch (after assigning an existing row to a node that already has a page — the create-child branch can't conflict since it makes a new Sitemap_ID).

**Consolidate picker "Go to page →":** when the picker (`openConsolidatePicker`) has a `currentTarget`, the "Currently consolidating to" panel includes a button that resolves the target row by URL, closes the picker, closes whichever full-panel view is open (Table/Nav/Redirects/Menus), and calls `selectRow(targetIdx)` — same navigate-to-row pattern the Redirect Editor's clickable title uses.

**Duplicate Sitemap_ID detection:** `detectDuplicateNavIds()` returns `[{ id, nodes[] }]` for IDs assigned to 2+ nodes. `fixDuplicateNavIds()` keeps the first node's ID and renumbers the rest using next-available padded numbers. `renderNavEditor()` shows a red ⚠ link in the toolbar stats when duplicates exist.

**Multi-bar (unified action bar):** `setupMultiBar()` wires the single bottom-of-sidebar action bar that replaces the old `batch-bar` (filtered) and `bulk-bar` (selected). `getMultiBarTargets()` returns the target rows: multi-selected wins; otherwise filtered rows when filters are narrowing the list; otherwise empty. `applyMultiAction(row, origIndex, action, value)` handles each value-driven action (`kke`, `published`, `page-type`, `content-theme`, `group`, `primary-tag`, `add-tag`). `updateMultiBar()` shows/hides the bar and updates the label between "Apply to N selected:" and "Apply to N filtered:". The legacy `updateBulkBar` / `updateBatchBar` names are kept as shims so existing call sites keep working.

**Bulk sitemap assignment (`assign-nav` Multi-bar action):** unlike the other actions, this one has no value dropdown — picking it and clicking Apply opens `openBulkNavAssignDialog(targets, onDone)` directly (special-cased in both the `#multi-action` change handler and the Apply click handler). Eligibility defaults to `effectiveKke(row)` (`Final_KKE || KKE_Recommendation`) being `Keep`/`Evolve` — mirroring `createSitemapFromAudit`'s own gate — with an `_bna-include-all` checkbox ("Include Kill / Exclude / unreviewed pages too") to opt into everything else; this is the path for building a "current state" sitemap snapshot that intentionally includes killed/consolidated pages. Regardless of that checkbox, if any eligible row's effective KKE is `Consolidate`, one batched `confirmDialog` ("Include Consolidate pages?") asks before they're swept in — declining drops just those rows from the run. The dialog opens with an optional **Suggested** banner (only shown when found) computed by `suggestBulkNavTarget(eligibleTargets)` — the bulk equivalent of the per-row Sitemap picker's auto-suggestion: it runs `suggestNavFromUrl()` (walk each page's URL up to the nearest ancestor page that's already assigned to a node) across every eligible target and offers whichever node the most of them agree on, with a `(N of M pages…)` count; **Use this** one-click-accepts it via the same `pickExistingNode()` path as manually picking. Below that, the dialog offers two ways to choose a destination: **pick an existing node** (reuses `showMenuNodePicker()` verbatim) or **create a new bucket** (a label input + optional parent picker, also via `showMenuNodePicker()`; blank parent = a fresh top-level node). `createBucketNode(label, parentNode)` makes the bucket — a child via the existing `createNavChildForPage()` when a parent is given, or a hand-built root node (mirroring `addNavRootNode()`'s shape) when not — deduping its slug against its siblings either way (`uniqueSiblingSlug()`, case-insensitive, alias/ref nodes excluded from the collision check, appends `-2`/`-3`/…). A placement-mode radio then picks how pages land under that destination: **Direct children** (default, unchanged) calls `bulkAssignRowsToBucket(targets, bucketNode)`, which creates one child node per target row under the bucket via `createNavChildForPage()`, deriving each child's slug from `extractSlug()` on the row's URL (deduped the same way) and its label from `extractPageTitle()` on `Title 1`/`Title` (falling back to the slug when blank) — the same URL-suggestion building blocks `suggestNavFromUrl()`/`createNavChildForPage()` already used for the single-row case, just looped. **Preserve URL structure** instead calls the new `bulkAssignRowsPreservingUrlStructure(targets, rootParent, maxDepth)` — mirrors `createSitemapFromAudit()`'s per-row segment-walk (`urlPathSegments` → nested `findOrCreateBucketNode()` calls → `assignRowToNodeDirect` or overflow into `bulkAssignRowsToBucketCore`), but seeded from the chosen destination (`rootParent`) instead of always starting at the true top level. Rows that already carry a `Sitemap_ID` are skipped (reported in the completion toast) — this is about fast initial placement of unplaced pages, not reorganizing existing ones; reorganize afterward with the Sitemap editor's drag-and-drop. No per-row `logChange()`, matching `assignNav()`'s existing single-row assignment (Sitemap fields aren't change-logged there either).

**Create Sitemap from Audit (Project → Create Sitemap from Audit…, `menu-create-sitemap-from-audit` IPC):** auto-generates a starter sitemap tree from the audit's own URL structure — a thin automation layer over the bulk-assign primitives above, not a second placement engine. `openCreateSitemapFromAuditDialog()` shows the eligible-row count (reactive to the include-all checkbox), a **Bucket depth** select (1–4, default 2), and an **Include Kill/Exclude/unreviewed pages too** checkbox (default off — same Keep/Evolve gate as the `_needs-placement` filter); if a sitemap already exists it shows a banner clarifying the tool only merges, never replaces. `createSitemapFromAudit({maxDepth, includeAllRows})` does the work: for each eligible row (unplaced, has a URL, KKE-gated unless `includeAllRows`), walks up to `maxDepth` of `urlPathSegments(url)` as nested buckets via `findOrCreateBucketNode(titleCaseFromSlug(seg), parent)` — find-or-create by label (case-insensitive), so pages sharing a path prefix land under the same section on repeated runs instead of duplicating it. If the row's full path fits within `maxDepth`, it's assigned **directly** to the deepest bucket reached via `assignRowToNodeDirect(row, node)` (no synthetic child) — this is what makes a landing page like `/about` merge into the very node that `/about/team` also nests under, regardless of which row is processed first: `findOrCreateBucketNode` returns the same node either way, and a node can be both a page and a container for its children like anywhere else in this data model. Rows whose path exceeds `maxDepth` fold the remaining depth into one leaf child instead — collected per deepest-bucket-reached into an `overflowByNode` map and run once each through `bulkAssignRowsToBucketCore()` (the refresh-free half of `bulkAssignRowsToBucket`, split out for exactly this — batching many buckets in one pass without a UI refresh per bucket).

**Hub node → content workflow:** hub nodes (children have assigned pages, node itself has none — the `isHub` "NEW" badge) already had visualization/reporting; two additions close the loop from "review" to "content in the pipeline." **Mark content status:** `openNavNodeEditor()` shows an amber "Net New" banner (only when `isHubNode` — same predicate as the tree's `isHub`, computed via `hasDescendantPages(node, _navPageCountsCache())`) pointing at the existing Build section's `Page_Status` field rather than duplicating a second bound control — one source of truth for the status. **Promote to a real page:** the banner's **Create Page** button, and a `.ne-net-new-badge` tooltip hint in the tree, both call `promoteHubNodeToRow(node)` — builds a blank row from `state.headers`, sets the URL to `getRedirectBaseUrl() + '/' + node.computedPath` (guards against an existing row at that URL), `Title 1`/`Title` = the node's label, `KKE_Recommendation = 'Keep'`, tags it `net-new` (added to `state.tagLibrary` if new), pushes to **both** `state.rows` and `state.editedRows` (the same pattern the existing "New Page" sidebar button — `addNewRow()` — already uses; `state.rows` isn't actually immutable, just never *edited* in place), then `assignRowToNodeDirect()`s it to the node. No new "promoted" flag is needed — once the node has a direct page, `isHub`/`hasDescendantPages` naturally stop flagging it as net-new on the next render, in the tree and in every report/export that already computes hub status live (Net New Content Brief, Migration Tracker's Net New column).

**Field filter (arbitrary-column sidebar filter):** `state.fieldFilters = [{field, operator, value}, ...]`. `applyFilter()` AND-applies them to rows after the existing text/KKE/group filters. `openFieldFilterPopup()` builds the field/operator/value picker; operators include `is-blank`, `is-not-blank`, `contains`, `not-contains`, `equals`, `not-equals`, `starts-with`, `ends-with` (`fieldFilterMatches(row, ff)` does the comparison). Active filters render as removable chips via `renderFieldFilterChips()`. Saved filters serialize fieldFilters alongside text/KKE/group.

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

The engine ports the `visual-sitemap-v15` prototype: per-node **horizontal vs vertical** auto-layout driven by two thresholds (**Vertical from depth** `vertDepth`, **or if children ≥** `childThresh`; whichever fires first; `99` = off), with a per-node right-click **context menu** to force horiz/vert or set a node color. Collapse/expand per node (stacked "has sub-pages" shadow), pan/zoom/fit, numbering toggle. **Color** resolves as: per-node override > first matching **color rule** > fallback. Rules (`{condition:{type:'depth'|'depthRange'|'parentId'|'value'|'external'|'field'|'always'}, color}`) are edited in the Settings panel's **Colors** tab (drag-reorder, add/delete, generators "by depth" / "by top-level section" / **"Mark external links"** / **"Color by field"**; each nav node carries `colorValue` = its top-level section label so value-rules tint whole subtrees). The `external` condition type matches `node.external` — stamped `true` for nav nodes with an external `url` set and for menu items of `kind:'link'` — so links pointing off-site can be colored distinctly regardless of section/depth. The **"Mark external links"** button (`renderColorsTab()`/`wireColorsTab()` in `src/sitemap-template.js`) inserts a single `{type:'external'}` rule at the very top of `colorRules` (so it wins over any existing depth/section scheme) rather than replacing the whole rule set like the other two generators; a duplicate-guard skips re-adding if one's already present.

**Generic "color by field" rule (`type:'field'`):** the engine has **zero built-in knowledge** of which node fields are colorable — the host declares them via `DATA.fieldDefs = [{key, label, valueLabels?, valueColors?}]`, and every node carries its raw values on `node.fields` (stamped by `navToSitemap()` in renderer.js: `phase`, `nodeType`, `pageStatus`, `buildPattern`, `buildAssignee`, `writeAssignee`, `migrateAssignee` — see `navSitemapFieldDefs()`). Adding a new colorable dimension is a one-line change in `navSitemapFieldDefs()` + `navToSitemap()`'s `fields` object; nothing in `src/sitemap-template.js` needs to change. `matchesRule` checks `node.fields[c.field] === c.value`; `distinctFieldValues(key)` scans the live tree for every value actually present (including blank, so coverage gaps like "no Page Status set" are visible) to drive both the **Colors tab**'s field-select + "Color by field" button and the **+ Add rule** dialog's "A specific field value" option. `valueLabels` overrides display text for a raw value (e.g. blank `nodeType` → "Page"); `valueColors` lets a field reuse colors already assigned elsewhere in the app instead of cycling the generic palette — `pageStatus` uses this to pull each status's color straight from `state.pageStatusLibrary`, so the sitemap and the rest of the app agree on what "Published" looks like. Menus don't carry any of these fields, so `generateMenuSitemap()` simply omits `fieldDefs` and the engine hides the field-select UI entirely whenever the host declares none.

Settings panel also has **Layout** (card/gap px) and **Legend** (editable labels) tabs, plus **Save as my defaults** / **Reset to defaults**.

`generateNavSitemap()` builds **one synthetic site root** (label = siteDomain/client) whose children are the nav top-levels; each nav node → `{id,label,sub:"N pages",colorValue:topSection,menu:!phase(→dashed),collapsible,stacked,children}`; `collapse:'Y'` nodes seed `initialCollapsed`. The synthetic root is suppressible: `projectSettings.sitemapShowSiteRoot === false` (Project Settings → Identity, "Show a site root box in the Visual Sitemap"; only persisted when off) instead makes the sitemap's own top-level node(s) the root(s) — the engine lays out N stacked roots, so this works for one or many top-levels. `generateMenuSitemap()` builds **one root per menu** (`rootHeadings:true` stacks them with headings; neutral `isMenuRoot`; items colored by kind Page/Link/Header, `header` dashed). Both call the shared **`openSitemapView({context,title,roots,defaultColorRules,palette,rootColor,…})`**.

**Settings tiers:** app defaults live in `prefs.sitemapDefaults` (returned by `get-prefs`); per-project, per-context overrides live in `projectSettings.sitemapSettings.{nav,menus}` (layout consts, `colorRules`, `legendLabels`, `nodeOverrides`, and — **menus only** — a `collapsed` view-state) — persisted free via the existing `projectSettings` → KKE_Settings/.transmission JSON plumbing. `sitemapEffectiveSettings(context, defaultColorRules)` = appDefaults < project overrides; `openSitemapView` persists each reported state into `projectSettings.sitemapSettings[context]` and `setDirty(true)`. Both sitemaps prefer `projectSettings.brandPalette` when set.

**Collapse is two-way bound to `node.collapse` (nav only).** `node.collapse` (the Sitemap's **Collapse** checkbox / Sitemap column) is the *single source of truth* for which nav nodes start collapsed in the sitemap — `generateNavSitemap` seeds `initialCollapsed` from it on every open, and `openSitemapView` is called with `collapseToNavNodes:true`, which (a) ignores any saved `sitemapSettings.nav.collapsed` so a stale view-state can't shadow a checkbox change, and (b) on each reported state writes the view's collapse set back onto the nav nodes via **`applySitemapCollapseToNav(ids)`** (sets `node.collapse` `'Y'`/`''` for nodes with children, `state.navTreeDirty=true`, re-renders the open nav editor). Menus keep their own persisted `collapsed` view-state (menu items have no collapse flag).

**Drag-and-drop (shared engine):** the nav tree and the menu item tree share ONE drag/drop engine (defined near the Menus section in renderer.js): `makeTreeDragHandle(grip, row, mime, id, {dragImage})` wires the grip's dragstart/dragend; `attachTreeRowDropTarget(row, {mime, onReorder(draggedId, zone), foreign?})` wires dragover/dragleave/drop; `_treeDragOver = {el, zone}` tracks the active target and `clearTreeDropIndicators()` clears it; `_setTreeDropZone` paints the indicator. Tree mutation stays per-view in the `onReorder` callback (`moveNavNode` / `moveMenuItem`). 30% top/bottom zones → before/after, middle → into; the `dragleave` guard (`row.contains(e.relatedTarget)`) prevents flicker. Indicators are the shared `.tree-drop-before/after/into` (inset-shadow edges + into-tint) + `.tree-row-dragging` (opacity 0.35). The `foreign` hook is available for a row to accept other drag types but is currently unused (the old sidebar-row→node drag-assign was removed — the Sitemap hides the sidebar, so it was unreachable; assign via the audit bar **Sitemap** button/picker).

**`_findNavNodeLocation(target, nodes)`** — helper that walks the nav tree by object reference (not by `parentNumber`) to locate a node's parent array and index. Used by `deleteNavNodeFromEditor` to fix a bug where "also delete this node" wasn't working after tree reorganizations that left stale `parentNumber` values.

**Treemap (engine in `src/treemap-template.js`):** the content inventory as a squarified treemap (Bruls/Huizing/van Wijk), boxes sized by page count and colored by KKE composition, top-level section, or a tracked build field — reached via the Sitemap toolbar's **Treemap** button (`#btn-nav-treemap`), next to Visual Sitemap. `window.TreemapTemplate.build(data)` follows the exact same standalone-HTML / `app`-`client`-`print` three-mode contract as `SitemapTemplate.build()` (same CSP/webview rationale — see that engine's header comment), but is a deliberately smaller, separate module: **no in-webview Settings panel, no collapse, no per-node overrides.** Depth and coloring are chosen once, host-side, in a small pre-render dialog (`openTreemapConfigDialog()`) before the view opens; changing either means reopening that dialog and regenerating — there's no live round-trip like the box-tree engine's `pushState()`/`persist()`.

- **Rollup, not a separate URL-folder treemap:** built from the *existing* sitemap tree (`state.navTree`), not from re-parsed URL paths. `buildTreemapNode(node, topLabel, depthLimit, currentDepth, ctx)` recurses normally below the chosen depth; at the limit it stops and reports the node's *subtree* totals instead of its children, so a depth-2 box's size/color reflects everything rolled up beneath it, not just its direct count.
- **Sizing (`computeSubtreePageCounts()`):** counts *every* audit row assigned to a node's subtree via `Sitemap_ID`, regardless of KKE outcome — deliberately not `_navPageCountsCache()` (which excludes Kill/Consolidate for the Sitemap editor's "how many pages will still be live" badge). A section that's entirely being killed should still show up sized by how much content is there, not shrink to nothing. This also keeps the KKE-breakdown subtitle's percentage from exceeding 100% — box size and breakdown total are the same row count.
- **KKE composition (`computeSubtreeKkeBreakdown()`):** bottom-up tally of every row's effective KKE (`Final_KKE` else `KKE_Recommendation`) per subtree; `dominantKke()` picks the most frequent value for a box's fill color (`treemapKkeColor()`, resolved via `getComputedStyle` since the webview has no access to the host's `:root` custom properties — includes Consolidate, which the older `kkeColor()`/`resolvedKkeColor()` helpers omit) and its subtitle (e.g. "62% Keep").
- **Color-by-field constraint:** the full field registry (`navSitemapFieldDefs()` — Phase, Node Type, Page Status, Build Pattern, and the three assignee roles, the same registry the Visual Sitemap's generic field-coloring uses) is only offered when depth is **Unlimited** — a rolled-up box has no single field value to report, so limited depths only offer **Top-level section** and **KKE composition**, both of which have well-defined "dominant value across a subtree" semantics. `openTreemapConfigDialog()` enforces this by re-populating the color-by `<select>` on the depth `<select>`'s `change` event.
- **Export reuse:** `sitemapExportClient`/`sitemapExportPdf` gained an optional 4th `templateModule` param (default `window.SitemapTemplate`) so the treemap path can pass `window.TreemapTemplate` through the exact same HTML/PDF export IPC plumbing without forking it. Existing box-tree call sites are unchanged (still 3 args).
- **Only leaves carry a semantic fill color** — a container (has visible children) box renders as neutral structural chrome (border + label strip) in the engine; only leaf/rolled-up boxes get the resolved KKE/section/field color, so "what does a two-tone nested box mean" is never ambiguous.

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
- **Release step (manual — do this on every release)**: bump the version in `package.json` and add a `CHANGELOG.md` entry as usual; build + sign + notarize + staple the dmg/zip and create the tagged Release on `factus10/transmission` as normal. Then **also**: `gh release create vX.Y.Z <dmg> <zip> --repo factus10/transmission-updates --title "..." --notes-file ...` to mirror the same two assets there (`gh release upload --clobber` if a partial/draft release is left behind — large-asset uploads to this repo have intermittently 404'd or silently dropped assets mid-upload; always verify via `gh release view vX.Y.Z --repo factus10/transmission-updates --json assets` before moving on). Finally, in a checkout of `transmission-updates`: bump `version` / `publishedAt` / `notes` in `update-manifest.json`, regenerate `changelog.html` from this repo's `CHANGELOG.md` (rendered with `marked`, the same lib already a dependency here — see the generator used when this feature was built, not checked in), and push. Nothing here automates this sync yet.
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
| `docs/USER_GUIDE.md` | Full user manual — assumes an intelligent reader new to KKE audits and the app |
| `docs/PITCH.md` | Client-facing pitch (written + conversational versions) — describes Jakala's process and competitive advantages |
| `src/help.html` | Help window — concise feature documentation opened as a separate window |

For UI/interaction changes, also keep **`docs/UI_STANDARDS.md`** current (the interaction contract) and **`docs/dev/REVIEW_FINDINGS.md`** (the audit backlog) up to date. If a change alters the design tokens (`:root` in `styles.css`), the button specs, or the dialog/toast conventions, also update **`docs/SHARED_STYLE_GUIDE.md`** — the portable style contract handed to the sibling **Tauri** app to keep both apps visually consistent (it mirrors §1 tokens + §2 button CSS verbatim).

---

## Bug fixes (logged here for reference)

- **Phased nodes and NEW badge:** `isHub` and `isOrphanLeaf` logic both gate on `!isPhased` before applying the `.ne-net-new-badge`, so nodes with a non-empty `node.phase` never show the NEW badge.
- **`deleteNavNodeFromEditor` object-reference lookup:** now uses `_findNavNodeLocation()` by object reference rather than `parentNumber` to find the target in the tree, fixing "also delete this node" failing silently after nav reorganizations that left stale `parentNumber` values.
- **`clearNavAssignment()` live tree refresh:** now calls `invalidateNavPageCountsCache()` and, if `_navEditorOpen` is true, `renderNavEditor()` so the nav tree immediately reflects the cleared page assignment without requiring a manual re-open.

---

## Known limitations / future work

- Single sheet only — reads `workbook.SheetNames[0]`
- Virtual scrolling in sidebar — tested to ~4,000+ rows (ROW_HEIGHT=34px, OVERSCAN=10)
- Undo/redo: Cmd+Z / Cmd+Shift+Z for KKE changes and sitemap node deletions (single or bulk), 100-action stack per session
- Tag library is global (shared across all files); visibleFields is also global
- `new-window` events from webview open in system browser — intentional
- Webview cannot load `localhost` URLs in production without CSP adjustment
