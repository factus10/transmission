# Redirects Walkthrough

How to make sure every URL that's going away lands somewhere sensible — building the redirect map that keeps SEO equity and bookmarks alive after the migration.

> Prerequisite: MRA calls made (especially **Archive** and **Consolidate**), and a **Site domain** set in Project Settings.

---

## 0. The mental model

- A redirect is needed for any **Archive** page and any page whose **URL is changing** (its new computed path differs from its current URL). Consolidated pages redirect to their target.
- You rarely set destinations by hand. The app **resolves** them from a priority order, and re-derives them from the sitemap on demand.
- One special value matters: **`404`** means "let this URL die — do not write a redirect." It's distinct from blank (which means "TBD").

**Destination priority** (highest wins): custom per-row destination → sitemap node path → project default destination → blank.

---

## 1. Open the Redirect Editor

**Redirects** tab (view switcher) or **Cmd+Shift+R**. It lists every page needing a redirect — Archive pages and URL-changed pages — each with its MRA badge, title (click to jump to that row in Audit), current URL, an editable **destination**, and a **sitemap picker** to point it at a node.

> Fragments (Renders as = Fragment) have no public URL and are excluded from the list automatically.

---

## 2. Set destinations efficiently

- **Re-derive from sitemap** — recomputes destinations from current sitemap paths for every row with a sitemap assignment (skips explicit `404`s). Run this after you've reorganized the sitemap.
- **Sitemap picker** (per row) — point a single redirect at a specific node.
- **404 toggle** — mark a row as an intentional 404 (no redirect rule).
- **Find/Replace** — toggles a bar that **filters** the list to matching destinations (exact-match optional) and can **Replace All** across them — ideal for domain or path-prefix sweeps.

The editor has its own status filter, text search, and sortable columns; opening it from a row auto-scrolls to that page.

> Destinations are also resolved automatically on **Save** for all Archive/URL-changed rows — the editor is for review and overrides, not a prerequisite for a correct export.

---

## 3. Validate the chains

- **Migration → Redirect Chain Check…** flags redirects that point at another page being archived (a redirect to a redirect, or to a 404). Repoint these to a live destination.
- The **Pre-Handoff Check** includes this same chain check (see **Pre-flight & Hand-off**).

---

## 4. Export the map

- **Migration → Export Redirect Map (CSV)…** writes the redirect rules as CSV for the engineering team.
- **Reports → Redirect Map Report…** is the human-readable version — three sections: **Archive** redirects, **URL-changed** redirects, and **intentional 404s**.

---

## Quick checklist for "redirects ready"

- [ ] Every Archive / URL-changed page has a destination (or an intentional **404**)
- [ ] **Re-derive from sitemap** run after the tree was finalized
- [ ] **Redirect Chain Check** is clean — no redirects into Archive/404 pages
- [ ] Intentional 404s are marked, not left blank
- [ ] Redirect map **exported** (CSV for engineering, report for the client)

---

*Next: **Producing the Outputs** — the report catalog. See also the **Consolidate** walkthrough.*
