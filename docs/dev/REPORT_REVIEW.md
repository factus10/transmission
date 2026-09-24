# Report review

*September 2026. Covers the 17 reports on the **Reports** menu, plus three that behave like reports: the Audit Progress dashboard, Redirect Chain Check, and Pre-Handoff Check.*

This is a list of findings for deciding what to fix, not a spec. Line references are to `src/renderer.js` at `main` (2.18.1), as of this review. The findings came from reading the code, not from running each report against a real audit. The ones marked ✔ were checked directly against the source. The rest are from code reading and should be confirmed when each is fixed.

---

## The short version

Most of the problems come from three causes that affect many reports. Each report is then weak in its own ways on top of that.

### 1. Reports disagree about which decision counts

The engine's rule is that **Final_KKE, the client's decision, wins over the auditor's recommendation** (`effectiveKke()`). The redirect resolver, the redirect CSV, the Migration Tracker and the audience reports follow it. These do not; they read `KKE_Recommendation` only:

- ✔ `gatherProgressStats()`, which feeds the Audit Progress dashboard, its PDF, the **Executive Summary** and **SME Review Status**
- ✔ **Redirect Map Report**
- **Migration Checklist**
- **Component Inventory**
- the Kill→Kill chain logic (`computeRedirectChains`) and the **Pre-Handoff Check**'s "unreviewed" check

On a project that has been through SME review, these can put a page in the wrong bucket. The worst case is a redirect listed for a page the client decided to keep, or missing for a page the client decided to kill. (PR #42 fixed the same issue for consolidation specifically.)

### 2. Reports count different sets of rows

The same project gives different totals depending on the report:

- **Out-of-scope sites.** Some reports read `reportRows()`, which leaves out sites marked out of scope. Others read `state.editedRows`, which doesn't. The second group still shows the banner saying out-of-scope pages are "excluded from every figure below", so on those reports the banner is false:
  - Menu Report, Sitemap Coverage and Net New Brief, via `_navPageCountsCache()`
  - Audience Debt's Kill list
  - Site Consolidation page counts
  - Redirect Chain Check's chain logic
  - Pre-Handoff unreviewed and consolidate checks
  - Migration Direction Brief source pages
- **Content vs. non-content.** The Executive Summary counts content pages only; redirects (3xx) and missing pages (4xx) are left out. These reports still count them:
  - ✔ Audience reports: `audienceScopeRows()` keeps every undecided row, so untriaged 3xx/4xx pages end up in every audience total.
  - Content Inventory
  - Site Consolidation
  - Cross-Site Duplicates
  - SME figures (`smeTotal`)

  A client who reads the Executive Summary and then Content Inventory will see two different "total pages" figures.

### 3. The same logic is written more than once, and the copies have drifted

- **Redirect listings.** The CSV export and the Migration Tracker both use `redirectRuleForRow()`. ✔ The Redirect Map Report and the Migration Checklist each rebuild the list themselves:
  - they don't run the resolver first
  - they derive destinations from `Computed Path` rather than the stored `Redirect_Destination`
  - Consolidate pages are dropped
  - fragments aren't skipped
  - nothing is split per source site

  **The Redirect Map Report can list different rules from the CSV you actually deploy.** This is the most serious single finding in this review.
- **"Net new" / hub pages** have three definitions:
  - the Sitemap tree and node editor (the correct one)
  - Net New Brief, which lists Header and phased nodes
  - Sitemap Coverage, which drops the has-pages-below test

  The three NEW counts can all differ.
- **Section tallies** exist three times over two row sets: Executive Summary "By Section", Content Inventory, and dashboard "By group".

### Across all reports: presentation

- **Tables have no size limit.** Redirect Map, Migration Checklist and Content Inventory's per-group blocks run to 100+ PDF pages on a real 3k–13k row audit. A PDF of 3,000 redirect rules is not something anyone deploys from.
- **No "so what".** Most reports are tables with no key findings or next step. The few that do say something (Pre-Handoff, Redirect Chain Check, Audience Coverage's under-served flag) are the most useful ones.
- **Three reports don't use the shared report layout** (`showReport`/`buildReportShell`):
  - the Audit Progress PDF
  - Sitemap Coverage, which also leaves the previous report's title in the modal
  - the Menu Report export

  They look different from the others, and have no scope banner.
- ✔ **The Menu Report export has a hardcoded header** reading *"CMS Migration & Consolidation"* and *"Internal — Not for client distribution"* (≈27395). That's on a report in the Reports menu that people will reasonably send to a client. It also loads Google Fonts, so it renders in a different font offline.
- **The report header** shows today's date and the local **file name**. It doesn't show a "data as of" date, and it exposes internal file names to the client.
- ✔ **The Audit Progress dashboard's bar** writes `var(--kke-keep)20` as a colour, which is invalid CSS. Built-in states lose their segment fill and only the border shows.

---

## Proposed plan

The phases are ordered so that each one makes the next cheaper. Phase 1 is almost entirely correctness work, and most of it consists of switching reports to helpers that already exist.

### Phase 1: make the numbers right *(highest value, mostly small)*

1. **Base every report's decision counts on `effectiveKke()`**, starting with `gatherProgressStats()`. That fixes the Executive Summary, SME Status, dashboard and progress PDF together. Also switch the Redirect Map, Migration Checklist, Component Inventory, chain logic and Pre-Handoff.
2. **Build the Redirect Map Report and the Migration Checklist's redirect table from `redirectRuleForRow()`**, after running `resolveRedirectDestinations()`. This one change fixes every redirect item under cause 3. The four redirect outputs (CSV, Tracker, Map, Checklist) then agree by construction.
3. **Kill pages with no destination.** Add them as a "needs a destination" group in the Redirect Map, and as a **Pre-Handoff check**. Today the CSV ships them as `(TBD)` and no report warns about it.
4. **Use one scope for every report:** `reportRows()`, content rows only, wherever the report counts pages for a client. That covers `_navPageCountsCache()` (or a report-specific variant of it), `audienceScopeRows()`, Content Inventory, Site Consolidation, Cross-Site Duplicates, SME figures and chain/Pre-Handoff. Where a count deliberately includes redirects (auditor progress), label it as including them.
5. **One hub / net-new helper** (the Sitemap tree's version), used by Coverage and Net New Brief.
6. **Small fixes:**
   - the dashboard bar colour
   - SME `finalResolved` should count only rows with a decision, and percentages should be capped at 100%
   - Executive Summary findings should cover Consolidate, Exclude and custom states, each with a percentage
   - remove the Checklist's duplicated URL-change table
   - count Consolidate as its own row in the Checklist instead of under "Other"
   - show Site Consolidation's hidden "(unattributed)" row
   - the Cross-Site Duplicates explanation text should state the fields it actually matched on
7. **Menu Report export:** take the header from Project Settings (client / project), drop the "Internal" badge (or make it an option), and remove the Google Fonts dependency.

### Phase 2: make them consistent

8. **Every report uses `showReport`/`buildReportShell`**, including the Progress PDF, Sitemap Coverage and the Menu export.
9. **Header:** client · project · "data as of <last save>" · the scope banner. Drop the file name.
10. **A shared cap for long tables:** top N rows plus an "…and N more" row that points to the matching sidebar filter or the CSV/Tracker export. That turns 100-page PDFs into readable ones without hiding anything.
11. **One section-tally helper** feeding the Executive Summary, Content Inventory and the dashboard.

### Phase 3: make them useful

12. **A "Key findings / Next steps" block** at the top of each report, generated from the data (e.g. most under-served Primary audience, N redirects with no destination, owners who haven't responded).
13. **Rework the three migration reports so they don't overlap:**
    - **Migration Checklist:** a scope summary that links out
    - **Redirect Map:** a summary by site and reason, plus a sample, with "deploy from the CSV" as the next step
    - **Pre-Handoff:** the readiness gate
14. **Merge Audience Debt into Audience Coverage** as a "Risks" section. Move auditor worklists (the untagged-pages list, the Debt lists) into an appendix marked as auditor-only, so the client-facing body stays short.
15. **Net New Brief as a real hand-off to writers:**
    - include empty leaves and `net-new`-tagged pages, not just hubs
    - group by section and writer
    - show Page Status, Writer Brief and Build Pattern
16. **New report: Build status by section.** Page Status × builder / writer / migrator by section. Today this only exists inside the Migration Tracker xlsx; there's no on-screen or PDF version, and it's what a PM asks for weekly.
17. *(Later)* Progress snapshots over time, so the status report can show movement, not just a point in time.

---

## Per-report scorecard

"Verdict" is how well the report does its job today, not how important it is.

| Report | Reader | Verdict | Main problems | Recommendation |
|---|---|---|---|---|
| **Executive Summary** | Client exec | OK | Raw KKE. SME % can exceed 100. Orphan finding counts redirects and Kill pages. Findings only for Keep/Kill/Evolve; counts with no %. By Section has no decision mix and doesn't add up to the headline | Phase 1 fixes; per-section decision mix; next-steps block |
| **Content Inventory by Section** | Client, SMEs | Weak | Counts all rows, so it disagrees with the Executive Summary. Bar has no Unreviewed segment. "Sample" is just the first 5 rows. One block per group gives hundreds of blocks on a large site | One ranked section table (pages, % Kill/Evolve/Keep) with top-N + Other; content-only |
| **SME Review Status** | Auditor / PM | Weak | "Assigned" means "has a decision", not "has an owner". Pending count can go negative. Any free text counts as a conflict. Conflict table (first 30 in crawl order) has no URL or notes | Per-owner outstanding lists (the chase-up sheet); conflicts with URL + notes, sorted by owner |
| **Audit Progress dashboard / PDF** | Auditor; PDF to client | OK / Weak | Bar colour bug. PDF omits the content split and SME section and builds its own layout. "Flagged / Tagged" means nothing to a client | Build the PDF on the shared shell; client-appropriate sections |
| **Menu Report** | IA / UX, build | OK | Hardcoded agency / "Internal" header. A ref to a hub shows **empty**. "Redirect-only" state can never appear. Double-counts nodes in several menus. Preview and export are separate builders | Header from settings; subtree counts for hubs; problems summary at top |
| **Sitemap Coverage** | IA lead | Weak | Not on the shared shell (stale title). All rows: "Unassigned" includes Kill/Exclude/Fragment. Path-mismatch list includes Kill. Own hub definition. Hardcoded ">5 pages" threshold | Move to the shared shell; `reportRows` + effective KKE; coverage % by section |
| **Component Inventory** | Design system / dev | OK | Raw KKE. Killed pages inflate component demand. Complexity totals computed but never shown | Count surviving pages only; show complexity; link components to Target Spec |
| **Content Type Crosswalk** | CMS architect | Good | "Pages" includes Kill/Exclude. Targets that come from the registry aren't counted | Add a surviving-pages column; count targets resolved through the registry |
| **Net New Content Brief** | Writers, client | Weak | Only lists hubs (misses empty leaves, the real new pages). Lists Header/phased nodes. No status, writer or brief. Promoted pages drop out | Rebuild as the writer hand-off (Phase 3 #15) |
| **Audience Coverage** | Strategist | Good | Totals include 3xx/4xx. "— None" shown as tier Secondary. Consolidate pages count as serving an audience | Content-only scope; fold Debt in as "Risks" |
| **Audience × Section Matrix** | Strategist / IA | OK | Shading divides by *all* pages, so an untagged section looks pale. Mixes target-sitemap sections with source URL paths. No row limit; columns clip in the PDF at 15 audiences | Shade by tagged share; Untagged column; top-N sections; choose the section source |
| **Audience Debt** | Strategist / auditor | OK | Kill list ignores scope. "— None" pages mixed with Tertiary-only pages. Suggests Consolidate for rows already Consolidate. Blank when all tiers are default | Merge into Coverage |
| **Jobs Coverage** | Strategist / exec | Good | Consolidate-only or unreviewed pages count as serving a job. Says "grouped" but has no group headers. Empty library shows only a toast | Flag thin coverage; real group headers |
| **Site Consolidation Overview** | Exec (merger) | OK | Page counts include 3xx/4xx and ignore scope. "(unattributed)" is computed but hidden, so totals don't reconcile. The "unique audiences" advice is never computed | Content-only; show unattributed; add a unique-audiences column |
| **Cross-Site Duplicate Overlap** | Auditor | OK | Title-only matching when that's the only field, while the text claims title + H1 + meta. 404 template titles form groups. Includes resolved groups. Runs with < 2 sites | Say what was matched; exclude non-content/resolved; resolved/total progress |
| **Migration Direction Brief** | Builder / writer / migrator | Good | Out-of-scope and fragment source pages included. Output title doesn't match the menu name. Migrator gets no old→new URLs or merge detail | Scope fix; add the migrator's redirect / merge columns |
| **Migration Checklist** | PM / client | Weak | Copied redirect logic (all cause-3 problems). Consolidate counted as "Other". URL changes listed twice. Nothing to check off | Scope summary that links to Redirect Map and Pre-Handoff |
| **Redirect Map Report** | Dev / devops | **Broken** | ✔ Raw KKE; ✔ destinations from `Computed Path`, not the stored/manual/inherited value; no resolver run; Consolidate dropped; fragments included; no per-site split; `(TBD)` never flagged; 100+ page PDF | Rebuild on `redirectRuleForRow()`; summary + sample; "deploy from CSV" |
| **Redirect Chain Check** | Auditor | Good | Chain logic ignores scope and uses raw KKE; misses Consolidate chains. PDF truncated at 12/25 rows | Scope + effective KKE; fold chains into `resolveFinalUrl` |
| **Pre-Handoff Check** | Auditor / lead | Good | No check for Kill pages with no destination. Unreviewed/consolidate checks ignore scope. "N issues" adds pages and categories together | Add the TBD check; scope fix; separate the units |

---

## Decisions needed from you

1. **Content-only everywhere?** The proposal is: client-facing reports count content pages; auditor tools (the progress dashboard, Pre-Handoff) count every row, labelled. Is that the split you want?
2. **Is the Menu Report meant for clients?** If it's internal-only, it should move out of the Reports menu or say so on screen, not just in the exported file.
3. **Migration Checklist:** is it worth keeping once Redirect Map and Pre-Handoff are fixed, or should it become a one-page scope summary (the proposal above)?
4. **Auditor worklists inside client reports** (the untagged list, Debt lists, Coverage's unassigned list): move them to an auditor-only appendix, or keep them inline?
5. **Build status by section:** do you want it as a report (Phase 3 #16), or is the Migration Tracker xlsx enough?

---

## Housekeeping found along the way

- CLAUDE.md's *Client reports* section still says "Six client-facing reports"; there are 17 on the menu.
- The Content Type Crosswalk's section comment sits above the Audience section (≈6139), away from its function.
- Component Inventory's co-occurrence comment says "top 10" but the code shows 15.
