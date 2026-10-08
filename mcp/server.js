#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// Transmission MCP server — read-only access to a .transmission audit project.
//
//   node mcp/server.js [--project /path/to/audit.transmission]
//
// See docs/dev/MCP_SERVER_PROPOSAL.md for the design and mcp/README.md for
// setup. Zero dependencies on purpose: node:sqlite for the database and the
// transport below instead of @modelcontextprotocol/sdk. The stdio transport is
// newline-delimited JSON-RPC 2.0, and a server that only offers tools and two
// resources needs a handful of methods — not a dependency tree.
//
// stdout carries protocol messages ONLY. Anything diagnostic goes to stderr;
// a stray console.log here corrupts the stream for the client.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const path = require('node:path');
const readline = require('node:readline');
const { loadProject, fileStamp, FIELD_FILTER_OPERATORS, VIRTUAL_FIELDS, PROPOSAL_FIELDS } = require('./lib/project');
const { INSTRUCTIONS, SEMANTICS_MD } = require('./lib/semantics');
const { listPrompts, getPrompt } = require('./lib/prompts');

const SERVER_INFO = { name: 'transmission', version: '0.3.0' };
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

// ─── Active project ──────────────────────────────────────────────────────────

let activePath = null;
let cached = null;

function argProject() {
  const i = process.argv.indexOf('--project');
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env.TRANSMISSION_PROJECT || null;
}

/** The project Transmission currently has open, if the app is running.
 *  main.js writes `current-project.json` into its userData folder on every
 *  open and clears it on quit, so a Claude session started from anywhere —
 *  the desktop app, a terminal — connects to "what's open in Transmission"
 *  with no per-project configuration. Checked only when nothing explicit was
 *  given, and re-read on each use so switching projects in the app is
 *  picked up by the next call. */
function currentProjectFromApp() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidates = process.platform === 'darwin'
    ? ['Transmission', 'transmission'].map(n => path.join(home, 'Library', 'Application Support', n, 'current-project.json'))
    : [path.join(process.env.APPDATA || path.join(home, '.config'), 'transmission', 'current-project.json')];
  for (const f of candidates) {
    try {
      const j = JSON.parse(require('node:fs').readFileSync(f, 'utf8'));
      if (j && typeof j.filePath === 'string' && require('node:fs').existsSync(j.filePath)) return j.filePath;
    } catch (_) { /* not there, or not readable */ }
  }
  return null;
}

/** The current project, reloaded whenever the file (or its WAL) has changed on
 *  disk. The app autosaves a project every ~2s while someone is working in it,
 *  so a cached copy goes stale quickly — and a stat is far cheaper than a load. */
function project() {
  if (!activePath) {
    const fromApp = currentProjectFromApp();
    if (fromApp) activePath = fromApp;
    else throw new Error('No project is open. Call open_project with the path to a .transmission file — or open one in Transmission, which this server then follows automatically.');
  }
  if (!cached || cached.filePath !== activePath || cached.stamp !== fileStamp(activePath)) {
    cached = loadProject(activePath);
  }
  return cached;
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const FILTER_SCHEMA = {
  type: 'array',
  description: 'Conditions, ALL of which must hold. Same semantics as the app\'s sidebar field filters: text operators are case-insensitive; greater-than/less-than compare numerically when both sides are numbers ("1,234" parses) and a blank cell matches neither.',
  items: {
    type: 'object',
    properties: {
      field: { type: 'string', description: 'A column name (case-insensitive) or a virtual field: ' + Object.keys(VIRTUAL_FIELDS).join(', ') },
      operator: { type: 'string', enum: FIELD_FILTER_OPERATORS },
      value: { type: 'string', description: 'Omit for is-blank / is-not-blank.' }
    },
    required: ['field', 'operator']
  }
};

const SELECT_PROPS = {
  filters: FILTER_SCHEMA,
  savedFilter: { type: 'string', description: 'Name of one of the project\'s saved filters (see project_overview) — the auditor\'s own worklists. Combined with `filters` using AND.' },
  search: { type: 'string', description: 'Case-insensitive text search.' },
  searchScope: { type: 'string', enum: ['all', 'url', 'title'], description: 'Where `search` looks. Default all fields.' },
  scope: { type: 'string', enum: ['in-scope', 'all'], description: 'in-scope (default) excludes rows from source sites marked out of scope, matching the app\'s reports.' }
};

const TOOLS = [
  {
    name: 'open_project',
    description: 'Open a Transmission project (.transmission file) and return its overview. Replaces any project already open. Spreadsheets (.xlsx) are not supported — convert with File → Save As Project in the app.',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Absolute path to the .transmission file.' } }, required: ['path'] },
    run: ({ path: p }) => {
      if (!p) throw new Error('`path` is required.');
      const next = loadProject(p);           // load first: a bad path must not drop the project already open
      activePath = next.filePath;
      cached = next;
      return next.overview();
    }
  },
  {
    name: 'project_overview',
    description: 'Start here. Identity, last save, row counts, content vs non-content split, decision (KKE) mix, review progress, sitemap size, source sites, libraries, and saved filter names.',
    inputSchema: { type: 'object', properties: {} },
    run: () => project().overview()
  },
  {
    name: 'describe_columns',
    description: 'What fields exist and which are worth grouping by. Without `columns`: every field with its filled / blank / distinct counts, plus the virtual fields. With `columns`: the top values of those fields. Crawl exports carry 100+ columns; call this before grouping or filtering on one you have not seen.',
    inputSchema: {
      type: 'object',
      properties: {
        columns: { type: 'array', items: { type: 'string' }, description: 'Fields to profile in detail.' },
        topN: { type: 'integer', description: 'Top values per field (default 10, max 50).' },
        scope: SELECT_PROPS.scope
      }
    },
    run: a => project().describeColumns(a)
  },
  {
    name: 'aggregate',
    description: 'Count rows grouped by one to three fields, optionally filtered. Use this for every "how many" question instead of paging through query_rows. Comma-separated columns (Tags, Audiences, Jobs_Served, Design_Patterns) are split so each value is tallied separately. Example: pages being killed per section → groupBy ["@path_1"], filters [{field:"@effective_kke", operator:"equals", value:"Kill"}, {field:"@content_kind", operator:"equals", value:"content"}].',
    inputSchema: {
      type: 'object',
      properties: {
        groupBy: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3, description: 'Column names or virtual fields.' },
        ...SELECT_PROPS,
        splitCsv: { type: 'boolean', description: 'Set false to group comma-separated cells as whole strings. Default true.' },
        limit: { type: 'integer', description: 'Max groups returned, largest first (default 100, max 1000).' }
      },
      required: ['groupBy']
    },
    run: a => project().aggregate(a)
  },
  {
    name: 'query_rows',
    description: 'List matching rows, projected to chosen columns. Paged: default 25 rows, max 200. Long cells are truncated — use get_row for a full page record. Always name `columns`; the default is just URL, title, status code and effective KKE.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SELECT_PROPS,
        columns: { type: 'array', items: { type: 'string' }, description: 'Column names or virtual fields. The URL is always included.' },
        sortBy: { type: 'string' },
        sortDir: { type: 'string', enum: ['asc', 'desc'] },
        limit: { type: 'integer' },
        offset: { type: 'integer' }
      }
    },
    run: a => project().queryRows(a)
  },
  {
    name: 'get_row',
    description: 'Everything about one page, by URL: all non-blank fields, derived facts, its sitemap node, which pages consolidate into it, and its change history (who decided what, when).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The page URL as it appears in the crawl. Trailing slash and case are forgiven.' },
        includeInternal: { type: 'boolean', description: 'Include internal "_" bookkeeping columns. Default false.' },
        historyLimit: { type: 'integer', description: 'Change-log entries to include (default 50).' }
      },
      required: ['url']
    },
    run: a => project().getRow(a)
  },
  {
    name: 'get_sitemap',
    description: 'The new-site sitemap tree (or one subtree) with page counts per node. Default depth 2; pass rootId to drill into a section, or depth 0 for everything (capped by maxNodes).',
    inputSchema: {
      type: 'object',
      properties: {
        rootId: { type: 'string', description: 'A node id (from a previous get_sitemap, or a row\'s Sitemap_ID).' },
        depth: { type: 'integer', description: 'Levels to show from the root(s). Default 2; 0 = unlimited.' },
        maxNodes: { type: 'integer', description: 'Default 300, max 2000.' }
      }
    },
    run: a => project().getSitemap(a)
  },
  {
    name: 'get_redirects',
    description: 'Redirect rules and their provenance. mode "summary" (default): per source site, how many are set, deliberately 404, or owed but still blank, and who wrote them. mode "list": the rules themselves, paged. Covers every row with a destination plus Kill/Consolidate rows still owing one.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['summary', 'list'] },
        provenance: { type: 'string', enum: ['auto', 'manual', 'inherited', 'unknown'], description: 'auto = derived from the sitemap; manual = a person chose it; inherited = the live site already redirected this URL; unknown = written before provenance was recorded.' },
        state: { type: 'string', enum: ['none', '404', 'set'] },
        ...SELECT_PROPS,
        limit: { type: 'integer' },
        offset: { type: 'integer' }
      }
    },
    run: a => project().getRedirects(a)
  },
  {
    name: 'get_changelog',
    description: 'The audit trail: every logged change with timestamp, auditor, URL, field, old and new value — newest first. Filter by url / field / auditor / date, or pass summary:true for counts by field and by auditor.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        field: { type: 'string', description: 'e.g. KKE_Recommendation, Final_KKE, "(row deleted)"' },
        auditor: { type: 'string' },
        since: { type: 'string', description: 'ISO timestamp, inclusive.' },
        until: { type: 'string', description: 'ISO timestamp, inclusive.' },
        summary: { type: 'boolean' },
        limit: { type: 'integer', description: 'Default 50, max 500.' },
        offset: { type: 'integer' }
      }
    },
    run: a => project().changelog(a)
  },
  {
    name: 'propose_changes',
    description: 'Queue proposed changes for the auditor to accept or reject in Transmission. This is the ONLY way to change anything, and it changes nothing by itself: each item is a request — page URL, field, value, and the reason — that a person reviews in the app (sidebar "Proposals" button). Call it only when the person has asked you to queue proposals (e.g. after confirming a section-review worksheet); never speculatively. Allowed fields: ' + Object.keys(PROPOSAL_FIELDS).join(', ') + '. Controlled fields are checked against this project\'s own vocabularies (KKE states, audience and job libraries); Consolidate is refused (it needs a target only the app can set); Tags/Audiences/Jobs_Served ADD to the cell, Notes appends to an existing note, the rest replace. A whole batch is validated before anything is written; a pending proposal for the same page + field is replaced by the newer one.',
    inputSchema: {
      type: 'object',
      properties: {
        changes: {
          type: 'array', minItems: 1,
          items: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The page URL as it appears in the crawl.' },
              field: { type: 'string', description: 'One of the allowed fields.' },
              value: { type: 'string', description: 'The proposed value. For Tags / Audiences / Jobs_Served, one or more comma-separated values to add.' },
              rationale: { type: 'string', description: 'Why — one sentence the auditor reads before accepting. Required.' }
            },
            required: ['url', 'field', 'value', 'rationale']
          }
        },
        source: { type: 'string', description: 'What produced these, e.g. "section-review /news". Shown to the auditor.' },
        batch: { type: 'string', description: 'Optional batch id to group a run; generated when omitted.' }
      },
      required: ['changes']
    },
    readOnly: false,
    run: a => project().proposeChanges(a)
  },
  {
    name: 'list_proposals',
    description: 'Proposals queued for this project and their status (pending / accepted / rejected), each with the field\'s current value so you can see whether a pending one is still relevant. Use it to avoid re-proposing what is already queued, and to see what the auditor accepted or rejected from an earlier batch.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'all'], description: 'Default pending.' },
        batch: { type: 'string' },
        limit: { type: 'integer', description: 'Default 100, max 1000.' },
        offset: { type: 'integer' }
      }
    },
    run: a => project().listProposals(a)
  },
  {
    name: 'get_libraries',
    description: 'The project\'s controlled vocabularies and workshop output. Without `which`: what exists and how big. With `which`: the contents — identity, kkeStates, audiences (with tiers), jobs, sites, contentTypes (current→target crosswalk), targetSpecs, pageStatuses, assignees, contentThemes, glossary, savedFilters, menus.',
    inputSchema: {
      type: 'object',
      properties: { which: { type: 'array', items: { type: 'string' } } }
    },
    run: a => project().getLibraries(a)
  }
];

const RESOURCES = [
  {
    uri: 'transmission://semantics',
    name: 'How to read a Transmission audit',
    description: 'What blank means, Kill vs Exclude vs Consolidate, content vs non-content rows, redirect provenance, audiences. Read before quoting numbers.',
    mimeType: 'text/markdown',
    read: () => SEMANTICS_MD
  },
  {
    uri: 'transmission://project/glossary',
    name: 'Project glossary',
    description: 'This project\'s own definitions for its tags and groups.',
    mimeType: 'text/markdown',
    read: () => {
      const g = project().settings.glossary || {};
      const section = (title, o) => {
        const names = Object.keys(o || {}).filter(k => String(o[k] || '').trim()).sort();
        return `## ${title}\n\n` + (names.length ? names.map(n => `### ${n}\n\n${o[n]}`).join('\n\n') : '_None defined._');
      };
      return `# Glossary\n\n${section('Tags', g.tags)}\n\n${section('Groups', g.groups)}\n`;
    }
  }
];

// ─── JSON-RPC ────────────────────────────────────────────────────────────────

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handle(method, params) {
  switch (method) {
    case 'initialize': {
      const asked = params && params.protocolVersion;
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS
      };
    }
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOLS.map(({ name, description, inputSchema, readOnly }) => ({ name, description, inputSchema, annotations: { readOnlyHint: readOnly !== false, destructiveHint: false } })) };
    case 'tools/call': {
      const tool = TOOLS.find(t => t.name === (params && params.name));
      if (!tool) throw rpcError(-32602, `Unknown tool: ${params && params.name}`);
      // A tool that fails is a RESULT the model should read and correct from
      // (wrong field name, no project open) — not a protocol error.
      try {
        const result = tool.run((params && params.arguments) || {});
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: e.message }], isError: true };
      }
    }
    case 'resources/list':
      return { resources: RESOURCES.map(({ uri, name, description, mimeType }) => ({ uri, name, description, mimeType })) };
    case 'prompts/list':
      return { prompts: listPrompts() };
    case 'prompts/get':
      try { return getPrompt(params && params.name, params && params.arguments); }
      catch (e) { throw e.invalidParams ? rpcError(-32602, e.message) : e; }
    case 'resources/templates/list':
      return { resourceTemplates: [] };
    case 'resources/read': {
      const res = RESOURCES.find(r => r.uri === (params && params.uri));
      if (!res) throw rpcError(-32002, `Unknown resource: ${params && params.uri}`);
      return { contents: [{ uri: res.uri, mimeType: res.mimeType, text: res.read() }] };
    }
    default:
      throw rpcError(-32601, `Method not found: ${method}`);
  }
}

function rpcError(code, message) {
  const e = new Error(message);
  e.rpcCode = code;
  return e;
}

function onLine(line) {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); }
  catch (_) { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); return; }

  const isRequest = msg && msg.id !== undefined && msg.id !== null && typeof msg.method === 'string';
  if (!isRequest) return;   // notifications (initialized, cancelled) and stray responses need no reply

  try {
    send({ jsonrpc: '2.0', id: msg.id, result: handle(msg.method, msg.params) });
  } catch (e) {
    send({ jsonrpc: '2.0', id: msg.id, error: { code: e.rpcCode || -32603, message: e.message } });
  }
}

function main() {
  const initial = argProject();
  if (initial) {
    // Deferred to first use, so a bad --project surfaces as a readable tool
    // error the model can relay, not a server that dies before the handshake.
    activePath = path.resolve(initial);
  }
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', onLine);
  rl.on('close', () => process.exit(0));
}

if (require.main === module) main();

module.exports = { handle, TOOLS, RESOURCES };
