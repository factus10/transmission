---
title: Content Practice Wiki — Index
status: working
last-reviewed: 2026-04-28
---

# Content Practice Wiki

Internal reference for content audit, migration, and strategy work. A living set of pages that name our concepts, show their relationships, and capture lessons from real engagements.

> **For Claude and David:** this wiki is the working memory. When in doubt about how a concept is defined, link to the page here rather than re-deriving it. When you encounter a new pattern in a real engagement, write it up here so the next engagement starts ahead.

---

## How to navigate

The wiki organizes around three axes:

- **Concepts** — the vocabulary we use (KKE, dispositions, scope, authority, etc.)
- **Patterns** — recurring situations and how to recognize them
- **Practices** — the procedures we follow (audit, SME review, nav assignment, etc.)

Each page is self-contained but cross-linked. Most pages end with a **See also** block.

---

## Pages

### Foundations

- [Content Audit Overview](./content-audit-overview.md) — what we're doing, why, and where this fits in an engagement
- [KKE: The Classic Framework](./kke-classic.md) — Keep / Kill / Evolve / Exclude, the canonical definitions and where they came from
- [Why KKE Falls Short](./the-five-dimensions.md) — the conceptual analysis: KKE compresses five independent dimensions into one column

### Recognizing trouble

- [Patterns Where KKE Breaks](./patterns.md) — eight named patterns auditors hit repeatedly, with examples

### Toward a better framework

- [Content Audit Disposition (CAD)](./content-audit-disposition.md) — the proposed three-column model that decompresses KKE
- [Vocabulary Governance](./vocabulary-governance.md) — why audit vocabularies degrade and how to keep them clean

### Reference

- [Glossary](./glossary.md) — every term we use, defined once
- [Related Practices Roadmap](./related-practices-roadmap.md) — pages to add next: rubrics, SME workflow, nav/IA, analytics, AI

---

## Relationship map

```
                    ┌───────────────────────────┐
                    │  Content Audit Overview   │
                    │   (the engagement)        │
                    └─────────────┬─────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
        ┌─────────▼─────────┐         ┌──────────▼──────────┐
        │  KKE Classic      │         │  Related Practices  │
        │  (today's tool)   │         │  (rubrics, SME, IA, │
        └─────────┬─────────┘         │   analytics, AI)    │
                  │                   └─────────────────────┘
                  │
        ┌─────────▼─────────┐
        │  Why KKE Falls    │
        │  Short — the 5    │◄────┐
        │  dimensions       │     │ informs
        └─────────┬─────────┘     │
                  │               │
                  │         ┌─────┴──────────┐
        ┌─────────▼─────────▼─┐  │ Patterns Where  │
        │  Content Audit       │  │ KKE Breaks      │
        │  Disposition (CAD)   │  └─────────────────┘
        │  — the proposal      │
        └──────────────────────┘
                  │
        ┌─────────▼──────────┐
        │  Vocabulary        │
        │  Governance        │
        └────────────────────┘
```

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
