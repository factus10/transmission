# Transmission

A macOS desktop app for auditing website content. Load a Screaming Frog crawl export (or any spreadsheet with URLs), review each page in an embedded browser, and record Keep/Kill/Evolve decisions directly in the file.

**Version 2.10.0** — "How Soon Is Now?"

---

## Documentation

All documentation lives in **[`docs/`](docs/)**.

- **[Running an Audit](docs/RUNNING_AN_AUDIT.md)** — start here for a real engagement. The opinionated order to do things in, why that order matters, and the assumptions the tool makes that will otherwise catch you out.
- **[User Guide](docs/USER_GUIDE.md)** — the full reference, feature by feature, following the lifecycle of an audit (Set up → Audit → Classify → Review → Architect → Ship).
- **[Quick Start](docs/QUICK_START.md)** — the five-minute tour of the core loop.

The individual **[walkthroughs](docs/walkthroughs/)** are also shippable as standalone hand-outs (see [`docs/walkthroughs/README.md`](docs/walkthroughs/README.md) for the reading path). Architecture and developer notes live in [`CLAUDE.md`](CLAUDE.md); the content-type / roles rationale in [`docs/CONTENT_TYPE_MODEL.md`](docs/CONTENT_TYPE_MODEL.md).

The list below is a feature catalog, not a how-to.

---

## Features

### Project Files (.transmission)
- **SQLite-backed project files** — **File → Save As Project…** (`Cmd+Shift+S`) converts the open spreadsheet (with all in-session edits) into a single `.transmission` file and switches the session to it. Saves become instant (milliseconds, no workbook rebuild) regardless of file size; the existing 2-second autosave does the rest.
- **One file is still the whole project** — rows, decisions, sitemap, settings, glossary, libraries, and the full change history (now with an auditor name per entry) travel inside it. Put it wherever the project lives; Finder double-click opens it.
- **Every column survives, losslessly** — your whole crawl is preserved exactly as exported, including any **custom extraction** columns from Screaming Frog (XPath/CSS/regex pulls: CMS IDs, author bylines, publish dates, schema markup, component flags…). Nothing is dropped, renamed, or reordered when you open a spreadsheet or convert it to a `.transmission` project, and it all round-trips back out intact on **Export Full Workbook**. Those columns aren't dead weight either — surface them in Table View, pin them to the field bar, or filter on them with **+ Field filter**. The app treats your columns and its own audit columns identically.
- **Excel becomes the deliverable format** — **File → Export Full Workbook (.xlsx)…** writes a complete spreadsheet (all structural sheets + full change history) for clients, colleagues without Transmission, or archive. Exports round-trip: an exported workbook can be re-opened and re-converted later.
- **Package for Handoff** — **File → Package for Handoff…** saves, checkpoints, and zips the project (with a README for the recipient) in one step, then reveals the zip in Finder. The other auditor unzips and double-clicks; their edits join the same change history under their username. A rolling safety copy of each project is also kept in the app's support folder on every open.
- **Client Export profiles** — **File → Export… → Client Export** exports just the columns an audience needs (filtered or all rows). Ships with **Client Summary** and **Full** built-ins; save your own named profiles and they travel with the project.

### Core Audit Workflow
- **Open any spreadsheet** (.xlsx, .xls, .xlsm, .ods, .csv) or a `.transmission` project — designed for Screaming Frog exports
- **File → Open Recent** — submenu of the 10 most recent files (newest first), with "Clear Recent Files" at the bottom. Files that have moved/been deleted show with `(missing)` and are disabled. Useful when juggling multiple projects.
- **Two-panel layout** — filterable row list on the left, embedded browser on the right
- **KKE decisions** — Keep, Kill, Evolve, Exclude (plus custom states you define)
- **Kill cleanup prompt** — when changing KKE to Kill on a page that already has a sitemap assignment or redirect destination, the app asks whether to clear them. Applies to single-row KKE buttons, Final KKE, bulk KKE, and Table View inline edits.
- **Redirect indicator** — when the selected page has a redirect destination, a small amber badge in the audit bar's **Decide** cluster shows where it goes (`↪ /new-path`, full URL on hover); click it to open that page in the Redirect Editor, or the **×** to clear the destination. The literal `404` shows as a `404` badge (intentional deindex).
- **Tags** — freeform chip input, stored as comma-separated values
- **Notes** — per-page rationale in a popover
- **Groups & Primary Tag** — categorize pages into groups with a primary tag
- **Auto-save** — changes save automatically after a short idle (≈0.4s in `.transmission` projects, 2s in spreadsheets), with a clear title-bar state (● Unsaved → ⟳ Saving… → ✓ All changes saved)
- **Jump to next unreviewed** — press `]` to skip to the next page without a KKE decision
- **Note snippets** — save reusable rationale text and insert it into any Notes popover
- **Session resume cue** — reopening a partly-done audit shows where you left off

### Guidance & onboarding
- **Welcome dialog + 5-step Product Tour** — a spotlight walkthrough on first launch; re-openable from the Help menu
- **Keyboard cheat-sheet** — press `?` anywhere (or Help → Keyboard Shortcuts, `Cmd+/`)
- **Searchable help** — the Help window has a sticky search box (Cmd+F focuses it) that filters sections live
- **Pre-Handoff Check** (Migration menu) — one command runs every pre-flight check (unreviewed rows, consolidate targets, redirect chains, duplicate sitemap IDs, empty sitemap leaves) into a single exportable pass/issue report
- **AI Suggest for Unreviewed** (Project menu) — fills `Suggested_KKE` for undecided pages via the rubric + Claude (requires your API key); never touches your human KKE
- **Compare KKE vs SME** (SME menu) — full-screen side-by-side of auditor vs SME decisions, click-through to any row
- **Page thumbnails** — hover a visited row in the sidebar to preview its screenshot (captured on visit, kept in memory only)
- **Check for Updates** — checks automatically at launch and via **Help → Check for Updates…**; when a newer version is out, shows a **What's New** changelog (opened in a small internal browser window) and a **Download** link. Installs are still manual (drag the new build to Applications) — nothing downloads or installs itself.
- **Consistent dialogs** — every modal closes on Esc / backdrop-click, with a unified close button and footer layout

### View Switcher (persistent tab strip)
A horizontal tab strip sits permanently below the OS titlebar, always one click away regardless of which view is active:
- **Audit** (`Cmd+1`) — default audit view (sidebar + browser)
- **Table** (`Cmd+T`) — full-width spreadsheet
- **Sitemap** (`Cmd+Shift+T`) — sitemap editor
- **Redirects** (`Cmd+Shift+R`) — redirect editor
- **Menus** (`Cmd+Shift+M`) — menu builder

The View menu mirrors these and adds **Audit Progress…** (`Cmd+P`), zoom controls, and (in source builds) developer items.

### Menu organization
- **App menu (macOS) / File (Win/Linux)** — Preferences (`Cmd+,`)
- **File** — Open · Open Recent · Save · **Save As Project…** (`Cmd+Shift+S`) · Import/Merge · Merge Auditor Decisions · Save/Load Template · **Export…** (unified Cmd+Shift+E) · **Export Full Workbook (.xlsx)…**
- **View** — view switcher mirrors + Audit Progress + zoom
- **Project** — Project Settings · Glossary · **Audience Library** · Content Type Registry · Target Spec Library · Component Library · **AI Suggest for Unreviewed** · Run Rubric · Refresh GA KKE · Recompute Suggested KKE · Triage Non-200 Pages
- **Migration** (export & validation tools) — **Pre-Handoff Check** · Migration Tracker · Export Redirect Map (CSV) · Redirect Chain Check · **Redirect Health Check**
- **Reports** (all reports, grouped) — Executive Summary · Content Inventory · SME Review Status · Menu Report · Sitemap Coverage · Component Inventory · **Audience Coverage · Audience × Section Matrix · Audience Debt · Site Consolidation Overview · Cross-Site Duplicate Overlap** · Migration Checklist · Net New Content Brief · Redirect Map Report
- **SME** — Export · Import · **Compare KKE vs SME** · Resolve Conflicts
- **Help** — Getting Started · Product Tour · Keyboard Shortcuts (`Cmd+/`) · Help

The unified Export dialog (`File → Export…`) is a single chooser for: Filtered Rows (xlsx) · Audit Decisions (CSV/JSON) · Redirect Map (CSV) · Migration Tracker (xlsx multi-sheet) · Client Export (column profiles, xlsx).

### Table View
- **Cmd+T** (or **View > Table View**) toggles a full-width spreadsheet view that hides the sidebar
- Sortable columns — click any header to cycle ascending/descending/none
- Per-column filter inputs for fine-grained filtering
- Resizable columns via drag handles
- **Columns...** button opens a column config dialog to choose which columns are visible
- **Frozen row number column** — the # column stays frozen when scrolling horizontally
- **Inline editing** — double-click audit columns (KKE, Tags, Notes, Group, Primary Tag, SME Decision, SME Notes, Content Owner, Final KKE) to edit inline. KKE-type columns show a dropdown, text columns show a text input. Commit on blur or Enter, cancel with Escape. **Tab / Shift+Tab** commits and moves to the adjacent editable column on the same row.
- **Keyboard navigation** — Arrow Up/Down and j/k navigate rows when no input is focused; the selected row scrolls into view automatically
- Independent sort and filter state from the sidebar — switching back preserves both
- Row selection syncs between Table View and the sidebar

### Content Types & the Crosswalk
Two separate concerns, kept distinct: **what the content *is*** (its type) and **how it *renders*** (page / fragment / generated).

- **Content Type** (the audit field formerly labeled "Page Type") — the data shape of each page. Every page has a *current* content type and maps to a *target* (new-CMS) content type.
- **Renders as** (the field formerly labeled "Nature") — **Page** (has a URL + breadcrumb, built from a page template), **Fragment (embeddable)** (no URL — embedded into pages via components, e.g. an AEM experience fragment), or **Generated** (a template over a query/feed). Stored values are unchanged for backward compatibility.
- **Target Content Type** — the new-CMS type each page maps to. Auto-filled (blanks only) from the Content Type Registry when Content Type changes; an inline `→ Target` hint appears in the audit bar.
- **Content Type Registry → crosswalk** (`Project → Content Type Registry`): per current content type, set its **Renders as** default, **Target Content Type**, **→ Target Spec**, and **Migration Track** default. Ships with curated defaults via an opt-in seed banner. The editor surfaces content types **in use without a crosswalk** as fillable rows (split-aware, so `Article / blog post` counts as covered by an `Article` entry) plus a **Show all pick-list types** toggle for unused global dropdown values; untouched surfaced rows aren't saved. Adding a type via the audit-bar **+ New content type…** seeds a registry stub automatically, keeping the global dropdown and the per-project crosswalk in sync.

### Migration Classification
- **Content Nature** ("Renders as") and **Migration Track** dropdowns in the audit bar (hidden by default; toggle via Preferences → Show Migration fields, or via the `MIGRATE` chip in the field-bar-top)
- **Ghost suggestion** for Migration Track derived from KKE + Content Nature, with the Content Type Registry providing a fallback when Content Nature is blank — click the dashed badge to accept
- **Auto-flow defaults** when Content Type changes: the registry fills blank Content_Nature, Migration_Track, and Target_Content_Type; never overwrites human input
- **Unclassified filter** in the sidebar toolbar — one-click filter for rows whose Content Nature is blank

### Migration Build & Direction
The migration delivery deliverable lives on the **sitemap**: each node carries Build Pattern, Build Guidance, Writer Brief, Page Status, and **three assignee roles** — Builder, Writer, and **Migrator**.

- **Target Spec Library** (`Project → Target Spec Library`, the `PatternLibrary` sheet) — per-project specs that each new content type is built from. Each spec is flagged **Page Template** (layout/components) or **Content Model** (a field schema, for fragments), and carries three kinds of **direction**: a **Writer brief** (for the author), **Build guidance** (for the builder), and a **Migration mapping** (source→target field map, for the migration engineer). Content Model specs also carry a field schema. Ships with 12 curated defaults; assigning a spec fills blank node fields (never clobbers).
- **Three direction kinds, two levels** — the type-level reference lives once on the spec (covers all bulk/scripted content); element-level briefs on a node override it only where it deviates.
- **Apply Pattern conflict dialog** — when a spec's defaults would overwrite content, opens a diff view with per-field Keep / Append / Replace choice.
- **Page Statuses + Assignees** managed in **Project Settings → Migration** tab. Both are inline-addable from the node editor (`+ New…`) with auto-color-cycling for new statuses. Assignee usage counts now span build / write / migrate.
- **Markdown toolbars** on the node editor's Build Guidance, Writer Brief, and Migration Notes textareas (bold/italic/code/link/lists/headings/quote).
- **Prev/Next navigation** through nodes in tree pre-order, directly from the node editor header.
- **Positive build indicators** on every sitemap row: status pill, `P` (pattern), `G` (build guidance), `W` (writer brief), assignee chips. Indicators only appear when the field is set, so blank rows stay clean.
- **Migration Direction Brief** (`Reports → Migration Direction Brief…`) — a per-person worklist for any of the three roles (Writer / Builder / Migrator), grouped by spec, leading with the type-level reference and listing the pages that follow it.
- **Migration Tracker Export** (`File → Export…` → Migration Tracker, or `Migration → Migration Tracker…`) produces a multi-sheet xlsx for engineering: Sitemap Plan (with a Migrator column), Source Pages (with Content Type / Renders As / Target Content Type), Redirects, Archive.

### Shared-content (Fragment) sitemap nodes
- A sitemap node's **Node type** can be **Page**, **Header / organizing level**, or **Fragment / shared content**.
- **Fragment nodes** represent embedded/shared content (e.g. an AEM experience fragment): they keep their computed path as a repository location but have **no menu entry, breadcrumb, or redirect**. They render as their own layer in the tree (a `FRAG` badge + tinted row) and are excluded from net-new / empty counts and the in-menu IA.
- **Nature-aware downstream** — pages that render as a Fragment are excluded from redirects (no public URL) and from the need-placement / sitemap-coverage checks (a fragment has no sitemap home by design).

### SME Review Workflow
A dedicated **SME** top-level menu for subject-matter-expert review:

- **Export for SME Review** — exports an `.xlsx` with a column subset (Address, Title, KKE_Recommendation, Notes, SME_Decision, SME_Notes, Content_Owner). Filter by Group or Primary Tag before exporting. The SME Decision column includes Excel data validation dropdowns. Uses ExcelJS for export.
- **Import SME Decisions** — merges SME responses back into the audit file by URL matching. Auto-populates Final_KKE: "Approve" copies the original KKE_Recommendation; "Change: X" extracts X as the new decision.
- **Resolve Conflicts** — opens a modal showing rows where the SME disagrees with the original recommendation. Per-row Final_KKE dropdown, plus bulk "Accept All SME" / "Keep All Original" actions.

### Global Search (Cmd+F)
- **Cmd+F** opens a floating search bar in the top-right corner that works from any view
- Searches all columns across all rows (not just filtered rows)
- Navigate through matches with the arrow buttons or Enter/Shift+Enter
- Each match selects the row and loads it in audit view
- If a matched row is hidden by the current sidebar filter, filters are cleared automatically
- First match is selected immediately as you type
- Press Escape or the close button to dismiss

### Add New Row
- **New Page** button in the sidebar toolbar (row 2) opens a dialog with URL and Title fields
- Checks for duplicate URLs before adding
- The new row is added to the spreadsheet and selected immediately
- Useful for adding pages discovered after the initial crawl

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd+O` | Open spreadsheet |
| `Cmd+S` | Save |
| `Cmd+F` | Global Search |
| `Cmd+1` | Audit View (return to default view) |
| `Cmd+T` | Toggle Table View |
| `Cmd+Shift+T` | Sitemap |
| `Cmd+Shift+R` | Redirect Editor |
| `Cmd+Shift+M` | Menus |
| `Cmd+Shift+E` | Export filtered rows |
| `Cmd+,` | Open Preferences |
| `Cmd+Z` | Undo last KKE change |
| `Cmd+Shift+Z` | Redo |
| `1` / `2` / `3` / `4` / `0` | Keep / Kill / Evolve / Exclude / Clear (when no input focused) |
| `F` | Toggle flag on selected row |
| `↑` / `↓` or `k` / `j` | Navigate rows |

### Filtering & Selection
- **Text search** — filters rows by any column value. A scope selector attached to the left of the search box lets you narrow matching to **URL only** or **Title only**, making search results intentional rather than catching metadata you didn't mean to match. Default ("All fields") preserves the original behavior.
- **KKE status filter** — checkbox dropdown supporting multi-select. Includes built-in states, custom states, and special filters: Unreviewed, Flagged, Duplicates, SME Conflicts, Pending Final KKE, **Consolidate (no target)**, **Shared sitemap node (2+ pages)**. All checked items are OR'd together.
- **Group filter** — filter by assigned group
- **Flagged filter** — show only flagged/bookmarked rows
- **Duplicate filter** — show rows with identical Title/H1/Meta Description
- **Field filter** — `+ Field filter` button in the sidebar toolbar opens a popup to filter on **any column** with operators: `is blank`, `is not blank`, `contains`, `doesn't contain`, `equals`, `doesn't equal`, `starts with`, `ends with`. Multiple filters AND together. Active filters render as removable chips in the toolbar. All conditions case-insensitive and whitespace-tolerant.
### Non-200 Status Code Triage
- **Project → Triage Non-200 Pages…** opens a dialog listing all rows with non-200 status codes (3xx, 4xx, 5xx), grouped by code
- Per-code action dropdowns let you batch-assign a KKE value (Kill, Exclude, Keep, Evolve) to all rows of that code in one click
- The dialog is also **auto-offered on file open** when non-200 rows are detected and haven't been triaged yet
- Sidebar rows with non-200 status codes show a small colored badge: **amber** for 3xx redirects, **red** for 4xx/5xx errors
- Rows remain fully retrievable and are not hidden — triage only sets KKE values; you can still review and override individual rows afterward

- **Saved filters** — capture text search + KKE filter + group filter + field filters as a named bundle in the file's `KKE_Settings` sheet. Select "+ Save current filter..." in the dropdown to save; restore any saved filter to instantly re-apply all four dimensions.
- **Sortable URL column** — click the header to sort ascending/descending
- **Multi-select** — Cmd+click to toggle, Shift+click for range; the checkbox in the **#** column header selects every visible (filtered) row at once (indeterminate when only some are selected)

### Row Flagging
- Star icon in every sidebar row — click or press `F` to flag
- Flagged state persists in the spreadsheet as a `_Flagged` column
- Filter to flagged rows only via the status dropdown

### Row Color Coding
- Sidebar rows have subtle KKE-tinted backgrounds — light green for Keep, light red for Kill, light yellow for Evolve, light gray for Exclude
- Gives instant visual scanning of audit progress without reading badges

### Sidebar Customization
- **Configurable columns** — choose which spreadsheet columns appear in the sidebar row list (Preferences → Sidebar columns)
- **Extra KKE comparison columns** — click the **+** button at the right end of the sidebar column header strip to add extra KKE-type columns (SME Decision, Final KKE, Content Owner, etc.) as additional badge columns in every sidebar row. Useful for comparing KKE Recommendation vs SME Decision at a glance. Column labels are abbreviated (SME_Decision -> "SME", Final_KKE -> "Final"). Click the x on a column header to remove it. Persisted in prefs.
- **Scrollable URL cells** — URL cells in the sidebar become horizontally scrollable on hover, with a thin scrollbar, so long URLs that were previously cut off can be read in full.
- **Column mapping quick access** — a small gear icon next to "KKE" in the sidebar column header strip opens Preferences for column mapping configuration.
- **Two-row sidebar toolbar** — Row 1: full-width search input with a clear button. Row 2: KKE filter dropdown, Group filter, row count, Saved filters dropdown + save button.
- **Resizable** — drag the divider to resize the sidebar

### Quick Stats Bar
- Persistent bar at the bottom of the sidebar showing "X/Y reviewed (Z%)" with a thin colored progress bar
- Updates in real time as you make KKE decisions
- Always visible when a file is open

### Progress Dashboard
- Open via **View > Progress Dashboard** to see audit progress
- **Client & Project fields** — editable names that persist in the spreadsheet
- Total pages, % reviewed, breakdown by KKE status
- Stacked color bar showing Keep/Kill/Evolve/Exclude proportions
- Counts for flagged, tagged, and noted pages
- Breakdown by group
- **SME Review section** — counts of SME-reviewed pages, approved vs. changed decisions, and Final KKE resolution status
- **Export PDF / HTML** — generate a branded progress report as a PDF or Word-compatible HTML file for client sharing

### Batch Operations — the unified Multi-bar
A single action bar at the bottom of the sidebar adapts to context:
- **"Apply to N selected:"** when rows are multi-selected (Cmd+click / Shift+click)
- **"Apply to N filtered:"** when filters are narrowing the list and nothing's selected
- Hidden when neither applies

The Action dropdown lists every applicable bulk operation: **Set KKE · Set Published Status · Set Content Type · Set Content Theme · Set Group · Set Primary Tag · Add Tag · Assign to Sitemap…**. Pick action → second dropdown shows the values for that action (with a `— Clear` option at the top of every list except *Add Tag*) → confirm → apply. Selection wins over filtering when both apply. Every change is logged to the audit trail.

**Assign to Sitemap…** is the one exception to the pick-a-value pattern — Apply opens a dialog instead: choose an existing sitemap node, or create a new bucket (top-level or nested under a node you pick), and every target page becomes its own new child node there, with slug and label auto-derived from its URL and title (duplicates de-duplicated automatically). Pages already on the sitemap are skipped. Built for placing dozens or hundreds of pages at once — e.g. filter to "Needs sitemap placement" and assign the whole batch — then reorganize with the Sitemap editor's drag-and-drop.

**Other batch operations:**
- **Batch AI assessment** — assess all filtered rows via the Claude API

### Sitemap Assignment
- Load a `Sitemap` sheet (or import from another file) to assign pages to the sitemap
- Cascading dropdown selection with breadcrumb preview
- Create child nodes on the fly
- URL-based suggestions — the app tries to match pages to sitemap nodes based on URL hierarchy
- Page slug editing for computed paths

### Sitemap Editor
- Open the **Sitemap** tab (or `Cmd+Shift+T`) for a **full-width** sitemap editor (sidebar is hidden)
- **Seed an empty sitemap from the audit view** — with no nodes yet, clicking the audit bar's **Sitemap** button shows an inline form (Label prefilled from the page title, Slug from the URL) and a **Create & assign** button that creates the first root node and assigns the current page to it in one step — no need to visit the Sitemap tab first
- Inline editing of node labels and slugs — changes cascade to all assigned pages
- **Drag-and-drop** to reorder nodes or reparent them (subtrees move together). Between-node drops show a bold line indicator with a circle handle; drop-into-node targets show a blue left-border shadow. The dragged row fades to 35% opacity for clear visual feedback.
- Add child nodes or root nodes; delete nodes (children promoted to parent)
- Resizable columns with the Node column expanding to fill available space
- **Clone branch** (⧉) — deep-clone a node and all its children as a sibling (structure only, no page assignments; top-level clone gets "(copy)" suffix)
- **Fold state memory** — collapsed/expanded state persists across re-renders (add, delete, move, edit)
- **Menu item toggle** — InMenu column to mark nodes as visible/hidden in navigation menus
- **Duplicate slug detection** — slugs that conflict with siblings are highlighted in red
- **Slug validation** — slugs are validated on assignment to prevent duplicates
- **Duplicate Sitemap_ID detection** — when 2+ sitemap nodes share the same `ID`, the toolbar shows a red ⚠ link with the count. Click → confirms → renumbers duplicates with new unique IDs (the first node in each group keeps the original). Pages assigned to the shared ID stay with the first node; the rest may need manual reassignment via the sitemap picker.
- **Consolidation Candidates** — toolbar button opens a bulk-resolve modal listing every sitemap node with 2+ assigned pages. Pick a target with a radio button, Apply makes the target Evolve and the rest Consolidate pointing to the target. Filter bar lets you exclude rows by KKE state or Group (e.g. de-scope an entire "Post Launch" section in one click).
- **Net new badge** — nodes that have child pages assigned but no page of their own show a yellow "NEW" badge in the Pages column, with a subtle yellow row tint. Reference (alias) nodes are excluded — they don't count toward NEW or empty stats since they don't own content. Stats bar shows the count. Double-click a NEW node to open its editor: an amber banner points at the Build section's Page Status field for tracking progress ("Not Started" → "In Progress"), and a **Create Page** button turns it into a real spreadsheet row (Keep, tagged `net-new`, assigned to the node) so it flows through the rest of the audit and migration tracker — once it has a page, the node stops being flagged as net new.
- **Create Sitemap from Audit** (Project menu) — auto-generates a starter sitemap tree straight from the crawl's own URLs, for a file with no sitemap yet (or extending one — it only merges, matching section names by label rather than ever replacing anything). Pick a bucket depth (how many URL segments become nested sections before the rest folds into one page) and whether to include Kill/Exclude/unreviewed rows, then Generate. `/about/leadership` becomes About → Leadership automatically; reorganize freely afterward with the Sitemap editor's drag-and-drop.
- **Empty branch indicator** — `○` shows for both empty leaves and parents whose entire subtree has no pages (no descendants with content either). Tooltip distinguishes the two cases. Helps spot redundant aspirational structure for cleanup.
- **External URL** — assign an external URL to a sitemap node via the link button in the actions column. Nodes with a URL show a link icon in the Pages column and the URL in blue italic in the Computed Path column. Stored in a `URL` column in the Sitemap sheet.
- **Phase property** — mark nodes as `Future` / `Stretch` / `Archived` for content the client wants but isn't building yet. Phased nodes get a colored dashed border, italicized label, and a small `FUTURE`/`STRETCH`/`ARCHIVED` pill in the Pages column. Toolbar adds a `Phase` filter (All / Current only / Non-current only) and a count to the stats line. Stored in a `Phase` column in the Sitemap sheet.
- **Node notes** — every node has a markdown notes field accessible from the modal node editor. Notes surface as a hover tooltip on the node label and a small `·` indicator. Stored in a `Notes` column in the Sitemap sheet.
- **Modal node editor** — `✎` button on each row opens a full property editor: read-only context (number / ID / parent / breadcrumb / computed path / page count), editable Label / Slug / In Menu / External URL / Phase / Notes, live preview of derived breadcrumb and computed path as you type. Cmd/Ctrl+Enter saves; Esc cancels.
- **Delete with reassign** — `✕` button always confirms. When pages are assigned, the dialog offers radio-button options: reassign to parent, reassign to another node (search picker), or clear assignments. Children are promoted to the parent unless you choose Delete-all.
- **Depth filter** — dropdown in the toolbar to filter the tree to a specific depth level ("All", "Top level", "Level 1", etc.). "Set Menu" and "Clear Menu" buttons apply to all visible nodes at the current depth.
- **Pages column indicators** — link icon (external URL), arrow icon (reference to another node), NEW (net new page needed), empty circle (empty leaf or empty branch), or numeric page count (clickable). Reference nodes never show NEW or ○.
- **Reference picker** — 880px wide dialog with nodes sorted hierarchically by sortID, indented by depth, top-level nodes bold. Search by node number matches from start; text search matches anywhere.
- **Wide scrollbar** — the sitemap editor's vertical scrollbar is widened to 14px so it's grabbable without hitting the window edge resize cursor.
- **Sanitizer on label/slug edits** — paste handlers strip mojibake (`‚Äô` → `'`), HTML entities, NBSP, zero-width chars, vertical tabs, etc. Multi-character mojibake patterns only — bare accented characters (`é`, `ü`, `ñ`) are left alone.
- **Menu Report** — a tight, hand-off-ready report of your menus (**Menus → Report**, or **Reports → Menu Report…**): one section card per menu with its item hierarchy, page-count badges on page references, `↗` on external links, `≡` on headers, and a red **missing** badge on broken references. Exports to PDF / HTML. (This is the former nav "IA Report", now fed by the independent menus.)
- Page counts per node with gap detection (empty nodes highlighted)
- **URL override** — a node can publish at an address independent of its place in the menu (`Url_Path`); the override re-roots its sub-pages too. Containment and URL are separate axes.
- **Breadcrumb parent** — set an arbitrary on-page breadcrumb top, independent of both the tree and the URL: mark a node a *breadcrumb root* or re-root it onto any other node (`Breadcrumb_Parent`); sub-pages inherit. Optional project "Home" prefix and advisory max-depth flag live in Project Settings → Identity. A deep `College of Business > Departments > Accounting` page can read simply **Home > Accounting**. The rendered page breadcrumb is exported as a column in the Migration Tracker Sitemap Plan, the Sitemap column-picker export, and the menu export.
- Full Sitemap sheet rewrite on save (preserves all extension columns including Phase, Notes, RefNodeID, InMenu, URL, Url_Path, Breadcrumb_Parent)

### Menus
- Open the **Menus** tab (or `Cmd+Shift+M`) — a full-width view for building **independent navigation menus** that *reference* content-tree pages, decoupled from where pages live in the hierarchy
- **Multiple, arbitrary menus** (Primary, Mega, Utility, Footer, search fly-out, …) — drag the left-panel list to reorder them
- **Three item kinds**, switchable in place via a dropdown: **page** (references a content node — live label/path, flags broken refs), **link** (external URL), **header** (label-only grouping)
- **Drag-and-drop** items (⋮⋮ grip) to reorder and nest; each menu can be flat or arbitrarily deep
- **Add or clone directly under an item** — every item row has its own **+** (adds a Page/Link/Header as that item's child, no drag needed after) and **⧉** (duplicates the item and its whole subtree as a sibling, ready to edit into a variant). The item toolbar (+ Page / + Link / + Header / Duplicate menu / Delete menu) stays pinned at the top while you scroll a long menu.
- A page can appear in **any number of menus** at any depth (many-to-many; the content node isn't modified)
- **Per-menu metadata** — a **Placement** (per-project controlled vocabulary: Top bar, Footer, Overlay / Fly-out, … with inline add) and a free-text **Description**
- **Add to a menu from the audit view** — the audit bar's **Menu** button adds the current page to a menu without leaving the audit. Because menus reference pages that live on the sitemap, it first checks the page is on the sitemap (and prompts you to add it if not); once it is, it opens a chooser of your existing menus (click one to add), with a **+ New menu…** option. If you have no menus yet, it opens a **New menu** dialog (Name / Placement / Description) and adds the page to it.
- **Seed from content tree** — generate a starter menu mirroring the in-menu sitemap nodes, then edit independently
- **Duplicate a menu** — clone a menu (and its full item tree) as a starting point for an alternate variant — e.g. testing a different mega-menu structure to show a client — without touching the original. The copy is selected immediately and pre-picked in the Export dialog's "just this menu" scope.
- **CMS-agnostic export** — **Export…** writes a neutral, structured description of your menus (all or just the selected one) that any platform's import maps from — no vendor model baked in. Two formats: a flat, readable **Excel** `Menus` sheet or nested **JSON**; page references resolve to their target URLs. CMS-native files are optional add-ons on top.
- **Broken-reference check** — if a referenced page is deleted/renumbered, the item shows `(missing page)` and a red **⚠ broken refs** toolbar button appears; one click lists every dangling item to re-point or remove before handoff.
- **Per-menu sitemap** — **Sitemap** draws each menu as a box-tree using the same interactive engine as the Visual Sitemap (below): menus stack with headings, items are colored by kind (page / link / header, headers dashed), and you collapse/expand, pan/zoom, recolor, and export right in the view.
- Menus travel with the file (both `.transmission` and `.xlsx`)

### Visual Sitemap
A fully interactive box-tree you build, refine, and hand off — the Sitemap Editor's **Visual Sitemap** button renders the **content IA** as one tree rooted at your homepage. Click cards to collapse/expand, scroll to zoom, drag to pan, **Fit** to frame.
- **Smart layout** — each branch lays out **horizontally** (children fan sideways) or **vertically** (children stack indented below) automatically, controlled by two thresholds in the toolbar: **Vertical from depth** and **or if children ≥**. Right-click any node to **force horizontal / vertical** or override it later.
- **Color rules** — a rule engine (Settings → **Colors**): color by depth or by top-level section out of the box, add your own rules, drag to reorder, and right-click a single node to **set its color**. Conditions match on depth, depth range, section, value, **links to another site**, or **any of 15 fields** — seven carried on the sitemap node (Phase, Node Type, Page Status, Build Pattern, Builder, Writer, Migrator) and eight read from the audit rows (Content Type, KKE, Final KKE, Renders as, Migration Track, Content Theme, Published Status, Target Content Type). Field coloring gives one color per value in use plus a "not set" bucket so gaps are visible; Page Status reuses the colors you've already assigned it in Project Settings. **Mark external links** is a one-click button that colors off-site destinations distinctly, layered on top of whatever scheme you're already using. Uses your **Client brand** palette (Project Settings → Identity) when set.
- **Combined conditions, split properties** — a single rule can test more than one condition, and different visual properties can be driven by different rules, so you can encode one dimension as color and another as line style at the same time.
- **Dominant vs. contains** — a node usually holds several pages, so a rule can test either the node's **dominant** value ("this section is mostly Articles") or whether **any page under it** matches ("this section contains something we're killing").
- **Card styling** — cards render as a **color band** or in the **heavy-outline** convention most sitemap decks use (white box, thick colored border); that toggle and per-rule line style (solid / dashed / dotted) live in Settings → **Colors**, while corner radius and inner padding are in Settings → **Layout**.
- **Settings panel** — **Layout** (card sizes & spacing), **Colors** (rules + per-node overrides), and **Legend** (editable labels) tabs, with **Save as my defaults** so new projects start the way you like.
- **Stacked pages** — multi-page leaves and collapsed branches render with a "more underneath" stack; build phase shows as a solid (current) vs dashed (phased) border.
- **Counts** — a toolbar dropdown decides what the line under each card's label says. By default a card stays clean until you collapse it, and then reports what it's hiding (*"6 pages hidden"*); you can also put that sub-page count on every branch, show each node's **assigned audit pages** instead, or turn the line off. Saved with the project and honored by every export.
- **Share it** — **Export HTML** writes a self-contained, **interactive** file a client opens in any browser (collapse/zoom/pan, no app needed); **Export PDF** prints the current view to a single right-sized page.
- **Export to Miro** — pushes the sitemap to a Miro board as real, editable Miro shapes rather than a flat image: one shape per page, positioned as laid out in the app, connected parent to child, carrying the colors from your rules. Roughly 400 pages takes about a minute. Requires a one-time connection (**App Settings → Miro → Connect to Miro** — authorize in the browser, pick your team); tokens are stored encrypted using the OS keychain, and an advanced fallback lets you supply your own Miro app instead. Pick the destination three ways — create a new board (the default), find an existing one by **name search or a pasted board link** (works even when the account holds thousands of boards), or **re-export to the last board** used for the project (remembered by board ID, so it survives a rename). The export is a one-way push: the board is fully editable in Miro, but changes there don't flow back into Transmission, and Miro shapes have no collapse/expand.
- The menu sitemaps use this same engine, so everything above applies there too.

### Treemap
Content inventory as a squarified treemap — boxes sized by page count, colored by what's actually happening to them. Sitemap toolbar → **Treemap**, next to Visual Sitemap.
- **Pick Depth and Color by, then Generate** — a small dialog up front (no live in-webview settings for now; change either and regenerate).
- **Depth** rolls deeper levels up into the box above them (Depth 2 = top-level sections, broken into their direct children; Unlimited = the real tree, however deep it goes).
- **Color by KKE decision** — each box shows its dominant Keep/Kill/Evolve/Consolidate/Exclude outcome and the composition percentage. **Color by top-level section**, or — only when Depth is Unlimited, since a rolled-up box has no single value to report — **Phase, Node Type, Page Status, Build Pattern, or any assignee role** (Page Status reuses the colors you've already assigned it in Project Settings).
- Pan/zoom/Fit, a legend, and **Export HTML** / **Export PDF**, same as the Visual Sitemap.

### Content Flow
Where the current site's content ends up in the new sitemap, as a flow diagram — band thickness is page count. Sitemap toolbar → **Content Flow**, next to Treemap.
- **Three readings, toggled in the view** — **→ Decision** maps the current site straight onto its Keep/Kill/Evolve/Consolidate/Exclude calls (including any states you've added yourself, each with its own block and color); **→ New sitemap** answers "where did this section's content go"; **→ Decision → New** shows both at once, which is the version to put in front of a client. Color the bands by decision or by source.
- **Name your sites** — source sites start out named after their domain, which is all the app can infer. Since that name labels a whole column of the diagram, the setup dialog offers to rename any that are still bare domains, right there. They're editable any time in **Project Settings → Sites** (where you also set which hosts belong to which site, the CMS, the owner, and whether a site is in scope at all), and the names travel with the project.
- **On a multi-site consolidation the left column can be the source site** — usually the better read, since the unit of work in a consolidation is the site: which site contributes what, and where does it go. Offered automatically whenever the audit spans more than one source site, and it leads by default. Section labels are qualified by site name (`Beta College › About`) so two sites' `/about` can't silently merge, and a site served from both `www.` and a subdomain still counts as one site.
- **Pages that arrive nowhere are shown, not dropped** — **Retired** (Kill), **Out of scope** (Exclude), and **Not yet placed** (no sitemap home yet). In most audits that's the largest number on the diagram, and a flow chart that omits it is misleading.
- **Consolidated pages flow through to their master's destination** — the URL dies but the content survives, so it's counted as arriving, with the band still colored as Consolidate. Chained consolidations resolve all the way through.
- **Current-site sections are read from the URL path** (shared path prefixes and locale prefixes stripped, per host); new-sitemap sections from where each page is placed in the tree. A small dialog picks how deep the current-site axis goes — top-level by default, or split `/academics/programs` from `/academics/advising`.
- **It stays readable at consolidation scale** — a five-site audit can produce sixty current-site sections, enough to leave the diagram no room to draw itself. Small sections past the top 20 group into one **Other** block (page totals still add up, and the count is reported), and labels are dropped rather than overlapped where blocks get thin — every block keeps its color and its hover detail regardless.
- Hover any band or block to isolate its flow. Pan/zoom/Fit, a legend, and **Export HTML** / **Export PDF** — the exported HTML keeps every toggle, so a client gets all the readings with no app.

### Rubrics & Assessment
- Define Keep/Kill/Evolve/Exclude criteria as markdown rubric files
- **Field rules** — auto-evaluated against spreadsheet data (12+ operators)
- **Content rules** — plain English for manual review or AI evaluation
- **In-app rubric editor** — edit rubric files directly (Preferences → Rubrics > Edit)
- **AI assessment** — optional Claude API integration for content-aware recommendations
- **Batch AI assessment** — process all filtered rows with progress tracking
- **Assessment history** — `_AssessedAt` and `_AssessmentResult` columns track when and how each page was assessed

### Browser Features
- **Viewport simulation** — Auto, SM (390px), MD (768px), LG (1280px), XL (1920px)
- **Side-by-side compare** — split the browser to view two pages simultaneously (click `◫`)
- **Content extraction** — extract word count, heading structure, and link count from the rendered page (click `⇊`)
- **Broken link check** — scan page links and report broken ones (click `🔗`)
- **Screenshot capture** — save the current view as PNG (click `📷`)
- **Open in browser** — open the current URL in the system browser
- **Load-error card** — when a page fails to load, the pane shows the URL + error with Retry / Open-in-browser buttons (instead of a silent blank view); a dead page is audit information, not an app failure

### Audit Bar
The audit bar is structured as a **vertical flow of labeled cluster cards**. Each cluster has a colored uppercase pill on its left edge identifying the activity, and the pill is clickable to collapse the cluster to a summary line. Cluster visibility persists per-user.

**Cluster: DECIDE (blue)** — the core call + per-row actions
- **KKE buttons** — Keep, Kill, Evolve, Consolidate, Exclude (plus custom states). The Consolidate button opens a target picker.
- **Suggested_KKE badge** — read-only, color-coded, shows the unified GA + Rubric recommendation with source prefix (e.g., `GA: Kill`). ⚠ when sources disagree. Click for the source breakdown popover.
- **Assess** — runs the rubric against the current row
- **Notes** — popover for per-page rationale (red dot when notes exist)
- **Sitemap** — assigns the page to a sitemap node. When a sitemap assignment exists, a green pill shows the leaf label with a small **×** to clear (confirmation modal lets you optionally delete the now-empty node).
- **SME readout + Final KKE** — when **Show SME fields** is on, SME Decision shows as a read-only display (set via SME → Import) and Final KKE is a dropdown. Final collapses to a green ✓ chip when it matches the KKE call.

*(Tree and Redirects buttons that used to live here are now in the persistent view switcher at the top of the window.)*

**Cluster: CLASSIFY (slate)** — descriptive metadata + tagging (merged from earlier separate Tag cluster)
- **Content Type** — pre-seeded with ~20 defaults; add custom values via **+ New content type…** (stored column is still `Page_Type`)
- **Theme** — per-project content theme
- **Published** — Published / Unpublished / Draft / 404
- **Group** — page grouping with glossary-note tooltip
- **Primary Tag** — single-value tag
- **Tags** — chip input for multiple labels

**Cluster: MIGRATE (amber, toggleable)** — delivery classification
- **Nature** — Page / Content Object / Generated
- **Track** — Scripted / Migrate Records / Configure / Manual Rebuild / Merge / Kill/Redirect, with a ghost suggestion derived from KKE + Content_Nature

**Cluster: CMS (green)** — admin links into both CMSes
- **Source CMS** and **New CMS** URL fields with one-click open-in-browser

Quick-toggle chips for SME and Migrate visibility live in the field-bar-top alongside the gear and ⊘/◉ blank-metadata toggle.

### Component Inventory
A system for cataloging the UI design patterns present on each page, helping ensure every component is accounted for in a redesign.

**Audit bar cluster:**
- A **PATTERNS** cluster (violet pill) appears in the audit bar — hidden by default; toggle on via the `Patterns` chip in the field-bar-top or via App Settings
- Each page can have any number of patterns tagged (stored comma-separated in the `Design_Patterns` column)
- **Chip-based input** identical to Tags: searchable dropdown, click to add/remove. Dropdown groups patterns by category with **Low / Medium / High complexity badges**. Hover a chip to see the pattern's description.

**Component Library (`Project → Component Library…`):**
- **57 built-in default patterns** across 12 categories: Hero, Card, Collection, Navigation, People, Content, Social Proof, Stats, CTA, Form, Media, Feed, Structural
- Each entry: Name, Category, Complexity (Low / Medium / High), Description, Design System URL, Aliases, Notes
- **Seed defaults** button adds the 57 built-ins to a fresh project (skips any that already exist by name)
- Stored in the `DesignPatternLibrary` structural sheet — travels with the file

**Reports → Component Inventory…:**
- Summary stats: pages audited, distinct patterns found, one-off pattern count
- Full inventory table: pattern name, category, complexity, page count, KKE breakdown per pattern
- **One-off patterns** (≤ 2 pages) are flagged — potential custom one-off builds or content to cut
- **Top co-occurring pattern pairs** — shows which patterns always appear together, revealing natural page templates

### Consolidate (Content Merging)
- **Consolidate** is a fifth KKE state alongside Keep / Kill / Evolve / Exclude — for pages whose content should be merged into another page in the inventory rather than killed outright
- Why it exists: most audits include a lot of "near-duplicate" pages (multiple landing pages on the same topic, overlapping FAQs, blog posts that should be one comprehensive guide). Kill discards their value; Evolve leaves cannibalization in place; Consolidate is the merge
- **Consolidate target picker** — virtual-scrolled, filterable, sortable list of every page in the inventory; pinned source URL + SME Notes hint at the top; current target shown in an indigo callout when reassigning, with a **"Go to page →"** link that jumps straight to the target row
- **Duplicate-destination guard** — marking a page Keep/Evolve (or assigning its sitemap node) when another Keep/Evolve page already shares that destination triggers a **"Did you mean to Consolidate?"** prompt naming the other page, with a one-click **Consolidate into it**. Catches accidental duplicate placements as they happen, not just when the Consolidation Candidates workflow is later run
- **`Consolidate_Into` column** — stores the destination using the target page's **Computed Path** (new site URL) when one is available, falling back to the inventory URL. The value updates automatically when the target page gains a sitemap assignment.
- **Dead target warning** — an amber dot appears on the Consolidate button when the consolidation target has been set to Kill or Exclude (a misconfiguration that needs attention)
- **"Consolidate → Kill/Exclude target" sidebar filter** — surfaces all pages whose consolidation target has been killed or excluded, so you can resolve the entire set at once
- **Pre-save sweep** — before writing the file, any stale `Consolidate_Into` values (inventory URLs that now have a computed path) are resolved to the new computed URL automatically
- **"Shared sitemap node (2+ pages)" sidebar filter** — surfaces all pages where the Sitemap_ID is shared with one or more other pages, so you can find consolidation candidates in the sidebar
- **Consolidation Candidates workflow** — Sitemap Editor toolbar button opens a bulk-resolve modal: every multi-page sitemap node listed with its pages, pick a target with a radio button, Apply sets the target to Evolve and the others to Consolidate pointing to the target. Skip defers groups; counter tracks progress. Filter bar above the list lets you exclude rows by KKE state (chip checkboxes for every value present in row data, including typos) or by Group (multi-select, useful for de-scoping a section like "Post Launch")
- **"Consolidate (no target)" filter** — surfaces rows where KKE or Final_KKE is Consolidate but `Consolidate_Into` is empty (typically after an SME import where the target wasn't specified)
- The picker shows the row's SME Notes as a yellow hint when present, since SMEs often write target URLs there

### Tag & Group Glossary
- **File > Edit Glossary…** opens a modal to add descriptions to every tag and group
- Markdown editor with a thin toolbar (bold, italic, list, link, code) and live preview
- Entries for tags you've created, groups you've used, and anything in the glossary itself
- Stored per-file in a hidden `KKE_Glossary` sheet (Type / Name / Notes) so the glossary travels with the audit
- Tag chips and the Group select in the audit bar show the glossary note as a hover tooltip
- **Export for Word…** button in the glossary modal generates a standalone `.html` file (client-branded with your project/client names) that Word opens with formatting preserved. Ready to drop into a content strategy deliverable.

### Audience tagging
Makes audience prioritization and jobs-to-be-done workshop output a real input to the audit instead of a slide nobody reopens. A page can have decent traffic, pass every rubric rule, and still serve nobody the client decided to invest in — that finding is unreachable without this.

- **`Audiences`** (multi-value chips) records every audience a page does real work for; **`Primary_Audience`** records who it's mainly for (auto-filled when only one is tagged).
- **Per-project library** with a **tier** per audience — Primary / Secondary / Tertiary / Not a target — plus a color. Lives on its own visible **`Audiences`** sheet, so the workshop output can be pasted in and kept as a working document. Managed in `Project → Audience Library…`. Paste your workshop output straight in, or seed an opt-in starter list — **Higher education** or **General organization** (all at Secondary; the ranking is yours to set).
- **A blank cell means *unreviewed*, not "serves nobody."** The reserved *— None (no target audience)* entry is the positive call, and only it argues Kill.
- **Bulk tagging** via the Multi-bar (Add / Remove Audience, Set Primary Audience) — the only realistic way to tag a large crawl. Worklist filters: **Needs audience**, **Serves no priority audience**, and **Audience suggested by AI**.
- **Fill Audiences from Section…** spreads audiences you have already tagged in a section onto that section's untagged pages. Free, no API key, only fills blanks, and reverses with one **Cmd+Z**. A section needs at least 3 tagged pages with an audience on half of them before it may speak for the rest.
- **Suggest Audiences with AI…** reads each page's title, H1, meta description, URL and section against *your* audience library and proposes who it serves. **It never writes the `Audiences` column** — suggestions land in a review queue grouped by answer, so a few thousand pages collapse into a few dozen judgements. Accept per group, or take them one at a time from the audit bar. Runs on your own Claude API key; Opus 5 / Sonnet 5 / Haiku 4.5.
- **Feeds Suggested_KKE** as a weighted source, colors the Visual Sitemap and Treemap by Primary Audience, and rides along in the Migration Tracker and SME export.
- **Three reports** — Audience Coverage, Audience × Section Matrix, Audience Debt.

### URL Variant Triage
A crawl is not a content inventory. On a CMS-driven site much of it is alternate views of the same page — pagination, sorting, faceted filters, tracking parameters. **Project → Triage URL Variants…** groups those by the page they point at and disposes of them in bulk.

- Reads the site's own **`rel=canonical`** rather than guessing from parameter names — authoritative, and no per-CMS rules to maintain.
- **Query-only variants** (same path) become **Exclude**; the canonical's redirect already covers them. **Different-path variants** become **Consolidate** into the canonical, which writes the redirect for you.
- Nothing is hidden: every page keeps its row and gets a logged decision, and the whole triage reverses with one **Cmd+Z**. Out-of-scope sites are skipped.
- Filters: **Alternate view of another page (canonical)** and **Canonical target not in this crawl**.

### Jobs to be done
Audiences answer *who* a page is for; jobs answer *what people came to do*. A per-project **Jobs** library (Project Settings → Audience) holds the JTBD workshop output — a short label, the full statement, and which audiences have it.

The payoff is the inverse question: **Reports → Jobs Coverage** leads with the jobs *nothing on the site answers*. That's the strongest brief for net-new content available, because each line traces back to something the client said in their own workshop. The same list is appended to the Net New Content Brief.

### Consolidating several sites into one
When an audit merges multiple existing sites — `www.company.com`, `home.anothercompany.com`, `thirdcompany.com` — the **site** becomes a unit of work in its own right.

- A **`Sites` registry** (Project Settings → **Sites**) lists each source site with its hosts, CMS, owner, and an **in scope** flag. It auto-creates one entry per domain found in the crawl; `www.`/non-`www.` is folded in automatically, and you decide whether `careers.` or `blog.` is the same site by moving hosts between entries.
- **`Source_Site`** is derived onto every row, so you can filter, sort, colour the sitemap, and export by it.
- **Out of scope** drops a site from every report denominator without deleting anything — for a property that isn't part of this phase.
- **Redirect maps split per domain**, because each retiring domain is deployed as its own redirect configuration. One sheet per domain in the Migration Tracker; one CSV per domain from the Redirect Map export.
- **Two consolidation reports** — **Site Consolidation Overview** (what each site contributes: pages, disposition, audiences, overlap, redirect rules required) and **Cross-Site Duplicate Overlap** (pages whose title, H1 and meta description appear on more than one site — the merge worklist).
- Transmission warns if several sites are in scope and no **Site Domain** is set, since redirect destinations would otherwise be built on whichever domain happens to come first.

### Suggested_KKE (Unified Suggestion Engine)
The audit bar's suggestion badge surfaces a unified recommendation drawn from multiple sources, prefixed with the winning source name (e.g., `GA: Kill`, `Rubric: Evolve`).

- **GA source** — generates a Keep/Kill/Evolve recommendation from four GA4 metrics: Sessions, Engagement Rate, Average Session Duration, Views per Session. PERCENTRANK normalization, weighted composite, configurable thresholds.
- **Rubric source** — field-rule + LLM assessment (per-row Assess button or batch via `Project → Run Rubric on filtered rows…`).
- **Audience source** — turns the audience prioritization workshop into a vote: serving a **Primary** audience argues Keep, serving only Tertiary/off-target audiences argues Evolve, and an explicit *— None (no target audience)* argues Kill. Untagged and Secondary-only pages abstain, so an untagged project is unaffected. See [Audience tagging](#audience-tagging).
- **Suggested_KKE column** stores the winning recommendation; **Suggested_KKE_Sources** is a JSON sidecar with the per-source breakdown.
- **Disagreement detection** — when sources disagree, the badge gets a dashed amber border with a ⚠ glyph. The popover highlights the disagreement.
- **One-time migration on file open** — files with legacy `GA_KKE_Recommendation` or `_AssessmentResult` get their values seeded into `Suggested_KKE` so the badge renders right away.
- **Configuration** — `Project → Project Settings → Suggestions` tab. GA sub-config opens the existing column-mapping / weights / thresholds dialog; source weights tune per-source preference. `Project → Recompute Suggested KKE` reruns the orchestrator.
- Suggestions never overwrite the human `KKE_Recommendation` — they're a signal, not a decision.

### Project Settings
**Project → Project Settings…** opens a centered, draggable modal with **five tabs**:

1. **Identity** — Client / Project name (shown in progress dashboard and PDFs), Site domain (target for redirects + sitemap paths), Default redirect destination (fallback for Kill pages without a custom redirect; changing it offers to rewrite matching existing values).
2. **KKE States** — Custom KKE states (label + color picker). Stored per-project AND globally so new files inherit them. Each row shows usage count and a **Merge…** button to reassign rows from one state to another (used for typo cleanup). Rogue values (KKE values in row data that aren't in your defined states) appear in a separate sub-section with their own Merge buttons.
3. **Suggestions** — GA Analytics source (button opens the existing GA KKE configuration dialog), Rubric source (button runs batch rubric), per-source weights with **Save & Recompute** action. Last-run stats shown.
4. **Migration** — **Page Statuses** (color, rename, reorder, delete with cascade-clear across sitemap nodes) and **Assignees** (rename, delete with cascade-clear). Inline-addable from anywhere they're picked.
5. **Saved Filters** — list of saved filter bundles with Apply / Delete per row.

All settings are stored in the `KKE_Settings` sheet and travel with the file.

### Preferences
- Open via **Transmission → Preferences…** on macOS (or **File → Preferences…** on Windows/Linux). Shortcut: `Cmd+,` / `Ctrl+,`.
- Auto-advance, Show SME fields, Show Migration fields, hide blank metadata, rubric directory, Claude API key, sidebar columns, column mapping, Miro connection
- Per-user preferences (stored in `prefs.json` in the app data directory). Cluster collapse state, blank-metadata visibility, and the SME / Migration field toggles persist across sessions.

### Redirect Editor
- Click **Redirects** in the view switcher (or `Cmd+Shift+R`) to open a **full-width** redirect map editor (sidebar is hidden)
- Shows all Kill pages and pages whose URL changed via sitemap mapping
- The `404` literal in `Redirect_Destination` is treated as a first-class "intentional deindex" — a **404** toggle button next to each row's destination input flips between a destination URL and `404`. Rows marked `404` style as amber-italic and appear in their own section in the Redirect Map Report.
- Each row displays: status badge, title (clickable — navigates to that row in audit view), current URL, editable destination URL
- Set per-row destinations manually or pick from the sitemap (600px wide picker, anchored to right edge)
- **Status filter** — dropdown to filter by KKE status or "URL Changed"
- **Text search** — filter by URL, title, or destination
- **Column sorting** — click Status, Title, Current URL, or Destination URL headers (asc/desc/none)
- **Find/Replace** — toolbar button opens a bar with Find and Replace fields. Find/Replace **filters** the list (shows only matching rows, not just highlights). Exact match checkbox available. Respects status filter and text search. Live match count shown as you type. "Replace All" applies the substitution to all matching destination URLs. Replace value can be blank to clear destinations.
- **Re-derive from sitemap** — toolbar button re-syncs redirect destinations from current sitemap assignments. Useful after reorganizing the sitemap when many existing destinations are out of date. Kill/Consolidate rows get the sitemap path as their destination; Keep/Evolve rows are updated only if their URL is actually changing; rows with an explicit `404` destination are skipped.
- **Scroll to current page** — when opening the redirect editor while viewing a page, the editor scrolls to and briefly highlights that page's row
- **Redirect destination resolution on save** — before saving, all Kill and URL-changed pages have their `Redirect_Destination` column populated with the resolved value (explicit > sitemap path > default > blank). No more homepage fallback — blank means retired/404.
- Site domain and default destination are configured in Project Settings (File menu)

### Reports & Analysis
- **Redirect Chain Detection** — Reports > Redirect Chain Check scans Kill pages and flags any whose redirect destination is itself a Kill page, catching redirect chains before implementation. Results shown in a dialog.
- **Redirect Health Check** — Migration > Redirect Health Check finds redirects that no longer agree with the sitemap: pages redirecting to themselves, Keep/Evolve pages carrying a redirect while not on the sitemap at all, and destinations left behind by a tree that has since been rebuilt. Groups them, shows every affected page, and repairs the ones you tick in a single undoable step. Destinations that still resolve to a real node are reported but never changed automatically.
- **Sitemap Coverage Report** — Reports > Sitemap Coverage Report analyzes the sitemap: empty leaf nodes (no pages, no children), hub nodes (children but no direct pages), overloaded nodes (5+ pages), and path mismatches (page URL doesn't match computed sitemap path).

### Client Reports
Client-facing reports available from the Reports menu, all exportable as PDF or HTML (Word-compatible):

- **Executive Summary** — total pages, KKE distribution bar, auto-generated key findings, SME review status, breakdown by section
- **Content Inventory by Section** — per-group breakdown with KKE distribution, sample pages, notes counts
- **SME Review Status** — overall SME completion, per-Content Owner table (assigned/reviewed/%/approved/changed/unresolved), unresolved conflicts list
- **Redirect Map Report** — summary (total/kill/URL-changed), redirect chain warnings, full redirect tables grouped by type
- **Net New Content Brief** — list of sitemap nodes that need new content (have child pages assigned but no page of their own), with breadcrumb paths, computed URLs, and child page context
- **Migration Checklist** — combined summary: pages to retain, remove, update, redirect; URL changes; net new pages; full tables for evolve pages with notes, redirect map, and URL changes
- **Component Inventory** — summary stats (pages audited, distinct patterns, one-off count), full per-pattern table (category, complexity, page count, KKE breakdown), one-off pattern flags, and top co-occurring pattern pairs
- **Content Type Crosswalk** — one row per current content type → renders-as → target (new-CMS) content type → target spec → migration track, with page volume, KKE breakdown, and a "no crosswalk" flag for current types lacking a registry entry. For the CMS architect planning the type migration.
- **Migration Direction Brief** — a per-person worklist for the Writer, Builder, or Migrator role, grouped by spec, leading with the type-level reference (writer brief / build guidance / migration mapping) and listing the pages that follow it.

All reports use a shared infrastructure (`buildReportShell()`, `showReport()`, `exportReport()`) and can be exported as PDF or HTML from the progress modal.

### Export & Import
- **Export filtered rows** — save the current filtered/sorted view as a new .xlsx file (`Cmd+Shift+E`)
- **Export audit decisions** — export just the audit columns (KKE, Tags, Notes, Group, etc.) as CSV or JSON
- **Export redirect map** — generate a CSV of 301 redirects using destinations from the redirect editor
- **Import/merge** — merge audit decisions from another spreadsheet by URL matching (existing decisions are preserved)
  - **Multi-sheet support** — sheet picker when the import file contains multiple sheets
  - **Multi-column selection** — checkboxes to choose which columns to import, with "exists"/"new" badges indicating whether each column already exists in the current file
  - **Add new URLs** — "Add new URLs not in current file" checkbox (checked by default) adds rows from the import file that don't exist in your spreadsheet, with all available data copied over. Toast reports new rows added count.
- **Audit templates** — File > Save Audit Template exports the current audit configuration (visible fields, tag library, group library, sidebar columns, custom KKE states, column mapping, auto-advance, project settings) as a `.kke-template.json` file. File > Load Audit Template imports and applies all settings. Useful for teams doing multiple audits with consistent configuration.
- **Multi-auditor merge** — File > Merge Auditor Decisions opens another auditor's file and merges their KKE recommendations by URL matching. Empty cells are filled automatically. Conflicts (both auditors reviewed the same row differently) open a resolution dialog with per-row dropdowns and "Accept All Theirs" / "Keep All Mine" bulk actions.
- **Bulk SME export by content owner** — the SME Export modal has a "Split into separate files by Content Owner" checkbox. Exports each owner's rows as a separate xlsx file into a chosen folder, each with data validation dropdowns.
- **Changelog / Audit trail** — KKE, SME Decision, and Final KKE changes are logged automatically. The log is written to a `KKE_ChangeLog` sheet on save (Timestamp, Row, URL, Field, Old Value, New Value). The sheet accumulates entries across sessions and is hidden from the data sheet picker.

### Appearance (Light / Dark / System)
- **App Settings** (the ⚙ button, or File → App Settings) has an **Appearance** control at the top — a **System / Light / Dark** segmented toggle. Per-user preference; default **System**, which follows the macOS system appearance.
- Full dark theme with WCAG-compliant contrast
- **The embedded browser always renders crawled pages as designed** — the webview is never dark-mode-adapted, regardless of this setting or the OS appearance — so reviewing pages in the app stays faithful to how they actually look.

### Undo/Redo
- `Cmd+Z` / `Cmd+Shift+Z` for KKE changes
- 100-action stack per session, cleared on file reload

---

## Prerequisites

- [Node.js](https://nodejs.org) 18 or later
- npm (included with Node.js)
- **Miro export (optional)** — a Miro account. Nothing to install; connect once from **App Settings → Miro → Connect to Miro** and the sitemap's **Export to Miro** action is available from then on.

---

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode (DevTools open)
npm run dev

# Run normally
npm start

# Unit tests (no dependencies — uses Node's built-in test runner)
npm test
```

---

## Building for Distribution

```bash
# Universal .dmg (ARM + Intel — recommended)
npm run build

# Apple Silicon only
npm run build:arm

# Intel only
npm run build:intel
```

Build output is in `dist/`. The universal `.dmg` will be around 200–250 MB.

The app is signed and notarized (Apple Developer ID), so it opens normally — no right-click-to-open or security override needed.

### App Icon

Place your app icon at `assets/icon.icns` before building. If absent, Electron Builder uses a default icon.

---

## Spreadsheet Format

Any `.xlsx` with a header row. Optimized for Screaming Frog crawl exports.

**Every column is preserved.** The app reads the first sheet and keeps all of its columns verbatim — including custom extraction columns. It only *adds* the audit columns below (if missing); it never drops or renames what you brought in. This holds through the full lifecycle: open → convert to `.transmission` → Export Full Workbook returns every original column intact.

**URL column auto-detection** looks for (case-insensitive): `Address`, `URL`, `Link`, `Website`, `Href`, `URI`. If none match, a picker appears.

### Audit Columns

The app injects these columns if not already present:

| Column | Purpose |
|--------|---------|
| `KKE_Recommendation` | Keep, Kill, Evolve, Exclude, or custom state |
| `Tags` | Comma-separated labels |
| `Notes` | Free-text rationale |
| `Group` | Page group assignment |
| `Primary Tag` | Single primary categorization tag |
| `_Flagged` | Row bookmark (1 = flagged) |
| `_AssessedAt` | ISO timestamp of last assessment |
| `_AssessmentResult` | Result of last assessment |
| `Redirect_Destination` | Custom redirect URL for Kill/moved pages |
| `SME_Decision` | SME review decision: Approve, Change: Keep/Kill/Evolve/Exclude |
| `SME_Notes` | Free-text SME commentary |
| `Content_Owner` | Assigned content owner (free text) |
| `Final_KKE` | Resolved final decision (same values as KKE_Recommendation, includes Consolidate) |
| `Consolidate_Into` | Target page URL when KKE is Consolidate (the page absorbing this one's content) |
| `Published_Status` | Published / Unpublished / Draft / 404 — for CMS-export workflows where unpublished pages need to be flagged in bulk |
| `Page_Type` | **Content Type** (UI label) — broad page categorization (Landing page, PDP, Article, etc.); picks from a global library you can extend. Stored header name stays `Page_Type` for backward compatibility |
| `Content_Theme` | Single-select site-specific theme — picks from a per-project library |
| `GA_KKE_Recommendation` | Analytics-derived Keep/Kill/Evolve (populated by GA KKE feature) |
| `GA_Score` | Composite 0–1 score backing `GA_KKE_Recommendation` |
| `Content_Nature` | **Renders as** (UI label): Page / Content Object (= "Fragment (embeddable)") / Generated — how the row surfaces in the new CMS |
| `Migration_Track` | Scripted / Migrate Records / Configure / Manual Rebuild / Merge / Kill/Redirect |
| `Target_Content_Type` | The new-CMS content type this page maps to; auto-filled (blanks only) from the Content Type Registry crosswalk, overridable per row |
| `Suggested_KKE` | Computed unified suggestion (GA + Rubric; folded in from standalone rubric) |
| `Suggested_KKE_Sources` | JSON sidecar holding per-source breakdown for the suggestion badge |
| `Source_CMS_URL` | Admin/edit URL in the source CMS — populated manually; future phase auto-fills from CMS exports |
| `New_CMS_URL` | Admin/edit URL in the new CMS — populated manually; future phase auto-fills from migration results |
| `Design_Patterns` | Comma-separated design pattern names tagged on the page (populated via the PATTERNS audit bar cluster) |

`Redirect_Destination` accepts the literal string **`404`** as a sentinel meaning "let this URL return 404 — do not write a redirect rule." Distinct from blank (TBD). Click the **404** button in the Redirect Editor to toggle.

Column names are auto-detected from common variations. You can override the mapping in Preferences → Column mapping.

### Structural Sheets (hidden from data-sheet picker)

| Sheet | Purpose |
|-------|---------|
| `Sitemap` | Sitemap nodes (legacy name: `NavStructure`, still auto-detected and upgraded on open) |
| `KKE_Settings` | Project-level key/value store (includes `gaKkeConfig` as JSON) |
| `KKE_ChangeLog` | Audit trail of KKE / SME / Final KKE changes |
| `KKE_Glossary` | Tag & group descriptions (Type / Name / Notes, markdown) |
| `ContentTypeRegistry` | The current→target **crosswalk**: per current content type → default `Content_Nature` (renders-as), `Target_Content_Type`, `Target_Spec`, `Migration_Track`, and notes. Curated defaults seeded opt-in. Edit via Project → Content Type Registry… |
| `PatternLibrary` | **Target Spec Library** (UI label): per-project specs each target content type is built from. Per spec: `Kind` (Page Template / Content Model), Description, Build Guidance default, Writer Brief default, **Migration Mapping default**, Default Migration Track, **Fields** (schema, for Content Models), Notes. 12 curated defaults seeded opt-in. Edit via Project → Target Spec Library… |
| `DesignPatternLibrary` | Per-project design pattern catalog (Name, Category, Complexity, Description, Design System URL, Aliases, Notes). 57 curated defaults seeded opt-in. Edit via Project → Component Library… |

### Project Settings (KKE_Settings Sheet)

The app stores project-level settings in a `KKE_Settings` sheet (key/value pairs). This sheet travels with the file, so settings are shared with anyone who opens it. Currently stores:

| Key | Purpose |
|-----|---------|
| `clientName` | Client name (shown in progress dashboard and PDF export) |
| `projectName` | Project name (shown in progress dashboard and PDF export) |
| `siteDomain` | Target domain for redirect URLs and sitemap paths |
| `defaultRedirectUrl` | Default redirect destination for Kill pages |
| `customKkeStates` | Custom KKE statuses with labels and colors (JSON) |

### Sitemap Columns

When a Sitemap sheet is present (or loaded from another file):

**On data rows (Smeal Main, etc.):**

| Column | Purpose |
|--------|---------|
| `Sitemap_ID` | Unique sitemap node identifier (legacy name: `NavID`) |
| `Sitemap_Destination` | Breadcrumb path (legacy name: `Nav Destination`) |
| `Computed Path` | URL path segment |
| `Sitemap_SortID` | Sortable position value (legacy name: `Nav_SortID`) |

Older files carrying the legacy column names are upgraded automatically the
first time they're opened — see `renameLegacyNavColumns()` in `main.js`.

**On Sitemap sheet (per-node columns):**

| Column | Purpose |
|--------|---------|
| `Number` | Hierarchical node number (e.g. `2.1.4.3`) |
| `Label` | Display text |
| `Path` | URL slug for this segment |
| `SortID` | Padded sort key for ordering |
| `ParentNumber` | Parent node's Number (for tree assembly) |
| `Computed Path` | Full slug path from root |
| `Breadcrumb` | Display path joined with ` > ` |
| `ID` | Stable unique ID — what data rows' Sitemap_ID points at |
| `RefNodeID` | If set, this node is an alias to another node |
| `InMenu` | `Y` if the node should appear in navigation menus |
| `URL` | External URL — node renders as a link rather than a page |
| `Notes` | Per-node markdown notes; surfaces as hover tooltip in the tree |
| `Phase` | `Future` / `Stretch` / `Archived` for non-current-build nodes |

---

## Rubric Format

Each KKE status has a `.md` file in the rubrics folder:

```markdown
# Keep

## Field Rules
- Status Code is 200
- Indexability Status is Indexable
- Word Count > 500

## Content Rules
- Page provides comprehensive coverage of its topic
- Content is current and regularly maintained
```

### Field Rule Operators

| Operator | Example |
|----------|---------|
| `is` / `is not` | `Status Code is 200` |
| `is empty` / `is not empty` | `Meta Description 1 is empty` |
| `contains` / `not contains` | `Title 1 contains buy` |
| `starts with` / `ends with` | `Address starts with https://example.com/blog` |
| `>` `>=` `<` `<=` | `Word Count > 300` |
| `and` (compound) | `Status Code >= 300 and Status Code < 400` |

All comparisons are case-insensitive.

---

## App Structure

```
kke-audit-tool/
├── main.js          — Main process: file I/O, IPC, menus, rubrics, assessment
├── preload.js       — contextBridge (main ↔ renderer)
├── src/
│   ├── index.html   — DOM structure
│   ├── renderer.js  — All UI logic
│   └── styles.css   — All styling (CSS custom properties, dark mode)
├── rubrics/         — Default rubric files (shipped with build)
├── assets/
│   └── icon.icns    — App icon
└── package.json     — Dependencies + Electron Builder config
```

---

## Preferences storage

Per-user preferences stored in `~/Library/Application Support/Transmission/prefs.json` (macOS) or the platform equivalent on Windows/Linux:

- **Auto-advance** — move to next row after assigning KKE status
- **Show SME fields** / **Show Migration fields** — visibility of those audit-bar clusters
- **hideBlankMetadata** — ⊘/◉ toggle state for the metadata row
- **collapsedClusters** — per-cluster collapse state
- **Rubrics folder** — path to rubric .md files (per-file override available)
- **Claude API key** — for AI-powered content assessment
- **Miro connection** — *not* stored here. The access token lives in its own file in the app data directory, encrypted using the OS keychain, and is never exposed to the app's interface layer. The Miro export's own options travel with the project rather than the user.
- **Sidebar columns** — which columns appear in the row list
- **Column mapping** — override auto-detected audit column names per file
- **Window bounds, sidebar width, sort order, filter text, kkeFilter** — UI state persisted across sessions

Access via `Cmd+,` or **Transmission → Preferences…** (macOS) / **File → Preferences…** (Windows/Linux).
