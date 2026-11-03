# Content Audit Pitch — Jakala

Two versions below: **Written** (for decks and proposals) and **Conversational** (talking points for client meetings).

---

## Written Version (Decks & Proposals)

---

### The Problem With Content Audits

Every website accumulates dead weight. Pages that no one visits. Blog posts from 2018 with broken links and outdated statistics. Three different landing pages targeting the same keyword, cannibalizing each other. A /resources section with 400 PDFs that haven't been opened in years.

You know this content is dragging your site down. Search engines are indexing thousands of pages and concluding that most of them aren't worth ranking. Your editorial team is creating new content without any visibility into what already exists. And when a redesign or migration comes up, nobody knows what to keep, what to cut, and what to fix.

A content audit answers these questions. But the way most agencies do it is painfully manual.

### How Content Audits Usually Work

The standard industry process looks like this:

1. Crawl the site with a tool like Screaming Frog to export every URL with its metadata — titles, descriptions, status codes, word counts, internal links.
2. Pull that export into a spreadsheet. Add columns for traffic data, keyword rankings, and audit decisions.
3. Open each URL in a browser. Compare what you see on the page to what's in the spreadsheet. Record your decision: migrate it, revise it, or archive it.
4. Repeat for every page on the site.

For a 500-page site, this takes days. For a 5,000-page site, it takes weeks. The auditor spends most of their time switching between browser tabs and spreadsheet rows, losing their place, copying data between tools, and fighting with Excel's row limits and filter quirks.

The spreadsheet was never designed for this work. It just happens to be the only tool most agencies have.

### How Jakala Does It Differently

We built a proprietary content audit platform that eliminates the manual overhead and lets our strategists focus on what actually matters: making smart decisions about your content.

**The page and the data, side by side.** Our tool loads your crawl data in a filterable sidebar alongside an embedded browser showing each page. No more switching between windows. Your strategist sees the metadata, the live page, and the audit controls in a single view.

**Structured decisions, not spreadsheet chaos.** Every page gets a clear recommendation — Migrate, Revise, Archive, or Exclude — with tags, notes, and group assignments. Decisions are recorded in a structured format that feeds directly into migration plans, redirect maps, and content briefs.

**Rubric-driven consistency.** We define evaluation criteria upfront as rubrics — specific, measurable rules tailored to your site. "If the page has fewer than 300 words and fewer than 2 internal links, flag it for review." "If the status code is 200 and the page is indexable with more than 500 words, it's a keeper." These rules are applied automatically across every page, ensuring consistent evaluation regardless of which strategist is reviewing.

**AI-assisted assessment.** For subjective criteria that can't be captured in a simple rule — content quality, topical relevance, brand alignment — our platform integrates AI evaluation against your custom rubrics. This doesn't replace human judgment; it augments it, giving strategists a data-informed starting point for every page.

**Analytics-informed recommendations.** When we have access to your Google Analytics, the platform generates a second Migrate/Revise/Archive recommendation drawn from actual traffic data — sessions, engagement rate, time on page, views per session — normalized and weighted into a composite score. The strategist sees this analytics-derived signal alongside their own judgment for every page. It never overrides the human decision; it's one more data point on top of the rubric and AI assessment.

**Client-shareable glossary.** Tags and groups aren't just internal bookkeeping — they carry meaning. The platform lets us attach descriptions to every tag and group used on the audit, and export that glossary as a formatted Word-ready document. The definitions that drove our decisions become part of your deliverable.

**Content consolidation as a first-class decision.** Most audits frame the choice as keep, kill, or evolve (we say Migrate, Revise, or Archive) — but a huge share of real audit work is *merging* near-duplicate pages: multiple landing pages competing for the same keyword, overlapping FAQs, blog posts on the same topic. Archive loses their accumulated value; Revise leaves the cannibalization problem in place. Our platform treats Consolidate as a fifth recommendation with its own workflow: each consolidated page is explicitly tied to the target page absorbing its content, and redirects automatically chase the target through any URL changes the target itself goes through. The Consolidation Candidates workflow finds every multi-page overlap on the site and lets the strategist resolve them in bulk — the difference between catching consolidation opportunities and silently missing them.

**Real-time progress tracking.** At any point during the audit, we can give you a status update: how many pages have been reviewed, the breakdown by recommendation, and how decisions map to your site structure. No waiting until the end for a summary — we can generate a branded progress report on demand and share it as a PDF.

**Navigation and information architecture, built in.** Content audits and IA work are inseparable. Our platform maps every page to your site's sitemap, highlights gaps where sections have no content, and lets strategists plan the future site architecture alongside the audit — not as a separate workstream.

**The sitemap arrives as a working artifact, not a screenshot.** The architecture we plan doesn't stay locked inside our tool. The visual sitemap publishes directly onto a Miro board as real, editable Miro shapes — one per page, positioned exactly as laid out, connected parent to child. Not a flat image pasted into a slide: a board your stakeholders can move around, comment on, and reorganize live in a workshop, in the environment they already work in. A 400-page site pushes across in about a minute. It's a one-way publish, which is the point — the board is where the conversation happens, while the audit data behind it stays authoritative in our platform.

**And the board is readable at a glance.** Sitemap cards can be colored by any of fifteen dimensions: the delivery properties of a page (its phase, its build status, who's writing it, who's building it, who's migrating it) or the audit decisions themselves — content type, Migrate/Revise/Archive, migration track, publishing status, target content type. Rules can combine conditions, and different visual properties can be driven by different rules, so one dimension reads as color while another reads as line style. Because a section usually holds many pages, a rule can ask either what that section *mostly* is or whether it *contains* anything in a given state — "this is mostly articles," or "there's something in here we're archiving." Cards render as a color band or in the heavy-outline convention most sitemap decks already use. The effect is one board where "what kind of page is this" and "what did we decide to do with it" are both legible without cross-referencing a spreadsheet.

**Two more pictures, for the two questions the sitemap can't answer.** A sitemap shows the shape of the site; it doesn't show where the *weight* is, and it doesn't show what happens to the content you have today. So the same data draws two further diagrams. A **treemap** sizes every section by how much content is actually in it and colors it by what we've decided to do with it — usually the more uncomfortable picture, because the section everyone talks about turns out to be forty pages while the one nobody mentions is eight hundred. And a **content flow** diagram traces the current site into the new one: which sections (or, in a consolidation, which *sites*) feed which parts of the new architecture, how much is being retired, and how much isn't placed yet — one image that answers "where does all of this go?" Every diagram exports as an interactive HTML file your team opens in a browser with nothing installed, as a PDF for the deck, as a plain image for slides, or onto a Miro board.

**A true content-type crosswalk, not just a page list.** A migration isn't just "which pages survive" — it's "what does each piece of content *become* in the new system." Our platform separates what content *is* (its type) from how it *renders* (a full page, an embeddable fragment, or a generated feed), and builds a current→target crosswalk: every current content type maps to a target content type in the new CMS, the spec that builds it, and a migration track. Embeddable fragments — the shared content that trips up migrations into systems like AEM — get their own home in the IA, and are automatically kept out of the redirect map and sitemap-coverage checks where they don't belong. The output is a migration the receiving CMS team can actually execute against.

**Direction for the people doing the work.** For each target content type we capture three kinds of direction, each written for a specific role: a *writer brief* for the author, *build guidance* for the page builder, and a *migration mapping* (source→target fields, what to drop, the gotchas) for the migration engineer. Authored once per type and inherited by every page of that type — so a 5,000-record news archive carries one mapping, not five thousand. Each role — writer, builder, migrator — gets a personalized worklist generated straight from the audit.

**SME review workflow, built in.** After the initial audit is complete, subject matter experts review the recommendations in a structured export — complete with Excel dropdown validation for their decisions. When their responses come back, the platform merges them automatically, flags disagreements, and provides a resolution interface where the content strategist makes the final call. No more emailing spreadsheets back and forth and manually reconciling changes.

**Full-page analysis tools.** Beyond the crawl data, our strategists can extract rendered content, check for broken links, capture full-page screenshots, and compare pages side by side — all without leaving the platform. Every finding is documented and exportable.

### What This Means for You

**Faster delivery.** The efficiency gains aren't marginal. By eliminating context-switching, automating rule-based evaluation, and providing integrated analysis tools, our strategists spend their time on judgment calls — not data wrangling. Audits that would take weeks with a spreadsheet are completed in days.

**More consistent results.** Rubric-driven evaluation means every page is held to the same standard. When three strategists audit different sections of your site, the criteria don't drift. The rubric is the source of truth.

**Actionable output, not just a spreadsheet.** The audit produces structured data that flows directly into your next steps. The platform includes a built-in redirect editor where strategists set redirect destinations for every archived page and every page whose URL changes — picking from the planned sitemap or specifying external URLs. The result is a ready-to-implement CSV of 301 redirects that your development team can import directly into any CMS, CDN, or server configuration. No manual redirect spreadsheet assembly. Content briefs for pages that need revising, sitemap placements for the pages you're keeping — it all comes out of the same workflow.

**Transparency throughout.** You don't have to wait for a final report to understand what's happening with your content. We can generate a branded progress report at any point during the audit and share it with you as a PDF — showing the current status, breakdown by recommendation, and group-level detail. A built-in Table View lets strategists view, sort, and filter the full spreadsheet without leaving the tool — no need to open Excel alongside the platform. Filtered exports let us share relevant subsets with different stakeholders — your SEO team sees one view, your content editors see another, your developers see the redirect map.

**Your data stays yours — all of it.** Everything is saved back to standard Excel files. There's no proprietary format lock-in, no cloud dependency, no data leaving your engagement. When the audit is done, you have a fully portable spreadsheet with every decision, tag, note, and recommendation intact. And critically, *your* data comes through untouched: whatever you pulled in your crawl — including custom Screaming Frog extractions like CMS template names, author bylines, publish dates, schema markup, or component flags — is preserved column-for-column through the entire audit and migration lifecycle. Most tools that "ingest" your spreadsheet quietly flatten it to a fixed template and lose those columns. We don't drop a single one — and better still, those custom columns become first-class audit data: your strategists can filter on them, sort by them, and surface them right next to the live page. The data you invested in capturing actually gets used.

---

## Conversational Version (Client Meetings)

Use these as talking points. Adapt to context.

---

### Opening (The Problem)

> "Every site we work with has the same challenge: years of content that's built up with no systematic review. Pages competing with each other for the same keywords. Blog posts from three CMOs ago that nobody's touched. A /resources section with hundreds of items that get zero traffic.
>
> The question isn't whether you need a content audit — it's how to do one without it taking forever and producing a spreadsheet that nobody acts on."

### The Usual Approach (What Competitors Do)

> "The standard process in our industry is: crawl the site, dump everything into a spreadsheet, then have someone open every single URL in a browser, flip back to the spreadsheet, type in their recommendation, and move to the next row. Over and over, for hundreds or thousands of pages.
>
> It works, technically. But most of the auditor's time is spent on logistics — switching windows, finding their place, copying data — rather than actually thinking about the content. And when you're doing that for 2,000 pages, fatigue sets in. The quality of decisions on page 1,500 is not the same as page 50."

### How We're Different

> "We built our own platform for this. The short version: instead of bouncing between a spreadsheet and a browser, our strategists see the page and all its data in one view. The metadata, the live page, the audit controls — all together.
>
> But the real difference is in consistency. Before we start reviewing pages, we define the criteria. What makes a page worth keeping? What signals tell us it should go? We encode those as rules — and the platform applies them automatically across every page. So instead of starting from scratch on each URL, the strategist gets a data-informed recommendation and focuses their time on the judgment calls.
>
> For the more subjective stuff — is this content actually good? Is it on-brand? Does it serve a clear purpose? — we layer in AI evaluation against those same criteria. It's not making the decision; it's giving the strategist a starting point based on your specific rubric."

### The Consolidation Angle

> "Something most audit processes get wrong: they only think about Migrate / Revise / Archive. But on most sites we audit, a third or more of the work is actually *merging* — three landing pages competing for the same keyword, four blog posts on the same topic, two FAQ pages with overlapping questions. If you Archive those, you throw away their value. If you Revise them, you leave the cannibalization in place across multiple 'improved' pages.
>
> Our platform treats Consolidate as a real decision with a real workflow. We can scan the site for every overlap, pick the page that should survive, and automatically redirect the rest to it — including handling cases where the target page itself is moving to a new URL. It's the difference between catching consolidation opportunities and silently missing them."

### The Sitemap Deliverable

> "One thing clients react to more than anything else: the site architecture we build during the audit doesn't stay trapped in our tool. We push it straight onto a Miro board — real Miro shapes, one per page, laid out exactly as we designed it, connected parent to child. Not a screenshot pasted into a slide.
>
> That changes what a sitemap review actually looks like. Instead of us presenting a static diagram while someone takes notes, your team is *in* the board — dragging a section somewhere else, commenting on a specific page, working out where something belongs. In a tool they already use. A four-hundred page site takes about a minute to push over.
>
> And the color coding comes with it. We can color the boxes by content type, or by what we decided to do with each page, or by who's responsible for building it — so you look at a section and immediately see 'this is mostly articles,' or 'there's a lot of red in here, we're cutting most of this.' It's a one-way publish, deliberately: the board is where the conversation happens, and the audit data behind it stays authoritative in our platform.
>
> And there are two other views we'll usually bring to that conversation. One sizes each section by how much content is really in it — that's normally the slide where someone says 'wait, *how* many pages are in there?' The other traces where your current content ends up in the new architecture: what moves, what merges, what we're retiring, what still has no home. Both come out of the same audit, and you can have them as a file your team clicks through in a browser, a PDF, or on the Miro board with everything else."

### Speed & Efficiency

> "The efficiency difference is significant. An audit that would take two to three weeks with a spreadsheet, we're completing in days. Not because we're cutting corners — because the tool handles the mechanical work and lets our people focus on strategy."

### What They Get

> "The output isn't just a spreadsheet with 'Migrate' or 'Archive' in a column. Every decision has context — tags, notes, group assignments. Pages are mapped to your sitemap. Our redirect editor lets strategists assign specific destinations for every archived or moved page — pulling from the planned sitemap or pointing to external URLs — and then export a ready-to-implement redirect map. You get content briefs for pages that need work, and a clear picture of what your site looks like after the audit.
>
> And when it's time for your subject matter experts to review — we don't just email them a spreadsheet and hope for the best. We generate a structured review sheet with dropdown menus for their decisions, merge their responses back automatically, and flag any disagreements for our strategist to resolve. The whole back-and-forth that usually takes a week of emails happens in minutes.
>
> And when a question comes up that no report was written for — how much of a section is being retired, what's still undecided for one audience — we can put it to the audit directly and get a real count back in minutes, not after a round of spreadsheet pivots. The audit stays the single source of truth; nothing about your content decisions is delegated to a model.
>
> And we can give you a status update at any point. We're not disappearing for three weeks and coming back with a deliverable. We generate a progress report — branded with your project details — and share it as a PDF whenever you want to see where things stand."

### Handling the "Can't We Just Use a Spreadsheet?" Question

> "You absolutely can. That's what most agencies do, and it produces results. The question is how much of your budget goes to an auditor wrestling with Excel versus actually thinking about your content.
>
> The spreadsheet approach also tends to produce inconsistent results. When you're 800 rows in, the criteria in your head have drifted from where they were on row 1. Our approach locks in the criteria upfront, so page 2,000 gets the same rigor as page 1."

### Handling the "Is AI Doing the Audit?" Question

> "No. AI assists our strategists — it doesn't replace them. Think of it like this: we define the evaluation criteria, the AI applies them at scale, and then a human reviews and makes the final call. The AI is particularly useful for subjective content quality questions that you can't answer with spreadsheet data alone. But every recommendation is reviewed by a strategist who understands your business."

### On Your Crawl Data (if they've invested in custom extractions)

> "One thing teams who really know Screaming Frog appreciate: if you've set up custom extractions — pulling CMS template names, author bylines, publish dates, structured data, whatever matters to you — all of that comes through completely intact. A lot of tools quietly collapse your spreadsheet down to their own fixed set of columns and lose that work. We keep every column exactly as you crawled it, and we make those custom fields usable inside the audit — your team can filter and sort on them and see them next to each live page. The data you went to the trouble of capturing actually drives the audit."

### Closing

> "Content audits are one of those things where the methodology matters as much as the expertise. Everyone in our space knows what Keep/Kill/Evolve means (we call it Migrate/Revise/Archive). The difference is in how efficiently and consistently you execute it. We invested in building the tooling to do it better."

---

## Key Stats to Reference

Use selectively based on the conversation:

- **QuickBooks case study:** Deleted 2,000 underperforming blog posts. Saw a 20% traffic increase within weeks, ultimately leading to 72% more signups. Proof that archiving content works.
- **Google's crawl budget:** Search engines allocate limited resources to crawling each site. Thousands of low-value pages dilute that budget, making it harder for your best content to get indexed and ranked.
- **Content decay:** The average piece of web content loses 50%+ of its organic traffic within 12 months of publication if not maintained. An audit identifies what's decaying and what's worth saving.
- **Migration risk:** Sites that migrate without auditing content first typically see 10–30% traffic drops that take 6–12 months to recover. A proper audit before migration significantly reduces this risk.

---

## Competitive Positioning

When clients mention other approaches or tools:

| They say | We say |
|----------|--------|
| "Our last agency just used Screaming Frog and Excel" | "We use Screaming Frog for the crawl too — it's the industry standard. The difference is what happens after the export. Instead of a spreadsheet, the data goes into our audit platform where every page is evaluated against defined criteria." |
| "We've looked at SEMrush Content Audit" | "SEMrush is great for pulling data together. Where it stops is the actual decision-making workflow — you're still looking at a dashboard and manually recording recommendations. Our platform is built specifically for the review-and-decide workflow." |
| "Can't we just do this with Google Sheets so everyone can collaborate?" | "Google Sheets works for small sites, but it doesn't scale. At 1,000+ pages you hit performance issues, and you still have the fundamental problem of flipping between the sheet and the actual pages. Our platform solves both." |
| "We already did an audit internally" | "That's great — we can import those decisions and build on them. Our platform merges existing audit data by URL, so nothing is lost. We'd review what you've done, apply our rubric for consistency, and fill in the gaps." |
| "Our team does all its architecture work in Miro" | "Then that's where we'll hand the architecture over. The visual sitemap publishes onto a Miro board as real, editable shapes — one per page, laid out as designed, connected parent to child, color-coded by content type or by what we decided to do with each page. Your team works with it the way they work with everything else in Miro; the audit data behind it stays authoritative on our side." |
| "We set up a lot of custom extractions in our crawl" | "Perfect — those come straight through. Every custom extraction column you built is preserved exactly, and our platform makes them usable: your team can filter and sort on them and see them alongside each live page. Most tools flatten your spreadsheet to a fixed template and throw that work away. We treat your columns as first-class data." |
