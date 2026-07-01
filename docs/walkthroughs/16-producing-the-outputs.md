# Producing the Outputs Walkthrough

What every report is *for* and when to run it. The audit's value is in the deliverables — this is the map of which one answers which question.

> Prerequisite: an audited file. Most reports work with partial data, but read best once KKE calls, classification, and (for IA reports) the sitemap are in place.

---

## 0. The mental model

- Reports are **read-only views** generated on demand from the current file — run them anytime, as often as you like.
- Each renders in a preview, and every report **exports to PDF or HTML** (HTML opens cleanly in Word).
- They group into three audiences: **stakeholder** narratives, **IA/structure** analyses, and **delivery/engineering** hand-offs.

---

## 1. Stakeholder reports (Reports menu)

- **Executive Summary…** — the top-line story: counts by KKE call, what's being kept/killed/evolved, the shape of the work. Lead with this in a client readout.
- **Content Inventory by Section…** — the full inventory grouped by Group/section. The detailed "here's every page and its decision" appendix.
- **SME Review Status…** — where the expert review stands (approved / changed / pending). Run during the SME loop.

---

## 2. IA & structure reports

- **Sitemap & IA…** — the future-state sitemap with per-node page and redirect counts; flags empty / redirect-only / header nodes. (Also the **IA Report** button in the sitemap toolbar.)
- **Sitemap Coverage Report…** — empty leaves, hubs, overloaded nodes, path mismatches. The gap-finder.
- **Content Type Crosswalk…** — current → target content-type mapping with page counts; flags types missing a registry entry.
- **Component Inventory…** — UI-component frequency, one-offs, and co-occurrence (see the **Component Inventory** walkthrough).

---

## 3. Delivery & engineering reports

- **Migration Direction Brief…** — per-person worklists for the **Writer / Builder / Migrator** roles, grouped by target spec (see **Build & Direction**). Supports custom templates.
- **Migration Checklist…** — the retain / remove / update / redirect summary the migration team works from.
- **Net New Content Brief…** — every sitemap node that needs brand-new content written.
- **Redirect Map Report…** — Kill / URL-changed / intentional-404 redirects (see **Redirects**).

---

## 4. Export

In any report preview, use the **PDF** or **HTML** export buttons. HTML is best when the client wants to drop it into Word or a doc; PDF for a fixed deliverable.

> The **Migration Direction Brief** can be styled with custom Markdown templates — see the **Templates** walkthrough.

---

## Quick checklist for "outputs produced"

- [ ] **Executive Summary** for the client readout
- [ ] **Content Inventory** as the detailed appendix
- [ ] IA reports (**Sitemap & IA**, **Sitemap Coverage**) if the future sitemap is in scope
- [ ] **Content Type Crosswalk** if migration classification was done
- [ ] Delivery reports (**Migration Direction Brief**, **Checklist**, **Net New**) for the build team
- [ ] Each exported in the format the recipient needs (PDF / HTML)

---

*Next: **Migration Tracker Hand-off** — the multi-sheet engineering workbook. See also `USER_GUIDE.md`.*
