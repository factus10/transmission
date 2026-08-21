# Testing

```bash
npm test
```

Node's built-in runner (`node --test`). **No dependencies, no config, no framework** — deliberately, because this is an Electron app whose entire dependency budget ships inside a signed and notarized universal binary, and a test framework earns its keep only once there is a lot to run.

Tests live in `test/*.test.js` and use `node:test` + `node:assert/strict`.

---

## Why the tests look the way they do

`src/renderer.js` is a single ~28,000-line browser script. It has no module system, no exports, and it assumes a DOM, `window.electronAPI`, and live `<webview>` elements. You cannot `require()` it, and standing up enough of Electron to load it would mean an integration harness — far more machinery than is warranted to check that a page with a cyclic consolidation target doesn't hang.

So the tests **lift individual functions out by source text** and evaluate them with the handful of app helpers they call stubbed:

```js
function extract(name) {
  const start = source.indexOf('\nfunction ' + name + '(');
  const end = source.indexOf('\n}\n', start);
  return source.slice(start + 1, end + 3);
}
```

### What that constrains

A function under test must be declared at **column 0** as `function name(…)` and closed by a `}` at **column 0**. That's already the house style throughout `renderer.js`, and it is not a silent requirement: the first test in each file asserts that every name still extracts, so a rename or a reformat fails with

```
renderer.js has no top-level "function sankeyCapSources(" — renamed, or no longer declared at column 0?
```

rather than quietly testing nothing. If you rename a function, update the `EXTRACTED` list.

Consequently these are tests of **pure host-side logic**: tallies, resolvers, graph builders, validation. Anything that touches the DOM, IPC, or a webview is out of scope here and belongs in a manual pass — see `docs/dev/TEST_PLAN.md`.

### Two traps, both already paid for

**Run in this realm, not a fresh vm context.** `vm.runInThisContext` is used on purpose:

- A fresh context created with `vm.createContext({})` has *no* globals — not even `URL`. Because the URL resolvers wrap parsing in `try/catch`, a missing global didn't throw; it degraded into *every row silently skipped*, and a whole suite passed vacuously against empty results.
- Objects constructed inside another realm carry that realm's prototypes, so `assert.deepStrictEqual` reports two identical-looking arrays as unequal (`actual: ['a'], expected: ['a']`, failed).

The cost is that lifted declarations become globals of the test process. That's harmless here and much easier to reason about.

**`PRELUDE` is a `String.raw` template.** It was once an ordinary template literal, in which `\s` collapses to a bare `s` — so a stubbed `/\s+/g` quietly evaluated as `/s+/g` and ate the "s" out of "University" in a rename test. Keep `String.raw`, or double every backslash.

### Stubs must mirror real behavior

A stub that is subtly weaker than the real function produces a *false failure* (or worse, a false pass). `treemapKkeColor` is the live example: the real one resolves built-in KKE colors from `:root` CSS custom properties, which don't exist in Node, so the stub hardcodes those hexes from `styles.css` — but it keeps the real custom-state lookup, because that branch is exactly what the tests exercise. An early version dropped it and reported a product bug that wasn't one.

---

## Adding tests

1. Add the function name to `EXTRACTED`.
2. Add anything new it closes over to `PRELUDE`.
3. Write the test. `setState(rows, overrides)` assigns the global `state` the lifted code reads.

**Verify a new test can fail.** Break the code it covers, confirm it goes red, then revert. A green suite that cannot detect a regression is worse than no suite, because it is trusted. `test/sankey.test.js` has been checked this way against three mutations: mis-routing `Exclude` to the wrong terminal bucket, removing the consolidation cycle guard, and renaming an extracted function — each caught.

---

## Coverage today

Three suites, 67 tests. Each file carries its own `EXTRACTED` list and `PRELUDE`, so a suite only stands up the stubs its own functions need.

### `test/sankey.test.js` — 34 tests over the Content Flow (Sankey) feature

| Area | What's asserted |
|------|-----------------|
| Harness | Every extracted function still resolves; the sandbox has the globals the code needs |
| Source axis | Placed pages flow from their **URL** section (not their breadcrumb); shared path prefixes stripped; locale prefixes stepped past; depth control; labels containing spaces and separators |
| Terminal buckets | Kill / Exclude / unplaced / unreviewed each land in the right endpoint |
| Consolidation | Chains resolve through to the final master; cycles terminate; off-inventory masters fall back rather than vanish |
| Graph shapes | Page totals conserve across every column, in every shape; no zero-width bands; no dangling endpoints |
| Decision shape | User-added KKE states get their own block and keep their configured color; legend ordering |
| Multi-site | Two sites' `/about` stay apart; several hosts of one registered site fold to one label; the section axis uses the site label, not the raw host |
| Source cap | The tail folds into `Other` without losing pages; a no-op below the limit; the engine retains room to draw |
| Site labels | Rename trims, cascades to `Source_Site`, dirties the project; rejects duplicates/blanks/bad indices; allows a case-only rename |
| Engine template | Self-contained output with no external `<script src>`; app vs client vs print mode chrome |

### `test/redirect-health.test.js` — 11 tests over self-redirects and the health check

Written against the 2.14.1 bug, where the health check and `resolveRedirectDestinations()` disagreed about what a loop is: the check cleared a loop and the next save derived it straight back, and on a two-page consolidation cycle the "fix" turned one loop into two.

| Area | What's asserted |
|------|-----------------|
| `isSelfRedirect` | The same page matches however it's written; a different page doesn't; the same path on another host is **not** a loop; blank and `404` are neither |
| A cleared loop stays cleared | The consolidation cycle that used to double; a Kill page whose target chains back to it; a loop already sitting in a file heals on the next save with no health check run |
| The fix does not overreach | A genuine consolidate redirect is still derived; a hand-typed destination is never touched; `404` survives; a cross-site redirect sharing a path is left alone |

### `test/sitemap-shape.test.js` — 22 tests over the sitemap shape check

The load-bearing assertions are the ones about *not overclaiming*: an unmeasurable tree must report "unknown" rather than "fine", and a projection has to be able to say the repairs aren't enough.

| Area | What's asserted |
|------|-----------------|
| Flat-site classification | One-page roots are singletons; a zero-page root counts too; a root with children never does; pages are counted **including** Kill and Consolidate |
| Crawl artifacts | `/tag`, `/category`, `/wp-content` roots classify as artifacts rather than singletons, and are flagged even in an otherwise healthy tree |
| Render prediction | A small tree is legible and a flat 500-root tree isn't; `measure:false` classifies without laying out; an unmeasurable tree reports unknown, never "fits"; a healthy tree doesn't warn; the site-root probe is measured, not assumed |
| Over-wide branches | Reported worst-first; an already-collapsed node isn't reported |
| Projection | Grouping shortens the canvas without widening it; **the bucket must be collapsed** — expanded it is not a fix at all; projecting mutates nothing; selecting nothing changes nothing; dropping artifacts removes exactly those roots; a projection can still come back unusable |
| The repair | `applyGroupNavRoots` moves the chosen roots and leaves the rest alone; a node below the top level is adopted, not duplicated |

Everything else in the app is currently covered by the manual pass in `docs/dev/TEST_PLAN.md`.
