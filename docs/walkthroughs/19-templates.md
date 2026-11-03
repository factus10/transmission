# Templates Walkthrough

How to reuse setup across projects and shape your reports — two distinct template systems that save you from reconfiguring every engagement.

> Prerequisite: a file is open (for audit templates) and/or you want to customize a report's output (for report templates).

---

## 0. The mental model

Two unrelated "template" features:

- **Audit templates** (`.kke-template.json`) — a portable snapshot of your *setup*: field config, vocabularies, decision states, column mapping, identity. Save once, apply to every new client file so you don't reconfigure from scratch.
- **Report templates** (Markdown + Mustache) — files that control how a report *renders*. Currently they style the **Migration Direction Brief**.

---

## 1. Audit templates — save your setup

1. Configure a file the way you like it (visible fields, tag/group libraries, sidebar columns, custom decision states, column mapping, identity, saved filters).
2. **File → Save Audit Template…**, name it. It writes a `.kke-template.json` capturing all of the above.
3. On a new project: **File → Load Audit Template…** and pick the file — your setup is applied in one step.

> Audit templates carry *configuration*, not page data. They're how you standardize a team's audit conventions across many clients.

---

## 2. Report templates — shape the Direction Brief

Custom report templates are **Markdown files with Mustache placeholders**, rendered to HTML.

1. Open the templates folder: in the **Migration Direction Brief** dialog → **Templates folder** (or it lives at **Documents → Transmission → templates**).
2. The folder ships with **`FIELDS-*.md`** reference files documenting every available placeholder for that report type. A template declares which report it's for via frontmatter (`appliesTo: assignee-brief`).
3. Write/edit a `.md` template using `{{field}}` for values and `{{#section}}…{{/section}}` to repeat lists.
4. In the Migration Direction Brief dialog, pick your template from the **Template** dropdown (or **Built-in default**, which needs no setup), then **Generate**.

> Placeholders available to a template are exactly what its matching `FIELDS-*.md` lists — start there rather than guessing field names.

---

## Quick checklist for "templates working"

- [ ] A reusable **audit template** saved for your standard setup
- [ ] New projects bootstrapped via **Load Audit Template**
- [ ] Custom report template (if any) declares the right `appliesTo`
- [ ] Placeholders match the report's `FIELDS-*.md`
- [ ] Template selected in the report dialog before **Generate**

---

*See also: the **Build & Direction** walkthrough (the Migration Direction Brief) and [the User Guide](../USER_GUIDE.md).*
