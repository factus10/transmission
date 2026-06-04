# Transmission — Test Plan

Features added in the current session. Test with a Screaming Frog crawl export (.xlsx) that has 50+ rows and a NavStructure sheet.

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
