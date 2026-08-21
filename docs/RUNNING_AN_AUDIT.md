# Running an Audit with Transmission

*The opinionated path. If you've been handed a crawl and a client and don't know where to start, start here.*

Every other document describes **what the tool can do**. This one describes **what to do, in what order, and why that order matters**. The [User Guide](./USER_GUIDE.md) is the reference you'll come back to for any single feature; this is the sequence you run once per engagement.

---

## Before anything: the opinions this tool holds

Transmission is not neutral. A handful of decisions are baked in, and every one of them will bite you if you don't know about it. Read these once — they take two minutes and they prevent most early mistakes.

**A blank cell means *nobody has looked yet*.** It never means "no". This is the single most important idea in the tool. A blank KKE is unreviewed. A blank `Audiences` cell is unreviewed. When you review something and conclude the answer is genuinely negative, you say so explicitly — tag the audience `— None (no target audience)`, set the KKE to `Exclude`. The distinction is what lets the tool tell "we haven't got to it" apart from "we decided against it", and every report and suggestion depends on it.

**Content you set aside still needs a decision.** Marking a site out of scope narrows your report totals; it does not make the pages go away, and the tool will keep telling you so in a banner on every report. If a property genuinely isn't part of the work, record that as `Exclude` on the rows. Filtering is a lens; the decision belongs on the page.

**The tool suggests; you decide.** `Suggested_KKE` is a weighted vote from analytics, a rubric, and audience tiers. It never writes to your `KKE_Recommendation`. When the sources disagree the badge says so — that disagreement is usually more informative than any single source, so look at it rather than around it.

**The crawl's own declarations beat our guesses.** Where a site states something — `rel=canonical`, a status code — the tool reads it rather than inferring from URL patterns. A parameter-name rule is a guess about someone else's CMS; a canonical is that CMS telling you the answer.

**`Kill` and `Exclude` are different.** `Kill` means the page is being removed and its URL needs a redirect decision. `Exclude` means the page isn't part of this audit's inventory at all — an alternate view, an out-of-scope property, an internal tool. Killing something you meant to exclude pollutes your redirect map with rules nobody needs.

**Everything travels with the file.** Libraries, settings, decisions, and the change log all live in the spreadsheet or the `.transmission` project. There's no server and no separate state. Hand someone the file and they have the whole audit.

---

## The shape of an engagement

```
0. Reduce the crawl to real content     ← do this first, always
1. Set the project up                    ← 20 minutes that save days
2. Classify in bulk                      ← before you look at anything individually
3. The audit pass                        ← the long part
4. SME review                            ← optional, but usually the point
5. IA, sitemap and menus                 ← if you're replatforming
6. Redirects                             ← falls out of 3 + 5
7. Build planning                        ← only if you're staffing the build
8. Deliverables
```

Steps 0–3 are close to mandatory. Everything after depends on what you were hired to do — a pure content audit stops after 4; a replatform goes all the way through 8.

---

## 0. Reduce the crawl to real content

**Do this before you look at a single page.** A crawl is a list of URLs that responded, not a list of pages. On a CMS-driven site, half of it routinely isn't content.

> **Why first:** every step after this one costs time per row. On a recent ~13,000-row crawl, this step took the real queue to ~6,500 — the auditor's workload halved before any judgement was made. Do it later and you'll have spent that time already.

**a. Triage non-200 pages.** `Project → Triage Non-200 Pages…`. Groups by status code with a sensible default action per group. Redirects and 404s in a crawl are rarely content decisions; get them out of the queue.

**b. Triage URL variants.** `Project → Triage URL Variants…`. Reads each page's `rel=canonical` — the site's own statement that a URL isn't distinct content — and groups variants by the page they point at.

- **Query-only** variants (same path, different query string) default to `Exclude`. The canonical's redirect already covers them.
- **Different-path** variants default to `Consolidate` into the canonical, which writes the redirect for you.
- Anything whose canonical wasn't crawled is left alone; the *Canonical target not in this crawl* filter finds them.

The whole triage undoes with one `Cmd+Z`, so it's safe to run and look at.

**c. Name the source sites.** `Project Settings → Sites`. One entry is created per domain found in the crawl. Two jobs here:

- **Merge the hosts that are really one site.** `www.` is folded in automatically; whether `careers.` or `docs.` is the same site is your call. Each host shows its page count to make that obvious.
- **Un-tick "In scope"** for any property that isn't part of this engagement. You'll be asked whether to record `Exclude` on those rows — say yes unless you intend to review them individually.

> If more than one site is in scope, **set the Site Domain** on the Identity tab. Without it, redirect destinations get built on whichever domain happens to come first in the crawl. The tool warns you; don't ignore it.

**Skip this whole step if:** single domain, no query strings, no non-200s. Rare, but it happens on small brochure sites.

---

## 1. Set the project up

Twenty minutes here saves days later, because most of it feeds automatic behavior downstream.

**Identity** (`Project Settings → Identity`) — client, project, site domain, default redirect destination. The domain is the one that matters; it's the target for every redirect you'll generate.

**Audience library** (`Project → Audience Library…`) — this is your audience prioritization workshop's output, and it is the step people skip and regret.

- **Paste from workshop…** takes the table straight from your spreadsheet: name, tier, description.
- No workshop yet? **Seed starter list…** offers a *Higher education* or *General organization* set to start from — but treat that as scaffolding, not an answer.
- **Set the tiers.** Everything downstream reads them: the picker's ordering, the coverage reports, and the audience vote in `Suggested_KKE`. A library left at the default `Secondary` for everything is inert — it will not be wrong, it will simply do nothing.

**Jobs to be done** (same tab, below Audiences) — the other half of the discovery workshop. Audiences answer *who*; jobs answer *what they came to do*. **Paste from workshop…** takes the table: short label, full statement, which audiences have it (blank = everybody).

> Worth doing even if you only get halfway. The payoff isn't the tagging — it's the inverse: a job with **no page serving it** is the strongest brief for net-new content you can write, because it traces back to something the client said themselves rather than to your opinion.

**Content Type Registry** (`Project → Content Type Registry…`) — only if you're replatforming. Maps each current content type to what it becomes in the new CMS, so classification flows automatically. The editor shows types in use with no crosswalk yet, so gaps are visible.

**Target Spec Library** (`Project → Target Spec Library…`) — also replatform-only, and only worth it if you're running the build. These are the page templates and content models the new site is assembled from; each carries default build guidance and a writer brief that pre-fill a page when you assign the spec in step 7. Seed the 12 built-ins and edit from there.

**Rubric and analytics** — optional, both feed `Suggested_KKE`. If you have GA4 data in the crawl the tool offers to configure it on open.

---

## 2. Classify in bulk

**Do not start clicking through pages yet.** Almost every classification is true of a whole section at once, and the Multi-bar exists for exactly this.

Filter to a section — the search box, the KKE filter, or **+ Field filter** for any column — then apply to everything visible: set Group, Content Type, Published Status, or **Add Audience**.

Audience and job tagging in particular are bulk jobs. Filter to `/admissions/`, select all, tag *Prospective Students* and *Compare programs*, move on. A large site is a few dozen passes plus hand-correction. Four filters give you the worklists:

- **Needs audience** — Keep/Evolve pages nobody has assessed yet
- **Serves no priority audience** — reviewed, and everything it serves is off-strategy
- **Needs a job** — Keep/Evolve pages with no job tagged
- **Audience suggested by AI** — a suggestion is waiting on your accept or reject

**Then close the long tail.** Bulk passes get the obvious sections; two tools finish the job.

`Project → Fill Audiences from Section…` spreads what you already tagged in a section onto that section's untagged pages. It costs nothing, needs no API key, invents nothing, and only fills blanks — so run it *after* your bulk passes, when there's something to propagate. It won't act on a section with fewer than three tagged pages, which is the point: it spreads your decision, it doesn't make one.

`Project → Suggest Audiences with AI…` handles what's left, against *your* audience library rather than a generic one. It never writes the `Audiences` column — suggestions queue up and you accept them by group (thousands of pages collapse into a few dozen distinct answers) or one at a time from the audit bar. Pilot it on one filtered section before running the whole crawl; it's billed to your own API key.

> **Order matters here.** Both tools are only as good as what they learn from. Hand-tag a section, bulk-tag the obvious ones, *then* inherit, *then* let AI take the remainder — running AI first spends money answering questions you were about to answer for free.

**Why all of this comes before the audit pass:** a page you've already classified is faster to judge, and the suggestion engine has more to work with by the time you get to it.

---

## 3. The audit pass

Now go page by page. The loop is: read the page in the built-in browser, make the call, capture why.

- **Keep · Kill · Evolve · Consolidate · Exclude** — keyboard shortcuts for each; the sidebar advances automatically if you want it to.
- **Notes are the deliverable.** Six months later the note is why anyone believes the decision. Write for the client, not for yourself.
- **Watch the Suggested KKE badge.** It shows the winning source (`GA: Kill`, `Audience: Keep`) and flags disagreement with a ⚠. Disagreement is signal: *high traffic, no priority audience* is usually a legacy hub; *low traffic, priority audience* argues for promotion, not removal.
- **Consolidate opens a picker** so you name the surviving page. That relationship writes the redirect later, so it's worth getting right at the point of decision.
- **Record components if the build team needs them.** The `Components` quick-chip reveals a chip input for the UI patterns on the page — hero, card grid, accordion. This is the only thing that feeds the **Component Inventory** report, and it's cheap while you're already looking at the page. Skip it entirely if nobody downstream asked.

Track progress with **Audit Progress** (`Cmd+P`).

---

## 4. SME review

Where the client's experts confirm or overturn your calls. Usually the point of the engagement, and usually where schedules slip.

`SME → Export for SME Review…` produces a standalone spreadsheet with dropdowns, optionally split per content owner. Audience columns ride along — SMEs are frequently the only people who know who actually reads a page.

Then `Import SME Decisions…`, `Compare KKE vs SME…` to see the conflicts side by side, and `Resolve Conflicts…` to produce `Final_KKE`. From that point on, `Final_KKE` is what every report and export reads.

---

## 5. IA, sitemap and menus

Only if you're replatforming.

**Build the tree.** **Create Sitemap from Audit…** (`Project` menu) generates a starter tree from your URL structure — faster than hand-building and easy to reorganize afterwards in the **Sitemap** view (`Cmd+Shift+T`).

A URL-derived tree is only an information architecture if the URLs carry one, and plenty don't. Read the dialog's prediction before you generate: on a flat CMS where every article sits at `/some-slug`, each page becomes its own top-level section — one real audit produced 548 sections from ~1,900 pages. Bucket depth won't change that, because sections come from the *first* URL segment. That's a finding about the site, not a fault in the tool, but it does produce a tree too big to draw, so the dialog offers to sweep the single-page sections into one section as part of the same step. If it lands that way anyway, the **shape check** (the ⚠ in the Sitemap toolbar's stats line, and offered when you open the Visual Sitemap) measures what you've got and what each repair would buy — including telling you when the repairs aren't enough, because grouping hundreds of pages into the eight sections the new site needs is your judgment, not a button.

Then place pages: the **Needs sitemap placement** filter finds Keep/Evolve pages with no home yet, and the Multi-bar's **Assign to Sitemap…** places many at once.

Useful checks while you're here: **Sitemap Coverage Report** (empty nodes, overloaded nodes), and the **Consolidation Candidates** tool for nodes that ended up with several pages.

**Then draw the menus — they are not the tree.** The **Menus** view (`Cmd+Shift+M`) is a separate axis on purpose. The sitemap says where a page *lives*; a menu says how people *get to it*, and the two genuinely differ — a page has one home but can appear in the top bar, a footer, and a mega-menu, and plenty of pages appear in no menu at all.

- **Seed from content tree** gets you a first draft from the sitemap; edit from there.
- Each menu has a **placement** (Top bar, Utility, Footer, Mega, …) so the hand-off says *where* it goes.
- Items are one of three kinds: a **page** (points at a sitemap node — the label follows the node if you rename it), an external **link**, or a label-only **header** for grouping.
- A red **⚠ broken refs** button appears if an item points at a node you've since deleted. Fix those before exporting.
- **Report** produces the client-facing Menu Report; **Export…** produces the CMS-agnostic structure (Excel or JSON) the build team imports.

> Skip menus if the engagement stops at the content audit. But if you're handing over an IA, the sitemap alone doesn't tell anyone what the navigation should say.

### Showing the current state — do it in a copy

Clients often ask for *"here's your site today"* before they'll engage with where it's going, and **Create Sitemap from Audit…** produces that picture in one pass, since it builds the tree straight from the live URL structure.

**Build it in a separate copy of the project, and archive that copy.** Not in your working file.

The reason is that a sitemap in Transmission is never purely descriptive. Placing a page on a node writes derived fields onto its row — `Computed Path`, `Sitemap_Destination`, `Page_Breadcrumb` — and on the next save the redirect resolver reads `Computed Path`, sees it differs from the page's live URL, and writes a `Redirect_Destination`. That is correct behavior for a *future-state* tree, where a page really is moving. For a *current-state* tree it manufactures redirects for pages that aren't going anywhere.

Transmission now records which redirects it derived, so deleting a node takes its derived redirects with it and the fossils no longer outlive the tree. Redirects written *before* that record existed are still ambiguous, though — the app can't tell them from something you typed — so an older file can still be carrying them.

So:

1. **Copy the project first** — `File → Save As Project…` to a new name, or duplicate the file in Finder. The Create Sitemap from Audit dialog asks what the tree is for; answering *where pages are today* offers **Save a copy first…**, which does this for you.
2. Build the URL-derived tree **in the copy**, export the Visual Sitemap (HTML / PDF / Miro) and the Treemap from there, and keep that copy as the archived deliverable.
3. Go back to your working file, untouched, and build the future state there.

### Resetting a file where it already happened

Symptoms, in rough order of how obvious they are:

- A page whose redirect destination is **its own URL** — a loop, and always wrong.
- A redirect whose path corresponds to **no node in the current tree** (a fossil of the deleted one).
- A **Keep or Evolve page with no sitemap placement that still carries a redirect**. It isn't moving, so it shouldn't have one at all. This is usually the largest group and the easiest to miss.

To find them, use sidebar field filters — `Redirect_Destination is-not-blank` combined with `Sitemap_ID is-blank`, with the KKE filter on Keep + Evolve, isolates that last group exactly.

To fix them, run **Migration → Redirect Health Check…**. It finds all three classes, groups them, shows every affected page, and repairs the groups you tick in a single undoable step. Anything whose destination still resolves to a real node in your sitemap is reported but never changed automatically — that may be a deliberate "send this to the parent", and only you know.

The Redirect Editor's **Re-derive from sitemap** is the blunter alternative: it re-points every *placed* row at its current node, skips unplaced rows entirely, and overwrites hand-set destinations (everything except a literal `404`). Prefer the health check.

> The cleanest habit remains the one above: a descriptive tree lives in its own archived copy, and the working file only ever holds the future state.

**Show it.** The Sitemap toolbar's **Visual Sitemap** renders the tree as an interactive box diagram — this is the artifact clients actually react to. Color it by KKE, section, phase, page status, or an audit field; export a shareable standalone HTML for the client, a PDF for the deck, or push it to a **Miro** board if the client works there (connect once in App Settings). **Treemap** answers a different question — where the content actually *is*, sized by page count — and is usually the more uncomfortable picture.

---

## 6. Redirects

Largely automatic if steps 3 and 5 were done properly — every `Kill` and every page whose URL changed already has a destination derived.

Open the **Redirects** view (`Cmd+Shift+R`) to review, override, and fill gaps. `404` in a destination is meaningful: it means *deliberately let this die*, as distinct from blank, which means *not decided yet*.

Then `Migration → Redirect Chain Check…` before you hand anything over. If the audit spans several source domains, the map splits per domain automatically — each retiring domain deploys its own configuration.

---

## 7. Build planning

Only if you're staffing and sequencing the build rather than just handing over an inventory. All of it lives in the Sitemap node editor (double-click a node, or the ✎ button), in the **Build**, **Write** and **Migrate** sections.

- **Page Status** — Not Started / In Progress / Built / In Review / Published / Blocked. Edit the vocabulary in Project Settings → Migration.
- **Three roles, one pool of people** — a **builder** assembles the page, a **writer** produces the copy, a **migrator** maps the old content into the new CMS. One person often holds several; the roles are separate because the work and the timing are.
- **Build guidance** and **Writer brief** are per-page markdown notes. Picking a **Target Spec** pre-fills them from that spec's defaults and asks before overwriting anything you already wrote.
- The tree shows this back to you as status pills and role chips, and the **Build:** filter narrows to *no status*, *no assignee*, *has guidance*, and so on — that filter is how you find what's unstaffed.

This is what feeds **Reports → Migration Direction Brief…**, which prints one person's whole queue: their pages, the source pages behind each, and where consolidations are hiding. It's the per-person work order, and it's the reason to fill any of this in.

> Skip this whole step if the deliverable is the audit itself. It exists for engagements where you're also running the build.

---

## 8. Deliverables

**Reports** (all export to PDF or HTML; the HTML opens cleanly in Word):

- *Stakeholder* — Executive Summary · Content Inventory by Section · SME Review Status
- *Audience* — Audience Coverage · Audience × Section Matrix · Audience Debt · Jobs Coverage
- *Consolidation* — Site Consolidation Overview · Cross-Site Duplicate Overlap
- *IA* — Menu Report · Sitemap Coverage · Content Type Crosswalk · Component Inventory
- *Build* — Migration Direction Brief · Migration Checklist · Net New Content Brief · Redirect Map

**Diagrams** (from the Sitemap toolbar, see step 5) — **Visual Sitemap** as interactive HTML for the client, PDF for the deck, or a **Miro** board; **Treemap** for the where-is-the-content picture. **Menus → Export…** hands the navigation to the build team as Excel or JSON.

**Migration menu** — `Pre-Handoff Check…` runs every pre-flight check at once; run it before you ship anything. `Migration Tracker…` is the engineering hand-off. `Export Redirect Map (CSV)…` is the redirect config itself, split per source domain when there's more than one.

**File → Package for Handoff…** zips the project with a README for the receiving team. **File → Export…** covers everything else — filtered rows, audit decisions, or a client-facing column subset via export profiles.

---

## What you can skip

| Step | Skip when |
|---|---|
| URL variant triage | The crawl has no query strings and no duplicate paths |
| Source sites | Single domain (the registry still auto-creates one entry; ignore it) |
| Audience tagging | No audience research exists — but say so rather than leaving it blank by accident |
| AI audience suggestion | The crawl is small enough to bulk-tag, or you have no API key. Inherit-from-section is free and covers most of it |
| Jobs to be done | No JTBD workshop was run. The Jobs field stays hidden until the library has entries |
| Component tagging | Nobody downstream asked for a component inventory |
| Content Type Registry / Target Spec Library | Not replatforming |
| SME round | The client has no reviewers, or you're the expert |
| Sitemap / redirects | Content audit only, no migration |
| Menus | You're handing over an inventory, not an IA |
| Build planning (step 7) | You're not staffing or sequencing the build |

---

## Common mistakes

**Auditing before triage.** Doubles the queue and buries the real content. Step 0 exists for this.

**Tagging audiences before setting tiers.** Everything works, nothing happens. Tiers are what the reports and the vote read.

**Using blank to mean "no".** Blank means unreviewed. Say no explicitly.

**Killing what you meant to exclude.** `Kill` puts a page in the redirect map. `Exclude` says it was never in the inventory.

**Treating Suggested KKE as the answer.** It's a weighted vote from partial signals. Its disagreements are more useful than its agreements.

**Reaching for AI audience suggestion first.** It learns nothing from an empty library and an untagged crawl. Tag by hand, bulk-tag, inherit from section, *then* pay for the remainder.

**Leaving AI suggestions unreviewed.** A pending suggestion is not a tagged page — it's an unanswered question, and every audience report still counts that page as untagged. Drain the queue before you run the readout.

**Leaving Site Domain unset with several sites in scope.** Redirect destinations get built on an arbitrary domain. The tool warns; heed it.

**Expecting the URL structure to be an IA.** *Create Sitemap from Audit* derives sections from first URL segments. On a site with no hierarchy in its URLs that yields hundreds of one-page sections — read the prediction before generating, and the shape check afterwards.

**Building a "current state" sitemap in the working file.** Placing pages writes redirects, and deleting the tree afterwards doesn't take them back — they survive to contradict the future-state tree you build next. Do it in an archived copy: [Showing the current state](#showing-the-current-state--do-it-in-a-copy).

---

## See also

- [User Guide](./USER_GUIDE.md) — the full reference, feature by feature
- [Quick Start](./QUICK_START.md) — the five-minute version of the core loop
- [Content Audit Framework](./CONTENT_AUDIT_FRAMEWORK.md) — the thinking behind KKE
- [Methodology wiki](./methodology/README.md) — practice-level guidance
