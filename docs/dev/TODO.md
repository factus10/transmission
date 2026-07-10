# TODO — Transmission

## Features

### High Priority
- [ ] **Per-file tag library** — tag library is currently global; should be per-file or at least mergeable

### External Assessment Integration
Some spreadsheets arrive with KKE recommendations already generated outside the app — for example, `AI KKE` (from Screaming Frog's AI analysis). These are distinct from the app's own recommendation engines (the built-in Assess/Rubric feature, and the GA-driven `Suggested_KKE` system — see Done, below) and need to be surfaced so auditors can compare multiple recommendation sources.

- [ ] **Detect external assessment columns** — on file open, scan headers for known assessment column patterns (`AI KKE`, or user-configured names) and register them as external assessment sources. GA KKE shipped as its own dedicated system (computed columns + config dialog), not via a generic column-detection mechanism — this item is now specifically about `AI KKE` and other truly external, unrecognized columns
- [ ] **Display external assessments in field bar** — show an external KKE column's value as a read-only badge (e.g. "AI: Keep") in the audit bar. The `Suggested_KKE` badge already does this for the app's own GA + Rubric sources; this item is about surfacing genuinely external columns like `AI KKE` the same way
- [ ] **Assessment comparison filter** — filter to rows where an external assessment column (e.g. `AI KKE`) disagrees with the app's own recommendation. GA-vs-Rubric disagreement within the app's own `Suggested_KKE` engine already has a dedicated filter (`_suggested-disagree` / `_suggested-mismatch`) — this item is about arbitrary externally-supplied columns, not GA
- [ ] **Bulk accept external assessment** — action to copy an external assessment column's values into `KKE_Recommendation` for all (or filtered) rows, as a starting point that the auditor then refines. Multi-bar's current action set (`kke`, `published`, `page-type`, `content-theme`, `group`, `primary-tag`, `add-tag`, `assign-nav`) has no equivalent

### Medium Priority
- [ ] **Undo/redo for all edits** — currently only covers KKE changes; extend to tags, notes, nav assignments, group changes
- [ ] **CSV import for large files** — direct CSV support that bypasses SheetJS memory limits for very large crawls (10k+ rows)
- [ ] **Bulk notes + bulk tag remove/replace** — Multi-bar now supports bulk-appending one tag (`add-tag`), but there's still no bulk Notes editing, and tag editing is add-only (no bulk remove or replace)
- [ ] **Content rules in rubric editor** — show content rule pass/fail in the assessment panel (currently only field rules show individual ✓/✗ results)

### Low Priority / Nice to Have
- [ ] **Webview localhost support** — CSP adjustment to allow loading localhost URLs in production builds
- [ ] **Per-file visible fields** — visibleFields preference is global; could be per-file
- [ ] **Drag-and-drop file open** — drag a spreadsheet onto the app window to open it
- [ ] **Virtual scrolling in nav editor** — nav editor renders all nodes in DOM; could be slow for very large trees (500+ nodes)
- [ ] **Virtual scrolling in redirect editor** — same issue for large redirect lists
- [ ] **Export progress dashboard as image** — PNG export option alongside PDF
- [ ] **Keyboard nav in nav editor** — arrow keys to move between nodes, Enter to edit

## Bugs / Technical Debt
- [ ] **Single sheet initial read** — sheet picker exists for multi-sheet files, but `readWorkbook()` still defaults to the first data sheet for the initial read before the picker appears
- [ ] **Webview "render frame disposed" root cause** — currently suppressed via try/catch in main.js and renderer; investigate whether it can be prevented rather than swallowed

## Done (Recent)
- [x] **"Create sitemap from audit" tool** — Project → Create Sitemap from Audit… auto-generates a starter tree from every eligible page's URL (bucket depth 1–4, optional include-Kill/Exclude/unreviewed), built as a thin layer over `findOrCreateBucketNode()` + the bulk-assign primitives — merges by matching section labels rather than ever replacing an existing tree, so it's safe to re-run
- [x] **Hub node → content workflow** — a net-new node's editor shows a banner pointing at the existing Page Status field (no duplicate control needed) plus a **Create Page** button (`promoteHubNodeToRow()`) that creates a real Keep row, tagged `net-new`, assigned to the node — same `state.rows`/`state.editedRows` push pattern as the existing "New Page" button. No separate "promoted" flag needed: once a node has a direct page, the existing hub/net-new detection stops flagging it everywhere (tree, reports, exports) automatically
- [x] **SME Review recognizes any decision value** — bare status values with no `Change:` prefix (SMEs don't reliably follow that convention) are now recognized everywhere SME_Decision is read, not just the documented `Accept` / `Change: <status>` forms, via a single shared `parseSmeDecision()` parser. The override value is never checked against the project's configured KKE states — an SME's own wording carries through into `Final_KKE` as-is; the resolve dialog and Table View's inline editor both keep an out-of-vocabulary value visible and selectable rather than losing it
- [x] **Bulk sitemap assignment** — Multi-bar's **Assign to Sitemap…** action: pick an existing node or create a new bucket (top-level or nested), then bulk-place many selected/filtered pages under it in one action, one child node per page, slug/label auto-derived from URL/title (`openBulkNavAssignDialog()`, `createBucketNode()`, `bulkAssignRowsToBucket()`, all renderer.js). Already-placed rows are skipped
- [x] **App renaming** — renamed "KKE Audit Tool" → **Transmission**; app ID `com.jakala.transmission` (package.json); KKE methodology and all `KKE_*` columns/sheets unchanged for file compatibility (shipped 2026-06-03, v2.2.0)
- [x] **Code signing** — signed with Developer ID (Team D4YLNBMZ79) and notarized (`hardenedRuntime` + `notarize.teamId` in package.json's `build` config); verified via successful `notarytool submit --wait` + `stapler staple` on recent builds
- [x] **Traffic data integration (GA KKE)** — `GA_KKE_Recommendation`/`GA_Score` computed columns derived from GA4 metrics (sessions, engagement rate, avg session duration, views/session), configured via Project Settings → Suggestions → `openGaKkeConfigDialog()`; folded into the unified `Suggested_KKE` orchestrator alongside the Rubric source with weighted voting + disagreement detection
- [x] **Explicit SME conflict filter** — sidebar `_sme-conflicts` filter ("SME Conflicts") shows rows where `SME_Decision` starts with `Change:`; blank SME Decision isn't flagged (implicit agreement)
- [x] **SME conflict resolution actions** — `openSmeResolveDialog()` offers Accept All (Final_KKE = SME's suggestion), Keep Original (Final_KKE = KKE_Recommendation), and per-row Revise via inline select
- [x] **Use external assessment columns as rubric inputs** — the field-rule engine reads any column by exact header name, so a rule like `AI KKE is Kill` already works with zero extra plumbing once such a column exists in the sheet
- [x] **Consolidation flag** — two-column target model (`_ConsolidateTargetId` stable identity + derived `Consolidate_Into` display), Consolidation Candidates workflow flags every nav node with 2+ assigned pages, proactive duplicate-destination guard, "Consolidated-In URL(s)" column in the Migration Tracker export
- [x] **Export migration tracker** — multi-sheet export (Sitemap Plan / Source Pages / Redirects / Archive) with builder/writer/migrator assignments, page status, hub "Net New" flag, and consolidation data; File → Export Migration Tracker…
- [x] **Nav editor search** — superseded by Cmd+F global search when the Sitemap is open (`navSearchMatches()`), matching label/breadcrumb/path/URL/notes and scrolling to the match
- [x] **Recent files list** — File → Open Recent submenu of the 10 most recently opened files, with a Clear option
- [x] **Column sorting** — Table View sorts by any column (click header to cycle asc → desc → none), with per-column filters
- [x] **Formula loss on save documented** — called out as a "Good to know" callout in the User Guide, explaining formulas are replaced with cached values on save (SheetJS limitation)
- [x] **SME columns** — `SME Decision`, `SME Notes`, `Content Owner`, `Final_KKE` auto-detected via candidates list and injected when missing
- [x] **Export for SME review** — filtered xlsx export with data-validation dropdowns via ExcelJS; strips internal columns
- [x] **SME import IPC flow** — two-step `import-audit-merge-open` / `import-audit-merge-read-sheet` with sheet picker
- [x] **SME review progress dashboard** — SME Reviewed and Final KKE Resolved counts with percentages
- [x] **Redirect validation** — `checkLinks` handler validates destination URLs
- [x] Navigation editor — full-panel tree editor with inline editing, drag-and-drop, add/delete
- [x] Redirect editor — full-panel redirect map with per-row destinations and nav picker
- [x] Create nav structure from scratch — Tree button works even without existing NavStructure sheet
- [x] Default redirect destination — configurable fallback, persisted in KKE_Settings sheet
- [x] Project settings (KKE_Settings sheet) — client name, project name, default redirect URL
- [x] Progress dashboard PDF export — branded report with client/project fields
- [x] Help as separate window — non-blocking, reusable
- [x] Menu restructuring — Reports menu, Settings in File menu with Cmd+,
- [x] Comprehensive rubrics — field rules using all relevant Screaming Frog columns
- [x] Custom KKE states in progress dashboard — previously only showed built-in four
