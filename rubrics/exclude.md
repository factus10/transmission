# Exclude

Pages that are out of scope for this audit. Not broken or bad — just not content pages.

## Field Rules

- Status Code >= 300 and Status Code < 400
  Redirects — not content pages, just routing

- Content Type not contains text/html
  Non-HTML resources: PDFs, images, JavaScript, CSS, XML feeds

- Indexability Status is Non-Indexable
  Intentionally hidden from search engines — respect the directive

- Meta Robots 1 contains noindex
  Explicitly noindexed by the site — excluded by design

- Canonical Link Element 1 is not empty
  Canonicalized to another URL — the canonical version is the one to audit

- Address contains ?
  URL parameter variant — likely a duplicate or filtered view of another page

- Address ends with /feed
  RSS/Atom feed — not a content page

- Address ends with /print
  Print-view duplicate of an existing page

## Content Rules

- URL belongs to an external domain not part of this audit
- Page is a utility/system page (search results, login, print view, feed)
- URL is a parameter variant or duplicate path of a canonical page
- Page is auto-generated scaffolding with no editorial content (e.g. CMS tag pages, archive pages)
- Page is a non-HTML resource (PDF, image, document) that should be audited separately
- Page is canonicalized to another URL and is not the canonical version
