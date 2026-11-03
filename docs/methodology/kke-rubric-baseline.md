# MRA Rubric — Baseline Definitions

A shared starting point for content audits using the Migrate / Revise / Archive framework. This document defines each disposition, when to choose it, when not to, and what it commits the project to. It is meant to be tailored per client — the criteria are illustrative, the structure is the contract.

The framework distinguishes **content-quality judgments** (MRA) from **delivery judgments** (Migration Track). MRA answers *what should happen to this content?* Migration Track answers *how does it move?* Those are separate decisions, often made by different people at different times. Don't conflate them.

The five dispositions are: **Migrate**, **Revise**, **Archive**, **Consolidate**, **Exclude**. A sixth state — **blank** — is legitimate and means "not yet reviewed."

---

## Migrate

**Migrate = "This page is doing its job. Migrate it forward as-is."**

Migrate is a content-quality affirmation: the page is accurate, current, useful, and on-brand. No revision is needed before it lives on the new site. The decision is about the content itself — how it's technically migrated is a separate call (Migration Track).

### When to choose Migrate

- Page is factually accurate and reflects current offerings
- Serves a documented user need (prospective students, current students, partners, etc.)
- Information isn't duplicated elsewhere in scope
- Required for compliance, accreditation, or legal reasons
- Critical to a successful user task (application, enrollment, degree planning)
- Supports the client's current strategic priorities
- Recent enough to be relevant under the project's age guidelines
- Content is grounded in user research, brand standards, or established best practice

### When *not* to choose Migrate

- You'd describe the content as "mostly fine but…" — that "but" is usually **Revise**
- The page exists but its job is being absorbed by another page → **Consolidate**
- You're keeping it only because you're not sure → that's not a reason. Decide.
- The page is accurate but no longer needed → **Archive**

### What Migrate commits the project to

- A migration path (scripted, record-migrated, or rebuilt) — the technical question, not the content question
- No further content work from the client. If you mark Migrate, the client should be able to trust the page goes forward untouched.

### Authoring rule

Migrate is the strongest endorsement in the framework. If you're hedging, you're not Migrating — you're Revising. Don't use Migrate as a default for "I haven't decided yet"; that's what blank means.

---

## Revise

**Revise = "Carry the page forward, but the content needs work before it serves users well."**

Revise is a content-quality judgment: this page belongs in the new site, but the writing, structure, currency, or clarity isn't where it should be. The migration is the moment to invest in fixing it.

Revise is **not** a comment on how the page will be technically migrated. A page can be Revise and still be script-migrated (the content team revises post-launch). That's a separate decision, captured in Migration Track.

### When to choose Revise

**Content is dated or thin**
- Information has drifted from accuracy (personnel changes, program updates, stale dates)
- Page hasn't been meaningfully updated in 3+ years and isn't evergreen
- Content is too short or too vague to serve its stated purpose
- Page is nebulous — purpose unclear, audience unclear, or both

**Content underperforms its responsibility**
- High-stakes content (priority audience, advisor-referenced, unique program differentiator) that exists but reads as generic, off-brand, or out of voice
- Content that's accurate but buried, poorly structured, or hard to scan
- Content that should be combined with related pages for a coherent user experience

**Content needs format or accessibility work**
- PDF that should be a web page
- Missing/poor page title or meta description
- Images missing alt text or needing replacement
- Accessibility improvements that exceed simple cleanup

**Content has governance gaps**
- Ownership unclear — needs assignment before it can be trusted forward
- Standard-review categories (degree pages, department pages, centers) where due diligence is required regardless of apparent quality

### When *not* to choose Revise

- The page is fine as-is → **Migrate**
- The page should not exist in the new site → **Archive**
- The page is fine but should fold into another → **Consolidate**
- The page is technically out of scope for the migration entirely → **Exclude** (and be sure: if it needs a redirect, it's Archive not Exclude)
- The migration script can't handle the layout but the content is fine → still **Migrate**, with Migration Track = Manual Rebuild. Revise is about the *writing*, not the *plumbing*.

### What Revise commits the project to

- A directive to the client's content staff: invest real effort here
- A decision the client owes back: *who* does the work, and *when* (before / during / after migration window)
- A note in the audit explaining what specifically needs to change — Revise without a reason isn't actionable

### Authoring rule

If you're tempted to choose Revise but can't articulate in one sentence what needs to change, the right answer is probably Migrate (the content's fine and you're being cautious) or Archive (the page can't be salvaged with reasonable effort). Revise without a specific charge becomes a backlog item nobody owns.

---

## Archive

**Archive = "This page should not exist in the new site."**

Archive removes the page from the live site. The content is archived for reference, not deleted from history, but no user-facing version goes forward. Every Archive comes with a *redirect decision* — which is not the same as a redirect (more on this below).

### When to choose Archive

**Content is no longer relevant**
- References past events (5+ years old), discontinued programs, or departed personnel
- Temporary content that's served its purpose (one-time announcements, expired campaigns)
- Old event pages, expired notices, sunset programs

**Content is redundant or hollow**
- Duplicates content that exists elsewhere in scope
- Placeholder, stub, or near-empty page
- Page is primarily a list of links and most/all are broken
- Pages that consist of information already available on better pages

**Content is broken**
- Returns an error, is orphaned with no path in
- Contains non-functional forms with no replacement plan
- Cannot meet WCAG 2.2 AA and cannot be reasonably remediated

**Content is misaligned with the new site**
- Internal-audience content (faculty/staff) appearing on a public site
- Page exists only as a redirect or a node in a redirect chain
- Image/file dumps intended for internal use

### When *not* to choose Archive

- The content is dated but valuable → **Revise**
- The content overlaps another page but has unique value to fold in → **Consolidate**
- The page is genuinely outside the migration's scope (third-party tool, partner site, system not being migrated) → **Exclude**
- You'd want to keep the URL working with no destination in mind → that's still Archive; the *redirect destination* is a separate decision, and "let it 404" is a valid choice

### What Archive commits the project to

A **redirect decision**, which is not the same as a redirect. For each Archive, the answer is one of:

- **Redirect to a specific page** — when there's a meaningful destination the user (or search engine) should reach instead
- **Redirect to a section landing or hub** — when there's no exact replacement but a reasonable parent
- **Let it 404** — when the page should genuinely disappear from the web. A 404 tells search engines to deindex, tells users the page is gone, and tells the system there's no replacement to imply. For expired events, retired programs, departed personnel, or content that shouldn't be silently mapped to something tangentially related, 404 is often the *correct* answer.

Plus: an **archive plan** (archived content is stored, not destroyed) and **communication** (stakeholders who relied on the page should know it's going).

### When 404 is the right call (instead of a redirect)

- Old event pages, expired offers, retired programs — there's no honest equivalent
- Departed personnel pages — redirecting to "our people" page is misleading
- Content the client wants search engines to *forget* (deindex it cleanly)
- Pages where any redirect would be a stretch — if the destination feels like a guess, 404 is more honest
- Cases where redirecting would create a redirect loop or chain that's worse than just being gone

### Authoring rule

If you'd be uncomfortable telling a real user who's bookmarked this page "we removed it, here's where to go now" — pause. Either the page isn't ready to Archive (Migrate/Revise), or the right answer is "we removed it, sorry, please use the site search" — i.e., a 404. A confused redirect is worse than an honest 404.

---

## Consolidate

**Consolidate = "This page should fold into another page."**

Consolidate is a structural decision: this page's content (or the user need it serves) belongs on a different, existing page. The source page goes away; the target page absorbs whatever's worth keeping. From the user's perspective, two pages become one.

Consolidate always names a target. Consolidate without a destination is an unresolved Archive.

### When to choose Consolidate

- Multiple pages serve the same audience with overlapping content
- A thin page would add value as a section of a parent or theme page rather than standing alone
- News/updates pages with the same purpose and audience that would read better as one
- Sibling pages whose distinctions don't actually matter to users
- A page whose content is a footnote on a larger story being told elsewhere

### When *not* to choose Consolidate

- The page should fold in but you don't know where yet → leave MRA blank or use Notes to flag for review; don't Consolidate without a target
- The content is unique and worth keeping → **Migrate** or **Revise**
- The content has no home and shouldn't have one → **Archive**
- The target page would need significant revision to absorb this content → that's a chained decision: Consolidate this page *into* a target, and mark the target as **Revise**

### What Consolidate commits the project to

- A named target page — must exist in the inventory
- A redirect from the source URL to the target's final URL (resolved automatically through the consolidate chain)
- Editorial work on the target: someone has to merge the content meaningfully. If the target is Migrate, the merge is light. If the merge is substantial, the target should be Revise.
- Awareness that consolidate chains are allowed but should be shallow. Page A → B → C is fine; A → B → C → D → E is a sign the structure isn't settled.

### Authoring rule

If you can't name the target page in one breath — and confirm it's in the inventory — you're not ready to Consolidate. Park it as blank and revisit when the structure clarifies.

---

## Exclude

**Exclude = "This page is entirely out of scope for the migration."**

Exclude is a scope statement, not a quality judgment. The page exists, the URL works, but it isn't the migration's problem. No content review. No redirect. No mention in the migration manifest. The page either continues to exist on a system that isn't being migrated, or its disposition is genuinely none of this project's business.

Exclude is the most easily misused decision in the framework. Read the next section carefully.

### When to choose Exclude

- The URL belongs to a different system that isn't being migrated (a separate subdomain, third-party application, partner-hosted tool, vendor portal)
- The page is generated by a service that lives outside the CMS (e.g., a hosted forms platform, an LMS, an event registration system)
- The page is in scope for a *different* project — another team owns its disposition
- Content the client has explicitly placed outside the engagement boundary

### When *not* to choose Exclude — read this twice

**Exclude is not a hiding place.** If the page has any in-scope disposition — any expected outcome that's the migration project's responsibility — it is **not** Exclude.

- The page should redirect somewhere → **Archive** (Exclude pages don't get redirects)
- The page is a duplicate that should go away → **Archive**
- The page is decent but you're not sure — you want to come back to it later → leave MRA **blank**
- The page is technically outside your typical inventory pattern but the client expects it handled → **Migrate / Revise / Archive / Consolidate** as appropriate
- You've decided you don't want to deal with it → that's not a reason. Make a real decision.

### What Exclude commits the project to

- Nothing. That's the point. Exclude says "this is not our problem."
- Documentation of why. An Exclude row should have Notes explaining the scope boundary, so the next reviewer doesn't second-guess it.

### Authoring rule

Before marking Exclude, answer this: **does anyone outside the migration project know they own this page's outcome?** If yes, name them in Notes and Exclude. If no — if the page's fate is genuinely unaddressed — you're not Excluding, you're abandoning. Pick a real MRA value.

---

## Cross-cutting principles

**MRA is content; Migration Track is delivery.** A page can be Revise and still script-migrate cleanly. A page can be Migrate and still need a hand-rebuild. Don't let one decision force the other.

**Notes are load-bearing for everything except Migrate.**
- **Revise** needs the *charge* — what specifically needs to change
- **Archive** needs the *redirect rationale* — destination URL or "let it 404," and why
- **Consolidate** needs the *target* — the page absorbing this one
- **Exclude** needs the *scope boundary* — who owns this outside the project
- **Migrate** can stand alone

**Blank is a legitimate state.** It means "not yet reviewed." Don't default to Migrate when you mean blank, and don't use Exclude when you mean "I'll come back to this." Blank is honest.

**Consolidate + Revise target is a real pattern.** When a Consolidate target absorbs meaningful content, it usually deserves Revise, not Migrate. The merging work *is* content work.

**404 is a first-class outcome.** An Archive with `Redirect_Destination = 404` is intentional, not incomplete. It tells the engineering team "do not write a redirect rule for this URL" — distinct from an Archive row where the destination is still TBD.

**Decisions are starting points, not verdicts.** Stakeholders own their content. The audit is the conversation starter.

---

*A baseline, not a standard. Tailor the thresholds and the language per engagement; preserve the structure, because the structure is what makes two auditors agree.*
