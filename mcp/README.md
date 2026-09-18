# Transmission MCP server

Read-only access to a `.transmission` audit project for any MCP client — ask questions of an audit that the Reports menu doesn't answer.

Design and reasoning: [`docs/dev/MCP_SERVER_PROPOSAL.md`](../docs/dev/MCP_SERVER_PROPOSAL.md).

## Requirements

- **Node 22.13 or newer** (uses the built-in `node:sqlite`). Nothing to install — there are no dependencies, and `npm install` in the app is not required.
- A **`.transmission` project**. Spreadsheets aren't supported: open the `.xlsx` in Transmission and use **File → Save As Project…** first.

## Setup

**Claude Code**

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

Filters use the same `{field, operator, value}` shape and semantics as the app's sidebar field filters, and `savedFilter` runs one of the project's own saved filters by name.

## Safe to use while the app is open

The server opens the project **read-only**, never migrates it, and holds the database only for the moment it takes to load. It notices when the app saves (every couple of seconds while someone is working) and reloads on the next call, so answers track the live audit.

One visible side effect: reading a project that the app has closed leaves empty `-shm` / `-wal` files beside it. That is how SQLite's WAL mode works for any reader; they are harmless, and the app removes them the next time it opens and closes the project.

## What it can't do yet

- **Change anything.** The app keeps the project in memory and would overwrite an outside edit on its next autosave. Writes are planned as *proposals* the auditor accepts in the app — see the proposal doc, §5.
- **Filters the app computes live** — duplicates, URL variants, redirect review, cross-site duplicates, consolidate-target checks, SME conflicts. A saved filter that uses one is refused by name rather than silently run without it; `get_libraries` → `savedFilters` shows which are usable.

## A note on client data

The server hands crawl and audit data to whichever model your MCP client is connected to. Treat it like any other tool that can read a client's project file.

## Tests

`npm test` from the repo root — `test/mcp-server.test.js`. It includes two drift checks: the fixture schema is lifted from `project-store.js`, and the filter operators are compared against the originals in `src/renderer.js`.
