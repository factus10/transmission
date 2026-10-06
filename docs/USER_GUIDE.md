# Transmission — User Guide

**Version 2.16.1 "Please, Please, Please, Let Me Get What I Want"**
macOS (Apple Silicon + Intel)

---

## Welcome

Transmission is a desktop workspace for **content audits and site migrations**. You load a crawl of an existing site, decide what to do with every page, shape the structure of the new site, and hand your engineering team a clean plan to build from — all in one place, and all saved back into a single spreadsheet.

This guide takes you from *"I've never opened it"* to *"I could run an audit in my sleep,"* in the order you'll actually do the work.

### Start here if you're new to an engagement

This guide is organized **by feature** — it's the reference you come back to for
any one thing. If you've just been handed a crawl and a client and want to know
*what to do in what order*, read **[Running an Audit](./RUNNING_AN_AUDIT.md)**
first. It's short, it's opinionated, and it explains why the order matters.

### How to use this guide

- **New here? Read top to bottom.** The sections follow the real lifecycle of an audit, so each one builds on the one before it.
- **Each section stands on its own.** It opens with what you'll be able to do, walks you through the steps, and ends with a **Quick self-check** so you know you're on solid ground before you move on.
- **Already fluent and just want the steps?** Every section links to a matching one-page checklist in [`walkthroughs/`](walkthroughs/) — the terse field-guide version of the same material.
- **Hunting for one specific fact?** Jump to the [reference appendix](#reference-appendix): Audit Columns, Keyboard Shortcuts, the rubric language, Structural Sheets, and more.

> **A quick word on terminology.** Throughout this guide, **KKE** is the core call you make on every existing page — **Keep · Kill · Evolve · Consolidate · Exclude**. If you've run content audits before, you may know this as a *content inventory* or a *rationalization*; the idea is the same.

### The lifecycle at a glance

- **A. Set up & orient** — install, open a file, configure the project
- **B. The core audit** — make KKE calls, find the work, act in bulk, tag and group
- **C. Classify for migration** — content types, AI and analytics suggestions, consolidation, non-200 triage
- **D. Collaborate & review** — SME review, merging parallel auditors
- **E. Architect the future site** — navigation and information architecture, then build direction
- **F. Ship it** — redirects, reports, the migration tracker, the pre-flight check
- **G. Power features** — templates and the component inventory

---

# A. Set up & orient

## 1. Getting Started

*By the end of this section you'll have Transmission installed, your first crawl open in front of you, and a clear sense of what the app just did to your file — including why that makes the spreadsheet the only thing you'll ever need to back up or hand off.*

> **In a hurry?** The [Getting Started walkthrough](walkthroughs/01-getting-started.md) is these same steps as a one-page checklist. This section is the guided tour — read it once and the rest of the app will make sense.

### The big idea: your spreadsheet *is* the project

Transmission isn't a database that swallows your data and keeps it somewhere private. It's a workspace that reads and writes **your spreadsheet directly**. When you open a crawl export, the app adds the columns and helper sheets it needs, and from then on every decision you make is written straight back into that same `.xlsx`.

That has one wonderfully freeing consequence: **one file is the whole project.** Hand it to a colleague who also has Transmission and they see exactly what you see — your Keep/Kill/Evolve calls, the sitemap, project settings, even the full change history. There's nothing else to sync or export. Back up the file and you've backed up everything.

> If you've run content audits before, you may know this pattern as a *content inventory* or a *rationalization* spreadsheet. Transmission keeps that familiar single-file deliverable — it just gives you a far better cockpit for filling it in.

### Project files: the faster way to work

Working directly in the `.xlsx` is fine for small files, but every save rebuilds the whole workbook — and on a few thousand rows you'll feel that pause. The fix is one menu item: **File → Save As Project…** (**Cmd+Shift+S**). That converts your open spreadsheet — including everything you've done so far this session — into a **Transmission project file** (`.transmission`), and the app switches over to it on the spot.

A project file keeps the "one file is the whole project" promise — rows, decisions, sitemap, settings, glossary, libraries, and the full change history all live inside it — but saves become **instant**. Edits are committed within a couple of seconds of making them, with no workbook rebuild and no pause, no matter how big the crawl. Put the file wherever the project lives (`Documents/Client Audits/acme.transmission`, say); double-clicking it in Finder opens it in Transmission, and it shows up in **Open Recent** like any other file.

Excel doesn't disappear — it just becomes the *deliverable* format instead of the *working* format:

- **File → Export Full Workbook (.xlsx)…** writes a complete spreadsheet (all audit columns and structural sheets, plus the entire change history) whenever you need one — for a client, a colleague without Transmission, or your own archive. An exported workbook can be opened (or re-imported) by Transmission later, so nothing is one-way.
- All the other exports (filtered rows, audit decisions, redirect map, Migration Tracker, SME export) work exactly the same from a project as from a spreadsheet.

**Handing a project to another auditor** is one command: **File → Package for Handoff…** saves your latest edits, folds the project into a complete single-file snapshot, and zips it (with a short README telling the recipient what to do) — then shows you the zip in Finder, ready to send. The other person unzips, double-clicks, and picks up exactly where you left off; their decisions land in the same change history, attributed to their username.

**Client-facing exports** don't need every Screaming Frog column. **File → Export… → Client Export** lets you pick exactly the columns an audience should see — start from the built-in **Client Summary** (URL, title, content type, decisions, notes, redirect) or **Full**, tick or untick columns, and export the filtered or full row set. **Save as profile…** names your selection and stores it *in the project*, so "Phase 2 stakeholder review" is one click next month — and travels with the file in a handoff.

> **Good to know:** Transmission also keeps a rolling safety copy of each project (in its own application-support folder) every time you open it, so even a mangled file has a recent fallback.

### Install and first launch

1. Open the **`.dmg`** you were given and drag **Transmission** into your **Applications** folder.
2. Double-click to launch. Because the app is **signed and notarized**, it opens like any other Mac app — no right-click trick and no security warnings.
3. You'll be greeted by a **Welcome** dialog, where you can open a file, view the keyboard shortcuts, or take a quick **Product Tour**.

> **Tip:** you can reopen any of that later from the **Help** menu — **Getting Started** (the welcome screen), **Product Tour** (a 5-step guided spotlight), or **Keyboard Shortcuts** (also `Cmd+/`, or just press `?` anywhere in the app).

Transmission also checks for a newer version each time it launches, and you can check any time via **Help → Check for Updates…**. If one's out, you'll see the new version number with a **What's New** button (opens the changelog in a small in-app window) and a **Download** button (opens the release page in your browser). Installing is still a manual drag-to-Applications, same as the first install — nothing downloads or replaces the running app on its own.

### Open your first file

1. Choose **File → Open…** (or press **Cmd+O**) and pick your crawl export.
2. If the workbook has **more than one data sheet**, a **sheet picker** appears at the top of the sidebar — choose the one you want to audit. (Transmission works on one data sheet at a time.)
3. Transmission finds your **URL column** automatically by looking for headers like `Address`, `URL`, or `Link`. If it can't tell which column holds the URLs, it'll ask you to point it out.

That's the whole setup. Click any row in the sidebar and the page loads in the built-in browser, ready to review.

### What Is Added

The first time you open a file, Transmission quietly prepares it for auditing. You don't have to do anything — but it's worth knowing what appeared, so nothing looks mysterious later. It adds two kinds of things.

#### Audit columns

These are the fields you'll fill in as you work. `KKE_Recommendation` comes first; Tags, Notes, Group, and Primary Tag sit just after your URL column; and the rest (SME review, migration, CMS links, and components) are appended at the end. The complete list, with what each one is for, lives in the [Audit Columns reference](#audit-columns).

#### Structural sheets

These behind-the-scenes sheets hold project state and travel with the file:

- **Sitemap** — your future-state sitemap
- **KKE_Settings** — project settings, saved filters, and computed-column configuration
- **KKE_ChangeLog** — an automatic history of every decision change
- **KKE_Glossary** — your definitions for tags and groups
- **ContentTypeRegistry** — the content-type → target crosswalk
- **PatternLibrary** — the Target Spec Library
- **DesignPatternLibrary** — the Component Library

> **Heads-up:** Transmission manages these sheets for you, so there's no need to touch them in Excel — and they're hidden from the sheet picker to stay out of your way. A few bookkeeping columns (`_Flagged`, `_AssessedAt`, `_AssessmentResult`, and a couple of others) are handled for you too and stay hidden from the field bar.

### Which file types work

Transmission opens its own **`.transmission`** project files plus **`.xlsx`** (Excel 2007+), **`.xls`** (97–2003), **`.xlsm`** (macro-enabled), **`.ods`** (OpenDocument), and **`.csv`**. It's tuned for Screaming Frog exports, but any spreadsheet with a URL column will do.

### Reopening recent files

**File → Open Recent** lists your 10 most recent files, newest first. If a file has moved or been deleted it shows as `(missing)` and is greyed out; clicking it simply removes it from the list. **Clear Recent Files** at the bottom empties the list entirely.

### Starter libraries (the seed banners)

The first time a project could use a head start, Transmission offers a **one-time banner** with a starter library you can accept or wave off:

- **Content Type Registry** — about 20 common content types with sensible defaults
- **Target Spec Library** — 12 ready-made page and content specs
- **Component Library** — 57 built-in UI components

Accepting a banner adds that library to your project, and — like every change — it's saved automatically. Dismiss one and nothing is lost: you can seed it later from inside its own editor whenever you're ready.

### Saving, and picking up where you left off

You'll rarely have to think about saving. Transmission auto-saves after your last edit — **almost immediately (about half a second) in a project file**, or after about two seconds in a spreadsheet — and you can force a save anytime with **Cmd+S**. The title bar always tells you where things stand: **● Unsaved changes** while you're working, **⟳ Saving…** during a write, and **✓ All changes saved** once it's safely on disk. (In a `.transmission` project the write itself takes milliseconds; saving an `.xlsx` rebuilds the workbook, which is why both the debounce and the write are slower there — see [Project files](#project-files-the-faster-way-to-work).)

Close the file, reopen it (it'll be waiting in **Open Recent**), and you land exactly where you left off — Transmission even shows a friendly nudge like *"Resuming: 47 reviewed, 312 to go — press ] for the next unreviewed."*

> **Good to know:** when Transmission saves, it replaces any live formulas in the workbook with their last computed values. That's deliberate — it prevents the corruption Excel can suffer when cross-sheet formulas are rewritten. If your source workbook depends on formulas, keep an untouched copy alongside your audit file.

### Going deeper: cross-CMS links and intentional 404s

Two features worth knowing exist now — you'll meet them properly in later sections, but they're set up at open time:

- **Source / New CMS links.** The **CMS** cluster in the audit bar has two link fields. Paste the admin/edit URL for a page in your old CMS and your new one, and the **↗** button jumps straight there. A small dot on the sidebar row shows what's filled in (◐ source only · ◑ new only · ⊜ both) — handy for inspecting structure during the audit and confirming migrated pages afterward.
- **"Let it 404."** Sometimes the right call for a dead page is *no* redirect at all. Setting a page's redirect destination to the literal value **`404`** tells your engineers to let that URL die honestly — which is different from leaving it blank (that means "still to be decided"). More on this in [Redirects](#15-redirects).
- **The redirect badge.** Once a page has a redirect destination, a small amber badge appears in the audit bar's **Decide** cluster showing where it points (`↪ /team`, full URL on hover) — so you can see it without leaving the audit view. Click the badge to jump to that page in the Redirect Editor, or the **×** to clear the destination. An intentional `404` shows as a `404` badge. (It reflects a *resolved* destination — the same value the sidebar's **R** dot marks — so it appears once the destination is set or after a save resolves it, not the instant you mark a page Kill.)

### Quick self-check

You're ready to start auditing when:

- [ ] The app opens normally, with no security prompts
- [ ] Your crawl is open with the **right data sheet** selected
- [ ] Clicking a row loads a live page (so the URL column was detected)
- [ ] You've accepted or dismissed the seed banners on purpose
- [ ] A first **Cmd+S** saved cleanly, and reopening the file brought everything back

---

## 2. Project Setup

*By the end of this section you'll know where every setting lives, which ones travel with your file versus stay on your machine, and how to set a project up so the rest of the audit simply flows.*

> **In a hurry?** The [Project Setup walkthrough](walkthroughs/02-project-setup.md) is the condensed checklist. This is the guided version.

### Two tiers of settings

Transmission keeps configuration in two places, and knowing which is which up front saves you hunting for settings later.

#### Project Settings — these travel with the file

Anything client-specific lives here, saved inside the spreadsheet itself. Hand the file to another auditor and they inherit all of it:

- Site domain
- Custom KKE states
- Suggestion weights
- Page statuses and assignees
- Saved filters

#### App Settings — these stay with you

These are your personal preferences. They follow you from project to project and never travel inside a client's file:

- Auto-advance
- Which clusters are visible
- Your Claude API key
- Sidebar columns
- Column mapping

> **Rule of thumb:** if a setting should be the same for everyone auditing this client, it belongs in **Project Settings**. If it's just how *you* like to work, it's **App Settings**.

### Configure the project

Open **File → Project Settings…** to find five tabs. You don't need to fill in everything up front, but a minute here smooths out the whole audit.

#### Identity

- **Client name** and **Project name** — shown in the progress dashboard and on exported reports.
- **Site domain** — the canonical domain for redirect and navigation paths: **one** URL, the domain the new site will live on (e.g. `https://business.example.edu`, optionally with a path). On a consolidation, don't list the source sites here — every redirect is built by putting a page's path after this value, so `https://a.edu; https://b.edu` produces destinations like `https://a.edu; https://b.edu/about`. The field refuses anything that isn't a single URL, and Transmission warns on open if a saved value isn't usable. It overrides the domain auto-detected from your URLs. If you change it later, existing redirects built on the old value are rewritten to the new one when you leave the field.
- **Default redirect destination** — the fallback for Kill pages that don't have their own redirect. Change it and Transmission offers to update existing destinations that matched the old value (including blank ones).

#### KKE States

Beyond the five built-in calls (Keep, Kill, Evolve, Consolidate, Exclude), you can define your own states here, each with a color. Custom states are saved **both** in the file (so they travel) **and** in your app preferences (so new files inherit them). Each one shows how many rows currently use it.

This tab is also where you tidy up messy values:

- **Merge a state.** Every state has a **Merge…** button that reassigns all its rows to another target. Targets are grouped into built-in states, your other custom states, and *undefined values found in the data* (typos like `POST LAUNCH`). Before committing, the dialog previews exactly how many `KKE_Recommendation`, `Final_KKE`, and `SME_Decision: Change: …` cells will change. Use it to fix typos from SMEs or earlier auditors, fold two redundant states into one, or retire a custom state into a built-in one.
- **Undefined values in data.** A sub-list shows KKE values sitting in the data that aren't built-in or custom — usually typos or legacy values. Each has its own **Merge…**. Whitespace is forgiven (`Post Launch` and `Post Launch ` match), but case matters (`POST LAUNCH` and `Post Launch` are listed separately, in case you want to normalize one into the other).

#### Suggestions

This tab tunes **Suggested_KKE**, the unified recommendation that blends analytics and rubric scoring (covered fully in [Suggested_KKE](#8-suggested_kke)):

- **GA Analytics source** — **Configure…** opens the column-mapping, weights, and thresholds dialog; **Re-run GA** refreshes the scores after your data changes.
- **Rubric source** — runs the rubric across your filtered rows.
- **Source weights** — how much GA and the rubric each count (set either to 0 to switch it off). **Save & Recompute** applies the change immediately.
- **Last run** — a quick readout of how many rows were computed, left blank, or disagreed.

#### Migration

Two controlled vocabularies that the build phase relies on:

- **Page Statuses** — the build-lifecycle labels, seeded with **Not Started · In Progress · Built · In Review · Published · Blocked**. You can recolor them, rename them (renames cascade to every node using them), reorder them, or delete them (deleting clears the status off affected nodes, after a confirmation).
- **Assignees** — one shared pool of people, used for the **Builder**, **Writer**, and **Migrator** roles. Usage counts show how many of each role they're on, and renaming or deleting cascades across all three.

Both lists can also be added to on the fly with **+ New…** wherever they appear.

#### Saved Filters

A list of your named filter bundles, each with **Apply** and **Delete**. A bundle captures the search text, KKE filter, group filter, and any field filters together — see [Finding the Work](#4-finding-the-work) for how to create them.

> **Where this is stored:** every project setting is saved in the file's `KKE_Settings` sheet, and the libraries these tabs reference live in their own structural sheets (the Target Spec Library in `PatternLibrary`, the content-type crosswalk in `ContentTypeRegistry`, the glossary in `KKE_Glossary`). It all rides along with the spreadsheet.

### Set your personal preferences

Open App Settings from the **⚙** button (or **Transmission → Preferences…**, **Cmd+,** — under **File** on Windows and Linux); the subtitle confirms it applies to you across all files.

- **Appearance** — a **System / Light / Dark** segmented toggle at the top of the dialog. **System** (the default) follows your macOS appearance; **Light** and **Dark** pin the app regardless of the OS. This is a per-user preference. *(The embedded browser always renders crawled pages as designed — it is never dark-mode-adapted — so the pages you review look exactly as they do live.)*
- **Auto-advance** — jump to the next row after you set a KKE call (on by default).
- **Show SME fields** — reveal the SME Decision / Final KKE / Content Owner controls (also toggled by the **SME** chip above the audit bar).
- **Show Migration fields** — reveal Content Nature / Migration Track (also the **MIGRATE** chip).
- **Show Components cluster** — reveal the component-tagging cluster (also the **Components** chip).
- **Rubrics folder** — where your rubric files live; **Browse…** to point at it, **Edit…** to open them in-app.
- **Claude API key** — optional; enables AI assessment and is stored locally on your machine.
- **Sidebar columns** — extra columns to show in the row list.
- **Column mapping** — tell Transmission which columns hold KKE / Tags / Notes / Group / Primary when your file uses non-standard names (saved per file).

> **Tip:** two more preferences live outside this dialog and stick automatically — whether blank metadata fields are hidden (the **⊘ / ◉** icon in the field bar) and which audit-bar clusters you've collapsed. App preferences are stored at `~/Library/Application Support/Transmission/prefs.json`; the full list is in the [appendix](#preferences-persisted).

### Decide what's on screen

You don't have to look at every field at once. Turn on only the **Show …** toggles this engagement actually needs:

- Doing migration classification? Turn on **Show Migration fields**.
- Running an SME review loop? Turn on **Show SME fields**.
- Cataloguing UI components? Turn on **Show Components cluster**.

Blank read-only metadata is hidden by default, and any audit-bar cluster collapses with a click — so the workspace stays as calm as you want it.

### Set the visible metadata fields

Click the **⚙** at the right edge of the metadata bar (not the one in the title bar) to open the field picker. There you can add or remove fields, drag to reorder them, or move fields between the "available" and "visible" lists.

### Quick self-check

Your project is set up when:

- [ ] **Identity** is filled in — at least the **Site domain**, since redirects and sitemap paths depend on it
- [ ] Any **custom KKE states** this engagement needs are defined
- [ ] **Suggestion sources** are configured, if you'll use Suggested_KKE
- [ ] **Migration** vocabularies are seeded, if you'll reach the build phase
- [ ] **App Settings** reflect how you like to work

> **A note on appearance:** Set **App Settings → Appearance** to **System**, **Light**, or **Dark**. System follows your macOS appearance automatically; both themes have WCAG-compliant contrast. Whichever you pick, the embedded browser still renders crawled pages as designed — it is never dark-mode-adapted — so reviewing pages stays faithful.

---

# B. The core audit

## 3. Running the Audit Pass

*By the end of this section you'll be moving through pages quickly and confidently — reading each one, making the call, and letting the app carry you to the next.*

> **In a hurry?** The [Running the Audit Pass walkthrough](walkthroughs/03-running-the-audit-pass.md) is the one-page version.

### The loop in one breath

One row equals one existing page. Click a row and Transmission loads that page in the built-in browser, then fills the **field bar** above it with everything it knows about the page. You make a call, and — with auto-advance on — the app moves you to the next row. Read, decide, repeat.

Almost everything here is keyboard-driven, so you can keep one hand on the number keys and your eyes on the page.

### Make the call

With a row selected, press a number key to record your KKE decision:

| Key | Call |
|-----|------|
| **1** | Keep |
| **2** | Kill |
| **3** | Evolve |
| **4** | Consolidate |
| **5** | Exclude |
| **0** | Clear the call |

A few things speed this up:

- **Auto-advance** moves you to the next row the moment you make a call, so you rarely reach for the mouse.
- Press **`]`** to jump straight to the next page that still needs a decision.
- Pressing **4** (Consolidate) opens a picker so you can choose the page this one merges into — see [Consolidate](#9-consolidate).

> **Tip:** the same calls sit as buttons in the **Decide** cluster if you'd rather click. A key press and a button click do exactly the same thing.

### Capture your reasoning

- **Notes** — click **Notes** in the Decide cluster to record *why* you made a call. A small dot on the button marks the pages that have notes.
- **Flag** — press **F** (or click the ★) to flag a page you want to revisit, then filter to flagged pages later.
- **Assess** — runs your rubric against the page and suggests a call; more in [Suggested_KKE](#8-suggested_kke).

### Classify as you go (optional)

The **Classify** cluster lets you add descriptive metadata without leaving the page: **Content Type**, **Theme**, **Published** status, **Group**, a **Primary Tag**, and free-form **Tags**.

> **Heads-up:** resist the urge to fill everything in on the first pass. Set the KKE call and — where it matters for migration — the **Content Type**, then handle the rest in bulk later (see [Bulk Operations](#5-bulk-operations)).

### Drive the built-in browser

The browser toolbar gives you the usual controls plus a few audit-specific tools:

- **← → ↺** — back, forward, reload, with the live URL shown alongside.
- **Viewport switcher** — preview the page at common screen sizes: **Auto**, **SM** (390×844), **MD** (768×1024), **LG** (1280×800), **XL** (1920×1080).
- **◫ Compare** — split the view to see two pages side by side (handy for duplicates).
- **📷 Screenshot** — capture the full, scrollable page as a PNG.
- **⇊ Extract content** — pull word count, heading structure, and link count into a popover you can copy or export.
- **🔗 Check links** — scan every link on the page and flag broken ones in red.
- **↗ Open externally** — open the page in your system browser.

> **Tip:** a page that won't load (a login wall, a blocked embed) is still fully auditable — everything you need sits in the field bar's metadata, so make the call from there.

### The field bar up close

The field bar has two regions.

**The top row** shows metadata pulled from your spreadsheet (Title, Status Code, and so on). Six fields accept inline edits — Title 1, Meta Description 1, H1-1, H1-2, H2-1, and H2-2 — and the rest are read-only. At its right edge sit the **SME**, **MIGRATE**, and **Components** chips (each reveals its matching cluster), the **⊘ / ◉** toggle (hide or show blank metadata fields), and the **⚙** field picker (choose which columns appear).

**The audit bar** below it is a stack of labeled **cluster** cards. Click a cluster's pill to collapse it to a one-line summary, and click again to expand; your choices stick, per cluster. Here's what each cluster holds:

- **Decide** (blue) — the KKE buttons, the read-only **Suggested_KKE** badge (which shows the recommendation and a ⚠ when its sources disagree), and the **Assess**, **Notes**, **Sitemap**, and **Menu** actions. With SME fields on, it also shows the SME readout and the **Final** call.
- **Classify** (slate) — Content Type, Theme, Published, Group, Primary Tag, and Tags (see [Tagging, Grouping & the Glossary](#6-tagging-grouping--the-glossary)).
- **Migrate** (amber, optional) — Renders as and Migration Track (see [Content Types & the Crosswalk](#7-content-types--the-crosswalk)).
- **CMS** (green) — Source CMS and New CMS admin links.

> **Heads-up:** switching a page to **Kill** when it already has a sitemap assignment or a redirect prompts you to clear them, so you never leave an orphaned redirect behind. The same prompt appears for Final KKE, bulk changes, and Table View edits.

### A few conveniences worth knowing

- **Page thumbnails.** Once you've viewed a page, hovering its sidebar row shows a thumbnail preview — a quick way to recognize a page without clicking back into it. Thumbnails live in memory only and never bloat your file.
- **Note snippets.** The Notes popover has a **Snippets…** menu for reusable rationale — insert a saved snippet, save the current note as one, or manage the list. Snippets follow you across projects.
- **Undo and redo.** **Cmd+Z** and **Cmd+Shift+Z** cover KKE changes and sitemap node deletions — single or bulk (up to 100 actions per session). Tag and note edits aren't undoable, but they're always saved.
- **Build the sitemap without leaving the audit.** The **Sitemap** button places the current page on the sitemap (and if the sitemap is still empty, it offers an inline form — Label prefilled from the title, Slug from the URL — to create its very first node in one click). The **Menu** button adds the page to one of your menus: since menus reference pages that are on the sitemap, it makes sure the page is on the sitemap first, then lets you pick an existing menu, spin up a **+ New menu…**, or (with no menus yet) create your first menu right there. No trip to the Sitemap or Menus view required.
- **Clean paste.** When you paste into sitemap labels, slugs, or notes, Transmission strips mojibake, stray HTML entities, and invisible characters — while leaving real accented letters (é, ü, ñ) untouched.

### Quick self-check

You're auditing well when:

- [ ] Every page you mean to review has a KKE call (press **`]`** to confirm none are left)
- [ ] You've captured a note wherever the call isn't self-evident
- [ ] **Content Type** is set where it'll feed migration classification
- [ ] Tricky pages are flagged for a second look

---

## 4. Finding the Work

*By the end of this section you'll be able to carve thousands of rows down to exactly the set you want to work on — and save those slices so you never rebuild them.*

> **In a hurry?** The [Finding the Work walkthrough](walkthroughs/04-finding-the-work.md) is the one-page version.

### How filtering thinks

Filters **stack**. Text search, KKE status, group, and any field filters all apply together (an AND), and the sidebar always shows exactly what's left. That matters for the next chapter, too: the **Multi-bar** acts on precisely this filtered set, so narrowing the list *is* how you choose what to act on in bulk.

### Search by text

The top of the sidebar is a search box with a **scope** selector beside it:

- **All fields** — search every column.
- **URL** — match only the address; great for sweeping a section by path, like `/news/`.
- **Title** — match only the page title; handy when you know the name but not the URL.

The placeholder text changes to show the active scope, and the scope sticks as you refine your search — it only changes when you pick a different one. Click **✕** to clear.

### Sort in site order

A crawl lists pages in whatever order the spider found them, and even an A–Z sort mixes sections together. For a site that's all over the place, click **Site order** in the sidebar's Address header to review it section by section:

- **Pages placed in the sitemap** come first, in sitemap order: the order you see in the Sitemap editor.
- **Unplaced pages** follow, grouped by site and then by URL path. Each section's landing page sits directly above everything under it: `/about`, then `/about/history` and `/about/team`, then `/about-us`. A plain A–Z sort would put `/about-us` in the middle of the About section. Numbers sort as numbers (`page/2` before `page/10`), and a page comes before its `?query` variants.
- URLs are **indented by level**, so sections read as sections.

Click **Site order** again to turn it off, or click the Address header to go back to A–Z / Z–A. Site order works together with every filter, and it's remembered like the other sort settings.

### Filter by KKE status

Click the **KKE filter** to open a checkbox list. Check as many as you like and they combine with OR — so **Keep + Evolve** shows everything you're keeping. Alongside the five calls, the list includes useful **special filters**:

- **Unreviewed** and **Flagged**
- **Duplicates** (identical Title, H1, or Meta Description)
- **SME conflicts** and **SME pending**
- **Consolidate (no target)** and **Consolidate (dead target)**
- **Shared sitemap node** and **Needs placement**
- **Suggested disagrees** and **Suggested ≠ your call**

Use the **Group** dropdown next to it to narrow to a single content group.

### Filter by any column

For anything the built-in filters don't cover, click **+ Field filter** and build your own:

1. Pick a **field** (any column in your spreadsheet).
2. Pick an **operator**: `is blank`, `is not blank`, `contains`, `doesn't contain`, `equals`, `doesn't equal`, `starts with`, `ends with`, `is greater than`, or `is less than`.
3. Enter a **value** and click **Apply**.

`is greater than` and `is less than` are for the numeric columns a crawl is full of — word count, status code, response time, inlinks, GA sessions. They compare as **numbers** whenever both the cell and your value are numeric (`1,234` is fine), so `Word Count is less than 300` finds thin pages without `900` sorting above `1,000` the way a text comparison would. Give either side something non-numeric and they fall back to comparing character by character in ASCII order — usable for text if you know that ordering, where uppercase sorts before lowercase. Blank cells match neither direction: blank means *unreviewed*, not zero.

Each filter becomes a removable chip, and you can stack several (they AND together). The **Unclassified** button is a one-click shortcut for the common case `Content Nature is blank`.

### Save a filter for next time

Built a slice you'll want again? Open **Saved filters…** and choose **+ Save current filter…**. The saved bundle remembers the search text and scope, the KKE selection, the group, and every field filter — all together. Manage your saved filters in **Project Settings → Saved Filters**.

### Find one specific thing (Cmd+F)

When you just want to *find* a page rather than narrow the list, press **Cmd+F** for a floating search bar. It searches every column across every row, shows a match count, and steps through hits with **◀ / ▶** — clearing the sidebar filters if needed so it can show you the match. Think of it as "find and jump," distinct from the sidebar's "narrow the list."

> **Good to know — reading the sidebar.** Each row carries a gentle KKE-tinted background (green Keep, red Kill, yellow Evolve, grey Exclude), the URL, a KKE badge, and the flag ★. Two small letters flag structure: **N** (green) means the page is assigned to a sitemap node, and **R** (amber) means it has a redirect. Non-200 pages show a colored status badge (amber for 3xx, red for 4xx/5xx). A **Quick Stats Bar** along the bottom tracks "X/Y reviewed (Z%)."

### Quick self-check

- [ ] Your search **scope** matches what you're hunting for
- [ ] You're multi-checking the KKE filter when you mean "either/or"
- [ ] Field filters are layered for precise slices (e.g. `Sitemap_ID is blank`)
- [ ] Slices you'll reuse are saved as named filters
- [ ] You reach for **Cmd+F** for one-off lookups

### A bit more to know

- **Customizing the sidebar.** By default the list shows your first few columns; change that in **App Settings → Sidebar columns**. The **+** at the right of the column-header strip adds extra comparison columns (SME Decision, Final KKE, Content Owner) as badges; the **×** removes one. Long URLs scroll sideways when you hover, and a small gear by "KKE" opens column mapping.
- **Adding a page by hand.** Found a page the crawl missed? **New Page** (in the sidebar toolbar) opens a URL + Title dialog, checks for duplicates, and drops the new row in, selected and ready.
- **Moving around.** Click a row to select and load it; **Cmd+click** toggles rows for a multi-selection; **Shift+click** selects a range; **↑/↓** or **k/j** step through.
- **Clearing out non-200s in bulk** is its own quick workflow — see [Non-200 Triage](#10-non-200-triage).

---

## 5. Bulk Operations

*By the end of this section you'll be making the same decision across dozens or hundreds of pages in a single click — turning a 4,000-row crawl into an afternoon's work instead of a week's.*

> **In a hurry?** The [Bulk Operations walkthrough](walkthroughs/05-bulk-operations.md) is the one-page version.

### How the Multi-bar chooses its target

The **Multi-bar** sits at the bottom of the sidebar and acts on one of two sets, by a simple rule:

- If you've **multi-selected** rows, it acts on your selection.
- Otherwise, if a **filter** is narrowing the list, it acts on the filtered rows.

The bar's label always tells you which — *"Apply to N selected:"* or *"Apply to N filtered:"* — so you can see what you're about to change before you change it.

### Choose your target

You have two ways to point the Multi-bar at the right pages:

- **Filter only.** Narrow the list with search, the KKE filter, or field filters (see [Finding the Work](#4-finding-the-work)) and let the Multi-bar act on the whole result. Best when the rule is expressible — "all 404s," "everything tagged thin-content."
- **Multi-select.** **Cmd+click** toggles individual rows and **Shift+click** selects a range. Best when the rule is in your head — "these five, not those two."
- **Select all visible.** The checkbox at the left of the column header strip selects every row the current filter shows — then Cmd+click to drop the exceptions and apply. It shows a dash (indeterminate) when only some visible rows are selected, and clicking it again clears the selection.

If you've both selected rows and applied a filter, your **selection wins**.

### Apply an action

1. Pick an **Action** — Set KKE, Set Published Status, Set Content Type, Set Content Theme, Set Group, Set Primary Tag, Add Tag, **Assign to Sitemap…**, or **⚠ Delete rows permanently…**.
2. Choose the **value** (every list except *Add Tag* offers a `— Clear` option at the top, so bulk-clearing a field is easy).
3. Click **Apply**. Every change is written to the audit trail.

**Clear selection** drops your multi-selection and hands the target back to the filter.

> **Heads-up:** bulk-setting **Kill** on pages that already have a sitemap assignment or redirect triggers the same cleanup prompt as a single Kill — so you decide whether to clear those too, rather than leaving redirects pointing nowhere.

### Deleting rows for good

Almost nothing in Transmission destroys data — your crawl is preserved column-for-column from import to export. **⚠ Delete rows permanently…** is the exception, and it exists for one narrow case: rows that were never pages. A stray export appended to the file, a merge that doubled a section, a handful of junk lines that arrived with the spreadsheet. Without it the only remedy is Excel, which costs you the audit columns and the change log.

**Use `Exclude`, not deletion, for anything that is a real URL.** Exclude says "this was in the crawl and isn't part of my inventory" — it keeps the row, keeps its history, and keeps it out of every report. Deletion says the row should never have existed. If you might want to explain the decision later, you want Exclude.

Before it does anything, the dialog tells you what the deletion **breaks**:

- pages that **consolidate into** one you're deleting, which would be left pointing at nothing
- how many of the doomed rows carry a **KKE decision** — reviewed work, as distinct from crawl noise
- how many are **placed on the sitemap**, or carry a **redirect destination** that will drop out of the redirect map

Then it asks you to type `PERMANENTLY DELETE`. The Delete button stays greyed out until you do.

Two things worth knowing before you commit:

- **It cannot be undone, and it clears your undo history for the session.** That second part isn't caution for its own sake — every undo entry refers to a row *by position*, and removing rows moves everything below them. Keeping the history would mean a later Cmd+Z quietly writing an old value into the wrong page. Dropping it is the safe answer.
- **Each deleted row is written to the change log**, with its URL. The removal is part of the audit trail even though the row isn't.

**There is no close-without-saving escape.** Autosave runs a couple of seconds after any change — sooner on a `.transmission` project than on a spreadsheet — so a deletion is on disk almost immediately. Don't rely on quitting to undo it.

If you do need to recover, a `.transmission` project writes a backup into the app's `backups` folder **each time it is opened**, so the fallback is the state of the project when you opened it this session — everything since is lost. That is a genuinely bad day, which is why the confirmation is what it is. Spreadsheets have no such backup.

### Placing many pages on the sitemap at once

**Assign to Sitemap…** works differently from the other bulk actions — there's no value to pick, just **Apply**, which opens a small dialog.

By default only **Keep** and **Evolve** pages are eligible (checking `Final_KKE` first if it's set, otherwise `KKE_Recommendation` — so an SME override wins). Everything else — Kill, Exclude, unreviewed, and Consolidate — is left off the sitemap unless you check **Include Kill / Exclude / unreviewed pages too**. This matters most when building a **current-state sitemap** for a client conversation (see below) — that's the one routine case where you *do* want everything represented, killed pages included. Even with that box checked, Consolidate pages get one more speed bump: if any are in the batch, a follow-up prompt asks you to confirm including them, since a Consolidate page is being merged into another page's URL rather than getting a destination of its own — easy to sweep in by accident.

Once you know which pages are going, pick a destination:

- **Suggested** — if some of your selected pages already have a *sibling* page placed on the sitemap (e.g. `/about` is already assigned and you're placing `/about/leadership`), the dialog offers that node up front with a one-click **Use this** — the same auto-suggestion the single-page Sitemap picker uses, extended to the whole batch. It shows how many of your pages agree (e.g. "12 of 15 pages").
- **Use an existing node** — pick any node already in the sitemap; every target page becomes a new child underneath it.
- **Create a new bucket** — name a fresh node (top-level, or nested under a node you pick) and every target page lands under that instead.

Then choose how pages get placed under that destination:

- **Direct children of the destination** (the default) — each page becomes its own child node, one level deep. Slug and label are auto-derived from its URL and title, and duplicates are automatically de-duplicated (`-2`, `-3`, …).
- **Preserve URL structure** — builds nested sections from each page's full URL path (just like Create Sitemap from Audit below), rooted under whatever destination you picked, to a **Bucket depth** you choose. Useful when the batch spans several URL folders and you want that structure to show up as sitemap sections rather than a flat pile of pages. If your destination already corresponds to part of the URL path (e.g. you picked "Products" and the URLs start with `/products/...`), you'll get a redundant nested section — pick a shallower destination or lower the depth to avoid it.

Pages already placed on the sitemap are skipped and called out in the confirmation. This is a *speed* tool, not a precision one: the goal is getting dozens or hundreds of pages onto the sitemap in one action, then reorganizing them into their final structure with the Sitemap editor's drag-and-drop.

> **Building a "current state" sitemap for a client conversation? Duplicate the project *first*.** `File → Save As Project…` to a dated snapshot name (e.g. `project-current-2026-07-15`), build the descriptive tree **there**, and export your diagrams from it — then go back to the untouched original for the forward plan. The two files together make the now-vs-future story easy to show a client.
>
> Do it in this order, not the other way around. Placing a page on a node writes its `Computed Path`, and on the next save the redirect resolver reads that, sees it differs from the page's live URL, and writes a `Redirect_Destination` — correct for a tree describing where pages are *going*, meaningless for one describing where they already *are*. Those redirects then outlive the tree: deleting a node clears its pages' sitemap fields but not their redirects, and the resolver won't revisit an existing value on a Keep/Evolve page. Snapshot-then-duplicate copies that contamination straight into your forward plan. In the snapshot copy, tick **Include Kill / Exclude / unreviewed pages too** so the whole site is represented. See [Showing the current state](./RUNNING_AN_AUDIT.md#showing-the-current-state--do-it-in-a-copy) for the reset procedure if it's already happened in place.

> **Starting from a blank sitemap?** **Project → Create Sitemap from Audit…** goes one step further than Assign to Sitemap — it reads every eligible page's URL and builds the whole starter tree for you in one pass, no destination to pick. `/about/leadership` becomes **About → Leadership** automatically. Pick a **Bucket depth** (how many URL segments become nested sections — 2 is a good default; anything deeper folds into one page under the deepest bucket) and whether to include Kill/Exclude/unreviewed pages, then Generate. Safe to run again later, too — it only merges (matching section names it already created), never replaces, so it won't duplicate work you've since reorganized by hand.

> **Read the prediction before you click Generate.** The dialog tells you how many top-level sections you're about to create and how many of them will hold a single page. This is worth a look, because the tool can only find the hierarchy your URLs already have — and plenty of sites don't have one. On a flat CMS where every article lives at `/some-long-slug`, each of those pages becomes its own top-level section: one real audit produced **548 sections from ~1,900 pages**, 461 of them a single page. Note also that **bucket depth won't change that number** — sections come from the *first* URL segment, so every depth gives the same count.
>
> That's not a failure of the tool, it's a finding about the site: those URLs carry no information architecture to derive one from. But it does produce a tree too big to draw. When the prediction looks like this, the dialog offers to sweep the single-page sections into one named section ("Unsorted" by default) as part of the same step, so what you end up with is a tree you can actually open and start organizing. You can also spot crawl artifacts here — `/tag`, `/category`, `/wp-content` — which are usually worth triaging to Kill or Exclude *before* generating, so they never enter the sitemap at all.

### Score in bulk instead of deciding by hand

Sometimes you don't want to *set* a call across many pages — you want a *suggestion* to react to. **Project → Run Rubric on filtered rows…** scores the filtered set and feeds the results into **Suggested_KKE** (see [Suggested_KKE](#8-suggested_kke)). You still make the final call; the rubric just does the first read.

> **Tip — a few patterns that pay off:**
> - *Mark all 404s as Unpublished:* field-filter `Status Code equals 404` → **Set Published Status → Unpublished**.
> - *Tag every Article "archive":* field-filter `Page_Type equals Article` → **Add Tag → archive**.
> - *Move 12 specific pages to a group:* Cmd-click the 12 → **Set Group**.

### Quick self-check

- [ ] The Multi-bar's label confirms the right target (**selected** vs **filtered**) before you Apply
- [ ] Anything you're tempted to delete is genuinely not a page — a real URL you aren't auditing is an `Exclude`
- [ ] You've spot-checked a couple of rows in the filtered set
- [ ] Any Kill-cleanup prompt was handled the way you intended
- [ ] You used batch scoring for *suggestions*, and set KKE by hand where judgment matters

### A bit more to know

- **Batch AI assessment.** The **Batch Assess** button in the assessment popover runs the AI across every filtered row, one at a time, with a running count you can cancel. It's paced at about one request per second to stay within API limits.
- **Finding duplicates.** The KKE filter's **Duplicates** option surfaces rows that share an identical Title, H1, or Meta Description — prime candidates for consolidation, or a sign of content copied across URLs.

---

## 6. Tagging, Grouping & the Glossary

*By the end of this section you'll be labeling pages with a consistent vocabulary — and documenting that vocabulary so every auditor (and the client) reads it the same way.*

> **In a hurry?** The [Tagging, Grouping & the Glossary walkthrough](walkthroughs/06-tagging-grouping-glossary.md) is the one-page version.

### Three kinds of label, three jobs

It's easy to confuse these, so here's the distinction up front:

- **Group** — *one per page.* The high-level bucket a page belongs to, like "Admissions" or "Research." Drives the Group filter and section-level reports.
- **Primary Tag** — *one per page.* The single most important descriptor — the page's headline characteristic.
- **Tags** — *many per page.* A free set of finer descriptors (`thin-content`, `outdated`, `evergreen`), stored as a comma-separated list.

The **Glossary** sits underneath all three, recording what each term *means* so it's applied the same way on page 12 and page 1,200.

### Apply labels as you audit

In the **Classify** cluster:

- **Group** and **Primary Tag** are single-select dropdowns. Pick a value, or choose **+ New…** to define one on the spot (it's sanitized and added to the library).
- **Tags** is a chip input — click **+ Add tag** to pick from the library or type a new one to create it.

To label many pages at once, narrow the list and use the **Multi-bar**: **Set Group**, **Set Primary Tag**, or **Add Tag** (see [Bulk Operations](#5-bulk-operations)).

> **Rule of thumb:** consistency beats coverage. A small, well-defined tag set applied uniformly is far more useful in reports than a sprawling one applied ad hoc.

### Keep the vocabulary honest with the Glossary

Open **Project → Edit Glossary…** to define your terms. The editor has two sections — **Tags** and **Groups** — and lists every name already in your file, so you never type one twice.

- Write a definition in each entry's markdown box. A small toolbar offers **B**, *I*, bullet list, link, and code, and **Preview** shows the rendered result.
- **+ Add entry** lets you seed a definition for a term you haven't applied yet.
- Empty definitions are pruned when you save, so only documented terms persist.

Your definitions travel with the file (in the `KKE_Glossary` sheet) and surface as hover tooltips on tag chips and the Group dropdown — gentle reminders right where you're working.

### Hand the glossary to the client

Click **Export for Word…** in the glossary editor to save a clean, styled `.html` file (Calibri 11pt, with your client, project, and date in the header). Word opens it directly, so it's ready to drop into a content-strategy deliverable as the documented key to your tagged inventory.

### Quick self-check

- [ ] Every page has a **Group**
- [ ] **Primary Tag** is set wherever one descriptor clearly dominates
- [ ] **Tags** are drawn from a deliberate, reused set — not freeform sprawl
- [ ] Every term in active use has a **Glossary** definition
- [ ] You've exported the glossary for the client if they need the key

### Two related Classify fields

The Classify cluster also holds two fields that aren't tags but live alongside them (both are bulk-markable via the Multi-bar):

- **Content Theme** — a site-specific, single-select label (one client's themes — "Sustainability," "Investor Relations" — won't match another's). It starts empty; **+ New theme…** adds to this project's list, stored in `Content_Theme`.
- **Published Status** — one of Published, Unpublished, Draft, or 404 / Missing. It's most useful when you start from a CMS export where drafts and unpublished pages show up as 404s: filter to those, multi-select, and **Set Published Status → Unpublished** in one move. Stored in `Published_Status`; any custom values from your import are preserved as `(custom)`.

The third Classify field, **Content Type**, is the key into the migration crosswalk and has its own section — see [Content Types & the Crosswalk](#7-content-types--the-crosswalk).

### First: get the alternate views out of your queue

A crawl lists *URLs that responded*, not pages. On a CMS-driven site a large share of those are the same page seen through pagination, sorting, faceted filters, or tracking parameters — on a recent ~13,000-row crawl, roughly half. Auditing them one by one is wasted work, and counting them overstates the site to the client by more than double.

**Project → Triage URL Variants…** finds them by reading the site's own `rel=canonical` — its explicit statement that a URL is not distinct content. That beats guessing from parameter names, which would mean maintaining rules for every CMS and plugin you meet.

The dialog groups variants by the page they point at, largest first, and picks a sensible default for each:

- **Query only** — the variant differs from its canonical by query string alone. The path is the same, so when that path is redirected the variants follow; they need no rule of their own. Default: **Exclude**.
- **Different path** — the URL itself dies, so it needs a redirect. Default: **Consolidate** into the canonical, which fills in the redirect for you.
- **Canonical target not in this crawl** — left alone. There's nothing to consolidate into; the `Canonical target not in this crawl` filter shows them.

> **Nothing is hidden.** Every page keeps its row in the sidebar and gets a real, logged KKE decision you can see and change. **Cmd+Z reverses the entire triage in one step.** Pages that already have a decision are skipped unless you say otherwise, and sites you've marked out of scope are never touched.

Two things get noticeably better afterwards: the **Duplicates** filter stops matching most of the site (it now ignores pages you've already dispositioned), and your undecided count reflects real content.

### Consolidating several sites into one

Most audits take one site to one site. When you're merging several — `www.company.com`, `home.anothercompany.com`, `thirdcompany.com` — the **site** becomes a unit of work with its own owner, CMS, redirect configuration, and go/no-go decision.

Transmission builds a **Sites registry** for you: open the crawl and every domain in it gets an entry, with `www.` and non-`www.` folded together automatically. Manage them in **Project Settings → Sites**:

- **Merge the hosts that are really one site.** Each host shows its page count; the **⇄** button moves it to another site. Whether `careers.company.com` belongs with the main corporate site or stands alone is your call, not something the tool should guess.
- **Un-tick "In scope"** for a property that isn't part of this phase — an intranet, say. Its pages stay in the file, but drop out of every report denominator so completion percentages mean what they say.
- Record each site's **CMS** and **owner** under **Details** — these travel into the hand-off.

Every row then carries a **Source Site** value, so you can filter by it, sort on it, color the Visual Sitemap by it, and export it.

Two things follow automatically:

- **Redirect maps split per domain.** Each retiring domain deploys its own redirect configuration, so the Migration Tracker writes one sheet per domain and the Redirect Map export offers one CSV per domain (pick a folder; it writes them all).
- **Set the Site Domain.** With several sites in scope and no target domain set, redirect destinations get built on whichever domain happens to come first in the crawl. Transmission warns you; set it on the **Identity** tab.

Then run **Reports → Site Consolidation Overview** and **Cross-Site Duplicate Overlap** — see [Reports](#16-reports-for-clients--stakeholders).

### Audience: who is this page for?

Most engagements start with an **audience prioritization workshop** — the client ranks who the site is really for. That ranking has traditionally lived in a deck and never touched the audit, so Keep/Kill/Evolve got argued on traffic and quality alone. Audience tagging closes that loop: a page can have respectable traffic, pass every rubric rule, and still serve nobody the organization decided to invest in. That is a finding you can act on, and it is invisible without this.

**1. Load the workshop output.** **Project → Audience Library…** (or Project Settings → **Audience**) is where the ranking lives. Add audiences one at a time, **Seed starter list…** to begin from a generic set (**Higher education** or **General organization**), or — usually fastest, and always the better answer when you have it — **Paste from workshop…** and drop in the table straight from your spreadsheet, one per line:

```
Prospective Undergraduates	Primary	High-school students choosing where to apply
Alumni	Secondary	Graduates staying connected
```

Each audience carries a **tier** — Primary, Secondary, Tertiary, or Not a target — plus a color used later for sitemap shading. **Setting the tiers is the step that matters.** Everything downstream reads them, and a library left entirely at the default Secondary can't tell you anything.

**2. Tag as you audit.** The **Audience** cluster appears in the audit bar (it reveals itself automatically once your library has entries; the `Audience` quick-chip toggles it). Two fields:

- **Also serves** — a chip input for every audience the page does real work for. The picker groups by tier, so your priority ranking stays in front of you while you tag.
- **Primarily for** — who it's *mainly* for. Tag exactly one audience and this fills itself in; tag several and you pick.

> **A blank audience is not "serves nobody."** Blank means *nobody has looked yet*. When you review a page and conclude it genuinely serves no one you care about, tag it **— None (no target audience)**. That distinction is what lets the app argue Kill on the second case without accusing every untouched row of the same thing.

**3. Tag in bulk — really.** Nobody hand-tags three thousand pages through a chip input, and a column that's 4% full makes every report below worthless. Filter to a section, select all, and use the Multi-bar's **Add Audience** / **Remove Audience** / **Set Primary Audience**. A large site is realistically a few dozen bulk passes plus hand-correction. Two filters give you the worklists:

- **Needs audience** — Keep/Evolve pages nobody has assessed yet.
- **Serves no priority audience** — reviewed, and everything it serves is off-strategy.

**4. Two tools for the long tail.** Bulk passes get you most of the way; these two get you the rest.

**Set audiences on the sitemap.** If your IA already says who each section is for, say it once, on the section. Every sitemap node's editor has an **Audience** section: tick the audiences the branch is for. A node with none set inherits from its nearest ancestor, so tagging *Academics* covers everything beneath it, and a child that sets its own (say *Faculty pages* → Faculty) overrides that for its own branch. Only nodes that set audiences themselves show a 👥 chip in the tree, so you can see where each setting lives.

Node audiences fill **untagged** pages placed under them. They never overwrite a page you've tagged, and they skip Kill/Exclude pages and out-of-scope sites, the same rules as the other fill tools. When you save a node with new audiences, you're asked before its branch is filled, with the page count. When you assign a single page from the audit bar, it's filled right away and a toast tells you so. Either way, one **Cmd+Z** undoes it. *— None* can't be set on a node: "serves nobody" is a call about a page, not a section. The Visual Sitemap and Treemap can color by **Audience (sitemap)**, so a whole branch shows the audience it inherits.

**Fill Audiences from Section…** (`Project` menu) spreads audiences you have *already* tagged in a section onto that section's untagged pages. It invents nothing — it only propagates a decision you made yourself somewhere else in the same section, and it only fills blanks. If any untagged pages sit under sitemap nodes with audiences, it offers to fill those from the sitemap first, since the sitemap is a decision and section agreement is only an inference. The dialog shows every section it can act on, what it would apply, the agreement behind it, and how many pages it would fill; untick any you disagree with. A section needs at least three tagged pages, with an audience appearing on at least half of them, before it's allowed to speak for the rest — so tag a handful by hand first, then run this. The whole fill is one **Cmd+Z**.

> **— None is never inherited.** Spreading "serves nobody" onto pages no one has looked at would turn an unreviewed blank into a Kill vote. If a page genuinely serves no one, that stays a call you make.

**Suggest Audiences with AI…** (`Project` menu, needs a Claude API key in App Settings) reads each page's title, H1, meta description, URL and section against *your* audience library and proposes who it serves. Because it's tagging against the library, the suggestions are specific to this client rather than generic — which is also why the library has to exist first.

It **does not write your `Audiences` column.** Suggestions go into a review queue, exactly as Suggested KKE never touches your KKE call. Review them two ways:

- **In bulk** — the review dialog groups every suggestion by the answer, so a few thousand pages become a few dozen decisions. Each group shows sample paths and a confidence reading; accept or decline the whole group. Low-confidence groups are where the metadata was too thin to tell — worth opening a couple of those pages first.
- **One at a time** — a page with a pending suggestion shows it inline in the Audience cluster with **Accept** and **Dismiss**, so you can take them as you work through the audit normally. The **Audience suggested by AI** filter is that worklist.

Pick the scope (everything untagged, or just the current filter — pilot one section before committing) and the model. Requests are billed to your own key, and **Esc** stops a run with everything suggested so far kept. Accepting is one **Cmd+Z**; declining leaves the page blank, which is the honest state — still unreviewed.

**5. It votes on the KKE call.** Once pages are tagged, **Audience** joins GA and Rubric as a source in [Suggested KKE](#8-suggested_kke): serving a Primary audience argues **Keep**, serving only Tertiary/off-target audiences argues **Evolve**, and an explicit *— None* argues **Kill**. Untagged pages and Secondary-only pages abstain entirely, so an untagged project is completely unaffected. Tune its weight beside the others in Project Settings → **Suggestions**.

The disagreements are where this earns its keep. *GA says Keep, Audience says Kill* is a popular page serving nobody strategic — often a legacy hub or an internal page ranking on brand terms. The reverse is under-served priority content, which argues for **promotion**, not removal.

**6. See it.** Color the Visual Sitemap or Treemap by **Primary Audience** to see which audience each section actually serves, and run the three audience reports — see [Reports](#16-reports-for-clients--stakeholders).

### Jobs to be done

Audiences answer *who* a page is for. **Jobs** answer *what they came to do* — and the two together are what a discovery workshop actually produces.

**Load them** in **Project Settings → Audience → Jobs to be done**. Each job has a short **label** (what you tag with, so the spreadsheet stays readable), the full **statement** in the workshop's own words, and the **audiences** that have it — leave that blank for a job anyone might have, like *find who to contact*. **Paste from workshop…** takes the table straight from your spreadsheet.

**Tag as you audit.** Once the library has entries, a **Jobs served** field appears in the Audience cluster. The picker puts the jobs belonging to *this page's* audiences at the top, so on a long list you're choosing from three rather than scrolling forty. Bulk-tag from the Multi-bar with **Add Job**, and use the **Needs a job** filter as the worklist.

> **The point isn't the tagging — it's the gap.** Run **Reports → Jobs Coverage** and read the top section first: *jobs nothing answers*. Those are jobs the client told you people come to do, for which the site has no page. That is the strongest brief for net-new content you can write, because every line traces back to something they said themselves rather than to your judgement. The same list is appended to the **Net New Content Brief**, which otherwise only finds gaps in the sitemap you drew.

The report's **Best page** column is the page you'd send someone to for that job — a Keep outranks an Evolve outranks an unreviewed page. It's a routing hint, not a quality score.

### Quick self-check — audience

- [ ] The audience library reflects the workshop, with **real tiers** set
- [ ] Every Keep/Evolve page is tagged, or on the **Needs audience** worklist
- [ ] No AI suggestions are left sitting unreviewed (**Audience suggested by AI** filter is empty)
- [ ] Pages that genuinely serve nobody are tagged **— None**, not left blank
- [ ] You've reviewed the **Risks** in Audience Coverage before signing off the redirect map
- [ ] If a JTBD workshop was run, **Jobs Coverage** has been read and its unserved jobs are in the net-new brief

---

# C. Classify for migration

## 7. Content Types & the Crosswalk

*By the end of this section you'll classify each page for migration — what it is, how it should render in the new CMS, and what it maps to — and most of the downstream defaults will fill themselves in.*

> **In a hurry?** The [Content Types & the Crosswalk walkthrough](walkthroughs/07-content-types-crosswalk.md) is the one-page version. The thinking behind it lives in `CONTENT_TYPE_MODEL.md`.

### The two questions every page answers

Migration asks two genuinely different things about a page, and Transmission keeps them apart on purpose:

- **What is it?** Its **Content Type** — the data shape (Article, Faculty Profile, Landing Page). Every page has a *current* type and maps to a *target* (new-CMS) type. This is the **key** everything else hangs off.
- **How does it render?** Its **Renders as** value — a **Page** (its own URL and breadcrumb), a **Record (own page)** (a structured entry, like a news post, event or profile, that still has its own URL), a **Fragment (embeddable, no URL)** (no URL of its own; dropped into pages via components, like an AEM experience fragment), or **Generated** (a template drawn over a feed or query).

The **Content Type Registry** is the crosswalk that ties them together. Define the mapping **once per content type**, and every page of that type inherits it — without ever overwriting something you set by hand.

### Set the Content Type as you audit

In the **Classify** cluster, set each page's **Content Type**. A small **→** hint appears next to it showing the target type it maps to.

> **Tip:** this is the one classification worth doing during your main audit pass. It's the key, so everything downstream (Renders as, target type, migration track) can flow from it automatically.

### Build the crosswalk

Open **Project → Content Type Registry…**. Each row maps one current content type to its targets:

- **Content Type** (current) — the key
- **Renders as** — Page / Record (own page) / Fragment (embeddable, no URL) / Generated
- **Target Content Type** — what it becomes in the new CMS
- **→ Target Spec** — the spec it's built from (see [Build & Direction](#14-build--direction))
- **Migration Track** — its default delivery track
- **Notes**

**Seed with defaults** stages about 20 common types to start from. The editor doesn't only show saved rows — it also lists every content type **in use in your data that has no crosswalk yet**, flagged *"● in use · N pages · no crosswalk,"* so gaps are visible and easy to fill. A **Show all pick-list types** toggle adds the global dropdown values you haven't used here.

> **Good to know:** the two stay in sync automatically. Adding a type via the audit bar's **+ New content type…** seeds a row here too, and untouched surfaced rows aren't saved — so browsing or toggling never bloats the sheet. The matching is split-aware, so a compound name like `Article / blog post` counts as covered by your `Article` or `Blog Post` entry rather than nagging you as a gap. The footer tallies `N types · M mapped · K need crosswalk`.

### Let the defaults flow

When you set or change a page's Content Type, Transmission fills its **blank** Renders as, Migration Track, and Target Content Type from the matching registry entry — and only the blank ones, so your hand-entered values are safe. Matching is case-insensitive, and falls back to splitting compound names and trying each part.

In the **Migrate** cluster, the **Track** field shows a dashed ghost suggestion (derived from the KKE call plus Renders as) whenever it's empty — click it to accept.

### Check your coverage

- The **Unclassified** button (a shortcut for `Content Nature is blank`) finds pages still missing a Renders-as value.
- **Reports → Content Type Crosswalk…** lays out the full current → target picture with page counts, and flags any type that still has **no crosswalk**.

### Quick self-check

- [ ] Every Keep/Evolve page has a **Content Type**
- [ ] The registry covers every type in use (no "no crosswalk" flags)
- [ ] **Renders as** is populated (the Unclassified count is down to zero)
- [ ] **Target Content Type** and **→ Target Spec** are mapped per type
- [ ] **Migration Track** is set, or the ghost suggestions accepted

### Going deeper

**Why the registry is per-project.** Different CMSs name things differently — a WordPress "post" isn't a Drupal "article" isn't a HubSpot "blog post." So each project keeps its own crosswalk, codifying that client's conventions. (The Content Type *vocabulary* in the dropdown is global and shared across your projects; the *crosswalk* is per-project. That's the two-tier design the sync above bridges.) A seeding banner on first open offers **Seed defaults**, **Open editor**, or **Don't ask again**; the data lives in the `ContentTypeRegistry` sheet.

**The Migrate cluster fields.** These appear once you turn on **Show Migration fields**:

- **Renders as** (stored as `Content_Nature`) — **Page** (a hand-authored standalone), **Record** (stored as `Content Object`: a structured entry like an article, event or bio that still has its own page), **Fragment** (stored as `Fragment`: embedded into other pages, no URL of its own, so it gets no redirect and needs no sitemap placement), or **Generated** (a system-rendered view over records). Don't confuse Record with Fragment: a news post migrated as a record is still a page people link to, and it needs a redirect like any other page. This is a *delivery* concern, not a quality one — a page can be Keep and any of the three.
- **Migration Track** — Scripted, Migrate Records, Configure, Manual Rebuild, Merge, or Kill/Redirect. The technical architect owns this call; the registry and the ghost suggestion just give it a head start.

**Fragments have no public URL.** In the Sitemap editor you can set a node's **Node type → Fragment / shared content**. A Fragment keeps a computed path as a repository location but has no menu entry, breadcrumb, or redirect; it shows a `FRAG` badge and sits outside the net-new/empty counts. Anything that renders as a Fragment is automatically left out of the redirect plan (no URL to redirect) and the needs-placement check (a fragment has no sitemap home by design — that's correct, not a gap).

**The reports.** The **Content Type Crosswalk** report gives the CMS architect the whole current → target map; the **Migration Direction Brief** turns the per-spec direction into per-person worklists (both in [Producing the Outputs](#16-producing-the-outputs)).

---

## 8. Suggested_KKE

*By the end of this section you'll have the app proposing a call for each page, so you spend your judgment confirming and correcting rather than starting from a blank row.*

> **In a hurry?** The [Suggested_KKE walkthrough](walkthroughs/08-suggested-kke.md) is the one-page version, and the rubric language is in the [appendix](#rubric-dsl-operators).

### What Suggested_KKE is

**Suggested_KKE** is a single recommendation that blends up to three independent sources:

- **Rubric** — deterministic rules you write.
- **AI** — Claude's judgment about the page.
- **GA** — a composite score from analytics metrics.

Each source produces its own call; Transmission combines them by a **weighted vote** into one suggestion and records the per-source breakdown behind it. Crucially, it **never touches your human KKE call** — the suggestion sits alongside yours for you to confirm or overrule.

### Set up your sources

All three are configured in **Project Settings → Suggestions**:

- **GA Analytics** — map your analytics columns and set the metric weights and thresholds.
- **Rubric** — point at your rubrics folder (in App Settings) and run the batch.
- **Source weights** — how much each source counts (0 switches one off), with **Save & Recompute**.

### Generate suggestions

- **From rubrics:** filter to the rows you want, then **Project → Run Rubric on filtered rows…** (or **Assess** a single page).
- **From AI:** **Project → AI Suggest for Unreviewed…** runs Claude across every page that still has no call (about a second per row; press **Esc** to stop). It writes only the suggestion — your KKE column is untouched.
- **From GA:** **Project → Refresh GA KKE**.

Each of these folds its result into Suggested_KKE automatically. To re-run just the combining step, use **Project → Recompute Suggested KKE**.

### Read and act on them

The **Suggested_KKE badge** in the Decide cluster shows the winning recommendation. Click it for a popover listing every source and how it voted.

When the sources **disagree**, the badge takes on a dashed amber border and a **⚠**. Two sidebar filters help you spend judgment where it counts:

- **Suggested disagrees** — the sources didn't agree with each other.
- **Suggested ≠ your call** — the suggestion differs from the call you made.

> **Workflow:** confirm the easy agreements quickly, then filter to those two and slow down only where the machine is unsure or disagrees with you.

### Quick self-check

- [ ] At least one source is configured (rubric, AI, or GA)
- [ ] **Source weights** reflect how much you trust each one
- [ ] Suggestions have been generated across the rows you care about
- [ ] You've reviewed the **disagreements** and **mismatches**
- [ ] Your human **KKE** call is confirmed where it matters

### Going deeper

#### Rubrics

Rubrics are plain Markdown files in a folder you choose (**App Settings → Rubrics folder**), one per status:

```
rubrics/  keep.md  kill.md  evolve.md  exclude.md
```

Each file has two sections. **Field Rules** are evaluated automatically against your spreadsheet data — the status with the most passing rules wins. **Content Rules** are plain-English statements used as a manual checklist and by the AI assessor. The full rule syntax is in the [Rubric DSL appendix](#rubric-dsl-operators).

#### Assessing a page

Click **Assess** on a row to see which field rules pass or fail for each status, a score, and a suggested call. **Accept Suggestion** applies it.

#### AI assessment

With a Claude API key set, **AI Assess** sends the page's metadata and your content rules to Claude and returns a recommendation with reasoning — useful for subjective rules a field comparison can't capture. Results are tracked in `_AssessedAt` and `_AssessmentResult`. (The batch version is **AI Suggest for Unreviewed**, above.)

#### Editing rubrics

**App Settings → Rubrics → Edit** opens an in-app editor with a tab per status, so you needn't leave the app. You can also bind a specific rubric folder to a specific file, so different projects use different rule sets (saved per filename).

#### How GA KKE scores a page

GA KKE turns GA4 metrics captured during the crawl into a Keep/Kill/Evolve recommendation — an *input* to your decision, never a replacement. It blends four metrics into a weighted composite (defaults shown):

| Metric | Weight |
|---|---|
| Sessions | 0.35 |
| Engagement Rate | 0.25 |
| Avg Session Duration | 0.25 |
| Views per Session | 0.15 |

Each metric is ranked against the whole site (PERCENTRANK), combined by those weights, and mapped to **Keep** (≥ 0.6), **Evolve** (≥ 0.3), or **Kill**. To set it up: crawl with GA4 connected, open the file, and click **Set up** on the "GA4 data detected" banner; the columns are auto-detected. Pick a weight preset or tune the weights, then **Save & Compute** — it fills the `GA_KKE_Recommendation` and `GA_Score` columns. Re-tune anytime in Project Settings → Suggestions, and **File → Refresh GA KKE** recomputes. It never touches `KKE_Recommendation`, never writes Excel formulas, and never re-runs silently; its config is stored as JSON in `KKE_Settings`.

---

## 9. Consolidate

*By the end of this section you'll be folding redundant pages into a single strong survivor — with the others pointing at it cleanly, and no broken redirects left behind.*

> **In a hurry?** The [Consolidate walkthrough](walkthroughs/09-consolidate.md) is the one-page version.

### Why Consolidate exists

Most audits frame the decision as Keep / Kill / Evolve, but a huge share of real work is **merging overlapping pages** — three landing pages chasing the same keyword, four near-duplicate blog posts. Kill and Evolve are both wrong for these: Kill throws away the value each page held, and Evolve leaves them competing with each other.

Consolidate is the merge option. It concentrates topic authority on one page, ends the keyword cannibalization, gives users a single source of truth, preserves the valuable bits, and leaves fewer pages to migrate. It also writes a clear brief for the content team: *"merge /old-a and /old-b into /new-canonical."*

### How it works

When you consolidate page A into page B, A's content merges **into** B. A points at its **target** (recorded in `Consolidate_Into`) and the target survives — usually as **Evolve**, since it's receiving new content. A consolidated page needs no sitemap placement of its own. On save, Transmission works out A's redirect by chasing B to wherever it actually lands, and it warns you if a target is **dead** (missing, or itself being killed).

### Consolidate a single page

1. Select the source page and press **4** (or click **Consolidate**). The **Consolidate into…** picker opens — a searchable, sortable list of your whole inventory, with the source URL and any SME notes pinned at the top.
2. Click a page to select it, then double-click it (or use **Set as target**) to confirm.

Transmission sets `Consolidate_Into`, switches the page's call to Consolidate, and clears its sitemap assignment. To change the target later, click Consolidate again — the current target is highlighted, with a **Go to page →** link that jumps straight to it if you want to check what you're merging into; **Clear target** removes both the target and the call.

**Transmission will offer to set the target to Evolve.** If the page you picked is marked **Keep**, **Kill**, **Exclude**, or hasn't been reviewed, a prompt asks whether to move it to Evolve, because that's the right shape: receiving content *is* a change, so Keep is no longer true, and a Kill or Exclude target is a destination that's itself being removed — the merged content would have nowhere to land and neither page would get a working redirect. You can decline if you have a reason; the consolidation stands either way. If the target already has a **Final KKE**, that gets updated too, so the change actually takes effect.

**You can't consolidate a page into itself**, or into a page that consolidates back into it — either one is a redirect loop plus content that never arrives, so both are refused outright rather than warned about.

> **Tip:** add a note on the target page about what's merging in. The Evolve prompt handles the call itself; the note is what tells the content team *why*.

### Find consolidation groups in bulk

When several pages already share a sitemap node, they're often consolidation candidates. **Sitemap → Consolidation Candidates…** opens a workflow built for exactly this:

1. It lists every node with 2 or more pages, biggest group first.
2. For each group, select the radio button on the page that should be the **target**.
3. Click **Apply**.

In one click, the target becomes Evolve (preserving a deliberate Keep/Evolve), the rest become Consolidate pointing at it, and their sitemap placement and explicit redirects are cleared. **Skip** defers a group that legitimately shares a node. A counter tracks *"X to resolve · Y skipped · Z hidden · N total,"* and a filter bar lets you scope by **Include KKE** or **Exclude groups** so you can set a whole section aside without touching individual calls.

> **Why this beats one-at-a-time:** it's roughly one Apply per group instead of four clicks per page, and it enforces the right shape every time — target = Evolve, the rest = Consolidate pointing at it.

### Catch duplicates as they happen

You don't have to remember to run Consolidation Candidates to catch a duplicate — Transmission also flags it the moment it happens. If you mark a page **Keep** or **Evolve** (or assign it to a sitemap node) and another **Keep/Evolve** page already sits at that same destination, a **"Did you mean to Consolidate?"** prompt appears naming the other page, with a one-click **Consolidate into it**. Only one page can occupy a given destination, so a second Keep/Evolve landing there is almost always a mistake rather than a deliberate choice — this catches it right away instead of at the sitemap-node level days later.

### Catch broken targets

Two sidebar filters keep consolidations honest — clear both before you ship:

- **Consolidate (no target)** — marked Consolidate but no target chosen yet. You don't have to remember to check: when there are any, a red **"⚠ N Consolidate: no target"** chip appears in the sidebar toolbar next to the row count, and clicking it applies this filter. It's there because a Consolidate with no target is the one call that isn't a finished decision — it says the page goes away without saying where its content and its redirect go — and it's the shape an SME import routinely leaves behind.
- **Consolidate (dead target)** — the target is missing or is itself Kill/Exclude (the source shows an amber dot).

### When the client changes a consolidation

SME review is where consolidation decisions get revisited most. The client knows which pages overlap in ways a crawl can't show, and may have a different idea of where the content belongs. Their **Final KKE** always wins: whether a page consolidates follows the Final KKE, not your recommendation.

- The KKE buttons still show **your** recommendation. When the Final KKE differs, a **Final** chip appears beside the buttons. Click it to pick a target (for a Consolidate) or to open the Final dropdown. In the sidebar, your KKE badge is struck through when a Final overrides it.
- Setting a page's Final KKE to **Consolidate** opens the target picker. If you had already picked a target, it's kept. Changing a Final *away* from Consolidate offers to clear the old target, or you can keep it (inactive) in case the decision changes back.
- **SME → Review Consolidations…** lists every consolidation the client touched: pages they asked to consolidate that you didn't, pages you consolidated that they kept, and pages where you both said Consolidate but the SME left notes. For each one you can choose or change the target, confirm it's right, or clear an unused target. A reviewed page leaves the list until its decision or target changes again. The app offers this review after an SME import or a Resolve Conflicts session. The **Consolidate (client changed — review)** filter finds the same pages.

### Quick self-check

- [ ] Every Consolidate page has a **live** target
- [ ] No **dead-target** warnings remain
- [ ] Each target survives as **Keep/Evolve**, not killed
- [ ] Consolidated pages carry no stray sitemap assignment
- [ ] Redirects resolve to a real URL (confirm in the [Redirect Editor](#15-redirects))

### Going deeper

**How the redirect is chased.** On save, a Consolidate page's destination is computed in order: the target's *future* computed path if it has a sitemap assignment, then — if the target is itself Consolidate — the final destination down the chain (cycle-safe), then the target's own explicit redirect, and finally the target's current URL. It updates automatically whenever the target's sitemap assignment changes, so you never maintain these by hand.

**Spotting them at a glance.** A Consolidate row takes on an indigo tint and a small `C` pill once a target is set, and the Consolidate button shows a dot. The **Shared sitemap node (2+ pages)** filter is a lighter-touch alternative to the Candidates workflow — it simply surfaces every page whose `Sitemap_ID` is shared, for cases you'd rather review one by one.

**When an SME asks for a Consolidate.** SME imports may carry `Change: Consolidate` (sometimes with a target hinted in their notes). Filter to **Consolidate (no target)**, click each row's Consolidate button — the picker shows the SME's notes in a yellow callout — and pick the target. The picker won't overwrite the SME's imposed Final KKE; it just fills in the destination.

---

## 10. Non-200 Triage

*By the end of this section you'll have cleared the redirects, 404s, and server errors out of a crawl in one sweep — so they stop cluttering the real content audit.*

> **In a hurry?** The [Non-200 Triage walkthrough](walkthroughs/10-non-200-triage.md) is the one-page version.

### The idea

A crawl is full of non-200 URLs — 3xx redirects, 4xx not-founds, 5xx errors. Most of these aren't content decisions; they're cleanup. Triage groups them **by status code** and lets you set a sensible default call for each whole group at once, rather than one row at a time.

### Run the triage

1. Open **Project → Triage Non-200 Pages…** — or simply accept the prompt Transmission offers automatically when it spots non-200 rows in a freshly opened file.
2. Review the table: one row per status code, showing the code and its label (like "301 — Moved Permanently"), how many pages it covers, and a KKE dropdown pre-set to a sensible default (3xx → Kill, 404 → Kill, 5xx → Exclude, and so on).
3. Adjust any group's call, or leave it **blank** to skip that group.
4. Click **Apply** to set the call across every page in each group you chose.

### Afterward

Non-200 pages keep a small **status-code badge** in the sidebar — amber for 3xx, red for 4xx/5xx — so you can eyeball what's left as you scroll.

> **Heads-up:** the defaults are a starting point, not a verdict. A 301 that points somewhere you're keeping might really be **Keep**. And triage only *sets* a call — it never hides a row. A page showing 404 in the crawl might be a misconfigured live page, a login wall, or one that was simply down during the crawl; it's still fully clickable and auditable, so you can inspect it, note it, and override the call like any other page.

### Quick self-check

- [ ] You ran triage (from the menu or the auto-offer)
- [ ] Each code group has a deliberate action, or was intentionally skipped
- [ ] You clicked **Apply**, so non-200 rows now carry calls
- [ ] No unexpected red or amber badges are left unreviewed

---

# D. Collaborate & review

## 11. SME Review

*By the end of this section you'll be able to send pages to subject-matter experts for validation — no app required on their end — and reconcile their calls into a final decision.*

> **In a hurry?** The [SME Review walkthrough](walkthroughs/11-sme-review.md) is the one-page version.

### The loop

SME review runs in four steps: **export → the reviewer fills in dropdowns → import → resolve.** Your reviewer needs nothing but Excel. Their answers land in three columns — `SME_Decision`, `SME_Notes`, and `Content_Owner` — which merge in alongside your work and never overwrite your KKE call.

Three columns track the decision as it moves:

- **`KKE_Recommendation`** — your original call.
- **`SME_Decision`** — the expert's verdict: **Approve**, or **Change: Keep / Kill / Evolve / Exclude** (custom states appear here too).
- **`Final_KKE`** — the resolved outcome. An **Approve** sets Final to match your call automatically; a **Change** creates a conflict for you to resolve.

### Export for review

Open **SME → Export for SME Review…**. You can scope the export to a **Group**, a **Primary Tag**, or **All**, and the file ships with data-validation dropdowns on the SME_Decision column so reviewers pick from valid options.

> **Tip:** if different people own different sections, tick **Split by Content Owner** — Transmission writes one file per owner (named for them) into a folder you choose, so each reviewer sees only their pages.

### What the reviewer does

For each page, the SME chooses **Approve** (they agree) or a **Change: …** option (they'd call it differently), and can add notes and a content owner. They save and send the file back.

### Import their decisions

**SME → Import SME Decisions…** reads the returned file and merges the SME columns back in, matched by URL. Where the SME approved, Final KKE is filled to match your call; where they chose a Change, a conflict is created.

### Compare, then resolve

- **SME → Compare KKE vs SME…** is a read-only, full-screen overview: every reviewed page side by side (your call, the SME's, the resolved Final, and a status of ✓ Agree, ↳ Resolved, or ⚠ Pending), with header tallies, a filter for agreements / changes / pending, and click-to-jump to any row.
- **SME → Resolve Conflicts…** is where you actually decide: a list of every disagreement showing the URL, your call, the SME's, and the current Final. Resolve them one at a time or in bulk.

The sidebar's **SME conflicts** and **SME pending** filters help you work the list down, and turning on **Show SME fields** lets you reconcile right in the audit bar.

### Quick self-check

- [ ] Exported (split by owner if there are multiple reviewers)
- [ ] Their file imported — the SME columns are populated
- [ ] You reviewed the divergence in **Compare KKE vs SME**
- [ ] **Resolve Conflicts** is done — every reviewed page has a **Final KKE**
- [ ] The **SME conflicts** and **SME pending** filters are empty

---

## 12. Multi-auditor Merge

*By the end of this section you'll be able to combine KKE decisions when two people audited the same inventory in parallel, resolving any disagreements cleanly.*

> **In a hurry?** The [Multi-auditor Merge walkthrough](walkthroughs/12-multi-auditor-merge.md) is the one-page version.

### How merging works

When two auditors split a large crawl, each works in their own copy. Merging reads the **other** auditor's file, matches rows by URL, and reports **agreements** versus **conflicts** — places where the two of you made different calls on the same page. Nothing is overwritten silently; you decide each conflict.

### Run the merge

1. Open your copy.
2. Choose **File → Merge Auditor Decisions…** and pick the other auditor's file.
3. Empty cells in your file fill automatically from theirs. If there are conflicts, a resolution dialog opens with a running "N remaining" count.

### Resolve and save

Work down the conflict list, picking the right call for each — or use the bulk actions **Accept All Theirs** / **Keep All Mine**. When the list is clear, **Cmd+S** saves the merged result, and the change-log entries persist with it. Your file is now the combined source of truth.

> **Good to know:** this reuses the same resolution screen as SME conflict resolution, so it'll feel familiar.

### Quick self-check

- [ ] The other auditor's file is merged in
- [ ] Every reported conflict is resolved (0 remaining)
- [ ] You spot-checked a few merged rows
- [ ] Saved — your copy is the canonical file

### A related tool: Import / Merge

**File → Import/Merge Audit Decisions…** is the gentler cousin of a full auditor merge: it matches by URL and fills **only empty** fields, leaving your existing decisions untouched. Multi-sheet files offer a sheet picker, column checkboxes show **exists** / **new** badges, and an **"Add new URLs not in current file"** option (on by default) appends rows your file is missing.

> **Good to know — the change log.** Every change to a KKE, SME Decision, or Final KKE is recorded automatically and written to a hidden `KKE_ChangeLog` sheet on save (Timestamp, Row, URL, Field, Old Value, New Value). It accumulates across sessions, giving the project a complete decision history — see [Pre-flight & Hand-off](#18-pre-flight--hand-off).

---

# E. Architect the future site

## 13. Sitemap & IA

*By the end of this section you'll have built the structure of the new site and placed every page you're keeping onto it — the moment the audit stops being a list and becomes a site.*

> **In a hurry?** The [Sitemap & IA walkthrough](walkthroughs/13-sitemap-ia.md) is the one-page version.

### The mental model

The **sitemap is how your content is organized** — the sections, the hierarchy, where each page lives. Its goal is a shared picture everyone can see: the **Visual Sitemap** (the toolbar's *Visual Sitemap* button) turns the structure into an interactive box-tree so stakeholders can *look at* the organization instead of reading a spreadsheet.

Your audit rows answer *"what do we do with each existing page?"* The sitemap answers a different question: *"how is the new site organized?"* You connect the two by **placing** each Keep/Evolve page onto a node. A node can carry **no** source pages (it's net-new content you'll write), **one**, or **many** (it's a consolidation target).

**The URL path and the on-page breadcrumb are *derived from* the sitemap — but they are not bound to it.** By default a page's URL and breadcrumb follow its position in the tree, and renaming a node cascades to its descendants. But the sitemap is about *organization*, not *addressing*, so either can diverge whenever the real site needs it to. The app has a per-node **URL override** and **breadcrumb override** for exactly this (the *Addressing & breadcrumb* block in the node editor) — so you organize content in the way that makes sense, without being forced into matching URLs or verbose breadcrumbs.

> **Two everyday examples of the split:**
> - **Retail.** Shoes might be organized under both `Home › Clothes › Men › Shoes` and `Home › Clothes › Women › Shoes`, yet ship at the flatter URLs `/shoes/men` and `/shoes/women`. Same organization, simpler addresses.
> - **Higher ed.** A department lives at `Home › Academics › Departments › Chemistry` in the sitemap, but its URL is just `/chemistry` and its on-page breadcrumb reads `Home > Departments > Chemistry`. The deep organizational home doesn't force a deep URL or a long breadcrumb.
>
> The rule of thumb: **organize in the sitemap; let URL and breadcrumb follow by default, and override only the few that shouldn't.**

Open the tree with **Cmd+Shift+T** (or the **Sitemap** tab). The **stats line** beneath the toolbar is your dashboard — more on reading it below.

> **Starting from nothing?** You don't have to open the Sitemap first. If the sitemap is still empty, clicking the audit bar's **Sitemap** button offers an inline form (Label prefilled from the page title, Slug from the URL) with a **Create & assign** button that creates the first root node and drops the current page onto it in one step.

### Place every Keep/Evolve page

Your goal is to drive **need placement** in the stats line down to **0**.

1. In the audit view, set the **KKE filter** to **Keep + Evolve**, then add a field filter for `Sitemap_ID is blank` and **Apply** — that's exactly the pages still needing a home.
2. For each one, click **Sitemap** in the Decide cluster, drill to the right node, and click **Assign**. Use **+ Child** in the picker to create a new node inline if no good home exists yet.

> **Tip:** the stats line's **"N need placement"** is a clickable link — it jumps you straight to those rows. Consolidate pages don't need placement; they fold into their target.

### Shape the future-state tree

- **Rename and re-slug** inline (double-click, or the **✎** editor). The label drives the breadcrumb; the slug drives the URL; both cascade to descendants.
- **Reorder or reparent** by dragging a node's grip — drop in the top or bottom third of a row to make it a sibling, or in the middle to make it a child.
- **Add** nodes with **+ Root Node** (toolbar) or the **+** on any row, and **⧉** clones a whole branch (structure only, no page assignments).
- **Remediate** (toolbar) ensures every assigned page has a child node — handy after a big reorganization.

> **Heads-up:** two children of the same parent can't share a slug (they'd collide on one URL), so duplicate slugs within a branch are highlighted in red until you fix them.

### Set node type, menu membership, and links

Open a node's editor and you can set:

- **Node type** — **Page** (a normal page), **Header** (a grouping level with no page of its own), or **Fragment** (shared/embedded content with no menu entry — see [Content Types & the Crosswalk](#7-content-types--the-crosswalk)).
- **Collapse** — collapse this node's subtree in the **Visual Sitemap** (it renders as a single box with a "has more underneath" stack instead of its full branch). The toolbar's **Collapse ✓** / **Expand** apply this to all *visible* nodes at once (pair with the Depth filter). *(What's actually in navigation is now described by the independent **Menus** view, not a per-node flag.)*
- **External URL** — point a menu item at an outside address instead of a built page.
- **Reference** — alias this node to another so the same destination can appear in two places without duplicating it.

### Phase out-of-scope work

Not everything in the tree ships in this build. In the node editor, set **Phase** to **Current build** (the default), **Future**, **Stretch**, or **Archived**. Phased nodes carry a colored badge, never raise a net-new "NEW" flag, and can be left out of exports. Filter the tree by phase with the toolbar **Phase** dropdown (All / Current build only / Non-current only), and on export you'll be asked whether to include phased nodes.

### Read the gap signals

Two badges tell you where the tree is incomplete:

- **NEW** (yellow) — a net-new node: it has descendant pages but no source page of its own. Expected for brand-new sections; a flag if you didn't mean it. Double-click it to open the editor — an amber banner explains why it's flagged, points at the **Page Status** field (Build section) for tracking "Not Started" → "In Progress" as the content strategist works it, and a **Create Page** button turns it into a real page: a new spreadsheet row (Keep, tagged `net-new`), assigned to the node, so it shows up everywhere a normal page does — audit view, exports, the migration tracker. Once it has a page, the NEW badge clears on its own.
- **Empty leaf** (red) — a node with no pages *and* no redirects pointing through it. Assign content, mark it net-new, phase it, or delete it before hand-off.

If any `Sitemap_ID` is assigned to two nodes, a **⚠ N duplicate IDs** link appears in the stats line — click it to auto-renumber the duplicates.

### Track coverage from the stats line

The stats line reads, left to right:

`N nodes · M current (A assigned, H net new, E empty) · [phase buckets] · P pages placed · [F fragments] · [status tallies] · X need placement`

So **need placement → 0** confirms every Keep/Evolve page is in the IA, **empty** counts your coverage gaps, and the status tallies track build progress (more in [Build & Direction](#14-build--direction)). Filter the tree with the **Depth**, **Phase**, and **Build** dropdowns, and use **Collapse All** / **Expand All** to manage large trees.

### See it and report on it

- **Visual Sitemap** (toolbar **Sitemap**) renders the content IA as one interactive box-tree rooted at your homepage, with a stacked shadow signalling a collapsed subtree or a multi-page leaf and a count line under each label (see **Counts** below). It opens live in the app — click a card's **+/−** to **collapse/expand** it, scroll to **zoom**, drag to **pan**, **Fit** to frame (Shift+1), **100%** for actual size (Shift+0; clicking the zoom readout between **−** and **+** does the same, and +/− on the keyboard step the zoom), toggle **Numbers**, choose what the **Counts** line under each label reports, **Expand all** / **Collapse all** (both re-fit the view, since they change the tree's size enormously). (Only the +/− toggles a branch — clicking the card body does nothing, so you can't accidentally hide a section while reaching for its colour.) Controls:
  - **Counts** (toolbar dropdown) — what the small line under each card's label says. **Hidden sub-pages (collapsed only)** is the default: a card says nothing until you collapse it, and then it tells you how many pages are folded away underneath (*"6 pages hidden"*) — the question a folded diagram actually raises. **Sub-pages on every branch** puts that count on every parent, collapsed or not, so you can size sections at a glance. **Assigned audit pages** is the original behavior — each card shows how many crawled pages are assigned to that node. **None** hides the line entirely. Whatever the mode, a collapsed card always reports what it's hiding (except in **None**). Your choice is saved with the project and is honored by the HTML, PDF, and Miro exports.
  - **Shape check** — a sitemap can be perfectly valid and still be too big to draw. If yours is, the app says so *before* opening the diagram (and the Sitemap toolbar's stats line carries a ⚠ you can click any time). The check reports how many top-level sections you have, the exact size the diagram would be, and the zoom it would open at — then names what's driving it:
    - **Top-level sections holding a single page** — the signature of a flat site: those pages sit at the URL root, so there was no path segment to nest them under. Fix: move them under one section.
    - **Crawl artifacts, not sections** — `/tag`, `/category`, `/author`, `/wp-content` and friends are CMS plumbing rather than parts of the site. Fix: remove those sections (their pages stay in the audit, just unplaced).
    - **Sections too wide to lay out** — a node with dozens of direct children spreads across one very long row. Fix: mark it collapsed (reversible any time via the **Collapse** checkbox).

    As you tick repairs, it shows **the tree you'd end up with** — sections, size, zoom. That's the point of the tool: on a genuinely flat site the honest answer is that these repairs *aren't enough*, because grouping 500 pages into the eight sections the new site will actually have is judgement, not a button. Better to know that before restructuring than after. It also answers the obvious first question — *shouldn't there be a site-root box above all this?* — by measuring it: a root box turns the diagram's height into width, which sometimes helps and often doesn't, and the check tells you which.

    **Opening it anyway is always offered**, and is sometimes the right call: "this site has 548 top-level sections and no information architecture" is a finding worth showing a client, and it's more convincing as a picture than a number.
  - **Smart layout** — each branch lays out **horizontally** (children fan sideways below the parent) or **vertically** (children stack below-and-indented) automatically. Two toolbar dropdowns decide which, whichever fires first: **Vertical from depth** (go vertical at this depth) and **or if children ≥** (go vertical for any node with this many children). Right-click any node with children to **force horizontal / force vertical** or clear the override; nodes you've overridden show a dashed outline.
  - **Hide in diagram** (node editor → Identity). Some sitemap nodes need to exist for mapping to the new CMS but shouldn't appear in a client diagram: Drupal `/user/123` profile pages, a feed, a search page. Tick **Hide in diagram** and that node and everything under it leave the Visual Sitemap and its HTML, PDF, PNG and Miro exports. The node keeps its pages, URL, redirects, menu references and report rows, and the Treemap and Content Flow still count it. Hidden nodes show a dashed *hidden in diagram* tag in the Sitemap editor.
  - **Large branches** (Settings → Layout). Two rules keep a flat site drawable:
    - **Collapse if children >** (default 25): any branch below the top level with more direct children than this opens collapsed. Its card says how many pages it hides ("~1,400 pages hidden"). A client sitemap should show *News*, not every headline. Expanding one lasts until you close the diagram, and it never ticks the branch's **Collapse** checkbox in the Sitemap editor. To keep a large branch open every time, raise the number or set it to 0.
    - **Stack top level if >** (default 30): top-level nodes are exempt from **or if children ≥**, so a homepage's sections spread across the top. A top-level node with more children than this stacks them in a column instead of one very wide row.

    Set either to 0 to turn it off. Both carry into the HTML, PDF, PNG and Miro exports, and the sitemap shape check measures the diagram with them applied.
  - **Parent position** (Settings → Layout) — **Centered over children** (the default), or **Left-aligned**, where each parent sits over its first child. The root anchors the top-left corner and the tree grows out to the right, which reads more like an outline on a wide, shallow site. **Fit** keeps a left-aligned tree against the left edge. Carries into the HTML, PDF, PNG and Miro exports.
  - **Settings** (button → panel, three tabs):
    - **Layout** — card width/height and every gap, in pixels, plus **Corner radius**, **Padding L/R**, and **Padding top/btm**. These are global looks, not per-rule. Radius and padding are capped relative to the card, so a large value can't squeeze the label out of its box. Previews live. Long page names clip cleanly at the card edge (hover a card for the full name), and the default card height fits a two-line name alongside the number and page count.

        Below the dimensions, a **Connectors** section sets how the lines between boxes look:
        - **Line color** — one color for every connector. Deliberately one color, not per-line: if you want a rainbow, Miro is the place to do that after export.
        - **Line weight** — *Uniform* (every line the same, the default and what sitemaps have always drawn) or **By content volume**, where each line's thickness reflects how many pages sit beneath it. A section carrying 200 pages draws as a thick trunk; a 4-page corner draws thin. A parent's shared run carries its whole branch and each drop carries that child's share, so it reads like a trunk splitting into branches.
        - **Base width** / **Max width** — the thin end and the thick end of that scale. The scale between them is compressed rather than straight-line, because sitemap volumes are lopsided: one enormous section would otherwise flatten everything else into identical hairlines.

        Volume weighting counts **every** page assigned beneath a node, including ones marked Kill or Consolidate — the line answers "how much content is under here", which is a different question from the card's page badge ("how many pages will still be live"). Menus have no page counts, so they always draw at the base width. All of it saves with the project and carries into the HTML, PDF, PNG and Miro exports.
    - **Colors** — a rule engine, covered in full under [Colour rules in depth](#colour-rules-in-depth). In short: pick a **Card style** — **Colour band** (the colour sits on a strip across the top of a white card) or **Heavy outline** (a white card with a thick coloured border, the convention most sitemap decks use and the one that reads better zoomed out over hundreds of cards) — then build rules that test anything on your sitemap *or* in your spreadsheet. Each rule can set a colour, a fill, and a **line style** (solid / dashed / dotted). New projects start coloured **by depth**; colouring by top-level section keys on the tree's top-level children, so a site whose pages all hang off a single root node came out effectively one colour. Start from a generator — **By depth**, **By section**, **Mark external** (off-site destinations, inserted at the top of the list so they win over whatever scheme you already have), or **Colour by this** for a single field — then add, recolor, delete, and drag to reorder. Right-click a single node → **Set color** to override just that node. Uses your **Client brand** palette (Project Settings → Identity) when set.
    - **Legend** — edit the legend's labels for the client-facing exports.
    - **Save as my defaults** stores the current layout/colors/legend as your app-wide starting point for new projects; **Reset to defaults** restores them.
  - Phased nodes are drawn with a **dashed** border, and that wins over whatever line style a colour rule sets — so a dashed card always means "not in this build." Every other card takes its line style from your rules (solid unless a rule says otherwise).
  - **Share it:** **Export HTML** writes a single self-contained, **still-interactive** file your client opens in any browser (they can collapse/expand, zoom, and pan — no app required; their tweaks persist in that file's local storage). **Export PDF** prints the current view to one page sized to the tree. **Export PNG** writes the same thing as a plain image, for slides and documents that won't place a PDF — the whole diagram at its natural size, not a screenshot of what happens to be on screen. **Export to Miro** pushes the diagram onto a Miro board as real, movable shapes — see [Send the sitemap to Miro](#send-the-sitemap-to-miro).

- **Treemap** (toolbar **Treemap**, next to Visual Sitemap) shows the same content as space-filling boxes sized by page count — good for "how much of the site is what" at a glance. Pick **Depth** and **Color by** in a small dialog, then **Generate**; there's no live in-webview settings panel here, so changing either means reopening the dialog. **Depth** rolls deeper levels up into the box above them — Depth 2 shows each top-level section broken into its direct children; **Unlimited** shows the real tree at whatever depth it actually goes. **Color by KKE decision** (each box's dominant Keep/Kill/Evolve/Consolidate/Exclude call, with the composition percentage) or **top-level section** work at any depth; **Phase**, **Node Type**, **Page Status**, **Build Pattern**, or an **assignee** role are only offered at **Unlimited** depth, since a rolled-up box has no single value to report for those.

    *Which* colors get used, though, is yours to set, and that does live in the view. Open the **Legend** and every entry has a color well next to it — change **Keep**, or a section, or a Page Status, and every box in that category follows. **Right-click any box** to override just that one, which is what you want when a client deck needs one section called out. **Reset colors** puts everything back. Your palette saves with the project and is kept per coloring mode, so the colors you chose for the section view don't disturb the KKE view; it also carries into every export. (Only leaf boxes are recolorable — a box with visible children inside it is structural chrome, not a category.)

    Pan/zoom/Fit, a legend, and the same **Export HTML** / **Export PDF** / **Export PNG** / **Export to Miro** as the Visual Sitemap.

- **Content Flow** (toolbar **Content Flow**, next to Treemap) is the migration itself as a flow diagram: where the content is now on the left, where it ends up on the right, and every band's thickness a page count. Three readings, toggled inside the view:
    - **→ Decision** maps the current site straight onto its decisions — Keep, Kill, Evolve, Consolidate, Exclude, and any states you've added yourself, each with its own block in the color you gave it. Pages nobody has reviewed collect in an **(unreviewed)** block, so the diagram doubles as a picture of how far the audit has got.
    - **→ New sitemap** answers *"where did this section's content go"*.
    - **→ Decision → New** shows both at once, and is usually the version worth putting in front of a client: it makes plain that you're not just moving pages, you're deciding about them.

  Bands color **by decision** or **by source**; hover any band or block to isolate its flow.

  The three endpoints on the right that aren't sitemap sections are the honest part: **Retired** (Kill), **Out of scope** (Exclude), and **Not yet placed** (no sitemap home yet). On most audits one of those is the biggest block on the diagram, and a flow chart that quietly omits the content going nowhere is worse than no diagram. **Consolidated** pages flow *through* to whatever section their master page lands in — the URL dies but the content survives, so it counts as arriving, with the band still colored as Consolidate — and chained consolidations resolve all the way to the end of the chain.

  Current-site sections come from the **URL path**, not from where a page has been placed (otherwise every placed page would flow from `Academics` to `Academics` and the diagram would show nothing). Shared path prefixes are stripped per host, so a crawl rooted at `alpha.edu/college/…` doesn't collapse into one bucket, and a locale prefix is stepped past so the columns read as sections rather than `Es / De / Zh-Hans`. A small dialog up front picks how deep that axis goes — top-level by default, or 2–3 segments to split `/academics/programs` from `/academics/advising` — and which reading to open with. Pan/zoom/Fit, a legend, and the same **Export HTML** / **Export PDF** / **Export PNG** / **Export to Miro**. Every export renders **the view you're currently looking at**, toggles and coloring included, and the exported HTML opens on that view with all the other readings still available — so the client gets everything without the app.

    On a **Miro board** the flow becomes blocks and weighted connectors, because Miro has no ribbon shape. The reading survives — what exists, how big each block is, what connects to what, in what color — but a band's thickness is Miro's own 1–24 stroke scale rather than the exact proportion drawn on screen, and blocks are given a minimum height so their labels fit. Treat it as the workshop version, and the PDF or PNG as the faithful one.

  > **Consolidating several sites into one?** A left column of current-site *sections* gets unwieldy fast — five sites with a dozen sections each is sixty blocks, which is more than the diagram can draw legibly. So whenever your audit covers more than one source site, a **Source site / Current section** selector appears at the left of the toolbar, and **Source site** leads by default. That's usually the question worth asking anyway: *which site is contributing what, and where does it land* — four or five blocks instead of sixty, and the merge shows up as several sites' bands converging on one new section. When you open the dialog, any in-scope site still named after its domain gets a rename box right there — worth thirty seconds, because that name labels a whole column of something you'll show a client, and "Beta College" reads better than "beta.edu". You can skip it; the names are editable any time in **Project Settings → Sites**, which is also where you say which hosts belong to which site, record each one's CMS and owner, and mark a site out of scope. Renaming a site updates every page's **Source Site** automatically. (On a single-site audit there's nothing to ask — the site never appears as a block, and the diagram is titled from the client and project names on **Project Settings → Identity**.) Sites you've marked out of scope are left out entirely (you'll see a note saying how many rows that was), and section names are qualified by site (`Beta College › About`) so two sites' `/about` can't quietly merge into one. A site served from both `www.` and a subdomain still counts as one site. If a column is still crowded, sections past the top 20 group into a single **Other** block — the totals still add up, and a note tells you how many were folded.

  > **Taming a big tree — collapse repeating patterns.** On a large site, whole branches repeat the same shape (every academic department has Overview / Faculty / Programs / Contact). Showing all of them is noise. Best practice: for any branch whose children follow a content pattern, **pick the best representative and leave it expanded** to show the pattern in full, then **collapse** the rest by clicking their **+/−**. The collapsed siblings still appear as single boxes with a "more underneath" stack, so the structure stays honest while the diagram stays readable. **Collapsing/expanding here is the same setting as the node's `Collapse` checkbox in the sitemap** — they stay in sync both ways: a node checked **Collapse** starts collapsed every time the sitemap opens, and collapsing a node in the sitemap ticks its checkbox (and is saved with the project). So you can shape "what's collapsed by default for the client" right in the diagram.
- **IA & coverage reports:** the **Visual Sitemap** (above) for structure, plus **Reports → Sitemap Coverage Report…** and **Reports → Net New Content Brief…**. *(The hand-off report of the navigation itself is now the **Menu Report**, in the Menus view.)*

To resolve pages that landed on the same node, see the Consolidation Candidates workflow in [Consolidate](#9-consolidate).

### Quick self-check

- [ ] **need placement = 0** — every Keep/Evolve page sits on a node
- [ ] No **empty** leaf nodes left unexplained
- [ ] No **duplicate Sitemap_ID** warning, and no red duplicate-slug highlights
- [ ] Out-of-scope work is **phased**, and net-new sections are intentional

### Going deeper

#### Assigning a page from the audit bar

Select a row and click **Sitemap** to open the picker. Cascading dropdowns drill to the node — the slug is auto-detected from the URL (and editable), and the parent is auto-suggested from the URL's hierarchy. **Assign** populates `Sitemap_ID`, `Sitemap_Destination` (the breadcrumb), `Computed Path`, and `Sitemap_SortID`. **+ Child** creates a sub-node with its number, ID, sort order, breadcrumb, and path all calculated for you, and **Remove** clears the assignment. If the sitemap has no nodes yet, the **Sitemap** button instead offers a short inline form to create the first root node and assign the page in one step.

#### The node editor

Double-click a label (or click **✎**) for the full editor. It shows read-only context (number, ID, parent, breadcrumb, computed path, page count) and editable Label, Slug, **Collapse** (folds the node's subtree in the Visual Sitemap), External URL, **URL override**, **Phase**, **Notes**, and **Node type** — plus the **Build / Write / Migrate** sections covered in [Build & Direction](#14-build--direction). The breadcrumb and path preview live as you type; **Esc** cancels and **Cmd/Ctrl+Enter** saves; and the **← / →** arrows walk the tree in order (saving first) so you can annotate node after node. A node with notes shows a small `·` and reveals them on hover.

> **URL override — when the address shouldn't follow the menu.** Normally a page's URL is built from its place in the tree (`Company > Careers` → `/company/careers`). Sometimes you want the page grouped one way in the navigation but published at a different address — e.g. listed under *Company* in the menu but living at `/careers`. Type that path into **URL override** and the page's URL ignores its ancestors. It's an absolute path from the site root, and it **re-roots the page's sub-pages too**: an override of `careers` on a section makes a child *Open Roles* resolve to `/careers/open-roles` regardless of where the section sits in the menu. Leave it blank to follow the hierarchy as before. Overridden rows show a `↪` next to their path in the tree, and the stats bar tallies how many overrides are in play. Everything downstream — redirects, the Migration Tracker's target URLs, consolidation targets — uses the overridden address automatically.

> **Breadcrumb parent — an arbitrary breadcrumb top.** The trail shown *on the page* is a third, separate axis: it need not match the menu hierarchy **or** the URL. By default a page's breadcrumb walks its physical ancestors, but you can set its **Breadcrumb parent** to *Breadcrumb root* (the trail starts at this page) or to *any other node* (the trail re-roots onto it). Classic case: the Department of Accounting page lives deep under `College of Business > Departments` in the tree, but should read simply **Home > Accounting** on the page — set Accounting's breadcrumb parent to *Breadcrumb root* and it collapses to that, while its own sub-pages inherit the new root (e.g. *Faculty* → **Home > Accounting > Faculty**). The optional **Breadcrumb home label** and **Breadcrumb max depth** live in **Project Settings → Identity**: the home label (e.g. "Home") is prepended to every trail, and the max depth is an advisory flag — nodes whose breadcrumb runs longer get a `⚠` in the tree and a tally in the stats bar, so you know where to plant a root. The node editor shows a live **Page breadcrumb** preview as you set this. (This is display-only — it never changes the URL or the menus.) The rendered page breadcrumb is carried into your deliverables: it's a **Page Breadcrumb** column in the Migration Tracker's Sitemap Plan and the Sitemap's column-picker export, and it travels with each referenced page in the menu export.

#### Deleting nodes

The **✕** (hover a row to reveal it) always confirms first, showing the breadcrumb so you know exactly what you're removing. If the node has children, you choose **Promote children** (delete just this node, children rise to its parent) or **Delete all** (the whole branch). If pages are assigned, you choose **Reassign to parent**, **Reassign to another node…** (a search picker), or **Clear assignments**. Every reassignment is logged, and every delete — single or bulk — is undoable with **Cmd+Z**.

#### Selecting and deleting nodes in bulk

Each row has its own checkbox at the left, next to the node number. Click one to select it; **Shift+click** another to select the whole visible range between them (rows hidden inside a collapsed branch are never swept in); click the checkbox in the column header to select every node currently visible. A bar appears above the tree once anything is selected, showing the count and **Delete Selected…** / **Clear Selection**.

**Select Empty Branches** (in the toolbar) finds every branch with zero assigned pages anywhere in its subtree and checks them for you — the fastest way to spot-clean a tree after reorganizing, without hunting for empty leaves by eye. It won't also select an empty branch's children individually; deleting the parent already takes the whole thing.

**Delete Selected…** always deletes the full subtree of each selected node and clears any assignments on pages underneath (pages return to the audit, not deleted — just unassigned). If you'd selected both a node and one of its own descendants, only the ancestor is deleted; the descendant would have gone with it anyway. One confirmation covers the whole batch, and one **Cmd+Z** undoes it — however many nodes it covered.

> **Building a "current state" sitemap** (see [Placing many pages on the sitemap at once](#placing-many-pages-on-the-sitemap-at-once)) routinely leaves branches empty once you start killing or consolidating pages in your forward-planning copy. **Select Empty Branches → Delete Selected…** is the fast way to clear that debris as you go.

#### The editor's columns and drag behavior

The columns are Node (number, toggle, label — it fills the width), Slug, Collapse, Computed Path, Breadcrumb, Pages, and Actions (✎ edit, **+** child, ⧉ clone, ↗ reference, external-URL link, ✕ delete — visible on hover); all are resizable. When you drag, the top/bottom third of a target row inserts before or after it (shown by a line indicator) and the middle reparents (shown by a blue left border). The dragged row fades to 35%, and the drop zone only activates after you've moved about 30% in, to avoid accidental drops. Moving a node carries its whole subtree, and all numbers, sort IDs, breadcrumbs, and paths recalculate. Fold state persists across edits.

#### Reading the Pages column

A link icon means an external URL, an arrow means a reference, **NEW** means net-new, an empty circle means an empty leaf, and a number is the page count (click it to expand). The **Menu Report** (Menus → Report) adds per-item badges: a page-count on each page reference, `↗` on an external link, `≡` on a header, and a red **missing** badge on a broken reference. These are purely informational — Transmission never blocks a save over coverage.

#### Colour rules in depth

Colour is the fastest way to make a sitemap *say* something. The rule engine lives in the Visual Sitemap's **Settings → Colors**.

**Card style.** Two conventions, toggled at the top of the tab. **Colour band** puts the colour on a strip across the top of an otherwise white card. **Heavy outline** leaves the card white and draws a thick coloured border — this is what most sitemap decks use, and it stays legible when the whole tree is zoomed out. Switching between them converts the rules you already have, keeping each one's colour, so it's a safe thing to try.

**What a rule can test.** Fifteen dimensions, from two places:

| Source | Dimensions |
|--------|------------|
| **The sitemap node** | Phase · Node Type · Page Status · Build Pattern · Builder · Writer · Migrator |
| **The spreadsheet** | Content Type · KKE · Final KKE · Renders as · Migration Track · Content Theme · Published Status · Target Content Type |

(Plus the structural ones: **Depth**, **Top-level section**, and **Links to another site**.)

Spreadsheet dimensions only appear if that column exists in the open file. And the **Colour by this** picker shows how many nodes actually carry a value for each one — `38/121`, or **no data**, in which case it's greyed out. So you can see at a glance which dimensions are worth colouring by, instead of generating a scheme and then wondering why it came out all one colour.

**Dominant value vs "any page is".** A sitemap node usually holds several pages, so there are two different questions you can ask of a spreadsheet dimension:

- The normal operators — **is**, **is not**, **contains**, **does not contain**, **is blank**, **is set** — test the node's **dominant** value: what its pages *mostly* are.
- The **any page is** operator asks whether **any** page under that node matches.

That second one is how you flag a section that merely *contains* something. `KKE any page is Kill` lights up a section holding one page marked Kill inside an otherwise Keep branch — which a dominant-value rule would never surface, because one Kill among twenty Keeps isn't the dominant value.

**Multiple conditions.** **+ Add condition** stacks conditions on one rule; *all* of them must match. A rule with no conditions matches everything — that's your catch-all, and it belongs last (new rules are inserted above it automatically, so it can't get stranded).

**Rules compose — this is the part worth understanding.** Rules are read top to bottom, but it isn't simply "first match wins and nothing else applies." Each visual property — **colour**, **fill**, **line style** — is claimed independently by the **first matching rule that actually sets it**. A rule that leaves a property unset doesn't claim it, so a rule further down can still supply it — line style has a "— leave unset —" option, and colour has a checkbox you can untick for the same purpose. That means you can encode two different dimensions at once, in separate rules, instead of writing a rule for every combination.

> **Worked example — colour by who's building it, line style by whether it's ready.**
>
> Say you have four builders and three page statuses. Encoding both in single rules would need one rule per *pair* — twelve rules, and a thirteenth the moment someone joins the team. Instead:
>
> 1. Add four rules — one per Builder — each setting a **colour** and leaving **Line style** on its "— leave unset —" option.
> 2. Add three rules — one per Page Status — each setting a **line style** (say Published → solid, In Progress → dashed, Not Started → dotted) and **unticking the Colour checkbox** so the rule claims only the line style.
>
> Seven rules instead of twelve, and adding a builder costs one rule rather than three. Every card takes its colour from the first group and its line style from the second.
>
> **Untick Colour on any rule that isn't about colour.** A rule with the Colour box ticked claims the colour of every card it matches, so a status rule that keeps its colour would recolour cards by status wherever it matched first. With Colour unticked the two groups are independent and their order doesn't matter.

**Line style** is per-rule: **solid**, **dashed**, **dotted**, or the "— leave unset —" option to let a later rule decide.

A node's own colour (right-click a card → **Set color**) beats every rule.

#### Reference picker and Visual Sitemap

The reference picker is a wide (880px) dialog, sorted hierarchically and indented by depth with top-level nodes in bold; a numeric search matches from the start (`2.2` finds 2.2.1) while a text search matches anywhere. The **Visual Sitemap** (see [See it and report on it](#see-it-and-report-on-it) above) draws the IA as an interactive box-tree with smart horizontal/vertical layout, an editable color-rule engine, collapse/expand, and interactive-HTML + PDF export.

#### The Sitemap sheet

Behind the editor, the `Sitemap` sheet (legacy name: `NavStructure` — older files are upgraded automatically on open) holds: **Number** (the dotted hierarchy like `1.1.2`), **Label**, **ID**, **Path** (slug), **SortID**, **ParentNumber**, **Computed Path**, and **Breadcrumb** — plus extension columns for the external `URL`, the `Url_Path` URL override, the `Breadcrumb_Parent` breadcrumb re-root, the `Collapse` sitemap flag, `Phase`, `Notes`, `Node_Type`, `InMenu` (legacy), the reference, and the build-metadata fields (Build Pattern, Page Status, the three assignees, Build Guidance, Writer Brief). The whole sheet is rewritten on save.

### Menus

The sitemap describes where content *lives*. **Menus** describe how people *get to it* — and those are not the same thing. A page can sit deep in the content hierarchy but appear in the top bar; the footer often groups links in ways that ignore site structure entirely; a "fly-out" or utility menu is frequently a curated junk-drawer of links that don't fit anywhere else. So menus are modeled as their own independent structures that *point at* your content pages, rather than being tied to the sitemap.

Open the **Menus** tab in the view switcher (or **Cmd+Shift+M**). On the left is your list of menus; on the right, the selected menu's contents.

- **Create as many menus as you need** — Primary, Mega, Utility, Footer, a search fly-out, whatever this client has. Names are arbitrary. **Drag the menus** in the left list to reorder them.
- **Seed from content tree** opens a small dialog: pick a starting **branch** of the content tree (or all top-level sections) and a **depth**, name the menu, and it mirrors that subtree as page references — then you edit it freely, independent of the tree.
- Each menu carries two bits of context: a **Placement** (a per-project controlled vocabulary — Top bar, Footer, Overlay / Fly-out, etc. — add your own with "+ New…") and a free-text **Description** for the "what the heck is this and how does it behave" note that helps both you and the client.
- **Add three kinds of item:** **+ Page** references a content page (search and pick it; it shows the live label and target path, and flags the reference if that page is later removed), **+ Link** is an external/utility URL like a login, and **+ Header** is a label-only heading for grouping (footer columns, mega sections). These toolbar buttons always add at the root — change an item's kind anytime with the little **page / link / header** dropdown on its left.
- **Drag the ⋮⋮ grip** to reorder items or nest them — drop onto the top/bottom third of a row to place it before/after, or the middle to nest it inside. Each menu can be flat or as deep as you like. The item toolbar stays pinned at the top of the panel as you scroll a long menu, so it's always in reach.
- **Add a child directly** — hover any item and click its **+** to add a Page/Link/Header right under it, no drag required afterward. Click its **⧉** to duplicate that item and everything nested under it as a sibling, ready to edit into a variant elsewhere in the same menu.
- The same page can appear in **as many menus as you want**, at any depth — referencing it in the footer doesn't remove it from the primary nav.
- **Duplicate menu** clones the selected menu — name, placement, description, and the whole item tree — as a fresh copy you can edit into an alternate variant without disturbing the original. Handy for testing two paths (e.g. a different mega-menu structure) to review with a client side by side: duplicate, adjust the copy, then use **Export…** with the "just this menu" scope (pre-selected on the new copy) to hand over only that variant.

Menus travel with the file (both `.transmission` projects and `.xlsx` exports), so they're saved alongside everything else.

**Seeing a menu as a diagram.** The toolbar's **Sitemap** button draws your menus using the same interactive engine as the **Visual Sitemap** (see [See it and report on it](#see-it-and-report-on-it)): each menu is one tree, stacked under its name, with items colored by kind (page / link / header) and headers shown with a dashed border. Everything from the Visual Sitemap applies here — collapse/expand, smart horizontal/vertical layout with right-click per-node overrides, the **Settings** panel (Layout / Colors / Legend), zoom/pan/Fit, and **Export HTML** (interactive, client-shareable) / **Export PDF**.

**Catching broken references.** Because menu items point at content pages, deleting or renumbering a page can leave a menu item dangling. Any broken item shows `(missing page)` inline, and the toolbar surfaces a red **⚠ N broken refs** button whenever any exist — click it to see them all and either **Re-pick** the page or **Remove** the item. Worth a quick check before you export for handoff.

**A tidy hand-off report.** The toolbar's **Report** (also **Reports → Menu Report…**) produces a polished, readable document — one section card per menu with its full item hierarchy, a page-count badge on each page reference, `↗` on external links, `≡` on headers, and a red **missing** badge on any broken reference. Export to PDF or HTML. This is the report to hand internal colleagues or a client when you want them to *read* the navigation rather than import it.

**Exporting menus for a build team.** The toolbar's **Export…** produces a *CMS-agnostic* deliverable — a neutral, structured description of your menus that any platform's import can map from (it deliberately doesn't bake in any one CMS's model). Choose **all menus or just the selected one**, and a format: **Excel** (a flat, readable `Menus` sheet — one row per item with its depth, label, kind, and resolved target URL) or **JSON** (the same data nested, for a developer to import programmatically). Page references resolve to their target URLs automatically. A Contentful, WordPress, Drupal, or AEM team each maps the same file onto its own navigation; if a client ever needs a platform-native file, that's a thin add-on on top of this neutral export.

---

## 14. Build & Direction

*By the end of this section you'll have turned a placed tree into work three people can pick up and execute — the builder who constructs each page, the writer who fills it, and the migrator who maps the old content in.*

> **In a hurry?** The [Build & Direction walkthrough](walkthroughs/14-build-direction.md) is the one-page version.

### The mental model

Every build node carries direction for **three roles**: the **Builder** (constructs the page), the **Writer** (writes its content), and the **Migrator** (maps source content into the new CMS).

That direction lives at **two levels**. Type-level defaults sit on the **Target Spec** — write the guidance once per spec, and every node built from it inherits it. Node-level briefs then override or extend that, page by page. A spec is either a **Page Template** (a full page layout) or a **Content Model** (an embeddable fragment or data shape, with a field schema).

The payoff: you don't write a brief on every page. Write one reference per spec (or on a representative node) and let the rest follow — the reports handle this gracefully, with no "missing brief" nagging.

### Build the Target Spec Library

Open **Project → Target Spec Library…**, seed the 12 defaults, then fill each spec in:

- **Kind** — Page Template or Content Model.
- **Description**.
- **Build guidance default** — standard build notes, for the Builder.
- **Writer brief default** — standard content brief, for the Writer.
- **Migration mapping default** — the source → target field map and gotchas, for the Migrator (it applies even to scripted content).
- **Fields** — the field schema, shown only for Content Models.
- **Default Migration Track** and **Notes**.

> **Heads-up:** specs are matched by **exact name**, and reports group by spec name — so a typo splits a group. Keep names consistent.

### Annotate each node

Open a node's editor; below its Migration notes are three sections, one per role:

- **Build** — pick a **Pattern** (a spec), set the **Page status** and **Builder**, and add page-specific **Build guidance**.
- **Write** — set the **Writer** and the **Writer brief**.
- **Migrate** — set the **Migrator**. There's no per-node migrate brief; the field mapping lives on the spec's Migration mapping (note per-page exceptions in Migration notes).

Picking a Pattern fills any **blank** Build guidance or Writer brief from that spec's defaults. If a field already has content, a **Keep / Append / Replace** dialog opens per field, so your writing is never silently overwritten. The editor's **← / →** arrows move you through nodes without closing it.

> **Tip:** for a run of similar pages, set the same **Pattern** (plus Status and assignees) on all of them, but write just **one** brief — on the spec, or on one representative node. The Migration Direction Brief shows that one as the reference and lists the rest under it.

### Manage the vocabularies

The **Project Settings → Migration** tab owns the two controlled lists these fields draw on:

- **Page Statuses** — the build-lifecycle labels (color, rename, reorder, delete). Renames and deletes cascade across every node using them.
- **Assignees** — one shared pool for Builder, Writer, and Migrator, with usage counts and the same cascade behavior.

Both are also addable inline with **+ New…** right where they appear.

### Track the build

Once any node has a status, the stats line appends **status tallies** (`5 built · 3 in progress · 2 blocked`). Filter the tree with the toolbar's **Build** dropdown — by status, assignee, pattern, or guidance presence. And each row shows positive-only indicators when metadata is set: a colored status pill; small **P** (pattern), **G** (build guidance), and **W** (writer brief) circles; and 🔧 builder / ✎ writer chips. Rows with no metadata stay clean.

### Produce per-person worklists

**Reports → Migration Direction Brief…** turns all of this into a worklist for one person:

1. Pick the **Role** — Writer, Builder, or Migrator.
2. Pick the **Person** from the shared assignee pool.
3. Optionally pick a **Template** (custom Markdown templates live in *Documents → Transmission → templates*; **Built-in default** needs no setup).
4. **Generate**, then export **PDF** or **HTML**.

The report groups that person's pages by spec, leads each group with the reference direction (the spec default plus any page-specific briefs), and lists the rest as followers. Under each sitemap node it also lists the **source page(s)** currently assigned to it; if other pages are being **consolidated into** one of those pages, that page gets a **merges N** flag so the writer knows the new page is absorbing content from N old ones. The summary line totals the consolidations folded in.

### Hand off

When the nodes are annotated, two commands carry the work to engineering: **Migration → Migration Tracker…** ([Migration Tracker Hand-off](#17-migration-tracker-hand-off)) and **Migration → Pre-Handoff Check…** ([Pre-flight & Hand-off](#18-pre-flight--hand-off)).

### Quick self-check

- [ ] Every build node has a **Pattern**, and each pattern has a default brief (or one reference page does)
- [ ] **Builder / Writer / Migrator** are assigned wherever work is owned
- [ ] **Page status** reflects where the build actually is
- [ ] Content Models have a **field schema**, and every spec has a **Migration mapping**
- [ ] Fragments are typed as **Fragment**, not left as standard pages
- [ ] You generated the **Migration Direction Brief** for each role and person

### Going deeper

**Why the migration mapping lives on the spec.** Authoring it once per spec is what lets thousands of scripted records share a single mapping — nobody edits 5,000 News records by hand. The 12 curated defaults (Hub Landing, Article, Faculty Profile, Program/Degree, Department, Event, Form Page, and more) seed from a banner the first time you open a project that has a sitemap.

**The node's build fields, in full.** Beyond Node type and Pattern, a node carries Page Status, Builder, Build Guidance, Writer, Writer Brief, and Migrator. The markdown fields (Migration Notes, Build Guidance, Writer Brief) each have a formatting toolbar, and **Cmd+B** / **Cmd+I** work inside them.

**Fragments.** Setting a node's **Node type → Fragment / shared content** marks embedded content: it keeps a computed path as a repository location but has no menu entry, breadcrumb, or redirect, sits outside the hub/empty/net-new counts, and shows a **FRAG** badge.

---

# F. Ship it

## 15. Redirects

*By the end of this section you'll have a clean redirect map — every URL that's going away pointing somewhere sensible — so the migration keeps its SEO equity and doesn't break anyone's bookmarks.*

> **In a hurry?** The [Redirects walkthrough](walkthroughs/15-redirects.md) is the one-page version.

### The mental model

A redirect is needed for any **Kill** page and any page whose **URL is changing** (its new computed path differs from its current URL); Consolidate pages redirect to their target. You rarely set destinations by hand — Transmission resolves them by a priority order and can re-derive them from the tree on demand. That order, highest first:

1. A custom destination you typed or picked for the row
2. The page's sitemap node path
3. The project's default redirect destination
4. Blank — meaning the page is retired and will 404

One special value matters: the literal **`404`** means "let this URL die honestly — write no redirect rule," which is different from a blank destination (still to be decided).

### Open the Redirect Editor

Open it from the **Redirects** tab or **Cmd+Shift+R**. It lists every page that needs a redirect — Kill pages and URL-changed pages — each showing its KKE badge, its title (click to jump to that row in the audit view), the current URL, an editable destination, and a sitemap picker. Fragments are left out automatically, since they have no public URL.

### Set destinations efficiently

- **Re-derive from sitemap** recomputes destinations from current sitemap paths for every row with a sitemap assignment, plus unplaced Kill/Consolidate rows whose destination the app derived (from a consolidation target or an inherited 3xx). It skips any explicit `404` and any destination you typed or picked yourself. Run it after you've reorganized the sitemap or changed the Site Domain.
- The per-row **sitemap picker** points a single redirect at a specific node.
- The **404 toggle** marks a row as an intentional 404.
- **Find/Replace** opens a bar that *filters the list* to matching destinations (exact-match optional) and can **Replace All** across them — ideal for domain or path-prefix sweeps.

Destinations also resolve automatically on **Save**, so the editor is for review and overrides, not a prerequisite for a correct export.

### Validate the chains

**Migration → Redirect Chain Check…** covers two things: redirects that point at another page being killed (repoint those to a live destination), and every **inherited redirect** in the crawl. The same check runs as part of the [Pre-flight check](#18-pre-flight--hand-off).

### Inherited redirects — the 3xx rows in your crawl

A 3xx URL isn't a page, it's a redirect rule the live site already has. Triage sets those to `Kill` and copies in the destination the crawl recorded — and from then on **the app re-derives that destination on every save**. That matters more than it sounds: if `/old-nursing` currently redirects to `/programs/nursing`, and you later move that page to `/academics/nursing` in your sitemap, the inherited rule follows it. You don't have to go back and fix redirects every time the tree changes. The same applies if the target gets consolidated into another page, or is retired to a 404. A chain on the live site (A → B → C) collapses to a single hop, so no rule you ship lands on a URL that is itself being retired.

Your own typed destinations are never touched by any of this — a redirect you set by hand stays exactly as you left it.

What the app **can't** decide for you gets grouped in the report, and the sidebar's **Inherited redirect needs review** filter is the worklist:

| Group | What it means | What to do |
|---|---|---|
| **No destination recorded** | The crawl found a 3xx but captured no target. | Give it a destination, or let it 404. |
| **Redirects to itself** | The rule resolves back to its own URL. | Always wrong — repoint or retire. |
| **Destination is a dead URL (4xx)** | It redirects to a page that's already gone. | Retire it (destination `404`) or repoint. |
| **Destination has no KKE decision yet** | It points at a page in your audit that nobody has ruled on. If that page turns out to be Kill, this rule points at nothing. | Decide those pages. The redirects re-derive themselves afterwards — you don't come back here. |
| **Destination is being retired with nowhere to go** | It points at a page marked Kill with no redirect of its own, or Consolidate with no target picked. | Finish the destination page's decision, or repoint the rule. |
| **Destination not in this crawl** | The target is on a site you're migrating but wasn't crawled, so the app can't confirm it survives. | Widen the crawl, or confirm by hand. |
| **Destination is on an out-of-scope site** | Nobody is maintaining the thing it points at. | Confirm you still want to send traffic there. |
| **Destination is off-site** | Points at another domain entirely. | Nothing to resolve — carried forward verbatim. Listed so you can confirm it. |

That "not in this crawl" versus "off-site" split is the one worth reading carefully. Both are destinations the app can't resolve to a row, but one is a gap in your data and the other is completely normal.

**Why "no KKE decision" and not "not placed on the sitemap"?** Because plenty of migrations keep every URL exactly as it is — the new CMS re-uses the existing paths and nobody builds a sitemap at all. In that project *nothing* is placed, so a placement-based warning would fire on every single row and mean nothing. Whether a page is placed depends on how you work; whether it has been decided does not. So the check asks the question that holds either way: **is there a page here that we've committed to keeping?**

This is also the one group you can clear without touching a single redirect. Decide the destination pages and the rules re-derive themselves on the next save.

### Check the redirects still agree with the sitemap

**Migration → Redirect Health Check…** answers a different question: not "does this destination work" but "does it still match where the sitemap says the page is going". Redirects are derived from the sitemap, but the app can't tell a destination *it* wrote from one *you* typed — so once a value exists on a Keep or Evolve page it is never revisited. Reorganize the tree, or build a sitemap and delete it, and the old destinations quietly survive.

It sorts what it finds into groups, each with the full list of affected pages:

- **Pages redirecting to themselves** — a loop. Always wrong, whatever the page's decision.
- **Not on the sitemap, but carrying a redirect** — a Keep/Evolve page with no placement isn't moving, so it needs no redirect. Usually the largest group, and the one nothing else finds.
- **Redirect disagrees with the page's sitemap node** — re-pointed at the node.
- **Placed where it already lives** — the node's path *is* the page's current URL, so the redirect is cleared.
- **Worth a look — left alone** — the destination is a real node in your sitemap, so it may well be a deliberate choice (sending a page to its parent, say). Reported, never changed.

Tick the groups you want repaired and apply: the whole repair is a **single Cmd+Z**. Blank destinations and intentional **404**s are never touched, and pages on sites you've marked out of scope are skipped.

> **If your file went through a "current state" sitemap**, this is the tool that cleans up after it — and [Showing the current state](./RUNNING_AN_AUDIT.md#showing-the-current-state--do-it-in-a-copy) is how to avoid needing it next time. A per-class count also appears in the Pre-Handoff Check.

### Export the map

- **Migration → Export Redirect Map (CSV)…** writes the rules as CSV for engineering.
- **Reports → Redirect Map Report…** is the human-readable version. It is built from the same rules as the CSV, so the two always agree. It lists the pages that **still need a destination** first, then redirects for removed pages, consolidated pages and pages whose URL changes, then intentional 404s. It also warns about redirect chains, and splits the rules by source site on a merger. Long lists stop at 200 rows. Deploy from the CSV or the Migration Tracker, not from the report.

### Quick self-check

- [ ] Every Kill / URL-changed page has a destination (or an intentional **404**)
- [ ] You ran **Re-derive from sitemap** after the tree was finalized
- [ ] The **Redirect Chain Check** is clean — no redirects into Kill/404 pages, and no inherited redirect left in an actionable group
- [ ] The **Redirect Health Check** is clean — no loops, orphans, or destinations that contradict the sitemap
- [ ] Intentional 404s are marked, not left blank
- [ ] The redirect map is exported

### Going deeper

**The columns.** Status (a KKE badge or "URL Changed"), Title (click to open the audit row), Current URL, the **→** arrow, the editable Destination URL, and the **🗂** sitemap picker. The toolbar adds a status filter, a text search, and sortable columns that cycle ascending → descending → none.

**Setting a destination.** Type any URL (including a cross-server one), pick a node from the sitemap (a 600px dropdown anchored to the right), or leave it blank to be resolved on save. The **default destination** and **site domain** live in Project Settings; changing the domain rewrites destinations that used the old one. On save, `Redirect_Destination` is filled from the priority chain above — there's no homepage fallback, so a blank means the page is retired and will 404.

**How Re-derive decides.** Kill and Consolidate rows take the sitemap computed path; Keep/Evolve rows update only when the URL is actually changing; rows with an explicit `404` are always skipped; and rows with no sitemap assignment are left alone. Every result is visible in the editor before you save, so you can review or override.

**A couple of conveniences.** Opening the editor from a page auto-scrolls to that page's row with a brief highlight. And the exported CSV carries four columns: Source URL, Destination URL, Status Code (`301`), and a Reason.

---

## 16. Producing the Outputs

*By the end of this section you'll know which report answers which question — and how to produce the deliverables your stakeholders and build team actually need.*

> **In a hurry?** The [Producing the Outputs walkthrough](walkthroughs/16-producing-the-outputs.md) is the one-page version.

### The mental model

Reports are read-only views, generated on demand from the current file — run them as often as you like. Every one exports to **PDF** or **HTML** (and the HTML opens cleanly in Word). They fall into three audiences, which is also how the Reports menu is grouped.

### For stakeholders

- **Executive Summary** — the top-line story: the content inventory, the KKE distribution, auto-generated key findings, SME status, and a section breakdown. Lead a client readout with this.

  **It counts content pages, not crawled URLs, and the difference is usually large.** A crawl lists every URL that *responded* — including every inherited 301 and every dead link. Reporting those as pages invites the one question you don't want mid-readout: *"we're really migrating twelve thousand pages?"* So the Overview leads with `URLs crawled`, breaks out **existing redirects (3xx)** and **not found / gone (4xx)**, and then gives **content pages audited** — and every figure below it, including the Kill percentage, is over content pages only. On a real higher-ed crawl that moved the headline "recommended for removal" figure from 66% to 31%; the first number was mostly redirects.

  A 5xx still counts as content — a broken page is a page, and it's work you'll be doing. Nothing is hidden: the non-content rows are named, counted, and still in the audit. **By Section** counts content pages too, so it adds up to the content total rather than to the crawl. If a section is missing entirely, check whether its site is marked out of scope — those rows are excluded from every figure in the report, and the banner at the top says how many.

  To see the rows behind the numbers, use the sidebar's **Existing redirect (3xx — not content)** or **Not content (3xx or 4xx)** filters.
- **Content Inventory by Section** — content pages by section. One ranked table shows every section's size and the share of each decision. Then a closer look at the ten largest sections: KKE distribution, a few sample pages, and notes counts. Your detailed appendix. Its section counts are the same as the Executive Summary's By Section.
- **SME Review Status** — where expert review stands: overall completion plus a per-Content-Owner table (assigned, reviewed, %, approved vs changed, unresolved conflicts) and a conflict list.
- **Audience Coverage** — per audience in priority order: how many pages serve them, how many treat them as the *primary* audience, what you're doing to that content, and which sections it lives in. Flags any Primary-tier audience with almost nothing aimed at it, usually the most actionable finding in the set. A **Risks** section (formerly the separate Audience Debt report) counts:
  - pages serving only non-priority audiences
  - pages reviewed as serving no audience
  - Primary-audience pages marked **Kill** (re-read these before signing off the redirect map)
  - **detail** pages serving four or more audiences

  Only detail pages count toward that last one. A landing page serving four or more audiences is normal: a program landing page can rightly serve prospective undergraduates, graduate students, executive-education seekers and certificate seekers at once. So a page is only counted when nothing sits beneath it in the sitemap or its URL path, and even then it's worth a look, not a defect. The page-by-page lists are in the audit-team appendix.
- **Audience × Section Matrix** — sections down, audiences across. Each cell is shaded by its share of the section's *tagged* pages, and an **Untagged** column shows what's left to tag. The 40 largest sections are shown. The single most persuasive artifact here: it makes "this entire section is written for the wrong people" visible in one glance, and it argues IA changes rather than page-by-page ones.
- **Site Consolidation Overview** — for audits merging several sites: what each source site contributes (pages, disposition mix, audiences served, how much of it duplicates another site, how many redirect rules retiring it needs). A site that is mostly overlap and serves no audience the others don't is a candidate to retire wholesale rather than migrate page by page.
- **Cross-Site Duplicate Overlap** — pages whose title, H1 and meta description are identical across two or more source sites. Each set collapses to one surviving page: pick the master, mark the rest **Consolidate** pointing at it, and the redirect map writes itself. Exact-match only, so treat it as a floor rather than a ceiling.
- **Jobs Coverage** — per job: how many pages serve it, what you're doing to them, and the page you'd send someone to. Leads with the jobs **nothing answers** — the strongest brief for net-new content, since each traces back to the client's own workshop.

### For information architecture

- **Menu Report** — one section card per menu with its item hierarchy, page-count badges on page references, `↗` on links, `≡` on headers, and a red **missing** badge on broken references. Also available as **Menus → Report**. A tight hand-off doc for colleagues and clients.
- **Sitemap Coverage Report** — the gap-finder. It lists kept pages that still need a place, net-new nodes, empty nodes, crowded nodes (more than 5 pages) and URLs that change. Its net-new and empty counts use the same definitions as the Sitemap tree's NEW and ○ badges.
- **Content Type Crosswalk** — one row per current type → renders → target type → target spec → migration track, with page volume and KKE breakdown, flagging any type with no crosswalk.
- **Component Inventory** — the UI-component picture (see [Component Inventory](#20-component-inventory)).

### For the build and engineering team

- **Migration Direction Brief** — per-person worklists for the Writer, Builder, or Migrator, grouped by spec and led by the reference direction (supports custom templates — see [Templates](#19-templates)).
- **Migration Checklist** — the migration on one page: a ready / not-ready headline, what happens to the pages (every decision, custom states included), redirect totals, and new pages to write. It points you to the Redirect Map Report for the rules and the Pre-Handoff Check for the blockers, rather than repeating them. The list of pages to update is in the audit-team appendix.
- **Net New Content Brief** — the hand-off to writers, grouped by writer and then by section. It lists section landing pages whose sub-pages exist, new pages nothing on the current site maps to, and placeholder pages still to be written. Each shows its status, template and writer brief, and it flags pages with no writer or no brief. It ends with the jobs no page answers.
- **Build Status** — the weekly progress view. It shows every page of the new site by **Page Status**, broken down by section and by person (builder, writer, migrator), with the blocked pages listed. Pages with no status yet are in the audit-team appendix. It leaves out headers, phased nodes, external links and aliases.
- **Redirect Map Report** — the same rules as the redirect CSV. It gives totals by type, the pages that still need a destination, chain warnings, a per-site split, and tables capped at 200 rows.

### Export them

Every report preview has **PDF** and **HTML** buttons. Choose HTML when the client wants to drop it into Word or a doc; PDF for a fixed deliverable.

Most reports open with **Key findings** and **Next steps**: what the numbers below mean, and what to do about them. Some also end with a marked **For the audit team** appendix of page-by-page working lists, such as untagged pages or pages still needing a place. The appendix is left out of exports unless you tick **Include audit-team appendix in export** next to the export buttons. It starts unticked every time, so the default export is the client version.

### Send the sitemap to Miro

A PDF is something a client reads. A Miro board is something a client can *work on* — which is what you want when the sitemap is going into a workshop and people will be moving boxes around and arguing about where things belong. **Export to Miro** puts the Visual Sitemap onto a Miro board as real, editable Miro shapes, not a flat picture.

#### Connect to Miro (one time)

Open **App Settings** (**⚙**) and find the **Miro** section:

1. Click **Connect to Miro**. Your browser opens, you authorise Transmission, and you pick **which Miro team to connect**.
2. Return to the app — that's it. The connection persists, so you only do this once.

Your token is stored **encrypted using the OS keychain**, deliberately *not* in the ordinary preferences file, and it's never readable by the app's interface layer. Once connected you get **Test connection** (confirms the token is live and lists the boards it can see), **Verify write access**, and **Remove**.

> **A connection is scoped to one Miro team.** That's how Miro's tokens work, not a limitation of the app. If you work across two teams, connect once per team — reconnecting swaps which team you're pointed at.

> **Advanced: paste a token from your own Miro app.** Tucked under the Connect button is a fallback for anyone who'd rather not use the connect service, or needs it when that service is unreachable. It means creating your own app in Miro (**Profile settings → Your apps → Create new app**), ticking the `boards:read` and `boards:write` scopes **before** you install it — the token is minted with whatever scopes are selected at install time — and pasting the resulting OAuth token. Most people never need this route.

#### Export

**The Treemap and Content Flow export to Miro too**, from their own toolbars, with the same board picker and the same "export again to the last board". Their dialog is shorter — board choice plus **Include a color key** — because the extra appearance controls below describe a box *tree* and have no counterpart in either. The Treemap goes across as its own rectangle packing; what the Content Flow can and can't carry is covered in [See it and report on it](#see-it-and-report-on-it).

In the Visual Sitemap toolbar, click **Export to Miro** (it sits alongside Export HTML, PDF and PNG). A dialog asks:

- **Where it goes** — three routes, because a work account can have thousands of boards:
  - **Create a new board** (pre-named from your client and project). Usually right — appending 400 shapes to a board someone else is working in rarely is. This is what most exports should use.
  - **Use an existing board** — **search by name** (the search runs on Miro's side, so it reaches every board you can see, not just a recent handful) or **paste a board link or ID** straight from your browser to land on one exact board. Either way the board's name is shown so you can confirm before exporting.
  - **Export again to *&lt;the last board&gt;*** — appears once you've exported this project to a board before, for a one-click repeat. It's remembered by the board's Miro **ID**, not its name, so it still finds the board even if you created it fresh (Miro names new boards "Untitled") and renamed it afterwards — the dialog shows its current name.
- **What to do about collapsed sections** — if any sections are collapsed, the dialog says how many pages are hidden and by how many collapsed sections, with **Include them (export the whole tree)** **off by default** — collapsed sections export as a stacked block unless you tick it (opt-in). When it's off, a second choice sets what the stacked block is labelled with — **the hidden page count**, or **just a +**. Your choice is remembered per project.
- **Appearance** — five controls, all remembered per project:
  - **Connector style** — Right-angle (the default and a match for the app's own sitemap) · Curved · Straight.
  - **Connector thickness** — **Match sitemap** (the default) uses whatever the Visual Sitemap's own **Settings → Layout → Connectors** is set to, including *By content volume*, so the board reads the same as the screen. The fixed choices — Thin · Medium · Heavy · Extra heavy — override that for one board, useful when a sitemap is going onto a wall and hairlines disappear at that size. These are whole-number widths on purpose: Miro's thickness slider only stops on whole numbers, so an in-between value renders as a barely-visible hairline.
  - **Card corners** — Rounded · Sharp/square. Also follows **Sitemap Settings → Layout → Corner radius** if you'd rather set it there — a radius of `0` gives square boxes. (Miro has no numeric corner radius, only "rounded shape" vs "square shape," so a rounded box shows Miro's own "Rounded corners: 0" field unused — that's expected, not a lost setting.)
  - **Border thickness** — Thin · Medium · Heavy, for how heavy the card outlines are.
  - **Include a color key** — adds a legend to the board (one labelled chip per color rule) so a client can read what each color means. On by default.
- **Deleting a board you didn't want** — when an export *creates* a board, the "Exported N pages…" message at the bottom of the window carries a **Delete board** button. It confirms first, and Miro moves the board to your team's **trash**, so it's recoverable there. It only ever appears for boards that export just created — never one you picked from the list or pasted a link to, since those may have other work on them. Ignoring it is fine; the message fades on its own. It lingers longer than a normal message and holds while your pointer is over it, because exporting opens the board in your browser and you'll usually be looking there when you decide.

> **A common workflow:** create a *new* board (nobody minds a fresh board getting 400 shapes), review it, then in Miro copy the pieces you want into the production board — or just promote the new board to production. Because Transmission remembers the board by ID, re-running the export after you've tidied and renamed it goes back to the same place. If the board turns out to be a dud, **Delete board** on the export message throws it away without leaving Transmission.

Then it runs, with a progress bar (creating the frame, then the pages, then the connections) and a **Cancel** button. When it finishes, the board opens in your browser.

#### What lands on the board

- A **frame** sized to the whole sitemap.
- **One shape per visible node**, positioned exactly where it sits in the app.
- **A connector for every parent → child** relationship.
- The **colours and line styles from your colour rules** (see [Colour rules in depth](#colour-rules-in-depth)) — so a board colour-coded by KKE or by builder arrives that way.
- **Collapsed sections as a stacked block** — two offset blocks behind the card, so it's visibly a folded-up section rather than a page that happens to be a dead end.

#### What to expect on speed and fidelity

Roughly **400 pages plus 400 connectors takes about a minute**. That's a floor, not a slow implementation: Miro rate-limits how fast items can be created, and connectors have no bulk endpoint, so it's one call per shape and one per connector.

Three things don't survive the trip exactly, and it's worth knowing which before you present:

- **Collapsed sections aren't collapsible on the board.** Miro has no collapse behaviour for shapes — only Miro *mind maps* collapse, and those are text-only with no colour, so using them would throw away all your colour coding. The stacked block is the substitute: it shows that something is folded away, but nobody can unfold it in Miro.
- **Corner radius becomes square-or-rounded.** Miro has no radius setting, so whatever specific radius you set in the Layout tab arrives as simply "rounded".
- **Inner padding is app-only.** Miro centres shape text itself and offers no padding control.

### Ask the audit a question (MCP server)

The reports above answer a fixed set of questions. An audit raises plenty that aren't on the list — *how many Keep pages under `/news` have no audience? Which sections did the SME overturn most? What did we decide about the PDFs on the careers subdomain?* — and until now the honest answer was "export to Excel and pivot."

Transmission ships a small **MCP server** (Model Context Protocol — the standard AI assistants use to talk to tools) that lets Claude Desktop, Claude Code or any other MCP client **read** a `.transmission` project and answer those questions directly, with real numbers. It's a developer preview: it works, it's tested, and it needs a one-time terminal setup.

**What it can do**

- Count pages grouped by any column — sections, decisions, audiences, tags, source sites, status codes — with filters, so *"Kill pages by section, content pages only"* is one question.
- List matching pages with the columns you choose, or pull one page's full record with its change history.
- Walk the sitemap with page counts per node, list redirects with who wrote each one, read the audit trail, and read the project's libraries (audiences, jobs, sites, the content-type crosswalk, the glossary).
- Apply your **saved filters** by name, so the AI sees the same worklists you do.

It also sends the model the conventions that matter — blank means *unreviewed*, Kill vs Exclude, content pages vs crawled URLs, the `404` sentinel — so an untouched crawl doesn't get reported back as a finished audit.

**What it deliberately can't do**

- **Change anything.** It opens the project read-only and never touches the file. Writes are planned as *proposals* you'd accept or reject in the app — the same contract Suggested_KKE and the AI audience suggestions already follow.
- Read `.xlsx` files. Use **File → Save As Project…** first.
- Compute the handful of filters only the app can (duplicates, URL variants, redirect review, cross-site duplicates). A saved filter that uses one is refused by name rather than run half-applied.

**Set it up**

You need **Node 22.13 or newer** installed (it uses Node's built-in SQLite; nothing else to install) and a copy of the Transmission source, which contains `mcp/server.js`.

For Claude Code:

```bash
claude mcp add transmission -- node /path/to/transmission/mcp/server.js
```

For Claude Desktop, add to `claude_desktop_config.json`:

```json
{ "mcpServers": { "transmission": { "command": "node", "args": ["/path/to/transmission/mcp/server.js"] } } }
```

Then, in a conversation: *"Open the project at /path/to/audit.transmission and give me an overview."* You can keep working in the app while it's connected — the server notices each autosave and answers from the current state.

**A note on client data.** The server hands crawl and audit data to whichever model your assistant is connected to. Treat it like any other tool that can read the client's project file, and check the engagement's data terms before connecting one.

### Quick self-check

- [ ] **Executive Summary** ready for the client readout
- [ ] **Content Inventory** prepared as the detailed appendix
- [ ] IA reports run if the future tree is in scope
- [ ] **Content Type Crosswalk** run if you did migration classification
- [ ] Delivery reports generated for the build team, each in the format its recipient needs

### Going deeper

The **Reports** menu holds everything above. The separate **Migration** menu is reserved for export and validation *tools* rather than reports — Pre-Handoff Check, Migration Tracker, Export Redirect Map (CSV), and Redirect Chain Check.

For a live progress view rather than a formal report, open the **Progress Dashboard** with **Cmd+P** (or **View → Audit Progress**): client and project, total and percent reviewed, the KKE breakdown as a stacked bar, flagged/tagged/noted counts, a by-group breakdown, and SME stats. It exports to PDF or HTML using the same layout as every other report: the content-page split, SME review, and a by-section table with each decision's share.

Every report's header shows the client and project, the date it was generated, and, when the crawl export includes Screaming Frog's **Crawl Timestamp** column, the dates the site was crawled. The crawl date is the real "as of" date for the page data; your decisions are always current.

It counts every row you're actually auditing, including redirects and error URLs — a 3xx still needs triaging, so it's still work — with the content split shown beneath the total. **Pages on sites you've marked out of scope are left out**, so a retired property can't hold your completion percentage below 100% forever; a note at the top says how many rows that was and which sites. The Executive Summary counts the same rows but reports only content pages, which is why its total is the smaller of the two.

---

## 17. Migration Tracker Hand-off

*By the end of this section you'll have packaged the whole audit into a single workbook your migration team can execute against.*

> **In a hurry?** The [Migration Tracker walkthrough](walkthroughs/17-migration-tracker.md) is the one-page version.

### The mental model

The Migration Tracker is *the* engineering deliverable — one `.xlsx` with four purpose-built sheets, generated from the current state of your project. It's a snapshot, not a live link, so re-export it whenever the audit moves on. Run the [Pre-Handoff Check](#18-pre-flight--hand-off) first.

### Export it

Open **Migration → Migration Tracker…**. A dialog lets you toggle which sheets and options to include (for example, whether Kill/Exclude rows appear in Source Pages, and whether phased nodes are included), then exports. The default filename is `{project-slug}-migration-tracker-YYYY-MM-DD.xlsx`. (You can also reach it via **File → Export…**.)

Two controls let you scope the **Sitemap Plan** sheet: a **column picker** (tick exactly which columns to include) and **Only nodes matching the active Build filter** — when you've set a Build filter in the Sitemap (say, one assignee or one page status), this exports just the nodes that match it. The toggle shows the active filter and how many nodes match.

**Just want the sitemap nodes, not the whole workbook?** In the Sitemap, set a **Build** (and/or Phase) filter, then use **Export → Filtered nodes → Excel…**. Pick **Rows** (the matching nodes, or all nodes) and **Columns**, and it writes a single sheet — `{project-slug}-sitemap-nodes-YYYY-MM-DD.xlsx`.

### What each sheet carries

- **Sitemap Plan** — one row per sitemap node, with all the build metadata: page status, build pattern, builder/writer/migrator, guidance and briefs, source-page count, the assigned **source-page URL(s)**, the **consolidated-in URL(s)** (any old pages being merged into those assigned pages), net-new flag, phase, in-menu, and external URL. The build team's master plan.
- **Source Pages** — your audit rows joined to their sitemap node: KKE / Final / Suggested calls, Content Type / Renders As / Target, Group, Primary Tag, and the target breadcrumb, path, pattern, and status. The "where does each old page go" map.
- **Redirects** — Kill rows plus URL changes; an intentional `404` surfaces as "(404) — intentional deindex."
- **Archive** — the Kill rows with their notes and tags, for client reference.

Each sheet has a frozen header row and pre-tuned column widths, ready to work in directly.

### Quick self-check

- [ ] The **Pre-Handoff Check** is clean before you export
- [ ] The dialog's toggles are set for this particular hand-off
- [ ] The **Sitemap Plan** carries the build metadata the team needs
- [ ] The **Redirects** sheet matches your redirect map
- [ ] You exported with a clear, dated filename

---

## 18. Pre-flight & Hand-off

*By the end of this section you'll run one command that checks everything at once — so you hand off with confidence — and you'll know where the decision history lives.*

> **In a hurry?** The [Pre-flight & Hand-off walkthrough](walkthroughs/18-preflight-handoff.md) is the one-page version.

### The mental model

The **Pre-Handoff Check** rolls every validation Transmission knows how to run into a single pass/issue report. It's a **gate, not a fix**: it tells you what's wrong and how to fix each item (with a sample of offending pages), and you fix, re-run, and repeat until it's clean. Running alongside it, the **change log** is your automatic audit trail.

### Run the Pre-Handoff Check

**Migration → Pre-Handoff Check…** reports either "**Ready for handoff**" or "**N issues across M checks**," covering:

1. Every page has a KKE decision.
2. Consolidate pages point to a target.
3. Consolidate targets are live (not Kill/Exclude).
4. No redirect chains.
5. No duplicate sitemap IDs *(sitemap files only)*.
6. No empty sitemap leaves *(sitemap files only)*.

Each failing check lists a sample of the pages plus a one-line fix (which filter to use, which editor to open); the sitemap checks are skipped automatically if the file has no Sitemap sheet. Work top-down — clear unreviewed pages first (they cascade into the other checks), then consolidations, then redirects, then sitemap — re-running after each batch. The check is itself a report, so you can export it to **PDF / HTML** as evidence that the audit passed its gate.

### The change log

Every change to a decision field — KKE, SME Decision, Final KKE, and the auto-filled classifications — is recorded during the session and appended to the hidden **KKE_ChangeLog** sheet on save (Timestamp, Row, URL, Field, Old Value, New Value). It accumulates across sessions, so the file always carries a complete history of how the inventory was decided.

### Quick self-check

- [ ] The Pre-Handoff Check reports **Ready for handoff** (0 issues)
- [ ] All applicable checks pass (sitemap checks may legitimately be N/A)
- [ ] You exported the check as evidence, if your process needs it
- [ ] A final **Save** wrote the change log
- [ ] Your outputs are generated: reports, the **Redirect Map**, and the **Migration Tracker**

---

# G. Power features

## 19. Templates

*By the end of this section you'll be able to reuse your setup across projects, and shape how the Migration Direction Brief reads.*

> **In a hurry?** The [Templates walkthrough](walkthroughs/19-templates.md) is the one-page version.

### Two different things called "templates"

These two features share a name but are unrelated:

- **Audit templates** (`.kke-template.json`) — a portable snapshot of your *setup*: field config, vocabularies, KKE states, column mapping, and identity. They carry configuration, never page data.
- **Report templates** (Markdown + Mustache) — files that control how a *report* renders. Today they shape the **Migration Direction Brief**.

### Audit templates — reuse your setup

1. Configure a file the way you like it.
2. **File → Save Audit Template…** writes a `.kke-template.json` capturing it all.
3. On a new project, **File → Load Audit Template…** applies that setup in one step.

A template captures your visible fields, tag and group libraries, sidebar columns, custom KKE states, column mapping, auto-advance preference, identity (client, project, site domain, default redirect), and saved filters. It's the way to standardize a team's audit conventions across many clients — create one, distribute it.

### Report templates — shape the Direction Brief

Custom report templates are Markdown files with Mustache placeholders, rendered to HTML.

1. Open the templates folder from the **Migration Direction Brief** dialog's **Templates folder** button (it lives at **Documents → Transmission → templates**).
2. The folder ships with **`FIELDS-*.md`** reference files listing every placeholder available for that report — start there rather than guessing field names. A template declares which report it's for in its frontmatter (`appliesTo: assignee-brief`).
3. Write the template with `{{field}}` for values and `{{#section}}…{{/section}}` to repeat lists.
4. In the dialog, pick your template from the **Template** dropdown (or **Built-in default**, which needs no setup), then **Generate**.

### Quick self-check

- [ ] A reusable **audit template** is saved for your standard setup
- [ ] New projects are bootstrapped via **Load Audit Template**
- [ ] Any custom report template declares the right `appliesTo`, and its placeholders match the matching `FIELDS-*.md`
- [ ] You selected the template in the dialog before **Generate**

---

## 20. Component Inventory

*By the end of this section you'll have catalogued the UI components used across the site, so the rebuild team knows exactly which design-system pieces they need.*

> **In a hurry?** The [Component Inventory walkthrough](walkthroughs/20-component-inventory.md) is the one-page version.

### The mental model

A **component** is a UI building block — a hero banner, a card grid, an accordion — and it's distinct from a page's content *type*. One page can carry several. You tag each page with the components it uses (stored in `Design_Patterns`), drawing from a shared, app-level library that ships with 57 defaults. The **Component Inventory report** then turns those tags into a frequency-and-reuse picture that scopes the rebuild's component set.

### Tag components on pages

1. Turn on **Show Components cluster** (in App Settings, or via the **Components** chip above the audit bar).
2. Click **+ Add component** to open the picker — entries are grouped by category, each with a Low/Medium/High complexity badge.
3. Pick the components on the page, or type a name with no match to **Create** it.

> **Tip:** tag what's *structurally* on the page — the reusable blocks — not every styled element. The goal is "which blocks does the rebuild need," not a pixel inventory.

### Curate the library

**Project → Component Library…** opens a two-pane editor where each entry has a name, category, complexity, description, design-system URL, aliases, and notes. **Seed defaults** adds the 57 built-ins, skipping any names you already have.

### Run the report

**Reports → Component Inventory…** produces a per-component frequency table with a KKE breakdown, a one-off flag for components on two or fewer pages, and the top co-occurring pairs — which often reveal the real page templates your team needs to build.

### Quick self-check

- [ ] The **Components** cluster is enabled and used while auditing
- [ ] Components are drawn from a consistent library, not freeform names
- [ ] The library is curated or seeded as needed
- [ ] The **Component Inventory report** is generated and exported
- [ ] One-offs are reviewed — dropped, consolidated, or justified

### Going deeper

The library lives in your app preferences (`prefs.json`, so it's shared across projects) and merges with any per-project additions in the file's `DesignPatternLibrary` sheet on open. In the report, a component that appears on 30 Kill pages may not be worth prioritizing, while one on 20 Evolve pages clearly is — the KKE breakdown is there to make that call. Component auditing is best as a **second pass**: filter to Keep + Evolve first (there's no value cataloguing pages you're killing), ideally alongside a UX or design colleague who knows the new design system.

---

# Reference Appendix

## Audit Columns

Injected into every file on open if not already present.

| Column | Purpose |
|--------|---------|
| **KKE_Recommendation** | Your Keep/Kill/Evolve/Consolidate/Exclude decision |
| **Tags** | Comma-separated labels |
| **Notes** | Free-text rationale |
| **Group** | Ad hoc grouping |
| **Primary Tag** | Single tag per page for Excel filtering |
| **Redirect_Destination** | URL set in the Redirect Editor (or `404` sentinel) |
| **SME_Decision** | SME verdict (Approve / Change: …) |
| **SME_Notes** | SME reviewer notes |
| **Content_Owner** | Person responsible for the page |
| **Final_KKE** | Resolved recommendation after SME review (incl. Consolidate) |
| **Consolidate_Into** | Consolidation target URL |
| **Published_Status** | Published / Unpublished / Draft / 404 |
| **Page_Type** | UI "Content Type"; key into the crosswalk |
| **Content_Theme** | Per-project theme |
| **Target_Content_Type** | New-CMS content type (auto-filled from the crosswalk) |
| **Content_Nature** | UI "Renders as": Page / Content Object (Record) / Fragment / Generated |
| **Migration_Track** | Scripted / Migrate Records / Configure / Manual Rebuild / Merge / Kill/Redirect |
| **Suggested_KKE** | Unified suggestion (GA + Rubric + Audience) |
| **Suggested_KKE_Sources** | JSON per-source breakdown for the badge |
| **GA_KKE_Recommendation** / **GA_Score** | GA-derived rec + 0–1 composite |
| **Source_CMS_URL** / **New_CMS_URL** | Admin/edit URLs in the source / new CMS |
| **Design_Patterns** | CSV of component names on the page |
| **Audiences** | CSV of every audience the page serves (blank = unreviewed) |
| **Primary_Audience** | Who the page is mainly for |

Internal (hidden from the field bar, saved in the file): `_Flagged`, `_AssessedAt`, `_AssessmentResult`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd+O** | Open file |
| **Cmd+S** | Save |
| **Cmd+Shift+S** | Save As Project (convert to `.transmission`) |
| **Cmd+F** | Global Search |
| **Cmd+1** | Audit view |
| **Cmd+T** | Table view |
| **Cmd+Shift+T** | Sitemap |
| **Cmd+Shift+R** | Redirect Editor |
| **Cmd+Shift+M** | Menus |
| **Cmd+Shift+E** | Unified Export dialog |
| **Cmd+P** | Audit Progress dashboard |
| **Cmd+,** | Preferences |
| **Cmd+Z** / **Cmd+Shift+Z** | Undo / Redo (KKE changes, sitemap node deletions) |
| **1 / 2 / 3 / 4 / 5 / 0** | Keep / Kill / Evolve / Consolidate / Exclude / Clear (no input focused) |
| **?** | Keyboard cheat-sheet |
| **F** | Toggle flag on the selected row |
| **Arrow Up / k** · **Arrow Down / j** | Previous / next row |
| **]** | Jump to next unreviewed row (wraps) |
| **Escape** | Close popover, modal, or tour |

Press **?** anytime, or **Help → Keyboard Shortcuts** (**Cmd+/**).

## Rubric DSL operators

Field rules are auto-evaluated against spreadsheet data; the status with the most passing rules wins. All text comparisons are case-insensitive.

| Syntax | Example |
|--------|---------|
| `Column is value` | `Status Code is 200` |
| `Column is not value` | `Content Type is not text/html` |
| `Column > value` / `>=` / `<` / `<=` | `Word Count > 500` · `Status Code >= 400` |
| `Column contains value` / `not contains` | `Title 1 contains buy` · `URL not contains /old/` |
| `Column starts with` / `ends with` | `Address ends with .pdf` |
| `Column is empty` / `is not empty` | `Meta Description 1 is empty` |
| Compound (AND) | `Status Code >= 300 and Status Code < 400` |

Content rules are plain-English statements shown as a checklist for manual / AI review.

## Structural Sheets

Hidden from the data-sheet picker; they carry project state and travel with the file.

| Sheet | Purpose |
|-------|---------|
| **Sitemap** | The sitemap (see [§13](#13-sitemap--ia) for the column format) |
| **KKE_Settings** | Project settings, saved filters, computed-column config (JSON) |
| **KKE_ChangeLog** | Decision-change audit trail |
| **KKE_Glossary** | Tag/group definitions |
| **ContentTypeRegistry** | Current→target crosswalk |
| **PatternLibrary** | Target Spec Library |
| **DesignPatternLibrary** | Component Library |

## Table View

**View → Table** or **Cmd+T** — a full-width spreadsheet view (sidebar hidden). All columns shown. **Sort** any header (asc/desc/none); per-column **text filters** (independent of the sidebar; a banner reminds you Table View filters on its own); **resize** by dragging header edges; **Columns…** toggles visibility + reorder. Selecting a row preserves it when you switch back to Audit. The **#** column is frozen when scrolling horizontally. **Inline editing**: double-click any audit column (KKE-type → dropdown; others → text); Enter/blur commits, Escape cancels, and **Tab / Shift+Tab** commits and hops to the adjacent editable column — so you can work across a row without re-clicking. **Keyboard**: Arrow Up/Down or j/k navigate when no input is focused.

## Preferences (persisted)

Last opened file (reopened on launch), window bounds, sidebar width, search text, sort order, visible metadata fields, tag library, group library, auto-advance, rubric directory (global + per-file), API key, column mappings (per file), sidebar column selection. Stored in `~/Library/Application Support/Transmission/prefs.json`.

**The Miro connection is the exception.** Your Miro token is *not* in `prefs.json` — it's stored encrypted in its own file using the OS keychain, and the app's interface layer can never read it back (it can set one, ask whether one exists, clear it, and ask the main process to make calls on its behalf). Manage it in **App Settings → Miro**; see [Send the sitemap to Miro](#send-the-sitemap-to-miro).

## Installation

**From DMG:** open the `.dmg` → drag **Transmission** to Applications → double-click to launch. The app is **signed and notarized** (Apple Developer ID), so it opens normally — no right-click or security-override needed.

**From source** (Node 18+):
```bash
npm install        # install dependencies
npm start          # run the app
npm run dev        # run with DevTools open
npm run build      # build universal .dmg (output in dist/)
```

## Known Limitations

- **Single sheet editing** — one data sheet at a time; other sheets preserved but not editable.
- **Formulas are stripped on save** — replaced with cached values to prevent Excel corruption; keep a backup if you rely on formulas.
- **Tag/group libraries are global** — shared across files, not per-file.
- **Fixed-element screenshots** — full-page captures scroll-and-stitch, so fixed headers/footers may repeat.
- **macOS only** — built and tested for macOS.
- **Miro: collapsed sections can't be unfolded on the board** — Miro has no collapse behaviour for shapes. Only Miro *mind maps* collapse, and those are text-only with no colour, so using them would lose all the colour coding. Collapsed sections export as a stacked block instead, which shows that something is folded away but can't be opened.
- **Miro: corner radius exports as square-vs-rounded only** — Miro has no radius setting, so a specific radius value in the app arrives as simply "rounded".
- **Miro: inner padding is app-only** — Miro centres shape text itself and has no padding control.
- **MCP server is read-only and needs Node 22.13+** — it can answer questions about a project but cannot change it; proposals-based writes are planned. It reads `.transmission` projects only, not spreadsheets.
- **Miro: one team per connection** — a Miro token is scoped to a single team; working across teams means connecting once per team.
- **New sitemap card defaults apply to new projects only** — existing projects keep the card height and colour rules they already saved. Changing them is a one-click job in the Visual Sitemap's **Layout** / **Colors** tabs.

---

*Task-oriented walkthroughs for each section live in [`walkthroughs/`](walkthroughs/). Architecture: `CLAUDE.md`. Design rationale: `CONTENT_TYPE_MODEL.md`.*
