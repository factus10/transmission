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
├─ view switcher  [Audit] [Table] [Nav Tree] [Redirects] ──────┤
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

Note: **Table View** (Cmd+T), **Navigation Tree** (Cmd+Shift+T), and **Redirect Editor** (Cmd+Shift+R) all hide the sidebar and go full-width. The `.tv-active` class on `#app` controls this layout switch and is used by all three views.

**View switcher** (`#view-switcher`) sits between the OS titlebar and the app shell. Always visible. Five tabs: Audit · Table · Navigation Tree · Redirects · Menus. `setupViewSwitcher()` wires the clicks; `refreshViewSwitcher()` keeps the active state in sync with the underlying `_tableViewOpen` / `_navEditorOpen` / `_redirectEditorOpen` / `_menusViewOpen` flags and is called from each view's open/close functions.

**Menu organization (post-reorg):**
- **App menu (macOS) / File (Win/Linux)** — Preferences (Cmd+,)
- **File** — Open · Open Recent · Save · Save As Project… (Cmd+Shift+S) · Import/Merge · Merge Auditor · Save/Load Template · Export… (unified dialog `openUnifiedExportDialog()`) · Export Full Workbook (.xlsx)… · Package for Handoff…
- **Edit** — standard
- **View** — Audit (Cmd+1) · Table (Cmd+T) · Nav Tree (Cmd+Shift+T) · Redirects (Cmd+Shift+R) · Menus (Cmd+Shift+M) · Audit Progress (Cmd+P) · zoom · fullscreen · (dev items in source builds)
- **Project** — Project Settings · Glossary · Content Type Registry · Target Spec Library · Component Library · Run Rubric · Refresh GA KKE · Recompute Suggested KKE · Triage Non-200 Pages
- **Migration** — Migration Tracker · Migration Checklist · Net New Brief · Redirect Map Report · Redirect Chain Check · Nav Coverage · Export Redirect Map (CSV)
- **Reports** — Executive Summary · Content Inventory · SME Review Status (narrative reports only)
- **SME** — Export / Import / Resolve
- **Help** — standard

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
- **File → Export Full Workbook (.xlsx)…** (`menu-export-workbook` → `exportFullWorkbook()` → `export-workbook` IPC) writes a complete xlsx (data + all structural sheets) to a chosen path. For projects it exports the **full** changelog from the DB with `opts.replaceChangeLog` so re-exports don't duplicate entries. The from-scratch NavStructure branch in `writeWorkbook` now writes the full column set (Notes/Phase/Node_Type/build metadata), since projects always export from scratch (`navSheetInfo = null`).
- **Safety:** `before-quit` checkpoints + closes the DB (no stale `-wal`/`-shm` sidecars); a rolling backup per project is written to `userData/backups/` on open via SQLite's online backup API. Opening a project created by a newer schema version fails with a clear "update the app" error.
- `buildSavePayload({ fullNav, drainLog })` in renderer.js builds the save/export payload; `fullNav` forces the complete nav tree (Save As Project, exports), `drainLog:false` leaves `_sessionChangeLog` intact (exports). Failed saves restore drained changelog entries.
- **Export profiles:** `openProfileExportDialog()` (unified Export dialog → "Client Export") exports a chosen column subset over filtered/all rows via the generic `export-migration-tracker` IPC (which accepts an optional `title`). Built-ins (`builtinExportProfiles()`: Client Summary, Full) are computed from current headers; user profiles persist in `projectSettings.exportProfiles` = `[{name, columns}]` (travels with the project).
- **Package for Handoff:** File → Package for Handoff… (`menu-package-handoff` → renderer `packageForHandoff()` saves if dirty → `package-handoff` IPC). Main checkpoints the WAL (`ProjectStore.checkpoint()`), zips the `.transmission` + a README.txt via JSZip, writes to a chosen path, and reveals in Finder.

---

## Process model

**Main process** (`main.js`) owns:
- All file system access (SheetJS read/write, ExcelJS for SME export, JSZip for xlsx post-processing)
- D3 rendering in hidden BrowserWindow (visual sitemap) — D3.min.js loaded via string concatenation (not template literals, since D3 source contains backticks)
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
| renderer → main | `get-current-path` | → string \| null                             |
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
| main → renderer | `menu-export-filtered` | none — export filtered rows |
| main → renderer | `menu-export-audit` | none — export audit decisions |
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
| renderer → main | `render-sitemap-d3` | `{ treeData, colorMap, options }` → `{ success, svg }` — renders D3 box-style tree in hidden BrowserWindow (D3.min.js loaded via string concatenation, not template literals). `colorMap` maps `buildPattern` → hex color; `options.menuOnly` drives stacked-shadow indicator. |
| main → renderer | `menu-non200-triage` | none — opens non-200 triage dialog |

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
  _sessionChangeLog: [],     // audit trail entries [{timestamp, row, url, field, oldVal, newVal}]
  _globalSearchMatches: [],  // Cmd+F matches — [{origIndex, row}] in audit view; [{nodeId}] when the Nav Tree is open
  _globalSearchCurrent: -1   // index into _globalSearchMatches for current match
}
```

Column mapping entries in `state.columnMap` include: `smeDecision`, `smeNotes`, `contentOwner`, `finalKke` (in addition to existing mappings).

**Column mapping persistence:** `computeColumnMap(headers, filePath, projectMap)` resolves per key: `projectSettings.columnMap` (file-level — travels with the project/workbook between auditors) > `prefs.columnMappings[basename]` (per-user, legacy) > auto-detect; saved names are honored only if still present in headers. Applying a mapping in App Settings writes BOTH tiers and saves the file before reloading (so the reload can't discard unsaved edits).

`state.projectSettings.glossary` = `{ tags: { name: markdownNotes }, groups: { name: markdownNotes } }` — persisted in the `KKE_Glossary` sheet.

`state.projectSettings.contentThemeLibrary` = array of theme strings — persisted in the `KKE_Settings` sheet as JSON.

`state.projectSettings.savedFilters` = array of `{name, filterText, kkeFilter, groupFilter, fieldFilters}` — persisted in `KKE_Settings`. Field filters travel with saved filter combos.

`state.projectSettings.gaKkeConfig` = `{ columnMap: {sessions, engagementRate, avgSessionDuration, viewsPerSession}, weights: {...}, thresholds: {keep, evolve}, missingPolicy: 'skip'|'zero', computedAt: ISO, lastRun: {computed, skipped, total} }` — or `{ dismissed: true }` if the user declined setup. Serialized into `KKE_Settings` sheet as JSON under `gaKkeConfig`.

**Nav node objects** (`state.navNodes`) include extension fields: `refNodeId` (alias to another node), `inMenu` ('Y' / '' — **legacy**: round-tripped but no longer edited in the UI; its controls were repurposed to `collapse`), `collapse` ('Y' / '' — collapse this node's subtree in the Visual Sitemap), `url` (external URL), `urlOverride` (URL-path override — see below), `breadcrumbParentId` (breadcrumb re-root — see below), `notes` (markdown), `phase` ('Future' / 'Stretch' / 'Archived' / custom / ''). Each is read from / written to a column on the NavStructure sheet (added on save if missing).

**URL override (decouples URL from hierarchy):** `node.urlOverride` (NavStructure `Url_Path` column) lets a page's URL diverge from where it sits in the menu. The IA — tree position, breadcrumb (labels), sortID, page counts — is unaffected; only `computedPath` (the URL) changes. `recalcDerivedFields()` builds `computedPath` via `computeNodeUrlPath(node)`: a node's own (normalized) override IS its path verbatim; otherwise it climbs ancestors collecting slugs **until the nearest ancestor override**, which becomes the new root and **re-roots the whole subtree** below it (descendants append their slugs to the override base). With no overrides in the chain this is identical to the old ancestor-slug join. Because every downstream URL consumer (redirects, `effectiveConsolidateUrl`, Migration Tracker target, URL-change detection, `cascadeNavChangesToRows`) reads `computedPath`, no consumer needed changes — only the derivation did. `normalizeUrlOverride(s)` strips leading/trailing slashes so overrides match the stored no-leading-slash convention. Edited in the modal node editor (`#_nne-urlpath`, routed through `onNavNodeEdit('urlOverride', …)` so the subtree recalcs and assigned-page URLs cascade); the tree path cell prefixes an overridden path with `↪` in accent color; the nav stats bar tallies `N URL overrides`. Round-trips in both xlsx (`Url_Path` column) and `.transmission` (flat-node JSON via `NAV_HEADER_TO_KEY`).

**Breadcrumb override (decouples the on-page breadcrumb from hierarchy):** `node.breadcrumbParentId` (NavStructure `Breadcrumb_Parent` column) sets an **arbitrary breadcrumb top**, independent of both physical containment AND the URL. `node.breadcrumb` stays the full physical label chain (IA context / row `Nav Destination`); the *page* breadcrumb is computed live by `computePageBreadcrumbLabels(node)` / `pageBreadcrumbOf(node)`, which walk the breadcrumb-parent chain: `''` = inherit the physical parent (default), `'__root__'` (`BREADCRUMB_ROOT`) = the trail starts here, `<nodeId>` = re-root onto that node (continuing up *its* chain). The walk is cycle-safe (visited Set) and falls back to the physical parent if a `breadcrumbParentId` dangles. Descendants inherit the re-root automatically (they hit the override while climbing), so you only set it at the re-root point. Two **optional per-project cosmetics** in `projectSettings` (Project Settings → Identity): `breadcrumbHomeLabel` (prepended to every trail unless already the first crumb) and `breadcrumbMaxDepth` (advisory — `breadcrumbExceedsCap()` flags longer trails; never enforced). This is **display-only** — it does NOT affect `computedPath`, rows, or menus — so the editor select (`#_nne-bcparent`: inherit / root / pick-a-node via the reused `showMenuNodePicker`) commits the value directly in `commitEdits` (no cascade). Tree breadcrumb cell marks overrides with `↰` (accent) and over-cap with `⚠` (red); stats bar tallies `N breadcrumb overrides` / `⚠ N over depth`. `hasBreadcrumbOverride()` is the predicate. Round-trips in xlsx (`Breadcrumb_Parent` column) and `.transmission`.

**Phase 2, Chunk α — nav node build/write metadata:** nav nodes carry build + write annotations for the migration delivery deliverable. Six new fields, read/written via NavStructure columns (auto-added on save):
- `buildPattern` — selected pattern name (free-text for α; library lands in β)
- `buildGuidance` — markdown notes for the page builder
- `writerBrief` — markdown notes for the content writer
- `pageStatus` — controlled vocab from `state.pageStatusLibrary` (per-project, seeded with `DEFAULT_PAGE_STATUSES`)
- `buildAssignee` — controlled vocab from `state.assigneeLibrary` (per-project, starts empty)
- `writeAssignee` — same library as `buildAssignee` (unified pool)
- `migrateAssignee` — same library; the **Migrator** role (NavStructure `Migrate_Assignee` column). Owns mapping source content into the new CMS; the mapping reference itself lives on the target spec, not per node. Surfaced in the Migrate section of the node editor, the build filter, assignee usage/cascade, the Migration Tracker Nav Plan column, and the Migration Direction Brief report.

**Libraries persisted in `projectSettings`:**
- `pageStatusLibrary` = `[{ name, color }]` — seeded on first open with 6 defaults (Not Started, In Progress, Built, In Review, Published, Blocked); user can add inline via `+ New…` (auto-colored from `PAGE_STATUS_AUTO_COLORS` cycle).
- `assigneeLibrary` = `string[]` — alphabetically sorted; inline `+ New…` adds + persists. Unified pool for all three roles (builder / writer / migrator). `computeAssigneeUsage()` returns `{build, write, migrate}` per name; rename/delete cascade across all three node fields.

**`openNavNodeEditor()`** is structured as a stack of labeled, color-pilled blocks (the `.nne-section` / `.nne-section-header` / `.nne-section-pill` pattern) so the long form is scannable rather than a flat field list: a tinted read-only **Context** panel (`.nne-context-panel` — Parent / Breadcrumb / Computed Path / Page breadcrumb), then **Identity** (slate pill — Label, Slug, In menu, Node type `#_nne-node-type` Page/Header/Fragment with live `#_nne-node-type-hint`, Phase), **Addressing & breadcrumb** (teal pill — External URL, URL override, Breadcrumb parent, Reference), **Notes** (gray pill — "Migration notes"), then **Build** (blue — pattern + status + builder + guidance), **Write** (violet — writer + brief), and **Migrate** (amber — migrator assignee `#_nne-massignee`; the mapping reference itself lives on the target spec, not the node). Section pills use inline hex backgrounds (matching the existing Build/Write/Migrate pills). Inline-add behavior implemented via the reusable `buildInlineAddSelect({ wrapEl, selectId, options, currentValue, placeholder, newPromptTitle, onNewValue, decorator })` helper. The `decorator` callback (used for Page_Status) renders a color swatch next to the select.

Pattern picker (Chunk β): `Build_Pattern` is now an inline-add select over `state.patternLibrary`. On selection, `applyPatternToNode(pattern, dialog)` fills any blank `Build_Guidance` / `Writer_Brief` fields from the pattern's defaults. For any field that already has content, `showApplyPatternDialog(pattern, conflicts)` opens a two-column diff modal letting the user choose Keep / Append / Replace per field (decision D from planning — never silently clobbers).

**Phase 2, Chunk ε — Migration Tracker Export:** File → Export Migration Tracker… opens `openMigrationTrackerExportDialog()` with sheet/option toggles. `runMigrationTrackerExport(opts)` assembles four sheets via `buildNavPlanSheet`, `buildSourcePagesSheet`, `buildRedirectsSheet`, `buildArchiveSheet`, then ships them to main via `exportMigrationTracker` IPC which writes the xlsx with SheetJS.
- **Nav Plan** — one row per nav node (filterable by phase / refs): Sort, Number, Breadcrumb, Label, URL, Page Status, Build Pattern, Builder, Writer, Migrator, Build Guidance, Writer Brief, Migration Notes, Source Page Count, **Source Page URL(s)** (the assigned live page URLs, ` | `-joined; same Kill/Consolidate exclusion as the count), **Consolidated-In URL(s)** (URLs of pages whose `Consolidate_Into` targets one of the node's assigned pages — matched on each assigned page's current URL **and** `effectiveConsolidateUrl`, deduped, ` | `-joined), Net New, Phase, In Menu, External URL, Readiness Warnings.
- **Source Pages** — audit rows joined to their nav node (KKE, Final KKE, Suggested KKE, Page Type, Group, Primary Tag, target breadcrumb / path / pattern / status). Kill/Exclude inclusion toggled by user.
- **Redirects** — Kill rows + non-Kill URL changes. `404` sentinel surfaces as "(404)" with disposition "404 — intentional deindex".
- **Archive** — Kill rows with notes + tags, for client reference.

Default file name: `{project-slug}-migration-tracker-YYYY-MM-DD.xlsx`. Header row is frozen on each sheet; column widths are pre-tuned.

**Nav-node export column control + Build-filter scope (shared engine):** the Nav Plan columns are defined once in `navExportColumnDefs()` (`{key,label,wch,get(node,ctx)}`; `navExportDefaultColumnKeys()` = all keys in order). `navExportContext()` supplies page counts / URL builder / net-new test to the getters; `buildNavNodesSheet(nodes, colKeys, sheetName)` renders the `{name,aoa,cols}` sheet for any node list + chosen column keys (empty/omitted keys → all columns). `getNavNodesForExport({includePhased,includeRefs,respectBuildFilter,buildFilter,phaseFilter})` returns the export node set in `sortNodesForNavigation` order; `respectBuildFilter` keeps only nodes that **directly** match `buildFilter` via `matchesNavBuildFilter` (same predicate as the on-screen Build-filter match count). `buildNavPlanSheet(planOpts)` now delegates to these (accepts `respectBuildFilter`, `buildFilter`, `columns`).
- The **Migration Tracker dialog** adds an *Only nodes matching the active Build filter* toggle (reads `#nav-build-filter`; disabled + labelled "no Build filter set" when none active, else shows the filter label + match count) and a **Nav Plan columns** checkbox grid (`navExportColumnsHtml('_mte', …)` / `readNavExportColumns(modal,'_mte')`, with All/None buttons).
- The **Nav Tree toolbar** Export ▾ menu gains *Filtered nodes → Excel (choose columns)…* → `openNavNodesExportDialog()`: a Rows scope (current Build+Phase filters vs all, pre-selecting "filtered" when a filter is active) + the same column grid (`_nne` prefix), then `runNavNodesExport(nodes, colKeys)` ships a single-sheet xlsx (`{slug}-nav-nodes-YYYY-MM-DD.xlsx`) via the `exportMigrationTracker` IPC. Reuses `navExportColumnsHtml` / `readNavExportColumns`.

**Migration Direction Brief — source pages + consolidation flag:** `gatherAssigneeBriefData(role, person)` (Reports → Migration Direction Brief…) now attaches per nav-node `sourcePages` = the live source rows assigned to it (`NavID == node.id`, excluding Kill/Consolidate) as `{url, title, mergeCount}`, plus a node-level `mergeTotal`. `mergeCount` is the number of distinct pages being **consolidated into** that source page — computed from a `Consolidate_Into → rows` map (`rowIsConsolidate`), matched against the page's current URL **and** `effectiveConsolidateUrl(row)` (since `Consolidate_Into` may hold either). `summary.consolidatedIn` totals merges across the person's pages. The built-in HTML (`assigneeBriefBuiltinHtml`) lists each node's source page(s) under its row, each with a **merges N** pill when `mergeCount > 0` (no expansion of which pages — "list pages, flag consolidations"); the node count cell shows `(+N)`. The template context (`assigneeBriefContext`) exposes `sourcePages` + `mergeTotal` per page and `summary.consolidatedIn`.

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
| `Consolidate_Into`   | URL          | Set via Consolidate picker; target page in the inventory |
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

**Schema additions:** `Content_Nature`, `Migration_Track`, `Target_Content_Type`, `Suggested_KKE`, `Suggested_KKE_Sources`, `Source_CMS_URL`, `New_CMS_URL` are appended to `AUDIT_COLUMNS` and to the `auditCols` injection list in `main.js`. Columns appear in every file on open.

**Phase 1, Chunk D — Suggested_KKE unified badge + sidebar filters + settings:** thin orchestrator over the existing GA + Rubric pipelines.
- **Sidebar filters** (`renderKkeFilterOptions()`): two special filters — `_suggested-disagree` (sources internally disagreed; reads `Suggested_KKE_Sources.disagreement`) and `_suggested-mismatch` (Suggested_KKE differs from the user's KKE call). Both registered in the `specialFilters` Set in `applyFilter()`.
- **Settings dialog** (`openSuggestedKkeSettings()`): File → Suggested KKE Settings… opens a modal for tuning per-source weights (currently GA + Rubric, 0–5 each). "Save & Recompute" triggers immediate re-run. Persists to `state.projectSettings.suggestedKkeConfig.weights`.
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

**NavStructure `Node_Type`:** active, three values — `''` (Page), `'Header'` (structural grouping), `'Fragment'` (shared/embedded content). Set via the node editor's Node type select. **Fragment** nodes keep their computed path as a repository location but have no menu/breadcrumb/redirect; they render as their own layer (`.ne-fragment-badge` `FRAG` + `.ne-row-fragment`), are excluded from hub/empty/net-new counts (tree render + stats buckets), get a stats tally, and (being not-in-menu) are absent from the in-menu IA. `Nav_Layer` remains reserved (recognized in `parseNavSheet()`, preserved on rewrite, no UI). Existing files round-trip cleanly.

**Nature-aware downstream (`isFragmentRow(row)` = `Content_Nature === 'Content Object'`):** rows that render as a Fragment have no public URL, so they're skipped in `resolveRedirectDestinations()`, the Redirect Editor list (`renderRedirectEditor`), the tracker `buildRedirectsSheet()`, the need-placement count + `_needs-placement` filter, and Nav Coverage (`showNavCoverageReport()` also skips Header/Fragment nodes). `isFragmentRow` is a hoisted function declaration so earlier call sites resolve.

**Content type crosswalk:** `Page_Type` (UI label **Content Type**) is the key into `state.projectSettings.contentTypeRegistry` (entries: `{contentType, defaultContentNature, targetContentType, targetSpec, defaultMigrationTrack, notes}`). `applyContentTypeRegistryDefaults()` fills blank `Content_Nature` (UI **Renders as**), `Migration_Track`, and `Target_Content_Type`; `updateTargetContentTypeHint(row)` drives the `#target-ct-hint` `→ Target` readout in the audit bar. `Content_Nature` UI label is **Renders as** (Page / "Fragment (embeddable)" = stored `Content Object` / Generated). Crosswalk report: `reportContentTypeCrosswalk()` (`menu-report-content-crosswalk`).

**Redirect_Destination = "404" sentinel:** literal string `"404"` means "let this URL return 404 — do not write a redirect rule." Distinct from blank (TBD). Recognized by:
- `resolveRedirectDestinations()` — propagates 404 through consolidate chains; preserves explicit 404 values
- Redirect Editor — `redirect-dest-404` CSS class on the input + a `re-404-btn` toggle button next to nav picker
- Redirect Map Report — three sections: Kill redirects, URL-changed redirects, Intentional 404s
- Migration Checklist — excludes 404 rows from the redirect manifest table

**Kill cleanup flow:** switching to Kill on a row with existing nav assignment (`NavID` populated) or redirect destination (`Redirect_Destination` populated) triggers `promptKillCleanup(origIndex)` — a modal asking whether to clear either/both. Helpers `clearNavAssignment(row, origIndex)` and `clearRedirectDestination(row, origIndex)` log each cleared field to the change log. `clearNavAssignment` also calls `updateNavBadge(row)` when the affected row is the currently-selected one, so the audit-bar Nav button refreshes immediately. Applies to: single-row KKE button, Final KKE select, `bulkAssignKke()` (aggregate modal via `promptBulkKillCleanup`), and Table View `tvStartInlineEdit` for KKE-type columns.

**Consolidate flow:** `Consolidate` is a 5th built-in KKE state. Clicking the button or selecting it via keyboard opens `openConsolidatePicker(origIndex)` — a virtual-scrolled list of every page in the inventory with filter input and sortable headers. `applyConsolidateTarget(origIndex, targetUrl)` sets `Consolidate_Into` and KKE=Consolidate (only if no Consolidate intent already exists — preserves SME-imposed Final_KKE). `clearConsolidateTarget(origIndex)` is the inverse. The redirect resolver in `resolveRedirectDestinations()` and the redirect editor's group-builder both chase the consolidate target through the target's `Computed Path`, chained Consolidates, and explicit redirects (cycle-safe via a visited Set seeded with the source URL).

**Consolidation Candidates workflow:** `openConsolidationCandidates()` is a Nav Editor toolbar action (`btn-nav-consolidate-candidates`) that opens a modal listing every nav node with 2+ assigned pages. `buildConsolidationCandidates()` groups rows by `NavID`, returns groups sorted by size desc. Each group renders with radio buttons; `applyConsolidationGroup(group, targetOrigIndex)` sets the target to Evolve (preserving Keep/Evolve), the rest to Consolidate with `Consolidate_Into = targetUrl` and clears their nav + explicit redirect. Skipped groups are session-only (a `Set` inside the modal closure).

**Duplicate NavID detection:** `detectDuplicateNavIds()` returns `[{ id, nodes[] }]` for IDs assigned to 2+ nodes. `fixDuplicateNavIds()` keeps the first node's ID and renumbers the rest using next-available padded numbers. `renderNavEditor()` shows a red ⚠ link in the toolbar stats when duplicates exist.

**Multi-bar (unified action bar):** `setupMultiBar()` wires the single bottom-of-sidebar action bar that replaces the old `batch-bar` (filtered) and `bulk-bar` (selected). `getMultiBarTargets()` returns the target rows: multi-selected wins; otherwise filtered rows when filters are narrowing the list; otherwise empty. `applyMultiAction(row, origIndex, action, value)` handles each action (`kke`, `published`, `page-type`, `content-theme`, `group`, `primary-tag`, `add-tag`). `updateMultiBar()` shows/hides the bar and updates the label between "Apply to N selected:" and "Apply to N filtered:". The legacy `updateBulkBar` / `updateBatchBar` names are kept as shims so existing call sites keep working.

**Field filter (arbitrary-column sidebar filter):** `state.fieldFilters = [{field, operator, value}, ...]`. `applyFilter()` AND-applies them to rows after the existing text/KKE/group filters. `openFieldFilterPopup()` builds the field/operator/value picker; operators include `is-blank`, `is-not-blank`, `contains`, `not-contains`, `equals`, `not-equals`, `starts-with`, `ends-with` (`fieldFilterMatches(row, ff)` does the comparison). Active filters render as removable chips via `renderFieldFilterChips()`. Saved filters serialize fieldFilters alongside text/KKE/group.

**Non-200 Status Code Triage** (`Project → Triage Non-200 Pages…`, `menu-non200-triage` IPC): `openNon200TriageDialog()` groups `state.editedRows` by HTTP status code using `statusCodeCategory()` (returns `'3xx'`, `'4xx'`, `'5xx'`, or `null`) and `STATUS_CODE_LABELS` (maps common codes to human-readable labels). Renders a table: one row per code group with code + label, row count, and a KKE action dropdown pre-populated by `defaultTriageAction(code)` (sensible defaults: 3xx → Kill, 404 → Kill, 5xx → Exclude, etc.). "Apply" batch-sets KKE for all rows in each group that have a non-blank action selected. `maybeOfferNon200Triage()` is called at the end of `loadData()` and auto-offers the dialog when non-200 rows are present. Sidebar rows render a `.row-sc-badge` span with class `.row-sc-3xx` (amber) or `.row-sc-4xx` / `.row-sc-5xx` (red) when the row has a non-200 status code. Wired in `main.js` Project menu; `preload.js` exposes `onMenuNon200Triage: (cb) => ipcRenderer.on('menu-non200-triage', () => cb())`.

**Modal node editor:** `openNavNodeEditor(node)` opens a full property editor (Label, Slug, In Menu, External URL, **Phase**, **Notes**) with read-only context (Number, ID, parent, breadcrumb, computed path, page count). Save calls `onNavNodeEdit` for label/slug (so paths cascade through `recalcDerivedFields`), then directly assigns `inMenu` / `url` / `notes` / `phase` and triggers `state.navTreeDirty + setDirty(true)`. Live preview updates breadcrumb/computedPath as user types. Delete uses `executeDeleteNavNode` with reassignment options.

**Phase property on nav nodes:** `node.phase` is a string (empty = current build, otherwise `'Future'`, `'Stretch'`, `'Archived'`, or any custom value). Stored in NavStructure's `Phase` column (added on first save if missing). The render path adds `ne-row-phase` class + `data-phase` attribute for styling, and prepends a `ne-phase-badge` pill in the count cell. Phase filter `#nav-phase-filter` ('__current__' = empty phase only, '__nonblank__' = phased only) hides nodes via `return document.createDocumentFragment()` from `renderNavEditorNode`. On export, `showPhaseExportPrompt(phasedCount)` asks whether to include phased nodes; the user's choice is passed to main as `includePhase`.

**Node notes:** `node.notes` is markdown stored in NavStructure's `Notes` column. Surfaced as a hover `title` on the label input, and `ne-cell-has-notes` class drops a small `·` indicator. Edited only via the modal node editor.

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
`logChange(origIndex, field, oldVal, newVal)` pushes an entry to `state._sessionChangeLog`. Called automatically when KKE_Recommendation, SME_Decision, or Final_KKE changes. On save, entries are appended to the `KKE_ChangeLog` sheet and `_sessionChangeLog` is cleared.

---

## Full-panel views

Three full-panel views replace `#content-area` in `#main-panel`. All three hide the sidebar and go full-width using the `.tv-active` class on `#app`. All views are accessible via the View menu: Audit View (Cmd+1), Table View (Cmd+T), Navigation Tree (Cmd+Shift+T), Redirect Editor (Cmd+Shift+R).

### Navigation editor (`#nav-editor`)
**Cmd+F in the Nav Tree** searches nav nodes instead of audit rows: when `_navEditorOpen`, `globalSearchUpdate()` calls `navSearchMatches(query)` (matches label / breadcrumb / number / computedPath / path / url / notes / buildPattern / pageStatus / assignees, in `sortNodesForNavigation` order; only nodes currently present in `#nav-editor-body` so active Phase/Build/Depth filters are honored) and stores `[{nodeId}]`. `globalSearchNavigate(±1)` routes to `scrollToNavNode(id)`, which expands collapsed ancestors (re-render if needed), scrolls the row into view, and applies `.ne-row-search-current` (+ flash `.ne-row-highlight`); `clearNavSearchHighlight()` clears it on close/empty query.

Toggled via the **Tree** button. Hides sidebar via `.tv-active` class. Full tree with inline editing of labels and slugs, drag-and-drop reorder/reparent, add/delete nodes. Changes cascade to audit rows (`Nav Destination`, `Computed Path`, `Nav_SortID`). On save, sends `allNavNodes` for full `NavStructure` sheet rewrite. Column widths are resizable via drag handles. The Node column (`.ne-left`) uses `flex:1` to absorb extra window width. **Clone branch** (⧉ button) deep-clones a node and all children as a sibling (structure only, no page assignments; top-level clone gets "(copy)" suffix). **Fold state** (`state.navFoldState`) persists collapsed/expanded state across re-renders. Nav changes snapshot old paths before recalculation to preserve page suffixes during moves. Supports a **Collapse** column (per-node sitemap collapse flag — the legacy InMenu checkbox/column + Set/Clear-Menu buttons + node-editor toggle were all repurposed to `node.collapse`; `inMenu` data is preserved for round-trip but no longer edited in the UI) and **duplicate slug detection** via `buildDuplicateSlugSet()`, `refreshDuplicateSlugHighlights()`, and `navSlugExistsInBranch()` which highlight conflicting slugs within the same branch. **Net new badge**: nodes with child pages assigned but no direct pages show a yellow "NEW" badge (`.ne-net-new-badge`) in the Pages column; row has a subtle yellow tint. Stats bar shows "X net new" count. **External URL**: nodes can have an external URL assigned (stored in `URL` column of NavStructure sheet); shows link icon in Pages column and URL in blue italic in Computed Path. **Depth filter**: dropdown filters tree to a specific depth; the **"Collapse"/"Expand"** buttons set/clear `node.collapse` on all visible nodes. **Pages column indicators**: link icon (external URL), arrow (reference to another node), NEW (net new), empty circle (empty leaf), or numeric count (clickable). **Reference picker**: 880px wide dialog with hierarchical sort by sortID, depth indentation, bold top-level nodes; number search matches from start, text search matches anywhere.

**Visual Sitemap (`generateNavSitemap`):** the **Sitemap** button (modal titled "Visual Sitemap", reusing `#progress-modal`) renders the **content IA** (no longer menu-framed) as box-style D3 trees via `render-sitemap-d3` (hidden BrowserWindow, D3 via string concat), one card per top-level section, 160×34px boxes, page-count badge, zoom/pan, Visual/Text-Tree tabs, PDF + SVG/HTML export. Toolbar controls (persist as `projectSettings.navSitemap{Layout,ColorBy,Palette}`):
- **Levels** — `depthFilter` cap (All / 1…treeMaxDepth); deeper nodes collapse to a stacked box.
- **Layout** (`options.layout`) — `outline` (indented), `tree` (`d3.tree()`), `columns` (mega: spine-skip then fan branch children into columns).
- **Color by** (`colorValueOf`) — `section` (top-level ancestor) / `pattern` (`buildPattern`) / `status` (`pageStatus`, uses `pageStatusLibrary` colors) / `kke` (per-node from assigned rows' Final/KKE; `Mixed` when they differ). `buildNavColorMap()` builds the colorMap.
- **Palette** — `meaningful` / `brand` (`projectSettings.brandPalette`, edited in Project Settings → Identity) / `mono` (single color via `options.defaultColor`).
- **Collapse**: a node with `collapse` (or past the Levels cap) renders with the stacked **"has sub-pages"** shadow (`hasHiddenChildren`) and its subtree omitted. **Border** = build phase (solid = current build, dashed = phased), via `options.borderLegend`; the D3 renderer's nav-only legend rows are suppressed for menus via `options.showStack`/`borderLegend`/`legendTitle`. The shared D3 renderer (`main.js`) writes to a **unique temp file per call** so concurrent renders don't collide.

**Drag-and-drop (shared engine):** the nav tree and the menu item tree share ONE drag/drop engine (defined near the Menus section in renderer.js): `makeTreeDragHandle(grip, row, mime, id, {dragImage})` wires the grip's dragstart/dragend; `attachTreeRowDropTarget(row, {mime, onReorder(draggedId, zone), foreign?})` wires dragover/dragleave/drop; `_treeDragOver = {el, zone}` tracks the active target and `clearTreeDropIndicators()` clears it; `_setTreeDropZone` paints the indicator. Tree mutation stays per-view in the `onReorder` callback (`moveNavNode` / `moveMenuItem`). 30% top/bottom zones → before/after, middle → into; the `dragleave` guard (`row.contains(e.relatedTarget)`) prevents flicker. Indicators are the shared `.tree-drop-before/after/into` (inset-shadow edges + into-tint) + `.tree-row-dragging` (opacity 0.35). The `foreign` hook is available for a row to accept other drag types but is currently unused (the old sidebar-row→node drag-assign was removed — the Nav Tree hides the sidebar, so it was unreachable; assign via the audit bar **Nav** button/picker).

**`_findNavNodeLocation(target, nodes)`** — helper that walks the nav tree by object reference (not by `parentNumber`) to locate a node's parent array and index. Used by `deleteNavNodeFromEditor` to fix a bug where "also delete this node" wasn't working after tree reorganizations that left stale `parentNumber` values.

### Redirect editor (`#redirect-editor`)
Toggled via the **Redirects** button. Hides sidebar via `.tv-active` class. Shows all pages needing redirects (Kill pages + URL-changed pages). Each row has: KKE badge, title (clickable — navigates to that row in audit view), current URL, editable destination URL, and a nav picker button (600px wide, anchored to right edge). Destination priority: custom per-row > nav node path > default destination > blank (no more homepage fallback). `resolveRedirectDestinations()` is called before save to populate `Redirect_Destination` for all Kill/URL-changed pages. Site domain and default destination are configured in **Project Settings (▤)**, not in the redirect toolbar. The editor has its own status filter dropdown, text search, and sortable column headers (Status, Title, Current URL, Destination URL — each cycles asc → desc → none). **Find/Replace** (`#redirect-find-replace-bar`): toolbar button toggles a bar with Find/Replace fields; Find/Replace **filters** the list (shows only matching rows, not just highlights). Exact match checkbox available. Respects status filter and text search. Live match count shown. "Replace All" applies substitution to all matching destination URLs. **Scroll to current page**: when opened from audit view, auto-scrolls to the currently selected page's row with a brief highlight.

**`resyncNavBasedRedirects()`** — wired to the "Re-derive from nav" button (`#btn-redirect-resync-nav`) in the redirect editor toolbar. Iterates all rows with a non-empty `NavID`: for Kill/Consolidate rows, sets `Redirect_Destination` to the resolved nav path (skips if destination is literal `'404'`); for other KKE values, updates destination only when `Computed Path` differs from the current URL (URL is changing), also skipping `'404'` values. Calls `setDirty(true)` and refreshes the redirect editor. Distinct from `resolveRedirectDestinations()` (which runs automatically on save for all Kill/URL-changed rows) — this function is a manual on-demand sync.

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

**Other ops:** `addMenu` / `deleteMenu`, `addMenuItemRef` (→ `showMenuNodePicker`, a searchable content-node picker) / `addMenuItemLink` / `addMenuItemHeader`, `removeMenuItem` (reparents orphans to the removed item's parent), `seedMenuFromContentTree` (builds a menu mirroring in-menu nav nodes, falls back to all nodes). Setup in `setupMenusView()`; the other views' open functions call `closeMenusView()` and vice-versa.

**Export (`btn-menu-export` → `openMenuExportDialog()` → `runMenuExport(list, format)`):** CMS-agnostic — a neutral structured representation any CMS import maps from; **no vendor's nav model is baked in** (CMS-native files would be optional opt-in adapters layered on top). Two formats: **xlsx** (`buildMenuExportSheet()` → a flat `Menus` sheet via the existing `export-migration-tracker` IPC; columns Menu/Placement/Description/Depth/Trail/Label/Kind/Target URL/Target Page/Node ID/Item ID/Parent Item ID) and **JSON** (`menuToJsonTree()` → nested per-menu items via the `save-text-file` IPC, which now takes optional `filters`). `menuExportTargetUrl()` resolves a `ref` to its node's `computedPath` (domain-prefixed) and a `link` to its external URL. Dialog scope = all menus / the selected one.

**Reference integrity:** `findMenuOrphans()` returns `{menu,item}` for every `ref` item whose `nodeId` no longer matches a live node (deleted/renumbered). `renderMenusView()` shows a red `⚠ N broken refs` toolbar button (`#btn-menu-check`, hidden at 0) → `openMenuOrphansDialog()` lists each broken item with **Re-pick…** (reuses `showMenuNodePicker`) and **Remove** (`removeMenuItem`); the list re-renders live as you resolve them. Each broken item also shows `(missing page)` inline in the tree.

**Page breadcrumb in exports:** the breadcrumb axis surfaces in deliverables via a `pageBreadcrumb` column (`pageBreadcrumbOf(node)`) — added to `navExportColumnDefs()` (so it flows into the Migration Tracker **Nav Plan** sheet and the Nav Tree's *Filtered nodes → Excel* column picker) and to the menu export (xlsx `Page Breadcrumb` column + JSON `pageBreadcrumb` on `ref` items).

**Per-menu sitemap (`btn-menu-sitemap` → `generateMenuSitemap()`):** renders each menu as a box-tree through the shared `render-sitemap-d3` IPC (same `{name, menu, pattern, phase, pageCount, hasHiddenChildren, children}` shape as the nav sitemap). One tree per menu (synthetic root = the menu name, styled neutral via `isMenuRoot`); `header` items dashed (`menu:false`). Wide `openModal`, one card per menu, scroll-zoom / drag-pan (`_menuSitemapZoom`), and a per-card **SVG** download via `save-text-file`. Per-card **layout** picker (`menu.sitemapLayout`); modal-level **Color by** (kind / section via `menuColoring`/`menuSections`) + **Palette** (meaningful / brand / mono; persist as `projectSettings.sitemapColorBy`/`sitemapPalette`). Both sitemaps share the brand palette (`projectSettings.brandPalette`).

**Sitemap layouts (`options.layout` in the D3 renderer):** three layouts, selectable per menu via a card dropdown (stored as `menu.sitemapLayout`, default `columns`):
- `outline` — DFS indented list (depth → indent right, rows stack down). The original; deep/narrow menus.
- `tree` — top-down tidy tree via `d3.tree()`; classic fan-out for shallow/wide.
- `columns` — mega-menu layout: descends the single-child **spine** (e.g. Primary → Home → Academics) until the menu branches, then fans those children into side-by-side **columns**, each stacking its descendants vertically (nested items indent within the column). Wide *and* deep. The spine is centered over the columns; `sec.isColumnHead` / `d.isSpine` flags drive top-down vs indented connectors. `ROW_HC`/`COL_GAP`/`INDENT_C` tune spacing.
The renderer is layout-agnostic otherwise; the menu sitemap passes `legendTitle`/`borderLegend`/`showStack:false` so the legend reads "Item kind · Page/Link · Header" instead of the nav-only "In nav / Has sub-pages". **Backlog (later):** backport the menu DnD engine to the nav tree.

---

## SME workflow

The Subject Matter Expert (SME) workflow enables external reviewers to validate KKE recommendations without needing the app.

### Export (File > SME Export, or `menu-sme-export`)
Generates a standalone `.xlsx` file for SME review. Uses **ExcelJS** (not SheetJS) to produce xlsx files with embedded data validation dropdowns (e.g., SME_Decision options). After ExcelJS generates the file, a post-processing step via **JSZip** replaces `&quot;` with literal quote characters in the xlsx XML to work around an ExcelJS encoding issue. The export is handled by the `sme-export` IPC channel in the main process.

### Import (File > SME Import, or `menu-sme-import`)
Reads back the SME-completed spreadsheet and merges SME columns (`SME_Decision`, `SME_Notes`, `Content_Owner`) into the working data. Uses a two-step IPC flow: `import-audit-merge-open` opens a file picker and returns available sheet names, then `import-audit-merge-read-sheet` reads the selected sheet. This replaced the earlier single `import-audit-merge` channel.

### Resolve (File > SME Resolve, or `menu-sme-resolve`)
Reconciles SME decisions with original KKE recommendations to produce `Final_KKE` values. Where SME approved the original recommendation, `Final_KKE` matches `KKE_Recommendation`. Where SME chose "Change: X", `Final_KKE` is set to the SME's override.

---

## Client reports

Six client-facing reports accessible from the Reports menu, all using shared infrastructure:

- `buildReportShell(title, bodyHtml)` — wraps body HTML in a full standalone HTML document with embedded styles
- `showReport(title, bodyHtml, exporterFn)` — renders report in the progress modal and wires up the exporter callback
- `exportReport(title, bodyHtml, defaultName, format)` — exports as PDF (via `export-progress-pdf`) or HTML (via `export-report-html`)
- `_progressModalExporter` — callback stored globally; called with `'pdf'` or `'html'` when the user clicks the export buttons in the progress modal

Reports: Executive Summary, Content Inventory by Section, SME Review Status, Redirect Map Report, Net New Content Brief, Migration Checklist. Each is triggered by a `menu-report-*` IPC channel from the Reports menu.

**IA Report enhancements:** `reportNavIa()` builds a `redirectCounts` map (NavID → count of Kill/Consolidate rows assigned to that node) and passes it to the HTML builders. `_navIaPreviewSubtree` / `_navIaExportItem` now render four distinct node states:
- `isEmpty` (no pages + redirect count is 0) → red empty badge
- `isRedirectOnly` (redirect count > 0 but no live pages) → `→` slate badge
- `isHeader` (structural header node) → `≡` italic header badge in export
- Normal (has live pages) → `Np` grey count badge

Page counts in both `renderNavEditor()` and `_navPageCountsCache()` exclude Kill/Consolidate rows so those pages do not inflate live-page tallies.

**Default redirect URL propagation**: when `defaultRedirectUrl` is changed in Project Settings, the app checks for existing redirect destinations matching the old value and offers to update them all via a confirmation dialog showing the count of affected pages.

---

## Dependencies

| Package | Used for |
|---------|----------|
| SheetJS (`xlsx`) | Reading and writing xlsx files (all general file I/O) |
| ExcelJS | SME export only — needed for data validation dropdowns in xlsx |
| JSZip | Transitive from ExcelJS; also used directly for post-processing xlsx (`&quot;` fix) |
| D3 (`d3.min.js`) | Visual sitemap rendering — custom indented-list layout (not D3 tidy tree) using `d3.hierarchy()` for data binding, in hidden BrowserWindow via `render-sitemap-d3` IPC |

---

## Structural sheets

Sheets hidden from the data sheet picker:

| Sheet | Purpose |
|-------|---------|
| `NavStructure` | Navigation tree nodes (Number, Label, Path, ID, URL, `Url_Path` URL override, etc.) |
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

Implemented as a proper `.modal-overlay` + `.modal-dialog` (replaced the earlier draggable popover). All modals are draggable from their header via the reusable `makeModalDraggable(modalEl, { handleSelector? })` utility. `resetModalPosition(modalEl)` clears positioning on close so reopen returns to center. Modals using this utility: Project Settings, ContentTypeRegistry editor, Computed Columns, Suggested KKE settings (legacy), Glossary editor, GA KKE config dialog. Handle defaults to `.modal-header`; older dialogs that use a custom first-child header div pass `handleSelector: ':scope > div:first-child'`. The utility skips drag when the mousedown target is a button/input/select/textarea/link. `toggleProjectSettingsPopover()` opens it; `switchProjectSettingsTab(tab)` handles tab switching. `refreshSuggestionsTab()` populates the Suggestions tab from `state.projectSettings.gaKkeConfig` and `suggestedKkeConfig()`. `renderSavedFiltersList()` populates Saved Filters. Standalone GA KKE Settings and Suggested KKE Settings menu items are removed; their UIs live inside the Suggestions tab. The **App Settings** popover (⚙ button, or File → App Settings) handles application-wide prefs (auto-advance, show SME fields, rubric dir, API key, sidebar columns, column mapping). Custom KKE states are stored BOTH per-project (KKE_Settings sheet, travels with file) AND globally (app prefs, so new files inherit them).

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
5. In `writeWorkbook`: call `writeYourSheet()` and add the name to `sheetsWeEdit` so it's preserved
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
| `docs/PITCH.md` | Client-facing pitch (written + conversational versions) — describes the audit process and its competitive advantages |
| `src/help.html` | Help window — concise feature documentation opened as a separate window |

For UI/interaction changes, also keep **`docs/UI_STANDARDS.md`** current (the interaction contract) and **`docs/dev/REVIEW_FINDINGS.md`** (the audit backlog) up to date.

---

## Bug fixes (logged here for reference)

- **Phased nodes and NEW badge:** `isHub` and `isOrphanLeaf` logic both gate on `!isPhased` before applying the `.ne-net-new-badge`, so nodes with a non-empty `node.phase` never show the NEW badge.
- **`deleteNavNodeFromEditor` object-reference lookup:** now uses `_findNavNodeLocation()` by object reference rather than `parentNumber` to find the target in the tree, fixing "also delete this node" failing silently after nav reorganizations that left stale `parentNumber` values.
- **`clearNavAssignment()` live tree refresh:** now calls `invalidateNavPageCountsCache()` and, if `_navEditorOpen` is true, `renderNavEditor()` so the nav tree immediately reflects the cleared page assignment without requiring a manual re-open.

---

## Known limitations / future work

- Single sheet only — reads `workbook.SheetNames[0]`
- Virtual scrolling in sidebar — tested to ~4,000+ rows (ROW_HEIGHT=34px, OVERSCAN=10)
- Undo/redo: Cmd+Z / Cmd+Shift+Z for KKE changes, 100-action stack per session
- Tag library is global (shared across all files); visibleFields is also global
- `new-window` events from webview open in system browser — intentional
- Webview cannot load `localhost` URLs in production without CSP adjustment
