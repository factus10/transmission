# Docs Re-Architecture — Process Walkthroughs as the User Guide Backbone

**This is a kickoff brief for a dedicated session.** It is not itself the work — it tells that session what to build and how. Run it as a **Code session** (it must read source to get UI details right, launch the app to verify flows, and write `.md` files into this repo).

---

## The goal

Today `USER_GUIDE.md` grew ad hoc — feature-by-feature, in roughly the order features were built. It's accurate but not *task-shaped*: a new auditor can't read it front-to-back and learn "how do I actually do an audit."

The fix: write a **process walkthrough for each major workflow** — task-oriented, numbered-steps, mental-model-first — using `NAV_BUILD_WALKTHROUGH.md` as the proven template. Then **re-spine the User Guide around those walkthroughs**: the guide becomes an ordered path through the real lifecycle of an audit, with reference material hanging off each step rather than floating on its own.

Outcome: a guide you can hand a brand-new strategist and say "start at the top."

---

## Why this is a Code session (read this first)

A walkthrough is worthless if a step says "click **Page Type**" when the button now reads **Content Type**. The single biggest failure mode here is documenting the app *as remembered* instead of *as it is*. So the working method is **verify-then-write**, every time:

1. **Read the source** for the feature before documenting it — `src/renderer.js` (UI logic + exact element IDs/labels), `src/index.html` (DOM + labels), `main.js` (menus, IPC, file behavior).
2. **Cross-check menu paths** against `buildMenu()` in `main.js` (the `send('menu-…')` factory) — don't trust memory for where a command lives.
3. **When unsure, launch the app and look.** Boot pattern (macOS has no `timeout`):
   ```
   (npx electron . --enable-logging > /tmp/kke.log 2>&1 &) ; sleep 8
   # …inspect…
   pkill -f "electron \."
   ```
4. Treat `CLAUDE.md` as the architectural source of truth for *what exists and what it's called* — it was just brought current for 2.2.0.

---

## The walkthrough template (extracted from NAV_BUILD_WALKTHROUGH.md)

Every walkthrough follows this anatomy. Keep them **tight** (~80–160 lines). They teach a path, not every option — options live in reference sections.

```
# <Process name> Walkthrough

<1–2 sentence framing: what this gets you and when you'd do it.>

> Prerequisite: <what must be true / done first>.

## 0. The mental model
<3–6 lines. The one idea that makes the rest obvious. This is the most
 important section — if the reader gets the model, the steps are self-evident.>

## 1. <First concrete step>
1. Exact path: View/menu → control → action. Use real labels and shortcuts.
2. …
> Tip / gotcha callout where a step has a non-obvious consequence.

## 2. <Next step>
…

## N. <Final step / produce the output>
…

## Quick checklist for "good <output>"
- [ ] terse, verifiable end-state bullets the reader can self-check against
```

**Style rules** (match the existing walkthrough's voice):
- Second person, imperative. "Filter to Keep + Evolve," not "the user can filter."
- **Bold** every real UI label, menu item, button, cluster name, and shortcut. Exact strings.
- `> blockquote` callouts for prerequisites, gotchas, and the "efficient pattern" power-tips.
- Lead with the **mental model**; never open with a feature tour.
- Show the *fast path* a pro would take (e.g. multi-select + drag), not just the click-by-click.
- End with a **self-check checklist**.

---

## Terminology contract (2.2.0 — do not get these wrong)

The session must use current names everywhere. Common traps:

| Say this | NOT this | Note |
|---|---|---|
| **Content Type** | Page Type | UI label; column is still `Page_Type` under the hood |
| **Renders as** (Page / Record / Fragment / Generated) | Nature / Content Object | Record is stored as `Content Object`; Fragment as `Fragment` |
| **Target Spec Library** | Page Template Library / Pattern Library | sheet is still `PatternLibrary` |
| **Migration Direction Brief** | Writer / Builder Brief | now covers 3 roles |
| **Migrator** (3rd role) | — | alongside Builder / Writer |
| **Component Library** / **Components** | Design Pattern Library | |
| View switcher tabs: **Audit · Table · Nav Tree · Redirects** | the old in-bar Tree/Redirects buttons | removed |
| Audit-bar clusters: **DECIDE · CLASSIFY · MIGRATE · CMS** (+ patterns) | — | |

**First task of the session:** refresh `NAV_BUILD_WALKTHROUGH.md` itself — it predates 2.2.0 and still says "Page Template Library" and "Writer / Builder Brief." It's the template *and* one of the deliverables, so fixing it first both corrects it and re-confirms the format.

---

## The walkthrough inventory

Write one walkthrough per process below, grouped into the **lifecycle order** that will also become the User Guide spine. `(exists)` = already drafted, needs refresh; `(new)` = write from scratch. Suggested file convention: `walkthroughs/NN-slug.md`.

### A. Set up & orient
1. **Getting started** — install/first-run, open a file, URL-column detection, multi-sheet picker, what the structural sheets are, the seed banners (registry / specs / components), saving & round-trip, data ownership. `(new)`
2. **Project setup** — Project Settings tabs (Identity, KKE States, Suggestions, Migration, Saved Filters) + App Settings/prefs; what travels with the file vs. what's per-user. `(new)`

### B. The core audit
3. **Running the audit pass** — the field bar clusters, KKE buttons + keyboard (1/2/3/4/0), auto-advance, Notes, flagging, the embedded browser + viewport sim + thumbnails. `(new)`
4. **Finding the work** — search scopes, the KKE checkbox filter (incl. special filters), field filters, saved filters, Global Search (Cmd+F). `(new)`
5. **Bulk operations** — multi-select + the unified Multi-bar; batch assess. `(new)`
6. **Tagging, grouping & the glossary** — Tags vs Primary Tag vs Group; the glossary editor + Word export. `(new)`

### C. Classify for migration
7. **Content types & the crosswalk** — Content Type → Renders as → Target Content Type; the Content Type Registry crosswalk; → Target Spec; non-destructive auto-fill. `(new)` *(source: the new sections already in USER_GUIDE/help can be mined, but verify against `openContentTypeRegistryEditor` + `applyContentTypeRegistryDefaults`)*
8. **Suggested_KKE** — rubrics (DSL), AI assessment, GA analytics; how the three sources combine, weights, disagreement, recompute. `(new)`
9. **Consolidate** — the picker, Consolidation Candidates, redirect chasing, dead-target warning. `(new)`
10. **Non-200 triage** — the dialog, auto-offer, batch actions, sidebar badges. `(new)`

### D. Collaborate & review
11. **SME review** — export → reviewer fills dropdowns → import → resolve conflicts; split-by-owner. `(new)`
12. **Multi-auditor merge** — merging another auditor's file, conflict resolution. `(new)`

### E. Architect the future site
13. **Navigation & IA** — building the future-state tree, placing Keep/Evolve pages, references/aliases, phases, duplicate detection, the Visual Sitemap. *(split from the existing walkthrough — the IA half)* `(exists → refresh + split)`
14. **Build & direction** — Target Spec Library (Page Template vs Content Model, the 3 direction kinds + field schema), node build metadata, Builder/Writer/**Migrator** roles, statuses, Fragment nodes. *(the build half)* `(exists → refresh + split)`

### F. Ship it
15. **Redirects** — the Redirect Editor, destination resolution priority, the `404` sentinel, find/replace, re-derive-from-nav, chain check, CSV export. `(new)`
16. **Producing the outputs** — the report catalog (what each report is *for* + when to run it), incl. the new **Content Type Crosswalk** and **Migration Direction Brief**; PDF/HTML export. `(new)`
17. **Migration Tracker hand-off** — the multi-sheet xlsx, what each sheet carries, the export options. `(new)`
18. **Pre-flight & hand-off** — Pre-Handoff Check, the "good outputs" checklist, the change log. `(new)`

### G. Power features (shorter walkthroughs / reference)
19. **Templates** — audit templates (save/load) + report templates (Markdown/Mustache, placeholders, where files live). `(new)`
20. **Component inventory** — tagging components, the library editor, the Component Inventory report. `(new)`

> Scope check before writing all 20: the session should confirm this inventory against the live menus first and flag anything missing or merge-worthy. Don't pad — if two items collapse into one natural walkthrough, do it.

---

## Re-spining the User Guide

Once the walkthroughs exist:

1. **Restructure `USER_GUIDE.md` to follow the A–G lifecycle above.** Each top-level section opens with its walkthrough (inlined or linked — recommend **inlined**, so the guide reads as one continuous path), then a **Reference** subsection with the exhaustive option-level detail that currently floats around the guide.
2. **Migrate, don't duplicate.** Move existing accurate prose from today's guide into the new structure's reference subsections; delete what the walkthrough now covers. Net result should be *shorter and clearer*, not additive.
3. **Keep a "Reference" appendix** for things that aren't a process: Audit Columns table, Keyboard Shortcuts, Rubric DSL operators, Structural Sheets, Common Screaming Frog columns.
4. **Decide the file story** (ask the user once, in that session): keep `walkthroughs/*.md` as standalone shippable docs *and* inline them into the guide, or make the guide the only home and drop the standalone files. Recommend keeping standalones — they're useful as individual hand-outs and as the `help.html` source.
5. **Keep `src/help.html` in sync** — it can summarize each walkthrough's mental-model + checklist.

---

## Acceptance checklist (definition of done)

- [ ] `NAV_BUILD_WALKTHROUGH.md` refreshed to 2.2.0 terminology and split into IA + Build halves.
- [ ] A walkthrough exists for every confirmed process in the inventory, each following the template + style rules.
- [ ] **Every UI label, menu path, and shortcut in every walkthrough was verified against source or the running app** — not memory.
- [ ] Terminology contract honored throughout (no "Page Type" / "Page Template Library" / "Writer/Builder Brief").
- [ ] `USER_GUIDE.md` restructured to the A–G spine; reference detail preserved, duplication removed; net length flat or down.
- [ ] `README.md` feature list and `src/help.html` reconciled with the new structure.
- [ ] A short top-of-guide "Reading path" that names the lifecycle so a newcomer knows the order.

---

## Suggested first message for the new session

> Read `DOCS_WALKTHROUGH_PLAN.md` — it's the brief for this session. Start by (1) confirming the walkthrough inventory against the live menus in `main.js`, then (2) refreshing `NAV_BUILD_WALKTHROUGH.md` to 2.2.0 terminology and splitting it into an IA walkthrough and a Build & Direction walkthrough. Verify every UI label against `src/renderer.js` / `src/index.html` / the running app as you go — do not document from memory. Check in with me after the inventory + the first refreshed walkthrough so we can lock the format before you write the rest.

---

## Pointers (current source of truth)

- `CLAUDE.md` — architecture, exact column/sheet/function names, IPC channels (current as of 2.2.0).
- `NAV_BUILD_WALKTHROUGH.md` — the format exemplar (and a deliverable to refresh).
- `CONTENT_TYPE_MODEL.md` — the design rationale behind content types / crosswalk / roles (good for the mental-model sections of walkthroughs 7, 13, 14).
- `UI_STANDARDS.md` — interaction conventions (useful if any walkthrough describes dialogs).
- `src/renderer.js`, `src/index.html`, `main.js` — the ground truth for labels, flows, menus.
