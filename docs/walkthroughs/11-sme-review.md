# SME Review Walkthrough

How to get subject-matter experts to validate your KKE calls without giving them the app — a round-trip through a self-contained spreadsheet they fill in and you reconcile.

> Prerequisite: KKE calls made on the pages you want reviewed.

---

## 0. The mental model

The loop is **export → reviewer fills dropdowns → import → resolve**:

- You **export** a standalone `.xlsx` with built-in dropdowns. The SME needs only Excel.
- They record an **SME Decision** per page (approve your call, or change it) plus notes.
- You **import** their file back, **compare** their decisions against yours, and **resolve** every conflict into a **Final KKE**.

The SME's columns (**SME_Decision**, **SME_Notes**, **Content_Owner**) merge in alongside your audit — they never overwrite your original KKE.

---

## 1. Export for review

1. **SME → Export for SME Review…** opens the export modal.
2. Optionally **split by Content Owner** — produces one file per owner so each reviewer sees only their pages.
3. The export uses ExcelJS to embed **data-validation dropdowns** (so SMEs pick from a fixed list, not free-type), and ships.

> The file is fully standalone — hand it off by email; the reviewer needs no install.

---

## 2. Reviewer fills it in

Each page row offers an **SME Decision**: **Approve** the recommendation, or **Change: Keep / Kill / Evolve / Exclude**, with room for **SME Notes** and **Content Owner**. They fill, save, send it back.

---

## 3. Import their decisions

**SME → Import SME Decisions…** reads the returned file (pick the sheet if prompted) and merges **SME_Decision**, **SME_Notes**, **Content_Owner** into your working data — matched by URL, leaving your KKE column intact.

---

## 4. Compare and resolve

- **SME → Compare KKE vs SME…** shows where the SME agreed vs. diverged from your call — a quick read on the review.
- **SME → Resolve Conflicts…** reconciles into **Final_KKE**: where the SME **approved**, Final matches your KKE; where they chose **Change: X**, Final becomes their override.

Two sidebar special filters help you work the list: **SME conflicts** and **SME pending**.

> Turn on **Show SME fields** (App Settings) to see SME Decision / Final KKE / Content Owner inline in the **Decide** cluster while you reconcile.

---

## Quick checklist for "SME review complete"

- [ ] Exported (split by owner if multiple reviewers)
- [ ] Reviewer file(s) imported — SME columns populated
- [ ] **Compare KKE vs SME** reviewed for divergence
- [ ] **Resolve Conflicts** run — every reviewed page has a **Final KKE**
- [ ] **SME conflicts / pending** filters are empty
- [ ] Saved (**Cmd+S**)

---

*Next: **Multi-auditor Merge** — combining work from several auditors. See also [the User Guide](../USER_GUIDE.md).*
