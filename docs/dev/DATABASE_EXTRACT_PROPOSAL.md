# Proposal — Auditing from a CMS extract, not just a crawl

**Status:** **superseded in part** — do not implement from this document as written. Superseded 2026-08-28 by [The Unit of Audit](../methodology/the-unit-of-audit.md).
**Date:** 2026-08-27
**Scope:** support audits whose source of truth is a content-management-system export (Drupal, WordPress, Contentful, AEM, Sitecore) rather than — or in addition to — a Screaming Frog crawl.

> ### What this document got wrong
>
> It solutioned ahead of the methodology. The practice question — *what is the unit of audit, and at what altitude is each unit judged* — was settled after this was written, in
> **[docs/methodology/the-unit-of-audit.md](../methodology/the-unit-of-audit.md)**. Read that first; this document is the technical sketch downstream of it and needs rewriting against it.
>
> **Specifically superseded:**
>
> - **§5.1 (granularity) has the right conclusion for the wrong reason.** It justifies rolling components up on **scale** grounds ("30,000 rows would break the sidebar"). The real reason is **semantic**: there is no decision to make about an individual component instance. A component instance has one owner, no independent lifecycle, and no editorial identity. The decision is one per component *type*, and it is a design-system call, not a KKE call. Correct conclusion, misleading rationale — and the rationale is what a future reader would generalize from.
> - **§3 and §4 treat every entity as one audit unit.** They have no notion of **review altitude** (per entry / type + sample / configuration / design system), which is the mechanism that makes the method finishable. The row model here is not wrong, but the volume argument built on it is.
> - **Generated views are under-modeled throughout.** They are a distinct class — a URL with *no content record* — and they are the one category the crawl sees and an extract structurally cannot. §9's reconciliation buckets gesture at this; the methodology page makes it a first-class class with its own decision vocabulary.
> - **§8 conflates decision vocabularies.** Entries take KKE. Types take a *mapping*. Views take a *configuration spec*. Components take a *design-system* call. Four decisions, four vocabularies.
>
> **Still believed correct and carried forward:** one row table rather than two (§3); `rowKey()` identity (§4.3); profiles-not-plugins and the notarization argument (§5); the `pageRows()` denominator (§7) — the highest-risk item, and unchanged; the crawl/extract split and four-bucket reconciliation (§9); the session/partition findings (§6).

---

## 1. The problem, stated precisely

Transmission's unit of audit is **a URL**. That assumption is invisible because it is everywhere:

- `state.urlColumn` is read at 83 sites in renderer.js.
- `_ConsolidateTargetId` stores the master's `Address` as its stable identity.
- `import-audit-merge` joins an imported sheet to the working file **on URL**.
- `buildRedirectResolverContext()` builds a `rowByUrl` map; `detectDuplicates()`, `resolveFinalUrl()`, `crossSiteDuplicateGroups()` and `computeRowSourceSite()` all key off it.

That is correct for a crawl, because a crawl can only see URLs. It is a **methodological inheritance from 2010**, when a page was a row in a `node` table with a `body` field and the URL was a faithful proxy for the content.

It is no longer faithful. In every CMS the practice now migrates *to*, a delivered page is an **assembly**: a shell entity plus references to other entities — a hero, a set of cards, a person record, a shared promo, an auto-generated listing. Those referenced entities are content: they were written by someone, they are owned by someone, they are stale or not, and they are reused or not. A crawl cannot see any of them. It sees the flattened HTML they produced.

Three consequences, each of which we currently ship as a silent inaccuracy:

**1. We under-count the work.** A "1,200-page site" is routinely 9,000 content entities. The migration estimate built from 1,200 is wrong by most of an order of magnitude, and the client discovers this after the SOW is signed.

**2. We cannot see unpublished or unlinked content.** A crawl finds what is published *and* reachable. Content that is unpublished, orphaned from the menu, gated behind login, or reachable only from a search facet is invisible — and in most CMSes that is 20–40% of the table. `Published_Status` (Published / Unpublished / Draft / 404) already exists in the schema "for CMS-export workflows"; nothing currently populates it, because nothing can.

**3. We cannot compute reuse, so KKE is judged wrong.** A thin, low-traffic content object that appears on 40 pages looks like a Kill on every signal we currently have. It is structural. Conversely, killing a page can orphan the three content objects that existed only for it — and nobody finds out until the build.

### What is already right, and must not be disturbed

- **`Content_Nature` is already the entity/page distinction.** Page / `Content Object` (UI: "Fragment (embeddable)") / Generated. `isFragmentRow()` already routes fragments out of redirects (`resolveRedirectDestinations`, `buildRedirectsSheet`, the Redirect Editor) and out of nav-placement checks (`_needs-placement`). **The hard part of "a row that has no URL" is already built and shipping.**
- **The target side of the migration is already entity-shaped.** `PatternLibrary` carries `kind: 'Content Model'` with a `fields` schema; `ContentTypeRegistry` is a current-type → target-type + target-spec crosswalk.
- **`reportRows()` is the precedent for changing a denominator safely** — a single canonical accessor that returns `state.editedRows` *by reference* when the new dimension is inert.

So this is not a new axis bolted onto the app. **It is the completion of an arc the app is already halfway along: the target model is entity-shaped and the source model is not.**

---

## 2. Decisions proposed

1. **One row table, not two.** An entity is a row. Do not introduce a parallel entity store.
2. **Identity becomes `rowKey()`** — `Entity_ID` when present, else the URL. Mirrors `consolidateTargetAddr()`'s fallback-to-legacy shape.
3. **References live in their own edge list**, not in a CSV cell. New structural sheet `References` / table in `.transmission`.
4. **Ingest is a declarative profile, not a code plugin.** No arbitrary code in a notarized build.
5. **The profile must declare audit granularity.** Which entity types are audit units; which are page innards that roll up. Non-optional.
6. **Reports count pages by default.** `pageRows()` joins `reportRows()` as a canonical accessor; entity counts are reported as a distinct, labelled figure.
7. **The crawl stays.** The end state is a two-source audit that reconciles them, not a replacement.

---

## 3. Why one row table

The tempting move is a second model — `state.entities` beside `state.rows` — because entities genuinely are a different kind of thing. It is the wrong call here:

- Every view (sidebar, Table View, Sitemap assignment, Multi-bar, filters, saved filters, undo, change log, SME export, Migration Tracker) is written against `editedRows`. A second store forks all of it, twice, forever.
- The distinguishing fact — *does this render at a URL* — is **one column that already exists** and is already honored by the code paths that care.
- `.transmission`'s `rows` table is JSON-per-row and preserves arbitrary columns losslessly. It absorbs entity fields with no schema change.

So: an entity is a row whose `Content_Nature` is `Content Object`, and whose URL cell may be empty. The app already mostly believes this.

**What one table costs, and the mitigations:**

| Cost | Mitigation |
|---|---|
| Sidebar row counts balloon (tested to ~4k rows; a Drupal extract can be 40k) | §5 granularity filter — the real fix. Plus a default filter to page-rows on open. |
| "3,400 pages" in every report silently becomes "3,400 rows" | §7 `pageRows()`. This is the highest-risk item in the proposal. |
| Blank URL cells in the sidebar's URL column | Sidebar shows `Entity_ID` + type badge when the URL is empty. |

---

## 4. Data model

### 4.1 New audit columns

Appended to `injectAndOrderAuditColumns()` in main.js, the single source of truth:

| Column | Meaning |
|---|---|
| `Entity_ID` | The CMS's own primary key (`node/4412`, a Contentful entry id). **Stable identity.** Never user-edited. |
| `Entity_Type` | The CMS's machine type (`article`, `paragraph--hero`). Feeds `Page_Type`, which stays the human/crosswalk key. |
| `Entity_Bundle` | Sub-type where the CMS has one (Drupal bundle, WP post type + template). Optional. |
| `_Rendered_On` | **Derived.** URLs of the page-rows this entity appears on, from the edge list. `_`-prefixed: internal, hidden from Table View. |
| `_Reuse_Count` | **Derived.** `_Rendered_On.length`. The number KKE actually needs. |
| `Preview_URL` | Authenticated/preview address for an entity with no public URL. See §6. |

`Published_Status` finally gets populated — by the extract, which is what it was reserved for.

### 4.2 The `References` edge list

```
from_key    to_key    field       kind
node/1201   node/4412 field_hero  embed
node/1201   node/882  field_promo reference
```

- **Its own sheet/table, not a cell.** A page assembled from 12 entities and an entity used on 40 pages both blow past what a readable CSV cell can hold, and the graph needs to be indexed in both directions.
- `kind` distinguishes **embed** (the target renders inside the source — reuse, blast radius) from **reference** (a link or relation — weaker signal). Conflating them makes every taxonomy term look like a heavily-reused component.
- Keyed by `rowKey()`, so an edge survives a URL change.
- Built into two `Map`s on load (`refsFrom`, `refsTo`), the same way `rowByUrl` is built today.

### 4.3 `rowKey()` — the identity accessor

```js
function rowKey(row) {
  const id = String(row?.['Entity_ID'] || '').trim();
  return id || String(row?.[state.urlColumn || 'Address'] || '').trim();
}
```

83 `state.urlColumn` reads sound like an 83-site migration. They are not. Most ask *"what is this page's address"* — for a redirect, a host, a display string — and stay correct verbatim. Only the sites that ask *"which row is this"* change:

`consolidateTargetAddr` / `findConsolidateTargetRow` · `applyConsolidateTarget`'s guards · the `rowByUrl` map in `buildRedirectResolverContext` · `importMergeAudit`'s join · `detectDuplicates` · `promoteHubNodeToRow`'s existing-row check · `addNewRow`'s duplicate check.

Roughly a dozen. Each one is a place where "the URL is the row's name" is stated, and each is worth an explicit decision anyway.

**Consolidate keeps storing an Address in `_ConsolidateTargetId` when one exists** — legacy files must resolve unchanged. The read path goes through `rowKey()`, so an entity target resolves too.

---

## 5. Ingest — profiles, not plugins

The user's instinct to stay out of the database is right, and the reason is stronger than convenience.

**Why not a live DB connector:** credentials to a client's production CMS database, in a desktop app, is a liability we should not hold. Every CMS needs a different driver (native modules, rebuilt per Electron bump — we already pay this for `better-sqlite3`). Access is usually refused anyway, and when granted it takes weeks.

**Why not a code-plugin architecture:** the build is signed, notarized and hardened-runtime (`docs/dev/BUILD_SIGNED_BINARIES.md`). Loading third-party JavaScript into the main process means either disabling protections that exist for good reason, or building a sandbox and an update channel — a permanent piece of infrastructure. And the plugin would run with full filesystem access alongside client content. The cost is real and the benefit is a file format we can describe declaratively.

**What to build instead — an extract profile.** A JSON mapping from *their* export to our model:

```json
{
  "name": "Drupal 10 — node + paragraph export",
  "cms": "Drupal",
  "entity": { "id": "nid", "type": "type", "title": "title",
              "url": "alias", "status": "status", "changed": "changed" },
  "auditUnits":  ["page", "article", "person", "program", "event"],
  "rollUp":      ["paragraph--*", "media--*"],
  "ignore":      ["path_alias", "menu_link_content"],
  "references":  { "file": "references.csv",
                   "from": "entity_id", "to": "target_id",
                   "field": "field_name", "embedKinds": ["paragraph", "block"] },
  "preview": "https://cms.{domain}/node/{Entity_ID}/preview"
}
```

This is the fifth instance of a pattern the app already runs on: **seed from a curated default, then curate per project** (`ContentTypeRegistry`, `PatternLibrary`, `DesignPatternLibrary`, `Audiences`, `Sites`). Ship profiles for Drupal, WordPress, Contentful, AEM and Sitecore; let the auditor remap columns in a dialog when the export doesn't match; save the result to the project.

A profile is data. It cannot execute, it needs no signing, and a client can be sent one to fill in. If live DB access is ever genuinely wanted, the honest shape is a **separate CLI that emits this extract format** — same contract, none of the liability inside the signed app.

### 5.1 Granularity is the load-bearing setting

**This is the difference between a working feature and an unusable one.** A Drupal export of a 1,200-page site yields ~1,200 nodes and ~30,000 paragraphs. Paragraphs are almost never audit units — nobody makes a Keep/Kill call on a two-column layout wrapper. They are page innards.

So `auditUnits` / `rollUp` / `ignore` are mandatory in the profile:

- **audit unit** → becomes a row, gets a KKE decision.
- **roll up** → does *not* become a row. Contributes to its owner's `Design_Patterns` (the component inventory already exists and is exactly the right destination) and to its owner's word count.
- **ignore** → dropped.

The import dialog must show the projected row count **before** importing, live as the classification changes — the same "predict before you build" move `openCreateSitemapFromAuditDialog()` makes, for the same reason: this is the cheapest possible place to catch a 30,000-row mistake.

Rolling paragraphs up into the existing component inventory is a genuinely good trade — it turns the extract's most numerous, least interesting rows into the *component-usage* data that report currently gets by hand.

---

## 6. Viewing content that has no public URL

Three distinct cases, three answers:

**(a) Entity renders at a public URL.** Unchanged.

**(b) Entity renders only inside other pages.** It has no view of its own — but the auditor does not want one. They want to see it *in situ*. Load `_Rendered_On[0]` and offer a picker for the rest ("appears on 40 pages"). This falls straight out of the edge list and is the single highest-value viewing feature here.

**(c) Entity is unpublished, gated, or has no rendered form.** Two mechanisms:

**Preview URL template.** A project setting, `previewUrlTemplate`, e.g. `https://cms.client.edu/node/{Entity_ID}/preview`, with a per-row `Preview_URL` override. `loadUrl()` picks the public URL when there is one, else the resolved preview. Config string, no new machinery.

**Authenticated sessions.** Worth knowing before designing anything: **`<webview id="webview" allowpopups>` in index.html declares no `partition`**, so it runs on the app's default session, which persists cookies to `userData`. Logging into a client CMS inside the webview today already works and already survives a restart. Nobody designed that; it is a side effect.

Which means the work is not "add authentication" — it is **making an accidental behavior explicit and safe**:

1. **Per-project partition** (`persist:project-<hash>`). Today client A's cookies are visible to client B's audit. That is a real confidentiality problem hiding in a default.
2. **A visible session state** — a lock/unlock indicator in the webview toolbar, "Sign in to source CMS", and an explicit **Clear session** that survives into the handoff checklist. An auditor should never wonder whether a client credential is still sitting in the app.
3. **Never store credentials.** The user signs in through the real login form in the webview. We hold a cookie jar we can drop, not a password. (`safeStorage` exists for the Miro token, but a CMS password is a different risk class and there is no reason to hold one.)
4. **Handoff hygiene** — `packageForHandoff()` must never include the partition, and `runPreHandoffCheck()` should report a live session.

**Field inspector** — for an entity with no viewable form at all, render its extracted field values as a read-only panel where the webview would be. Cheap, and the only way to judge a data-only entity.

---

## 7. The counting problem

**The highest-risk item here, because it fails silently into client deliverables.** Every report counts rows. Add entities to the same table and "1,200 pages" becomes "9,000" with no code change and no warning — in the Executive Summary, on an invoice basis, in front of a client.

The fix follows `reportRows()` exactly:

```js
/** Rows that render at a public URL — the denominator for anything the
 *  word "page" appears next to. Returns reportRows() by reference when the
 *  project has no non-page entities, so crawl-only projects are unchanged. */
function pageRows() {
  const rows = reportRows();
  if (!rows.some(isNonPageEntity)) return rows;
  return rows.filter(r => !isNonPageEntity(r));
}
```

Then, per report, an explicit decision — not a default:

- **Executive Summary, Content Inventory, Sitemap Coverage, Redirect Map** → `pageRows()`, with entity totals stated separately ("1,204 pages · 7,880 content entities").
- **Component Inventory, Content Type Crosswalk, Migration Tracker Source Pages** → all rows; entities are the point.
- **Audience/Jobs coverage** → `pageRows()`. Audience is a property of a delivered page.

Ship this in Phase 0, **before** any extract can be imported. Retrofitting a denominator after the numbers have been in a client deck is not a fix.

---

## 8. What the reference graph pays for

The features that justify the whole effort — none possible from a crawl:

- **Reuse count on the audit bar.** "Appears on 40 pages." Reframes the KKE call immediately.
- **True orphans.** No URL, referenced by nothing, not in a menu → Kill, with certainty. A crawl cannot see these at all, and they are usually the largest single Kill bucket in the audit.
- **Kill blast radius.** "Killing this page orphans 3 entities used nowhere else" — a `confirmDialog`, in the shape `promptKillCleanup()` already establishes.
- **Consolidate becomes checkable.** Merging two pages that embed the same shared object is a different job from merging two pages that don't. Today we cannot tell.
- **Assembly view.** "This page is: 1 hero, 3 cards, 1 person listing (auto), 2 shared promos." What the auditor needs to *judge* the page, and what the builder needs to build it.
- **Migration Track derivation gets sharper.** `deriveMigrationTrackSuggestion()` currently infers `Content_Nature` from `Page_Type` via the registry. The extract *states* it. A guess becomes a fact.

---

## 9. Reconciling crawl and extract

The end state is **both sources**, joined on URL, with the disagreements as the finding. This is the most sellable artifact in the proposal and it exists only when both are present:

| Bucket | Meaning |
|---|---|
| In both | The normal case. Crawl supplies status, SEO metadata, GA. Extract supplies type, fields, references, owner. |
| Crawl only | Published and reachable but not in the extract — another system, static files, a subsite nobody mentioned. **Scope discovery.** |
| Extract only, published | Published but never crawled — orphaned from navigation, `noindex`, robots-blocked, login-gated. **Usually the biggest surprise in the report.** |
| Extract only, unpublished | Drafts and archives. Often thousands. A migration-scope decision nobody has made. |

Concretely: run the extract import over a project that already has a crawl, match on normalized URL, and report the four buckets. Mechanically this is `importMergeAudit()`'s join with a different key resolver and a report on the residue.

---

## 10. Phasing

Each phase is independently shippable and useful.

**Phase 0 — Groundwork (no user-visible feature).**
`rowKey()`; `Entity_ID` / `Entity_Type` columns injected; the dozen identity sites migrated; `pageRows()` and the per-report denominator decisions; per-project webview partition. *Nothing changes for a crawl-only project — that is the acceptance test.*

**Phase 1 — Extract import.**
Profile format; shipped profiles for Drupal + WordPress; import dialog with granularity classification and a live projected row count; populate `Published_Status`, `Entity_Type`, `Content_Nature`. Ships value with no graph: unpublished content becomes visible for the first time.

**Phase 2 — The reference graph.**
`References` sheet/table; `refsFrom`/`refsTo` indexes; `_Reuse_Count` / `_Rendered_On`; reuse badge; orphan filter; Kill blast-radius dialog; assembly view; paragraph roll-up into `Design_Patterns`. **The payoff phase.**

**Phase 3 — Viewing.**
`previewUrlTemplate` + `Preview_URL`; view-in-context with page picker; field inspector; explicit session UI, Clear session, handoff hygiene.

**Phase 4 — Reconciliation.**
Crawl ⇄ extract four-bucket match and report. Last because it needs both; **arguably the most valuable single output here**, and worth pulling forward if a live engagement wants it.

Contentful / AEM / Sitecore profiles land opportunistically — each is a JSON file, not a phase.

---

## 11. Open questions

1. **Does an entity get its own KKE decision, or inherit its page's?** Proposed: its own, because reuse means one entity spans pages with different fates. But it makes the KKE denominator ambiguous and needs a bulk story ("inherit from the page that embeds you") to be usable at scale.
2. **How does an entity get placed in the sitemap?** Fragments are already excluded from placement. But a *reused* entity arguably has a home — a repository location. `Node_Type: 'Fragment'` already exists for exactly this. Do they connect?
3. **Roll-up depth.** Drupal nests paragraphs inside paragraphs. Does a nested one roll up to its parent paragraph or to the owning node? (Almost certainly the node.)
4. **Multi-site + extract.** One extract per source site, or one combined? `Source_Site` is derived from the URL host — an entity with no URL has no host. Probably: stamp `Source_Site` at import time from which extract it came in on.
5. **Do we ask clients for extracts at kickoff?** This changes the sales conversation more than the tool. Worth deciding before Phase 1 ships, since it determines whether we ever get the input.
