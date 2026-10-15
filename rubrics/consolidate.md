# Consolidate

Consolidate retires a page's URL and merges its content into another page that
already exists in the inventory. It is the one decision that is not finished
without a target, so it is described as Patterns rather than field rules: a
pattern says which page the content goes to. The app's per-page assessment
cannot name a target, so it never suggests Consolidate; a Claude session
working across the whole audit reads these patterns instead.

## Patterns

### Thin child page → consolidate into its parent
- Applies when: Word Count < 300
- Applies when: @url_parent is not empty
- Applies when: Status Code is 200
- Unless: Page_Type is Form
- Unless: Page_Type is Listing
- Judgment: the main content is roughly 1–3 paragraphs and would read naturally as a section of the parent page
- Then: Consolidate → parent
- Cite: paragraph count, the parent's URL and title, the sentence that shows the fit
- Ask instead: the page serves a different audience from its parent, or the parent is itself thin or being killed

### Near-identical siblings → consolidate into the strongest one
- Applies when: No. Near Duplicates > 0
- Applies when: Status Code is 200
- Judgment: the siblings say the same thing for the same audience, and the differences between them don't matter to a reader
- Then: Consolidate → the sibling with the most traffic and the most complete content
- Cite: the near-duplicate URLs, each page's traffic, what the surviving page lacks
- Ask instead: the siblings target different audiences, programs or locations
