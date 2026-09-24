# Migration Track — Baseline Definitions

Migration Track answers a different question than KKE: **how does this page move into the new system?** Where KKE is a content-quality call (owned by content strategists), Migration Track is a delivery call (owned by technical architects, developers, and the content team executing the migration). The two correlate but don't determine each other.

Six tracks: **Scripted**, **Migrate Records**, **Configure**, **Manual Rebuild**, **Merge**, **Kill/Redirect**. Plus blank (not yet decided).

---

## Scripted

**Scripted = "A migration script can move this page into the new CMS without human intervention."**

Scripted is the default for content that's structured well enough to extract from the source system, transform predictably, and load into the new CMS as a page. The technical team writes the script; the script runs; the page appears in the new system in the right shape, with the right content, in the right place.

### When to choose Scripted

- The page exists in the source CMS as a discrete unit (a node, a post, a page record)
- Its layout maps cleanly to a known component pattern in the new CMS
- The content fields (title, body, hero image, metadata) line up with target fields, or can be transformed with predictable rules
- Multiple pages share the same shape — the script will handle this and 50 others like it
- Edge cases are rare enough that a few manual fix-ups post-script are acceptable

### When *not* to choose Scripted

- Layout is unique or complex enough that a generic script will produce broken output → **Manual Rebuild**
- Content lives as structured records (faculty, events, articles), not pages → **Migrate Records**
- The page is system-generated and the new CMS will regenerate it from data → **Configure**
- The page should fold into another → **Merge**
- The page isn't moving forward → **Kill/Redirect**

### What Scripted commits the project to

- A migration script written, tested, and run by the technical team
- A spot-check pass after the script runs — verify it actually produced the right output for this page
- A fallback plan if the script fails for this row specifically (most common: demote to Manual Rebuild)

### Authoring rule

Scripted is the *cheapest* track per page but the *most expensive* to set up. The threshold is "are there enough pages of this shape to justify writing a script?" If this is a one-off, it's probably Manual Rebuild even if the layout is technically simple.

---

## Migrate Records

**Migrate Records = "This is structured content (a record), and the new CMS will store it as a content-type entry, not a page."**

Migrate Records applies to content that's *about* something — a faculty member, an event, a press release, a course — where the source system stored it as a content object and the new CMS will too, but the storage mechanics are different enough that a page-migration script doesn't apply. The migration extracts records from the source database (or via the CMS API), transforms field-by-field, and loads them as new content-type entries.

### When to choose Migrate Records

- The content has a content-type identity in the source system: faculty bio, event listing, news article, course catalog entry, alumni spotlight
- The new CMS will model it as a content type with structured fields, not as freeform pages
- The mapping is record-to-record, not page-to-page
- URL is generated from the content type's slug pattern, not authored as a path

### When *not* to choose Migrate Records

- The content is a freeform page that happens to be about a topic → **Scripted**
- The new CMS will *generate* the listing/index pages dynamically from these records — only the records themselves are Migrate Records; the listing pages are **Configure**
- The records are too inconsistent or messy to map cleanly → **Manual Rebuild**
- The content is being retired → **Kill/Redirect**

### What Migrate Records commits the project to

- A content-type schema in the new CMS (defined by the engineering team in coordination with content strategy)
- An ETL pipeline (extract from source, transform fields, load as new entries)
- A validation pass — record counts match, required fields populated, relationships preserved
- URL handling: confirm the new CMS's URL pattern preserves or redirects from the old paths

### Authoring rule

If you find yourself asking "is this a page or a record?" — look at how the content is *authored* in the source system. If editors create it through a form with structured fields, it's Migrate Records. If they author free-form HTML or use a page builder, it's Scripted (or Manual Rebuild).

---

## Configure

**Configure = "The new CMS will generate this page automatically once the underlying data and templates are in place."**

Configure applies to pages that aren't really *content* in the migration sense — they're system-generated views over content that lives elsewhere. Listing pages, tag archives, search results, faceted browse pages, automatically-paginated indexes, "recent news" landing pages. Nothing migrates *to* these URLs because nothing lived *on* them in the first place — the source CMS generated them, and the new CMS will too, once configured correctly.

### When to choose Configure

- The page is a list, index, archive, or browse view rendered from underlying records
- The page's content changes whenever the underlying records change
- The source CMS doesn't store this page's body as authored content — it computes it
- The new CMS has a templating system that will produce the equivalent view from migrated content-type entries

### When *not* to choose Configure

- The page has authored content (intro paragraph, custom hero, curated callouts) that needs to migrate even if the listing portion is generated → **Manual Rebuild** (or Scripted if the authored portion fits a pattern)
- The page is a one-off landing that *looks* like a hub but is actually authored → **Scripted** or **Manual Rebuild**
- Underlying records aren't migrating → **Kill/Redirect**

### What Configure commits the project to

- Template work in the new CMS (engineering)
- Configuration: which records appear, how they're sorted, faceting/filtering, pagination
- Verification that the generated page produces equivalent or better output than the source
- URL preservation: the new generated URL should match the old, or a redirect should be in place

### Authoring rule

If a page has zero hand-authored content — no body, no intro, no curated copy — it's Configure. The moment authored content shows up, you're either splitting it (the authored shell is Scripted/Manual Rebuild; the generated list inside is a Configure component) or the whole thing becomes Manual Rebuild.

---

## Manual Rebuild

**Manual Rebuild = "A human builds this page in the new CMS, by hand, in the new authoring tools."**

Manual Rebuild is the catch-all for pages that don't fit a script-migrated mold. The reasons vary — content needs revision (Evolve), the layout is unique enough that scripting it isn't worth the effort, the source data is too messy to transform reliably, the new CMS uses such different building blocks that there's no clean automated path. The commonality: someone sits in the new CMS and creates the page from scratch (or from a substantially edited version of the source).

### When to choose Manual Rebuild

- KKE is **Evolve** — content is changing as part of the migration, so manual work is happening anyway
- Layout is unique, complex, or component-heavy in ways the migration script can't handle reliably
- Source content is inconsistent enough that scripting it would produce more cleanup than just rebuilding
- New CMS components are different enough that "scripted migration" would mean dumping content into a rich-text field — defeating the point of the new system
- One-off pages where script overhead exceeds rebuild effort

### When *not* to choose Manual Rebuild

- Content is fine and layout is standard → **Scripted**
- Content is structured records → **Migrate Records**
- Page is system-generated → **Configure**
- The "rebuild" is really folding into another page → **Merge**

### What Manual Rebuild commits the project to

- A human's time, in the new CMS, with the source content available for reference
- A clear ownership question: who does the rebuild — content team, agency, vendor, internal staff?
- A schedule: rebuilds bottleneck on people, not on machines. They can't all happen the day before launch.
- Documentation of what "done" looks like, especially when KKE = Evolve and the rebuild is also a content revision

### Authoring rule

Manual Rebuild is the most expensive track per page. If you find yourself classifying a large share of the inventory as Manual Rebuild, pause: either the new CMS is a poor fit, or the migration scripts haven't been adequately scoped, or the team is hedging because nobody's confident in the automated paths. Investigate before accepting it.

---

## Merge

**Merge = "This page's content (or what's worth keeping of it) gets folded into another page during migration."**

Merge is the delivery counterpart to KKE = Consolidate. The page itself doesn't migrate; instead, a human takes its content (selectively, often heavily edited) and incorporates it into the target page. The source URL redirects to the target. From the new system's perspective, the source page never existed.

### When to choose Merge

- KKE is **Consolidate** — the content decision has already been made; Merge is the delivery realization
- The target page exists in the inventory and is itself migrating (Keep, Evolve, or being newly built)
- A human will do the merging — either the content team, the agency, or the client

### When *not* to choose Merge

- The source page should fold in but no target is named → not ready for Merge; resolve the KKE decision first
- The source page should disappear without folding anywhere → **Kill/Redirect**
- The source page is fine on its own → **Scripted** / **Manual Rebuild**

### What Merge commits the project to

- Editorial work on the target page (read both sources, decide what's worth keeping, integrate cleanly)
- A redirect from source URL to target URL
- A track decision *for the target* — if absorbing this content meaningfully changes the target page, the target is probably **Manual Rebuild** even if it would otherwise be Scripted
- Awareness that consolidate chains are valid but expensive — A merges into B which merges into C means the editor working on B is doing two merges, then C's editor inherits all three

### Authoring rule

Merge is editorial work disguised as migration work. Budget accordingly. A Merge of two pages takes longer than a Manual Rebuild of one because the editor has to reconcile two voices, two structures, and two ideas of what the page is for.

---

## Kill/Redirect

**Kill/Redirect = "This page does not exist in the new system. The URL either redirects somewhere or returns a 404."**

Kill/Redirect is the delivery counterpart to KKE = Kill. No content migrates. The only deliverable is a redirect rule (or an explicit decision to let the URL 404). All editorial work on this page stops at the audit; the rest is engineering.

### When to choose Kill/Redirect

- KKE is **Kill**
- KKE is **Exclude** *only when* the page nonetheless needs a redirect rule written by this project (rare; usually Exclude pages are out of scope for redirects too)

### When *not* to choose Kill/Redirect

- The page is moving forward in any form → any other track
- The page is consolidating into another → **Merge**
- KKE is Exclude and the project has no responsibility for the URL → leave Migration Track blank

### What Kill/Redirect commits the project to

- A redirect destination — either a URL or the literal sentinel `404` (intentional deindex)
- Inclusion in the redirect manifest delivered to engineering
- Inclusion in the SEO handoff: which URLs are being redirected (and where), which are being let to 404
- An archive plan if the source content has historical value

### Authoring rule

Kill/Redirect is the simplest track to *execute* but the easiest to get wrong by default. A confused redirect that points users to a tangentially-related page is worse than a 404. When the destination would be a stretch, prefer 404 — and document the choice in Notes so SEO and engineering see the intent.

---

## Cross-cutting principles

**Migration Track is owned by the technical architect, not the content strategist.** The strategist's KKE call drives a *suggested* default Migration Track, but the architect makes the final call based on what scripts can actually handle, what the new CMS supports, and what the project budget allows.

**The KKE → Migration Track suggestion table:**

| KKE | Content Nature | Default Migration Track |
|-----|----------------|------------------------|
| Keep | Page | Scripted |
| Keep | Content Object (Record) | Migrate Records |
| Keep | Fragment | Migrate Records |
| Keep | Generated | Configure |
| Evolve | (any) | Manual Rebuild |
| Consolidate | (any) | Merge |
| Kill | (any) | Kill/Redirect |
| Exclude | (any) | (blank — usually no track) |

This is a *suggestion*, not a determination. Override freely with Notes explaining why.

**Migration Track timing differs by track.** Configure can happen any time after the underlying records are migrated. Scripted and Migrate Records run in batches. Manual Rebuild and Merge are bottlenecked on people and have to be scheduled. Kill/Redirect is a single deliverable at launch. Don't assume a uniform timeline.

**The "I gave up and dumped it in a rich text field" outcome.** When a Scripted migration fails on a page and the script falls back to dumping raw HTML into a rich-text field, that's a *failed Scripted* outcome that should be reclassified as **Manual Rebuild** post-launch (the content is technically there, but the build quality is unacceptable). Phase 3+ tooling will track this via a `Migration_Status` field populated from the technical team's success/failure list.

**Notes carry the *why*, especially on overrides.** Default tracks are easy. Overrides need explanation: "Suggested Scripted, switched to Manual Rebuild because layout uses a custom widget the new CMS can't replicate" is the kind of note that prevents re-litigation later.

**Blank means "not yet assigned."** Migration Track is hidden by default in the audit UI; it gets reviewed during the technical-architecture phase. Don't pre-populate it during the content audit unless you're confident; let the architect's pass do the assignment with appropriate context.

---

*Companion document to the KKE Rubric Baseline. Same structure, different layer.*
