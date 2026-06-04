# Content Types & the Crosswalk Walkthrough

How to classify each page for migration: what type it is *today*, how it should *render* in the new CMS, and what it maps *to*. Get the crosswalk right and most of this fills itself in.

> Prerequisite: a file is open. Turn on **Show Migration fields** in App Settings to see the **Migrate** cluster.

---

## 0. The mental model

Three linked attributes describe a page's migration shape:

- **Content Type** — what the page *is* in the current CMS (Article, Faculty Profile, Landing Page…). This is the **key**.
- **Renders as** — how it will *surface* in the new CMS: **Page**, **Fragment (embeddable)**, or **Generated**.
- **Target Content Type** — what it maps *to* in the new system.

The **Content Type Registry** is the **crosswalk** that connects them. Define the mapping **once per content type** there, and every page of that type inherits its defaults — non-destructively, so your hand-entered values are never overwritten.

---

## 1. Set Content Type as you audit

In the **Classify** cluster, set **Content Type** (its UI label; the underlying column is `Page_Type`). A **→** hint next to it shows the mapped **Target** content type once a crosswalk entry exists.

> This is the one classification worth doing during the main audit pass — it's the key everything else hangs off. The rest can follow from the registry.

---

## 2. Build the crosswalk

**Project → Content Type Registry…** opens the editor. Each row is one current content type with its targets:

| Column | Meaning |
|---|---|
| **Content Type** (current) | the key |
| **Renders as** | default Page / Fragment (embeddable) / Generated |
| **Target Content Type** | the new-CMS type it becomes |
| **→ Target Spec** | the spec it's built from (Target Spec Library) |
| **Migration Track** | default delivery track |
| **Notes** | guidance |

**Seed with defaults** stages ~20 common content types. Sorted alphabetically on save.

---

## 3. Let the defaults fill in

When a row's **Content Type** is set (or changed), the app looks it up in the registry and fills **blank** `Renders as`, `Migration Track`, and `Target Content Type` from the matched entry — **never overwriting** anything you typed. Each auto-filled field is logged to the change log.

- Lookup is case-insensitive exact match first; if that misses, it splits compound types (`Article / blog post`) on separators and tries each token — so you don't have to register every variant.
- The **Migrate** cluster shows **Renders as** and **Track**, plus a **ghost suggestion** next to Track when it's blank (derived from KKE + Renders as) — click to accept.

> **Renders as = Fragment (embeddable)** (stored `Content Object`) marks content with no public URL — it's skipped in redirects and nav coverage downstream.

---

## 4. Verify coverage

- The **Unclassified** sidebar button (or `Content Nature is blank` field filter) finds pages still missing a **Renders as** value.
- **Reports → Content Type Crosswalk…** shows the full current → target mapping with per-type page counts and flags types that have **no crosswalk** entry yet.

---

## Quick checklist for "classified for migration"

- [ ] Every keep/evolve page has a **Content Type**
- [ ] The **Content Type Registry** covers every type in use (no "no crosswalk" flags)
- [ ] **Renders as** populated (Unclassified count → 0)
- [ ] **Target Content Type** and **→ Target Spec** mapped per type
- [ ] **Migration Track** set (or ghost suggestions accepted)
- [ ] Saved (**Cmd+S**)

---

*See also: `CONTENT_TYPE_MODEL.md` (the rationale), the **Build & Direction** walkthrough (Target Specs), and `USER_GUIDE.md`.*
