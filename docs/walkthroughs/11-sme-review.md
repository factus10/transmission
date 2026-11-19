# SME Review Walkthrough

How to get subject-matter experts to validate your MRA calls without giving them the app — a round-trip through a self-contained spreadsheet they fill in and you reconcile.

> Prerequisite: MRA calls made on the pages you want reviewed.

---

## 0. The mental model

The loop is **export → reviewer fills dropdowns → import → resolve**:

- You **export** a standalone `.xlsx` with built-in dropdowns. The SME needs only Excel.
- They record an **SME Decision** per page (approve your call, or change it) plus notes.
- You **import** their file back, **compare** their decisions against yours, and **resolve** every conflict into a **Final MRA**.

The SME's columns (**SME_Decision**, **SME_Notes**, **Content_Owner**) merge in alongside your audit — they never overwrite your original MRA.

---

## 1. Export for review

1. **SME → Export for SME Review…** opens the export modal.
2. Optionally **split by Content Owner** — produces one file per owner so each reviewer sees only their pages.
   Pages you asked the client about (**C**) travel with their status, priority and reason, sorted to the top (urgent first). Choose **Open client-review items only** to send just those.
3. The export uses ExcelJS to embed **data-validation dropdowns** (so SMEs pick from a fixed list, not free-type), and ships.

> The file is fully standalone — hand it off by email; the reviewer needs no install.

> **Clients from before the rename.** If a client's project started when the decisions were still Keep / Kill / Evolve, tick **Use Keep / Kill / Evolve wording** in the export dialog to send that one worksheet in the words they know. It isn't remembered for the next export. Whatever wording comes back, the import reads it as Migrate / Revise / Archive ("Change: Kill" becomes Archive; a bare "Keep" next to a Migrate recommendation counts as approval) and tells you how many decisions it re-worded.

---

## 2. Reviewer fills it in

Each page row offers an **SME Decision**: **Approve** the recommendation, or **Change: Migrate / Revise / Archive / Exclude**, with room for **SME Notes** and **Content Owner**. They fill, save, send it back.

---

## 3. Import their decisions

**SME → Import SME Decisions…** reads the returned file (pick the sheet if prompted) and merges **SME_Decision**, **SME_Notes**, **Content_Owner** into your working data — matched by URL, leaving your MRA column intact.

---

## 4. Compare and resolve

- **SME → Compare MRA vs SME…** shows where the SME agreed vs. diverged from your call — a quick read on the review.
- **SME → Resolve Conflicts…** reconciles into **Final_MRA**: where the SME **approved**, Final matches your MRA; where they chose **Change: X**, Final becomes their override.

Two sidebar special filters help you work the list: **SME conflicts** and **SME pending**.

A client question counts as **answered** as soon as `SME_Decision` has anything in it; nothing needs clearing. **Reports → SME Review Status** lists the ones still open by owner and reason, and **Client review: urgent (open)** finds the urgent ones, which block the Pre-Handoff Check. More: [Questions to the client](../USER_GUIDE.md#questions-to-the-client).

> Turn on **Show SME fields** (App Settings) to see SME Decision / Final MRA / Content Owner inline in the **Decide** cluster while you reconcile.

---

## Quick checklist for "SME review complete"

- [ ] Exported (split by owner if multiple reviewers)
- [ ] Reviewer file(s) imported — SME columns populated
- [ ] **Compare MRA vs SME** reviewed for divergence
- [ ] **Resolve Conflicts** run — every reviewed page has a **Final MRA**
- [ ] **SME conflicts / pending** filters are empty
- [ ] **Client review: urgent (open)** is empty
- [ ] Saved (**Cmd+S**)

---

*Next: **Multi-auditor Merge** — combining work from several auditors. See also [the User Guide](../USER_GUIDE.md).*
