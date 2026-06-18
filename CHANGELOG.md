# Changelog

All notable changes to Transmission are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
major-version codenames drawn from The Smiths.

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
