# Multi-auditor Merge Walkthrough

How to combine KKE decisions when more than one auditor worked the same inventory in parallel — merge their file into yours and resolve the disagreements.

> Prerequisite: two audited copies of the **same** inventory (same URLs), each with KKE calls.

---

## 0. The mental model

- Two auditors split a large crawl, each making calls in their own copy of the file.
- Merging reads the **other** auditor's decisions, matches rows by URL, and reports **agreements** vs **conflicts** (where the two of you made different KKE calls on the same page).
- You resolve conflicts one at a time, choosing whose call wins — the merge never silently overwrites.

---

## 1. Run the merge

1. Open your copy.
2. **File → Merge Auditor Decisions…** and pick the other auditor's file.
3. The app matches rows and reports: how many decisions came in, agreements, and the number of **conflicts**. If there are none, you're done.

---

## 2. Resolve conflicts

When conflicts exist, a resolution dialog lists each one — the page, **your** call, and **their** call — with a running "N conflicts remaining" count. Work down the list, picking the correct call for each, until all are resolved.

> This reuses the same resolution pattern as SME conflict resolution, so it'll feel familiar if you've done an SME round.

---

## 3. Save the merged result

After resolving, **Cmd+S**. The merged decisions and the change-log entries persist to your file, which is now the combined source of truth.

---

## Quick checklist for "merge complete"

- [ ] Merged the other auditor's file into your copy
- [ ] Every reported **conflict** resolved (0 remaining)
- [ ] Spot-checked a few merged rows
- [ ] Saved (**Cmd+S**) — combined state is the canonical file

---

*See also: the **SME Review** walkthrough (same resolution UX for expert decisions) and `USER_GUIDE.md`.*
