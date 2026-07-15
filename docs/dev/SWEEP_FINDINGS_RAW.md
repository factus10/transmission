# Codebase Sweep — RAW, UNVERIFIED findings

> **These findings have NOT been verified.** The sweep's adversarial
> verification pass and synthesis pass both died on a session usage limit
> before they could run. Every item below is a single agent's unchecked claim.
> Expect false positives — **especially in `dead-code`**, where a wrong claim is
> dangerous to act on (code can be reached via string-keyed dispatch, IPC channel
> names, or DOM event delegation, not just direct calls). Verify before acting.

Raw findings: 148 · after dedup: 148

---

## HIGH (53)

### [correctness-risk] `src/renderer.js:1702`
**The shared modal key handler makes Enter click the primary button even when a different button (e.g. Cancel) has keyboard focus, because it preventDefaults the focused button's own activation from the capture phase.**

- *Evidence:* `if (top.primaryBtn && !e.shiftKey) { e.preventDefault(); top.primaryBtn.click(); }` inside `document.addEventListener('keydown', …, true)` — the only bail-out is `if (tag === 'textarea') return;`
- *Impact:* Enter on a focused non-primary button never activates that button: the capture-phase preventDefault cancels the synthesized click and the primary button fires instead. In `confirmDialog({danger:true})` and `showKillCleanupModal`/`showBulkKillCleanupModal` (both of which are reached with a destructive/Apply primary), a user who tabs to Cancel and presses Enter executes the destructive action — clearing Sitemap_ID / Sitemap_Destination / Computed Path / Redirect_Destination on the row or on every selected row, silently mutating audit data the user was trying to protect. It also fires when focus is anywhere outside the dialog, since the handler never checks that `e.target` is inside `top.overlay`.
- *Proposed fix:* In `_ensureModalKeyHandler`, bail before the primary-click when the event target is itself activatable (`if (tag === 'button' || tag === 'a' || (e.target.tagName === 'INPUT' && e.target.type === 'checkbox')) return;`) and require `top.overlay.contains(e.target)` so Enter only triggers the primary from body fields (the `showPrompt` text-input case this was written for).

### [correctness-risk] `src/renderer.js:1409`
**Cmd+F's "temporarily clear filters" block permanently wipes the user's sidebar filters, never restores them, and still misses `state.fieldFilters` — so the matched row can remain invisible and un-navigable.**

- *Evidence:* `// Temporarily clear filters to show the row` followed by `state.filterText=''; … state.kkeFilter=[]; state.groupFilter=''; … applyFilter();` — with no restore path, and no reset of `state.fieldFilters` (which `applyFilter()` reads at line 2682: `const ffs = Array.isArray(state.fieldFilters) ? state.fieldFilters : [];`).
- *Impact:* Nothing is temporary: one Cmd+F hit silently destroys a KKE filter + group filter + search text the auditor built (or restored from a saved filter). Worse, because `fieldFilters` survives, a row hidden by e.g. the "Unclassified" toggle or any `contains` field filter is still absent from `state.filteredRows`, so `selectRow()` loads it in the webview but the sidebar shows no selection and `navigateRow()` dead-ends immediately (`currentPos === -1` → `return`) — ↑/↓/j/k stop working until the user manually changes a filter. The same 6-line block is copy-pasted into `globalSearchGoToRow` (lines 1436-1444), so both paths carry the identical defect.
- *Proposed fix:* Extract one `clearSidebarFilters()` helper that resets filterText / kkeFilter / groupFilter **and** `state.fieldFilters` (then `renderFieldFilterChips()` + `refreshUnclassifiedButton()` + `applyFilter()`), call it from both `globalSearchNavigate` and `globalSearchGoToRow`, and either restore the prior filter state on `closeGlobalSearch()` or drop the misleading "temporarily" comment and toast that filters were cleared.

### [correctness-risk] `src/renderer.js:7064`
**Project Settings → Saved Filters → Apply restores a saved filter incorrectly: it targets a non-existent element id, never sets `state.groupFilter` (the value `applyFilter()` actually reads), and never refreshes the field-filter chips or the Unclassified button — so the auditor gets the wrong row set with invisible filters.**

- *Evidence:* const gSel = $('group-filter-select'); if (gSel) gSel.value = f.groupFilter || '';  — but index.html:59 is `<select id="group-filter">` and applyFilter() reads `const gf = state.groupFilter;` (renderer.js:2680).
- *Impact:* Applying a saved filter from Project Settings silently drops the saved group filter AND leaves any previously-active group filter in place, so the sidebar shows a different row set than the saved filter defines. `state.fieldFilters` is swapped in without calling renderFieldFilterChips()/refreshUnclassifiedButton(), so the field filters narrow the list with no visible chip and no way to remove them. The auditor then reviews the wrong subset of a 4,000-row crawl believing it's the saved slice. The sidebar's own restore path does it correctly (2434–2444), so behavior differs by which UI you used.
- *Proposed fix:* Extract the sidebar's restore block (renderer.js:2434–2444: sets state.filterText, toggles #btn-clear-search, state.kkeFilter + renderKkeFilterOptions(), state.groupFilter + els.groupFilter.value, state.fieldFilters + renderFieldFilterChips(), applyFilter()) into `applySavedFilter(f)` and call it from BOTH the sidebar saved-filters dropdown and this Project Settings handler. Add refreshUnclassifiedButton() to the shared helper.

### [correctness-risk] `src/renderer.js:5674`
**`runBatchAssessment()` overwrites the human `KKE_Recommendation` column on every filtered row with raw AI output, with no `logChange()` and no `pushUndo()` — the one KKE write path in the app that leaves no audit trail.**

- *Evidence:* if (llmResult.recommendation) { row[kkeCol()] = llmResult.recommendation; row['_AssessmentResult'] = llmResult.recommendation; }  — no logChange/pushUndo anywhere in the loop (5658–5687).
- *Impact:* Every other KKE mutation logs to KKE_ChangeLog (3336, 8731, 17402, 22691) and the single-row path also pushes undo (17401–17402). This one doesn't. It is reachable from Project Settings → Suggestions → 'Run Rubric' (6666–6669) and View/Project menu `menu-rubric-batch` (519), where it is framed as a *suggestion source* alongside GA; the confirm dialog only says 'Assess N rows via AI?'. On a project where 3,000 rows were already human-audited, one click replaces all of those decisions with the model's answer — silently, unrecoverably, and invisibly in the changelog exported to the client. Its sibling `runSuggestForUnreviewed()` (5703) deliberately writes only `_AssessmentResult` and comments '// feeds the Rubric source — never touches KKE'.
- *Proposed fix:* Make the batch path write `_AssessmentResult` only and let computeSuggestedKke() surface it as Suggested_KKE (exactly as runSuggestForUnreviewed does), or — if overwriting KKE is genuinely wanted — route each write through the existing logChange(origIndex, kkeCol(), old, new) + pushUndo() pair and skip rows that already carry a human KKE. Same gap in acceptSuggestion() at 5629 (`row[kkeCol()] = val;` with no logChange).

### [correctness-risk] `src/renderer.js:4389`
**Deleting an entry in the Component Library editor silently overwrites the NEXT entry with the deleted entry's field values — the exact bug that was already found and fixed in the twin Target Spec Library editor, but never back-ported here.**

- *Evidence:* Delete handler: `working.splice(_selectedIdx, 1); selectItem(Math.min(_selectedIdx, working.length - 1));` — and `selectItem(idx)` starts with `syncFromDom();` *before* `_selectedIdx = idx;`, while `syncFromDom()` writes the still-displayed form values into `working[_selectedIdx]`. After the splice, `working[_selectedIdx]` is the entry that shifted up. The sibling editor carries a fixed version with a comment: "do NOT syncFromDom() here. Callers sync the *current* entry BEFORE changing _selectedIdx; syncing again here would read the old entry's form values into the new index, overwriting the clicked entry (the 'everything turns into Article' + duplicate-entries bug)." (line 8405).
- *Impact:* Delete any non-last component: it disappears, and the following entry is clobbered with the deleted one's name/category/description. The list length looks right, so the loss is invisible. Save then writes the corrupted library to prefs.json via `savePrefs({ designPatternLibrary: saved })` — this library is GLOBAL (app-level), so one bad delete corrupts the component vocabulary for every project on that machine, and `state.projectSettings.designPatternLibrary = saved` bakes it into the open project file too.
- *Proposed fix:* Mirror the fixed twin: in the `#_dpl-d-delete` handler, do the sync-and-clear before mutating — `syncFromDom(); _selectedIdx = -1; working.splice(idx, 1); _selectedIdx = Math.min(idx, working.length - 1); modal.innerHTML = buildBody(); wireEvents();` — i.e. never let `syncFromDom()` run against a `_selectedIdx` that no longer addresses the entry the DOM is showing. Better: extract the two editors' shared master/detail machinery so this class of fix can't be applied to only one copy again.

### [correctness-risk] `src/renderer.js:14510`
**cascadeNavChangesToRows passes the 1-based `_rowIndex` to logChange(), which expects a 0-based origIndex — every auto-derived Redirect_Destination change is logged against the wrong row and the wrong URL.**

- *Evidence:* `logChange(row._rowIndex ?? state.editedRows.indexOf(row), 'Redirect_Destination', existing, newRedirect);` — but main.js:632/748 set `_rowIndex: i + 1` (1-based), while logChange (renderer.js:119-125) does `state.editedRows[origIndex]?.[state.urlColumn]` and `row: origIndex + 1`.
- *Impact:* `_rowIndex` is present on every row from both the xlsx and .transmission open paths, so the `??` fallback essentially never fires: each redirect-cascade entry written to the KKE_ChangeLog sheet records Row = i+2 and the URL of the *next* page in the inventory. The change log is a client-facing audit trail that accumulates across sessions and is exported in full on Export Full Workbook — it is silently attributing edits to the wrong page. Also, `state.editedRows.indexOf(row)` in the fallback is an O(n) scan inside a 4,000-row loop.
- *Proposed fix:* Take the index from the enclosing loop: change `state.editedRows.forEach(row => {` (line 14473) to `forEach((row, i) => {` and call `logChange(i, 'Redirect_Destination', existing, newRedirect)`. Drop the `_rowIndex ?? indexOf` expression entirely.

### [correctness-risk] `src/renderer.js:13446`
**buildTreemapNode gives a container box its full subtree count as `value` but emits only its children — pages assigned directly to that node vanish and its children are inflated to fill the whole box.**

- *Evidence:* `const out = { id: node.id, label: ..., value };` then `if (kids.length) { out.children = kids.map(...) }` — the children's values sum to `value` minus the node's own directly-assigned pages, and treemap-template.js:65 scales children to fill the parent rect exactly (`var scale = total > 0 ? (w * h) / total : 0;` where `total` = sum of the *children's* values).
- *Impact:* A node that is both a page and a container is the normal case here — `createSitemapFromAudit()` deliberately assigns landing pages directly to bucket nodes that also have children ("a node can be both a page and a container"). A section with 40 direct pages and one child holding 2 pages renders as a box whose interior is 100% that one child, telling the client all 42 pages live under the child. The box's outer area is right, so the error is invisible; the treemap is an exported client deliverable (client HTML / PDF).
- *Proposed fix:* Have computeSubtreePageCounts() also return its internal `direct` map (it already builds it, line 15036-15041) and expose it as `ctx.directCounts`. In buildTreemapNode, when `kids.length && ctx.directCounts[node.id] > 0`, append a synthetic leaf child (label e.g. `node.label + ' (this page)'`, value = the direct count, colored/subtitled via the existing resolveTreemapNodeColor/treemapSubtitle) so the children's values sum to the parent's.

### [correctness-risk] `src/renderer.js:16296`
**createNavChild() creates a real sitemap node but never sets state.navTreeDirty / setDirty(true), so for .transmission projects the node is never written to disk — a row assigned to it saves with a Sitemap_ID pointing at a node that won't exist on reload.**

- *Evidence:* `parent.children.push(newNode); state.navNodes.push(newNode); state.newNavNodes.push(newNode);` … then straight to `showToast('Created: ' + label, 'success');` — no `state.navTreeDirty = true` and no `setDirty(true)` anywhere in the function (16247-16307). buildSavePayload only emits the tree when dirty: `if ((state.navTreeDirty || fullNav) && state.navNodes.length > 0)` (5210), and the project save path ignores newNavNodes entirely: `projectStore.saveAll({ headers, rows, allNavNodes, projectSettings, changeLog, … })` (main.js:1802).
- *Impact:* Silent audit-data corruption. Flow: audit bar → Sitemap picker → '+ Add child' → Create, then clear the slug and hit Assign — assignNav()'s direct-assign branch sets only `setDirty(true)` (10196), not navTreeDirty. The file saves, allNavNodes is omitted, and the new node is dropped (it survives only on the legacy xlsx `newNavNodes` append path, and only when a Sitemap sheet already exists). The row keeps an orphaned Sitemap_ID → broken breadcrumb/computed path/redirect target in every downstream deliverable. Closing the popover without assigning loses the node outright with no unsaved-changes warning.
- *Proposed fix:* Set `state.navTreeDirty = true; setDirty(true);` in createNavChild — and delete the body: it is a third verbatim copy of createNavChildForPage(parentNode, slug, label) (10208-10240; addNavChildNode at 14635 is the second), duplicating the maxId scan, maxChildIdx scan, breadcrumb/computedPath/buildSortID derivation and node literal. Call createNavChildForPage() and then set the dirty flags (it also gains the uniqueSiblingSlug/navSlugExistsInBranch collision handling createNavChild lacks).

### [correctness-risk] `src/renderer.js:17574`
**`recalculateComputedColumns()` calls `renderMetaFields(state.selectedIndex)` with the row *index* where a row *object* is expected, blanking the field bar and breaking its editable inputs.**

- *Evidence:* L17574: `renderMetaFields(state.selectedIndex);` — but the signature is `function renderMetaFields(row, origIndex)` (L3422), and every one of the ~18 other call sites passes `renderMetaFields(state.editedRows[state.selectedIndex], state.selectedIndex)`.
- *Impact:* After Recalculate in the Computed Columns editor, the selected row's field bar re-renders from a Number: `const value = row[h] ?? ''` (L3471) yields '' for every field, so Title / Meta Description / H1 all show EMPTY even though the data is intact. Worse, `origIndex` is `undefined`, so the editable input's listener `state.editedRows[origIndex][h] = input.value` (L3497) throws a TypeError the moment the auditor types into the blank-looking Title field. The user sees their title vanish and can't retype it until they reselect the row.
- *Proposed fix:* Change to `renderMetaFields(state.editedRows[state.selectedIndex], state.selectedIndex);` — matching every other call site.

### [correctness-risk] `src/renderer.js:16794`
**`kkeColor` / `resolvedKkeColor` / `resolvedKkeBgColor` omit `Consolidate` from their maps, so Consolidate renders as undifferentiated grey/black in the client-facing Audit Progress PDF.**

- *Evidence:* L16794: `const map = { Keep: '--kke-keep', Kill: '--kke-kill', Evolve: '--kke-evolve', Exclude: '--kke-exclude' };` — no Consolidate, yet `BUILTIN_KKE = ['Keep','Kill','Evolve','Consolidate','Exclude']` (L116) and `--kke-consolidate: #4338ca` exists in styles.css (L28). The falls-through path is `state.customKkeStates.find(...)`, which never matches a built-in, so it returns `var(--text-primary)` / `#333` / `#33333333`.
- *Impact:* Every surface built on these three helpers mis-colors Consolidate: the Progress dashboard stacked bar + 'By status' rows (L16838/16845), the exported Audit Progress PDF (L16913/16914/16921), and the shared report bar/stat builders at L18420/18433. On a migration audit where Consolidate is a heavily-used state, the deliverable PDF shows a black bar segment and black stat text where every other state is color-coded. `treemapKkeColor()` (L15095) already carries the correct 5-entry map and its own header comment explicitly flags this gap.
- *Proposed fix:* Add `Consolidate: '--kke-consolidate'` (and `--kke-consolidate-bg`) to all three maps, or better: delete the three near-identical helpers and have them all delegate to the already-correct `treemapKkeColor()`-style single map (a `kkeVar(label)` lookup + a `resolve()` wrapper).

### [correctness-risk] `src/renderer.js:7689`
**A Suggested_KKE source weight of 0 is silently coerced back to 1.0, so "turn this source off" actually makes it win.**

- *Evidence:* const w = weights[s.source.toLowerCase()] || 1.0;
- *Impact:* Both weight editors accept and persist 0 (`ga: isFinite(ga) && ga >= 0 ? ga : 1.0` at 7871 and 6675; both `<input min="0">`). A user who zeroes GA to disable it gets GA back at weight 1.0. With Rubric also at 1.0 the tally ties, and `sources.find(s => s.rec === best)` / the `for…in` iteration order resolve the tie to the FIRST source — GA. So the source the auditor tried to silence becomes the one that wins every disagreement, and the wrong value lands in the `Suggested_KKE` column that ships in the Migration Tracker and client exports. Silent — no warning, no visible difference in the badge.
- *Proposed fix:* Use a null-coalescing lookup that respects 0: `const raw = weights[s.source.toLowerCase()]; const w = Number.isFinite(raw) ? raw : 1.0;`. Consider also skipping zero-weight sources entirely in `gatherRowSources`/`pickWinner` so a 0-weight source can't win a tie either, and label the input "0 = ignore this source".

### [correctness-risk] `src/renderer.js:12237`
**showMenuNodePicker hand-builds its overlay instead of using openModal(), so pressing Escape inside the picker also closes the openModal dialog that launched it — destroying the user's in-progress configuration — and its document keydown listener is never removed unless Escape is the thing that closes it.**

- *Evidence:* document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
- *Impact:* Two defects from one root cause. (1) The picker is not in `_modalStack`, so `_ensureModalKeyHandler` (line 1689) independently closes the *top of the stack* on Escape while the picker's own listener closes the picker. Every launch site is inside an openModal dialog — `seedMenuFromContentTree` (12337), `openMenuOrphansDialog` (12530), `openBulkNavAssignDialog` (10592/10610, modal at 10622), the node editor's breadcrumb-parent select (15453) — so Escape in the picker silently nukes the parent dialog too, losing a half-configured seed/bulk-assign. `e.stopPropagation()` at line 1696 does not prevent this (it would need stopImmediatePropagation, and the handlers are on different… same target, different listeners — both fire). (2) The `esc` listener is only unregistered on the Escape path; closing via Cancel, the backdrop, or picking a node leaves it attached forever. Seeding a menu means one pick per item, so a 200-item menu leaves 200 dead listeners, each holding a detached overlay closure.
- *Proposed fix:* Rebuild showMenuNodePicker on `openModal()` (the documented contract in docs/UI_STANDARDS.md — 'Never hand-build a modal'). openModal already owns Esc, backdrop close, and z-index stacking via `_modalStack`, which makes it correctly close only the topmost dialog and removes the leak entirely. If the 1300 z-index was the reason for hand-building, note that openModal already computes `z = 1000 + _modalStack.length * 10`, so a picker opened from a dialog naturally stacks above it.

### [correctness-risk] `src/renderer.js:11094`
**promptClearNavAssignment() leaves its document-level keydown listener attached after every close path except Escape, so a later Enter keypress anywhere in the app re-clicks the detached "Clear assignment" button and silently wipes a row's sitemap assignment.**

- *Evidence:* close() { dialog.remove(); overlay.remove(); }  // never removes onKey
...
if (e.key === 'Enter')  { e.preventDefault(); dialog.querySelector('#_nbc-clear').click(); ... }
document.addEventListener('keydown', onKey);
- *Impact:* Cancel the dialog (or click Clear), then press Enter anywhere — in the Notes textarea, a meta-field input, the search box — and onKey fires on the still-live closure: it click()s the detached #_nbc-clear, whose handler runs clearNavAssignment(row, origIndex) + setDirty(true) against the ORIGINAL origIndex, regardless of which row is now selected. If the user had ticked "also delete this now-empty node" before cancelling, deleteNavNodeFromEditor() also runs. A page silently loses its Sitemap_ID / Sitemap_Destination / Computed Path / Page_Breadcrumb — corrupting the sitemap, the redirect map, and the Migration Tracker deliverable — with only a toast the user will read as stale. It also preventDefault()s Enter globally. Every open/close of the dialog stacks another listener.
- *Proposed fix:* close() must call document.removeEventListener('keydown', onKey) (and the Enter branch should guard on the dialog still being connected). Better: rebuild this dialog on openModal(), which already owns Esc, backdrop-close and teardown — see finding on hand-built modals below.

### [correctness-risk] `src/renderer.js:10900`
**_MOJIBAKE_MAP contains a bare 2-char 'â€' key inserted BEFORE the longer 'â€“'/'â€”'/'â€¦'/'â€¢' keys, so sanitizeText() corrupts the four most common mojibake sequences instead of repairing them.**

- *Evidence:* 'â€™':"'",'â€˜':"'",'â€œ':'"','â€':'"','â€':'"',   // 5th key is the bare 2-char prefix 'â€' (verified: U+00E2 U+20AC only)
'â€“':'–','â€”':'—','â€¦':'…','â€¢':'•',            // …defined on the NEXT line, i.e. later in insertion order
- *Impact:* sanitizeText() walks Object.entries() in insertion order, so the 2-char prefix (index 70) is applied before the 3-char en-dash/em-dash/ellipsis/bullet keys (indices 71-74) and eats their prefix. Reproduced: "Alumni â€“ Giving" -> 'Alumni "“ Giving'; "Read moreâ€¦" -> 'Read more"¦'; "A â€¢ B" -> 'A "¢ B'. attachSanitizer() runs this on paste and blur of nav node Label/Slug/Notes, so pasting a title straight out of a crawl export writes the mangled string into the node label — which then flows verbatim into breadcrumb, Sitemap_Destination, Page_Breadcrumb, the Visual Sitemap, the client sitemap export and the Migration Tracker. The one function whose entire job is cleaning paste residue is the thing introducing it. Separately, 'Âª':'»' (line 10896) is a mis-mapping copy-pasted from the adjacent 'Â»':'»' — it should be 'ª'.
- *Proposed fix:* Delete the bare 'â€' key (it is also a duplicate — the intended entry, 'â€' for a right double-quote, is already the key before it), and fix 'Âª' to map to 'ª'. To make ordering non-load-bearing, precompute the entry list once sorted by descending key length so longest-match always wins.

### [correctness-risk] `src/renderer.js:18295`
**In the Kill branch of resolveRedirectDestinations, an auto-written destination is indistinguishable from a manual override on the next save, so a Kill row that later gets a sitemap home keeps redirecting to the project default forever.**

- *Evidence:* if (kke === 'kill') {
      if (existing) return; // explicit value already set
- *Impact:* resolveRedirectDestinations runs on every save (including the 2s autosave). Mark a page Kill with no nav home and a defaultRedirectUrl set → autosave writes Redirect_Destination = defaultRedirectUrl. Assign that page to a sitemap node afterwards → every later save short-circuits on `if (existing) return`, and exportRedirectMap prefers the stored customDest (line 22281-22284), so the client's redirect CSV 301s the killed page to the homepage instead of its replacement section. The Consolidate branch three lines above already solves exactly this with `looksAutoDerived` (18289), and cascadeNavChangesToRows reconstructs the same 'was this auto?' guess a third way (14507) — resyncNavBasedRedirects exists purely as a manual band-aid for the resulting staleness.
- *Proposed fix:* Give the Kill branch the same auto-derivation test the Consolidate branch has: recompute `resolved` first, then rewrite when `!existing || existing === resolved || existing === defaultRedirectUrl || existing === previously-derived-nav-path`. Better: stop reverse-engineering provenance in three places — record it once (e.g. a `_RedirectAuto` flag, same `_`-prefixed internal-column pattern as `_ConsolidateTargetId`) and have 14503, 18289 and 18295 all read it.

### [correctness-risk] `main.js:1632`
**The from-scratch Sitemap sheet branch writes node notes/build guidance/writer brief without clampCell(), so a single over-long field aborts the entire xlsx export — and projects ALWAYS take this branch.**

- *Evidence:* Line 1632: `node.buildPattern || '', node.buildGuidance || '', node.writerBrief || '', node.pageStatus || '',` — no clampCell, unlike the sibling rewrite branch at 1606-1607: `newRow[colIdx.buildGuidance] = clampCell(node.buildGuidance || '');`
- *Impact:* readProject() sets `navSheetInfo = null` (main.js:760, "No xlsx behind a project — exports build the Sitemap sheet from scratch"), so the `if (navSheetInfo && workbook.Sheets[...])` guard at 1491 is always false for a .transmission project and the unclamped branch at 1616 always runs. clampCell exists precisely because "exceeding it makes the whole workbook write throw and aborts the save" (911-912). A single build-guidance/writer-brief/notes field over 32,767 chars (a pasted spec or long markdown brief on one node in a 500-node tree) makes File → Export Full Workbook fail outright with a raw SheetJS error — the client deliverable never gets produced, and the same failure hits Save As on a spreadsheet with no prior Sitemap sheet.
- *Proposed fix:* Wrap the long-text fields in the from-scratch row push (1626-1634) in the existing clampCell(): `clampCell(node.notes || ''), ... clampCell(node.buildGuidance || ''), clampCell(node.writerBrief || '')`. Better: build the row through one shared node→cells serializer used by both the rewrite (1583-1613) and from-scratch (1625-1635) branches so clamping can't drift between them again.

### [correctness-risk] `main.js:938`
**writeSettingsSheet silently DROPS any projectSettings key whose JSON exceeds 32,767 chars — including `menus`, `sitemapSettings`, and `savedFilters` — with only a console.warn.**

- *Evidence:* Line 938-941: `if (typeof serialized === 'string' && serialized.length > MAX_CELL) { console.warn(..."skipping it so the save can complete."); continue; }`
- *Impact:* `state.projectSettings.menus` (renderer.js:11378 — the whole Menus data model, one MenuItem ≈ 100 chars of JSON) and `sitemapSettings` (colorRules + per-node `nodeOverrides` across a 500+ node tree) are serialized into a single KKE_Settings cell. A few hundred menu items or a few hundred node color overrides crosses 32,767 chars, at which point every save to an .xlsx working file — and every Export Full Workbook from a project, the documented "round-trip path back to Excel" — writes a KKE_Settings sheet with that key simply absent. Reopening the file silently restores an audit with all its menus gone. The user sees a successful save and no toast; the only signal is a main-process console.warn they will never see.
- *Proposed fix:* Don't drop the key. Either spill oversized values across multiple `Key`/`Value` rows (e.g. `menus#0`, `menus#1`, reassembled by concatenation in parseSettingsSheet before the JSON.parse at 902-903), or give large structures their own structural sheet the way glossary/patternLibrary/contentTypeRegistry already do (they are destructured out at 924-930 for exactly this reason). At minimum, surface the drop to the renderer as a save warning instead of a console.warn.

### [correctness-risk] `src/renderer.js:22276`
**exportRedirectMap() (Migration → Export Redirect Map CSV) re-derives redirects from scratch instead of reading the resolver's output, so it silently drops every Consolidate page, emits the literal '404' sentinel as a 301 destination, and ignores Final_KKE.**

- *Evidence:* `const status = String(row[kke] || '').trim().toLowerCase();` … `if (customDest) { dest = customDest; }` … `'Destination URL': dest, 'Status Code': '301'` — there is no `consolidate` branch, no `dest === '404'` check, and `kke` is `kkeCol()`, never `finalKkeCol()`.
- *Impact:* This CSV is the redirect manifest handed to the client's ops team. (1) Consolidate rows have their nav assignment cleared by applyConsolidateTarget, so they carry no `Computed Path` and never match the `kill` branch — every consolidated page is absent from the file and will 404 in production, while the Migration Tracker's Redirects sheet does include them (buildRedirectsSheet, line 19269). (2) A row explicitly marked intentional-404 ships as `301 → 404`, a literal broken rule. (3) After an SME resolve pass, a page whose Final_KKE is Kill but whose KKE_Recommendation is Keep gets no redirect row. On a 4k-page migration this is a wrong client-facing deliverable produced silently.
- *Proposed fix:* Call `resolveRedirectDestinations()` (line 18232 — it already chases consolidate chains via `consolidateTargetAddr`, propagates the '404' sentinel, and skips `isFragmentRow`) and then emit one CSV row per non-blank `Redirect_Destination`, mapping `'404'` to a no-redirect/deindex disposition. This is exactly the pattern `buildRedirectsSheet()` already uses at line 19249.

### [correctness-risk] `src/renderer.js:19737`
**reportNetNewBrief (and three sibling reports) build their own Sitemap_ID→count map that counts Kill/Consolidate rows as live content, instead of calling the canonical _navPageCountsCache(), so net-new and coverage reports disagree with the Migration Tracker for the same project.**

- *Evidence:* `state.editedRows.forEach(row => { const navID = row['Sitemap_ID'] || ''; if (navID) pageCounts[navID] = (pageCounts[navID] || 0) + 1; });` — versus `_navPageCountsCache()` (line 15010): "Exclude Kill/Consolidate rows — those pages are going away; their Sitemap_ID is a redirect hint, not evidence that the page lives at that node."
- *Impact:* A node whose only assigned pages are being killed shows a page count > 0, so it is never flagged as net-new — the client is never told to write that page, and the site ships with a hole. The Migration Tracker's `Net New` column goes through navExportContext() → _navPageCountsCache() and *does* exclude them, so the two deliverables contradict each other on the same file. Same raw map at line 19350 (Migration Checklist net-new count), 20328 (Sitemap Coverage: Empty Leaves / Net New / Overloaded), and 19835 (Pre-Handoff Check's 'No empty sitemap leaves', which therefore passes on a sitemap with dead-only leaves).
- *Proposed fix:* Replace all four hand-rolled maps with `invalidateNavPageCountsCache(); const pageCounts = _navPageCountsCache();` — the same map the nav editor, Migration Tracker, and Treemap already use.

### [correctness-risk] `project-store.js:217`
**The changelog `auditor` column is captured and read back but silently dropped by the xlsx exporter, so a project -> xlsx -> project round trip permanently blanks every auditor attribution.**

- *Evidence:* readChangeLog() maps it: `.map(e => ({ timestamp: e.timestamp, auditor: e.auditor, row: e.row, ... }))` — but the only consumer, writeWorkbook (main.js:1720), declares `const clHeaders = ['Timestamp', 'Row', 'URL', 'Field', 'Old Value', 'New Value'];` and maps `changeLog.map(e => [e.timestamp, e.row, e.url || '', e.field, e.from, e.to])` — no auditor.
- *Impact:* The `auditor` column exists precisely for the multi-auditor workflow (there is a Merge Auditor feature), is populated with os.userInfo().username on every save (line 157/181), and is faithfully returned by readChangeLog — then thrown away at the only point it could reach a human. Two concrete costs: (1) the KKE_ChangeLog sheet in every exported workbook and every Package-for-Handoff deliverable shows *what* changed but never *who* changed it; (2) worse, on the supported round trip project -> Export Full Workbook -> open xlsx -> Save As Project, readWorkbookChangeLog (main.js:1834) hardcodes `auditor: ''`, so all historical attribution is permanently destroyed — the DB column that held it is reloaded as empty for every row. On a shared client audit this silently erases the accountability trail.
- *Proposed fix:* Add 'Auditor' to `clHeaders` in writeWorkbook (main.js:1720) and `e.auditor || ''` to the row mapper (main.js:1726), and read it back in readWorkbookChangeLog (main.js:1827-1835) as `auditor: String(r[6] ?? '')` with the existing `''` only as the fallback for genuinely pre-versioning sheets. The column index shift is safe because the sheet is rewritten wholesale on export.

### [correctness-risk] `src/renderer.js:22280`
**exportRedirectMap() (Migration → Export Redirect Map CSV — the file handed to the dev team) is a stale parallel reimplementation of resolveRedirectDestinations(): it silently drops every Consolidate redirect, exports the '404' sentinel as a live 301 destination, and does not exclude Fragment rows.**

- *Evidence:* exportRedirectMap has exactly two branches — `if (status === 'kill') {` (22280) and `if (computedPath) {` (22305). There is no `consolidate` branch, no `dest === '404'` check, and no `isFragmentRow(row)` guard, all three of which resolveRedirectDestinations() has (`if (isFragmentRow(row)) return;` 18276, `if (kke === 'consolidate')` 18281, `if (startUrl === '404') return '404';` 18246).
- *Impact:* A Consolidate row has its nav assignment cleared by design, so it has no Computed Path — it falls through both branches and produces NO row in the exported CSV. On a typical crawl where consolidation is a large share of the Kill/merge work, the redirect map shipped to the client's dev team is missing every consolidation 301, and any page deliberately marked for deindex ships as `Destination URL: 404, Status Code: 301`. buildRedirectsSheet() (19247) already shows the correct shape.
- *Proposed fix:* Delete the derivation and mirror buildRedirectsSheet(): call `resolveRedirectDestinations()` first, then read `row['Redirect_Destination']` per row, skipping `isFragmentRow(row)` and mapping the `'404'` sentinel to a 410/no-rule row. That makes the CSV, the Migration Tracker Redirects sheet, and the Redirect Editor all agree by construction.

### [correctness-risk] `src/styles.css:442`
**The selected-row highlight is silently cancelled by the KKE tint rules — a selected row with any KKE value renders with no selection background.**

- *Evidence:* .row-item.selected { background: rgba(99,102,241,0.22); … } is immediately followed by .row-item.row-kke-keep { background: rgba(34,139,34,0.03); } (and kill/evolve/consolidate/exclude).
- *Impact:* Both selectors have identical specificity (0,2,0), so source order decides and the later .row-kke-* rule wins. renderer.js:3052 stamps `row-kke-<value>` on every row that has a KKE set, so in a completed audit — i.e. most of a 4,000-row crawl — the currently-selected row loses its 22%-alpha highlight and keeps only a 3px left border. Note .row-item.multi-selected (line 448) sits AFTER the KKE rules and therefore does highlight correctly, which is why the bug reads as "multi-select highlights, click-select doesn't."
- *Proposed fix:* Move the .row-item.selected block below the .row-item.row-kke-* block (mirroring how .multi-selected is already ordered), or raise its specificity to .row-item.row-item.selected. Do not add !important — the file already has enough of those.

### [correctness-risk] `src/styles.css:1888`
**#toast sits at z-index 600 while openModal() allocates dialogs from z-index 1000 up, so every toast fired from inside a modal is painted behind the overlay/dialog.**

- *Evidence:* #toast { … z-index: 600; } vs renderer.js:1737 `const z = 1000 + _modalStack.length * 10;` (overlay = z, dialog = z+1).
- *Impact:* Toasts are the app's only feedback channel per UI_STANDARDS §5 ("Silent success erodes trust"). Any toast raised while a modal is open — "Seeded 57 components" from the Component Library, save/export success and error toasts from modal footers, weight-recompute confirmations from Project Settings — is dimmed by the rgba(0,0,0,0.3) overlay and fully occluded whenever the dialog reaches the bottom-centre of the viewport (.app-modal is max-height: calc(100vh - 48px) and centred; #toast is bottom: 24px; left: 50%). The user gets no confirmation that the action succeeded or failed.
- *Proposed fix:* Raise #toast above the modal stack — set z-index to a value above the highest allocated modal z (e.g. 5000), or better, derive it from the same constant openModal uses so the two can't drift apart again.

### [correctness-risk] `src/treemap-template.js:132`
**A treemap node that has children but whose box lands under the 70x50px container threshold renders grey instead of its real color, because the host only assigns `color` to leaf nodes.**

- *Evidence:* `if (!isContainer) box.style.background = node.color || '#9aa0ab';` — but renderer.js:13446-13451 sets `out.color` only in the `else` branch (`if (kids.length) { out.children = ... } else { out.color = resolveTreemapNodeColor(...); out.subtitle = ... }`), so any node with children has `color === undefined`.
- *Impact:* The engine's own comment (line 108-109) promises the opposite: "else it renders as a flat leaf using its own already-correct rolled-up value/color". There is no such color. On any real crawl, every section small enough to fall below MIN_CONTAINER_W/H — which on a 500-node tree with a long tail of small sections is most of them — paints the fallback grey #9aa0ab and shows no subtitle. A client reads grey as "no data / unclassified" when it actually means "Kill" or "Published". This ships in the client HTML export and the PDF.
- *Proposed fix:* Have buildTreemapNode() in renderer.js always compute `out.color` and `out.subtitle` (they are already correct rolled-up values from ctx.subtreeCounts / computeSubtreeKkeBreakdown), not only on the leaf branch — move those two lines out of the `else`. The engine already prefers children when a box is big enough, so an always-present color is only consumed on the small-box path it was documented for.

### [correctness-risk] `src/treemap-template.js:116`
**Squarify normalizes a container's children to fill 100% of the parent's rect, but the parent's value includes its own directly-assigned pages — so those pages are invisible and every child box is silently inflated.**

- *Evidence:* `layout(n.children, n._x + PAD, n._y + HEADER_H, n._w - PAD * 2, n._h - HEADER_H - PAD);` feeds the parent's whole inner rect to the children, whose scale is then `var scale = total > 0 ? (w * h) / total : 0;` (line 65) with `total` = sum of *children* values only. Host-side, `const value = ctx.subtreeCounts[node.id] || 0;` (renderer.js:13442) is the node's full subtree count = own direct pages + descendants.
- *Impact:* Box area stops being proportional to page count as soon as any container has pages assigned directly to it (extremely common — an `/about` landing page node that also has `/about/team` beneath it). A section with 100 own pages and one child holding 1 page renders as a big box entirely filled by that one child, reading as "all 101 pages live in the child". Pages assigned directly to a container have no box at all. This is the treemap's single load-bearing claim (area == volume of content) and it is wrong in exactly the sections a strategist cares most about; it ships to the client in HTML and PDF.
- *Proposed fix:* In buildTreemapNode() (renderer.js:13441), when a node has children AND direct pages of its own (`subtreeCounts[node.id] - sum(children subtree counts) > 0`), append a synthetic leaf child (label e.g. the node's own label, value = the direct count, colored/subtitled like any leaf) so the children's values sum to the parent's value. That restores the treemap invariant without touching the engine.

### [correctness-risk] `src/sitemap-template.js:586`
**The Visual Sitemap legend never describes the colors actually in play — it hardcodes "Color band = node depth" and shows three colorless card swatches, regardless of the active color rules.**

- *Evidence:* `'<div class="legend-note">' + esc(legend('interactionHint')) + '<br><b>Scroll</b> to zoom &middot; <b>Drag</b> to pan<br>' + esc(legend('colorBand')) + '</div>';` with `colorBand: 'Color band = node depth (customizable)'` (line 71). `fillLegend()` never reads `S.colorRules`.
- *Impact:* Every color scheme other than "Color by depth" ships a legend that actively lies. Color by top-level section, Color by field (Page Status, Phase, Build Pattern, the three assignee roles), and "Mark external links" all produce a diagram whose colors carry the real meaning, while the legend asserts the bands encode depth and shows no swatches at all. The client-shareable HTML export and the PDF are precisely where the legend is the only interpretive aid — the strategist isn't there to explain. The sibling treemap engine already does this correctly (`fillLegend()` at treemap-template.js:218-226 renders one `.l-sw` swatch per `DATA.legend` entry).
- *Proposed fix:* Rebuild `fillLegend()` to emit one swatch row per entry in `S.colorRules` (each rule already carries `{label, color}` — genDepthRules/genSectionRules/genFieldRules all populate `label`), plus a row for the fallback color and a count of node color overrides, and call it from `render()` so it stays in sync when rules change. Keep the static card/stacked/root rows and the interaction hint; drop the fixed `colorBand` sentence (or repurpose the editable key as the legend's heading).

### [correctness-risk] `main.js:2566`
**The computed-column evaluator silently resolves a column name that does not exist to 0, so a typo'd or renamed {Column} reference produces a plausible-looking wrong value for every row instead of an error.**

- *Evidence:* case 'ColumnRef': { const raw = row[ast.name]; if (raw === undefined || raw === null || raw === '') return 0;
- *Impact:* `undefined` (column absent from the sheet) is conflated with blank. `evaluate-computed-columns` receives only `{definitions, rows}` — never `headers` — so an unknown COL_REF can never be detected, and `errors` (line 2663) only collects *parse* failures. A formula like `classify({Sesions}, 0:"Kill", 40:"Evolve", 70:"Keep")` parses cleanly, evaluates to 0 on all 4,000 rows, and labels the entire inventory "Kill" — written straight into `state.editedRows` by recalculateComputedColumns (renderer.js:17567) and shipped to the client. Same failure when a crawl export renames a column between runs.
- *Proposed fix:* Pass `headers` in the `evaluate-computed-columns` payload and walk each parsed AST for `ColumnRef` nodes at parse time in `evaluateComputedColumns()` (main.js:2655), pushing `"<def.name>: unknown column {X}"` into `errors` — the renderer already surfaces `errors` as a toast (renderer.js:17561) and as inline `.cc-error` preview text (17524).

### [correctness-risk] `src/renderer.js:12237`
**showMenuNodePicker hand-rolls a bubble-phase Esc listener that the modal factory's capture-phase handler pre-empts, so Esc closes the dialog *underneath* the picker instead of the picker.**

- *Evidence:* showMenuNodePicker: `document.addEventListener('keydown', function esc(e) {` (bubble phase, line 12237) — while the factory registers `}, true);` (capture, line 1707) and does `e.preventDefault(); e.stopPropagation(); top.close(top.escapeValue);` (line 1695-1697).
- *Impact:* Both listeners sit on `document`. The factory's capture listener fires first, and its `stopPropagation()` means the picker's own Esc handler never runs. The picker is not on `_modalStack`, so `top` is the parent dialog. Two reachable paths: openBulkNavAssignDialog (openModal at :10622 → picker at :10592) and openMenuOrphansDialog (openModal at :12542 → picker at :12530). Pressing Esc while picking a sitemap node during a bulk assignment silently closes the bulk-assign dialog, discards the user's chosen targets, and leaves the orphaned picker overlay (z-index 1300) floating on screen over the app. UI_STANDARDS §9: 'The modal factory owns Esc (closes top modal)… Don't add competing global handlers inside a dialog.'
- *Proposed fix:* Delete the hand-rolled `esc` listener and the hardcoded `z-index:1300` (line 12207), and call the documented retrofit right after the overlay is appended: `registerModalDismiss(overlay, dialog, close)` (renderer.js:1882). That pushes the picker onto `_modalStack` so the factory's single handler targets it correctly and assigns a stacked z-index instead of a guessed ceiling. Same treatment for the other pickers that can open over an openModal dialog.

### [correctness-risk] `src/renderer.js:22687`
**The multi-bar's bulk Kill path silently skips Kill-cleanup because the only function that ever called `promptBulkKillCleanup` is dead code, leaving stale sitemap assignments and redirect destinations on killed pages.**

- *Evidence:* `applyMultiAction` kke branch: `row[kkeCol()] = value; logChange(...); return true;` — no cleanup. Meanwhile renderer.js:3329 `const ok = await promptBulkKillCleanup(toAsk);` sits inside `bulkAssignKke`, and codegraph_callers reports "No callers found for bulkAssignKke" (0 refs across main.js, preload.js, renderer.js, index.html, help.html).
- *Impact:* Every bulk 'Set KKE = Kill' from the Multi-bar (the only bulk KKE path still wired — `#multi-action` → `applyMultiAction`) leaves `Sitemap_ID` and `Redirect_Destination` populated on killed rows. Single-row Kill still prompts (`promptKillCleanup`), so the same action produces different data depending on how it was invoked. Downstream this corrupts client deliverables: killed pages keep a nav assignment that inflates the Migration Tracker's Sitemap Plan source-page counts, and stale redirect destinations get written into the exported Redirect Map. At 4,000-row crawls, bulk-Kill of a whole 3xx/4xx triage group is exactly when this fires — hundreds of rows at once.
- *Proposed fix:* Call the existing `promptBulkKillCleanup(targets.filter(i => state.editedRows[i][kkeCol()] !== 'Kill'))` from the Multi-bar Apply handler (renderer.js:22623) before the `applyMultiAction` loop when `a === 'kke' && v === 'Kill'`, mirroring what `bulkAssignKke` did. Then delete the now-redundant `bulkAssignKke` (3323) and `bulkAssignPublishedStatus` (3298), both fully superseded by `applyMultiAction`.

### [dead-code] `main.js:54`
**`AUDIT_COLUMNS` is never referenced — the real audit-column injection list is the local `auditCols` array inside `injectAndOrderAuditColumns` — yet CLAUDE.md instructs developers to add new columns to both, and the two have already drifted.**

- *Evidence:* `const AUDIT_COLUMNS = ['KKE_Recommendation', 'Tags', 'Notes', ...]` at main.js:54; grepping `AUDIT_COLUMNS` across main.js, preload.js and renderer.js returns only line 54 itself. The list that actually runs is `const auditCols = [columnMap.kke, columnMap.tags, ...]` at main.js:125, consumed by `auditCols.forEach(col => { if (!headers.includes(col)) { headers.push(col); ... } })` at main.js:140.
- *Impact:* This is a live trap, not just clutter. CLAUDE.md states new schema columns are "appended to `AUDIT_COLUMNS` and to the `auditCols` injection list in `main.js`" — a developer who follows the docs and adds a column only to `AUDIT_COLUMNS` gets no injection at all, so the column silently never appears in opened files and any renderer code writing to it produces a key that is dropped on save. They have already diverged: `AUDIT_COLUMNS` is missing `Redirect_Destination`, `Group` and `Primary Tag`, all of which `auditCols` injects.
- *Proposed fix:* Delete `AUDIT_COLUMNS` (main.js:54-67) and update the CLAUDE.md schema-additions note to name only the `auditCols` list in `injectAndOrderAuditColumns`. If a single named constant is wanted, hoist `auditCols` to module scope and have `injectAndOrderAuditColumns` build from it, so there is exactly one list.

### [docs-drift] `main.js:54`
**CLAUDE.md instructs devs to append new audit columns to `AUDIT_COLUMNS`, but that constant is declared once and never read — the real injection list is the separate `auditCols` array, and the two have already drifted apart.**

- *Evidence:* CLAUDE.md:345 — "…are appended to `AUDIT_COLUMNS` and to the `auditCols` injection list in `main.js`. Columns appear in every file on open."  `grep -rn AUDIT_COLUMNS` across main.js/preload.js/project-store.js/src/ returns exactly one hit: the declaration at main.js:54. The live list is `const auditCols = [...]` at main.js:125, which contains `'Redirect_Destination'` — a column AUDIT_COLUMNS (main.js:54-67) does not have.
- *Impact:* The single most dangerous stale claim in the file. A dev or agent adding the next audit column (the app adds them regularly — Design_Patterns, Page_Breadcrumb, _ConsolidateTargetId all landed this way) follows CLAUDE.md, edits AUDIT_COLUMNS, sees no effect, and ships a column that is never injected on file open — so it is blank/missing for every existing client project and absent from every xlsx export built off `state.headers`. The already-present `Redirect_Destination` drift proves this trap has been stepped in.
- *Proposed fix:* Delete the dead `AUDIT_COLUMNS` at main.js:54-68 (it is unreferenced) and hoist `auditCols` (main.js:125) out of `injectAndOrderAuditColumns` into a single module-level constant that both the injection loop and any future consumer read. Then correct CLAUDE.md:345 to name only that one list.

### [docs-drift] `src/renderer.js:117`
**CLAUDE.md documents `_sessionChangeLog`, `_globalSearchMatches` and `_globalSearchCurrent` as keys on the `state` object, but all three are module-level variables; `state._sessionChangeLog` does not exist.**

- *Evidence:* CLAUDE.md:240-242 lists them inside the `state` block (`_sessionChangeLog: [],  // audit trail entries`), and CLAUDE.md:517 says "`logChange(...)` pushes an entry to `state._sessionChangeLog`". Actual: `src/renderer.js:117  const _sessionChangeLog = [];` and `src/renderer.js:1268  let _globalSearchMatches = [];`. `grep -c 'state\._sessionChangeLog' src/renderer.js` → 0.
- *Impact:* Silent client-data corruption path. The change log is the audit trail written to the `KKE_ChangeLog` sheet / `changelog` table. A dev following CLAUDE.md writes `state._sessionChangeLog.push(entry)` — JS happily creates a new unread property, `buildSavePayload` (renderer.js:5251) reads the module-level array, and those audit entries are silently dropped on save with no error. Same class of failure for anyone extending Cmd+F search.
- *Proposed fix:* Move the three vars out of the `state` block in CLAUDE.md:240-242 into a short "module-level renderer vars (NOT on `state`)" note, and fix CLAUDE.md:517 to say `_sessionChangeLog` rather than `state._sessionChangeLog`. Alternatively actually move them onto `state` so the doc becomes true — but then every existing call site must change.

### [docs-drift] `main.js:453`
**The "Menu organization (post-reorg)" list in CLAUDE.md is stale for three of the eight menus: Migration, Reports and SME all differ from what `buildMenu()` actually builds.**

- *Evidence:* CLAUDE.md:47 — "**Migration** — Migration Tracker · Migration Checklist · Net New Brief · Redirect Map Report · Redirect Chain Check · Sitemap Coverage · Export Redirect Map (CSV)". Actual Migration submenu (main.js:453-458) has four items: Pre-Handoff Check… · Migration Tracker… · Export Redirect Map (CSV)… · Redirect Chain Check…. CLAUDE.md:48 — "**Reports** — Executive Summary · Content Inventory · SME Review Status (narrative reports only)"; actual Reports submenu (main.js:466-479) has ten items including Sitemap Coverage Report… (main.js:473) and Migration Checklist… (main.js:478). CLAUDE.md:49 — "**SME** — Export / Import / Resolve"; actual has a fourth, Compare KKE vs SME… (main.js:491).
- *Impact:* This list is the map anyone (agent or human) uses to find or place a menu item. Four commands documented under Migration actually live in Reports, the "(narrative reports only)" parenthetical is flatly false, and `menu-prehandoff-check` / `menu-kke-vs-sme` / `menu-suggest-unreviewed` / `menu-report-assignee-brief` are shipping features that appear nowhere in CLAUDE.md (0 mentions each). Someone adding a report will put it in the wrong menu or duplicate an existing one.
- *Proposed fix:* Regenerate CLAUDE.md:42-50 directly from the submenu arrays in `buildMenu()` (main.js:426-495), and add the four missing `menu-*` channels to the IPC table at CLAUDE.md:120-200.

### [duplication] `src/renderer.js:10776`
**clearNav() hand-rolls the field clearing that clearNavAssignment() already does, but omits logChange(), invalidateNavPageCountsCache() and the open-editor re-render — so the popover's Clear button behaves differently from every other un-assign path.**

- *Evidence:* row['Sitemap_ID']           = '';
  row['Sitemap_Destination'] = '';
  row['Computed Path']   = '';
  row['Sitemap_SortID']      = '';
  row['Page_Breadcrumb'] = '';   // vs clearNavAssignment(): logChange(origIndex, c, old, '') per column + invalidateNavPageCountsCache() + if (_navEditorOpen) renderNavEditor()
- *Impact:* Three parallel paths now un-assign a page: clearNav() (popover Clear, line 9814), clearNavAssignment() (Kill cleanup + the nav badge ×), and promptClearNavAssignment(). Only clearNav() skips the change log — the KKE_ChangeLog sheet silently loses the un-assignment, so a multi-auditor project cannot see who removed a page from the sitemap. It also leaves _navPageCountsCacheMap stale, which is the exact bug CLAUDE.md records as fixed in clearNavAssignment(); page counts, hub/NEW badges and the net-new tallies stay wrong until the next renderNavEditor(). The duplication has already leaked: line 2262 carries a comment 'Consistency with the manual clearNav()' next to a third copy of the orphan-leaf check.
- *Proposed fix:* Make clearNav() call clearNavAssignment(row, state.selectedIndex), then keep only its UI-specific tail (closeNavPopover / renderMetaFields / renderVisibleRows / showToast / showOrphanNodeDialog). The orphan-leaf check at 10794-10804 and the identical one at 2262-2270 should collapse into one helper.

### [duplication] `src/renderer.js:18232`
**Redirect destination resolution is implemented three times (save resolver, redirect editor, CSV export) and the three have drifted on chained consolidates, the 404 sentinel, and fragment exclusion.**

- *Evidence:* resolveFinalUrl in the save path recurses with a visited Set and propagates the sentinel — `if (targetExplicit === '404') return '404';` — while renderRedirectEditor's copy does a one-hop lookup that does the opposite: `else if (tExplicit && tExplicit !== '404') resolvedDest = tExplicit; else resolvedDest = String(targetRow[urlCol] || '').trim();` (21861-21862).
- *Impact:* Three concrete divergences: (a) a Consolidate chain A→B→C shows B's URL in the Redirect Editor but saves C's URL — the reviewer approves one thing and the file ships another; (b) when a consolidate master is marked 404, the editor displays the master's old live URL while the save writes '404'; (c) exportRedirectMap (22272) has no `isFragmentRow` guard at all, unlike resolveRedirectDestinations (18276) and renderRedirectEditor (21843), so the client-facing Redirect Map CSV — reachable straight from the unified Export dialog's `case 'redirects'` (17874) — emits 301 rules for embeddable content objects that have no public URL. Separately the editor copy uses `state.editedRows.find(...)` inside its row loop instead of the resolver's `rowByUrl` Map, which is O(n·m) — on a 4,000-row crawl with a few hundred consolidations that is millions of string compares per render.
- *Proposed fix:* Export resolveRedirectDestinations' inner `resolveFinalUrl` (plus its rowByUrl Map and the isFragmentRow guard) as one shared resolver and have renderRedirectEditor (21850-21911) and exportRedirectMap (22272-22325) call it for their display/export values instead of re-deriving. One resolver means the editor, the saved file, and the CSV can never disagree.

### [duplication] `src/renderer.js:18663`
**The "is this URL changing?" predicate and the "computed path → absolute URL" conversion are each hand-inlined at 7+ sites, and the two client reports use raw `siteDomain` instead of `getRedirectBaseUrl()`, so they emit relative destinations and a homepage fallback that was removed everywhere else.**

- *Evidence:* reportRedirectMap: `const finalDest = dest || (computed ? (siteDomain ? siteDomain + '/' + computed : '/' + computed) : defaultDest || '/');` (18663) — the `|| '/'` homepage fallback contradicts the documented "custom > nav path > default > blank (no more homepage fallback)" priority. The path-compare block `try { srcPath = new URL(url).pathname.replace(/\/+$/, ''); } catch (_) { srcPath = url; }` + `const destPath = '/' + computed.replace(/^\//, '').replace(/\/+$/, '');` is repeated verbatim at 3098, 18318, 18674, 19337, 21546, 21928, 22311. The domain-prefix expression `baseUrl ? baseUrl + '/' + p.replace(/^\//, '') : '/' + p.replace(/^\//, '')` is defined as a local closure three times (14468 `pathToRedirectUrl`, 19099 `nodeUrl`, 21518 `pathToUrl`) and inlined ~10 more times.
- *Impact:* reportRedirectMap (18631) and reportMigrationChecklist (19304) read `state.projectSettings.siteDomain` directly rather than `getRedirectBaseUrl()` (21703), which falls back to auto-detecting the origin from the crawl's own URLs. On any project where the user never filled in Site Domain — the common case early in an audit — those two client-facing reports print bare relative paths (`/about`) while the Redirect Editor, the CSV export, and the saved `Redirect_Destination` column all print absolute URLs. The reports also invent a `/` homepage redirect for Kill pages that the engine deliberately leaves blank.
- *Proposed fix:* Hoist two module-level helpers next to `getRedirectBaseUrl()`: `pathToUrl(p)` (the single domain-prefix rule) and `rowUrlIsChanging(row)` (the URL-vs-Computed-Path compare), then replace all 7 inline compares and all 13 prefix expressions with them. Have reportRedirectMap/reportMigrationChecklist call `getRedirectBaseUrl()` and drop the `|| '/'` fallback.

### [duplication] `main.js:3230`
**`sme-export-multi` is a verbatim copy of `sme-export`'s ~70-line ExcelJS worksheet build + JSZip &quot;-patch, and the two copies have already drifted.**

- *Evidence:* `if (lower.includes('address') || lower.includes('url')) col.width = 50;` … `xml.replace(/<formula1>(.*?)<\/formula1>/g, …)` — identical blocks at 3166-3223 and 3243-3281; only the validation strings differ (`errorTitle: 'Invalid decision'` vs `errorTitle: 'Invalid'`).
- *Impact:* Every SME-sheet change — the `'—'` placeholder (3195/3261), the column-width heuristic, the frozen header, the data-validation list, the &quot; workaround — must be made twice. The multi-file split-by-Content-Owner export is the one most likely to be handed to a client's SMEs, and it is the copy that silently keeps the old behavior when only the single-file path is fixed. Two ExcelJS/JSZip pipelines also means two places to get the xlsx XML patch wrong.
- *Proposed fix:* Extract `async function buildSmeWorkbookBuffer({ headers, rows, smeOptions, smeDecisionCol })` returning the patched nodebuffer; have `sme-export` write it to the chosen path and `sme-export-multi` loop it over `files`. Both handlers shrink to a dialog + a write.

### [performance] `src/renderer.js:3042`
**renderVisibleRows() destroys and rebuilds every visible row's DOM subtree on every scroll frame and on every row selection, instead of repositioning/reusing rows or just toggling the selection class.**

- *Evidence:* const existing = els.rowList.querySelectorAll('.row-item,.virtual-empty-msg');\n  existing.forEach(el => el.remove());
- *Impact:* Each call tears down ~40-50 rows × ~10 child elements (num cell, url cell, extra cols, flag, indicators, status badge, KKE badge) plus a click listener each, then recreates them all — ~500 element creations + listener bindings. It fires on every requestAnimationFrame during sidebar scroll (setupVirtualScroll, line 3208) AND on every selectRow (line 3237), which is the row-selection hot path: arrow-key/j-k walking a 4,000-row crawl rebuilds the entire visible window per keystroke purely to move one `.selected` class. selectRow also sets scrollTop first (3229-3233), which synchronously fires the scroll handler, so a single selection can paint twice.
- *Proposed fix:* Split the two concerns: keep a keyed pool of `.row-item` nodes (Map origIndex→el), reuse/reposition nodes still in range on scroll rather than remove+recreate, and for selection changes call a cheap `refreshRowSelectionClasses()` that only toggles `.selected`/`.multi-selected` on the existing nodes (the same pattern the multi-select handlers at 3274/3286 need). Delegate the row click listener once on `els.rowList` instead of binding per row (line 3198).

### [performance] `src/renderer.js:5383`
**`refreshRowInList(origIndex)` throws its argument away and does a full teardown/rebuild of every visible sidebar row; it is called from every per-keystroke edit handler, alongside `setDirty(true)` which rescans all rows.**

- *Evidence:* `function refreshRowInList(origIndex) { // With virtual scrolling, just re-render visible rows — the row may or may not be in the DOM currently\n  renderVisibleRows(); }` — the param is never read. Called on every `input` event: line 3501 (`state.editedRows[origIndex][h] = input.value; setDirty(true); refreshRowInList(origIndex);`) and line 3616 (CMS URL fields), plus every tag/pattern chip change (3856, 4052).
- *Impact:* Per character typed in Title / Meta Description / H1 / CMS-URL fields: `renderVisibleRows()` (3025) removes ~40 `.row-item` nodes and rebuilds each from scratch — every rebuilt row runs `state.headers.find(h => h.toLowerCase() === 'status code')` (a linear scan of ~50-200 crawl columns), a `new URL()` parse, `consolidateTargetAddr()`, ~12 `createElement`s and 2 `addEventListener`s. On top of that `setDirty(true)` calls `updateStatsBar()` (3351), which does `state.editedRows.filter(...)` over the whole inventory. At a 4,000-row crawl that is ~8,000 header comparisons, 40 URL parses, ~500 DOM node creations and a 4,000-row scan *per keystroke* — typing in the field bar visibly stutters.
- *Proposed fix:* Honor the argument: patch the one row in place — `const el = els.rowList.querySelector('.row-item[data-orig-index="' + origIndex + '"]')` (the attribute is already stamped at 3061) and update just its cells, falling back to `renderVisibleRows()` only when the row isn't currently mounted. Separately, hoist the `'status code'` header lookup out of the per-row loop, and make `setDirty` mark the stats bar dirty (recompute on rAF/idle) instead of rescanning all rows synchronously on every character.

### [performance] `src/renderer.js:578`
**The sidebar search input runs a full unfiltered scan of every row × every column AND a synchronous prefs disk write on every single keystroke — no debounce.**

- *Evidence:* `els.searchInput.addEventListener('input', e => { state.filterText = e.target.value.toLowerCase(); applyFilter(); window.electronAPI.savePrefs({ filterText: state.filterText }); ... })` (578-583).
- *Impact:* Two costs per keypress. (1) `applyFilter()` in 'All fields' scope does `rows.filter(({row}) => Object.values(row).some(v => String(v).toLowerCase().includes(q)))` (2696-2698) — on a 4,000-row Screaming Frog export with ~100 columns that is ~400k String()+toLowerCase() allocations, then `applySort()` + `renderRows()` + `updateStatsBar()`. If the `_consolidate-dead-target` KKE filter is also active it degrades further: that branch calls `rowConsolidateHasDeadTarget` → `findConsolidateTargetRow` → `state.editedRows.find(...)` (8993), a full linear scan per consolidating row, i.e. O(consolidates × rows). (2) `savePrefs` in main is `fs.readFileSync` + `fs.writeFileSync` of prefs.json (main.js:221-227) on the main process's thread — a blocking disk round-trip per character typed. Typing a 10-char query on a real client crawl does all of this 10 times.
- *Proposed fix:* Debounce both, reusing the pattern already present in this file: `setupGlobalSearch()` (1292-1296) does `clearTimeout(debounce); debounce = setTimeout(globalSearchUpdate, 150)`. Apply the same 150ms debounce to `applyFilter()` here, and debounce the `savePrefs({filterText})` call much longer (or move it to blur), since it is only persistence.

### [performance] `src/renderer.js:14006`
**Every keystroke in a nav slug input runs a full tree recalc + a full cascade over all audit rows + a sidebar re-render, with no debounce and no id→node index.**

- *Evidence:* `slugInput.addEventListener('input', () => onNavNodeEdit(node, 'path', slugInput.value));` (13627) → onNavNodeEdit does `snapshotNavPaths(); recalcDerivedFields(node); resolveNavReferences(); cascadeNavChangesToRows(oldPaths);` (14007-14011). cascadeNavChangesToRows then does `state.navNodes.find(n => n.id === navID)` **per row** (14476), `pageBreadcrumbOf(node)` per row (14481, itself walking the parent chain with more `.find`s), then `refreshAllConsolidateDisplays()` (14518, whose findConsolidateTargetRow at 8993 is a full `state.editedRows.find` per consolidating row) and `renderVisibleRows()` (14520).
- *Impact:* At the app's stated scale (4,000 rows / 500 nodes) a single typed character costs ~2M node lookups for the row join, several million more for the per-row breadcrumb walk, plus an O(consolidating × rows) sweep and a sidebar repaint — typing a slug in the Sitemap editor stalls per keypress. There is no id→node index anywhere: `state.navNodes.find` appears 54 times in this file.
- *Proposed fix:* (1) Debounce the slug input's cascade (commit on `change`/blur, or a ~250ms debounce) — the sanitizer already wires a blur commit at 13628, so the `input` listener can be dropped or debounced. (2) Add a memoized `navNodeById()` Map (invalidated alongside `invalidateNavPageCountsCache()`) and use it in cascadeNavChangesToRows, computeNodeUrlPath, computePageBreadcrumbLabels, isNavDescendantOf, and resolveNavReferences instead of the linear `.find`s.

### [performance] `src/renderer.js:16172`
**suggestNavFromUrl() re-parses every row's URL on every path level, and suggestBulkNavTarget() calls it once per selected row — quadratic work with a `new URL()` per iteration, run synchronously while opening the bulk sitemap-assign dialog.**

- *Evidence:* `while (testPath) { … for (const row of state.editedRows) { let rowUrl = …; try { const ru = new URL(rowUrl); … } }` (16166-16194), driven by `targets.forEach(origIndex => { … suggestNavFromUrl(url) …` (16209-16218) and called at `const suggestion = suggestBulkNavTarget(eligibleTargets);` (10525).
- *Impact:* Cost is targets × rows × pathDepth URL constructions. On a 4,000-row crawl, one suggestNavFromUrl() call already builds ~16k URL objects (fine for the single-row picker at 9936). But the Multi-bar 'Assign to Sitemap' action runs it for every unplaced target: filter to 1,000 unplaced pages and openBulkNavAssignDialog() does ~16 million URL parses on the main thread before the dialog paints — a multi-second-to-minute UI freeze on exactly the workflow (bulk initial placement) that is supposed to be the fast path.
- *Proposed fix:* Build the normalized-URL → Sitemap_ID index once (single O(rows) pass producing a Map keyed by lowercased origin+pathname, reusing the same normalization already inlined at 16174-16179), and pass it into suggestNavFromUrl as an optional second arg so suggestBulkNavTarget builds it once for the whole batch. Each per-row lookup then becomes a Map.get instead of a full table scan.

### [performance] `src/renderer.js:9781`
**applyConsolidationGroup triggers a full nav-tree rebuild once per consolidated row, and the dialog is only reachable from the nav editor so the re-render always fires.**

- *Evidence:* group.rows.forEach(({ origIndex, row }) => { … clearNavAssignment(row, origIndex); … })
- *Impact:* `clearNavAssignment` (2232) ends with `if (_navEditorOpen) renderNavEditor();`, and `openConsolidationCandidates` is wired only to `#btn-nav-consolidate-candidates` in the Sitemap toolbar (11168), so `_navEditorOpen` is always true here. `renderNavEditor` (13112) does a full `state.editedRows.forEach` page-count pass plus a full tree DOM rebuild. Applying one 20-page group on a 4,000-row crawl with a 500-node tree = 19 complete tree rebuilds + 19 full row scans back-to-back, then `applyFilter()` on top. The dialog is designed to be run group after group, so this compounds.
- *Proposed fix:* Give `clearNavAssignment(row, origIndex, opts)` a `{ deferRender: true }` (or split out a `clearNavAssignmentCore`), call that inside the loop, and do one `invalidateNavPageCountsCache()` + `if (_navEditorOpen) renderNavEditor()` after the forEach — right next to the existing `setDirty(true)` / `applyFilter()` at 9790-9791. Same pattern `bulkAssignRowsToBucketCore` already uses to batch without a per-row refresh.

### [performance] `src/renderer.js:11936`
**renderMenusView() is O(items² + items × navNodes): childrenOf() re-filters the whole item array once per parent, buildMenuItemRow does two linear state.navNodes.find() scans per row, and findMenuOrphans() rescans everything again — and the whole thing re-runs on every add/move/clone/kind-change.**

- *Evidence:* const childrenOf = (pid) => items.filter(it => (it.parentId || '') === (pid || ''));
- *Impact:* seedMenuFromContentTree with 'All levels' from all top-level sections mirrors the entire nav tree into one menu, so on a 500–800 node crawl a menu legitimately holds 500–800 items. Per renderMenusView() that is: ~N² parentId comparisons in renderMenuItemTree (640k at N=800); 2 × N × M id scans from menuItemLabel (11485) plus the `mi-sub` lookup (11982) (~1.3M at N=M=800); plus another N × M in findMenuOrphans (11735 → 12494). ≈2.5M comparisons plus 800 DOM rows rebuilt on *every* drag-drop reorder (moveMenuItem → renderMenusView, 12194), every item add, clone, remove, and kind change — a several-hundred-ms hitch per interaction on exactly the menus the seed button is designed to produce.
- *Proposed fix:* Two hoists, both cheap. (a) Build a parent→children Map once per renderMenuItemTree/menuToJsonTree/buildMenuExportSheet/cloneMenuItem pass instead of the per-parent `.filter()` closure (it is written out 4 separate times: 11936, 12085, 12365, 12391). (b) Add a `navNodeById(id)` helper backed by a Map rebuilt when state.navNodes changes — `state.navNodes.find(n => n.id === …)` appears 34 times across renderer.js with no index; there is only `findNavNode(number)` (10131), which keys on number, not id.

### [performance] `src/renderer.js:21856`
**renderRedirectEditor() does a full linear scan of state.editedRows inside its per-row loop (twice) plus a linear scan of state.navNodes, and the search box re-runs the whole thing on every keystroke with no debounce.**

- *Evidence:* `const targetRow = state.editedRows.find(r => String(r[urlCol] || '').trim() === target);` — inside `for (let i = 0; i < state.editedRows.length; i++)`; repeated at 21889; `state.navNodes.find(n => n.id === navID)` at 21903. Wiring at 21578: `$('redirect-search').addEventListener('input', () => renderRedirectEditor());`
- *Impact:* O(rows²). On a 4,000-row crawl with ~800 Kill/Consolidate rows that is ~3.2M String()+trim() comparisons per render, and the render also rebuilds every entry's DOM (no virtualization, 3 listeners per row). Because the search input is undebounced — unlike table-view-search (150ms, line 20860) and frUpdateView (150ms, line 21606) — this fires on every keypress, so typing in the redirect search visibly locks the UI at the scale this app is built for.
- *Proposed fix:* Hoist a `rowByUrl` Map and a `nodeById` Map once at the top of renderRedirectEditor (resolveRedirectDestinations already builds precisely this at line 18239) and look targets up in O(1); wrap the `redirect-search` input handler in the same 150ms debounce the two other search boxes in this file already use.

### [performance] `project-store.js:160`
**saveAll() deletes and re-inserts every row on every save, so the 2s debounced autosave re-serializes the entire crawl even when one cell changed.**

- *Evidence:* db.exec('DELETE FROM headers; DELETE FROM rows;');
headers.forEach((h, i) => insHeader.run(i, String(h)));
rows.forEach((r, i) => insRow.run(i, JSON.stringify(r)));
- *Impact:* I modelled this exact transaction (DELETE + re-INSERT all rows) at 4,000 rows x 70 columns — a normal Screaming Frog export width: 18.0 MB of JSON is re-stringified and rewritten per save, taking 85-120ms in the transaction, with ~58ms of that pure JSON.stringify. That is a main-process stall on the hot editing path: every KKE click / notes keystroke burst triggers the debounced autosave, so the user pays ~100ms of blocked main process every 2 seconds while auditing, plus the same 4k-row array being structured-cloned across IPC each time. The header comment's '~5ms at 4k rows' claim (CLAUDE.md repeats it) is off by ~20x for a realistic wide crawl. It gets worse linearly: an 8k-row crawl doubles it.
- *Proposed fix:* The rows table already has a stable `idx` primary key, so the full rewrite is unnecessary. Accept an optional set of dirty row indices in the saveAll payload (the renderer already tracks edits and logs row indices into `_sessionChangeLog`) and issue `INSERT OR REPLACE INTO rows (idx, data) VALUES (?, ?)` for only those, deleting only trailing indices when the row count shrank. Keep the full-rewrite path for the first save / Save-As-Project. Headers are tiny and can keep the delete+insert. This makes an autosave O(changed rows) instead of O(all rows).

### [performance] `main.js:3059`
**The computed-column tokenizer/parser/evaluator is pure JS with zero Node dependencies, yet lives in main — so recalculating forces a structured clone of the entire crawl to main and the results back, and re-spreads each row once per definition.**

- *Evidence:* ipcMain.handle('evaluate-computed-columns', (event, { definitions, rows }) => …) — called with `rows: state.editedRows` (renderer.js:17557), and inside: `const ctx = { ...row, ...computed };` (main.js:2672).
- *Impact:* At 4,000 rows × ~200 Screaming Frog columns, every 'Recalculate' serializes ~800k cells to main and clones the results back, blocking both processes; nothing in tokenizeFormula/parseFormulaExpr/evaluateAST (2346–2651) touches `fs`, `dialog`, or any other main-only API. On top of that, `{ ...row, ...computed }` allocates a fresh ~200-key object per definition per row — 5 definitions × 4,000 rows = 20,000 spreads / ~4M property copies of data the renderer already has in memory.
- *Proposed fix:* Move the tokenizer/parser/evaluator into a renderer-side module (e.g. `src/formula.js`, loaded before renderer.js like sitemap-template.js) and call it directly; delete the IPC hop and the preload bridge. If it must stay in main, build the context once per row (`const ctx = Object.create(row)` then assign computed values onto `ctx`) instead of re-spreading per definition.

### [performance] `src/renderer.js:21856`
**renderRedirectEditor() resolves every Kill/Consolidate row's target with an O(n) `state.editedRows.find()` (and an O(nodes) `state.navNodes.find()`) inside its per-row loop, and the whole thing re-runs on every keystroke of the redirect search box.**

- *Evidence:* const targetRow = state.editedRows.find(r => String(r[urlCol] || '').trim() === target);  // line 21856, again at 21889; plus `state.navNodes.find(n => n.id === navID)` at 21903 — all inside `for (let i = 0; i < state.editedRows.length; i++)`. Trigger: `$('redirect-search').addEventListener('input', () => renderRedirectEditor());` (line 21578).
- *Impact:* Quadratic in rows. At 4,000 rows with ~1,000 Kill/Consolidate rows that is ~4M string coercions + compares per render, plus up to 1,000×500 = 500k node scans — and it fires on EVERY character typed in the redirect search field. Fine at 500 rows (~60k ops, imperceptible); at 4k rows the search box becomes visibly laggy (hundreds of ms per keystroke) on top of the DOM rebuild in finding #2 below. The identical resolution in resolveRedirectDestinations() is already linear, so the same client file behaves fine on save and badly in the editor.
- *Proposed fix:* Hoist `rowByUrl` (a Map keyed on trimmed Address) and `nodeById` (a Map keyed on node.id) once, before the row loop. resolveRedirectDestinations() at line 18238 already builds exactly this Map (`const rowByUrl = new Map(); state.editedRows.forEach(...)`) — extract it into a shared `buildRowByUrlMap()` / `buildNavNodeIndex()` helper and have both call sites use it. Additionally, debounce the `redirect-search` input handler (~150ms) so a keystroke does not trigger a full entry rebuild.

### [performance] `src/renderer.js:22074`
**The redirect editor builds a full DOM row (with inputs and event listeners) for every matching entry with no virtual scrolling, unlike the sidebar and Table View which both already implement it.**

- *Evidence:* for (const entry of filteredEntries) { body.appendChild(renderRedirectRow(entry, baseUrl)); }  — preceded by `body.innerHTML = '';` (line 22067). No startIdx/endIdx windowing anywhere in renderRedirectEditor().
- *Impact:* On a 4,000-row crawl where most pages are Kill (a common end-state for a migration audit), filteredEntries can be 1,000–3,000 entries. Each renderRedirectRow() creates a row with a text input plus click/input listeners, so a single render can create 10k+ DOM nodes and thousands of listeners — a multi-hundred-ms stall — and it is torn down and rebuilt on every keystroke, every sort-header click, and every status-filter change. At 500 rows this is unnoticeable; at 4k it is the worst stall in the app.
- *Proposed fix:* Apply the virtual-scroll pattern that already exists twice in this file: fix a row height constant, set the container height to `filteredEntries.length * ROW_HEIGHT`, and render only the `[startIdx, endIdx]` window on scroll (mirror renderVisibleRows() at line 3025 / renderTableVisibleRows() at line 21162, including their `requestAnimationFrame` scroll throttle).

### [performance] `src/renderer.js:9049`
**refreshAllConsolidateDisplays() is O(consolidate-rows x total-rows) because findConsolidateTargetRow() does a linear `state.editedRows.find()` per row — and it runs before every autosave and after every sitemap edit, despite the comment calling it a "cheap full sweep".**

- *Evidence:* function refreshAllConsolidateDisplays() { state.editedRows.forEach((row, i) => refreshConsolidateDisplay(row, i)); }  → refreshConsolidateDisplay → findConsolidateTargetRow → `return state.editedRows.find(r => String(r[urlCol] || '').trim() === id) || null;` (line 8993). Doc comment on line 9047: "Refresh every consolidating row's display path from its identity (cheap full sweep)."
- *Impact:* Quadratic. Called from resolveConsolidateIntoUrls() (line 18222, which saveFile() calls on every 2s-debounced autosave) and from cascadeNavChangesToRows() (line 14518, after every nav drag/rename). At 4,000 rows with 20% Consolidate that is 800 × 4,000 = 3.2M string trims+compares per save and per sitemap edit — a repeated stall the user pays for while typing in the sitemap. Negligible at 500 rows (~50k ops).
- *Proposed fix:* Build the Address→row Map once and pass it down: `refreshAllConsolidateDisplays()` should construct it and hand it to `refreshConsolidateDisplay(row, i, rowByUrl)` / `findConsolidateTargetRow(row, rowByUrl)`. resolveRedirectDestinations() (line 18238) already builds this exact Map — extract it as a shared helper and reuse it across all three consumers.

### [performance] `src/renderer.js:14476`
**Nav-node ancestor and by-id lookups are all linear `state.navNodes.find()` scans with no index, so a single sitemap edit costs O(rows x nodes) in the cascade and O(nodes^2 x depth) in the recalc.**

- *Evidence:* cascadeNavChangesToRows: `state.editedRows.forEach(row => { ... const node = state.navNodes.find(n => n.id === navID); ...})` (line 14476). recalcDerivedFields: `cur = cur.parentNumber ? state.navNodes.find(n => n.number === cur.parentNumber) : null;` (line 14146) inside a per-node ancestor climb that then `node.children.forEach(child => recalcDerivedFields(child))`. Same linear parent hop repeated at lines 14051 (computeNodeUrlPath) and 14092–14094 (computePageBreadcrumbLabels).
- *Impact:* Every nav rename/slug edit/drag runs recalcDerivedFields on the moved subtree (each node climbing ancestors via an O(500) scan, and computeNodeUrlPath + pageBreadcrumbOf each re-climbing with their own O(500) scans) and then cascadeNavChangesToRows over all rows with another O(500) scan each. At 4,000 rows / 500 nodes / depth 4 that is ~2M scans in the cascade alone, plus ~1M in the recalc — a visible freeze after each drop in the sitemap. At 100 nodes / 500 rows it is imperceptible.
- *Proposed fix:* Maintain two Maps alongside state.navNodes — `_nodeById` and `_nodeByNumber` — rebuilt once whenever the tree structure changes (the same places that already call invalidateNavPageCountsCache()), and replace every `state.navNodes.find(...)` hot-path lookup with a Map get. This is a mechanical swap at the ~20 `state.navNodes.find` sites and turns the cascade into O(rows) and the recalc into O(nodes x depth).

### [performance] `src/renderer.js:578`
**Every keystroke in the sidebar search box runs an undebounced full-corpus filter AND an IPC call that does a synchronous read+write of prefs.json in the main process.**

- *Evidence:* els.searchInput.addEventListener('input', e => { state.filterText = e.target.value.toLowerCase(); applyFilter(); window.electronAPI.savePrefs({ filterText: state.filterText }); ... });  — and main.js:221 `function savePrefs(updates) { ... const merged = { ...loadPrefs(), ...updates }; fs.writeFileSync(prefsPath, JSON.stringify(merged, null, 2)); }`. applyFilter's default scope is `rows.filter(({ row }) => Object.values(row).some(v => String(v).toLowerCase().includes(q)))` (line 2701).
- *Impact:* Two compounding costs per character. (a) The 'All fields' scan is 4,000 rows × ~100 Screaming Frog columns = ~400k String()+toLowerCase() allocations, plus a fresh 4,000-object `{row, origIndex}` array (line 2683) — roughly 50-150ms per keystroke at 4k rows, so a 10-character query costs over a second of jank. (b) savePrefs does a synchronous readFileSync + writeFileSync on the MAIN process event loop per keystroke, blocking IPC/menus/window for the whole app. At 500 rows (a) is fine but (b) still hits the disk on every character.
- *Proposed fix:* Debounce the input handler (~150ms) around both applyFilter() and savePrefs; persist filterText on blur or on the trailing debounce edge only. For the scan itself, cache a per-row lowercased search blob (built once in loadData, invalidated in the edit path that writes to editedRows) and match against that instead of re-deriving Object.values().map(String).toLowerCase() on every keystroke.

### [ui-standards] `src/renderer.js:4061`
**renderDesignPatternChips writes hardcoded light-mode hex colors as an inline style, which overrides the stylesheet and silently kills the dark-mode rule that already exists for these exact chips.**

- *Evidence:* `chip.style.cssText = 'background:#ede9fe;color:#5b21b6;border-color:#c4b5fd;';` — the identical values already live in styles.css:1415 (`#design-pattern-chips .tag-chip { background: #ede9fe; color: #5b21b6; border-color: #c4b5fd; }`) and styles.css:2880 supplies the dark variant (`:root[data-theme="dark"] #design-pattern-chips .tag-chip { background: #2e1065; ... }`).
- *Impact:* Inline styles beat any stylesheet selector without `!important`, so styles.css:2880 is dead code — Component chips in the audit bar stay pale-lavender-on-dark in dark mode, the one cluster in the app that never themes. Violates golden rule 3 ('Never hardcode colors… use the CSS custom properties') and §7 ('Dark mode is automatic… verify contrast holds in both themes'). The chips are re-rendered on every row selection, so this is on the hot path for every page in a 4,000-row crawl.
- *Proposed fix:* Delete line 4061 entirely — `chip.className = 'tag-chip'` (line 4060) plus the container id `#design-pattern-chips` already select both the light rule (styles.css:1415) and the dark rule (styles.css:2880). No replacement needed; removing the inline style is the whole fix and restores dark mode for free.

## MEDIUM (73)

### [altitude] `src/renderer.js:3635`
**`setupClusterQuickToggles` hand-writes the same toggle three times and exposes a `window._refreshClusterQuickToggles` global back-channel, even though the chips already declare which cluster they control via a `data-cluster` attribute that the code ignores.**

- *Evidence:* Three near-identical blocks differing only in identifiers: `state.showSmeFields = !state.showSmeFields; window.electronAPI.savePrefs({ showSmeFields: … }); applySmeFieldsVisibility(); const settingsCb = document.getElementById('pref-show-sme-fields'); …` repeated for `showMigrationFields`/`pref-show-migration-fields` and `showDesignPatterns`/`pref-show-design-patterns`; then `window._refreshClusterQuickToggles = refresh;` (3692). index.html already carries `data-cluster="sme" | "migrate" | "patterns"` on the three chips (lines 170-172).
- *Impact:* There is no single place that knows what a 'toggleable audit cluster' is, so the fourth one has to be added in five places (state key, prefs key, apply* fn, App Settings checkbox id, chip id) and the App Settings checkboxes have to reach back through a `window.*` global to keep the chips in sync. The SME chip's handler also uniquely remembers to refresh the Decide cluster summary (3666) while the other two don't — exactly the copy-paste drift this shape invites.
- *Proposed fix:* Drive all three from one table keyed by the existing `data-cluster` value — `const CLUSTER_TOGGLES = { sme: { stateKey: 'showSmeFields', apply: applySmeFieldsVisibility, prefCb: 'pref-show-sme-fields' }, … }` — iterate `strip.querySelectorAll('.qt-chip')`, and export `refresh` on a module-scope binding the App Settings handlers call directly instead of hanging it off `window`. Always refresh cluster summaries after any toggle.

### [altitude] `src/renderer.js:22179`
**showRedirectNavPicker() is a second, weaker sitemap-node picker bolted onto the Redirect Editor instead of reusing showMenuNodePicker(), the shared picker every other surface already calls.**

- *Evidence:* showRedirectNavPicker hand-builds its own dropdown and sorts inside the keystroke handler: `const sorted = [...state.navNodes].sort((a, b) => (a.sortID || a.number || '').localeCompare(b.sortID || b.number || ''));` (22202), and filters on only two fields: `n.label.toLowerCase().includes(filter) || (n.breadcrumb || '').toLowerCase().includes(filter)` (22205). showMenuNodePicker (12197) orders via `sortNodesForNavigation(state.navNodes)` (12232), searches `[n.label, n.breadcrumb, n.number, n.computedPath, n.path]` (12243), indents by depth, and has an Escape handler.
- *Impact:* The Redirect Editor's picker can't be searched by node number or path (the two things an auditor actually has in hand when wiring a redirect), doesn't show hierarchy, and can't be dismissed with Esc — while the identical picker in the Menus view, the bulk sitemap assign, the breadcrumb-parent select, and the reference picker all can. It also re-sorts the full node list on every keystroke, which at 500+ nodes is a needless O(n log n) per character. Any future picker improvement has to be made twice.
- *Proposed fix:* Delete showRedirectNavPicker's body and call `showMenuNodePicker((node) => { … }, { title: 'Choose a redirect destination' })`, moving the existing destination-writing logic (destInput.value / entry.row[REDIRECT_DEST_COL] / setDirty) into the onPick callback and routing the path→URL conversion through the shared `pathToUrl()` helper.

### [correctness-risk] `src/renderer.js:3184`
**The extra-KKE sidebar badge gates on a hardcoded 4-value KKE vocabulary that predates Consolidate and ignores custom KKE states, so those values render as unstyled grey text while the main KKE column badges them correctly 15 lines earlier.**

- *Evidence:* const isKkeValue = ['keep','kill','evolve','exclude'].includes(val.toLowerCase()) ||
- *Impact:* `BUILTIN_KKE` (line 116) is `['Keep','Kill','Evolve','Consolidate','Exclude']` and `.kke-badge.consolidate` exists in styles.css:663. So when a user adds `Final_KKE` or `SME_Decision` as an extra sidebar column (the whole point of extraKkeCols), a Consolidate decision — and every user-defined custom KKE state, a documented feature — loses its colour and renders as 9px muted text, while the primary KKE column (line 3169) badges the same value fine because it applies `kke-badge` unconditionally. The auditor visually scanning the comparison column can't see Consolidate rows at a glance, which is precisely the workflow those columns exist for.
- *Proposed fix:* Drop the whitelist and mirror the primary badge: use the existing `allKkeStates()` helper (line 131) — `const isKkeValue = allKkeStates().some(s => s.toLowerCase() === val.toLowerCase()) || val.startsWith('Change:') || val === 'Approve';` — or simply apply `kke-badge` unconditionally like line 3169 does.

### [correctness-risk] `src/renderer.js:7310`
**The glossary editor discards its entire unsaved working copy on a stray backdrop click (and on Esc) with no dirty check or confirmation.**

- *Evidence:* overlay.addEventListener('click', close);  — where `close()` just removes the DOM (7304–7307) and the edits live only in the local `working` object, committed to state.projectSettings.glossary exclusively in the Save handler (7318).
- *Impact:* The editor lists an entry per known tag AND group (collectAllKnownNames scans every row's Tags cell), so a real session is many textareas of typed definitions. One click on the exposed backdrop — the dialog is only min(760px,92vw) wide, so the backdrop is a large target — throws all of it away with no warning and no undo. registerModalDismiss(7184) makes Esc do the same.
- *Proposed fix:* Track a dirty flag (set it in the textarea `input` listener at 7238 and the +Add handler), and in `close()` — plus the rawClose passed to registerModalDismiss — route through `confirmDialog({ title: 'Discard glossary changes?', … })` when dirty, mirroring how other editors guard unsaved work.

### [correctness-risk] `src/renderer.js:5100`
**The page-thumbnail cache is keyed by the webview's *resolved* URL but looked up by the row's *declared* URL, so any redirecting or normalized page never shows its thumbnail on hover.**

- *Evidence:* Capture: `try { url = wv.getURL(); } catch (e) { return; } … _thumbCache.set(url, dataUrl);` (5099-5106). Lookup: `const data = row && _thumbCache.get(String(row[state.urlColumn || 'Address'] || ''));` (5126).
- *Impact:* `wv.getURL()` returns the post-redirect, post-normalization URL. Screaming Frog exports are full of 3xx rows (the app has a whole Non-200 Triage flow for them), and bare-domain / non-canonical addresses get a trailing slash added by Chromium. For every such row the thumbnail is stored under a key no row ever hovers with, so the feature silently does nothing on precisely the rows an auditor most wants a visual on — and the cache fills with unreachable entries, evicting reachable ones via the 250-entry LRU.
- *Proposed fix:* Key the cache by the URL that was requested, not the one that resolved: have `loadUrl(url)` (5068) stash the requested URL (e.g. `_pendingThumbUrl = url`) and have `captureThumb()` write `_thumbCache.set(_pendingThumbUrl, dataUrl)` — guarding that the webview didn't navigate elsewhere in the meantime. Optionally also set the resolved URL as a second key so in-webview link-following still populates the target row.

### [correctness-risk] `src/renderer.js:1112`
**loadData() resets filter state in the wrong order and never clears kkeFilter/groupFilter, so the previous file's filters leak into a newly-opened file and the Unclassified button lies about its state.**

- *Evidence:* `1112: refreshUnclassifiedButton();` runs one line BEFORE `1114: state.fieldFilters = [];`. And the restore is guarded with no else: `1121: if (savedKkeFilter) { state.kkeFilter = ... }` / `1125: if (state.projectSettings.groupFilter) { state.groupFilter = ... }`.
- *Impact:* Open file A with the Unclassified filter on, then open file B: `refreshUnclassifiedButton()` reads A's still-populated `state.fieldFilters` and paints the button `.active`, then the array is emptied — so the button shows active while nothing is filtered, and the click handler (2563-2570), which keys off `state.fieldFilters` and not the class, will ADD the filter when the user clicks the already-'active' button to turn it off. Separately, if file A had a project-level `kkeFilter` (e.g. only Kill) and file B has none, `state.kkeFilter` is never reset — file B opens showing a filtered subset of its rows with no indication the filter came from another project. On a 4k-row crawl that reads as 'my import lost most of my pages.'
- *Proposed fix:* Move `refreshUnclassifiedButton()` to after the `state.fieldFilters = []` reset, and give the KKE/group restores an else branch that clears (`state.kkeFilter = []` / `state.groupFilter = ''`, followed by `renderKkeFilterOptions()` / `els.groupFilter.value = ''`) so filter state is unconditionally derived from the file being opened.

### [correctness-risk] `src/renderer.js:14588`
**moveNavNode's removeNavNodeFromParent still locates a node's parent by the stale-prone `parentNumber`, the exact failure mode `_findNavNodeLocation()` was written to fix — a miss silently duplicates the dragged subtree.**

- *Evidence:* `const parent = state.navNodes.find(n => n.number === node.parentNumber); if (parent) { const idx = parent.children.indexOf(node); if (idx >= 0) parent.children.splice(idx, 1); }` — vs. `_findNavNodeLocation` (15762) whose own comment says "by reference (not by parentNumber, which can be stale after reorganisations and cause silent deletion failures)".
- *Impact:* If `parentNumber` is stale, the lookup either finds nothing or finds the wrong node, `indexOf` returns -1, and no splice happens — but moveNavNode (14560-14572) unconditionally pushes/splices `dragged` into the target anyway. The node then exists in two places in state.navTree; flattenNavTreeForSave (14604) walks the tree and would emit it twice, writing a duplicate Sitemap node (duplicate Sitemap_ID) to the saved project. A drag-and-drop reorder is the single most common Sitemap-editor action.
- *Proposed fix:* Replace removeNavNodeFromParent's body with the existing helper: `const loc = _findNavNodeLocation(node, state.navTree); if (!loc) return false; loc.siblings.splice(loc.idx, 1); return true;` and have moveNavNode bail (with a toast) if it returns false, rather than pushing a node it failed to detach.

### [correctness-risk] `src/renderer.js:14407`
**updateNavEditorNodeDOM overwrites the path and breadcrumb cells with plain text, destroying the external-URL input and every override/warning marker the full render put there.**

- *Evidence:* `if (pathCell) pathCell.textContent = node.computedPath || '';` and `if (bcCell) bcCell.textContent = node.breadcrumb || '';` — but renderNavEditorNode puts an `<input>` + clear button in that same cell when `node.url` is set (13641-13665, and `pathCell.dataset.field = 'computedPath'` is assigned at 13640 *before* the branch), prefixes '↪ ' for URL overrides (13672), and prefixes '↰ '/'⚠ ' with colors + titles on the breadcrumb (13687-13696).
- *Impact:* onNavNodeEdit calls this for the edited node and every descendant (14016-14019), so editing one slug wipes the external-URL editor out of every descendant row that had one (the URL is still in the data, but the row now shows a computed path and the user cannot clear/edit it without reopening the view), and silently drops the ↪ override marker and the ⚠ breadcrumb-over-cap warning from those rows — the row stops reporting a state that is still true.
- *Proposed fix:* Have updateNavEditorNodeDOM skip the path cell when `node.url` is set, and reuse the same decoration logic as the renderer for the override/cap markers — extract the two cell-painting blocks from renderNavEditorNode into `paintNavPathCell(pathCell, node)` / `paintNavBreadcrumbCell(bcCell, node)` and call them from both places.

### [correctness-risk] `src/renderer.js:16077`
**executeDeleteNavNode() locates the node via the stale-prone parentNumber lookup and silently returns when it can't find it — while the caller has already promised the user the node was deleted.**

- *Evidence:* `const parent = node.parentNumber ? state.navNodes.find(n => n.number === node.parentNumber) : null; const siblings = parent ? parent.children : state.navTree; const idx = siblings.indexOf(node); if (idx < 0) return;` (16075-16078) — and the caller does `overlay.remove(); executeDeleteNavNode(node, mode, assignAction, reassignTargetNode); showToast(`Deleted "${node.label}"`, 'success');` (16009-16011), unconditionally.
- *Impact:* This is the exact failure mode _findNavNodeLocation() (15762) was written to fix — the docs record it as 'also delete this node failing silently after nav reorganizations that left stale parentNumber values' — but only deleteNavNodeFromEditor() was converted. Here a lookup miss produces a green 'Deleted X' toast with the node still in the tree and, worse, the assignment-reassignment loop below already skipped, so the user believes a destructive operation succeeded when nothing happened. cloneNavBranch() (15853-15856) uses the same fragile lookup and degrades even worse: `siblings.indexOf(node)` of -1 makes `siblings.splice(idx + 1, 0, cloned)` insert the clone at position 0 of the root tree instead of beside the original.
- *Proposed fix:* Use `_findNavNodeLocation(node, state.navTree)` in both executeDeleteNavNode() and cloneNavBranch() (reference equality, immune to stale parentNumber), and have executeDeleteNavNode return a boolean so checkAndExecute() only toasts success when the delete actually happened.

### [correctness-risk] `src/renderer.js:15816`
**cloneNavBranch() rebuilds each node from a hardcoded 8-field literal, silently dropping every extension field — nodeType, phase, notes, url, urlOverride, collapse, and all Build/Write/Migrate metadata.**

- *Evidence:* `const clone = { number: '', label: src.label + ' (copy)', path: src.path, sortID: '', parentNumber: '', breadcrumb: '', computedPath: '', id, children: [] };` (15828-15838) — no copy of src.nodeType / src.phase / src.notes / src.url / src.urlOverride / src.collapse / src.buildPattern / src.buildGuidance / src.writerBrief / src.pageStatus / src.buildAssignee / src.writeAssignee / src.migrateAssignee.
- *Impact:* Cloning a section to make a variant (the documented 'duplicate to edit independently' use) quietly converts Fragment and Header nodes into standard Pages and strips Phase — so the copies re-enter the in-menu IA, the empty/net-new/hub counts, the redirect resolver and the Migration Tracker export as live current-build pages, and every build/writer brief and assignee on the branch is lost. Nothing warns the user. cloneMenuItem(), the sibling feature, deep-clones all fields.
- *Proposed fix:* Spread the source node and override only the identity/derived fields: `const clone = { ...src, id, number: '', sortID: '', parentNumber: '', breadcrumb: '', computedPath: '', children: [] }` (keep refNodeId/breadcrumbParentId handling explicit — a cloned alias or breadcrumb re-root probably should still point at the original target).

### [correctness-risk] `src/renderer.js:17388`
**`applyUndoAction()` writes the reverted value straight into `editedRows` without a matching `logChange()`, so the persisted KKE_ChangeLog audit trail drifts from the actual saved data.**

- *Evidence:* L17390: `state.editedRows[action.origIndex][action.field] = val;` followed only by `setDirty(true)` — while the forward path `recordKkeChange()` (L17400-17403) does BOTH `pushUndo({...})` and `logChange(origIndex, kkeCol(), oldVal, newVal)`.
- *Impact:* Set a page to Kill, hit Cmd+Z, save. The file's KKE_Recommendation is back to 'Keep' but KKE_ChangeLog permanently records 'Keep → Kill' by that auditor with no reversal entry. The changelog is the multi-auditor accountability record that ships with the .transmission project and the exported workbook; a reviewer reading it will believe a decision was made that isn't in the data. Undo also bypasses `promptKillCleanup()`, so a Kill→Keep undo leaves the nav assignment / redirect that the Kill cleanup cleared.
- *Proposed fix:* In `applyUndoAction`, after computing `val`, call `logChange(action.origIndex, action.field, isUndo ? action.newValue : action.oldValue, val)` so the reversal is recorded like any other change.

### [correctness-risk] `src/renderer.js:16764`
**`gatherProgressStats()` silently reclassifies any row with an unrecognized (rogue) KKE value as 'Unreviewed', deflating the completion percentage in the client progress report.**

- *Evidence:* L16764-16765: `if (kke && kkeCounts.hasOwnProperty(kke)) kkeCounts[kke]++;` / `else unreviewed++;` — a non-empty `kke` that isn't a built-in or current custom state falls into the `unreviewed` bucket, and `reviewed = total - unreviewed` (L16781) is derived from it.
- *Impact:* Rogue KKE values are a known, expected condition — Project Settings ships a dedicated 'rogue-value cleanup' tool for them, and they arise routinely from SME round-trips, merged auditor files, and deleted custom states. A 4,000-row crawl with 300 rows carrying a stale/mis-cased value reports '3,700 reviewed (92%)' in the Audit Progress PDF the client sees, while the app's own sidebar '_unreviewed' filter would show those rows as decided. Reviewed count and the stacked bar disagree with reality with no warning anywhere.
- *Proposed fix:* Add a third bucket — count non-empty-but-unknown values into a `rogue` tally kept out of `unreviewed`, and surface it as its own 'Unrecognized status (N)' row in the dashboard and PDF (linking to the existing rogue-value cleanup), so the reviewed % stays truthful.

### [correctness-risk] `src/renderer.js:12416`
**buildMenuExportSheet emits rows only from menu items, so a menu with zero items vanishes entirely from the xlsx export — its name, placement, and description are never written — while menuToJsonTree still includes it. The two export formats disagree about what the project contains.**

- *Evidence:*     walk('', 0, []);
  });
- *Impact:* Menu name/placement/description are carried only on item rows (columns 1–3 of each pushed row), so `walk('', 0, [])` on an empty `items` array pushes nothing at all. An empty menu is a normal, meaningful state — created via `addMenu`/`promptCreateMenuFull` as a placeholder for a menu the client must build, or emptied during editing — and the xlsx is the human-readable CMS-import deliverable. The client receives a spreadsheet that silently omits a menu the project defines, while the JSON export of the same project (12383, `items: build('')` → `[]`) lists it. Nothing in openMenuExportDialog warns about the drop.
- *Proposed fix:* In buildMenuExportSheet, after `walk('', 0, [])`, emit a single metadata-only row (Menu / Placement / Description filled, Depth 0, Kind blank or 'empty') when the menu produced no rows — so every menu in the export scope appears in the sheet exactly as it does in menuToJsonTree.

### [correctness-risk] `src/renderer.js:17618`
**The Client Export and Filtered Rows exports only strip `_rowIndex`, so internal `_`-prefixed columns (notably `_ConsolidateTargetId`) ship inside client-facing spreadsheets.**

- *Evidence:* { name: 'Full (all columns)', builtin: true, columns: state.headers.filter(h => h !== '_rowIndex') }
- *Impact:* `_ConsolidateTargetId` is injected into every file's headers by main.js (auditCols, main.js:67), and it is documented as internal — "`_`-prefixed: hidden from Table View, never user-edited". Both the Client Export column grid (17629, same `h !== '_rowIndex'` filter) and exportFilteredRows (17886) therefore hand the client a column of raw old-site identity URLs, and the 'Full (all columns)' built-in profile checks it by default. Every other surface uses the established convention `!h.startsWith('_')` (Table View 20953/20961, field-filter picker 2596, 21432) — these two export paths are the only ones that don't.
- *Proposed fix:* Replace `h !== '_rowIndex'` with the existing convention `h !== '_rowIndex' && !h.startsWith('_')` at 17618, 17629 and 17886 (a shared `exportableHeaders()` helper would keep the four call sites honest).

### [correctness-risk] `src/renderer.js:18329`
**REPORT_CSS (the only stylesheet injected into exported report HTML/PDF) defines no CSS custom properties, but three report bodies style themselves entirely with var(--…) tokens — so those tokens are unresolvable in every exported file.**

- *Evidence:* REPORT_CSS opens `body { font-family: -apple-system, …; color: #222; }` with no `:root {}` block, while assigneeBriefBuiltinHtml emits `border-left:3px solid var(--accent);background:var(--bg-main);` (line 20223) and `font-family:var(--font-mono)` (20248). Someone already hit this and patched one spot with a fallback: `var(--kke-evolve-bg,#fff7ed)` (20219).
- *Impact:* exportReport() wraps the live preview's HTML in buildReportShell, which injects only REPORT_CSS. Every `var(--accent)` / `--border` / `--text-muted` / `--font-mono` declaration is invalid at computed-value time in the exported document, so the Migration Direction Brief PDF handed to a writer/builder loses its brief-box accent bars, table borders, muted-text hierarchy, and monospace URLs. Same for the Pre-Handoff Check (19856) and Sitemap Coverage (20375), the latter of which is exported by dumping `$('progress-body').innerHTML` verbatim (20430). The comment at 18375 states the convention these three violate: report bodies must hardcode colors for a white background.
- *Proposed fix:* Add a `:root { --accent:…; --border:…; --text-muted:…; --bg-main:…; --font-mono:…; --kke-*:… }` block (light-theme values from styles.css) to the top of REPORT_CSS — one edit, and both buildReportShell and buildReportShellRaw pick it up, so all three bodies and any future var()-using report export correctly.

### [correctness-risk] `project-store.js:236`
**The rolling backup overwrites the only existing backup in place, so a failed or damaged backup destroys the last good copy — and its failure is swallowed.**

- *Evidence:* const dest = path.join(destDir, path.basename(this.filePath) + '.backup');
return this.db.backup(dest).then(() => dest);
- *Impact:* `db.backup(dest)` writes directly onto the single fixed destination path. Two failure modes on real client data: (1) if the backup is interrupted (crash, disk full, app quit — it is explicitly fire-and-forget), `dest` is left as a truncated/invalid DB and the previous good backup is already gone; (2) it runs on *every* open (main.js:770), so opening an already-damaged project immediately overwrites the last good backup with the damaged state — the safety net erases itself exactly when it is needed. And main.js:770 does `.catch(() => { /* non-fatal */ })`, so the user is never told their only backup silently stopped being written.
- *Proposed fix:* Back up to a temp path in the same directory and atomically promote it: `const tmp = dest + '.tmp'; return this.db.backup(tmp).then(() => { fs.renameSync(tmp, dest); return dest; })`. Keep 2-3 timestamped generations rather than one fixed name so a bad open cannot clobber the last good copy. At the call site, surface a one-time toast on failure instead of swallowing it entirely.

### [correctness-risk] `project-store.js:188`
**The appVersion stamp written into every project's meta table is always empty in packaged builds, because npm_package_version only exists when launched via an npm script.**

- *Evidence:* this._setMeta('appVersion', process.env.npm_package_version || '');
- *Impact:* `process.env.npm_package_version` is injected by npm when it runs a script (`npm start` -> `electron .`), so this works in dev and is silently `''` in the shipped .dmg, which macOS launches directly. Every save by every real user therefore stamps `appVersion = ''`. This is the one field you would reach for when a schema migration goes wrong or a client's project opens oddly ('which build wrote this?'), and it has never contained a value in any release. Electron's correct accessor is already in use elsewhere in this codebase — main.js:2165 does `const current = app.getVersion();` for the update check — so the right value was available all along.
- *Proposed fix:* project-store.js deliberately does not require electron, so pass the version in rather than reading env: add an `appVersion` field to the saveAll payload from main.js (which can call `app.getVersion()`), and write `this._setMeta('appVersion', appVersion || '')`. Same one-line change in create() if you want a createdBy-version stamp.

### [correctness-risk] `main.js:2979`
**`export-progress-pdf` leaks its hidden BrowserWindow on any failure — the `win.close()` is inside the try block with no `finally`, unlike the sibling `export-sitemap-pdf` handler which gets this right.**

- *Evidence:* const win = new BrowserWindow({ show: false, width: 800, height: 600 }); await win.loadURL(…); const pdfData = await win.webContents.printToPDF(…); win.close();  … } catch (e) { return { success: false, error: e.message }; }
- *Impact:* If `loadURL` or `printToPDF` rejects — which is exactly what happens on the large reports this handler exists for — the hidden window is never destroyed. It keeps the full report DOM alive, keeps a renderer process running, and (since `window-all-closed` on darwin doesn't quit) accumulates one leaked window per failed export attempt for the rest of the session. Compare `export-sitemap-pdf` at 3329: `finally { if (win) { try { win.close(); } catch (_) {} } }`.
- *Proposed fix:* Hoist `let win = null;` above the try and close it in a `finally`, mirroring `export-sitemap-pdf` (3303/3329-3331) exactly.

### [dead-code] `src/renderer.js:2447`
**The `btn-save-filter` click handler in setupSavedFilters() is unreachable (the button is permanently hidden) and is a drifted copy of the live `__save__` branch — it silently omits fieldFilters from the saved bundle.**

- *Evidence:* btn.classList.add('hidden'); // hide the "+" button, use dropdown option instead
- *Impact:* ~16 lines of dead code that look authoritative. `src/index.html:70` ships the button with `class="btn-icon-tiny hidden"` and renderSavedFilterSelect() re-adds `hidden` on every render, so the handler can never fire. Worse, it is a stale duplicate: the live `__save__` path (2418-2424) persists `fieldFilters`, this copy (2453-2458) does not. Anyone who un-hides the button (or copies this block as the pattern) reintroduces saved filters that silently drop the user's arbitrary-field filters — a saved filter that quietly returns the wrong row set.
- *Proposed fix:* Delete the `btn.addEventListener` block (2447-2462) and the `btn` lookups at 2405/2467, and remove `#btn-save-filter` from index.html. If a '+' affordance is ever wanted back, have it call a single `saveCurrentFilter()` helper that the `__save__` option also calls, so the two can't drift again.

### [dead-code] `src/renderer.js:1405`
**Cmd+F counts matches in Table View and the Redirect Editor but navigation is a silent no-op there, and the `!_navEditorOpen` term in the guard is already unreachable.**

- *Evidence:* `if (!_tableViewOpen && !_navEditorOpen && !_redirectEditorOpen) {` — the nav case already returned six lines earlier (`if (_navEditorOpen) { … return; }`), and no branch exists for `_tableViewOpen` / `_redirectEditorOpen`.
- *Impact:* With Table View open (a primary working view for 4,000-row files), Cmd+F reports `"12 matches"` and then `"1 of 12"` as the user presses Enter, while nothing scrolls, highlights, or selects — the feature looks broken rather than unsupported. The redundant `!_navEditorOpen` term also misleads the next reader into thinking the nav case is handled here.
- *Proposed fix:* Drop the dead `!_navEditorOpen` term, and either route Table View matches through the existing virtual-scroll row targeting (the same pattern `scrollToNavNode` uses for the tree) / the Redirect Editor's existing scroll-to-current-page logic, or hide `#global-search-bar` (and skip the Cmd+F handler) while those views are open so the count can't advertise a capability that isn't there.

### [dead-code] `src/renderer.js:5659`
**The abort check inside `runBatchAssessment()` can never fire — nothing in that code path ever sets `_batchAssessAbort` to true — so a batch AI run cannot be cancelled once started.**

- *Evidence:* 5650: `_batchAssessAbort = false;` … 5659: `if (_batchAssessAbort) break;` — the only assignment of `true` in the file is 5722, inside runSuggestForUnreviewed's `const onAbort = (e) => { if (e.key === 'Escape') _batchAssessAbort = true; };`.
- *Impact:* Bites at real crawl scale: with no sidebar filter, `state.filteredRows` is every row, and the loop sleeps 1s per row (5686). A 4,000-row crawl is a ~70-minute uninterruptible loop spending Claude API credits per row, with the UI showing a per-row toast and no stop control. The identical loop written 60 lines below has a working Esc-to-cancel — the drift is pure copy-paste divergence.
- *Proposed fix:* Both loops are the same pipeline (loadRubrics → per-row assessRow + assessRowLLM → 1s rate limit → error tally → computeSuggestedKke → toast). Extract one `runAssessBatch({ rows, writeKke })` that installs the Esc `onAbort` listener in a try/finally (5722–5745) and have runBatchAssessment and runSuggestForUnreviewed both call it; that removes the dead branch and the divergence at once.

### [dead-code] `src/renderer.js:112`
**The entire nav-tree sidebar filter feature is unreachable: `_navTreeFilter` is only ever assigned `null`, and the modal it belongs to is only ever hidden, never shown.**

- *Evidence:* Every reference in the file: `112: let _navTreeFilter = null;`, `2786: if (_navTreeFilter) {`, `11158: _navTreeFilter = null;`. And the only reference to its modal anywhere in renderer.js is `16147: $('navtree-modal').classList.add('hidden');` — nothing ever removes the `hidden` class (index.html:1000 declares `<div id="navtree-modal" class="hidden">`).
- *Impact:* Dead surface kept alive at startup: `setupNavTree()` (renderer.js:11151-11162) wires three listeners to a modal that cannot be opened, `closeNavTree()` (16145) is unreachable, the `#navtree-modal` markup ships in index.html, and `applyFilter()` carries a filter branch (2786-2787) that can never fire. This was collateral from the Chunk iii removal of the audit-bar Tree button (documented in CLAUDE.md) — the view moved to the view switcher but this filter path was left behind. Anyone reading applyFilter has to reason about a filter axis that does not exist.
- *Proposed fix:* Delete `_navTreeFilter` (112), the filter branch in `applyFilter()` (2786-2787), `closeNavTree()` (16145), the three `btn-navtree-close` / `navtree-overlay` / `btn-navtree-clear-filter` listeners in `setupNavTree()`, and the `#navtree-modal` block in index.html. Sidebar-by-node filtering is already served by the field-filter system (`state.fieldFilters` + `fieldFilterMatches`).

### [dead-code] `src/renderer.js:14676`
**addNavChildNode and addNavRootNode try to focus a label `<input>` that no longer exists — the row label has been a static span since the editor moved renaming into the modal.**

- *Evidence:* `const input = wrapper.querySelector('.ne-cell-label input'); if (input) { input.focus(); input.select(); }` — but the only children ever appended to `.ne-cell-label` are `labelText` (a `span.ne-label-text`, 13583-13601) and the build-indicator span (13608). The selector can never match.
- *Impact:* Dead `setTimeout` + query on both add paths (and the same block in cloneNavBranch at 15871). More importantly the affordance it was meant to provide is gone: adding a node now leaves a literal "New Node" / "New Root" row with no focus and no inline rename — the user must find and click the ✎ button. Adding a section of ten pages means twenty extra clicks.
- *Proposed fix:* Delete the three dead setTimeout blocks, and if the intent (rename immediately) is still wanted, call `openNavNodeEditor(newNode)` after `renderNavEditor()` — the modal is now the only rename path.

### [dead-code] `src/renderer.js:16145`
**The legacy nav-tree modal is unreachable: nothing ever un-hides #navtree-modal/#navtree-overlay, and _navTreeFilter is only ever assigned null — so closeNavTree() and its whole supporting cast are dead.**

- *Evidence:* `function closeNavTree() { $('navtree-overlay').classList.add('hidden'); $('navtree-modal').classList.add('hidden'); }` (16145-16148). Grep across the repo: `classList.remove('hidden')` is never called on either element, and `_navTreeFilter` has exactly two writes — its declaration `let _navTreeFilter = null;` (112) and `_navTreeFilter = null;` (11158).
- *Impact:* Carries a dead sidebar-filter branch in applyFilter() — `if (_navTreeFilter) { rows = rows.filter(…) }` (2786-2787) — that can never be true, plus three no-op listeners in setupNavTree() (11155-11163), the #navtree-* markup in src/index.html (999-1009), the #navtree-modal/#navtree-overlay/#navtree-body CSS (styles.css 2506-2540), and `#btn-navtree.nav-editor-active` (styles.css 4103) whose element no longer exists. Every future reader has to prove this is dead again, and the fake filter hook invites someone to 'reuse' it.
- *Proposed fix:* Delete closeNavTree(), the _navTreeFilter declaration and its applyFilter() branch, the three setupNavTree() listeners, the #navtree-* DOM in index.html, and the corresponding CSS blocks. The Sitemap editor (#nav-editor) is the only tree UI now.

### [dead-code] `src/renderer.js:17015`
**`renderKkeButtons()` still builds a full set of bulk KKE buttons for `#bulk-bar`, an element that no longer exists — the Multi-bar replaced it.**

- *Evidence:* L17015: `const bulkGroup = document.querySelector('#bulk-bar .kke-btn-group');` — `grep -rn 'id="bulk-bar"' src/` returns nothing (only `#multi-bar` exists, index.html:104). The `bulk-kke-btn` class it stamps on (L17020) has zero other references: no CSS rule, no click handler. The codebase itself notes at L22569: `// Replaces the old separate "batch-bar" (filtered) and "bulk-bar" (selected) pair.`
- *Impact:* Ten lines of unreachable button-construction that read as live code in the hottest, most-edited function of the KKE system. The next person adding a KKE state will dutifully keep this branch working and may 'fix' the null guard rather than delete it, and anyone grepping `bulk-kke-btn` to find the bulk handler finds a class that is created but never styled or listened to.
- *Proposed fix:* Delete L17014-17025 (the `bulkGroup` block) — the Multi-bar drives bulk KKE through `#multi-action` + `applyMultiAction(row, origIndex, 'kke', value)`, not through per-state buttons.

### [dead-code] `src/renderer.js:11100`
**updateRedirectBadge() is entirely unreachable — its host element #btn-redirects was deleted from index.html in Chunk iii, so the guard returns on every call and the audit bar has silently lost its redirect indicator.**

- *Evidence:* const btn = $('btn-redirects');
  if (!btn) return;   // grep src/index.html: 'btn-redirects' NOT FOUND
- *Impact:* ~46 lines of JS (badge build, URL-shortening label logic, the × clear-redirect handler with its logChange) plus 4 CSS rules (.redirect-badge, .rb-text, .rb-clear, :hover at styles.css:2396-2428) are dead. Worse than dead: this is a lost feature, not just dead code — an auditor in the audit view now has no visible indication that the selected page carries a Redirect_Destination, and no one-click way to clear it. updateNavBadge() calls it on every row selection for nothing. Two other null-safe stragglers (21778, 21803) reference the same missing element.
- *Proposed fix:* Either re-home the badge onto an element that exists (the view-switcher Redirects tab, or the Decide cluster) and drop the null guard, or delete updateRedirectBadge() plus its three call sites (10993, 11139, 21811) and the four .redirect-badge CSS rules. Do not leave it half-alive.

### [dead-code] `main.js:54`
**`AUDIT_COLUMNS` is never referenced anywhere in the codebase, yet it is the list CLAUDE.md tells developers to add new audit columns to — and it has already drifted from the list that actually does the injection.**

- *Evidence:* `const AUDIT_COLUMNS = ['KKE_Recommendation', 'Tags', 'Notes', '_Flagged', ...]` — grep for `AUDIT_COLUMNS` across main.js, preload.js, project-store.js and src/renderer.js returns only this definition line.
- *Impact:* The real injection list is the inline `auditCols` array inside injectAndOrderAuditColumns (125-139). The two have already diverged — `Redirect_Destination` is in the live list but absent from AUDIT_COLUMNS. CLAUDE.md's schema section says new columns are "appended to AUDIT_COLUMNS and to the auditCols injection list in main.js", so a developer following the documented pattern can add a column to AUDIT_COLUMNS, see nothing happen, and ship a half-wired column. It is a live trap, not just dead bytes.
- *Proposed fix:* Delete `AUDIT_COLUMNS` (54-67) and make injectAndOrderAuditColumns build its list from the columnMap keys plus a single exported `EXTRA_AUDIT_COLUMNS` const — one list, actually consumed. Update the CLAUDE.md schema note to name only that list.

### [dead-code] `preload.js:68`
**Four main->renderer event bridges are subscribed by the renderer but never sent by main — vestigial channels left behind by the menu reorg.**

- *Evidence:* onMenuExportFiltered:(cb) => ipcRenderer.on('menu-export-filtered',  ()     => cb()),
onMenuExportAudit:   (cb) => ipcRenderer.on('menu-export-audit',     ()     => cb()),
- *Impact:* I diffed every `ipcRenderer.on` channel in preload.js against every `send()` in main.js: `menu-export-filtered`, `menu-export-audit` (preload.js:68-69), `menu-ga-kke-settings` (:81) and `menu-suggested-kke-settings` (:84) have zero senders in main.js. The renderer dutifully registers handlers for all four (src/renderer.js:476, 477, 505, 516) that can never fire. These paths were superseded by the unified Export dialog and the Project Settings -> Suggestions tab, but the wiring was left half-removed, so the code reads as if four menu commands still exist. CLAUDE.md's IPC table (lines 169-170) still documents `menu-export-filtered` and `menu-export-audit` as live channels, so the docs actively mislead the next person.
- *Proposed fix:* Delete the four bridges from preload.js and their four subscriptions in src/renderer.js:476-477, 505, 515-516 (the target functions exportFilteredRows / exportAuditDecisions / openGaKkeConfigDialog / openSuggestedKkeSettings stay — they are still reached from the Export dialog and the Suggestions tab). Remove the two stale rows from the CLAUDE.md IPC table.

### [dead-code] `src/styles.css:2506`
**The entire legacy nav-tree modal — markup, CSS, and teardown code — is unreachable; nothing ever opens it.**

- *Evidence:* #navtree-modal / #navtree-overlay / #navtree-header / #navtree-body / .navtree-node / .navtree-toggle / .navtree-label / .navtree-count / .navtree-children / .has-gap (styles.css:2504–2579). grep across renderer.js, index.html, main.js and the template modules finds zero constructors for .navtree-node et al.; the only renderer code that touches it is closeNavTree() (renderer.js:16145–16147), which hides an element that starts hidden.
- *Impact:* ~75 lines of CSS, 13 lines of markup (index.html:998–1010) and three event listeners (renderer.js:11155–11161) for a modal that has been superseded by the full-panel #nav-editor. It is a live maintenance trap: the classes look load-bearing to anyone touching the sitemap code, and #btn-navtree-clear-filter / #navtree-stats read like a working filter UI.
- *Proposed fix:* Delete the #navtree-* block from styles.css, the modal from index.html, and closeNavTree() plus its listeners from renderer.js. The Sitemap view (#nav-editor) is the sole surviving tree UI.

### [dead-code] `src/styles.css:456`
**#bulk-bar / #batch-bar CSS survives the multi-bar consolidation, and renderer.js still tries to populate a #bulk-bar that no longer exists in the DOM.**

- *Evidence:* styles.css:456 `#bulk-bar { … }`, :465 `#bulk-bar.hidden`, :533 `#batch-bar { … }`, :543 `#batch-bar.hidden`, :550 `.bulk-clear-btn` — neither id exists in index.html (renderer.js:22569 confirms: "Replaces the old separate 'batch-bar' (filtered) and 'bulk-bar' (selected) pair"). renderer.js:17015 still runs `document.querySelector('#bulk-bar .kke-btn-group')`.
- *Impact:* The querySelector always returns null, so the guarded block that rebuilds bulk KKE buttons for custom KKE states (renderer.js:17015–17025) is a permanent no-op — dead code that reads as a working feature. Anyone adding a custom KKE state and wondering why it doesn't appear in a bulk bar will chase this. Same for the dead .bulk-kke-btn class it creates. Also dead alongside it: `#btn-navtree.nav-editor-active` (styles.css:4103) and `#btn-redirects.redirect-editor-active` (:3546) — buttons removed in Chunk iii.
- *Proposed fix:* Delete the #bulk-bar / #batch-bar / .bulk-clear-btn rules and the two dead active-state rules from styles.css, and remove the dead bulkGroup block at renderer.js:17015. The live element is #multi-bar (index.html:104), styled via .bulk-count.

### [dead-code] `main.js:3392`
**`export-nav-tree` hardcodes three `show*` flags to `true` and then branches on them five times each, and one of those always-on columns ("Menu") is fed by `inMenu` — the legacy field the UI no longer lets anyone edit.**

- *Evidence:* const showPages = true;  const showMenu  = true;  const showNotes = true;  … if (showMenu)  headers.push('Menu');  … if (showMenu)  { r[extraIdx++] = row.inMenu || ''; }
- *Impact:* Two kinds of rot in one place. The `if (showPages/showMenu/showNotes)` guards are unreachable-false branches on both the indented and flat paths (3398-3411, 3416-3426), obscuring the actual column layout and the fragile `extraIdx` arithmetic. More importantly the client-facing Sitemap xlsx always ships a "Menu" column populated from `node.inMenu` (renderer.js:13012-13013), which per the current data model is legacy — its editor controls were repurposed to `node.collapse` — so every export hands the client a column of frozen, un-editable, meaningless Y/blank values.
- *Proposed fix:* Drop the three constants and their guards, emitting Number/Level*/Pages/[Phase]/Notes unconditionally; drop the 'Menu' column and the `inMenu` field from the row shape in `exportNavTree` (renderer.js:13012-13022). If a per-node flag genuinely belongs in the client export, emit `collapse` — the field the UI actually writes.

### [dead-code] `preload.js:68`
**`menu-export-filtered` and `menu-export-audit` are documented as live main→renderer IPC channels, but nothing in the app sends them — the preload bridges and renderer listeners are unreachable.**

- *Evidence:* CLAUDE.md:169-170 — "| main → renderer | `menu-export-filtered` | none — export filtered rows |" / "| `menu-export-audit` | none — export audit decisions |". Repo-wide grep (excluding .md): the only senders are `docs/dev/winnow-salvage/winnow-main.js:194,198` — an archived salvage file, not the live main process. Live `main.js` never sends either. The receivers `preload.js:68-69` and `src/renderer.js:476-477` (`window.electronAPI.onMenuExportFiltered(() => exportFilteredRows())`) can therefore never fire; both exports are now reached only through `openUnifiedExportDialog()` (renderer.js:17872-17873).
- *Impact:* Two of ~72 documented IPC channels are phantom. Anyone debugging "why doesn't File → Export filtered fire" chases a channel that no menu item sends. Low runtime cost, but it makes the IPC table — the doc's most-trusted reference section — provably unreliable.
- *Proposed fix:* Delete `preload.js:68-69` and `src/renderer.js:476-477`, and remove rows CLAUDE.md:169-170 from the IPC table. `exportFilteredRows()` / `exportAuditDecisions()` stay — they are still called by the unified export dialog.

### [dead-code] `src/renderer.js:16145`
**An entire legacy 'navtree' modal — markup, close handlers, CSS, and a sidebar filter branch — is unreachable: `closeNavTree()` exists but there is no `openNavTree()` and nothing ever removes `.hidden` from it.**

- *Evidence:* `function closeNavTree() { $('navtree-overlay').classList.add('hidden'); $('navtree-modal').classList.add('hidden'); }` is the only function touching it. Grepping `navtree` across renderer.js returns zero `classList.remove('hidden')` / show / open calls for `#navtree-modal` or `#navtree-overlay`. Its own preceding comment says: "Nav tree: legacy modal open/close for old overlay references".
- *Impact:* Dead surface across four files: index.html:999-1009 (`#navtree-overlay`, `#navtree-modal`, `#navtree-header`, `#navtree-body`, `#navtree-footer`, `#navtree-stats`, `#btn-navtree-close`, `#btn-navtree-clear-filter`); renderer.js:11155-11162 (three event listeners registered on every startup for a modal that cannot open); styles.css:2506-2579 (~14 rules incl. `.navtree-node`, `.navtree-toggle`, `.navtree-label`, `.navtree-count`, `.navtree-children` — zero JS creates these classes) plus styles.css:4103 `#btn-navtree.nav-editor-active` (no `id="btn-navtree"` exists in index.html at all, so the null-guards at renderer.js:11319 and 11362-11364 are also permanently false). It also strands `_navTreeFilter` (declared renderer.js:112, read in `applyFilter()` at 2786-2787, but its only assignment anywhere is `_navTreeFilter = null` at 11158) — so the per-node sidebar filter branch can never be true.
- *Proposed fix:* Delete `closeNavTree()`, the three listeners in `setupNavTree()`, the index.html block, the styles.css `navtree` rules, the `$('btn-navtree')` null-guard branches, and `_navTreeFilter` together with its dead branch in `applyFilter()`.

### [dead-code] `preload.js:33`
**Four preload bridges have no renderer caller; three of them keep a matching `ipcMain.handle` alive, and one of those is the sole writer of a prefs key that main.js still reads — making the per-file rubric-directory override permanently unreachable.**

- *Evidence:* `setFileRubricDir: (payload) => ipcRenderer.invoke('set-file-rubric-dir', payload)` — zero `electronAPI.setFileRubricDir` references in renderer.js or index.html. Its handler (main.js:2764) contains the only write to the pref: `savePrefs({ fileRubricDirs: dirs })` (main.js:2774), while main.js:2757 still reads `const perFile = prefs.fileRubricDirs?.[fileName];`.
- *Impact:* `prefs.fileRubricDirs` can never be populated, so the per-file rubric-dir lookup at main.js:2757 is a permanent no-op — a whole feature that looks implemented but cannot be triggered from the UI. The same zero-caller check flags three more bridges: `getCurrentPath` (preload.js:12, handler main.js:1962), `evaluateFormula` (preload.js:48, handler main.js:3050 — a redundant single-rule entry point; the live path is `evaluateComputedColumns`, which reuses the same `parseFieldRule`/`evaluateFieldRule` helpers, so those helpers stay), and `removeAllListeners` (preload.js:132). CLAUDE.md still documents `get-current-path` in its IPC table.
- *Proposed fix:* Either wire `setFileRubricDir` to the App Settings rubric-dir picker (renderer.js:6113, which currently only calls `pickRubricDir()` and sets the input value without persisting a per-file override), or delete it along with `fileRubricDirs` and its read at main.js:2757. Delete the `getCurrentPath`, `evaluateFormula` and `removeAllListeners` bridges plus the `get-current-path` and `evaluate-formula` handlers, and drop `get-current-path` from the CLAUDE.md IPC table.

### [dead-code] `src/renderer.js:19087`
**`computeNodeReadinessWarnings()` deliberately returns `[]`, but is still wired into the nav export column set — so every Migration Tracker export ships a permanently blank 'Readiness Warnings' column to the client.**

- *Evidence:* `function computeNodeReadinessWarnings(node) { // Intentionally empty. See comment above.\n  return []; }` (renderer.js:15001). It is still a column def: `{ key: 'readiness', label: 'Readiness Warnings', wch: 30, get: (n) => computeNodeReadinessWarnings(n).join(' · ') }` (renderer.js:19087), and `navExportDefaultColumnKeys()` returns `navExportColumnDefs().map(d => d.key)` (renderer.js:19092) — i.e. every key, readiness included, pre-checked in both export dialogs (renderer.js:18865 and 19013).
- *Impact:* Client-facing deliverable defect: the Migration Tracker 'Sitemap Plan' sheet and the Sitemap's 'Filtered nodes → Excel' export both ship a 30-char-wide 'Readiness Warnings' column that is always empty, which reads to a client as "nothing was assessed" rather than "this check is off". Two other call sites also burn work for nothing: renderer.js:13197 `state.navNodes.reduce((acc, n) => acc + computeNodeReadinessWarnings(n).length, 0)` runs on every `renderNavEditor()` (a full pass over 500+ nodes summing zeros), and renderer.js:14910 computes `warnings` per row in `buildNavRowBuildIndicators`.
- *Proposed fix:* Since CLAUDE.md says the function is kept intentionally so callers survive, keep the function but drop the `readiness` entry from `navExportColumnDefs()` (renderer.js:19087) so the blank column stops shipping, and short-circuit the stats reduce at renderer.js:13197. Re-add both when rules are restored to the function.

### [docs-drift] `CLAUDE.md:349`
**CLAUDE.md routes seven separate features through the File menu that the menu reorg moved elsewhere — including one item the same document elsewhere admits was deleted.**

- *Evidence:* CLAUDE.md:349 — "**Settings dialog** (`openSuggestedKkeSettings()`): File → Suggested KKE Settings… opens a modal" — no such menu item exists in `buildMenu()`, and CLAUDE.md:682 itself says "Standalone GA KKE Settings and Suggested KKE Settings menu items are removed". Also stale: CLAUDE.md:281 "File → Export Migration Tracker…" (actually Migration → Migration Tracker…, main.js:456); CLAUDE.md:350 "File → Run Rubric on filtered rows…" and :352 "File → Recompute Suggested KKE" (both Project menu, main.js:441-443); CLAUDE.md:602/605/608 "File > SME Export/Import/Resolve" (SME menu, main.js:488-492); CLAUDE.md:675 "File → Project Settings" (Project menu, main.js:431); CLAUDE.md:682 "App Settings popover (⚙ button, or File → App Settings)" (actually Preferences…, Cmd+, in the app menu, main.js:433).
- *Impact:* Every one of these is a load-bearing entry point a dev is sent to when tracing a feature. The Suggested-KKE one is worst: the doc gives step-by-step UI instructions for a menu item that does not exist, and contradicts itself 300 lines later, so a reader cannot tell which half is current.
- *Proposed fix:* Sweep CLAUDE.md for `File →` / `File >` and rewrite each against `buildMenu()` (main.js:426-495). Delete the "File → Suggested KKE Settings…" sentence at CLAUDE.md:349 entirely and point it at Project Settings → Suggestions tab, which is where `refreshSuggestionsTab()` already lives.

### [docs-drift] `src/renderer.js:5202`
**The documented `save-file` payload shape is wrong on the key name and omits two fields — the doc says `editedRows`, the code sends `rows`.**

- *Evidence:* CLAUDE.md:512 — "`saveFile()` → `electronAPI.saveFile({ headers, editedRows, changeLog? })`". Actual `buildSavePayload()` at src/renderer.js:5202-5256 builds `{ headers, rows: state.editedRows.map(...), newNavNodes?, allNavNodes?, projectSettings?, changeLog? }` — the wire key is `rows`, and `newNavNodes` (renderer.js:5206) is undocumented anywhere. The IPC table at CLAUDE.md:126 gives a third, also-incomplete shape (`{ headers, rows, allNavNodes?, projectSettings? }` — no `changeLog`, no `newNavNodes`).
- *Impact:* `save-file` is the single write path for all client audit data, both xlsx and `.transmission`. Two doc sections disagree with each other and both disagree with the code. A main-process change written against `payload.editedRows` reads `undefined` and would save an empty sheet; a change that forgets `newNavNodes` silently drops user-created sitemap nodes.
- *Proposed fix:* Make CLAUDE.md:512 and CLAUDE.md:126 both cite the single real shape emitted by `buildSavePayload()` (renderer.js:5202), including `newNavNodes` and `changeLog`, and note that `buildSavePayload` is the one place that shape is defined.

### [docs-drift] `main.js:125`
**`GA_KKE_Recommendation` and `GA_Score` are listed in the "Audit columns" table under the heading "Columns are injected into every file if not already present" — but neither string appears anywhere in main.js.**

- *Evidence:* CLAUDE.md:316 heading: "Columns are injected into every file if not already present"; CLAUDE.md:332-333 then lists `| GA_KKE_Recommendation | Controlled (computed) |` and `| GA_Score | Numeric (computed) |`. `grep -rn 'GA_KKE_Recommendation\|GA_Score' main.js` → no matches; the `auditCols` injection list (main.js:125-139) does not contain them. They are created lazily in the renderer by the GA compute pass, which splices them into `state.headers` (src/renderer.js:7392-7393, 7710-7716) only when a user configures GA.
- *Impact:* A dev writing any consumer that reads `row['GA_Score']` after file open — a report, an export column, a filter — will get `undefined` on every project that never ran GA setup, because the column genuinely is not there. The table's framing promises it always is. Wrong client-facing deliverable (blank/undefined column in an exported xlsx) is the realistic failure.
- *Proposed fix:* Split the CLAUDE.md:318-343 table into "injected on open (from `auditCols`, main.js:125)" and "created on demand by a compute pass", putting `GA_KKE_Recommendation`, `GA_Score` — and, for the same reason, verifying `Suggested_KKE`/`_AssessmentResult` — in the correct half.

### [duplication] `src/renderer.js:7244`
**The glossary editor hand-rolls a second markdown toolbar instead of calling `attachMarkdownToolbar()`, which is defined 1,400 lines earlier in the same file and already used by the node editor.**

- *Evidence:* body.querySelectorAll('._gloss-md').forEach(btn => { … switch (btn.dataset.md) { case 'bold': inserted = `**${sel || 'bold'}**` … } })  — while attachMarkdownToolbar/applyMarkdownAction (5846–5951) implement the same thing and are used at 15516–15518.
- *Impact:* Two markdown editors with drifted behavior: the glossary version has no toggle-off (re-clicking Bold on already-bold text wraps it again), no heading/quote/numbered-list buttons, and no Cmd+B / Cmd+I shortcuts, all of which the shared helper has. It also finds its textarea via `btn.closest('div').nextElementSibling` (7247), which breaks if the entry markup is ever reordered. Every future markdown fix has to be made twice.
- *Proposed fix:* Delete the `._gloss-toolbar` markup (7223–7229) and the `._gloss-md` handler block (7244–7266); after appending each entry, call `attachMarkdownToolbar(entry.querySelector('._gloss-textarea'))` — it inserts its own toolbar above the textarea and already dispatches the `input` event the working-bucket listener at 7237 relies on.

### [duplication] `src/renderer.js:4466`
**Two client-facing reports each hand-roll their own hardcoded KKE colour map instead of calling the existing `resolvedKkeColor()`, so any custom KKE state the project defines renders unstyled in the deliverable.**

- *Evidence:* `const colors = { Keep: '#16a34a', Kill: '#dc2626', Evolve: '#d97706', Exclude: '#6b7280', Consolidate: '#7c3aed' };` appears verbatim inside `kkeStyle()` in `reportDesignPatterns` (4466) and again inside `kkeStyle()` in `reportContentTypeCrosswalk` (4558). Meanwhile `resolvedKkeColor(label)` (16801) already resolves the `--kke-*` CSS variables *and* falls back to `state.customKkeStates.find(s => s.label === label).color`.
- *Impact:* Custom KKE states are a first-class, documented feature (Project Settings → KKE States, with a colour picker). In the Component Inventory and Content Type Crosswalk reports — both exported to PDF/HTML and handed to the client — every custom state's KKE breakdown renders in plain black with no weight, so the two reports disagree with the rest of the app and with each other's colour semantics if the tokens are ever retuned. The hex values are also frozen copies of the `:root` tokens and will drift silently.
- *Proposed fix:* Replace both local `kkeStyle()` helpers with a single shared one built on `resolvedKkeColor(v)` (which already handles custom states and reads the live tokens) — reports need resolved values rather than `var()` because they are exported standalone. While there, drop `function kkeClass(v)` at 4461: it is defined inside `reportDesignPatterns` and never called (the report only ever uses `kkeStyle`).

### [duplication] `src/renderer.js:1096`
**The default visible-fields list is written twice — once as main.js's DEFAULT_VISIBLE_FIELDS, once hardcoded in the renderer — and the renderer's copy silently overrides a user who has hidden all meta fields.**

- *Evidence:* `const defaults = ['Title 1', 'Status Code', 'Indexability Status', 'Redirect URL'];` (1096), duplicating `DEFAULT_VISIBLE_FIELDS` in main.js:198-203, which `get-prefs` already applies (`visibleFields: prefs.visibleFields || DEFAULT_VISIBLE_FIELDS`, main.js:2213).
- *Impact:* Two drift costs. (1) CLAUDE.md tells a maintainer 'Change default visible fields: Edit DEFAULT_VISIBLE_FIELDS in main.js' — but for any user whose saved `visibleFields` is `[]`, the renderer's private copy is what actually applies, so editing main.js has no effect. (2) `[] || DEFAULT` short-circuits to `[]` (an empty array is truthy), so a user who deliberately removes every meta field gets the four defaults re-seeded on every file open and can never make that choice stick. The same parallel-vocabulary problem exists at 358-365, where `pageTypeLibrary` defaults are hardcoded in the renderer while every other default library (design patterns, content-type registry, pattern library) is served from main via IPC.
- *Proposed fix:* Delete the renderer's copy — `get-prefs` already returns the default when prefs is unset, so `state.visibleFields` is authoritative on arrival. If empty-array-means-defaults is intended, express it once in main.js (`prefs.visibleFields?.length ? prefs.visibleFields : DEFAULT_VISIBLE_FIELDS`). Move the `pageTypeLibrary` seed to main alongside `DEFAULT_DESIGN_PATTERN_LIBRARY` and fetch it over the existing IPC pattern.

### [duplication] `src/renderer.js:14428`
**refreshDuplicateSlugHighlights re-implements buildDuplicateSlugSet's sibling-duplicate logic but omits the reference-node exclusion, so the incremental update flags aliases the full render does not.**

- *Evidence:* refreshDuplicateSlugHighlights: `for (const sib of siblings) { const slug = (sib.path || '').trim().toLowerCase(); if (!slug) continue; ... }` — vs buildDuplicateSlugSet (13478-13480), which is the same group-by-slug logic but with `if (child.refNodeId) continue; // alias — slug not part of URL hierarchy`.
- *Impact:* Typing a slug that collides with an alias sibling paints a false "Duplicate slug in this branch" warning on both rows; the warning then disappears on the next full renderNavEditor(), which excludes aliases. Two copies of one rule, already drifted once — any future change to duplicate detection has to be made twice.
- *Proposed fix:* Extract the group-by-slug core into one helper, e.g. `duplicateSlugIdsAmong(siblings)` returning a Set (honoring the `refNodeId` skip), and have both buildDuplicateSlugSet's `scan()` and refreshDuplicateSlugHighlights call it.

### [duplication] `src/renderer.js:9237`
**The title-column resolution is hand-rolled inline in 15 places instead of joining the existing state.columnMap accessor family.**

- *Evidence:* const titleCol = state.headers.includes('Title 1') ? 'Title 1' : state.headers.includes('Title') ? 'Title' : null;
- *Impact:* Three copies inside this slice alone (9175 in `findEvolveDestinationConflicts`, 9237 in `openConsolidatePicker`, 9677 in `renderCandidateGroup`); `grep -c` finds 15 across renderer.js. The file already has a column-accessor family for exactly this — `kkeCol()`, `tagsCol()`, `notesCol()`, `groupCol()`, `primaryTagCol()`, `finalKkeCol()` (136-144), all backed by `computeColumnMap()` in main.js, which honors a per-project column mapping. Title is the one audit-adjacent column that opted out, so a client whose crawl names the column anything but `Title 1`/`Title` gets blank titles in the Consolidate picker, the duplicate-destination warning, and the Consolidation Candidates list — with no way to remap it in App Settings like every other column.
- *Proposed fix:* Add `title` to `computeColumnMap()` (with a `TITLE_CANDIDATES` list: `Title 1`, `Title`, `Page Title`) and a `titleCol()` accessor next to the others at line 136, then replace all 15 inline ternaries with `titleCol()`.

### [duplication] `src/renderer.js:18048`
**showAuditorConflictDialog is a copy of openSmeResolveDialog that dropped the out-of-vocabulary-value handling, so a per-row conflict cannot be resolved to the other auditor's value when that value isn't in this project's KKE states.**

- *Evidence:* ['', ...allKkeStates()].forEach(v => { … });   // no preselect, no injection of c.theirKke
- *Impact:* Custom KKE states are per-project (KKE_Settings), so a merged auditor file routinely carries a state this project doesn't define. The per-row select then offers no option matching `theirKke` and nothing is preselected, while 'Accept All Theirs' (18101, `c.row[kkeCol()] = c.theirKke`) writes that same value happily — the bulk path accepts what the per-row path cannot even represent, and the user must hand-pick a value for every conflict. The SME twin already fixed this with a comment explaining why: 'The SME's own wording may not be a state this project currently defines … offer it anyway' (20757-20760).
- *Proposed fix:* Factor the two dialogs' shared body (they are ~120 near-identical lines over the same #sme-resolve-* DOM) into one `openConflictResolveDialog({title, rows, leftLabel, rightLabel, suggestedOf, apply})`, carrying the SME version's option-injection + preselect (`if (c.suggested && !finalOptions.includes(c.suggested)) finalOptions.push(c.suggested)`) for both.

### [duplication] `src/renderer.js:17807`
**The unified Export dialog's "has at least one decision" count uses a different predicate than exportAuditDecisions, so the number it advertises is not the number of rows it exports.**

- *Evidence:* const decisionCount = state.editedRows.filter(r => {
    return ['KKE_Recommendation', 'Tags', 'Notes', 'Group', 'Primary Tag'].some(h => { … })
- *Impact:* exportAuditDecisions actually keeps any row where one of `[kke, tags, notes, group, primaryTag, 'Sitemap_ID', 'Sitemap_Destination']` is non-blank (17902/17910). Sitemap placement is done in bulk for hundreds of rows, so on a real audit the dialog says e.g. '400 rows have at least one decision' and the CSV then contains 1,200. The dialog's own description text also lists Sitemap_ID but omits Sitemap_Destination, compounding the drift. The literal-name-array-then-ternary-remap in the counter is also a parallel vocabulary for the columnMap accessors it ends up calling anyway.
- *Proposed fix:* Extract one `auditDecisionHeaders()` + `rowHasAuditDecision(row)` pair and have both openUnifiedExportDialog's count and exportAuditDecisions' filter call it — the count and the export then cannot disagree.

### [duplication] `main.js:1500`
**Nav-node column↔property knowledge is spelled out in five independent parallel lists; adding one nav field today means editing eight places, which is what let the clampCell bug (finding 1) drift in.**

- *Evidence:* Line 1500-1538: eight copy-pasted blocks — `if (!nsHeaders.includes('RefNodeID')) { nsHeaders.push('RefNodeID'); nsData[0] = nsHeaders; }` … repeated verbatim for InMenu/URL/Url_Path/Breadcrumb_Parent/Collapse/Notes/Phase — sitting 40 lines above `const ensureCols = [...]; ensureCols.forEach(c => {...})` (1540-1546) that does exactly the same thing in a loop.
- *Impact:* The same nav schema is restated in NAV_HEADER_TO_KEY (711-720), parseNavSheet's `idx` map (800-828) and its node literal (840-869), writeWorkbook's ensure-ladder (1500-1551) + `colIdx` map (1553-1580) + `newRow` assignments (1585-1611), and the from-scratch header array + row array (1620-1634). They have already diverged: the from-scratch branch emits `Nav_Layer` while the ensure-ladder deliberately does not, and only the rewrite branch clamps long cells. Every future nav field (the CLAUDE.md pattern says there will be more) pays the eight-edit tax and risks another silent one-branch omission.
- *Proposed fix:* Declare one `NAV_COLUMN_DEFS = [{header:'Notes', key:'notes', long:true}, ...]` and derive all five consumers from it: NAV_HEADER_TO_KEY = Object.fromEntries(defs.map(...)), parseNavSheet's idx/node build, the ensure list, the colIdx map, and both write branches (applying clampCell where `long`). As an immediate low-risk step, fold lines 1500-1538 into the existing `ensureCols` array at 1540.

### [duplication] `src/renderer.js:19341`
**Redirect derivation is written five times with drifted rules; reportMigrationChecklist's URL-changed branch ignores the row's explicit Redirect_Destination and the '404' sentinel, so its redirect manifest contradicts the Redirect Editor and the CSV export.**

- *Evidence:* `redirects.push({ url, dest: siteDomain ? siteDomain + destPath : destPath, title: row[titleCol] || '' });` — `dest` (the row's Redirect_Destination) is read at 19319 and consulted only in the `kke === 'Kill'` branch above; the URL-changed branch never looks at it, nor at `dest === '404'`.
- *Impact:* A page with a hand-edited destination in the Redirect Editor shows one destination in the Migration Checklist and a different one in the CSV export (which uses `customDest || destinationUrl`, line 22320) — two client deliverables from the same file that disagree. A non-Kill row marked intentional-404 still lands in the Checklist's redirect table as a 301. Root cause: resolveRedirectDestinations() (18232) is the canonical resolver, but only buildRedirectsSheet() reuses it (19249) — renderRedirectEditor (21838), exportRedirectMap (22272), reportRedirectMap (18650), and reportMigrationChecklist (19315) each reimplement the Kill/consolidate/URL-changed priority ladder, and they have drifted apart.
- *Proposed fix:* Adopt buildRedirectsSheet's pattern everywhere: call `resolveRedirectDestinations()` once, then read `Redirect_Destination` (treating `'404'` as no-rule). The Redirect Editor needs the derived-vs-manual distinction, so extract its per-row resolution into a shared `resolveRowRedirect(row, ctx)` that both the resolver and the editor call, and have the three report/export paths simply read the resolved column.

### [duplication] `src/renderer.js:16802`
**Four parallel KKE→color maps (kkeColor, resolvedKkeColor, resolvedKkeBgColor, treemapKkeColor); three of them omit Consolidate, a built-in KKE state, so the Executive Summary and Content Inventory reports render the Consolidate segment as undifferentiated grey.**

- *Evidence:* `resolvedKkeColor`: `const map = { Keep: '--kke-keep', Kill: '--kke-kill', Evolve: '--kke-evolve', Exclude: '--kke-exclude' };` (16802) — no Consolidate, while `BUILTIN_KKE = ['Keep', 'Kill', 'Evolve', 'Consolidate', 'Exclude']` (116) and `--kke-consolidate: #4338ca` exists in styles.css:28. treemapKkeColor's own docstring concedes it: "Includes Consolidate, which the older kkeColor()/resolvedKkeColor() helpers omit" (15093).
- *Impact:* `kkeBarHtml()` (18413) and `kkeStatsRows()` (18428) iterate `allKkeStates()` — which includes Consolidate — but color each segment via `resolvedKkeColor`/`resolvedKkeBgColor`. Consolidate misses the map, isn't in `customKkeStates` (it's built-in), and falls through to `'#333'` / `'#33333333'`. Every Executive Summary and Content Inventory PDF/HTML sent to a client draws the Consolidate band in default grey, visually indistinguishable from an unrecognized state. Same in the progress dashboard via `kkeColor` → `var(--text-primary)`.
- *Proposed fix:* Collapse to one `KKE_COLOR_VARS = { Keep, Kill, Evolve, Consolidate, Exclude }` table and one lookup `kkeColorVar(label, { bg = false, resolved = false })`; make kkeColor/resolvedKkeColor/resolvedKkeBgColor/treemapKkeColor thin wrappers over it so adding a 6th built-in state can never drift again.

### [duplication] `main.js:1003`
**Four structural-sheet parse/write pairs repeat identical positional-column boilerplate, and three of the four writers forgot the clampCell() guard that the fourth applies — an oversized markdown note will produce an invalid xlsx cell.**

- *Evidence:* writeContentTypeRegistrySheet pushes `e.notes || ''` raw (1017); writeDesignPatternLibrarySheet pushes `e.description || ''`, `e.notes || ''` raw (1389-1390); writeGlossarySheet pushes `tags[k]` raw (1426) — while writePatternLibrarySheet wraps every free-text column: `clampCell(e.description || ''), clampCell(e.buildGuidanceDefault || '')…` (1259-1266). `clampCell` (914) exists precisely because Excel caps a cell at 32,767 chars. All four writers also end with the same verbatim 5-line replace-or-append tail (`if (workbook.SheetNames.includes(sheetName)) { workbook.Sheets[sheetName] = ws; } else { XLSX.utils.book_append_sheet(...) }`).
- *Impact:* KKE_Glossary notes are markdown authored freely by the auditor and are the likeliest column to blow the limit; when it happens SheetJS writes a cell Excel rejects, and the user's save of an .xlsx project silently produces a file that won't open. Structurally, the four parse functions index columns positionally (`rawData[i][4]`, `rawData[i][5]`…), so adding a column to any sheet means hand-editing two functions in lockstep — the exact drift that produced the clampCell gap.
- *Proposed fix:* Introduce a schema-driven pair next to clampCell: `parseColumnarSheet(ws, schema)` / `writeColumnarSheet(wb, name, schema, entries, { sortBy })` where `schema = [{ header: 'Content_Type', key: 'contentType', trim: true }, { header: 'Notes', key: 'notes', clamp: true }, …]`. Rewrite all four sheet pairs (ContentTypeRegistry, PatternLibrary, DesignPatternLibrary, KKE_Glossary) against it; clamping becomes a schema flag instead of something each writer must remember.

### [duplication] `src/renderer.js:2503`
**Two operator/predicate engines with two vocabularies for one concept: the rubric field-rule evaluator in main.js (snake_case, with numeric comparisons) and the sidebar field-filter in renderer.js (kebab-case, no numeric comparisons).**

- *Evidence:* renderer's `fieldFilterMatches`: `case 'is-blank': … case 'not-contains': … case 'equals': … case 'starts-with':` (2510-2516). main's `evalCondition`: `case 'is_empty': … case 'not_contains': … case 'is': … case 'starts_with': … case 'gt': return parseFloat(cellVal) > parseFloat(testVal);` (2325-2340). Same eight string predicates, two spellings — plus main.js has `gt/gte/lt/lte` that renderer.js does not.
- *Impact:* The numeric comparison engine already exists and is exercised by rubric files, but the sidebar's FIELD_FILTER_OPERATORS list (2493-2501) can't reach it — so an auditor triaging a 4,000-row crawl cannot filter `Word Count < 300` or `Sessions >= 100` in the UI at all, despite the app being able to evaluate exactly that expression a few thousand lines away. Any future operator has to be added twice, in two spellings, and the two engines already disagree on blank handling (`is`/`equals` compare lowercased-trimmed in both, but main's `truthy` default has no renderer counterpart).
- *Proposed fix:* Extract one predicate table — `{ op, label, needsValue, test(cellVal, testVal) }` keyed by a single canonical vocabulary — into a small shared module both processes require (renderer already loads plain scripts before renderer.js, cf. src/sitemap-template.js). Have `fieldFilterMatches` and `evalCondition` both dispatch through it, and surface the `gt/gte/lt/lte` entries in FIELD_FILTER_OPERATORS so the sidebar gains numeric filtering for free.

### [duplication] `src/treemap-template.js:161`
**The treemap engine re-implements the sitemap engine's pan/zoom/fit, console-bridge emit, HTML escaping, print-ready handshake and page shell verbatim rather than sharing them.**

- *Evidence:* `// Pan + zoom + fit — ported near-verbatim from the Visual Sitemap engine` — and it is: `applyXform`, `setupPanZoom` (same MAX=80, same 0.18 factor, same 0.10–3 clamp) and `fitToScreen` (same margin=32, same `Math.max(0.10, Math.min(1, s))`) at lines 163-204 match sitemap-template.js:494-535 line for line, modulo `canvasW`/`CANVAS_W`.
- *Impact:* Roughly 120 lines are maintained twice, including four copies of the same escape map (`esc`/`escAttr` in each file), two copies of `emit()`/MSG_PREFIX, two copies of `markReady()`, two near-identical `build()` shells, and ~40 duplicated CSS rules (#toolbar, .tb-btn, #zoom-label, #viewport, #legend-panel, the @media print block). A fix or tuning change to zoom, print sizing, or the host bridge lands in one engine and silently drifts in the other — and both ship into every client export, so the drift is visible to clients.
- *Proposed fix:* Extract the shared half into one module (e.g. `src/engine-shell.js`) exporting the common engine source (pan/zoom/fit, emit, esc, markReady) plus the base CSS and the `build()` document shell, and have both templates concatenate it into their own engine string. The only genuine divergence is the sitemap's pointerdown guard (`e.target.closest('.node-card') || e.target.closest('.ctx-menu')`), which can be a hook the caller supplies.

### [performance] `src/renderer.js:3149`
**The 'Status Code' header is resolved with a case-insensitive linear scan of state.headers inside the per-row render loop, redoing the same lookup for every visible row on every paint.**

- *Evidence:* const scColName = state.headers.find(h => h.toLowerCase() === 'status code');
- *Impact:* Screaming Frog 'Internal: All' exports routinely carry 80-300 columns. At ~45 visible rows that is 3,600-13,500 wasted String.toLowerCase() allocations per paint, and renderVisibleRows paints on every rAF while scrolling the sidebar — so this burns measurable time in the scroll frame budget on exactly the large crawls the app targets. Pure waste: the answer is identical for all rows.
- *Proposed fix:* Hoist the lookup out of the loop — compute it once at the top of renderVisibleRows (or cache it alongside `_displayCols` in renderRows, which already caches the display columns for exactly this reason at line 2992), and reuse it for every row.

### [performance] `src/renderer.js:2699`
**The 'All fields' search re-scans every column of every row with Object.values(row) on every keystroke, un-debounced, and each keystroke also fires a savePrefs IPC round-trip.**

- *Evidence:* rows.filter(({ row }) =>
        Object.values(row).some(v => String(v).toLowerCase().includes(q))
      );
- *Impact:* Object.values() allocates a fresh array per row, then String()+toLowerCase() per cell. On a 4,000-row × 200-column Screaming Frog export that is up to 800k string allocations per keystroke, followed by applySort() and a full renderRows() teardown — and the input handler (line 580) calls applyFilter() synchronously on every `input` event with no debounce, plus `window.electronAPI.savePrefs({filterText})` on every character. Typing a 10-character query does that ten times, producing visible sidebar jank at exactly the crawl size the app is built for.
- *Proposed fix:* Cache a per-row lowercase haystack (a joined `_searchBlob` built once in loadData/on edit, invalidated where editedRows is mutated) so the scan is one includes() per row; and debounce both applyFilter() and the savePrefs call in the `els.searchInput` input handler (~120ms), the way a keystroke-driven filter over thousands of rows needs.

### [performance] `src/renderer.js:1338`
**`globalSearchUpdate` auto-jumps to the first match on every debounced keystroke, so each keystroke triggers a row selection, a live webview page load, and (per the filter-clearing path) a full sidebar re-render.**

- *Evidence:* `globalSearchNavigate(1); // go to first match` at the end of `globalSearchUpdate`, which runs on a 150ms `input` debounce.
- *Impact:* On a 4,000-row crawl, every pause while typing a query re-scans every cell (`Object.values(row).some(...)`, ~4k rows × ~80 columns) AND then calls `selectRow()`, which sets `webview.src` — a real network fetch of a client page — plus `renderVisibleRows()`, plus a whole `applyFilter()` pass whenever the first match isn't in the filtered set. Typing "contact" fires several page loads for pages the user never asked to see, and each one also wipes their filters (see the finding at line 1409).
- *Proposed fix:* In `globalSearchUpdate`, only compute and display the match count; move the jump to the explicit navigation affordances that already exist (Enter, the ▲/▼ buttons, `globalSearchGoToRow`). The nav-editor branch can keep its cheap scroll-to-first if desired, since it doesn't load a URL.

### [performance] `src/renderer.js:975`
**The one-time Consolidate_Into migration in loadData() nests a full `state.editedRows.find()` inside a per-row loop — O(consolidates × rows) on every open of a legacy project.**

- *Evidence:* `const master = byAddr.get(legacy) || state.editedRows.find(m => effectiveConsolidateUrl(m) === legacy);` (975), inside `state.editedRows.forEach((r, i) => {...})` (969).
- *Impact:* The `byAddr` Map only covers the case where the legacy value was the master's Address; the code's own comment says the value 'may be the master's Address OR its effective new-site URL', and every URL-form legacy value falls through to the linear scan. On a 4,000-row crawl with 500 legacy consolidations that is 2M `effectiveConsolidateUrl()` calls (each doing string work plus a `getRedirectBaseUrl()` call) executed synchronously on the open path, before the first row is painted — the app appears hung on opening an older client project.
- *Proposed fix:* Build a second lookup Map alongside `byAddr` in the same O(n) pass at 968 — `byEffective.set(effectiveConsolidateUrl(r), r)` — and replace the `.find()` with `byAddr.get(legacy) || byEffective.get(legacy)`. While there, the three sequential full passes over `editedRows` in loadData (893 track rename, 922 GA seed, 969 consolidate migration) can be folded into one loop.

### [performance] `src/renderer.js:16725`
**Row selection rescans the entire row table twice and rebuilds two full <select> elements — collectGroups() and populateContentThemeSelect() both walk state.editedRows on every selectRow().**

- *Evidence:* `function collectGroups() { … for (const row of state.editedRows) { const g = String(row[groupCol()] || '').trim(); …` (16725-16732), called from populateGroupSelect (16675) which populateAuditFields calls at 3550; populateContentThemeSelect does its own `state.editedRows.forEach(r => { const v = String(r['Content_Theme'] || '')… })` (16555-16558) and is called at 3556. Both then do `innerHTML = ''` and re-create every <option>.
- *Impact:* On a 4,000-row crawl every row click (and every arrow-key/j-k step through the sidebar) does 8,000 row reads plus a full teardown/rebuild of both dropdowns' DOM — pure waste, since neither vocabulary can change between selections. This is the hot path the app is used in all day; it also thrashes the selects' DOM for no visual change. populatePageTypeSelect (16515) already gets this right by reading only the library.
- *Proposed fix:* Cache the derived vocabularies (a `_groupsCache` / `_themesCache` invalidated in loadData(), on group/theme creation, and wherever the group or Content_Theme column is bulk-assigned — the same invalidation pattern _navPageCountsCacheMap already uses), and in the populate* functions rebuild the <option> list only when the cached vocabulary array changed; otherwise just set `sel.value`.

### [performance] `src/renderer.js:17516`
**`renderComputedColumnCards()` fires one `evaluateComputedColumns` IPC round-trip *per column card*, and each one redundantly evaluates every definition.**

- *Evidence:* Inside `state.computedColumns.forEach((col, idx) => {...})` (L17468), L17516: `window.electronAPI.evaluateComputedColumns({ definitions: state.computedColumns.filter(c => c.name && c.formula), rows: sampleRows })` — the payload is identical on every iteration (all definitions, the same `state.editedRows.slice(0, 5)`); only the `.then` differs, plucking `r[col.name]` (L17528).
- *Impact:* N columns → N async IPC round-trips and N×N formula evaluations for a preview that needs exactly one. Every keystroke-triggered re-render (add column, delete column, `change` on any name/formula field) re-fires the whole fan-out, and because the N promises resolve independently against DOM nodes captured in a closure, a rapid edit can land a stale preview on a card that was already re-rendered.
- *Proposed fix:* Hoist a single `evaluateComputedColumns({ definitions, rows: state.editedRows.slice(0,5) })` call above the `forEach`, await it once, and pass the resolved `results` into the per-card preview render — one round-trip, one evaluation pass, no stale-closure race.

### [performance] `src/renderer.js:9048`
**refreshAllConsolidateDisplays is O(consolidating rows × all rows) because findConsolidateTargetRow does a linear scan per row, and it runs on every save and every single nav assignment.**

- *Evidence:* function refreshAllConsolidateDisplays() { state.editedRows.forEach((row, i) => refreshConsolidateDisplay(row, i)); }
- *Impact:* `refreshConsolidateDisplay` → `findConsolidateTargetRow` → `state.editedRows.find(r => String(r[urlCol]||'').trim() === id)` (8993), a fresh full scan per consolidating row. On a 4,000-row crawl with 800 Consolidate rows that is ~3.2M row-property reads + trims per sweep. The sweep runs before every save via `resolveConsolidateIntoUrls()` (18222, called at 5264/5293/5336) AND on every single-row nav assignment via `resyncConsolidateInto()` (10002, 10177, 10195) — i.e. on the assign hot path, not just at save time.
- *Proposed fix:* Build the address→row Map once and thread it through: `refreshAllConsolidateDisplays` already has the exact prior art in `resolveRedirectDestinations`, which builds `const rowByUrl = new Map(); state.editedRows.forEach(...)` at 18239. Pass that map into `findConsolidateTargetRow(row, rowByUrl)` (falling back to the scan when omitted) and the sweep drops to O(n).

### [performance] `src/renderer.js:9630`
**The Consolidation Candidates refresh recomputes the entire candidate set twice per keystroke-level UI event, and each build does an O(groups × navNodes) node lookup.**

- *Evidence:* const totalUnfiltered = buildConsolidationCandidates().length;
- *Impact:* `refresh()` calls `buildConsolidationCandidates(filter)` at 9627 and then `buildConsolidationCandidates()` again at 9630 purely to get a count. Each build is a full pass over `state.editedRows` plus, inside `groups.forEach`, a linear `state.navNodes.find(n => n.id === navId)` (9499) — O(groups × nodes). `refresh()` fires on every KKE checkbox toggle, every group-exclude add/remove, and every Skip/Apply. On a 4,000-row / 500-node project with ~200 multi-page groups that is 2 × (4,000 row pass + 100,000 node comparisons) per click.
- *Proposed fix:* Index nodes once — `const nodeById = new Map(state.navNodes.map(n => [n.id, n]))` — and look up instead of `.find`. Compute `totalUnfiltered` from the same single pass (build the groups map once, derive both the filtered and unfiltered counts from it) rather than calling the builder a second time.

### [performance] `src/renderer.js:12698`
**Every collapse/expand click inside the Visual Sitemap webview triggers a full renderNavEditor() — tearing down and rebuilding the entire nav tree DOM behind the 94vw modal that is covering it — and every engine state push (including color-picker drags) calls setDirty(true).**

- *Evidence:* if (typeof _navEditorOpen !== 'undefined' && _navEditorOpen) renderNavEditor();
- *Impact:* The nav Visual Sitemap is only reachable from `$('btn-nav-sitemap')` in the nav-editor toolbar (11208), so `_navEditorOpen` is always true while it is open. Each collapse toggle in the webview → 'state' message → applySitemapCollapseToNav → `changed` → renderNavEditor(), which does `body.innerHTML = ''` and rebuilds every row (13282-13286) on top of ~14 full passes over state.navNodes and a hasDescendantPages recursion per node (13147). At 500+ nodes that is a 100ms+ DOM rebuild the user cannot even see, once per click, while they are exploring the sitemap. Separately, persist() (12632) fires setDirty(true) on *every* pushState, and the engine pushes on the color rule's `input` event (src/sitemap-template.js:726), so dragging one color slider spams the dirty flag and the debounced autosave.
- *Proposed fix:* Set a `_navEditorStale = true` flag in applySitemapCollapseToNav instead of re-rendering, and call renderNavEditor() once when the sitemap modal closes (openSitemapView's openModal already has an onClose seam). Optionally debounce persist()/setDirty on the 'state' message so a color-picker drag coalesces into one dirty mark.

### [performance] `src/renderer.js:10210`
**Every node-minting helper rescans all of state.navNodes to find the max id, and the batch creators call them once per row — making Create Sitemap from Audit and bulk nav assign quadratic in row count.**

- *Evidence:* let maxId = 0;
  for (const n of state.navNodes) {
    const idNum = parseInt(n.id, 10);
    if (idNum > maxId) maxId = idNum;
  }   // inside createNavChildForPage(), called once per row from bulkAssignRowsToBucketCore() (10334) and createSitemapFromAudit() (10423)
- *Impact:* On a 4,000-row crawl, Create Sitemap from Audit grows state.navNodes from ~0 to ~4,000 while rescanning the whole array per insert: sum(1..4000) ~= 8M parseInt calls, plus uniqueSiblingSlug() rebuilding a fresh Set of the bucket's children on every call (a /news/ bucket with 1,500 children costs another ~1.1M Set inserts). Measured on this exact code shape: 248ms of synchronous, blocked main thread with the modal already closed and no progress UI — the app just freezes. The same scan is copy-pasted in four places (createNavChildForPage 10209, createRootNodeFromPage 10021, createBucketNode 10266, addNavRootNode 14690), so all node creation pays it.
- *Proposed fix:* Hoist a module-level nextNavId counter seeded once from state.navNodes on file open / nav load (and bumped on each mint), and have all four helpers read it instead of rescanning. Optionally pass a reusable sibling-slug Set into bulkAssignRowsToBucketCore()'s loop rather than rebuilding it per row.

### [performance] `src/index.html:10`
**An offline-first desktop app fetches its UI fonts from Google over the network on every launch, via a render-blocking stylesheet link with no bundled fallback.**

- *Evidence:* <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono…&family=IBM+Plex+Sans…&display=swap" rel="stylesheet"> — and `find` over the repo returns no .woff/.woff2/.ttf/.otf; assets/ contains only icon.icns and icon.png.
- *Impact:* External stylesheets block first paint, so app startup is gated on a Google round-trip — noticeable on a slow link and worst on a captive-portal network, where the request hangs until it times out rather than failing fast. Offline (a normal state for a tool used on client sites), --font-sans/--font-mono silently degrade to system-ui/Menlo, so the app renders in the wrong typeface. It also means the app phones home to Google on every launch of a tool that otherwise touches nothing but local files — an easy question to get asked in a client security review.
- *Proposed fix:* Download the IBM Plex Sans/Mono woff2 subsets into assets/fonts/, declare them with @font-face in styles.css, drop the two <link> tags and the preconnect, and tighten the CSP back to `style-src 'self' 'unsafe-inline'; font-src 'self'` (the existing font-src/style-src allowances for fonts.googleapis.com / fonts.gstatic.com then become removable too).

### [performance] `src/sitemap-template.js:265`
**`subtreeBox()` is recomputed from scratch for every child at every level of layout, and a full teardown+relayout+host round-trip fires on every `input` event tick of the settings panel.**

- *Evidence:* `node.children.forEach(function (c) { layoutNode(c, xcol, cy, depth + 1); cy += subtreeBox(c, depth + 1).h + k.VL_GAP; });` — `subtreeBox` recursively walks the child's entire subtree, and is called again per child from the horizontal branch (line 252) and once more on the root in `computeLayout` (line 280). Nothing is memoized; `L()` allocates a fresh settings object on every one of those calls.
- *Impact:* Layout costs O(sum of every node's depth) subtree walks per render — ~3k walks + 3k object allocations on a 500-node tree, worse on deep trees. That would be tolerable once, except `render(); pushState();` is wired to the `input` event of both the layout number fields (line 664) and each color-rule swatch (line 726), so dragging a native color picker re-lays out the whole tree, blows away and rebuilds every card (`cl.innerHTML = ''`, plus a `document.getElementById('cards-layer')` lookup per card at line 429) and emits a full-settings JSON over the console bridge at ~60Hz — each of which the host handles by walking the entire navTree (`applySitemapCollapseToNav`, renderer.js:12660) and calling `setDirty(true)`. On a 500+ node tree that makes the Colors tab visibly janky and floods the host.
- *Proposed fix:* Memoize `subtreeBox` in a `{}` cache keyed by node id, cleared at the top of `computeLayout()` (collapse state and settings are constant within a render pass); hoist `L()` to one call per render and pass `k` down; hoist the `cards-layer` element into `renderCards` from `render()` (it is already resolved there as `cl`); and debounce `pushState()` (~250ms) so continuous `input` drags emit one state message instead of hundreds.

### [performance] `main.js:2980`
**Both PDF exporters navigate a hidden window to a percent-encoded `data:` URL of the whole document, which inflates the payload ~2-3x and runs into Chromium's ~2MB URL cap on exactly the big deliverables that matter.**

- *Evidence:* await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));  — same construction at 3306 in export-sitemap-pdf.
- *Impact:* `encodeURIComponent` expands every space, quote, angle bracket, brace and newline to 3 bytes, so a ~700KB report HTML becomes a >2MB URL. Chromium refuses to navigate URLs beyond `url::kMaxURLChars` (2MB), so the export fails with an opaque error rather than producing the PDF. This bites precisely on a Redirect Map / Migration Checklist over a multi-thousand-URL crawl, and on the sitemap print HTML (which inlines the 64KB `src/sitemap-template.js` engine plus a JSON blob for 500+ nodes). It also triples peak string memory in main for every export.
- *Proposed fix:* Write `html` to a temp file (`fs.writeFileSync(path.join(os.tmpdir(), 'transmission-export-<pid>.html'), html)`) and `await win.loadFile(tmp)` in both handlers, unlinking in the existing `finally`. No size ceiling, no encode pass, and the same `document.title === 'READY'` wait still works.

### [performance] `src/renderer.js:1159`
**recomputeAllPageBreadcrumbs() runs on every file open and is O(rows x nodes x depth) because each row re-resolves its node and re-walks the breadcrumb chain with linear scans.**

- *Evidence:* recomputeAllPageBreadcrumbs();  (in loadData, line 1159) → `state.editedRows.forEach(row => { const next = computeRowPageBreadcrumb(row); ... })` (line 14132) → computeRowPageBreadcrumb does `const node = state.navNodes.find(n => n.id === navID);` (line 14120) then pageBreadcrumbOf(node) → computePageBreadcrumbLabels, whose every ancestor hop is another `state.navNodes.find(...)` (lines 14092–14094).
- *Impact:* At 4,000 rows / 500 nodes / breadcrumb depth 4 that is ~4,000 × (500 + 4×500) = ~10M array scans of blocking work on the open path, before the UI is interactive — on top of the other open-time passes. Every placed row also recomputes its ancestors' labels from scratch even though whole sections share the same chain. Negligible on a 500-row / 50-node file.
- *Proposed fix:* Two changes, both cheap: (1) use the node id/number Maps from the finding above so the node lookup and each ancestor hop are O(1); (2) memoize pageBreadcrumbOf per node id for the duration of the sweep (a `Map<nodeId, string>`) — rows sharing a node, which is the common case, then cost one Map hit each instead of a full chain walk.

### [performance] `src/renderer.js:13495`
**renderNavEditorNode() calls document.getElementById twice per node to re-read the phase and build filter values, and renderNavEditor() re-scans all rows to build a pageCounts map it has just invalidated the cache for.**

- *Evidence:* Per node: `const phaseFilterEl = document.getElementById('nav-phase-filter');` (13495) and `const buildFilterEl = document.getElementById('nav-build-filter');` (13503) — both at the top of the recursive per-node function. In renderNavEditor: `invalidateNavPageCountsCache();` (13116) immediately followed by a hand-rolled `const pageCounts = {}; state.editedRows.forEach(row => {...})` (13119-13126) that duplicates _navPageCountsCache()'s body (line 15007) verbatim.
- *Impact:* At 500 nodes that is 1,000 getElementById calls per re-render, and renderNavEditor() is called from 35 sites (every add/delete/drag/edit). The pageCounts duplication means each render does a full 4,000-row scan locally AND leaves the shared cache null, so the next consumer (isHubNode at line 15176, navPageCount at 15102) re-scans all 4,000 rows again — two full row passes where one cached pass would do. Neither is fatal alone, but they sit inside the tree render that already has no virtual scrolling, so they add to a stall that fires on every keystroke-level nav edit.
- *Proposed fix:* Read the two filter values once in renderNavEditor() and thread them through as parameters (renderNavEditorNode already takes `pageCounts, depth, dupSlugs, depthFilter` — add them there). Delete the local pageCounts block and call `_navPageCountsCache()` after the invalidate, passing that map down — one scan, one source of truth, and the cache stays warm for isHubNode/navPageCount.

### [simplification] `src/styles.css:4676`
**#field-bar-audit is declared twice, 3,800 lines apart, with contradictory layout — the first declaration is dead and its stale properties still leak in.**

- *Evidence:* styles.css:873 `#field-bar-audit { display: flex; align-items: center; gap: 10px; padding: 4px 12px; flex-wrap: wrap; row-gap: 4px; }` and styles.css:4676 `#field-bar-audit { display: flex; flex-direction: column; gap: 6px; padding: 8px; }`. Same for .modal-title (declared at :1503 and again at :4281).
- *Impact:* The later block wins on gap/padding/direction, but `align-items: center`, `flex-wrap: wrap` and `row-gap: 4px` from the first block are never overridden and silently apply to a column flow where they mean something entirely different. Editing the visible block at :873 (the one you find first, in the "Field bar" section) has no effect on the properties it declares — a guaranteed wasted debugging cycle for the next person tuning the audit bar.
- *Proposed fix:* Merge the two #field-bar-audit blocks into the single cluster-era declaration at :4676 (dropping the leftover row-flow properties), and collapse the duplicate .modal-title into the one at :4281 that carries the color token.

### [ui-standards] `src/renderer.js:1198`
**addNewRow() hand-builds a modal with inline styles and a hardcoded z-index, bypassing the openModal() infrastructure the codebase mandates.**

- *Evidence:* `urlEditor.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-surface);...box-shadow:0 16px 48px rgba(0,0,0,0.3);padding:20px;z-index:700;width:500px;'` (1198), plus a hand-rolled overlay at `z-index:600` (1213).
- *Impact:* CLAUDE.md's UI contract is explicit: 'Never hand-build a modal → use openModal(). It owns Esc, backdrop-close, z-index stacking, and the .modal-close × header.' This dialog gets none of that: Esc does not dismiss it (only the two Enter handlers and the overlay click exist), and its fixed z-index of 600/700 sits BELOW every `openModal()` dialog, which stacks from `1000 + _modalStack.length * 10` (1735) — so if 'New Page' is opened over any other modal it renders underneath it and is unreachable. It also hardcodes a shadow color and font sizes that the `:root` tokens exist to own.
- *Proposed fix:* Rebuild on `openModal({ title: 'Add New Page', body, buttons: [Cancel, Add], width: 500 })` (1726) — it supplies the overlay, Esc/backdrop dismissal, drag, the close button, and correct stacking. The two inputs then need only their keydown-Enter shortcut.

### [ui-standards] `src/renderer.js:10811`
**showOrphanNodeDialog() and promptClearNavAssignment() both hand-build modal overlays with hardcoded colors, z-indexes and bespoke Esc handling instead of using openModal(), which the project's UI contract explicitly forbids.**

- *Evidence:* overlay.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);';   // and at 11020: z-index:920 / 930, 'rgba(0,0,0,0.35)'
- *Impact:* docs/UI_STANDARDS.md (per CLAUDE.md: 'Never hand-build a modal -> use openModal()') exists precisely because openModal() owns Esc, backdrop-close, z-index stacking and teardown. Hand-rolling it is what produced the leaked keydown listener in promptClearNavAssignment() (top finding) — a silent data-corruption bug — and showOrphanNodeDialog() has the same leak in milder form (its onKey is only removed on Escape, never when the user clicks Keep node / Remove node, so every invocation permanently stacks another document listener). The ad-hoc z-indexes (500 vs 920/930) also sit outside the shared stacking order, and rgba(0,0,0,0.3) vs 0.35 backdrops drift from the token set.
- *Proposed fix:* Rebuild both on openModal({ title, body, buttons }) — this deletes the overlay/dialog construction, the inline styling, and both onKey handlers, and fixes the listener leak as a side effect. Both dialogs are small enough that this is a near-mechanical conversion.

### [ui-standards] `src/styles.css:4548`
**111 lines of hardcoded hex in component rules force a parallel, hand-maintained block of 56 dark-mode counter-rules — the exact failure mode the token system exists to prevent.**

- *Evidence:* .audit-cluster { … border: 1px solid #cbd5e1; background: #f8fafc; } (styles.css:4548–4559), which then requires :root[data-theme="dark"] .audit-cluster { background: var(--bg-panel); border-color: var(--border); } at :2901. The same pattern repeats across styles.css:2871–2927 (row-ind-cms, row-sc-*, dp-option-complexity, design-pattern chips, cluster pills, qt-chip, sme-decision-display, final-kke-match, redirect-dest-404 …), :5099–5104 (.nne-pill-*) and :5433 (.cp-hint-box).
- *Impact:* UI_STANDARDS §7 and golden rule #3 forbid hardcoded colors precisely because of this: every light tint written as a literal hex needs a second literal hex to undo it in dark mode. There are now 56 such counter-rules. Each new tinted chip costs two edits in two distant places, and the comment at :5429 records a bug this already shipped (.cp-hint-box was unreadable in dark mode because its light hex had no dark twin) — that will recur.
- *Proposed fix:* Promote the recurring tints to :root tokens with dark values in the :root[data-theme="dark"] block (e.g. --surface-cluster, --pill-blue/-slate/-violet/-amber/-green, --tint-warn/-danger/-ok), rewrite the component rules to use var(), and delete the corresponding overrides in the 2871–2927 block. .nne-pill-* (:5093) is the correct shape to copy — it was already extracted from inline hex for this reason.

### [ui-standards] `src/renderer.js:16022`
**showDeleteConfirmDialog hand-paints its destructive buttons with an inline red background instead of the `.btn-primary.btn-danger` class the standard mandates — which its own sibling dialog uses correctly 5,000 lines earlier.**

- *Evidence:* `deleteAllBtn.className = 'btn btn-sm';` + `deleteAllBtn.style.cssText = 'background:var(--kke-kill);color:#fff;border:none;';` (16022-16023, repeated verbatim at 16033-16034 for the no-children branch). Compare showOrphanNodeDialog:10837 — `removeBtn.className = 'btn btn-sm btn-primary btn-danger';`
- *Impact:* Copy-paste with drift on the app's most destructive action (deleting a sitemap node and its subtree). Bypasses `.btn-primary.btn-danger` (styles.css:1810) and therefore also its `:hover` state (styles.css:1811) and the dark-mode hover override (styles.css:2896) — the button has no hover feedback in either theme. Hardcodes `color:#fff`, violating golden rule 3. UI_STANDARDS §2.1 is explicit: 'Destructive primary action (filled red). Use via confirmDialog({danger:true}) or class="btn btn-sm btn-primary btn-danger".' The hasChildren branch also renders a green `btn-primary` (Promote children, :16018) *and* the red button, breaking §2.2 'One primary per dialog'.
- *Proposed fix:* Replace both blocks with `className = 'btn btn-sm btn-primary btn-danger'` and drop the two `style.cssText` lines — exactly the form showOrphanNodeDialog:10837 already uses. For the hasChildren branch, demote 'Promote children' to `btn btn-sm btn-ghost` so there is one primary, rightmost.

### [ui-standards] `src/renderer.js:10568`
**Two dialogs call openModal with `buttons: []` and hand-build an inline-styled footer inside the body, which loses the standard `.modal-footer` chrome and silently disables the factory's Enter-to-confirm.**

- *Evidence:* `footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:4px;';` (10568, and verbatim again at 10679) followed by `openModal({ title: 'Assign to Sitemap', body, width: 480, buttons: [] })` (10622) and `openModal({ title: 'Create Sitemap from Audit', body, width: 480, buttons: [] })` (10688).
- *Impact:* The factory only builds a footer and only sets `primaryBtn` inside `if (buttons.length)` (renderer.js:1774, 1789), so with `buttons: []` the keydown handler's `if (top.primaryBtn && !e.shiftKey) top.primaryBtn.click()` (renderer.js:1702) is a no-op. Enter does nothing in the bulk sitemap-assign dialog or Create-Sitemap-from-Audit — every other dialog in the app confirms on Enter, so these two feel broken. They also lose `.modal-footer`'s border-top/padding, so the buttons float against the body with a 4px margin. Violates §4 ('never a bespoke div with its own padding/border CSS') and §1.3.
- *Proposed fix:* Delete both hand-built footers and move the buttons into openModal's `buttons:` array — `[{label:'Cancel', variant:'ghost', value:null}, {label:'Assign N pages', variant:'primary', primary:true, onClick:(api)=>…, closeOnClick:false}]`. Use `closeOnClick:false` plus the returned `api` to keep the existing disabled-until-a-target-is-chosen behavior, and drive the disabled state off the button node the factory returns.

### [ui-standards] `src/renderer.js:14286`
**Four hand-built centered dialogs never close on Esc, and six lack the mandatory `.modal-close ×` header button.**

- *Evidence:* openReassignTargetPicker: `overlay.style.cssText = 'position:fixed;inset:0;z-index:600;…'` with only `cancelBtn.addEventListener('click', () => overlay.remove())` (14364) — no Esc handler, no backdrop-click close, no `×`. Same Esc gap in openGaKkeConfigDialog (overlay at 8823), showPhaseExportPrompt (13044), openConsolidationCandidates (9547).
- *Impact:* Golden rule 6: 'Every centered dialog has a .modal-close × in its header and closes on Esc + backdrop click.' openReassignTargetPicker is the worst — it is opened *from* the node-delete confirm dialog, so a user mid-delete has no Esc, no backdrop, and no ×; the only exit is finding the Cancel button. `showPhaseExportPrompt` blocks an export flow behind an un-Esc-able dialog. Grep confirms the six dialogs with zero `modal-close`: showDeleteConfirmDialog, showOrphanNodeDialog, showPhaseExportPrompt, openReassignTargetPicker, showMenuNodePicker, showNavReferencePicker. Each also hardcodes its own z-index (500/600/800/920), the exact per-modal z-guessing the factory's `_modalStack` exists to eliminate.
- *Proposed fix:* For showPhaseExportPrompt (a 3-button promise, 27 lines) port it to `openModal({buttons:[…], onClose:resolve})` outright — it is the cheapest and gets ×/Esc/backdrop/z-stacking free. For the three larger ones, apply the §1.5 retrofit: `registerModalDismiss(overlay, dialog, () => close())` right after append, and drop the hardcoded z-index; add `<button class="modal-close" title="Close">×</button>` to each header, matching openConsolidationCandidates:9580 which already does this correctly.

## LOW (22)

### [correctness-risk] `src/renderer.js:3002`
**The zero-match branch of renderRows() returns before resetting els.rowList's explicit height, leaving the previous result set's scroll height behind, and tags the empty message with no class so the removal selector for it never matches.**

- *Evidence:* if (filteredRows.length === 0) {
    const msg = document.createElement('div');
- *Impact:* `els.rowList.style.height` is only ever assigned in the non-empty path (line 3020). Filter a 4,000-row crawl down to zero matches and the list keeps `height: 136000px`, so the sidebar shows 'No rows match your filter.' at the top of a ~136,000px empty scroll region with a full-length scrollbar — it reads as a broken/hung list. Relatedly, `renderVisibleRows` removes `.row-item,.virtual-empty-msg` (line 3042) but this message div is never given the `virtual-empty-msg` class, so that half of the selector is inert.
- *Proposed fix:* In the empty branch, reset `els.rowList.style.height = ''` (or `'auto'`) before appending the message, and give the message div `className = 'virtual-empty-msg'` so the existing cleanup selector in renderVisibleRows actually matches it.

### [correctness-risk] `main.js:1008`
**Emptying a structural library (registry / pattern / design-pattern / glossary) can never be persisted — the old sheet is left on disk and the entries reappear on next open.**

- *Evidence:* Line 1008-1011: `if (entries.length === 0) { // Nothing to persist — leave any existing sheet alone (don't auto-delete)  return; }` — mirrored in writePatternLibrarySheet (1254), writeDesignPatternLibrarySheet (1380) and writeGlossarySheet (1421-1424).
- *Impact:* These four keys are also destructured out of the KKE_Settings write (924-930), so an emptied library has no other path to disk. A user who seeds the 20-entry DEFAULT_CONTENT_TYPE_REGISTRY, decides it doesn't fit the client, and deletes every row gets all 20 back the next time the file is opened — with no error and no way to clear them short of hand-editing the xlsx. Deleting *some* entries works; deleting the last one silently does not.
- *Proposed fix:* On an empty (but present) array, write the sheet with just its header row rather than returning early, so the emptied state round-trips; keep the early return only when the key is genuinely absent from projectSettings (`undefined`), which is the case the "don't auto-delete" comment was actually guarding.

### [correctness-risk] `project-store.js:199`
**readAll() parses row and nav-node JSON blobs with no error guard, while the settings loop right below it has one — a single bad blob makes the whole project unopenable with a raw SyntaxError.**

- *Evidence:* const rows = this.db.prepare('SELECT data FROM rows ORDER BY idx').all().map(r => JSON.parse(r.data));
const navNodes = ... .map(r => JSON.parse(r.data));
...
try { projectSettings[key] = JSON.parse(value); } catch (e) { projectSettings[key] = value; }
- *Impact:* The settings loop (line 203) defends against a malformed value; rows (:199) and nav_nodes (:200) do not. If one of 4,000 row blobs is truncated — a plausible outcome of the interrupted-write and clobbered-backup scenarios in the backupTo finding — the whole `open` throws an unhandled SyntaxError, surfacing to the user as the generic 'Could not open the project' error box (main.js:775) with a JSON parser message, and taking all 3,999 intact rows down with it. The user loses the entire audit rather than one row.
- *Proposed fix:* Wrap the two maps the same way the settings loop already is: parse per blob inside a try/catch, skip (or substitute an empty object for) the unparseable entry, and collect the count of failures into a `readAll()` return field so main.js can warn 'N rows could not be recovered' instead of failing the open outright.

### [correctness-risk] `src/renderer.js:16046`
**Two nav dialogs attach a document-level keydown listener but only remove it inside the Escape branch, so dismissing via any button leaks the listener permanently.**

- *Evidence:* showDeleteConfirmDialog: `const onKey = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); } }; document.addEventListener('keydown', onKey);` — `removeEventListener` is reachable only when Esc fires. Identical pattern in showOrphanNodeDialog:10850-10853.
- *Impact:* Cancel, 'Promote children', 'Delete all', 'Keep node' and 'Remove node' all call `overlay.remove()` without unbinding, so every open-and-button-dismiss cycle strands one handler on `document` forever. Curating a 500-node sitemap means dozens of stale closures, each holding a reference to a detached overlay and its captured `node`/`reassignTargetNode` — a slow leak, and every subsequent Esc keypress anywhere in the app runs all of them. This is precisely the bookkeeping `registerModalDismiss` / `_pruneModalStack` (renderer.js:1678-1684) were built to own.
- *Proposed fix:* Delete both bespoke `onKey` blocks and route the dialogs through `registerModalDismiss(overlay, dialog, close)`; its self-healing `_pruneModalStack` drops entries whose overlay has been detached, so button-dismissal needs no cleanup at the call site.

### [dead-code] `src/renderer.js:2112`
**The product tour's click-outside-to-skip handler is unreachable, and the tour's dim is click-through, so users can operate the app underneath it.**

- *Evidence:* `backdrop.addEventListener('click', endProductTour); // click outside = skip` — but `renderTourStep` does `backdrop.classList.add('hidden')` whenever a target rect resolves (line 2183), and the element that actually renders the dim, `#tour-ring`, is `pointer-events: none` (styles.css:4315, `box-shadow: 0 0 0 9999px rgba(0,0,0,0.55)`).
- *Impact:* All five `TOUR_STEPS` anchor to elements that are effectively always present (`#view-switcher`, `#toolbar`, `#row-list-wrap` fallback), so the backdrop is hidden for the entire tour and the skip-on-click affordance never runs. Meanwhile clicks land on the live UI through the fake dim — steps 2 and 5 spotlight `#view-switcher`, so a user clicking the highlighted area to "continue" switches views mid-tour instead of dismissing.
- *Proposed fix:* Keep `#tour-backdrop` visible (transparent, beneath `#tour-ring`, `pointer-events: auto`) during anchored steps instead of hiding it, and let the ring supply only the border — then the existing `endProductTour` click handler works and the dim actually blocks stray clicks.

### [dead-code] `src/renderer.js:1824`
**`openModal`'s returned `setPrimary` is a no-op stub with zero call sites, yet it is advertised in the function's public JSDoc contract.**

- *Evidence:* `setPrimary(btnOrFn) { /* reserved */ },` — and `@returns {{ close, overlay, dialog, body, footer, setPrimary }}` at line 1724. Grep for `setPrimary` across renderer.js returns only these two lines.
- *Impact:* Every one of the app's ~50 dialogs is built on `openModal`; a documented-but-inert method invites a future caller to wire dynamic primary-button state to it and get a silent no-op (e.g. an Apply button that never enables). Low blast radius today, but it is a trap sitting in the most-reused API in the file.
- *Proposed fix:* Delete the `setPrimary` stub and its `@returns` mention; if dynamic primary-button control is actually wanted, implement it by reassigning `primaryBtn` (the stack entry already exposes it through a getter, so a real setter would work with no other change).

### [dead-code] `src/renderer.js:6600`
**`_projectSettingsPos` is declared and commented as the modal's session-remembered position but is never read or written anywhere.**

- *Evidence:* let _projectSettingsPos = null; // { top, left } in pixels  — the only occurrence of the identifier in the file; positioning is now owned by makeModalDraggable()/resetModalPosition() (6636, 7082).
- *Impact:* Misleading leftover from the pre-makeModalDraggable popover: it advertises a 'session memory' behavior that does not exist (closeProjectSettingsPopover explicitly resets position to center every time), so a future reader will look for the code that maintains it.
- *Proposed fix:* Delete the declaration and its comment; the drag/reset contract is entirely handled by makeModalDraggable(modal) and resetModalPosition(els.projectSettingsModal).

### [dead-code] `src/renderer.js:1082`
**A ternary in loadData() picks between two identical branches — a vestige of a removed multi-sheet filename decoration.**

- *Evidence:* `els.fileName.textContent = (dataSheets && dataSheets.length > 1) ? displayName : displayName;` (1082-1084).
- *Impact:* Zero-effect conditional that reads as if multi-sheet files get a different title (they don't). It invites a maintainer to 'fix' a branch that was already deleted, and it obscures that the sheet name is never surfaced in the titlebar even though the sheet picker (1067-1079) is shown.
- *Proposed fix:* Collapse to `els.fileName.textContent = displayName;` — or, if showing the active sheet was the original intent, make the true branch `` `${displayName} — ${sheetName}` ``.

### [dead-code] `src/renderer.js:15101`
**countNodePages() has no callers anywhere in the repo.**

- *Evidence:* `function countNodePages(node) { return _navPageCountsCache()[node.id] || 0; }` (15101-15103) — repo-wide grep (excluding node_modules) returns only this definition; the three live call sites all inline `_navPageCountsCache()[node.id]` themselves (e.g. 10456).
- *Impact:* Trivial in isolation, but it sits in the middle of the treemap helpers and looks like the sanctioned accessor for page counts, so a future caller may reach for it without noticing it wraps the Kill/Consolidate-excluding cache — the wrong count for treemap/inventory sizing, which deliberately uses computeSubtreePageCounts() instead.
- *Proposed fix:* Delete it, or (if a shared accessor is wanted) make it the single entry point and convert the three inline `_navPageCountsCache()[node.id] || 0` reads to call it.

### [dead-code] `main.js:780`
**`colLetter()` and the `columns` block it feeds in parseNavSheet compute Excel column letters "for formula generation", but the app strips every formula on write and nothing ever reads `.columns`.**

- *Evidence:* Line 883-889: `// Column letters for formula generation` → `columns = { id: colLetter(idx.id), breadcrumb: ..., computedPath: ..., sortID: ... }`. writeWorkbook reads only `navSheetInfo.sheetName` (1491/1493/1649), and line 1732-1743 says "Strip ALL formulas" and deletes `ws[addr].f` on every cell of every sheet.
- *Impact:* Confirmed dead: grep shows the only consumers of navSheetInfo are `.sheetName`; the renderer destructures navTree and touches only `.roots` / `.nodes` (renderer.js:1030-1031). The vestige is actively misleading — writeWorkbook:1641-1644 re-creates `navSheetInfo.columns` with *numeric* indices (`{ id: 0, number: 1, ... }`) where parseNavSheet produces *letters*, a type mismatch that survives only because nobody reads the field. Anyone reintroducing formulas would trust one of two incompatible shapes.
- *Proposed fix:* Delete `colLetter()` (780-788), the `columns` block (883-889) — return `{ roots, nodes }` — and the `columns:` keys on navSheetInfo (653, 1641-1644), narrowing navSheetInfo to `{ sheetName }` (and update the type comment on line 15).

### [dead-code] `preload.js:12`
**Four exposed contextBridge methods have zero callers in src/, and three of them are still backed by live ipcMain handlers.**

- *Evidence:* getCurrentPath: ()        => ipcRenderer.invoke('get-current-path'),
- *Impact:* Grepping `electronAPI.<name>` across all of src/ (including help.html; there is no dynamic `electronAPI[...]` access anywhere) returns 0 hits for `getCurrentPath` (:12), `setFileRubricDir` (:33), `evaluateFormula` (:48) and `removeAllListeners` (:132). The first three still have live handlers in main.js (`get-current-path` :1962, `set-file-rubric-dir` :2764, `evaluate-formula` :3050), so this is unused IPC surface exposed into the renderer plus three dead handlers in the main process — needless attack surface on a contextBridge whose whole job is to be a minimal, audited boundary, and a maintenance trap (someone will 'fix' evaluate-formula one day for no one).
- *Proposed fix:* Remove the four bridge methods from preload.js and the three now-orphaned `ipcMain.handle` blocks in main.js. If `removeAllListeners` is being kept deliberately as a teardown escape hatch, it is currently unreachable — either use it in the renderer's view-teardown paths or drop it.

### [dead-code] `src/sitemap-template.js:204`
**Three functions in the sitemap engine and one CSS class in both engines are never reached, and get inlined into every client export via Function.toString().**

- *Evidence:* `function hexRgba(hex, a) {` — grep across the whole repo returns exactly one hit for each of `hexRgba` (line 204), `dedupeParentRules` (line 802) and `parentOf` (line 811): their own definitions, no call sites. Likewise `document.body.classList.add('print-ready')` (sitemap-template.js:914, treemap-template.js:239) — `.print-ready` has no matching rule in either engine's CSS or in styles.css.
- *Impact:* Small but it is shipped code: because the engine body is serialized with `Function.prototype.toString()`, every dead function is embedded verbatim in every client-shareable HTML export and every PDF source document. `dedupeParentRules` in particular is a stub for a feature (parentId rule dedupe) that the Colors tab never wired up, and `parentOf` duplicates the `INDEX[id].parentId` lookup already done inline in `matchesRule`. They read as live infrastructure to the next person touching the color-rule engine.
- *Proposed fix:* Delete `hexRgba`, `dedupeParentRules` and `parentOf` from sitemap-template.js, and drop the `print-ready` class add from both engines' `markReady()` (the `printing` body class plus the `@media print` block already do all the actual work) — or add the missing `.print-ready` rule if it was meant to exist.

### [dead-code] `main.js:3050`
**The `evaluate-formula` IPC handler and its preload bridge have no caller anywhere in the renderer.**

- *Evidence:* ipcMain.handle('evaluate-formula', (event, { formula, row }) => { … const rule = parseFieldRule(formula); return { result: evaluateFieldRule(rule, row) }; });
- *Impact:* `evaluateFormula` appears exactly once in the codebase outside this handler — `preload.js:48` — and never in `src/renderer.js`. It is an exposed, unused surface on `window.electronAPI` that invites future callers into the rubric single-condition grammar (`parseFieldRule`, 2284) rather than the computed-column grammar (`parseFormulaExpr`, 2421) — two parallel formula vocabularies, only one of which is actually wired up. Keeping it alive also means the rubric parser can never be changed without checking a dead path.
- *Proposed fix:* Delete the handler (3050-3057) and `evaluateFormula` from preload.js:48. `parseFieldRule`/`evaluateFieldRule` stay — they are still the engine behind `assess-row` (2802).

### [dead-code] `src/sitemap-template.js:204`
**A cluster of helpers and locals are defined but never referenced anywhere in the codebase.**

- *Evidence:* Each of these appears exactly once across main.js, preload.js, project-store.js, renderer.js, sitemap-template.js, treemap-template.js, index.html and help.html — the definition line itself: `function hexRgba(hex, a)` (sitemap-template.js:204), `function dedupeParentRules(rules)` (sitemap-template.js:802), `function parentOf(id) { return INDEX[id] ? INDEX[id].parentId : null; }` (sitemap-template.js:811).
- *Impact:* Pure carry cost, but `hexRgba`/`dedupeParentRules`/`parentOf` sit inside the sitemap engine function that is serialized via `Function.toString()` and inlined into every generated sitemap HTML — so they are re-emitted into each app view, client export, and print/PDF document. The same one-reference check also flags `countNodePages` (renderer.js:15101, a thin wrapper over `_navPageCountsCache()`), `_projectSettingsPos` (renderer.js:6600, a leftover from when Project Settings was a draggable popover rather than a modal using `makeModalDraggable`/`resetModalPosition`), and `_frMatches` (renderer.js:21581, declared beside the still-live `_frCurrent` but never read or written).
- *Proposed fix:* Delete `hexRgba`, `dedupeParentRules` and `parentOf` from src/sitemap-template.js, and `countNodePages`, `_projectSettingsPos` and `_frMatches` from src/renderer.js. Callers wanting a node's page count should use `_navPageCountsCache()[node.id] || 0` directly, which is what `countNodePages` was.

### [docs-drift] `main.js:2233`
**CLAUDE.md contradicts itself on where `designPatternLibrary` is stored (per-project vs global prefs), and the default library's size is stated as 57 entries / 12 categories when it is 61 / 13.**

- *Evidence:* CLAUDE.md:239 (state object): "`designPatternLibrary: [], // per-project UI/design patterns …; structural sheet DesignPatternLibrary`" vs CLAUDE.md:379: "**app-level (global), stored in `prefs.json`**". Code agrees with the latter: `main.js:2233  designPatternLibrary: prefs.designPatternLibrary || []` inside the `get-prefs` handler. Separately, CLAUDE.md:188/379/671 all say "57 entries" / "57 entries across 12 categories"; counting `name:` and distinct `category:` values in `DEFAULT_DESIGN_PATTERN_LIBRARY` (main.js:1280) gives 61 entries across 13 categories (the 13th being `Structural`).
- *Impact:* The storage contradiction sends a dev to add a per-project migration for a value that actually lives in global prefs (or vice-versa) — the two tiers have different save paths and different sharing semantics for a client handoff. The entry count is cosmetic on its own but is the kind of number a reader trusts without checking.
- *Proposed fix:* Correct the comment at CLAUDE.md:239 to match CLAUDE.md:379 (global, `prefs.json`, with the xlsx sheet merged in for back-compat), and update the three "57 entries / 12 categories" mentions to 61 / 13 — or drop the count so it cannot go stale again.

### [duplication] `src/renderer.js:7708`
**ensureSuggestedKkeColumns duplicates ensureGaKkeColumns' addCol closure verbatim; the derived-column insertion dance has no shared helper despite being a documented extension pattern.**

- *Evidence:* const addCol = (name, afterIdx) => { if (headers.includes(name)) return; const idx = Math.min(Math.max(afterIdx, 0), headers.length - 1) + 1; headers.splice(idx, 0, name); state.editedRows.forEach(r => { if (!(name in r)) r[name] = ''; }); state.rows.forEach(r => { if (!(name in r)) r[name] = ''; }); };
- *Impact:* Byte-identical to lines 7476-7482 in `ensureGaKkeColumns`. This three-way mutation (headers.splice + backfill editedRows + backfill rows) is the exact sequence CLAUDE.md's "Add a new computed/derived column" recipe prescribes, so every future derived column copies it again — and any drift (e.g. forgetting the `state.rows` backfill) produces columns that silently vanish from one of the two row arrays. The same slice also redeclares an identical `TRACK_OPTIONS` literal twice (8030 in the ContentTypeRegistry editor, 8289 in the Target Spec editor), a third parallel copy of the vocabulary `deriveMigrationTrackSuggestion` hardcodes at 1534.
- *Proposed fix:* Hoist one module-level `insertDerivedColumn(name, afterIdx)` and have both `ensureGaKkeColumns` and `ensureSuggestedKkeColumns` call it. Likewise hoist `MIGRATION_TRACK_OPTIONS` (and `NATURE_OPTIONS`/`NATURE_LABEL`) to module scope next to `BUILTIN_KKE` so the two editors and the suggestion deriver share one vocabulary.

### [duplication] `src/renderer.js:12424`
**menuExportDefaultName re-derives the project slug with an expression byte-identical to sitemapProjectSlug(), which is defined 158 lines away in the same section.**

- *Evidence:* const slug = (ps.projectName || ps.clientName || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
- *Impact:* The same slug expression is written out five times in renderer.js (12424, 12582, 17594, 18935, 19045). sitemapProjectSlug() at 12582 is already the extracted helper, and menuExportDefaultName sits in the same Menus/Sitemap block — so the copy here is pure drift risk: any change to slug rules (e.g. length cap, unicode handling) silently produces mismatched filenames between the menu export and every sitemap/treemap export of the same project.
- *Proposed fix:* Replace the body of menuExportDefaultName with `return `${sitemapProjectSlug()}-menus-${new Date().toISOString().slice(0,10)}.${ext}`;` and point the three out-of-slice copies (17594, 18935, 19045) at the same helper.

### [duplication] `src/styles.css:465`
**Nine per-component `X.hidden { display: none; }` rules are unconditional no-ops — the global `.hidden { display: none !important; }` already wins over all of them.**

- *Evidence:* styles.css:5436 `.hidden { display: none !important; }`. The redundant rules: :465 #bulk-bar.hidden, :543 #batch-bar.hidden, :1005 .ga-kke-banner.hidden, :1719 #webview-compare.hidden, :4560 .audit-cluster.hidden, :4622 .sme-fields-inline.hidden, :4657 .final-kke-match.hidden, :4659 .final-kke-select.hidden, :4760 .ps-tab-content.hidden.
- *Impact:* An author `!important` beats any non-important rule regardless of specificity, so none of these nine ever contribute a byte of behaviour. They actively mislead: the comment at styles.css:1119 ("visibility handled by the unified .audit-cluster.hidden rule") credits one of these dead rules for behaviour the global .hidden is actually providing, so the next author will reason about the wrong mechanism.
- *Proposed fix:* Delete all nine and let the single global .hidden rule do the work. If a component genuinely needs a non-none hidden state, it needs a distinct class, not a shadowed override.

### [performance] `src/renderer.js:7583`
**computeGaKke runs a full applyFilter() re-filter and re-render twice for a single compute action.**

- *Evidence:* computeSuggestedKke();

  applyFilter();
- *Impact:* `computeSuggestedKke()` (7729) already ends with its own `setDirty(true)` + `applyFilter()` + `updateSuggestedKkeBadge()` at 7758-7762, so `computeGaKke` immediately repeats all three. `applyFilter()` re-filters all 4,000 rows (with a per-row `Object.values(row).some(...)` scan when a text filter is active, i.e. O(rows × columns)) and rebuilds the virtualized sidebar. Same double-pass hits `runBatchAssessment` (5748) and the Project Settings "Save weights & recompute" path.
- *Proposed fix:* Give `computeSuggestedKke(opts)` a `{ refreshUi: false }` flag (or extract a `computeSuggestedKkeCore()` that only mutates rows), and let the outermost caller do the single `setDirty` + `applyFilter` + badge refresh — the same defer-the-render shape recommended for `clearNavAssignment` above.

### [simplification] `src/renderer.js:10266`
**Three verbatim copies of "mint a new top-level nav node" — createRootNodeFromPage(), createBucketNode()'s root branch, and addNavRootNode() — differing only in where the label and slug come from.**

- *Evidence:* const id = String(maxId + 1).padStart(5, '0');
  const number = String(state.navTree.length + 1);
  const sortID = buildSortID(number);
  const newNode = { number, label: cleanLabel, path: slug, sortID, parentNumber: '', breadcrumb: cleanLabel, computedPath: slug, id, children: [] };
  state.navTree.push(newNode); state.navNodes.push(newNode);   // identical to createRootNodeFromPage() (10026-10034) and addNavRootNode() (14695-14706)
- *Impact:* Three places to keep in sync every time the node shape gains a field — and they have already drifted: createBucketNode() dedupes its slug against siblings via uniqueSiblingSlug() and sanitizes the label, while createRootNodeFromPage() (the audit-bar 'create the first sitemap node' path) does neither, so it can mint a root whose slug collides with an existing one. addNavRootNode() additionally sets navTreeDirty/setDirty, which the other two leave to their callers — an easy omission to make in a fourth copy.
- *Proposed fix:* Keep createBucketNode(label, parentNode) as the single root/child minting entry point and have createRootNodeFromPage() and addNavRootNode() delegate to it (passing an explicit slug where they need one), so slug dedup, label sanitization and the node literal live in one place.

### [ui-standards] `src/renderer.js:4061`
**Design-pattern chips are styled with hardcoded hex colours inlined via `style.cssText`, violating the repo's stated 'no hardcoded colors — use the :root custom properties' contract.**

- *Evidence:* `chip.className = 'tag-chip'; chip.style.cssText = 'background:#ede9fe;color:#5b21b6;border-color:#c4b5fd;';` — the tag chips two functions earlier (3862) use only the `tag-chip` class with no inline colours.
- *Impact:* The violet component-chip palette can't be retuned from the design tokens, won't follow the `.cluster-patterns` pill colour if it changes, and can't participate in any theme change — while the visually parallel tag chips can. docs/UI_STANDARDS.md names this as a pre-merge checklist item.
- *Proposed fix:* Add a `.dp-chip` (or `.tag-chip.tag-chip-pattern`) rule in styles.css backed by new `--dp-chip-bg / --dp-chip-fg / --dp-chip-border` tokens in `:root`, and replace the `style.cssText` line with `chip.className = 'tag-chip dp-chip';`.

### [ui-standards] `src/renderer.js:17795`
**openUnifiedExportDialog hand-builds its overlay/modal, Esc key handler, backdrop close and z-index instead of using openModal(), which the neighbouring openProfileExportDialog uses correctly.**

- *Evidence:* overlay.className = 'modal-overlay';
  overlay.style.zIndex = '900';
- *Impact:* CLAUDE.md and docs/UI_STANDARDS.md make openModal() the contract precisely because it owns Esc, backdrop-close, the `.modal-close ×` header and z-index *stacking*. The hardcoded `zIndex = '900'` sits outside that stack, and the private `document.addEventListener('keydown', onKey)` is a second, uncoordinated Esc handler; openProfileExportDialog 60 lines below (17677) already does this the sanctioned way, so this is drift rather than a deliberate exception.
- *Proposed fix:* Rebuild it with openModal({ title: 'Export…', body, width, buttons: [] }) and wire the `.xpd-option` clicks off `m.dialog`, deleting the manual overlay/keydown/backdrop plumbing (17795-17865).
