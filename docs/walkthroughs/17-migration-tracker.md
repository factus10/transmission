# Migration Tracker Hand-off Walkthrough

How to package the whole audit into one multi-sheet workbook the migration team can execute against — the single artifact that carries decisions, build metadata, redirects, and the kill list.

> Prerequisite: KKE calls, sitemap placement, and (ideally) build metadata in place. Run the **Pre-Handoff Check** first.

---

## 0. The mental model

- The Migration Tracker is **the engineering deliverable**: a single `.xlsx` with four purpose-built sheets, each answering one team's question.
- It's generated from current state — re-export anytime as the audit evolves.
- Each sheet is pre-tuned (frozen header row, sized columns) to be worked in directly.

---

## 1. Export it

**Migration → Migration Tracker…** opens the export dialog with sheet/option toggles. Choose what to include (e.g. whether Kill/Exclude rows appear in Source Pages, whether phased nodes are included), then export. Default filename: `{project-slug}-migration-tracker-YYYY-MM-DD.xlsx`.

---

## 2. What each sheet carries

- **Sitemap Plan** — one row per sitemap node: sort, number, breadcrumb, label, URL, **Page Status**, **Build Pattern**, **Builder / Writer**, build guidance, writer brief, migration notes, source-page count, net-new flag, phase, in-menu, external URL. The build team's master plan.
- **Source Pages** — audit rows joined to their sitemap node: KKE / Final KKE / Suggested KKE, Content Type, Group, Primary Tag, and the target breadcrumb / path / pattern / status. The "where does each old page go" map.
- **Redirects** — Kill rows + non-Kill URL changes; intentional `404`s surface as "(404) — intentional deindex".
- **Archive** — Kill rows with their notes and tags, for client reference (what was removed and why).

---

## 3. When to re-export

Re-run after any meaningful change — new placements, build-metadata edits, redirect changes. The tracker is a snapshot, not a live link; hand off the latest export.

---

## Quick checklist for "tracker ready"

- [ ] **Pre-Handoff Check** clean before exporting
- [ ] Sheet/option toggles set for this hand-off (Kill inclusion, phased nodes)
- [ ] **Sitemap Plan** carries the build metadata the team needs
- [ ] **Redirects** sheet matches the Redirect Map
- [ ] Exported with a clear, dated filename

---

*Next: **Pre-flight & Hand-off** — the final validation pass. See also the **Build & Direction** and **Redirects** walkthroughs.*
