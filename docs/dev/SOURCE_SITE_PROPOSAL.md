# Proposal — Source Site as a first-class dimension

**Status:** approved · Phases 1–3 implemented 2026-07-29
**Date:** 2026-07-29
**Scope:** support audits that consolidate several existing sites into one, where the multiplicity is expressed as multiple domains (`www.company.com`, `home.anothercompany.com`, `thirdcompany.com`).

## Decisions taken

1. **`Source_Site` is a stored column**, recomputed on open and on any registry change (the `Page_Breadcrumb` pattern).
2. **Out-of-scope sites drop out of report denominators.** `reportRows()` is the canonical accessor; it returns `state.editedRows` *by reference* when nothing is out of scope, so single-site projects are provably unchanged.
3. **One redirect sheet per source domain** in the Migration Tracker, and one CSV per domain from the Redirect Map export (a folder picker, mirroring `sme-export-multi`).
4. **No migration sequencing.** `wave` was dropped from the model — sequencing lives outside this tool. `cms` and `owner` were kept, as they describe the site rather than the schedule.

---

## 1. The problem

Transmission currently models an audit as **one site becoming one site**. That assumption is invisible on a single-domain crawl and wrong in a consolidation, where the unit of work is often not the page or the section but *the site*: it has an owner, a CMS to export from, a migration wave, its own redirect configuration, and its own go/no-go decision.

Today the source domain exists only as a substring of the `Address` cell. Nothing reads it, so:

**Every grouping silently merges sites.** This already bit the audience work — `makeSectionResolver()` merged `companyA.com/about` and `companyB.com/about` into one "About" row until it was taught to qualify by host (renderer.js). That fix is local to the audience reports. Every *other* grouping in the app still merges: Content Inventory by Section, the Executive Summary's section breakdown, and `createSitemapFromAudit()`, whose `findOrCreateBucketNode()` (renderer.js:11674) matches purely on label, so three sites' `/about` collapse into one node whether or not that was intended.

**The redirect base is picked arbitrarily.** `getRedirectBaseUrl()` (renderer.js:24561) uses `projectSettings.siteDomain` when set, and otherwise **the origin of the first row that parses**. On a multi-domain crawl with `siteDomain` unset, every derived `Redirect_Destination` is built on whichever domain happened to sort first. It is not wrong so much as arbitrary, and nothing warns.

**The redirect map can't be handed over.** `buildRedirectsSheet()` (renderer.js:22099) and the Redirect Map CSV emit one flat list keyed by source URL. But each retiring domain needs its **own** redirect configuration, on its own host/CDN/server. The migration engineer receives one sheet and splits it by hand — exactly the kind of manual re-derivation the tracker exists to remove.

**Cross-site duplication is invisible.** `detectDuplicates()` (renderer.js:25657) fingerprints on `Title 1` + `H1-1` + `Meta Description 1`, so it *already* catches the same About page existing on three domains. But the result is an undifferentiated `_duplicates` filter. The genuinely useful question in a consolidation — *"which pages exist on more than one of these sites, and which copy wins?"* — is the single biggest driver of Consolidate decisions, and the data to answer it is already computed and then thrown away.

**There is no per-site progress or scope.** "Is anothercompany.com done?" and "is thirdcompany.com even in scope for this phase?" are ordinary questions with no answer in the tool.

### What already works, and shouldn't be touched

Worth stating so the proposal doesn't over-reach:

- **Consolidate is already cross-domain-safe.** `_ConsolidateTargetId` stores the master's full `Address`, so a target on another domain resolves correctly with no changes. This was a good call and stays.
- **The redirect *destination* is legitimately single-domain.** In a consolidation everything lands on one new site, which is precisely what `siteDomain` means. The destination side needs no new concept — only the source side does.
- **Content-based duplicate detection is the right primitive.** It needs surfacing, not replacing.

---

## 2. Why a registry, not just "parse the host"

Source site is derivable from the URL, so the obvious move is to derive it everywhere and stop. That fails on three counts:

1. **Host ≠ site.** `www.company.com` and `company.com` are one site (the current Acadia test file contains both — 403 and 31 rows). `careers.company.com` might be one site with `www.company.com` or a separate property being retired; `blog.company.com` likewise. Only the auditor knows. A grouping rule guessed from the hostname will be wrong on roughly every real engagement.
2. **A site carries facts the URL doesn't.** Which CMS it exports from, who owns it, which migration wave it's in, when it cuts over, whether it's in scope this phase. These drive sequencing and hand-off.
3. **Labels matter in deliverables.** "Legacy Corporate Site (Sitecore)" reads better in a client readout than `www.company.com`.

That is the same shape as `ContentTypeRegistry`, `PatternLibrary`, and the new `Audiences` sheet: **a per-project registry, seeded from what's in the data, then curated.** The app already has this pattern four times over; this is a fifth instance of it, not a new mechanism.

---

## 3. Data model

### 3.1 The `Sites` structural sheet

Per-project, following `Audiences` exactly (parse/write pair in main.js, listed in `structuralNames`, excluded from the `KKE_Settings` JSON blob, carried in `projectSettings.siteLibrary`).

```js
projectSettings.siteLibrary = [
  { label: 'Corporate (legacy)',      // what appears in reports
    hosts: ['company.com', 'www.company.com', 'careers.company.com'],
    cms: 'Sitecore 9',
    owner: 'Marketing',
    wave: '1',
    inScope: true,
    color: '#2563eb',
    notes: '' },
  ...
]
```

`hosts` is a list precisely because the www/non-www and subdomain-grouping decisions are the auditor's to make. Sheet columns: `Label`, `Hosts` (comma-separated), `CMS`, `Owner`, `Wave`, `In_Scope`, `Color`, `Notes`.

**Seeding is automatic and safe:** on open, any normalized host present in the data but absent from the registry gets its own entry, label = host, `inScope: true`. So a single-domain project silently gains a one-entry registry that changes nothing, and a consolidation project opens with a real starting list to curate. This mirrors how the audience library folds in unknown values found in the data.

### 3.2 `Source_Site` — a derived-but-stored column

Add `Source_Site` to `injectAndOrderAuditColumns()`, recomputed on open and whenever the registry changes.

This follows the **`Page_Breadcrumb` precedent exactly** (`computeRowPageBreadcrumb()` renderer.js:16593 / `recomputeAllPageBreadcrumbs()` renderer.js:16604): a value fully derivable in-app, materialized into a column so that filtering, sorting, Table View, the field-filter system, saved filters, sitemap/treemap coloring via `SITEMAP_ROW_FIELDS`, and every export get it **for free** rather than each growing its own host-parsing.

Deriving it on the fly instead would mean touching a dozen consumers; storing it means touching one recompute function. The cost is one more column and the discipline of recomputing it — the same trade `Page_Breadcrumb` already made and which has held up.

---

## 4. Where it pays off

### 4.1 Deliverables (the strongest case)

- **Redirect map split per source site.** `buildRedirectsSheet()` gains a per-site grouping, and the Migration Tracker emits either one sheet per retiring domain or one sheet with a `Source Site` column and a frozen filter. The Redirect Map CSV export gains the same. This is the item with the clearest hand-off value: each domain's redirect config is a separate operational artifact, always.
- **Migration Tracker + Client Export** carry `Source Site`, so the client can pivot on it.
- **Per-site cutover sequencing** via `wave`, which the Migration Checklist can group by.

### 4.2 Reports

- **Site Consolidation Overview** (new; the readout artifact). One row per source site: pages, KKE mix, audiences served, how many pages duplicate another site's content, how many redirect off-domain, in-scope flag, wave. This is the "what are we actually merging, and what does each site contribute" table that currently gets built by hand in a spreadsheet.
- **Cross-site duplicate overlap** (new; builds on `detectDuplicates()`). Content fingerprints that appear on 2+ *sites*, with the copies listed side by side and the KKE call on each. This is the Consolidate worklist for a merger, and the computation already exists — it needs a grouping and a report, not an engine.
- **Existing reports gain a site dimension**: Executive Summary gets a per-site breakdown; Content Inventory by Section can group by site first; Audience × Section becomes explicitly Audience × Site when a site axis exists (superseding the host-qualification heuristic I added to `makeSectionResolver()`, which can then be simplified to read the registry).

### 4.3 Sitemap building

`createSitemapFromAudit()` gains a **merge mode**: *merge sites* (current behavior — `/about` from all three lands in one node, which is the point when you're genuinely unifying) or *keep separate* (top-level bucket per source site, for auditing before deciding what merges). Neither is right in general; today only the first is possible, and it's implicit.

### 4.4 Correctness fix

When the registry holds more than one in-scope site and `projectSettings.siteDomain` is unset, warn — because `getRedirectBaseUrl()`'s first-row fallback is arbitrary in that case. Cheap, and prevents a whole class of quietly wrong redirect destinations.

---

## 5. Phasing

| Phase | Contents | Effort |
|---|---|---|
| **1 — Name the sites** ✅ | `Sites` sheet + `siteLibrary` + auto-seed from hosts · `Source_Site` column + recompute · Project Settings → Sites tab (label, hosts w/ page counts, host merge, in-scope, color, CMS/owner) · field-filter/Table View/sitemap-coloring fall out free · the `siteDomain` warning | M |
| **2 — Hand it off** ✅ | Redirect map split per source site (tracker sheets + per-domain CSVs) · `Source Site` in Migration Tracker Source Pages · Site Consolidation Overview report | M |
| **3 — Find the overlaps** ✅ | Cross-Site Duplicate Overlap report over the existing fingerprints · `_cross-site-duplicate` sidebar filter | S–M |
| **4 — Sequence it** | ~~`wave`~~ (dropped — out of scope) · per-site progress in the dashboard · sitemap build merge-mode toggle | S |

Phase 4's remaining two items were **not** built. The sitemap build merge-mode toggle
(`createSitemapFromAudit()` still merges same-label buckets across sites, which is
sometimes the point and sometimes wrong) is the one worth revisiting first.

Phase 1 alone is worth shipping: it makes the dimension visible and filterable everywhere, at which point a lot of the manual work becomes possible even before the dedicated reports exist. Phase 2 is where it starts saving the migration engineer real time. Phase 3 is the one that changes audit *decisions* rather than reporting.

---

## 6. Risks and open questions

**Single-domain projects must not notice this.** The registry auto-seeds one entry, `Source_Site` holds the same value on every row, and every grouping behaves as it does today. Worth an explicit test: the current Acadia file (two hosts, one site) must produce a one-entry registry and byte-identical report output.

**Host grouping is a judgment call the tool can't make.** Auto-seeding one site per host is the safe default, but on a real engagement the first task is merging `www.`/`careers.`/`blog.` entries into the right sites. If that curation step is skipped, reports fragment. Mitigation: the Sites tab should show page counts per host so the merge decisions are obvious, and possibly suggest merges where hosts share a registrable domain.

**`Source_Site` can drift** if a row's `Address` is edited after derivation — the same exposure `Page_Breadcrumb` has. Recompute on open covers the realistic cases.

**A crawl is not a content inventory.** Site-level scope answers "is this property part of the engagement"; it does nothing about the ~50% of a typical crawl that is alternate views of the same page. That is a separate axis — see [URL_VARIANT_TRIAGE_PROPOSAL.md](./URL_VARIANT_TRIAGE_PROPOSAL.md).

**Scope discipline.** This proposal deliberately does *not* touch: the Consolidate identity model, the single-destination redirect base, or the content-fingerprint duplicate engine. All three are correct as they stand and only need surfacing.

### Decisions I need

1. **Does `Source_Site` earn a stored column, or should it stay derived?** I lean stored, on the `Page_Breadcrumb` precedent — it buys filtering, Table View, saved filters, sitemap coloring, and exports with no per-consumer work. The cost is column bloat on single-site projects, where it's a constant.
2. **Should out-of-scope sites be excluded from report denominators**, the way Kill/Exclude rows already are in `audienceScopeRows()`? Consistent, but it means an `inScope: false` toggle silently changes every percentage in the deck.
3. **One redirect sheet per domain, or one sheet with a `Source Site` column?** Per-domain matches how the configs are actually deployed; one sheet is easier to scan and diff. Could be a dialog toggle like the tracker's other options.
4. **Is "wave" real for you**, or is sequencing handled outside the tool? It's cheap to add and easy to leave blank, but if it goes unused it's another empty column in the hand-off.
