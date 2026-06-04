# KKE Rubric Files

This folder contains rubric definitions for the KKE content audit tool. Each `.md` file defines the rules for one KKE status. The app looks for these files:

- `keep.md` — rules for pages that should be kept as-is
- `kill.md` — rules for pages that should be removed
- `evolve.md` — rules for pages that need improvement
- `exclude.md` — rules for pages outside the scope of the audit

You can point the app at a different rubrics folder in **Settings > Rubrics folder**.

---

## File Format

Each file has two sections: **Field Rules** (evaluated automatically against spreadsheet data) and **Content Rules** (evaluated manually or by AI).

```markdown
# Keep

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
