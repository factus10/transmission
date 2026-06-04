# Transmission — Review Findings & Prioritized Backlog

**Date:** June 2026
**Scope:** End-to-end UI/UX consistency review + feature refinement + new-feature ideas.
**Method:** Read of HANDOFF.md, CLAUDE.md, USER_GUIDE.md + direct source audit of `src/renderer.js`, `src/index.html`, `src/styles.css`, `main.js`.

Each item below is tagged with **status**, **effort** (S/M/L), and concrete **file refs** where known.

Legend: ☐ todo · ◐ in progress · ☑ done

---

## Implemented this session (✓)
- ☑ **Unified dialog system** — `openModal` / `confirmDialog` / `alertDialog` + refactored `showPrompt` (renderer.js, after the prompt section). Shared z-index stack, Esc-closes, backdrop-closes, focus, consistent footer. CSS in styles.css (`.app-modal*`, `.modal-title`, `.modal-close-btn`, `.modal-message`, `.modal-prompt-input`).
- ☑ **Replaced all 15 native `confirm()` + 1 `alert()`** with `confirmDialog`/`alertDialog`.
- ☑ **Shortcut cheat-sheet** — `?` from anywhere, or Help → Keyboard Shortcuts (`⌘/`). `openShortcutHelp()`.
- ☑ **First-run welcome** — `openWelcomeDialog()` on first launch (gated by new `seenWelcome` pref), re-openable via Help → Getting Started.
- ☑ **Real front door** — `#no-selection` panel now shows "No file open yet" + Open/Getting-started buttons when no file is loaded (`updateNoSelectionState()`).
- ☑ **Dialog chrome standardized** — defined and enforced one standard: header = title left + a single **`.modal-close` ✕** top-right (= dismiss/Esc); footer = right-aligned `Cancel`(ghost) + primary(`Save`/`Done`), left-aligned utilities; list actions (Add/Seed) live at the top. Fixes applied: `.modal-close` is now a **global** style (was only defined under `.ctr-modal`, so Page Template & Component fell back to default boxed-button chrome); converted the four text-"Close" header buttons (Glossary, GA, Consolidation Candidates, Nav-node editor), Non-200's ghost-✕, Project Settings' `.icon-btn`, and 10 other centered-modal headers (field picker, App Settings, computed columns, nav assignment, rubric, progress, SME export/resolve, table columns, import/merge) all to `.modal-close ×`; moved Glossary "+ Add entry" from the footer to the top tab row to match the other editors. Popovers (notes, assess), toolbars (compare, redirect find/replace, global search), and the full-panel nav-tree close intentionally keep their own affordances.
- ☑ **Footer layout + count nouns unified** — the footer flex/padding style (count-left via a `flex:1` span, `Cancel`+`Save` pushed right) was only scoped to `.ctr-modal`, so the `.pl-modal` editors (Component & Page Template) bunched everything left with no padding. Promoted that style to the **global `.modal-footer`** (removed the redundant `.ctr-modal` rule). Also made the entry-count noun match each editor's concept: **"N components"** (Component Library), **"N templates"** (Page Template Library), **"N entries"** (Content Type Registry) — and aligned their seed/save toasts to the same nouns.
- ☑ **Noted exceptions brought into compliance** — (1) **Consolidate picker** now has a `.modal-close ×` in its header and is registered via `registerModalDismiss` (Esc + z-stack), like every other centered modal. (2) **Footer container divergence**: the global `.modal-footer` now right-aligns by default (`justify-content:flex-end`), and the seven centered-modal footers that used bespoke `#*-footer` CSS (field picker, rubric, nav tree, SME export, SME resolve, table columns, import/merge) now use `class="modal-footer"` with their redundant per-id rules deleted — footer styling is fully centralized. (3) **`info` toast** is now a real styled type (`#toast.info`, new `--info` token, light+dark). Popover footers (notes/assess/nav) remain intentionally exempt. **Project Settings** keeps its single `Done` (no Cancel) — this is the sanctioned *live-save* pattern documented in `UI_STANDARDS.md` §2, not a violation.
- ☑ **App-wide modal button audit** — inventoried all ~23 renderer modals + 17 index.html modals/popovers and enforced one footer spec: action buttons are **`btn btn-sm`** (was full-size in 6 editors: Component, Page Template, Content Type Registry, Suggested KKE, Apply Pattern, Migration Tracker); **Cancel = `btn btn-sm btn-ghost`**, **primary = `btn btn-sm btn-primary` rightmost**, Cancel immediately left of primary; left side = ghost utilities. Specific fixes: Field Picker had primary on the *left* (reordered Cancel→Save); Computed Columns had primary on the left + a "Close" label (now Recalculate ghost-left / **Done** primary-right, space-between); nav-tree close `icon-btn`→`.modal-close ×`; orphan-node "Remove node" now uses the **`.btn-danger`** class instead of inline `background:var(--danger)`. The 6 secondary "Delete" buttons (ghost + `kke-kill` text) were already mutually consistent and left as the secondary-destructive convention. Popovers (notes, assess) keep `icon-btn ✕` by design.
- ☑ **Bespoke modals routed through the factory** — kill-cleanup modals (`showKillCleanupModal`, `showBulkKillCleanupModal`) rewritten onto `openModal`; the four large editors (Component Library, Custom-KKE merge, Glossary, Non-200 triage) retrofitted via `registerModalDismiss()` so they inherit **Esc-to-close** and a **coordinated z-index stack**. The stack is self-healing (`_pruneModalStack()`) so editors that close via their own buttons don't leak entries.

> **Doc/code bug found & FIXED:** USER_GUIDE shortcuts table said `4` = Exclude, but the code maps `4` = Consolidate, `5` = Exclude. Corrected the table to `1/2/3/4/5/0 = Keep/Kill/Evolve/Consolidate/Exclude/Clear` and added the `?` cheat-sheet row.

---

## P0 — Consistency foundations (do first; everything else feels better after)

### ☑ Unified dialog system  · L  — DONE. Factory + confirm/prompt/alert migration + bespoke editors retrofitted (Esc + z-stack). Remaining bespoke modals not yet touched: Project Settings & Field Picker already used the `.modal-overlay` HTML pattern with Esc; they could be folded onto the factory later but are low-priority since they already behave correctly.
**Problem.** Modals are constructed ~5 different ways: pre-built HTML toggled with `.hidden` (Field Picker, Project Settings); runtime `createElement` with inline styles (`showPrompt` r1425, kill-cleanup r1516/r1570, `openCustomKkeMergeDialog`); runtime with `.modal-overlay`/`.modal-dialog` classes (Component Library, Suggested KKE, Non-200 triage). Glossary is top-aligned (`top:40px`) while others center.
- **Z-index** is hand-picked per modal: 600 (CSS), 800/900, 920/930, 950. No coordination → stacking bugs when one dialog opens another.
- **Esc-to-close** works in ~half. Missing: Component Library, Non-200 triage, Custom-KKE merge, Glossary. (The shortcuts table promises "Escape closes modal" — it silently fails here.)
- **Backdrop-click** has 3 behaviors: always-close, close-only-if-`target===overlay`, no-handler.

**Fix.** One module: `openModal({title, body, buttons, width, draggable, onClose})` + `confirmDialog({title, message, confirmLabel, danger})→Promise<bool>`. Guarantees: centered, draggable, Esc-closes, backdrop-click-closes, focus-trap, single z-index stack (counter, not literals), consistent footer order (Cancel left / primary right). Promote `makeModalDraggable` (r4679) and `showPrompt` into it.

### ☑ Replace 15 native `confirm()` + 1 `alert()`  · M — DONE (all migrated to `confirmDialog`/`alertDialog`).

### ☑ Retrofit Esc + backdrop on remaining bespoke modals  · S — DONE (Component Library, Non-200 triage, Custom-KKE merge, Glossary, Consolidate picker all via `registerModalDismiss`).

---

## P1 — Learning curve & discoverability (the real adoption risk)

### ☑ Real first-run / welcome screen  · M — DONE. `#no-selection` is now a context-aware front door ("No file open yet" + Open/Getting-started) and `openWelcomeDialog()` runs once on first launch. (Not yet added: "Open Recent" inside the welcome, and screencast links — those depend on the P4 screencasts existing.)

### ☑ Keyboard shortcut cheat-sheet overlay (`?` / Cmd+/)  · S — DONE (`openShortcutHelp()`, `?` anywhere + Help → Keyboard Shortcuts).

### ☑ First-run product tour (5 steps)  · M — DONE. `startProductTour()` — a spotlight walkthrough (open file → views → decide → filter/batch → plan & hand off). Each step anchors to a real element when visible (`#btn-open-empty`, `#view-switcher`, `#field-bar-audit`/`#row-list-wrap`, `#toolbar`) and falls back to a centered card otherwise, so it works with or without a file open. Next/Back/Skip + progress dots; ←/→/Esc keys; click-outside skips. Launchable from the welcome dialog ("Take a quick tour") and **Help → Product Tour**. NOTE: it does not auto-run separately on first launch — the welcome dialog is the auto first-run experience and offers the tour as a one-click option (avoids a double popup). Say the word if you'd rather it auto-start. Flattens the curve more than any doc.

### ☑ Make hidden clusters discoverable  · S — DONE. Added a "+ More fields:" label before the SME/Migrate/Components quick-toggle chips so they read as reveal-toggles.

### ☑ Label the App-vs-Project settings distinction  · S — DONE. App Settings header now reads "App Settings · Applies to you, across all files"; Project Settings header "Project Settings · Saved with this file — travels with the spreadsheet" (`.modal-subtitle`).

---

## P2 — Trust & rough edges  ✅ ALL DONE

### ☑ Undo-scope honesty  · S — DONE. The empty-undo toast now reads "Nothing to undo — only KKE changes are undoable" (the undo stack only ever holds KKE actions, so this is the honest scope signal).

### ☑ Save-state legibility  · S — DONE. Titlebar now shows "⟳ Saving…" while a save is in flight (`showSavingStatus()` in `saveFile`) and "✓ All changes saved" at rest (`setDirty(false)`); a failed save restores the "Unsaved changes" indicator.

### ☑ Non-200 triage: "Don't offer again for this file"  · S — DONE. The auto-offer was already a passive toast (not a blocking dialog) gated on `non200TriageDismissed`, but nothing *set* the flag. Added a "Don't remind me about this file" checkbox to the triage dialog footer that persists it to `projectSettings`.

### ☑ Table View ↔ sidebar filter divergence banner  · S — DONE. When the sidebar has active filters, Table View shows an info banner (`#table-view-divergence`) clarifying it filters independently and is showing all rows.

### ☑ Expose latent nav build filters  · S — DONE. `populateNavBuildFilter()` now appends per-value `status:NAME` / `assignee:NAME` options (from the project's Page Status & Assignee libraries) to the nav Build-filter dropdown, rebuilt on each `renderNavEditor()`.

### ☑ Single Reports menu  · S — DONE. All reports now live under **Reports** (grouped: stakeholder · IA/components · migration), and **Migration** is now just export/validation tools (Migration Tracker, Export Redirect Map CSV, Redirect Chain Check).

---

## P3 — New features (polish-first ordering)

### ☑ "Pre-Handoff Check" command  · M — DONE. `runPreHandoffCheck()` (Migration → Pre-Handoff Check…) runs six pre-flight checks — unreviewed rows, consolidate-no-target, dead consolidate targets, redirect chains (Kill→Kill), duplicate nav IDs, empty nav leaves — into one pass/issue report with per-check fix hints, exportable as PDF/HTML. Refactored chain detection into reusable `computeRedirectChains()`. Nav checks auto-skip when there's no NavStructure.

### ☑ Jump-to-next-unreviewed (`]`)  · S — DONE. `jumpToNextUnreviewed()` bound to `]`; advances to the next blank-KKE row in the filtered list (wraps; works with nothing selected). Added to the cheat-sheet.

### ☑ Note templates / snippets  · S — DONE. Notes popover has a "Snippets…" select: insert a saved snippet at the cursor, "Save current note as snippet", and a "Manage snippets…" dialog. Stored app-wide in the `noteTemplates` pref.

### ☑ Session resume cue  · S — DONE. `showSessionResumeCue()` on file open: "Resuming: N reviewed, M to go (P%) — press ] for the next unreviewed" (only when there's prior progress).

### ☑ Proactive AI triage pass  · M — DONE. **Project → AI Suggest for Unreviewed…** (`runSuggestForUnreviewed`). Decision: writes to **Suggested_KKE** (never the human KKE) by filling `_AssessmentResult` for blank-KKE rows then running `computeSuggestedKke()`. Requires the user's Claude API key (errors clearly if missing); Esc cancels mid-run.

### ☑ Sidebar screenshot thumbnails  · M — DONE (sane version). Lazy capture-on-visit: after a page settles, `els.webview.capturePage()` stores a 320px thumbnail in an in-memory LRU (`_thumbCache`, cap 250, never persisted). Shown as a hover-preview (`#thumb-preview`) on sidebar rows you've visited. Degrades silently if `capturePage` is unavailable. NOTE: the capture path couldn't be runtime-verified headlessly (needs a loaded page) — worth a quick manual hover check.

### ☑ Audit diff view (KKE vs SME)  · M — DONE. **SME → Compare KKE vs SME…** (`openKkeVsSmeView`). Decision: compares the auditor's KKE against the SME decision (not two files). Near-fullscreen view via `openModal` (94vw): summary counts (agree / changed / pending / not-yet-reviewed), a status filter, and a per-row table (Page · Auditor · SME · Final · Status). Row click closes and jumps to that row in the audit view.

---

## P4 — Training materials

### ☑ 2-page Quick Start  · S — DONE. Created `QUICK_START.md` ("your first audit in ~10 minutes"): open → decide (the core loop) → filter & batch → plan migration → check & hand off, plus the shortcuts and SME flow.
### ◐ Task-based recipes  · S — PARTIAL. The Quick Start embeds the key flows (consolidation candidates, SME handoff, CMS-import batching, pre-handoff). A standalone recipes doc could still be split out if wanted.
### ☑ Docs pass for this session's features — DONE. Updated `USER_GUIDE.md` (Pre-Handoff Check, AI Suggest for Unreviewed, Compare KKE vs SME, Notes & Snippets, Page Thumbnails, welcome/tour/cheat-sheet, save-state, undo scope, `]`, Table-View divergence, Reports/Migration menu reorg), `src/help.html` (getting-help + helpers section, KKE 1–5, save-state), and `README.md` (menu org, new feature bullets).
### ☑ Single source of truth for docs  · M — DONE (terminology). Swept the renamed UI labels across all user-facing docs: **Design Pattern Library → Component Library**, **Design Pattern Inventory → Component Inventory**, **Pattern Library → Page Template Library**, plus cluster/chip/pill/pref labels (Patterns → Components, "Show Components cluster", "COMPONENTS" pill) and section headings ("Component Auditing"). Files: `README.md`, `USER_GUIDE.md`, `src/help.html`. Also fixed a help.html bug that listed the Component Library's storage as the `PatternLibrary` sheet (it's `DesignPatternLibrary`). PITCH.md had no occurrences. CLAUDE.md intentionally retains the internal code identifiers (`Design_Patterns` column, `DesignPatternLibrary`/`PatternLibrary` sheets, `openDesignPatternLibraryEditor`, `#design-pattern-*` IDs) — those name real code and already pair with the correct UI labels. (A generate-help-from-one-source pipeline is still a possible future nicety, but the drift itself is resolved.)
### ◐ 3–5 short screencasts (60–120s)  · M — SCRIPTS DONE, recording pending. `SCREENCASTS.md` has shot-by-shot scripts (setup conventions + on-screen actions + narration + end cards) for all five: Core Loop, Filter & Batch, Consolidation, Migration Planning & Export, Reports & SME — plus three optional shorts (AI Suggest, Product Tour, Thumbnails). The actual recording is the only remaining step (out of scope for code).

### ☑ UI/UX standards document — created `UI_STANDARDS.md`: the interaction/presentation contract (dialog system, button/footer/close conventions, tokens, naming, feedback, empty states, pre-merge checklist). Linked from `CLAUDE.md` (top of the docs section) and `HANDOFF.md` so future sessions read it before building UI.

---

## Notes on what's already strong (don't regress)
- `showToast` is used consistently (203 calls) — good feedback discipline.
- Button system is coherent: `.btn` base + `.btn-primary`/`.btn-ghost`/`.btn-sm`/`.btn-danger`.
- The custom delete-node dialog, consolidate picker, and reference picker are genuinely good — they're the *target* quality bar the native confirms should match.
- `state.rows` (read-only) vs `state.editedRows` (working copy) separation is clean.
