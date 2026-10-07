---
name: audit-status
description: Where the audit stands right now, as a short status note — progress both ways (auditor vs client), what moved recently and by whom, what is still owed before handoff, section by section. Use for "where are we", a Monday check-in, a client status email, a stand-up, "what's left", or "what changed since Friday" on a Transmission content audit.
argument-hint: "[since YYYY-MM-DD]"
---

# Audit status

Produce a status note a strategist can paste into an email or read out in a stand-up. Everything in it comes from the `transmission` MCP tools; every figure must be reproducible in the app. Follow the ground rules in the `ask-the-audit` skill (blank = unreviewed, content pages for client figures, in scope by default, `@effective_kke`).

If the user gave a date (`since …`), the "what moved" section covers that window; otherwise use the last 7 days.

## Gather (in this order)

1. `project_overview` — client, project, `savedAt`, `auditorProgress`, `contentInventory`, `contentSplit`, `effectiveKke.contentOnly`, `placement`, `sites`, `savedFilters`.
2. **Decisions by section** — `aggregate groupBy:["@path_1","@effective_kke"] filters:[{field:"@content_kind",operator:"equals",value:"content"}]`. If `describe_columns columns:["Group"]` shows Group is well filled, group by `Group` instead and say so.
3. **What's still undecided, by section** — `aggregate groupBy:["@path_1"] filters:[{field:"@effective_kke",operator:"is-blank"},{field:"@content_kind",operator:"equals",value:"content"}]`.
4. **What moved** — `get_changelog since:<date> summary:true` for counts by auditor and field, then `get_changelog since:<date> limit:50` to characterise it (mostly new decisions? SME import? redirects?).
5. **Owed before handoff** — each is one call:
   - Consolidate with no target: `query_rows filters:[{field:"@effective_kke",operator:"equals",value:"Consolidate"},{field:"_ConsolidateTargetId",operator:"is-blank"}] columns:["Title 1"]`
   - Keep/Evolve pages with no sitemap home (only if `overview.sitemap.nodes > 0`): `aggregate groupBy:["@path_1"] filters:[{field:"Sitemap_ID",operator:"is-blank"},{field:"@effective_kke",operator:"equals",value:"Keep"},{field:"@content_kind",operator:"equals",value:"content"}]` and the same for `Evolve`. Skip fragments: add `{field:"Content_Nature",operator:"not-equals",value:"Fragment"}`.
   - Redirects owed but blank: `get_redirects` (summary) → `owedButBlank` per site.
   - Keep/Evolve pages with no audience, if the project has an audience library (`overview.libraries.audiences > 0`): `aggregate groupBy:["@path_1"] filters:[{field:"Audiences",operator:"is-blank"},{field:"@effective_kke",operator:"equals",value:"Keep"},{field:"@content_kind",operator:"equals",value:"content"}]` (+ Evolve).
6. If the SME round has started (`Final_KKE` filled on some rows — check `describe_columns columns:["Final_KKE","SME_Decision"]`): `aggregate groupBy:["KKE_Recommendation","Final_KKE"] filters:[{field:"Final_KKE",operator:"is-not-blank"}]` and report how many calls the SME changed.

## Write

Keep it under a screen. Plain prose with short lists; no raw JSON.

**Headline** — one sentence: *N of M content pages decided (P%); K inherited redirects and dead URLs triaged separately.* Give both readings when they differ materially: auditor progress (every row) and the client inventory (content only).

**Decisions so far** — the mix (Keep / Evolve / Kill / Consolidate / Exclude / undecided) over content pages, then the two or three sections that dominate the undecided tail.

**What moved since <date>** — who did what: *"David made 41 decisions, mostly /academics; the SME import landed 108 Final values on <date>, changing 4."*

**Still owed before handoff** — only the lines that are non-zero. Name the saved filter or sidebar filter that finds each.

**Next** — two or three concrete suggestions in audit order (undecided sections first, then placement, then redirects, then audiences), drawn from the numbers above, not generic advice.

Close with a one-line **How to see these rows** per figure where it isn't obvious.

**Translate server syntax into the app's controls — `@` fields and `filters` JSON do not exist there.** The sidebar has: a **search box** (scope All fields / URL / Title), the **KKE filter** (a checkbox list of decision values plus named entries), the **Group** dropdown, **+ Field filter** (real column · operator · value), and **saved filters**. So: `@effective_kke equals Kill` → *KKE filter = Kill*; `@effective_kke is-blank` → *KKE filter = Unreviewed*; `@path_2 equals /news/2017` → *search `/news/2017/` (scope URL)*; `@content_kind` → *Field filter `Status Code equals 200`* or the entry **Not content (3xx or 4xx)**; `Primary_Audience equals X` → *Field filter `Primary_Audience equals X`* (a real column, fine as is). Named entries, verbatim: **Unreviewed · Consolidate (no target) · Consolidate (client changed — review) · Pending Final KKE · SME Conflicts · Suggested KKE: differs from my KKE · Suggested KKE: sources disagree · Needs sitemap placement (Keep/Evolve, no node) · Needs audience (Keep/Evolve, untagged) · Not content (3xx or 4xx) · Existing redirect (3xx — not content) · Inherited redirect needs review**. Write each reproduction as a recipe the strategist can click through.

## Don't

- Don't report the Kill percentage over all rows if non-content rows exist; the client number is content only.
- Don't call an undecided section "unfinished" if its rows are 3xx/4xx — those are triage, not audit.
- Don't propose decisions here; this skill reports. Point to `section-review` for that.
