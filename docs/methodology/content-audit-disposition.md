---
title: Content Audit Disposition (CAD)
status: working
last-reviewed: 2026-04-28
---

# Content Audit Disposition (CAD)

The proposed framework that decompresses [KKE's five dimensions](./the-five-dimensions.md) into separate columns. CAD is what a future revision of our methodology should look like once we're ready to break with single-column KKE.

> **Status:** this is a proposal, not yet implemented. The audit tool today operates on KKE with operational tooling that mitigates KKE's failure modes (see [Patterns Where KKE Breaks](./patterns.md)). CAD is the long-term direction.

## The acronym

**CAD — Content Audit Disposition.** "Disposition" is the records-management term for "what we're doing with this." The acronym is short, pronounceable, and avoids fanciful naming.

## The shape

Three independent columns capture the disposition. A fourth captures process state. Authority is expressed by having multiple disposition column-sets stacked.

### Column 1 — Scope

| Value | Meaning |
|---|---|
| `InScope` | Actively being audited |
| `OutOfCrawl` | Got crawled but isn't real content |
| `Deferred` | Valid content, not in this audit cycle |
| `OutOfAuthority` | Owned by another team / engagement |
| `ComplianceHold` | Can't be touched without legal review |
| `ThirdParty` | Aggregated content, not editable by this team |

### Column 2 — Content Fate

| Value | Meaning |
|---|---|
| `Preserve` | Content stays as-is |
| `Improve` | Revised in place, retains identity |
| `Replace` | Completely rewritten; same role, new content |
| `Merge` | Absorbed by another page (target = `Consolidate_Into`) |
| `Split` | Becomes 2+ pages (targets = `Split_Into`, comma-separated URLs) |
| `Retire` | Removed |

Only meaningful when `Scope = InScope`.

### Column 3 — URL Fate

| Value | Meaning |
|---|---|
| `Preserve` | URL stays exactly as it is |
| `Move` | URL changes via nav reorganization |
| `Redirect` | URL retires; redirect destination set |
| `404` | URL retires; deliberate no-redirect |

Only meaningful when `Scope = InScope`.

### Column 4 — Process State

| Value | Meaning |
|---|---|
| `Unreviewed` | Auditor hasn't looked yet |
| `InReview` | Examined, needs more info |
| `Decided` | Auditor confident |
| `PendingSME` | Sent for expert review |
| `PendingStakeholder` | Sent for business decision |
| `Resolved` | Final answer |

## Mapping classic KKE onto CAD

| KKE | Scope | ContentFate | URLFate |
|---|---|---|---|
| Keep | InScope | Preserve | Preserve OR Move |
| Kill | InScope | Retire | Redirect OR 404 |
| Evolve | InScope | Improve | Preserve OR Move |
| Consolidate | InScope | Merge | Redirect (to target) |
| Exclude (current usage) | OutOfCrawl OR Deferred OR OutOfAuthority OR ComplianceHold | (n/a) | (n/a) |

The five-state KKE shorthand survives as a **derived view** of the underlying disposition. Auditors can think "this is a Kill" while the data captures that more precisely as `InScope / Retire / Redirect-to-/general-products`.

## Authority becomes formal

Each authority gets its own column-set: `Auditor_Disposition`, `SME_Disposition`, `GA_Disposition`, `AI_Disposition`. The synthesis (`Final_Disposition`) is the resolved view.

When authorities disagree, the disagreement *is* a signal — surface it in reports rather than flattening it.

## Why this isn't already implemented

Three reasons CAD lives as a proposal rather than a shipped feature:

1. **Backward compatibility.** Real audits are in flight using KKE. A clean break would orphan them. The migration path needs to be a layering, not a replacement.
2. **Auditor cognitive load.** Three columns instead of one is more to track per page. The folksonomy of KKE is genuinely useful as shorthand. CAD has to coexist with KKE-as-summary, not replace it.
3. **Tooling readiness.** The current audit tool handles KKE with workarounds. A CAD-native tool would need redesigned UI for the three-column model — picker, filters, reports, the whole stack.

## Migration path

Non-breaking adoption:

1. **Layer the new columns alongside KKE.** Add `Scope`, `ContentFate`, `URLFate`, `ProcessState` as optional audit columns. Keep `KKE_Recommendation`.
2. **Auto-derive in both directions.** Tools fill the new columns from KKE values using the mapping table above. KKE is computed from the new columns when those are set. Auditors using KKE alone keep working; auditors who want granularity get it.
3. **Profile-driven UI.** Project Settings includes a "Disposition mode" toggle. Default for new projects: KKE mode. Advanced projects opt in to CAD mode.
4. **Reports adapt.** Migration Checklist and similar reports surface whichever level of granularity the project uses.

## What CAD doesn't fix

CAD addresses the compression problem in the disposition column. It doesn't address:

- **Tagging.** Tags / Groups handle categorization (what is this page about?), not disposition. Orthogonal axis.
- **Content quality assessment.** Rubrics and AI evaluation produce disposition recommendations as outputs but live alongside, not inside, the framework.
- **IA / Nav decisions.** Where a page sits in the future structure is independent of its disposition.
- **Migration mechanics.** Redirect maps, content briefs, URL rewrites are downstream of disposition.

These are separate concerns documented in their own pages (TBD — see [related practices roadmap](./related-practices-roadmap.md)).

## Open questions

- **Is Process State per-authority or per-row?** A row might be Decided by the auditor but PendingSME — two authorities, two states. Probably needs to be per-authority.
- **How do you express "Consolidate plus Split"?** Take page A, merge half its content into B, half into C. Combinations of fates aren't representable as single-value enums.
- **Should "Replace" and "Improve" be on a spectrum?** Or are they categorically different? Maybe a 0–10 "rewrite intensity" alongside the binary.
- **Pages that should become navigation-only landing pads?** A high-traffic but thin page might be best repurposed as a nav node. Not Preserve, not Improve — something else.
- **Non-page content?** PDFs, images, downloadable assets currently get shoehorned into KKE. May need a parallel framework.

## See also

- [Why KKE Falls Short — The Five Dimensions](./the-five-dimensions.md)
- [Patterns Where KKE Breaks](./patterns.md)
- [Vocabulary Governance](./vocabulary-governance.md) — necessary operational layer
- [KKE: The Classic Framework](./kke-classic.md) — what we use today
