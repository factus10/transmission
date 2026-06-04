---
title: Patterns Where KKE Breaks
status: working
last-reviewed: 2026-04-28
---

# Patterns Where KKE Breaks

Recurring situations in real audits where the four-state KKE vocabulary doesn't have language for what's actually happening. Each pattern is named so we can say "this is a Pattern A situation" and skip the re-deriving.

> **Format:** each pattern includes the situation, what auditors typically do under KKE, what's actually wrong, and what the [Five Dimensions analysis](./the-five-dimensions.md) says is happening.

---

## A. The Post-Launch Problem

**Situation:** Mid-audit, the client de-scopes a section. Pages are valid content, just not in this cycle.

**Under KKE:** Auditor marks them all `Exclude`. Or invents a custom state like `Post-Launch`.

**What's wrong:** Now the de-scoped pages are indistinguishable from genuine crawl noise (sitemap fragments, admin URLs). The client report says "we're excluding 200 pages" without telling anyone *why*. The migration team can't tell what to defer vs. what to drop.

**What's really going on:** [Scope](./the-five-dimensions.md#1-scope--is-this-page-in-this-audit) and [Content Fate](./the-five-dimensions.md#2-content-fate--what-happens-to-the-content) are different dimensions; KKE collapses them. "Out-of-crawl-scope" and "Deferred" are both Scope values, but they need different downstream handling.

**Tactical mitigation in the tool:** Custom KKE states + Consolidation Candidates filter bar lets you de-scope pages by KKE state or Group without touching individual decisions.

---

## B. The Implicit Consolidate

**Situation:** Auditor reviews three pages on the same topic — three landing pages competing for the same keyword, or four blog posts that should be one comprehensive guide. The right call is to merge them into one canonical page.

**Under KKE (before Consolidate existed):** Auditors used "assign multiple pages to one nav node" as a covert *these should merge* signal. The data didn't say it; the human reading the audit had to infer it from page counts.

**What's wrong:** Implicit conventions don't survive handoffs. The migration team gets the spreadsheet without the auditor's mental model. The intent is invisible.

**What's really going on:** Content Fate has more values than Preserve / Improve / Retire. "Merge" is a real fate.

**Resolution:** We added Consolidate as a first-class KKE state. The picker captures the target; redirects chase the target through nav changes; the Consolidation Candidates workflow finds groups in bulk. This pattern is largely *resolved* by tooling because we recognized the missing concept.

**Lesson:** any pattern auditors are communicating with implicit conventions is a missing first-class concept. There are probably others we haven't named yet.

---

## C. Keep But Moved

**Situation:** Page is high-quality (Keep), but its URL is changing because the IA is being reorganized.

**Under KKE:** `KKE = Keep`. `Redirect_Destination` = new URL. Two columns to express one decision.

**What's wrong:** The KKE column alone doesn't tell the migration team "this URL is changing." Reports that group by KKE miss the URL change. A reader scanning for "what's moving" has to consult Redirect_Destination separately.

**What's really going on:** [Content Fate (Preserve)](./the-five-dimensions.md#2-content-fate--what-happens-to-the-content) and [URL Fate (Move)](./the-five-dimensions.md#3-url-fate--what-happens-to-the-url) are independent dimensions. KKE bundles them.

---

## D. The Half-Decision

**Situation:** Auditor reviews a page, can't decide between Keep and Evolve, wants to flag it for stakeholder input.

**Under KKE:** Leaves blank (looks Unreviewed) or marks Flagged + adds Notes. Neither is a clean "needs decision from someone else" state.

**What's wrong:** Confidence is conflated with absence. A blank cell could mean "haven't gotten to it" or "looked at it but unsure." The audit's progress meter can't distinguish.

**What's really going on:** [Process State](./the-five-dimensions.md#4-process-state--where-is-this-decision-in-the-workflow) is a missing dimension. KKE assumes binary (decided / not decided).

---

## E. The Split

**Situation:** One page is doing three jobs — about-the-team, about-services, about-history all on `/about`. Decision: split into three pages.

**Under KKE:** No state for this. Auditor adds a Note. Migration team has to read every Note to catch it.

**What's wrong:** Easy to miss. Inconsistent across auditors. Not surfaced in any report.

**What's really going on:** Content Fate is missing the **Split** value. Inverse of Consolidate.

---

## F. Cross-Engagement Orphan

**Situation:** Audit covers Marketing's site. `/support` is owned by Customer Service, not part of this engagement. Marketing wants the audit to acknowledge those pages but not decide on them.

**Under KKE:** Not Keep, not Evolve, not Kill. `Exclude` is closest but lumps these with crawl noise.

**What's wrong:** "We didn't decide" is different from "we excluded." A custom state helps but doesn't cleanly differentiate.

**What's really going on:** [Scope](./the-five-dimensions.md#1-scope--is-this-page-in-this-audit) has more values than "in" and "out." `OutOfAuthority` is a real category.

---

## G. Multiple Authorities Disagree

**Situation:** Page has `KKE = Keep` (auditor likes it), `GA_KKE = Kill` (no traffic), `SME_Decision = Change: Evolve` (subject expert says it's outdated). Three authorities, three answers.

**Under KKE:** Final_KKE makes the auditor pick one as the resolved value, as if the disagreement didn't matter.

**What's wrong:** The disagreement *is* a signal. A page where Analytics and SME agree but Auditor disagrees is interesting. A page where all three disagree is a research target. Flattening to Final_KKE loses that.

**What's really going on:** [Authority](./the-five-dimensions.md#5-authority--whose-decision-is-this) is a real dimension. KKE-the-original-framework assumed a single authority per page. We've added authority columns operationally; the framework hasn't caught up.

**Tactical mitigation:** SME conflict resolution UI. But it doesn't surface analytics-vs-auditor or AI-vs-SME conflicts the same way.

---

## H. Replace vs Evolve

**Situation:** Page is well-trafficked but its premise is wrong (e.g. lists 2018 pricing structure, hasn't been updated). The content team needs to start over.

**Under KKE:** Marked Evolve.

**What's wrong:** "Evolve" implies iteration ("improve in place"). The migration team estimates the work as a minor revision. It's actually a complete rewrite. Effort estimates are wrong.

**What's really going on:** Content Fate is missing **Replace**. Different effort, different brief, different timeline.

---

## Cross-pattern observations

Three patterns are largely *resolved* by tooling once we named the missing concept:

- **Pattern B** — Consolidate is a first-class state with full workflow
- **Pattern G's governance subset** — Custom KKE merge / rogue cleanup handles vocabulary drift across authorities
- **Pattern A's tactical layer** — filter bar in Consolidation Candidates lets you scope by KKE/Group

Five patterns are *mitigated but not resolved* — the tooling makes them survivable in practice without changing the data model. A future audit will hit them again:

- A (Post-Launch problem persists conceptually)
- C (Keep But Moved)
- D (Half-Decision)
- E (Split)
- F (Cross-Engagement Orphan)
- H (Replace vs Evolve)

The full conceptual fix is the [proposed CAD framework](./content-audit-disposition.md).

## See also

- [Why KKE Falls Short — The Five Dimensions](./the-five-dimensions.md)
- [Content Audit Disposition (CAD)](./content-audit-disposition.md)
- [Vocabulary Governance](./vocabulary-governance.md)
