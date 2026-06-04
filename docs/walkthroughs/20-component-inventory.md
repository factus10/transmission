# Component Inventory Walkthrough

How to catalog the UI components that appear across the site — hero banners, card grids, accordions — so the rebuild team knows what design-system pieces they actually need.

> Prerequisite: a file is open. Turn on **Show Components cluster** (App Settings, or the **Components** quick-chip above the audit bar).

---

## 0. The mental model

- A **component** is a UI building block on a page (distinct from its *content type*). One page can carry several.
- You tag each page with the components it uses (stored in `Design_Patterns`, comma-separated — same mechanic as Tags).
- The component **library** is a shared, app-level vocabulary (57 built-in defaults across 12 categories), so names stay consistent. The **Component Inventory report** then turns those tags into a frequency-and-reuse picture.

---

## 1. Tag components on pages

In the **Components** cluster of the audit bar:

1. **+ Add component** opens the picker — entries grouped by category, with a complexity badge (Low / Medium / High); already-selected ones are highlighted.
2. Pick the components on the current page. Type a name with no match to get a **Create "…"** option.

> Tag what's *structurally* on the page, not every styled element. The goal is "which reusable blocks does the rebuild need," not a pixel inventory.

---

## 2. Curate the library

**Project → Component Library…** opens the two-pane editor. Each entry has a name, category, complexity, description, design-system URL, aliases, and notes. **Seed defaults** adds the 57 built-ins (skipping any that already exist by name). The library lives in your app prefs (global), so it carries across files; per-project additions in the file's sheet merge in on open.

---

## 3. Run the report

**Reports → Component Inventory…** produces:

- a per-component **frequency table** with a KKE breakdown,
- a **one-off flag** for components appearing on ≤2 pages (candidates to drop or consolidate),
- the **top co-occurring pairs** (components that tend to appear together).

This tells the design-system team what to build first (high-frequency), what to question (one-offs), and what bundles naturally.

---

## Quick checklist for "component inventory done"

- [ ] **Components** cluster enabled and used while auditing
- [ ] Components tagged from a **consistent library** (not freeform names)
- [ ] Library curated / seeded as needed
- [ ] **Component Inventory report** generated and exported
- [ ] One-offs reviewed (drop, consolidate, or justify)

---

*See also: the **Tagging, Grouping & Glossary** walkthrough (same chip mechanic) and `USER_GUIDE.md`.*
