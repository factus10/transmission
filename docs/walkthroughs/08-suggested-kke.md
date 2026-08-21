# Suggested_KKE Walkthrough

How to get the app to *propose* a Keep/Kill/Evolve call so you confirm rather than start from scratch — combining rubric logic, AI judgment, and analytics into one suggestion.

> Prerequisite: a file is open. AI assessment needs a **Claude API key** (App Settings); GA needs analytics columns in your data.

---

## 0. The mental model

**Suggested_KKE** is a thin **orchestrator** over up to three independent sources:

- **Rubric** — deterministic rules you write (a small DSL over field values + content checks).
- **AI** — Claude's judgment on the page, written into the assessment result.
- **GA** — a composite score from analytics metrics (sessions, engagement, …).

Each source produces its own recommendation; the orchestrator combines them by **weighted vote** into one **Suggested_KKE**, and records the per-source breakdown. **It never touches your human KKE call** — suggestions sit alongside for you to confirm or override.

---

## 1. Set up the sources

All three are configured from **Project Settings → Suggestions**:

- **GA Analytics** — map your analytics columns (sessions, engagement rate, …), set metric weights and Keep/Evolve thresholds.
- **Rubric** — point at your rubrics folder (App Settings → Rubrics folder) and run the batch.
- **Source weights** — how much each source counts (GA / Rubric, 0–5), with **Save weights & recompute**.

---

## 2. Generate suggestions

- **Rubric across a set:** filter to the rows you want, then **Project → Run Rubric on filtered rows…** (or **Assess** on a single page).
- **AI for the backlog:** **Project → AI Suggest for Unreviewed…** generates a suggestion for every **unreviewed** row via Claude (≈1s/row, spends credits; **Esc** aborts). It writes only the assessment result — your KKE column is untouched.
- **GA:** **Project → Refresh GA KKE** recomputes the analytics recommendation.

Each of these automatically rolls its output into **Suggested_KKE** via the orchestrator. To re-run the combine step alone: **Project → Recompute Suggested KKE**.

---

## 3. Read and act on suggestions

In the **Decide** cluster, the **Suggested_KKE badge** shows the winning rec (e.g. "GA: Kill" / "Rubric: Evolve"). Click it for a **popover** listing every source, its rec, and the winner.

When sources **disagree**, the badge gets a dashed amber border + **⚠** and the popover highlights the conflict. Two sidebar special filters surface these:

- **Suggested disagrees** — the sources didn't agree internally.
- **Suggested ≠ your call** — the suggestion differs from the KKE you set.

> Workflow: confirm the easy agreements fast, then filter to **Suggested ≠ your call** and **Suggested disagrees** to spend your judgment only where it matters.

---

## Quick checklist for "suggestions working"

- [ ] At least one source configured (rubric / AI / GA)
- [ ] **Source weights** reflect how much you trust each
- [ ] Suggestions generated (batch rubric / AI unreviewed / GA refresh)
- [ ] Reviewed **disagreements** and **mismatches** via the sidebar filters
- [ ] Human **KKE** confirmed where it counts (suggestions are inputs, not decisions)

---

*See also: the *Rubric DSL* reference, the **Content Types & Crosswalk** walkthrough, and [the User Guide](../USER_GUIDE.md).*
