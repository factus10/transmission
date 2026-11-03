# Consolidate Walkthrough

How to fold redundant pages into a single surviving page — so three thin pages on one topic become one strong page, with the other two redirecting in.

> Prerequisite: a file is open with MRA calls in progress.

---

## 0. The mental model

- **Consolidate** is an MRA call that says "this page's content merges *into* another page." The page you consolidate **away** points at a **target**; the **target** is what survives (usually **Revise**).
- A consolidated page needs **no sitemap placement** — it folds into its target. The redirect resolver later chases the target through its computed path, any further consolidations, and explicit redirects (cycle-safe) so the URL lands somewhere real.
- The app warns when a consolidate points at a **dead target** (a page that doesn't exist or is itself being archived) so you never strand a redirect.

---

## 1. Consolidate one page

1. With the page selected, press **4** or click **Consolidate** — this opens **Consolidate into…**, a searchable, sortable list of every page in the inventory.
2. Pick the target page. The app sets `Consolidate_Into` and MRA = **Consolidate**, and clears the page's own sitemap assignment.

> It won't clobber an existing consolidate intent (e.g. one set by an SME's Final MRA) — your earlier decision is preserved.

---

## 2. Find consolidation groups in bulk

When several pages already share one sitemap node, they're likely consolidation candidates:

- **Sitemap → Consolidation Candidates…** lists every node with **2+** assigned pages, largest first.
- For each group, pick the **target** (set to **Revise**); the rest become **Consolidate** pointing at it, with their nav + explicit redirects cleared. Skip a group to leave it untouched for the session.

You'll also get flagged automatically, without running this workflow: marking a page Migrate/Revise (or assigning its sitemap node) when another Migrate/Revise page already sits at that destination pops a **"Did you mean to Consolidate?"** prompt naming the other page, with a one-click **Consolidate into it**.

---

## 3. Catch broken targets

Two sidebar special filters keep consolidations honest:

- **Consolidate: no target** — marked Consolidate but no target chosen.
- **Consolidate: dead target** — the target doesn't exist or is itself Archive/missing (the sidebar dot turns amber).

Resolve both before shipping — every consolidated page must point at a live survivor.

---

## Quick checklist for "clean consolidation"

- [ ] Every **Consolidate** page has a target (**no target** filter is empty)
- [ ] No **dead target** warnings remain
- [ ] Each target survives as **Migrate/Revise** (not itself archived)
- [ ] Consolidated pages have no stray sitemap assignment
- [ ] Redirects resolve to a real URL (verify in the Redirect Editor)

---

*See also: the **Redirects** walkthrough (how targets resolve to URLs) and [the User Guide](../USER_GUIDE.md).*
