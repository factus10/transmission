# Changelog

All notable changes to Transmission are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
major-version codenames drawn from The Smiths.

## [Unreleased]

## [2.9.9] — "How Soon Is Now?"

### Changed

- **The synthetic "site root" box in the Visual Sitemap is now off by default.** Sitemaps show your own top-level nodes as the roots, with no extra wrapper box above them. Turn it back on per project in Project Settings → Identity ("Show a site root box in the Visual Sitemap") — and that choice now sticks. Note this affects existing projects: any that relied on the old default will no longer show the wrapper box until you re-enable it.
- **Turning off Page counts now gives a fully label-only Miro export.** Previously the "N pages" tallies were dropped but collapsed sections kept a "+N" marker; now both are suppressed, so each exported card shows just the node's text. (Turn off **Page counts** in the sitemap toolbar before exporting.)

### Fixed

- **The "Show a site root box" setting is now preserved for .xlsx projects.** Unchecking it and reopening the spreadsheet silently reverted it — boolean project settings weren't surviving the spreadsheet round-trip (a stored "off" read back as the text "FALSE" and was ignored). Booleans now round-trip correctly. (.transmission projects were already fine.)

## [2.9.8] — "How Soon Is Now?"

### Changed

- **The Visual Sitemap's Page counts toggle now applies to the Miro export.** Turning **Page counts** off and exporting to Miro produces label-only cards, matching the in-app view and the HTML/PDF exports. Collapsed sections still carry their "+N hidden" marker — on a static board that's the only cue that content is folded beneath a card.

## [2.9.7] — "How Soon Is Now?"

### Added

- **Hide page counts in the Visual Sitemap.** A new **Page counts** toggle in the sitemap toolbar (next to **Numbers**) hides the per-card "N pages" tally so you can read the tree by its labels alone. The choice is remembered per project and rides along into the interactive HTML and PDF exports.

## [2.9.6] — "How Soon Is Now?"

The Miro sitemap export becomes usable against a real work account — where a
login can see thousands of boards — and you can now control how the exported
board looks.

### Added

- **Find any Miro board, however many you have.** Exporting to Miro used to offer a fixed list of your 50 most-recent boards, which is unusable on a work account with thousands. The export dialog now **searches your boards by name** (the search runs on Miro's side, so it reaches every board, not just a recent handful), lets you **paste a board link or ID** to land on one exact board, and — once you've exported a project — offers a one-click **"Export again to _that board_"**. That last one is remembered by the board's Miro **ID**, not its name, so it still finds the board after you rename it (a board created "Untitled" and named later resolves to its real name).
- **Control the look of the exported board.** A new **Appearance** section in the export dialog sets the **connector style** (right-angle, curved, or straight), the **card corners** (rounded or square), the **border thickness**, and whether to include a **color key** — a legend, built from your color rules, that tells a client what each color means. Every choice is remembered per project.
- **Including collapsed sections is now opt-in.** The "Include them" option defaults off, so collapsed sections export as a compact stacked block unless you ask for the whole tree.

### Fixed

- **The Miro export no longer fails with "invalid parameters" on long page names.** An attempt to shrink long labels to fit the card sent Miro a font size below its minimum, which it rejects outright — so any sitemap with a long page title failed to export entirely. Labels are kept in full at a readable size and Miro fits them to the card.
- **Connectors route around the cards, not through them.** In a vertical column, connector lines now run down the gutter beside the stack (matching the app's own sitemap) instead of straight through the boxes between a parent and its lower children.
- **Card borders export at a visible weight.** A fractional border width rendered hair-thin on the board and left Miro's own thickness slider without a handle; it's now a clean whole number.

### Changed

- **The export dialog's controls are tidier.** The Appearance dropdowns sit in an aligned grid and are styled to match the rest of the app in both light and dark themes.
- **The Visual Sitemap toolbar wraps instead of scrolling.** On a narrow window it flows its controls onto a second row rather than hiding the export buttons off the right edge.
- **Removed the redundant "Back to Audit" buttons** from the Table, Sitemap, Redirects, and Menus views — the always-visible view switcher's Audit tab already does this.

## [2.8.2] — "How Soon Is Now?"

Three Visual Sitemap interaction fixes.

### Fixed
- **Collapsing a branch is now the +/− button only.** Collapse/expand was bound to the whole card, so an errant click while reaching for right-click → **Set color** would hide the entire subtree you were trying to colour. Only the +/− toggles now; the card body does nothing. The +/− is a little larger with its own hover state.
- **The node colour picker no longer closes the moment you drag a slider.** Right-click → **Set color** opens the OS colour panel; adjusting it used to tear the menu (and the panel with it) down on the first change. It now previews live, stays open while you fine-tune, and commits when you dismiss the panel.
- **The Legend panel no longer renders behind the sitemap** (issue #9). The toolbar scrolls horizontally on narrow windows, which was silently clipping the dropdown where it hangs below the toolbar — so its lower half was cut away and the canvas showed through. The panel now floats above the canvas, anchored under the Legend button.

## [2.8.1] — "How Soon Is Now?"

A packaging fix for 2.8.0.

### Fixed
- **2.8.0 crashed on launch** with "Cannot find module './miro'." The packaged build's file allowlist named each top-level source file individually, and the new `miro.js` module (added for the Miro export) wasn't on the list, so it was left out of the app bundle — the app ran correctly in development, where files load straight from disk, but not once packaged. The allowlist now includes every top-level module, so this class of omission can't recur. No behaviour changes; if 2.8.0 launched for you, nothing else is different.

## [2.8.0] — "How Soon Is Now?"

The Visual Sitemap can now be pushed to a Miro board as real, editable shapes, and
the colour rules behind it were rebuilt to encode anything in your audit.

### Added
- **Export the Visual Sitemap to Miro.** The sitemap toolbar gains **Export to Miro** alongside Export HTML and Export PDF. It creates a frame, one Miro shape per page positioned exactly where it sits in the app, and a connector for every parent→child link — carrying the colours and line styles from your colour rules. These are real Miro items, not a flat picture, so a client can move them around in a workshop. About 400 pages plus 400 connectors takes roughly a minute, with a progress bar and a Cancel button; Miro's own rate limits are the floor there, not the export.
- **One-click Miro connection.** App Settings → Miro → **Connect to Miro** opens your browser, you authorise Transmission and choose which Miro team to connect, and you're done. The token is stored encrypted in the OS keychain — deliberately not in the ordinary preferences file — and is never readable by the app's interface layer. An **Advanced** option remains for anyone who would rather paste a token from their own Miro app, which also covers the case where the connection service is unreachable.
- **Colour rules can read anything in the audit.** Sitemap cards can be coloured by 15 dimensions: seven from the sitemap node (Phase, Node Type, Page Status, Build Pattern, Builder, Writer, Migrator) and eight from the spreadsheet (Content Type, KKE, Final KKE, Renders as, Migration Track, Content Theme, Published Status, Target Content Type). Spreadsheet dimensions only appear when that column exists, and the picker shows how many nodes actually carry a value for each — so an empty dimension is visible as empty rather than silently producing a one-colour scheme.
- **Rules that ask "does this section contain…".** A sitemap node usually holds several pages, so a rule can test either the node's dominant value ("mostly Articles") or, with the new **any page is** operator, whether *any* page beneath it matches — which is how you flag a section containing a single Kill inside an otherwise Keep branch.
- **Rules compose.** Each visual property is taken from the first matching rule that actually sets it, so colour can come from one rule and line style from another. Encoding two dimensions at once no longer needs a rule for every combination.
- **Heavy-outline card style**, the convention most sitemap decks use — white card, thick coloured border — as an alternative to the colour band. Switching converts existing rules in place and keeps their colours.
- **Line style per rule** (solid, dashed, dotted), plus **corner radius** and **inner padding** in the Layout tab.
- **Collapsed sections are surfaced, not silently dropped.** Exporting with sections collapsed used to omit those pages without saying so. The export dialog now reports how many pages are hidden and offers to include them (on by default); sections left collapsed export as a stacked block labelled with either the hidden page count or a "+".

### Fixed
- **Long page names no longer spill outside their card in the Visual Sitemap.** Cards had no overflow boundary, so a name too tall for the box escaped it instead of clipping. Names now clip cleanly, the full name is available on hover, and the default card height fits a two-line name alongside the number and page count.

### Changed
- The nav sitemap now defaults to colouring **by depth**. Colouring by top-level section keys on the tree's top-level children, so a site whose pages all hang off a single root node came out effectively one colour. Depth always has something to say. Either can be chosen in Settings → Colors.

## [2.7.2] — "How Soon Is Now?"

Two Sitemap-editor undo/redo correctness fixes.

### Fixed
- **Undoing a Sitemap-node deletion now fully restores the rest of the tree.** Deleting a node renumbers the nodes that come after it; undoing brought the deleted node back but left the pages assigned to those renumbered nodes showing stale sort positions, paths, and breadcrumbs. Undo now re-syncs every affected page, so it's a true round-trip.
- **Redoing a node deletion now repeats what the delete actually did with its pages.** If you deleted a node and sent its pages to the parent (or to another node), then undid, redoing had *cleared* those pages instead of re-sending them. Redo now reapplies the original choice — and safely falls back to clearing only if the chosen destination no longer exists.

## [2.7.1] — "How Soon Is Now?"

A small follow-up to 2.7.0 with three Sitemap-editor fixes.

### Fixed
- **The bulk-delete confirmation now reports the real number of nodes it will remove.** It had counted only the top-level branches in your selection, so deleting a whole nested selection could say "Delete 20 nodes" while ~1,500 actually disappeared. The count now includes the selected branches and everything beneath them (with a note explaining the difference), matching the page count shown beside it.
- **The "select all" checkbox in the Sitemap editor no longer stays checked after the selection is cleared** — for example, right after a bulk delete has emptied it.

### Changed
- **"Delete selected" is much faster on large sitemaps.** It used to recompute the entire tree and re-cascade to every row once *per deleted node*; it now does that once for the whole batch. On a ~580-node / 4,000-row sitemap, deleting 200 nodes dropped from about 1.9 s to ~70 ms, with byte-identical results.

## [2.7.0] — "How Soon Is Now?"

A correctness, performance, and polish release from a codebase-wide review sweep — two dozen fixes across the reports, exports, audit bar, and sitemap tools, plus one restored feature. Every change was verified in the running app.

### Added
- **The redirect indicator is back in the audit bar.** When the selected page has a redirect destination, a small amber badge in the **Decide** cluster shows where it points (`↪ /new-path`, full URL on hover) — click it to open that page in the Redirect Editor, or the **×** to clear the destination. An intentional `404` shows as a `404` badge. This per-page affordance had been lost when the Redirects button moved to the view switcher; the sidebar's **R** dot only told you *that* a page redirected, not where.

### Fixed
- **Reports no longer drop "rogue" KKE values.** A page whose KKE is a typo, or a custom state that was later removed, was silently omitted from the Progress dashboard's reviewed count and from the Content Inventory report's per-section tallies — so a section's bar could visibly under-total against its own page count, and the dashboard could disagree with the sidebar's own reviewed percentage. Both now count every decision under its own label.
- **Client-facing exports no longer leak internal columns.** The **Client Export** and **Filtered Rows** exports were including `_`-prefixed engine columns — the internal consolidation-target ID, raw AI-assessment output — in spreadsheets meant for clients. They now exclude them, matching every other surface.
- **Three report PDFs render correctly again.** Pre-Handoff Check, Migration Direction Brief, and Sitemap Coverage referenced design tokens that were undefined in the exported document, so accent bars and borders vanished and tinted callouts went transparent. The exported HTML/PDF — and the dark-mode in-app preview, which was painting a near-black panel onto white "paper" — now style correctly.
- **The menu export includes menus that have no items.** A menu you'd named and placed but not yet filled in was silently dropped from the xlsx export, while the JSON export of the same project still listed it.
- **The Migration Direction Brief's page URLs are well-formed.** They were being built with no separator between domain and path (`https://example.comabout/team`) and with no domain at all when Site Domain was blank. The reports now share one correct computed-path → URL rule, so the brief agrees with the Migration Tracker.
- **Bulk-setting Kill offers the same cleanup as every other Kill path.** Killing a batch of pages from the Multi-bar now prompts to clear their sitemap assignments and redirect destinations, matching the single-row KKE button, Final KKE, and Table View inline edits. It had been silently skipping that cleanup.
- **Clearing a sitemap assignment from the audit bar is now recorded.** The Sitemap popover's Clear button was the one un-assignment path that didn't write to the client-facing change log.
- **A damaged project file no longer locks you out entirely.** One unreadable row used to fail the whole `.transmission` project open with a raw parser error; the project now opens with the affected row flagged and its original data preserved.
- **Deleting every entry from a structural library now sticks.** Emptying the Content Type Registry, Target Spec Library, Component Library, or Glossary and saving to xlsx used to silently restore the entries on reopen.
- **`Esc` cancels a batch AI assessment.** The cancel check was present but nothing was wired to trigger it, so a long run (about a second per page) couldn't be stopped short of quitting.
- **The saved app version is correct in packaged builds.** Projects were stamping a blank version into their metadata; they now record the real app version.
- **Component chips are legible in dark mode.** They were rendering with hardcoded light colors regardless of theme.
- **The SME split-by-owner export matches the single-file export.** Both now share one builder, so they can't drift — the multi-file copy had picked up terser validation messages.
- **Smaller fixes:** a no-match filter no longer strands a giant empty scroll region under the "no rows" message; canceling a progress-report PDF export no longer shows a spurious "failed" error, and that export window no longer leaks on a failed render.

### Changed
- **Noticeably faster on large crawls.** Several operations that scaled poorly were re-worked and measured at the app's ~4,000-row / ~500-node design target:
  - Bulk **Assign to Sitemap** no longer freezes for several seconds while computing suggested destinations — on 1,000 unplaced pages, roughly seven seconds down to a few milliseconds. This was worst exactly when the sitemap was still empty, which is when you'd use it.
  - Typing in the **sidebar search** and the **Redirect Editor search** is debounced, so a keystroke no longer re-scans every row / rebuilds the whole list.
  - Renaming a **sitemap node** cascades to its assigned pages far faster (about 32 ms down to 5 ms per keystroke).
  - Resolving a **consolidation group** rebuilds the sitemap tree once instead of once per page in the group.

## [2.6.4] — "How Soon Is Now?"

### Added
- **KKE gate + placement modes for bulk sitemap assignment.** The sidebar's "Assign to Sitemap" bulk action now defaults to Keep/Evolve pages only (mirroring Create Sitemap from Audit), with an "include Kill/Exclude/unreviewed pages too" opt-in for building a full current-state snapshot — plus one batched confirmation before sweeping in Consolidate pages, since those merge into another page's URL rather than getting their own. A new placement choice lets you preserve each page's URL structure as nested sections instead of always flattening into direct children.
- **Bulk multi-select and delete in the Sitemap editor, with undo.** Every tree row now has a checkbox (plain click, shift-click range-select, select-all, and a new "Select Empty Branches" shortcut for finding dead sections after later killing/consolidating pages). Bulk delete covers the whole selection in one confirmation, and — like every other sitemap edit — a single Cmd+Z reverses the entire batch. Single-node delete (the tree row's ✕, the node editor's own Delete button, and the "clear assignment + delete now-empty node" flow) is now undoable too, having been folded into the same shared delete path.

### Fixed
- **Filter state could leak between files on open.** The "Unclassified" toolbar button, the KKE filter, and the group filter could all inherit stale state from whichever file was previously open, occasionally leaving a filter showing "active" with nothing actually filtered.
- **Sidebar page thumbnails could silently never appear.** The hover-preview cache was keyed by the webview's resolved URL after a page finished loading, but looked up by the row's declared crawl Address — any redirect, trailing-slash normalization, or protocol upgrade (common in Screaming Frog exports) meant the thumbnail was cached under a key the lookup never checked.
- **The Glossary editor could silently discard unsaved changes.** Cancel, the × button, a backdrop click, and Esc all dismissed the editor immediately with no warning. All four now prompt to discard if there are unsaved edits.
- **Extra KKE-type sidebar columns (Final KKE, SME Decision, etc.) lost their color coding for Consolidate or any custom KKE state**, falling back to plain text instead of a colored badge.
- **Recomputing computed columns while a row was selected could crash the app** the next time you typed into any field bar input, due to a wrong-arguments bug in the field-bar refresh.
- **Deleting an entry in the Component Library or Target Spec Library could silently clobber the entry that shifted into its place**, overwriting it with the deleted entry's stale, unsaved form values.
- **Project Settings' Saved Filters "Apply" button applied the wrong row set (or silently did nothing)** due to a stale duplicate of the sidebar's own restore logic pointing at a DOM element that no longer exists. Both now share one implementation.
- **Cmd+F search only "temporarily" cleared filters in name** — it never restored them afterward, and never accounted for field filters at all, so a match hidden only by a field filter still wasn't reachable via arrow-key/j-k navigation. Both gaps are fixed.
- **A selected row could lose its purple selection fill once it also had a KKE color**, and **toasts could render invisibly behind an open modal dialog** — two CSS specificity/z-index bugs, both fixed.
- **A typo'd or renamed `{Column}` reference in a computed-column formula silently computed as 0** instead of raising an error, which could mislabel an entire inventory with no warning. It's now a formula error.
- **A Kill page's redirect destination could get stuck on the project default** even after the page was later given a proper sitemap home — it now upgrades to the more specific nav path, the same way Consolidate targets already did.
- **Four reports (Pre-Handoff Check, Net New Content Brief, Migration Checklist, Sitemap Coverage) could disagree with the Sitemap editor's own page counts**, since each built its own inline count that didn't exclude Kill/Consolidate pages the way the canonical count does.
- **Project settings too large to fit in an xlsx cell (a heavy Menus model, for example) were silently dropped on save**, logged only to the developer console. Now surfaced as a toast naming what was dropped.
- **Exporting a project whose sitemap had a single very long note, build-guidance, or writer-brief field could abort the entire workbook export** with a raw spreadsheet-library error, taking every other node's data down with it. That field is now clamped like its counterparts already were.
- **A Treemap section squeezed into a small sliver of canvas (crowded next to a much larger sibling) could render as blank grey** instead of its actual KKE-composition color, even though the underlying data was there.
- **Dragging a sitemap node to reorganize it could occasionally duplicate it** (the same node appearing in two places in the tree, sharing one ID) when its internal parent pointer had drifted out of sync — a stale-lookup bug also fixed in node delete and clone, which could silently no-op a delete (while still showing a success toast) or misplace a clone.
- **Editing a nav node's slug could wipe visual indicators (URL-override, breadcrumb-override, depth-warning markers) from descendant rows** in the sitemap tree, even though the underlying data was untouched.
- **Cloning a sitemap branch dropped every field beyond a small hardcoded set** — phase, notes, external URL, and all Build/Write/Migrate metadata vanished from the copy with no warning.
- **Undoing a KKE decision didn't record the reversal in the audit trail**, so the exported change log could permanently disagree with the actual data after a Cmd+Z.

## [2.6.3] — "How Soon Is Now?"

### Fixed
- **Redirect destinations could disagree between the Redirect Editor and the exported CSV.** Redirect resolution was implemented three separate times and had drifted: the editor's live preview did a one-hop lookup instead of following full Consolidate chains and didn't carry through the `404` sentinel, and the CSV export had no Consolidate handling at all (silently dropping consolidation redirects) while shipping literal `404,301` rows for intentional deindexes. All three now share one resolver, and SME-resolved Kill/Consolidate decisions (`Final_KKE`) are correctly picked up everywhere a redirect is derived.
- **Batch AI/rubric assessment silently overwrote human KKE decisions with no audit trail or undo.** Running a batch Assess now only writes to the AI's own suggestion field, matching how the equivalent "AI Suggest for Unreviewed" already behaved — your own KKE calls are never silently replaced. The per-row "Accept suggestion" button also now logs the change and supports Undo like every other KKE edit.
- **Sitemap rename/move changelog entries were attributed to the wrong page.** Renaming or moving a sitemap node cascades a redirect-destination update to every assigned page; the resulting changelog entries could log the wrong row number against the wrong URL. They now attribute correctly.
- **Exporting a project to xlsx and reopening it lost who-made-which-change.** The auditor name on each change-log entry wasn't carried through an Export Full Workbook → reopen round trip. It now survives.
- **A few dialogs could misbehave with the keyboard.** Pressing Enter while focused on a dialog's Cancel button (or an auto-focused checkbox) could fire the primary action instead — including destructive Kill-cleanup confirmations. Escape on the sitemap node picker could close the wrong (parent) dialog. Canceling the "Clear sitemap assignment?" prompt could leave a stale keyboard shortcut active that later silently re-fired against the wrong row. All three are fixed.
- **Pasted text with curly quotes, dashes, ellipses, or bullets could come out worse than before.** The mojibake-repair step in the text sanitizer had its most common patterns in the wrong order, so it actively corrupted exactly the sequences it exists to fix. Repairs correctly now.
- **A new sitemap node created from the audit bar's "+ Child" form could vanish after a save.** In `.transmission` projects, the new node wasn't always included in what got written to disk, leaving the page assigned to it pointing at a node that no longer existed on reopen.
- **Consolidate now gets its own color in the Progress dashboard and exported Audit Progress PDF.** It previously rendered as plain dark text, indistinguishable from body copy, while every other decision had a color.
- **Zeroing out a Suggested_KKE source's weight (to disable it) didn't actually disable it.** A weight of exactly 0 was silently treated as the default weight instead — so a disabled source could still win a tied disagreement.
- **A sitemap section that's also itself a page could disappear from the Treemap.** A node that's both a container (has sub-pages) and directly assigned its own page — the normal shape for a section landing page — now gets its own visible box for its own page(s), instead of that page's share of the section being silently absorbed into its children's boxes.

### Changed
- **Faster autosave on large `.transmission` projects.** Autosave now only rewrites rows that actually changed instead of the entire table on every save — most noticeable on multi-thousand-row projects, where a single-cell edit no longer re-writes the whole inventory.

## [2.6.2] — "How Soon Is Now?"

### Added
- **Suggested destination in bulk sitemap assignment.** The Multi-bar's
  Assign to Sitemap… dialog now offers a one-click **Suggested** node when
  some of the selected pages already have a sibling page placed on the
  sitemap (e.g. `/about` is already assigned while you're placing
  `/about/leadership`) — the same auto-suggestion the single-page Sitemap
  picker uses, extended to the whole batch, with a count of how many pages
  agree.

## [2.6.1] — "How Soon Is Now?"

### Fixed
- **Sidebar row list could get stuck truncated after using a full-width
  view.** The virtual-scrolled row list sizes itself off the sidebar
  container's height, which is zero while the Sitemap, Table, Redirects, or
  Menus view is hiding it. Anything that mutated row data and re-rendered
  during that window — bulk sitemap assignment, Create Sitemap from Audit,
  promoting a hub node from the node editor — painted a truncated list that
  stuck around after returning to the Audit view, until an unrelated filter
  change happened to force a fresh render. The row list now skips painting
  while hidden and always repaints fresh the moment the Audit view is shown
  again.

## [2.6.0] — "How Soon Is Now?"

### Added
- **"External link" Visual Sitemap color rule.** A new color-rule condition
  matches nodes that point off-site (a nav node with an external URL, or a
  `Link`-kind menu item) so they can be colored distinctly from ordinary
  pages regardless of section or depth. A one-click **"Mark external links"**
  button in the Colors tab adds it at the top of the rule list; it's also
  selectable manually via **+ Add rule**.
- **"Color by field" Visual Sitemap color rule.** Color the sitemap by
  **Phase**, **Node Type**, **Page Status**, **Build Pattern**, or any of the
  three **assignee** roles — pick a field in the Colors tab and click
  **Color by field** for one rule per value actually in use (including a
  bucket for "not set," so gaps are visible at a glance). Page Status reuses
  the same colors you've already assigned it in Project Settings, so the
  sitemap and the rest of the app agree on what each status looks like.
- **Treemap.** A new squarified-treemap view of the content inventory
  (Sitemap toolbar → **Treemap**, next to Visual Sitemap) — boxes sized by
  page count, colored by KKE decision, top-level section, or (at full depth)
  any tracked build field. Pick **Depth** and **Color by** in a small dialog
  and Generate; pan/zoom/Fit, a legend, and Export HTML/PDF match the Visual
  Sitemap. Hand-rolled, no charting library added.
- **Add and clone menu items directly under another item.** Every menu item
  row now has its own **+** (add a Page/Link/Header as that item's child,
  no more adding at the bottom and dragging it into place) and **⧉**
  (duplicate the item and its whole subtree as a sibling, ready to edit into
  a variant elsewhere in the menu).
- **Bulk sitemap assignment.** Select or filter a batch of pages (e.g. the
  "Needs sitemap placement" filter), then **Assign to Sitemap…** in the
  bulk-action bar to place all of them at once — pick an existing sitemap
  node or create a new bucket (top-level or nested) as the destination. Each
  page becomes its own child node, with slug and label auto-derived from its
  URL and title; pages already on the sitemap are skipped. Built for getting
  dozens or hundreds of pages placed fast, then reorganizing with the
  Sitemap editor's existing drag-and-drop.
- **Create Sitemap from Audit.** A new **Project → Create Sitemap from
  Audit…** tool auto-generates a whole starter tree from the crawl's own
  URLs in one pass — pick how many URL segments become nested sections
  (bucket depth) and whether to include Kill/Exclude/unreviewed pages, then
  Generate. `/about/leadership` becomes **About → Leadership** on its own.
  Safe to run on a file that already has a sitemap, or run again later — it
  only merges into matching section names, never replaces or deletes.
- **Hub node → content page.** A net-new ("NEW") sitemap node's editor now
  shows an amber banner explaining the gap, with a **Create Page** button
  that promotes it into a real spreadsheet row — a new Keep page, tagged
  `net-new`, assigned to the node — so it flows through the rest of the
  audit and migration tracker like any other page. The banner also points
  at the Build section's Page Status field for tracking "Not Started" →
  "In Progress" before it's promoted.

### Changed
- The Menus view's item toolbar (**+ Page / + Link / + Header / Duplicate
  menu / Delete menu**) now stays pinned to the top of the panel while
  scrolling a long menu.

### Fixed
- **SME Review workflow only recognized the exact `Change: X` format.** A
  bare status value with no prefix (e.g. an SME just typing `Kill` instead of
  `Change: Kill`) was silently invisible everywhere — the conflict filter,
  the resolve dialog, the progress dashboard, and the SME Review Status
  report all missed it. It's now recognized the same as an explicit
  `Change:`, and the override value is never required to match one of the
  project's currently-configured KKE states — an SME's own wording (typo,
  custom term, whatever) carries through into `Final_KKE` rather than being
  dropped. The two "pick a value" dropdowns involved (the resolve dialog's
  Final KKE select, and Table View's inline SME_Decision/Final_KKE editor)
  now keep an out-of-vocabulary value visible and pre-selected instead of
  silently losing it.
- **Client reports were nearly unreadable in dark mode.** Executive Summary,
  Content Inventory, Menu Report, and the other client-facing reports are
  built with colors hardcoded for a white background (the same markup doubles
  as the exported HTML/PDF, which always renders on white). The live in-app
  preview now forces that same white surface instead of inheriting the app's
  dark panel background, which had made near-black report text nearly
  invisible.
- **Per-menu Sitemap diagram could render items detached from their menu.**
  Menu item ids are only unique within their own menu, but the diagram merges
  every menu into one shared engine instance that indexed node positions by
  id globally — two different menus reusing the same local item id (routine
  and expected) could silently overwrite each other's computed position,
  making one item appear to float unattached. Node ids in this diagram are
  now namespaced per menu.

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
