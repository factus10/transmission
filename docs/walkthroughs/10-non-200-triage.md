# Non-200 Triage Walkthrough

How to clear out the redirects, 404s, and server errors in a crawl in one sweep — so broken and non-canonical URLs don't clutter the real content audit.

> Prerequisite: a file open with an HTTP **Status Code** column (standard in Screaming Frog exports).

---

## 0. The mental model

- A crawl is full of non-200 URLs: 3xx redirects, 4xx not-founds, 5xx errors. Most of these aren't content decisions — they're cleanup.
- Triage groups them **by status code** and lets you set a sensible default KKE for each whole group at once, rather than one row at a time.
- The app pre-fills smart defaults (3xx → Kill, 404 → Kill, 5xx → Exclude, …); you adjust, then **Apply**.

---

## 1. Open triage

- **Project → Triage Non-200 Pages…**, or accept the **auto-offer** that appears when a freshly opened file contains non-200 rows.

The dialog shows a table: one row per status code, with its label (e.g. "301 — Moved Permanently"), the page count, and a **KKE action** dropdown pre-set to the recommended default.

---

## 2. Set actions and apply

1. Review each code group's pre-filled action; change any that need a different call.
2. Leave a group's action **blank** to skip it.
3. **Apply** batch-sets KKE for every row in each group that has an action selected.

> Defaults are a starting point, not a verdict. A 301 that points somewhere you're keeping might be **Keep**, not **Kill** — adjust per group.

---

## 3. Spot them in the sidebar afterward

Non-200 rows carry a **status-code badge** in the sidebar: amber for **3xx**, red for **4xx / 5xx**. Use it to eyeball what's left, and the KKE filter to confirm nothing slipped through unreviewed.

---

## Quick checklist for "triaged"

- [ ] Ran triage (manually or via the auto-offer)
- [ ] Each code group given a deliberate action (or intentionally skipped)
- [ ] **Applied** — non-200 rows now carry KKE calls
- [ ] Sidebar shows no unexpected red/amber badges left unreviewed
- [ ] Saved (**Cmd+S**)

---

*See also: the **Redirects** walkthrough (turning Kills into redirect rules) and [the User Guide](../USER_GUIDE.md).*
