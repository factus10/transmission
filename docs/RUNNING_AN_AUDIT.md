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
5. IA and sitemap                        ← if you're replatforming
6. Redirects                             ← falls out of 3 + 5
7. Deliverables
```

Steps 0–3 are close to mandatory. Everything after depends on what you were hired to do — a pure content audit stops after 4; a replatform goes all the way through 7.

---

## 0. Reduce the crawl to real content

**Do this before you look at a single page.** A crawl is a list of URLs that responded, not a list of pages. On a CMS-driven site, half of it routinely isn't content.

> **Why first:** every step after this one costs time per row. On a recent 13,216-row crawl, this step took the real queue to 6,550 — the auditor's workload halved before any judgement was made. Do it later and you'll have spent that time already.

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

**Content Type Registry** (`Project → Content Type Registry…`) — only if you're replatforming. Maps each current content type to what it becomes in the new CMS, so classification flows automatically. The editor shows types in use with no crosswalk yet, so gaps are visible.

**Rubric and analytics** — optional, both feed `Suggested_KKE`. If you have GA4 data in the crawl the tool offers to configure it on open.

---

## 2. Classify in bulk

**Do not start clicking through pages yet.** Almost every classification is true of a whole section at once, and the Multi-bar exists for exactly this.

Filter to a section — the search box, the KKE filter, or **+ Field filter** for any column — then apply to everything visible: set Group, Content Type, Published Status, or **Add Audience**.

Audience tagging in particular is a bulk job. Filter to `/admissions/`, select all, tag *Prospective Students*, move on. A large site is a few dozen passes plus hand-correction. Two filters give you the worklists:

- **Needs audience** — Keep/Evolve pages nobody has assessed yet
- **Serves no priority audience** — reviewed, and everything it serves is off-strategy

> **Why before the audit pass:** a page you've already classified is faster to judge, and the suggestion engine has more to work with when you get to it.

---

## 3. The audit pass

Now go page by page. The loop is: read the page in the built-in browser, make the call, capture why.

- **Keep · Kill · Evolve · Consolidate · Exclude** — keyboard shortcuts for each; the sidebar advances automatically if you want it to.
- **Notes are the deliverable.** Six months later the note is why anyone believes the decision. Write for the client, not for yourself.
- **Watch the Suggested KKE badge.** It shows the winning source (`GA: Kill`, `Audience: Keep`) and flags disagreement with a ⚠. Disagreement is signal: *high traffic, no priority audience* is usually a legacy hub; *low traffic, priority audience* argues for promotion, not removal.
- **Consolidate opens a picker** so you name the surviving page. That relationship writes the redirect later, so it's worth getting right at the point of decision.

Track progress with **Audit Progress** (`Cmd+P`).

---

## 4. SME review

Where the client's experts confirm or overturn your calls. Usually the point of the engagement, and usually where schedules slip.

`SME → Export for SME Review…` produces a standalone spreadsheet with dropdowns, optionally split per content owner. Audience columns ride along — SMEs are frequently the only people who know who actually reads a page.

Then `Import SME Decisions…`, `Compare KKE vs SME…` to see the conflicts side by side, and `Resolve Conflicts…` to produce `Final_KKE`. From that point on, `Final_KKE` is what every report and export reads.

---

## 5. IA and sitemap

Only if you're replatforming.

**Create Sitemap from Audit…** (`Project` menu) builds a starter tree from your URL structure, which is faster than hand-building and easy to reorganize afterwards in the **Sitemap** view (`Cmd+Shift+T`).

Then place pages: the **Needs sitemap placement** filter finds Keep/Evolve pages with no home yet, and the Multi-bar's **Assign to Sitemap…** places many at once.

Useful checks while you're here: **Sitemap Coverage Report** (empty nodes, overloaded nodes), and the **Consolidation Candidates** tool for nodes that ended up with several pages.

---

## 6. Redirects

Largely automatic if steps 3 and 5 were done properly — every `Kill` and every page whose URL changed already has a destination derived.

Open the **Redirects** view (`Cmd+Shift+R`) to review, override, and fill gaps. `404` in a destination is meaningful: it means *deliberately let this die*, as distinct from blank, which means *not decided yet*.

Then `Migration → Redirect Chain Check…` before you hand anything over. If the audit spans several source domains, the map splits per domain automatically — each retiring domain deploys its own configuration.

---

## 7. Deliverables

**Reports** (all export to PDF or HTML; the HTML opens cleanly in Word):

- *Stakeholder* — Executive Summary · Content Inventory by Section · SME Review Status
- *Audience* — Audience Coverage · Audience × Section Matrix · Audience Debt
- *Consolidation* — Site Consolidation Overview · Cross-Site Duplicate Overlap
- *IA* — Menu Report · Sitemap Coverage · Content Type Crosswalk · Component Inventory
- *Build* — Migration Direction Brief · Migration Checklist · Net New Content Brief · Redirect Map

**Migration menu** — `Pre-Handoff Check…` runs every pre-flight check at once; run it before you ship anything. `Migration Tracker…` is the engineering hand-off.

**File → Package for Handoff…** zips the project with a README for the receiving team.

---

## What you can skip

| Step | Skip when |
|---|---|
| URL variant triage | The crawl has no query strings and no duplicate paths |
| Source sites | Single domain (the registry still auto-creates one entry; ignore it) |
| Audience tagging | No audience research exists — but say so rather than leaving it blank by accident |
| Content Type Registry | Not replatforming |
| SME round | The client has no reviewers, or you're the expert |
| Sitemap / redirects | Content audit only, no migration |

---

## Common mistakes

**Auditing before triage.** Doubles the queue and buries the real content. Step 0 exists for this.

**Tagging audiences before setting tiers.** Everything works, nothing happens. Tiers are what the reports and the vote read.

**Using blank to mean "no".** Blank means unreviewed. Say no explicitly.

**Killing what you meant to exclude.** `Kill` puts a page in the redirect map. `Exclude` says it was never in the inventory.

**Treating Suggested KKE as the answer.** It's a weighted vote from partial signals. Its disagreements are more useful than its agreements.

**Leaving Site Domain unset with several sites in scope.** Redirect destinations get built on an arbitrary domain. The tool warns; heed it.

---

## Coming next

**Jobs-to-be-done** — the second half of the audience work. Audiences answer *who*; JTBD answers *what they came to do*, and unserved jobs become the argument for net-new content. When it lands it slots into step 1 (alongside the audience library) and step 7 (a jobs coverage report feeding the Net New Content Brief). Until then, capture jobs in audience descriptions and notes.

---

## See also

- [User Guide](./USER_GUIDE.md) — the full reference, feature by feature
- [Quick Start](./QUICK_START.md) — the five-minute version of the core loop
- [Content Audit Framework](./CONTENT_AUDIT_FRAMEWORK.md) — the thinking behind KKE
- [Methodology wiki](./methodology/README.md) — practice-level guidance
