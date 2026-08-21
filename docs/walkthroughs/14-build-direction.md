# Build & Direction Walkthrough

How to turn a placed sitemap into **work three people can pick up and execute** — the builder who constructs each page, the writer who fills it, and the migrator who maps the old content in. This is where the sitemap stops being a map and becomes a delivery plan.

> Prerequisite: the future-state sitemap exists and your Keep/Evolve pages are placed on it (**need placement = 0**). See the **Sitemap & IA** walkthrough.

---

## 0. The mental model

- Every build node carries direction for **three roles**: **Builder** (constructs the page), **Writer** (writes the content), **Migrator** (maps source content into the new CMS).
- Direction lives at **two levels**. Type-level defaults sit on the **Target Spec** in the **Target Spec Library** — write the guidance *once per spec* and every node on that spec inherits it. Node-level briefs override or extend, page by page.
- A **Target Spec** is either a **Page Template** (a full page layout) or a **Content Model** (an embeddable fragment / data shape, with a field schema).
- You don't need a brief on every page. Write one reference brief per spec (or on one representative node) and let the rest follow — the reports handle this gracefully, with no "missing brief" nagging.

Open the tree with **Cmd+Shift+T**. The **status tallies** in the stats line ("5 built · 3 in progress") are your build dashboard.

---

## 1. Build the Target Spec Library

A **Target Spec** is what a node is built from. It's the backbone of every brief.

1. **Project → Target Spec Library…**
2. Seed the **12 defaults**, then edit. For each spec set:
   - **Kind** — **Page Template** (full page layout) or **Content Model** (embeddable fragment / data shape).
   - **Description**
   - **Build guidance default** — the standard build notes for this spec (for the **Builder**).
   - **Writer brief default** — the standard content brief (for the **Writer**).
   - **Migration mapping default** — the source → target field map and migration gotchas (for the **Migrator**). Applies even to scripted content.
   - **Fields** — the field schema; shown in the editor only for **Content Models**.
   - **Default Migration Track** · **Notes**.

> Gotcha: specs are matched by **exact name**. Reports group by spec name, so a typo splits a group. Keep names consistent.

---

## 2. Annotate each node with build metadata

Open a node's editor (double-click the label, or **✎**). Below **Migration notes** are three sections matching the three roles:

**Build** (blue pill — *for the person constructing this page*):
- **Pattern** — pick a spec from the Target Spec Library (or type a new name to add it). On selection, any **blank** Build guidance / Writer brief is filled from that spec's defaults. If a field already has content, a **Keep / Append / Replace** diff dialog opens per field — it never silently clobbers what you wrote.
- **Page status** — Not Started / In Progress / Built / In Review / Published / Blocked (manage the list in Project Settings → Migration).
- **Builder** — pick from the assignee list (or add inline via **+ New…**).
- **Build guidance** — markdown; specific build instructions for this page.

**Write** (violet pill — *for the content writer; especially important for net-new pages*):
- **Writer** — assignee.
- **Writer brief** — markdown; audience, purpose, key messages, voice.

**Migrate** (amber pill — *for the person mapping source content in*):
- **Migrator** — assignee. There's no per-node migrate brief: the source→target field mapping lives on the spec's **Migration mapping** (add per-page exceptions in **Migration notes** above).

Use the editor's **← / →** arrows to move through nodes without closing it.

> Efficient pattern: set the same **Pattern** (and a **Status** + **Builder/Writer/Migrator**) on all similar pages, but write **one** brief per spec. The Migration Direction Brief shows that one as the reference and lists the rest under it.

---

## 3. Manage the controlled vocabularies

**Project Settings → Migration** tab owns the two libraries used across all nodes:

- **Page Statuses** — color, rename (cascades to nodes), reorder, delete (cascade-clears the status off affected nodes). Seeded with 6 defaults.
- **Assignees** — one shared pool for **Builder / Writer / Migrator**. Usage counts show `{build, write, migrate}` per name; rename/delete cascade across all three node fields.

Both are also addable on the fly via **+ New…** inside the node editor.

---

## 4. Handle Fragment nodes

Set a node's **Node type** to **Fragment / shared content** for content that's embedded rather than navigated to (a shared CTA block, a stats module). Fragments:

- keep a computed path as a repository location, but have **no menu entry, breadcrumb, or redirect**;
- are excluded from hub / empty / net-new counts and get their own stats tally;
- render with a **FRAG** badge in the tree.

A row whose **Renders as** = **Fragment (embeddable)** (stored as `Content Object`) is treated the same way downstream — skipped in redirect resolution and sitemap-coverage checks.

---

## 5. Read the build dashboard and filter the work

The stats line appends **status tallies** once any node has a status:

`… · 5 built · 3 in progress · 2 blocked · …`

**Filter the tree** with the toolbar **Build:** dropdown:
- **By status** — has any / none.
- **By assignee** — has any / none (per-person filtering matches branches and auto-expands).
- **By pattern** — has / no pattern.
- **By guidance** — has build guidance or writer brief / none.

**Row indicators** (positive-only — blank rows stay clean): colored **status pill**, letter circles **P** (pattern) / **G** (build guidance) / **W** (writer brief), and **🔧** builder / **✎** writer assignee chips.

---

## 6. Produce the per-person worklists

**Reports → Migration Direction Brief…**

1. Pick **Role** — **Writer**, **Builder**, or **Migrator**.
2. Pick **Person** (the shared assignee pool).
3. Optionally pick a **Template** — custom Markdown templates live in **Documents → Transmission → templates**; **Built-in default** needs no setup.
4. **Generate**, then export **PDF / HTML**.

The output groups that person's pages **by pattern / target spec**, leads each group with the reference direction (the spec-level default + any page-specific briefs), and lists the rest as followers. The Migrator role reads the spec's **Migration mapping** as its type-level reference.

---

## 7. Hand off

Once nodes are annotated:

- **Migration → Migration Tracker…** — the multi-sheet xlsx (Sitemap Plan with all build metadata, Source Pages, Redirects, Archive). See the **Migration Tracker** walkthrough for what each sheet carries.
- **Migration → Pre-Handoff Check…** — runs every validation at once (unreviewed pages, bad consolidate targets, redirect chains, duplicate sitemap IDs, empty sitemap leaves). Fix what it flags, re-run, then export. See the **Pre-flight & hand-off** walkthrough.

---

## Quick checklist for "good direction"

- [ ] Every build node has a **Pattern**, and each pattern/spec has a default brief (or one reference page does)
- [ ] **Builder / Writer / Migrator** assigned wherever work is owned
- [ ] **Page status** reflects reality (the tallies match where the build actually is)
- [ ] Content Models have a **field schema**; every spec has a **Migration mapping** for the migrator
- [ ] Fragments are typed as **Fragment**, not left as standard pages
- [ ] Generated the **Migration Direction Brief** for each role/person
- [ ] **Pre-Handoff Check** is clean before exporting the **Migration Tracker**

---

*See also: the **Sitemap & IA** walkthrough (building and placing the sitemap), [the User Guide](../USER_GUIDE.md), and `CONTENT_TYPE_MODEL.md` (why the three roles and two levels exist).*
