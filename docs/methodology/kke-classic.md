---
title: KKE — The Classic Framework
status: stable
last-reviewed: 2026-04-28
---

# KKE — The Classic Framework

The four-state vocabulary used in most content audits today, including most of ours. This page documents what KKE *is* and how it's used. The argument for moving past it lives in [Why KKE Falls Short](./the-five-dimensions.md).

## The four states

### Keep
Content is high-quality, on-strategy, performing well. Migrate as-is. URL may stay or move depending on IA changes; content stays.

**Typical signals:** healthy traffic, positive engagement metrics, current information, no overlap with other pages.

### Kill
Content is low-quality, off-strategy, redundant, or has no audience. Remove it. URL retires (with a redirect to the most appropriate destination, or a deliberate 404).

**Typical signals:** zero or near-zero traffic, outdated information, broken purpose (e.g. event pages from past events), redundant with better-performing pages.

### Evolve
Content has value but needs work. Improve in place — rewrite, expand, restructure, update — without changing its identity. URL typically stays.

**Typical signals:** decent traffic but high bounce, partially current information, gaps in coverage, structurally outdated.

### Exclude
Page should not be part of the audit's recommendations. Either it shouldn't have been crawled in the first place, or it's out of scope.

**Typical signals:** crawl noise (sitemap fragments, JSON endpoints, search result pages), administrative URLs, pages owned by another team, regulated content under legal hold.

> **Note:** the auditor convention has historically conflated several distinct uses of Exclude. See [Patterns: The Post-Launch Problem](./patterns.md#a-the-post-launch-problem) and [Why KKE Falls Short — Scope dimension](./the-five-dimensions.md#scope).

## Sibling frameworks

KKE is one of several four-bucket triage rubrics used in the industry. They share the same architecture — a single column of mutually-exclusive labels — and the same limitations.

| Framework | Values | Notes |
|---|---|---|
| **KKE** | Keep / Kill / Evolve / Exclude | The version we use most often. |
| **MRA** | Migrate / Revise / Archive | Migration-flavored. "Archive" is closer to "Exclude" than to "Kill." |
| **KKER** | Keep / Kill / Evolve / Replace | Adds Replace as distinct from Evolve. Closer to acknowledging Content Fate as a real dimension. |
| **CCC** | Cull / Consolidate / Create | More strategic-flavored. Notably includes Consolidate as a first-class state — most other frameworks don't. |
| **Triage** | Various, often Keep / Fix / Toss | Informal. |

All of them share KKE's compression problem. None of them addresses Authority or Confidence as real dimensions.

## The fifth state: Consolidate

We've added **Consolidate** as a fifth state in our practice. It means: *this page is going away, and its content is being merged into another page in the inventory.* The destination is recorded in a `Consolidate_Into` column.

Consolidate is the merge option. Without it, auditors are forced to choose between:

- Kill (which discards the content's value)
- Evolve (which leaves cannibalization in place across multiple "improved" pages)

Neither is right when the correct decision is "merge these into one canonical page."

Consolidate brings its own data requirements: the target URL must be picked, the redirect must chase the target through any URL changes the target itself goes through, and SMEs need a way to recommend it (`Change: Consolidate`). See [the audit tool's Consolidate workflow](../USER_GUIDE.md#9-consolidate) for the operational specifics.

## When KKE works well

KKE is genuinely useful as a **client-facing summary**:

- "We reviewed 3,400 pages: 1,100 Keep, 1,200 Kill, 800 Evolve, 200 Consolidate, 100 Exclude."
- The five labels fit on one line of a deck.
- Stakeholders grasp the categories instantly.

It also works fine for **simple sites** where the patterns in [Patterns Where KKE Breaks](./patterns.md) don't show up in volume.

## When KKE breaks down

The five-state vocabulary stops being enough when:

- Multiple authorities (auditor, SME, analytics, AI) disagree about the same page
- Pages need to be deferred without being excluded
- The page is high-quality but its URL is changing
- One page should become two or three pages
- Multiple pages should become one

The [Five Dimensions analysis](./the-five-dimensions.md) explains why these break the model. The [Patterns page](./patterns.md) catalogs how they show up in real engagements.

## See also

- [Content Audit Overview](./content-audit-overview.md)
- [Why KKE Falls Short — The Five Dimensions](./the-five-dimensions.md)
- [Patterns Where KKE Breaks](./patterns.md)
- [Content Audit Disposition (CAD)](./content-audit-disposition.md)
