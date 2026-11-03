# Bulk Operations Walkthrough

How to apply one decision to many pages at once. Once you can filter (see **Finding the Work**), bulk operations are what turn a 4,000-row crawl into an afternoon's work instead of a week's.

> Prerequisite: a file is open, and you can narrow the list with filters.

---

## 0. The mental model

The **Multi-bar** at the bottom of the sidebar acts on a target set, chosen by one simple rule:

- If you've **multi-selected** rows, the target is your selection.
- Otherwise, if a **filter is narrowing** the list, the target is the **filtered rows**.

The bar's label tells you which — *"Apply to N selected:"* vs *"Apply to N filtered:"* — so you always know what you're about to change.

---

## 1. Select rows (or just filter)

Two ways to define the target:

- **Filter only** — narrow with search / MRA / field filters (see **Finding the Work**) and let the Multi-bar act on the whole filtered list. Fastest for "everything matching X."
- **Multi-select** — **Cmd+click** toggles individual rows; **Shift+click** selects a range. Use this when you want a hand-picked subset of what's on screen.

> Multi-select beats filter when the rule is in your head, not in the data ("these five, not those two"). Filter beats multi-select when the rule is expressible ("all 404s").

---

## 2. Apply an action

In the **Multi-bar**:

1. Pick an **Action…**: **Set MRA**, **Set Published Status**, **Set Content Type**, **Set Content Theme**, **Set Group**, **Set Primary Tag**, or **Add Tag**.
2. Pick the **value** (the second dropdown populates from your libraries).
3. **Apply**.

**Clear selection** drops the multi-selection (returning the target to "filtered").

> Gotcha: bulk-setting MRA to **Archive** on pages that already have a sitemap assignment or redirect triggers a **cleanup prompt** — choose whether to clear those too, so you don't leave orphaned redirects.

---

## 3. Batch assess (rubric → Suggested_MRA)

To score many pages at once rather than set a call by hand:

- **Project → Run Rubric on filtered rows…** runs the rubric across the filtered set and feeds **Suggested_MRA** (see the **Suggested_MRA** walkthrough). This produces *suggestions*, not final calls — you still confirm.

---

## Quick checklist for "good bulk ops"

- [ ] The Multi-bar label confirms the right target (**selected** vs **filtered**) before you Apply
- [ ] Filter narrowed correctly — spot-check a couple of rows first
- [ ] Archive-cleanup prompt handled (redirects / nav cleared where intended)
- [ ] Used **batch assess** for scoring, hand-set MRA only where judgment is needed
- [ ] Saved (**Cmd+S**)

---

*Next: **Tagging, Grouping & the Glossary** — the vocabulary layer. See also [the User Guide](../USER_GUIDE.md).*
