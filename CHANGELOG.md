# Changelog

All notable changes to Transmission are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
major-version codenames drawn from The Smiths.

## [2.5.3] — "How Soon Is Now?"

### Added
- **Duplicate Consolidate-destination guard.** Setting a page to Keep/Evolve
  when another page already targets the same Sitemap node now offers to
  Consolidate it into that page instead — catching the mistake the moment it
  happens, as a proactive complement to the bulk Consolidation Candidates
  workflow.
- **Check for Updates.** Transmission checks for a newer version at startup
  and via **Help → Check for Updates…**, with a "What's New" changelog viewer
  and a link to download the latest release.
- **Duplicate menu.** Clone a menu — name, placement, description, and its
  full item tree — as a starting point for an alternate variant (e.g.
  testing a different mega-menu structure) without touching the original.
  The copy is selected immediately and pre-picked in the Export dialog's
  "just this menu" scope.

### Changed
- **Nav → Sitemap rename finished** across the UI, exports, and docs — the
  remaining `Nav_*` audit/export columns are renamed to `Sitemap_*` for
  clients (e.g. `Sitemap_Destination`, `Sitemap_ID`, `Sitemap_SortID`).

## [2.5.2] — "How Soon Is Now?"

### Added
- **Visual Sitemap site-root toggle** — a "Show a site root box in the Visual
  Sitemap" setting (Project Settings → Identity) suppresses the synthetic
  site-root box; when off, the sitemap's own top-level node(s) become the
  root(s) instead, so single- and multi-section sites both lay out cleanly.

## [2.5.1] — "How Soon Is Now?"

### Added
- **`Page_Breadcrumb` audit column** — the derived on-page breadcrumb for a
  row's assigned sitemap node, honoring the breadcrumb-parent override axis
  and the Home-label prefix. Distinct from `Sitemap_Destination` (the
  physical IA label chain). Read-only; shown in Table View by default.

## [2.5.0] — "How Soon Is Now?"

A "content cockpit" release: the Visual Sitemap is rewritten from the ground
up as a self-contained engine, consolidation gets a sturdier data model, and
the audit bar gains direct sitemap assignment and dark mode.

### Added
- **Visual Sitemap rewritten as a self-contained engine.** The
  D3-in-a-hidden-window renderer is retired; one portable engine
  (`src/sitemap-template.js`) now powers the in-app view (via an Electron
  `<webview>`), the client-shareable HTML export, and the print/PDF export.
  Threshold-based per-node horizontal/vertical layout, a color-rule engine,
  and a Settings panel (Layout / Colors / Legend) replace the old renderer.
  The `d3` and `mermaid` dependencies are fully removed.
- **Two-column Consolidate target model** — the consolidation target is now
  stored as a stable page identity (`_ConsolidateTargetId`) plus a derived,
  always-fresh relative-path display (`Consolidate_Into`), so the link
  survives the target page later being placed in the nav tree or gaining a
  URL override.
- Offer to remove an orphaned nav node when its last assigned page is Killed
  or Consolidated away.
- **Dark mode** for the app chrome.

### Changed
- The Sitemap is reframed as **content organization**, decoupled from URL and
  breadcrumb; pages can now be assigned to a sitemap node directly from the
  audit bar.

## [2.4.1] — "How Soon Is Now?"

### Changed
- **The nav "IA Report" became the Menu Report.** The polished section-card +
  tree report is now fed by the independent **menus** rather than `inMenu`-filtered
  nav nodes — reached via **Menus → Report** and **Reports → Menu Report…** (the
  old nav-editor IA-Report button was removed). One card per menu with its item
  hierarchy, page-count badges on page references, `↗` on external links, `≡` on
  headers, and a red **missing** badge on broken references. PDF / HTML export.
  This retires the lingering `inMenu`-vs-report question.

## [2.4.0] — "How Soon Is Now?"

A visualization-focused release: the sitemaps gain layouts, palettes, and
collapse, and the Nav Tree sitemap is reframed as the content-IA "Visual Sitemap."

### Added
- **Sitemap layouts** (both sitemaps) — **Outline**, **Top-down tree**, and
  **Mega columns** (sections fan into side-by-side columns, items stacked beneath).
- **Color by + Palette** — color the IA sitemap by **Section / Build pattern /
  Page status / KKE** (menus by **Item kind / Section**), in a **Meaningful**,
  **Client brand**, or **Mono** palette. A client-brand palette editor lives in
  **Project Settings → Identity** and is shared across both sitemaps.
- **Collapse + Levels** — a per-node **Collapse** flag summarizes a subtree as a
  single box with a "has more underneath" stack, and a **Levels** selector caps
  the visible depth — built for large (1000+ node) trees.
- **Seed from content tree** (Menus) reworked into a pick-a-branch + depth dialog.

### Changed
- The **Nav Tree → Sitemap** is now the **Visual Sitemap** of the content IA:
  retitled, the "Menu items only" toggle removed, and the border now encodes
  build phase (solid = current build, dashed = phased).
- The legacy per-node **In-menu** controls (checkbox, Set/Clear Menu, node-editor
  toggle) are **repurposed to Collapse**. `inMenu` data still round-trips.

### Fixed
- Per-menu sitemap rendered every card with the last menu's tree (concurrent
  renders clobbered a shared temp file) — temp files are now unique per call.

## [2.3.0] — "How Soon Is Now?"

Decouples the navigation tree's four overloaded jobs into independent axes and
builds out an independent menu subsystem.

### Added
- **URL override** (`Url_Path`) — a nav node can publish at an address independent
  of its place in the menu; the override re-roots its sub-pages too. Containment and
  URL become separate axes.
- **Breadcrumb axis** (`Breadcrumb_Parent`) — set an arbitrary on-page breadcrumb top
  independent of both the tree and the URL: mark a node a breadcrumb root or re-root
  it onto any node; sub-pages inherit. Optional project "Home" prefix + advisory
  max-depth (Project Settings → Identity). The rendered page breadcrumb is exported
  in the Migration Tracker Nav Plan, the Nav Tree column-picker export, and the menu
  export.
- **Menus** — a new full-panel view (Cmd+Shift+M) for building independent navigation
  structures that reference content pages: multiple arbitrary menus (drag to reorder),
  three item kinds (page / link / header, switchable in place), drag-and-drop nesting,
  per-menu placement (controlled vocab) + description, and seed-from-content-tree.
- **CMS-agnostic menu export** — a neutral structured deliverable (Excel `Menus` sheet
  or nested JSON) any CMS import maps from; page refs resolve to target URLs.
- **Menu broken-reference check** — flags menu items pointing at deleted pages, with
  re-pick / remove.
- **Per-menu sitemap** — each menu rendered as a box-tree (items colored by kind), with
  zoom/pan and per-menu SVG download.

### Changed
- **Nav node editor** reorganized into labeled, color-pilled sections (Context /
  Identity / Addressing & breadcrumb / Notes / Build / Write / Migrate) for scannability.
- **Unified drag-and-drop** — the nav tree and menu item tree now share one engine and
  one clean indicator style.

### Removed
- The vestigial sidebar-row → nav-node drag-assign (unreachable since the Nav Tree view
  hides the sidebar). Assign pages via the audit-bar **Nav** button.

## [2.2.0] — "How Soon Is Now?"

### Changed
- **Renamed** the product from "KKE Audit Tool" to **Transmission** (a Joy Division
  song; version codenames remain Smiths titles). The **KKE** methodology and all
  `KKE_*` columns/sheets are unchanged, so existing files stay compatible. App ID is
  now `io.github.factus10.transmission`; a one-time migration carries old prefs to the new
  user-data folder.
- **Content Type ↔ Registry sync.** The Content Type Registry editor now surfaces
  in-use content types that lack a crosswalk (split-aware), with a "Show all
  pick-list types" toggle; adding a type from the audit-bar dropdown seeds a registry
  stub. Untouched stubs aren't persisted.
- **Documentation re-architecture.** `USER_GUIDE.md` rebuilt as a friendly,
  lifecycle-spined manual; a set of terse `walkthroughs/` added as standalone
  checklists; `help.html` restructured to match. All docs moved under `docs/`.

### Added
- **Report template engine** (Markdown + Mustache) for the Migration Direction Brief.
- **Migration Direction Brief** report covering three roles — Writer, Builder, and
  **Migrator** — grouped by target spec.
- **Pre-Handoff Check**, **Content Type Crosswalk** report, and the needs-placement
  filter.

### Build
- Universal macOS build is **signed and notarized** (stapled `.dmg` and `.zip`).
