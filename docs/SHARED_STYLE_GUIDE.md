# Shared Style Guide — Transmission Design Language

**Purpose.** This document lets a second app — a **Tauri** desktop app — share a consistent visual and interaction style with **Transmission** (an Electron desktop app). Hand this file to the Claude Code session working on the Tauri app. It is self-contained — you do **not** need access to the Transmission codebase to apply it.

**Good news for the Tauri app:** Tauri's frontend is a system webview rendering plain HTML/CSS/JS, exactly like Electron's renderer. So **all the CSS tokens (§1) and button specs (§2) drop in verbatim** — same stylesheet, same `var(--…)` model, same dark-mode-for-free behavior. Only the platform plumbing differs (Rust commands via `invoke` instead of Electron IPC), and that doesn't affect style. Where a rule depends on the platform, it's marked **[Platform note]** with the Tauri equivalent.

Transmission's full internal contract lives in its `docs/UI_STANDARDS.md`; this is the portable subset plus the exact design tokens.

---

## 1. Design tokens (copy these verbatim)

Everything visual is driven by CSS custom properties. **Never hardcode a hex color, font, or key dimension** — always `var(--…)`. Copy this `:root` block into the other app's stylesheet and theme from it.

```css
:root {
  /* Surfaces */
  --bg-base:       #f5f5f5;   /* app background */
  --bg-sidebar:    #ffffff;
  --bg-panel:      #fafafa;
  --bg-surface:    #ffffff;   /* cards, modals, inputs */
  --bg-hover:      #f0f0f0;
  --bg-selected:   #e0f2e8;   /* selected row (accent-tinted) */
  --bg-field-bar:  #fafafa;
  --bg-audit-bar:  #f5f5f5;

  /* Borders */
  --border:        #e0e0e0;
  --border-light:  #d0d0d0;

  /* Accent (primary green) + info */
  --accent:        #16a34a;   /* primary action / active state */
  --accent-dim:    #dcfce7;
  --accent-text:   #166534;
  --info:          #2563eb;

  /* Semantic status palette (Keep/Kill/Evolve/Consolidate/Exclude).
     Reuse the *hues* even if your app has no KKE concept:
     green=positive, red=destructive, amber=caution,
     indigo=merge/secondary, gray=neutral/inactive. */
  --kke-migrate:           #15703a;  --kke-migrate-bg:        #dcfce7;
  --kke-archive:           #b91c1c;  --kke-archive-bg:        #fee2e2;
  --kke-revise:         #854d0e;  --kke-revise-bg:      #fef9c3;
  --kke-consolidate:    #4338ca;  --kke-consolidate-bg: #e0e7ff;
  --kke-exclude:        #636363;  --kke-exclude-bg:     #f0f0f0;

  /* Text */
  --text-primary:   #1a1a1a;
  --text-secondary: #4b4b4b;
  --text-muted:     #636363;
  --text-accent:    #1a1a1a;

  /* Feedback */
  --danger:  #b91c1c;
  --warning: #854d0e;

  /* Typography */
  --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', 'Menlo', monospace;

  /* Dimensions */
  --radius:       4px;
  --sidebar-w:    480px;   /* adapt to your layout */
}
```

### Dark mode (automatic, follows OS)

Because everything uses tokens, dark mode is just a token override. Wrap this in `@media (prefers-color-scheme: dark) { :root { … } }`:

```css
--bg-base:#1a1a1a; --bg-sidebar:#222222; --bg-panel:#1e1e1e;
--bg-surface:#2a2a2a; --bg-hover:#333333; --bg-selected:#1a3d2a;
--bg-field-bar:#242424; --bg-audit-bar:#1e1e1e;
--border:#3a3a3a; --border-light:#444444;
--accent:#22c55e; --accent-dim:#1a3d2a; --accent-text:#86efac; --info:#60a5fa;
--kke-migrate:#4ade80; --kke-migrate-bg:#14532d;
--kke-archive:#f87171; --kke-archive-bg:#450a0a;
--kke-revise:#fbbf24; --kke-revise-bg:#422006;
--kke-exclude:#9ca3af; --kke-exclude-bg:#374151;
--text-primary:#e5e5e5; --text-secondary:#a3a3a3;
--text-muted:#737373; --text-accent:#e5e5e5;
--danger:#f87171; --warning:#fbbf24;
```

**Rule:** if you add UI and it doesn't adapt to dark mode for free, you hardcoded a color. Fix it by using a token.

### Typography rules
- **IBM Plex Sans** for all UI; **IBM Plex Mono** for URLs, codes, IDs, keys, file paths.
- Base font size **14px**, line-height **1.5**. **Never go below 11px.**
- `-webkit-font-smoothing: antialiased`.

---

## 2. Buttons (exact specs)

```css
.btn {
  font-family: var(--font-sans);
  font-size: 13px; font-weight: 500;
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 150ms, border-color 150ms;
  white-space: nowrap;
}
.btn-primary { background: var(--accent); color:#fff; border-color: var(--accent); }
.btn-primary:hover { background:#15803d; }
.btn-primary.btn-danger { background: var(--kke-archive); border-color: var(--kke-archive); color:#fff; }
.btn-primary.btn-danger:hover { background:#991b1b; }
.btn-ghost { background: transparent; color: var(--text-secondary); border-color: var(--border-light); }
.btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-sm { font-size: 12px; padding: 4px 10px; }   /* the standard size in footers/toolbars */
```

**Class system:** `.btn` is the base (rarely alone). Always add a size (`.btn-sm`) + a variant (`.btn-primary` / `.btn-ghost`).

**Rules:**
- Exactly **one** `.btn-primary` (green) per dialog/footer — it is the affirmative action and sits **rightmost**.
- Everything else is `.btn-ghost` (transparent, secondary).
- Destructive **primary** action = `.btn-primary.btn-danger` (filled red). A destructive **secondary** action next to a Save uses a ghost button with red text: `style="color:var(--kke-archive)"`.
- Footer/toolbar buttons are `btn btn-sm …` — no full-size buttons in footers.
- **Labels = the specific verb:** `Save`, `Export`, `Import`, `Apply`, `Assign`, `Delete`. Use `Done` only for live-saved dialogs. Use `Cancel` to dismiss without committing.

---

## 3. Dialogs & modals

The single most important consistency rule: **all dialogs share one anatomy and one button order.**

### Anatomy & order
```
┌ header ───────────────────────────────────────────────┐
│ title (left)                              close × (right) │
├ body (scrolls) ───────────────────────────────────────┤
│ …content…                                              │
├ footer ───────────────────────────────────────────────┤
│ [utility ghost]   …spacer…   [Cancel ghost] [Primary] │  ← primary rightmost
└────────────────────────────────────────────────────────┘
```

- **Header** has a close affordance: a `×` (U+00D7) button, top-right. It means "dismiss without saving" — identical to Esc and backdrop click. Do **not** use a text "Close" button or a different glyph (no `✕` U+2715, no `&times;`).
- **Footer** is flex, right-aligned: `display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:12px 16px; border-top`. For a left-aligned count/utility, put a `<span style="flex:1">` first to absorb the space.
- Every centered dialog closes on **Esc** and **backdrop click**, and focuses the first field or primary button on open.
- **Count nouns match the thing counted and the dialog title** ("3 templates", not a generic "3 items"), and the success toast uses the same noun.

### One factory, never hand-rolled
In Transmission a single `openModal()` factory owns Esc, backdrop-close, z-index stacking (nested dialogs layer correctly), focus, and the header `×`. **The other app should have one equivalent helper and route every dialog through it** — don't sprinkle bespoke overlay/z-index/Esc code per dialog. Consistency comes from the factory.

Transmission's specialized wrappers (replicate the equivalents in the other app rather than using native browser dialogs):
| Need | Helper | Returns |
|------|--------|---------|
| Yes/no | `confirmDialog({title, message, confirmLabel, danger})` | `Promise<boolean>` |
| Acknowledge | `alertDialog({title, message, okLabel})` | `Promise<void>` |
| One text input | `showPrompt(title, placeholder, defaultValue)` | `Promise<string\|null>` |
| Custom (forms/lists/editors) | `openModal({title, body, width, buttons, onClose})` | modal API |

**[Platform note — Tauri]** Native `window.confirm/alert/prompt` *do* function in a Tauri webview, but they look like raw OS dialogs and break visual consistency — **don't use them for in-app decisions.** Build the same custom dialog helpers (`confirmDialog` / `alertDialog` / `showPrompt` / `openModal`) in JS so dialogs match Transmission. Reserve Tauri's `@tauri-apps/plugin-dialog` (the Rust-backed native dialog API) for genuinely OS-level interactions — file open/save pickers, "quit without saving?" at the window level — where a native dialog is actually expected.

---

## 4. Feedback — toasts, not blocking dialogs

- Outcomes of state-changing actions get a **toast** (auto-dismiss ~2.5s), never a blocking dialog.
- Types: `success` (green border), `error` (red border), `info` (blue, `--info`), or neutral (no type).
- **Every state-changing action gives feedback** — a toast, a badge update, or a visible result. Silent success erodes trust.
- Blocking dialogs are for **decisions only** (confirm/choose), never for "it worked."

```js
showToast('Saved ✓', 'success');
showToast('Save failed: ' + err, 'error');
showToast('Nothing to apply to');  // neutral
```

---

## 5. Status pills & badges

Transmission renders state as colored pills using the semantic palette: a colored text on a tinted background, e.g. Migrate = `color:var(--kke-migrate); background:var(--kke-migrate-bg)`. Reuse this convention for any status in the other app:
- green = positive/done, red = destructive/blocked, amber = caution/in-progress, indigo = secondary/merge, gray = neutral/inactive.
- Pills are small (≈11–12px), rounded (`var(--radius)`), padded `2px 6px`.

---

## 6. Empty & first-run states
- Never leave a blank panel. Show a welcome affordance or a one-line hint pointing at the action that fills the view ("No entries yet — click **+ Add** or **Seed defaults**.").
- First launch: a one-time getting-started dialog, re-openable from Help.
- Provide a keyboard cheat-sheet (`?`), and keep it in sync with the actual shortcuts.

---

## 7. Code & naming conventions (portable)
- Escape any user-derived string before putting it in `innerHTML`.
- Sanitize pasted text in name/slug/notes fields.
- Dynamically-built modal element IDs use a short, hyphenated, function-scoped prefix so handlers/tests can find them (e.g. `_settings-…`, `_export-…`).
- Cache frequently-used elements once at init rather than re-querying.

---

## 8. Quick checklist for any new UI (shared)
- [ ] No native `confirm/alert/prompt` — used the custom dialog helpers.
- [ ] Dialog routed through the one modal factory; no bespoke overlay/z-index/Esc.
- [ ] Header has a `×`; Esc + backdrop close it.
- [ ] Footer: `btn btn-sm`; one green primary, rightmost; Cancel ghost to its left; count/utility on the left via a `flex:1` span.
- [ ] Destructive primary uses the red/`btn-danger` treatment.
- [ ] No hardcoded colors/fonts/sizes — tokens only; verified in light **and** dark mode.
- [ ] State-changing actions emit a toast (or visible result).
- [ ] Fonts: IBM Plex Sans (UI) / Mono (codes); nothing below 11px.

---

## 9. What is intentionally NOT shared
These are Transmission specifics the Tauri app should **not** copy unless relevant:
- The KKE methodology (Keep/Kill/Evolve/Consolidate/Exclude) and all `KKE_*` column/sheet names — that's a domain schema, not a style rule. Borrow the *color semantics*, not the vocabulary.
- Electron's IPC architecture (main/preload/renderer split). The Tauri app uses Rust `#[tauri::command]` functions called from JS via `invoke()` — a different plumbing model. Keep the same *principle* though: the webview holds no privileged access; all file/OS work crosses a single typed boundary into Rust.
- Full-panel view-switcher layout, sidebar dimensions — adapt to the Tauri app's own information architecture.

---

*This guide mirrors Transmission's `docs/UI_STANDARDS.md` and `src/styles.css` `:root` tokens as of v2.4.1. If the two apps drift, the tokens in §1 and the button specs in §2 are the source of truth to re-sync against.*
