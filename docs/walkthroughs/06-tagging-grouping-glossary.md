# Tagging, Grouping & the Glossary Walkthrough

How to build a consistent vocabulary across the audit — so "thin content" means the same thing on page 12 and page 1,200 — and document it for the client.

> Prerequisite: a file is open.

---

## 0. The mental model

Three distinct vocabulary fields, each with a different job:

- **Group** — *one per page.* The high-level bucket a page belongs to (e.g. "Admissions," "Research"). Drives the **Group** filter and section-level reports.
- **Primary Tag** — *one per page.* The single most important descriptor — the page's headline characteristic.
- **Tags** — *many per page.* A free, comma-separated set of finer descriptors (`thin-content, outdated, evergreen`).

The **Glossary** is the layer that keeps these honest: a per-name definition so every auditor uses each term the same way, and so the client gets a documented key.

---

## 1. Apply the vocabulary

In the **Classify** cluster of the audit bar:

- **Group** / **Primary** are single-select dropdowns; each has **+ New…** to define a value on the fly (sanitized and added to the library).
- **Tags** is a chip input — **+ Add tag** picks from the library or creates a new tag inline.

For many pages at once, use the **Multi-bar**: **Set Group**, **Set Primary Tag**, or **Add Tag** (see **Bulk Operations**).

> Consistency beats coverage. A small, well-defined tag set applied uniformly is far more useful in reports than a sprawling one applied ad hoc.

---

## 2. Document terms in the Glossary

**Project → Edit Glossary…** opens the editor:

- Two sections — **Tags** and **Groups** — list every known name.
- Add **Notes** (markdown) per term: what it means, when to apply it, examples.
- Empty-notes entries are pruned on save, so only documented terms persist.

The glossary travels with the file (the **KKE_Glossary** sheet), so the definitions move with the project.

---

## 3. Hand the glossary to the client

In the glossary editor, **Export for Word…** writes an `.html` file you can open directly in Word — a clean, formatted key of every tag and group with its definition. Use it as an appendix to the audit deliverable so stakeholders can read the tagged inventory without the app.

---

## Quick checklist for "good vocabulary"

- [ ] Every page has a **Group** (section-level reports depend on it)
- [ ] **Primary Tag** set where one descriptor clearly dominates
- [ ] **Tags** drawn from a deliberate, reused set — not freeform sprawl
- [ ] Every term in active use has a **Glossary** definition
- [ ] Glossary **exported for Word** if the client needs the key
- [ ] Saved (**Cmd+S**)

---

*Next (Classify for migration): **Content Types & the Crosswalk**. See also [the User Guide](../USER_GUIDE.md).*
