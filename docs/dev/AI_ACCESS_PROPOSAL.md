# Proposal — Programmatic AI access to audit data

**Status:** draft · not approved · no code written
**Date:** 2026-08-23
**Scope:** letting an AI assistant read — and possibly write — the data in a Transmission project, either from outside the app (an MCP server over `.transmission` files) or from inside it (the app driving Claude over its own data, generalizing the audience-suggestion pattern).

> Feasibility assessment, not a design. Every claim about the current code was checked against 2.17.1; the phasing and the open questions are the parts that need a decision.

---

## 1. Two different products

"Let AI work with the audit data" splits into two things that share almost no implementation:

**Outward — an MCP server.** Claude Code / Claude Desktop reaches into a project file and answers questions about it: *how many Keep pages have no sitemap placement, what does the redirect map look like, which sections are entirely Kill.* The AI is the client; Transmission's data is the resource. The app need not be running.

**Inward — the app drives the AI.** Transmission already does this: `callClaudeMessages()` (main.js:3382) with schema-constrained, batched requests behind Suggest Audiences with AI and the rubric assessor. Generalizing it means more in-app AI features, not an integration.

They answer different questions. Outward is *"I want to ask my audit things from wherever I'm working."* Inward is *"I want the app to do more of the audit for me."* This proposal is mostly about the outward path, because that's the one with real unknowns — but see §7, because the inward path may be the better buy.

---

## 2. Reading is nearly free, and this is verified

A `.transmission` project is SQLite, and `ProjectStore` (project-store.js) was deliberately built free of Electron — its constructor comment says so, and its only import is `better-sqlite3`. Rows are stored as **one JSON object per row**, which turns out to be the load-bearing detail: SQLite's JSON functions can query them directly, so a reader needs no knowledge of Transmission's column model to filter or aggregate.

Checked on Node v24.10.0 / SQLite 3.53.2, using the built-in `node:sqlite` and **no dependencies at all**:

```sql
SELECT json_extract(data,'$.KKE_Recommendation') kke, COUNT(*) n FROM rows GROUP BY 1;
-- → [{ kke: 'Keep', n: 1 }, { kke: 'Kill', n: 2 }]
```

Two consequences:

- **No native-module problem.** `better-sqlite3` is ABI-bound to whichever runtime last built it, and `postinstall` runs `electron-rebuild` on it — so a plain-Node process sharing the app's `node_modules` is a coin flip. `node:sqlite` sidesteps this entirely and keeps the server dependency-free, which matches the dependency discipline the rest of the project holds itself to (see the rationale in docs/dev/TESTING.md).
- **Aggregation pushes down into SQL.** This is not a nicety. A real audit is 3k–13k rows; no MCP tool can return that. The useful surface is `query_rows(filter)`, `kke_summary()`, `redirect_map()`, `sitemap_tree()`, `coverage_gaps()` — server-side answers, never row dumps. Anything that returns "all the rows" is a design error, not a large response.

**Concurrency is already handled.** `_pragmas()` sets `journal_mode = WAL`, so an external reader is safe while the app has the project open. It sees last-saved state, which for a project is ~400ms stale (`AUTOSAVE_DELAY_PROJECT`, renderer.js:7776) — effectively live.

---

## 3. The real constraint: the semantics are unreachable

The database yields *columns*. Nearly nothing that makes those columns **mean** anything is reachable from outside the app.

| Logic | Lives in | Callable from Node? |
|---|---|---|
| `effectiveKke`, `reportRows` (out-of-scope sites), `isFragmentRow`, `consolidateTargetAddr`, `resolveRedirectDestinations`, `pageBreadcrumbOf`, the section resolvers | `src/renderer.js` — **30,490 lines**, no module system, no exports, assumes a DOM and `window.electronAPI` | No |
| `injectAndOrderAuditColumns`, `computeColumnMap`, the xlsx structural-sheet parsers | `main.js` — `require('electron')` on line 1 | No |

A naive server would therefore report `KKE_Recommendation` where the app's answer is `Final_KKE || KKE_Recommendation`; count pages the audit has explicitly scoped out; treat a Consolidate row as having no destination rather than chasing the chain; and offer `Sitemap_Destination` where the on-page answer is `Page_Breadcrumb`. Subtly wrong in exactly the places this app spent effort getting right — and subtly wrong is worse than absent, because an AI will state it confidently.

**The existing workaround doesn't generalize.** `docs/dev/TESTING.md` lifts functions out of `renderer.js` **by source text** (`source.indexOf('\nfunction ' + name + '(')`), which forces every lifted function to be declared at column 0 and needs a hand-written stub prelude per suite. That is a good trade for 67 tests. As the foundation of a shipped integration it is a liability — a reformat or rename breaks it, and the stubs silently drift from the real behavior (TESTING.md documents that failure happening twice already).

**So the honest scope is: a useful MCP server implies extracting a shared domain module out of `renderer.js`.** The MCP plumbing is a weekend. The extraction is the project. It has independent value — it is also what would let the test suite cover more than three subsystems — but it should be costed as the main line item, not a prerequisite footnote.

---

## 4. Writes have one specific blocker

`saveAll()` (project-store.js:155) writes the renderer's **entire in-memory row array**: it diffs by `idx`, deletes any `idx` the array no longer covers, and replaces `nav_nodes` and `settings` wholesale. The app **never re-reads the file after open** — there is no `fs.watch`, no `watchFile`, no watcher of any kind in `main.js` or `renderer.js`.

So an external write to an open project is silently overwritten by the next autosave, ~400ms after any edit. No conflict, no error, no indication to either party. That is the worst available failure mode for an audit tool, whose entire value proposition is that decisions are recorded.

Three ways out, ascending in cost and honesty:

1. **Read-only, stated as a guarantee.** No blocker exists. Recommended for v1.
2. **Write only when no app instance holds the file.** An advisory lock is cheap; still fragile if the project is opened mid-session.
3. **Route writes through the running app**, so an AI edit takes the same path as a UI edit — `logChange()`, the dirty flag, the undo stack. This is the only variant where an AI's changes are auditable the way every other change in this app is, which for this app is close to a requirement.

---

## 5. Architectures

**A — standalone, read-only, `.transmission` only.** Own repo, `node:sqlite`, ~300–500 lines, zero dependencies, **no changes to the app**, and deliberately outside the signed/notarized bundle (nothing to re-sign, no new attack surface in the shipped binary). Works against today's files. Caveat: answers in raw-column terms until §3 is paid for.

**B — A, plus xlsx projects.** Needs the structural-sheet parsers lifted out of `main.js`. Possibly skippable: projects are the working format and xlsx is import/export only, so the working case is covered by A.

**C — the app hosts the server.** Live state; the semantics come for free because the renderer already has them; writes go through the normal edit path. Costs: a localhost HTTP/SSE listener inside a signed app, a token and an auth story, and the app must be running. This is where §4's option 3 lands.

---

## 6. Phasing

| Phase | Contents | Effort |
|---|---|---|
| **1 — Read it** | Standalone read-only MCP server over `.transmission` via `node:sqlite`. Aggregate/filter tools only, no row dumps. Raw-column semantics, documented as such | S |
| **2 — Mean it** | Extract a shared domain module from `renderer.js` (`effectiveKke`, `reportRows`, consolidate resolution, redirect resolution, section resolvers, breadcrumb). Server and app consume the same file; the test suite's source-lifting hack becomes a real import | **L — the actual project** |
| **3 — Answer like the app** | Server tools re-expressed over the extracted module: coverage gaps, redirect map, KKE mix by section, consolidation chains — matching what the app's own reports say, by construction | M |
| **4 — Write** | Only after §4 is decided. Either advisory-lock writes, or the in-app host (C) | M–L |

Phase 1 alone is worth having: it makes an audit answerable from Claude Code without opening the app, and it is small enough to abandon cheaply if the workflow doesn't stick. Phase 2 is where the cost is, and it should be justified on its own merits (testability, a second consumer of the domain logic) rather than as MCP overhead.

---

## 7. The cheaper alternative, stated fairly

The inward path may deliver more value per unit of work. `callClaudeMessages()` already exists; the audience suggester already batches (`AUDIENCE_AI_BATCH_SIZE = 20`, `AUDIENCE_AI_CONCURRENCY = 3`, renderer.js:5074) and already has the right contract — suggestions land in `_Suggested_Audiences` and **never** touch the human column, with an explicit review queue. That contract is reusable for any AI-assisted audit step.

Crucially, inward features run where the semantics already live, so they skip §3 entirely, and every write already goes through `logChange()`, so they skip §4 as well. If the goal is "AI does more of the audit," this is the shorter road. If the goal is "I want to interrogate an audit from my editor," only the MCP server gets there.

**This is a product question, not a feasibility one**, and it should be answered before Phase 2 is funded.

---

## 8. Risks and open questions

**Wrong-but-confident is the main risk.** A read-only server that answers in raw columns will be believed. Phase 1 must state its limits in each tool's own description (not only in a README), or Phase 2 becomes mandatory rather than optional.

**Client data leaves the app's boundary.** Audit projects contain client URLs, titles, and internal notes. Today they only ever reach Anthropic through the deliberate, user-initiated AI features with a user-supplied key. An MCP server hands the whole project to whatever client connects. That is presumably the intent, but it should be an explicit decision, and it may bear on what a client engagement's contract allows.

**Extraction risk.** Pulling functions out of a 30,000-line file that has no module boundaries will surface hidden coupling to `state` and to DOM helpers. Mitigate by extracting only the functions the server needs, keeping `state` an injected argument rather than a global, and leaning on the three existing suites as the regression net.

**Scope discipline.** This proposal deliberately does not touch: the persistence schema (`SCHEMA_VERSION` stays 1 — nothing here needs a schema change), the xlsx path, or the existing in-app AI features.

### Decisions I need

1. **Outward or inward first?** (§7.) They share nothing; picking both means doing both.
2. **Read-only for v1 — acceptable?** I recommend yes. Writes are answerable later and cheaply *if* the read path exists first.
3. **Is Phase 2's extraction fundable on its own merits?** If not, Phase 1 is the whole feature, and it should be scoped and described as a raw-data reader rather than as "Transmission's MCP server."
4. **Does client data going to an arbitrary MCP client raise a contractual issue** on the engagements this is used for? Worth answering before, not after.
5. **Separate repo, or in this one?** Separate keeps it out of the signed bundle and out of the dependency budget; in-repo keeps it honest against schema changes. I lean separate for Phase 1, in-repo once Phase 2 exists and the two must share a module.
