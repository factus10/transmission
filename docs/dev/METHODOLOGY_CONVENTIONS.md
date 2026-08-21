# Methodology pages — writing conventions

The conventions for maintaining `docs/methodology/`. These lived at the bottom of
that directory's README until the method pages were published publicly, at which
point contributor guidance stopped belonging in a reader-facing index.

---

## Conventions

### File format

- Markdown only. Plain `[text](./relative-path.md)` links so this works in GitHub, Obsidian, Notion (paste), and raw `cat`.
- Top-of-file front-matter (`---` block) with `title`, `status`, `last-reviewed`. Keep it minimal so non-front-matter readers don't choke.
- Each page ends with a **See also** section listing related pages.

### Status values

- `working` — actively being edited; expect revisions
- `stable` — content is solid; minor updates only
- `archived` — kept for history but no longer current
- `stub` — placeholder; needs writing

### When to add a new page

- A concept gets used in two or more discussions and we keep re-deriving its definition → make a page.
- A pattern recurs across engagements → write it up under Patterns.
- A practice has steps that someone other than the originator might run → write the procedure.

### When NOT to add a new page

- One-off observations belong in engagement notes, not the wiki.
- If the topic fits cleanly inside an existing page, expand the existing page.
- Project-specific details (a particular client's quirks) don't belong here — they belong in that project's docs.

### Tone

- Direct. We're writing for our colleagues, not pitching to clients.
- Examples over abstractions. If you can't show it, you don't understand it yet.
- Honest about tradeoffs. "Here's why we don't do X" is as useful as "here's how we do Y."

---

## See also

This wiki lives alongside (and was seeded by) the [Content Audit Framework critique](../CONTENT_AUDIT_FRAMEWORK.md) — a longer analytical document that argues for the CAD framework. Read that first if you want the full reasoning; use the wiki for working reference.
