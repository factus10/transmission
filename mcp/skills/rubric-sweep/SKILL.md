---
name: rubric-sweep
description: Apply the project's own rubric patterns across the whole Transmission audit — find every page a pattern describes (a thin page whose content belongs on its parent, near-identical siblings), read the candidates and their targets, and propose decisions grouped by where the content goes. Use when asked to "apply the rubric", "run the rubric across the site", "find thin pages to consolidate", "what should merge into what", "sweep for consolidation candidates", or to check a section against the project's rubrics.
argument-hint: "[section or pattern name, optional]"
---

# Rubric sweep

The app's own rubric assessment looks at one page at a time and sees only its crawl columns, so it can't answer the questions that matter most in a consolidation: is this page thin *because its content belongs somewhere else*, and does that somewhere else have room for it? This skill answers them across the whole audit, using the rubric patterns the project itself defines — never criteria of your own.

It **proposes; it never decides.** Follow the `ask-the-audit` ground rules (blank = unreviewed, content pages, in scope, `@effective_kke`, every list reproducible in the app).

## 1. Read the rubric

`get_rubrics`. If `source` is `none`, stop: say the project carries no rubrics of its own and that the auditor can add them in **Project → Rubrics… → Copy from my library**, then **Save**. Do not fall back to general best practice — the point of the sweep is that it applies *their* rules, which they can defend to the client.

Collect every pattern (most live in `consolidate`). If the user named a pattern or a decision, keep only those. Read each pattern's parts:

- `appliesWhen` — conditions that must **all** hold; each has ready-made `filters`.
- `unless` — exceptions; a page matching **any** is out.
- `judgment` — what only the page itself can tell you. This is the part you read pages for.
- `then` — `{decision, target}`; for Consolidate the target says where the content goes (`parent` = `@url_parent`, the current site's parent; "sitemap parent" = the node above in `get_sitemap`; anything else, interpret it literally and say how you did).
- `cite` — the evidence each proposal must show. `askInstead` — when to ask rather than propose.

A condition with `filters: null` uses `>=`/`<=`; restate it with `greater-than`/`less-than` on the next whole number and say so.

## 2. Find the candidates — filters first, always

Build each pattern's filter list: its `appliesWhen` filters, plus `{field:"@content_kind",operator:"equals",value:"content"}`, plus the section the user named (see `section-review` §1), plus — unless the user asked to re-check decided pages — `{field:"@effective_kke",operator:"is-blank"}`.

1. **Count before listing:** `aggregate groupBy:["@path_1"]` with those filters. Report the total.
2. **Apply the exceptions:** for each `unless` condition, aggregate the same set with it added, and subtract. Report how many each exception removed — that is part of the finding.
3. **List what's left:** `query_rows` with the filters, `columns` covering the `cite` fields plus `["Title 1","Word Count","@url_parent","@effective_kke","Primary_Audience","Audiences"]` (whichever exist; `describe_columns` if unsure), `limit` 200.
4. **Size check.** More than ~60 candidates: show the counts by section and ask whether to work through them section by section. Each candidate costs a page read; don't spend that without saying so.

If you're re-checking decided pages too, keep them in a separate list: a pattern that disagrees with a decision someone already made is a *question*, not a proposal.

## 3. Resolve each target and check it can receive

For Consolidate, find the target for every candidate (`@url_parent` for `parent`). Then check the target, with `query_rows`/`get_row`:

- **It exists in the audit and is content.** `@url_parent` blank → no proposal; list it as "no parent page in the audit".
- **It isn't going away.** Target `@effective_kke` Kill or Exclude → the content has nowhere to land: ask instead. Target Consolidate → it is itself merging somewhere: follow its `Consolidate_Into` once and say so, or ask if that ends somewhere unexpected.
- **It isn't the homepage**, unless the pattern says so. A top-level page's `@url_parent` is the homepage; "merge into the homepage" is almost never what a rubric author meant. Ask.
- **Capacity.** Count how many candidates point at each target. Five or more thin pages into one parent is a restructure, not a merge — group them, and say that the parent may need a section per merged page.

## 4. Read the candidates and their targets

`get_page_text` in batches of up to 10 — the candidates **and** their targets (you can't judge "fits as a section of the parent" without reading the parent). The project caches what it reads, so a page read once is free for everyone after.

- Use `paragraphs` (paragraphs of a sentence or more) for any "N paragraphs" judgment, not the crawl's Word Count, which includes navigation and footer. Check `region`: if it says `body without header/nav/footer/aside`, the count is less reliable; say so for that page.
- Pages in `failed` (blocked, behind a login, timed out, gone) are **not** judged. List them under "couldn't read" with the reason. Never fill the gap from the title.

Then apply each pattern's `judgment` to what you read, page by page — and across pages:

- **Clusters:** siblings under one parent that all fit are one merged section, not five separate merges. Say which ones overlap with each other.
- **Fit:** quote the one sentence from the candidate that shows it belongs on the target (or doesn't). That sentence is the evidence a reviewer checks.
- **`askInstead`:** apply it literally. Audience mismatch is a common one — compare `Primary_Audience`/`Audiences` of candidate and target when the rubric mentions audience.

## 5. Report, grouped by where the content goes

Lead with one line per pattern: *N pages matched the conditions · M removed by exceptions · K read · J proposed · Q questions · F couldn't read.*

Then, for Consolidate, one block per **target** page:

**→ /admissions/financial-aid** (Keep · would become Evolve)
| Page | Paragraphs | Why it fits | Confidence |
|---|---|---|---|
| /admissions/financial-aid/fafsa | 2 | "File the FAFSA by March 1 to be considered…" — the parent already lists deadlines | high |

Follow with **Questions** (the `askInstead` cases and any target problems, each phrased as a question with its evidence), **Couldn't read**, and **Not checked** (anything the patterns ask that no column or page text answers).

End with **How to see these rows** — the pattern's conditions as app controls, e.g. *+ Field filter `Word Count less-than 300` · KKE filter = Unreviewed · search `/admissions/` (scope URL)* — never server syntax. The server's `@url_parent` has no app equivalent; say "pages directly under <parent URL>" and give the URL search.

## 6. Queue proposals — only when asked

Offer it in one line: *"Say the word and I'll queue the J proposals for you to review in Transmission."* When they say yes, call `propose_changes` with `source: "rubric-sweep <pattern name>"` and one change per confirmed page:

- **Consolidate:** `field: "Consolidate_Into"`, `value:` the target page's URL. Never `KKE_Recommendation: Consolidate` — it is refused, because a consolidation without a target isn't a decision.
- **Any other decision** (a pattern whose `then` is Kill, Evolve…): `field: "KKE_Recommendation"`.
- `rationale`: the pattern name plus the cited evidence in one sentence — it's what the reviewer reads before accepting.

Queue only what they confirmed; leave questions out unless told otherwise. Report `skipped` items and their reasons (the server refuses self-merges, loops, and targets marked Kill/Exclude). Tell them where it lands: *the ✦ button or the sidebar's Proposals button in Transmission*. Accepting asks once about clearing sitemap and redirect assignments and once about moving the targets to Evolve.

## Don't

- Don't invent criteria. If the rubric has no pattern for something you notice, mention it under "Not checked" as a possible pattern to add — don't act on it.
- Don't read pages before filtering. The filters exist so the sweep reads dozens of pages, not thousands.
- Don't judge a page you couldn't read, and don't treat a failed fetch as thin content.
- Don't propose into a target you haven't checked can receive it.
