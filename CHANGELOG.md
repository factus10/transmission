# Changelog

All notable changes to Transmission are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
major-version codenames drawn from The Smiths.

## [Unreleased]

### Added

- **SME → Review Consolidations….** Clients often have their own view of which pages overlap and where the content belongs. This list collects every consolidation their Final KKE changed: pages they asked to consolidate that you didn't, pages you consolidated that they kept (their old target is still stored), and pages where you both agreed but the SME left notes. That last group is where "merge it into X instead" usually gets written. For each page you can choose or change the target, confirm it, or clear the target nobody uses anymore. A page leaves the list once you've reviewed it, and comes back if the decision or target changes later. The app offers the review after an SME import or a Resolve session, and the **Consolidate (client changed — review)** sidebar filter finds the same pages.

### Changed

- **Every report has the same header.** It shows client · project, the date the report was generated, and the dates the site was crawled (read from Screaming Frog's **Crawl Timestamp** column when the export has it). The local file name is gone from exported reports. The in-app preview now shows the same header as the exported file.

- **Section counts agree everywhere.** The Executive Summary's By Section, Content Inventory and the progress dashboard now read one shared tally.
  - By Section is now a table showing each decision's share per section.
  - Content Inventory is now one ranked table of every section, plus a closer look at the ten largest. It used to produce one block per section, which ran to hundreds of pages on a large site.

- **The Audit Progress export uses the standard report layout.** It gains the content / redirect split, the SME review figures, and a by-section table, all of which the dashboard already showed.

- **Long tables are capped.** The Audience × Section Matrix shows the 40 largest sections, and SME Review Status shows the 30 owners furthest from done. The rest are rolled into one row, so totals still add up.

- **Audience × Section Matrix shading is clearer.** Cells are shaded by their share of the section's *tagged* pages, and a new **Untagged** column shows what's left. A mostly-untagged section used to look pale everywhere, so the shading tracked tagging progress rather than who the section serves.

- **The Menu Report export** shows the same header details and out-of-scope notice as every other report.

### Fixed

- **A client's Final KKE now decides whether a page consolidates.** If you recommended Consolidate and the client's Final KKE said Keep, the page was still treated as consolidating. It kept its target, it kept the redirect that merges it into another page, and it stayed in the consolidate worklists. Every other part of the app already put Final KKE first; consolidation now does too. The reverse case works as well: a client Final of Consolidate over your Keep now counts as a consolidation, and the audit bar asks where it should go.

- **The audit bar shows when the client overrode your call.** The KKE buttons show your recommendation, and nothing showed that a Final KKE had replaced it unless you had turned on the SME fields. A **Final** chip now appears next to the buttons whenever the two differ. Click it to pick the target (for a Consolidate) or to open the Final dropdown. In the sidebar, the KKE badge is struck through when a Final overrides it, and a consolidate flag the client overrode is shown as inactive.

- **The Consolidate button's status dot is back.** The red dot (no target) and the amber dot (target is being killed) inside the Consolidate button disappeared as soon as a file opened, because the buttons were rebuilt without them. Both show again.

- **The Redirect Map Report now matches the redirect CSV.** The report derived its own rules, and they could differ from the file you deploy:
  - It read your recommendation instead of the client's Final KKE.
  - It took destinations from the sitemap path, ignoring redirects you typed or inherited.
  - It dropped consolidated pages.

  The report and the Migration Checklist now use the same rules as the CSV and the Migration Tracker, so all four agree. The report lists pages that **still need a destination** first, and splits rules by source site on a merger. Long lists stop at 200 rows with a pointer to the full CSV, so the PDF is no longer hundreds of pages.

- **Consolidated pages with no destination are flagged.** A Consolidate page with nowhere to redirect used to disappear from every redirect list. It now ships as `(TBD)` like a Kill with no destination. The **Pre-Handoff Check** has a new check for both.

- **Reports count the client's decision.** The progress dashboard, its PDF, the Executive Summary, SME Review Status, Component Inventory, the redirect chain check and the Pre-Handoff Check counted your recommendation even after an SME had set a Final KKE. They now count the Final KKE. SME percentages can no longer go over 100%.

- **Reports agree on what counts.**
  - Audience reports, Content Inventory, Site Consolidation and Cross-Site Duplicates now count content pages. Existing redirects and dead URLs are no longer counted, so their totals match the Executive Summary.
  - Reports that said out-of-scope sites were excluded now actually exclude them. That covers the Menu Report, Sitemap Coverage, Net New Brief, Audience Debt, redirect chains, Pre-Handoff and the Migration Direction Brief.

- **One definition of "net new".** The Sitemap tree, its stats bar, the Net New Brief, Sitemap Coverage, the Migration Checklist and the Migration Tracker each counted net-new and empty pages differently. They now all match the tree's NEW and ○ badges. As a result, the stats bar's "empty" count now includes empty branches, not just empty leaves.

- **Executive Summary.**
  - Findings now cover every decision, Consolidate and custom states included, each with its percentage.
  - The orphan-page count only counts content pages being kept.
  - By Section adds up to the page total.

- **Smaller fixes:**
  - The progress dashboard's bar segments are filled in again.
  - Report previews in the app are styled like the exported file.
  - Sitemap Coverage uses the standard report layout, and no longer shows the previous report's title.
  - The Migration Checklist no longer lists URL changes twice, and counts Consolidate on its own line.
  - Site Consolidation shows pages that belong to no site.
  - Cross-Site Duplicates names the fields it actually matched.
  - SME Review Status lists conflicts with URL and SME notes, grouped by owner.
  - The Menu Report export no longer carries a hard-coded agency name or an "Internal — not for client distribution" badge. Its header shows the client and project names, and it no longer needs Google Fonts.

## [2.18.1] — "Please, Please, Please, Let Me Get What I Want"

### Fixed

- **News posts, events and profiles are no longer treated as fragments.** The Renders as value `Content Object` did double duty. The built-in Content Type Registry uses it for records like news posts, events and faculty profiles, which have their own pages. But the dropdown labeled it "Fragment (embeddable)", and the app treated every such row as having no URL. Those pages were left out of redirects, redirect exports, sitemap-placement checks and Sitemap Coverage (614 rows on one real audit). Renders as now has separate **Record (own page)** and **Fragment (embeddable, no URL)** options, and only Fragment is skipped. Existing projects are repaired once when opened: `Content Object` rows the crawl reached at a URL become records, and rows the crawl never reached keep their fragment treatment. A notice gives the counts.
- **Site Domain only accepts one URL.** On a merger it's natural to type both source sites into Site Domain, but every redirect is built by putting a page's path after that value, so every destination came out as `https://a.edu; https://b.edu/about`. That isn't a URL. The field now rejects anything that isn't a single URL and shows why. Opening a project whose saved Site Domain is malformed shows a warning. When you correct it, redirects built on the old value are rewritten to the new one.
- **App-derived Kill and Consolidate redirects now follow changes.** A destination the app derived for a Kill or Consolidate page stayed frozen once anything it was derived from changed, such as the Site Domain or the page it points at. Keep/Evolve redirects already updated on save; these now do too. **Re-derive from sitemap** also covers unplaced Kill/Consolidate rows, such as retired 301s and consolidated pages; before, it skipped every row without a sitemap assignment. Destinations you typed or picked yourself are still never touched.
- **Multi-paragraph dialogs no longer run together.** A modal body with more than one paragraph rendered as a single block — most visibly the update dialog, where "Transmission vX is available" ran straight into the release note beneath it. The global CSS reset zeroes every margin and nothing restored it for dialog text.

## [2.18.0] — "Please, Please, Please, Let Me Get What I Want"

### Added

- **Inherited redirects carry forward instead of freezing.** A 3xx in a crawl is a redirect rule the live site already has, and Triage Non-200 copies its destination in. That copy was recorded as a hand-typed value, which meant the redirect resolver would never revisit it — so a rule written on day one still pointed at its target's **old** URL on day ninety, after you'd moved that page in the sitemap. On a replatform that ships redirects to URLs which won't exist.

  Those destinations now re-derive on every save, the way sitemap-derived redirects already did. If the page an inherited redirect points at moves, is consolidated into another page, or is retired to a 404, the rule follows it. A chain on the live site (A → B → C) collapses to a single hop, so no rule lands on a URL that is itself being retired. Redirects you typed by hand are still never touched — that contract is unchanged; only the machine-copied ones were ever affected.

  **Redirect Chain Check** (Migration menu) is now a full report rather than a list, and covers what the app *can't* resolve — grouped and explained, because these are genuinely different problems: no destination recorded · redirects to itself · destination is a dead 4xx · **destination has no KKE decision yet** · destination is being retired with nowhere to go · **destination not in this crawl** · destination on an out-of-scope site. Off-site destinations are listed separately and carry forward verbatim. The **Inherited redirect needs review** sidebar filter is the worklist, and the Pre-Handoff Check counts what's left.

  Two of those groups are worth calling out. *Destination not in this crawl* is separated from *off-site* because a destination the app can't match to a row is either a hole in your crawl data or an ordinary external link, and those need opposite responses. And *destination has no KKE decision yet* is the one that catches the quiet failure: a redirect pointing at a page nobody has ruled on, which may turn out to be Kill. It keys on the **decision, not on sitemap placement** — deliberately, because a migration that preserves every URL in the new CMS never builds a sitemap, and a placement-based check would fire on all of it. Whether a page is placed depends on how you work; whether it's been decided doesn't. It's also the group you clear without touching a redirect: decide the destination pages, and the rules re-derive themselves.

- **Out-of-scope sites are now actually excluded from progress figures.** Marking a source site out of scope has always been documented as narrowing report totals, and every report already printed a banner saying so — but the audit-progress numbers behind four surfaces (the progress dashboard, its PDF export, the Executive Summary and SME Review Status) were still counted over the whole crawl. The banner was telling clients that pages were excluded from figures that included them, and completion could never reach 100% on a project with a retired property dragging the denominator. Fixed at the source, so all four agree. The dashboard and progress PDF, which don't route through the shared report wrapper, now carry the same disclosure.

- **Reports count content pages, not crawled URLs.** A crawl lists every URL that responded, so the Executive Summary's headline had been counting inherited 301s and dead links as pages — and a stakeholder reading it asks the obvious question: are we really migrating twelve thousand pages? The answer was always that number minus the redirects.

  The Overview now leads with `URLs crawled`, breaks out **existing redirects (3xx)** and **not found / gone (4xx)**, and reports **content pages audited** — and every figure below it, including the KKE bar and the "recommended for removal" percentage, is over content pages only. On a real higher-ed crawl that moved the removal figure from 66% to 31%; the first number was mostly redirects. Nothing is hidden — the non-content rows are named, counted, and still in the audit, and two new sidebar filters (**Existing redirect (3xx — not content)**, **Not content (3xx or 4xx)**) show the rows behind the number.

  A 5xx still counts as content: a broken page is a page, and it's work you'll be doing. The split is derived from the crawl's own Status Code, so existing projects get correct numbers with no setup, and a crawl with no Status Code column reports exactly as it did before. The progress dashboard shows the split too, beneath its unchanged all-rows total — an auditor's progress covers every row, because a redirect still has to be triaged. Section tallies follow the same rule: the dashboard's *By group* counts every row and the Executive Summary's *By Section* counts content pages, so each adds up to the total printed above it.

- **Delete rows permanently.** A crawl sometimes arrives carrying rows that were never pages — a stray export appended to the file, a merge that doubled a section. Until now the only remedy was Excel, which costs you the audit columns and the change log. The Multi-bar's new **⚠ Delete rows permanently…** removes them from the project outright.

  It's the one destructive action in the app, so it behaves like one. Before anything happens it reports what the deletion *breaks*: pages that consolidate into one you're deleting and would be left pointing at nothing, how many of the doomed rows carry a KKE decision rather than being crawl noise, and how many are placed on the sitemap or carry a redirect destination. Then it asks you to type `PERMANENTLY DELETE`. Every removal is written to the change log. Autosave commits it to the file within a couple of seconds, so there is no close-without-saving escape — the dialog says so rather than implying one.

  It also clears the session's undo history, which is worth understanding rather than just accepting: every undo entry refers to a row *by position*, and removing rows moves everything below them — so keeping the history would mean a later Cmd+Z writing an old value into the wrong page. For a real URL you simply aren't auditing, **Exclude** remains the right answer; deletion is for rows that shouldn't be in the spreadsheet at all.

- **Field filters can compare numerically — `is greater than` and `is less than`.** A crawl is full of numeric columns (word count, status code, response time, inlinks, GA sessions) and until now the only way to filter one was `contains`, which can't express "under 300 words." The two new operators compare as numbers whenever both the cell and your value are numeric — comma-grouped values like `1,234` included — so `900` doesn't sort above `1,000` the way a text comparison would. Given anything non-numeric they fall back to comparing character by character in ASCII order, usable for text if you know that ordering. Blank cells match neither direction: blank means *unreviewed* in this app, not zero.

### Fixed

- **A second field filter can be removed again.** Stacked filter chips were squeezed by the buttons beside them until the × was clipped off the pill — leaving the filter hiding your rows with no way to dismiss it. Chips now take a row of their own, long field names and values truncate instead of the button, and the × is always hittable.
- **Triage Non-200 Pages is no longer stuck behind its own dim overlay.** The dialog was being placed alongside the backdrop rather than inside it, so it painted underneath — the screen dimmed and the dialog was unreachable in the corner.

## [2.17.1] — "Please, Please, Please, Let Me Get What I Want"

### Fixed

- **What's New always shows the current changelog.** The window could render a copy up to ten minutes old — which is exactly the wrong ten minutes, since you reach it from a prompt that has just told you a new version exists, and the cached page describes the *previous* release. It now fetches fresh every time you open it.
- **The changelog page opens on the newest release.** It used to lead with an empty "Unreleased" section, which read as though something had failed to load. (This one was already live before this release — the page is generated and published separately from the app.)

## [2.17.0] — "Please, Please, Please, Let Me Get What I Want"

### Added

- **Sitemap shape check.** A sitemap can be structurally perfect and still be undrawable, and the app used to discover that for you only by rendering a wall of specks. The check names what's driving the size and shows what fixing it would buy — *before* you commit to the fix.

  It reports how many top-level sections you have, the exact size the diagram will be, and the zoom it will open at (measured with the real layout engine, so the numbers are the ones you'll get). Then it groups the causes: **top-level sections holding a single page** — the signature of a flat site with no hierarchy in its URLs; **crawl artifacts** like `/tag`, `/category` and `/wp-content` that are CMS plumbing rather than parts of the site; and **sections too wide to lay out**. Each can be repaired in place — moved under one section, removed (the pages stay in the audit, just unplaced), or marked collapsed.

  As you tick the repairs it shows the tree you'd end up with. That matters because on a genuinely flat site the honest answer is that they aren't enough — the tree needs real sections, which is judgement, not a button — and it's better to know that before restructuring hundreds of sections than after. Opening the diagram as-is is always offered: a site with no information architecture is a legitimate finding to show a client. Reached from the ⚠ in the Sitemap toolbar's stats line, and offered automatically when you open the Visual Sitemap on a tree that won't render.

- **Create Sitemap from Audit says what it's about to build.** The dialog now predicts the tree before you generate it: how many top-level sections you'll get, how many of those hold a single page, and which crawl artifacts are in the mix. It also explains something the tool can't fix for you — sections come from the *first* URL segment, so bucket depth won't reduce them. When the result would be unusable it offers to sweep the single-page sections into one named section as part of the same step, so what lands is a tree you can actually open.

- **Undo covers grouping sitemap sections.** Moving sections under a bucket — from either the shape check or Create Sitemap from Audit — reverses with a single Cmd+Z, however many sections moved.

- **Help → Online Documentation** opens the full documentation in your browser — the User Guide, the engagement sequence, one-page walkthroughs for every stage of an audit, and the method pages behind them. The in-app **Transmission Help** window is unchanged and still the fastest way to check one thing; this is the long-form set, and it's public, so it can be sent to a client or a colleague who doesn't have the app.

### Fixed

- **The Visual Sitemap no longer opens on an empty screen.** A very large tree — the kind "Create Sitemap from Audit" produces from a flat site, where every page sits at the URL root and becomes its own top-level section — laid out tens of thousands of pixels wide and over a hundred thousand tall. Fit-to-screen refused to zoom out past 10% and then centred the canvas, which on a canvas ten times wider than the window pushed every card off the left edge: on a real 1,755-node audit, **none** of the 1,755 cards were on screen, so the diagram looked as though it had never been built. Fit now zooms out as far as it needs to, and only centres an axis when the content actually fits it, so you always land on the diagram. Scrolling out reaches the same zoom Fit uses, rather than stopping above it.

## [2.16.1] — "Please, Please, Please, Let Me Get What I Want"

### Changed

- **The Visual Sitemap and Treemap open faster on large audits.** Both views summarize every audit row against the node it's placed on before they can draw — the step that decides what a section "mostly is" for color-by-field rules. That summary is now about a third quicker: roughly 24ms → 15ms on a 13,000-page audit, and 83ms → 59ms on a 40,000-page one. Nothing about what's drawn changes; it's the same summary, computed with less overhead. (The connector volume-weighting added in 2.16.0 was measured at the same time and left alone — at well under a millisecond it was never the delay.)

## [2.16.0] — "Please, Please, Please, Let Me Get What I Want"

### Added

- **Sitemap connector color and weight.** The Visual Sitemap's **Settings → Layout** tab has a new **Connectors** section. **Line color** replaces the fixed grey — pick one color for every line (per-line rainbows are a Miro job, not this app's). **Line weight** can now be **By content volume**: each line's thickness reflects how many pages sit beneath it, so a section carrying 200 pages draws as a thick trunk and a 4-page corner draws thin. A parent's shared run carries its whole branch and each drop carries that child's share, like a trunk splitting into branches. The scale is compressed on purpose, so small sections stay legible next to a huge one. Both settings save with the project and carry into the HTML, PDF, PNG **and Miro** exports — they're sitemap settings, not export settings.

### Changed

- **The Miro export's Connector thickness now defaults to "Match sitemap"**, so a volume-weighted sitemap exports volume-weighted lines. The old fixed choices (Thin/Medium/Heavy/Extra heavy) remain as a per-board override. If you've already set a thickness for a project it's untouched; a project that never set one now exports at 2 rather than 1, because that's what the app's own 1.5px line rounds to and "match" should mean match.

## [2.15.0] — "Please, Please, Please, Let Me Get What I Want"

### Added

- **Connector thickness for the Miro sitemap export.** The Appearance section of **Export to Miro** now sets how heavy the lines *between* boxes are — Thin (the default, and what exports drew before) · Medium · Heavy · Extra heavy — alongside the connector style and card border controls that were already there. It's remembered per project like the rest. The widths are whole numbers on purpose: Miro's thickness slider only stops on whole numbers, and an in-between value renders as a barely-visible hairline.
- **Delete a scratch Miro board straight from the export toast.** The export dialog nudges you toward *create a new board* — review it, then tidy up — and there was no way to do the tidying, so throwaway boards piled up in your Miro team. When an export creates a board, the "Exported N pages…" toast now carries a **Delete board** button. It only appears for boards that export just created (never one you picked, which may have other work on it), it asks for confirmation first, and Miro moves the board to your team's trash so it can be restored. Ignoring it is always fine — the toast simply lapses, and it waits longer than usual and holds while you hover, since the export opens the board in your browser and you'll be looking elsewhere.

## [2.14.1] — "Please, Please, Please, Let Me Get What I Want"

### Fixed

- **Redirect loops now actually clear.** The Redirect Health Check would report a page redirecting to itself, you'd tick the group and hit **Fix selected**, and the loop would be back the moment the file next auto-saved. The check and the redirect resolver disagreed about what a loop is: the resolver, walking a consolidation chain that circles back on itself, gives up and returns the last URL it saw — which is the page's own URL — and nothing stopped it writing that. So the check cleared the loop and the very next save derived it straight back. On a two-page consolidation cycle the "fix" made things *worse*, turning one loop into two. Both halves now share one definition of a self-redirect, a derived destination that lands back on its own page is treated as no destination at all, and loops already sitting in a file heal themselves on the next save without the health check being run at all. A redirect you typed by hand is still never touched, and `404` still means a deliberate deindex.
- **A cross-site redirect is no longer mistaken for a loop.** On a consolidation, `alpha.edu/about` → `beta.edu/about` was read as a page redirecting to itself, because only the URL path was compared. Hosts are now compared too, whenever both sides carry one.

## [2.14.0] — "Please, Please, Please, Let Me Get What I Want"

### Added

- **Export PNG** — every visualization (Visual Sitemap, Treemap, Content Flow) now exports a plain image alongside HTML and PDF, for slides and documents that can't place a PDF. The image is the whole diagram at the size it lays out at, not a screenshot of what happens to be on screen, rendered at 2× where it fits so text stays crisp.
- **Recolor the Treemap.** Open the **Legend** and every entry has a color well: change **Keep**, or a section, or a Page Status, and every box in that category follows. **Right-click any box** to override just that one — useful for calling out a single section in a client deck. **Reset colors** puts everything back. Your palette saves with the project, per coloring mode (the colors you chose for the section view don't disturb the KKE view), and carries into the HTML, PDF, PNG and Miro exports.
- **Export the Treemap and Content Flow to Miro**, the way the Visual Sitemap already could — same board picker, same "export again to the last board", same optional color key. The Treemap goes across as its own rectangle packing. The Content Flow becomes blocks and weighted connectors, since Miro has no ribbon: the reading survives (what exists, how big, what connects to what, in what color), but band thickness is Miro's 1–24 stroke scale rather than the exact proportion drawn on screen.
- **A "Consolidate: no target" chip in the sidebar**, showing how many pages are marked Consolidate without a page to consolidate *into* — the one KKE value that isn't a finished decision, since it says the page goes away without saying where its content and its redirect go. Click it to filter to exactly those. It appears only when there are any. (The same filter has always been available under the KKE filter dropdown, and the Pre-Handoff Check has always counted them; this puts the number where you'll see it.)

### Changed

- **Consolidating now nudges the target page to Evolve.** Merging another page's content into a page is work, and Evolve is how this audit says there's work to do here — so choosing a target marked **Keep** (which claims the page is unchanged) or **Kill/Exclude** (a destination that is itself being removed) now asks whether to set it to Evolve. You can decline; the consolidation stands either way.
- **A page can no longer consolidate into itself**, or into a page that consolidates back into it. Either one is a redirect loop and a page whose content never lands anywhere.
- **Releases are published by a script now** (`npm run release:publish`), instead of four commands run by hand. It verifies the signed artifacts before uploading anything, uploads each asset on its own, checks every byte count against the local file, and confirms that `releases/latest` actually resolves to the new version on both repos before the update manifest — the thing that tells running copies an update exists — is published. Developer-facing only; nothing changes in the app.

### Fixed

- **Content Flow exports now match what you're looking at.** Switching the left column, the shape, or the coloring and then exporting produced the view the diagram *opened* with, not the one on screen — so a PDF could show a completely different reading than the one you meant to hand over. The exported HTML also opens on that view now, with its toggles set to match.

## [2.13.1] — "Please, Please, Please, Let Me Get What I Want"

### Fixed

- **The legend opens in front of the diagram again** in Content Flow and the Treemap. It was being clipped to a sliver at the bottom edge of the toolbar, so it read as hidden behind the visualization.
- **Content Flow's toolbar buttons stopped responding after switching the left column.** Legend, Fit and the export buttons were re-registered every time the axis changed, so a second click cancelled the first — the legend in particular would open and immediately close, appearing to do nothing.

## [2.13.0] — "Please, Please, Please, Let Me Get What I Want"

### Added

- **`npm test`** — the project now has automated tests, using Node's built-in runner, with no new dependencies (this is a signed, notarized universal binary; its dependency budget is not spent on a test framework). 32 tests cover the Content Flow's host-side logic. See `docs/dev/TESTING.md`.

- **Sitemap toolbar → Content Flow** — the migration itself as a flow diagram: where the content is now on the left, where it ends up on the right, and every band's thickness a page count. Three readings, switched inside the view: **→ Decision** maps the current site straight onto its Keep/Kill/Evolve/Consolidate/Exclude calls — including any states you've added yourself, each with its own block in the color you gave it, plus an **(unreviewed)** block that doubles as a picture of how far the audit has got; **→ New sitemap** answers *"where did this section's content go"*; and **→ Decision → New** shows both at once, the version worth showing a client, because it makes plain that you're not just moving pages, you're deciding about them. Color the bands by decision or by source; hover any band or block to isolate its flow. The three endpoints that aren't sitemap sections are the point as much as the flows are — **Retired**, **Out of scope**, and **Not yet placed** — since on most audits one of those is the largest block on the diagram, and a flow chart that quietly omits the content going nowhere is worse than none. **Consolidated** pages flow *through* to whatever section their master page lands in (the URL dies, the content survives), chained consolidations included. Current-site sections are read from the URL path, with shared path prefixes and locale prefixes stripped per host, and a dialog up front picks how deep that axis goes. **Export HTML** keeps every reading and coloring, so a client gets the whole thing in a browser with no app; **Export PDF** prints the current view to one page.
- **Content Flow understands multi-site consolidations.** When the audit covers more than one source site, the left column can be the **source site** rather than the current section — and it leads by default, because in a consolidation that's the question: which site contributes what, and where does it land. Four or five blocks instead of the sixty a five-site audit's sections would produce, with the merge showing as several sites' bands converging on one new section. Out-of-scope sites are excluded, section names are qualified by site (`Beta College › About`) so two sites' `/about` can't quietly merge, and a site served from both `www.` and a subdomain still counts as one site. Where a column is still crowded, sections past the top 20 group into a single **Other** block — totals still add up, and a note says how many were folded.
- **Give your source sites real names.** A site picked up from a crawl is named after its domain, because that's all Transmission can infer — fine when the name only appeared in reports, less so now that it labels a whole column of a diagram you'll put in front of a client. The Content Flow setup dialog now offers a rename box for any in-scope site still named after its address, so "beta.edu" can become "Beta College" without leaving what you were doing. Skip it if you like; the names live in **Project Settings → Sites** as they always have, travel with the project, and renaming a site still updates every page's **Source Site**. Nothing is asked on a single-site audit, where the site never appears as a block. Renaming a site whose new name differs only in capitalization now works, too.

## [2.12.0] — "Please, Please, Please, Let Me Get What I Want"

### Added

- **Migration → Redirect Health Check…** — finds redirects that no longer agree with your sitemap and repairs them in one undoable step. Redirects are derived from the sitemap, but the app cannot tell a destination *it* wrote from one *you* typed, so once a value exists on a Keep or Evolve page it is never revisited — reorganize the tree, or build a sitemap and delete it, and the old destinations quietly survive to contradict the new tree. The check sorts what it finds into groups, each listing every affected page: pages **redirecting to themselves** (a loop), Keep/Evolve pages **carrying a redirect while not on the sitemap at all** (they aren't moving, so they need none — usually the largest group and the one nothing else finds), destinations that **disagree with the page's sitemap node**, and pages **placed where they already live**. Tick the groups to repair; the whole fix is a single **Cmd+Z**. Anything whose destination still resolves to a real node in your sitemap is reported but *never* changed automatically, since that may well be a deliberate choice. Blank destinations, intentional **404**s, and out-of-scope sites are left alone. A per-class count also appears in the Pre-Handoff Check.

### Changed

- **Create Sitemap from Audit now asks what the tree is for.** *Where pages are going* (the default, and what the tool has always assumed) or *where pages are today* — a snapshot to show a client. Pick the snapshot and it says plainly that a snapshot belongs in **a copy** of the project, with a **Save a copy first…** button that makes one and switches you to it. Placing pages writes where they're going and Transmission derives redirects from that, which is right for a tree describing the future and meaningless for one describing the present.
- **Redirects you didn't write now follow the sitemap on their own.** Previously a destination on a Keep or Evolve page was never revisited once it existed — so reorganizing the tree, or building a sitemap and deleting it, left the old destinations behind to contradict the new tree. Now a redirect **Transmission derived** is kept current: it follows the page's node when the tree moves, and is cleared when the page stops moving (taken off the sitemap, or placed where it already lives). A destination **you** typed or picked is never touched — including on Kill pages, where a hand-set destination that happened to match the project default could previously be overwritten. Clearing a page's sitemap assignment now also clears the redirect that was derived from it (the Kill/Consolidate cleanup prompt still asks separately and honors your answer).
- **Redirects already in your file are left exactly as they are.** They predate the record of who wrote them, so the app treats them as ambiguous rather than guessing — use **Migration → Redirect Health Check…** to review and repair those, which is what it's for.
- **Transmission now records how each redirect destination was set** — derived from the sitemap, or entered by a person. Nothing acted on this yet, but it is the fact whose absence lets a redirect derived from a sitemap you have since deleted survive forever: without it the app has to guess from the value alone whether it may update a destination, and on Keep/Evolve pages it guesses "leave it alone". Redirects set from now on are recorded; ones already in your file read as unknown and keep being treated cautiously.
- **A collapsed section in the Visual Sitemap now tells you how much it's hiding.** Folding a branch used to hide the answer along with the pages — the card kept reporting its own assigned page count, which is rarely the number you want from a box you just closed. A collapsed card now reads *"6 pages hidden"*: the sub-pages folded away underneath it. The **Counts** dropdown in the sitemap toolbar (where the **Page counts** checkbox used to be) picks what that line reports — **Hidden sub-pages (collapsed only)**, the new default, which leaves expanded cards clean; **Sub-pages on every branch**, for sizing sections at a glance; **Assigned audit pages**, the original per-node tally, unchanged for anyone who works that way; or **None**. Your choice saves with the project and carries into the HTML, PDF, and Miro exports. If you had page counts switched off, they stay off.

## [2.11.1] — "Please, Please, Please, Let Me Get What I Want"

### Fixed

- **Coloring a sitemap section no longer applies the color to a different one.** In the Visual Sitemap's color rules, choosing a section under **Top-level section** could save the rule against another section — usually the level above — and reopening the rule showed a third one, as though the choice hadn't committed. It had: the list was offering the wrong values behind the right names. On a sitemap whose sections all sit beneath a single top node, every entry in that list quietly carried the same value, the root's. Sections now identify themselves correctly, so the section you pick is the section that gets colored, and it still reads correctly when you reopen the rule.
- **Color by top-level section now has more than one section to offer.** On a sitemap built under a single root page, the entire tree counted as one section — so coloring by section colored everything alike, in the **Visual Sitemap** and the **Treemap** both. The sections beneath a lone root are now treated as the sections, which is what they look like on screen anyway.
- A color rule now reads the way you built it — *Top-level section is Admissions*, rather than the internal field name.

**If you already have a section color rule** in a sitemap with a single root page, it was matching the whole tree. It now matches just that root, so re-point it at the section you actually meant.

## [2.11.0] — "Please, Please, Please, Let Me Get What I Want"

### Added

- **Audience tagging at crawl scale.** Tagging audiences was affordable on a section and unaffordable on a site, and a column that stays 4% full makes every report built on it worthless. Two tools close that gap, and they are deliberately trusted differently.
  - **Project → Fill Audiences from Section…** spreads audiences you have *already* tagged in a section onto that section's untagged pages. It costs nothing, needs no API key, and invents nothing — it only propagates a decision you made yourself elsewhere in the same section. The dialog shows every section it can act on, what it would apply, the agreement behind it, and how many pages it would fill; untick any you disagree with. A section needs at least three tagged pages, with an audience appearing on half of them, before it may speak for the rest, and only blank cells are filled. The whole fill is one **Cmd+Z**. *— None (no target audience)* is never inherited: spreading "serves nobody" onto pages no one has looked at would turn an unreviewed blank into a Kill vote.
  - **Project → Suggest Audiences with AI…** reads each page's title, H1, meta description, URL and section against **your** audience library — so suggestions are specific to this client rather than generic — and proposes who it serves. **It never writes your `Audiences` column.** Suggestions land in a review queue grouped by answer, which is what makes them reviewable: a few thousand pages collapse into a few dozen distinct decisions, each shown with sample paths and a confidence reading. Accept a whole group at once, or take suggestions one at a time from the ghost that appears in the audit bar. Declining leaves the page blank — still unreviewed, which is the honest state. **Audience suggested by AI** is the worklist filter, and accepting is one **Cmd+Z**.
  - Pick the scope (everything untagged, or just the current filter, to pilot one section first) and the model — **Claude Opus 5**, **Sonnet 5**, or **Haiku 4.5**. Requests are batched twenty pages at a time and run three at once, so a crawl-sized run finishes in minutes rather than hours; **Esc** stops it with everything suggested so far kept. Billed to your own Claude API key.
  - The model is constrained to the audiences in your library — it cannot invent one — and returns nothing at all for a page whose metadata was too thin to judge, rather than guessing.

### Changed

- **AI assessment now runs on current Claude models.** The rubric assessment path was pinned to a model retired long ago; both it and the new audience suggestion run through one shared, up-to-date call path with proper error reporting (a rejected key or a declined request now says so instead of failing as a parse error).

## [2.10.0] — "How Soon Is Now?"

### Added

- **Jobs to be done — the other half of the discovery workshop.** Audiences answer *who* a page is for; jobs answer *what people came to do*. A per-project **Jobs** library (Project Settings → Audience) holds the JTBD output: a short label, the full statement in the workshop's own words, and which audiences have it (blank for a job anyone might have).
  - A **Jobs served** field appears in the Audience cluster once the library has entries — the picker puts jobs belonging to *this page's* audiences at the top, so you're choosing from a few rather than scrolling all of them. Bulk-tag with **Add Job**; **Needs a job** is the worklist filter.
  - **The payoff is the inverse question.** **Reports → Jobs Coverage** leads with the jobs *nothing on the site answers* — the strongest brief for net-new content available, because each line traces back to something the client said themselves rather than to an auditor's judgement. The same list is appended to the **Net New Content Brief**, which otherwise only finds gaps in the sitemap you drew.
  - Lives on its own visible **`Jobs`** sheet, so the workshop output stays an editable working document.
- **URL Variant Triage — a crawl is not a content inventory.** On a CMS-driven site much of a crawl is alternate views of the same page: pagination, sorting, faceted filters, tracking parameters. **Project → Triage URL Variants…** groups those by the page they point at and lets you dispose of them in bulk.
  - It reads the site's own **`rel=canonical`** rather than guessing from parameter names. Transmission always ingested that column and never used it; a declared canonical is authoritative where a rule about `?p=` versus `?page_id=` is a guess about someone else's CMS.
  - **Query-only variants** (same path, different query) become **Exclude** — the canonical's own redirect already covers them, so a rule each would bury the ones that matter. **Different-path variants** become **Consolidate** into the canonical, which writes the redirect for you.
  - Nothing is hidden. Every page keeps its row and gets a real, logged decision, and the whole triage reverses with a single **Cmd+Z**. Triage skips sites you've marked out of scope.
  - On a ~13,000-row crawl this took the undecided queue to ~6,500 and the **Duplicates** filter from ~9,000 rows to ~2,400.
  - Two new filters: **Alternate view of another page (canonical)** and **Canonical target not in this crawl**.

### Fixed

- **The Duplicates filter no longer counts content you've already dispositioned.** Pages marked Kill or Exclude are left out of duplicate detection, so the filter is a worklist of duplicate content still needing a decision rather than a list that includes everything already dealt with.
- **Triage is undoable.** Bulk triage actions now push a single undo entry covering every row they touched — one Cmd+Z, not one per page. Non-200 triage gained this too.
- **Out-of-scope sites no longer disappear quietly.** Marking a site out of scope narrows report totals, but nothing said so — a summary could read "1,888 pages" with 11,328 silently dropped. Every report and every exported PDF/HTML now carries a banner naming what was left out and how many pages it covers, and the **Source Pages** and **Archive** sheets are complete again (they carry a Source Site column to filter on instead). Un-ticking **In scope** now also offers to mark those pages **KKE = Exclude**, so the judgement lives on the row — visible in the audit, the change log, and every export — rather than only as a reporting setting. The audit workflow itself never hid anything: the sidebar and Table View always showed every row.
- **Section reports no longer break a translated site into language buckets.** On a multilingual site the reports grouped pages as *Es · De · It · Zh-Hans* — language rather than topic, with the same real sections repeated under each. Locale prefixes are now skipped, so the sections read *Product Lines*, *Events*, and so on. Detection is structural, not just pattern-matching: it needs three or more locale-shaped segments that share a section beneath them, so an intranet whose top sections are `/it/`, `/hr/` and `/pl/` is left alone.
- **Non-Latin URL slugs are readable again.** A section or auto-derived sitemap bucket taken from an encoded slug showed as `%E4%BA%A7%E5%93%81%E7%BA%BF` instead of `产品线`.
- **The Net New Content Brief no longer stalls on large sites.** It re-scanned every audit row once for every node beneath every net-new section, so cost grew with pages × sitemap nodes. On a 6,000-page crawl with a 6,000-node sitemap that worked out to roughly 24 seconds of scanning; it now indexes rows by sitemap node once and produces the same report in well under a tenth of a second.

### Added

- **Audience tagging — the audience prioritization workshop is now a real input to the audit.** Until now that ranking lived in a deck and never touched a row, so Keep/Kill/Evolve got argued on traffic and quality alone. A page can have respectable traffic, pass every rubric rule, and still serve nobody the client decided to invest in — that finding was previously unreachable.
  - Two new columns: **`Audiences`** (a chip input for every audience a page does real work for) and **`Primary_Audience`** (who it's mainly for — fills itself in when only one audience is tagged).
  - **Project → Audience Library…** holds the workshop output: each audience gets a **tier** (Primary / Secondary / Tertiary / Not a target), a color, and a description. Add them one at a time, **Paste from workshop…** to drop your table straight in, or **Seed starter list…** to begin from a generic **Higher education** or **General organization** set. It lives on its own visible **`Audiences`** sheet, so it stays an editable working document rather than a settings blob.
  - **A blank cell means *unreviewed*, not "serves nobody."** When a page genuinely serves no one you care about, tag it **— None (no target audience)** — that's the positive call, and the only one that argues Kill.
  - **Bulk tagging** via the Multi-bar (**Add Audience**, **Remove Audience**, **Set Primary Audience**) — filter to a section, select all, tag, move on. Two new sidebar filters give you the worklists: **Needs audience** and **Serves no priority audience**.
- **Audience joins GA and Rubric as a Suggested_KKE source.** Serving a **Primary** audience argues Keep; serving only Tertiary or off-target audiences argues Evolve; an explicit *— None* argues Kill. Untagged and Secondary-only pages abstain, so projects that haven't started tagging are completely unaffected. Weight it beside the others in Project Settings → Suggestions. The disagreements are the interesting part: *GA says Keep, Audience says Kill* is a popular page serving nobody strategic, and the reverse argues for promoting under-served priority content rather than removing it.
- **Three audience reports.** **Audience Coverage** (pages per audience in priority order, with disposition mix, top sections, and a flag on any Primary audience with almost nothing aimed at it), **Audience × Section Matrix** (sections down, audiences across, cells shaded by share — makes "this whole section is written for the wrong people" visible at a glance), and **Audience Debt** (off-strategy content · priority-audience pages marked Kill · pages serving four or more audiences).
- **Source sites are now a real dimension, for audits merging several sites into one.** Open a crawl and Transmission builds a **Sites** registry — one entry per domain, with `www.`/non-`www.` folded together. Manage them in **Project Settings → Sites**: merge the hosts that are really one site (each shows its page count), record CMS and owner, and un-tick **In scope** for a property that isn't part of this phase.
  - Every row gains a **`Source_Site`** value, so you can filter, sort, color the Visual Sitemap, and export by it.
  - **Out-of-scope sites drop out of every report denominator** — nothing is deleted, but completion percentages stop counting content nobody is migrating.
  - **Redirect maps split per domain**, because each retiring domain deploys its own redirect configuration: one sheet per domain in the Migration Tracker, and one CSV per domain from the Redirect Map export.
  - Two new reports — **Site Consolidation Overview** (what each site contributes: pages, disposition, audiences served, cross-site overlap, redirect rules required) and **Cross-Site Duplicate Overlap** (pages whose title, H1 and meta description appear on more than one site — the merge worklist), plus a **Duplicated on another source site** sidebar filter.
  - Transmission warns when several sites are in scope but no **Site Domain** is set, since redirect destinations would otherwise be built on whichever domain happened to come first in the crawl.
- **Consolidation-aware section grouping.** When an audit spans several source sites — `www.company.com`, `home.anothercompany.com`, `thirdcompany.com` — the audience reports group unplaced pages as *domain › section* rather than merging two sites' `/about` pages into one row. `www.`/non-`www.` is treated as one site, and each site's own shared path prefix (a crawl rooted at `/acad/` or `/en/`) is stripped independently, so real sections surface on every site in the set.
- **Color the Visual Sitemap and Treemap by Primary Audience**, using each audience's own color. Audience columns also flow into the Migration Tracker's Source Pages sheet and the SME export — SMEs are frequently the only people who know who actually reads a page.

## [2.9.9] — "How Soon Is Now?"

### Changed

- **The synthetic "site root" box in the Visual Sitemap is now off by default.** Sitemaps show your own top-level nodes as the roots, with no extra wrapper box above them. Turn it back on per project in Project Settings → Identity ("Show a site root box in the Visual Sitemap") — and that choice now sticks. Note this affects existing projects: any that relied on the old default will no longer show the wrapper box until you re-enable it.
- **Turning off Page counts now gives a fully label-only Miro export.** Previously the "N pages" tallies were dropped but collapsed sections kept a "+N" marker; now both are suppressed, so each exported card shows just the node's text. (Turn off **Page counts** in the sitemap toolbar before exporting.)

### Fixed

- **The "Show a site root box" setting is now preserved for .xlsx projects.** Unchecking it and reopening the spreadsheet silently reverted it — boolean project settings weren't surviving the spreadsheet round-trip (a stored "off" read back as the text "FALSE" and was ignored). Booleans now round-trip correctly. (.transmission projects were already fine.)

## [2.9.8] — "How Soon Is Now?"

### Changed

- **The Visual Sitemap's Page counts toggle now applies to the Miro export.** Turning **Page counts** off and exporting to Miro produces label-only cards, matching the in-app view and the HTML/PDF exports. Collapsed sections still carry their "+N hidden" marker — on a static board that's the only cue that content is folded beneath a card.

## [2.9.7] — "How Soon Is Now?"

### Added

- **Hide page counts in the Visual Sitemap.** A new **Page counts** toggle in the sitemap toolbar (next to **Numbers**) hides the per-card "N pages" tally so you can read the tree by its labels alone. The choice is remembered per project and rides along into the interactive HTML and PDF exports.

## [2.9.6] — "How Soon Is Now?"

The Miro sitemap export becomes usable against a real work account — where a
login can see thousands of boards — and you can now control how the exported
board looks.

### Added

- **Find any Miro board, however many you have.** Exporting to Miro used to offer a fixed list of your 50 most-recent boards, which is unusable on a work account with thousands. The export dialog now **searches your boards by name** (the search runs on Miro's side, so it reaches every board, not just a recent handful), lets you **paste a board link or ID** to land on one exact board, and — once you've exported a project — offers a one-click **"Export again to _that board_"**. That last one is remembered by the board's Miro **ID**, not its name, so it still finds the board after you rename it (a board created "Untitled" and named later resolves to its real name).
- **Control the look of the exported board.** A new **Appearance** section in the export dialog sets the **connector style** (right-angle, curved, or straight), the **card corners** (rounded or square), the **border thickness**, and whether to include a **color key** — a legend, built from your color rules, that tells a client what each color means. Every choice is remembered per project.
- **Including collapsed sections is now opt-in.** The "Include them" option defaults off, so collapsed sections export as a compact stacked block unless you ask for the whole tree.

### Fixed

- **The Miro export no longer fails with "invalid parameters" on long page names.** An attempt to shrink long labels to fit the card sent Miro a font size below its minimum, which it rejects outright — so any sitemap with a long page title failed to export entirely. Labels are kept in full at a readable size and Miro fits them to the card.
- **Connectors route around the cards, not through them.** In a vertical column, connector lines now run down the gutter beside the stack (matching the app's own sitemap) instead of straight through the boxes between a parent and its lower children.
- **Card borders export at a visible weight.** A fractional border width rendered hair-thin on the board and left Miro's own thickness slider without a handle; it's now a clean whole number.

### Changed

- **The export dialog's controls are tidier.** The Appearance dropdowns sit in an aligned grid and are styled to match the rest of the app in both light and dark themes.
- **The Visual Sitemap toolbar wraps instead of scrolling.** On a narrow window it flows its controls onto a second row rather than hiding the export buttons off the right edge.
- **Removed the redundant "Back to Audit" buttons** from the Table, Sitemap, Redirects, and Menus views — the always-visible view switcher's Audit tab already does this.

## [2.8.2] — "How Soon Is Now?"

Three Visual Sitemap interaction fixes.

### Fixed
- **Collapsing a branch is now the +/− button only.** Collapse/expand was bound to the whole card, so an errant click while reaching for right-click → **Set color** would hide the entire subtree you were trying to colour. Only the +/− toggles now; the card body does nothing. The +/− is a little larger with its own hover state.
- **The node colour picker no longer closes the moment you drag a slider.** Right-click → **Set color** opens the OS colour panel; adjusting it used to tear the menu (and the panel with it) down on the first change. It now previews live, stays open while you fine-tune, and commits when you dismiss the panel.
- **The Legend panel no longer renders behind the sitemap** (issue #9). The toolbar scrolls horizontally on narrow windows, which was silently clipping the dropdown where it hangs below the toolbar — so its lower half was cut away and the canvas showed through. The panel now floats above the canvas, anchored under the Legend button.

## [2.8.1] — "How Soon Is Now?"

A packaging fix for 2.8.0.

### Fixed
- **2.8.0 crashed on launch** with "Cannot find module './miro'." The packaged build's file allowlist named each top-level source file individually, and the new `miro.js` module (added for the Miro export) wasn't on the list, so it was left out of the app bundle — the app ran correctly in development, where files load straight from disk, but not once packaged. The allowlist now includes every top-level module, so this class of omission can't recur. No behaviour changes; if 2.8.0 launched for you, nothing else is different.

## [2.8.0] — "How Soon Is Now?"

The Visual Sitemap can now be pushed to a Miro board as real, editable shapes, and
the colour rules behind it were rebuilt to encode anything in your audit.

### Added
- **Export the Visual Sitemap to Miro.** The sitemap toolbar gains **Export to Miro** alongside Export HTML and Export PDF. It creates a frame, one Miro shape per page positioned exactly where it sits in the app, and a connector for every parent→child link — carrying the colours and line styles from your colour rules. These are real Miro items, not a flat picture, so a client can move them around in a workshop. About 400 pages plus 400 connectors takes roughly a minute, with a progress bar and a Cancel button; Miro's own rate limits are the floor there, not the export.
- **One-click Miro connection.** App Settings → Miro → **Connect to Miro** opens your browser, you authorise Transmission and choose which Miro team to connect, and you're done. The token is stored encrypted in the OS keychain — deliberately not in the ordinary preferences file — and is never readable by the app's interface layer. An **Advanced** option remains for anyone who would rather paste a token from their own Miro app, which also covers the case where the connection service is unreachable.
- **Colour rules can read anything in the audit.** Sitemap cards can be coloured by 15 dimensions: seven from the sitemap node (Phase, Node Type, Page Status, Build Pattern, Builder, Writer, Migrator) and eight from the spreadsheet (Content Type, KKE, Final KKE, Renders as, Migration Track, Content Theme, Published Status, Target Content Type). Spreadsheet dimensions only appear when that column exists, and the picker shows how many nodes actually carry a value for each — so an empty dimension is visible as empty rather than silently producing a one-colour scheme.
- **Rules that ask "does this section contain…".** A sitemap node usually holds several pages, so a rule can test either the node's dominant value ("mostly Articles") or, with the new **any page is** operator, whether *any* page beneath it matches — which is how you flag a section containing a single Kill inside an otherwise Keep branch.
- **Rules compose.** Each visual property is taken from the first matching rule that actually sets it, so colour can come from one rule and line style from another. Encoding two dimensions at once no longer needs a rule for every combination.
- **Heavy-outline card style**, the convention most sitemap decks use — white card, thick coloured border — as an alternative to the colour band. Switching converts existing rules in place and keeps their colours.
- **Line style per rule** (solid, dashed, dotted), plus **corner radius** and **inner padding** in the Layout tab.
- **Collapsed sections are surfaced, not silently dropped.** Exporting with sections collapsed used to omit those pages without saying so. The export dialog now reports how many pages are hidden and offers to include them (on by default); sections left collapsed export as a stacked block labelled with either the hidden page count or a "+".

### Fixed
- **Long page names no longer spill outside their card in the Visual Sitemap.** Cards had no overflow boundary, so a name too tall for the box escaped it instead of clipping. Names now clip cleanly, the full name is available on hover, and the default card height fits a two-line name alongside the number and page count.

### Changed
- The nav sitemap now defaults to colouring **by depth**. Colouring by top-level section keys on the tree's top-level children, so a site whose pages all hang off a single root node came out effectively one colour. Depth always has something to say. Either can be chosen in Settings → Colors.

## [2.7.2] — "How Soon Is Now?"

Two Sitemap-editor undo/redo correctness fixes.

### Fixed
- **Undoing a Sitemap-node deletion now fully restores the rest of the tree.** Deleting a node renumbers the nodes that come after it; undoing brought the deleted node back but left the pages assigned to those renumbered nodes showing stale sort positions, paths, and breadcrumbs. Undo now re-syncs every affected page, so it's a true round-trip.
- **Redoing a node deletion now repeats what the delete actually did with its pages.** If you deleted a node and sent its pages to the parent (or to another node), then undid, redoing had *cleared* those pages instead of re-sending them. Redo now reapplies the original choice — and safely falls back to clearing only if the chosen destination no longer exists.

## [2.7.1] — "How Soon Is Now?"

A small follow-up to 2.7.0 with three Sitemap-editor fixes.

### Fixed
- **The bulk-delete confirmation now reports the real number of nodes it will remove.** It had counted only the top-level branches in your selection, so deleting a whole nested selection could say "Delete 20 nodes" while ~1,500 actually disappeared. The count now includes the selected branches and everything beneath them (with a note explaining the difference), matching the page count shown beside it.
- **The "select all" checkbox in the Sitemap editor no longer stays checked after the selection is cleared** — for example, right after a bulk delete has emptied it.

### Changed
- **"Delete selected" is much faster on large sitemaps.** It used to recompute the entire tree and re-cascade to every row once *per deleted node*; it now does that once for the whole batch. On a ~580-node / 4,000-row sitemap, deleting 200 nodes dropped from about 1.9 s to ~70 ms, with byte-identical results.

## [2.7.0] — "How Soon Is Now?"

A correctness, performance, and polish release from a codebase-wide review sweep — two dozen fixes across the reports, exports, audit bar, and sitemap tools, plus one restored feature. Every change was verified in the running app.

### Added
- **The redirect indicator is back in the audit bar.** When the selected page has a redirect destination, a small amber badge in the **Decide** cluster shows where it points (`↪ /new-path`, full URL on hover) — click it to open that page in the Redirect Editor, or the **×** to clear the destination. An intentional `404` shows as a `404` badge. This per-page affordance had been lost when the Redirects button moved to the view switcher; the sidebar's **R** dot only told you *that* a page redirected, not where.

### Fixed
- **Reports no longer drop "rogue" KKE values.** A page whose KKE is a typo, or a custom state that was later removed, was silently omitted from the Progress dashboard's reviewed count and from the Content Inventory report's per-section tallies — so a section's bar could visibly under-total against its own page count, and the dashboard could disagree with the sidebar's own reviewed percentage. Both now count every decision under its own label.
- **Client-facing exports no longer leak internal columns.** The **Client Export** and **Filtered Rows** exports were including `_`-prefixed engine columns — the internal consolidation-target ID, raw AI-assessment output — in spreadsheets meant for clients. They now exclude them, matching every other surface.
- **Three report PDFs render correctly again.** Pre-Handoff Check, Migration Direction Brief, and Sitemap Coverage referenced design tokens that were undefined in the exported document, so accent bars and borders vanished and tinted callouts went transparent. The exported HTML/PDF — and the dark-mode in-app preview, which was painting a near-black panel onto white "paper" — now style correctly.
- **The menu export includes menus that have no items.** A menu you'd named and placed but not yet filled in was silently dropped from the xlsx export, while the JSON export of the same project still listed it.
- **The Migration Direction Brief's page URLs are well-formed.** They were being built with no separator between domain and path (`https://example.comabout/team`) and with no domain at all when Site Domain was blank. The reports now share one correct computed-path → URL rule, so the brief agrees with the Migration Tracker.
- **Bulk-setting Kill offers the same cleanup as every other Kill path.** Killing a batch of pages from the Multi-bar now prompts to clear their sitemap assignments and redirect destinations, matching the single-row KKE button, Final KKE, and Table View inline edits. It had been silently skipping that cleanup.
- **Clearing a sitemap assignment from the audit bar is now recorded.** The Sitemap popover's Clear button was the one un-assignment path that didn't write to the client-facing change log.
- **A damaged project file no longer locks you out entirely.** One unreadable row used to fail the whole `.transmission` project open with a raw parser error; the project now opens with the affected row flagged and its original data preserved.
- **Deleting every entry from a structural library now sticks.** Emptying the Content Type Registry, Target Spec Library, Component Library, or Glossary and saving to xlsx used to silently restore the entries on reopen.
- **`Esc` cancels a batch AI assessment.** The cancel check was present but nothing was wired to trigger it, so a long run (about a second per page) couldn't be stopped short of quitting.
- **The saved app version is correct in packaged builds.** Projects were stamping a blank version into their metadata; they now record the real app version.
- **Component chips are legible in dark mode.** They were rendering with hardcoded light colors regardless of theme.
- **The SME split-by-owner export matches the single-file export.** Both now share one builder, so they can't drift — the multi-file copy had picked up terser validation messages.
- **Smaller fixes:** a no-match filter no longer strands a giant empty scroll region under the "no rows" message; canceling a progress-report PDF export no longer shows a spurious "failed" error, and that export window no longer leaks on a failed render.

### Changed
- **Noticeably faster on large crawls.** Several operations that scaled poorly were re-worked and measured at the app's ~4,000-row / ~500-node design target:
  - Bulk **Assign to Sitemap** no longer freezes for several seconds while computing suggested destinations — on 1,000 unplaced pages, roughly seven seconds down to a few milliseconds. This was worst exactly when the sitemap was still empty, which is when you'd use it.
  - Typing in the **sidebar search** and the **Redirect Editor search** is debounced, so a keystroke no longer re-scans every row / rebuilds the whole list.
  - Renaming a **sitemap node** cascades to its assigned pages far faster (about 32 ms down to 5 ms per keystroke).
  - Resolving a **consolidation group** rebuilds the sitemap tree once instead of once per page in the group.

## [2.6.4] — "How Soon Is Now?"

### Added
- **KKE gate + placement modes for bulk sitemap assignment.** The sidebar's "Assign to Sitemap" bulk action now defaults to Keep/Evolve pages only (mirroring Create Sitemap from Audit), with an "include Kill/Exclude/unreviewed pages too" opt-in for building a full current-state snapshot — plus one batched confirmation before sweeping in Consolidate pages, since those merge into another page's URL rather than getting their own. A new placement choice lets you preserve each page's URL structure as nested sections instead of always flattening into direct children.
- **Bulk multi-select and delete in the Sitemap editor, with undo.** Every tree row now has a checkbox (plain click, shift-click range-select, select-all, and a new "Select Empty Branches" shortcut for finding dead sections after later killing/consolidating pages). Bulk delete covers the whole selection in one confirmation, and — like every other sitemap edit — a single Cmd+Z reverses the entire batch. Single-node delete (the tree row's ✕, the node editor's own Delete button, and the "clear assignment + delete now-empty node" flow) is now undoable too, having been folded into the same shared delete path.

### Fixed
- **Filter state could leak between files on open.** The "Unclassified" toolbar button, the KKE filter, and the group filter could all inherit stale state from whichever file was previously open, occasionally leaving a filter showing "active" with nothing actually filtered.
- **Sidebar page thumbnails could silently never appear.** The hover-preview cache was keyed by the webview's resolved URL after a page finished loading, but looked up by the row's declared crawl Address — any redirect, trailing-slash normalization, or protocol upgrade (common in Screaming Frog exports) meant the thumbnail was cached under a key the lookup never checked.
- **The Glossary editor could silently discard unsaved changes.** Cancel, the × button, a backdrop click, and Esc all dismissed the editor immediately with no warning. All four now prompt to discard if there are unsaved edits.
- **Extra KKE-type sidebar columns (Final KKE, SME Decision, etc.) lost their color coding for Consolidate or any custom KKE state**, falling back to plain text instead of a colored badge.
- **Recomputing computed columns while a row was selected could crash the app** the next time you typed into any field bar input, due to a wrong-arguments bug in the field-bar refresh.
- **Deleting an entry in the Component Library or Target Spec Library could silently clobber the entry that shifted into its place**, overwriting it with the deleted entry's stale, unsaved form values.
- **Project Settings' Saved Filters "Apply" button applied the wrong row set (or silently did nothing)** due to a stale duplicate of the sidebar's own restore logic pointing at a DOM element that no longer exists. Both now share one implementation.
- **Cmd+F search only "temporarily" cleared filters in name** — it never restored them afterward, and never accounted for field filters at all, so a match hidden only by a field filter still wasn't reachable via arrow-key/j-k navigation. Both gaps are fixed.
- **A selected row could lose its purple selection fill once it also had a KKE color**, and **toasts could render invisibly behind an open modal dialog** — two CSS specificity/z-index bugs, both fixed.
- **A typo'd or renamed `{Column}` reference in a computed-column formula silently computed as 0** instead of raising an error, which could mislabel an entire inventory with no warning. It's now a formula error.
- **A Kill page's redirect destination could get stuck on the project default** even after the page was later given a proper sitemap home — it now upgrades to the more specific nav path, the same way Consolidate targets already did.
- **Four reports (Pre-Handoff Check, Net New Content Brief, Migration Checklist, Sitemap Coverage) could disagree with the Sitemap editor's own page counts**, since each built its own inline count that didn't exclude Kill/Consolidate pages the way the canonical count does.
- **Project settings too large to fit in an xlsx cell (a heavy Menus model, for example) were silently dropped on save**, logged only to the developer console. Now surfaced as a toast naming what was dropped.
- **Exporting a project whose sitemap had a single very long note, build-guidance, or writer-brief field could abort the entire workbook export** with a raw spreadsheet-library error, taking every other node's data down with it. That field is now clamped like its counterparts already were.
- **A Treemap section squeezed into a small sliver of canvas (crowded next to a much larger sibling) could render as blank grey** instead of its actual KKE-composition color, even though the underlying data was there.
- **Dragging a sitemap node to reorganize it could occasionally duplicate it** (the same node appearing in two places in the tree, sharing one ID) when its internal parent pointer had drifted out of sync — a stale-lookup bug also fixed in node delete and clone, which could silently no-op a delete (while still showing a success toast) or misplace a clone.
- **Editing a nav node's slug could wipe visual indicators (URL-override, breadcrumb-override, depth-warning markers) from descendant rows** in the sitemap tree, even though the underlying data was untouched.
- **Cloning a sitemap branch dropped every field beyond a small hardcoded set** — phase, notes, external URL, and all Build/Write/Migrate metadata vanished from the copy with no warning.
- **Undoing a KKE decision didn't record the reversal in the audit trail**, so the exported change log could permanently disagree with the actual data after a Cmd+Z.

## [2.6.3] — "How Soon Is Now?"

### Fixed
- **Redirect destinations could disagree between the Redirect Editor and the exported CSV.** Redirect resolution was implemented three separate times and had drifted: the editor's live preview did a one-hop lookup instead of following full Consolidate chains and didn't carry through the `404` sentinel, and the CSV export had no Consolidate handling at all (silently dropping consolidation redirects) while shipping literal `404,301` rows for intentional deindexes. All three now share one resolver, and SME-resolved Kill/Consolidate decisions (`Final_KKE`) are correctly picked up everywhere a redirect is derived.
- **Batch AI/rubric assessment silently overwrote human KKE decisions with no audit trail or undo.** Running a batch Assess now only writes to the AI's own suggestion field, matching how the equivalent "AI Suggest for Unreviewed" already behaved — your own KKE calls are never silently replaced. The per-row "Accept suggestion" button also now logs the change and supports Undo like every other KKE edit.
- **Sitemap rename/move changelog entries were attributed to the wrong page.** Renaming or moving a sitemap node cascades a redirect-destination update to every assigned page; the resulting changelog entries could log the wrong row number against the wrong URL. They now attribute correctly.
- **Exporting a project to xlsx and reopening it lost who-made-which-change.** The auditor name on each change-log entry wasn't carried through an Export Full Workbook → reopen round trip. It now survives.
- **A few dialogs could misbehave with the keyboard.** Pressing Enter while focused on a dialog's Cancel button (or an auto-focused checkbox) could fire the primary action instead — including destructive Kill-cleanup confirmations. Escape on the sitemap node picker could close the wrong (parent) dialog. Canceling the "Clear sitemap assignment?" prompt could leave a stale keyboard shortcut active that later silently re-fired against the wrong row. All three are fixed.
- **Pasted text with curly quotes, dashes, ellipses, or bullets could come out worse than before.** The mojibake-repair step in the text sanitizer had its most common patterns in the wrong order, so it actively corrupted exactly the sequences it exists to fix. Repairs correctly now.
- **A new sitemap node created from the audit bar's "+ Child" form could vanish after a save.** In `.transmission` projects, the new node wasn't always included in what got written to disk, leaving the page assigned to it pointing at a node that no longer existed on reopen.
- **Consolidate now gets its own color in the Progress dashboard and exported Audit Progress PDF.** It previously rendered as plain dark text, indistinguishable from body copy, while every other decision had a color.
- **Zeroing out a Suggested_KKE source's weight (to disable it) didn't actually disable it.** A weight of exactly 0 was silently treated as the default weight instead — so a disabled source could still win a tied disagreement.
- **A sitemap section that's also itself a page could disappear from the Treemap.** A node that's both a container (has sub-pages) and directly assigned its own page — the normal shape for a section landing page — now gets its own visible box for its own page(s), instead of that page's share of the section being silently absorbed into its children's boxes.

### Changed
- **Faster autosave on large `.transmission` projects.** Autosave now only rewrites rows that actually changed instead of the entire table on every save — most noticeable on multi-thousand-row projects, where a single-cell edit no longer re-writes the whole inventory.

## [2.6.2] — "How Soon Is Now?"

### Added
- **Suggested destination in bulk sitemap assignment.** The Multi-bar's
  Assign to Sitemap… dialog now offers a one-click **Suggested** node when
  some of the selected pages already have a sibling page placed on the
  sitemap (e.g. `/about` is already assigned while you're placing
  `/about/leadership`) — the same auto-suggestion the single-page Sitemap
  picker uses, extended to the whole batch, with a count of how many pages
  agree.

## [2.6.1] — "How Soon Is Now?"

### Fixed
- **Sidebar row list could get stuck truncated after using a full-width
  view.** The virtual-scrolled row list sizes itself off the sidebar
  container's height, which is zero while the Sitemap, Table, Redirects, or
  Menus view is hiding it. Anything that mutated row data and re-rendered
  during that window — bulk sitemap assignment, Create Sitemap from Audit,
  promoting a hub node from the node editor — painted a truncated list that
  stuck around after returning to the Audit view, until an unrelated filter
  change happened to force a fresh render. The row list now skips painting
  while hidden and always repaints fresh the moment the Audit view is shown
  again.

## [2.6.0] — "How Soon Is Now?"

### Added
- **"External link" Visual Sitemap color rule.** A new color-rule condition
  matches nodes that point off-site (a nav node with an external URL, or a
  `Link`-kind menu item) so they can be colored distinctly from ordinary
  pages regardless of section or depth. A one-click **"Mark external links"**
  button in the Colors tab adds it at the top of the rule list; it's also
  selectable manually via **+ Add rule**.
- **"Color by field" Visual Sitemap color rule.** Color the sitemap by
  **Phase**, **Node Type**, **Page Status**, **Build Pattern**, or any of the
  three **assignee** roles — pick a field in the Colors tab and click
  **Color by field** for one rule per value actually in use (including a
  bucket for "not set," so gaps are visible at a glance). Page Status reuses
  the same colors you've already assigned it in Project Settings, so the
  sitemap and the rest of the app agree on what each status looks like.
- **Treemap.** A new squarified-treemap view of the content inventory
  (Sitemap toolbar → **Treemap**, next to Visual Sitemap) — boxes sized by
  page count, colored by KKE decision, top-level section, or (at full depth)
  any tracked build field. Pick **Depth** and **Color by** in a small dialog
  and Generate; pan/zoom/Fit, a legend, and Export HTML/PDF match the Visual
  Sitemap. Hand-rolled, no charting library added.
- **Add and clone menu items directly under another item.** Every menu item
  row now has its own **+** (add a Page/Link/Header as that item's child,
  no more adding at the bottom and dragging it into place) and **⧉**
  (duplicate the item and its whole subtree as a sibling, ready to edit into
  a variant elsewhere in the menu).
- **Bulk sitemap assignment.** Select or filter a batch of pages (e.g. the
  "Needs sitemap placement" filter), then **Assign to Sitemap…** in the
  bulk-action bar to place all of them at once — pick an existing sitemap
  node or create a new bucket (top-level or nested) as the destination. Each
  page becomes its own child node, with slug and label auto-derived from its
  URL and title; pages already on the sitemap are skipped. Built for getting
  dozens or hundreds of pages placed fast, then reorganizing with the
  Sitemap editor's existing drag-and-drop.
- **Create Sitemap from Audit.** A new **Project → Create Sitemap from
  Audit…** tool auto-generates a whole starter tree from the crawl's own
  URLs in one pass — pick how many URL segments become nested sections
  (bucket depth) and whether to include Kill/Exclude/unreviewed pages, then
  Generate. `/about/leadership` becomes **About → Leadership** on its own.
  Safe to run on a file that already has a sitemap, or run again later — it
  only merges into matching section names, never replaces or deletes.
- **Hub node → content page.** A net-new ("NEW") sitemap node's editor now
  shows an amber banner explaining the gap, with a **Create Page** button
  that promotes it into a real spreadsheet row — a new Keep page, tagged
  `net-new`, assigned to the node — so it flows through the rest of the
  audit and migration tracker like any other page. The banner also points
  at the Build section's Page Status field for tracking "Not Started" →
  "In Progress" before it's promoted.

### Changed
- The Menus view's item toolbar (**+ Page / + Link / + Header / Duplicate
  menu / Delete menu**) now stays pinned to the top of the panel while
  scrolling a long menu.

### Fixed
- **SME Review workflow only recognized the exact `Change: X` format.** A
  bare status value with no prefix (e.g. an SME just typing `Kill` instead of
  `Change: Kill`) was silently invisible everywhere — the conflict filter,
  the resolve dialog, the progress dashboard, and the SME Review Status
  report all missed it. It's now recognized the same as an explicit
  `Change:`, and the override value is never required to match one of the
  project's currently-configured KKE states — an SME's own wording (typo,
  custom term, whatever) carries through into `Final_KKE` rather than being
  dropped. The two "pick a value" dropdowns involved (the resolve dialog's
  Final KKE select, and Table View's inline SME_Decision/Final_KKE editor)
  now keep an out-of-vocabulary value visible and pre-selected instead of
  silently losing it.
- **Client reports were nearly unreadable in dark mode.** Executive Summary,
  Content Inventory, Menu Report, and the other client-facing reports are
  built with colors hardcoded for a white background (the same markup doubles
  as the exported HTML/PDF, which always renders on white). The live in-app
  preview now forces that same white surface instead of inheriting the app's
  dark panel background, which had made near-black report text nearly
  invisible.
- **Per-menu Sitemap diagram could render items detached from their menu.**
  Menu item ids are only unique within their own menu, but the diagram merges
  every menu into one shared engine instance that indexed node positions by
  id globally — two different menus reusing the same local item id (routine
  and expected) could silently overwrite each other's computed position,
  making one item appear to float unattached. Node ids in this diagram are
  now namespaced per menu.

## [2.5.3] — "How Soon Is Now?"

### Added
- **Duplicate Consolidate-destination guard.** Setting a page to Keep/Evolve
  when another page already targets the same Sitemap node now offers to
  Consolidate it into that page instead — catching the mistake the moment it
  happens, as a proactive complement to the bulk Consolidation Candidates
  workflow.
- **Check for Updates.** Transmission checks for a newer version at startup
  and via **Help → Check for Updates…**, with a "What's New" changelog viewer
  and a link to download the latest release.
- **Duplicate menu.** Clone a menu — name, placement, description, and its
  full item tree — as a starting point for an alternate variant (e.g.
  testing a different mega-menu structure) without touching the original.
  The copy is selected immediately and pre-picked in the Export dialog's
  "just this menu" scope.

### Changed
- **Nav → Sitemap rename finished** across the UI, exports, and docs — the
  remaining `Nav_*` audit/export columns are renamed to `Sitemap_*` for
  clients (e.g. `Sitemap_Destination`, `Sitemap_ID`, `Sitemap_SortID`).

## [2.5.2] — "How Soon Is Now?"

### Added
- **Visual Sitemap site-root toggle** — a "Show a site root box in the Visual
  Sitemap" setting (Project Settings → Identity) suppresses the synthetic
  site-root box; when off, the sitemap's own top-level node(s) become the
  root(s) instead, so single- and multi-section sites both lay out cleanly.

## [2.5.1] — "How Soon Is Now?"

### Added
- **`Page_Breadcrumb` audit column** — the derived on-page breadcrumb for a
  row's assigned sitemap node, honoring the breadcrumb-parent override axis
  and the Home-label prefix. Distinct from `Sitemap_Destination` (the
  physical IA label chain). Read-only; shown in Table View by default.

## [2.5.0] — "How Soon Is Now?"

A "content cockpit" release: the Visual Sitemap is rewritten from the ground
up as a self-contained engine, consolidation gets a sturdier data model, and
the audit bar gains direct sitemap assignment and dark mode.

### Added
- **Visual Sitemap rewritten as a self-contained engine.** The
  D3-in-a-hidden-window renderer is retired; one portable engine
  (`src/sitemap-template.js`) now powers the in-app view (via an Electron
  `<webview>`), the client-shareable HTML export, and the print/PDF export.
  Threshold-based per-node horizontal/vertical layout, a color-rule engine,
  and a Settings panel (Layout / Colors / Legend) replace the old renderer.
  The `d3` and `mermaid` dependencies are fully removed.
- **Two-column Consolidate target model** — the consolidation target is now
  stored as a stable page identity (`_ConsolidateTargetId`) plus a derived,
  always-fresh relative-path display (`Consolidate_Into`), so the link
  survives the target page later being placed in the nav tree or gaining a
  URL override.
- Offer to remove an orphaned nav node when its last assigned page is Killed
  or Consolidated away.
- **Dark mode** for the app chrome.

### Changed
- The Sitemap is reframed as **content organization**, decoupled from URL and
  breadcrumb; pages can now be assigned to a sitemap node directly from the
  audit bar.

## [2.4.1] — "How Soon Is Now?"

### Changed
- **The nav "IA Report" became the Menu Report.** The polished section-card +
  tree report is now fed by the independent **menus** rather than `inMenu`-filtered
  nav nodes — reached via **Menus → Report** and **Reports → Menu Report…** (the
  old nav-editor IA-Report button was removed). One card per menu with its item
  hierarchy, page-count badges on page references, `↗` on external links, `≡` on
  headers, and a red **missing** badge on broken references. PDF / HTML export.
  This retires the lingering `inMenu`-vs-report question.

## [2.4.0] — "How Soon Is Now?"

A visualization-focused release: the sitemaps gain layouts, palettes, and
collapse, and the Nav Tree sitemap is reframed as the content-IA "Visual Sitemap."

### Added
- **Sitemap layouts** (both sitemaps) — **Outline**, **Top-down tree**, and
  **Mega columns** (sections fan into side-by-side columns, items stacked beneath).
- **Color by + Palette** — color the IA sitemap by **Section / Build pattern /
  Page status / KKE** (menus by **Item kind / Section**), in a **Meaningful**,
  **Client brand**, or **Mono** palette. A client-brand palette editor lives in
  **Project Settings → Identity** and is shared across both sitemaps.
- **Collapse + Levels** — a per-node **Collapse** flag summarizes a subtree as a
  single box with a "has more underneath" stack, and a **Levels** selector caps
  the visible depth — built for large (1000+ node) trees.
- **Seed from content tree** (Menus) reworked into a pick-a-branch + depth dialog.

### Changed
- The **Nav Tree → Sitemap** is now the **Visual Sitemap** of the content IA:
  retitled, the "Menu items only" toggle removed, and the border now encodes
  build phase (solid = current build, dashed = phased).
- The legacy per-node **In-menu** controls (checkbox, Set/Clear Menu, node-editor
  toggle) are **repurposed to Collapse**. `inMenu` data still round-trips.

### Fixed
- Per-menu sitemap rendered every card with the last menu's tree (concurrent
  renders clobbered a shared temp file) — temp files are now unique per call.

## [2.3.0] — "How Soon Is Now?"

Decouples the navigation tree's four overloaded jobs into independent axes and
builds out an independent menu subsystem.

### Added
- **URL override** (`Url_Path`) — a nav node can publish at an address independent
  of its place in the menu; the override re-roots its sub-pages too. Containment and
  URL become separate axes.
- **Breadcrumb axis** (`Breadcrumb_Parent`) — set an arbitrary on-page breadcrumb top
  independent of both the tree and the URL: mark a node a breadcrumb root or re-root
  it onto any node; sub-pages inherit. Optional project "Home" prefix + advisory
  max-depth (Project Settings → Identity). The rendered page breadcrumb is exported
  in the Migration Tracker Nav Plan, the Nav Tree column-picker export, and the menu
  export.
- **Menus** — a new full-panel view (Cmd+Shift+M) for building independent navigation
  structures that reference content pages: multiple arbitrary menus (drag to reorder),
  three item kinds (page / link / header, switchable in place), drag-and-drop nesting,
  per-menu placement (controlled vocab) + description, and seed-from-content-tree.
- **CMS-agnostic menu export** — a neutral structured deliverable (Excel `Menus` sheet
  or nested JSON) any CMS import maps from; page refs resolve to target URLs.
- **Menu broken-reference check** — flags menu items pointing at deleted pages, with
  re-pick / remove.
- **Per-menu sitemap** — each menu rendered as a box-tree (items colored by kind), with
  zoom/pan and per-menu SVG download.

### Changed
- **Nav node editor** reorganized into labeled, color-pilled sections (Context /
  Identity / Addressing & breadcrumb / Notes / Build / Write / Migrate) for scannability.
- **Unified drag-and-drop** — the nav tree and menu item tree now share one engine and
  one clean indicator style.

### Removed
- The vestigial sidebar-row → nav-node drag-assign (unreachable since the Nav Tree view
  hides the sidebar). Assign pages via the audit-bar **Nav** button.

## [2.2.0] — "How Soon Is Now?"

### Changed
- **Renamed** the product from "KKE Audit Tool" to **Transmission** (a Joy Division
  song; version codenames remain Smiths titles). The **KKE** methodology and all
  `KKE_*` columns/sheets are unchanged, so existing files stay compatible. App ID is
  now `io.github.factus10.transmission`; a one-time migration carries old prefs to the new
  user-data folder.
- **Content Type ↔ Registry sync.** The Content Type Registry editor now surfaces
  in-use content types that lack a crosswalk (split-aware), with a "Show all
  pick-list types" toggle; adding a type from the audit-bar dropdown seeds a registry
  stub. Untouched stubs aren't persisted.
- **Documentation re-architecture.** `USER_GUIDE.md` rebuilt as a friendly,
  lifecycle-spined manual; a set of terse `walkthroughs/` added as standalone
  checklists; `help.html` restructured to match. All docs moved under `docs/`.

### Added
- **Report template engine** (Markdown + Mustache) for the Migration Direction Brief.
- **Migration Direction Brief** report covering three roles — Writer, Builder, and
  **Migrator** — grouped by target spec.
- **Pre-Handoff Check**, **Content Type Crosswalk** report, and the needs-placement
  filter.

### Build
- Universal macOS build is **signed and notarized** (stapled `.dmg` and `.zip`).
