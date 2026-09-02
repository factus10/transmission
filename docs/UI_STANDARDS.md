# Transmission — UI / UX Standards

**Purpose.** This is the contract for building UI in this app. Follow it so new features feel like they were always part of the product. It is prescriptive on purpose — when in doubt, do what's written here. Architecture (state, IPC, file I/O) lives in `CLAUDE.md`; this doc is about *interaction and presentation*.

If you find existing code that violates a rule here, prefer fixing it to match (it's probably pre-standardization), unless doing so is risky — in which case note it in `REVIEW_FINDINGS.md`.

---

## 0. Golden rules (non-negotiable)

1. **Never use `window.confirm` / `window.alert` / `window.prompt`.** They're blocked or off-brand in Electron. Use `confirmDialog`, `alertDialog`, `showPrompt`.
2. **Never build a modal from scratch with inline-styled overlay/dialog divs.** Use `openModal()`. If you're extending a pre-existing hand-built modal, retrofit it with `registerModalDismiss()`.
3. **Never hardcode colors, fonts, or key dimensions.** Use the CSS custom properties (`var(--…)`).
4. **Never give blocking feedback for non-decisions.** Use `showToast()`.
5. **Primary action is always the rightmost footer button, green, `btn btn-sm btn-primary`.** Cancel sits immediately to its left as `btn btn-sm btn-ghost`.
6. **Every centered dialog has a `.modal-close ×` in its header** and closes on Esc + backdrop click (free if you use the factory).

---

## 1. Dialogs & modals

### 1.1 Pick the right tool

| Need | Use | Returns |
|------|-----|---------|
| Yes/no decision | `confirmDialog({title, message, confirmLabel, danger})` | `Promise<boolean>` |
| Acknowledge a message | `alertDialog({title, message, okLabel})` | `Promise<void>` |
| One short text input | `showPrompt(title, placeholder, defaultValue)` | `Promise<string\|null>` |
| Any custom dialog (forms, lists, two-pane editors) | `openModal({...})` | `{ close, overlay, dialog, body, footer }` |
| Add Esc + z-stacking to a **pre-existing** hand-built modal you can't easily rewrite | `registerModalDismiss(overlay, dialog, rawClose)` | wrapped `close` fn |

All five live near the top of `renderer.js` under "Unified dialog system." Read that block before adding UI.

### 1.2 `confirmDialog` — the default for "are you sure?"

```js
if (!(await confirmDialog({
  title: 'Delete sitemap node',
  message: `Delete "${node.label}"?\n\n${pageCount} pages will lose their assignment.`,
  confirmLabel: 'Delete',
  danger: true,            // red primary button for destructive actions
}))) return;
// …proceed
```

- The enclosing function must be `async`. Event handlers and `setTimeout` callbacks can be made `async` freely.
- `danger: true` makes the confirm button `.btn-danger` (filled red). Use it for any irreversible action.
- Esc / backdrop / ✕ all resolve `false`.

### 1.3 `openModal` — custom dialogs

```js
const body = document.createElement('div');
body.innerHTML = `…your form / list / two-pane editor…`;

openModal({
  title: 'Migration Tracker',
  body,                              // string (innerHTML) or a DOM Node
  width: 560,                        // number → px, or a CSS string
  className: 'mte-modal',            // optional extra class for bespoke layout
  escapeValue: null,                 // value passed to onClose on Esc/backdrop/✕
  buttons: [
    { label: 'Cancel', variant: 'ghost', value: null },
    { label: 'Export', variant: 'primary', primary: true,
      onClick: (api) => collectExportOptions(body) },   // return value → close result
  ],
  onClose: (result) => { /* single resolution point */ },
});
```

You get for free: centered + draggable, **Esc-closes**, **backdrop-click-closes**, focus on the first field/primary button, a coordinated **z-index stack** (nested dialogs always layer correctly), and a `.modal-close ×` header button. **Do not** add your own Esc/backdrop/z-index — the factory owns those.

Button objects: `{ label, variant: 'primary'|'danger'|'ghost', value, primary, onClick, closeOnClick }`.
- `primary: true` marks the Enter-key default and the rightmost emphasis.
- `onClick(api)` may return a value used as the close result; set `closeOnClick: false` to keep the dialog open (e.g. validation failed).

### 1.4 Anatomy & order

```
┌ .modal-header ───────────────────────────────────┐
│ .modal-title (left)              .modal-close × (right) │
├ .modal-body / .app-modal-body (scrolls) ──────────┤
│ …content…                                          │
├ .modal-footer ────────────────────────────────────┤
│ [utility ghost]  …spacer…   [Cancel ghost] [Primary] │  ← primary rightmost
└────────────────────────────────────────────────────┘
```

### 1.5 Retrofitting an existing hand-built modal

If a legacy modal builds its own overlay/dialog and you only need to make it behave correctly (Esc + z-stack), don't rewrite it — call this right after it's appended to the DOM:

```js
document.body.appendChild(overlay);
overlay.appendChild(dialog);   // a CHILD of the overlay — see below
registerModalDismiss(overlay, dialog, () => close()); // close = its existing teardown
```

It assigns a stacked z-index and wires Esc. The modal keeps its own backdrop/button close paths; the stack is self-healing (`_pruneModalStack`) so it won't leak. New modals should use `openModal` instead.

**The dialog must be a child of the overlay, or carry its own `position`.** `.modal-overlay` is `position: fixed` with a z-index, so it opens a stacking context; `.modal-dialog` is *not* positioned, and **z-index is ignored on a static-position element**. A dialog appended to `<body>` as the overlay's *sibling* therefore paints **under** the dim mask however high a z-index it — or `registerModalDismiss` — is given: the screen dims and the dialog is unreachable. Two ways out, and only two:

- **Preferred:** append the dialog *into* the overlay. It gets flex-centered and paints above the mask, exactly as `openModal()` does.
- **Legacy:** keep it a sibling but give it `position: fixed` in its own inline `cssText`. Most hand-built dialogs in `renderer.js` do this and are fine; the ones that forgot are how this rule got written.

`makeModalDraggable()` works either way — it switches to `position: absolute`, which resolves against the `inset: 0` overlay to the same viewport coordinates.

### 1.6 Popovers, toolbars, and full-panel views are NOT modals

Notes/Assess popovers, the compare/redirect-find-replace/global-search toolbars, and the full-panel Table/Tree/Redirect views are intentionally *not* centered dialogs. They keep their own affordances (e.g. an `icon-btn ✕`). Don't force the modal standard onto them.

### 1.7 Toolbars & control strips wrap at narrow widths

Any horizontal strip of controls (view toolbars, filter bars, action bars, audit-bar clusters) **must wrap onto extra rows rather than overflow.** A `display:flex` strip with no wrap pushes its right-hand controls (stats, `Back to Audit`, `Replace All`, `Delete Selected…`) off the edge, where the container's `overflow:hidden` clips them invisibly — the user can't tell a control exists.

The rule for every control strip:

- Add **`flex-wrap: wrap; row-gap: 6px;`** (the sidebar toolbar `#toolbar-row2` and every view toolbar now do this). Don't rely on `overflow-x: auto` — a horizontal scrollbar inside app chrome is a smell and hides controls until scrolled.
- Keep a `<span style="flex:1"></span>` spacer (or `margin-left:auto`) to right-align trailing controls; on wrap they drop to a new row, still visible.
- Give any `flex:1` input a **`min-width`** so it can't collapse to a sliver when it shares a wrapped row (see `#redirect-find-replace-bar .re-search-input`).
- Let a `flex:1` field cluster (e.g. `#meta-fields`) carry `overflow:hidden` so its `min-width` resolves to 0 and it absorbs the squeeze instead of forcing overflow.
- Dialogs cap at `calc(100vw - 32px)` / `calc(100vh - 48px)` (`.app-modal` and `.modal-dialog`) so they never exceed a narrow window.

The app window's `minWidth`/`minHeight` (`main.js`, 960×640) is the floor; verified graceful down to ~500px so there's comfortable headroom. Verify new strips with the in-project HTML-preview technique (a throwaway page linking `src/styles.css`, rendered in the browser pane at 960/760/620/500px).

---

## 2. Buttons

### 2.1 The class system (defined in `styles.css`)

| Class | Use |
|-------|-----|
| `.btn` | Base. Rarely used alone — always add a size + variant. |
| `.btn-sm` | **The standard size for every modal footer / toolbar button.** |
| `.btn-primary` | Green affirmative action. Exactly **one per footer**, rightmost. |
| `.btn-ghost` | Secondary / Cancel / utility. Transparent. |
| `.btn-primary.btn-danger` | Destructive **primary** action (filled red). Use via `confirmDialog({danger:true})` or `class="btn btn-sm btn-primary btn-danger"`. |
| `.nb-clear` / `.rb-clear` | Inline chip clear (the small **×** on the Sitemap and Redirect badges): transparent, `color: inherit`, `opacity: 0.65` → `1` and `var(--kke-kill)` on hover. The pattern for an icon-only clear inside a badge. |

### 2.2 Rules

- **Footer buttons are `btn btn-sm …`.** No full-size `btn` in footers.
- **Order:** utilities (ghost) on the left → spacer → `Cancel` (ghost) → **primary** (rightmost). The factory enforces this; hand-built footers must match.
- **One primary per dialog.** Everything else is `.btn-ghost`.
- **Destructive:** the *primary* destructive action uses `.btn-danger` (filled red). A *secondary* destructive action sitting next to a Save (e.g. "Delete Node" in an editor footer) uses ghost + red text: `class="btn btn-sm btn-ghost" style="color:var(--kke-kill);"`. Both conventions exist on purpose — pick by whether removal is the main action.
- **Labels:** use the specific verb for the primary action — `Save`, `Export`, `Import`, `Apply`, `Assign`, `Delete`. Use `Done` only for live-saved / acknowledge-and-close dialogs (e.g. Project Settings, which persists as you type). Use `Cancel` for dismiss-without-committing.

---

## 3. Close affordance

- Header close = **`<button class="modal-close" title="Close">×</button>`**, top-right, glyph `×` (U+00D7). The factory adds this automatically (`.modal-close-btn`, an alias of `.modal-close`).
- The ✕ means "dismiss without saving" — identical to Esc and backdrop click.
- Do **not** use a text "Close" button, an `icon-btn`, or `&times;`/`✕` (U+2715) in a centered-dialog header.

---

## 4. Footers

- Use **`class="modal-footer"`** — never a bespoke `<div id="…-footer">` with its own padding/border CSS. The global rule gives it `display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:12px 16px; border-top`, so a plain `Cancel`+`Save` footer right-aligns automatically.
- For left-aligned content (a count/status like "12 templates", or a left utility button such as "Recalculate All"/"Clear target"), put a **`<span style="flex:1">`** first — it absorbs the free space and the action buttons sit at the right edge. Use `justify-content:space-between` inline only when you have exactly one left item and one right item and don't want a spacer span.
- **Count nouns match the thing being counted and the dialog title:** "N components", "N templates", "N entries" — never a generic "N patterns" for everything. Keep the success/seed **toast** noun in sync with the footer.

---

## 5. Feedback — toasts

```js
showToast('Saved ✓', 'success');   // green accent border
showToast('Save failed: ' + err, 'error');   // red border
showToast('Nothing to apply to');  // neutral (omit type)
```

- Types: `'success'` (green), `'error'` (red), `'info'` (blue, via the `--info` token), or omit the type for a neutral message. All three are styled in `#toast.*`.
- Toasts auto-dismiss (~2.5s). Use them for outcomes, **never to ask a question** — anything the user must answer is a dialog.
- Every state-changing user action should give feedback — a toast, a badge update, or a visible result. Silent success erodes trust.

### 5a. Optional actions on a toast

A toast may carry **one optional follow-up** to the outcome it reports — the
Undo-toast pattern:

```js
showToast('Exported 409 pages to Miro', 'success',
  { label: 'Delete board', danger: true, onClick: () => {…} });
```

This is not a licence to put decisions in toasts. It qualifies only when **all**
of these hold:

- **Ignoring it is a valid answer.** Letting the toast lapse must leave the user
  in a sensible state. If they have to answer, it is a dialog.
- **It follows from the outcome just reported** — undoing it, or discarding what
  it just produced. Not an unrelated shortcut.
- **Anything destructive still confirms in a real dialog.** The toast button
  opens `confirmDialog`; it never destroys on a single click, because a toast
  can be clicked by someone who has not read it.
- **There is exactly one.** Two actions is a dialog wearing a toast's clothes.

`showToast()` handles the mechanics: an action switches pointer events back on
(the base toast is deliberately click-through), stretches the dismiss to ~20s,
holds it open while hovered, and re-arms when the window regains focus — an
action the user cannot physically reach is worse than no action at all.

---

## 6. Empty & first-run states

- **No file open:** the main panel `#no-selection` shows a welcome affordance (`updateNoSelectionState()` toggles it). Keep it meaningful — never leave a blank panel.
- **First launch:** `openWelcomeDialog()` runs once (gated by the `seenWelcome` pref) and is re-openable via Help → Getting Started.
- **Keyboard cheat-sheet:** `?` anywhere, or Help → Keyboard Shortcuts. If you add a shortcut, add it to `SHORTCUT_GROUPS` in `renderer.js`.
- When a list/library is empty, show a one-line hint pointing at the action that fills it ("No entries yet — click **+ Add row** or **Seed with defaults**.").

---

## 7. Colors, tokens, typography

- **All colors and key dimensions come from `:root` custom properties.** Edit tokens there; don't hardcode hex values in component rules or inline styles.
- Common tokens: `--accent` (primary green), `--danger`, `--kke-keep/kill/evolve/consolidate/exclude` (+ `*-bg`), `--text-primary/secondary/muted`, `--bg-surface/main/hover/field-bar`, `--border` / `--border-light`, `--radius`, `--sidebar-w`, `--font-sans` / `--font-mono`.
- Fonts: IBM Plex Sans (UI) / IBM Plex Mono (URLs, codes, keys). Base 14px; **never below 11px**.
- Dark mode is automatic (follows macOS). Because you use tokens, your UI adapts for free — verify contrast holds in both themes.

---

## 8. Naming & code conventions

- `$('element-id')` is the shorthand for `document.getElementById`. Frequently-used elements are cached in the `els` object at init.
- Dynamically-built modal element IDs use a short, hyphenated, function-scoped prefix: `_dpl-…` (Component Library), `_pl-…` (Page Template), `_ctr-…`, `_skp-…`, `_nne-…`, `_mte-…`, etc. Keep the convention so handlers and tests can find them.
- Text input that needs the user to type a value → `showPrompt`, never `window.prompt`.
- Sanitize pasted user text in name/slug/notes fields with `sanitizeText` / `attachSanitizer`.
- Escape any user-derived string going into `innerHTML` with `escapeHtml`.

---

## 9. Keyboard

- The modal factory owns **Esc** (closes top modal) and **Enter** (triggers the primary button, except inside `<textarea>`). Don't add competing global handlers inside a dialog.
- App-level shortcuts live in the `window`/`document` keydown handlers in `renderer.js` and are documented in `SHORTCUT_GROUPS`. The canonical KKE keys are `1` Keep · `2` Kill · `3` Evolve · `4` Consolidate · `5` Exclude · `0` Clear. Keep the cheat-sheet, the code, and `USER_GUIDE.md` in agreement.

---

## 10. Main ↔ renderer (brief — full detail in CLAUDE.md)

- Renderer has **no Node APIs**. Everything crosses via `window.electronAPI.*`.
- A new channel requires edits in **all three**: `main.js` (`ipcMain.handle` / menu `send`), `preload.js` (`contextBridge` exposure), `renderer.js` (call / listener).
- Menu items send via the `send(channel)` factory in `main.js`; the renderer wires them in `bindIPCListeners`.

---

## 11. Data & state safety (brief — full detail in CLAUDE.md)

- `state.rows` is the **read-only** original. All edits go to `state.editedRows[origIndex]`.
- Mutating data → call `setDirty(true)` (triggers the autosave timer + dirty indicator).
- KKE / SME / Final-KKE changes → call `logChange(origIndex, field, oldVal, newVal)` for the audit trail.
- Per-project data travels in xlsx structural sheets via `state.projectSettings`; per-user prefs go through `get-prefs` / `save-prefs` (remember to whitelist new keys in `main.js`'s `get-prefs`).

---

## 12. Pre-merge checklist for any new UI

- [ ] No `window.confirm/alert/prompt`; used `confirmDialog`/`alertDialog`/`showPrompt`.
- [ ] Any new modal uses `openModal` (or `registerModalDismiss` for a legacy one). No bespoke overlay/z-index/Esc code.
- [ ] A hand-built dialog is appended **into** its overlay (or sets its own `position: fixed`) — a static-position sibling paints under the dim mask no matter its z-index.
- [ ] Header has a `.modal-close ×`; Esc and backdrop close it.
- [ ] Footer: `btn btn-sm`; one green primary, rightmost; Cancel ghost to its left; utilities/count on the left via a `flex:1` span.
- [ ] Destructive primary uses `.btn-danger` (or `danger:true`).
- [ ] Any new toolbar / control strip has `flex-wrap: wrap` (§1.7) — verified controls wrap, not clip, at a narrow window.
- [ ] No hardcoded colors/fonts/sizes — tokens only.
- [ ] State-changing actions give feedback via `showToast`.
- [ ] Any toast action is optional, singular, follows from the outcome, and confirms in a dialog if destructive (§5a).
- [ ] New IPC channel touches all three files; new pref key whitelisted in `get-prefs`.
- [ ] New shortcut added to `SHORTCUT_GROUPS`; KKE/shortcut docs updated.
- [ ] User-facing changes reflected in `README.md`, `USER_GUIDE.md`, and `src/help.html`.
- [ ] `node --check src/renderer.js main.js preload.js` passes; app boots clean (no console errors).

---

*Related: `CLAUDE.md` (architecture & IPC reference) · `REVIEW_FINDINGS.md` (audit backlog & what's been standardized) · `USER_GUIDE.md` (end-user manual).*
