# Transmission — User Guide

**Version 2.2.0 "How Soon Is Now?"**
macOS (Apple Silicon + Intel)

---

## Welcome

Transmission is a desktop workspace for **content audits and site migrations**. You load a crawl of an existing site, decide what to do with every page, shape the structure of the new site, and hand your engineering team a clean plan to build from — all in one place, and all saved back into a single spreadsheet.

This guide takes you from *"I've never opened it"* to *"I could run an audit in my sleep,"* in the order you'll actually do the work.

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

That has one wonderfully freeing consequence: **one file is the whole project.** Hand it to a colleague who also has Transmission and they see exactly what you see — your Keep/Kill/Evolve calls, the navigation tree, project settings, even the full change history. There's nothing else to sync or export. Back up the file and you've backed up everything.

> If you've run content audits before, you may know this pattern as a *content inventory* or a *rationalization* spreadsheet. Transmission keeps that familiar single-file deliverable — it just gives you a far better cockpit for filling it in.

### Project files: the faster way to work

Working directly in the `.xlsx` is fine for small files, but every save rebuilds the whole workbook — and on a few thousand rows you'll feel that pause. The fix is one menu item: **File → Save As Project…** (**Cmd+Shift+S**). That converts your open spreadsheet — including everything you've done so far this session — into a **Transmission project file** (`.transmission`), and the app switches over to it on the spot.

A project file keeps the "one file is the whole project" promise — rows, decisions, nav tree, settings, glossary, libraries, and the full change history all live inside it — but saves become **instant**. Edits are committed within a couple of seconds of making them, with no workbook rebuild and no pause, no matter how big the crawl. Put the file wherever the project lives (`Documents/Alpha/Alpha.transmission`, say); double-clicking it in Finder opens it in Transmission, and it shows up in **Open Recent** like any other file.

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

- **NavStructure** — your future-state navigation tree
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
- **Site domain** — the canonical domain for redirect and navigation paths. It overrides the domain auto-detected from your URLs. If you change it later, Transmission offers to rewrite any existing redirects that used the old domain.
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

Open App Settings from the **⚙** button (or **File → App Settings**); the subtitle confirms it applies to you across all files.

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

- [ ] **Identity** is filled in — at least the **Site domain**, since redirects and nav paths depend on it
- [ ] Any **custom KKE states** this engagement needs are defined
- [ ] **Suggestion sources** are configured, if you'll use Suggested_KKE
- [ ] **Migration** vocabularies are seeded, if you'll reach the build phase
- [ ] **App Settings** reflect how you like to work

> **A note on dark mode:** Transmission follows your macOS appearance automatically, with WCAG-compliant contrast in both light and dark themes — nothing to configure.

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

- **Decide** (blue) — the KKE buttons, the read-only **Suggested_KKE** badge (which shows the recommendation and a ⚠ when its sources disagree), and the **Assess**, **Notes**, and **Nav** actions. With SME fields on, it also shows the SME readout and the **Final** call.
- **Classify** (slate) — Content Type, Theme, Published, Group, Primary Tag, and Tags (see [Tagging, Grouping & the Glossary](#6-tagging-grouping--the-glossary)).
- **Migrate** (amber, optional) — Renders as and Migration Track (see [Content Types & the Crosswalk](#7-content-types--the-crosswalk)).
- **CMS** (green) — Source CMS and New CMS admin links.

> **Heads-up:** switching a page to **Kill** when it already has a nav assignment or a redirect prompts you to clear them, so you never leave an orphaned redirect behind. The same prompt appears for Final KKE, bulk changes, and Table View edits.

### A few conveniences worth knowing

- **Page thumbnails.** Once you've viewed a page, hovering its sidebar row shows a thumbnail preview — a quick way to recognize a page without clicking back into it. Thumbnails live in memory only and never bloat your file.
- **Note snippets.** The Notes popover has a **Snippets…** menu for reusable rationale — insert a saved snippet, save the current note as one, or manage the list. Snippets follow you across projects.
- **Undo and redo.** **Cmd+Z** and **Cmd+Shift+Z** cover KKE changes (up to 100 per session). Tag, note, and nav edits aren't undoable, but they're always saved.
- **Clean paste.** When you paste into nav labels, slugs, or notes, Transmission strips mojibake, stray HTML entities, and invisible characters — while leaving real accented letters (é, ü, ñ) untouched.

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

### Filter by KKE status

Click the **KKE filter** to open a checkbox list. Check as many as you like and they combine with OR — so **Keep + Evolve** shows everything you're keeping. Alongside the five calls, the list includes useful **special filters**:

- **Unreviewed** and **Flagged**
- **Duplicates** (identical Title, H1, or Meta Description)
- **SME conflicts** and **SME pending**
- **Consolidate (no target)** and **Consolidate (dead target)**
- **Shared nav** and **Needs placement**
- **Suggested disagrees** and **Suggested ≠ your call**

Use the **Group** dropdown next to it to narrow to a single content group.

### Filter by any column

For anything the built-in filters don't cover, click **+ Field filter** and build your own:

1. Pick a **field** (any column in your spreadsheet).
2. Pick an **operator**: `is blank`, `is not blank`, `contains`, `doesn't contain`, `equals`, `doesn't equal`, `starts with`, or `ends with`.
3. Enter a **value** and click **Apply**.

Each filter becomes a removable chip, and you can stack several (they AND together). The **Unclassified** button is a one-click shortcut for the common case `Content Nature is blank`.

### Save a filter for next time

Built a slice you'll want again? Open **Saved filters…** and choose **+ Save current filter…**. The saved bundle remembers the search text and scope, the KKE selection, the group, and every field filter — all together. Manage your saved filters in **Project Settings → Saved Filters**.

### Find one specific thing (Cmd+F)

When you just want to *find* a page rather than narrow the list, press **Cmd+F** for a floating search bar. It searches every column across every row, shows a match count, and steps through hits with **◀ / ▶** — clearing the sidebar filters if needed so it can show you the match. Think of it as "find and jump," distinct from the sidebar's "narrow the list."

> **Good to know — reading the sidebar.** Each row carries a gentle KKE-tinted background (green Keep, red Kill, yellow Evolve, grey Exclude), the URL, a KKE badge, and the flag ★. Two small letters flag structure: **N** (green) means the page is assigned to a nav node, and **R** (amber) means it has a redirect. Non-200 pages show a colored status badge (amber for 3xx, red for 4xx/5xx). A **Quick Stats Bar** along the bottom tracks "X/Y reviewed (Z%)."

### Quick self-check

- [ ] Your search **scope** matches what you're hunting for
- [ ] You're multi-checking the KKE filter when you mean "either/or"
- [ ] Field filters are layered for precise slices (e.g. `NavID is blank`)
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

If you've both selected rows and applied a filter, your **selection wins**.

### Apply an action

1. Pick an **Action** — Set KKE, Set Published Status, Set Content Type, Set Content Theme, Set Group, Set Primary Tag, or Add Tag.
2. Choose the **value** (every list except *Add Tag* offers a `— Clear` option at the top, so bulk-clearing a field is easy).
3. Click **Apply**. Every change is written to the audit trail.

**Clear selection** drops your multi-selection and hands the target back to the filter.

> **Heads-up:** bulk-setting **Kill** on pages that already have a nav assignment or redirect triggers the same cleanup prompt as a single Kill — so you decide whether to clear those too, rather than leaving redirects pointing nowhere.

### Score in bulk instead of deciding by hand

Sometimes you don't want to *set* a call across many pages — you want a *suggestion* to react to. **Project → Run Rubric on filtered rows…** scores the filtered set and feeds the results into **Suggested_KKE** (see [Suggested_KKE](#8-suggested_kke)). You still make the final call; the rubric just does the first read.

> **Tip — a few patterns that pay off:**
> - *Mark all 404s as Unpublished:* field-filter `Status Code equals 404` → **Set Published Status → Unpublished**.
> - *Tag every Article "archive":* field-filter `Page_Type equals Article` → **Add Tag → archive**.
> - *Move 12 specific pages to a group:* Cmd-click the 12 → **Set Group**.

### Quick self-check

- [ ] The Multi-bar's label confirms the right target (**selected** vs **filtered**) before you Apply
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

---

# C. Classify for migration

## 7. Content Types & the Crosswalk

*By the end of this section you'll classify each page for migration — what it is, how it should render in the new CMS, and what it maps to — and most of the downstream defaults will fill themselves in.*

> **In a hurry?** The [Content Types & the Crosswalk walkthrough](walkthroughs/07-content-types-crosswalk.md) is the one-page version. The thinking behind it lives in `CONTENT_TYPE_MODEL.md`.

### The two questions every page answers

Migration asks two genuinely different things about a page, and Transmission keeps them apart on purpose:

- **What is it?** Its **Content Type** — the data shape (Article, Faculty Profile, Landing Page). Every page has a *current* type and maps to a *target* (new-CMS) type. This is the **key** everything else hangs off.
- **How does it render?** Its **Renders as** value — a **Page** (its own URL and breadcrumb), a **Fragment (embeddable)** (no URL of its own; dropped into pages via components, like an AEM experience fragment), or **Generated** (a template drawn over a feed or query).

The **Content Type Registry** is the crosswalk that ties them together. Define the mapping **once per content type**, and every page of that type inherits it — without ever overwriting something you set by hand.

### Set the Content Type as you audit

In the **Classify** cluster, set each page's **Content Type**. A small **→** hint appears next to it showing the target type it maps to.

> **Tip:** this is the one classification worth doing during your main audit pass. It's the key, so everything downstream (Renders as, target type, migration track) can flow from it automatically.

### Build the crosswalk

Open **Project → Content Type Registry…**. Each row maps one current content type to its targets:

- **Content Type** (current) — the key
- **Renders as** — Page / Fragment (embeddable) / Generated
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

- **Renders as** (stored as `Content_Nature`) — **Page** (a hand-authored standalone), **Content Object** (a record like an article or bio, shown in the UI as "Fragment (embeddable)"), or **Generated** (a system-rendered view over records). This is a *delivery* concern, not a quality one — a page can be Keep and any of the three.
- **Migration Track** — Scripted, Migrate Records, Configure, Manual Rebuild, Merge, or Kill/Redirect. The technical architect owns this call; the registry and the ghost suggestion just give it a head start.

**Fragments have no public URL.** In the Navigation Editor you can set a node's **Node type → Fragment / shared content**. A Fragment keeps a computed path as a repository location but has no menu entry, breadcrumb, or redirect; it shows a `FRAG` badge and sits outside the net-new/empty counts. Anything that renders as a Fragment is automatically left out of the redirect plan (no URL to redirect) and the needs-placement check (a fragment has no nav home by design — that's correct, not a gap).

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

When you consolidate page A into page B, A's content merges **into** B. A points at its **target** (recorded in `Consolidate_Into`) and the target survives — usually as **Evolve**, since it's receiving new content. A consolidated page needs no nav placement of its own. On save, Transmission works out A's redirect by chasing B to wherever it actually lands, and it warns you if a target is **dead** (missing, or itself being killed).

### Consolidate a single page

1. Select the source page and press **4** (or click **Consolidate**). The **Consolidate into…** picker opens — a searchable, sortable list of your whole inventory, with the source URL and any SME notes pinned at the top.
2. Click a page to select it, then double-click it (or use **Set as target**) to confirm.

Transmission sets `Consolidate_Into`, switches the page's call to Consolidate, and clears its nav assignment. To change the target later, click Consolidate again (the current target is highlighted); **Clear target** removes both the target and the call.

> **Tip:** mark the **target** page **Evolve** and add a note about what's merging in. Don't leave it Unreviewed, don't mark it Keep (receiving content *is* a change), and never mark it Kill (content can't merge into a dead page).

### Find consolidation groups in bulk

When several pages already share a nav node, they're often consolidation candidates. **Navigation Tree → Consolidation Candidates…** opens a workflow built for exactly this:

1. It lists every node with 2 or more pages, biggest group first.
2. For each group, select the radio button on the page that should be the **target**.
3. Click **Apply**.

In one click, the target becomes Evolve (preserving a deliberate Keep/Evolve), the rest become Consolidate pointing at it, and their nav and explicit redirects are cleared. **Skip** defers a group that legitimately shares a node. A counter tracks *"X to resolve · Y skipped · Z hidden · N total,"* and a filter bar lets you scope by **Include KKE** or **Exclude groups** so you can set a whole section aside without touching individual calls.

> **Why this beats one-at-a-time:** it's roughly one Apply per group instead of four clicks per page, and it enforces the right shape every time — target = Evolve, the rest = Consolidate pointing at it.

### Catch broken targets

Two sidebar filters keep consolidations honest — clear both before you ship:

- **Consolidate (no target)** — marked Consolidate but no target chosen yet.
- **Consolidate (dead target)** — the target is missing or is itself Kill/Exclude (the source shows an amber dot).

### Quick self-check

- [ ] Every Consolidate page has a **live** target
- [ ] No **dead-target** warnings remain
- [ ] Each target survives as **Keep/Evolve**, not killed
- [ ] Consolidated pages carry no stray nav assignment
- [ ] Redirects resolve to a real URL (confirm in the [Redirect Editor](#15-redirects))

### Going deeper

**How the redirect is chased.** On save, a Consolidate page's destination is computed in order: the target's *future* computed path if it has a nav assignment, then — if the target is itself Consolidate — the final destination down the chain (cycle-safe), then the target's own explicit redirect, and finally the target's current URL. It updates automatically whenever the target's nav changes, so you never maintain these by hand.

**Spotting them at a glance.** A Consolidate row takes on an indigo tint and a small `C` pill once a target is set, and the Consolidate button shows a dot. The **Shared nav node (2+ pages)** filter is a lighter-touch alternative to the Candidates workflow — it simply surfaces every page whose `NavID` is shared, for cases you'd rather review one by one.

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

**File → Import/Merge** is the gentler cousin of a full auditor merge: it matches by URL and fills **only empty** fields, leaving your existing decisions untouched. Multi-sheet files offer a sheet picker, column checkboxes show **exists** / **new** badges, and an **"Add new URLs not in current file"** option (on by default) appends rows your file is missing.

> **Good to know — the change log.** Every change to a KKE, SME Decision, or Final KKE is recorded automatically and written to a hidden `KKE_ChangeLog` sheet on save (Timestamp, Row, URL, Field, Old Value, New Value). It accumulates across sessions, giving the project a complete decision history — see [Pre-flight & Hand-off](#18-pre-flight--hand-off).

---

# E. Architect the future site

## 13. Navigation & IA

*By the end of this section you'll have built the structure of the new site and placed every page you're keeping onto it — the moment the audit stops being a list and becomes a site.*

> **In a hurry?** The [Navigation & IA walkthrough](walkthroughs/13-navigation-ia.md) is the one-page version.

### The mental model

Your audit rows answer one question: *"what do we do with each existing page?"* The **navigation tree** answers a different one: *"what is the new site?"* — its sections, its hierarchy, its URLs.

You connect the two by **placing** each Keep/Evolve page onto a tree node. A node can carry **no** source pages (it's net-new content you'll write), **one**, or **many** (it's a consolidation target). The tree is the source of truth for breadcrumbs and computed URLs, so renaming a node cascades the change to its descendants and to every page beneath it.

Open the tree with **Cmd+Shift+T** (or the **Navigation Tree** tab). The **stats line** beneath the toolbar is your dashboard — more on reading it below.

### Place every Keep/Evolve page

Your goal is to drive **need placement** in the stats line down to **0**.

1. In the audit view, set the **KKE filter** to **Keep + Evolve**, then add a field filter for `NavID is blank` and **Apply** — that's exactly the pages still needing a home.
2. For each one, click **Nav** in the Decide cluster, drill to the right node, and click **Assign**. Use **+ Child** in the picker to create a new node inline if no good home exists yet.
3. To place many similar pages at once, multi-select them in the sidebar and **drag the selection onto a node**.

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
- **In menu** — whether the node appears in navigation. The toolbar's **Set Menu ✓** / **Clear Menu** toggle this for all *visible* nodes at once (pair with the Depth filter).
- **External URL** — point a menu item at an outside address instead of a built page.
- **Reference** — alias this node to another so the same destination can appear in two places without duplicating it.

### Phase out-of-scope work

Not everything in the tree ships in this build. In the node editor, set **Phase** to **Current build** (the default), **Future**, **Stretch**, or **Archived**. Phased nodes carry a colored badge, never raise a net-new "NEW" flag, and can be left out of exports. Filter the tree by phase with the toolbar **Phase** dropdown (All / Current build only / Non-current only), and on export you'll be asked whether to include phased nodes.

### Read the gap signals

Two badges tell you where the tree is incomplete:

- **NEW** (yellow) — a net-new node: it has descendant pages but no source page of its own. Expected for brand-new sections; a flag if you didn't mean it.
- **Empty leaf** (red) — a node with no pages *and* no redirects pointing through it. Assign content, mark it net-new, phase it, or delete it before hand-off.

If any `NavID` is assigned to two nodes, a **⚠ N duplicate IDs** link appears in the stats line — click it to auto-renumber the duplicates.

### Track coverage from the stats line

The stats line reads, left to right:

`N nodes · M current (A assigned, H net new, E empty) · [phase buckets] · P pages placed · [F fragments] · [status tallies] · X need placement`

So **need placement → 0** confirms every Keep/Evolve page is in the IA, **empty** counts your coverage gaps, and the status tallies track build progress (more in [Build & Direction](#14-build--direction)). Filter the tree with the **Depth**, **Phase**, and **Build** dropdowns, and use **Collapse All** / **Expand All** to manage large trees.

### See it and report on it

- **Sitemap** (toolbar) renders a box-style tree: a solid border means the node is in the menu, dashed means it isn't; the fill color comes from its build pattern; a stacked shadow signals hidden children; and a corner badge shows the page count. Toggle **Menu items only**, switch **Visual** / **Text Tree** tabs, zoom and pan, and export as **PDF** or **SVG/HTML**.
- **IA & coverage reports:** **IA Report** (toolbar) or **Reports → Navigation IA…**, **Reports → Nav Coverage Report…**, and **Reports → Net New Content Brief…**.

To resolve pages that landed on the same node, see the Consolidation Candidates workflow in [Consolidate](#9-consolidate).

### Quick self-check

- [ ] **need placement = 0** — every Keep/Evolve page sits on a node
- [ ] No **empty** leaf nodes left unexplained
- [ ] No **duplicate NavID** warning, and no red duplicate-slug highlights
- [ ] **In menu** set correctly on every node that belongs in navigation
- [ ] Out-of-scope work is **phased**, and net-new sections are intentional

### Going deeper

#### Assigning a page from the audit bar

Select a row and click **Nav** to open the picker. Cascading dropdowns drill to the node — the slug is auto-detected from the URL (and editable), and the parent is auto-suggested from the URL's hierarchy. **Assign** populates `NavID`, `Nav Destination` (the breadcrumb), `Computed Path`, and `Nav_SortID`. **+ Child** creates a sub-node with its number, ID, sort order, breadcrumb, and path all calculated for you, and **Remove** clears the assignment.

#### The node editor

Double-click a label (or click **✎**) for the full editor. It shows read-only context (number, ID, parent, breadcrumb, computed path, page count) and editable Label, Slug, In Menu, External URL, **Phase**, **Notes**, and **Node type** — plus the **Build / Write / Migrate** sections covered in [Build & Direction](#14-build--direction). The breadcrumb and path preview live as you type; **Esc** cancels and **Cmd/Ctrl+Enter** saves; and the **← / →** arrows walk the tree in order (saving first) so you can annotate node after node. A node with notes shows a small `·` and reveals them on hover.

#### Deleting nodes

The **✕** always confirms first, showing the breadcrumb so you know exactly what you're removing. If the node has children, you choose **Promote children** (delete just this node, children rise to its parent) or **Delete all** (the whole branch). If pages are assigned, you choose **Reassign to parent**, **Reassign to another node…** (a search picker), or **Clear assignments**. Every reassignment is logged.

#### The editor's columns and drag behavior

The columns are Node (number, toggle, label — it fills the width), Slug, InMenu, Computed Path, Breadcrumb, Pages, and Actions (✎ edit, **+** child, ⧉ clone, ↗ reference, external-URL link, ✕ delete — visible on hover); all are resizable. When you drag, the top/bottom third of a target row inserts before or after it (shown by a line indicator) and the middle reparents (shown by a blue left border). The dragged row fades to 35%, and the drop zone only activates after you've moved about 30% in, to avoid accidental drops. Moving a node carries its whole subtree, and all numbers, sort IDs, breadcrumbs, and paths recalculate. Fold state persists across edits.

#### Reading the Pages column

A link icon means an external URL, an arrow means a reference, **NEW** means net-new, an empty circle means an empty leaf, and a number is the page count (click it to expand). The Navigation IA report adds four node states: a **red** badge for **Empty** (no pages, no redirects), a slate **→** for **Redirect only**, a grey **Np** for **N live pages**, and an italic **≡** for a **Structural header**. These are purely informational — Transmission never blocks a save over coverage.

#### Reference picker and Visual Sitemap

The reference picker is a wide (880px) dialog, sorted hierarchically and indented by depth with top-level nodes in bold; a numeric search matches from the start (`2.2` finds 2.2.1) while a text search matches anywhere. The Visual Sitemap lays the tree out left-to-right like a file tree (50px per level, L-shaped connectors), one card per top-level section, with each node a labeled 160×34px box.

#### The NavStructure sheet

Behind the editor, the `NavStructure` sheet holds: **Number** (the dotted hierarchy like `1.1.2`), **Label**, **ID**, **Path** (slug), **SortID**, **ParentNumber**, **Computed Path**, and **Breadcrumb** — plus extension columns for the external `URL`, `Phase`, `Notes`, `Node_Type`, `InMenu`, the reference, and the build-metadata fields (Build Pattern, Page Status, the three assignees, Build Guidance, Writer Brief). The whole sheet is rewritten on save.

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

The report groups that person's pages by spec, leads each group with the reference direction (the spec default plus any page-specific briefs), and lists the rest as followers. Under each nav node it also lists the **source page(s)** currently assigned to it; if other pages are being **consolidated into** one of those pages, that page gets a **merges N** flag so the writer knows the new page is absorbing content from N old ones. The summary line totals the consolidations folded in.

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

**Why the migration mapping lives on the spec.** Authoring it once per spec is what lets thousands of scripted records share a single mapping — nobody edits 5,000 News records by hand. The 12 curated defaults (Hub Landing, Article, Faculty Profile, Program/Degree, Department, Event, Form Page, and more) seed from a banner the first time you open a project that has a nav tree.

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
2. The page's nav node path
3. The project's default redirect destination
4. Blank — meaning the page is retired and will 404

One special value matters: the literal **`404`** means "let this URL die honestly — write no redirect rule," which is different from a blank destination (still to be decided).

### Open the Redirect Editor

Open it from the **Redirects** tab or **Cmd+Shift+R**. It lists every page that needs a redirect — Kill pages and URL-changed pages — each showing its KKE badge, its title (click to jump to that row in the audit view), the current URL, an editable destination, and a nav picker. Fragments are left out automatically, since they have no public URL.

### Set destinations efficiently

- **Re-derive from nav** recomputes destinations from current nav paths for every row with a nav assignment (it skips any explicit `404`). Run it after you've reorganized the tree.
- The per-row **nav picker** points a single redirect at a specific node.
- The **404 toggle** marks a row as an intentional 404.
- **Find/Replace** opens a bar that *filters the list* to matching destinations (exact-match optional) and can **Replace All** across them — ideal for domain or path-prefix sweeps.

Destinations also resolve automatically on **Save**, so the editor is for review and overrides, not a prerequisite for a correct export.

### Validate the chains

**Migration → Redirect Chain Check…** flags any redirect that points at another page being killed (a redirect into a redirect, or into a 404). Repoint those to a live destination. The same check runs as part of the [Pre-flight check](#18-pre-flight--hand-off).

### Export the map

- **Migration → Export Redirect Map (CSV)…** writes the rules as CSV for engineering.
- **Reports → Redirect Map Report…** is the human-readable version, split into Kill redirects, URL-changed redirects, and intentional 404s.

### Quick self-check

- [ ] Every Kill / URL-changed page has a destination (or an intentional **404**)
- [ ] You ran **Re-derive from nav** after the tree was finalized
- [ ] The **Redirect Chain Check** is clean — no redirects into Kill/404 pages
- [ ] Intentional 404s are marked, not left blank
- [ ] The redirect map is exported

### Going deeper

**The columns.** Status (a KKE badge or "URL Changed"), Title (click to open the audit row), Current URL, the **→** arrow, the editable Destination URL, and the **🗂** nav picker. The toolbar adds a status filter, a text search, and sortable columns that cycle ascending → descending → none.

**Setting a destination.** Type any URL (including a cross-server one), pick a node from the nav tree (a 600px dropdown anchored to the right), or leave it blank to be resolved on save. The **default destination** and **site domain** live in Project Settings; changing the domain rewrites destinations that used the old one. On save, `Redirect_Destination` is filled from the priority chain above — there's no homepage fallback, so a blank means the page is retired and will 404.

**How Re-derive decides.** Kill and Consolidate rows take the nav computed path; Keep/Evolve rows update only when the URL is actually changing; rows with an explicit `404` are always skipped; and rows with no nav assignment are left alone. Every result is visible in the editor before you save, so you can review or override.

**A couple of conveniences.** Opening the editor from a page auto-scrolls to that page's row with a brief highlight. And the exported CSV carries four columns: Source URL, Destination URL, Status Code (`301`), and a Reason.

---

## 16. Producing the Outputs

*By the end of this section you'll know which report answers which question — and how to produce the deliverables your stakeholders and build team actually need.*

> **In a hurry?** The [Producing the Outputs walkthrough](walkthroughs/16-producing-the-outputs.md) is the one-page version.

### The mental model

Reports are read-only views, generated on demand from the current file — run them as often as you like. Every one exports to **PDF** or **HTML** (and the HTML opens cleanly in Word). They fall into three audiences, which is also how the Reports menu is grouped.

### For stakeholders

- **Executive Summary** — the top-line story: total pages, the KKE distribution, auto-generated key findings, SME status, and a section breakdown. Lead a client readout with this.
- **Content Inventory by Section** — the full inventory grouped by section, with KKE distribution, sample pages, and notes counts. Your detailed appendix.
- **SME Review Status** — where expert review stands: overall completion plus a per-Content-Owner table (assigned, reviewed, %, approved vs changed, unresolved conflicts) and a conflict list.

### For information architecture

- **Navigation IA** — the in-menu tree with per-node page and redirect counts (and the [node states](#13-navigation--ia) from §13). Also available as the **IA Report** button in the nav toolbar.
- **Nav Coverage Report** — the gap-finder: empty leaf nodes, hub nodes, overloaded nodes (5+ pages), and path mismatches.
- **Content Type Crosswalk** — one row per current type → renders → target type → target spec → migration track, with page volume and KKE breakdown, flagging any type with no crosswalk.
- **Component Inventory** — the UI-component picture (see [Component Inventory](#20-component-inventory)).

### For the build and engineering team

- **Migration Direction Brief** — per-person worklists for the Writer, Builder, or Migrator, grouped by spec and led by the reference direction (supports custom templates — see [Templates](#19-templates)).
- **Migration Checklist** — the comprehensive hand-off: what to retain, remove, update, and redirect, plus URL changes and net-new pages, with full tables.
- **Net New Content Brief** — every nav node that needs brand-new content written.
- **Redirect Map Report** — totals, intentional 404s, chain warnings, and full tables by type.

### Export them

Every report preview has **PDF** and **HTML** buttons. Choose HTML when the client wants to drop it into Word or a doc; PDF for a fixed deliverable.

### Quick self-check

- [ ] **Executive Summary** ready for the client readout
- [ ] **Content Inventory** prepared as the detailed appendix
- [ ] IA reports run if the future tree is in scope
- [ ] **Content Type Crosswalk** run if you did migration classification
- [ ] Delivery reports generated for the build team, each in the format its recipient needs

### Going deeper

The **Reports** menu holds everything above. The separate **Migration** menu is reserved for export and validation *tools* rather than reports — Pre-Handoff Check, Migration Tracker, Export Redirect Map (CSV), and Redirect Chain Check.

For a live progress view rather than a formal report, open the **Progress Dashboard** with **Cmd+P** (or **View → Audit Progress**): client and project, total and percent reviewed, the KKE breakdown as a stacked bar, flagged/tagged/noted counts, a by-group breakdown, and SME stats — exportable to PDF or HTML with a client/project/date header, like every other report.

---

## 17. Migration Tracker Hand-off

*By the end of this section you'll have packaged the whole audit into a single workbook your migration team can execute against.*

> **In a hurry?** The [Migration Tracker walkthrough](walkthroughs/17-migration-tracker.md) is the one-page version.

### The mental model

The Migration Tracker is *the* engineering deliverable — one `.xlsx` with four purpose-built sheets, generated from the current state of your project. It's a snapshot, not a live link, so re-export it whenever the audit moves on. Run the [Pre-Handoff Check](#18-pre-flight--hand-off) first.

### Export it

Open **Migration → Migration Tracker…**. A dialog lets you toggle which sheets and options to include (for example, whether Kill/Exclude rows appear in Source Pages, and whether phased nodes are included), then exports. The default filename is `{project-slug}-migration-tracker-YYYY-MM-DD.xlsx`. (You can also reach it via **File → Export…**.)

Two controls let you scope the **Nav Plan** sheet: a **column picker** (tick exactly which columns to include) and **Only nodes matching the active Build filter** — when you've set a Build filter in the Nav Tree (say, one assignee or one page status), this exports just the nodes that match it. The toggle shows the active filter and how many nodes match.

**Just want the nav nodes, not the whole workbook?** In the Nav Tree, set a **Build** (and/or Phase) filter, then use **Export → Filtered nodes → Excel…**. Pick **Rows** (the matching nodes, or all nodes) and **Columns**, and it writes a single sheet — `{project-slug}-nav-nodes-YYYY-MM-DD.xlsx`.

### What each sheet carries

- **Nav Plan** — one row per nav node, with all the build metadata: page status, build pattern, builder/writer/migrator, guidance and briefs, source-page count, the assigned **source-page URL(s)**, the **consolidated-in URL(s)** (any old pages being merged into those assigned pages), net-new flag, phase, in-menu, and external URL. The build team's master plan.
- **Source Pages** — your audit rows joined to their nav node: KKE / Final / Suggested calls, Content Type / Renders As / Target, Group, Primary Tag, and the target breadcrumb, path, pattern, and status. The "where does each old page go" map.
- **Redirects** — Kill rows plus URL changes; an intentional `404` surfaces as "(404) — intentional deindex."
- **Archive** — the Kill rows with their notes and tags, for client reference.

Each sheet has a frozen header row and pre-tuned column widths, ready to work in directly.

### Quick self-check

- [ ] The **Pre-Handoff Check** is clean before you export
- [ ] The dialog's toggles are set for this particular hand-off
- [ ] The **Nav Plan** carries the build metadata the team needs
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
5. No duplicate nav IDs *(nav-tree files only)*.
6. No empty nav leaves *(nav-tree files only)*.

Each failing check lists a sample of the pages plus a one-line fix (which filter to use, which editor to open); the nav checks are skipped automatically if the file has no NavStructure. Work top-down — clear unreviewed pages first (they cascade into the other checks), then consolidations, then redirects, then nav — re-running after each batch. The check is itself a report, so you can export it to **PDF / HTML** as evidence that the audit passed its gate.

### The change log

Every change to a decision field — KKE, SME Decision, Final KKE, and the auto-filled classifications — is recorded during the session and appended to the hidden **KKE_ChangeLog** sheet on save (Timestamp, Row, URL, Field, Old Value, New Value). It accumulates across sessions, so the file always carries a complete history of how the inventory was decided.

### Quick self-check

- [ ] The Pre-Handoff Check reports **Ready for handoff** (0 issues)
- [ ] All applicable checks pass (nav checks may legitimately be N/A)
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
| **Content_Nature** | UI "Renders as": Page / Content Object (Fragment) / Generated |
| **Migration_Track** | Scripted / Migrate Records / Configure / Manual Rebuild / Merge / Kill/Redirect |
| **Suggested_KKE** | Unified suggestion (GA + Rubric + AI) |
| **Suggested_KKE_Sources** | JSON per-source breakdown for the badge |
| **GA_KKE_Recommendation** / **GA_Score** | GA-derived rec + 0–1 composite |
| **Source_CMS_URL** / **New_CMS_URL** | Admin/edit URLs in the source / new CMS |
| **Design_Patterns** | CSV of component names on the page |

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
| **Cmd+Shift+T** | Navigation Tree |
| **Cmd+Shift+R** | Redirect Editor |
| **Cmd+Shift+E** | Unified Export dialog |
| **Cmd+P** | Audit Progress dashboard |
| **Cmd+,** | Preferences |
| **Cmd+Z** / **Cmd+Shift+Z** | Undo / Redo (KKE changes only) |
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
| **NavStructure** | The nav tree (see [§13](#13-navigation--ia) for the column format) |
| **KKE_Settings** | Project settings, saved filters, computed-column config (JSON) |
| **KKE_ChangeLog** | Decision-change audit trail |
| **KKE_Glossary** | Tag/group definitions |
| **ContentTypeRegistry** | Current→target crosswalk |
| **PatternLibrary** | Target Spec Library |
| **DesignPatternLibrary** | Component Library |

## Table View

**View → Table** or **Cmd+T** — a full-width spreadsheet view (sidebar hidden). All columns shown. **Sort** any header (asc/desc/none); per-column **text filters** (independent of the sidebar; a banner reminds you Table View filters on its own); **resize** by dragging header edges; **Columns…** toggles visibility + reorder. Selecting a row preserves it when you switch back to Audit. The **#** column is frozen when scrolling horizontally. **Inline editing**: double-click any audit column (KKE-type → dropdown; others → text); Enter/blur commits, Escape cancels. **Keyboard**: Arrow Up/Down or j/k navigate when no input is focused.

## Preferences (persisted)

Last opened file (reopened on launch), window bounds, sidebar width, search text, sort order, visible metadata fields, tag library, group library, auto-advance, rubric directory (global + per-file), API key, column mappings (per file), sidebar column selection. Stored in `~/Library/Application Support/Transmission/prefs.json`.

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

---

*Task-oriented walkthroughs for each section live in [`walkthroughs/`](walkthroughs/). Architecture: `CLAUDE.md`. Design rationale: `CONTENT_TYPE_MODEL.md`.*
