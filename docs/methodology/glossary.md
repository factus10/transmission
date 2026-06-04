---
title: Glossary
status: working
last-reviewed: 2026-04-28
---

# Glossary

Every term used elsewhere in the wiki, defined once. When in doubt, link here rather than re-defining.

---

### Audit
A systematic review of every page on a site to decide what stays, what changes, what merges, and what goes — and to capture rationale and downstream actions for each. See [Content Audit Overview](./content-audit-overview.md).

### Authority
The source of an audit recommendation. Common authorities: Auditor, SME, Analytics (GA), AI. See [The Five Dimensions: Authority](./the-five-dimensions.md#5-authority--whose-decision-is-this).

### Authority-stamped
Data values whose source is recorded with them. `KKE_Recommendation` is auditor-stamped; `SME_Decision` is SME-stamped; `GA_KKE_Recommendation` is analytics-stamped. The current audit tool treats authority as a column dimension; CAD treats it as a first-class concept.

### CAD — Content Audit Disposition
The proposed framework that decompresses KKE into separate columns for Scope, Content Fate, URL Fate, and Process State. See [Content Audit Disposition](./content-audit-disposition.md).

### Cannibalization
When multiple URLs on the same site target the same query/topic and dilute each other's ranking. The textbook fix is consolidation. See Pattern B in [Patterns](./patterns.md#b-the-implicit-consolidate).

### Compression problem
The argument that KKE collapses five independent decisions into one column, hiding important distinctions. The central thesis of [Why KKE Falls Short](./the-five-dimensions.md).

### Confidence
Synonym for [Process State](./the-five-dimensions.md#4-process-state--where-is-this-decision-in-the-workflow). How sure the auditor is about a decision.

### Consolidate
A KKE state we've added to the four originals: this page is going away, and its content is being merged into another page in the inventory. The destination is recorded in `Consolidate_Into`. See [KKE Classic — The Fifth State](./kke-classic.md#the-fifth-state-consolidate).

### Consolidate target
The page that absorbs another page's content during a Consolidate operation. Recorded in the `Consolidate_Into` column on the source page.

### Consolidation Candidates
A workflow tool in the audit app that surfaces every nav node with 2+ assigned pages, letting auditors bulk-resolve them by picking a target per group.

### Content Fate
What should happen to the content of a page. One of the [Five Dimensions](./the-five-dimensions.md#2-content-fate--what-happens-to-the-content). Values: Preserve, Improve, Replace, Merge, Split, Retire.

### Crawl noise
Pages that got crawled but aren't real content — sitemap fragments, JSON endpoints, search results, admin URLs. A common form of OutOfCrawl scope.

### Disposition
Records-management term meaning "what we're doing with this." The umbrella term for an audit decision in the [CAD framework](./content-audit-disposition.md). A disposition is the combination of Scope + Content Fate + URL Fate (+ optionally Process State).

### Evolve
KKE state: content has value but needs work. Improve in place — rewrite, expand, restructure, update — without changing its identity. See [KKE Classic](./kke-classic.md#evolve).

### Exclude
KKE state: page is not part of the audit's recommendations. Catch-all that conflates several distinct Scope reasons. See [KKE Classic](./kke-classic.md#exclude) and [Pattern A](./patterns.md#a-the-post-launch-problem).

### Final_KKE
A column representing the resolved disposition after authority-level inputs have been reconciled. Currently column-based; in CAD this becomes the synthesis of multiple authority disposition column-sets.

### Five Dimensions
The conceptual decomposition that KKE compresses: Scope, Content Fate, URL Fate, Process State, Authority. See [The Five Dimensions](./the-five-dimensions.md).

### Folksonomy
A vocabulary that emerges from informal use rather than formal taxonomy. KKE works as a folksonomy — five labels everyone learns in 30 seconds — but degrades when used as a strict taxonomy.

### Governance
The operational layer that keeps controlled vocabularies clean: detection, normalization, audit trail. See [Vocabulary Governance](./vocabulary-governance.md).

### Keep
KKE state: content is high-quality, on-strategy, performing well. Migrate as-is. See [KKE Classic](./kke-classic.md#keep).

### Kill
KKE state: content is low-quality, off-strategy, redundant, or has no audience. Remove. URL retires (with redirect or deliberate 404). See [KKE Classic](./kke-classic.md#kill).

### KKE
The four-state vocabulary used in most content audits today: Keep / Kill / Evolve / Exclude. We've added Consolidate as a fifth. See [KKE Classic](./kke-classic.md).

### MRA
Sibling framework: Migrate / Revise / Archive. Migration-flavored. Same compression problem as KKE. See [KKE Classic — Sibling Frameworks](./kke-classic.md#sibling-frameworks).

### Pattern A through H
Named patterns in [Patterns Where KKE Breaks](./patterns.md). Each is a recurring real-engagement situation that exposes a different facet of KKE's compression problem.

### PERCENTRANK
Statistical normalization method used in the audit tool's [GA KKE](../USER_GUIDE.md#8-suggested_kke) feature: each page's metric value is converted to its percentile rank against all other pages, so values across radically different scales (sessions, engagement rate, duration) become comparable.

### Process State
Where a decision sits in the audit workflow. One of the [Five Dimensions](./the-five-dimensions.md#4-process-state--where-is-this-decision-in-the-workflow). Values: Unreviewed, InReview, Decided, PendingSME, PendingStakeholder, Resolved.

### Rogue value
A KKE value present in row data that isn't in the defined custom states or built-ins. Typically a typo, legacy import, or SME-invented label. See [Vocabulary Governance — Detection](./vocabulary-governance.md#1-detection).

### Rubric
A structured set of rules used to evaluate pages against criteria. Field rules (mechanical, evaluated by tool against spreadsheet data) and content rules (subjective, evaluated by AI or auditor). Rubrics produce inputs to the audit decision but live alongside, not inside, the disposition framework.

### Scope
Whether a page is in the audit at all. One of the [Five Dimensions](./the-five-dimensions.md#1-scope--is-this-page-in-this-audit). Values: InScope, OutOfCrawl, Deferred, OutOfAuthority, ComplianceHold, ThirdParty.

### SME
Subject Matter Expert. A non-auditor authority who reviews pages they have domain expertise on. Their input is captured in `SME_Decision` and `SME_Notes`.

### Split
A Content Fate value: one page becomes 2+ pages. Inverse of Consolidate. Currently not first-class in KKE; auditors typically note it in free text.

### URL Fate
What happens to a URL. One of the [Five Dimensions](./the-five-dimensions.md#3-url-fate--what-happens-to-the-url). Values: Preserve, Move, Redirect, 404. Independent of Content Fate.

### Vocabulary drift
The gradual divergence of values used in audit data when no governance is in place. SMEs invent labels, auditors typo, imports introduce legacy values. See [Vocabulary Governance](./vocabulary-governance.md).

## See also

Every page in this wiki uses these terms. Start at [the index](./README.md).
