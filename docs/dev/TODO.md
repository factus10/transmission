# TODO — Transmission

## Features

### High Priority
- [ ] **App renaming** — pick a name (Winnow, Triage, Thresher, etc.) and update app ID, window title, menus, docs, package.json
- [ ] **Code signing** — sign and notarize the app so recipients don't need to right-click > Open
- [ ] **Traffic data integration** — surface the `GA KKE` recommendation (derived from Google Analytics data) alongside the auditor's own KKE recommendation and AI assessment. The GA KKE calculation methodology is TBD. For now, treat it as an external assessment column to detect and display
- [ ] **Per-file tag library** — tag library is currently global; should be per-file or at least mergeable

### SME Review Workflow
The audit workflow involves sending a subset of pages to client SMEs for review. They confirm or override our KKE recommendations, add their own notes, and identify the content owner. The spreadsheet round-trips: we export → SME reviews in Excel → we import their decisions back.

**Observed SME Decision format** (from Smeal): `Accept` when the SME agrees with our recommendation, or `Change: <status>` when they override (e.g. `Change: Kill`, `Change: Evolve`). Rationale goes in `SME Notes`. `Content Owner/SME` identifies the reviewer. Most rows come back without an SME Decision (not yet reviewed). Consider also supporting bare status values (`Keep`, `Kill`, `Evolve`) in addition to the `Change:` prefix.

- [ ] **Verify SME import parsing** — `import-audit-merge-open` / `import-audit-merge-read-sheet` IPC flow is wired, but confirm that `Change: <status>` and bare status values (`Kill`, `Evolve`) are both parsed correctly when merging SME responses
- [ ] **Explicit SME Differs filter** — conflict detection exists, but add a named filter option ("SME Differs") that shows only rows where the parsed SME Decision status differs from KKE_Recommendation. Blank SME Decision = implicit agreement, don't flag
- [ ] **SME conflict resolution actions** — audit bar already shows KKE and SME Decision side by side. Add explicit actions: Accept SME (overwrite KKE_Recommendation with SME's status), Keep Ours (retain our recommendation, note the disagreement), or Revise (set a new value). Track resolution in a column (e.g. `_SME_Resolved`)

### External Assessment Integration
Some spreadsheets arrive with KKE recommendations already generated outside the app — for example, `AI KKE` (from Screaming Frog's AI analysis) or `GA KKE` (derived from Google Analytics traffic data). These are distinct from the app's built-in Assess feature and need to be surfaced so auditors can compare multiple recommendation sources.

- [ ] **Detect external assessment columns** — on file open, scan headers for known assessment column patterns (`AI KKE`, `GA KKE`, or user-configured names). Register them as "external assessment sources" so the app knows they exist
- [ ] **Display external assessments in field bar** — show external KKE values alongside the app's own `KKE_Recommendation` and `_AssessmentResult` in the audit bar (e.g. as read-only badges: "AI: Keep", "GA: Kill"). Auditor sees all signals at a glance
- [ ] **Assessment comparison filter** — filter to rows where external assessments disagree with each other or with the app's recommendation (e.g. "AI ≠ GA", "AI ≠ KKE"). Helps auditors focus on pages where signals conflict
- [ ] **Use external assessments as rubric inputs** — allow field rules to reference external assessment columns (e.g. `AI KKE = Kill` as a signal in the Kill rubric). This lets the built-in rubric engine incorporate external AI/GA signals
- [ ] **Bulk accept external assessment** — action to copy an external assessment column's values into `KKE_Recommendation` for all (or filtered) rows, as a starting point that the auditor then refines

### Navigation & Migration Tracking
- [ ] **Hub node content tracking** — hub nodes (⚑) represent new IA pages that need content. Add a workflow for the content strategist to review hub nodes, mark them as "content needed", and eventually add them as rows in the spreadsheet so they appear in the migration tracker export
- [ ] **Consolidation flag** — when 2+ pages are assigned to the same nav node, flag them as candidates for content consolidation. Show a visual indicator in the nav editor (e.g. count badge in a different color) and include a "Consolidate" column or note in the migration tracker export so the content team knows these pages need to be merged
- [ ] **Export migration tracker** — export a spreadsheet that includes both existing pages (with their redirect/nav mapping), hub nodes flagged as new pages needing content, and consolidation flags for nodes with multiple source pages. Include columns for content owner, status, and due date

### Medium Priority
- [ ] **Undo/redo for all edits** — currently only covers KKE changes; extend to tags, notes, nav assignments, group changes
- [ ] **CSV import for large files** — direct CSV support that bypasses SheetJS memory limits for very large crawls (10k+ rows)
- [ ] **Bulk tag/note editing** — edit tags or notes for multiple selected rows at once (currently only bulk KKE is supported)
- [ ] **Verify nav editor search** — `_navTreeFilter` state and search placeholder exist; confirm filter-by-label/path actually works end-to-end and polish if incomplete
- [ ] **Content rules in rubric editor** — show content rule pass/fail in the assessment panel (currently only field rules show individual results)

### Low Priority / Nice to Have
- [ ] **Webview localhost support** — CSP adjustment to allow loading localhost URLs in production builds
- [ ] **Per-file visible fields** — visibleFields preference is global; could be per-file
- [ ] **Drag-and-drop file open** — drag a spreadsheet onto the app window to open it
- [ ] **Recent files list** — File menu shows recently opened files
- [ ] **Column sorting** — sort by any column, not just the URL column
- [ ] **Virtual scrolling in nav editor** — nav editor renders all nodes in DOM; could be slow for very large trees (500+ nodes)
- [ ] **Virtual scrolling in redirect editor** — same issue for large redirect lists
- [ ] **Export progress dashboard as image** — PNG export option alongside PDF
- [ ] **Keyboard nav in nav editor** — arrow keys to move between nodes, Enter to edit

## Bugs / Technical Debt
- [ ] **Single sheet initial read** — sheet picker exists for multi-sheet files, but `readWorkbook()` still defaults to `SheetNames[0]` for the initial read before the picker appears
- [ ] **Formula loss on save** — all formulas are replaced with cached values on save (SheetJS limitation); document this more prominently in USER_GUIDE / help
- [ ] **Webview "render frame disposed" root cause** — currently suppressed via try/catch in main.js and renderer; investigate whether it can be prevented rather than swallowed

## Done (Recent)
- [x] **SME columns** — `SME Decision`, `SME Notes`, `Content Owner`, `Final_KKE` auto-detected via candidates list and injected when missing (main.js:31-34, 381-403)
- [x] **Export for SME review** — filtered xlsx export with data-validation dropdowns via ExcelJS; strips internal columns (renderer.js:7716+, main.js:1756)
- [x] **SME import IPC flow** — two-step `import-audit-merge-open` / `import-audit-merge-read-sheet` with sheet picker
- [x] **SME review progress dashboard** — SME Reviewed and Final KKE Resolved counts with percentages
- [x] **Redirect validation** — `checkLinks` handler validates destination URLs (main.js:1503)
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
