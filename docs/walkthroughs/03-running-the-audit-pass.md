# Running the Audit Pass Walkthrough

The core loop: look at a page, make the call, move on. This is where you'll spend most of your time, so the goal is to make each decision in seconds without touching the mouse.

> Prerequisite: a file is open with rows loading in the browser (see **Getting Started**).

---

## 0. The mental model

- One row = one existing page. Selecting it loads the page in the **embedded browser** and fills the **field bar** above it.
- The field bar is organized into **clusters** — **Decide**, **Classify**, and (when enabled) **Migrate**, **Components**, **CMS**. You'll live in **Decide**.
- The whole loop is keyboard-driven: **arrow keys** to move between rows, **1–5** to set the KKE call, and with **auto-advance** on you're carried to the next page automatically. You rarely click.

---

## 1. Make the call

With a row selected, the **Decide** cluster shows the **KKE** buttons. Set the recommendation by keyboard:

| Key | Call |
|---|---|
| **1** | Keep |
| **2** | Kill |
| **3** | Evolve |
| **4** | Consolidate |
| **5** | Exclude |

- **Auto-advance** (App Settings): after you set a call, focus jumps to the next row. Just keep pressing 1–5 as you read down the list.
- **`]`** jumps to the **next unreviewed** row — the fastest way to chew through a backlog.
- **Consolidate** (4) opens the consolidate picker — see the **Consolidate** walkthrough.

> Keep your eyes on the browser, your hand on 1–5. A clean pass is: read → press → read → press.

---

## 2. Record rationale and flag follow-ups

- **Notes** (Decide cluster) opens a popover for rationale; a dot indicator shows when a row has notes.
- **F** flags / unflags the current row (★). Flagged rows are filterable later (the **Flagged** special filter) — use it to mark "come back to this."
- **Assess** runs the rubric against the current page (see **Suggested_KKE**).

---

## 3. Classify as you go (optional)

The **Classify** cluster carries descriptive metadata — fill what's useful while the page is in front of you:

- **Content Type** — the page's current-CMS type (the key into the migration crosswalk). A **→** hint shows the mapped target type.
- **Theme**, **Published** (Published / Unpublished / Draft / 404 / Missing), **Group**, **Primary** tag, and free **Tags**.

> Don't over-classify on the first pass. Set Content Type and KKE; leave the rest for batch operations or a second sweep.

---

## 4. Drive the embedded browser

The **webview toolbar** below the field bar gives you:

- **← → ↺** — back / forward / reload, and the live **URL**.
- **Viewport switcher** — **Auto** (fill space) · **SM** 390×844 · **MD** 768×1024 · **LG** 1280×800 · **XL** 1920×1080. No scaling — it sets a real viewport so you can judge responsive behavior.
- **◫** side-by-side compare · **📷** capture screenshot · **⇊** extract page content · **🔗** check page links · **↗** open in your system browser.

> Pages that won't render (auth walls, blocked embeds) are still auditable from the metadata in the field bar — you don't need the page to load to make a call.

---

## Quick checklist for "a clean pass"

- [ ] Every page you intend to review has a **KKE** call (no unreviewed rows left — check with `]`)
- [ ] Rationale captured in **Notes** where the call isn't obvious
- [ ] **Content Type** set where it'll drive migration classification
- [ ] Tricky pages **flagged (F)** for a second look
- [ ] Saved (**Cmd+S**) — calls and the change log persist to the file

---

*Next: **Finding the Work** — search, filters, and saved filters to slice the list. See also the *Keyboard Shortcuts* reference.*
