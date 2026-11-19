---
title: Glossary
status: working
last-reviewed: 2026-04-28
---

# Glossary

Every term used elsewhere in these pages, defined once. When in doubt, link here rather than re-defining.

---

### Archive
MRA state (formerly **Kill**): content is low-quality, off-strategy, redundant, or has no audience. Remove it. The URL retires and owes a redirect (or a deliberate 404). See [KKE Classic](./kke-classic.md#kill).

### Audit
A systematic review of every page on a site to decide what stays, what changes, what merges, and what goes — and to capture rationale and downstream actions for each. See [Content Audit Overview](./content-audit-overview.md).

### Authority
The source of an audit recommendation. Common authorities: Auditor, SME, Analytics (GA), AI. See [The Five Dimensions: Authority](./the-five-dimensions.md#5-authority--whose-decision-is-this).

### Authority-stamped
Data values whose source is recorded with them. `MRA_Recommendation` is auditor-stamped; `SME_Decision` is SME-stamped; `GA_MRA_Recommendation` is analytics-stamped. The current audit tool treats authority as a column dimension; CAD treats it as a first-class concept.

### CAD — Content Audit Disposition
The proposed framework that decompresses MRA into separate columns for Scope, Content Fate, URL Fate, and Process State. See [Content Audit Disposition](./content-audit-disposition.md).

### Cannibalization
When multiple URLs on the same site target the same query/topic and dilute each other's ranking. The textbook fix is consolidation. See Pattern B in [Patterns](./patterns.md#b-the-implicit-consolidate).

### Client Review
Transmission's record of a question for the client: `Client_Review` = **Needs decision** (the auditor looked and can't make the call) or **Please confirm** (a call made with low confidence), plus a priority (Normal / Urgent) and a reason. Open until the SME answers. Covers the stakeholder part of [Process State](#process-state). See [Questions to the client](../USER_GUIDE.md#questions-to-the-client).

### Compression problem
The argument that MRA collapses five independent decisions into one column, hiding important distinctions. The central thesis of [Why MRA Falls Short](./the-five-dimensions.md).

### Confidence
Synonym for [Process State](./the-five-dimensions.md#4-process-state--where-is-this-decision-in-the-workflow). How sure the auditor is about a decision.

### Consolidate
An MRA state we've added to the four originals: this page is going away, and its content is being merged into another page in the inventory. The destination is recorded in `Consolidate_Into`. See [KKE Classic — The Fifth State](./kke-classic.md#the-fifth-state-consolidate).

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

### Exclude
MRA state: page is not part of the audit's recommendations. Catch-all that conflates several distinct Scope reasons. See [KKE Classic](./kke-classic.md#exclude) and [Pattern A](./patterns.md#a-the-post-launch-problem).

### Final_MRA
A column representing the resolved disposition after authority-level inputs have been reconciled. Currently column-based; in CAD this becomes the synthesis of multiple authority disposition column-sets.

### Five Dimensions
The conceptual decomposition that MRA compresses: Scope, Content Fate, URL Fate, Process State, Authority. See [The Five Dimensions](./the-five-dimensions.md).

### Folksonomy
A vocabulary that emerges from informal use rather than formal taxonomy. MRA works as a folksonomy — five labels everyone learns in 30 seconds — but degrades when used as a strict taxonomy.

### Governance
The operational layer that keeps controlled vocabularies clean: detection, normalization, audit trail. See [Vocabulary Governance](./vocabulary-governance.md).

### KKE
Keep / Kill / Evolve / Exclude — the four-state vocabulary Transmission used before it adopted MRA, and still the most common one in the industry. Keep = Migrate, Evolve = Revise, Kill = Archive. Transmission reads files and worksheets in these words as MRA. See [KKE Classic](./kke-classic.md).

### Migrate
MRA state (formerly **Keep**): content is high-quality, on-strategy, performing well. Carry it forward as-is. See [KKE Classic](./kke-classic.md#keep).

### MRA
Migrate / Revise / Archive — the decision vocabulary Transmission uses, plus Exclude and a fifth state, Consolidate. It renames the classic KKE states one-for-one (Keep → Migrate, Evolve → Revise, Kill → Archive). Some industry uses of MRA treat "Archive" as closer to Exclude; in Transmission, Archive means exactly what Kill did: the page is retired and owes a redirect. See [KKE Classic — Sibling Frameworks](./kke-classic.md#sibling-frameworks).

### Pattern A through H
Named patterns in [Patterns Where MRA Breaks](./patterns.md). Each is a recurring real-engagement situation that exposes a different facet of MRA's compression problem.

### PERCENTRANK
Statistical normalization method used in the audit tool's [GA MRA](../USER_GUIDE.md#8-suggested_mra) feature: each page's metric value is converted to its percentile rank against all other pages, so values across radically different scales (sessions, engagement rate, duration) become comparable.

### Process State
Where a decision sits in the audit workflow. One of the [Five Dimensions](./the-five-dimensions.md#4-process-state--where-is-this-decision-in-the-workflow). Values: Unreviewed, InReview, Decided, PendingSME, PendingStakeholder, Resolved. Transmission records the stakeholder part as [Client Review](#client-review).

### Revise
MRA state (formerly **Evolve**): content has value but needs work. Improve in place — rewrite, expand, restructure, update — without changing its identity. See [KKE Classic](./kke-classic.md#evolve).

### Rogue value
An MRA value present in row data that isn't in the defined custom states or built-ins. Typically a typo, legacy import, or SME-invented label. See [Vocabulary Governance — Detection](./vocabulary-governance.md#1-detection).

### Rubric
A structured set of rules used to evaluate pages against criteria. Field rules (mechanical, evaluated by tool against spreadsheet data) and content rules (subjective, evaluated by AI or auditor). Rubrics produce inputs to the audit decision but live alongside, not inside, the disposition framework.

### Scope
Whether a page is in the audit at all. One of the [Five Dimensions](./the-five-dimensions.md#1-scope--is-this-page-in-this-audit). Values: InScope, OutOfCrawl, Deferred, OutOfAuthority, ComplianceHold, ThirdParty.

### SME
Subject Matter Expert. A non-auditor authority who reviews pages they have domain expertise on. Their input is captured in `SME_Decision` and `SME_Notes`.

### Split
A Content Fate value: one page becomes 2+ pages. Inverse of Consolidate. Currently not first-class in MRA; auditors typically note it in free text.

### URL Fate
What happens to a URL. One of the [Five Dimensions](./the-five-dimensions.md#3-url-fate--what-happens-to-the-url). Values: Preserve, Move, Redirect, 404. Independent of Content Fate.

### Vocabulary drift
The gradual divergence of values used in audit data when no governance is in place. SMEs invent labels, auditors typo, imports introduce legacy values. See [Vocabulary Governance](./vocabulary-governance.md).

## See also

Every page in the method uses these terms. Start at [the index](./README.md).
