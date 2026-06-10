const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard, webContents, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { ProjectStore, PROJECT_EXT } = require('./project-store');

// ─── State ────────────────────────────────────────────────────────────────────

let mainWindow = null;
let helpWindow = null;
let currentFilePath = null;
let currentSheetName = null;
let navSheetInfo = null;  // { sheetName, columns: { id, breadcrumb, computedPath, sortID } }

// SQLite persistence for .transmission project files. Open whenever the current
// file is a project; xlsx files continue through the legacy SheetJS path.
const projectStore = new ProjectStore();
const isProjectFile = (fp) => typeof fp === 'string' && fp.toLowerCase().endsWith(PROJECT_EXT);

const userDataPath = app.getPath('userData');
const prefsPath    = path.join(userDataPath, 'prefs.json');

// One-time migration: the app was renamed "KKE Audit Tool" → "Transmission",
// which moves the userData folder. Carry the old prefs over the first time the
// renamed app runs so recent files, the API key, and libraries survive the rename.
try {
  if (!fs.existsSync(prefsPath)) {
    const legacyPrefs = path.join(app.getPath('appData'), 'KKE Audit Tool', 'prefs.json');
    if (fs.existsSync(legacyPrefs)) {
      fs.mkdirSync(userDataPath, { recursive: true });
      fs.copyFileSync(legacyPrefs, prefsPath);
    }
  }
} catch (e) { /* non-fatal — start with fresh prefs */ }

// ─── Audit columns injected if not present in the xlsx ───────────────────────
// These are the three write-fields the app manages for every crawl file.

const AUDIT_COLUMNS = ['KKE_Recommendation', 'Tags', 'Notes', '_Flagged', '_AssessedAt', '_AssessmentResult',
                       'SME_Decision', 'SME_Notes', 'Content_Owner', 'Final_KKE', 'Consolidate_Into',
                       'Published_Status', 'Page_Type', 'Content_Theme',
                       // Phase 1: classification + delivery + suggestion + CMS links
                       'Content_Nature', 'Migration_Track', 'Suggested_KKE', 'Suggested_KKE_Sources',
                       'Source_CMS_URL', 'New_CMS_URL',
                       // Content-type crosswalk: target (new-CMS) content type, auto-mapped from Page_Type
                       'Target_Content_Type',
                       // Design pattern inventory
                       'Design_Patterns'];
const NAV_COLUMNS   = ['NavID', 'Nav Destination', 'Computed Path', 'Nav_SortID'];

// Candidate names for auto-detecting audit columns (first match wins, case-insensitive)
const KKE_CANDIDATES  = ['KKE_Recommendation', 'KKE Rec', 'KKE Recommendation', 'KKE', 'Recommendation'];
const TAGS_CANDIDATES = ['Tags', 'KKE Tags', 'Audit Tags'];
const NOTES_CANDIDATES = ['Notes', 'Notes/Rationale', 'Rationale', 'Audit Notes'];
const GROUP_CANDIDATES = ['Group', 'Audit Group', 'Page Group'];
const PRIMARY_TAG_CANDIDATES = ['Primary Tag', 'Primary_Tag', 'Main Tag'];
const SME_DECISION_CANDIDATES = ['SME_Decision', 'SME Decision', 'SME Rec'];
const SME_NOTES_CANDIDATES = ['SME_Notes', 'SME Notes'];
const CONTENT_OWNER_CANDIDATES = ['Content_Owner', 'Content Owner', 'Owner', 'SME'];
const FINAL_KKE_CANDIDATES = ['Final_KKE', 'Final KKE', 'Final Recommendation'];

function detectAuditCol(headers, candidates) {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx >= 0) return headers[idx];
  }
  return null;
}

// Determine column mapping: saved prefs override auto-detection ONLY when the saved name
// still exists in the current file's headers. A stale savedMap value for a column the file
// doesn't have any more would otherwise get re-injected as a duplicate.
// Shared by the xlsx reader and the .transmission project reader.
function computeColumnMap(headers, filePath) {
  const prefs = loadPrefs();
  const fileName = path.basename(filePath);
  const savedMap = prefs.columnMappings?.[fileName] || null;
  const honorSaved = (key) => {
    const v = savedMap?.[key];
    return v && headers.includes(v) ? v : null;
  };

  return {
    kke:   honorSaved('kke')   || detectAuditCol(headers, KKE_CANDIDATES)  || 'KKE_Recommendation',
    tags:  honorSaved('tags')  || detectAuditCol(headers, TAGS_CANDIDATES) || 'Tags',
    notes: honorSaved('notes') || detectAuditCol(headers, NOTES_CANDIDATES) || 'Notes',
    group:        honorSaved('group')        || detectAuditCol(headers, GROUP_CANDIDATES)          || 'Group',
    primaryTag:   honorSaved('primaryTag')   || detectAuditCol(headers, PRIMARY_TAG_CANDIDATES)   || 'Primary Tag',
    smeDecision:  honorSaved('smeDecision')  || detectAuditCol(headers, SME_DECISION_CANDIDATES)  || 'SME_Decision',
    smeNotes:     honorSaved('smeNotes')     || detectAuditCol(headers, SME_NOTES_CANDIDATES)     || 'SME_Notes',
    contentOwner: honorSaved('contentOwner') || detectAuditCol(headers, CONTENT_OWNER_CANDIDATES) || 'Content_Owner',
    finalKke:     honorSaved('finalKke')     || detectAuditCol(headers, FINAL_KKE_CANDIDATES)     || 'Final_KKE'
  };
}

// Inject missing audit columns (blank values) and reorder: KKE first, then
// Tags/Notes/Group/Primary Tag right after the URL column. Mutates headers +
// rows in place. Shared by the xlsx reader and the .transmission project
// reader — running it on project open is what lets a new app version add new
// audit columns to projects created by an older version.
function injectAndOrderAuditColumns(headers, rows, columnMap) {
  const auditCols = [columnMap.kke, columnMap.tags, columnMap.notes, columnMap.group, columnMap.primaryTag,
                     columnMap.smeDecision, columnMap.smeNotes, columnMap.contentOwner, columnMap.finalKke,
                     '_Flagged', '_AssessedAt', '_AssessmentResult', 'Redirect_Destination', 'Consolidate_Into',
                     'Published_Status', 'Page_Type', 'Content_Theme',
                     // Phase 1: classification + delivery + suggestion + CMS links
                     'Content_Nature', 'Migration_Track', 'Suggested_KKE', 'Suggested_KKE_Sources',
                     'Source_CMS_URL', 'New_CMS_URL',
                     // Content-type crosswalk: target (new-CMS) content type, auto-mapped from Page_Type
                     'Target_Content_Type',
                     // Design pattern inventory
                     'Design_Patterns'];
  auditCols.forEach(col => {
    if (!headers.includes(col)) {
      headers.push(col);
      rows.forEach(r => { r[col] = ''; });
    }
  });

  function moveCol(col, targetIdx) {
    const curIdx = headers.indexOf(col);
    if (curIdx === -1 || curIdx === targetIdx) return;
    headers.splice(curIdx, 1);
    headers.splice(targetIdx, 0, col);
  }

  // KKE goes to position 0
  moveCol(columnMap.kke, 0);

  // Tags, Notes, Group, Primary Tag go right after Address (in that order)
  const urlCol = detectUrlColumn(headers);
  const afterUrl = urlCol ? headers.indexOf(urlCol) + 1 : 1;
  const postUrlCols = [columnMap.tags, columnMap.notes, columnMap.group, columnMap.primaryTag];
  postUrlCols.forEach((col, i) => {
    moveCol(col, afterUrl + i);
  });
}

// ─── Preferences ─────────────────────────────────────────────────────────────
// {
//   lastFile: '/path/to/file.xlsx',
//   visibleFields: ['Title 1', 'Status Code', ...],
//   tagLibrary: ['thin-content', 'outdated', ...]
// }

const DEFAULT_VISIBLE_FIELDS = [
  'Title 1',
  'Status Code',
  'Indexability Status',
  'Redirect URL'
];

const DEFAULT_TAG_LIBRARY = [
  'thin-content', 'outdated', 'evergreen', 'duplicate', 'near-duplicate', 'high-quality',
  'high-traffic', 'low-traffic', 'revenue-driver', 'brand-critical', 'orphaned',
  'blog-post', 'landing-page', 'product-page', 'resource', 'news', 'archive',
  'needs-rewrite', 'needs-merge', 'needs-redirect', 'needs-review', 'quick-win'
];

function loadPrefs() {
  try {
    if (fs.existsSync(prefsPath)) {
      return JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function savePrefs(updates) {
  try {
    fs.mkdirSync(path.dirname(prefsPath), { recursive: true });
    const merged = { ...loadPrefs(), ...updates };
    fs.writeFileSync(prefsPath, JSON.stringify(merged, null, 2));
  } catch (e) { /* ignore */ }
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const prefs = loadPrefs();
  const wb = prefs.windowBounds || {};

  mainWindow = new BrowserWindow({
    width: wb.width || 1440,
    height: wb.height || 960,
    x: wb.x,
    y: wb.y,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f5f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Save window size/position on resize and move
  const saveWindowBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      savePrefs({ windowBounds: mainWindow.getBounds() });
    }
  };
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

function buildRecentFilesSubmenu() {
  const prefs = loadPrefs();
  const recents = Array.isArray(prefs.recentFiles) ? prefs.recentFiles : [];
  if (recents.length === 0) {
    return [{ label: 'No recent files', enabled: false }];
  }
  const items = recents.map((p, i) => {
    const exists = fs.existsSync(p);
    const name = path.basename(p);
    return {
      label: `${i + 1}. ${name}${exists ? '' : ' (missing)'}`,
      toolTip: p,
      enabled: exists,
      click: () => openRecentFile(p),
    };
  });
  items.push({ type: 'separator' });
  items.push({
    label: 'Clear Recent Files',
    click: () => {
      savePrefs({ recentFiles: [] });
      buildMenu();
    },
  });
  return items;
}

function recordRecentFile(filePath) {
  if (!filePath) return;
  const prefs = loadPrefs();
  const existing = Array.isArray(prefs.recentFiles) ? prefs.recentFiles : [];
  const filtered = existing.filter(p => p !== filePath);
  filtered.unshift(filePath);
  const next = filtered.slice(0, 10);
  savePrefs({ recentFiles: next });
  buildMenu();
}

async function openRecentFile(filePath) {
  if (!fs.existsSync(filePath)) {
    dialog.showErrorBox('File Not Found', `The file no longer exists:\n\n${filePath}`);
    // Drop from recents and rebuild menu
    const prefs = loadPrefs();
    const filtered = (prefs.recentFiles || []).filter(p => p !== filePath);
    savePrefs({ recentFiles: filtered });
    buildMenu();
    return;
  }
  openAnyPath(filePath);
}

// Open either kind of file (xlsx/csv spreadsheet or .transmission project) and
// ship it to the renderer. Single entry point for the open dialog, recents,
// and Finder double-click.
function openAnyPath(filePath, targetSheet) {
  if (!isProjectFile(filePath) && projectStore.isOpen) projectStore.close();
  const data = isProjectFile(filePath)
    ? readProject(filePath)
    : readWorkbook(filePath, targetSheet);
  if (data) {
    currentFilePath = filePath;
    currentSheetName = data.sheetName;
    savePrefs({ lastFile: filePath, lastSheet: data.sheetName });
    recordRecentFile(filePath);
    mainWindow?.webContents.send('file-opened', { filePath, ...data });
  }
  return data;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const send = (channel) => () => mainWindow?.webContents.send(channel);

  // Preferences item shared between platforms — placed in app menu on macOS,
  // in File menu on Windows/Linux per platform convention.
  const preferencesItem = {
    label: 'Preferences…',
    accelerator: 'CmdOrCtrl+,',
    click: send('menu-settings')
  };

  const template = [
    // ── App menu (macOS only — Windows/Linux skip this) ────────────────────
    ...(isMac ? [{
      label: 'Transmission',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        preferencesItem,
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),

    // ── File ────────────────────────────────────────────────────────────────
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => openFileDialog() },
        { label: 'Open Recent', submenu: buildRecentFilesSubmenu() },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send('menu-save') },
        { label: 'Save As Project…', accelerator: 'CmdOrCtrl+Shift+S', click: send('menu-save-as-project') },
        { type: 'separator' },
        { label: 'Import/Merge Audit Decisions…', click: send('menu-import-merge') },
        { label: 'Merge Auditor Decisions…',      click: send('menu-merge-auditor') },
        { type: 'separator' },
        { label: 'Save Audit Template…', click: send('menu-save-template') },
        { label: 'Load Audit Template…', click: send('menu-load-template') },
        { type: 'separator' },
        { label: 'Export…', accelerator: 'CmdOrCtrl+Shift+E', click: send('menu-export-dialog') },
        { label: 'Export Full Workbook (.xlsx)…', click: send('menu-export-workbook') },
        // Windows/Linux: Preferences sits here (macOS has it in the app menu)
        ...(!isMac ? [{ type: 'separator' }, preferencesItem] : []),
        { type: 'separator' },
        { role: 'close' }
      ]
    },

    // ── Edit ───────────────────────────────────────────────────────────────
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },

    // ── View ───────────────────────────────────────────────────────────────
    {
      label: 'View',
      submenu: [
        { label: 'Audit',           accelerator: 'CmdOrCtrl+1',        click: send('menu-audit-view') },
        { label: 'Table',           accelerator: 'CmdOrCtrl+T',        click: send('menu-table-view') },
        { label: 'Navigation Tree', accelerator: 'CmdOrCtrl+Shift+T',  click: send('menu-nav-tree') },
        { label: 'Redirects',       accelerator: 'CmdOrCtrl+Shift+R',  click: send('menu-redirect-editor') },
        { type: 'separator' },
        { label: 'Audit Progress…', accelerator: 'CmdOrCtrl+P', click: send('menu-progress') },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(process.env.NODE_ENV === 'development' || !app.isPackaged ? [
          { type: 'separator' },
          { role: 'reload' },
          { role: 'toggleDevTools' }
        ] : [])
      ]
    },

    // ── Project (per-project configuration + project-state commands) ───────
    {
      label: 'Project',
      submenu: [
        { label: 'Project Settings…',     click: send('menu-project-settings') },
        { label: 'Triage Non-200 Pages…', click: send('menu-non200-triage') },
        { type: 'separator' },
        { label: 'Edit Glossary…',        click: send('menu-glossary') },
        { label: 'Content Type Registry…', click: send('menu-content-type-registry') },
        { label: 'Target Spec Library…',    click: send('menu-pattern-library') },
        { label: 'Component Library…',      click: send('menu-design-pattern-library') },
        { type: 'separator' },
        { label: 'AI Suggest for Unreviewed…',   click: send('menu-suggest-unreviewed') },
        { label: 'Run Rubric on filtered rows…', click: send('menu-rubric-batch') },
        { label: 'Refresh GA KKE',               click: send('menu-ga-kke-refresh') },
        { label: 'Recompute Suggested KKE',      click: send('menu-suggested-kke-recompute') }
      ]
    },

    // ── Migration (delivery-phase export & validation tools) ───────────────
    {
      label: 'Migration',
      submenu: [
        { label: 'Pre-Handoff Check…', click: send('menu-prehandoff-check') },
        { type: 'separator' },
        { label: 'Migration Tracker…', click: send('menu-export-migration-tracker') },
        { label: 'Export Redirect Map (CSV)…', click: send('menu-export-redirects') },
        { type: 'separator' },
        { label: 'Redirect Chain Check…',   click: send('menu-redirect-chain-check') }
      ]
    },

    // ── Reports (all stakeholder & analysis reports, grouped) ──────────────
    {
      label: 'Reports',
      submenu: [
        { label: 'Executive Summary…',          click: send('menu-report-executive-summary') },
        { label: 'Content Inventory by Section…', click: send('menu-report-content-inventory') },
        { label: 'SME Review Status…',          click: send('menu-report-sme-status') },
        { type: 'separator' },
        { label: 'Navigation IA…',              click: send('menu-report-nav-ia') },
        { label: 'Nav Coverage Report…',        click: send('menu-nav-coverage') },
        { label: 'Component Inventory…',          click: send('menu-report-design-patterns') },
        { label: 'Content Type Crosswalk…',       click: send('menu-report-content-crosswalk') },
        { type: 'separator' },
        { label: 'Migration Direction Brief…', click: send('menu-report-assignee-brief') },
        { label: 'Migration Checklist…',    click: send('menu-report-migration-checklist') },
        { label: 'Net New Content Brief…',  click: send('menu-report-net-new') },
        { label: 'Redirect Map Report…',    click: send('menu-report-redirect-map') }
      ]
    },

    // ── SME (workflow) ─────────────────────────────────────────────────────
    {
      label: 'SME',
      submenu: [
        { label: 'Export for SME Review…',  click: send('menu-sme-export') },
        { label: 'Import SME Decisions…',   click: send('menu-sme-import') },
        { type: 'separator' },
        { label: 'Compare KKE vs SME…',     click: send('menu-kke-vs-sme') },
        { label: 'Resolve Conflicts…',      click: send('menu-sme-resolve') }
      ]
    },

    // ── Help ───────────────────────────────────────────────────────────────
    {
      role: 'help',
      submenu: [
        { label: 'Getting Started', click: send('menu-welcome') },
        { label: 'Product Tour', click: send('menu-product-tour') },
        { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: send('menu-shortcuts') },
        { type: 'separator' },
        { label: 'Transmission Help', click: () => openHelpWindow() }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── File dialog ──────────────────────────────────────────────────────────────

async function openFileDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project or Spreadsheet',
    filters: [
      { name: 'All Supported', extensions: ['transmission', 'xlsx', 'xls', 'xlsm', 'ods', 'csv'] },
      { name: 'Transmission Project', extensions: ['transmission'] },
      { name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm', 'ods', 'csv'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    openAnyPath(result.filePaths[0]);
  }
}

// ─── Excel helpers ────────────────────────────────────────────────────────────

function readWorkbook(filePath, targetSheet) {
  try {
    const workbook  = XLSX.readFile(filePath, { type: 'file', cellDates: true });
    const allSheetNames = workbook.SheetNames;

    // Structural sheets (not selectable as data sheets)
    const structuralNames = new Set(['navstructure', 'kke_settings', 'kke_changelog', 'kke_glossary', 'contenttyperegistry', 'patternlibrary', 'designpatternlibrary']);
    const dataSheets = allSheetNames.filter(s => !structuralNames.has(s.toLowerCase()));

    // Pick which sheet to load
    const sheetName = (targetSheet && allSheetNames.includes(targetSheet))
      ? targetSheet
      : (dataSheets[0] || allSheetNames[0]);

    const worksheet = workbook.Sheets[sheetName];

    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false
    });

    if (rawData.length < 2) {
      dialog.showErrorBox('Empty Sheet', `The sheet "${sheetName}" has no data rows.`);
      return null;
    }

    let headers = rawData[0].map(String);

    // Detect & auto-merge duplicate header names — a sign the file got corrupted by an earlier
    // injection bug. Strategy: keep the first occurrence; for each duplicate, copy values
    // forward into the first occurrence wherever the first is blank. If any row has conflicting
    // non-blank values across duplicates, leave that conflict alone and surface a warning.
    const headerCounts = {};
    headers.forEach(h => { headerCounts[h] = (headerCounts[h] || 0) + 1; });
    const duplicateHeaders = Object.keys(headerCounts).filter(h => headerCounts[h] > 1);
    let dedupReport = null;
    if (duplicateHeaders.length > 0) {
      console.warn('Duplicate headers detected in', filePath, ':', duplicateHeaders);
      const firstSeen = {};
      const dropIdxSet = new Set();
      headers.forEach((h, i) => {
        if (firstSeen[h] === undefined) firstSeen[h] = i;
        else dropIdxSet.add(i);
      });
      let conflicts = 0;
      let merged = 0;
      // rawData[0] is headers; iterate data rows
      for (let r = 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row) continue;
        for (const dupIdx of dropIdxSet) {
          const dupVal = row[dupIdx];
          if (dupVal === undefined || dupVal === null || String(dupVal).trim() === '') continue;
          const headerName = headers[dupIdx];
          const firstIdx = firstSeen[headerName];
          const firstVal = row[firstIdx];
          const firstTrim = (firstVal === undefined || firstVal === null) ? '' : String(firstVal).trim();
          if (!firstTrim) {
            row[firstIdx] = dupVal;
            merged++;
          } else if (String(firstVal).trim() !== String(dupVal).trim()) {
            conflicts++;
          }
        }
      }
      // Drop duplicate columns from headers and every row
      const keep = (i) => !dropIdxSet.has(i);
      headers = headers.filter((_, i) => keep(i));
      for (let r = 1; r < rawData.length; r++) {
        if (rawData[r]) rawData[r] = rawData[r].filter((_, i) => keep(i));
      }
      dedupReport = {
        names: duplicateHeaders,
        droppedColumns: dropIdxSet.size,
        valuesMerged: merged,
        conflicts
      };
      console.warn('Dedup applied:', dedupReport);
    }

    const columnMap = computeColumnMap(headers, filePath);

    // Build row objects keyed by original header positions BEFORE reordering
    const origHeaders = [...headers];
    const rows = rawData.slice(1).map((row, i) => {
      const obj = { _rowIndex: i + 1 };
      origHeaders.forEach((h, j) => { obj[h] = row[j] ?? ''; });
      return obj;
    });

    injectAndOrderAuditColumns(headers, rows, columnMap);

    // Check for NavStructure sheet
    let navTree = null;
    const navSheetName = allSheetNames.find(s => s.toLowerCase() === 'navstructure');
    if (navSheetName) {
      navTree = parseNavSheet(workbook.Sheets[navSheetName]);
      if (navTree) {
        NAV_COLUMNS.forEach(col => {
          if (!headers.includes(col)) headers.push(col);
        });
        // Store nav sheet info for formula generation on save
        navSheetInfo = { sheetName: navSheetName, columns: navTree.columns };
      }
    } else {
      navSheetInfo = null;
    }

    // Check for KKE_Settings sheet (project-level key/value store)
    let projectSettings = {};
    const settingsSheetName = allSheetNames.find(s => s.toLowerCase() === 'kke_settings');
    if (settingsSheetName) {
      projectSettings = parseSettingsSheet(workbook.Sheets[settingsSheetName]);
    }

    // Check for KKE_Glossary sheet (tag + group notes)
    const glossarySheetName = allSheetNames.find(s => s.toLowerCase() === 'kke_glossary');
    if (glossarySheetName) {
      projectSettings.glossary = parseGlossarySheet(workbook.Sheets[glossarySheetName]);
    }

    // Check for ContentTypeRegistry sheet (Phase 1, Chunk B)
    const ctrSheetName = allSheetNames.find(s => s.toLowerCase() === 'contenttyperegistry');
    if (ctrSheetName) {
      projectSettings.contentTypeRegistry = parseContentTypeRegistrySheet(workbook.Sheets[ctrSheetName]);
    } else {
      projectSettings.contentTypeRegistry = projectSettings.contentTypeRegistry || [];
    }

    // Check for PatternLibrary sheet (Phase 2, Chunk β)
    const plSheetName = allSheetNames.find(s => s.toLowerCase() === 'patternlibrary');
    if (plSheetName) {
      projectSettings.patternLibrary = parsePatternLibrarySheet(workbook.Sheets[plSheetName]);
    } else {
      projectSettings.patternLibrary = projectSettings.patternLibrary || [];
    }

    // Check for DesignPatternLibrary sheet
    const dplSheetName = allSheetNames.find(s => s.toLowerCase() === 'designpatternlibrary');
    if (dplSheetName) {
      projectSettings.designPatternLibrary = parseDesignPatternLibrarySheet(workbook.Sheets[dplSheetName]);
    } else {
      projectSettings.designPatternLibrary = projectSettings.designPatternLibrary || [];
    }

    const urlColumn = detectUrlColumn(headers);

    return { headers, rows, sheetName, urlColumn, navTree, dataSheets, columnMap, projectSettings, dedupReport };
  } catch (err) {
    dialog.showErrorBox('Error Reading File', `Could not open the spreadsheet:\n\n${err.message}`);
    return null;
  }
}

// ─── .transmission project files (SQLite) ─────────────────────────────────────

// Header name → flat-node property, as saved by the renderer's
// flattenNavTreeForSave(). Used to rebuild a worksheet-shaped structure so
// parseNavSheet() can reconstruct the tree with identical semantics to the
// xlsx path (sibling order from row order, etc.).
const NAV_HEADER_TO_KEY = {
  'Number': 'number', 'Label': 'label', 'Path': 'path', 'SortID': 'sortID',
  'ParentNumber': 'parentNumber', 'Breadcrumb': 'breadcrumb', 'Computed Path': 'computedPath',
  'ID': 'id', 'RefNodeID': 'refNodeId', 'InMenu': 'inMenu', 'URL': 'url',
  'Notes': 'notes', 'Phase': 'phase', 'Node_Type': 'nodeType', 'Nav_Layer': 'navLayer',
  'Build_Pattern': 'buildPattern', 'Build_Guidance': 'buildGuidance', 'Writer_Brief': 'writerBrief',
  'Page_Status': 'pageStatus', 'Build_Assignee': 'buildAssignee', 'Write_Assignee': 'writeAssignee',
  'Migrate_Assignee': 'migrateAssignee'
};

function navTreeFromFlatNodes(flatNodes) {
  if (!flatNodes || flatNodes.length === 0) return null;
  const headerNames = Object.keys(NAV_HEADER_TO_KEY);
  const aoa = [headerNames];
  for (const n of flatNodes) {
    aoa.push(headerNames.map(h => n[NAV_HEADER_TO_KEY[h]] ?? ''));
  }
  return parseNavSheet(XLSX.utils.aoa_to_sheet(aoa));
}

function readProject(filePath) {
  try {
    projectStore.open(filePath);
    const { headers, rows, navNodes, projectSettings, sheetName } = projectStore.readAll();

    if (headers.length === 0) {
      throw new Error('Project file contains no data.');
    }

    // Same post-processing as the xlsx path: column mapping (honoring saved
    // per-file overrides) + injection of any audit columns added since the
    // project was last saved.
    const columnMap = computeColumnMap(headers, filePath);
    injectAndOrderAuditColumns(headers, rows, columnMap);
    rows.forEach((r, i) => { r._rowIndex = i + 1; });

    let navTree = null;
    if (navNodes.length > 0) {
      navTree = navTreeFromFlatNodes(navNodes);
      if (navTree) {
        NAV_COLUMNS.forEach(col => {
          if (!headers.includes(col)) headers.push(col);
        });
      }
    }
    // No xlsx behind a project — exports build NavStructure from scratch.
    navSheetInfo = null;

    // Default library keys, matching readWorkbook
    projectSettings.contentTypeRegistry = projectSettings.contentTypeRegistry || [];
    projectSettings.patternLibrary = projectSettings.patternLibrary || [];
    projectSettings.designPatternLibrary = projectSettings.designPatternLibrary || [];

    const urlColumn = detectUrlColumn(headers);

    // Rolling backup (SQLite online backup API — consistent even mid-session).
    projectStore.backupTo(path.join(userDataPath, 'backups')).catch(() => { /* non-fatal */ });

    return { headers, rows, sheetName, urlColumn, navTree, dataSheets: [sheetName], columnMap, projectSettings, dedupReport: null };
  } catch (err) {
    projectStore.close();
    dialog.showErrorBox('Error Opening Project', `Could not open the project:\n\n${err.message}`);
    return null;
  }
}

function colLetter(idx) {
  let letter = '';
  let n = idx;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function parseNavSheet(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false
  });

  if (rawData.length < 2) return null;

  const h = rawData[0].map(String);
  const idx = {
    number:       h.indexOf('Number'),
    label:        h.indexOf('Label'),
    path:         h.indexOf('Path'),
    sortID:       h.indexOf('SortID'),
    parentNumber: h.indexOf('ParentNumber'),
    breadcrumb:   h.indexOf('Breadcrumb'),
    computedPath: h.indexOf('Computed Path'),
    id:           h.indexOf('ID'),
    refNodeId:    h.indexOf('RefNodeID'),
    inMenu:       h.indexOf('InMenu'),
    url:          h.indexOf('URL'),
    notes:        h.indexOf('Notes'),
    phase:        h.indexOf('Phase'),
    // Phase 5 (reserved): preserved through round-trip; no UI binding yet.
    nodeType:     h.indexOf('Node_Type'),
    navLayer:     h.indexOf('Nav_Layer'),
    // Phase 2, Chunk α: build / write metadata per node
    buildPattern:   h.indexOf('Build_Pattern'),
    buildGuidance:  h.indexOf('Build_Guidance'),
    writerBrief:    h.indexOf('Writer_Brief'),
    pageStatus:     h.indexOf('Page_Status'),
    buildAssignee:  h.indexOf('Build_Assignee'),
    writeAssignee:  h.indexOf('Write_Assignee'),
    migrateAssignee: h.indexOf('Migrate_Assignee')
  };

  if (idx.number === -1 || idx.label === -1 || idx.id === -1) return null;

  const nodes = [];
  const nodeMap = {};

  for (let i = 1; i < rawData.length; i++) {
    const r = rawData[i];
    const number = String(r[idx.number] || '');
    if (!number) continue;

    const node = {
      number,
      label:        String(r[idx.label] || ''),
      path:         idx.path >= 0        ? String(r[idx.path] || '')         : '',
      sortID:       idx.sortID >= 0      ? String(r[idx.sortID] || '')       : '',
      parentNumber: idx.parentNumber >= 0 ? String(r[idx.parentNumber] || '') : '',
      breadcrumb:   idx.breadcrumb >= 0  ? String(r[idx.breadcrumb] || '')   : '',
      computedPath: idx.computedPath >= 0 ? String(r[idx.computedPath] || '') : '',
      id:           String(r[idx.id] || ''),
      refNodeId:    idx.refNodeId >= 0   ? String(r[idx.refNodeId] || '')   : '',
      inMenu:       idx.inMenu >= 0      ? String(r[idx.inMenu] || '')      : '',
      url:          idx.url >= 0         ? String(r[idx.url] || '')         : '',
      notes:        idx.notes >= 0       ? String(r[idx.notes] || '')       : '',
      phase:        idx.phase >= 0       ? String(r[idx.phase] || '')       : '',
      // Phase 5 reserved fields — preserved but not bound to UI yet
      nodeType:     idx.nodeType >= 0    ? String(r[idx.nodeType] || '')    : '',
      navLayer:     idx.navLayer >= 0    ? String(r[idx.navLayer] || '')    : '',
      // Phase 2, Chunk α: build / write metadata
      buildPattern:   idx.buildPattern  >= 0 ? String(r[idx.buildPattern]  || '') : '',
      buildGuidance:  idx.buildGuidance >= 0 ? String(r[idx.buildGuidance] || '') : '',
      writerBrief:    idx.writerBrief   >= 0 ? String(r[idx.writerBrief]   || '') : '',
      pageStatus:     idx.pageStatus    >= 0 ? String(r[idx.pageStatus]    || '') : '',
      buildAssignee:  idx.buildAssignee >= 0 ? String(r[idx.buildAssignee] || '') : '',
      writeAssignee:  idx.writeAssignee >= 0 ? String(r[idx.writeAssignee] || '') : '',
      migrateAssignee: idx.migrateAssignee >= 0 ? String(r[idx.migrateAssignee] || '') : '',
      children:     []
    };
    nodes.push(node);
    nodeMap[number] = node;
  }

  const roots = [];
  for (const node of nodes) {
    if (node.parentNumber && nodeMap[node.parentNumber]) {
      nodeMap[node.parentNumber].children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Column letters for formula generation
  const columns = {
    id:           colLetter(idx.id),
    breadcrumb:   idx.breadcrumb >= 0   ? colLetter(idx.breadcrumb)   : null,
    computedPath: idx.computedPath >= 0 ? colLetter(idx.computedPath) : null,
    sortID:       idx.sortID >= 0       ? colLetter(idx.sortID)       : null
  };

  return { roots, nodes, columns };
}

function parseSettingsSheet(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const settings = {};
  for (let i = 0; i < rawData.length; i++) {
    const key = String(rawData[i][0] || '').trim();
    let val = String(rawData[i][1] || '');
    if (!key) continue;
    // Try to parse JSON arrays/objects
    if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
      try { val = JSON.parse(val); } catch (_) {}
    }
    settings[key] = val;
  }
  return settings;
}

// Excel cannot store more than 32767 characters in a single cell — exceeding it
// makes the whole workbook write throw and aborts the save. Clamp any string cell
// (with a visible marker) so an over-long note/brief/template can never block saving.
const MAX_CELL_LEN = 32767;
function clampCell(v) {
  if (typeof v !== 'string' || v.length <= MAX_CELL_LEN) return v;
  return v.slice(0, MAX_CELL_LEN - 80) + '\n…[truncated — exceeded Excel’s 32,767-character cell limit]';
}

function writeSettingsSheet(workbook, settings) {
  if (!settings || Object.keys(settings).length === 0) return;
  // These each live in their own structural sheet — never duplicate them into the
  // KKE_Settings key/value cells. Their JSON copy can exceed Excel's 32767-char
  // per-cell limit, which makes the whole workbook write throw and aborts the save.
  const {
    glossary: _glossary,
    patternLibrary: _patternLibrary,
    contentTypeRegistry: _contentTypeRegistry,
    designPatternLibrary: _designPatternLibrary,
    ...settingsToWrite
  } = settings;
  if (Object.keys(settingsToWrite).length === 0) return;
  const MAX_CELL = 32767; // Excel hard limit on cell text length
  const aoa = [['Key', 'Value']];
  for (const [key, val] of Object.entries(settingsToWrite)) {
    // Serialize arrays and objects as JSON strings
    let serialized = (Array.isArray(val) || (val && typeof val === 'object')) ? JSON.stringify(val) : val;
    // Defense-in-depth: never let a single oversized value crash the entire save.
    if (typeof serialized === 'string' && serialized.length > MAX_CELL) {
      console.warn(`[KKE] Settings "${key}" is ${serialized.length} chars — exceeds the ${MAX_CELL}-char cell limit; skipping it so the save can complete.`);
      continue;
    }
    aoa.push([key, serialized]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const sheetName = 'KKE_Settings';
  if (workbook.SheetNames.includes(sheetName)) {
    workbook.Sheets[sheetName] = ws;
  } else {
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }
}

// ─── ContentTypeRegistry (Phase 1, Chunk B) ─────────────────────────────────
// Per-project sheet mapping CMS Page_Type values → default Content_Nature and
// default Migration_Track. Travels with the file.

const DEFAULT_CONTENT_TYPE_REGISTRY = [
  // Page-shaped content (typically Scripted)
  { contentType: 'Landing Page',         defaultContentNature: 'Page',           defaultMigrationTrack: 'Scripted',         notes: 'Authored marketing or campaign page; usually has a body, hero, CTAs.' },
  { contentType: 'About / Static Page',  defaultContentNature: 'Page',           defaultMigrationTrack: 'Scripted',         notes: 'Hand-authored informational page that doesn\'t change often.' },
  { contentType: 'Program / Degree',     defaultContentNature: 'Page',           defaultMigrationTrack: 'Scripted',         notes: 'Program or degree page; rich landing-style layout. Standard review per KKE rubric.' },
  { contentType: 'Department',           defaultContentNature: 'Page',           defaultMigrationTrack: 'Scripted',         notes: 'Department page. Standard review per KKE rubric.' },
  { contentType: 'Center / Institute',   defaultContentNature: 'Page',           defaultMigrationTrack: 'Scripted',         notes: 'Research center or institute page. Standard review per KKE rubric.' },
  { contentType: 'Homepage',             defaultContentNature: 'Page',           defaultMigrationTrack: 'Manual Rebuild',   notes: 'Top-of-site homepage; almost always unique enough to rebuild by hand.' },
  { contentType: 'Form Page',            defaultContentNature: 'Page',           defaultMigrationTrack: 'Manual Rebuild',   notes: 'Forms rarely script-migrate cleanly; rebuild in the new CMS\'s form tool.' },
  { contentType: 'PDF',                  defaultContentNature: 'Page',           defaultMigrationTrack: 'Manual Rebuild',   notes: 'PDFs that should become web pages. If retiring the PDF, KKE = Kill instead.' },
  // Content objects (typically Migrate Records)
  { contentType: 'Article',              defaultContentNature: 'Content Object', defaultMigrationTrack: 'Migrate Records',     notes: 'Editorial article or post. Maps to an article content type in the new CMS.' },
  { contentType: 'Blog Post',            defaultContentNature: 'Content Object', defaultMigrationTrack: 'Migrate Records',     notes: 'Blog/news entry. Maps to a content-type entry in the new CMS.' },
  { contentType: 'News',                 defaultContentNature: 'Content Object', defaultMigrationTrack: 'Migrate Records',     notes: 'News post. Subject to the project\'s news-age cutoff.' },
  { contentType: 'Press Release',        defaultContentNature: 'Content Object', defaultMigrationTrack: 'Migrate Records',     notes: 'Press release record.' },
  { contentType: 'Event',                defaultContentNature: 'Content Object', defaultMigrationTrack: 'Migrate Records',     notes: 'Event listing. Past events may KKE = Kill per the framework.' },
  { contentType: 'Faculty Profile',      defaultContentNature: 'Content Object', defaultMigrationTrack: 'Migrate Records',     notes: 'Faculty/staff bio. Maps to a person content type.' },
  { contentType: 'Alumni Spotlight',     defaultContentNature: 'Content Object', defaultMigrationTrack: 'Migrate Records',     notes: 'Alumni profile/spotlight. Subject to the project\'s spotlight age rules.' },
  { contentType: 'Case Study',           defaultContentNature: 'Content Object', defaultMigrationTrack: 'Migrate Records',     notes: 'Long-form case study record.' },
  // Generated views (typically Configure)
  { contentType: 'Listing / Index',      defaultContentNature: 'Generated',      defaultMigrationTrack: 'Configure',        notes: 'List view computed over content-type entries (e.g., /news, /events).' },
  { contentType: 'Archive',              defaultContentNature: 'Generated',      defaultMigrationTrack: 'Configure',        notes: 'Date-based or category-based archive view.' },
  { contentType: 'Tag / Category',       defaultContentNature: 'Generated',      defaultMigrationTrack: 'Configure',        notes: 'Tag- or category-filtered listing.' },
  { contentType: 'Search Results',       defaultContentNature: 'Generated',      defaultMigrationTrack: 'Configure',        notes: 'Site search results page. Typically rebuilt in the new CMS\'s search.' }
];

function parseContentTypeRegistrySheet(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const entries = [];
  // Skip header row
  for (let i = 1; i < rawData.length; i++) {
    const contentType = String(rawData[i][0] || '').trim();
    if (!contentType) continue;
    entries.push({
      contentType,
      defaultContentNature: String(rawData[i][1] || '').trim(),
      defaultMigrationTrack: String(rawData[i][2] || '').trim(),
      notes: String(rawData[i][3] || ''),
      // Crosswalk additions (appended columns; absent in older sheets → blank)
      targetContentType: String(rawData[i][4] || '').trim(),
      targetSpec:        String(rawData[i][5] || '').trim()
    });
  }
  return entries;
}

function writeContentTypeRegistrySheet(workbook, registry) {
  if (!Array.isArray(registry)) return;
  const sheetName = 'ContentTypeRegistry';
  // Filter out fully-blank rows
  const entries = registry.filter(e => String(e?.contentType || '').trim());
  if (entries.length === 0) {
    // Nothing to persist — leave any existing sheet alone (don't auto-delete)
    return;
  }
  const aoa = [['Content_Type', 'Default_Content_Nature', 'Default_Migration_Track', 'Notes', 'Target_Content_Type', 'Target_Spec']];
  // Sort alphabetically by contentType for stable diffs
  entries.sort((a, b) => a.contentType.localeCompare(b.contentType));
  entries.forEach(e => aoa.push([
    e.contentType,
    e.defaultContentNature || '',
    e.defaultMigrationTrack || '',
    e.notes || '',
    e.targetContentType || '',
    e.targetSpec || ''
  ]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (workbook.SheetNames.includes(sheetName)) {
    workbook.Sheets[sheetName] = ws;
  } else {
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }
}

// ─── PatternLibrary (Phase 2, Chunk β) ───────────────────────────────────────
// Per-project library of page-build patterns. Each pattern describes how a
// page is constructed in the new CMS, with templates for build guidance and
// writer brief that fill in on selection (when the node's fields are blank).

const DEFAULT_PATTERN_LIBRARY = [
  {
    patternName: 'Hub Landing',
    description: 'Top-of-section landing with intro + child-section cards',
    buildGuidanceDefault:
`- Hero region with concise intro headline and 1–2 sentence summary
- Grid of cards linking to direct child sections
- Optional feature/highlight band
- Optional CTA toward the section's most important page`,
    writerBriefDefault:
`Audience: visitors entering this section for the first time.
Purpose: orient them to what's in this section and where to go next.
Tone: confident, scannable.
Key elements: ~30-word intro, descriptive card titles + subtitles, optional 1–2 CTAs.`,
    defaultMigrationTrack: 'Manual Rebuild',
    notes: 'Common for top-level sections (About, Academics, Research, etc.).'
  },
  {
    patternName: 'Topic Listing',
    description: 'Filterable list view over content-type entries',
    buildGuidanceDefault:
`- Configure list template to pull from the relevant content type
- Set default sort (date desc or alphabetical)
- Configure filters (tag/category/date)
- Pagination or infinite scroll per design
- Empty-state and "no matches" copy`,
    writerBriefDefault:
`No body content — this page is generated. If a brief intro is wanted, write 1–2 sentences explaining what's listed and why.`,
    defaultMigrationTrack: 'Configure',
    notes: 'Use for /news, /events, /faculty, etc. Authored content here is minimal or absent.'
  },
  {
    patternName: 'Article',
    description: 'Long-form editorial article or post',
    buildGuidanceDefault:
`- Standard article template (hero image, title, dek, body, author, date)
- Inline media and pull-quotes per content type's allowed blocks
- Related-content rail at the bottom`,
    writerBriefDefault:
`Audience: readers searching for or arriving from a topic listing.
Purpose: deliver the story.
Voice: per brand guidelines.
Required: headline, dek, author, body, 1+ images with alt text.`,
    defaultMigrationTrack: 'Migrate Records',
    notes: 'Maps to an article content type in the new CMS.'
  },
  {
    patternName: 'Blog Post',
    description: 'Shorter editorial post — news, updates, announcements',
    buildGuidanceDefault:
`- Standard post template (title, date, author, body)
- Tagging for categorization
- Auto-list on the parent topic landing`,
    writerBriefDefault:
`Audience: subscribers and section visitors.
Purpose: announce or update.
Voice: per brand guidelines; usually less formal than long-form articles.`,
    defaultMigrationTrack: 'Migrate Records',
    notes: 'Maps to a blog/post content type.'
  },
  {
    patternName: 'Faculty Profile',
    description: 'Person page — bio + research + contact + publications',
    buildGuidanceDefault:
`- Person content type with structured fields:
  - Name, title, department(s), photo, contact
  - Bio (rich text)
  - Research interests (tags or list)
  - Selected publications (linked entries or freeform list)
  - Office hours / availability if applicable
- Connect to relevant programs/departments via relationship fields`,
    writerBriefDefault:
`Audience: prospective students, peers, media.
Purpose: establish credibility and accessibility.
Required: bio (150–300 words), research focus, contact info, current photo.
Voice: third-person, professional, warm.`,
    defaultMigrationTrack: 'Migrate Records',
    notes: 'Maps to a faculty/person content type. Photos and publication links often migrated separately.'
  },
  {
    patternName: 'Program / Degree Page',
    description: 'Detail page for an academic program or degree',
    buildGuidanceDefault:
`- Hero with program name, type (Major / Minor / Certificate), and tagline
- Overview section: who it's for, what they'll learn
- Curriculum/requirements section (structured or linked)
- Admissions / how to apply (CTA)
- Outcomes / careers section
- Faculty contacts
- Related programs rail`,
    writerBriefDefault:
`Audience: prospective students and parents.
Purpose: explain the program, what it leads to, and how to apply.
Tone: aspirational, concrete, scannable.
Required elements: program description, curriculum overview, careers/outcomes, contact, apply CTA.`,
    defaultMigrationTrack: 'Scripted',
    notes: 'Standard review per KKE rubric. Often the highest-traffic pages in the site.'
  },
  {
    patternName: 'Department Page',
    description: 'Section hub for a department or academic unit',
    buildGuidanceDefault:
`- Hero with department name and brief identity statement
- Mission/about section
- Faculty grid (linked content type)
- Programs grid (linked content type)
- Research highlights (linked)
- News/events listing
- Contact block`,
    writerBriefDefault:
`Audience: prospective students, current students, peers, media.
Purpose: showcase the department's identity, people, and offerings.
Tone: institutional, but distinctive — what makes this department unique?
Required: ~100-word identity statement; rest pulls from linked content types.`,
    defaultMigrationTrack: 'Scripted',
    notes: 'Standard review per KKE rubric.'
  },
  {
    patternName: 'Event',
    description: 'Event listing or detail — date, location, registration',
    buildGuidanceDefault:
`- Event content type with structured fields:
  - Title, date/time, location, host
  - Description (rich text)
  - Registration link or embed
  - Featured image
- Auto-listed on /events; auto-archived after the event date`,
    writerBriefDefault:
`Audience: prospective attendees.
Purpose: explain what the event is and how to attend.
Required: title, date/time, location, who's hosting, brief description, register/RSVP CTA.`,
    defaultMigrationTrack: 'Migrate Records',
    notes: 'Past events may KKE = Kill per the framework. Event listing pages are Configure.'
  },
  {
    patternName: 'Static / Informational Page',
    description: 'Hand-authored informational page',
    buildGuidanceDefault:
`- Standard rich-text page template
- Optional table-of-contents nav if long
- Inline images, links, lists as needed
- Last-updated date in footer`,
    writerBriefDefault:
`Audience: visitors looking for specific information.
Purpose: convey reference material clearly.
Tone: clear, factual, hierarchical.
Required: well-organized headings, dates if time-sensitive.`,
    defaultMigrationTrack: 'Scripted',
    notes: 'About pages, policy pages, FAQ landing, etc.'
  },
  {
    patternName: 'Form Page',
    description: 'Page primarily built around a form',
    buildGuidanceDefault:
`- Form embedded via the new CMS's form tool (or third-party embed)
- Intro copy explaining what the form is for and what happens after submit
- Confirmation/thank-you state or page
- Privacy/consent language if collecting PII`,
    writerBriefDefault:
`Audience: someone ready to take action (contact, apply, request info).
Purpose: collect the right info with minimum friction.
Required: form purpose explanation, confirmation copy, any privacy notice.`,
    defaultMigrationTrack: 'Manual Rebuild',
    notes: 'Forms rarely script-migrate cleanly. Rebuild in the new CMS\'s form tool.'
  },
  {
    patternName: 'Search Results',
    description: 'Site search results page',
    buildGuidanceDefault:
`- Configure the new CMS's search component / external search integration
- Empty-state, no-results, and faceted results states
- Result-count and pagination`,
    writerBriefDefault:
`No body content — generated. Empty-state and no-results copy can be tuned per project.`,
    defaultMigrationTrack: 'Configure',
    notes: 'Typically rebuilt in the new CMS\'s search.'
  },
  {
    patternName: 'Generic Content Page',
    description: 'Fallback page template for content that doesn\'t fit other patterns',
    buildGuidanceDefault:
`- Standard rich-text page template, no specialized components
- Optional sidebar/related-content rail
- Last-updated date`,
    writerBriefDefault:
`Audience: visitors who arrived via search or direct link.
Purpose: convey information clearly when there's no specialized template.`,
    defaultMigrationTrack: 'Scripted',
    notes: 'Use when none of the other patterns fit. Consider whether a more specific pattern should be added to the library.'
  }
];

function parsePatternLibrarySheet(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const entries = [];
  for (let i = 1; i < rawData.length; i++) {
    const name = String(rawData[i][0] || '').trim();
    if (!name) continue;
    entries.push({
      patternName: name,
      description: String(rawData[i][1] || ''),
      buildGuidanceDefault: String(rawData[i][2] || ''),
      writerBriefDefault: String(rawData[i][3] || ''),
      defaultMigrationTrack: String(rawData[i][4] || '').trim(),
      notes: String(rawData[i][5] || ''),
      // Target-spec additions (appended columns; absent in older sheets → defaults)
      kind: String(rawData[i][6] || '').trim() || 'Page Template', // 'Page Template' | 'Content Model'
      migrationMappingDefault: String(rawData[i][7] || ''),
      fields: String(rawData[i][8] || '')
    });
  }
  return entries;
}

function writePatternLibrarySheet(workbook, library) {
  if (!Array.isArray(library)) return;
  const sheetName = 'PatternLibrary';
  const entries = library.filter(e => String(e?.patternName || '').trim());
  if (entries.length === 0) return;
  const aoa = [['Pattern_Name', 'Description', 'Build_Guidance_Default', 'Writer_Brief_Default', 'Default_Migration_Track', 'Notes', 'Kind', 'Migration_Mapping_Default', 'Fields']];
  entries.sort((a, b) => a.patternName.localeCompare(b.patternName));
  entries.forEach(e => aoa.push([
    e.patternName,
    clampCell(e.description || ''),
    clampCell(e.buildGuidanceDefault || ''),
    clampCell(e.writerBriefDefault || ''),
    e.defaultMigrationTrack || '',
    clampCell(e.notes || ''),
    e.kind || 'Page Template',
    clampCell(e.migrationMappingDefault || ''),
    clampCell(e.fields || '')
  ]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (workbook.SheetNames.includes(sheetName)) {
    workbook.Sheets[sheetName] = ws;
  } else {
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }
}

// ─── DesignPatternLibrary ──────────────────────────────────────────────────────
// Per-project library of design/UI patterns that can appear on any page.
// Stored as comma-separated values in the Design_Patterns audit column.

const DEFAULT_DESIGN_PATTERN_LIBRARY = [
  // ── Heroes ──────────────────────────────────────────────────────────────────
  { name: 'Hero – Background',    category: 'Hero',    complexity: 'Low',    description: 'Full-bleed background image with overlaid headline and CTA buttons.',           dsUrl: '', aliases: '', notes: '' },
  { name: 'Hero – Split',         category: 'Hero',    complexity: 'Low',    description: 'Image on one side, headline + body copy + CTA on the other.',                   dsUrl: '', aliases: 'Hero – Side by Side', notes: '' },
  { name: 'Hero – Overlay',       category: 'Hero',    complexity: 'Low',    description: 'Image with a semi-transparent color overlay and text layered on top.',           dsUrl: '', aliases: '', notes: '' },
  { name: 'Hero – Stacked',       category: 'Hero',    complexity: 'Low',    description: 'Image above, text content below; no overlap.',                                   dsUrl: '', aliases: '', notes: '' },
  { name: 'Hero – Minimal',       category: 'Hero',    complexity: 'Low',    description: 'Text-only hero; no image. Used for content-heavy interior pages.',               dsUrl: '', aliases: 'Text Hero, Page Header', notes: '' },
  { name: 'Hero – Person',        category: 'Hero',    complexity: 'Medium', description: 'Designed for bio/profile pages: photo, name, title, and brief copy.',            dsUrl: '', aliases: 'Bio Hero', notes: '' },
  { name: 'Hero – Video',         category: 'Hero',    complexity: 'High',   description: 'Background video loop (muted autoplay) with headline and CTA overlaid.',         dsUrl: '', aliases: '', notes: 'WCAG: must provide pause control and captions.' },
  { name: 'Hero – Logo',          category: 'Hero',    complexity: 'Low',    description: 'Large logo as focal point; used for brand or partnership landing pages.',         dsUrl: '', aliases: '', notes: '' },
  // ── Cards & Pathways ────────────────────────────────────────────────────────
  { name: 'Card – Standard',      category: 'Card',    complexity: 'Low',    description: 'Image + headline + excerpt + link; the most common card variant.',               dsUrl: '', aliases: 'Content Card', notes: '' },
  { name: 'Card – Overlay',       category: 'Card',    complexity: 'Low',    description: 'Text overlaid on image, usually with a gradient scrim.',                         dsUrl: '', aliases: '', notes: '' },
  { name: 'Card – Icon',          category: 'Card',    complexity: 'Low',    description: 'Icon + headline + short description; no image.',                                 dsUrl: '', aliases: 'Feature Card', notes: '' },
  { name: 'Card – Pathway',       category: 'Card',    complexity: 'Low',    description: 'Navigational card with directional intent; often labeled "Explore" or similar.', dsUrl: '', aliases: 'Promo Card', notes: '' },
  { name: 'Card – Sticky Pathway',category: 'Card',    complexity: 'High',   description: 'Image stays fixed while long body text scrolls alongside it.',                  dsUrl: '', aliases: 'Scrolling Feature', notes: '' },
  { name: 'Card – Person',        category: 'Card',    complexity: 'Low',    description: 'Photo + name + title + contact info; grouped as a team grid.',                   dsUrl: '', aliases: 'Staff Card, Faculty Card', notes: '' },
  { name: 'Card – Event',         category: 'Card',    complexity: 'Medium', description: 'Date + time + title + location; tied to calendar/events data.',                  dsUrl: '', aliases: 'Event Listing', notes: '' },
  { name: 'Card – Video',         category: 'Card',    complexity: 'Medium', description: 'Thumbnail with play button; opens inline or in a modal player.',                 dsUrl: '', aliases: 'Video Tile', notes: '' },
  { name: 'Card – Stat',          category: 'Card',    complexity: 'Low',    description: 'Single large number or metric with a short label.',                              dsUrl: '', aliases: 'Metric Card, Number Callout', notes: '' },
  { name: 'Card – News',          category: 'Card',    complexity: 'Low',    description: 'Headline + date + excerpt for editorial/news content.',                          dsUrl: '', aliases: 'Article Card, Blog Card', notes: '' },
  { name: 'Card – Logo',          category: 'Card',    complexity: 'Low',    description: 'Partner or sponsor logo with an optional link.',                                 dsUrl: '', aliases: 'Partner Card', notes: '' },
  // ── Collection layouts ───────────────────────────────────────────────────────
  { name: 'Card Collection',      category: 'Collection', complexity: 'Low',    description: 'Grid or row of cards; the most common section pattern on institutional sites.', dsUrl: '', aliases: 'Card Grid, Card Row', notes: '' },
  { name: 'Filterable Card Grid', category: 'Collection', complexity: 'High',   description: 'Card grid with filter chips or dropdowns to narrow results by tag/category.',   dsUrl: '', aliases: 'Filtered Listing', notes: '' },
  { name: 'Carousel / Slider',    category: 'Collection', complexity: 'Medium', description: 'Auto- or manually-advancing sequence of cards or images.',                      dsUrl: '', aliases: 'Slideshow, Rotator', notes: 'Low engagement in A/B research; use sparingly.' },
  { name: 'Logo Cloud',           category: 'Collection', complexity: 'Low',    description: 'Horizontal strip of partner, client, or accreditation logos.',                  dsUrl: '', aliases: 'Partner Logos, Sponsor Strip', notes: '' },
  { name: 'Team Grid',            category: 'Collection', complexity: 'Low',    description: 'Section-level grid of person cards for a department or team.',                  dsUrl: '', aliases: 'People Grid', notes: '' },
  // ── Navigation (page-level) ──────────────────────────────────────────────────
  { name: 'Breadcrumbs',          category: 'Navigation', complexity: 'Low',    description: 'Location path from site root to current page.',                                dsUrl: '', aliases: '', notes: '' },
  { name: 'Anchor Links Bar',     category: 'Navigation', complexity: 'Medium', description: 'Sticky or static bar of jump-links to named sections on the same page.',        dsUrl: '', aliases: 'In-page Nav, Jump Links', notes: '' },
  { name: 'Section Nav – Tabs',   category: 'Navigation', complexity: 'Medium', description: 'Horizontal tab strip switching between content panels.',                        dsUrl: '', aliases: 'Tabbed Navigation', notes: '' },
  { name: 'Section Nav – Vertical',category:'Navigation', complexity: 'Low',    description: 'Left-rail navigation within a section or topic area.',                          dsUrl: '', aliases: 'Side Nav, Left Nav', notes: '' },
  { name: 'Pagination',           category: 'Navigation', complexity: 'Low',    description: 'Numbered or prev/next page controls for a listing.',                            dsUrl: '', aliases: '', notes: '' },
  { name: 'Directional Links',    category: 'Navigation', complexity: 'Low',    description: 'Prev / Next links at the bottom of sequential content.',                        dsUrl: '', aliases: 'Prev-Next Nav', notes: '' },
  { name: 'Steps / Progress',     category: 'Navigation', complexity: 'Medium', description: 'Numbered step indicator for multi-step flows or processes.',                    dsUrl: '', aliases: 'Step Indicator, Wizard Nav', notes: '' },
  // ── People & Profiles ────────────────────────────────────────────────────────
  { name: 'Bio Block',            category: 'People',  complexity: 'Medium', description: 'Full profile section: photo, name, title, narrative bio, credentials.',          dsUrl: '', aliases: 'Faculty Bio, Staff Bio', notes: '' },
  { name: 'Expert Feed',          category: 'People',  complexity: 'High',   description: 'Grid of expert profiles filterable by topic or organizational unit.',             dsUrl: '', aliases: 'Expert Directory', notes: 'Higher-ed specific; typically database-driven.' },
  // ── Content & Text ───────────────────────────────────────────────────────────
  { name: 'Rich Text Block',      category: 'Content', complexity: 'Low',    description: 'Basic WYSIWYG body content: paragraphs, lists, inline images.',                 dsUrl: '', aliases: 'Body Copy, WYSIWYG', notes: '' },
  { name: 'Callout / Alert',      category: 'Content', complexity: 'Low',    description: 'Highlighted box (info, warning, success, neutral) to call out key info.',        dsUrl: '', aliases: 'Notice, Banner Alert', notes: '' },
  { name: 'Pull Quote',           category: 'Content', complexity: 'Low',    description: 'Emphasized excerpt or attributed quote, visually distinct from body text.',      dsUrl: '', aliases: 'Blockquote, Featured Quote', notes: '' },
  { name: 'Accordion / FAQ',      category: 'Content', complexity: 'Low',    description: 'Expandable/collapsible content sections; common for FAQs and long text.',       dsUrl: '', aliases: 'Expandable, Disclosure', notes: '' },
  { name: 'Table',                category: 'Content', complexity: 'Medium', description: 'Structured data in rows and columns.',                                           dsUrl: '', aliases: 'Data Table, Comparison Table', notes: '' },
  { name: 'Timeline',             category: 'Content', complexity: 'Medium', description: 'Chronological narrative with dates and milestones.',                             dsUrl: '', aliases: 'History Timeline', notes: '' },
  { name: 'Feature Section',      category: 'Content', complexity: 'Low',    description: 'Image + headline + body + CTA arranged as a standalone highlight section.',      dsUrl: '', aliases: 'Feature Block, Split Content', notes: '' },
  // ── Social Proof ─────────────────────────────────────────────────────────────
  { name: 'Testimonial',          category: 'Social Proof', complexity: 'Low',    description: 'Attributed quote with photo, name, and credentials.',                           dsUrl: '', aliases: 'Quote, Review', notes: '' },
  { name: 'Testimonial Carousel', category: 'Social Proof', complexity: 'Medium', description: 'Auto-rotating or manually-advanced testimonial display.',                       dsUrl: '', aliases: '', notes: '' },
  { name: 'Awards / Rankings',    category: 'Social Proof', complexity: 'Low',    description: 'Badge or text display of recognition, rankings, or certifications.',            dsUrl: '', aliases: 'Rankings Block', notes: '' },
  // ── Stats & Metrics ───────────────────────────────────────────────────────────
  { name: 'Stats Block',          category: 'Stats',   complexity: 'Low',    description: '3–4 large numbers with short labels (e.g. "94% job placement").',               dsUrl: '', aliases: 'Key Metrics, Numbers Block', notes: '' },
  { name: 'Comparison Table',     category: 'Stats',   complexity: 'Medium', description: 'Side-by-side feature/option comparison with checkmarks or values.',              dsUrl: '', aliases: 'Pricing Table', notes: '' },
  { name: 'Data Visualization',   category: 'Stats',   complexity: 'High',   description: 'Custom chart, infographic, or interactive data display.',                        dsUrl: '', aliases: 'Chart, Infographic, Dataviz', notes: '' },
  // ── CTAs & Conversion ────────────────────────────────────────────────────────
  { name: 'CTA Banner',           category: 'CTA',     complexity: 'Low',    description: 'Full-width section with a headline, short text, and 1–2 action buttons.',       dsUrl: '', aliases: 'CTA Section, Action Banner', notes: '' },
  { name: 'CTA – Inline Button',  category: 'CTA',     complexity: 'Low',    description: 'A single action button within a content flow.',                                  dsUrl: '', aliases: 'Button, CTA Button', notes: '' },
  { name: 'Newsletter Signup',    category: 'CTA',     complexity: 'Low',    description: 'Email address field with a subscribe button; often in-page or in footer.',       dsUrl: '', aliases: 'Email Signup', notes: '' },
  // ── Forms ─────────────────────────────────────────────────────────────────────
  { name: 'Contact Form',         category: 'Form',    complexity: 'Medium', description: 'General inquiry form: name, email, message, optional subject.',                 dsUrl: '', aliases: 'Inquiry Form', notes: '' },
  { name: 'Search Form',          category: 'Form',    complexity: 'Medium', description: 'Query input with results rendered on page or on a results page.',               dsUrl: '', aliases: 'Search Bar, Search UI', notes: '' },
  { name: 'Faceted Filter',       category: 'Form',    complexity: 'High',   description: 'Multi-dimension filter UI: dropdowns, checkboxes, date pickers.',               dsUrl: '', aliases: 'Filtered Search, Facets', notes: '' },
  { name: 'Application / Inquiry',category: 'Form',    complexity: 'High',   description: 'Multi-field conversion form for inquiries, applications, or registrations.',    dsUrl: '', aliases: 'Lead Form, Registration Form', notes: '' },
  // ── Media ──────────────────────────────────────────────────────────────────────
  { name: 'Video Player',         category: 'Media',   complexity: 'Medium', description: 'Embedded video player (YouTube, Vimeo, or hosted); inline or modal.',           dsUrl: '', aliases: 'Video Embed', notes: '' },
  { name: 'Image Gallery',        category: 'Media',   complexity: 'Medium', description: 'Grid or masonry of photos, optionally with lightbox.',                          dsUrl: '', aliases: 'Photo Gallery', notes: '' },
  { name: 'Audio Player',         category: 'Media',   complexity: 'Medium', description: 'Embedded audio player for podcasts or recorded content.',                       dsUrl: '', aliases: 'Podcast Player', notes: '' },
  // ── Dynamic Feeds ────────────────────────────────────────────────────────────
  { name: 'News / Blog Feed',     category: 'Feed',    complexity: 'Medium', description: 'Dynamically populated list of articles/posts from a CMS query.',               dsUrl: '', aliases: 'Article Feed, Latest Posts', notes: '' },
  { name: 'Events Feed',          category: 'Feed',    complexity: 'Medium', description: 'Upcoming events pulled from a calendar data source.',                           dsUrl: '', aliases: 'Upcoming Events', notes: '' },
  { name: 'Social Media Feed',    category: 'Feed',    complexity: 'High',   description: 'Embedded social content from Instagram, X, LinkedIn, etc.',                    dsUrl: '', aliases: '', notes: 'GDPR/privacy risk. Check with legal before use.' },
  // ── Structural ────────────────────────────────────────────────────────────────
  { name: 'Sidebar',              category: 'Structural', complexity: 'Medium', description: 'Persistent secondary column alongside main content.',                         dsUrl: '', aliases: 'Right Rail, Left Rail', notes: '' },
  { name: 'Map Embed',            category: 'Structural', complexity: 'Medium', description: 'Embedded interactive or static map (Google Maps, Mapbox, etc.).',             dsUrl: '', aliases: 'Location Map', notes: '' },
];

function parseDesignPatternLibrarySheet(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const entries = [];
  for (let i = 1; i < rawData.length; i++) {
    const name = String(rawData[i][0] || '').trim();
    if (!name) continue;
    entries.push({
      name:        name,
      category:    String(rawData[i][1] || '').trim(),
      complexity:  String(rawData[i][2] || '').trim(),
      description: String(rawData[i][3] || ''),
      dsUrl:       String(rawData[i][4] || '').trim(),
      aliases:     String(rawData[i][5] || ''),
      notes:       String(rawData[i][6] || ''),
    });
  }
  return entries;
}

function writeDesignPatternLibrarySheet(workbook, library) {
  if (!Array.isArray(library)) return;
  const sheetName = 'DesignPatternLibrary';
  const entries = library.filter(e => String(e?.name || '').trim());
  if (entries.length === 0) return;
  const aoa = [['Name', 'Category', 'Complexity', 'Description', 'DS_URL', 'Aliases', 'Notes']];
  entries.sort((a, b) => {
    const ca = a.category || '', cb = b.category || '';
    if (ca !== cb) return ca.localeCompare(cb);
    return (a.name || '').localeCompare(b.name || '');
  });
  entries.forEach(e => aoa.push([
    e.name, e.category || '', e.complexity || '', e.description || '',
    e.dsUrl || '', e.aliases || '', e.notes || ''
  ]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (workbook.SheetNames.includes(sheetName)) {
    workbook.Sheets[sheetName] = ws;
  } else {
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }
}

function parseGlossarySheet(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const glossary = { tags: {}, groups: {} };
  // Skip header row
  for (let i = 1; i < rawData.length; i++) {
    const type = String(rawData[i][0] || '').trim().toLowerCase();
    const name = String(rawData[i][1] || '').trim();
    const notes = String(rawData[i][2] || '');
    if (!name) continue;
    if (type === 'tag') glossary.tags[name] = notes;
    else if (type === 'group') glossary.groups[name] = notes;
  }
  return glossary;
}

function writeGlossarySheet(workbook, glossary) {
  if (!glossary) return;
  const tags = glossary.tags || {};
  const groups = glossary.groups || {};
  const tagKeys = Object.keys(tags).filter(k => String(tags[k] || '').trim());
  const groupKeys = Object.keys(groups).filter(k => String(groups[k] || '').trim());
  const sheetName = 'KKE_Glossary';
  if (tagKeys.length === 0 && groupKeys.length === 0) {
    // Nothing to write; leave any existing sheet alone
    return;
  }
  const aoa = [['Type', 'Name', 'Notes']];
  tagKeys.sort().forEach(k => aoa.push(['Tag', k, tags[k]]));
  groupKeys.sort().forEach(k => aoa.push(['Group', k, groups[k]]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (workbook.SheetNames.includes(sheetName)) {
    workbook.Sheets[sheetName] = ws;
  } else {
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }
}

function detectUrlColumn(headers) {
  // 'Address' is the Screaming Frog default — listed first
  const candidates = ['address', 'url', 'link', 'website', 'href', 'uri'];
  for (const h of headers) {
    if (candidates.includes(h.toLowerCase().trim())) return h;
  }
  return null;
}

function writeWorkbook(filePath, headers, rows, newNavNodes, allNavNodes, projectSettings, changeLog, opts = {}) {
  try {
    const aoa = [headers];
    for (const row of rows) {
      aoa.push(headers.map(h => clampCell(row[h] ?? '')));
    }

    const targetSheet = currentSheetName || 'Sheet1';
    let workbook;

    // Preserve other sheets from the original file
    if (fs.existsSync(filePath)) {
      try {
        workbook = XLSX.readFile(filePath, { type: 'file' });
      } catch (e) {
        workbook = XLSX.utils.book_new();
      }
    } else {
      workbook = XLSX.utils.book_new();
    }

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Replace the target data sheet
    if (workbook.SheetNames.includes(targetSheet)) {
      workbook.Sheets[targetSheet] = worksheet;
    } else {
      XLSX.utils.book_append_sheet(workbook, worksheet, targetSheet);
    }
    const sheetsWeEdit = new Set([targetSheet]);

    // Full rewrite of NavStructure sheet (nav editor edits)
    if (allNavNodes && allNavNodes.length > 0) {
      if (navSheetInfo && workbook.Sheets[navSheetInfo.sheetName]) {
        // Rewrite existing NavStructure sheet
        const nsName = navSheetInfo.sheetName;
        sheetsWeEdit.add(nsName);
        const nsWs = workbook.Sheets[nsName];
        const nsData = XLSX.utils.sheet_to_json(nsWs, { header: 1, defval: '' });
        const nsHeaders = nsData[0].map(String);

        // Ensure RefNodeID column exists
        if (!nsHeaders.includes('RefNodeID')) {
          nsHeaders.push('RefNodeID');
          nsData[0] = nsHeaders;
        }
        // Ensure InMenu column exists
        if (!nsHeaders.includes('InMenu')) {
          nsHeaders.push('InMenu');
          nsData[0] = nsHeaders;
        }
        // Ensure URL column exists
        if (!nsHeaders.includes('URL')) {
          nsHeaders.push('URL');
          nsData[0] = nsHeaders;
        }
        // Ensure Notes column exists
        if (!nsHeaders.includes('Notes')) {
          nsHeaders.push('Notes');
          nsData[0] = nsHeaders;
        }
        // Ensure Phase column exists
        if (!nsHeaders.includes('Phase')) {
          nsHeaders.push('Phase');
          nsData[0] = nsHeaders;
        }
        // Phase 2, Chunk α: build / write metadata columns
        const ensureCols = ['Build_Pattern', 'Build_Guidance', 'Writer_Brief', 'Page_Status', 'Build_Assignee', 'Write_Assignee', 'Migrate_Assignee'];
        ensureCols.forEach(c => {
          if (!nsHeaders.includes(c)) {
            nsHeaders.push(c);
            nsData[0] = nsHeaders;
          }
        });
        // Node_Type is now active — auto-add so header/structural nodes persist
        if (!nsHeaders.includes('Node_Type')) {
          nsHeaders.push('Node_Type');
          nsData[0] = nsHeaders;
        }
        // Nav_Layer: Phase 5 reserved — preserve if present, do not auto-add
        const colIdx = {
          number:       nsHeaders.indexOf('Number'),
          label:        nsHeaders.indexOf('Label'),
          path:         nsHeaders.indexOf('Path'),
          sortID:       nsHeaders.indexOf('SortID'),
          parentNumber: nsHeaders.indexOf('ParentNumber'),
          computedPath: nsHeaders.indexOf('Computed Path'),
          breadcrumb:   nsHeaders.indexOf('Breadcrumb'),
          id:           nsHeaders.indexOf('ID'),
          refNodeId:    nsHeaders.indexOf('RefNodeID'),
          inMenu:       nsHeaders.indexOf('InMenu'),
          url:          nsHeaders.indexOf('URL'),
          notes:        nsHeaders.indexOf('Notes'),
          phase:        nsHeaders.indexOf('Phase'),
          nodeType:     nsHeaders.indexOf('Node_Type'),
          navLayer:     nsHeaders.indexOf('Nav_Layer'),
          // Phase 2, Chunk α
          buildPattern:   nsHeaders.indexOf('Build_Pattern'),
          buildGuidance:  nsHeaders.indexOf('Build_Guidance'),
          writerBrief:    nsHeaders.indexOf('Writer_Brief'),
          pageStatus:     nsHeaders.indexOf('Page_Status'),
          buildAssignee:  nsHeaders.indexOf('Build_Assignee'),
          writeAssignee:  nsHeaders.indexOf('Write_Assignee'),
          migrateAssignee: nsHeaders.indexOf('Migrate_Assignee')
        };

        const rebuilt = [nsData[0]];
        for (const node of allNavNodes) {
          const newRow = new Array(nsHeaders.length).fill('');
          if (colIdx.number >= 0)       newRow[colIdx.number]       = node.number;
          if (colIdx.label >= 0)        newRow[colIdx.label]        = node.label;
          if (colIdx.path >= 0)         newRow[colIdx.path]         = node.path;
          if (colIdx.sortID >= 0)       newRow[colIdx.sortID]       = node.sortID;
          if (colIdx.parentNumber >= 0) newRow[colIdx.parentNumber] = node.parentNumber;
          if (colIdx.computedPath >= 0) newRow[colIdx.computedPath] = node.computedPath;
          if (colIdx.breadcrumb >= 0)   newRow[colIdx.breadcrumb]   = node.breadcrumb;
          if (colIdx.id >= 0)           newRow[colIdx.id]           = node.id;
          if (colIdx.refNodeId >= 0)    newRow[colIdx.refNodeId]    = node.refNodeId || '';
          if (colIdx.inMenu >= 0)       newRow[colIdx.inMenu]       = node.inMenu || '';
          if (colIdx.url >= 0)          newRow[colIdx.url]          = node.url || '';
          if (colIdx.notes >= 0)        newRow[colIdx.notes]        = clampCell(node.notes || '');
          if (colIdx.phase >= 0)        newRow[colIdx.phase]        = node.phase || '';
          // Phase 5 reserved fields — preserve through round-trip
          if (colIdx.nodeType >= 0)     newRow[colIdx.nodeType]     = node.nodeType || '';
          if (colIdx.navLayer >= 0)     newRow[colIdx.navLayer]     = node.navLayer || '';
          // Phase 2, Chunk α: build / write metadata
          if (colIdx.buildPattern   >= 0) newRow[colIdx.buildPattern]   = node.buildPattern   || '';
          if (colIdx.buildGuidance  >= 0) newRow[colIdx.buildGuidance]  = clampCell(node.buildGuidance  || '');
          if (colIdx.writerBrief    >= 0) newRow[colIdx.writerBrief]    = clampCell(node.writerBrief    || '');
          if (colIdx.pageStatus     >= 0) newRow[colIdx.pageStatus]     = node.pageStatus     || '';
          if (colIdx.buildAssignee  >= 0) newRow[colIdx.buildAssignee]  = node.buildAssignee  || '';
          if (colIdx.writeAssignee  >= 0) newRow[colIdx.writeAssignee]  = node.writeAssignee  || '';
          if (colIdx.migrateAssignee >= 0) newRow[colIdx.migrateAssignee] = node.migrateAssignee || '';
          rebuilt.push(newRow);
        }

        workbook.Sheets[nsName] = XLSX.utils.aoa_to_sheet(rebuilt);
      } else {
        // Create new NavStructure sheet — full column set, so projects (which
        // always export from scratch) round-trip notes/phase/build metadata.
        const nsName = 'NavStructure';
        const nsHeaders = ['ID', 'Number', 'ParentNumber', 'Label', 'Path', 'SortID', 'Computed Path', 'Breadcrumb',
                           'RefNodeID', 'InMenu', 'URL', 'Notes', 'Phase', 'Node_Type', 'Nav_Layer',
                           'Build_Pattern', 'Build_Guidance', 'Writer_Brief', 'Page_Status',
                           'Build_Assignee', 'Write_Assignee', 'Migrate_Assignee'];
        const rebuilt = [nsHeaders];
        for (const node of allNavNodes) {
          rebuilt.push([
            node.id, node.number, node.parentNumber || '',
            node.label, node.path || '', node.sortID || '',
            node.computedPath || '', node.breadcrumb || '',
            node.refNodeId || '', node.inMenu || '', node.url || '',
            node.notes || '', node.phase || '', node.nodeType || '', node.navLayer || '',
            node.buildPattern || '', node.buildGuidance || '', node.writerBrief || '', node.pageStatus || '',
            node.buildAssignee || '', node.writeAssignee || '', node.migrateAssignee || ''
          ]);
        }
        workbook.Sheets[nsName] = XLSX.utils.aoa_to_sheet(rebuilt);
        if (!workbook.SheetNames.includes(nsName)) {
          workbook.SheetNames.push(nsName);
        }
        // Set navSheetInfo so subsequent saves can rewrite
        navSheetInfo = {
          sheetName: nsName,
          columns: { id: 0, number: 1, parentNumber: 2, label: 3, path: 4, sortID: 5, computedPath: 6, breadcrumb: 7 }
        };
      }
    }
    // Append new nav nodes to NavStructure sheet (legacy: from nav popover child creation)
    else if (newNavNodes && newNavNodes.length > 0 && navSheetInfo) {
      const nsName = navSheetInfo.sheetName;
      sheetsWeEdit.add(nsName);
      if (workbook.Sheets[nsName]) {
        const nsWs = workbook.Sheets[nsName];
        const nsData = XLSX.utils.sheet_to_json(nsWs, { header: 1, defval: '' });
        const nsHeaders = nsData[0].map(String);

        // Column indices in NavStructure
        const colIdx = {
          number:       nsHeaders.indexOf('Number'),
          label:        nsHeaders.indexOf('Label'),
          path:         nsHeaders.indexOf('Path'),
          sortID:       nsHeaders.indexOf('SortID'),
          parentNumber: nsHeaders.indexOf('ParentNumber'),
          computedPath: nsHeaders.indexOf('Computed Path'),
          breadcrumb:   nsHeaders.indexOf('Breadcrumb'),
          id:           nsHeaders.indexOf('ID')
        };

        // Collect existing IDs to avoid duplicates
        const existingIds = new Set();
        for (let i = 1; i < nsData.length; i++) {
          if (colIdx.id >= 0) existingIds.add(String(nsData[i][colIdx.id] || ''));
        }

        for (const node of newNavNodes) {
          if (existingIds.has(node.id)) continue; // already written
          const newRow = new Array(nsHeaders.length).fill('');
          if (colIdx.number >= 0)       newRow[colIdx.number]       = node.number;
          if (colIdx.label >= 0)        newRow[colIdx.label]        = node.label;
          if (colIdx.path >= 0)         newRow[colIdx.path]         = node.path;
          if (colIdx.sortID >= 0)       newRow[colIdx.sortID]       = node.sortID;
          if (colIdx.parentNumber >= 0) newRow[colIdx.parentNumber] = node.parentNumber;
          if (colIdx.computedPath >= 0) newRow[colIdx.computedPath] = node.computedPath;
          if (colIdx.breadcrumb >= 0)   newRow[colIdx.breadcrumb]   = node.breadcrumb;
          if (colIdx.id >= 0)           newRow[colIdx.id]           = node.id;
          nsData.push(newRow);
          existingIds.add(node.id);
        }

        workbook.Sheets[nsName] = XLSX.utils.aoa_to_sheet(nsData);
      }
    }

    // Write project settings sheet
    if (projectSettings) {
      writeSettingsSheet(workbook, projectSettings);
      sheetsWeEdit.add('KKE_Settings');
      if (projectSettings.glossary) {
        writeGlossarySheet(workbook, projectSettings.glossary);
        sheetsWeEdit.add('KKE_Glossary');
      }
      if (Array.isArray(projectSettings.contentTypeRegistry) && projectSettings.contentTypeRegistry.length > 0) {
        writeContentTypeRegistrySheet(workbook, projectSettings.contentTypeRegistry);
        sheetsWeEdit.add('ContentTypeRegistry');
      }
      if (Array.isArray(projectSettings.patternLibrary) && projectSettings.patternLibrary.length > 0) {
        writePatternLibrarySheet(workbook, projectSettings.patternLibrary);
        sheetsWeEdit.add('PatternLibrary');
      }
      if (Array.isArray(projectSettings.designPatternLibrary) && projectSettings.designPatternLibrary.length > 0) {
        writeDesignPatternLibrarySheet(workbook, projectSettings.designPatternLibrary);
        sheetsWeEdit.add('DesignPatternLibrary');
      }
    }

    // Append to change log sheet (or replace it wholesale when the caller is
    // exporting a project's full history — re-exporting would otherwise duplicate)
    if (changeLog && changeLog.length > 0) {
      const clName = 'KKE_ChangeLog';
      sheetsWeEdit.add(clName);
      const clHeaders = ['Timestamp', 'Row', 'URL', 'Field', 'Old Value', 'New Value'];
      let existingRows = [];
      if (!opts.replaceChangeLog && workbook.Sheets[clName]) {
        const existing = XLSX.utils.sheet_to_json(workbook.Sheets[clName], { header: 1, defval: '' });
        if (existing.length > 1) existingRows = existing.slice(1); // skip header
      }
      const newRows = changeLog.map(e => [e.timestamp, e.row, e.url || '', e.field, e.from, e.to]);
      const allRows = [clHeaders, ...existingRows, ...newRows];
      workbook.Sheets[clName] = XLSX.utils.aoa_to_sheet(allRows);
      if (!workbook.SheetNames.includes(clName)) workbook.SheetNames.push(clName);
    }

    // Strip ALL formulas — SheetJS can't faithfully round-trip cross-sheet
    // refs or Google Sheets functions, causing Excel to flag the file as corrupt.
    // Our edited sheets are built from scratch (no formulas), and other sheets'
    // formulas are replaced with their cached values.
    for (const sn of workbook.SheetNames) {
      const ws = workbook.Sheets[sn];
      for (const addr in ws) {
        if (addr[0] === '!') continue;
        if (ws[addr].f) {
          delete ws[addr].f;
        }
      }
    }

    XLSX.writeFile(workbook, filePath, { compression: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('open-file-dialog', async () => { await openFileDialog(); });

ipcMain.handle('get-last-file', async () => {
  const prefs = loadPrefs();
  if (prefs.lastFile && fs.existsSync(prefs.lastFile)) {
    const data = isProjectFile(prefs.lastFile)
      ? readProject(prefs.lastFile)
      : readWorkbook(prefs.lastFile, prefs.lastSheet || null);
    if (data) {
      currentFilePath = prefs.lastFile;
      currentSheetName = data.sheetName;
      recordRecentFile(prefs.lastFile);
      return { filePath: prefs.lastFile, ...data };
    }
  }
  return null;
});

ipcMain.handle('reload-sheet', async (event, { sheetName }) => {
  if (!currentFilePath) return null;
  const data = isProjectFile(currentFilePath)
    ? readProject(currentFilePath)  // projects are single-sheet; ignore sheetName
    : readWorkbook(currentFilePath, sheetName || currentSheetName);
  if (data) {
    currentSheetName = data.sheetName;
    savePrefs({ lastSheet: data.sheetName });
    return { filePath: currentFilePath, ...data };
  }
  return null;
});

ipcMain.handle('save-file', async (event, { headers, rows, newNavNodes, allNavNodes, projectSettings, changeLog }) => {
  if (!currentFilePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Spreadsheet',
      defaultPath: 'spreadsheet.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled) return { success: false, error: 'Cancelled' };
    currentFilePath = result.filePath;
    savePrefs({ lastFile: currentFilePath });
  }

  // .transmission projects save to SQLite — a single transaction, no workbook rebuild.
  if (isProjectFile(currentFilePath)) {
    try {
      if (!projectStore.isOpen) projectStore.open(currentFilePath);
      const result = projectStore.saveAll({ headers, rows, allNavNodes, projectSettings, changeLog, sheetName: currentSheetName });
      if (result.success) mainWindow?.webContents.send('save-success', currentFilePath);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  const result = writeWorkbook(currentFilePath, headers, rows, newNavNodes, allNavNodes, projectSettings, changeLog);
  if (result.success) mainWindow?.webContents.send('save-success', currentFilePath);
  return result;
});

// Read a workbook's KKE_ChangeLog sheet as changelog entries, so Save As
// Project can carry the spreadsheet's accumulated history into the DB.
// (The app always writes the sheet as 'KKE_ChangeLog', so the exact-name
// `sheets` filter keeps this read cheap — no need to parse the data sheets.)
function readWorkbookChangeLog(filePath) {
  try {
    const wb = XLSX.readFile(filePath, { type: 'file', sheets: 'KKE_ChangeLog' });
    const ws = wb.Sheets['KKE_ChangeLog'];
    if (!ws) return [];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return rows.slice(1)
      .filter(r => r.some(c => String(c).trim() !== ''))
      .map(r => ({
        timestamp: String(r[0] ?? ''),
        row: r[1] === '' ? null : r[1],
        url: String(r[2] ?? ''),
        field: String(r[3] ?? ''),
        from: String(r[4] ?? ''),
        to: String(r[5] ?? ''),
        auditor: ''  // unknown — xlsx history predates per-auditor logging
      }));
  } catch (e) {
    return [];
  }
}

// Convert the currently-open spreadsheet (plus all in-session edits) into a
// .transmission project file and switch the session over to it.
ipcMain.handle('save-as-project', async (event, payload) => {
  const base = currentFilePath
    ? path.basename(currentFilePath).replace(/\.[^.]+$/, '')
    : 'audit';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save As Transmission Project',
    defaultPath: base + '.transmission',
    filters: [{ name: 'Transmission Project', extensions: ['transmission'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };

  try {
    // Carry the source workbook's accumulated change history into the project
    const sourceLog = (currentFilePath && !isProjectFile(currentFilePath) && fs.existsSync(currentFilePath))
      ? readWorkbookChangeLog(currentFilePath)
      : [];
    projectStore.create(result.filePath);
    projectStore.saveAll({
      ...payload,
      changeLog: [...sourceLog, ...(payload.changeLog || [])],
      sheetName: currentSheetName || 'Data'
    });
    currentFilePath = result.filePath;
    navSheetInfo = null;
    savePrefs({ lastFile: currentFilePath, lastSheet: null });
    recordRecentFile(currentFilePath);
    mainWindow?.webContents.send('save-success', currentFilePath);
    return { success: true, filePath: currentFilePath };
  } catch (err) {
    projectStore.close();
    return { success: false, error: err.message };
  }
});

// Full xlsx export — the round-trip path back to Excel for projects (and a
// Save As for spreadsheets). For projects, the DB's change log is the log of
// record, so the export carries the full history.
ipcMain.handle('export-workbook', async (event, { headers, rows, allNavNodes, projectSettings, changeLog }) => {
  const base = currentFilePath
    ? path.basename(currentFilePath).replace(/\.[^.]+$/, '')
    : 'audit';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Full Workbook',
    defaultPath: base + '.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };

  let log = changeLog;
  let replaceChangeLog = false;
  if (isProjectFile(currentFilePath) && projectStore.isOpen) {
    try {
      log = projectStore.readChangeLog();
      replaceChangeLog = true; // full history, not an append — avoids duplicates on re-export
    } catch (e) { /* fall back to session log */ }
  }
  const res = writeWorkbook(result.filePath, headers, rows, undefined, allNavNodes, projectSettings, log, { replaceChangeLog });
  if (res.success) res.filePath = result.filePath;
  return res;
});

ipcMain.handle('get-current-path', () => currentFilePath);

ipcMain.handle('open-external', async (event, url) => { await shell.openExternal(url); });

// ─── Report templates (Markdown + Mustache, rendered with marked) ─────────────
// Templates live as .md files in ~/Documents/Transmission/templates/. Each may
// carry YAML-ish frontmatter (name, appliesTo). The renderer hands us a data
// context; we run Mustache then marked and return HTML. marked is ESM-only, so we
// load it via dynamic import (Electron's Node 20 can't require() an ESM package).
const Mustache = require('mustache');
const { marked } = require('marked'); // v4 (CommonJS) — require()-able from asar in the packaged build

function reportTemplatesDir() {
  return path.join(app.getPath('documents'), 'Transmission', 'templates');
}

function parseTemplateFrontmatter(text) {
  const m = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  m[1].split(/\r?\n/).forEach(line => {
    const mm = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (mm) meta[mm[1]] = mm[2].replace(/^["']|["']$/g, '').trim();
  });
  return { meta, body: text.slice(m[0].length) };
}

const SEED_REPORT_TEMPLATES = {
  'writer-builder-brief.md':
`---
name: Writer / Builder Brief (starter)
appliesTo: assignee-brief
---
# {{report.title}}

**{{client}}{{#project}} — {{.}}{{/project}}**
{{date}}

{{role}} worklist for **{{person}}** — {{summary.pages}} page(s), {{summary.sourcePages}} source page(s), across {{summary.patterns}} pattern(s).

<div class="page-break"></div>

{{#groups}}
## {{pattern}} — {{count}} page(s)

{{#hasReference}}
{{{referenceBrief}}}
{{/hasReference}}
{{^hasReference}}
*No reference brief recorded — these pages follow the established {{pattern}} convention.*
{{/hasReference}}

| Page | URL | Status | Pages |
|------|-----|--------|-------|
{{#pages}}| {{#hasBrief}}★ {{/hasBrief}}{{breadcrumb}} | {{url}} | {{status}} | {{sourceCount}} |
{{/pages}}

{{/groups}}

---
*Generated by Transmission — edit this file in the templates folder to change the layout.*
`,
  'FIELDS-assignee-brief.md':
`# Template fields — Writer / Builder Brief

Templates whose frontmatter says **appliesTo: assignee-brief** receive the data below.
Use {{field}} to insert a value, {{#section}}...{{/section}} to repeat a list (or show a
block when a value is present), and {{^section}}...{{/section}} for the empty case.
Use triple braces {{{field}}} to insert pre-formatted markdown without escaping — needed
for the brief fields.

## Top level
- **client** — client name
- **project** — project name
- **date** — formatted generation date
- **role** — "Writer" or "Builder"
- **person** — the assignee's name
- **report.title** — e.g. "Writer Brief — Jane Doe"
- **summary.pages** — nav pages assigned to this person
- **summary.sourcePages** — total source pages behind them
- **summary.patterns** — number of distinct build patterns
- **summary.briefs** — pages that have a page-specific brief

## groups  — repeat with {{#groups}} ... {{/groups}}
Each group is one build pattern.
- **pattern** — pattern name (or "No build pattern")
- **count** — pages in this group
- **hasReference** — true when a reference brief exists; use {{#hasReference}} ... {{/hasReference}}
- **referenceBrief** — the reference brief as markdown; insert with {{{referenceBrief}}}
- **briefs** — individual reference briefs, each with **label** and **md**; loop {{#briefs}} ... {{/briefs}} and insert {{{md}}}
- **pages** — the pages in this group (below)

## pages  — repeat with {{#pages}} ... {{/pages}} inside a group
- **breadcrumb** — full nav path (falls back to the node label)
- **label** — the node's own label
- **url** — target URL (site domain + computed path)
- **status** — page status (may be empty)
- **sourceCount** — source pages behind this node
- **hasBrief** — true when this page has its own brief
- **brief** — this page's brief as markdown; insert with {{{brief}}}

## Tips
- A bare {{value}} is HTML-escaped (safe). Use {{{value}}} only for the markdown brief fields.
- Add <div class="page-break"></div> anywhere to force a page break in the exported PDF.
- Copy the starter template, give it a unique **name:** in the frontmatter, and it appears
  as a separate choice in the report's template picker.
`
};

function ensureReportTemplates() {
  const dir = reportTemplatesDir();
  fs.mkdirSync(dir, { recursive: true });
  for (const [fname, content] of Object.entries(SEED_REPORT_TEMPLATES)) {
    const fp = path.join(dir, fname);
    if (!fs.existsSync(fp)) { try { fs.writeFileSync(fp, content); } catch (e) { /* ignore */ } }
  }
  return dir;
}

ipcMain.handle('list-report-templates', (event, appliesTo) => {
  try {
    const dir = ensureReportTemplates();
    const out = [];
    fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.md') && !f.toUpperCase().startsWith('FIELDS'))
      .forEach(f => {
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        const { meta } = parseTemplateFrontmatter(text);
        // Only offer templates whose appliesTo matches this report (keeps the
        // picker honest — a template authored for another context won't be listed).
        if (appliesTo && meta.appliesTo !== appliesTo) return;
        out.push({ name: meta.name || f.replace(/\.md$/i, ''), fileName: f, path: path.join(dir, f) });
      });
    out.sort((a, b) => a.name.localeCompare(b.name));
    return { success: true, dir, templates: out };
  } catch (err) { return { success: false, error: err.message, templates: [] }; }
});

ipcMain.handle('render-report-template', async (event, { templatePath, context }) => {
  try {
    const text = fs.readFileSync(templatePath, 'utf8');
    const { body } = parseTemplateFrontmatter(text);
    const rendered = Mustache.render(body, context || {});
    const html = marked.parse(rendered);
    return { success: true, html };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('open-templates-folder', () => {
  try { shell.openPath(ensureReportTemplates()); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

// Phase 1, Chunk B: return the curated default ContentTypeRegistry — renderer decides
// whether to merge it into projectSettings (opt-in seeding).
ipcMain.handle('get-default-content-type-registry', () => DEFAULT_CONTENT_TYPE_REGISTRY.map(e => ({ ...e })));

// Phase 2, Chunk β: same pattern for PatternLibrary.
ipcMain.handle('get-default-pattern-library', () => DEFAULT_PATTERN_LIBRARY.map(e => ({ ...e })));
ipcMain.handle('get-default-design-pattern-library', () => DEFAULT_DESIGN_PATTERN_LIBRARY.map(e => ({ ...e })));

ipcMain.handle('open-help-window', () => { openHelpWindow(); });

function openHelpWindow() {
  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.focus();
    return;
  }
  helpWindow = new BrowserWindow({
    width: 560,
    height: 700,
    minWidth: 400,
    minHeight: 300,
    title: 'Transmission — Help',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  helpWindow.loadFile(path.join(__dirname, 'src', 'help.html'));
  helpWindow.on('closed', () => { helpWindow = null; });
}

// Preferences (visible fields + tag library)
ipcMain.handle('get-prefs', () => {
  const prefs = loadPrefs();
  return {
    visibleFields: prefs.visibleFields || DEFAULT_VISIBLE_FIELDS,
    tagLibrary:    prefs.tagLibrary    || DEFAULT_TAG_LIBRARY,
    autoAdvance:   prefs.autoAdvance !== undefined ? prefs.autoAdvance : true,
    groupLibrary:  prefs.groupLibrary || [],
    sidebarWidth:  prefs.sidebarWidth  || null,
    sortOrder:     prefs.sortOrder     || '',
    filterText:    prefs.filterText    || '',
    rubricDir:       prefs.rubricDir       || getDefaultRubricDir(),
    claudeApiKey:    prefs.claudeApiKey    || '',
    sidebarColumns:  prefs.sidebarColumns  || [],
    customKkeStates: prefs.customKkeStates || [],
    tableColumns:    prefs.tableColumns || null,
    extraKkeCols:    prefs.extraKkeCols || [],
    kkeFilter:       prefs.kkeFilter || null,
    showSmeFields:   prefs.showSmeFields || false,
    showMigrationFields: prefs.showMigrationFields || false,
    showDesignPatterns: prefs.showDesignPatterns || false,
    hideBlankMetadata: prefs.hideBlankMetadata !== undefined ? prefs.hideBlankMetadata : true,
    collapsedClusters: prefs.collapsedClusters || {},
    pageTypeLibrary:   prefs.pageTypeLibrary   || [],
    designPatternLibrary: prefs.designPatternLibrary || [],
    seenWelcome:       prefs.seenWelcome || false,
    noteTemplates:     prefs.noteTemplates || []
  };
});

ipcMain.handle('save-prefs', (event, updates) => {
  savePrefs(updates);
  return { success: true };
});

// ─── Rubrics ──────────────────────────────────────────────────────────────────

function getDefaultRubricDir() {
  // Default: rubrics/ next to the app entry point (dev) or in userData (prod)
  const devPath = path.join(__dirname, 'rubrics');
  if (fs.existsSync(devPath)) return devPath;
  return path.join(userDataPath, 'rubrics');
}

function parseRubricFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fieldRules = [];
    const contentRules = [];
    let section = null;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (/^##\s+field\s+rules/i.test(trimmed)) { section = 'field'; continue; }
      if (/^##\s+content\s+rules/i.test(trimmed)) { section = 'content'; continue; }
      if (/^#\s+/.test(trimmed)) continue; // top-level heading

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const ruleText = trimmed.slice(2).trim();
        if (!ruleText) continue;
        if (section === 'field') {
          fieldRules.push(parseFieldRule(ruleText));
        } else if (section === 'content') {
          contentRules.push(ruleText);
        }
      }
    }
    return { fieldRules, contentRules };
  } catch (e) {
    return { fieldRules: [], contentRules: [] };
  }
}

function parseFieldRule(text) {
  // Compound: "Field >= X and Field < Y"
  const andParts = text.split(/\s+and\s+/i);
  if (andParts.length > 1) {
    return { type: 'compound', conditions: andParts.map(parseSingleCondition), raw: text };
  }
  return { type: 'single', ...parseSingleCondition(text), raw: text };
}

function parseSingleCondition(text) {
  // Patterns: "Field is Value", "Field is not Value", "Field >= N", "Field > N", etc.
  const ops = [
    { pattern: /^(.+?)\s+is not empty$/i,      op: 'is_not_empty', noVal: true },
    { pattern: /^(.+?)\s+is empty$/i,           op: 'is_empty', noVal: true },
    { pattern: /^(.+?)\s+is not\s+(.+)$/i,      op: 'is_not' },
    { pattern: /^(.+?)\s+is\s+(.+)$/i,          op: 'is' },
    { pattern: /^(.+?)\s+not contains\s+(.+)$/i, op: 'not_contains' },
    { pattern: /^(.+?)\s+contains\s+(.+)$/i,    op: 'contains' },
    { pattern: /^(.+?)\s+starts with\s+(.+)$/i, op: 'starts_with' },
    { pattern: /^(.+?)\s+ends with\s+(.+)$/i,   op: 'ends_with' },
    { pattern: /^(.+?)\s*>=\s*(.+)$/,           op: 'gte' },
    { pattern: /^(.+?)\s*<=\s*(.+)$/,           op: 'lte' },
    { pattern: /^(.+?)\s*>\s*(.+)$/,            op: 'gt' },
    { pattern: /^(.+?)\s*<\s*(.+)$/,            op: 'lt' },
  ];
  for (const { pattern, op, noVal } of ops) {
    const m = text.match(pattern);
    if (m) return { field: m[1].trim(), op, value: noVal ? '' : m[2].trim() };
  }
  return { field: text, op: 'truthy', value: '' };
}

function evaluateFieldRule(rule, row) {
  if (rule.type === 'compound') {
    return rule.conditions.every(c => evalCondition(c, row));
  }
  return evalCondition(rule, row);
}

function evalCondition(cond, row) {
  const cellVal = String(row[cond.field] ?? '').trim();
  const testVal = cond.value;
  switch (cond.op) {
    case 'is':           return cellVal.toLowerCase() === testVal.toLowerCase();
    case 'is_not':       return cellVal.toLowerCase() !== testVal.toLowerCase();
    case 'is_empty':     return cellVal === '';
    case 'is_not_empty': return cellVal !== '';
    case 'contains':     return cellVal.toLowerCase().includes(testVal.toLowerCase());
    case 'not_contains': return !cellVal.toLowerCase().includes(testVal.toLowerCase());
    case 'starts_with':  return cellVal.toLowerCase().startsWith(testVal.toLowerCase());
    case 'ends_with':    return cellVal.toLowerCase().endsWith(testVal.toLowerCase());
    case 'gt':           return parseFloat(cellVal) >  parseFloat(testVal);
    case 'gte':          return parseFloat(cellVal) >= parseFloat(testVal);
    case 'lt':           return parseFloat(cellVal) <  parseFloat(testVal);
    case 'lte':          return parseFloat(cellVal) <= parseFloat(testVal);
    case 'truthy':       return !!cellVal;
    default:             return false;
  }
}

// ─── Computed Columns: Tokenizer + Parser + Evaluator ──────────────────────

function tokenizeFormula(formula) {
  const tokens = [];
  let i = 0;
  while (i < formula.length) {
    // Skip whitespace
    if (/\s/.test(formula[i])) { i++; continue; }

    // Column reference: {Column Name}
    if (formula[i] === '{') {
      const end = formula.indexOf('}', i + 1);
      if (end === -1) throw new Error('Unclosed column reference {');
      tokens.push({ type: 'COL_REF', value: formula.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    // String literal: "..." or '...'
    if (formula[i] === '"' || formula[i] === "'") {
      const quote = formula[i];
      let str = '';
      i++;
      while (i < formula.length && formula[i] !== quote) {
        if (formula[i] === '\\' && i + 1 < formula.length) { str += formula[++i]; }
        else { str += formula[i]; }
        i++;
      }
      if (i >= formula.length) throw new Error(`Unclosed string literal`);
      i++; // skip closing quote
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    // Number (including decimals)
    if (/[0-9]/.test(formula[i]) || (formula[i] === '.' && i + 1 < formula.length && /[0-9]/.test(formula[i + 1]))) {
      let num = '';
      while (i < formula.length && /[0-9.]/.test(formula[i])) { num += formula[i++]; }
      tokens.push({ type: 'NUMBER', value: parseFloat(num) });
      continue;
    }

    // Two-char operators
    if (i + 1 < formula.length) {
      const two = formula.slice(i, i + 2);
      if (['>=', '<=', '==', '!='].includes(two)) {
        tokens.push({ type: 'OP', value: two });
        i += 2;
        continue;
      }
    }

    // Single-char operators and punctuation
    if ('+-*/%><'.includes(formula[i])) {
      tokens.push({ type: 'OP', value: formula[i] });
      i++;
      continue;
    }
    if (formula[i] === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (formula[i] === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (formula[i] === ',') { tokens.push({ type: 'COMMA' }); i++; continue; }
    if (formula[i] === ':') { tokens.push({ type: 'COLON' }); i++; continue; }

    // Identifier (function name)
    if (/[a-zA-Z_]/.test(formula[i])) {
      let ident = '';
      while (i < formula.length && /[a-zA-Z_0-9]/.test(formula[i])) { ident += formula[i++]; }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    throw new Error(`Unexpected character: '${formula[i]}' at position ${i}`);
  }
  tokens.push({ type: 'EOF' });
  return tokens;
}

function parseFormulaExpr(formula) {
  const tokens = tokenizeFormula(formula);
  let pos = 0;

  function peek() { return tokens[pos]; }
  function advance() { return tokens[pos++]; }
  function expect(type) {
    const t = advance();
    if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type}`);
    return t;
  }

  // Expression: comparison
  function parseExpr() { return parseComparison(); }

  function parseComparison() {
    let left = parseAddSub();
    while (peek().type === 'OP' && ['>', '<', '>=', '<=', '==', '!='].includes(peek().value)) {
      const op = advance().value;
      const right = parseAddSub();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
      const op = advance().value;
      const right = parseMulDiv();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  function parseMulDiv() {
    let left = parseUnary();
    while (peek().type === 'OP' && ('*/%'.includes(peek().value))) {
      const op = advance().value;
      const right = parseUnary();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  function parseUnary() {
    if (peek().type === 'OP' && peek().value === '-') {
      advance();
      const operand = parseUnary();
      return { type: 'BinaryOp', op: '*', left: { type: 'NumberLiteral', value: -1 }, right: operand };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();

    // Number
    if (t.type === 'NUMBER') {
      advance();
      return { type: 'NumberLiteral', value: t.value };
    }

    // String
    if (t.type === 'STRING') {
      advance();
      return { type: 'StringLiteral', value: t.value };
    }

    // Column reference
    if (t.type === 'COL_REF') {
      advance();
      return { type: 'ColumnRef', name: t.value };
    }

    // Parenthesized expression
    if (t.type === 'LPAREN') {
      advance();
      const expr = parseExpr();
      expect('RPAREN');
      return expr;
    }

    // Function call or classify
    if (t.type === 'IDENT') {
      const name = advance().value.toLowerCase();

      if (name === 'classify') {
        return parseClassify();
      }

      // Regular function call
      expect('LPAREN');
      const args = [];
      if (peek().type !== 'RPAREN') {
        args.push(parseExpr());
        while (peek().type === 'COMMA') {
          advance(); // skip comma
          args.push(parseExpr());
        }
      }
      expect('RPAREN');
      return { type: 'FunctionCall', name, args };
    }

    throw new Error(`Unexpected token: ${t.type}${t.value ? ' (' + t.value + ')' : ''}`);
  }

  function parseClassify() {
    // classify({col}, 0: "Kill", 40: "Evolve", 70: "Keep")
    expect('LPAREN');
    const valueExpr = parseExpr();
    const thresholds = [];
    while (peek().type === 'COMMA') {
      advance(); // skip comma
      // threshold: number or negative number
      let threshold;
      if (peek().type === 'OP' && peek().value === '-') {
        advance();
        threshold = -expect('NUMBER').value;
      } else {
        threshold = expect('NUMBER').value;
      }
      expect('COLON');
      const label = expect('STRING').value;
      thresholds.push({ threshold, label });
    }
    expect('RPAREN');
    // Sort ascending by threshold
    thresholds.sort((a, b) => a.threshold - b.threshold);
    return { type: 'Classify', valueExpr, thresholds };
  }

  const ast = parseExpr();
  if (peek().type !== 'EOF') throw new Error(`Unexpected token after expression: ${peek().type}`);
  return ast;
}

function evaluateAST(ast, row) {
  switch (ast.type) {
    case 'NumberLiteral': return ast.value;
    case 'StringLiteral': return ast.value;

    case 'ColumnRef': {
      const raw = row[ast.name];
      if (raw === undefined || raw === null || raw === '') return 0;
      const s = String(raw).trim().replace(/,/g, '');
      if (s === '' || /^(n\/a|#n\/a|#value!|-)$/i.test(s)) return 0;
      const n = Number(s);
      return isNaN(n) ? s : n; // Return string if not numeric
    }

    case 'BinaryOp': {
      const l = evaluateAST(ast.left, row);
      const r = evaluateAST(ast.right, row);
      const ln = typeof l === 'number' ? l : (Number(l) || 0);
      const rn = typeof r === 'number' ? r : (Number(r) || 0);
      switch (ast.op) {
        case '+': {
          // String concatenation if either side is a non-numeric string
          if (typeof l === 'string' && isNaN(Number(l))) return l + String(r);
          if (typeof r === 'string' && isNaN(Number(r))) return String(l) + r;
          return ln + rn;
        }
        case '-': return ln - rn;
        case '*': return ln * rn;
        case '/': return rn === 0 ? 0 : ln / rn;
        case '%': return rn === 0 ? 0 : ln % rn;
        case '>':  return ln > rn ? 1 : 0;
        case '<':  return ln < rn ? 1 : 0;
        case '>=': return ln >= rn ? 1 : 0;
        case '<=': return ln <= rn ? 1 : 0;
        case '==': return String(l).toLowerCase() === String(r).toLowerCase() ? 1 : 0;
        case '!=': return String(l).toLowerCase() !== String(r).toLowerCase() ? 1 : 0;
        default: return 0;
      }
    }

    case 'FunctionCall': {
      const args = ast.args.map(a => evaluateAST(a, row));
      switch (ast.name) {
        case 'round': {
          const v = typeof args[0] === 'number' ? args[0] : Number(args[0]) || 0;
          const d = args.length > 1 ? (typeof args[1] === 'number' ? args[1] : Number(args[1]) || 0) : 0;
          const f = Math.pow(10, d);
          return Math.round(v * f) / f;
        }
        case 'floor': return Math.floor(Number(args[0]) || 0);
        case 'ceil':  return Math.ceil(Number(args[0]) || 0);
        case 'abs':   return Math.abs(Number(args[0]) || 0);
        case 'min':   return Math.min(...args.map(a => typeof a === 'number' ? a : Number(a) || 0));
        case 'max':   return Math.max(...args.map(a => typeof a === 'number' ? a : Number(a) || 0));
        case 'len':   return String(args[0]).length;
        case 'number': {
          const s = String(args[0]).replace(/,/g, '').trim();
          const n = Number(s);
          return isNaN(n) ? 0 : n;
        }
        case 'coalesce': {
          for (const a of args) {
            if (a !== 0 && a !== '' && a !== null && a !== undefined) return a;
          }
          return args.length > 0 ? args[args.length - 1] : 0;
        }
        case 'if': {
          const cond = args[0];
          const truthy = (typeof cond === 'number') ? cond !== 0 : !!cond;
          return truthy ? (args[1] ?? 0) : (args[2] ?? 0);
        }
        case 'lower': return String(args[0]).toLowerCase();
        case 'upper': return String(args[0]).toUpperCase();
        case 'concat': return args.map(a => String(a)).join('');
        default: throw new Error(`Unknown function: ${ast.name}`);
      }
    }

    case 'Classify': {
      const val = Number(evaluateAST(ast.valueExpr, row)) || 0;
      if (ast.thresholds.length === 0) return '';
      // Find highest threshold <= val
      let result = ast.thresholds[0].label; // default to lowest
      for (const { threshold, label } of ast.thresholds) {
        if (val >= threshold) result = label;
        else break;
      }
      return result;
    }

    default: throw new Error(`Unknown AST node: ${ast.type}`);
  }
}

function evaluateComputedColumns(definitions, rows) {
  // Parse all formulas up front
  const parsed = definitions.map(def => {
    try {
      return { name: def.name, ast: parseFormulaExpr(def.formula), error: null };
    } catch (e) {
      return { name: def.name, ast: null, error: e.message };
    }
  });

  const errors = parsed.filter(p => p.error).map(p => `${p.name}: ${p.error}`);

  // Evaluate in order for each row (later columns can reference earlier ones)
  const results = rows.map(row => {
    const computed = {};
    for (const p of parsed) {
      if (p.ast) {
        try {
          // Merge prior computed values into a temporary row context
          const ctx = { ...row, ...computed };
          computed[p.name] = evaluateAST(p.ast, ctx);
        } catch (e) {
          computed[p.name] = '';
        }
      } else {
        computed[p.name] = '';
      }
    }
    return computed;
  });

  return { results, errors };
}

function loadAllRubrics(rubricDir) {
  const statuses = ['keep', 'kill', 'evolve', 'exclude'];
  const rubrics = {};
  for (const status of statuses) {
    const fp = path.join(rubricDir, `${status}.md`);
    if (fs.existsSync(fp)) {
      rubrics[status] = parseRubricFile(fp);
    } else {
      rubrics[status] = { fieldRules: [], contentRules: [] };
    }
  }
  return rubrics;
}

function assessRow(row, rubrics) {
  const results = {};
  for (const [status, rubric] of Object.entries(rubrics)) {
    const fieldResults = rubric.fieldRules.map(rule => ({
      rule: rule.raw,
      pass: evaluateFieldRule(rule, row)
    }));
    const fieldPass = fieldResults.length > 0
      ? fieldResults.filter(r => r.pass).length
      : 0;
    const fieldTotal = fieldResults.length;
    results[status] = {
      fieldResults,
      fieldScore: fieldTotal > 0 ? fieldPass / fieldTotal : 0,
      contentRules: rubric.contentRules
    };
  }

  // Pick best field-rule match
  let suggestion = null;
  let bestScore = -1;
  for (const [status, r] of Object.entries(results)) {
    if (r.fieldResults.length > 0 && r.fieldScore > bestScore) {
      bestScore = r.fieldScore;
      suggestion = status;
    }
  }

  return { results, suggestion, bestScore };
}

// Rubric IPC
ipcMain.handle('get-rubric-dir', () => {
  const prefs = loadPrefs();
  return prefs.rubricDir || getDefaultRubricDir();
});

ipcMain.handle('pick-rubric-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Rubrics Folder',
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const dir = result.filePaths[0];
    savePrefs({ rubricDir: dir });
    return dir;
  }
  return null;
});

ipcMain.handle('load-rubrics', () => {
  const prefs = loadPrefs();
  // Per-file rubric dir override
  let dir = prefs.rubricDir || getDefaultRubricDir();
  if (currentFilePath) {
    const fileName = path.basename(currentFilePath);
    const perFile = prefs.fileRubricDirs?.[fileName];
    if (perFile && fs.existsSync(perFile)) dir = perFile;
  }
  if (!fs.existsSync(dir)) return { rubrics: {}, dir };
  return { rubrics: loadAllRubrics(dir), dir };
});

ipcMain.handle('set-file-rubric-dir', async (event, { rubricDir }) => {
  if (!currentFilePath) return { success: false };
  const prefs = loadPrefs();
  const fileName = path.basename(currentFilePath);
  const dirs = prefs.fileRubricDirs || {};
  if (rubricDir) {
    dirs[fileName] = rubricDir;
  } else {
    delete dirs[fileName];
  }
  savePrefs({ fileRubricDirs: dirs });
  return { success: true };
});

ipcMain.handle('read-rubric-file', async (event, { status }) => {
  const prefs = loadPrefs();
  const dir = prefs.rubricDir || getDefaultRubricDir();
  const fp = path.join(dir, `${status}.md`);
  try {
    if (fs.existsSync(fp)) return { content: fs.readFileSync(fp, 'utf8') };
    return { content: '' };
  } catch (e) {
    return { content: '', error: e.message };
  }
});

ipcMain.handle('write-rubric-file', async (event, { status, content }) => {
  const prefs = loadPrefs();
  const dir = prefs.rubricDir || getDefaultRubricDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${status}.md`), content, 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('assess-row', (event, { row }) => {
  const prefs = loadPrefs();
  const dir = prefs.rubricDir || getDefaultRubricDir();
  if (!fs.existsSync(dir)) return { error: 'Rubric directory not found' };
  const rubrics = loadAllRubrics(dir);
  return assessRow(row, rubrics);
});

ipcMain.handle('assess-row-llm', async (event, { row, rubrics, apiKey }) => {
  try {
    const prompt = buildLLMPrompt(row, rubrics);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      return { error: `API error ${response.status}: ${errText}` };
    }
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return parseLLMResponse(text);
  } catch (e) {
    return { error: e.message };
  }
});

function buildLLMPrompt(row, rubrics) {
  let prompt = `You are a content auditor assessing a web page. Based on the page metadata and the rubric rules below, recommend a KKE status: Keep, Kill, Evolve, or Exclude.\n\n`;
  prompt += `## Page Metadata\n`;
  for (const [key, val] of Object.entries(row)) {
    if (key === '_rowIndex' || !val) continue;
    prompt += `- **${key}**: ${val}\n`;
  }
  prompt += `\n## Rubrics\n`;
  for (const [status, rubric] of Object.entries(rubrics)) {
    prompt += `\n### ${status.charAt(0).toUpperCase() + status.slice(1)}\n`;
    if (rubric.contentRules.length > 0) {
      rubric.contentRules.forEach(r => { prompt += `- ${r}\n`; });
    }
  }
  prompt += `\nRespond in this exact JSON format:\n`;
  prompt += `{"recommendation": "Keep|Kill|Evolve|Exclude", "confidence": "high|medium|low", "reasoning": "brief explanation"}\n`;
  prompt += `Return only the JSON, no other text.`;
  return prompt;
}

function parseLLMResponse(text) {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      recommendation: parsed.recommendation || null,
      confidence: parsed.confidence || 'low',
      reasoning: parsed.reasoning || ''
    };
  } catch (e) {
    return { recommendation: null, confidence: 'low', reasoning: text, error: 'Failed to parse LLM response' };
  }
}

ipcMain.handle('check-links', async (event, { urls }) => {
  const results = [];
  for (const url of urls.slice(0, 50)) { // limit to 50 links
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) });
      results.push({ url, status: response.status, ok: response.ok });
    } catch (e) {
      results.push({ url, status: 0, ok: false, error: e.message });
    }
  }
  return results;
});

ipcMain.handle('capture-screenshot', async (event, { defaultName, webContentsId }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Screenshot',
    defaultPath: defaultName || 'screenshot.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });
  if (result.canceled) return { success: false };
  try {
    const wc = webContents.fromId(webContentsId);
    if (!wc) throw new Error('Webview not found');

    // Gather page dimensions and save scroll position
    const info = await wc.executeJavaScript(`({
      vpH: window.innerHeight,
      fullH: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      dpr: window.devicePixelRatio || 1,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    })`);
    const { vpH, fullH, dpr } = info;

    // Capture each viewport strip by scrolling
    const strips = [];
    for (let y = 0; y < fullH; y += vpH) {
      await wc.executeJavaScript(`window.scrollTo(0, ${y})`);
      await new Promise(r => setTimeout(r, 150));
      const img = await wc.capturePage();
      strips.push({ img, cssY: y });
    }

    // Restore scroll position
    await wc.executeJavaScript(`window.scrollTo(${info.scrollX}, ${info.scrollY})`);

    // Stitch strips into one image
    const firstSize = strips[0].img.getSize();
    const outW = firstSize.width;                         // physical pixels
    const outH = Math.round(fullH * dpr);
    const bpp = 4;
    const outRowBytes = outW * bpp;
    const combined = Buffer.alloc(outW * outH * bpp);

    for (const strip of strips) {
      const bmp = strip.img.toBitmap();
      const size = strip.img.getSize();
      const srcRowBytes = size.width * bpp;
      const cssRemaining = fullH - strip.cssY;
      const pixelStripH = Math.min(size.height, Math.round(Math.min(vpH, cssRemaining) * dpr));
      const dstStartRow = Math.round(strip.cssY * dpr);

      for (let row = 0; row < pixelStripH; row++) {
        const srcOff = row * srcRowBytes;
        const dstOff = (dstStartRow + row) * outRowBytes;
        if (dstOff + outRowBytes <= combined.length && srcOff + srcRowBytes <= bmp.length) {
          bmp.copy(combined, dstOff, srcOff, srcOff + Math.min(srcRowBytes, outRowBytes));
        }
      }
    }

    const finalImage = nativeImage.createFromBitmap(combined, { width: outW, height: outH });
    fs.writeFileSync(result.filePath, finalImage.toPNG());
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('save-text-file', async (event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Results',
    defaultPath: defaultName || 'results.txt',
    filters: [{ name: 'Text', extensions: ['txt'] }, { name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled) return { success: false };
  try {
    fs.writeFileSync(result.filePath, content, 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-progress-pdf', async (event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Progress Report',
    defaultPath: defaultName || 'audit-progress.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled) return { success: false };
  try {
    const win = new BrowserWindow({ show: false, width: 800, height: 600 });
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
    });
    win.close();
    fs.writeFileSync(result.filePath, pdfData);
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-filtered', async (event, { headers, rows }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Filtered Rows',
    defaultPath: 'filtered-export.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    const aoa = [headers];
    for (const row of rows) {
      aoa.push(headers.map(h => clampCell(row[h] ?? '')));
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, result.filePath, { compression: true });
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

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

ipcMain.handle('evaluate-formula', (event, { formula, row }) => {
  try {
    const rule = parseFieldRule(formula);
    return { result: evaluateFieldRule(rule, row) };
  } catch (e) {
    return { result: false, error: e.message };
  }
});

ipcMain.handle('evaluate-computed-columns', (event, { definitions, rows }) => {
  try {
    return evaluateComputedColumns(definitions, rows);
  } catch (e) {
    return { results: [], errors: [e.message] };
  }
});

ipcMain.handle('export-audit-csv', async (event, { headers, rows }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Audit Decisions',
    defaultPath: 'audit-decisions.csv',
    filters: [
      { name: 'CSV', extensions: ['csv'] },
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    const ext = path.extname(result.filePath).toLowerCase();
    if (ext === '.json') {
      fs.writeFileSync(result.filePath, JSON.stringify(rows, null, 2), 'utf8');
    } else {
      // CSV
      const csvHeaders = headers.join(',');
      const csvRows = rows.map(row =>
        headers.map(h => {
          const val = String(row[h] || '');
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? '"' + val.replace(/"/g, '""') + '"'
            : val;
        }).join(',')
      );
      fs.writeFileSync(result.filePath, csvHeaders + '\n' + csvRows.join('\n'), 'utf8');
    }
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-redirects', async (event, { rows }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Redirect Map',
    defaultPath: 'redirect-map.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    const headers = ['Source URL', 'Destination URL', 'Status Code', 'Reason'];
    const csvHeaders = headers.join(',');
    const csvRows = rows.map(row =>
      headers.map(h => {
        const val = String(row[h] || '');
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? '"' + val.replace(/"/g, '""') + '"'
          : val;
      }).join(',')
    );
    fs.writeFileSync(result.filePath, csvHeaders + '\n' + csvRows.join('\n'), 'utf8');
    return { success: true, filePath: result.filePath, count: rows.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Phase 2, Chunk ε: Migration Tracker Export.
// Renderer builds an array of `{ name, aoa }` sheets (aoa = array-of-arrays in SheetJS shape).
// Main writes them to xlsx and returns the path. No formula evaluation needed; this is a
// pure data deliverable for engineering.
ipcMain.handle('export-migration-tracker', async (event, { defaultName, sheets }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Migration Tracker',
    defaultPath: defaultName || 'migration-tracker.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    const workbook = XLSX.utils.book_new();
    sheets.forEach(s => {
      if (!s || !s.name || !Array.isArray(s.aoa)) return;
      const ws = XLSX.utils.aoa_to_sheet(s.aoa);
      // Apply column widths if provided
      if (Array.isArray(s.cols)) ws['!cols'] = s.cols;
      // Freeze the header row
      if (s.aoa.length > 0) ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      XLSX.utils.book_append_sheet(workbook, ws, s.name.slice(0, 31)); // Excel sheet name max 31 chars
    });
    XLSX.writeFile(workbook, result.filePath);
    return { success: true, filePath: result.filePath, sheetCount: sheets.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('sme-export', async (event, { headers, rows, defaultName, smeOptions, smeDecisionCol }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export for SME Review',
    defaultPath: defaultName || 'sme-review.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('SME Review');

    // Header row
    ws.addRow(headers);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

    // Data rows
    rows.forEach(row => {
      ws.addRow(headers.map(h => row[h] ?? ''));
    });

    // Column widths
    headers.forEach((h, i) => {
      const col = ws.getColumn(i + 1);
      const lower = h.toLowerCase();
      if (lower.includes('address') || lower.includes('url')) col.width = 50;
      else if (lower.includes('title')) col.width = 40;
      else if (lower.includes('notes')) col.width = 30;
      else col.width = 18;
    });

    // Freeze header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Data validation dropdown on SME Decision column
    if (smeOptions && smeDecisionCol && headers.includes(smeDecisionCol)) {
      const colIdx = headers.indexOf(smeDecisionCol) + 1; // 1-indexed
      for (let r = 2; r <= rows.length + 1; r++) {
        const cell = ws.getCell(r, colIdx);
        // Default placeholder for empty cells
        if (!cell.value) cell.value = '—';
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"' + smeOptions.join(',') + '"'],
          showErrorMessage: true,
          errorTitle: 'Invalid decision',
          error: 'Please select from the dropdown options.'
        };
      }
    }

    // ExcelJS encodes quotes as &quot; in dataValidation formulae, but
    // Excel on Mac requires literal quotes. Write to buffer, patch XML, rewrite.
    const JSZip = require('jszip');
    const buf = await workbook.xlsx.writeBuffer();
    const zip = await JSZip.loadAsync(buf);
    for (const name of Object.keys(zip.files)) {
      if (name.match(/xl\/worksheets\/sheet\d+\.xml$/)) {
        let xml = await zip.file(name).async('string');
        // Only fix &quot; inside <formula1> tags
        xml = xml.replace(/<formula1>(.*?)<\/formula1>/g, (match, inner) => {
          return '<formula1>' + inner.replace(/&quot;/g, '"') + '</formula1>';
        });
        zip.file(name, xml);
      }
    }
    const fixedBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(result.filePath, fixedBuf);
    return { success: true, filePath: result.filePath, count: rows.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('sme-export-multi', async (event, { files }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose folder for SME export files',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths.length) return { success: false, error: 'Cancelled' };
  const dir = result.filePaths[0];
  try {
    const JSZip = require('jszip');
    const written = [];
    for (const file of files) {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('SME Review');
      ws.addRow(file.headers);
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      file.rows.forEach(row => ws.addRow(file.headers.map(h => row[h] ?? '')));
      file.headers.forEach((h, i) => {
        const col = ws.getColumn(i + 1);
        const lower = h.toLowerCase();
        if (lower.includes('address') || lower.includes('url')) col.width = 50;
        else if (lower.includes('title')) col.width = 40;
        else if (lower.includes('notes')) col.width = 30;
        else col.width = 18;
      });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      if (file.smeOptions && file.smeDecisionCol && file.headers.includes(file.smeDecisionCol)) {
        const colIdx = file.headers.indexOf(file.smeDecisionCol) + 1;
        for (let r = 2; r <= file.rows.length + 1; r++) {
          const cell = ws.getCell(r, colIdx);
          if (!cell.value) cell.value = '—';
          cell.dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ['"' + file.smeOptions.join(',') + '"'],
            showErrorMessage: true, errorTitle: 'Invalid', error: 'Select from dropdown.'
          };
        }
      }
      const buf = await workbook.xlsx.writeBuffer();
      const zip = await JSZip.loadAsync(buf);
      for (const name of Object.keys(zip.files)) {
        if (name.match(/xl\/worksheets\/sheet\d+\.xml$/)) {
          let xml = await zip.file(name).async('string');
          xml = xml.replace(/<formula1>(.*?)<\/formula1>/g, (m, inner) =>
            '<formula1>' + inner.replace(/&quot;/g, '"') + '</formula1>');
          zip.file(name, xml);
        }
      }
      const fixedBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const filePath = path.join(dir, file.fileName);
      fs.writeFileSync(filePath, fixedBuf);
      written.push(filePath);
    }
    return { success: true, count: written.length, dir };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('render-sitemap-d3', async (event, { treeData, colorMap, options }) => {
  try {
    const d3Path = path.join(__dirname, 'node_modules', 'd3', 'dist', 'd3.min.js');
    const d3Js = fs.readFileSync(d3Path, 'utf8');
    const treeJson = JSON.stringify(treeData);
    const colorMapJson = JSON.stringify(colorMap || {});
    const optsJson = JSON.stringify(options || {});
    const tmpHtml = path.join(require('os').tmpdir(), 'kke-d3-render.html');

    // Build HTML by concatenation (not template literals — D3 source has backticks)
    const parts = [];
    parts.push('<!DOCTYPE html><html><head><style>');
    parts.push('body{margin:0;padding:0;background:#fff;font-family:-apple-system,Helvetica Neue,Arial,sans-serif}');
    parts.push('</style></head><body><svg id="tree"></svg>');
    parts.push('<script>');
    parts.push(d3Js);
    parts.push('</script>');
    parts.push('<script>');
    parts.push('var TREE_DATA=' + treeJson + ';');
    parts.push('var COLOR_MAP=' + colorMapJson + ';');
    parts.push('var OPTS=' + optsJson + ';');
    parts.push('(function() {');
    // Box + layout constants
    parts.push('  var BOX_W=160, BOX_H=34, BOX_RX=5;');
    // Indented-list layout: each depth level is INDENT px to the right; rows stack top-to-bottom
    parts.push('  var INDENT=50, ROW_H=52;');
    // TRUNK_X: the connector trunk runs at this x-offset from the parent box left edge
    parts.push('  var TRUNK_X=14;');
    parts.push('  var DEFAULT_COLOR="#6366f1";');
    // Color helpers
    parts.push('  function nodeColor(d) { return COLOR_MAP[d.data.pattern] || DEFAULT_COLOR; }');
    parts.push('  function hexRgba(hex, a) {');
    parts.push('    var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);');
    parts.push('    return "rgba("+r+","+g+","+b+","+a+")";');
    parts.push('  }');
    // Build hierarchy then assign positions with a custom DFS pre-order layout
    // Each node gets .lx (left x) and .ly (top y) — the top-left corner of its box
    parts.push('  var root = d3.hierarchy(TREE_DATA);');
    parts.push('  var counter = {v:0};');
    parts.push('  function layoutNode(d, depth) {');
    parts.push('    d.lx = depth * INDENT;');
    parts.push('    d.ly = counter.v * ROW_H;');
    parts.push('    counter.v++;');
    parts.push('    if (d.children) d.children.forEach(function(c) { layoutNode(c, depth+1); });');
    parts.push('  }');
    parts.push('  layoutNode(root, 0);');
    // Compute SVG canvas size from the layout
    parts.push('  var allNodes = root.descendants();');
    parts.push('  var maxRight = 0;');
    parts.push('  allNodes.forEach(function(d) { var r=d.lx+BOX_W; if(r>maxRight) maxRight=r; });');
    parts.push('  var treeW = Math.max(400, maxRight + 80);');
    parts.push('  var treeH = Math.max(200, counter.v * ROW_H + 60);');
    parts.push('  var svg = d3.select("#tree").attr("width", treeW).attr("height", treeH);');
    parts.push('  var g = svg.append("g").attr("transform", "translate(20,20)");');
    // Links — L-shaped connectors: trunk descends from parent's left area, branch extends right to child
    // Path: parent trunk-bottom → down to child midpoint-y → right to child box left edge
    parts.push('  g.selectAll(".link").data(root.links()).join("path")');
    parts.push('    .attr("fill","none").attr("stroke","#c5c5d8").attr("stroke-width","1.5px")');
    parts.push('    .attr("d", function(d) {');
    parts.push('      var px=d.source.lx+TRUNK_X, py=d.source.ly+BOX_H;');
    parts.push('      var cx=d.target.lx,          cy=d.target.ly+BOX_H/2;');
    parts.push('      return "M"+px+","+py+" L"+px+","+cy+" L"+cx+","+cy;');
    parts.push('    });');
    // Node groups placed at top-left of each box (rects/text use 0,0 origin)
    parts.push('  var node = g.selectAll(".node").data(allNodes).join("g")');
    parts.push('    .attr("transform", function(d) { return "translate("+d.lx+","+d.ly+")"; });');
    // Shadow boxes — stacked effect for nodes that have children hidden from this filtered view
    // Rects use top-left origin (0,0) since node groups are now placed at box top-left
    parts.push('  node.filter(function(d){return d.data.hasHiddenChildren;})');
    parts.push('    .append("rect")');
    parts.push('    .attr("x",6).attr("y",6)');
    parts.push('    .attr("width",BOX_W).attr("height",BOX_H).attr("rx",BOX_RX)');
    parts.push('    .attr("fill","#eeeef8").attr("stroke","#b8b8cc").attr("stroke-width","1px");');
    parts.push('  node.filter(function(d){return d.data.hasHiddenChildren;})');
    parts.push('    .append("rect")');
    parts.push('    .attr("x",3).attr("y",3)');
    parts.push('    .attr("width",BOX_W).attr("height",BOX_H).attr("rx",BOX_RX)');
    parts.push('    .attr("fill","#f3f3fb").attr("stroke","#c5c5dc").attr("stroke-width","1px");');
    // Main box
    parts.push('  node.append("rect")');
    parts.push('    .attr("x",0).attr("y",0)');
    parts.push('    .attr("width",BOX_W).attr("height",BOX_H).attr("rx",BOX_RX)');
    parts.push('    .attr("fill", function(d) { return hexRgba(nodeColor(d), 0.12); })');
    parts.push('    .attr("stroke", function(d) { return nodeColor(d); })');
    parts.push('    .attr("stroke-width","1.5px")');
    parts.push('    .attr("stroke-dasharray", function(d) { return d.data.menu ? "none" : "5,3"; });');
    // Label — centered inside box; bold for root level
    parts.push('  node.append("text")');
    parts.push('    .attr("x",BOX_W/2).attr("y",BOX_H/2).attr("dy","0.35em")');
    parts.push('    .attr("text-anchor","middle")');
    parts.push('    .attr("font-size","12px")');
    parts.push('    .attr("font-weight", function(d) { return d.depth===0 ? "600" : "400"; })');
    parts.push('    .attr("fill","#1e1e2e")');
    parts.push('    .text(function(d) { var n=d.data.name; return n.length>22?n.substring(0,20)+"…":n; });');
    // Page count badge — small number in top-right corner of box
    parts.push('  node.filter(function(d){return d.data.pageCount>0;})');
    parts.push('    .append("text")');
    parts.push('    .attr("x",BOX_W-4).attr("y",9)');
    parts.push('    .attr("text-anchor","end").attr("font-size","9px").attr("font-weight","600")');
    parts.push('    .attr("fill", function(d) { return nodeColor(d); })');
    parts.push('    .text(function(d) { return d.data.pageCount; });');
    // Measure tree bounding box, compute legend height, then finalize SVG size
    parts.push('  var bb = g.node().getBBox();');
    parts.push('  var patterns = Object.keys(COLOR_MAP);');
    parts.push('  var COLS=4, ITEM_W=175, ITEM_H=18;');
    parts.push('  var patternRowCount = patterns.length>0 ? Math.ceil(patterns.length/COLS) : 0;');
    // Legend has: title row (14px) + pattern rows + indicator row (22px) + bottom padding (8px)
    parts.push('  var legendH = patternRowCount>0 ? 14 + patternRowCount*ITEM_H + 22 + 8 : 22 + 8;');
    // Reposition g — nudge to keep content clear of SVG edge
    parts.push('  g.attr("transform","translate("+(20-bb.x)+","+(20-bb.y)+")");');
    // Finalize SVG canvas size
    parts.push('  var svgW = 20 + bb.width + 40;');
    parts.push('  var svgH = 20 + bb.height + 20 + legendH + 10;');
    parts.push('  svg.attr("width",svgW).attr("height",svgH);');
    // Legend — anchored below the repositioned tree
    parts.push('  var lgY = 20 + bb.height + 20;');
    parts.push('  var lgG = svg.append("g").attr("transform","translate(20,"+lgY+")");');
    // Pattern rows (only when patterns exist)
    parts.push('  if (patterns.length > 0) {');
    parts.push('    lgG.append("text").attr("x",0).attr("y",0)');
    parts.push('      .attr("font-size","10px").attr("font-weight","600").attr("fill","#888")');
    parts.push('      .text("Page Pattern");');
    parts.push('    patterns.forEach(function(p, i) {');
    parts.push('      var col=i%COLS, row=Math.floor(i/COLS);');
    parts.push('      var x=col*ITEM_W, y=row*ITEM_H+14;');
    parts.push('      var c=COLOR_MAP[p];');
    parts.push('      lgG.append("rect").attr("x",x).attr("y",y-9).attr("width",12).attr("height",12).attr("rx",2)');
    parts.push('        .attr("fill",hexRgba(c,0.15)).attr("stroke",c).attr("stroke-width","1.5px");');
    parts.push('      lgG.append("text").attr("x",x+16).attr("y",y+1)');
    parts.push('        .attr("font-size","10px").attr("fill","#444")');
    parts.push('        .text(p.length>24?p.substring(0,22)+"…":p);');
    parts.push('    });');
    parts.push('  }');
    // InMenu indicator row — always shown; indY is local-y within lgG for the indicator row
    parts.push('  var indY = patternRowCount>0 ? patternRowCount*ITEM_H+22 : 9;');
    parts.push('  lgG.append("rect").attr("x",0).attr("y",indY-9).attr("width",28).attr("height",12).attr("rx",2)');
    parts.push('    .attr("fill","rgba(99,102,241,0.1)").attr("stroke","#6366f1").attr("stroke-width","1.5px");');
    parts.push('  lgG.append("text").attr("x",34).attr("y",indY+1).attr("font-size","10px").attr("fill","#555").text("In nav menu");');
    parts.push('  lgG.append("rect").attr("x",120).attr("y",indY-9).attr("width",28).attr("height",12).attr("rx",2)');
    parts.push('    .attr("fill","rgba(99,102,241,0.1)").attr("stroke","#6366f1").attr("stroke-width","1.5px").attr("stroke-dasharray","5,3");');
    parts.push('  lgG.append("text").attr("x",154).attr("y",indY+1).attr("font-size","10px").attr("fill","#555").text("Not in nav");');
    // Stack indicator — back shadow, mid shadow, main box (each offset 3px down-right from previous)
    parts.push('  lgG.append("rect").attr("x",246+4).attr("y",indY-9+4).attr("width",28).attr("height",12).attr("rx",2)');
    parts.push('    .attr("fill","#eeeef8").attr("stroke","#b8b8cc").attr("stroke-width","1px");');
    parts.push('  lgG.append("rect").attr("x",246+2).attr("y",indY-9+2).attr("width",28).attr("height",12).attr("rx",2)');
    parts.push('    .attr("fill","#f3f3fb").attr("stroke","#c5c5dc").attr("stroke-width","1px");');
    parts.push('  lgG.append("rect").attr("x",246).attr("y",indY-9).attr("width",28).attr("height",12).attr("rx",2)');
    parts.push('    .attr("fill","rgba(99,102,241,0.1)").attr("stroke","#6366f1").attr("stroke-width","1.5px");');
    parts.push('  lgG.append("text").attr("x",246+34).attr("y",indY+1).attr("font-size","10px").attr("fill","#555").text("Has sub-pages");');
    parts.push('  document.title="DONE";');
    parts.push('})();');
    parts.push('</script></body></html>');

    fs.writeFileSync(tmpHtml, parts.join('\n'), 'utf8');
    const win = new BrowserWindow({ show: false, width: 5000, height: 3000, webPreferences: { nodeIntegration: false } });
    await win.loadFile(tmpHtml);
    await new Promise(r => setTimeout(r, 2000));
    const svg = await win.webContents.executeJavaScript('document.getElementById("tree").outerHTML');
    win.close();
    try { fs.unlinkSync(tmpHtml); } catch (_) {}
    return { success: true, svg };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-report-html', async (event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Report as HTML',
    defaultPath: defaultName || 'report.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    fs.writeFileSync(result.filePath, html, 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-audit-template', async (event, { template }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Audit Template',
    defaultPath: (template.name || 'audit-template') + '.kke-template.json',
    filters: [{ name: 'KKE Template', extensions: ['json'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(template, null, 2), 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('load-audit-template', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Audit Template',
    filters: [{ name: 'KKE Template', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  try {
    const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
    return { template: data, filePath: result.filePaths[0] };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('export-nav-tree', async (event, { format, rows, maxDepth, includePhase }) => {
  const defaultName = format === 'indented' ? 'nav-tree-indented.xlsx' : 'nav-tree-flat.xlsx';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Navigation Tree',
    defaultPath: defaultName,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    let aoa;
    const showPhase = includePhase !== false && rows.some(r => r.phase);
    // Pages, Menu, and Notes always appear so the headers are predictable for clients,
    // even on a fresh export where you haven't filled anything in yet.
    const showPages = true;
    const showMenu  = true;
    const showNotes = true;
    if (format === 'indented') {
      const headers = ['Number'];
      for (let i = 1; i <= maxDepth; i++) headers.push('Level ' + i);
      if (showPages) headers.push('Pages');
      if (showMenu)  headers.push('Menu');
      if (showPhase) headers.push('Phase');
      if (showNotes) headers.push('Notes');
      aoa = [headers];
      for (const row of rows) {
        const r = new Array(headers.length).fill('');
        r[0] = row.number;
        r[row.depth + 1] = row.label;
        let extraIdx = maxDepth + 1;
        if (showPages) { r[extraIdx++] = row.status || ''; }
        if (showMenu)  { r[extraIdx++] = row.inMenu || ''; }
        if (showPhase) { r[extraIdx++] = row.phase || ''; }
        if (showNotes) { r[extraIdx++] = row.notes || ''; }
        aoa.push(r);
      }
    } else {
      const headers = ['Number', 'Label', 'Path', 'Breadcrumb', 'Reference To'];
      if (showPages) headers.push('Pages');
      if (showMenu)  headers.push('Menu');
      if (showPhase) headers.push('Phase');
      if (showNotes) headers.push('Notes');
      aoa = [headers];
      for (const row of rows) {
        const r = [row.number, row.label, row.computedPath, row.breadcrumb, row.refTo || ''];
        if (showPages) r.push(row.status || '');
        if (showMenu)  r.push(row.inMenu || '');
        if (showPhase) r.push(row.phase || '');
        if (showNotes) r.push(row.notes || '');
        aoa.push(r);
      }
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'Navigation');
    XLSX.writeFile(wb, result.filePath, { compression: true });
    return { success: true, filePath: result.filePath, count: rows.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-column-map', (event, { columnMap }) => {
  if (!currentFilePath) return { success: false };
  const prefs = loadPrefs();
  const fileName = path.basename(currentFilePath);
  const mappings = prefs.columnMappings || {};
  mappings[fileName] = columnMap;
  savePrefs({ columnMappings: mappings });
  return { success: true };
});

// ─── Nav Structure IPC ───────────────────────────────────────────────────────

ipcMain.handle('load-nav-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Navigation Structure',
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm', 'ods'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const wb = XLSX.readFile(result.filePaths[0], { type: 'file', cellDates: true });
      const navSheetName = wb.SheetNames.find(s => s.toLowerCase() === 'navstructure');
      if (!navSheetName) {
        dialog.showErrorBox('No NavStructure Sheet', 'The selected file does not contain a sheet named "NavStructure".');
        return null;
      }
      return parseNavSheet(wb.Sheets[navSheetName]);
    } catch (e) {
      dialog.showErrorBox('Error', `Could not read file: ${e.message}`);
      return null;
    }
  }
  return null;
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

// Suppress "Render frame was disposed" errors from webview navigation races
process.on('uncaughtException', (err) => {
  if (err.message?.includes('Render frame was disposed')) return;
  console.error('Uncaught exception:', err);
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Finder double-click / dock drop of a .transmission (or xlsx) file.
// May fire before the window exists; stash and open once ready.
let pendingOpenPath = null;
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    openAnyPath(filePath);
  } else {
    pendingOpenPath = filePath;
  }
});
app.on('browser-window-created', () => {
  if (pendingOpenPath) {
    const p = pendingOpenPath;
    pendingOpenPath = null;
    // Let the renderer finish loading before shipping the file
    setTimeout(() => openAnyPath(p), 800);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Checkpoint + close the project DB cleanly on quit so the .transmission file
// is a complete single-file snapshot (no stale -wal/-shm sidecars).
app.on('before-quit', () => {
  try { projectStore.close(); } catch (e) { /* best effort */ }
});
