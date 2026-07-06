# Screencast Scripts

Five short screencasts (60–120s each) that cover the tool end to end. Record straight from these — each beat is an on-screen action plus a suggested line of narration. Keep them tight; viewers bail after two minutes.

These pair with the in-app **Help → Product Tour** (the live 5-step walkthrough) — the videos are the narrated, watch-don't-click version of the same arc.

---

## Setup (do once before recording)

- **Demo file:** the Stanford OHS crawl (`stanford_ohs.xlsx`) or any realistic Screaming Frog export. Same file as the screenshot set, so visuals stay consistent.
- **Window size:** ~1440×900 (records cleanly, not cramped).
- **Pre-seed state:** before recording the loop video, assign a mix of Keep/Kill/Evolve/Consolidate to ~15–20 rows so badges, the progress bar, and reports have color. For the migration/reporting videos, also assign a handful of pages to sitemap nodes and set 2–3 SME decisions.
- **Set Client/Project** in Project Settings so report headers aren't blank.
- **Hide secrets:** if you'll show AI Suggest, confirm no real API key is visible on screen (App Settings).
- **Appearance:** record light mode; optionally re-shoot the hero shot in dark mode.
- **Cursor & keys:** turn on a keystroke visualizer (e.g. KeyCastr) — several beats are keyboard-driven (`1`–`5`, `]`, `?`).
- **Pacing:** ~1 action every 3–4 seconds; pause ~1s after each so cuts are clean.

---

## 1 · The Core Loop  (~90s)  — *the one video to make if you only make one*

**Goal:** show how fast a page-by-page audit goes.

| # | On screen | Narration |
|---|-----------|-----------|
| 1 | Launch to the welcome screen; click **Open a file**, pick the crawl. | "Open a Screaming Frog export — or any spreadsheet with URLs." |
| 2 | File loads; sidebar fills; click a row → page renders in the built-in browser. | "Every page loads right here, next to its metadata." |
| 3 | Press **1**, then ↓ to next row, **2**, **3**… let auto-advance carry you. | "Decide each page — 1 Keep, 2 Kill, 3 Evolve, 4 Consolidate, 5 Exclude. It advances automatically." |
| 4 | Press **]** to jump past several decided rows to the next blank one. | "Press the bracket key to skip straight to the next undecided page." |
| 5 | Open **Notes**, type a line, then the **Snippets** menu → insert a saved snippet. | "Add rationale as you go — and reuse standard notes from the snippets menu." |
| 6 | Glance at the title bar: ⟳ Saving… → ✓ All changes saved. | "It saves automatically, straight back to your file." |
| 7 | Point at the sidebar progress bar / press **?** to flash the shortcut sheet. | "Progress is always visible — and question-mark shows every shortcut." |

**End card:** "Keep · Kill · Evolve · Consolidate · Exclude — one call per page."

---

## 2 · Filter & Batch  (~75s)  — *don't decide one page at a time*

**Goal:** large-list triage.

| # | On screen | Narration |
|---|-----------|-----------|
| 1 | Type `/news/` in search; switch the scope dropdown to **URL**. | "Filter by text — and scope it to just URLs, or titles." |
| 2 | Open the **KKE filter**, check **Unreviewed**; show the row count drop. | "Stack filters: show only what's left to review." |
| 3 | Click **+ Field filter** → Status Code → equals → `404`. | "Or filter on any column — here, every 404." |
| 4 | With those filtered, use the bottom **action bar** → Set KKE → Kill → Apply. | "Then set them all at once from the action bar." |
| 5 | (Optional) **Project → Triage Non-200 Pages** → show the grouped table → Apply. | "For status-code cleanup, the triage tool does it by code in one pass." |

**End card:** "Filter, then batch — minutes instead of hours."

---

## 3 · Consolidation  (~75s)  — *the merge decision most audits miss*

**Goal:** show Consolidate + finding candidates.

| # | On screen | Narration |
|---|-----------|-----------|
| 1 | On a near-duplicate page, press **4** (Consolidate); the target picker opens. | "Consolidate merges a page into another — pick the survivor." |
| 2 | Filter the picker, select the canonical page, **Set as target**. | "Search the full inventory and point it at the keeper." |
| 3 | Open the **Sitemap → Consolidation Candidates…**; show a node with 2+ pages. | "Or find candidates in bulk: every sitemap node with multiple pages." |
| 4 | Pick the target radio in a group → **Apply**; show the others flip to Consolidate. | "One click sets the target to Evolve and the rest to Consolidate — pointing at it." |
| 5 | Briefly show the sidebar **C** pill / indigo tint on consolidated rows. | "Consolidated pages are flagged, and their redirects follow the target automatically." |

**End card:** "Merge overlapping pages — don't just kill or keep them."

---

## 4 · Migration Planning & Export  (~110s)

**Goal:** sitemap → redirects → pre-flight → export.

| # | On screen | Narration |
|---|-----------|-----------|
| 1 | **Cmd+Shift+T** → Sitemap. Drag a node to reparent; edit a label inline. | "Lay out the future-state sitemap: drag to reorganize, edit labels inline." |
| 2 | From the audit bar, click **Sitemap** on a page and assign it to a node. | "Assign your Keep and Evolve pages to where they'll live — right from the audit." |
| 3 | **Cmd+Shift+R** → Redirect Editor; show Kill + URL-changed rows with destinations. | "Every removed or moved page gets a redirect — review them here." |
| 4 | **Migration → Pre-Handoff Check**; show the pass/issue report, point at a flagged check. | "Before handoff, one command checks everything: unreviewed pages, dead consolidate targets, redirect chains, empty sitemap nodes." |
| 5 | **File → Export… (Cmd+Shift+E)** → choose **Migration Tracker**; show the saved multi-sheet xlsx. | "Then export the migration tracker — a multi-sheet workbook engineering can build from." |

**End card:** "Audit → IA → redirects → a clean engineering handoff."

---

## 5 · Reports & SME Review  (~100s)

**Goal:** stakeholder outputs + the SME loop.

| # | On screen | Narration |
|---|-----------|-----------|
| 1 | **Reports → Executive Summary**; show the KKE bar + findings; click **PDF**. | "Stakeholder reports in one click — exec summary, content inventory, and more." |
| 2 | Briefly open **Reports → Sitemap Coverage** or **Component Inventory** to show range. | "Plus IA coverage and a component inventory for design-system scoping." |
| 3 | **SME → Export for SME Review**; note the dropdown-validated file. | "Send a subset to a subject-matter expert — they decide in Excel." |
| 4 | **SME → Import SME Decisions**, then **SME → Compare KKE vs SME**. | "Bring their calls back, and compare auditor vs SME side by side." |
| 5 | Click a row in the compare view → it jumps to that page; resolve via **Resolve Conflicts**. | "Click through any disagreement and finalize the call." |

**End card:** "From audit to client-ready reports and expert sign-off."

---

## Optional shorts (15–30s each)

- **AI Suggest:** *Project → AI Suggest for Unreviewed* → watch Suggested_KKE fill in → "AI proposes; you confirm. It never overwrites your call."
- **Product Tour:** *Help → Product Tour* → step through the spotlight → "New here? The built-in tour walks you through it."
- **Thumbnails:** hover a few visited sidebar rows → previews pop → "Hover to recognize a page without clicking back."

---

## Publishing

- Export at 1080p; trim dead air; add the end-card line as a title.
- Link them from the in-app **Welcome dialog** and **Help** menu (the welcome screen already references the tour — a "Watch the videos" link can point at wherever these land).
- Keep file names matching the section titles so they map back to this script.
