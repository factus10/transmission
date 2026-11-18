---
title: The Unit of Audit — Why the URL Stopped Being the Atom
status: draft
last-reviewed: 2026-08-28
---

# The Unit of Audit — Why the URL Stopped Being the Atom

The core argument: **a content audit reviews content entries, organized by content type. It does not review URLs.** The URL was a faithful stand-in for a piece of content for about fifteen years, and it quietly stopped being one. Auditing URLs now means reviewing a rendering rather than the thing rendered — counting the wrong objects, missing content that has no URL, and re-deciding the same shared content dozens of times without noticing.

This page argues the unit. It is deliberately orthogonal to [Why KKE Falls Short](./the-five-dimensions.md), which argues the *decision*: that page says one column carries five decisions; this page says the row underneath that column is the wrong object. Both critiques are real, and neither fixes the other. You can decompress the decision perfectly and still be making it about the wrong thing.

> **Note:** [Content Audit Overview](./content-audit-overview.md) opens by defining an audit as "a systematic review of every page on a site." That sentence encodes the assumption this page revises. It should be revisited once this settles.

---

## 1. Why the URL was the right atom, and when it stopped

In an early-2010s CMS, a page was a row in a table with a `body` field. One row, one URL, one thing. A crawl was a genuine census: everything that existed was published, everything published had a URL, and the URL identified it. Auditing URLs was auditing content, and nobody had to think about the difference.

Three things broke that, all of them mainstream by now:

**Composition.** Layout Builder, Paragraphs, Gutenberg blocks, AEM components, Sitecore renderings. A page is assembled at render time from parts that don't correspond to it one-to-one.

**Reference and reuse.** A content entry appears on many pages. A person record shows on their profile, their department's page, three program pages and a news byline. It is one piece of content with one owner and one lifecycle, seen at six addresses.

**Generation.** Listings, archives, taxonomy term pages, search results, faceted browse. URLs with no content record behind them — a query rendered as a page.

The result: **a URL is a view onto content, the way a report is a view onto a database.** A crawl is a census of renderings, not of content. It is still valuable — see §7 — but it is not an inventory, and treating it as one produces an audit that is confidently wrong about its own scope.

### How this shows up in practice

- **The estimate is wrong at signature.** A "1,200-page site" is routinely several thousand content entries. The discrepancy surfaces during build, after the SOW.
- **Unpublished and unlinked content is invisible.** Drafts, archives, content orphaned from navigation, content behind login, content reachable only through a facet. In most mature CMSes this is a large fraction of the table, and none of it is in a crawl.
- **Shared content is judged incidentally, many times, never as itself.** A promo block on 40 pages gets an implicit verdict 40 times, as part of 40 other decisions, and an explicit verdict zero times.
- **Generated views get audited as if they were pages.** They aren't. They're configuration, and the decision about them is a different decision.
- **The migration mapping has to be rebuilt from scratch.** The engineers need current type → target type. The audit hands them a URL list. That mapping is the actual deliverable, and it gets re-derived by hand.

---

## 2. The atom is the content-type entry

**The unit of audit is an entry of a content type**: a thing that was authored once, is owned by someone, has its own lifecycle, and migrates as a record.

That is the level at which every real decision already gets made. Migration projects map content types to content types. Editorial ownership attaches to types. Governance attaches to types. When a client says "we have 400 news articles, 900 providers, and 60 program pages," they are describing their site accurately in a way a URL count never does.

### Composition is below the atom

Blocks, paragraphs, Layout Builder sections, Gutenberg blocks, AEM components — none of these are audit units, and the reason is not that there are too many of them. **It is that there is no decision to make about an individual instance.** A 50/50 photo-text block on one page has one owner (that page), no independent lifecycle, and no editorial identity. Nobody keeps or kills the four-hundredth instance of a card grid.

The decision about composition is real, but it lives one level up and is made once: **does this component type carry forward, get redesigned, or get dropped?** That is a design-system question, informed by usage evidence — how many pages, which sections, which pages are being killed anyway, what it co-occurs with. It belongs in a component inventory, not in the page review.

The instance data still matters. It is *evidence for the type decision*, and it is what the migration engineer maps. But it is not something a content strategist reviews one at a time, and building an audit that asks them to is how you get a 30,000-row spreadsheet nobody finishes.

### What the engineers need instead

If a component type or an embedded content type is killed, the engineers need a directive, not a discovery: **this component, these N pages, remove it during the mapping.** Same for a killed embedded type. That is a *type disposition* — one line per type, with the affected page list attached — and it is an audit output, not an engineering problem to be found later.

---

## 3. Three classes of audit unit, plus one below the line

Everything in a CMS falls into one of four categories. The first three are audit units; the fourth is not.

| Class | Has a URL? | Has a content record? | Reviewed as |
|---|---|---|---|
| **Addressable entry** | Yes | Yes | Per entry — the traditional "page" |
| **Embedded entry** | No | Yes | Per type, sampled per entry |
| **Generated view** | Yes | **No** — it's configuration | Per view, as a query spec |
| *Composition* | *No* | *Belongs to its owner* | *Not an audit unit — one decision per component type* |

The vocabulary for the first three already exists and is stable: `Content_Nature` — **Page**, **Fragment** (stored as `Content Object`), **Generated**. See [Content-Type & Migration-Direction Model](../CONTENT_TYPE_MODEL.md) for how these map to target specs and direction.

### Addressable entries

A content entry that renders at its own URL. Articles, providers, products, programs, companies, standard pages. Reviewed per entry, because each has independent editorial value and a plausibly different fate. This is the class the classic audit already handles well, and nothing here changes it.

### Embedded entries

A content entry with no URL of its own, rendering only inside other entries. Shared promos, alerts, callouts, reusable copy blocks, AEM experience fragments, and in some systems entire types (a "contact block" that only ever appears embedded).

Two things follow. First, **there is no canonical view of one** — you cannot look at it directly, only in situ, on a page that embeds it. Second, **reuse changes the verdict.** A thin, low-traffic embedded entry that appears on 40 pages is structural, not disposable; every signal a URL-based audit can see says Kill.

### Generated views

A URL with no content behind it. `/news`, `/events`, `/providers`, an archive, a tag page, faceted browse, search results.

These get glossed in most audits, and they shouldn't be. A generated view:

- **Is not migrated, it is configured.** There is no record to move. Somebody rebuilds the query in the new CMS.
- **Carries an idea forward.** "We list news, newest first, filterable by topic" is a requirement, and if nobody writes it down it is discovered during build.
- **Usually belongs in the sitemap.** It's in the menu, it's linked, it ranks.
- **Usually needs a redirect.** Its path is a real URL that dies.
- **Explodes in a crawl.** Pagination and facets turn one decision into thousands of URLs — which is what makes URL-atomic auditing feel unmanageable on exactly the sites where it matters most.

The decision on a view is not really Keep/Kill. It is: **does this listing exist in the new site, over what query, at what path?**

### The composite case

Most real pages are more than one of these at once. On a company page: the company's own fields (addressable entry), its products and documents rendered inline (embedded or referenced entries), and "articles about this company" (a generated view, scoped to this entry). One URL, three classes behind it — and only one of them is what you're deciding about when you review that page.

That is the clearest possible demonstration that the URL is a rendering. Six things are being shown; a URL-based audit records one verdict.

---

## 4. Review altitude — the operational core

The obvious objection to auditing entries rather than URLs is volume: 1,200 URLs became 6,000 entries, so the work grew fivefold.

It didn't, because **not every class is reviewed at the same altitude.** Choosing the altitude per type is the central planning act of this method.

| Altitude | Applies to | The work |
|---|---|---|
| **Per entry** | Types where each entry has independent editorial value | One decision per entry — the classic review |
| **Type + sample** | Types whose entries are structurally interchangeable | One decision for the type, validated against a sample, with outliers pulled out for individual review |
| **Configuration** | Generated views | One spec per view: query, sort, filters, path, does it survive |
| **Design system** | Composition | One decision per component type, with usage evidence |

Assigning altitude is a judgment call made once per type, early, and it is where the effort estimate actually comes from. Some rules of thumb that have held up:

- If entries differ in **who owns them** or **whether they're still true**, review per entry.
- If entries differ only in **which page they appear on**, review the type.
- If the type is **generated**, it is never per-entry — the entries are the output of the decision, not the input.
- **Volume is not the criterion.** 5,000 news records can be a single type-level decision. 30 policy documents can each need individual review.

### Why this is less work, not more

This is the part that isn't obvious.

A URL-atomic audit of a composed site does hidden duplicate work: a shared block on 40 pages is implicitly judged 40 times, as a component of 40 other decisions, and never gets a decision of its own. Simultaneously it does *no* work on content it cannot see — the unpublished, the unlinked, the embedded-only — which then surfaces during build as unscoped work.

Auditing by type with varied altitude collapses the duplicated effort into one decision per type, and moves the invisible content into scope where it can be estimated. Illustratively — the shape, not measured figures — a site presenting as 1,200 URLs might resolve to something like 1,200 addressable entries at per-entry review, 30 embedded types at type-level with sampling, 40 views as configuration specs, and 25 component types as design decisions. The per-entry pile is roughly the same size as before. Everything else got smaller and became visible.

The real change is not the amount of work. It is that **the work is now aimed at objects that decisions can actually attach to.**

---

## 5. Three decision vocabularies, not one

Once the classes are separated, it becomes obvious that they don't share a decision language. Forcing them to is how "Kill" ends up meaning four different things in one spreadsheet.

| Class | Decision | Vocabulary |
|---|---|---|
| Addressable / embedded **entry** | What happens to this content? | KKE (or [CAD](./content-audit-disposition.md)) — Keep / Kill / Evolve / Consolidate / Exclude |
| Content **type** | Where does this shape land in the new model? | A **mapping**: current type → target type, or "no target — retire" |
| Generated **view** | Does this listing survive, over what? | A **configuration spec** — query, sort, filters, path |
| **Component** type | Does this pattern carry forward? | A **design-system** call — carry / redesign / drop |

KKE remains correct for entries; nothing here displaces it. What changes is that the other three decisions stop being smuggled into it. The type mapping in particular is the artifact migration engineers most need and the one an audit is most likely to omit, because it has no natural home in a page-per-row spreadsheet.

---

## 6. Reviewing what you can't see

Embedded entries have no address, and some of the most important content on a site is unpublished, gated, or in preview. Three practices:

**Review in context.** For an embedded entry, load one of the pages it appears on. This is not a compromise — it is what the auditor actually wants, because embedded content is judged in the context it renders in. A list of every page it appears on is the reuse evidence and the navigation mechanism at once.

**Use preview and authenticated views for the rest.** Most CMSes expose a preview address per entry. Unpublished content, gated content, and pre-launch content are reachable that way with a logged-in session. This is an ordinary part of the work, not an edge case, and access should be requested at kickoff rather than discovered in week three.

**Inspect the fields when there is no rendering at all.** Some entries have no visual form worth looking at — a data record consumed by something else. Reading the extracted field values *is* the review.

A practical caution: an authenticated session into a client CMS is a real credential in a real tool. It should be scoped to one engagement, visible to the auditor while it's live, and explicitly cleared at handoff.

---

## 7. Sources — and why none of them is sufficient alone

The extract does not replace the crawl. They see different things, and the disagreement between them is itself a finding.

| | The extract | The crawl |
|---|---|---|
| **Answers** | What exists | What is published and reachable, and how it behaves |
| **Provides** | Every entry incl. unpublished · type · fields · relationships · owner · lifecycle dates | Status codes · rendered titles/H1s/meta · word count · crawl depth · internal links · indexability · analytics keys |
| **Cannot see** | **Generated views** (they have no record) · **component usage on page-builder pages** · anything outside the CMS | Anything without a URL · anything unpublished or unlinked · type and structure |

Two asymmetries run the crawl's way, and together they end any argument that an extract supersedes it:

**Generated views.** The crawl sees them; the extract structurally cannot, because there is no record to export. This is the whole of §3's third class.

**Page-builder content.** Where a site uses Elementor, Divi, WPBakery or similar, the page's actual composition is stored as a serialized JSON or shortcode blob in a single field rather than as structured references. The extract can tell you the entry exists and what type it is; it cannot tell you what the page is *made of*. For those types the rendered HTML is the better source, and the crawl becomes more load-bearing rather than less.

The crawl is also the only source for how a page behaves when served — status, indexability, internal linking, and the analytics keys that make KKE calls defensible.

**The extract is the census. The crawl is the evidence.**

### The filesystem is a third sweep

Neither source sees a file that no CMS record points to and no page links: a PDF sitting in an uploads directory, legacy static HTML predating the CMS, a microsite dropped into a subdirectory years ago. A directory listing of the web root — a `find`, an FTP listing, an S3 bucket inventory — is a cheap third sweep and it is the only thing that catches them.

Keep two things separate here. **Discovery** and **review** are different decisions, and conflating them is how this gets skipped. Nearly all of these files are out of scope for *review* — nobody makes a KKE call on a 2014 PDF — but they are emphatically in scope for *discovery*, because they redirect, they rank, they get linked from other sites, and they are somebody's compliance problem. Sweep for them, count them, decide about them as a group, and say so explicitly rather than letting them fall out of the audit unremarked.

### The join key is the hardest decision in the reconciliation

Matching the extract to the crawl looks trivial and isn't. Path aliases change; a single entry can have several; language prefixes, trailing slashes, case, and redirect chains all break naive equality. Decide the key at the start, not when the join fails.

In order of reliability:

| Method | How | Reliability |
|---|---|---|
| **Entity ID embedded in rendered HTML** | The CMS emits its own primary key into every page; extract it during the crawl | **Highest** — it is the CMS naming itself |
| **Canonical path alias from the CMS** | Join on the path the CMS itself stores | Good, if aliases are stable and single-valued |
| **Slug** | Match on the last path segment | Weak — collides across sections |
| **Fuzzy title/URL match** | Last resort | Flag every match for manual review |

**The first method deserves to be the default, because it usually costs nothing.** Most CMSes advertise their own entity ID in the markup already:

- **Drupal** emits `<link rel="shortlink" href="/node/68" />` in the head of every page, independent of theme. Screaming Frog custom extraction: `//link[@rel="shortlink"]/@href`, then take the trailing integer. Body classes typically carry the content type as well (`page-node-type-basic-page`).
- **WordPress** emits the post ID via `body_class()` on any theme that hasn't stripped it — `postid-123` for posts, `page-id-123` for pages — and a `rel="shortlink"` tag pointing at `?p=123`.

This technique was documented by Lullabot on a large multi-site Drupal inventory, and its significance goes well past convenience: **the crawl can report the CMS's own entity ID and content type with no database access at all.** That makes it both the best join key and — see §10 — a far stronger fallback than it first appears when no extract is forthcoming.

Verify it on a handful of pages before trusting it across a crawl. A heavily customized theme can strip either signal, and a fully decoupled front end may emit neither.

### Reconciling them is a deliverable

Join on the strongest available key, then report the residue. Each bucket has a crisp meaning and an action:

| Bucket | Meaning | Action |
|---|---|---|
| **In both** | The normal case | Review as planned, with full evidence |
| **Crawl only** | Published and reachable, not in the extract | Scope discovery — generated views, another system, static files, a subsite nobody mentioned |
| **Extract only, published** | Published but never crawled | Orphaned from navigation, `noindex`, robots-blocked, login-gated. Usually the largest surprise in the report |
| **Extract only, unpublished** | Drafts, archives, abandoned work | A scope decision nobody has made yet |

That four-bucket table is often the single most useful page of an audit readout, and it exists only when both sources are present.

---

## 8. Documents and media — the scope nobody declares

Most audits exclude documents and media, and the reason is almost never methodological. It is that nobody scoped it. The exclusion then plays out one of three ways, and none of them is good:

- **Scripted migration carries everything across.** Whatever sits in the assets directory arrives on the new platform uninspected — the superseded, the duplicated and the inaccessible along with the rest.
- **It defers to the client.** The "we deliver the pretty box, they sort out the contents" outcome. In practice nobody sorts it out, and it becomes the new site's debt on launch day.
- **The strategist does it anyway**, off the books, because somebody has to. Real work, no line item, absorbed by whoever noticed. This is the most common of the three and the only one that leaves no trace in the record.

None of those is a decision. This section is about making it one.

### The categorization error

"Media and assets" bundles two unlike things under one word, and the bundling is what makes them invisible.

**A PDF policy document is content.** Someone wrote it, someone owns it, it carries a date, it gets superseded, and it can be wrong. That it was published as a file rather than as a record is an implementation detail of how it reached the web — exactly the way a URL is an implementation detail of how a record gets delivered (§1). It is the same error this page is about, one level over: mistaking the container for the thing.

An image in a page layout is not content in that sense. Neither is a hosted video, which is an asset in another system, with its own lifecycle, referenced by content.

So the line is not media-versus-not:

| Class | Examples | Treatment |
|---|---|---|
| **Document content** | PDF and Office documents carrying editorial content — policies, forms, catalogs, reports, brochures | **Audit units.** Usually type-level or sampled altitude (§4) |
| **Presentational media** | Images used in page layouts, decorative and illustrative | Not audit units — carried by the migration mechanism |
| **Third-party embedded media** | Video and audio hosted elsewhere | The decision belongs to the embedding page; the asset has its own lifecycle in its own system |
| **Orphaned files** | Whatever the filesystem sweep (§7) turns up | A group disposition, not individual review |

Documents are frequently the load-bearing content on a site — the form people actually came for, the policy that governs something, the catalog a program depends on. Auditing 1,200 pages while ignoring 3,000 PDFs is not a smaller audit. It is an audit of the less consequential half.

### Why a client will pay for it

Three arguments, in descending order of how well they land:

**Accessibility exposure.** Remediation obligations attach to documents as much as to pages, and a migration is the moment that liability moves onto a new platform with a fresh launch date attached to it. A scripted migration that carries everything across carries the exposure forward at volume, in one motion, invisibly. This is the argument that turns asset work from a nice-to-have into a scoped, priced deliverable — and it is a genuine service rather than a scare tactic, because the alternative is that nobody ever looks.

**Rights and licensing.** Stock licenses, commissioned photography and third-party material do not automatically survive a platform or ownership change. Nobody discovers this at a convenient moment.

**Volume and cost.** Document sets are usually large, largely stale, and heavily duplicated by pages that say the same thing in HTML. A pass that kills the superseded half is a real reduction in what has to be migrated, hosted and maintained.

### Three positions, one of which isn't available

For any engagement, declare one:

1. **In scope, audited.** Document content is reviewed at an assigned altitude, like any other type.
2. **Out of scope, inventoried.** Not reviewed, but counted, characterized, and handed over with the risks flagged.
3. **Out of scope, undeclared.** Today's default. This is not a position — it is an omission, and the work does not disappear along with the line item. It just stops being visible, or billable.

**The methodological claim is that (3) is not available.** If assets are not being audited, they are inventoried and handed over. That is the floor, and it should be stated in the SOW either way.

Inventorying is cheap, and the crawl supplies most of it: count and total size by file type, the linked-from count per file, the last-modified distribution, an orphan flag from the filesystem sweep, and a flag for documents that duplicate a page's content. Hours, not weeks — and it converts an invisible liability into a register somebody can act on, or knowingly decline to.

---

## 9. How an engagement changes

The sequence, not just the vocabulary, is different. Compare with the flow in [Content Audit Overview](./content-audit-overview.md).

**1. Get the type inventory before reviewing anything.** Content types, entry counts per type, which are addressable, which are embedded, which have views over them. This is close to free from any CMS admin, it reframes the entire engagement, and it is the only honest basis for a scope estimate. Doing this first is the largest single change to the practice.

**2. Assign review altitude per type.** Per entry / type + sample / configuration / design system. The effort estimate falls out of this step, and it is defensible because it is itemized by type.

**3. Declare a position on documents and media.** In scope and audited, or out of scope and inventoried — see §8. This is a scoping act and it belongs beside the effort estimate, not in a footnote discovered later.

**4. Map current types to target types.** Often the target model exists already, or is being designed in parallel. Either way this crosswalk is the migration's spine and should be started early, not derived at the end.

**5. Inventory the generated views.** Usually a manual pass in the CMS admin, cross-checked against the crawl. Each gets a spec.

**6. Review entries at the assigned altitude.** The bulk of the work, now aimed correctly.

**7. Run component and view tracks in parallel.** Different people. Components are a design-system conversation; views are IA and configuration. Neither should block entry review.

**8. Reconcile against the crawl, and sweep the filesystem.** Reachability, SEO and analytics evidence, the four-bucket report, and the orphaned-file sweep. This is where everything living outside the CMS surfaces — and it should surface early enough to be scoped, not during build.

Steps 1 and 2 are the transformational ones. They move the scoping fact — *how much content is actually here, and how much of it needs individual judgment* — from the middle of the project to the beginning.

---

## 10. What to ask the client for

Ask at kickoff, in this order. Each item is useful on its own, so a partial answer still moves the work forward.

1. **The content type list with entry counts.** Cheap, fast, available from any CMS admin. Even alone it reframes scope.
2. **Per type: is it addressable, what is its URL pattern, how many published vs. unpublished.**
3. **The inventory of listings and views** — usually manual, from the admin. Nothing else produces this.
4. **The extract itself** — one file per type, or one file with a type column. Entry ID, type, title, URL/path, status, dates, owner, and the fields that carry editorial content.
5. **Relationship/reference data**, if the system can export it — what embeds or references what.
6. **A directory listing of the web root** — for the filesystem sweep in §7. Usually a one-line request to whoever runs the servers.
7. **Read access to the CMS admin**, which answers questions no export anticipates.
8. **Preview or staging access**, for unpublished and gated content.

### How to ask for the extract

*How* you ask determines what you get, and the framing matters more than the technology.

**Do not ask for database credentials.** It is the hardest ask, it is the one most likely to be refused outright, and it puts you in custody of client production data you have no reason to hold. It also skips the people who know things the schema doesn't.

The productive middle rung is **"can your developer run one command for us"**:

- **Drupal** — a `drush` entity-query script, or a config export for the content model. Respects the entity API, so it catches computed fields a raw SQL query misses.
- **WordPress** — `wp post list --post_type=any --post_status=any`, plus `wp post-type list` for the model. Handles custom post types and serialized meta properly.
- **Headless / SaaS platforms** — the platform's own export API or CLI.

That is a small, bounded, auditable request that a developer can evaluate in a minute, and it produces a better extract than the CSV an admin screen will give you.

**One trap worth naming up front, because it fails silently.** Anonymous WordPress REST requests (`/wp-json/wp/v2/posts`) return only `publish`-status content by default. You get a clean-looking, complete-looking extract that omits every draft, pending and private entry — which is precisely the content the crawl also can't see, and precisely the reason you asked for an extract at all. Draft statuses need an authenticated request with `edit_posts` capability. Check the status distribution in any extract you receive: if nothing is unpublished, assume the extract is wrong before assuming the site is unusually tidy.

### When you can't get an extract

Common, and not fatal. Degrade in this order:

- **Crawl with entity-ID extraction.** Before treating "no extract" as a real constraint, check whether the site advertises its own entity IDs and content types in the markup (§7). On stock Drupal and WordPress it usually does, and Screaming Frog can pull them during the crawl you were running anyway. **This is not inference — it is the CMS naming itself.** You get real type classification, and therefore review altitude, type mapping and the component/view distinction, with zero client cooperation. It still cannot see unpublished or unlinked content, which is the one thing only an extract provides.
- **Type list + counts only.** Enough to set altitude, size the work, and structure the type mapping. This is the floor and it is worth insisting on — it is a screenshot of an admin page.
- **Add a CMS admin walkthrough.** An hour with someone who knows the system identifies embedded-only types and views faster than any export.
- **Add per-type exports for the types that matter.** Rarely all-or-nothing; the four or five high-volume types are usually exportable even when a full extract isn't.
- **Crawl only, classified by URL pattern and template.** The genuine floor. Weakest, and explicitly a set of inferences — record it as such so nobody downstream mistakes it for the CMS's own account of itself.

---

## 11. Open questions

Honest gaps in this method as written:

1. **Does an embedded entry get its own KKE decision, or inherit from the pages that embed it?** Reuse means one entry can span pages with different fates. Leaning toward: its own, with inheritance as the bulk default.
2. **Where does an embedded entry live in the IA?** It has no menu position, but reused content plausibly has a repository home. See the Fragment node treatment in [Content-Type & Migration-Direction Model](../CONTENT_TYPE_MODEL.md).
3. **Translations.** One entry with N translations, or N entries? Usually the decision is at the entry level and translations follow — but not always, and not when language sites have separate owners.
4. **Taxonomy.** Terms are entities, and term pages are generated views. But the vocabulary itself is a governance question, not a KKE question — see [Vocabulary Governance](./vocabulary-governance.md).
5. **Group disposition for orphaned files.** §8 says declare a position and inventory at minimum; it does not say what to *do* with four thousand orphaned files once inventoried. Counting them is easy. Deciding about them as a class — and getting a client to own that decision — is not, and a per-file review is never happening.
6. **Does document content need its own review altitude rules?** §8 puts it at type-level or sampled, by analogy. But a document set's staleness distribution is usually far worse than a page set's, and "sample it" may be the wrong instinct where each document carries its own compliance obligation.
7. **Revisions.** Never audit units. Worth confirming an extract excludes them, since raw table counts often don't.
8. **Does this change what we sell?** Asking for a type inventory at kickoff changes the shape of the engagement and the estimate. That is a practice decision before it is a tooling one.

---

## See also

- [Content Audit Overview](./content-audit-overview.md) — the engagement this sits inside; its opening definition needs revisiting against this page
- [Why KKE Falls Short — The Five Dimensions](./the-five-dimensions.md) — the parallel critique: that page decompresses the decision, this one decompresses the unit
- [Content Audit Disposition (CAD)](./content-audit-disposition.md) — the proposed decision model, which applies to entries once the unit is right
- [Patterns Where KKE Breaks](./patterns.md) — several of these patterns are symptoms of the wrong unit, not the wrong vocabulary
- [Content-Type & Migration-Direction Model](../CONTENT_TYPE_MODEL.md) — the target-side model: renders-as kinds, target specs, and the three kinds of direction
- [Vocabulary Governance](./vocabulary-governance.md) — type and component vocabularies degrade the same way audit vocabularies do
