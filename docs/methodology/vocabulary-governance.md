---
title: Vocabulary Governance
status: working
last-reviewed: 2026-04-28
---

# Vocabulary Governance

The operational layer that any multi-authority audit framework requires. Without it, controlled vocabularies degrade silently into noise.

## The problem

Audit data is produced by multiple authorities — auditors, SMEs, analytics tools, AI assistance, prior-engagement legacy data — and consumed by tools and humans downstream (migration teams, content writers, redirect implementers, dashboards). When the producers and consumers don't agree on the vocabulary, downstream output is wrong.

Common failure modes:

| Failure | Looks like | Caused by |
|---|---|---|
| **Typo variants** | `Post Launch` and `Post-Launch` both appearing in the data | Different SMEs / auditors, no validation, free text |
| **Whitespace drift** | `Post-Launch` and `Post-Launch ` (trailing space) treated as different | Excel paste, manual entry, copy from email |
| **Case drift** | `POST LAUNCH`, `Post-Launch`, `post-launch` | Different SMEs, no normalization step |
| **SME extensions** | `Change: Consolidate-with-X`, `Change: Defer to Phase 2` | SMEs writing prose where the dropdown should constrain |
| **Legacy import** | `Migrate`, `Archive` from a prior MRA-framework audit imported into a KKE workflow | Mid-engagement framework changes, multi-vendor history |

Each failure mode is invisible until a downstream consumer (a report, a redirect map, a count) trips on it. By then it's already in the deliverable.

## What governance looks like

Active management of the vocabulary throughout the audit lifecycle. Three responsibilities:

### 1. Detection

Surface mismatches automatically:

- **Rogue value detection** — flag any KKE value present in row data that isn't in the defined custom states or built-ins
- **Whitespace tolerance for matching** — `Post Launch` and `Post Launch ` should match the same defined state for purposes of counting
- **Case awareness** — `POST LAUNCH` vs `Post-Launch` is intentionally different (so users can normalize) but should be obvious in the UI

### 2. Normalization

Provide tools to merge / rename / consolidate:

- **Merge tooling** — pick a source value, pick a target, rewrite every row using the source. Update KKE_Recommendation, Final_KKE, and SME_Decision (`Change: <source>` → `Change: <target>`).
- **Bulk rename** — change a state's label, every reference updates
- **Per-row reassignment** — for cases where the same source value should split across multiple targets depending on context

### 3. Audit trail

Every normalization step is logged:

- Timestamp
- Field changed
- Old value
- New value
- Operator (auditor / system / merge action)

The change log is itself a structural sheet that travels with the file. Reviewers and downstream consumers can audit the audit.

## How it's currently implemented

In the audit tool today:

- **Custom KKE merge** (Project Settings) — pick a custom state, click Merge, choose target. Rewrites KKE_Recommendation, Final_KKE, and SME_Decision values; logs every cell change to the `KKE_ChangeLog` sheet.
- **Rogue value cleanup** — Project Settings shows a separate sub-section listing every KKE value present in row data that isn't built-in or in your custom states. Each gets a Merge button.
- **Whitespace-tolerant matching** — built into the rogue detection so trailing spaces don't create false rogues.
- **Change log** — every KKE / Final_KKE / SME_Decision change is logged with timestamp, row, URL, field, old value, new value. Persists across sessions in the `KKE_ChangeLog` sheet.

## What governance still doesn't cover

- **Multi-authority disagreement as a class** — when GA says Kill and SME says Evolve, that's not a vocabulary problem, but the absence of a clear escalation path means it gets resolved invisibly via Final_KKE.
- **Cross-engagement vocabulary** — if Engagement A used `Defer` and Engagement B uses `Post Launch`, there's no shared canonical vocabulary that survives across projects.
- **Validation at entry time** — currently we detect rogues after they're in the data. Stricter validation (constrain SMEs to defined values via dropdown only) would prevent the problem upstream, but at the cost of SME flexibility.

## Lessons for the framework

This page exists because [Authority](./the-five-dimensions.md#5-authority--whose-decision-is-this) is a real dimension. The moment you accept that, you accept that producers and consumers can disagree on vocabulary, and the framework owes you tooling to manage that.

The [proposed CAD framework](./content-audit-disposition.md) treats Authority as a first-class column-set rather than as an exception. A faithful CAD implementation has to design vocabulary governance up front — not bolt it on after a typo causes a downstream report to ship wrong.

## See also

- [Why KKE Falls Short — Authority](./the-five-dimensions.md#5-authority--whose-decision-is-this)
- [Content Audit Disposition (CAD)](./content-audit-disposition.md)
- [Patterns Where KKE Breaks — Pattern G](./patterns.md#g-multiple-authorities-disagree)
