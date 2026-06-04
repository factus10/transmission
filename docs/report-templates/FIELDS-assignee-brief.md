# Template fields — Writer / Builder Brief

Templates whose frontmatter says **appliesTo: assignee-brief** receive the data below.
Use {{field}} to insert a value, {{#section}}...{{/section}} to repeat a list (or show a
block when a value is present), and {{^section}}...{{/section}} for the empty case.
Use triple braces {{{field}}} to insert pre-formatted markdown without escaping — needed
for the brief fields.

## Top level
- **client** — client name
- **project** — project name
- **date** — formatted generation date
- **role** — "Writer" or "Builder"
- **person** — the assignee's name
- **report.title** — e.g. "Writer Brief — Jane Doe"
- **summary.pages** — nav pages assigned to this person
- **summary.sourcePages** — total source pages behind them
- **summary.patterns** — number of distinct build patterns
- **summary.briefs** — pages that have a page-specific brief

## groups  — repeat with {{#groups}} ... {{/groups}}
Each group is one build pattern.
- **pattern** — pattern name (or "No build pattern")
- **count** — pages in this group
- **hasReference** — true when a reference brief exists; use {{#hasReference}} ... {{/hasReference}}
- **referenceBrief** — the reference brief as markdown; insert with {{{referenceBrief}}}
- **briefs** — individual reference briefs, each with **label** and **md**; loop {{#briefs}} ... {{/briefs}} and insert {{{md}}}
- **pages** — the pages in this group (below)

## pages  — repeat with {{#pages}} ... {{/pages}} inside a group
- **breadcrumb** — full nav path (falls back to the node label)
- **label** — the node's own label
- **url** — target URL (site domain + computed path)
- **status** — page status (may be empty)
- **sourceCount** — source pages behind this node
- **hasBrief** — true when this page has its own brief
- **brief** — this page's brief as markdown; insert with {{{brief}}}

## Tips
- A bare {{value}} is HTML-escaped (safe). Use {{{value}}} only for the markdown brief fields.
- Add <div class="page-break"></div> anywhere to force a page break in the exported PDF.
- Copy the starter template, give it a unique **name:** in the frontmatter, and it appears
  as a separate choice in the report's template picker.
