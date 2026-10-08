---
name: section-review
description: Review one section of a Transmission content audit with the strategist — profile its pages, surface the patterns a person would spot after twenty of them, and propose Keep/Kill/Evolve/Consolidate calls for the undecided ones as a worksheet to confirm. Use when asked to "go through", "review", "work through", "help me decide" or "what should we do with" a section, directory, URL prefix, sitemap node, content type or group of pages in the audit.
argument-hint: "<section — a URL prefix like /news, a Group name, or a sitemap node>"
---

# Section review

The audit pass is where a strategist's hours go: open a page, decide, write why, next. Most of a section is decided by its pattern — the same type, the same age, the same traffic — and the exceptions are what deserve attention. This skill does the pattern work from the project data so the person can spend their judgement on the exceptions.

It **proposes**; it never decides. Output is a worksheet the strategist confirms and then applies in the app (one row at a time, or in bulk with the Multi-bar on a filtered list). Follow the `ask-the-audit` ground rules: blank = unreviewed, content pages only, `@effective_kke`, every list reproducible.

## 1. Pin down the section

Resolve what the user named to a filter:

- A URL prefix (`/news`, `/academics/departments`): `{field:"Address",operator:"starts-with",value:"https://<host>/news"}` — take the host from `project_overview.siteDomain` or the first rows. Or use `@path_1` / `@path_2 equals /news`.
- A Group: `{field:"Group",operator:"equals",value:"News"}`.
- A sitemap node: `get_sitemap` to find its id, then `{field:"Sitemap_ID",operator:"equals",value:"n005"}` — but note that only *placed* pages match; the URL prefix is usually what they mean.
- A content type: `{field:"Page_Type",operator:"equals",value:"News article"}`.

Always add `{field:"@content_kind",operator:"equals",value:"content"}` unless the user asks about redirects/404s. Call the resulting array `SECTION` below.

## 2. Profile it

Run these and read them together:

1. **Size and state** — `aggregate groupBy:["@effective_kke"] filters:SECTION`.
2. **What it's made of** — `aggregate groupBy:["Page_Type","@effective_kke"] filters:SECTION`, then the same over `Content_Owner`, `Audiences` and whatever date / analytics columns exist (`describe_columns` without arguments lists them; crawl exports vary — look for `Last Modified`, `GA4 Sessions`, `Word Count`, `Inlinks`).
3. **Sub-structure** — `aggregate groupBy:["@path_2","@effective_kke"] filters:SECTION` (for a deep section, `@path_2` is the year or subsection — the single most useful cut).
4. **The decided part, as precedent** — `query_rows filters:SECTION + [{field:"@effective_kke",operator:"is-not-blank"}] columns:["Title 1","Page_Type","@effective_kke","Notes","Last Modified"] limit:40 sortBy:"Last Modified"`. The Notes on decided pages are the auditor's own reasoning; reuse their words and thresholds (e.g. "archival news; no traffic") rather than inventing new criteria.
5. **The undecided part** — `query_rows filters:SECTION + [{field:"@effective_kke",operator:"is-blank"}] columns:["Title 1","Page_Type","Status Code","Last Modified","GA4 Sessions","Inlinks","Word Count","Audiences","Suggested_KKE"] limit:200 sortBy:"GA4 Sessions" sortDir:"desc"` (use whichever traffic/date/size columns exist). Page through `nextOffset` if needed; if more than ~200 are undecided, work by `@path_2` sub-group instead of all at once and say so.
6. **Signals already in the file** — `Suggested_KKE` (the app's weighted vote from analytics, rubric and audience) and `Suggested_KKE_Sources` (`disagreement:true` means the sources disagreed, which is itself informative). `Audiences` tier, via `get_libraries which:["audiences"]`.

## 3. Find the patterns

State the two to four patterns that explain most of the section, each with a count, e.g.:

- *92 of 104 news posts dated 2016–2021 are Kill with the note "archival news; no traffic"; 2023–24 posts are Keep.*
- *Every department has a `/research` sub-page; 5 are Consolidate into the central Research section, 2 have no target yet.*
- *Nothing under /student-life has an audience tagged or a decision.*

Then the **exceptions** — pages that break their own pattern (a Keep inside a Kill year, a page with real traffic marked Kill, a Keep with a 404). These are the ones worth a human's minute.

## 4. Propose

For each undecided page (or each sub-group when the section is large), one proposed decision with a one-line reason **in the auditor's own vocabulary** from step 2.4, and a confidence:

| URL | Proposed | Why | Confidence |
|---|---|---|---|
| /news/2022/… | Kill | Same pattern as 2016–21: archival, 3 sessions, no priority audience | high |
| /about/mission | Keep | Core institutional page; links from 14 pages | medium — no owner has looked at it |
| /academics/departments/english | **ask** | Department landing with 1,200 sessions but no audience tagged; the other 7 departments are Keep — confirm before assuming | low |

Rules for proposals:

- Use `Suggested_KKE` as one input, not the answer; say when you're agreeing with it and when you're not and why.
- Prefer the decision the section's own precedent implies. If there is no precedent (nothing decided yet), say so and propose conservatively — Keep/Evolve for pages with traffic or a priority audience, **ask** for the rest — rather than inventing a Kill threshold.
- Never propose Consolidate without naming the target page, and never propose Kill on a Primary-audience page without flagging it explicitly.
- Blank audiences are *unassessed*, not a reason to Kill.
- If the project has a glossary (`get_libraries which:["glossary"]`), use its tag definitions when suggesting tags.

## 5. Hand it back

End with:

- **Apply in the app** — the sidebar filter that shows exactly the proposed-Kill set (and the proposed-Keep set), so the strategist can select-all and use the Multi-bar: e.g. *Search `/news/2022/`, KKE filter = Unreviewed, then Apply → KKE → Kill.* Where the proposal isn't bulk-shaped, say so. Use the app's controls, not server syntax: search box (scope URL) for a path, **KKE filter = Unreviewed**, **+ Field filter** on real columns (`Page_Type equals Directory`), never `@path_1` or `filters:[…]`.
- **Exceptions to look at by hand** — the short list from step 3.
- **What I couldn't see** — e.g. the app's duplicate detection, page content itself (you have metadata, not the page), anything the user asked that the columns don't carry.
- **Offer to queue it** — one line: *"Say the word and I'll queue the N high-confidence proposals for you to accept in Transmission."* Do not call `propose_changes` until they say yes.

## 6. Queue proposals (only when asked)

When the strategist confirms, call `propose_changes` with one change per page you proposed, `source:"section-review <section>"`, and the worksheet's **Why** as each `rationale` — that sentence is what they read in the app before accepting. Queue only the rows they confirmed (typically the high-confidence ones; leave **ask** rows out unless told otherwise). Never propose `Consolidate` — it needs a target only the app's picker can set; list those separately as "set by hand". If the result reports `skipped` items (already that value, page not found) or `replacedPending`, say so. Then tell them where it lands: *the ✦ button / sidebar "Proposals" button in Transmission, or Project → Review Proposals*. Nothing is changed until they accept there.

## Don't

- Don't propose decisions for pages that already have one — list them as precedent, or as exceptions if they break the pattern.
- Don't read a page's age or traffic as a decision rule the auditor hasn't used.
- Don't paste hundreds of rows; group, count, and show representative examples.
