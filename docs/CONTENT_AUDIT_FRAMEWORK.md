# Content Audit Framework — A Critical Review of KKE

A working document for evolving the Keep / Kill / Evolve / Exclude (and Migrate / Revise / Archive, and similar) framework into something that survives contact with real engagements.

---

## 1. The Heritage of KKE

KKE — Keep, Kill, Evolve, Exclude — comes out of a tradition of triage rubrics for legacy content during site migrations. Add four words to a sticky note and you can train a junior auditor in five minutes. That's the framework's strength: brevity. Any auditor can grasp it; clients can grasp it; the deliverable looks legible.

The framework's weakness is that "decide what to do with this page" turns out not to be one decision. It's four or five decisions stacked on top of each other, and a single column flattens them into a label that loses information at every stage of the engagement.

The sibling frameworks share the same architecture and inherit the same limitations:

- **MRA** — Migrate / Revise / Archive (more migration-flavored)
- **KKER** — Keep / Kill / Evolve / Replace (replaces "Exclude" with "Replace")
- **CCC** — Cull / Consolidate / Create (more strategic-flavored)
- **Triage** — informal but widely used

All single-column. All conflate.

## 2. The Hidden Dimensions

A real audit decision has at minimum five independent dimensions. KKE compresses them into one column. The compression is what causes most of the subtleties we've hit during development.

### 2.1 Scope — Is this page in this audit at all?

- **In scope** — actively being audited
- **Out of crawl scope** — page got crawled but shouldn't have been; not real content (search results, admin URLs, JSON feeds, infinite-scroll variants, sitemap fragments)
- **Deferred** — valid content, not in this audit cycle (post-launch, next phase, future redesign)
- **Out of authority** — owned by another team/department/engagement, not yours to decide
- **Compliance hold** — can't be touched without legal review
- **Third-party / aggregated** — content sourced from another system, not editable by this team

KKE collapses all of these into "Exclude." That's why the Post Launch problem keeps coming up. These look the same in the data but have very different implications:

- Out-of-crawl-scope items should arguably be **deleted** from the audit spreadsheet entirely, not preserved as Excludes.
- Deferred items should ship to the client as **"we know about these, they're queued for next cycle"** — not "excluded" in any disposition sense.
- Compliance holds need **annotation visible in reports** so the migration team doesn't try to redirect a page they can't legally touch.

### 2.2 Content Fate — What happens to the content of this page?

- **Preserve** — content stays as-is (Keep)
- **Improve** — content is revised in place, retains identity (Evolve)
- **Replace** — content is completely rewritten; new content, same role
- **Merge into** — content is absorbed by another page (Consolidate)
- **Split into** — content becomes 2+ pages
- **Retire** — content is removed (Kill)

Six values, not four. The two missing from KKE are **Replace** and **Split**:

- **Replace** matters because "improve in place" (Evolve) is different from "throw it out and write fresh." A page that's stylistically dated but topically fine is Evolve. A page whose entire premise is wrong but whose URL is valuable is Replace. The migration team needs to know which.
- **Split** matters because the inverse of Consolidate happens too. One page doing three jobs (about the team + about the services + about the history, all on /about) should become three pages. Currently auditors note this in the Notes field and hope someone reads it.

### 2.3 URL Fate — What happens to the URL?

- **Preserve** — URL stays exactly as it is
- **Move** — URL changes via sitemap reorganization (the page is Keep but lives at a new path)
- **Redirect** — URL retires, redirect points elsewhere
- **404** — URL retires, no redirect (deliberate, e.g. for thin or noisy URLs)

URL fate is **mostly independent** of content fate:

- A Keep page can get a new URL because the sitemap reorganized. Same content, different address.
- A Kill page can have no redirect (intentional 404 for low-value or duplicate URLs).
- A Consolidate page always redirects (to the target).
- An Evolve page can keep its URL or move it.

KKE's single column tangles these. The current app fixes part of this by having a separate `Redirect_Destination` column — but that fix is implicit in the data model, not in the framework's vocabulary.

### 2.4 Confidence / Process State — Where is this decision in the workflow?

- **Unreviewed** — haven't looked yet
- **Looked at, undecided** — examined, more research needed
- **Decided** — auditor is confident
- **Pending SME** — sent for expert review
- **Pending stakeholder** — sent for business decision
- **Resolved** — final answer

KKE has implicit "Unreviewed" (blank cell) and "Decided" (cell filled in). The middle states are real — auditors absolutely encounter pages they need more info on — but there's no clean place to put them. They get parked in Notes, or with the Flag bookmark, or in a Tag. None of those communicate "I looked at this and don't have enough information yet."

The current `Final_KKE` column hints at the workflow dimension: it's a separate column because the resolution is a separate moment from the initial recommendation. But that pattern stops at SME — it doesn't generalize to "pending stakeholder" or "needs research."

### 2.5 Authority — Whose decision is this?

The app's evolution makes this dimension extremely visible:

- `KKE_Recommendation` — auditor's call
- `SME_Decision` — domain expert's call
- `GA_KKE_Recommendation` — analytics-derived
- `AI KKE` — AI's pattern-match against rubric
- `Final_KKE` — the synthesis

Each authority has different weight on different pages. A page with high traffic and strong engagement should weight Analytics heavily. A page about regulated medical content should weight SME heavily. A purely promotional page should weight Auditor + Stakeholder.

KKE-as-originally-conceived assumed one authority per page — the auditor. The current app has effectively built a parallel system of authority-stamped recommendations. That should be acknowledged in the framework, not treated as an exception.

#### Authority requires governance

Once you accept that an audit has multiple authorities producing recommendations, you also have to accept that authority-stamped vocabularies degrade without active management. SMEs invent their own labels (`Change: Consolidate`, `Change: Post-Launch`, `Evolve - Post`). Multiple auditors over multiple cycles introduce subtle variants (`Post Launch` vs `Post-Launch`). Imports from other tools bring legacy values that don't match the current vocabulary.

A framework that treats authority as a real dimension has to provide for **governance tooling**: a way to detect rogue values, normalize typos, merge variants, and enforce a defined vocabulary. Otherwise "multiple authorities" silently becomes "vocabulary drift," which silently becomes "the data column says one thing, the report says another, the migration team trusts neither."

The audit app's Custom KKE merge / rogue value detection / undefined-values cleanup are operational implementations of this need. Any future framework based on these dimensions has to design the governance layer up front — not bolt it on after a typo causes a downstream report to ship wrong.

## 3. Patterns Where KKE Breaks Down (Real Examples)

### Pattern A: The Post-Launch Problem

Mid-audit, the client de-scopes a section. Pages are valid content, just not in this cycle. KKE says: mark them Exclude. But now they're indistinguishable from genuine crawl noise. The client report says "we're excluding 200 pages" without telling anyone *why*. The migration team can't tell what to defer vs. what to drop.

**Underlying issue:** Scope and Content Fate are different dimensions; KKE collapses them.

### Pattern B: The Implicit Consolidate

For years, auditors used "assign N pages to one sitemap node" as a covert *these should merge* signal. The data didn't say it; the human reading the audit had to infer it from page counts. We added Consolidate as an explicit KKE state to fix this.

**Lesson:** Any pattern auditors are communicating with implicit conventions is a missing first-class concept. There are probably others.

### Pattern C: Keep But Moved

High-quality page; its URL is changing because the sitemap is being reorganized. KKE = Keep. `Redirect_Destination` = the new URL. Two pieces of information about one page in two columns. The KKE column alone doesn't tell the migration team "this URL is changing."

**Underlying issue:** Content Fate (preserve) and URL Fate (move) are independent.

### Pattern D: The Half-Decision

Auditor reviews a page, can't decide between Keep and Evolve, wants to flag for stakeholder input. Currently: leaves blank (looks Unreviewed) or sets Flagged + Notes. Neither is a clean "needs a decision from someone else" state.

**Underlying issue:** Process state is a missing dimension.

### Pattern E: The Split

One page is doing three jobs. Decision: split into three pages. KKE has no value for this. The auditor adds a Note. The migration team has to read every Note hoping to catch it.

**Underlying issue:** Content Fate is missing the Split value.

### Pattern F: Cross-Engagement Orphan

Audit covers Marketing's site. /support is owned by Customer Service, not part of this engagement. Marketing wants the audit to acknowledge those pages but not decide on them. KKE: not Keep, not Evolve, not Kill, not really Exclude. Currently auditors fudge it.

**Underlying issue:** Scope has more values than "in" and "out."

### Pattern G: Multiple Authorities Disagree

Page has KKE=Keep (auditor likes it), GA_KKE=Kill (no traffic), SME_Decision=Change:Evolve (subject expert says it's outdated). Three authorities, three answers. The single `Final_KKE` column makes the auditor pick one as if the disagreement didn't matter. It does matter — the disagreement is itself a signal.

**Underlying issue:** Authority is a dimension; KKE assumes a single authority.

### Pattern H: Replace vs Evolve

Page is well-trafficked but its premise is wrong (e.g. lists 2018 pricing structure, hasn't been updated, content team needs to start over). Currently: Evolve. But "improve" implies iteration, not throwing it out. The migration team estimates the work as "minor revision." It's actually "rewrite from scratch."

**Underlying issue:** Content Fate is missing Replace.

## 4. A Proposed Framework

### 4.1 Three columns instead of one

Replace `KKE_Recommendation` with three independent columns:

| Column | Values |
|--------|--------|
| **Scope** | InScope / OutOfCrawl / Deferred / OutOfAuthority / ComplianceHold / ThirdParty |
| **ContentFate** | Preserve / Improve / Replace / Merge / Split / Retire |
| **URLFate** | Preserve / Move / Redirect / 404 |

The original KKE values become well-known combinations of the three:

| KKE | Scope | ContentFate | URLFate |
|-----|-------|-------------|---------|
| Keep | InScope | Preserve | Preserve or Move |
| Kill | InScope | Retire | Redirect or 404 |
| Evolve | InScope | Improve | Preserve or Move |
| Consolidate | InScope | Merge | Redirect (to target) |
| Exclude (current usage) | OutOfCrawl | (n/a) | (n/a) |

The new vocabulary doesn't replace shorthand for the common cases — auditors still say "this is a Kill" — but when something doesn't fit (Pattern A, F, G, H), the framework has language for it.

### 4.2 Add a Process State column

Independent of disposition. Tracks where the decision is in the workflow:

**ProcessState**: Unreviewed / InReview / Decided / PendingSME / PendingStakeholder / Resolved

This replaces the current implicit-blank-vs-filled treatment with explicit states, and gives auditors a place for Pattern D.

### 4.3 Authority becomes formal

The current pattern of multiple recommendation columns (KKE / SME / GA / AI / Final) is correct — make it the framework, not an exception.

Each authority is a recommendation column with the same disposition shape (Scope + ContentFate + URLFate). The synthesis column (currently `Final_KKE`) is the auditor's resolved view.

When authorities disagree, that disagreement is a signal, not a bug. Surface it explicitly.

### 4.4 Naming the framework

Brand-friendly options:

- **CAD** — Content Audit Disposition. Clean acronym; "disposition" is the records-management term for "what we're doing with this." Sounds like a noun, which the current term ("KKE recommendation") strains to be.
- **Three Fates** — Scope, Content, URL. Memorable, mythological, easy to teach. Slight risk of sounding fanciful.
- **CALM** — Content Audit Lifecycle Map. Has the lifecycle angle but is somewhat redundant.
- **Audit Disposition** — Plain English. Boring but accurate.
- **Just don't acronym it.** Call it the "audit disposition" and let the columns speak for themselves. Frameworks that avoid an acronym sometimes age better — they don't get pigeonholed.

For the methodology itself (the process, not the framework):

- **Content Lifecycle Audit** — adds the lifecycle angle to "content audit"
- **Content Disposition Audit** — emphasizes the deliverable
- **Strategic Content Audit** — competitive positioning
- Or just **Content Audit** — let the methodology branding live in process docs, not the name

My pick: **CAD (Content Audit Disposition)** for the framework, **Content Audit** for the engagement type. Don't try to brand the methodology with a clever name — the value is in the framework, not the label.

### 4.5 What to keep from KKE

KKE's brevity is genuinely valuable. The five-state vocabulary (Keep / Kill / Evolve / Consolidate / Exclude) works well for the *common cases* and the **client-facing summary**. Keep it as a folksonomy, computed from the underlying disposition columns:

- Keep = Scope:InScope + ContentFate:Preserve
- Kill = Scope:InScope + ContentFate:Retire
- Evolve = Scope:InScope + ContentFate:Improve
- Consolidate = Scope:InScope + ContentFate:Merge
- Exclude = Scope ≠ InScope (with a sub-reason)

Pages whose disposition doesn't map cleanly onto KKE get a "see disposition columns" indicator. The framework gracefully degrades to KKE when that's all the audience needs.

## 5. Migration Path for Existing Audits

The audit tool has real audits in flight. A clean break would orphan them.

1. **Layer the new columns alongside KKE.** Add `Scope`, `ContentFate`, `URLFate`, `ProcessState` as new audit columns. Preserve `KKE_Recommendation` for backward compatibility.
2. **Auto-derive in both directions.** The app can fill the new columns from existing KKE values using the table in §4.1, and compute KKE from the new columns. Auditors using KKE alone keep working; auditors who want more granularity get more granularity.
3. **Profile-driven UI.** Project Settings includes a "Disposition mode" toggle. Default for new projects: simple KKE mode. Advanced projects opt in to the three-column mode.
4. **Reports adapt.** Migration Checklist and similar reports surface whichever level of granularity the project uses.

This is a non-breaking evolution. Old audits work unchanged; new audits can use whichever framework fits.

## 6. What This Document Doesn't Cover

- **Tagging.** Tags / Groups / Primary Tag handle dimensions of *categorization* (what is this page about?) rather than *disposition* (what should we do with it?). The two are orthogonal and the current vocabulary serves them fine.
- **Content quality.** Rubrics handle "is this page good?" — separate from disposition.
- **Migration mechanics.** Redirect maps, URL changes, content briefs are downstream of disposition. The framework provides inputs to those processes; it isn't those processes.
- **Information architecture.** Sitemap assignments are a parallel concern. A page can have any disposition independent of where it fits (or doesn't) in the future IA.

## 7. Open Questions

These don't have clean answers yet:

- **Is Confidence per-authority or per-row?** A row might be Decided by the auditor but Pending SME — two authorities, two confidence levels. Probably needs to be per-authority.
- **How do you express "consolidate plus split"?** "Take page A, merge half its content into B, half into C." Combinations of fates aren't currently representable.
- **Should "Replace" and "Improve" be on a spectrum?** Or are they categorically different? Maybe a 0–10 "rewrite intensity" alongside a binary in-place / replaced.
- **What about pages that should become navigation-only nodes?** A page with great traffic but thin content might be best repurposed as a nav landing pad. Not Keep, not Evolve, not Kill — something else.
- **How does the framework handle non-page content?** PDFs, images, downloadable assets. Currently shoehorned into KKE. Probably need a parallel framework for non-page assets.

These are the next round of subtleties. They'll surface when this framework hits its own contact with reality.

## 8. Postscript: Operational Tooling vs. Conceptual Fix

The audit app this framework grew out of has accumulated tooling that *mitigates* most of the patterns in §3 without changing the underlying conceptual model. This is worth being honest about: the framework critiques KKE; the tooling patches KKE. The two complement each other but they're not the same thing.

Examples of operational tooling that addresses §3 patterns without resolving them:

| Pattern | Tooling that mitigates it | What's still unresolved |
|---|---|---|
| **A — Post-Launch problem** | Filter bar in Consolidation Candidates can exclude rows by KKE state or Group. Custom KKE merge cleans up typo variants. | The KKE column still can't natively distinguish "out of crawl scope" from "deferred." Reports that group by KKE still mis-categorize. |
| **B — Implicit Consolidate** | Consolidate is now a first-class KKE state with a target picker, redirect chasing, and a Consolidation Candidates workflow modal. | Largely *resolved* by tooling — but only because the framework recognized Consolidate as a missing concept and the tooling implemented it. This is the exception that proves the rule: when conceptual gaps are addressed, tooling can fully close them. |
| **C — Keep but moved** | Computed Path + Redirect_Destination columns capture the URL change separately from KKE. | The KKE column doesn't reflect the URL change. A reader looking at "Keep" can't tell that the URL is moving without checking other columns. |
| **D — The half-decision** | Notes field, Flagged bookmark, "Pending Final KKE" filter. | No clean "needs decision from someone" state. Auditors still park decisions in Notes and hope someone reads them. |
| **E — The split** | None. Auditors note it in Notes. | No data structure for "this page becomes 2+ pages." |
| **F — Cross-engagement orphan** | Custom KKE states + Group filtering. | The vocabulary still treats them as Excludes for downstream tooling that doesn't know about custom states. |
| **G — Multiple authorities disagree** | Separate columns per authority + SME conflict resolution UI. The framework *codified* this pattern. | Final_KKE flattens disagreements. Reports rarely surface authority-level conflict as a signal in its own right. |
| **H — Replace vs Evolve** | None. Auditors lump both into Evolve. | Same. |
| **2.5 — Vocabulary governance** | Custom KKE merge, rogue-value detection, whitespace-tolerant matching, change log. | Largely *resolved* operationally. The conceptual point — that authority-stamped vocabularies need governance — is now built into the tool. |

**What this teaches:**

1. **Tooling can close conceptual gaps when the gap is recognized.** Pattern B (Consolidate) and §2.5 (governance) went from "problem" to "mostly solved" via deliberate tooling. The pattern: name the missing concept, then build the workflow.
2. **Tooling can mask conceptual gaps without closing them.** Patterns A, C, D, E, F, G, H still have the underlying compression problem — the tooling makes them survivable in practice without changing the data model. A future audit using this tool will hit the same patterns, and the tool will require the same workarounds.
3. **The conceptual fix matters more than the tooling fix.** A clean three-column disposition (Scope / ContentFate / URLFate) plus a Confidence column would render most of §3's patterns moot. The tooling would still exist, but as utilities rather than band-aids.

The framework remains the long-term goal. The tooling is the bridge from where the methodology is now to where it should be. Both are real; neither replaces the other.

---

*This document is a snapshot. Like KKE itself, it should be revised as the next layer of subtleties emerges.*
