# Project Setup Walkthrough

How to configure a project so the rest of the audit runs smoothly — identity, the KKE vocabulary, where suggestions come from, and the migration vocabularies. Five minutes here saves friction everywhere downstream.

> Prerequisite: a file is open (see **Getting Started**).

---

## 0. The mental model

There are **two tiers of configuration**, and they behave differently:

- **Project Settings** — *"Saved with this file — travels with the spreadsheet."* Anything client-specific lives here: site domain, custom KKE states, suggestion weights, page statuses, assignees, saved filters. Hand off the file and these come with it.
- **App Settings** — *"Applies to you, across all files."* Per-user UI preferences: auto-advance, which clusters are visible, your API key, sidebar columns, column mapping. These stay on your machine.

If a setting should be the same for every auditor on this client, it belongs in **Project Settings**. If it's how *you* like to work, it's **App Settings**.

---

## 1. Project Settings — the five tabs

Open with **File → Project Settings…** (or **Project → Project Settings…**). It's a tabbed modal:

**Identity** — **Client name**, **Project name**, **Site domain**, **Default redirect destination**. The site domain drives redirect URLs and sitemap paths; changing it offers to rewrite existing redirect destinations to the new domain.

**KKE States** — add **custom KKE states** (with a color), beyond the five built-ins (Keep / Kill / Evolve / Consolidate / Exclude), and clean up rogue values. Custom states are stored both with the file *and* in your app prefs, so new files inherit them.

**Suggestions** — configure the **Suggested_KKE** sources:
- **GA Analytics** source — opens the GA column mapping + metric weights dialog.
- **Rubric** source — runs the rubric batch.
- **Source weights** (GA / Rubric, 0–5) with **Save weights & recompute**.

**Migration** — the two controlled vocabularies used by the build phase:
- **Page Statuses** — color, rename (cascades), reorder, delete (cascade-clears). Seeded with 6 defaults.
- **Assignees** — one shared pool for Builder / Writer / Migrator, with per-name usage counts; rename/delete cascade across nodes.

**Saved Filters** — list of named filter bundles with **Apply** / **Delete** per row (created from the sidebar — see **Finding the Work**).

> All of these save into the file's **KKE_Settings** sheet on **Cmd+S**.

---

## 2. App Settings — per-user preferences

Open with the **⚙** button (or **Transmission → Preferences…**, **Cmd+,** — on Windows and Linux it sits under **File**). The subtitle confirms it: *Applies to you, across all files.*

- **Auto-advance** — jump to the next row after you assign a KKE status.
- **Show SME fields** — reveal SME Decision / Final KKE / Content Owner in the audit bar.
- **Show Migration fields** — reveal Content Nature / Migration Track.
- **Show Components cluster** — reveal the design-pattern (Components) cluster.
- **Rubrics folder** — point at your rubric markdown; **Browse…** / **Edit…**.
- **Claude API key** — optional, enables AI assessment.
- **Sidebar columns** — extra columns to show in the row list.
- **Column mapping** — tell the app which spreadsheet columns hold KKE / Tags / Notes / Group / Primary, then **Apply**. Use this when your file's columns are named differently from the defaults.

---

## 3. Decide what's on screen

The three **Show …** toggles (and the **Components** quick-chip above the audit bar) control how much of the audit bar you see. Turn on only what this engagement needs:

- Doing migration classification? Turn on **Show Migration fields**.
- Running an SME loop? Turn on **Show SME fields**.
- Inventorying UI components? Turn on **Show Components cluster**.

Blank read-only metadata fields are hidden by default, and each audit-bar **cluster collapses** with a click — so the bar stays compact regardless.

---

## Quick checklist for "project configured"

- [ ] **Identity** filled — at least **Site domain** (redirects/paths depend on it)
- [ ] Any **custom KKE states** the engagement needs are defined
- [ ] **Suggestion sources** set up if you'll use Suggested_KKE (GA mapping and/or rubrics, weights)
- [ ] **Migration** vocab seeded if you'll do the build phase (statuses + assignees)
- [ ] App Settings reflect how you want to work (auto-advance, visible clusters, API key)
- [ ] **Saved** — Project Settings persist to the file

---

*Next: **Running the Audit Pass** — the field bar, KKE keys, and the embedded browser. See also [the User Guide](../USER_GUIDE.md).*
