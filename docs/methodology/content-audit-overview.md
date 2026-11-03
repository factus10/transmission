---
title: Content Audit Overview
status: working
last-reviewed: 2026-04-28
---

# Content Audit Overview

A content audit is a systematic review of every page on a site to decide what stays, what changes, what merges, and what goes — and to capture the rationale and downstream actions for each decision.

## Why we do them

Most audits get commissioned for one of three reasons:

1. **Migration** — the site is moving to a new platform, IA, or design system. Without an audit, the migration carries forward years of accumulated content debt.
2. **Performance** — traffic is declining or stagnant. The site has too many pages diluting topic authority and crawl budget.
3. **Editorial reset** — content has drifted from strategy. The audit re-grounds the site around current goals.

The work is similar in all three cases. The deliverables differ.

## What an audit produces

A finished audit produces (at minimum):

- **Per-page disposition** — a recommendation for each URL (migrate, revise, archive, consolidate, defer, etc.)
- **Rationale** — why we made that call (notes, tags, rubric outputs)
- **Downstream actions** — redirect maps, content briefs, IA assignments
- **Reports** — summaries by section, by recommendation, by content owner

## How an audit fits in an engagement

```
┌─ Discovery ──────┐  ┌─ Audit ─────────┐  ┌─ Plan ──────────┐  ┌─ Build ──────┐
│ Stakeholder      │  │ Crawl + GA      │  │ IA finalized    │  │ Content      │
│ interviews       │─►│ Per-page review │─►│ Migration plan  │─►│ produced /   │
│ Goals defined    │  │ SME review      │  │ Redirect map    │  │ migrated     │
│ Rubric drafted   │  │ Conflict resol. │  │ Content briefs  │  │ Site ships   │
└──────────────────┘  └─────────────────┘  └─────────────────┘  └──────────────┘
```

The audit sits between Discovery (what should the site become?) and Plan (how do we get there?). It produces the data layer the Plan phase consumes.

## The decision the audit is trying to capture

For every page, an auditor is implicitly answering five questions:

1. **Scope** — Is this page in this audit at all?
2. **Content fate** — What should happen to the content of this page?
3. **URL fate** — What should happen to this URL?
4. **Confidence** — Are we sure, or do we need more input?
5. **Authority** — Who's making this call (auditor / SME / analytics / AI)?

The classic single-column framework ([MRA, formerly KKE](./kke-classic.md)) compresses these into a single column. Most of the [patterns we hit](./patterns.md) trace back to that compression.

The proposed [Content Audit Disposition (CAD)](./content-audit-disposition.md) framework decompresses them into separate columns.

## What an audit doesn't produce

- **The new IA.** That's an output of the Plan phase, informed by the audit but not produced by it.
- **The new content.** Content briefs come out of the audit; the writing happens in Build.
- **The strategy.** The audit assumes a strategy exists and tests pages against it. If you don't have a strategy, you're not ready for an audit.

## Practices that feed the audit

- **Rubrics** — the criteria each page is evaluated against. (Page TBD — see [related practices roadmap](./related-practices-roadmap.md).)
- **SME review workflow** — how subject matter experts validate auditor recommendations. (Page TBD.)
- **Nav and IA decisions** — how pages map to the future site structure. (Page TBD.)
- **Analytics-informed scoring** — how GA4 data refines recommendations. (Page TBD.)
- **AI-assisted assessment** — how AI evaluates content against rubrics. (Page TBD.)

## See also

- [KKE: The Classic Framework](./kke-classic.md)
- [Why MRA Falls Short — The Five Dimensions](./the-five-dimensions.md)
- [Patterns Where MRA Breaks](./patterns.md)
- [Glossary](./glossary.md)
