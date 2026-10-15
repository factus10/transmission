# Transmission MCP server

Read-only access to a `.transmission` audit project for any MCP client — ask questions of an audit that the Reports menu doesn't answer.

Design and reasoning: [`docs/dev/MCP_SERVER_PROPOSAL.md`](../docs/dev/MCP_SERVER_PROPOSAL.md).

## Requirements

- **Node 22.13 or newer** (uses the built-in `node:sqlite`). Nothing to install — there are no dependencies, and `npm install` in the app is not required.
- A **`.transmission` project**. Spreadsheets aren't supported: open the `.xlsx` in Transmission and use **File → Save As Project…** first.

## Setup

**From the app (simplest).** With a `.transmission` project open, click **✦** in the title bar → **Open in Claude**. Transmission builds a **Claude desktop extension** (`transmission.mcpb`: `server.js` + `lib/` + a manifest, see `claude-extension.js` at the repo root) from this folder and hands it to the Claude app, which asks to install it and then runs it on its **own bundled Node** — no CLI, no system Node. Extensions carry no skills, so the server also offers the four skills as **MCP prompts** (`mcp/lib/prompts.js` serves each `skills/*/SKILL.md` body, with the `ask-the-audit` ground rules appended) — the chat's **+** menu lists them. With the `claude` CLI installed, the dialog also offers a Claude Code session (Code tab or Terminal): the plugin ships inside the app (`Contents/Resources/mcp`) and registers itself with Claude Code on first use. The app also writes `current-project.json` in its support folder, which the server reads when started with no project — so any session connects to what's open.

**Claude Code — as a plugin.** This directory is a Claude Code plugin: it declares the server *and* ships the skills below, so one install wires both.

```bash
# from a checkout of the repo
claude plugin install transmission --marketplace /absolute/path/to/transmission/mcp -y

# or, for one session only
claude --plugin-dir /absolute/path/to/transmission/mcp
```

The repo root also carries a marketplace entry (`.claude-plugin/marketplace.json`), so `/plugin marketplace add factus10/transmission` then `/plugin install transmission` works for anyone with access to the repo.

**Claude Code — server only**

```bash
claude mcp add transmission -- node /absolute/path/to/transmission/mcp/server.js
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "transmission": {
      "command": "node",
      "args": ["/absolute/path/to/transmission/mcp/server.js"]
    }
  }
}
```

Then, in a conversation: *"Open the project at /path/to/audit.transmission"*. To start with a project already open, append `--project /path/to/audit.transmission` to the args (or set `TRANSMISSION_PROJECT`).

## Skills

Four skills ride along in `skills/`. They encode *how to ask* — the audit's conventions and the order of operations from `docs/RUNNING_AN_AUDIT.md` — so the model behaves like an analyst who has read the method, not one guessing from column names. Each ends in something the strategist acts on in the app; none of them change the project.

| Skill | Use it when | Produces |
|---|---|---|
| `ask-the-audit` | Any "how many / which pages / what did we decide" question | A number, its breakdown, and the sidebar filter that reproduces it |
| `audit-status` | Monday check-in, client status email, "what changed since Friday" | A status note: progress both ways, what moved and by whom, what's still owed before handoff |
| `section-review` | "Help me go through /news", "what should we do with the department pages" | The section's patterns, the exceptions worth a human minute, and a proposed-decision worksheet with reasons in the auditor's own vocabulary |
| `rubric-sweep` | "Apply the rubric across the site", "find thin pages to consolidate" | The project's own rubric patterns applied to every matching page: candidates found by the pattern's conditions, candidates and targets read with `get_page_text`, and proposals grouped by where the content goes, with questions kept separate |
| `decision-consistency` | Before SME export, handoff, or a readout | Pages whose decision contradicts their neighbours or their data, each with the evidence and a question — never an accusation |

Invoke them as `/audit-status`, `/section-review /news`, `/decision-consistency`, `/rubric-sweep /admissions`, or just ask in plain language; the descriptions let the model pick them up.

**Try them without client data:**

```bash
node mcp/sample/make-sample-project.js        # → mcp/sample/alpha-university.transmission
```

That writes a deterministic 314-row fictional university audit with a sitemap, audiences, saved filters and three weeks of change history — and seven planted problems (a Keep page that 404s, Consolidate pages with no target, a Kill in a priority-audience section, SME overrides, an undecided tail) for the skills to find. The script prints the list.

## What it can do

| Tool | |
|---|---|
| `open_project` | Point the server at a project file |
| `project_overview` | Counts, decision mix, progress, sites, libraries, saved filters — start here |
| `describe_columns` | What fields exist and which are worth grouping by |
| `aggregate` | Counts grouped by up to three fields — the tool for any "how many" question |
| `query_rows` | Matching rows, chosen columns, paged |
| `get_row` | One page in full, by URL, with its change history |
| `get_sitemap` | The new-site tree with page counts |
| `get_redirects` | Redirect rules and who wrote them |
| `get_changelog` | The audit trail |
| `get_libraries` | Audiences, jobs, sites, content types, statuses, glossary… |
| `get_rubrics` | The project's own decision rubrics, with each pattern's conditions as ready-to-run filters |
| `get_page_text` | The main content of up to 10 audit pages (paragraphs, words, headings, text), fetched live once and cached in the project |

Filters use the same `{field, operator, value}` shape and semantics as the app's sidebar field filters, and `savedFilter` runs one of the project's own saved filters by name.

## Safe to use while the app is open

The server opens the project **read-only**, never migrates it, and holds the database only for the moment it takes to load. It notices when the app saves (every couple of seconds while someone is working) and reloads on the next call, so answers track the live audit.

One visible side effect: reading a project that the app has closed leaves empty `-shm` / `-wal` files beside it. That is how SQLite's WAL mode works for any reader; they are harmless, and the app removes them the next time it opens and closes the project.

## Proposals — the one write

`propose_changes` queues a request (page URL, field, value, one-line rationale) in a `proposals` table inside the project file. It never touches the audit: the app shows the queue (✦ in the title bar, **Proposals** in the sidebar, Project → Review Proposals) and the auditor accepts or rejects there. Accepted values are written by the app through its own paths — change-logged with a `(proposal accepted)` entry carrying the source and rationale, one `Cmd+Z` per batch. `list_proposals` shows what's queued, accepted or rejected.

Allowed fields: decision, notes, tags, group, primary tag, content type, theme, renders-as, migration track, published status, audiences, primary audience, jobs. Controlled values are checked against the project's own libraries; `Consolidate` is refused (it needs a target only the app's picker can set); tags/audiences/jobs are added, never removed; a note is appended. `Final_KKE`, `_`-columns, sitemap placement, redirects and consolidation targets cannot be proposed. The whole batch is validated before any of it is written, and a pending proposal for the same page + field is replaced rather than stacked.

The table is created on demand without touching the file's schema version; the app stamps schema v2 when it next opens the project.

## What it can't do yet

- **Skills in Claude Desktop.** Desktop can run the server (configure it as above) but doesn't load Claude Code plugins or skills; the skills are Claude Code only for now.

- **Change anything directly.** The app keeps the project in memory and would overwrite an outside edit on its next autosave, so the only write is the proposals queue above.
- **Filters the app computes live** — duplicates, URL variants, redirect review, cross-site duplicates, consolidate-target checks, SME conflicts. A saved filter that uses one is refused by name rather than silently run without it; `get_libraries` → `savedFilters` shows which are usable.

## A note on client data

The server hands crawl and audit data to whichever model your MCP client is connected to. Treat it like any other tool that can read a client's project file.

## Tests

`npm test` from the repo root — `test/mcp-server.test.js`. It includes two drift checks: the fixture schema is lifted from `project-store.js`, and the filter operators are compared against the originals in `src/renderer.js`.
