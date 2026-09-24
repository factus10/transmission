# Content-Type & Migration-Direction Model (design)

Status: **All phases built (in dev), pending manual test + signed build.** Captures the model worked out in conversation so implementation doesn't drift. Supersedes the looser notes in `REVIEW_FINDINGS.md`.

**Resolved decisions:** (a) **Unified** into one Target Spec Library (Page Template / Content Model kinds), not two libraries. (b) Added a dedicated **Migrator** role (third sitemap-node assignee), not folded into Builder.

---

## The core idea

Two separate concerns, often conflated:

1. **Content type** — the *data shape*. Every piece of content has a **current** type (today's CMS) and maps to a **target** type (new CMS). This mapping is **universal** — pages, fragments, and generated content all get a target type.
2. **Rendering** — *how* the target type surfaces. This is what varies, and it determines breadcrumb / URL / redirect behavior.

The current→target **mapping** is identical for all content. Only the *rendering target* differs.

## Three "renders as" kinds (reuse `Content_Nature`)

`Content_Nature` already encodes this; relabel it **"Renders as"** with friendlier option text (values stay as-is under the hood so downstream logic keeps working):

| Renders as | (stored value) | Breadcrumb / URL | Rendered by |
|---|---|---|---|
| **Page** | `Page` | yes | a **Page Template** (layout) |
| **Record** | `Content Object` | yes | a content-type entry rendered as its own page (news post, event, profile) |
| **Fragment** | `Fragment` | no | **embedded** into pages via components (no page template) |

> **Changed:** Fragment was originally stored as `Content Object`, which the default registry also used for records such as news posts, so those were treated as having no URL. Fragment now has its own stored value, and `Content Object` means Record. `splitContentObjectFragments()` repairs older files once on open.
| **Generated** | `Generated` | yes | a template over a query/feed |

## The crosswalk (extend the Content Type Registry)

The registry becomes a current→target crosswalk. Per current content type:

- **Current Content Type** (the audit field today labeled "Page Type" → relabel **"Content Type"**)
- **Renders as** default (Page / Fragment / Generated)
- **→ Target Spec** — points at a *spec* (see below), kind-aware:
  - Page/Generated → a **Page Template** (layout)
  - Fragment → a **Content Model** (field schema)
- **Migration Track** default (already exists)

A row's **Target Content Type** is auto-looked-up from its current type (overridable per row), the same non-destructive "fill blanks only" flow `Content_Nature`/`Migration_Track` already use.

## Direction is universal, attached to people, three kinds, two levels

The big realization: **any element may need human direction** — and "scripted" needs it most (authoring a reliable source→target map from messy content is the hard part, not the absence of work). So direction is not gated by render-type or migration track.

**Three kinds of direction** (audiences):

| Kind | For | Answers |
|---|---|---|
| **Writer brief** | content author | what to write / voice / required fields |
| **Build guidance** | page/component builder | how to assemble it |
| **Migration mapping** | migration engineer / staffer (incl. scripted) | source→target field map, what to drop, gotchas |

**Two levels** (this is what keeps it from drowning):

- **Type/spec level (the default, authored once):** lives on the **Target Spec** (page template *or* content model). Covers all **bulk / scripted** content — the 5,000 News records inherit one mapping; nobody touches them individually.
- **Element level (the exception, per item):** lives on the **element**, only where it deviates from the type default. Inherits the default, overrides per element. Same DRY pattern as "one writer brief per pattern, others follow."

## Where the spec lives — unify the libraries (recommended)

Generalize the **Page Template Library** into a **Target Spec Library**: each entry flagged **Page Template** or **Content Model**.
- Both kinds carry the three direction sections (writer brief, build guidance, **migration mapping**).
- **Content Model** entries also carry a **field schema** (the deliverable that replaces a page layout for fragments).
- **Page Template** entries carry layout/components.

This gives one home for all briefs/direction and one editor, rather than a second parallel library.

## Shared-content space in the sitemap (Fragments)

Use the **reserved `Node_Type` / `Nav_Layer`** Sitemap columns: a node can be a **Fragment / shared-content** node — keeps its **computed path** (repository location, e.g. AEM `/content/experience-fragments/...`) but is **not in menu, no breadcrumb, no redirect**, and renders as its own layer/card in the sitemap. This is also what gives fragments a home for element-level direction + an assignee (no new per-row fields needed).

Bulk records with **no node** are directed purely at the **type level** — that's correct, not a gap.

## Downstream behavior must be nature-aware

- **Redirects exclude Fragments** (no public URL → no bogus redirect).
- **"Need placement" & Sitemap Coverage** stop flagging Fragments as sitemap gaps; a Fragment "needs placement" means "no content-space home," a separate check.

## Roles

Today: **Builder / Writer**. Add a third — **Migrator / Migration owner** — so the migration-mapping work and ownership can be assigned and reported separately. (Or fold into Builder; leaning toward a third role.)

## Reporting

- **Content Type Crosswalk** report (current → target, counts, renders-as) for the CMS architect.
- The **Writer/Builder Brief report generalizes** into a **per-assignee Migration Direction worklist**: all three direction kinds, all content (not page-only), grouped by type/spec, leading with the type-level reference and listing the elements that follow.
- Surface **Target Content Type** in the Migration Tracker (Source Pages) and the direction report.

---

## Phasing

- **Phase 1 — Naming + crosswalk + 3-kind direction. ✅ BUILT (in dev).**
  - 1a — relabels: Page Type→**Content Type**; Nature→**Renders as** (Page / Fragment (embeddable) / Generated); `Target_Content_Type` audit column with non-destructive auto-map + audit-bar hint.
  - 1b — registry extended into a crosswalk (current type · renders-as · **target type** · **→ target spec** · track). **Page Template Library → Target Spec Library**: per-entry **Kind** (Page Template / Content Model), a **Migration mapping** default section (the third direction kind), and a **field schema** for Content Model entries.
  - 1c — **Migrator** role: `migrateAssignee` on sitemap nodes (Sitemap `Migrate_Assignee` column, node-editor Migrate section, build filter, Project Settings usage/cascade, Migration Tracker Sitemap Plan column). The **Writer/Builder Brief report → Migration Direction Brief**: three roles (writer · builder · migrator); migrator direction has no per-node field — its reference is the spec's migration-mapping default.
- **Phase 2 — Shared-content sitemap space. ✅ BUILT (in dev).** Node editor gains a **Node type** select (Page / Header / **Fragment**). Fragment nodes get a `FRAG` badge + tinted/italic row, are excluded from net-new/empty/hub counts (tree + stats), shown in a stats tally, and (being not-in-menu) are naturally absent from the in-menu IA report. Sitemap already round-trips `Node_Type`. *(`Nav_Layer` remains reserved — a single Fragment node type proved sufficient; revisit if multiple repository layers are needed.)*
- **Phase 3 — Nature-aware downstream. ✅ BUILT (in dev).** `isFragmentRow(row)` (= `Content_Nature === 'Fragment'`; was `'Content Object'` until the Record/Fragment split). Fragments are skipped in `resolveRedirectDestinations`, the Redirect Editor list, the tracker Redirects sheet, the need-placement count + `_needs-placement` filter, and Sitemap Coverage (which also now skips Header/Fragment nodes).
- **Phase 4 — Reporting. ✅ BUILT (in dev).** New **Content Type Crosswalk** report (Reports menu): current type → renders-as → target type → target spec → migration track, with page volume, KKE mix, and a "no crosswalk" flag for unmapped types. Tracker **Source Pages** sheet now carries Content Type / Renders As / Target Content Type. *(The brief report was generalized into the 3-kind Migration Direction Brief earlier, in 1c.)*
