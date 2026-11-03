---
title: Why MRA Falls Short — The Five Dimensions
status: working
last-reviewed: 2026-04-28
---

# Why MRA Falls Short — The Five Dimensions

The core argument: **MRA compresses five independent decisions into one column**. The compression is invisible while audits are simple, then surfaces as a series of subtle bugs as audits get realistic.

This page enumerates the dimensions. The [Patterns page](./patterns.md) shows where they collide with reality.

---

## 1. Scope — Is this page in this audit?

Not every page in the crawl is part of the audit's purview. Scope answers "should we be making decisions about this page at all?"

| Value | Meaning |
|---|---|
| **InScope** | Actively being audited |
| **OutOfCrawl** | Got crawled but isn't real content (search results, admin URLs, JSON feeds, sitemap fragments, infinite-scroll variants) |
| **Deferred** | Valid content, not in this audit cycle (post-launch sections, next-phase work, future redesign scope) |
| **OutOfAuthority** | Owned by another team/department/engagement, not yours to decide |
| **ComplianceHold** | Can't be touched without legal review (regulated industries) |
| **ThirdParty** | Aggregated content from another system (job listings, partner content, syndicated feeds) |

MRA collapses all of these into "Exclude." That's why the [Post-Launch problem](./patterns.md#a-the-post-launch-problem) keeps coming up — different reasons for being out-of-audit have different downstream implications, but they look identical in the data.

---

## 2. Content Fate — What happens to the content?

Independent of scope and URL. Answers "what should the content of this page become?"

| Value | Meaning | MRA equivalent |
|---|---|---|
| **Preserve** | Content stays as-is | Migrate |
| **Improve** | Content is revised in place; retains identity | Revise |
| **Replace** | Content is completely rewritten; new content, same role | (none — usually shoehorned into Revise) |
| **Merge** | Content is absorbed by another page | Consolidate |
| **Split** | Content becomes 2+ pages | (none — usually noted in free text) |
| **Retire** | Content is removed | Archive |

Two of these are missing from MRA: **Replace** and **Split**.

- **Replace matters** because "improve in place" implies iteration. A page that's stylistically dated but topically fine is Revise. A page whose entire premise is wrong but whose URL is valuable is Replace. The content team needs to know which.
- **Split matters** because the inverse of Consolidate happens too. One page doing three jobs (about the team + about services + about history) should become three pages.

---

## 3. URL Fate — What happens to the URL?

Mostly independent of content fate.

| Value | Meaning |
|---|---|
| **Preserve** | URL stays exactly as it is |
| **Move** | URL changes via nav reorganization (the page is Migrate but lives at a new path) |
| **Redirect** | URL retires; redirect points elsewhere |
| **404** | URL retires; no redirect (deliberate, e.g. for thin or noisy URLs) |

Why this is independent:

- A Migrate page can get a new URL because the IA reorganized. Same content, different address.
- An Archive page can have no redirect (intentional 404 for low-value or duplicate URLs).
- A Consolidate page always redirects (to the target).
- A Revise page can keep its URL or move it.

MRA's single column tangles content fate and URL fate. Our audit tool fixes this implicitly with separate columns (`MRA_Recommendation` + `Redirect_Destination` + nav `Computed Path`), but the framework's vocabulary doesn't expose the distinction.

---

## 4. Process State — Where is this decision in the workflow?

Decisions move through a process. Where this row sits in that process is itself a piece of information.

| Value | Meaning |
|---|---|
| **Unreviewed** | Auditor hasn't looked yet |
| **InReview** | Examined; need more research before deciding |
| **Decided** | Auditor is confident |
| **PendingSME** | Sent for expert review |
| **PendingStakeholder** | Sent for business decision |
| **Resolved** | Final answer |

MRA has implicit Unreviewed (blank) and Decided (filled in). The middle states are real — auditors absolutely encounter pages they need more info on — but there's no clean place to put them. They get parked in Notes, with the Flag bookmark, or in Tags.

The audit tool's `Final_MRA` column hints at this dimension: it's a separate column because the resolution is a separate moment from the initial recommendation. But the pattern stops at SME — it doesn't generalize to "needs research" or "pending stakeholder."

---

## 5. Authority — Whose decision is this?

The audit tool's column proliferation makes this dimension extremely visible:

| Column | Authority |
|---|---|
| `MRA_Recommendation` | Auditor |
| `SME_Decision` | Domain expert |
| `GA_MRA_Recommendation` | Analytics-derived (PERCENTRANK on traffic + engagement) |
| `AI_MRA` | AI pattern-match against rubric |
| `Final_MRA` | The synthesis |

Each authority has different weight on different pages:

- A page with high traffic and strong engagement should weight Analytics heavily.
- A page about regulated medical content should weight SME heavily.
- A purely promotional page should weight Auditor + Stakeholder.

MRA-as-originally-conceived assumed one authority per page — the auditor. The audit tool has effectively built a parallel system of authority-stamped recommendations. Treat that as the framework, not as an exception.

### Authority requires governance

Once you accept that an audit has multiple authorities producing recommendations, you also have to accept that authority-stamped vocabularies degrade without active management:

- SMEs invent their own labels (`Change: Consolidate`, `Change: Post-Launch`, `Revise - Post`)
- Multiple auditors over multiple cycles introduce variants (`Post Launch` vs `Post-Launch`)
- Imports from other tools bring legacy values

A framework that treats Authority as a real dimension has to provide [vocabulary governance](./vocabulary-governance.md). Otherwise "multiple authorities" silently becomes "vocabulary drift," which silently becomes "the data column says one thing, the report says another, the migration team trusts neither."

---

## What this analysis enables

Once you've named the five dimensions, you can ask cleaner questions:

- "Why is this page hard to classify?" → which dimension is the source of the difficulty?
- "Why don't auditors agree?" → are they disagreeing on Content Fate or URL Fate or Scope?
- "Why does the migration team trust the audit data less than they should?" → is governance failing? Is Authority being flattened?

It also enables the [proposed CAD framework](./content-audit-disposition.md), which decompresses these dimensions into separate columns.

---

## See also

- [KKE: The Classic Framework](./kke-classic.md) — the four-state vocabulary MRA renames, and what each state means
- [Patterns Where MRA Breaks](./patterns.md) — concrete examples of the dimensions colliding
- [Content Audit Disposition (CAD)](./content-audit-disposition.md) — what to do about it
- [Vocabulary Governance](./vocabulary-governance.md) — the operational layer Authority requires
