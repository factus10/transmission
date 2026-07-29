# Proposal — URL Variant Triage

**Status:** approved · Phase 1 implemented 2026-07-29
**Date:** 2026-07-29

## Decisions taken

1. **Query-only variants → `Exclude`.** Kill implies a redirect obligation these do not have.
2. **Out-of-scope sites are skipped.** Triage reads `reportRows()`, so a property nobody is migrating never has decisions written into it by a bulk action.
3. **Undo added** — one `bulk-edit` action covers the whole triage, and Non-200 triage was retro-fitted to the same primitive.
4. **"Canonical not in crawl" is a filter**, not a report section (`_variant-target-missing`).

### Measured on the first real crawl (13,216 rows)

Applying the defaults: **6,629 Excluded · 37 Consolidated · 77 skipped** (canonical not crawled).
Audit queue **13,216 → 6,550 undecided**. Duplicates filter **9,001 → 2,361**.
One Cmd+Z reverses all 6,666 rows; redo reproduces exactly.

One correction to §2: the in-app split is **6,629 query-only / 114 path**, not 6,706 / 37. The offline figure
asked "does this URL have a query string"; the implementation asks the sharper question, "does it differ from
its canonical *only* by query string". Totals reconcile (6,629 + 114 = 6,743).

**Scope:** stop treating query-string and duplicate-path URLs as distinct content, using the signal the crawl already carries.

---

## 1. The problem

A crawl is not a content inventory. It is a list of *URLs that responded*, and on any CMS-driven site a large share of those URLs are alternate views of the same page — pagination, sorting, faceted filters, tracking parameters, print views.

Transmission currently has no concept of this. Every crawl row is a page, gets a row in the sidebar, counts in every total, and needs its own Keep/Kill/Evolve decision. On the first real consolidation crawl this was measured against, that is not a rounding error:

| | |
|---|---|
| crawl rows | 13,216 |
| URLs carrying a query string | 7,150 (54%) |
| distinct host + path | 6,080 |
| rows flagged by the existing `Duplicates` filter | 9,001 (68%) |

The `Duplicates` filter is the clearest symptom. It fingerprints on Title + H1 + Meta, so every `?page=2` shares a fingerprint with its parent list, and the filter selects two-thirds of the site. A filter that matches everything answers nothing.

The cost is real and lands on a person: an auditor asked to review 13,216 rows when roughly 6,000 are content, and a client-facing count that overstates the site by more than double.

### Why parameter-name heuristics are the wrong answer

The obvious design is a rules table over parameter names — `page`/`sort`/`items_per_page` are navigation, `page_id`/`product` are identity, `utm_*` is tracking. That is how this proposal started, and a parameter census does sort cleanly into classes:

```
list navigation / display     page · sort · order · items_per_page      (Drupal views)
faceted filters               a module-specific field_*_value prefix    (Drupal views)
faceted search                a plugin-specific prefix                  (WordPress)
search results                q · p                                     (Magento)
tracking                      utm_* and ad-network click IDs
content identity              page_id                                   (WordPress)
```

But every one of those judgements is a guess about someone else's CMS, and the guesses need maintaining per platform, per plugin, per client. Half the classes above are named by a *module or plugin* prefix, not by anything standard — a rules table would need an entry per plugin we ever meet. `p` is pagination in Magento and something else elsewhere; `q` is a search query here and a generic parameter somewhere else.

**The site already answers the question.** Screaming Frog exports `Canonical Link Element 1`, and Transmission has always ingested it losslessly — and never read it. Nothing in `renderer.js` or `main.js` consults it for any logic; `Indexability Status` is likewise only a default visible field and a token in user-authored rubric field rules.

On the same crawl:

| of the 7,150 query-string URLs | |
|---|---|
| canonical points **elsewhere** | 6,706 (94%) |
| canonical is **self** | 0 |
| no canonical declared | 444 |
| flagged non-indexable by the crawler | 7,149 |

The site is explicitly telling us these are not distinct content. That is authoritative where a parameter-name rule is inferential, it needs no per-CMS maintenance, and it generalises to variants that have no query string at all.

---

## 2. What the signal supports

Classifying every row by its declared canonical, on the same crawl:

| class | rows | notes |
|---|---|---|
| **Variant** — canonical points elsewhere | 6,743 | 6,706 query-only, **37 path-only** |
| ↳ canonical target present in the crawl | 6,666 (98.9%) | consolidation target resolves |
| ↳ canonical target absent from the crawl | 77 | a finding, not an action |
| **Canonical** — self-referencing | 3,497 | genuine content, audit normally |
| **Undeclared** — no canonical | 2,976 | 444 query · 2,532 path — judgement calls |

Two details decide the design:

**Variants collapse onto very few targets.** There are only **99 distinct canonical targets**, and the two largest absorb 4,317 and 2,284 variants — two paginated list pages generating 6,601 crawl rows between them. 81 of the 99 targets have exactly one variant. So the bulk decision is concentrated in a handful of groups a person can actually review, not 6,743 individual calls.

**The 37 path-only variants matter more than their count.** These are duplicate *paths* canonicalising elsewhere — a dying URL that needs a redirect. They behave differently from query variants and must not be lumped in with them (see §3.2).

---

## 3. Design

### 3.1 A triage dialog, modelled on Non-200

The existing **Triage Non-200 Pages** (`openNon200TriageDialog()` / `applyTriage()` / `maybeOfferNon200Triage()`) is exactly the right shape and should be mirrored, not reinvented: group rows by a shared property, show counts, offer one action per group, apply in bulk, and *offer* itself on open rather than acting automatically.

**Project → Triage URL Variants…**, sitting next to Triage Non-200 Pages. One row per canonical target, largest first:

```
Canonical target                                    Variants  Kind          Action
investors…/sec-filings                                 4,317  query only    [ Exclude ▾ ]
investors…/news-releases                               2,284  query only    [ Exclude ▾ ]
home…/product-lines                                       14  query only    [ Exclude ▾ ]
home…/about-us                                             3  path          [ Consolidate ▾ ]
…
⚠ 77 variants whose canonical was not crawled                               [ review ]
```

Plus the same **"skip rows that already have a decision"** toggle Non-200 triage has, so re-running never overwrites human calls.

### 3.2 The default action differs by kind — and this is the crux

**Query-only variants default to `Exclude`.** A variant differing from its canonical *only* by query string shares the same path. When that path is redirected at migration, the query variants follow: server redirect rules match on path and either preserve or drop the query. Marking 6,600 `?page=N` URLs as **Consolidate** would emit 6,600 redirect rules that are all the same rule. That is not a hand-off; it is noise that buries the ~400 rules that matter.

`Exclude` is the correct existing state: not part of the content inventory, no separate migration decision owed. It already means this, and downstream already honours it (`audienceScopeRows()` skips it, the Migration Tracker has an include-Exclude toggle).

**Path variants default to `Consolidate` into the canonical.** Here the URL itself dies, so it needs a rule. And this maps onto machinery that already exists exactly: set `_ConsolidateTargetId` to the canonical's Address — the same stable identity `applyConsolidateTarget()` writes — and `resolveRedirectDestinations()` derives the redirect with no further work. The redirect map writes itself.

**Undeclared and self-canonical rows are never touched.** They are the audit.

### 3.3 No new column

The evidence lives on the row already: `Canonical Link Element 1` came in with the crawl. Triage acts on it and records the outcome in `KKE_Recommendation` (+ `_ConsolidateTargetId` where relevant). Nothing needs a `_Variant_Of` column, and anyone auditing the decision later can see exactly what it was based on.

### 3.4 It records decisions; it never hides rows

Every affected row gets a real, visible KKE value, written through `logChange()` so it lands in `KKE_ChangeLog` with its before/after. Variants stay in the sidebar, in Table View, and in the file. This is the same principle the source-site scope work had to be corrected on: a page not being part of the migration is a **decision to record**, not content to make disappear.

### 3.5 Undo

Non-200 triage does not push an undo entry. At its scale that is survivable; at 6,600 rows in one click it is not. URL Variant Triage should push a **single** combined undo action (the pattern `bulkDeleteNavNodes()` already uses for multi-node deletes), and the same should be retro-fitted to Non-200 triage while the code is open.

---

## 4. What it changes downstream

- **The `Duplicates` filter becomes usable again.** Once variants are Excluded, the Title/H1/Meta fingerprint stops matching 68% of the site and starts surfacing genuine duplicate *content*.
- **Every count becomes honest.** Executive Summary, Content Inventory, progress percentages, and the Site Consolidation Overview all stop counting alternate views as pages.
- **The redirect map shrinks to the rules that exist.** ~400 real rules rather than ~7,000 near-identical ones.
- **The audit queue drops by roughly half** on a crawl of this shape — the single largest saving of auditor time available anywhere in the tool.

---

## 5. Phasing

| Phase | Contents | Effort |
|---|---|---|
| **1 — Read the canonical** | Classify rows (variant / canonical / undeclared, query-only vs path) · Triage dialog grouped by canonical target with per-group actions · `Exclude` / `Consolidate` apply with `logChange` + one combined undo · offer-on-open toast · `_url-variant` sidebar filter | M |
| **2 — Surface the gaps** | The "canonical not in crawl" list as a data-quality finding · a *Variants* column in the Site Consolidation Overview · flag suspiciously dominant targets (§6) | S |
| **3 — No-canonical fallback** | Parameter-name heuristics for the undeclared query URLs only, presented as *suggestions* to confirm — never applied unattended | M |

Phase 1 is the whole value. Phase 3 is deliberately last and deliberately advisory: it is the guess, and it should never outrank the site's own declaration.

---

## 6. Risks and open questions

**Canonicals can be wrong.** A misconfigured CMS pointing every page's canonical at the homepage is a real and common failure. Collapsing an entire site into one row on that basis would be a disaster. Guard: if a single target absorbs more than some share of all variants, flag it for explicit confirmation rather than pre-selecting an action. Note the shape is not itself suspicious — 4,317 variants of one paginated list is legitimate here — so this needs a human look, not a threshold that silently blocks.

**A site with no canonicals gets nothing** from Phase 1. That is honest: we would be guessing, and Phase 3 says so at the point of use.

**`Exclude` is a slightly lossy label.** It bundles "alternate view of another page" with "outside the audit's remit". They are different reasons for the same disposition. Notes can carry the distinction, but if it matters for reporting, a dedicated KKE state (or a `Variant` value on an existing column) would be cleaner. Raising it rather than deciding it.

**Interaction with a re-crawl.** If the crawl is refreshed, previously-triaged variants keep their decision (the skip-assigned toggle protects them) but genuinely new variants appear untriaged. That is the right behaviour; worth confirming it holds through the Import/Merge path.

### Decisions I need

1. **Is `Exclude` right for query-only variants, or should they be `Kill`?** I lean Exclude: Kill implies a deliberate removal with a redirect obligation, which is exactly what these do *not* need. But Kill is what a client might expect to see against a URL that will stop resolving.
2. **Should triage run over out-of-scope sites too?** They are still in the file and still need decisions — consistent with §3.4 — but it means acting on content nobody is migrating.
3. **Retro-fit undo to Non-200 triage** while the pattern is being written, or leave it?
4. **Is the 77 "canonical not in the crawl" case worth a report section**, or just a filter?
