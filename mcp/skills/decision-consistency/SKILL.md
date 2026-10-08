---
name: decision-consistency
description: Find pages in a Transmission content audit whose decision contradicts their neighbours or their own data — a Keep among a Kill year, a Kill in a priority-audience section with real traffic, a Keep page that returns 404, Consolidate with no target, pages where the auditor and the suggestion engine disagree, SME overrides that cluster. Use before an SME export, before handoff, before a client readout, or when asked "does this look consistent", "did we miss anything", "sanity check the decisions", "QA the audit".
argument-hint: "[section or scope, optional]"
---

# Decision consistency

An audit of a few thousand pages, made over weeks by more than one person, will contain decisions that don't agree with each other. Most are deliberate; some are slips. This skill finds the candidates and asks *"intentional?"* — it does not declare errors, because the page a rule says is wrong is often the one the auditor thought hardest about. Every item carries the evidence (the auditor's note, the traffic, the SME comment) needed to answer the question in a glance.

Follow the `ask-the-audit` ground rules. Scope to a section if the user named one (see `section-review` §1 for turning a name into a filter); otherwise run the whole in-scope inventory, content pages only (`{field:"@content_kind",operator:"equals",value:"content"}`). Call that filter array `BASE`.

## The checks

Run each; skip any whose prerequisite column is empty (`describe_columns` tells you). Collect findings per check with counts.

**A. Breaks its own neighbourhood.** `aggregate groupBy:["@path_2","@effective_kke"] filters:BASE`. For every `@path_2` where one decision holds ≥ 80% of the decided pages and some other decision has ≤ 3 pages, pull those few with `query_rows … columns:["Title 1","Page_Type","Notes","GA4 Sessions","Last Modified"]`. A minority with a Note explaining itself is probably fine; a minority with no Note is the finding. One pattern to recognise and skip: an **Exclude majority with a single Keep** is almost always a canonical page surrounded by its own query-string variants (URL variant triage marks the variants Exclude) — not a contradiction. Repeat with `groupBy:["@path_1","Page_Type","@effective_kke"]` for type-level outliers (one Kill among Keep listings).

**B. Decision contradicts the crawl.** Keep/Evolve pages that aren't pages. **Do not use BASE here** — BASE restricts to content pages, which is exactly what this check must look outside of. Use only: `query_rows filters:[{field:"@effective_kke",operator:"equals",value:"Keep"},{field:"@content_kind",operator:"not-equals",value:"content"}] columns:["Status Code","Title 1","Notes"]`, then the same with `Evolve` (plus any section filter the user asked for). A Keep on a 404 or 301 is almost always a slip or a crawl artefact. Report "clean" only if both queries return `total: 0`.

**C. Kill on priority content.** If the project has an audience library (`get_libraries which:["audiences"]` — note which names are Primary tier): `query_rows filters:BASE + [{field:"@effective_kke",operator:"equals",value:"Kill"},{field:"Primary_Audience",operator:"equals",value:"<each Primary audience>"}] columns:["Title 1","Notes","GA4 Sessions","Audiences"]`. Superseded pages (a dated tuition page with a note) are fine; a Kill with real traffic and no note is the finding. Also Kill with high traffic regardless of audience: sort Kill rows by the analytics column descending and look at the top ten.

**D. Consolidate without a destination.** `query_rows filters:BASE + [{field:"@effective_kke",operator:"equals",value:"Consolidate"},{field:"_ConsolidateTargetId",operator:"is-blank"}] columns:["Title 1","Consolidate_Into","Notes"]`. These produce no redirect and the content lands nowhere; always report.

**E. Auditor vs the suggestion engine.** `aggregate groupBy:["Suggested_KKE","@effective_kke"] filters:BASE + [{field:"Suggested_KKE",operator:"is-not-blank"},{field:"@effective_kke",operator:"is-not-blank"}]`. Disagreement is not error — the engine is a weighted vote from partial signals — but *systematic* disagreement in one section (engine says Keep, auditor said Kill across a whole directory) is worth a look. Pull examples for the largest off-diagonal cells, with `Suggested_KKE_Sources` and `Notes`.

**F. SME overrides, if the SME round has run.** `aggregate groupBy:["KKE_Recommendation","Final_KKE","@path_1"] filters:[{field:"Final_KKE",operator:"is-not-blank"}]`, keep rows where the two differ. A cluster (four centres in one section all flipped Kill→Keep) usually means the auditor's rule was wrong for that section, not four separate accidents — say that, and pull `SME_Notes` for the reason. Also `aggregate groupBy:["Content_Owner","SME_Decision"]` to see which owners changed most.

**G. Redirect obligations.** `get_redirects` summary → `owedButBlank` per site; list them with `get_redirects mode:"list" state:"none"`. And the inverse: pages with a destination but a Keep/Evolve decision whose URL isn't changing — only if the project has a sitemap; otherwise skip (the app's Redirect Health Check covers this properly).

**H. Blank where the section says otherwise.** Sections where audiences or Page_Type are filled on most pages but blank on a few: `aggregate groupBy:["@path_1"] filters:BASE + [{field:"Audiences",operator:"is-blank"},{field:"@effective_kke",operator:"equals",value:"Keep"}]` compared with the section's totals. These are classification gaps, not decision errors — report them separately and briefly.

## Report

Order by what would embarrass the team most if a client saw it: B (Keep on a dead URL) and D (Consolidate nowhere) first, then C, then A, then F, then E, then G and H.

For each check: one line of count and meaning, then a table of at most ten rows with the evidence columns and a **Question** column phrased as a question (*"Intentional? The other 13 posts in /news/2017 are Kill and this one has no note."*). If a check found nothing, one line saying so — a clean check is information.

End with **How to see these rows** per check

**Translate server syntax into the app's controls — `@` fields and `filters` JSON do not exist there.** The sidebar has: a **search box** (scope All fields / URL / Title), the **KKE filter** (a checkbox list of decision values plus named entries), the **Group** dropdown, **+ Field filter** (real column · operator · value), and **saved filters**. So: `@effective_kke equals Kill` → *KKE filter = Kill*; `@effective_kke is-blank` → *KKE filter = Unreviewed*; `@path_2 equals /news/2017` → *search `/news/2017/` (scope URL)*; `@content_kind` → *Field filter `Status Code equals 200`* or the entry **Not content (3xx or 4xx)**; `Primary_Audience equals X` → *Field filter `Primary_Audience equals X`* (a real column, fine as is). Named entries, verbatim: **Unreviewed · Consolidate (no target) · Consolidate (client changed — review) · Pending Final KKE · SME Conflicts · Suggested KKE: differs from my KKE · Suggested KKE: sources disagree · Needs sitemap placement (Keep/Evolve, no node) · Needs audience (Keep/Evolve, untagged) · Not content (3xx or 4xx) · Existing redirect (3xx — not content) · Inherited redirect needs review**. Write each reproduction as a recipe the strategist can click through.

Then **Not checked here** — duplicates, URL variants, redirect chains and health, which only the app computes (*Migration → Redirect Health Check*, *Redirect Chain Check*, the *Duplicates* filter).

## Don't

- Don't queue proposals from this skill unless asked; most findings are questions for a person, not changes. If the strategist answers a question with a decision ("yes, make the counselors page Keep"), *then* `propose_changes` for that row with their answer as the rationale.
- Don't call anything an error. Ask.
- Don't flag a Kill that has a Note explaining it as a finding; mention it as "explained" at most.
- Don't flag unreviewed pages as inconsistent — they are undecided, which is `audit-status`'s job to count.
