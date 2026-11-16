# Transmission — Handoff Document
**Date:** June 2026  
**Purpose:** End-to-end UI/UX audit and feature completeness audit  
**Recommended model:** Claude Opus (latest)

---

## What This Is

A macOS Electron desktop app for auditing website content. The primary workflow: load a Screaming Frog crawl export (`.xlsx`), review each page in an embedded browser, and record Keep / Kill / Evolve / Consolidate / Exclude decisions. It has grown significantly — it now also handles migration planning (nav tree, redirect mapping, CMS delivery metadata), design component inventory, reporting, and SME review workflows.

**Version:** 2.0.0 "How Soon Is Now?"  
**Stack:** Electron + plain JS (no React/Vue), SheetJS, ExcelJS, D3  
**Platform:** macOS, Apple Silicon (arm64) and Intel (x64), as separate builds

---

## File Map

```
main.js          (2,945 lines) — Main process: file I/O, IPC, menus, prefs
preload.js                     — contextBridge: exposes window.electronAPI
src/
  index.html     (1,050 lines) — Full DOM structure
  renderer.js   (17,802 lines) — All UI logic, state, event handlers
  styles.css     (4,860 lines) — All styling via CSS custom properties
  help.html                   — Separate help window
assets/icon.icns
```

**Critical rule:** renderer.js has no Node API access. Everything goes through `window.electronAPI.*` (defined in preload.js, handled in main.js). Any new main↔renderer channel requires changes to all three files.

---

## Architecture: State & Data Flow

All UI state lives in a single `state` object in renderer.js. Key fields:

```js
state.rows          // original rows from xlsx — NEVER mutated
state.editedRows    // deep-cloned working copy — all edits go here
state.filteredRows  // [{row, origIndex}] — what the sidebar shows
state.selectedIndex // origIndex of the currently selected row
state.navTree       // hierarchical nav nodes [{label, children, ...}]
state.navNodes      // flat array of all nav nodes
state.projectSettings // persisted to KKE_Settings sheet in xlsx
```

**Two storage tiers:**
- **App prefs** (`prefs.json` in userData): `tagLibrary`, `pageTypeLibrary`, `designPatternLibrary` (Component Library), `visibleFields`, `showSmeFields`, `showMigrationFields`, `showDesignPatterns`, sidebar settings
- **Per-project** (xlsx structural sheets): `patternLibrary` (Page Template Library), `contentTypeRegistry`, `navTree`, `projectSettings` (client name, saved filters, etc.)

---

## The Full Feature Set (as of June 2026)

### Core audit
- KKE decision buttons: Keep / Kill / Evolve / Consolidate / Exclude + custom states
- Tags (chip input, CSV), Notes (popover), Group, Primary Tag
- Undo/redo (Cmd+Z / Cmd+Shift+Z, 100-action stack)
- Auto-save (2s debounce), dirty indicator
- Multi-select: Cmd+click / Shift+click, bulk KKE assignment via Multi-bar

### Sidebar
- Virtual scrolling (~4k+ rows)
- Text search with **scope selector** (All fields / URL / Title)
- KKE filter (multi-checkbox dropdown), Group filter
- **Field filter** (arbitrary column: contains, equals, is-blank, etc.)
- Special sidebar filters: `_suggested-disagree`, `_suggested-mismatch`, `_consolidate-dead-target`, `_consolidate-needs-target`
- Saved filter combos (name + restore)
- Row sort (URL asc/desc), row color coding by KKE
- Extra KKE badge columns configurable
- **Non-200 triage** (auto-offered on file open when non-200 rows exist)
- **Row flagging** (🚩 per-row, filterable)

### Views (persistent tab strip at top of window)
1. **Audit** (Cmd+1) — sidebar + browser + audit bar
2. **Table** (Cmd+T) — full-width spreadsheet, inline editing, per-column filters, virtual scroll
3. **Navigation Tree** (Cmd+Shift+T) — nav editor
4. **Redirects** (Cmd+Shift+R) — redirect editor

### Audit bar clusters (collapsible, with summary readout when collapsed)
Each cluster has a colored pill label on the left edge:
- **DECIDE** (blue) — KKE buttons, Suggested_KKE badge, Notes, Nav assignment, SME/Final when visible
- **CLASSIFY** (slate) — Page Type, Theme, Published Status, Group, Primary Tag, Tags
- **COMPONENTS** (violet, hidden by default) — UI component chip input (the `Design_Patterns` column)
- **MIGRATE** (amber, hidden by default) — Content Nature, Migration Track + ghost suggestion
- **CMS** (green) — Source CMS URL / New CMS URL edit+open links

Quick-toggle chips in the field-bar-top: `SME`, `Migrate`, `Components`

### Navigation editor
- Full tree with drag-and-drop reorder/reparent, inline label/slug editing
- Each node: label, slug, computed path, sort ID, In Menu toggle, external URL, phase, notes
- Per-node **build metadata**: Build Pattern (from Page Template Library), Page Status, Build Assignee, Write Assignee, Build Guidance (markdown), Writer Brief (markdown)
- Visual sitemap: box-style D3 tree, left-aligned indented layout (DFS), L-shaped connectors, Build Pattern color coding, solid/dashed border = in menu / not, stacked shadow = hidden children, legend
- Stats bar, depth filter, phase filter, build filter
- Consolidation Candidates workflow
- Duplicate slug detection, duplicate NavID detection
- Clone branch, visual sitemap, nav coverage report

### Redirect editor
- All Kill + URL-changed pages with editable destination
- Find/Replace bar, status filter, sortable columns
- Nav picker (600px, hierarchical) for each destination
- **Re-derive from nav** button (`resyncNavBasedRedirects`) to re-sync all nav-based redirects on demand
- 404 sentinel: `Redirect_Destination = "404"` = intentional deindex

### Consolidate flow
- Consolidate picks a target page from the full inventory
- `Consolidate_Into` stores the computed URL (new site path) if target has a nav assignment; falls back to inventory URL
- Auto-updates when target gains a nav assignment
- Pre-save sweep (`resolveConsolidateIntoUrls`) resolves any stale inventory URLs
- **Dead target warning**: amber dot on Consolidate button + `_consolidate-dead-target` filter when target is Kill/Exclude

### Migration classification (Phase 1)
- `Content_Nature`: Page / Content Object (Record) / Fragment / Generated
- `Migration_Track`: Scripted / Migrate Records / Configure / Manual Rebuild / Merge / Kill/Redirect
- Ghost suggestion derived from KKE + Content_Nature (or ContentTypeRegistry fallback)
- ContentTypeRegistry: per-project Page_Type → { Default_Content_Nature, Default_Migration_Track }

### Suggested KKE engine (Phase 1)
- Unified badge combining GA analytics + Rubric assessment
- Per-source weights configurable in Project Settings → Suggestions tab
- Disagreement indicator (⚠) when sources conflict
- `Suggested_KKE_Sources` JSON sidecar column for full breakdown

### SME workflow
- Export for SME review (ExcelJS with data validation dropdowns)
- Import SME decisions back by URL matching
- Resolve conflicts modal (per-row Final_KKE, bulk accept/keep)

### Reporting
- **Executive Summary** — KKE distribution, tags, progress
- **Content Inventory by Section** — grouped by nav section
- **SME Review Status** — approval rates, disagreements
- **Redirect Map Report** — Kill redirects, URL changes, intentional 404s
- **Net New Content Brief** — nav nodes with no source pages
- **Migration Checklist** — structured handoff document
- **Navigation IA** — nav tree with redirect counts, page counts, node states
- **Component Inventory** (new) — per-component frequency, one-off flag, co-occurrence pairs

### Libraries and project data
- **Page Template Library** (Project menu) — per-project CMS page templates for nav nodes; 12 built-in defaults
- **Component Library** (Project menu) — app-level UI component vocabulary; 57 built-in defaults across 12 categories (Hero, Card, Collection, Navigation, People, Content, Social Proof, Stats, CTA, Form, Media, Feed, Structural)
- **Content Type Registry** — per-project Page_Type → migration defaults
- **Tag & Group Glossary** — markdown notes per tag/group
- **Project Settings** — 5 tabs: Identity, KKE States, Suggestions, Migration, Saved Filters

### Migration Tracker Export
- Multi-sheet xlsx: Nav Plan, Source Pages, Redirects, Archive
- Nav Plan: one row per nav node with build metadata, source page count, readiness info
- Source Pages: audit rows joined to nav assignment with KKE and migration metadata

---

## Known Rough Edges / Things to Audit

These are areas worth scrutiny in the UI/UX review:

1. **"Page Template Library" vs "Component Library"** — recently renamed from "Pattern Library" and "Design Pattern Library". Verify terminology is consistent across all menus, modal headers, tooltips, help text, and CLAUDE.md.

2. **Component Library seeding** — seeds 57 defaults from `DEFAULT_DESIGN_PATTERN_LIBRARY` via async IPC on first run. The library is empty for a brief moment. Verify the UX handles this gracefully (the dropdown shouldn't show an empty state permanently).

3. **Audit bar cluster ordering** — DECIDE → CLASSIFY → COMPONENTS → MIGRATE → CMS. COMPONENTS is hidden by default. Consider whether the ordering makes sense for the workflow: users typically do DECIDE first, then CLASSIFY, then (optionally) COMPONENTS and MIGRATE. Does COMPONENTS before MIGRATE feel right?

4. **Quick-toggle chips** (SME / Migrate / Components) — these live in the field-bar-top, above the audit bar. Are they discoverable? Do new users understand what they do? The only affordance is small chips with text labels.

5. **Cluster collapse + summary readouts** — each cluster shows a one-line summary when collapsed. Verify the summaries are meaningful for all clusters (COMPONENTS shows first 2 names + overflow count, which may be too dense).

6. **Consolidate flow complexity** — the Consolidate button, target picker, dead-target warning, and pre-save sweep are all relatively new. The interaction model (pick a target from a list, watch it update when the target moves in the nav tree) may not be obvious.

7. **Navigation editor density** — the nav editor packs a lot: inline editing, drag-and-drop, build indicators, status pills, assignee chips, page counts, phase badges, fold state, filter dropdowns, stats bar, toolbar buttons. Is anything overwhelming or underused?

8. **Visual sitemap usability** — the indented tree layout is a recent redesign. Worth checking whether it communicates hierarchy clearly, especially for deep trees.

9. **Table View** — has its own independent sort/filter. Is it obvious that Table View filters are separate from sidebar filters? What happens to the Table View selection when you switch back to Audit view?

10. **Report discovery** — reports are split between the Reports menu (narrative reports) and Migration menu (delivery-phase outputs). Is that split intuitive?

11. **Progress Dashboard (Cmd+P)** — doubles as the report viewer and the sitemap viewer. Is this modal re-use confusing?

12. **App Settings vs Project Settings** — two different settings locations. App Settings (⚙ in field-bar-top) = per-user prefs. Project Settings (Project menu) = per-project data. Do users understand the distinction?

13. **Save behavior** — the file auto-saves after 2s of inactivity (dirty indicator shows unsaved state). There's also File → Save (Cmd+S). Is the auto-save vs. explicit save model clear?

14. **Undo/redo scope** — Undo only covers KKE changes (100-action stack). Other changes (tags, notes, nav edits) are NOT undoable. Is this documented/communicated?

15. **Non-200 triage dialog** — auto-offered on file open when non-200 rows are present. Could be disruptive if it fires every time a file is opened. Does it have a "don't show again" / "I'll handle this manually" option?

---

## Key Conventions for Working in This Codebase

- `$('element-id')` is the shorthand for `document.getElementById`
- `els` object caches all frequently-accessed DOM elements at init time
- `state.editedRows[origIndex]` is the canonical working copy; `state.rows[origIndex]` is read-only original
- `setDirty(true)` marks unsaved changes + triggers auto-save timer
- `logChange(origIndex, field, oldVal, newVal)` adds to the audit trail (written to KKE_ChangeLog sheet on save)
- `showToast(message, type)` for non-blocking user feedback
- `window.prompt()` is blocked in Electron — the app uses `showPrompt(title, placeholder, default)` instead
- D3 sitemap: built via string concatenation (not template literals) because D3 source contains backticks
- New IPC channels always need changes in **all three**: `main.js`, `preload.js`, `renderer.js`

---

## Files to Read for Context

| File | Why |
|------|-----|
| `UI_STANDARDS.md` | **The interaction/presentation contract** — dialog system, button/footer/close conventions, tokens, naming, pre-merge checklist. Read before building any UI. |
| `CLAUDE.md` | Technical reference — full architecture, state object, IPC table, all audit columns, structural sheets, conventions |
| `README.md` | Feature list + quick setup guide |
| `USER_GUIDE.md` | Full user manual — good for understanding intended UX flows |
| `src/help.html` | Concise in-app help — reflects what users actually see |
| `src/index.html` | Full DOM structure — read this to understand what elements exist before editing renderer.js |

---

## Suggested Audit Approach

### Phase 1 — Feature completeness audit
Walk through every feature listed in this document and CLAUDE.md and check:
- Is it actually implemented in the code?
- Does it have a menu item / keyboard shortcut / discoverable entry point?
- Is it documented consistently in README, USER_GUIDE, help.html, and CLAUDE.md?
- Are there any half-finished states (e.g., functions that exist but aren't wired to a UI trigger)?

### Phase 2 — UI/UX audit
Focus areas:
- **Terminology consistency** — does the same thing have the same name everywhere? (menus, modal headers, column names, help text, tooltips)
- **Discoverability** — can a new user find every major feature without reading the manual?
- **Workflow coherence** — does the left-to-right / top-to-bottom flow of the audit bar match how people actually do audits?
- **Visual hierarchy** — are the most important controls most prominent?
- **Empty states** — what does the app look like before a file is opened? Before patterns are tagged? Before a nav tree exists?
- **Error handling** — what happens when an IPC call fails, a file can't be read, a URL doesn't load?

### Phase 3 — Gap analysis
What would a content strategist / IA / UX team need that this app doesn't yet provide?
Compare against the CLAUDE.md feature list and USER_GUIDE to identify anything planned but not yet built.

---

## Recent Changes (This Session — June 2026)

Everything listed here was added or changed in the most recent development session:

- **Visual sitemap redesign** — replaced D3 tidy tree with custom indented-list layout; L-shaped elbow connectors; Build Pattern color coding; solid/dashed borders for InMenu; stacked shadow boxes for hidden children; color legend
- **Component Library** (was "Design Pattern Library") — new `Design_Patterns` column; `.cluster-components` audit bar cluster; 57-entry default library; `openDesignPatternLibraryEditor()`; `reportDesignPatterns()` (Component Inventory report)
- **Storage bug fix** — `pageTypeLibrary` and `designPatternLibrary` were not returned by `get-prefs`, so user additions were lost on restart. Fixed by adding both to `get-prefs`.
- **Component Library storage** — moved from per-project xlsx to app-level prefs (like `tagLibrary`); auto-seeds 57 defaults on first run
- **Rename** — "Pattern Library" → "Page Template Library"; "Design Pattern Library" → "Component Library"; cluster pill "Patterns" → "Components"
- **Consolidate improvements** — `effectiveConsolidateUrl()` stores computed URL; dead-target amber warning; `_consolidate-dead-target` sidebar filter; `resolveConsolidateIntoUrls()` pre-save sweep
- **Search scope selector** — URL / Title / All fields on sidebar search
- **Documentation** — README, USER_GUIDE, help.html, CLAUDE.md all updated

---

*This document was prepared to enable a clean handoff to a new session. The full technical specification lives in `CLAUDE.md`. The user manual lives in `USER_GUIDE.md`.*
