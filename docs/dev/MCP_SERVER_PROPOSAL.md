# Proposal — MCP Server

**Status:** Phase 1 implemented 2026-09-18 · Phase 2 proposed
**Date:** 2026-09-18

**Scope:** let an MCP client (Claude Desktop, Claude Code, anything that speaks the Model Context Protocol) ask questions of a `.transmission` project — and, later, propose changes to one — without going through the app's UI.

---

## 1. The problem

The Reports menu is a fixed set of questions. An audit raises a great many that aren't on it: *how many Keep pages under `/news` have no audience? which sections did the SME overturn most? what did we decide about PDFs on the careers subdomain?* Today those get answered by exporting to Excel and pivoting, or not at all.

The project file already holds everything needed to answer them. A `.transmission` file is a SQLite database with a stable, versioned schema, and most of what the app derives is **materialized into the rows** — `Source_Site`, `Page_Breadcrumb`, `Computed Path`, `Consolidate_Into`, `Suggested_KKE`, and `Redirect_Destination` (re-resolved on every save). A reader gets those for free.

An MCP server turns that file into something a model can query directly, so the ad hoc question gets a real number instead of a guess.

---

## 2. Two facts that decide the design

### 2.1 The app is the only safe writer

The renderer holds the whole project in memory (`state.editedRows`), `ProjectStore.saveAll()` writes the `rows` table *from that copy* on a 2-second debounced autosave, and **the app never re-reads the file**. So an external process that edits a row while the app is open has its edit silently overwritten within two seconds — and the app would never have shown it anyway.

Reads are the opposite: the file is in WAL mode, so a second reader is safe alongside the app, and the same 2-second autosave means a reader sees near-live state.

Consequence: **reads can be direct; writes cannot be.** Phase 1 is read-only. Phase 2 (§5) routes writes through the app as proposals.

### 2.2 The app's SQLite binding doesn't load in plain Node

`better-sqlite3` is rebuilt against Electron's ABI by `postinstall` (`electron-rebuild -f -w better-sqlite3`). `require('./project-store')` from a plain `node` process fails with a `NODE_MODULE_VERSION` mismatch. The server therefore **does not use `ProjectStore`** — it reads the same tables through `node:sqlite`, which ships with Node.

That is a deliberate second reason not to reuse it, too: `ProjectStore.open()` sets pragmas and runs `_migrate()`, which stamps `user_version`. An observer has no business migrating someone's project. The server opens the file `readOnly`, and a test asserts the file's bytes are unchanged after a full battery of tool calls.

The cost is two readers of one schema. `test/mcp-server.test.js` builds its fixture from the `CREATE TABLE` text **lifted out of `project-store.js`** — the same source-lifting trick the renderer tests use — so a schema change that the server hasn't followed fails the suite rather than drifting silently.

---

## 3. Decisions taken

1. **Standalone stdio server, not an in-app endpoint.** An endpoint hosted by the running app would see live in-memory state and could use the real write paths — but it needs a request/response channel from main to the renderer (every main→renderer channel today is fire-and-forget `send`), a listening socket inside the sandboxed signed build (the `network.server` entitlement), and it only works while the app is open. The file-based server needs none of that and works on a closed project.
2. **Zero dependencies.** `node:sqlite` for the database and a hand-rolled JSON-RPC-over-stdio transport (~100 lines) instead of `@modelcontextprotocol/sdk`. Same reasoning as `callClaudeMessages()` using raw HTTPS: one small surface doesn't justify a dependency tree. Requires Node 22.13+.
3. **Lives in `mcp/`, outside the app bundle.** electron-builder's `files` globs are `*.js` (root only) and `src/**/*`, so nothing under `mcp/` ships in the `.dmg` and the signed build is untouched.
4. **Rows are addressed by URL, never by index.** `deleteRows()` splices and shifts every index after it — the same hazard that made that feature clear the undo stack. A URL is the only identity that survives.
5. **Out-of-scope sites are excluded by default**, mirroring `reportRows()`, so a number from the server agrees with the number in a report. `scope: "all"` opts out.
6. **An unsupported filter is an error, not an empty result.** Most of the sidebar's special filters (`_duplicates`, `_url-variant`, `_redirect-needs-review`, …) are computed by renderer code the server doesn't have. A saved filter that uses one is refused by name. Quietly ignoring it would return a confidently wrong row set.
7. **Semantics ship with the server.** A model that doesn't know blank KKE means *unreviewed* will report an untouched crawl as a finished audit. The `initialize` response's `instructions`, and a `transmission://semantics` resource, carry the conventions from `docs/RUNNING_AN_AUDIT.md` that change how numbers must be read.

---

## 4. Phase 1 — read-only server (implemented)

```
mcp/
  server.js        — stdio JSON-RPC transport, tool + resource registry
  lib/project.js   — read-only project loader + query engine
  lib/semantics.js — the conventions text (instructions + resource)
  README.md        — setup for Claude Code / Claude Desktop
test/
  mcp-server.test.js
```

Register it:

```bash
claude mcp add transmission -- node /path/to/transmission/mcp/server.js --project /path/to/audit.transmission
```

`--project` (or `TRANSMISSION_PROJECT`) is optional; `open_project` switches projects at any time.

### Tools

| Tool | What it answers |
|---|---|
| `open_project` | Point the server at a `.transmission` file. Returns the overview. |
| `project_overview` | Identity, last save, row counts, content vs non-content split, effective-KKE mix (all rows *and* content only), sites and scope, sitemap size, which libraries exist, saved filter names. |
| `describe_columns` | Per column: fill count, distinct count, top values. How a model learns what is worth grouping by in a crawl export with 100+ columns. |
| `aggregate` | Counts grouped by up to three fields, with filters. **The important one** — it answers "Kill pages by section by site" in a few hundred tokens instead of pulling 13,000 rows into context. CSV columns (`Tags`, `Audiences`, `Jobs_Served`, `Design_Patterns`) are split so each value is tallied on its own. |
| `query_rows` | Matching rows, projected to chosen columns, paged and sortable. Long cells are truncated. |
| `get_row` | One page by URL: every non-blank field, its sitemap node, what consolidates into it, and its change history. |
| `get_sitemap` | The tree (or a subtree) to a chosen depth, with direct and whole-subtree page counts per node. |
| `get_redirects` | Redirect rules with provenance (`auto` / `manual` / `inherited` / unknown), distinguishing the `404` sentinel from blank. Summary by site + state, or a paged list. |
| `get_changelog` | The audit trail, filterable by URL, field, auditor, and date. |
| `get_libraries` | Audiences, jobs, sites, content type crosswalk, target specs, page statuses, assignees, KKE states, glossary. |

### Filters

`aggregate`, `query_rows` and `get_redirects` take the same `filters` array the sidebar uses — `[{field, operator, value}]`, ANDed, same ten operators, same semantics (ordering operators compare numerically when both sides are numbers; a blank cell matches neither direction). The port in `mcp/lib/project.js` is held to the original by a **drift test**: the suite lifts `fieldFilterMatches()` out of `renderer.js` and asserts both implementations agree over a matrix of operators × cell shapes.

`savedFilter: "name"` applies one of the project's own saved filters — the auditor's worklists, by the names they gave them. Text search, field filters, group filter, KKE statuses, and the twelve special filters that need no renderer state are honored; any other special filter is refused by name (decision 6).

### Virtual fields

Usable anywhere a field name is — filters, `groupBy`, `columns`, `sortBy`:

| Field | Value |
|---|---|
| `@effective_kke` | `Final_KKE`, else the KKE recommendation — the `effectiveKke()` reading. Blank = unreviewed. |
| `@content_kind` | `content` / `redirect` (3xx) / `gone` (4xx), from the crawl's Status Code — `nonContentKind()`. 5xx is content. |
| `@redirect_state` | `none` (blank — undecided) / `404` (deliberate) / `set`. |
| `@host` | The URL's host, `www.` folded away (`normalizeSourceHost()`). |
| `@path_1`, `@path_2` | The first one / two URL path segments. Deliberately **not** called "section": the app's section resolver strips shared prefixes and steps past locale segments, and this does neither. |
| `@in_scope` | `yes` / `no` — whether the row's source site is in scope. |

### What Phase 1 deliberately doesn't do

- **Anything the renderer computes live and doesn't store**: redirect health buckets, inherited-redirect classification, URL-variant groups, duplicate fingerprints, the sitemap shape check, `makeSectionResolver()` sections. Each needs either the source-lifting approach at runtime (brittle in a shipped tool) or extraction into a pure shared module the way `src/sitemap-layout.js` was. Worth doing per function as a need appears, not speculatively.
- **`.xlsx` files.** The working format is `.transmission`; the xlsx path would drag SheetJS into a zero-dependency server. *Save As Project* first.
- **The per-user column-mapping tier** (`prefs.columnMappings`). The server honors `projectSettings.columnMap`, then auto-detects — the two tiers that travel with the file. Reading the app's `prefs.json` would mean locating a sandbox container path and would make a query's result depend on whose machine ran it.
- **Audit-column injection.** The app adds missing audit columns on open; the server just reads an absent column as blank, which is the same answer without mutating anything.

---

## 5. Phase 2 — writes as proposals (proposed)

The contract already exists in the app: `Suggested_KKE` and `_Suggested_Audiences` both promise that a machine **never writes the human's column** — it queues a suggestion and a person accepts or rejects it. MCP writes should be a third instance of that contract, not a new one.

- **`propose_changes([{url, field, value, rationale}])`** inserts into a new `proposals` table. `saveAll()` touches only `headers`, `rows`, `nav_nodes`, `settings`, `changelog` and `meta`, so an extra table survives every autosave untouched — no coordination with the running app is needed to *queue* a proposal.
- **The app reads the queue** on open and on window focus, and shows a review dialog grouped **by proposed value** — the `openAudienceSuggestionReview()` pattern, which is what makes thousands of suggestions reviewable as a few dozen decisions.
- **Accepting goes through the real write paths**: `logChange()`, one `pushBulkEditUndo()` entry per accepted group, a `Suggested_KKE` refresh, and a re-check that the URL still resolves to the row the proposal was written against.
- **Field allow-list:** Notes, Tags, Audiences, Jobs_Served, Page_Type, Content_Theme, KKE_Recommendation. **Never:** `Final_KKE` (the SME's call), any `_`-prefixed column, sitemap structure, row deletion.
- **Provenance in the changelog.** An accepted proposal needs to read as "proposed by an agent, accepted by David", distinct from a hand edit — the same reason `_RedirectSource` exists.

### Open decisions

1. **Schema bump or optional table?** Bumping `SCHEMA_VERSION` to 2 makes older app builds refuse the file with the "update the app" error — correct but abrupt for a table they could safely ignore. The alternative is `CREATE TABLE IF NOT EXISTS` with no version bump and an app that treats the table as optional.
2. **Where does the server live long-term?** `mcp/` in this (private) repo keeps the filter port and its drift test next to the code they track. A public repo — or a `.mcpb` bundle in `transmission-updates` — is what another auditor could actually install.
3. **Client data.** The server hands crawl data to whichever model the client is connected to. That is the same exposure as the app's existing Claude calls, but at ad hoc query scale and under the *client's* configuration rather than the app's. Worth a line in `docs/RUNNING_AN_AUDIT.md` once this is in anyone else's hands.
