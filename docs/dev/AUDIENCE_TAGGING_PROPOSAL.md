# Proposal — Audience & Jobs-to-be-Done tagging

**Status:** approved · **fully implemented** (1 & 2 on 2026-07-28, 3 and 4 on 2026-07-29)
**Date:** 2026-07-28
**Scope:** make audience prioritization and JTBD workshop output a first-class, load-bearing input to the KKE process.

## Decisions taken

1. **Jobs-to-be-done stays in Phase 3.** Audience tagging ships without it.
2. **`Audiences` is a real structural sheet**, not settings JSON — it doubles as the
   working document the workshop output is pasted into and edited in.
3. **The audience source votes in `Suggested_KKE` by default** (weight 1.0). Untagged
   rows abstain, so existing projects are unaffected until someone tags something.
4. **Tiers are Primary / Secondary / Tertiary / Not a target**, kept deliberately
   constrained to make the prioritization conversation useful. Revisable later.

---

## 1. The problem

We run audience prioritization and jobs-to-be-done workshops with clients. Those workshops produce a ranked list of audiences and a set of job statements — genuinely the most strategic artifacts of discovery. Then the audit starts, and that output goes into a slide deck and never touches a single row.

The result is a real gap. Today the audit can answer:

- What is this page *about*? → `Content_Theme`
- What *kind* of thing is it? → `Page_Type`
- Is it performing? → `GA_KKE_Recommendation`
- Does it meet quality criteria? → rubric / `_AssessmentResult`

It cannot answer the question the client actually asked in the workshop:

- **Who is this page for, and is that someone we care about?**

That question is the whole point of prioritizing audiences. Without it, "Kill" is argued on traffic and quality — both of which are downstream proxies for relevance to a person. A page can have decent traffic, pass every rubric rule, and still serve nobody the organization decided to invest in. Right now we have no way to see that, let alone report it.

### Why not just use Tags or Content_Theme

The obvious objection: `Tags` is already a free CSV vocabulary — tag pages `prospective-students` and be done.

That fails on four counts, and each one matters:

1. **No priority.** The entire value of an audience prioritization workshop is the *ranking*. A flat tag list throws that away — the one piece of information we were paid to produce.
2. **No primary/secondary distinction.** "Serves six audiences" usually means "serves nobody," but a flat tag set can't express "mainly for X, also useful to Y."
3. **`Tags` is already load-bearing** for thin-content/outdated/evergreen-style flags, and its library is *global* (shared across every client file). Audiences are emphatically per-client.
4. **No defined role in scoring.** Tags feed nothing. For this to be a real input it has to vote in `Suggested_KKE`.

`Content_Theme` is orthogonal — "what is it about" vs. "who is it for." An admissions FAQ and an admissions viewbook share a theme and serve different audiences; a tuition page and a scholarship page serve one audience across two themes.

---

## 2. Data model

### 2.1 Per-page columns

Three new audit columns, injected in `injectAndOrderAuditColumns()` (main.js:117) alongside the existing set:

| Column | Type | Meaning |
|---|---|---|
| `Audiences` | Free (CSV) | Every audience this page does meaningful work for. Chip input, same storage shape as `Tags` / `Design_Patterns`. |
| `Primary_Audience` | Controlled (single) | Who it is *mainly* for. Auto-filled when exactly one audience is tagged; user-picked when several. |
| `Jobs_Served` | Free (CSV) | Which JTBD statements this page satisfies. Phase 3 — optional tier. |

`Primary_Audience` earns its own column rather than being derived as "first in the list" for two reasons: it is a real editorial decision distinct from "who might read this," and every downstream single-value consumer (sitemap coloring, treemap, cross-tab reports) needs one unambiguous value per row. Deriving it would silently make sitemap colors depend on chip insertion order.

### 2.2 The `— None` problem

**Blank must not mean "no audience."** Blank means "nobody has looked at this row yet." Those are opposite findings and conflating them will produce garbage suggestions the first time the engine runs.

So the audience library ships with one reserved entry, `— None (no target audience)`, that is explicitly selectable. Tagging a page with it is a positive assertion: *we looked, and this serves nobody we care about.* That is a Kill argument. A blank cell is not.

### 2.3 Per-project libraries

Both libraries live in `projectSettings` — **per project, not global prefs**. This is a deliberate departure from `designPatternLibrary` (global, because components genuinely repeat across clients) and matches `contentThemeLibrary` (per project). Audiences do not transfer between a university and a hospital system.

```js
projectSettings.audienceLibrary = [
  { name: 'Prospective Undergraduates',
    tier: 'Primary',        // Primary | Secondary | Tertiary | Not a target
    color: '#2563eb',
    description: 'High-school juniors/seniors evaluating where to apply.',
    notes: '' },            // markdown — workshop context, exclusions
  ...
]

projectSettings.jobLibrary = [   // Phase 3 — as built
  { label: 'Compare programs',        // what goes in the row cell
    statement: 'When I am comparing programs, I want outcome data, so I can justify the cost.',
    audiences: ['Prospective Undergraduates', 'Parents & Families'],
    notes: '' },
  ...
]

// `label`, not an opaque `id`: the row cell has to stay readable in the
// spreadsheet, which is the whole premise of this app. Commas are replaced
// with `;` on entry, since commas separate values in `Jobs_Served`.
```

Jobs carry a *list* of audiences rather than belonging to one. Most jobs are audience-specific, but some genuinely aren't ("find who to contact"), and forcing those into one owner distorts the gap analysis.

### 2.4 Persistence

`projectSettings` gets JSON-serialized into `KKE_Settings` (xlsx) and the settings table (`.transmission`) for free — no new plumbing required to *work*.

But I recommend promoting the audience library to a real **`Audiences` structural sheet** (columns: `Name`, `Tier`, `Color`, `Description`, `Notes`), following the `ContentTypeRegistry` precedent. Reason: the workshop output arrives as a spreadsheet, and the client wants to see and edit it as a spreadsheet. A visible sheet makes "paste the workshop output in here" the import path, and makes the audience list an auditable artifact in the handoff rather than an opaque JSON blob in a settings cell.

~~Jobs can stay in `KKE_Settings` JSON for Phase 3 and be promoted to a `Jobs` sheet only if clients ask to edit them directly.~~

**As built:** jobs got their own `Jobs` sheet immediately, for the same reason audiences did — the JTBD workshop output arrives as a table and the client wants to keep editing it as one. Waiting for someone to ask would have meant a migration later for no benefit.

### 2.5 Seed defaults

Ship a `DEFAULT_AUDIENCE_LIBRARY` in main.js (exposed via IPC, following `get-default-content-type-registry`), offered behind the same opt-in seed banner the registry uses. Given the practice's higher-ed weighting, a sensible starter set: Prospective Undergraduates · Prospective Graduate Students · Current Students · Faculty & Staff · Alumni · Donors · Parents & Families · Employers & Partners · Media · Researchers · *— None*.

All seeded at tier `Secondary` with a nudge to run the prioritization pass — **not** pre-tiered. Guessing the client's priorities and having them silently accepted is worse than an empty tier column.

---

## 3. UI

### 3.1 Audit bar — a new `.cluster-audience` cluster

Follows the established cluster contract exactly (`.audit-cluster[data-cluster]` + `.cluster-pill` + `.cluster-summary`, click-to-collapse, state in `state.collapsedClusters`). Rose pill — the remaining unused color (decide=blue, classify=slate, tag/patterns=violet, review=teal, migrate=amber, cms=green).

```
┌ Audience ──────────────────────────────────────────────────┐
│  Primarily for  [ Prospective Undergraduates ▾ ]           │
│  Also serves    [+ Add audience]  ⟨Parents×⟩ ⟨Counselors×⟩ │
└────────────────────────────────────────────────────────────┘
```

Chips reuse the `Design_Patterns` implementation almost verbatim (renderer.js:4055–4250) — `getRow*` / `setRow*` / `render*Chips` / `render*List` / `setup*Handlers` / `populate*`. The dropdown groups by **tier** instead of category, with tier acting exactly as `.dp-category-header` does, so Primary audiences sort to the top and the ranking is visible at the moment of tagging. That single detail is what keeps the workshop's output in front of the auditor all day.

Visibility: `state.showAudienceFields`, per-user pref, quick-toggle chip in `#cluster-quick-toggles` next to SME/Migrate/Components. Defaults off like its peers — but **auto-reveals the first time the project's audience library is non-empty**, so populating the library is the discovery moment rather than a menu item nobody finds.

### 3.2 Bulk tagging — the adoption question

This is the make-or-break item, and it is worth being blunt: **features like this die on tagging cost.** Nobody hand-tags 3,000 rows through a chip input. If bulk tagging isn't in Phase 1, the column stays 4% full and every report built on it is worthless.

Three mitigations, in order of value:

1. **Multi-bar actions** — add `add-audience`, `remove-audience`, and `set-primary-audience` to `applyMultiAction()` (renderer.js:24268). This is the real workflow: filter to `/admissions/`, select all, tag Prospective Undergraduates, move on. A 3,000-page site is realistically 20–40 bulk operations plus hand-correction.
2. **Inherit from section** — a one-shot action that assigns each row the dominant audience of its top-level sitemap section. Good starting scaffold; explicitly reviewable afterward.
3. **AI suggest** (Phase 4) — batch over title/H1/meta/URL + the library's descriptions.

### 3.3 Filtering

`Audiences contains X` works through the existing field-filter system with zero code. Worth adding on top:

- A `_needs-audience` special filter in the `specialFilters` set (renderer.js:2778), following `_needs-placement`: Keep/Evolve rows with a blank `Audiences`. This is the tagging worklist.
- An `_audience-orphan` filter: rows whose only audiences are tier `Tertiary` / `Not a target` / `— None`. This is the Kill worklist.

I'd resist adding a third dropdown to the sidebar toolbar — it's already two rows — and let saved filters carry named audience combos instead.

### 3.4 Project Settings → Audience tab

New tab beside Migration, managing both libraries: add/rename/delete audiences with tier and color, usage counts per audience (following `computeAssigneeUsage()`), cascade-clear on delete, and a **paste-import** box for workshop output (name / tier / description, tab- or comma-separated). Jobs list in the same tab in Phase 3.

---

## 4. Where it pays off

### 4.1 Audience as a `Suggested_KKE` source ← the point of the whole feature

This is what makes audience a *real input* rather than another descriptive tag. `gatherRowSources()` (renderer.js:7900) currently reads GA and Rubric. Add a third:

| Row state | Vote |
|---|---|
| Serves ≥1 **Primary** audience | **Keep** |
| Serves only **Secondary** | *(abstain)* |
| Serves only **Tertiary / Not a target** | **Evolve** — right subject, wrong priority; usually a consolidation or trim candidate |
| Tagged `— None` | **Kill** |
| Blank | *(abstain — no vote)* |

It slots into the existing weighted-tally `pickWinner()` with no changes to the engine, gets a `audience` weight in `suggestedKkeConfig().weights` tunable in Project Settings → Suggestions alongside GA and Rubric, and inherits the disagreement badge for free.

The disagreement case is the genuinely interesting one and worth calling out to clients: **GA says Keep, Audience says Kill** = a popular page serving nobody strategic (usually a legacy hub or an internal-facing page ranking on brand terms). **GA says Kill, Audience says Keep** = under-served priority content, which is a *promotion* argument, not a removal one. Neither finding is reachable today. Both are the kind of thing that makes a client sit up in a readout.

### 4.2 Reports

**A. Audience Coverage Report** (the headline deliverable). Per audience, in tier order:

- Pages serving it — count, % of site, trend against tier (is our #1 audience served by 4% of the site?)
- KKE breakdown of those pages — *how much of what serves our top audience are we killing?*
- Where it lives in the IA — top sitemap sections, revealing scatter
- **Orphan-audience flag** — a Primary audience under a threshold page count is a headline strategic finding, not a data-quality note
- Jobs covered vs. jobs with no page (Phase 3)

**B. Audience × Section matrix.** Cross-tab of audience against top-level sitemap section. This is the most persuasive single artifact in the set — it makes findings like "the entire Alumni section is written for prospective students" visible in one glance, and it argues IA changes rather than page-level ones.

**C. Audience Debt.** Three lists that translate directly into scope:
- Pages serving only non-priority audiences (maintenance cost, no strategic return)
- Priority-audience pages marked Kill (probable mistakes — review these)
- Pages tagged with 4+ audiences (serving nobody; rewrite or split candidates)

**D. Jobs Coverage** (Phase 3). Per job: which pages serve it, which page is *the* answer, and which jobs have **no page at all**. Unserved jobs feed straight into the existing **Net New Content Brief** — this is the cleanest possible justification for net-new content, because it traces a proposed page back to a workshop statement the client made themselves.

Additions to existing reports, cheap and worth doing: an audience coverage line in **Executive Summary**; a dominant-audience column in **Content Inventory by Section**; audience columns in the **Migration Tracker** Source Pages sheet (`buildSourcePagesSheet()`, renderer.js:20810); audience columns in the **SME export** — SMEs are frequently the only people who actually know who reads a given page, so letting them correct the tagging is high-value.

### 4.3 Sitemap & treemap coloring — nearly free, high impact

`SITEMAP_ROW_FIELDS` (renderer.js:14380) already supports coloring the Visual Sitemap by an audit column, with dominant-value and `any-is` set semantics. Adding `Primary_Audience` is **one line**, and the treemap's color-by-field registry picks it up from the same source.

"Color the sitemap by who each section serves" is the demo that sells this feature in a client meeting, and it costs nearly nothing once the column exists. I'd pull it forward into Phase 2 rather than treat it as polish.

**Multi-site note:** `makeSectionResolver()` qualifies unplaced rows as `domain › Section` when the crawl spans several source sites, so a consolidation audit's two `/about` pages can't merge into one row. That is a local heuristic — see [SOURCE_SITE_PROPOSAL.md](./SOURCE_SITE_PROPOSAL.md) for making source site a real dimension, which would supersede it.

⚠️ **One real constraint:** `computeNavRowFieldAggregates()` treats each cell as a single value, so a CSV `Audiences` cell would aggregate as one opaque string (`"Alumni, Donors"` becomes its own "value"). Only `Primary_Audience` can be exposed to sitemap coloring without teaching that function to split multi-value columns. That's a contained follow-up, not a blocker — but it needs to be a deliberate decision rather than a surprise.

---

## 5. Phasing

| Phase | Contents | Effort |
|---|---|---|
| **1 — Tag it** ✅ | `Audiences` + `Primary_Audience` columns · `audienceLibrary` + `Audiences` sheet · audit-bar cluster + tier-grouped chips · Project Settings → Audience tab · **multi-bar bulk actions** · `_needs-audience` / `_audience-orphan` filters · seed defaults · workshop paste-import | M |
| **2 — Use it** ✅ | `Suggested_KKE` audience source + weight · sitemap/treemap coloring (`Primary_Audience`) · Audience Coverage + Audience × Section + Audience Debt reports · Migration Tracker / SME export columns | M |
| **3 — Jobs** ✅ | `jobLibrary` + `Jobs` sheet · `Jobs_Served` tagging (audience-aware picker) · Jobs library editor + paste-import · `add-job`/`remove-job` bulk · `_needs-job` filter · Jobs Coverage report · unserved jobs appended to the Net New Content Brief | M |
| **4 — Scale** ✅ | inherit-from-section (`computeSectionAudienceProfiles`, ≥3 tagged / ≥50% agreement, blanks only, `— None` never inherited) · AI audience suggestion batched 20/request × 3 concurrent, schema-constrained to the library, staged in `_Suggested_Audiences` and accepted via a set-grouped review dialog or a per-row ghost · `_audience-suggested` filter · model picker (Opus 5 / Sonnet 5 / Haiku 4.5) | S–M |

`Jobs_Served` was **not** injected as a column in Phase 1 — an always-blank column
in every export is worse than adding it when Phase 3 actually lands. Column
injection is idempotent on open, so adding it later back-fills existing projects.

Phases 1 and 2 are the coherent first release; Phase 1 alone ships a column nobody has a reason to fill in. Phase 3 is separable and can wait for a real engagement to pull it. Phase 4 is what makes it viable on a 5,000-page crawl.

---

## 6. Risks and open questions

**Tagging cost is the primary risk.** Covered above; the mitigation is that bulk actions ship in Phase 1, not later.

**Audience inflation.** Clients will name fourteen audiences. Tiering absorbs most of the damage, and a soft warning past ~8 helps. Usefully, the failure mode is self-reporting: "pages tagged with 4+ audiences" is already report C, so an over-inflated library shows up as a finding rather than as silent noise.

**Not every page has an audience, and that's fine.** Policy pages, legal notices, and archive stubs will sit at `— None` or blank forever. The reports need to handle a large untagged tail without implying the audit is incomplete — coverage percentages should be stated against *in-scope Keep/Evolve rows*, not against the whole crawl.

**One aside spotted while tracing the AI path:** `assess-row-llm` (main.js:2996) pinned `claude-sonnet-4-20250514`. ✅ Done in Phase 4 — both paths now share `callClaudeMessages()`, which also handles the `stop_reason: "refusal"` case that previously surfaced as a parse failure.

**Resolved in Phase 4 — how much to trust each volume tool.** Inherit writes `Audiences` directly (its dialog *is* the review, and it only ever propagates a decision the auditor already made in that section); AI never does, staging into `_Suggested_Audiences` for accept/reject. That split follows the line the tool already holds with `Suggested_KKE`: a deterministic derivation from your own decisions can write; a model's guess cannot.

### Decisions I need from you

1. **Jobs in or out of the first release?** I've phased them third. If JTBD is the part clients actually respond to, it should move up — but it roughly doubles the library/editor surface.
2. **`Audiences` as a structural sheet, or settings JSON only?** The sheet is more work and makes the workshop handoff a real, editable artifact. I lean sheet.
3. **Should the audience source vote on `Suggested_KKE` by default,** or ship abstaining (weight 0) until a project opts in? Voting by default is the stronger product statement; abstaining is safer for existing projects that will have the column blank everywhere. I lean *voting by default* — blank rows abstain anyway, so an untagged project is unaffected.
4. **Tier vocabulary** — Primary / Secondary / Tertiary / Not a target, or something closer to how you actually run the workshop?
