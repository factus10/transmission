# Getting Started Walkthrough

How to install the app, open your first crawl export, and understand what the file you're editing actually is. Do this once; everything else builds on it.

> Prerequisite: a spreadsheet with a **URL column** — ideally a **Screaming Frog** `.xlsx` crawl export, but any `.xlsx`/`.csv` with a URL column works.

---

## 0. The mental model

- The app is a **viewer and editor for your spreadsheet** — it doesn't own a database. Your `.xlsx` *is* the project.
- On open, it **injects its audit columns** (KKE_Recommendation, Tags, Notes, …) if they aren't already there, and adds a handful of **structural sheets** (NavStructure, KKE_Settings, etc.) to hold project state.
- Everything you do saves **back into that same file**. Hand the file to a colleague with the app and they see exactly your state — decisions, sitemap, settings, change log.
- So: **one file = one project**, fully portable.

---

## 1. Install & first run

1. Download the `.dmg`, drag the app to **Applications**.
2. It's signed and notarized, so it opens normally — no right-click or security override needed.
3. On first launch you get a **Welcome** dialog (also under **Help → Getting Started**). From it you can **Open a file**, view **Keyboard shortcuts**, or **Take a quick tour** (a 5-step spotlight tour, also under **Help → Product Tour**).

---

## 2. Open a crawl export

1. **File → Open…** (**Cmd+O**), or the **Open a file** button on the empty state.
2. The app reads the first **data** sheet (structural sheets are skipped). If the file has **more than one data sheet**, a **sheet picker** appears in the titlebar — switch sheets there.
3. **URL detection:** it auto-detects the URL column by header name (`Address`, `URL`, `Link`, …; `Address` is the Screaming Frog default). If it can't find one, a **column picker** asks you to choose which column holds the URL.

> Single-sheet model: the app audits **one data sheet at a time**. Pick the right one if your export bundles several.

---

## 3. What got added to your file

On open, the app ensures these exist (and adds them if missing):

- **Audit columns** — KKE_Recommendation lands first; Tags, Notes, Group, Primary Tag sit right after the URL column; the rest (SME, migration, CMS, Design_Patterns…) are appended. See the *Audit Columns* reference.
- **Structural sheets** (hidden from the data-sheet picker), each carrying part of the project:
  - **NavStructure** — the future-state sitemap.
  - **KKE_Settings** — project settings, saved filters, computed-column config.
  - **KKE_ChangeLog** — the audit trail of decision changes.
  - **KKE_Glossary**, **ContentTypeRegistry**, **PatternLibrary** (Target Spec Library), **DesignPatternLibrary** (Component Library).

---

## 4. The five views

A persistent **tab strip** below the titlebar (mirrored in the **View** menu) switches between the app's five views — always one click away:

- **Audit** (**Cmd+1**) — the default: sidebar row list + the embedded browser and field bar. Where you make each Keep/Kill/Evolve call.
- **Table** (**Cmd+T**) — a full-width spreadsheet of every row and column, with inline editing.
- **Sitemap** (**Cmd+Shift+T**) — the drag-and-drop editor for the future-state sitemap.
- **Redirects** (**Cmd+Shift+R**) — every Kill or URL-changed page with an editable destination.
- **Menus** (**Cmd+Shift+M**) — build independent navigation menus that reference your sitemap pages.

> You can build navigation right from the **Audit** view without switching tabs: the audit bar's **Sitemap** button places the current page on the sitemap (and, if the sitemap is still empty, offers a quick form to create its first node), and the **Menu** button drops the page into one of your menus.

---

## 5. Seed banners

The first time a project could use a starter library, a one-time **seed banner** offers defaults — accept or dismiss:

- **Content Type Registry** — ~20 common content types with default classifications (**Seed defaults**).
- **Target Spec Library** — 12 curated page-template/content-model specs (offered once a sitemap exists).
- **Component Library** — 57 built-in UI components (self-seeds globally on first run; also re-seedable from the editor).

Seeding only stages the data — **save** to commit it to the file.

---

## 6. Save & round-trip

1. **File → Save** (**Cmd+S**). The titlebar shows the dirty state; a toast confirms the write.
2. On save the app resolves redirect destinations, writes all audit + structural sheets, and appends this session's changes to **KKE_ChangeLog**.
3. Reopen the file (it's also in **File → Open Recent**) and everything is exactly as you left it.

> Data ownership: the file is the single source of truth and is **portable** — no cloud, no separate database. Back it up like any document. Per-*user* preferences (below) live outside the file and don't travel with it.

---

## Quick checklist for "ready to audit"

- [ ] App opens past the Gatekeeper prompt
- [ ] Crawl export opened; the **right data sheet** is selected
- [ ] URL column detected (or picked) — rows load a page in the browser when selected
- [ ] Audit columns present; structural sheets created
- [ ] Seed banners accepted or dismissed deliberately
- [ ] First **Save** succeeded and the file reopens with state intact

---

*Next: **Project Setup** — configure identity, KKE states, suggestion sources, and the migration vocabularies. See also `USER_GUIDE.md` and the *Audit Columns* reference.*
