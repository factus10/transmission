# Pre-flight & Hand-off Walkthrough

The final pass before you ship: one command that runs every validation, plus the change log that proves what was decided. Do this last, every time.

> Prerequisite: the audit, sitemap, and redirects are substantially complete.

---

## 0. The mental model

- The **Pre-Handoff Check** rolls every validation the app knows how to do into a single pass/issue report — so you don't have to remember to run six separate checks.
- It's a **gate, not a fix**: it tells you what's wrong and how to fix each, with a sample of offending rows. Fix, re-run, repeat until clean.
- The **change log** is your audit trail — every decision change, captured automatically, written to the file on save.

---

## 1. Run the Pre-Handoff Check

**Migration → Pre-Handoff Check…** runs all of these at once and reports "**Ready for handoff**" or "**N issues across M checks**":

1. **Every page has an MRA decision** — no unreviewed rows.
2. **Consolidate pages point to a target** — no dangling consolidations.
3. **Consolidate targets are live** — none point at an Archive/Exclude page.
4. **No redirect chains** — no Archive redirecting into another Archive/404.
5. **No duplicate nav IDs** — *(nav-tree files only)*.
6. **No empty nav leaves** — *(nav-tree files only)*.

Each failing check lists a sample of the offending pages and a one-line fix (which filter to use, which editor to open). Nav checks are skipped automatically if the file has no Sitemap sheet.

> Work top-down: clear unreviewed pages first (they cascade into the other checks), then consolidations, then redirects, then nav. Re-run after each batch.

---

## 2. Export the check (optional)

The Pre-Handoff Check is itself a report — export it to **PDF / HTML** as evidence the audit passed its gate, to attach to the hand-off.

---

## 3. The change log

Every change to a decision field (MRA, SME Decision, Final MRA, and auto-filled classifications) is logged to **`_sessionChangeLog`** during the session and appended to the **MRA_ChangeLog** sheet on **Save** — timestamp, row, URL, field, old value, new value. It accumulates across sessions, so the file carries a complete history of how the inventory was decided.

---

## Quick checklist for "ready to hand off"

- [ ] **Pre-Handoff Check** reports **Ready for handoff** (0 issues)
- [ ] All six checks pass (or nav checks legitimately N/A)
- [ ] Check report exported as evidence if the process requires it
- [ ] Final **Save** — change log written to the file
- [ ] Outputs generated: reports, **Redirect Map**, **Migration Tracker**

---

*This is the end of the lifecycle. See also: **Producing the Outputs**, **Migration Tracker**, and [the User Guide](../USER_GUIDE.md).*
