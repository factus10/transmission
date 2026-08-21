# Transmission — Test Plan

The manual half of the test suite — it accumulates by feature, and covers what `npm test` structurally cannot reach: the DOM, IPC, the `<webview>` engines, and anything that talks to Miro. See `docs/dev/TESTING.md` for what is automated.

Test with a Screaming Frog crawl export (.xlsx) that has 50+ rows and a Sitemap sheet.

---

## 1. Import/Merge Audit Decisions

**Setup:** Have a second xlsx file with some of the same URLs and a few extra columns.

- [ ] File → Import/Merge Audit Decisions
- [ ] Multi-sheet file: verify sheet picker dropdown appears, switching sheets refreshes column list
- [ ] Single-sheet file: verify sheet picker is hidden
- [ ] Column checkboxes show "exists" (blue) or "new" (green) badges correctly
- [ ] Select multiple columns, click Import
- [ ] Existing columns: empty cells filled, existing values preserved
- [ ] New columns: appear after KKE_Recommendation in the header
- [ ] Toast shows matched/imported/kept counts
- [ ] Cancel button and overlay click both dismiss the modal

## 2. Duplicate Slug Detection (Nav Tree)

**Setup:** Open a file with NavStructure, go to Tree view.

- [ ] Edit a node's slug to match a sibling's slug → cell turns red with "Duplicate slug in this branch" tooltip
- [ ] Fix the slug → red highlight clears immediately
- [ ] Duplicate highlights appear on initial render for pre-existing duplicates
- [ ] Nav popover: try to assign a page with a slug that exists in the branch → error toast, assignment blocked
- [ ] Edit an already-assigned page's slug to a duplicate → error toast, change blocked

## 3. Menu Item Toggle (Nav Tree)

- [ ] "Menu" column header visible in nav editor
- [ ] Checkbox per node — check/uncheck toggles `inMenu` between 'Y' and ''
- [ ] Save file, reopen → Menu checkboxes preserved
- [ ] New nodes default to unchecked

## 4. Bulk Nav Assign

**Setup:** Multi-select 3+ rows in sidebar (Cmd+click), open Tree view.

- [ ] Drag multi-selected rows onto a tree node
- [ ] Each row gets a child node created with slug from URL's last path segment
- [ ] Title comes from "Title 1" column
- [ ] Duplicate slugs are skipped with count in toast
- [ ] Pages with no URL slug (homepage) assigned directly to node
- [ ] Multi-selection clears after assignment
- [ ] Nav editor re-renders showing new child nodes

## 5. Titlebar Buttons Removed

- [ ] Only "?" (Help) button visible in titlebar
- [ ] File → Project Settings opens the popover
- [ ] File → App Settings (Cmd+,) opens the popover
- [ ] Reports → Audit Progress opens the dashboard
- [ ] No crashes from missing button elements

## 6. Full-Width Fields

- [ ] Add "Nav Destination" and "Computed Path" to visible fields (gear icon)
- [ ] Both always render on their own row in the field bar, regardless of content length
- [ ] Other fields still flow/wrap normally

## 7. Table View

**Setup:** Open a file with 50+ rows.

- [ ] View → Table View (or Cmd+T) — sidebar hides, full-width table appears
- [ ] All columns visible with smart default widths
- [ ] Cmd+T again closes table view, restores sidebar
- [ ] **Sort:** Click any column header — cycles asc (▲) → desc (▼) → none
- [ ] **Per-column filters:** Type in filter input below a header — rows filter after ~150ms
- [ ] Multiple column filters work together (AND)
- [ ] Global filter (top toolbar) searches all columns
- [ ] **Resize:** Drag header right edge to resize a column — width persists after close/reopen
- [ ] **Column freeze:** Row number (#) column stays visible when scrolling horizontally
- [ ] **Column config:** Click "Columns…" — shows checkbox + drag-to-reorder list
- [ ] Uncheck columns → they disappear from table
- [ ] Drag to reorder → columns reorder
- [ ] Save persists, Reset Defaults restores all
- [ ] **Selection sync:** Click a row in table, close table view (Cmd+T) → audit view shows that row
- [ ] **Inline editing:** Double-click KKE cell → dropdown appears, change commits on blur
- [ ] Double-click Notes/Tags cell → text input appears, Enter commits, Escape cancels
- [ ] Double-click SME Decision cell → dropdown with Approve/Change options
- [ ] Changes reflect in sidebar immediately
- [ ] **Keyboard nav:** Arrow Up/Down or j/k navigate rows, selected row scrolls into view
- [ ] **Stats:** Row count shown in toolbar ("X of Y rows")
- [ ] **Virtual scroll:** Scroll through 1000+ rows smoothly, no lag

## 8. SME Review Workflow

### 8a. SME Columns

- [ ] Open any file → SME_Decision, SME_Notes, Content_Owner, Final_KKE columns exist
- [ ] SME Decision dropdown in audit bar: Approve, Change: Keep, Change: Kill, Change: Evolve, Change: Exclude
- [ ] Final KKE dropdown in audit bar: same values as KKE (Keep/Kill/Evolve/Exclude + custom)
- [ ] Both dropdowns update row data and mark file dirty

### 8b. SME Export

- [ ] SME → Export for SME Review
- [ ] Modal: filter by Group / Primary Tag / All rows
- [ ] Changing filter updates row count preview
- [ ] Export produces xlsx with column subset: Address, Title, KKE, Notes, SME_Decision, SME_Notes, Content_Owner
- [ ] SME_Decision cells have "—" placeholder
- [ ] **Open exported file in Excel:** SME_Decision cells have dropdown (Approve, Change: Keep, etc.)
- [ ] Header row is bold, shaded, and frozen
- [ ] Column widths are appropriate
- [ ] Filter label included in filename (e.g. "Client - Project - SME Review - Marketing.xlsx")
- [ ] **Split by Content Owner:** Check the checkbox, export → multiple files created in chosen folder, one per owner
- [ ] Each file has data validation dropdowns
- [ ] "Unassigned" file for rows with no Content Owner

### 8c. SME Import

- [ ] Fill in some SME decisions in the exported file (mix of Approve and Change: values)
- [ ] SME → Import SME Decisions
- [ ] Uses standard import/merge modal (sheet picker, column checkboxes)
- [ ] After merge: "Approve" rows → Final_KKE auto-set to KKE_Recommendation
- [ ] "Change: Kill" rows → Final_KKE auto-set to "Kill"
- [ ] "—" placeholders treated as empty (not imported)
- [ ] If unresolved conflicts exist, prompted to open resolve dialog
- [ ] Toast shows matched/imported/auto-set counts

### 8d. SME Conflict Resolution

- [ ] SME → Resolve Conflicts
- [ ] Modal shows rows where SME_Decision starts with "Change:" and Final_KKE is empty
- [ ] Each row: title, KKE badge → SME text, Final_KKE dropdown (defaults to SME suggestion), ✓ button
- [ ] Click ✓ → sets Final_KKE, row disappears from list, count updates
- [ ] "Accept All SME" → all remaining rows get SME's suggested value
- [ ] "Keep All Original" → all remaining rows get KKE_Recommendation value
- [ ] "Done" closes modal, sidebar updates
- [ ] Empty state message when all resolved

### 8e. SME Filters

- [ ] Sidebar KKE filter dropdown has "SME Conflicts" option → shows rows where SME starts with "Change:"
- [ ] Sidebar KKE filter has "Pending Final KKE" → shows rows where KKE is set but Final_KKE is empty

## 9. Quick Stats Bar

- [ ] Visible at bottom of sidebar when file is open
- [ ] Shows "X/Y reviewed (Z%)" with progress bar
- [ ] Progress bar fills proportionally (green)
- [ ] Updates in real time when KKE status is assigned/cleared
- [ ] Hidden when no file is open

## 10. Row Color Coding

- [ ] Keep rows have very subtle green tint
- [ ] Kill rows have very subtle red tint
- [ ] Evolve rows have very subtle yellow tint
- [ ] Exclude rows have very subtle gray tint
- [ ] Unreviewed rows have no tint
- [ ] Selected row highlight overrides the tint
- [ ] Colors are subtle enough to not interfere with readability

## 11. Saved Filters

- [ ] "Saved filters…" dropdown and "+" button visible in sidebar toolbar
- [ ] Set a filter combo (search text + KKE filter + group), click "+"
- [ ] Enter a name → filter saved, appears in dropdown
- [ ] Clear filters, select the saved filter from dropdown → filters restored
- [ ] Save file, reopen → saved filters still in dropdown (persisted in KKE_Settings)
- [ ] Saving with same name overwrites the old filter

## 12. Redirect Chain Detection

**Setup:** Mark 2+ pages as Kill. Set one Kill page's redirect destination to another Kill page's URL.

- [ ] Reports → Redirect Chain Check
- [ ] Dialog shows the chain: source → dest → issue description
- [ ] No chains: toast says "No redirect chains detected"
- [ ] Up to 20 chains shown in dialog, "and X more" for overflow

## 13. Nav Coverage Report

**Setup:** Have a NavStructure with some empty leaf nodes, hub nodes, and some pages assigned.

- [ ] Reports → Nav Coverage Report
- [ ] Shows summary: total nodes, assigned pages, unassigned pages
- [ ] **Empty Leaves** section: lists nodes with no pages and no children (red heading)
- [ ] **Hub Nodes** section: lists nodes with children but no direct pages (yellow heading)
- [ ] **Overloaded Nodes** section: lists nodes with 5+ pages
- [ ] **Path Mismatches** section: lists pages whose URL doesn't end with computed path
- [ ] Clean state: "No issues detected" message
- [ ] No nav structure loaded: error toast

## 14. Audit Templates

- [ ] File → Save Audit Template → prompted for name → saves .kke-template.json
- [ ] File contains: visibleFields, tagLibrary, groupLibrary, sidebarColumns, customKkeStates, columnMap, autoAdvance, projectSettings
- [ ] Open a different file (or fresh file)
- [ ] File → Load Audit Template → select the template file
- [ ] Confirmation dialog shows template name and what will be applied
- [ ] After apply: visible fields, tags, groups, sidebar columns, custom states all updated
- [ ] Toast confirms template applied
- [ ] Cancel on confirmation does nothing

## 15. Multi-Auditor Merge

**Setup:** Have two copies of the same file, each with some different KKE decisions.

- [ ] File → Merge Auditor Decisions → pick the other auditor's file
- [ ] Rows where only the other auditor reviewed: their decision fills in automatically
- [ ] Rows where both agree: counted as "agreed"
- [ ] Rows where both differ: conflict resolution dialog appears
- [ ] Dialog shows "Mine" badge vs "Theirs" badge with per-row dropdown
- [ ] ✓ button resolves individual row
- [ ] "Accept All Theirs" / "Keep All Mine" bulk buttons work
- [ ] "Done" closes dialog, sidebar updates
- [ ] Toast shows file name, agreed/filled/conflict counts

## 16. Changelog / Audit Trail

- [ ] Make several KKE, SME Decision, and Final KKE changes
- [ ] Save the file
- [ ] Open in Excel: `KKE_ChangeLog` sheet exists with entries
- [ ] Columns: Timestamp, Row, URL, Field, Old Value, New Value
- [ ] Make more changes, save again → new entries appended (not overwritten)
- [ ] KKE_ChangeLog sheet not shown in the app's data sheet picker
- [ ] Re-import the same file → existing changelog preserved

## 17. Progress Dashboard — SME Section

- [ ] Reports → Audit Progress (or close/reopen if already open)
- [ ] After SME import: "SME Review" section appears
- [ ] Shows: SME Reviewed (X of Y, Z%), Approved count, Changed count
- [ ] Shows: Final KKE Resolved (X of Y, Z%), Pending count
- [ ] If no SME data: section doesn't appear

## 18. Crawler Source Alternatives (evaluation backlog)

Transmission has no built-in crawler by design; crawl exports come from external tools. Screaming Frog is the reference source. Alternatives to evaluate for import compatibility:

- [ ] **SiteOne Crawler** (https://github.com/janreges/siteone-crawler) — free/open-source, CLI + desktop app. Untested. Evaluate: export format (xlsx/csv?), column names vs SF (`Address`, `Status Code`, `Title 1`, …), whether URL auto-detection picks up its URL column, metadata coverage (titles/descriptions/H1s/indexability), redirect reporting.
- [ ] For any alternative: import a real export, confirm audit columns inject correctly, sidebar/filtering/field bar behave, and round-trip save preserves all original columns.

## 19. Project Files (.transmission)

**Setup:** An xlsx crawl export open in the app with some decisions, tags, a nav tree, and project settings.

- [ ] File → Save As Project… (Cmd+Shift+S) → dialog defaults to `<name>.transmission` → file created
- [ ] Titlebar switches to the project name; toast confirms; sheet picker hidden
- [ ] Make edits → titlebar flips to ⟳ Saving… and back almost instantly (no multi-second pause)
- [ ] Quit + relaunch → project reopens via last-file with all state (decisions, nav tree, settings, glossary, libraries)
- [ ] No `-wal` / `-shm` sidecar files next to the project after quit
- [ ] Open Recent lists the project; Finder double-click opens it (packaged build)
- [ ] File → Export Full Workbook (.xlsx)… → exported file opens in Excel; data sheet + NavStructure (incl. Notes/Phase/build metadata columns) + KKE_Settings + KKE_ChangeLog all present
- [ ] Save As Project from an xlsx with existing KKE_ChangeLog history → exported workbook contains the FULL history (pre-conversion entries included)
- [ ] Re-export over the same xlsx → KKE_ChangeLog entries are NOT duplicated
- [ ] Exported workbook re-opens in Transmission cleanly (round trip)
- [ ] Open an old project after an app update that adds audit columns → new columns appear (injection on open)
- [ ] Rolling backup exists in `~/Library/Application Support/Transmission/backups/` after opening a project
- [ ] Changelog entries in the project carry the auditor's username (check exported KKE_ChangeLog or DB)
- [ ] Opening a project with a future schema version shows the "update the app" error (set `PRAGMA user_version` higher to simulate)
- [ ] Switching from a project to an xlsx file and back works; saves route to the right format each time

## 20. Client Export Profiles & Package for Handoff

**Setup:** A `.transmission` project open with decisions and an active sidebar filter.

### Client Export
- [ ] File → Export… → Client Export opens the profile dialog
- [ ] "Client Summary" pre-selected; only its columns checked; count readout correct
- [ ] "Full (all columns)" checks everything except `_rowIndex`
- [ ] Rows radios show correct counts; "Filtered" pre-selected when a filter is active, disabled at 0 matches
- [ ] Column search narrows the grid; All/None respect the current search
- [ ] Export → xlsx contains exactly the checked columns, in header order, with the chosen row scope
- [ ] Save as profile… → named profile appears under "This project"; survives save + reopen (stored in project)
- [ ] Re-saving with the same name overwrites rather than duplicating
- [ ] Delete enabled only for saved profiles; confirm dialog; built-ins not deletable
- [ ] Profiles travel: package/handoff the project to another machine/user → profiles still listed

### Package for Handoff
- [ ] File → Package for Handoff… with an xlsx open → friendly error suggesting Save As Project
- [ ] With a dirty project → saves first, then opens the zip save dialog (default `{name}-handoff-YYYY-MM-DD.zip`)
- [ ] Zip is revealed in Finder; contains the `.transmission` + README.txt
- [ ] Unzip → double-click the project → opens with full state (rows, nav, settings, changelog)
- [ ] Original project keeps working after packaging (checkpoint doesn't disturb the open session)

---

## 21. Visualizations (Visual Sitemap · Treemap · Content Flow)

These three engines render inside a `<webview>` from a generated standalone document, and every export re-generates that document in `print` mode in a hidden window. None of that is reachable from `npm test` — the automated suites cover only the host-side data (see `docs/dev/TESTING.md`), so everything below is a manual pass.

**Setup:** a project with a sitemap of 100+ nodes, several sections, at least one collapsed node, and pages assigned across a mix of KKE values.

### 21a. Visual Sitemap — view
- [ ] Sitemap toolbar → **Visual Sitemap** opens the diagram with cards on screen (not a blank/empty viewport)
- [ ] A card's **+/−** collapses/expands; clicking the card body does nothing
- [ ] Scroll zooms, drag pans, **Fit** frames the whole tree; on a very large tree Fit zooms below 10% and the cards are visible, not pushed off the left edge
- [ ] Scrolling out reaches the same zoom **Fit** lands on (no floor above it)
- [ ] **Numbers** toggle; **Expand all** / **Collapse all**
- [ ] **Counts** dropdown: hidden-sub-pages (default, only on collapsed cards) · sub-pages on every branch · assigned audit pages · none — choice survives close + reopen and appears in an export
- [ ] Collapse a node in the diagram → close → the Sitemap editor's **Collapse** checkbox for that node is now ticked (two-way binding)

### 21b. Visual Sitemap — settings
- [ ] **Layout** tab: card size/gaps/corner radius/padding all preview live; radius and padding are clamped so a label can't be squeezed out
- [ ] **Connectors**: **Line color** repaints every line; **Line weight → By content volume** makes trunks thicker than leaf drops; **Base/Max width** move the two ends of the scale; *Uniform* renders exactly as before the setting existed
- [ ] **Colors** tab: generators (by depth · by section · mark external · by field), add/delete/drag-reorder rules, per-rule line style, card style band vs heavy outline
- [ ] Right-click a node → force horizontal/vertical, set color; overridden nodes show a dashed outline
- [ ] **Save as my defaults** → new project opens with those settings; **Reset to defaults** restores
- [ ] All of the above persists with the project (save, reopen, verify)

### 21c. Sitemap shape check
- [ ] Sitemap stats line shows a clickable **⚠** when the tree is too big to draw, and no ⚠ on a healthy tree
- [ ] Opening the Visual Sitemap on such a tree offers the check first
- [ ] Reported section count, canvas size, and zoom match what the diagram actually opens at
- [ ] Ticking repairs updates the projected sections/size/zoom live; unticking restores the original numbers
- [ ] The projection changes nothing until **Apply** — cancel, then confirm the tree is untouched
- [ ] Apply grouping → the bucket is created **collapsed**, the chosen roots move into it, other roots are unmoved
- [ ] **Cmd+Z** reverses the whole grouping in one step, however many sections moved
- [ ] Drop artifacts → exactly those roots go, and their pages remain in the audit as unplaced
- [ ] **Open the diagram anyway** always available and works

### 21d. Create Sitemap from Audit — prediction
- [ ] Dialog reports predicted top-level sections, single-page sections, and crawl artifacts before generating
- [ ] Toggling "include Kill/Exclude/unreviewed" updates the prediction
- [ ] Changing **Bucket depth** does *not* change the section count
- [ ] The sweep-into-one-section offer appears on a flat site, and the generated tree opens
- [ ] Choosing *where pages are today* reveals the redirect note and **Save a copy first…**, which switches the session to the copy
- [ ] After generating, the shape check is offered when the result needs it

### 21e. Treemap
- [ ] Sitemap toolbar → **Treemap**: config dialog offers Depth and Color by; field-based coloring is offered only at **Unlimited** depth
- [ ] Box sizes reflect subtree page counts including Kill/Consolidate; KKE subtitle percentage never exceeds 100%
- [ ] Legend color wells recolor a whole category; right-click recolors one leaf only; container boxes are not recolorable
- [ ] **Reset colors** restores; palette persists per color-by mode and survives save + reopen

### 21f. Content Flow (Sankey)
- [ ] Sitemap toolbar → **Content Flow**; config dialog offers source depth, and site-rename fields only with 2+ in-scope sites
- [ ] **From** (section / source site) and **Shape** (→ Decision · → New sitemap · both) re-read without regenerating
- [ ] Column totals conserve across every shape; Retired / Out of scope / Not placed buckets are present
- [ ] A consolidated page flows through to its master's destination, still colored as Consolidate
- [ ] Custom KKE states get their own block in the configured color

### 21g. Exports (all three engines)
- [ ] **Export HTML** → opens in a browser with no app, still interactive, no external `<script src>`; the client file has no settings panel or export buttons
- [ ] **Export PDF** → one page sized to the diagram, nothing clipped
- [ ] **Export PNG** → the whole diagram at its layout size, not a screenshot of the viewport
- [ ] Every export renders **the view currently on screen** (collapse state, counts mode, colors, and for Content Flow the From/Shape/Color-by toggles)

## 22. Miro export

**Setup:** a connected Miro account (App Settings → Miro) and a sitemap of 100+ nodes.

- [ ] Board picker: create new (default) · search by name · paste a board link/ID · re-export to the last board (shown by its *current* name after a rename; the option disappears if the board was deleted)
- [ ] **Appearance**: connector style, connector thickness (**Match sitemap** default — a volume-weighted sitemap exports volume-weighted lines), card corners, border thickness, color key — all remembered per project
- [ ] Collapsed sections: **Include them** is off by default and exports a stacked block with the chosen `+N` / count label; ticking it exports the whole tree
- [ ] Board matches the app: positions, colors, line styles, and the color key chips
- [ ] Progress modal updates through frame → shapes → connectors; **Cancel** stops cleanly
- [ ] Result toast reports the item count; **Delete board** appears only for a board this export created, confirms first, and clears the remembered board
- [ ] Treemap and Content Flow export to Miro through the same picker (board choice + color key only), after the view has rendered
