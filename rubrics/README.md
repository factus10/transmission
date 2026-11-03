# Rubric Files

This folder contains rubric definitions for the content audit. Each `.md` file defines the rules for one decision. The app looks for these files:

- `migrate.md` — rules for pages that move to the new site as-is
- `revise.md` — rules for pages that move but need work first
- `archive.md` — rules for pages that are retired (and owe a redirect)
- `exclude.md` — rules for pages outside the scope of the audit
- `consolidate.md` — patterns for pages whose content should merge into another page

These were `keep.md`, `evolve.md` and `kill.md` before the Keep/Kill/Evolve → Migrate/Revise/Archive rename. A library that still uses the old file names keeps working: the app reads a legacy file when the new one is missing, and saves under the new name. A rubric's `Then:` line may use either vocabulary.

This folder is your **personal library**. A project carries its own copy of its rubrics (Project → Rubrics… → **Copy from my library**), so everyone auditing it — and Claude, through the Transmission extension — applies the same ones. A project with no rubrics of its own uses this folder for the per-page assessment.

You can point the app at a different rubrics folder in **Settings > Rubrics folder**.

---

## File Format

Each file has two sections: **Field Rules** (evaluated automatically against spreadsheet data) and **Content Rules** (evaluated manually or by AI).

```markdown
# Migrate

## Field Rules
- Status Code is 200
- Indexability Status is Indexable

## Content Rules
- Page provides comprehensive coverage of its topic
- Content is evergreen and regularly maintained
```

The `#` heading is ignored by the parser (it's just for readability). The `## Field Rules` and `## Content Rules` headings are required — they tell the parser which section each rule belongs to.

Rules are bullet points starting with `- ` or `* `.

---

## Field Rule Syntax

Field rules compare a **column name** from your spreadsheet against a **value** using an **operator**. The column name must match the spreadsheet header exactly (case-insensitive matching is used for the value comparison).

### Exact match

```
- Status Code is 200
- Indexability Status is Indexable
- Content Type is not text/html
```

### Numeric comparisons

For columns containing numbers (status codes, word counts, traffic, etc.):

```
- Status Code >= 400
- Word Count > 500
- Word Count < 300
- Unique Inlinks <= 1
```

| Operator | Meaning                |
|----------|------------------------|
| `>`      | greater than           |
| `>=`     | greater than or equal  |
| `<`      | less than              |
| `<=`     | less than or equal     |

### Text matching

```
- Title 1 contains buy
- Meta Description 1 not contains click here
- Address starts with https://example.com/blog
- Address ends with .pdf
```

| Operator         | Meaning                              |
|------------------|--------------------------------------|
| `contains`       | value appears anywhere in the cell   |
| `not contains`   | value does NOT appear in the cell    |
| `starts with`    | cell begins with the value           |
| `ends with`      | cell ends with the value             |

### Empty / non-empty checks

```
- Meta Description 1 is empty
- H1-1 is not empty
```

### Compound rules (AND)

Combine two conditions on one line with `and`:

```
- Status Code >= 300 and Status Code < 400
- Word Count > 100 and Word Count < 300
```

Both conditions must be true for the rule to pass.

---

## Content Rules

Content rules are plain English descriptions meant for human judgment or AI assessment. They are displayed in the assessment panel as a checklist.

If you have a **Claude API key** configured in Settings, you can click **AI Assess** to have the content rules evaluated by Claude against the page metadata.

```markdown
## Content Rules
- Page provides comprehensive, authoritative coverage of its topic
- Content is well-structured with clear headings and logical flow
- Page serves a clear purpose in the site's information architecture
```

---

## Column Names

Field rules reference columns by their header name in the spreadsheet. Common Screaming Frog columns include:

| Column                | Type    | Example values                  |
|-----------------------|---------|---------------------------------|
| `Address`             | URL     | `https://example.com/page`      |
| `Status Code`         | Number  | `200`, `301`, `404`             |
| `Indexability Status`  | Text    | `Indexable`, `Non-Indexable`    |
| `Title 1`            | Text    | Page title                      |
| `Meta Description 1` | Text    | Meta description                |
| `H1-1`               | Text    | First H1 heading                |
| `Word Count`          | Number  | `1523`                          |
| `Redirect URL`       | URL     | Target of 3xx redirect          |
| `Content Type`       | Text    | `text/html`                     |
| `Unique Inlinks`     | Number  | Count of internal links to page |

Open your spreadsheet's header row to see the exact column names available for your file.

---

## Tips

- **Start simple.** A few field rules per status is enough to get useful suggestions.
- **Use content rules for nuance.** Things like "content quality" or "strategic value" can't be checked from spreadsheet data alone.
- **Compound rules are useful for ranges.** E.g., redirect detection: `Status Code >= 300 and Status Code < 400`.
- **Rules are evaluated per-status.** The status with the most passing field rules is suggested.
- **All comparisons are case-insensitive** for text operators (`is`, `contains`, `starts with`, `ends with`).


---

## Patterns (whole-audit rules)

Field and content rules judge one page at a time. A **pattern** describes a situation that only shows up across pages — a thin page under a parent that could absorb it, a cluster of near-identical siblings — and is what a Claude session reads when it reviews the whole audit. Patterns go under a `## Patterns` heading, one `###` block each:

```markdown
## Patterns

### Thin child page → consolidate into its parent
- Applies when: Word Count < 300
- Applies when: @url_parent is not empty
- Unless: Page_Type is Form
- Judgment: the main content is roughly 1–3 paragraphs and would read naturally as a section of the parent
- Then: Consolidate → parent
- Cite: paragraph count, the parent's URL, why it fits
- Ask instead: the page serves a different audience from its parent
```

| Label | Meaning |
|-------|---------|
| `Applies when` | A condition in the field-rule syntax. Repeat it; **all** must hold. These are what narrow thousands of pages to the few worth reading, so make them do as much as they can. |
| `Unless` | An exception in the same syntax. Repeat it; **any** match excludes the page. |
| `Judgment` | What a person (or Claude, reading the page) has to decide. Keep everything a column can answer out of here. |
| `Then` | The decision, and for Consolidate its target: `Consolidate → parent`. |
| `Cite` | The evidence to show with each proposal. |
| `Ask instead` | When to raise a question rather than propose a change. |

`@url_parent` is the nearest page above this one in the current site's URL structure that is itself in the inventory. Any column in the crawl, any audit column, and the virtual fields the Transmission extension offers (`@effective_kke`, `@content_kind`, `@path_1`, …) can be used in a condition. `>=` and `<=` work in the app's own assessment but have no equivalent in the sidebar's field filters, so prefer `>` and `<` in patterns.
