# Import/Merge Audit Decisions — Implementation Notes

These notes document the changes made to the Import/Merge feature. Use them to port the same functionality to another version of the app.

---

## What changed

The original Import/Merge feature silently merged a fixed set of audit columns (KKE_Recommendation, Tags, Notes, Group, PrimaryTag) from an imported file into the current file, matching by URL.

The new version:
1. Opens an imported file (xlsx/xls/csv)
2. If the file has **multiple sheets**, shows a sheet picker dropdown; selecting a sheet loads its columns
3. Shows a **checkbox list** of all columns in the selected sheet (excluding the URL join column)
4. Each column is labeled **"exists"** or **"new"** depending on whether it's already in the current spreadsheet
5. User checks whichever columns they want to import (any number)
6. **Existing columns**: values are merged non-destructively (empty cells filled, existing values preserved)
7. **New columns**: created in the header array immediately after `KKE_Recommendation`, then populated

---

## Files changed

### 1. `main.js` — IPC split into two handlers

The old single `import-audit-merge` handler is replaced with two:

**`import-audit-merge-open`** — Opens the file dialog, reads the workbook, returns sheet names (does NOT read any sheet data yet):

```js
ipcMain.handle('import-audit-merge-open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Audit Decisions',
    filters: [{ name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  try {
    const wb = XLSX.readFile(result.filePaths[0], { type: 'file', raw: false });
    return { filePath: result.filePaths[0], sheetNames: wb.SheetNames };
  } catch (e) {
    return { error: e.message };
  }
});
```

Returns: `{ filePath, sheetNames }` or `null` (cancelled) or `{ error }`.

**`import-audit-merge-read-sheet`** — Reads a specific sheet from an already-opened file:

```js
ipcMain.handle('import-audit-merge-read-sheet', async (event, { filePath, sheetName }) => {
  try {
    const wb = XLSX.readFile(filePath, { type: 'file', raw: false });
    const ws = wb.Sheets[sheetName];
    if (!ws) return { error: `Sheet "${sheetName}" not found` };
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    if (rawData.length < 2) return { error: 'No data rows' };
    const headers = rawData[0].map(String);
    const rows = rawData.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, j) => { obj[h] = row[j] ?? ''; });
      return obj;
    });
    return { headers, rows, filePath, sheetName };
  } catch (e) {
    return { error: e.message };
  }
});
```

Returns: `{ headers, rows, filePath, sheetName }` or `{ error }`.

### 2. `preload.js` — Two new API methods

Replace the old `importAuditMerge` with:

```js
importAuditMergeOpen: () => ipcRenderer.invoke('import-audit-merge-open'),
importAuditMergeReadSheet: (opts) => ipcRenderer.invoke('import-audit-merge-read-sheet', opts),
```

### 3. `src/index.html` — Modal markup

Added before the "Export filtered rows confirm" section. Includes a sheet picker row (hidden when single-sheet) and a column checkbox list:

```html
<!-- Import/Merge column picker -->
<div id="import-merge-overlay" class="modal-overlay hidden"></div>
<div id="import-merge-modal" class="hidden">
  <div id="import-merge-header">
    <span class="modal-title">Import Audit Decisions</span>
    <button id="btn-import-merge-close" class="icon-btn">✕</button>
  </div>
  <div id="import-merge-body">
    <p id="import-merge-file-info"></p>
    <div id="import-merge-sheet-row" class="hidden">
      <label for="import-merge-sheet-select">Sheet:</label>
      <select id="import-merge-sheet-select"></select>
    </div>
    <label>Select columns to import:</label>
    <div id="import-merge-col-list"></div>
  </div>
  <div id="import-merge-footer">
    <button id="btn-import-merge-cancel" class="btn btn-sm btn-ghost">Cancel</button>
    <button id="btn-import-merge-apply" class="btn btn-sm btn-primary">Import</button>
  </div>
</div>
```

- `#import-merge-overlay` — click-to-dismiss backdrop
- `#import-merge-sheet-row` — hidden when file has only one sheet, shown with dropdown when multiple
- `#import-merge-col-list` — container for dynamically generated checkbox rows
- `#import-merge-file-info` — shows "filename → sheetName — N rows, N columns"

### 4. `src/styles.css` — Modal styles

Added a new section `/* ── Import/Merge modal ── */`:

```css
/* ── Import/Merge modal ─────────────────────────────────────────────────── */

#import-merge-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 400;
}

#import-merge-modal {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  width: 420px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.3);
}

#import-merge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

#import-merge-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

#import-merge-body label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-top: 4px;
}

#import-merge-body p {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

#import-merge-sheet-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

#import-merge-sheet-select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  font-family: var(--font-sans);
  background: var(--bg-main);
}

#import-merge-col-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-main);
}

#import-merge-col-list label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text);
  cursor: pointer;
  margin: 0;
}

#import-merge-col-list label:hover {
  background: var(--bg-hover);
}

/* "exists" badge (blue) */
#import-merge-col-list label .import-col-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--accent);
  color: #fff;
  flex-shrink: 0;
}

/* "new" badge (green/evolve color) */
#import-merge-col-list label .import-col-badge-new {
  background: var(--kke-evolve);
}

#import-merge-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}
```

Adjust CSS variable names to match the target app's theme tokens.

### 5. `src/renderer.js` — Two functions

#### `importMergeAudit()` — Main flow

```js
async function importMergeAudit() {
  if (state.editedRows.length === 0) { showToast('Open a file first', 'error'); return; }

  // Step 1: Open file and get sheet names
  const fileInfo = await window.electronAPI.importAuditMergeOpen();
  if (!fileInfo) return;
  if (fileInfo.error) { showToast('Import error: ' + fileInfo.error, 'error'); return; }

  // Step 2: Show modal — user picks sheet (if multiple) + columns
  const result = await showImportMergeModal(fileInfo);
  if (!result) return;

  const { selectedColumns, data } = result;
  const urlCol = state.urlColumn || 'Address';
  const impUrlCol = data.headers.find(h => h.toLowerCase() === urlCol.toLowerCase());
  if (!impUrlCol) {
    showToast(`Selected sheet missing "${urlCol}" column`, 'error');
    return;
  }

  // Ensure each selected column exists in current headers
  const kkeIdx = state.headers.indexOf(kkeCol());
  let insertOffset = 0;
  for (const col of selectedColumns) {
    if (!state.headers.includes(col)) {
      const insertAt = kkeIdx >= 0 ? kkeIdx + 1 + insertOffset : state.headers.length;
      state.headers.splice(insertAt, 0, col);
      state.editedRows.forEach(row => { row[col] = row[col] || ''; });
      insertOffset++;
    }
  }

  // Build lookup from imported data by URL
  const importMap = new Map();
  data.rows.forEach(row => {
    const url = String(row[impUrlCol] || '').trim().toLowerCase();
    if (url) importMap.set(url, row);
  });

  // Merge selected columns by URL match
  let merged = 0;
  let skipped = 0;
  let matched = 0;

  state.editedRows.forEach(row => {
    const url = String(row[urlCol] || '').trim().toLowerCase();
    if (!url) return;
    const imp = importMap.get(url);
    if (!imp) return;
    matched++;
    for (const col of selectedColumns) {
      const impVal = String(imp[col] || '').trim();
      const curVal = String(row[col] || '').trim();
      if (impVal && !curVal) {
        row[col] = impVal;
        merged++;
      } else if (impVal && curVal && impVal !== curVal) {
        skipped++;
      }
    }
  });

  setDirty(true);
  applyFilter();
  if (state.selectedIndex !== null) {
    renderMetaFields(state.editedRows[state.selectedIndex]);
    populateAuditFields(state.editedRows[state.selectedIndex]);
  }
  const parts = [`${matched} URLs matched`, `${merged} values imported`];
  if (skipped) parts.push(`${skipped} kept existing`);
  showToast(parts.join(', '), 'success');
}
```

Key behaviors:
- **URL matching** is case-insensitive, trimmed
- **New columns** splice into `state.headers` after KKE_Recommendation, preserving order of selection
- **Each new column** gets an empty string default in every existing row
- **Non-destructive merge**: only writes to empty cells; if both have values and they differ, it counts as "skipped" (kept existing)
- After merge: marks dirty, re-applies filter, re-renders meta fields

#### `showImportMergeModal(fileInfo)` — Promise-based modal with sheet picker

The modal receives `{ filePath, sheetNames }` (NOT the sheet data). It loads sheet data on demand when the user picks a sheet.

```js
function showImportMergeModal(fileInfo) {
  return new Promise(resolve => {
    const overlay    = document.getElementById('import-merge-overlay');
    const modal      = document.getElementById('import-merge-modal');
    const colList    = document.getElementById('import-merge-col-list');
    const info       = document.getElementById('import-merge-file-info');
    const sheetRow   = document.getElementById('import-merge-sheet-row');
    const sheetSel   = document.getElementById('import-merge-sheet-select');
    const btnApply   = document.getElementById('btn-import-merge-apply');
    const btnCancel  = document.getElementById('btn-import-merge-cancel');
    const btnClose   = document.getElementById('btn-import-merge-close');

    const fileName = fileInfo.filePath ? fileInfo.filePath.split('/').pop() : 'imported file';
    const { sheetNames, filePath } = fileInfo;
    let currentData = null; // holds { headers, rows } for selected sheet

    // Sheet picker — show only if multiple sheets
    if (sheetNames.length > 1) {
      sheetRow.classList.remove('hidden');
      sheetSel.innerHTML = '';
      sheetNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sheetSel.appendChild(opt);
      });
    } else {
      sheetRow.classList.add('hidden');
    }

    // Load a sheet's data and populate the column list
    async function loadSheet(sheetName) {
      colList.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:12px;">Loading...</div>';
      btnApply.disabled = true;
      const data = await window.electronAPI.importAuditMergeReadSheet({ filePath, sheetName });
      if (data.error) {
        colList.innerHTML = `<div style="padding:10px;color:var(--kke-kill);font-size:12px;">${data.error}</div>`;
        currentData = null;
        return;
      }
      currentData = data;
      info.textContent = `${fileName} → ${sheetName} — ${data.rows.length} rows, ${data.headers.length} columns`;
      populateColList(data.headers);
      btnApply.disabled = false;
    }

    function populateColList(headers) {
      const urlCol = state.urlColumn || 'Address';
      colList.innerHTML = '';
      headers.forEach(h => {
        if (h.toLowerCase() === urlCol.toLowerCase()) return;
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = h;
        label.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = h;
        label.appendChild(span);
        const exists = state.headers.includes(h);
        const badge = document.createElement('span');
        badge.textContent = exists ? 'exists' : 'new';
        badge.className = exists ? 'import-col-badge' : 'import-col-badge import-col-badge-new';
        label.appendChild(badge);
        colList.appendChild(label);
      });
    }

    // Wire sheet change
    sheetSel.addEventListener('change', onSheetChange);
    function onSheetChange() { loadSheet(sheetSel.value); }

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');

    // Load first sheet immediately
    loadSheet(sheetNames[0]);

    function cleanup() {
      overlay.classList.add('hidden');
      modal.classList.add('hidden');
      sheetSel.removeEventListener('change', onSheetChange);
      btnApply.removeEventListener('click', onApply);
      btnCancel.removeEventListener('click', onCancel);
      btnClose.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onCancel);
    }

    function onApply() {
      if (!currentData) { showToast('No sheet data loaded', 'error'); return; }
      const checked = [...colList.querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
      if (checked.length === 0) { showToast('Select at least one column', 'error'); return; }
      cleanup();
      resolve({ selectedColumns: checked, data: currentData });
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    btnApply.addEventListener('click', onApply);
    btnCancel.addEventListener('click', onCancel);
    btnClose.addEventListener('click', onCancel);
    overlay.addEventListener('click', onCancel);
  });
}
```

Key design decisions:
- **Lazy sheet loading**: the file is opened once (getting sheet names), then each sheet is read on demand via a second IPC call. This avoids reading all sheets upfront for large workbooks.
- **Sheet picker hidden for single-sheet files**: the dropdown only appears when `sheetNames.length > 1`.
- **Column list refreshes on sheet change**: switching sheets clears the checkbox list, shows "Loading...", then repopulates with the new sheet's columns.
- **Import button disabled while loading**: prevents submitting before sheet data is ready.
- The modal resolves with `{ selectedColumns: string[], data: { headers, rows, filePath, sheetName } }` or `null` on cancel.

---

## Assumptions / dependencies

- `state.urlColumn` holds the detected URL column name (e.g. `'Address'`)
- `state.headers` is a mutable array of column names
- `state.editedRows` is the mutable working copy of row objects
- `kkeCol()` returns the current KKE_Recommendation column name
- `setDirty(true)`, `applyFilter()`, `renderMetaFields()`, `populateAuditFields()`, `showToast()` exist
- `window.electronAPI.importAuditMergeOpen()` — opens file dialog, returns `{ filePath, sheetNames }` or `null`/`{ error }`
- `window.electronAPI.importAuditMergeReadSheet({ filePath, sheetName })` — reads one sheet, returns `{ headers, rows, filePath, sheetName }` or `{ error }`
- The menu sends `menu-import-merge` to the renderer, which calls `importMergeAudit()`
- The menu item and its `onMenuImportMerge` listener are unchanged

---

## Additional change: Full-width fields in field bar

In `renderMetaFields()` in `renderer.js`, a `fullWidthFields` Set was added so that certain fields always get their own row in the field bar (using the existing `meta-full` CSS class with `flex-basis: 100%`):

```js
// Added inside renderMetaFields(), before the sizeClass function:
const fullWidthFields = new Set(['Nav Destination', 'Computed Path']);

// Then in sizeClass(), after the title check:
if (fullWidthFields.has(header)) return 'meta-full';
```

Add any long-value field names to `fullWidthFields` to force them onto their own row.

---

## Additional change: Duplicate slug validation in nav assignment

In `renderer.js`, a new helper function checks for duplicate slugs within a nav branch:

```js
/** Check if a slug already exists among a node's children (case-insensitive). */
function navSlugExistsInBranch(parentNode, slug, excludeNodeId) {
  const children = parentNode.children || [];
  const slugLower = slug.toLowerCase();
  return children.some(child =>
    child.id !== excludeNodeId &&
    (child.path || '').toLowerCase() === slugLower
  );
}
```

Parameters:
- `parentNode` — the nav node whose children to check
- `slug` — the slug being assigned
- `excludeNodeId` — optional, the ID of a node to skip (used when editing an existing node's slug so it doesn't flag itself)

### Where the check is applied

**1. `assignNav()` — Assign button in nav popover**

Added before `createNavChildForPage()`, when `pageSlug` is non-empty:

```js
if (pageSlug) {
  // Check for duplicate slug in this branch
  if (navSlugExistsInBranch(node, pageSlug)) {
    showToast(`Slug "${pageSlug}" already exists under "${node.label}"`, 'error');
    els.navSlugInput.focus();
    return;
  }
  // ... rest of child creation
}
```

Here `node` is the selected parent node (the node the user picked in the nav popover dropdowns).

**2. `els.navSlugInput` change handler — editing slug of an already-assigned page**

Added after finding the assigned node, before updating `Computed Path`:

```js
const slug = els.navSlugInput.value.trim();
// Check for duplicate slug among siblings
const parentNode = state.navNodes.find(n => (n.children || []).some(c => c.id === node.id));
if (slug && parentNode && navSlugExistsInBranch(parentNode, slug, node.id)) {
  showToast(`Slug "${slug}" already exists under "${parentNode.label}"`, 'error');
  els.navSlugInput.focus();
  return;
}
```

Here `node` is the page's own child node (found via `row['NavID']`), so we look up its parent to check siblings. `node.id` is passed as `excludeNodeId` so the current node doesn't conflict with itself.

**3. Drag-and-drop (`assignNavToRow`)** — NOT checked, because drag-drop assigns directly to a node without a slug (no child created, no slug conflict possible).

### Assumptions
- Nav nodes have a `path` property that stores the slug (the last segment of the URL path)
- Nav nodes have a `children` array
- `state.navNodes` is the flat list of all nav nodes
- `els.navSlugInput` is the slug text input in the nav popover

---

## Additional change: Highlight duplicate slugs in nav tree view

The nav editor tree view now visually highlights nodes that share a slug with a sibling.

### `renderer.js` — `buildDuplicateSlugSet()` + rendering changes

A new function computes all duplicate-slug node IDs across the tree:

```js
/** Build a Set of node IDs that have a duplicate slug among their siblings. */
function buildDuplicateSlugSet(roots) {
  const dupes = new Set();
  function scan(children) {
    if (!children || children.length === 0) return;
    const bySlug = {};
    for (const child of children) {
      const slug = (child.path || '').trim().toLowerCase();
      if (!slug) continue;
      if (!bySlug[slug]) bySlug[slug] = [];
      bySlug[slug].push(child.id);
    }
    for (const ids of Object.values(bySlug)) {
      if (ids.length > 1) ids.forEach(id => dupes.add(id));
    }
    for (const child of children) scan(child.children);
  }
  scan(roots);
  return dupes;
}
```

Called once in `renderNavEditor()` before rendering nodes:
```js
const dupSlugs = buildDuplicateSlugSet(state.navTree);
```

Passed as a 4th parameter to `renderNavEditorNode(node, pageCounts, depth, dupSlugs)` — including the recursive call for children.

In `renderNavEditorNode`, after building the slug cell:
```js
if (dupSlugs && dupSlugs.has(node.id)) {
  slugCell.classList.add('ne-slug-duplicate');
  slugCell.title = 'Duplicate slug in this branch';
}
```

### `styles.css` — Duplicate slug highlight

```css
.ne-slug-duplicate { background: var(--kke-kill-bg, #fff0f0); }
.ne-slug-duplicate input { color: var(--kke-kill); }
```

Uses the "Kill" color scheme (red tones) to signal the conflict. The slug cell gets a light red background and the input text turns red.

### Live update on slug edit

The initial render highlights are static — they're computed once in `renderNavEditor()`. To keep them live when the user edits a slug inline in the tree, a `refreshDuplicateSlugHighlights(node)` function is called from `onNavNodeEdit` when `field === 'path'`:

```js
// At the end of onNavNodeEdit():
if (field === 'path') {
  refreshDuplicateSlugHighlights(node);
}
```

The refresh function:

```js
/** Refresh duplicate-slug highlights for a node's siblings (including itself). */
function refreshDuplicateSlugHighlights(node) {
  // Find siblings: parent's children, or top-level tree if no parent
  const parent = node.parentNumber
    ? state.navNodes.find(n => n.number === node.parentNumber)
    : null;
  const siblings = parent ? (parent.children || []) : state.navTree;

  // Detect duplicates among siblings
  const bySlug = {};
  for (const sib of siblings) {
    const slug = (sib.path || '').trim().toLowerCase();
    if (!slug) continue;
    if (!bySlug[slug]) bySlug[slug] = [];
    bySlug[slug].push(sib.id);
  }
  const dupeIds = new Set();
  for (const ids of Object.values(bySlug)) {
    if (ids.length > 1) ids.forEach(id => dupeIds.add(id));
  }

  // Update DOM for each sibling
  for (const sib of siblings) {
    const wrapper = document.querySelector(`[data-node-id="${sib.id}"]`);
    if (!wrapper) continue;
    const slugCell = wrapper.querySelector('.ne-col-slug');
    if (!slugCell) continue;
    if (dupeIds.has(sib.id)) {
      slugCell.classList.add('ne-slug-duplicate');
      slugCell.title = 'Duplicate slug in this branch';
    } else {
      slugCell.classList.remove('ne-slug-duplicate');
      slugCell.title = '';
    }
  }
}
```

This only rescans the edited node's siblings (not the full tree), so it's fast. It both adds AND removes the highlight class, so fixing a duplicate clears the red immediately.

---

## Feature: Menu item toggle on nav nodes

A new `inMenu` property on nav nodes controls whether a node should appear in the site menu.

### Data model
- **Property**: `node.inMenu` — stored as `'Y'` (in menu) or `''` (not in menu)
- **Sheet column**: `InMenu` in the `NavStructure` sheet

### `main.js` changes

**Parse** — add `inMenu` to the column index lookup in `parseNavSheet()`:
```js
inMenu: h.indexOf('InMenu')
```
And to node construction:
```js
inMenu: idx.inMenu >= 0 ? String(r[idx.inMenu] || '') : '',
```

**Save (rewrite path)** — ensure `InMenu` column exists in headers, add to `colIdx`, write it:
```js
if (!nsHeaders.includes('InMenu')) { nsHeaders.push('InMenu'); nsData[0] = nsHeaders; }
// in colIdx:
inMenu: nsHeaders.indexOf('InMenu')
// in row builder:
if (colIdx.inMenu >= 0) newRow[colIdx.inMenu] = node.inMenu || '';
```

**Save (create-new path)** — add `'InMenu'` to the header array, `node.inMenu || ''` to the row array.

### `index.html` changes

Add a `Menu` column header in `#nav-editor-col-headers`, between Pages and Actions:
```html
<span class="ne-col-hdr ne-col-menu">Menu</span>
```

### `styles.css` changes

```css
.ne-col-menu     { width: 44px; flex-shrink: 0; text-align: center; }
.ne-col-menu input[type="checkbox"] { margin: 0; cursor: pointer; }
```

### `renderer.js` changes

In `renderNavEditorNode()`, after the count cell and before the actions cell, add:

```js
// Menu checkbox
const menuCell = document.createElement('span');
menuCell.className = 'ne-cell ne-col-menu';
const menuCb = document.createElement('input');
menuCb.type = 'checkbox';
menuCb.checked = node.inMenu === 'Y' || node.inMenu === 'y' || node.inMenu === 'true';
menuCb.title = 'Include in menu';
menuCb.addEventListener('change', () => {
  node.inMenu = menuCb.checked ? 'Y' : '';
  setDirty(true);
  state.navTreeDirty = true;
});
menuCell.appendChild(menuCb);
row.appendChild(menuCell);
```

Also ensure `createNavChildForPage()` initializes `inMenu: ''` on new nodes (or it will be `undefined` — the save logic handles this with `|| ''`).

---

## Feature: Bulk assign pages to nav node

Multi-selected sidebar rows can be dragged onto a nav node to assign them all at once. Each page gets a child node created under the target, using its URL's last path segment as slug and its title.

### Sidebar drag (`renderer.js`)

The `dragstart` handler now carries all multi-selected indices as JSON:

```js
item.addEventListener('dragstart', (e) => {
  let indices;
  if (state.multiSelected.size > 0 && state.multiSelected.has(origIndex)) {
    indices = [...state.multiSelected];
  } else {
    indices = [origIndex];
  }
  e.dataTransfer.setData('text/plain', JSON.stringify(indices));
  e.dataTransfer.effectAllowed = 'move';
});
```

### Nav tree drop handler (`renderer.js`)

The drop handler in `renderNavEditorNode` now parses JSON and dispatches:

```js
if (!e.dataTransfer.types.includes('text/nav-node-id') && e.dataTransfer.types.includes('text/plain')) {
  const raw = e.dataTransfer.getData('text/plain');
  let indices;
  try { indices = JSON.parse(raw); } catch (_) { indices = null; }
  if (Array.isArray(indices) && indices.length > 1) {
    bulkAssignNavToRows(indices, node);
  } else {
    const idx = Array.isArray(indices) ? indices[0] : parseInt(raw, 10);
    if (!isNaN(idx)) assignNavToRow(idx, node);
  }
  return;
}
```

### `bulkAssignNavToRows(origIndices, node)` — new function

```js
function bulkAssignNavToRows(origIndices, node) {
  // Redirect reference nodes to target
  if (node.refNodeId) {
    const target = state.navNodes.find(n => n.id === node.refNodeId);
    if (target) {
      showToast(`${node.label} is a reference — assigning to ${target.label} instead`, 'info');
      node = target;
    }
  }

  const urlCol = state.urlColumn || 'Address';
  ['NavID', 'Nav Destination', 'Computed Path', 'Nav_SortID'].forEach(col => {
    if (!state.headers.includes(col)) state.headers.push(col);
  });

  const oldPaths = snapshotNavPaths();
  let assigned = 0;
  let dupes = 0;

  for (const origIndex of origIndices) {
    const row = state.editedRows[origIndex];
    if (!row) continue;

    // Derive slug from URL's last path segment
    const url = row[urlCol] || '';
    let slug = '';
    try {
      const u = new URL(url);
      const segments = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
      slug = segments.length > 0 ? segments[segments.length - 1] : '';
    } catch (_) {
      const segments = url.replace(/\/+$/, '').split('/').filter(Boolean);
      slug = segments.length > 0 ? segments[segments.length - 1] : '';
    }

    const title = row['Title 1'] || row['Title'] || slug || 'untitled';

    // Skip duplicate slugs
    if (slug && navSlugExistsInBranch(node, slug)) {
      dupes++;
      continue;
    }

    if (slug) {
      const childNode = createNavChildForPage(node, slug, title);
      row['NavID']           = childNode.id;
      row['Nav Destination'] = childNode.breadcrumb;
      row['Nav_SortID']      = childNode.sortID;
      row['Computed Path']   = childNode.computedPath;
    } else {
      row['NavID']           = node.id;
      row['Nav Destination'] = node.breadcrumb || node.label;
      row['Nav_SortID']      = node.sortID || '';
      row['Computed Path']   = node.computedPath || '';
    }
    assigned++;
  }

  cascadeNavChangesToRows(oldPaths);
  setDirty(true);
  state.navTreeDirty = true;
  state.multiSelected.clear();
  renderVisibleRows();
  if (_navEditorOpen) renderNavEditor();

  const parts = [`${assigned} pages assigned to ${node.label}`];
  if (dupes) parts.push(`${dupes} skipped (duplicate slugs)`);
  showToast(parts.join(', '), 'success');
}
```

Key behaviors:
- **Slug derivation**: last segment of the URL path (e.g. `https://example.com/blog/my-post/` → `my-post`)
- **Title**: uses `Title 1` column, falls back to `Title`, then slug, then `'untitled'`
- **Duplicate check**: uses `navSlugExistsInBranch()` — skips rows with duplicate slugs (reports count in toast)
- **No slug (homepage)**: assigns directly to the node without creating a child
- **Clears multi-selection** after assignment
- **Re-renders** both sidebar and nav editor

---

## UI change: Remove titlebar icon buttons (except Help)

The titlebar buttons for **Audit Progress (◉)**, **Project Settings (▤)**, and **App Settings (⚙)** were removed from the titlebar. The **Help (?)** button remains. All three features are already accessible via the application menu (File → Project Settings, File → App Settings, Reports → Audit Progress).

### `index.html`

Replace the `#titlebar-actions` div contents — remove the three buttons, keep only Help:

```html
<div id="titlebar-actions">
  <button id="btn-help" class="icon-btn" title="Help">?</button>
</div>
```

### `renderer.js` — Null guards

Since `btn-progress`, `btn-settings`, and `btn-project-settings` no longer exist in the DOM, guard their event listener attachments:

1. `els.btnSettings.addEventListener(...)` → `if (els.btnSettings) els.btnSettings.addEventListener(...)`
2. `els.btnProjectSettings.addEventListener(...)` → `if (els.btnProjectSettings) els.btnProjectSettings.addEventListener(...)`
3. `$('btn-progress').addEventListener(...)` → guard with `const btnProgress = $('btn-progress'); if (btnProgress) btnProgress.addEventListener(...)`

The popover positioning functions (`toggleSettingsPopover`, `toggleProjectSettingsPopover`) already had null guards for the button elements (falling back to fixed positioning at top-right), so no changes needed there.

The click-outside-to-close handlers in the document click listener compare `e.target !== els.btnSettings` etc. — these safely evaluate to `true` when the button is `null`, which is correct (always close when clicking outside).

---

## Feature: Table View (full-width spreadsheet)

A full-width spreadsheet view toggled via View → Table View (Cmd+T). Hides the sidebar for maximum horizontal space. Virtual-scrolled, with independent sort/filter, resizable columns, and a column configuration dialog.

### Files changed

#### `main.js`
- Added `Table View` menu item in View submenu with `CmdOrCtrl+T` accelerator, sends `menu-table-view` IPC
- Added `tableColumns` to the `get-prefs` return object

#### `preload.js`
- Added `onMenuTableView` IPC bridge

#### `index.html`
Added two blocks:

**Table View container** inside `#main-panel` (before closing `</div><!-- /main-panel -->`):
```html
<div id="table-view" class="hidden">
  <div id="table-view-toolbar">
    <span class="table-view-title">Table View</span>
    <input id="table-view-search" type="text" class="tv-search-input" placeholder="Global filter…">
    <span style="flex:1"></span>
    <span id="table-view-stats"></span>
    <button id="btn-table-columns" class="btn btn-sm btn-ghost">Columns…</button>
    <button id="btn-table-view-close" class="btn btn-sm btn-ghost">Back to Audit</button>
  </div>
  <div id="table-view-header-wrap">
    <div id="table-view-col-headers"></div>
    <div id="table-view-col-filters"></div>
  </div>
  <div id="table-view-body-wrap">
    <div id="table-view-body"></div>
  </div>
</div>
```

**Column config modal** (near other modals):
```html
<div id="tv-col-overlay" class="modal-overlay hidden"></div>
<div id="tv-col-modal" class="hidden">
  <div id="tv-col-header">
    <span class="modal-title">Table Columns</span>
    <button id="btn-tv-col-close" class="icon-btn">✕</button>
  </div>
  <div id="tv-col-body"></div>
  <div id="tv-col-footer">
    <button id="btn-tv-col-reset" class="btn btn-sm btn-ghost">Reset Defaults</button>
    <span style="flex:1"></span>
    <button id="btn-tv-col-cancel" class="btn btn-sm btn-ghost">Cancel</button>
    <button id="btn-tv-col-save" class="btn btn-sm btn-primary">Save</button>
  </div>
</div>
```

#### `styles.css`
Added `/* ── Table View */` section with:

- `.tv-active #sidebar, .tv-active #resize-handle { display: none !important; }` — hides sidebar when table is open (class toggled on `#app`)
- `#table-view`: flex column, flex:1, min-height:0
- `#table-view-toolbar`: flex row toolbar with global search, stats, buttons
- `#table-view-header-wrap`: overflow:hidden, synced horizontally with body via JS
- `.tv-col-hdr`: column header cells — flex:none, width set inline, sort arrows, click-to-sort
- `.tv-col-resize`: absolute-positioned resize handle on right edge of headers, cursor:col-resize
- `.tv-filter-cell` / `.tv-filter-input`: per-column filter inputs below headers
- `#table-view-body-wrap`: flex:1, overflow:auto (scroll container)
- `.tv-row`: position:absolute, display:flex, height:28px — virtual scrolled rows
- `.tv-cell`: flex:none, overflow ellipsis, border-right
- `.tv-cell.editing` styles for inline edit inputs
- `#tv-col-modal` + children: column config dialog following existing modal pattern
- `.tv-col-config-item`: draggable row with handle, checkbox, label

#### `renderer.js`

**State variables:**
```js
let _tableViewOpen = false
let _tableSort = { col: '', dir: '' }
let _tableColFilters = {}           // { colName: 'filterStr' }
let _tableGlobalFilter = ''
let _tableColumns = []              // [{ name, visible, width }]
let _tableFilteredRows = []         // [{ row, origIndex }]
const TV_ROW_HEIGHT = 28
const TV_OVERSCAN = 15
```

**Key functions:**

- `setupTableView()` — called from `init()`, wires up event listeners (close button, column config, global search with 150ms debounce, virtual scroll with rAF throttle + horizontal header sync)
- `tvDefaultWidth(colName)` — smart default column widths: 320px URLs, 240px titles, 100px status codes, 80px counts, 150px default
- `ensureTableColumns()` — on first open, builds column config from `state.headers` with smart widths, or reconciles saved prefs with current headers (adds new, removes stale)
- `toggleTableView()` / `openTableView()` / `closeTableView()` — follows redirect editor pattern. Open: closes other panels, adds `.tv-active` on `#app`, shows table. Close: removes `.tv-active`, restores audit view with selection preserved.
- `applyTableFilter()` — independent pipeline: builds from `state.editedRows`, applies global filter, per-column filters, then sort (with numeric detection). Result in `_tableFilteredRows`.
- `renderTableView()` — renders headers + filter row, sets body height for virtual scroll, sets min-width for horizontal scroll, calls `renderTableVisibleRows()`
- `renderTableHeaders(visibleCols)` — column name cells with sort arrows and resize handles
- `renderTableFilterRow(visibleCols)` — per-column filter inputs with 150ms debounce (re-renders body only, preserves filter focus)
- `renderTableVisibleRows()` — virtual scroll: calculates visible range from scrollTop, renders only those rows as absolutely-positioned divs. KKE cells get colored badges.
- `startTvColumnResize(e, col)` — mousedown/mousemove/mouseup drag to resize, persists to prefs on mouseup
- `openTableColumnConfig()` / `closeTableColumnConfig()` / `saveTableColumnConfig()` / `resetTableColumnDefaults()` / `renderTvColConfigList()` — column config dialog with checkbox visibility + drag-to-reorder

**Integration points:**
- `loadData()` resets all table view state
- `openNavEditor()` and `openRedirectEditor()` close table view if open (mutual exclusion)
- IPC listener: `window.electronAPI.onMenuTableView(() => toggleTableView())`
- Prefs: `state.tableColumns` loaded from prefs, `_tableColumns` persisted on column resize and config save

### Assumptions / dependencies
- `state.editedRows`, `state.headers`, `state.selectedIndex`, `kkeCol()` exist
- `$()` is the element-by-id helper
- `selectRow()`, `showToast()`, `setDirty()` exist
- `window.electronAPI.savePrefs()` / `getPrefs()` exist
- The `#app` element wraps sidebar + main-panel (for `.tv-active` class toggle)

---

## Feature: SME Review Workflow

Three-column decision workflow: KKE_Recommendation → SME_Decision → Final_KKE.

### Column Model

| Column | Values | Set by |
|--------|--------|--------|
| `SME_Decision` | Approve, Change: Keep, Change: Kill, Change: Evolve, Change: Exclude (+ custom) | SME |
| `SME_Notes` | Free text | SME |
| `Content_Owner` | Free text | Auditor/SME |
| `Final_KKE` | Same as KKE (Keep/Kill/Evolve/Exclude + custom) | Content strategist |

### main.js changes

**AUDIT_COLUMNS** — add: `'SME_Decision', 'SME_Notes', 'Content_Owner', 'Final_KKE'`

**Candidate arrays** — add:
```js
const SME_DECISION_CANDIDATES = ['SME_Decision', 'SME Decision', 'SME Rec'];
const SME_NOTES_CANDIDATES = ['SME_Notes', 'SME Notes'];
const CONTENT_OWNER_CANDIDATES = ['Content_Owner', 'Content Owner', 'Owner', 'SME'];
const FINAL_KKE_CANDIDATES = ['Final_KKE', 'Final KKE', 'Final Recommendation'];
```

**Column detection** — add to columnMap construction:
```js
smeDecision:  savedMap?.smeDecision  || detectAuditCol(headers, SME_DECISION_CANDIDATES)  || 'SME_Decision',
smeNotes:     savedMap?.smeNotes     || detectAuditCol(headers, SME_NOTES_CANDIDATES)     || 'SME_Notes',
contentOwner: savedMap?.contentOwner || detectAuditCol(headers, CONTENT_OWNER_CANDIDATES) || 'Content_Owner',
finalKke:     savedMap?.finalKke     || detectAuditCol(headers, FINAL_KKE_CANDIDATES)     || 'Final_KKE'
```

**Column injection** — add SME columns to the `auditCols` array so they're injected if missing.

**SME menu** — new top-level menu between Reports and Help:
- Export for SME Review… → `menu-sme-export`
- Import SME Decisions… → `menu-sme-import`
- Resolve Conflicts… → `menu-sme-resolve`

**SME export IPC** — `sme-export` handler: receives `{headers, rows, defaultName}`, opens save dialog, writes xlsx via SheetJS.

### preload.js changes
```js
onMenuSmeExport:  (cb) => ipcRenderer.on('menu-sme-export', () => cb()),
onMenuSmeImport:  (cb) => ipcRenderer.on('menu-sme-import', () => cb()),
onMenuSmeResolve: (cb) => ipcRenderer.on('menu-sme-resolve', () => cb()),
smeExport:        (payload) => ipcRenderer.invoke('sme-export', payload),
```

### index.html changes

**SME Export modal** (`#sme-export-modal`):
- Filter by Group / Primary Tag / All rows dropdown
- Second dropdown for filter value (populated dynamically)
- Row count preview
- Export / Cancel buttons

**SME Resolve modal** (`#sme-resolve-modal`):
- Header with conflict count
- Scrollable body (conflict rows rendered by JS)
- Footer: Accept All SME / Keep All Original / Done buttons

### styles.css changes
Added `/* ── SME modals */` section:
- `#sme-export-modal`: 420px wide, standard modal pattern
- `#sme-resolve-modal`: 720px wide, max-height 80vh
- `.sme-conflict-row`: flex row with title, KKE badge, arrow, SME text, Final_KKE dropdown, confirm button
- Standard header/body/footer patterns

### renderer.js changes

**Column helpers:**
```js
function smeDecisionCol()  { return state.columnMap.smeDecision; }
function smeNotesCol()     { return state.columnMap.smeNotes; }
function contentOwnerCol() { return state.columnMap.contentOwner; }
function finalKkeCol()     { return state.columnMap.finalKke; }
```

**columnMap defaults** — add `smeDecision`, `smeNotes`, `contentOwner`, `finalKke`.

**IPC listeners:**
```js
window.electronAPI.onMenuSmeExport(() => smeExport());
window.electronAPI.onMenuSmeImport(() => smeImport());
window.electronAPI.onMenuSmeResolve(() => openSmeResolveDialog());
```

**Filter additions** — in `renderKkeFilterOptions()`, add:
- `{ value: '_sme-conflicts', text: 'SME Conflicts' }`
- `{ value: '_sme-pending', text: 'Pending Final KKE' }`

In `applyFilter()`, add two new filter branches:
- `_sme-conflicts`: rows where SME_Decision starts with "Change:"
- `_sme-pending`: rows where KKE is set but Final_KKE is empty

**SME Export** — uses **ExcelJS** (not SheetJS) for proper Excel data validation dropdowns.

`npm install exceljs` + `const ExcelJS = require('exceljs')` in main.js.

The `sme-export` IPC handler in main.js uses ExcelJS to:
- Create worksheet with bold/shaded header row
- Set column widths (50 for URLs, 40 for titles, 30 for notes, 18 default)
- Freeze header row
- Add **data validation dropdown** on the SME Decision column with all valid options (Approve, Change: Keep, etc.)
- Error message on invalid input

SheetJS community edition doesn't support data validation, which is why ExcelJS is used for this one export. All other exports continue to use SheetJS.

`smeExport()` + `showSmeExportModal()`:
- Modal with Group/PrimaryTag/All filter
- Column subset: [Address, Title, KKE_Recommendation, Notes, SME_Decision, SME_Notes, Content_Owner]
- SME columns blanked on export
- Writes xlsx via `window.electronAPI.smeExport()`

**SME Import** (`smeImport()`):
- Reuses existing `importAuditMergeOpen()` + `showImportMergeModal()` pattern
- After merge, auto-populates Final_KKE:
  - "Approve" → Final_KKE = KKE_Recommendation
  - "Change: X" → Final_KKE = X
- If unresolved conflicts remain, prompts to open resolve dialog

**SME Resolve** (`openSmeResolveDialog()`):
- Finds rows where SME_Decision starts with "Change:" AND Final_KKE is empty
- Each row shows: title, KKE badge → SME text, Final_KKE dropdown (defaults to SME's suggestion), confirm button
- "Accept All SME": sets Final_KKE to SME's suggested value for all
- "Keep All Original": sets Final_KKE to KKE_Recommendation for all
- Rows removed from list as resolved, count updates live

**Progress Dashboard** — `gatherProgressStats()` adds:
```js
smeTotal, smeReviewed, smePct, smeApproved, smeChanged, finalResolved, finalPct
```
`openProgressDashboard()` adds "SME Review" section showing these stats.

### SME Decision + Final KKE dropdowns in audit bar

Added two new dropdowns to the `#field-bar-audit` in `index.html`, between Primary Tag and Tags:

```html
<!-- SME Decision -->
<div class="audit-group audit-group-compact">
  <label class="audit-label">SME</label>
  <select id="sme-decision-select" class="sme-decision-select">
    <option value="">—</option>
  </select>
</div>

<!-- Final KKE -->
<div class="audit-group audit-group-compact">
  <label class="audit-label">Final</label>
  <select id="final-kke-select" class="final-kke-select">
    <option value="">—</option>
  </select>
</div>
```

**CSS** — `.sme-decision-select` and `.final-kke-select` follow same pattern as `.group-select`.

**Renderer functions:**

`populateSmeDecisionSelect(currentValue)` — populates with: blank, "Approve", "Change: Keep", "Change: Kill", "Change: Evolve", "Change: Exclude", plus "Change: {custom}" for each custom KKE state. Uses `allKkeStates()`.

`populateFinalKkeSelect(currentValue)` — populates with: blank + all KKE states (same values as KKE_Recommendation).

Both called from `populateAuditFields(row)`.

**Change listeners** — wired up in `init()` alongside primaryTagSelect:
```js
$('sme-decision-select').addEventListener('change', () => {
  if (state.selectedIndex === null) return;
  state.editedRows[state.selectedIndex][smeDecisionCol()] = $('sme-decision-select').value;
  setDirty(true);
  refreshRowInList(state.selectedIndex);
});

$('final-kke-select').addEventListener('change', () => {
  if (state.selectedIndex === null) return;
  state.editedRows[state.selectedIndex][finalKkeCol()] = $('final-kke-select').value;
  setDirty(true);
  refreshRowInList(state.selectedIndex);
});
```

---

## Additional Features (batch implementation)

### Quick Stats Bar
Persistent bar at bottom of sidebar: `X/Y reviewed (Z%)` with 4px progress bar using `--pct` CSS variable. Updated via `updateStatsBar()` called from `applyFilter()` and `setDirty()`. HTML: `#stats-bar` after bulk bar. CSS: `#stats-bar-progress::after` with transition.

### Row Color Coding
Sidebar rows get subtle KKE-tinted backgrounds via classes: `.row-kke-keep` (green 6%), `.row-kke-kill` (red 6%), `.row-kke-evolve` (yellow 6%), `.row-kke-exclude` (gray 6%). Class applied in `renderVisibleRows()`.

### Column Freezing in Table View
Row number column (`#`) is sticky-left in headers, filters, and body cells via `position: sticky; left: 0; z-index`.

### Inline Table Editing
Double-click audit columns in table view. `tvStartInlineEdit(cell, colName, origIndex)` renders dropdown (KKE/SME) or text input (Tags/Notes). Commit on blur/Enter, cancel on Escape. Editable set: KKE, Tags, Notes, Group, Primary Tag, SME_Decision, SME_Notes, Content_Owner, Final_KKE.

### Saved Filters
Save named filter combos (search + KKE + group). Stored in `projectSettings.savedFilters` (travels with file). HTML: `#saved-filter-select` + `#btn-save-filter` in toolbar. `setupSavedFilters()` wires save/restore. `renderSavedFilterSelect()` populates dropdown.

### Redirect Chain Detection
Reports → Redirect Chain Check. `checkRedirectChains()` finds Kill pages redirecting to other Kill pages. Shows alert with chain details.

### Nav Coverage Report
Reports → Nav Coverage Report. `showNavCoverageReport()` analyzes: empty leaves, hub nodes (no pages but children do), overloaded nodes (5+), path mismatches. Reuses progress modal for display.

### Audit Templates
File → Save Audit Template / Load Audit Template. Saves/loads a `.kke-template.json` file containing: visibleFields, tagLibrary, groupLibrary, sidebarColumns, customKkeStates, columnMap, autoAdvance, projectSettings (client/project/domain/redirectUrl/savedFilters). IPC: `save-audit-template` and `load-audit-template` in main.js. Renderer: `saveAuditTemplate()` and `loadAuditTemplate()`. On load, applies all settings and re-renders UI.

### Keyboard Navigation in Table View
Arrow keys (Up/Down) and j/k navigate rows when table view is open and no input is focused. `tvNavigate(delta)` updates `state.selectedIndex`, scrolls into view, and re-renders. Added in `setupTableView()`.

### Bulk SME Export by Content Owner
"Split into separate files by Content Owner" checkbox in SME export modal. When checked, groups rows by Content_Owner value and exports each group as a separate xlsx file into a user-chosen folder. IPC: `sme-export-multi` handler in main.js creates multiple ExcelJS workbooks with data validation. File names include the owner name.

### Multi-Auditor Merge
File → Merge Auditor Decisions. Opens another auditor's file, reads their KKE_Recommendation column, matches by URL. Three outcomes:
- **Empty in mine**: takes their decision (filled)
- **Same**: counts as agreed
- **Different**: conflict — shown in a resolution dialog (reuses SME resolve modal with "Accept All Theirs" / "Keep All Mine" / per-row dropdown)

All changes logged via `logChange()`.

### Changelog / Audit Trail
`_sessionChangeLog` array in renderer tracks changes: `{timestamp, row, url, field, from, to}`. `logChange(origIndex, field, old, new)` called from KKE changes, SME Decision, Final KKE, and auditor merge. On save, `changeLog` array sent to main.js which appends to `KKE_ChangeLog` sheet (columns: Timestamp, Row, URL, Field, Old Value, New Value). Sheet is hidden from data sheet picker. Entries accumulate across saves.
