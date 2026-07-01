# Transmission — Quick Start

**Your first content audit in about 10 minutes.** This is the short version; the full manual is `USER_GUIDE.md`.

> KKE = **Keep · Kill · Evolve** (+ **Consolidate** and **Exclude**). For every page on a site, you make one call.

---

## 1. Open your crawl  ·  1 min

- **Cmd+O** (or the **Open a file** button on the welcome screen) and pick a Screaming Frog `.xlsx` export — or any spreadsheet with a URL column.
- The app auto-detects the URL column and adds its own audit columns (KKE, Tags, Notes, etc.). Your original columns are untouched.
- First launch shows a **Welcome** dialog. Take the **Product Tour** (5 steps) if you want the guided version, or press **?** anytime for the keyboard cheat-sheet.

## 2. Make the call, fast  ·  the core loop

1. Click a row → the page loads in the built-in browser, with its metadata above it.
2. Press a number to decide:

   | Key | Decision |
   |-----|----------|
   | **1** | Keep |
   | **2** | Kill |
   | **3** | Evolve |
   | **4** | Consolidate (pick a target page to merge into) |
   | **5** | Exclude (out of scope) |
   | **0** | Clear |

3. With **auto-advance** on (default), you jump to the next page automatically.
4. Press **]** anytime to skip to the next page that still needs a decision.
5. Add a **Note** (the Snippets menu has reusable rationales), **Tags**, or a **Group** as needed.

Everything **auto-saves** 2 seconds after you stop — watch the title bar: *● Unsaved → ⟳ Saving… → ✓ All changes saved.* Or **Cmd+S** to save now.

## 3. Filter & batch  ·  don't decide one-by-one when you don't have to

- **Search** + **scope** (All / URL / Title) at the top of the sidebar.
- **KKE filter** (multi-check), **Group filter**, and **+ Field filter** (any column: contains / equals / is-blank…).
- Select rows (Cmd+click / Shift+click) **or** just narrow with filters, then use the **action bar at the bottom of the sidebar** to set KKE / Published / Page Type / Theme / Group / tags on *all* of them at once.
- Example: filter Status Code = 404 → action bar → Set KKE → Kill → Apply.

> Starting from a CMS export with thousands of pages? **Project → Triage Non-200 Pages** batch-assigns by status code, and **Project → AI Suggest for Unreviewed** can pre-fill a `Suggested_KKE` for every undecided page (needs a Claude API key; never overwrites your call).

## 4. Plan the migration  ·  optional, when you're replatforming

- **Sitemap** (Cmd+Shift+T): drag-and-drop the future-state IA; assign Keep/Evolve pages to nodes. You can also seed the very first node straight from the audit bar's **Sitemap** button.
- **Menus** (Cmd+Shift+M): build independent navigation menus that reference your sitemap pages; the audit bar's **Menu** button drops the current page into a menu without leaving the audit.
- **Redirects** (Cmd+Shift+R): every Kill or URL-changed page, with an editable destination.
- **Consolidate**: point near-duplicate pages at the survivor; the redirect follows the target automatically.

## 5. Check & hand off  ·  before you ship

1. **Migration → Pre-Handoff Check** — one report flags everything that isn't ready: unreviewed pages, consolidate targets that don't exist (or point at a Kill page), redirect chains, duplicate nav IDs, empty nav nodes. Fix what it finds.
2. **Reports** menu — Executive Summary, Content Inventory, SME Review Status, Sitemap Coverage, Migration Checklist, and more (export each as PDF or Word-compatible HTML).
3. **File → Export… (Cmd+Shift+E)** — filtered rows, audit decisions (CSV/JSON), redirect map (CSV), or the multi-sheet Migration Tracker for engineering.

---

## The shortcuts worth memorizing

`1`–`5` set KKE · `0` clears · `]` next unreviewed · `F` flag · `j`/`k` or arrows move · `Cmd+F` global search · `Cmd+S` save · `?` all shortcuts.

## Bringing in a subject-matter expert?

`SME → Export for SME Review` → they fill in decisions in Excel → `SME → Import SME Decisions` → `SME → Compare KKE vs SME` (side-by-side) → `Resolve Conflicts` to finalize.

---

*Two settings homes:* **App Settings** (⚙, per-user, all files) vs **Project Settings** (Project menu, saved in this file). *Stuck?* Press **?** for shortcuts or **Help → Product Tour** for the walkthrough.
