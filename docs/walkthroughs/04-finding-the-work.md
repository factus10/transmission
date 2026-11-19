# Finding the Work Walkthrough

How to slice thousands of rows down to exactly the set you want to act on. Filtering well is what makes batch decisions and a clean audit possible.

> Prerequisite: a file is open.

---

## 0. The mental model

- Filters are **stackable and AND-ed**: text search **and** MRA status **and** group **and** any field filters all apply together. Narrow from broad to specific.
- The sidebar list always reflects the current filter — and the **Multi-bar** at the bottom acts on exactly that filtered set (see **Bulk Operations**).
- Save a filter combination once and recall it later, so recurring slices ("unreviewed thin content") are one click.

---

## 1. Search

The sidebar's top row is a search box with a **scope** selector:

- **All fields** — matches any column.
- **URL** — matches only the URL column.
- **Title** — matches only the page title.

The placeholder updates to reflect the scope. **✕** clears it.

---

## 2. Filter by MRA status

The **MRA filter** (toolbar row 2) is a **checkbox dropdown** — check **multiple** statuses and they're OR-ed together (e.g. **Migrate + Revise**). The button label reflects your selection. Beyond the literal statuses, it includes **special filters**:

- **Unreviewed** — no MRA call yet.
- **Flagged** — rows you marked with **F**.
- **Client review: open** / **Client review: urgent (open)** — pages you asked the client about (**C**) that the SME hasn't answered yet.
- **Reviewed, undecided** — pages marked *Needs decision* that still have no call.
- **Duplicates**, **SME conflicts / pending**, **Consolidate (no target)** / **Consolidate → Archive/Exclude target**, **Shared sitemap node (2+ pages)**, **Needs placement**, **Suggested disagrees**, **Suggested ≠ your call**.

Use the **Group** dropdown alongside it to scope to one content group.

---

## 3. Field filters (any column)

For anything the built-in filters don't cover, **+ Field filter**:

1. Pick a **field**, an **operator** — `is blank`, `is not blank`, `contains`, `does not contain`, `equals`, `not equals`, `starts with`, `ends with` — and a **value**.
2. **Apply**. Active filters show as removable **chips**; add as many as you need (they AND together).

> Common move: MRA = **Migrate + Revise**, then **+ Field filter** `Sitemap_ID is blank` to find pages that still need a nav home. The **Unclassified** button is a one-click shortcut for `Content Nature is blank`.

---

## 4. Save and recall filters

Once you've built a useful combination:

1. Open **Saved filters…** → **+ Save current filter…**, name it.
2. The bundle stores text, scope, MRA selection, group, **and** field filters — they all travel together.
3. Recall any time from the dropdown; manage them in **Project Settings → Saved Filters**. (Saved filters persist with the file.)

---

## 5. Global Search (Cmd+F)

For "where is that one page/value" rather than narrowing the work list:

- **Cmd+F** opens the **Global Search** bar — searches across all columns, shows a **match count**, and **◀ / ▶** step through hits (jumping the selection to each). **✕** closes it.

This is distinct from the sidebar filter: it finds and navigates rather than reducing the list.

---

## Quick checklist for "finding the work"

- [ ] Search **scope** set to match what you're looking for (URL vs Title vs All)
- [ ] MRA filter using **multi-check** where you mean "either" (Migrate + Revise)
- [ ] Field filters layered for precise slices (e.g. `Sitemap_ID is blank`)
- [ ] Recurring slices saved as **named filters**
- [ ] **Cmd+F** for one-off lookups, sidebar filters for work sets

---

*Next: **Bulk Operations** — act on the filtered set all at once. See also [the User Guide](../USER_GUIDE.md).*
