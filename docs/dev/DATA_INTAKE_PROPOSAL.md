# Proposal: Data Intake Checks

**Status:** proposed
**Date:** 2026-11-23

**Scope:** check the data at the edges, when a crawl is opened, when another file is merged in, and when a project is saved, so that problems in the inventory are found and named before anyone starts making decisions on top of them.

Prompted by a talk on AI for SEO (Sam Torres) whose data-validation slide reads:

- Validate on load
- Validate before saving
- Fail LOUDLY, and name what failed
- Audit how many rows passed and failed
- Check totals against the source

Her examples were the Python libraries pydantic and pandera. The idea carries over directly. The libraries don't, and don't need to: this is a declarative table of expectations plus a pure checking module, in the same style as `src/terminology.js`.

---

## 1. The problem

Every number in a client report rests on the inventory being what we think it is. Today the app trusts its inputs almost completely, and the ways they go wrong are familiar from real engagements:

- **Header variants.** `Clicks`, `clicks` and `Clicks ` (trailing space) are three different columns. A GSC export joined to a crawl that already had a `clicks` column produces two half-empty columns, and whichever one a report reads is wrong.
- **URL counts that blow up or shrink.** A page×query GSC export has many rows per URL. A crawl run twice and pasted together has every URL twice. Case, trailing slashes, `http`/`https` and `www.` decide whether two rows are "the same page", and each merge path decides that differently or not at all.
- **Silent drops.** A merge that matches 4,100 of 4,600 rows reports "4,100 URLs matched" and nothing about the 500 it couldn't place, or the clicks attached to them.

None of these is visible in the UI. They surface weeks later as a figure that doesn't reconcile with the client's own analytics.

## 2. What exists today

| Check | Where | Loud? |
|---|---|---|
| Exact-duplicate header names merged forward | `readWorkbook()` in main.js → `dedupReport` → toast in `loadData()` | Yes (toast) |
| Non-200 status codes | `openNon200TriageDialog()` | Offered on open |
| URL variants by canonical | `classifyUrlVariants()` | Offered on open |
| Duplicate content fingerprints | `detectDuplicates()` | Sidebar filter |
| Content vs non-content rows | `nonContentKind()` | In reports |

The last four are **content findings**: they assume the data is sound and ask what it says. Only the first is a **data-quality check**, and it is exact-match, so it misses every case-variant or whitespace header.

### Silent behavior found while writing this

All three merge paths build a URL lookup the same way:

```js
const importMap = new Map();
data.rows.forEach(row => {
  const url = String(row[impUrlCol] || '').trim().toLowerCase();
  if (url) importMap.set(url, row);
});
```

in `importMergeAudit()`, `mergeAuditorDecisions()` and `smeImport()`. Two consequences:

1. **A repeated URL in the incoming file is silently overwritten**. The last row wins and the others vanish. For a GSC page×query export that means one arbitrary query's clicks are kept and the rest are dropped. For an SME worksheet where a reviewer duplicated a row to annotate it, one of their two answers is lost.
2. **Lowercasing the whole URL collapses paths that differ only by case.** `/About` and `/about` are distinct URLs on most servers (and genuinely distinct pages on some), but they merge as one.

Meanwhile trailing slash, scheme and `www.` differences are *not* normalized, so `https://www.x.edu/a/` and `https://x.edu/a` fail to match, and are not reported either.

Also on load: a crawl containing the same Address twice opens with both rows and no warning. The consolidate picker already works around this (it excludes candidates by URL as well as index "since a crawl can list one Address twice"), which is good evidence it happens.

## 3. Proposal

### 3.1 A declarative intake schema (`src/intake-checks.js`)

A pure UMD module, with no DOM, no Node APIs and no dependencies, loaded by main and the renderer, and copied byte-identical to `mcp/lib/intake-checks.js` (with a drift test, as `terminology.js` has).

It holds **source profiles**: what a given export is expected to contain.

```js
{
  id: 'screaming-frog',
  label: 'Screaming Frog crawl',
  detect: ['Address', 'Status Code', 'Indexability'],   // headers that identify it
  key: 'Address',
  columns: {
    'Address':      { type: 'url',    required: true, unique: true },
    'Status Code':  { type: 'status', required: true },
    'Word Count':   { type: 'int' },
    'Crawl Timestamp': { type: 'date' },
  },
}
```

Initial profiles: Screaming Frog crawl, GSC Pages export, GSC page×query export, GA4 landing-page export, Transmission SME worksheet. A file that matches no profile still gets the generic checks (§3.2), with no type checks.

Types: `url`, `status`, `int`, `number` (accepts `1,234`, the same parse as `fieldFilterNumber()`), `percent`, `date`, `text`. Each column also carries **aliases**, because the same export has changed column names between tool versions.

Nothing in the profile is enforced by refusing to open a file. A profile only describes what to expect, so the report can say exactly what didn't match.

### 3.2 Load-time checks

Run on the first open of a crawl, after **Save As Project**, and on demand (**Project → Check Data…**). Each check has a stable id, a human name, a severity, and the list of rows or columns it failed on.

| id | Check | Severity |
|---|---|---|
| `header-near-dupe` | Headers equal after case-folding and trimming (`Clicks` / `clicks ` / `CLICKS`) | error |
| `header-missing` | A profile's required column is absent (after aliases) | error |
| `url-blank` | Row has no value in the URL column | error |
| `url-unparseable` | URL column value isn't an absolute URL | error |
| `url-dupe-exact` | Same Address on more than one row | error |
| `url-dupe-loose` | Addresses equal after trailing slash / scheme / `www.` folding (reported separately from exact, because some are real distinct pages) | warning |
| `url-case-only` | Addresses differing only by path case | warning |
| `mixed-scheme` | Both `http://` and `https://` for one host | warning |
| `type-mismatch` | A typed column holds a value that doesn't parse (e.g. `Status Code` = `Blocked by robots.txt`) | warning |
| `empty-column` | A column is blank on every row | info |
| `row-count` | Rows loaded vs. non-empty rows in the sheet (catches `sheet_to_json` truncation and stray blank lines) | error if they differ |

**Severity decides how loud, not whether the file opens.** The auditor needs the file open to fix it, so even an error-level finding only means the report opens immediately and stays visible until it's looked at.

### 3.3 The intake report

A modal (`openModal()`), opened automatically when any check at warning level or above fails, otherwise available from the menu:

> **Data check: `alpha-edu-crawl-2026-11.xlsx`** (Screaming Frog crawl)
> 12,400 rows read · **12,354 passed** · **46 failed** on 3 checks
>
> ✗ **Duplicate Address**: 23 URLs appear twice  [Show these rows]
> ✗ **Header near-duplicates**: `Clicks`, `clicks`  [Merge into "Clicks"]
> ⚠ **Status Code not a number**: 23 rows (`Blocked by robots.txt`)  [Show these rows]

- **Show these rows** applies an `_intake-failed:<checkId>` special filter (registered in `applyFilter()`'s `specialFilters`), so the auditor fixes things in the normal sidebar and Table View.
- **Merge into "…"** reuses the existing merge-forward logic from `readWorkbook()`: blanks are filled, conflicts are kept and counted. The logic is lifted into the shared module so it can apply case-insensitively.
- **Remove duplicate rows** for `url-dupe-exact` routes through the existing `openDeleteRowsDialog()` with the second and later copies pre-selected, so the typed confirmation and change logging stay as they are. When the duplicates disagree on a field, the dialog says so before deleting.

### 3.4 Merge reconciliation (the highest-value piece)

Replace the three hand-built lookups with one shared `buildImportIndex(rows, urlCol, opts)` that **never silently overwrites**:

1. **Duplicate keys in the incoming file are a finding, not an overwrite.** The merge dialog shows "412 URLs appear more than once in this file" and asks how to combine them, per numeric column: **sum** (the right answer for GSC clicks/impressions by query), **first**, **last**, or **skip those URLs**. Text columns default to first, and differing values are counted as conflicts.
2. **Match on a defined key**, not ad hoc lowercasing: exact first, then a loose match (trailing slash, scheme, `www.`, host case) that is *reported* rather than silent. The path stays case-sensitive by default, with an opt-in.
3. **Unmatched rows are bucketed by cause**: would match if trailing slash ignored, would match on the other scheme, host not in the crawl, path not in the crawl. Each bucket gets a count and a **Copy URLs** button.
4. **Totals against the source.** For every numeric column being merged:

   > **Clicks**: 48,210 in file · 45,906 landed in inventory · **2,304 not placed** (4.8%)
   >  ↳ 1,880 on URLs not in the crawl · 424 combined from duplicate rows (sum)

   This is the number a strategist can take to a client: "the analytics we're using account for 95% of the clicks in your export; here's where the other 5% went."

The SME import and Merge Auditor paths get points 1–3. Point 4 only matters where numbers are merged.

### 3.5 Pre-save invariants

Checked in the renderer before `buildSavePayload()` hands off, against a baseline taken at load:

- Row count changed only by known operations (`deleteRows()`, `addNewRow()`, `promoteHubNodeToRow()`, merge "add new rows"). Those already go through a handful of functions, which would each record their delta.
- Headers are unique case-insensitively.
- No row has lost its URL.
- Every `Sitemap_ID` and `_ConsolidateTargetId` resolves (counted, not repaired; repair belongs to the existing tools).

**A failed invariant warns loudly and still saves.** Refusing to save puts an afternoon of decisions at risk, which is worse than a bad save that the rolling backup (`userData/backups/`) can recover from. The warning names the invariant and offers to open the backups folder. This is the one place in the proposal where I'd want a second opinion (see §6).

### 3.6 Intake log

Each check run and merge appends a compact record to `projectSettings.intakeLog`:

```js
{ at, kind: 'load'|'merge'|'save', file, profile, read, passed, failed,
  checks: { 'url-dupe-exact': 23, ... }, totals: { Clicks: { file, landed } } }
```

It travels with the project, which makes it usable by:

- **The Executive Summary**: one line under the crawl figures ("Data checked on load: 46 rows flagged, 23 duplicates removed"). It is shown only when the log exists, so old projects render unchanged.
- **The MCP server**: a `data_checks` tool returning the log, plus a line in `mcp/lib/semantics.js` telling a Claude session to cite it before quoting totals. The `ask-the-audit` skill already insists every figure be reproducible, and this extends that to "and say whether the inputs were checked."

## 4. Phasing

1. **Merge reconciliation** (§3.4). It fixes data loss that happens today, and it is self-contained: one shared index builder, three call sites, and the merge dialog's result view.
2. **Shared module + load-time checks + intake report** (§3.1–3.3), starting with the generic checks; source profiles follow.
3. **Intake log + report/MCP surfacing** (§3.6).
4. **Pre-save invariants** (§3.5).

## 5. Testing

- `test/intake-checks.test.js`: each check against small fixtures, including the boring-but-real cases: trailing-space headers, `1,234`, `Blocked by robots.txt` in Status Code, `/About` vs `/about`, a sheet with a blank line in the middle.
- `test/merge-reconcile.test.js`: a page×query fixture whose summed clicks must equal the source total, and whose unmatched buckets must add up to the row count.
- A drift test asserting `src/intake-checks.js` and `mcp/lib/intake-checks.js` are byte-identical.
- The invariant that **a clean file produces no report and no behavior change**, so existing projects are untouched.

## 6. Open questions

1. **Pre-save: warn or block?** The proposal says warn. Is there any invariant (row count?) that should block?
2. **Path case on merge.** Case-sensitive by default is technically right, but some clients' analytics lowercase everything. Should this be per-project, or detected (if the import file has no uppercase paths at all, fold case)?
3. **Re-running on open.** Checks run on first open and on demand. Should a project re-run them every open (cheap: ~13k rows is milliseconds) and only *show* the report when the findings changed?
4. **Remembering acknowledged findings.** Some findings are accepted, not fixed (two distinct pages genuinely differing only by case). Should those be recordable as "reviewed" so the report stops raising them, in the style of `consolidateReviewed`?
