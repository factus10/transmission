const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard, webContents, nativeImage, nativeTheme, net } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { ProjectStore, PROJECT_EXT } = require('./project-store');
const miro = require('./miro');

// ─── State ────────────────────────────────────────────────────────────────────

let mainWindow = null;
let helpWindow = null;
let changelogWindow = null;
let currentFilePath = null;
let currentSheetName = null;
let navSheetInfo = null;  // { sheetName }

// SQLite persistence for .transmission project files. Open whenever the current
// file is a project; xlsx files continue through the legacy SheetJS path.
const projectStore = new ProjectStore({ appVersion: app.getVersion() });
const isProjectFile = (fp) => typeof fp === 'string' && fp.toLowerCase().endsWith(PROJECT_EXT);

const userDataPath = app.getPath('userData');
const prefsPath    = path.join(userDataPath, 'prefs.json');

// Miro token lives in its own encrypted file, not prefs.json — see miro.js.
miro.init(userDataPath);

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

// ─── Update check ─────────────────────────────────────────────────────────────
// The main source repo (factus10/transmission) is private, so raw.githubusercontent.com
// / github.com URLs into it 404 for an unauthenticated app. The manifest + changelog
// instead live in a small dedicated PUBLIC repo (factus10/transmission-updates,
// published via GitHub Pages) that holds nothing but those two files — no source code,
// no client data. Bump `version` / `publishedAt` / `notes` in that repo's
// update-manifest.json (and copy the changelog) on each release; see CLAUDE.md
// "Update check" for the exact steps. The release DMG itself still lives on the
// private repo's GitHub Releases, so the Download link only resolves for logged-in
// collaborators — see the CLAUDE.md note.
const UPDATE_MANIFEST_URL = 'https://factus10.github.io/transmission-updates/update-manifest.json';
const UPDATE_TRUSTED_HOSTS = new Set(['factus10.github.io', 'github.com']);

// The user documentation, published to the same public Pages site from this
// repo's docs/ via scripts/generate-docs-site.js. Opened in the user's browser
// rather than a BrowserWindow like the changelog: this is a multi-page site
// people will want to search, bookmark and keep open beside the app.
const DOCS_SITE_URL = 'https://factus10.github.io/transmission-updates/docs/';

// ─── Audit columns injected if not present in the xlsx ───────────────────────
// The actual injection list lives in injectAndOrderAuditColumns()'s inline
// auditCols array below — this is the one source of truth for which columns
// get added to every file.

const NAV_COLUMNS   = ['Sitemap_ID', 'Sitemap_Destination', 'Computed Path', 'Sitemap_SortID'];

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

// Determine column mapping. Priority per key: the file's own saved mapping
// (projectSettings.columnMap — travels with the project/workbook between
// auditors) > per-user prefs keyed by file name (legacy) > auto-detection.
// A saved name is honored ONLY when it still exists in the current headers —
// a stale value would otherwise get re-injected as a duplicate column.
// Shared by the xlsx reader and the .transmission project reader.
function computeColumnMap(headers, filePath, projectMap) {
  const prefs = loadPrefs();
  const fileName = path.basename(filePath);
  const savedMap = prefs.columnMappings?.[fileName] || null;
  const honor = (map, key) => {
    const v = map?.[key];
    return v && headers.includes(v) ? v : null;
  };
  const honorSaved = (key) => honor(projectMap, key) || honor(savedMap, key);

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
                     'Design_Patterns',
                     // Audience tagging: who this page serves (CSV) + who it's mainly for
                     'Audiences', 'Primary_Audience',
                     // Jobs-to-be-done: which jobs this page actually does work for (CSV)
                     'Jobs_Served',
                     // Derived: which source site this page came from (consolidation audits)
                     'Source_Site',
                     // Derived: the page's on-page breadcrumb (from its sitemap node's breadcrumb axis)
                     'Page_Breadcrumb',
                     // Internal: stable identity (master page's current Address) backing Consolidate_Into
                     '_ConsolidateTargetId',
                     // Internal: pending audience suggestion (JSON) awaiting the auditor's accept/reject
                     '_Suggested_Audiences',
                     // Internal: who wrote Redirect_Destination — 'auto' (derived from the sitemap)
                     // or 'manual' (a person typed or picked it). Blank = unknown, which is what
                     // every file predating this column has; consumers must fall back to heuristics.
                     '_RedirectSource'];
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

// Historical column names — renamed for client-facing clarity (a raw "NavID"/
// "Nav Destination" column read as internal jargon when clients opened an
// exported spreadsheet). Old files carry the old names forever unless upgraded,
// so every file open transparently renames them in place: the header text and
// every row's key move from old → new, with no data loss. Shared by the xlsx
// reader and the .transmission project reader (same call-site pattern as
// `injectAndOrderAuditColumns` above). Once renamed, the very next save writes
// the new name back to disk — no separate DB/xlsx schema change needed.
const LEGACY_NAV_COLUMN_RENAMES = [
  ['NavID', 'Sitemap_ID'],
  ['Nav Destination', 'Sitemap_Destination'],
  ['Nav_SortID', 'Sitemap_SortID'],
];

function renameLegacyNavColumns(headers, rows) {
  LEGACY_NAV_COLUMN_RENAMES.forEach(([oldName, newName]) => {
    if (!headers.includes(oldName) || headers.includes(newName)) return;
    headers[headers.indexOf(oldName)] = newName;
    rows.forEach(r => {
      r[newName] = r[oldName];
      delete r[oldName];
    });
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

  // Resolve the saved theme so the native window background matches on first
  // paint (avoids a light flash on launch for dark-mode users).
  const themePref = prefs.themePref || 'system';
  const wantDark = themePref === 'dark' || (themePref === 'system' && nativeTheme.shouldUseDarkColors);

  mainWindow = new BrowserWindow({
    width: wb.width || 1440,
    height: wb.height || 960,
    x: wb.x,
    y: wb.y,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    backgroundColor: wantDark ? '#1a1a1a' : '#f5f5f5',
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
        { label: 'Package for Handoff…', click: send('menu-package-handoff') },
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
        { label: 'Sitemap',         accelerator: 'CmdOrCtrl+Shift+T',  click: send('menu-nav-tree') },
        { label: 'Redirects',       accelerator: 'CmdOrCtrl+Shift+R',  click: send('menu-redirect-editor') },
        { label: 'Menus',           accelerator: 'CmdOrCtrl+Shift+M',  click: send('menu-menus') },
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
        { label: 'Triage URL Variants…',  click: send('menu-url-variant-triage') },
        { label: 'Create Sitemap from Audit…', click: send('menu-create-sitemap-from-audit') },
        { type: 'separator' },
        { label: 'Edit Glossary…',        click: send('menu-glossary') },
        { label: 'Audience Library…',     click: send('menu-audience-library') },
        { label: 'Fill Audiences from Section…', click: send('menu-audience-inherit') },
        { label: 'Suggest Audiences with AI…',   click: send('menu-audience-ai') },
        { type: 'separator' },
        { label: 'Review Proposals…',            click: send('menu-review-proposals') },
        { label: 'Open in Claude Code…',         click: send('menu-open-in-claude') },
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
        { label: 'Redirect Chain Check…',   click: send('menu-redirect-chain-check') },
        { label: 'Redirect Health Check…',  click: send('menu-redirect-health-check') }
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
        { label: 'Menu Report…',                click: send('menu-report-nav-ia') },
        { label: 'Sitemap Coverage Report…',    click: send('menu-nav-coverage') },
        { label: 'Component Inventory…',          click: send('menu-report-design-patterns') },
        { label: 'Content Type Crosswalk…',       click: send('menu-report-content-crosswalk') },
        { type: 'separator' },
        { label: 'Audience Coverage…',            click: send('menu-report-audience-coverage') },
        { label: 'Audience × Section Matrix…',    click: send('menu-report-audience-matrix') },
        { label: 'Jobs Coverage…',                click: send('menu-report-jobs-coverage') },
        { type: 'separator' },
        { label: 'Site Consolidation Overview…',  click: send('menu-report-site-consolidation') },
        { label: 'Cross-Site Duplicate Overlap…', click: send('menu-report-cross-site-dupes') },
        { type: 'separator' },
        { label: 'Migration Direction Brief…', click: send('menu-report-assignee-brief') },
        { label: 'Migration Checklist…',    click: send('menu-report-migration-checklist') },
        { label: 'Build Status…',           click: send('menu-report-build-status') },
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
        { label: 'Resolve Conflicts…',      click: send('menu-sme-resolve') },
        { label: 'Review Consolidations…',  click: send('menu-consolidate-review') }
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
        { label: 'Transmission Help', click: () => openHelpWindow() },
        { label: 'Online Documentation', click: () => openDocsSite() },
        { type: 'separator' },
        { label: 'Check for Updates…', click: send('menu-check-updates') }
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

    // Structural sheets (not selectable as data sheets). 'navstructure' is the
    // legacy name for the sitemap-tree sheet (now written as 'Sitemap') — kept
    // here so older files still hide it from the data-sheet picker pre-migration.
    const structuralNames = new Set(['navstructure', 'sitemap', 'kke_settings', 'kke_changelog', 'kke_glossary', 'contenttyperegistry', 'patternlibrary', 'designpatternlibrary', 'audiences', 'sites', 'jobs']);
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

    // Early peek at KKE_Settings for a file-level column mapping (the full
    // settings parse happens further down; this small sheet is cheap to read twice)
    let projectColumnMap = null;
    const earlySettingsSheet = allSheetNames.find(s => s.toLowerCase() === 'kke_settings');
    if (earlySettingsSheet) {
      try {
        const early = parseSettingsSheet(workbook.Sheets[earlySettingsSheet]);
        if (early.columnMap && typeof early.columnMap === 'object') projectColumnMap = early.columnMap;
      } catch (e) { /* fall back to prefs/auto-detect */ }
    }
    const columnMap = computeColumnMap(headers, filePath, projectColumnMap);

    // Build row objects keyed by original header positions BEFORE reordering
    const origHeaders = [...headers];
    const rows = rawData.slice(1).map((row, i) => {
      const obj = { _rowIndex: i + 1 };
      origHeaders.forEach((h, j) => { obj[h] = row[j] ?? ''; });
      return obj;
    });

    renameLegacyNavColumns(headers, rows);
    injectAndOrderAuditColumns(headers, rows, columnMap);

    // Check for the sitemap-tree sheet — 'Sitemap' going forward, 'NavStructure'
    // in older files (matched case-insensitively either way).
    let navTree = null;
    const navSheetName = allSheetNames.find(s => ['navstructure', 'sitemap'].includes(s.toLowerCase()));
    if (navSheetName) {
      navTree = parseNavSheet(workbook.Sheets[navSheetName]);
      if (navTree) {
        NAV_COLUMNS.forEach(col => {
          if (!headers.includes(col)) headers.push(col);
        });
        // Canonicalize to 'Sitemap' regardless of the on-disk name — writeWorkbook()
        // physically renames the sheet the next time this file is saved.
        navSheetInfo = { sheetName: 'Sitemap' };
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

    // Check for Audiences sheet (audience prioritization workshop output)
    const audSheetName = allSheetNames.find(s => s.toLowerCase() === 'audiences');
    if (audSheetName) {
      projectSettings.audienceLibrary = parseAudienceLibrarySheet(workbook.Sheets[audSheetName]);
    } else {
      projectSettings.audienceLibrary = projectSettings.audienceLibrary || [];
    }

    // Check for Jobs sheet (jobs-to-be-done workshop output)
    const jobsSheetName = allSheetNames.find(s => s.toLowerCase() === 'jobs');
    if (jobsSheetName) {
      projectSettings.jobLibrary = parseJobLibrarySheet(workbook.Sheets[jobsSheetName]);
    } else {
      projectSettings.jobLibrary = projectSettings.jobLibrary || [];
    }

    // Check for Sites sheet (source sites in a consolidation audit)
    const sitesSheetName = allSheetNames.find(s => s.toLowerCase() === 'sites');
    if (sitesSheetName) {
      projectSettings.siteLibrary = parseSiteLibrarySheet(workbook.Sheets[sitesSheetName]);
    } else {
      projectSettings.siteLibrary = projectSettings.siteLibrary || [];
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
  'Url_Path': 'urlOverride', 'Breadcrumb_Parent': 'breadcrumbParentId', 'Collapse': 'collapse',
  'Notes': 'notes', 'Phase': 'phase', 'Node_Type': 'nodeType', 'Nav_Layer': 'navLayer',
  'Build_Pattern': 'buildPattern', 'Build_Guidance': 'buildGuidance', 'Writer_Brief': 'writerBrief',
  'Page_Status': 'pageStatus', 'Build_Assignee': 'buildAssignee', 'Write_Assignee': 'writeAssignee',
  'Migrate_Assignee': 'migrateAssignee', 'Node_Audiences': 'audiences',
  'Hide_In_Visual_Sitemap': 'hideInVisual'
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
    const { headers, rows, navNodes, projectSettings, sheetName, parseErrors } = projectStore.readAll();

    if (headers.length === 0) {
      throw new Error('Project file contains no data.');
    }

    // Unreadable blobs no longer abort the open (see readAll) — but they must not
    // pass silently either: the affected rows load blank, and the user needs to
    // know which ones before they act on the audit.
    if (parseErrors && parseErrors.length > 0) {
      const detail = parseErrors.slice(0, 10)
        .map(e => `• ${e.kind} ${e.idx}: ${e.error}`).join('\n');
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Project opened with damaged entries',
        message: `${parseErrors.length} entr${parseErrors.length === 1 ? 'y' : 'ies'} in this project could not be read and opened blank.`,
        detail: `The rest of the project opened normally. The unreadable data is preserved in the file, so it is not lost — but do not save over the project until you have a backup (one is written automatically to the app's backups folder each time a project is opened).\n\n${detail}` +
                (parseErrors.length > 10 ? `\n…and ${parseErrors.length - 10} more.` : '')
      });
    }

    // Same post-processing as the xlsx path: column mapping (honoring the
    // project's own saved mapping, then per-user overrides) + injection of any
    // audit columns added since the project was last saved.
    const columnMap = computeColumnMap(headers, filePath,
      (projectSettings.columnMap && typeof projectSettings.columnMap === 'object') ? projectSettings.columnMap : null);
    renameLegacyNavColumns(headers, rows);
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
    // No xlsx behind a project — exports build the Sitemap sheet from scratch.
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
    urlOverride:  h.indexOf('Url_Path'),
    breadcrumbParentId: h.indexOf('Breadcrumb_Parent'),
    collapse:     h.indexOf('Collapse'),
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
    migrateAssignee: h.indexOf('Migrate_Assignee'),
    // Who the branch is for (renderer: nodeOwnAudiences / navEffectiveAudienceMap)
    audiences:    h.indexOf('Node_Audiences'),
    // Kept in the sitemap (mapping, reports, redirects) but not drawn in the
    // Visual Sitemap — renderer: isNavHiddenInVisual()
    hideInVisual: h.indexOf('Hide_In_Visual_Sitemap')
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
      urlOverride:  idx.urlOverride >= 0 ? String(r[idx.urlOverride] || '') : '',
      breadcrumbParentId: idx.breadcrumbParentId >= 0 ? String(r[idx.breadcrumbParentId] || '') : '',
      collapse:     idx.collapse >= 0    ? String(r[idx.collapse] || '')    : '',
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
      audiences:    idx.audiences >= 0 ? String(r[idx.audiences] || '') : '',
      hideInVisual: idx.hideInVisual >= 0 ? String(r[idx.hideInVisual] || '') : '',
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

  return { roots, nodes };
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
    } else if (val === 'true' || val === 'false') {
      // Booleans are written as JSON strings (see writeSettingsSheet) so they
      // survive the round-trip. Without this, a bare boolean cell reads back as
      // the string "FALSE" and a stored `false` (e.g. sitemapShowSiteRoot) is
      // silently lost — the consumer's `!== false` check then never matches.
      val = (val === 'true');
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

// Returns the list of setting keys dropped for being oversized (empty if none) —
// callers surface this to the user instead of leaving it in a console nobody reads.
function writeSettingsSheet(workbook, settings) {
  if (!settings || Object.keys(settings).length === 0) return [];
  // These each live in their own structural sheet — never duplicate them into the
  // KKE_Settings key/value cells. Their JSON copy can exceed Excel's 32767-char
  // per-cell limit, which makes the whole workbook write throw and aborts the save.
  const {
    glossary: _glossary,
    patternLibrary: _patternLibrary,
    contentTypeRegistry: _contentTypeRegistry,
    designPatternLibrary: _designPatternLibrary,
    audienceLibrary: _audienceLibrary,
    siteLibrary: _siteLibrary,
    jobLibrary: _jobLibrary,
    ...settingsToWrite
  } = settings;
  if (Object.keys(settingsToWrite).length === 0) return [];
  const MAX_CELL = 32767; // Excel hard limit on cell text length
  const aoa = [['Key', 'Value']];
  const dropped = [];
  for (const [key, val] of Object.entries(settingsToWrite)) {
    // Serialize arrays and objects as JSON strings. Booleans too: a bare boolean
    // cell reads back as "FALSE"/"TRUE" (see parseSettingsSheet), which loses a
    // stored `false`; JSON-encoding makes it "false"/"true" so it round-trips.
    let serialized = (Array.isArray(val) || (val && typeof val === 'object') || typeof val === 'boolean') ? JSON.stringify(val) : val;
    // Defense-in-depth: never let a single oversized value crash the entire save.
    // A value this large is virtually always JSON (menus, sitemapSettings), so
    // truncating the string would leave invalid JSON that fails to parse back
    // into the shape callers expect — dropping it is the least-bad option, but
    // the caller must tell the user, not just log it.
    if (typeof serialized === 'string' && serialized.length > MAX_CELL) {
      console.warn(`[KKE] Settings "${key}" is ${serialized.length} chars — exceeds the ${MAX_CELL}-char cell limit; skipping it so the save can complete.`);
      dropped.push(key);
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
  return dropped;
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

/**
 * Persist a structural library the user has emptied, by reducing its sheet to a
 * header row. Callers reach here only with an explicitly-empty model (their own
 * `!Array.isArray(...)` guard already covers "not loaded / not sent"), so an
 * empty list means the user deleted the entries — and leaving the old sheet
 * intact silently reverts that on the next open. `.transmission` already
 * persists it (saveAll replaces the settings table wholesale), so skipping it
 * here made the two backends disagree about the same action.
 *
 * Only ever REPLACES an existing sheet, never creates one: a plain crawl export
 * shouldn't grow empty structural sheets just by being saved.
 */
function writeEmptyStructuralSheet(workbook, sheetName, header) {
  if (!workbook.SheetNames.includes(sheetName)) return;
  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet([header]);
}

function writeContentTypeRegistrySheet(workbook, registry) {
  if (!Array.isArray(registry)) return;
  const sheetName = 'ContentTypeRegistry';
  const HEADER = ['Content_Type', 'Default_Content_Nature', 'Default_Migration_Track', 'Notes', 'Target_Content_Type', 'Target_Spec'];
  // Filter out fully-blank rows
  const entries = registry.filter(e => String(e?.contentType || '').trim());
  if (entries.length === 0) {
    writeEmptyStructuralSheet(workbook, sheetName, HEADER);
    return;
  }
  const aoa = [HEADER];
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

// ─── Audiences ───────────────────────────────────────────────────────────────
// Per-project library capturing the output of an audience prioritization
// workshop: who the site is for, and how much each of them matters. Deliberately
// a visible structural sheet rather than a JSON blob in KKE_Settings — the
// workshop output arrives as a spreadsheet and the client wants to keep editing
// it as one, so the sheet IS the import/handoff path.
//
// Per-project, never global prefs: unlike components (which genuinely repeat
// across clients) an audience list does not transfer between a university and a
// hospital system.

const AUDIENCE_TIERS = ['Primary', 'Secondary', 'Tertiary', 'Not a target'];

// The reserved "we looked, and this serves nobody" entry. A BLANK Audiences cell
// means nobody has reviewed the row yet; this means the review happened and came
// back negative. Those are opposite findings, and collapsing them would make the
// suggestion engine read every untouched row as a Kill candidate.
const AUDIENCE_NONE = '— None (no target audience)';

// Seeded at Secondary on purpose — NOT pre-tiered. Guessing the client's
// priorities and having the guess silently accepted is worse than an empty
// ranking, and an all-Secondary library abstains from KKE voting until someone
// does the actual prioritization pass.
//
// Two starter lists, because "who is this site for" has no universal answer.
// Both are a convenience for projects with no workshop output yet — pasting the
// client's own ranking is always the better path, and the UI says so.
const AUDIENCE_STARTER_SETS = {
  'higher-ed': {
    label: 'Higher education',
    hint: 'Colleges, universities, schools — recruitment, enrollment, advancement.',
    entries: [
      { name: 'Prospective Undergraduates',    color: '#2563eb', description: 'High-school students evaluating where to apply.' },
      { name: 'Prospective Graduate Students', color: '#7c3aed', description: 'Working professionals and recent graduates evaluating advanced programs.' },
      { name: 'Current Students',              color: '#0891b2', description: 'Enrolled students handling registration, advising, campus life.' },
      { name: 'Parents & Families',            color: '#db2777', description: 'Families supporting an applicant or enrolled student.' },
      { name: 'Faculty & Staff',               color: '#65a30d', description: 'Internal audience — often better served by an intranet.' },
      { name: 'Alumni',                        color: '#ea580c', description: 'Graduates staying connected, using services, attending events.' },
      { name: 'Donors',                        color: '#ca8a04', description: 'Current and prospective givers evaluating impact.' },
      { name: 'Employers & Partners',          color: '#0d9488', description: 'Recruiters, industry and community partners.' },
      { name: 'Researchers',                   color: '#4f46e5', description: 'Academic peers and collaborators.' },
      { name: 'Media',                         color: '#78716c', description: 'Journalists seeking experts, facts, contacts.' }
    ]
  },
  general: {
    label: 'General organization',
    hint: 'Companies, nonprofits, agencies, government — anything not higher ed.',
    entries: [
      { name: 'Prospective Customers', color: '#2563eb', description: 'Evaluating and comparing before they buy or commit.' },
      { name: 'Existing Customers',    color: '#0891b2', description: 'Already bought — support, documentation, account, renewal.' },
      { name: 'Partners & Resellers',  color: '#0d9488', description: 'Channel, integration, referral, and delivery partners.' },
      { name: 'Investors & Analysts',  color: '#ca8a04', description: 'Financials, governance, strategy, filings.' },
      { name: 'Job Seekers',           color: '#7c3aed', description: 'Candidates researching roles, culture, and benefits.' },
      { name: 'Employees',             color: '#65a30d', description: 'Internal audience — often better served by an intranet.' },
      { name: 'Media & Press',         color: '#78716c', description: 'Journalists seeking facts, spokespeople, assets.' },
      { name: 'Vendors & Suppliers',   color: '#ea580c', description: 'Procurement, onboarding, invoicing, compliance.' },
      { name: 'General Public',        color: '#db2777', description: 'No specific relationship — reputation, community, transparency.' }
    ]
  }
};

// Shared across both sets: the reserved "reviewed, serves nobody" entry.
const AUDIENCE_NONE_ENTRY = {
  name: AUDIENCE_NONE, tier: 'Not a target', color: '#9ca3af',
  description: 'Reviewed and serves no audience we are investing in. A Kill argument — distinct from an untagged page.',
  notes: ''
};

function defaultAudienceLibrary(kind) {
  const set = AUDIENCE_STARTER_SETS[kind] || AUDIENCE_STARTER_SETS['higher-ed'];
  return set.entries
    .map(e => ({ ...e, tier: 'Secondary', notes: '' }))
    .concat([{ ...AUDIENCE_NONE_ENTRY }]);
}

function parseAudienceLibrarySheet(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const entries = [];
  for (let i = 1; i < rawData.length; i++) {
    const name = String(rawData[i][0] || '').trim();
    if (!name) continue;
    // A hand-edited sheet is the expected authoring path, so a tier typo must not
    // silently become an unmatchable value — fall back rather than trust it.
    const rawTier = String(rawData[i][1] || '').trim();
    const tier = AUDIENCE_TIERS.find(t => t.toLowerCase() === rawTier.toLowerCase()) || 'Secondary';
    entries.push({
      name,
      tier,
      color:       String(rawData[i][2] || '').trim(),
      description: String(rawData[i][3] || ''),
      notes:       String(rawData[i][4] || '')
    });
  }
  return entries;
}

function writeAudienceLibrarySheet(workbook, library) {
  if (!Array.isArray(library)) return;
  const sheetName = 'Audiences';
  const HEADER = ['Name', 'Tier', 'Color', 'Description', 'Notes'];
  const entries = library.filter(e => String(e?.name || '').trim());
  if (entries.length === 0) {
    writeEmptyStructuralSheet(workbook, sheetName, HEADER);
    return;
  }
  const aoa = [HEADER];
  // Tier order, then alphabetical — the sheet should read like the workshop
  // output it came from, with the priorities at the top.
  const ordered = entries.slice().sort((a, b) => {
    const ta = AUDIENCE_TIERS.indexOf(a.tier), tb = AUDIENCE_TIERS.indexOf(b.tier);
    if (ta !== tb) return (ta < 0 ? 99 : ta) - (tb < 0 ? 99 : tb);
    return String(a.name).localeCompare(String(b.name));
  });
  ordered.forEach(e => aoa.push([
    e.name,
    e.tier || '',
    e.color || '',
    clampCell(e.description || ''),
    clampCell(e.notes || '')
  ]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 60 }, { wch: 50 }];
  if (workbook.SheetNames.includes(sheetName)) {
    workbook.Sheets[sheetName] = ws;
  } else {
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }
}

// ─── Jobs (jobs-to-be-done) ──────────────────────────────────────────────────
// The other half of the discovery workshop output. Audiences answer *who*; jobs
// answer *what they came to do*. The payoff is the inverse question — a job with
// no page serving it is the cleanest possible argument for net-new content,
// because it traces a proposed page back to something the client said themselves.
//
// A job carries a short `label` (what goes in the row cell, so the spreadsheet
// stays readable) and the full `statement` in the workshop's own words. It also
// lists the audiences it belongs to — a list, not one owner, because most jobs
// are audience-specific but some ("find who to contact") genuinely aren't, and
// forcing those onto one audience would distort the coverage gap analysis.

/** Commas separate values in the row cell, so a label can never contain one. */
function sanitizeJobLabel(s) {
  return String(s || '').replace(/,/g, ';').trim();
}

function parseJobLibrarySheet(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const entries = [];
  for (let i = 1; i < rawData.length; i++) {
    const label = sanitizeJobLabel(rawData[i][0]);
    if (!label) continue;
    entries.push({
      label,
      statement: String(rawData[i][1] || '').trim(),
      audiences: String(rawData[i][2] || '').split(',').map(s => s.trim()).filter(Boolean),
      notes: String(rawData[i][3] || '')
    });
  }
  return entries;
}

function writeJobLibrarySheet(workbook, library) {
  if (!Array.isArray(library)) return;
  const sheetName = 'Jobs';
  const HEADER = ['Job', 'Statement', 'Audiences', 'Notes'];
  const entries = library.filter(e => String(e?.label || '').trim());
  if (entries.length === 0) {
    writeEmptyStructuralSheet(workbook, sheetName, HEADER);
    return;
  }
  const aoa = [HEADER];
  // Grouped by first audience then label, so the sheet reads like the workshop
  // it came from rather than an arbitrary insertion order.
  entries.slice()
    .sort((a, b) => (String((a.audiences || [])[0] || '~').localeCompare(String((b.audiences || [])[0] || '~')))
                 || String(a.label).localeCompare(String(b.label)))
    .forEach(e => aoa.push([
      e.label,
      clampCell(e.statement || ''),
      (e.audiences || []).join(', '),
      clampCell(e.notes || '')
    ]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 34 }, { wch: 70 }, { wch: 40 }, { wch: 40 }];
  if (workbook.SheetNames.includes(sheetName)) {
    workbook.Sheets[sheetName] = ws;
  } else {
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }
}

// ─── Sites ───────────────────────────────────────────────────────────────────
// The source sites an audit is consolidating. Transmission otherwise models an
// audit as one site becoming one site; in a merger the unit of work is often the
// SITE — it has an owner, a CMS to export from, its own redirect configuration,
// and its own in-scope decision.
//
// A registry rather than "parse the host", because host ≠ site: `www.company.com`
// and `company.com` are always one site, while `careers.company.com` may be one
// site with them or a separate property being retired. Only the auditor knows,
// so `hosts` is a list they curate. The registry auto-seeds one entry per host
// found in the data, which makes an ordinary single-domain project a one-entry
// registry that changes nothing.

function parseSiteLibrarySheet(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const entries = [];
  for (let i = 1; i < rawData.length; i++) {
    const label = String(rawData[i][0] || '').trim();
    if (!label) continue;
    entries.push({
      label,
      hosts: String(rawData[i][1] || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      cms:     String(rawData[i][2] || '').trim(),
      owner:   String(rawData[i][3] || '').trim(),
      // Blank means in scope. Only an explicit no opts a site out, so a
      // hand-edited sheet can never silently drop a site from every report.
      inScope: !/^(n|no|false|0)$/i.test(String(rawData[i][4] || '').trim()),
      color:   String(rawData[i][5] || '').trim(),
      notes:   String(rawData[i][6] || '')
    });
  }
  return entries;
}

function writeSiteLibrarySheet(workbook, library) {
  if (!Array.isArray(library)) return;
  const sheetName = 'Sites';
  const HEADER = ['Label', 'Hosts', 'CMS', 'Owner', 'In_Scope', 'Color', 'Notes'];
  const entries = library.filter(e => String(e?.label || '').trim());
  if (entries.length === 0) {
    writeEmptyStructuralSheet(workbook, sheetName, HEADER);
    return;
  }
  const aoa = [HEADER];
  entries.slice()
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
    .forEach(e => aoa.push([
      e.label,
      (e.hosts || []).join(', '),
      e.cms || '',
      e.owner || '',
      e.inScope === false ? 'No' : 'Yes',
      e.color || '',
      clampCell(e.notes || '')
    ]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 30 }, { wch: 44 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 50 }];
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
  const HEADER = ['Pattern_Name', 'Description', 'Build_Guidance_Default', 'Writer_Brief_Default', 'Default_Migration_Track', 'Notes', 'Kind', 'Migration_Mapping_Default', 'Fields'];
  const entries = library.filter(e => String(e?.patternName || '').trim());
  if (entries.length === 0) {
    writeEmptyStructuralSheet(workbook, sheetName, HEADER);
    return;
  }
  const aoa = [HEADER];
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
  { name: 'Card Collection',      category: 'Collection', complexity: 'Low',    description: 'Grid or row of cards; the most common section pattern on content-heavy sites.', dsUrl: '', aliases: 'Card Grid, Card Row', notes: '' },
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
  const HEADER = ['Name', 'Category', 'Complexity', 'Description', 'DS_URL', 'Aliases', 'Notes'];
  const entries = library.filter(e => String(e?.name || '').trim());
  if (entries.length === 0) {
    writeEmptyStructuralSheet(workbook, sheetName, HEADER);
    return;
  }
  const aoa = [HEADER];
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
  const HEADER = ['Type', 'Name', 'Notes'];
  if (tagKeys.length === 0 && groupKeys.length === 0) {
    writeEmptyStructuralSheet(workbook, sheetName, HEADER);
    return;
  }
  const aoa = [HEADER];
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

    // One-time migration: rename a legacy 'NavStructure' sheet to 'Sitemap' in
    // place (same client-facing rename as the data sheet's Sitemap_ID /
    // Sitemap_Destination columns). Renaming the actual sheet object here —
    // not just navSheetInfo — means the "rewrite existing sheet" branch below
    // finds it under the new name and updates it in place, rather than leaving
    // a stale duplicate 'NavStructure' sheet behind.
    const legacyNavSheetName = workbook.SheetNames.find(s => s.toLowerCase() === 'navstructure');
    if (legacyNavSheetName && legacyNavSheetName !== 'Sitemap' && !workbook.SheetNames.includes('Sitemap')) {
      workbook.Sheets['Sitemap'] = workbook.Sheets[legacyNavSheetName];
      delete workbook.Sheets[legacyNavSheetName];
      workbook.SheetNames[workbook.SheetNames.indexOf(legacyNavSheetName)] = 'Sitemap';
    }

    // Full rewrite of Sitemap sheet (nav editor edits)
    if (allNavNodes && allNavNodes.length > 0) {
      if (navSheetInfo && workbook.Sheets[navSheetInfo.sheetName]) {
        // Rewrite existing Sitemap sheet
        const nsName = navSheetInfo.sheetName;
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
        // Ensure Url_Path column exists (per-node URL override — decouples URL from hierarchy)
        if (!nsHeaders.includes('Url_Path')) {
          nsHeaders.push('Url_Path');
          nsData[0] = nsHeaders;
        }
        // Ensure Breadcrumb_Parent column exists (per-node breadcrumb re-root — decouples breadcrumb from hierarchy)
        if (!nsHeaders.includes('Breadcrumb_Parent')) {
          nsHeaders.push('Breadcrumb_Parent');
          nsData[0] = nsHeaders;
        }
        // Ensure Collapse column exists (per-node collapse-subtree flag for the visual sitemap)
        if (!nsHeaders.includes('Collapse')) {
          nsHeaders.push('Collapse');
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
        const ensureCols = ['Build_Pattern', 'Build_Guidance', 'Writer_Brief', 'Page_Status', 'Build_Assignee', 'Write_Assignee', 'Migrate_Assignee', 'Node_Audiences', 'Hide_In_Visual_Sitemap'];
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
          urlOverride:  nsHeaders.indexOf('Url_Path'),
          breadcrumbParentId: nsHeaders.indexOf('Breadcrumb_Parent'),
          collapse:     nsHeaders.indexOf('Collapse'),
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
          migrateAssignee: nsHeaders.indexOf('Migrate_Assignee'),
          audiences:      nsHeaders.indexOf('Node_Audiences'),
          hideInVisual:   nsHeaders.indexOf('Hide_In_Visual_Sitemap')
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
          if (colIdx.urlOverride >= 0)  newRow[colIdx.urlOverride]  = node.urlOverride || '';
          if (colIdx.breadcrumbParentId >= 0) newRow[colIdx.breadcrumbParentId] = node.breadcrumbParentId || '';
          if (colIdx.collapse >= 0)     newRow[colIdx.collapse]     = node.collapse || '';
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
          if (colIdx.audiences      >= 0) newRow[colIdx.audiences]      = node.audiences      || '';
          if (colIdx.hideInVisual   >= 0) newRow[colIdx.hideInVisual]   = node.hideInVisual   || '';
          rebuilt.push(newRow);
        }

        workbook.Sheets[nsName] = XLSX.utils.aoa_to_sheet(rebuilt);
      } else {
        // Create new Sitemap sheet — full column set, so projects (which
        // always export from scratch) round-trip notes/phase/build metadata.
        const nsName = 'Sitemap';
        const nsHeaders = ['ID', 'Number', 'ParentNumber', 'Label', 'Path', 'SortID', 'Computed Path', 'Breadcrumb',
                           'RefNodeID', 'InMenu', 'URL', 'Url_Path', 'Breadcrumb_Parent', 'Collapse', 'Notes', 'Phase', 'Node_Type', 'Nav_Layer',
                           'Build_Pattern', 'Build_Guidance', 'Writer_Brief', 'Page_Status',
                           'Build_Assignee', 'Write_Assignee', 'Migrate_Assignee', 'Node_Audiences', 'Hide_In_Visual_Sitemap'];
        const rebuilt = [nsHeaders];
        for (const node of allNavNodes) {
          rebuilt.push([
            node.id, node.number, node.parentNumber || '',
            node.label, node.path || '', node.sortID || '',
            node.computedPath || '', node.breadcrumb || '',
            node.refNodeId || '', node.inMenu || '', node.url || '', node.urlOverride || '', node.breadcrumbParentId || '', node.collapse || '',
            clampCell(node.notes || ''), node.phase || '', node.nodeType || '', node.navLayer || '',
            node.buildPattern || '', clampCell(node.buildGuidance || ''), clampCell(node.writerBrief || ''), node.pageStatus || '',
            node.buildAssignee || '', node.writeAssignee || '', node.migrateAssignee || '', node.audiences || '',
            node.hideInVisual || ''
          ]);
        }
        workbook.Sheets[nsName] = XLSX.utils.aoa_to_sheet(rebuilt);
        if (!workbook.SheetNames.includes(nsName)) {
          workbook.SheetNames.push(nsName);
        }
        // Set navSheetInfo so subsequent saves can rewrite
        navSheetInfo = { sheetName: nsName };
      }
    }
    // Append new nav nodes to Sitemap sheet (legacy: from nav popover child creation)
    else if (newNavNodes && newNavNodes.length > 0 && navSheetInfo) {
      const nsName = navSheetInfo.sheetName;
      if (workbook.Sheets[nsName]) {
        const nsWs = workbook.Sheets[nsName];
        const nsData = XLSX.utils.sheet_to_json(nsWs, { header: 1, defval: '' });
        const nsHeaders = nsData[0].map(String);

        // Column indices in Sitemap
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
    let droppedSettings = [];
    if (projectSettings) {
      droppedSettings = writeSettingsSheet(workbook, projectSettings);
      if (projectSettings.glossary) {
        writeGlossarySheet(workbook, projectSettings.glossary);
      }
      // No `.length > 0` here: an empty array is a real state (the user deleted
      // every entry) and has to reach the writer, which persists it by reducing
      // an existing sheet to its header. Array.isArray still gates out
      // "not loaded / not sent", which is the case worth protecting against.
      if (Array.isArray(projectSettings.contentTypeRegistry)) {
        writeContentTypeRegistrySheet(workbook, projectSettings.contentTypeRegistry);
      }
      if (Array.isArray(projectSettings.patternLibrary)) {
        writePatternLibrarySheet(workbook, projectSettings.patternLibrary);
      }
      if (Array.isArray(projectSettings.designPatternLibrary)) {
        writeDesignPatternLibrarySheet(workbook, projectSettings.designPatternLibrary);
      }
      if (Array.isArray(projectSettings.audienceLibrary)) {
        writeAudienceLibrarySheet(workbook, projectSettings.audienceLibrary);
      }
      if (Array.isArray(projectSettings.siteLibrary)) {
        writeSiteLibrarySheet(workbook, projectSettings.siteLibrary);
      }
      if (Array.isArray(projectSettings.jobLibrary)) {
        writeJobLibrarySheet(workbook, projectSettings.jobLibrary);
      }
    }

    // Append to change log sheet (or replace it wholesale when the caller is
    // exporting a project's full history — re-exporting would otherwise duplicate)
    if (changeLog && changeLog.length > 0) {
      const clName = 'KKE_ChangeLog';
      const clHeaders = ['Timestamp', 'Row', 'URL', 'Field', 'Old Value', 'New Value', 'Auditor'];
      let existingRows = [];
      if (!opts.replaceChangeLog && workbook.Sheets[clName]) {
        const existing = XLSX.utils.sheet_to_json(workbook.Sheets[clName], { header: 1, defval: '' });
        if (existing.length > 1) existingRows = existing.slice(1); // skip header
      }
      const newRows = changeLog.map(e => [e.timestamp, e.row, e.url || '', e.field, e.from, e.to, e.auditor || '']);
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
    return droppedSettings.length > 0 ? { success: true, droppedSettings } : { success: true };
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
        auditor: String(r[6] ?? '')  // '' for rows written before the Auditor column existed
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
    // Saved column mappings are keyed by basename (incl. extension), so a
    // mapping fixed on the source xlsx wouldn't apply to the new project —
    // the wrong-auto-detected-column problem would silently return. Carry it.
    const sourcePath = currentFilePath;
    currentFilePath = result.filePath;
    navSheetInfo = null;
    if (sourcePath) {
      const prefs = loadPrefs();
      const oldMap = prefs.columnMappings?.[path.basename(sourcePath)];
      const newName = path.basename(currentFilePath);
      if (oldMap && !prefs.columnMappings[newName]) {
        savePrefs({ columnMappings: { ...prefs.columnMappings, [newName]: oldMap } });
      }
    }
    savePrefs({ lastFile: currentFilePath, lastSheet: null });
    recordRecentFile(currentFilePath);
    mainWindow?.webContents.send('save-success', currentFilePath);
    return { success: true, filePath: currentFilePath };
  } catch (err) {
    projectStore.close();
    return { success: false, error: err.message };
  }
});

// Package the open project for handoff to another auditor: checkpoint the WAL
// so the .transmission file is a complete single-file snapshot, then zip it
// with a short README. The recipient unzips and double-clicks.
// ─── Proposals (changes queued from outside, e.g. the MCP server) ────────────
// The renderer asks, main answers from the open ProjectStore. The queue lives in
// the project file, so a .xlsx session has none — the renderer shows why.

function proposalsUnavailableReason() {
  if (!currentFilePath) return 'No file is open.';
  if (!isProjectFile(currentFilePath) || !projectStore.isOpen) return 'Proposals need a .transmission project (File → Save As Project…).';
  return null;
}

ipcMain.handle('proposals-pending', () => {
  const reason = proposalsUnavailableReason();
  if (reason) return { supported: false, reason, count: 0 };
  try { return { supported: true, count: projectStore.countProposals('pending') }; }
  catch (e) { return { supported: false, reason: e.message, count: 0 }; }
});

ipcMain.handle('proposals-list', () => {
  const reason = proposalsUnavailableReason();
  if (reason) return { success: false, error: reason, proposals: [] };
  try { return { success: true, proposals: projectStore.readProposals('pending') }; }
  catch (e) { return { success: false, error: e.message, proposals: [] }; }
});

ipcMain.handle('proposals-resolve', (_e, { ids, status } = {}) => {
  const reason = proposalsUnavailableReason();
  if (reason) return { success: false, error: reason, resolved: 0 };
  try { return { success: true, resolved: projectStore.resolveProposals(ids || [], status) }; }
  catch (e) { return { success: false, error: e.message, resolved: 0 }; }
});

// ─── Open in Claude Code ──────────────────────────────────────────────────────
// Launches the `claude` CLI in a Terminal window with the bundled MCP plugin
// (mcp/ ships as an extraResource) pointed at the open project. The plugin's
// server reads TRANSMISSION_PROJECT, so no per-project configuration is needed.
// Nothing here talks to a model: it opens a terminal, exactly as the user would.

function mcpPluginDir() {
  return app.isPackaged ? path.join(process.resourcesPath, 'mcp') : path.join(__dirname, 'mcp');
}

/** Resolve `claude` through a login shell, since a GUI app's PATH is not the
 *  user's terminal PATH (that is where ~/.local/bin and Homebrew live). */
function findClaudeCli() {
  return new Promise(resolve => {
    const { execFile } = require('child_process');
    execFile('/bin/zsh', ['-lc', 'command -v claude'], { timeout: 8000 }, (err, stdout) => {
      const p = String(stdout || '').trim().split('\n').pop();
      resolve(!err && p ? p : null);
    });
  });
}

const shQuote = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

ipcMain.handle('claude-launch-status', async () => {
  const reason = proposalsUnavailableReason();   // same precondition: a project file to point at
  const cli = await findClaudeCli();
  return { projectOk: !reason, projectReason: reason, cliFound: !!cli, cliPath: cli, pluginDir: mcpPluginDir(), platform: process.platform };
});

ipcMain.handle('claude-launch', async () => {
  const reason = proposalsUnavailableReason();
  if (reason) return { success: false, error: reason };
  const cli = await findClaudeCli();
  const plugin = mcpPluginDir();
  // Checkpoint so the file the server opens is complete even before its first autosave.
  try { projectStore.checkpoint(); } catch (_) { /* best effort */ }
  const cmd = `cd ${shQuote(path.dirname(currentFilePath))} && TRANSMISSION_PROJECT=${shQuote(currentFilePath)} claude --plugin-dir ${shQuote(plugin)}`;
  if (!cli) return { success: false, error: 'claude-not-found', command: cmd };
  if (process.platform !== 'darwin') return { success: false, error: 'unsupported-platform', command: cmd };
  // A `.command` file opened with Terminal runs without Apple Events, so there
  // is no Automation permission prompt — which an AppleScript `do script` would
  // trigger on first use and silently block on if dismissed. The file is
  // rewritten per launch and lives in userData, outside any project.
  try {
    const dir = path.join(app.getPath('userData'), 'launch');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'open-in-claude.command');
    fs.writeFileSync(file, `#!/bin/zsh -l\n# Written by Transmission — opens Claude Code on the current project.\nclear\n${cmd}\n`, { mode: 0o755 });
    const { execFile } = require('child_process');
    await new Promise((resolve, reject) => execFile('/usr/bin/open', ['-a', 'Terminal', file], { timeout: 15000 }, err => err ? reject(err) : resolve()));
    return { success: true, command: cmd };
  } catch (e) {
    return { success: false, error: e.message, command: cmd };
  }
});

ipcMain.handle('package-handoff', async () => {
  if (!isProjectFile(currentFilePath) || !projectStore.isOpen) {
    return { success: false, error: 'Open a .transmission project first (File → Save As Project…).' };
  }
  const base = path.basename(currentFilePath).replace(/\.transmission$/i, '');
  const stamp = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Package for Handoff',
    defaultPath: `${base}-handoff-${stamp}.zip`,
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };

  try {
    projectStore.checkpoint();
    const JSZip = require('jszip');
    const zip = new JSZip();
    zip.file(path.basename(currentFilePath), fs.readFileSync(currentFilePath));
    zip.file('README.txt', [
      'Transmission project handoff',
      '============================',
      `Project:  ${path.basename(currentFilePath)}`,
      `Packaged: ${new Date().toISOString()}`,
      `By:       ${require('os').userInfo().username}`,
      '',
      'To continue this audit:',
      '  1. Install Transmission.',
      '  2. Unzip, then double-click the .transmission file (or File → Open…).',
      '',
      'Everything travels inside the project file: rows and decisions, the',
      'sitemap, project settings, glossary and libraries, and the full',
      'change history. Edits you make are attributed to your username in the',
      'change log.'
    ].join('\n'));
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(result.filePath, buf);
    shell.showItemInFolder(result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
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

ipcMain.handle('get-default-audience-library', (event, opts) => defaultAudienceLibrary(opts && opts.kind));

ipcMain.handle('get-audience-starter-sets', () =>
  Object.entries(AUDIENCE_STARTER_SETS).map(([kind, s]) => ({ kind, label: s.label, hint: s.hint, count: s.entries.length + 1 })));

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

// ─── Update check ─────────────────────────────────────────────────────────────

function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

// Only ever load/open manifest-supplied URLs that point at hosts we publish
// to — the manifest is fetched over the network, so this is a floor against
// a compromised or malformed response redirecting the user's browser/window.
function isTrustedUpdateUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && UPDATE_TRUSTED_HOSTS.has(u.hostname);
  } catch (e) { return false; }
}

// Constant, not manifest-supplied — the trust check is a floor that keeps a
// later edit (or a URL that starts coming from config) from pointing a menu
// item at an arbitrary host.
function openDocsSite() {
  if (!isTrustedUpdateUrl(DOCS_SITE_URL)) return;
  shell.openExternal(DOCS_SITE_URL);
}

async function performUpdateCheck() {
  const current = app.getVersion();
  const response = await net.fetch(UPDATE_MANIFEST_URL);
  if (!response.ok) throw new Error(`Update check failed (HTTP ${response.status})`);
  const manifest = await response.json();
  if (!manifest || typeof manifest.version !== 'string') throw new Error('Malformed update manifest');
  if (!isTrustedUpdateUrl(manifest.changelogUrl) || !isTrustedUpdateUrl(manifest.downloadUrl)) {
    throw new Error('Update manifest points to an untrusted host');
  }
  return {
    available: compareVersions(manifest.version, current) > 0,
    current, latest: manifest.version,
    notes: manifest.notes || '',
    changelogUrl: manifest.changelogUrl,
    downloadUrl: manifest.downloadUrl,
    publishedAt: manifest.publishedAt || null,
  };
}

ipcMain.handle('check-for-updates', async () => {
  try { return await performUpdateCheck(); }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('open-changelog-window', (event, url) => { openChangelogWindow(url); });

// GitHub Pages serves the changelog with `cache-control: max-age=600`, so a
// plain loadURL can render a copy up to ten minutes old. That is exactly the
// wrong ten minutes: the user reaches this window from an update prompt that
// has just told them a new version exists, and a cached page shows them the
// PREVIOUS release's notes. Always revalidate — the page is ~150KB and opens
// on an explicit click, so the round trip costs nothing anyone will notice.
const CHANGELOG_LOAD_OPTS = { extraHeaders: 'Cache-Control: no-cache\n' };

function openChangelogWindow(url) {
  if (!isTrustedUpdateUrl(url)) return;
  if (changelogWindow && !changelogWindow.isDestroyed()) {
    changelogWindow.loadURL(url, CHANGELOG_LOAD_OPTS);
    changelogWindow.focus();
    return;
  }
  changelogWindow = new BrowserWindow({
    width: 760,
    height: 820,
    minWidth: 400,
    minHeight: 300,
    title: "What's New — Transmission",
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  changelogWindow.loadURL(url, CHANGELOG_LOAD_OPTS);
  changelogWindow.on('closed', () => { changelogWindow = null; });
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
    noteTemplates:     prefs.noteTemplates || [],
    sitemapDefaults:   prefs.sitemapDefaults || null,
    themePref:         prefs.themePref || 'system'
  };
});

ipcMain.handle('save-prefs', (event, updates) => {
  savePrefs(updates);
  return { success: true };
});

// ─── Miro ─────────────────────────────────────────────────────────────────────
//
// The token is write-scoped and never crosses back over IPC — the renderer can
// set it, ask whether one exists, clear it, and ask main to act on its behalf,
// but cannot read it. That is the whole reason these are separate handlers
// rather than another key in get-prefs/save-prefs.

ipcMain.handle('miro-status', () => ({
  hasToken: miro.hasToken(),
  encryptionAvailable: miro.encryptionAvailable(),
  connectAvailable: miro.connectConfigured(),
}));

ipcMain.handle('miro-set-token', (event, token) => {
  try {
    miro.setToken(token);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('miro-clear-token', () => {
  miro.clearToken();
  return { success: true };
});

ipcMain.handle('miro-test-connection', async () => {
  try {
    return { success: true, ...(await miro.testConnection()) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Server-side board search (name/description), paged — the workable path when a
// token can see thousands of boards and a single 50-item list can't.
ipcMain.handle('miro-search-boards', async (event, opts) => {
  try {
    return { success: true, ...(await miro.searchBoards(opts || {})) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Resolve one board by id — for a pasted board link and for re-reading a
// remembered board's current name (rename-safe re-export).
ipcMain.handle('miro-get-board', async (event, { boardId } = {}) => {
  try {
    return { success: true, board: await miro.getBoard(boardId) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('miro-create-board', async (event, { name, description }) => {
  try {
    return { success: true, board: await miro.createBoard(name, description) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Low-level board-writing surface used by the sitemap exporter.
ipcMain.handle('miro-create-frame', async (event, { boardId, ...opts }) => {
  try { return { success: true, frame: await miro.createFrame(boardId, opts) }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('miro-create-items-bulk', async (event, { boardId, items }) => {
  try { return { success: true, items: await miro.createItemsBulk(boardId, items) }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('miro-create-connector', async (event, { boardId, ...opts }) => {
  try { return { success: true, connector: await miro.createConnector(boardId, opts) }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('miro-list-items', async (event, { boardId, limit }) => {
  try { return { success: true, items: await miro.listItems(boardId, limit) }; }
  catch (err) { return { success: false, error: err.message }; }
});

// Deletes a whole board. The export dialog's default route is "create a new
// board" — review it, then tidy up — and until now the app had no way to do the
// tidying, so scratch boards accumulated in the user's team. Destructive enough
// that any caller must confirm with the user FIRST: this handler deliberately
// does no confirming of its own, because a dialog raised from main can't say
// which board, in whose team, or what is on it.
ipcMain.handle('miro-delete-board', async (event, { boardId } = {}) => {
  try {
    if (!boardId) return { success: false, error: 'No board id given' };
    await miro.deleteBoard(boardId);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

// Sitemap export. Progress is pushed back on a channel rather than returned,
// since a 400-node board takes tens of seconds and silence reads as a hang.
ipcMain.handle('miro-export-sitemap', async (event, { boardId, plan }) => {
  try {
    const result = await miro.exportSitemap(boardId, plan, (p) => {
      try { event.sender.send('miro-export-progress', p); } catch (e) { /* window gone */ }
    });
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('miro-cancel-export', () => { miro.cancelExport(); return { success: true }; });

// One-click connect. Opens the browser and waits for the user to authorise;
// the token is stored in main and never returned across IPC.
ipcMain.handle('miro-connect', async () => {
  try {
    return { success: true, ...(await miro.connectViaBrowser()) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('miro-cancel-connect', () => { miro.cancelConnect(); return { success: true }; });

ipcMain.handle('miro-token-info', async () => {
  try {
    return { success: true, ...(await miro.tokenInfo()) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Write-access probe. Creates one shape with an off-palette fill, reports what
// Miro stored, then deletes it. Cleanup is best-effort: a leftover test shape
// is untidy but harmless, and reporting the write success matters more than
// reporting a failed delete.
ipcMain.handle('miro-probe-write', async (event, { boardId }) => {
  try {
    const probe = await miro.createProbeShape(boardId);
    let cleanedUp = false;
    if (probe.itemId) {
      try { await miro.deleteItem(boardId, probe.itemId); cleanedUp = true; }
      catch (e) { /* leave it; surfaced via cleanedUp */ }
    }
    return { success: true, sentFillColor: '#8fd14f', ...probe, cleanedUp };
  } catch (err) {
    return { success: false, error: err.message };
  }
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

// ColumnRef silently resolves an unknown row property to 0 (see evaluateAST above) —
// that's the right behavior for a column that legitimately exists but is blank on
// this row, but it also means a typo'd or renamed {Column} reference mislabels an
// entire inventory with no error. Walk the AST once per formula, up front, and
// compare every referenced name against the real headers (plus other computed
// column names, since columns can reference each other) before any row is evaluated.
function collectColumnRefs(ast, refs) {
  if (!ast) return refs;
  switch (ast.type) {
    case 'ColumnRef': refs.add(ast.name); break;
    case 'BinaryOp': collectColumnRefs(ast.left, refs); collectColumnRefs(ast.right, refs); break;
    case 'FunctionCall': ast.args.forEach(a => collectColumnRefs(a, refs)); break;
    case 'Classify': collectColumnRefs(ast.valueExpr, refs); break;
  }
  return refs;
}

function evaluateComputedColumns(definitions, rows, headers) {
  const knownNames = headers ? new Set([...headers, ...definitions.map(d => d.name)]) : null;

  // Parse all formulas up front
  const parsed = definitions.map(def => {
    try {
      const ast = parseFormulaExpr(def.formula);
      if (knownNames) {
        const unknown = [...collectColumnRefs(ast, new Set())].filter(name => !knownNames.has(name));
        if (unknown.length > 0) {
          return { name: def.name, ast: null, error: `Unknown column reference: {${unknown.join('}, {')}}` };
        }
      }
      return { name: def.name, ast, error: null };
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

// ─── Claude API ───────────────────────────────────────────────────────────────
// Raw HTTPS rather than @anthropic-ai/sdk: this is the only Claude call surface
// in the app and adding an npm dependency to a signed/notarized universal build
// costs more than the two dozen lines below. Every request goes through
// callClaudeMessages() so the model, headers, and error shape stay in one place.

/** Models offered wherever the app calls Claude. `effort` marks the ones that
 *  accept `output_config.effort` — Haiku 4.5 rejects it, so the request shape
 *  is per-model and the renderer's picker reads this list rather than
 *  hard-coding a second copy of it. */
const CLAUDE_MODELS = [
  { id: 'claude-opus-5',    label: 'Claude Opus 5',    hint: 'Most capable — best judgement on thin metadata', effort: true },
  { id: 'claude-sonnet-5',  label: 'Claude Sonnet 5',  hint: 'Near-Opus quality, roughly half the cost',        effort: true },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hint: 'Fastest and cheapest — for very large crawls',    effort: false }
];
const DEFAULT_CLAUDE_MODEL = 'claude-opus-5';

ipcMain.handle('get-claude-models', () => CLAUDE_MODELS.map(m => ({ ...m })));

/**
 * One request to the Messages API.
 *
 * `schema` (a JSON Schema) turns on structured outputs, which is what makes the
 * batch audience path trustworthy: the model cannot return an audience name that
 * isn't in the project's library, because the schema constrains it to an enum.
 * Without it we'd be regex-stripping fences off free text and hoping.
 */
async function callClaudeMessages({ apiKey, model, system, prompt, schema, maxTokens = 4096, effort }) {
  const chosen = CLAUDE_MODELS.find(m => m.id === model) || CLAUDE_MODELS.find(m => m.id === DEFAULT_CLAUDE_MODEL);
  const body = {
    model: chosen.id,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  };
  if (system) body.system = system;
  const outputConfig = {};
  if (schema) outputConfig.format = { type: 'json_schema', schema };
  if (effort && chosen.effort) outputConfig.effort = effort;
  if (Object.keys(outputConfig).length) body.output_config = outputConfig;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errText = await response.text();
    let msg = errText;
    try { msg = JSON.parse(errText)?.error?.message || errText; } catch (_) { /* keep raw */ }
    const err = new Error(`API error ${response.status}: ${msg}`);
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  // Safety classifiers can decline with a 200 and an empty content array — read
  // stop_reason before indexing into content, or this looks like a parse failure.
  if (data.stop_reason === 'refusal') {
    const err = new Error('Claude declined this request' + (data.stop_details?.category ? ` (${data.stop_details.category})` : ''));
    err.refusal = true;
    throw err;
  }
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return { text, usage: data.usage || null, stopReason: data.stop_reason };
}

ipcMain.handle('assess-row-llm', async (event, { row, rubrics, apiKey, model }) => {
  try {
    const { text } = await callClaudeMessages({
      apiKey,
      model: model || DEFAULT_CLAUDE_MODEL,
      prompt: buildLLMPrompt(row, rubrics),
      maxTokens: 2048,
      effort: 'low'
    });
    return parseLLMResponse(text);
  } catch (e) {
    return { error: e.message };
  }
});

/**
 * Batch audience suggestion.
 *
 * Batched by design: one page per request is what makes AI triage unusable at
 * crawl scale (the rubric path's ~1s/row is an hour for 3,600 pages). Twenty
 * pages share one prompt — the audience library, which is the bulk of the
 * tokens, is sent once instead of twenty times.
 *
 * `pages` = [{ ref, url, title, h1, meta, section }]; `ref` is opaque to main
 * and comes back on each result so the renderer can map answers to rows without
 * relying on array order.
 */
ipcMain.handle('suggest-audiences-llm', async (event, { pages, audiences, jobs, apiKey, model }) => {
  try {
    const names = (audiences || []).map(a => a.name).filter(Boolean);
    if (!names.length) return { error: 'No audiences defined for this project' };
    const jobNames = (jobs || []).map(j => j.job).filter(Boolean);

    const schema = {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ref:        { type: 'string' },
              // Enum-constrained: the model physically cannot invent an audience
              // that isn't in this project's library.
              audiences:  { type: 'array', items: { type: 'string', enum: names } },
              primary:    { type: 'string', enum: ['', ...names] },
              jobs:       { type: 'array', items: { type: 'string', enum: jobNames.length ? jobNames : [''] } },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              reasoning:  { type: 'string' }
            },
            required: ['ref', 'audiences', 'primary', 'jobs', 'confidence', 'reasoning'],
            additionalProperties: false
          }
        }
      },
      required: ['results'],
      additionalProperties: false
    };

    const { text, usage } = await callClaudeMessages({
      apiKey,
      model: model || DEFAULT_CLAUDE_MODEL,
      system: buildAudienceSystemPrompt(audiences, jobs),
      prompt: buildAudienceBatchPrompt(pages),
      schema,
      effort: 'low',
      maxTokens: Math.min(16000, 500 * (pages || []).length + 2000)
    });

    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { return { error: 'Could not parse the response as JSON' }; }
    return { results: Array.isArray(parsed.results) ? parsed.results : [], usage };
  } catch (e) {
    return { error: e.message };
  }
});

function buildAudienceSystemPrompt(audiences, jobs) {
  let s = 'You are a content strategist tagging pages from a website audit with the audiences they serve.\n\n';
  s += 'This project ranks its audiences into tiers from a prioritization workshop. Use the tiers as context for '
     + 'who matters, but tag based on who a page ACTUALLY serves, not who the client wishes read it.\n\n';
  s += '## Audiences\n';
  (audiences || []).forEach(a => {
    s += `- **${a.name}** (${a.tier || 'Secondary'})${a.description ? ` — ${a.description}` : ''}\n`;
  });
  if ((jobs || []).length) {
    s += '\n## Jobs to be done\n';
    jobs.forEach(j => { s += `- **${j.job}**${j.statement ? ` — ${j.statement}` : ''}\n`; });
  }
  s += `
## Rules
- Tag only audiences the page does real work for. Two or three is typical; tagging everything is the same as tagging nothing.
- Set "primary" to the single audience the page is mainly for, or "" if it genuinely serves several equally.
- Every audience in "primary" must also appear in "audiences".
- Use the reserved audience "— None (no target audience)" ONLY when the page serves no listed audience at all
  (internal tooling, legal boilerplate, an empty landing page). It is mutually exclusive with every other audience.
- If the metadata is too thin to judge, return an empty "audiences" array and set confidence to "low". An honest
  abstention is more useful than a guess — a human reviews every one of these.
- "reasoning" is one short sentence, written for the auditor reviewing your call.`;
  if (!(jobs || []).length) s += '\n- Return an empty "jobs" array — this project has no jobs library.';
  return s;
}

function buildAudienceBatchPrompt(pages) {
  let p = 'Tag each of these pages. Return one result per page, using the ref given.\n\n';
  (pages || []).forEach(pg => {
    p += `### ref: ${pg.ref}\n`;
    if (pg.url)     p += `URL: ${pg.url}\n`;
    if (pg.section) p += `Site section: ${pg.section}\n`;
    if (pg.title)   p += `Title: ${pg.title}\n`;
    if (pg.h1)      p += `H1: ${pg.h1}\n`;
    if (pg.meta)    p += `Meta description: ${pg.meta}\n`;
    if (pg.type)    p += `Content type: ${pg.type}\n`;
    p += '\n';
  });
  return p;
}

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

ipcMain.handle('save-text-file', async (event, { content, defaultName, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Results',
    defaultPath: defaultName || 'results.txt',
    filters: Array.isArray(filters) && filters.length ? filters : [{ name: 'Text', extensions: ['txt'] }, { name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled) return { success: false };
  try {
    fs.writeFileSync(result.filePath, content, 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Loading generated HTML (sitemap / treemap / Content Flow / reports) ──────
// These pages used to be loaded as `data:` URLs. Chromium refuses any URL over
// 2 MB, and a data: URL percent-encodes its content (~1.6x), so a large
// diagram simply never loaded: a large Visual Sitemap can be ~2 MB of
// HTML, 3.2 MB encoded, and opened as a blank modal with no toolbar. Anything
// past the threshold now goes through a temp file instead; smaller pages keep
// the data: URL they always had.
const VIEW_DATA_URL_MAX = 1.5 * 1024 * 1024;
const VIEW_TMP_DIR = path.join(app.getPath('temp'), 'transmission-views');
function stageViewHtml(html) {
  fs.mkdirSync(VIEW_TMP_DIR, { recursive: true });
  const file = path.join(VIEW_TMP_DIR, `view-${Date.now()}-${require('crypto').randomBytes(4).toString('hex')}.html`);
  fs.writeFileSync(file, html, 'utf8');
  return file;
}
function loadHtmlIntoWindow(win, html) {
  const enc = encodeURIComponent(html);
  if (enc.length <= VIEW_DATA_URL_MAX) return win.loadURL('data:text/html;charset=utf-8,' + enc);
  return win.loadFile(stageViewHtml(html));
}
function clearStagedViews() {
  try { fs.rmSync(VIEW_TMP_DIR, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}
// The renderer's <webview>s hit the same limit — it asks for a file:// URL.
ipcMain.handle('stage-view-html', (event, html) => {
  return require('url').pathToFileURL(stageViewHtml(String(html || ''))).href;
});

ipcMain.handle('export-progress-pdf', async (event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Progress Report',
    defaultPath: defaultName || 'audit-progress.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  // 'Cancelled' is the sentinel every caller checks to stay quiet on cancel —
  // without it they report "Export failed: undefined".
  if (result.canceled) return { success: false, error: 'Cancelled' };
  let win = null;
  try {
    win = new BrowserWindow({ show: false, width: 800, height: 600 });
    await loadHtmlIntoWindow(win, html);
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
    });
    fs.writeFileSync(result.filePath, pdfData);
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    // Close on every path: a loadURL/printToPDF rejection used to skip the
    // close and strand the window + its renderer process for the session.
    if (win) { try { win.close(); } catch (_) {} }
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

ipcMain.handle('evaluate-computed-columns', (event, { definitions, rows, headers }) => {
  try {
    return evaluateComputedColumns(definitions, rows, headers);
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

/** One CSV per source site. Each retiring domain is deployed as its own redirect
 *  configuration, so a consolidation hand-off wants N files, not one merged list
 *  the implementer has to split. Mirrors `sme-export-multi`: pick a folder once,
 *  write every file into it. */
ipcMain.handle('export-redirects-multi', async (event, { files }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose folder for redirect map files',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths.length) return { success: false, error: 'Cancelled' };
  const dir = result.filePaths[0];
  try {
    const headers = ['Source URL', 'Destination URL', 'Status Code', 'Reason'];
    let total = 0;
    for (const file of files) {
      const csv = [headers.join(',')].concat(file.rows.map(row =>
        headers.map(h => {
          const val = String(row[h] || '');
          return /[",\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val;
        }).join(',')
      )).join('\n');
      fs.writeFileSync(path.join(dir, file.fileName), csv, 'utf8');
      total += file.rows.length;
    }
    return { success: true, dir, files: files.length, count: total };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Phase 2, Chunk ε: Migration Tracker Export.
// Renderer builds an array of `{ name, aoa }` sheets (aoa = array-of-arrays in SheetJS shape).
// Main writes them to xlsx and returns the path. No formula evaluation needed; this is a
// pure data deliverable for engineering.
ipcMain.handle('export-migration-tracker', async (event, { defaultName, sheets, title }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: title || 'Export Migration Tracker',
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

/** Build an SME-review .xlsx as a buffer: styled header, data rows, tuned column
 *  widths, a frozen header row, and a data-validation dropdown on the SME Decision
 *  column. Shared by both SME export handlers — they were near-verbatim copies of
 *  this ~45-line ExcelJS+JSZip build and had already drifted apart (the split-by-
 *  owner copy carried terser validation error strings), which is exactly the way a
 *  fix to one silently misses the other. */
async function buildSmeWorkbookBuffer({ headers, rows, smeOptions, smeDecisionCol }) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('SME Review');

  // Header row
  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

  // Data rows
  rows.forEach(row => ws.addRow(headers.map(h => row[h] ?? '')));

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
      xml = xml.replace(/<formula1>(.*?)<\/formula1>/g, (match, inner) =>
        '<formula1>' + inner.replace(/&quot;/g, '"') + '</formula1>');
      zip.file(name, xml);
    }
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

ipcMain.handle('sme-export', async (event, { headers, rows, defaultName, smeOptions, smeDecisionCol }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export for SME Review',
    defaultPath: defaultName || 'sme-review.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    const fixedBuf = await buildSmeWorkbookBuffer({ headers, rows, smeOptions, smeDecisionCol });
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
    const written = [];
    for (const file of files) {
      // Same builder as the single-file export — each split gets an identical workbook.
      const fixedBuf = await buildSmeWorkbookBuffer(file);
      const filePath = path.join(dir, file.fileName);
      fs.writeFileSync(filePath, fixedBuf);
      written.push(filePath);
    }
    return { success: true, count: written.length, dir };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Visual Sitemap → PDF. The renderer builds a complete, self-contained sitemap
// HTML (print mode) via SitemapTemplate; here we load it in a hidden window and
// print it to a single dynamically-sized page. The engine sizes the page to the
// laid-out canvas via an injected `@page { size: ... }` rule and flips
// document.title to 'READY' once layout settles, so we wait on that rather than
// a fixed timeout.
ipcMain.handle('export-sitemap-pdf', async (event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Sitemap as PDF',
    defaultPath: defaultName || 'sitemap.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  let win = null;
  try {
    win = new BrowserWindow({ show: false, width: 2000, height: 1400, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    await loadHtmlIntoWindow(win, html);
    // Wait for the engine to finish layout (document.title -> 'READY'), capped.
    await new Promise((resolve) => {
      let waited = 0;
      const tick = async () => {
        try {
          const t = await win.webContents.executeJavaScript('document.title');
          if (t === 'READY' || waited >= 6000) return resolve();
        } catch (_) { return resolve(); }
        waited += 120;
        setTimeout(tick, 120);
      };
      tick();
    });
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,   // honor the engine's injected @page size
      margins: { marginType: 'none' }
    });
    fs.writeFileSync(result.filePath, pdfData);
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    if (win) { try { win.close(); } catch (_) {} }
  }
});

// Raster export for the three visualization engines. Same hidden-window +
// print-mode-HTML trick as export-sitemap-pdf, but screenshotted rather than
// printed — for dropping a diagram into a deck or a doc that can't place a PDF.
//
// Two things make this work on a diagram much larger than the screen:
//   • The window is sized to the document's own content box, which each engine
//     publishes as window.__EXPORT_SIZE__ once it has laid out (the same moment
//     it flips document.title to 'READY').
//   • The OS may refuse a window that big. We read the size back and, if it was
//     clamped, shrink the zoom factor until the whole diagram fits what we
//     actually got — a smaller PNG beats a cropped one.
// A 2× zoom is used where it fits, so text stays crisp at normal viewing size.
const PNG_MAX_EDGE = 9000;        // hard ceiling per side; ~all real sitemaps fit
ipcMain.handle('export-viz-png', async (event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as PNG',
    defaultPath: defaultName || 'diagram.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  let win = null;
  try {
    win = new BrowserWindow({
      show: false, width: 1400, height: 900, useContentSize: true,
      paintWhenInitiallyHidden: true,   // default, but load-bearing here: a hidden window that never paints captures blank
      webPreferences: { nodeIntegration: false, contextIsolation: true, offscreen: false },
    });
    await loadHtmlIntoWindow(win, html);
    await new Promise((resolve) => {
      let waited = 0;
      const tick = async () => {
        try {
          const t = await win.webContents.executeJavaScript('document.title');
          if (t === 'READY' || waited >= 6000) return resolve();
        } catch (_) { return resolve(); }
        waited += 120;
        setTimeout(tick, 120);
      };
      tick();
    });

    const size = await win.webContents.executeJavaScript(
      '(window.__EXPORT_SIZE__ || {w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight})'
    );
    const cw = Math.max(1, Math.ceil(size.w || 1));
    const ch = Math.max(1, Math.ceil(size.h || 1));

    let zoom = Math.min(2, PNG_MAX_EDGE / cw, PNG_MAX_EDGE / ch);
    if (!(zoom > 0)) zoom = 1;
    zoom = Math.max(0.15, zoom);

    const applySize = async (z) => {
      win.webContents.setZoomFactor(z);
      const w = Math.max(1, Math.ceil(cw * z)), h = Math.max(1, Math.ceil(ch * z));
      win.setContentSize(w, h);
      await new Promise(r => setTimeout(r, 220));   // let the relayout land
      return { want: [w, h], got: win.getContentSize() };
    };

    let { want, got } = await applySize(zoom);
    if (got[0] < want[0] - 1 || got[1] < want[1] - 1) {
      // The OS clamped the window. Re-fit the whole diagram into what it gave us.
      const adj = Math.min(got[0] / want[0], got[1] / want[1]);
      if (adj > 0 && adj < 1) await applySize(Math.max(0.05, zoom * adj));
    }

    const image = await win.webContents.capturePage();
    if (image.isEmpty()) return { success: false, error: 'Nothing was captured' };
    fs.writeFileSync(result.filePath, image.toPNG());
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    if (win) { try { win.close(); } catch (_) {} }
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
    title: 'Export Sitemap',
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
    XLSX.utils.book_append_sheet(wb, ws, 'Sitemap');
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

// ─── Sitemap IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('load-nav-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Sitemap Structure',
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm', 'ods'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const wb = XLSX.readFile(result.filePaths[0], { type: 'file', cellDates: true });
      const navSheetName = wb.SheetNames.find(s => ['navstructure', 'sitemap'].includes(s.toLowerCase()));
      if (!navSheetName) {
        dialog.showErrorBox('No Sitemap Sheet', 'The selected file does not contain a sheet named "Sitemap".');
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

// Force every <webview> to report prefers-color-scheme: light to the page it
// loads, so a crawled site renders as designed regardless of the app's theme
// or the OS appearance. The app chrome's own dark mode is pure CSS (data-theme)
// and never touches webview contents; this covers sites that self-switch to a
// dark theme when the OS is dark — the exact case that sent auditors to an
// external browser. Applied via CDP Emulation, re-asserted on each navigation.
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() !== 'webview') return;
  const forceLight = () => {
    try {
      if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
      contents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: 'light' }]
      }).catch(() => {});
    } catch (e) { /* debugger may be unavailable; non-fatal */ }
  };
  contents.on('dom-ready', forceLight);
  contents.on('did-navigate', forceLight);
  contents.on('did-navigate-in-page', forceLight);
});

app.whenReady().then(() => {
  clearStagedViews();   // left behind by a crash or force-quit
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Silent startup update check — only interrupt the user if there's actually
  // something new; network hiccups here should never surface an error dialog.
  setTimeout(() => {
    performUpdateCheck()
      .then(result => {
        if (result.available && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-check-result', result);
        }
      })
      .catch(() => { /* silent */ });
  }, 3000);
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
  clearStagedViews();   // generated diagram pages; a stale one is never reopened
});
