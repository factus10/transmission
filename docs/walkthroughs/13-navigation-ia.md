# Sitemap & IA Walkthrough

How to build the **future-state sitemap** and place every page you're keeping onto it. This is where the audit stops being a list of pages and becomes the shape of the new site.

> Prerequisite: you've made KKE calls (at least **Keep** / **Evolve**) on the pages that matter. Placement operates on those rows; **Kill** and **Consolidate** pages don't get placed (they fold into a target or redirect).

---

## 0. The mental model

- The **audit rows** answer "what do we do with each *existing* page?"
- The **sitemap** answers "what is the *new* site?" — its sections, hierarchy, and URLs.
- You connect the two by **placing** each Keep/Evolve page onto a sitemap node. A node can carry **0** source pages (net-new), **1**, or **many** (a consolidation target).
- The tree is the source of truth for breadcrumbs and the computed URL of every node. Rename a node and the change cascades to its descendants and to every page assigned under it.

Open the tree with **Cmd+Shift+T** (or the **Sitemap** tab in the view switcher). The **stats line** under the toolbar is your dashboard — learn to read it (see §6).

> Starting fresh? You don't have to open the Sitemap first. On any page in the **Audit** view, clicking the audit bar's **Sitemap** button when the sitemap is still empty offers an inline form (Label prefilled from the title, Slug from the URL) and a **Create & assign** button that creates the first root node and assigns the page in one step.

---

## 1. Place every Keep/Evolve page

Goal: drive **need placement** in the stats line to **0**.

"Need placement" = Keep/Evolve rows with no sitemap node yet. To find and assign them:

1. **Audit** view (**Cmd+1**) → **KKE** filter → check **Keep** + **Evolve** → **+ Field filter** → field `Sitemap_ID`, operator **is blank** → **Apply**.
2. For each row, click **Sitemap** (in the **DECIDE** cluster) → drill to the right node → **Assign**. Use **+ Child** in the picker footer to create a new node inline if no good home exists yet.
3. To place many similar pages at once: multi-select them in the sidebar (**Cmd/Shift-click**), then **drag the selection onto a node** in the tree.

> Fast path: the stats line's **N need placement** link is clickable — it jumps you straight to the audit view filtered to exactly those rows. Work the list down to zero.

Consolidation note: pages you marked **Consolidate** don't need placement — they fold into their target. The *target* page (usually **Evolve**) is what gets the sitemap node.

---

## 2. Shape the future-state tree

In the **Sitemap**:

- **Rename / re-slug** inline — double-click the label, or open the **✎** node editor. The **Label** drives the breadcrumb; the **Slug** drives the computed URL segment. Changes cascade to descendants and assigned pages.
- **Reorder / reparent** by dragging the grip handle. Top/bottom third of a row = move as a sibling; middle = drop *into* the row as a child.
- **Add** nodes: **+ Root Node** (toolbar) or the **+** on a row.
- **Clone branch** (**⧉**) deep-copies a node and its children as a sibling — structure only, no page assignments.
- **Remediate** (toolbar) ensures every assigned page has a child node in the tree — useful after a bulk reorganization.

> Gotcha: duplicate slugs inside the same branch are highlighted in red. Two children of one parent can't share a slug — they'd collide on the same URL.

---

## 3. Node type, references, and external links

Open a node's editor (double-click the label, or **✎**). The top fields define what kind of node it is:

- **Node type** — **Page (standard)** / **Header / organizing level** / **Fragment / shared content**. A **Header** is a grouping level with no page of its own; a **Fragment** is shared/embedded content with no menu entry, breadcrumb, or redirect (see the Build & Direction walkthrough).
- **In menu** — toggles whether the node appears in the navigation menus. (**Set Menu ✓** / **Clear Menu** in the toolbar bulk-toggle this for all *visible* nodes — combine with the Depth filter.)
- **External URL** — point a menu item at an outside URL instead of a built page.
- **Reference** — alias this node to another node (a "→ breadcrumb" target) so the same destination can appear in two places without duplicating it.

> Menus are built separately (the **Menus** view / **Cmd+Shift+M**), but you can add a page to one without leaving the audit: the audit bar's **Menu** button first ensures the page is on the sitemap, then lets you pick an existing menu, start a **+ New menu…**, or create your first menu on the spot.

---

## 4. Phase out-of-scope work

Not everything in the tree ships in this build. In the node editor, set **Phase**:

- **— Current build (default)** — counts toward the live build.
- **Future / Aspirational**, **Stretch goal**, **Archived**, or any custom value — excluded from the "current" counts and optionally from exports.

Phased nodes get a phase badge in the tree and never raise a net-new "NEW" badge. Filter by phase with the toolbar **Phase:** dropdown (**All** / **Current build only** / **Non-current only**). On export you'll be asked whether to include phased nodes.

---

## 5. Read the gap signals

Two badges tell you where the tree is incomplete:

- **NEW** (yellow, in the Pages column) — a **net-new** node: it has descendant pages but no source page of its own. Expected for brand-new sections; a flag if you didn't mean it.
- **Empty leaf** (red) — a node with no pages *and* no redirects pointing at it. Either assign content, mark it net-new, phase it, or delete it before hand-off.

A **⚠ N duplicate IDs** link appears in the stats line if any Sitemap_ID is assigned to two nodes — click it to auto-renumber the duplicates.

---

## 6. Track coverage in the stats line

The stats line reads, in order:

`N nodes · M current (A assigned, H net new, E empty) · [phase buckets] · P pages placed · [F fragments] · [status tallies] · X need placement`

- **need placement → 0** is your "every Keep/Evolve page is in the IA" check (§1).
- **empty** is your coverage-gap count (§5).
- **status tallies** (e.g. "5 built · 3 in progress") track build completion — covered in the Build & Direction walkthrough.

**Filter the tree** with the toolbar dropdowns:
- **Depth:** collapse to a level (then bulk **Set Menu ✓** / **Clear Menu** on what's visible).
- **Phase:** current vs. non-current (§4).
- **Build:** by status / assignee / pattern / guidance presence (Build & Direction walkthrough).

Also: **Collapse All** / **Expand All**, and fold state persists across re-renders.

---

## 7. Resolve overlapping pages (optional)

If several pages landed on one node, they may be consolidation candidates:

- Toolbar → **Consolidation Candidates…** lists every node with **2+** assigned pages. Pick the target (→ **Evolve**); the rest become **Consolidate** pointing at it, with their sitemap assignment cleared.

---

## 8. See it and report on it

**Visual Sitemap** — toolbar **Sitemap**: a box-style tree where solid borders = in-menu, dashed = not in menu, fill color = build pattern, a stacked shadow = hidden children, and a corner badge = page count. Toggle **Menu items only**, switch **Visual / Text Tree** tabs, zoom/pan, and export as **PDF** or **SVG/HTML**.

**IA & coverage reports:**
- **IA Report** (toolbar) or **Reports → Sitemap & IA…** — the sitemap with per-node page and redirect counts; flags empty, redirect-only, and header nodes.
- **Reports → Sitemap Coverage Report…** — empty leaves, hubs, overloaded nodes, and path mismatches.
- **Reports → Net New Content Brief…** — every node that needs brand-new content.

---

## Quick checklist for "good IA"

- [ ] **need placement = 0** — every Keep/Evolve page sits on a node
- [ ] No **empty** leaf nodes left unexplained (assign / net-new / phase / delete)
- [ ] No **duplicate Sitemap_ID** warning in the stats line
- [ ] No red **duplicate-slug** highlights within a branch
- [ ] **In menu** set correctly on every node that belongs in navigation
- [ ] Phased work is marked **Future / Stretch / Archived**, not left in the current build
- [ ] Net-new sections are intentional, not accidental **NEW** badges

---

*Next: **Build & Direction** — annotate these nodes with target specs, build metadata, and Builder / Writer / Migrator assignments, then generate the per-person worklists. See also `USER_GUIDE.md`.*
