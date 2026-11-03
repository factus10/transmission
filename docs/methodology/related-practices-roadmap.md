---
title: Related Practices — Roadmap
status: stub
last-reviewed: 2026-04-28
---

# Related Practices — Roadmap

Pages still to write. The method currently focuses on the [MRA / disposition framework](./README.md). The practices that *feed* and *consume* the framework deserve their own pages over time.

This is a stub — the sections below name the pages and say what each would cover.

---

## Practices that feed the audit

### Rubrics — definition, structure, examples
**Why we need it:** rubrics are the criteria each page is evaluated against. Field rules (mechanical) vs content rules (subjective). The current audit tool has a rubric system but it's underdocumented.

**What the page should cover:**
- What a rubric is and why we use them
- Field rule syntax (operators, examples)
- Content rule philosophy (when to use AI vs auditor judgment)
- How to design a rubric for a specific engagement (the conversation with the client)
- When rubrics fail / when not to use them

### Audience Prioritization & Jobs-to-be-Done
**Why we need it:** we run these workshops on most engagements, and until the audit tool grew [audience tagging](../dev/AUDIENCE_TAGGING_PROPOSAL.md) their output never reached a single row — MRA got argued on traffic and quality, both of which are downstream proxies for relevance to a person. Audience is now a first-class authority source alongside GA and the rubric, so the methodology should catch up to the tooling.

**What the page should cover:**
- Running the prioritization workshop (who's in the room, how the ranking is forced, how many tiers is too many)
- Translating workshop output into a tiered audience library the audit can consume
- What each tier *commits you to* downstream (Primary → Migrate pressure; Tertiary → Revise pressure)
- Tagging strategy at scale: section-level bulk passes vs page-by-page, and when the tagging isn't worth it
- Reading the disagreement cases (high traffic + no priority audience; low traffic + priority audience)
- JTBD statements: capturing them, and using unserved jobs to justify net-new content

### SME Review Workflow
**Why we need it:** the SME round is where most engagements lose time and clarity. Captures: how to structure the export, how to onboard SMEs, common SME failure modes (writing prose where dropdowns are required, not specifying targets for Consolidate, missing deadlines).

**What the page should cover:**
- The SME export format (column choices, dropdowns, instructions)
- SME onboarding template (an email + a video script)
- Common SME failure modes and how to recover
- When to push back vs accept SME recommendations
- Handling cross-SME disagreements

### Nav and IA Decisions
**Why we need it:** the audit and the IA are two sides of one coin but treated as separate workstreams in most engagements. This page should document where they intersect.

**What the page should cover:**
- When IA decisions block audit decisions (and vice versa)
- The Nav Editor as a thinking tool, not just a deliverable
- Net new content nodes (pages that don't exist yet but the IA needs)
- Hub nodes vs leaf nodes
- Mapping audit dispositions to nav locations

### Analytics-Informed Audits
**Why we need it:** GA4 data is one of the strongest authority sources but methodology varies wildly across engagements. The current audit tool has a [GA MRA feature](../USER_GUIDE.md#8-suggested_mra) with documented methodology — this page should capture the strategy around when and how to use it.

**What the page should cover:**
- When analytics input is reliable vs misleading (low-traffic sites, recent migrations, tracking gaps)
- How to weight analytics against editorial judgment
- The four GA4 metrics we use and why (Sessions, Engagement Rate, Avg Session Duration, Views per Session)
- PERCENTRANK normalization and why
- When to override the analytics-derived recommendation

### AI-Assisted Assessment
**Why we need it:** AI evaluation against rubrics is increasingly part of our process. The page should capture what AI is good at, what it isn't, and how to integrate it.

**What the page should cover:**
- What AI can evaluate (rubric content rules, broad quality assessment)
- What AI shouldn't evaluate (strategic decisions, brand fit, regulated content)
- Prompt design for content evaluation
- Integration patterns with rubrics
- When to discard AI output

---

## Practices that consume the audit

### Migration Planning
**Why we need it:** the audit's deliverables (redirect maps, content briefs) are inputs to migration. This page documents how to translate audit data into a migration plan.

**What the page should cover:**
- Redirect map generation and quality control
- Content brief authoring (what info from the audit ends up in the brief)
- Migration sequencing (which dispositions ship first)
- Pre-migration QA checklist
- Post-migration validation

### Content Briefs
**Why we need it:** Revise, Replace, and Consolidate-target pages all need content briefs. The format isn't standardized and varies by client.

**What the page should cover:**
- Brief structure (problem, audience, scope, sources, success criteria)
- Inputs from the audit (what data populates the brief automatically)
- Brief vs ticket vs spec — when each is appropriate
- SEO inputs into briefs

### Reporting & Stakeholder Communication
**Why we need it:** the audit produces a lot of data; stakeholders see only summaries. The summaries are where the audit's value lands or doesn't.

**What the page should cover:**
- Executive summary structure
- The Migration Checklist deliverable
- Per-section / per-content-owner reports
- Progress reports during the audit (when to send, what to include)
- How to surface multi-authority disagreement (Pattern G) vs flatten it

---

## Cross-cutting

### Engagement Phases
**Why we need it:** Discovery / Audit / Plan / Build is a useful frame but each phase has substructure. This page should document the substructure for each.

### Tooling Decisions
**Why we need it:** when do we use the audit tool? When do we fall back to Excel? When do we add a new tool? Documenting this prevents tooling sprawl.

### Common Client Quirks
**Why we need it:** every client has its own audit-affecting quirks (regulated industries, multi-brand sites, multilingual content, multi-CMS environments). A page per quirk type, building over time.

---

## How to add a new page

When you're ready to write one of these:

1. Create the file in `docs/methodology/` using a kebab-case filename matching the link above (e.g. `rubrics.md`, `sme-review-workflow.md`).
2. Add front-matter (`status: working`, `last-reviewed: <date>`).
3. Update [the index](./README.md) — add the page under the right section.
4. Cross-link from related pages (the [Five Dimensions](./the-five-dimensions.md), [Patterns](./patterns.md), [CAD](./content-audit-disposition.md)).
5. Add new terms to [the Glossary](./glossary.md).

Replace the entry above with a working link once the page exists.

## See also

- [Method Index](./README.md)
- [Content Audit Overview](./content-audit-overview.md)
