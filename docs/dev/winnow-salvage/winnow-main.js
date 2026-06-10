const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard, webContents, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const DataStore = require('./src/datastore');
const ImportService = require('./src/import-service');
const ExportService = require('./src/export-service');
const CrawlEngine = require('./src/crawl-engine');
const GA4Service = require('./src/ga4-service');
const AIService = require('./src/ai-service');
const BrowserPool = require('./src/browser-pool');

// ─── State ────────────────────────────────────────────────────────────────────

let mainWindow = null;
let helpWindow = null;
const store = new DataStore();
let activeCrawl = null; // current CrawlEngine instance
let ga4Service = null;  // GA4 service instance
let browserPool = null; // BrowserPool for screenshots

const userDataPath = app.getPath('userData');
const prefsPath    = path.join(userDataPath, 'prefs.json');

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_VISIBLE_FIELDS = [
  'title', 'status_code', 'indexable', 'redirect_url'
];

const DEFAULT_TAG_LIBRARY = [
  'thin-content', 'outdated', 'evergreen', 'duplicate', 'near-duplicate', 'high-quality',
  'high-traffic', 'low-traffic', 'revenue-driver', 'brand-critical', 'orphaned',
  'blog-post', 'landing-page', 'product-page', 'resource', 'news', 'archive',
  'needs-rewrite', 'needs-merge', 'needs-redirect', 'needs-review', 'quick-win'
];

// ─── Preferences ─────────────────────────────────────────────────────────────

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

function buildMenu() {
  const template = [
    {
      label: 'Winnow',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project…',
          accelerator: 'CmdOrCtrl+N',
          click: () => newProject()
        },
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: () => openProject()
        },
        { type: 'separator' },
        {
          label: 'Import Spreadsheet…',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => importSpreadsheet()
        },
        {
          label: 'Export to Spreadsheet…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow?.webContents.send('menu-export')
        },
        { type: 'separator' },
        {
          label: 'Start Crawl…',
          click: () => mainWindow?.webContents.send('menu-crawl')
        },
        { type: 'separator' },
        {
          label: 'Import/Merge Audit Decisions…',
          click: () => mainWindow?.webContents.send('menu-import-merge')
        },
        { type: 'separator' },
        {
          label: 'Project Settings…',
          click: () => mainWindow?.webContents.send('menu-project-settings')
        },
        {
          label: 'App Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('menu-settings')
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Table View',
          accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow?.webContents.send('menu-table-view')
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Reports',
      submenu: [
        {
          label: 'Audit Progress…',
          click: () => mainWindow?.webContents.send('menu-progress')
        },
        { type: 'separator' },
        {
          label: 'Export Filtered Rows…',
          click: () => mainWindow?.webContents.send('menu-export-filtered')
        },
        {
          label: 'Export Audit Decisions (CSV/JSON)…',
          click: () => mainWindow?.webContents.send('menu-export-audit')
        },
        {
          label: 'Export Redirect Map (CSV)…',
          click: () => mainWindow?.webContents.send('menu-export-redirects')
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Winnow Help',
          click: () => openHelpWindow()
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Project operations ───────────────────────────────────────────────────────

async function newProject() {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'New Winnow Project',
    defaultPath: 'project.winnow',
    filters: [{ name: 'Winnow Project', extensions: ['winnow'] }]
  });
  if (result.canceled) return;

  try {
    store.create(result.filePath);
    savePrefs({ lastFile: result.filePath });
    updateTitle();
    mainWindow?.webContents.send('project-opened', {
      filePath: result.filePath,
      isNew: true,
      pageCount: 0
    });
  } catch (err) {
    dialog.showErrorBox('Error', `Could not create project:\n\n${err.message}`);
  }
}

async function openProject() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    filters: [
      { name: 'Winnow Project', extensions: ['winnow'] },
      { name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return;

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.winnow') {
    openWinnowFile(filePath);
  } else {
    // Spreadsheet: import into a new .winnow file
    const winnowPath = filePath.replace(/\.[^.]+$/, '.winnow');
    try {
      store.create(winnowPath);
      const result = ImportService.importFile(store, filePath);
      savePrefs({ lastFile: winnowPath });
      updateTitle();
      mainWindow?.webContents.send('project-opened', {
        filePath: winnowPath,
        importedFrom: filePath,
        isNew: false,
        pageCount: result.rowCount,
        hasNav: result.hasNav,
        projectSettings: result.projectSettings
      });
    } catch (err) {
      dialog.showErrorBox('Error', `Could not import file:\n\n${err.message}`);
    }
  }
}

function openWinnowFile(filePath) {
  try {
    store.open(filePath);
    savePrefs({ lastFile: filePath });
    updateTitle();
    const pageCount = store.getPageCount();
    const settings = store.getSettings();
    const navNodes = store.getNavNodes();
    mainWindow?.webContents.send('project-opened', {
      filePath,
      isNew: false,
      pageCount,
      hasNav: navNodes.length > 0,
      projectSettings: settings
    });
  } catch (err) {
    dialog.showErrorBox('Error', `Could not open project:\n\n${err.message}`);
  }
}

async function importSpreadsheet() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Spreadsheet',
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm', 'ods', 'csv'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return;

  const xlsxPath = result.filePaths[0];

  if (!store.isOpen) {
    // Create a new project alongside the spreadsheet
    const winnowPath = xlsxPath.replace(/\.[^.]+$/, '.winnow');
    store.create(winnowPath);
    savePrefs({ lastFile: winnowPath });
  }

  try {
    const importResult = ImportService.importFile(store, xlsxPath);
    updateTitle();
    mainWindow?.webContents.send('import-complete', {
      filePath: xlsxPath,
      rowCount: importResult.rowCount,
      hasNav: importResult.hasNav,
      projectSettings: importResult.projectSettings
    });
  } catch (err) {
    dialog.showErrorBox('Import Error', err.message);
  }
}

function updateTitle() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const name = store.filePath ? path.basename(store.filePath, '.winnow') : 'Winnow';
  mainWindow.setTitle(`Winnow — ${name}`);
}

// ─── Help window ──────────────────────────────────────────────────────────────

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
    title: 'Winnow — Help',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  helpWindow.loadFile(path.join(__dirname, 'src', 'help.html'));
  helpWindow.on('closed', () => { helpWindow = null; });
}

// ─── IPC: Project lifecycle ───────────────────────────────────────────────────

ipcMain.handle('new-project', async () => { await newProject(); });
ipcMain.handle('open-project', async () => { await openProject(); });
ipcMain.handle('import-spreadsheet', async () => { await importSpreadsheet(); });

ipcMain.handle('get-last-project', async () => {
  const prefs = loadPrefs();
  if (prefs.lastFile && fs.existsSync(prefs.lastFile)) {
    const ext = path.extname(prefs.lastFile).toLowerCase();
    if (ext === '.winnow') {
      try {
        store.open(prefs.lastFile);
        updateTitle();
        const pageCount = store.getPageCount();
        const settings = store.getSettings();
        const navNodes = store.getNavNodes();
        return {
          filePath: prefs.lastFile,
          isNew: false,
          pageCount,
          hasNav: navNodes.length > 0,
          projectSettings: settings
        };
      } catch (e) { return null; }
    }
  }
  return null;
});

ipcMain.handle('get-project-path', () => store.filePath);

// ─── IPC: Page data (SQLite-backed) ──────────────────────────────────────────

ipcMain.handle('get-pages', (event, opts) => {
  if (!store.isOpen) return { rows: [], totalCount: 0, filteredCount: 0 };
  return store.getPages(opts);
});

ipcMain.handle('get-page', (event, url) => {
  if (!store.isOpen) return null;
  return store.getPage(url);
});

ipcMain.handle('update-page', (event, { url, updates }) => {
  if (!store.isOpen) return { success: false };
  store.updatePage(url, updates);
  return { success: true };
});

ipcMain.handle('bulk-update-field', (event, { urls, field, value }) => {
  if (!store.isOpen) return { success: false };
  store.bulkUpdateField(urls, field, value);
  return { success: true };
});

ipcMain.handle('get-columns', () => {
  if (!store.isOpen) return [];
  return store.getColumns();
});

ipcMain.handle('get-extra-field-names', () => {
  if (!store.isOpen) return [];
  return store.getExtraFieldNames();
});

ipcMain.handle('get-distinct-values', (event, field) => {
  if (!store.isOpen) return [];
  return store.getDistinctValues(field);
});

ipcMain.handle('get-kke-summary', () => {
  if (!store.isOpen) return [];
  return store.getKkeSummary();
});

ipcMain.handle('get-group-summary', () => {
  if (!store.isOpen) return [];
  return store.getGroupSummary();
});

ipcMain.handle('get-page-count', () => {
  if (!store.isOpen) return 0;
  return store.getPageCount();
});

// ─── IPC: Nav nodes ───────────────────────────────────────────────────────────

ipcMain.handle('get-nav-tree', () => {
  if (!store.isOpen) return { roots: [], nodes: [] };
  return store.getNavTree();
});

ipcMain.handle('get-nav-nodes', () => {
  if (!store.isOpen) return [];
  return store.getNavNodes();
});

ipcMain.handle('set-nav-nodes', (event, nodes) => {
  if (!store.isOpen) return { success: false };
  store.setNavNodes(nodes);
  return { success: true };
});

// ─── IPC: Settings (project-level) ───────────────────────────────────────────

ipcMain.handle('get-project-settings', () => {
  if (!store.isOpen) return {};
  return store.getSettings();
});

ipcMain.handle('set-project-settings', (event, settings) => {
  if (!store.isOpen) return { success: false };
  store.setSettings(settings);
  return { success: true };
});

ipcMain.handle('set-project-setting', (event, { key, value }) => {
  if (!store.isOpen) return { success: false };
  store.setSetting(key, value);
  return { success: true };
});

// ─── IPC: Computed columns ────────────────────────────────────────────────────

ipcMain.handle('get-computed-columns', () => {
  if (!store.isOpen) return [];
  return store.getComputedColumns();
});

ipcMain.handle('set-computed-columns', (event, definitions) => {
  if (!store.isOpen) return { success: false };
  store.setComputedColumns(definitions);
  return { success: true };
});

ipcMain.handle('evaluate-computed-columns', (event, { definitions, rows }) => {
  try {
    return evaluateComputedColumns(definitions, rows);
  } catch (e) {
    return { results: [], errors: [e.message] };
  }
});

// ─── IPC: Export ──────────────────────────────────────────────────────────────

ipcMain.handle('export-xlsx', async (event, { filters } = {}) => {
  if (!store.isOpen) return { success: false, error: 'No project open' };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export to Spreadsheet',
    defaultPath: path.basename(store.filePath, '.winnow') + '.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  return ExportService.exportFull(store, result.filePath, { filters });
});

ipcMain.handle('export-filtered', async (event, { filterOpts }) => {
  if (!store.isOpen) return { success: false, error: 'No project open' };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Filtered Rows',
    defaultPath: 'filtered-export.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  const extraFields = store.getExtraFieldNames();
  return ExportService.exportFiltered(store, result.filePath, filterOpts, extraFields);
});

ipcMain.handle('export-audit-csv', async (event, { format }) => {
  if (!store.isOpen) return { success: false, error: 'No project open' };
  const ext = format === 'json' ? 'json' : 'csv';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Audit Decisions',
    defaultPath: `audit-decisions.${ext}`,
    filters: format === 'json'
      ? [{ name: 'JSON', extensions: ['json'] }]
      : [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  return ExportService.exportAuditDecisions(store, result.filePath, format);
});

ipcMain.handle('export-redirects', async () => {
  if (!store.isOpen) return { success: false, error: 'No project open' };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Redirect Map',
    defaultPath: 'redirect-map.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  return ExportService.exportRedirects(store, result.filePath);
});

ipcMain.handle('export-nav-tree', async (event, { format, rows, maxDepth }) => {
  const defaultName = format === 'indented' ? 'nav-tree-indented.xlsx' : 'nav-tree-flat.xlsx';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Navigation Tree',
    defaultPath: defaultName,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled) return { success: false, error: 'Cancelled' };
  try {
    let aoa;
    if (format === 'indented') {
      const headers = ['Number'];
      for (let i = 1; i <= maxDepth; i++) headers.push('Level ' + i);
      aoa = [headers];
      for (const row of rows) {
        const r = new Array(maxDepth + 1).fill('');
        r[0] = row.number;
        r[row.depth + 1] = row.label;
        aoa.push(r);
      }
    } else {
      aoa = [['Number', 'Label', 'Path', 'Breadcrumb', 'Reference To']];
      for (const row of rows) {
        aoa.push([row.number, row.label, row.computedPath, row.breadcrumb, row.refTo || '']);
      }
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'Navigation');
    XLSX.writeFile(wb, result.filePath);
    return { success: true, filePath: result.filePath, count: rows.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── IPC: Crawler ─────────────────────────────────────────────────────────────

ipcMain.handle('start-crawl', async (event, opts) => {
  if (!store.isOpen) return { success: false, error: 'No project open' };
  if (activeCrawl) return { success: false, error: 'Crawl already in progress' };

  try {
    console.log('[crawl] Starting with opts:', JSON.stringify({ seeds: opts.seeds, concurrency: opts.concurrency, maxPages: opts.maxPages, sitemapMode: opts.sitemapMode, respectRobots: opts.respectRobots }));

    activeCrawl = new CrawlEngine({
      store,
      seeds: opts.seeds || [],
      concurrency: opts.concurrency || 5,
      maxDepth: opts.maxDepth || 50,
      maxPages: opts.maxPages || 150000,
      exclusions: opts.exclusions || [],
      sitemapMode: opts.sitemapMode || 'auto',
      respectRobots: opts.respectRobots !== false,
      userAgent: opts.userAgent || 'chrome-desktop',
      rejectUnauthorized: opts.rejectUnauthorized !== false,
      strictScope: opts.strictScope || false,
      queryStringMode: opts.queryStringMode || 'exclude',
      timeoutMs: opts.timeoutMs || 15000,
      onProgress: (progress) => {
        mainWindow?.webContents.send('crawl-progress', progress);
      },
      onPageCrawled: (page) => {
        console.log('[crawl] Page:', page.url, 'status:', page.status_code);
        mainWindow?.webContents.send('crawl-page', { url: page.url, status: page.status_code });
      },
      onSitemap: (info) => {
        mainWindow?.webContents.send('crawl-sitemap', info);
      },
      onError: (err) => {
        console.log('[crawl] Error:', err.url, err.error);
        mainWindow?.webContents.send('crawl-error', err);
      }
    });

    store._recordHistory('crawl_start', opts.seeds[0], 0);
    store.addCrawlLog('info', opts.seeds[0], 'Crawl started — seeds: ' + opts.seeds.join(', '));

    // Run crawl (non-blocking from IPC perspective)
    activeCrawl.start().then((result) => {
      console.log('[crawl] Complete:', JSON.stringify(result));
      console.log('[crawl] DB page count:', store.getPageCount());
      store.addCrawlLog('info', null, `Crawl complete: ${result.crawled} pages, ${result.errors} errors, ${Math.round(result.elapsed / 1000)}s`);
      activeCrawl = null;
      mainWindow?.webContents.send('crawl-complete', result);
    }).catch((err) => {
      console.error('[crawl] Fatal error:', err.message, err.stack);
      store.addCrawlLog('error', null, 'Crawl failed: ' + err.message);
      activeCrawl = null;
      mainWindow?.webContents.send('crawl-complete', { error: err.message });
    });

    return { success: true };
  } catch (err) {
    activeCrawl = null;
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pause-crawl', () => {
  if (activeCrawl) { activeCrawl.pause(); return { success: true }; }
  return { success: false };
});

ipcMain.handle('resume-crawl', () => {
  if (activeCrawl) { activeCrawl.resume(); return { success: true }; }
  return { success: false };
});

ipcMain.handle('stop-crawl', () => {
  if (activeCrawl) { activeCrawl.stop(); return { success: true }; }
  return { success: false };
});

ipcMain.handle('get-crawl-status', () => {
  return { active: !!activeCrawl };
});

ipcMain.handle('get-crawl-log', (event, limit) => {
  if (!store.isOpen) return [];
  return store.getCrawlLog(limit || 500);
});

ipcMain.handle('clear-pages', async () => {
  if (!store.isOpen) return { success: false, error: 'No project open' };
  store.clearPages();
  return { success: true };
});

// ─── IPC: GA4 ─────────────────────────────────────────────────────────────────

function _getGA4Service() {
  if (!ga4Service) {
    const prefs = loadPrefs();
    ga4Service = new GA4Service({
      userDataPath,
      clientId: prefs.ga4ClientId || '',
      clientSecret: prefs.ga4ClientSecret || ''
    });
  }
  return ga4Service;
}

ipcMain.handle('ga4-authenticate', async () => {
  try {
    const svc = _getGA4Service();
    if (!svc.hasCredentials()) {
      return { success: false, error: 'Configure GA4 Client ID and Secret in App Settings first.' };
    }
    await svc.authenticate(mainWindow);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('ga4-list-properties', async () => {
  try {
    const svc = _getGA4Service();
    const properties = await svc.listProperties();
    return { success: true, properties };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('ga4-fetch-data', async (event, { propertyId, startDate, endDate }) => {
  if (!store.isOpen) return { success: false, error: 'No project open' };
  try {
    const svc = _getGA4Service();
    const result = await svc.fetchAndWriteData(store, propertyId, {
      startDate,
      endDate,
      onProgress: (progress) => {
        mainWindow?.webContents.send('ga4-progress', progress);
      }
    });
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('ga4-has-token', () => {
  const svc = _getGA4Service();
  return svc.hasToken();
});

ipcMain.handle('ga4-clear-token', () => {
  const svc = _getGA4Service();
  svc.clearToken();
  return { success: true };
});

ipcMain.handle('ga4-save-credentials', (event, { clientId, clientSecret }) => {
  savePrefs({ ga4ClientId: clientId, ga4ClientSecret: clientSecret });
  ga4Service = null; // force re-creation with new creds
  return { success: true };
});

// ─── IPC: BrowserPool screenshots ─────────────────────────────────────────────

ipcMain.handle('capture-page-screenshots', async (event, { urls }) => {
  if (!store.isOpen) return { success: false, error: 'No project open' };

  if (!browserPool) {
    browserPool = new BrowserPool({ poolSize: 2 });
  }

  // Screenshot directory alongside the .winnow file
  const screenshotDir = path.join(path.dirname(store.filePath), 'screenshots');

  const jobs = urls.map(url => {
    const safeName = url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100) + '.png';
    return { url, outputPath: path.join(screenshotDir, safeName) };
  });

  const result = await browserPool.captureMultiple(jobs, (progress) => {
    mainWindow?.webContents.send('screenshot-progress', progress);
  });

  // Write screenshot paths back to DataStore
  for (const r of result.results) {
    if (r.success) {
      store.updatePage(r.url, { screenshot_path: r.outputPath });
    }
  }

  return { success: true, completed: result.completed, errors: result.errors };
});

// ─── IPC: AI Assessment ───────────────────────────────────────────────────────

let activeAIAssessment = null;

ipcMain.handle('ai-assess-pages', async (event, { urls, mode, model }) => {
  if (!store.isOpen) return { success: false, error: 'No project open' };
  if (activeAIAssessment) return { success: false, error: 'Assessment already in progress' };

  const prefs = loadPrefs();
  const apiKey = prefs.claudeApiKey;
  if (!apiKey) return { success: false, error: 'Configure API key in App Settings' };

  // Load rubrics
  const rubricDir = prefs.rubricDir || getDefaultRubricDir();
  const rubrics = fs.existsSync(rubricDir) ? loadAllRubrics(rubricDir) : null;

  // Fetch pages
  const pages = urls.map(url => store.getPage(url)).filter(Boolean);
  if (pages.length === 0) return { success: false, error: 'No pages found' };

  activeAIAssessment = new AIService({
    apiKey,
    mode: mode || 'text',
    model: model || 'claude-sonnet-4-20250514',
    rubrics,
    onProgress: (progress) => {
      mainWindow?.webContents.send('ai-assess-progress', progress);
    },
    onResult: (result) => {
      mainWindow?.webContents.send('ai-assess-result', result);
    },
    onError: (err) => {
      mainWindow?.webContents.send('ai-assess-error', err);
    }
  });

  // Run async
  activeAIAssessment.assessPages(store, pages).then((result) => {
    activeAIAssessment = null;
    mainWindow?.webContents.send('ai-assess-complete', result);
  }).catch((err) => {
    activeAIAssessment = null;
    mainWindow?.webContents.send('ai-assess-complete', { error: err.message });
  });

  return { success: true, total: pages.length };
});

ipcMain.handle('ai-assess-stop', () => {
  if (activeAIAssessment) { activeAIAssessment.abort(); return { success: true }; }
  return { success: false };
});

// ─── IPC: Import/merge audit decisions ────────────────────────────────────────

ipcMain.handle('import-audit-merge', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Audit Decisions',
    filters: [{ name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  try {
    const wb = XLSX.readFile(result.filePaths[0], { type: 'file', raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    if (rawData.length < 2) return { error: 'No data rows' };
    const headers = rawData[0].map(String);
    const rows = rawData.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, j) => { obj[h] = row[j] ?? ''; });
      return obj;
    });
    return { headers, rows, filePath: result.filePaths[0] };
  } catch (e) {
    return { error: e.message };
  }
});

// ─── IPC: Preferences (app-level) ────────────────────────────────────────────

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
    customKkeStates: prefs.customKkeStates || []
  };
});

ipcMain.handle('save-prefs', (event, updates) => {
  savePrefs(updates);
  return { success: true };
});

// ─── IPC: Misc ────────────────────────────────────────────────────────────────

ipcMain.handle('open-external', async (event, url) => { await shell.openExternal(url); });
ipcMain.handle('open-help-window', () => { openHelpWindow(); });
ipcMain.handle('copy-to-clipboard', (event, text) => { clipboard.writeText(text); return true; });

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

ipcMain.handle('check-links', async (event, { urls }) => {
  const results = [];
  for (const url of urls.slice(0, 50)) {
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

    const info = await wc.executeJavaScript(`({
      vpH: window.innerHeight,
      fullH: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      dpr: window.devicePixelRatio || 1,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    })`);
    const { vpH, fullH, dpr } = info;

    const strips = [];
    for (let y = 0; y < fullH; y += vpH) {
      await wc.executeJavaScript(`window.scrollTo(0, ${y})`);
      await new Promise(r => setTimeout(r, 150));
      const img = await wc.capturePage();
      strips.push({ img, cssY: y });
    }
    await wc.executeJavaScript(`window.scrollTo(${info.scrollX}, ${info.scrollY})`);

    const firstSize = strips[0].img.getSize();
    const outW = firstSize.width;
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

// ─── Rubrics ──────────────────────────────────────────────────────────────────

function getDefaultRubricDir() {
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
      if (/^#\s+/.test(trimmed)) continue;

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
  const andParts = text.split(/\s+and\s+/i);
  if (andParts.length > 1) {
    return { type: 'compound', conditions: andParts.map(parseSingleCondition), raw: text };
  }
  return { type: 'single', ...parseSingleCondition(text), raw: text };
}

function parseSingleCondition(text) {
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
    const fieldPass = fieldResults.filter(r => r.pass).length;
    const fieldTotal = fieldResults.length;
    results[status] = {
      fieldResults,
      fieldScore: fieldTotal > 0 ? fieldPass / fieldTotal : 0,
      contentRules: rubric.contentRules
    };
  }

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
  let dir = prefs.rubricDir || getDefaultRubricDir();
  if (store.filePath) {
    const fileName = path.basename(store.filePath);
    const perFile = prefs.fileRubricDirs?.[fileName];
    if (perFile && fs.existsSync(perFile)) dir = perFile;
  }
  if (!fs.existsSync(dir)) return { rubrics: {}, dir };
  return { rubrics: loadAllRubrics(dir), dir };
});

ipcMain.handle('set-file-rubric-dir', async (event, { rubricDir }) => {
  if (!store.filePath) return { success: false };
  const prefs = loadPrefs();
  const fileName = path.basename(store.filePath);
  const dirs = prefs.fileRubricDirs || {};
  if (rubricDir) { dirs[fileName] = rubricDir; } else { delete dirs[fileName]; }
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
    if (key === '_rowIndex' || key === 'row_order' || !val) continue;
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

ipcMain.handle('evaluate-formula', (event, { formula, row }) => {
  try {
    const rule = parseFieldRule(formula);
    return { result: evaluateFieldRule(rule, row) };
  } catch (e) {
    return { result: false, error: e.message };
  }
});

// ─── Computed Columns: Tokenizer + Parser + Evaluator ──────────────────────

function tokenizeFormula(formula) {
  const tokens = [];
  let i = 0;
  while (i < formula.length) {
    if (/\s/.test(formula[i])) { i++; continue; }

    if (formula[i] === '{') {
      const end = formula.indexOf('}', i + 1);
      if (end === -1) throw new Error('Unclosed column reference {');
      tokens.push({ type: 'COL_REF', value: formula.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

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
      i++;
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    if (/[0-9]/.test(formula[i]) || (formula[i] === '.' && i + 1 < formula.length && /[0-9]/.test(formula[i + 1]))) {
      let num = '';
      while (i < formula.length && /[0-9.]/.test(formula[i])) { num += formula[i++]; }
      tokens.push({ type: 'NUMBER', value: parseFloat(num) });
      continue;
    }

    if (i + 1 < formula.length) {
      const two = formula.slice(i, i + 2);
      if (['>=', '<=', '==', '!='].includes(two)) {
        tokens.push({ type: 'OP', value: two });
        i += 2;
        continue;
      }
    }

    if ('+-*/%><'.includes(formula[i])) {
      tokens.push({ type: 'OP', value: formula[i] });
      i++;
      continue;
    }
    if (formula[i] === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (formula[i] === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (formula[i] === ',') { tokens.push({ type: 'COMMA' }); i++; continue; }
    if (formula[i] === ':') { tokens.push({ type: 'COLON' }); i++; continue; }

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

    if (t.type === 'NUMBER') { advance(); return { type: 'NumberLiteral', value: t.value }; }
    if (t.type === 'STRING') { advance(); return { type: 'StringLiteral', value: t.value }; }
    if (t.type === 'COL_REF') { advance(); return { type: 'ColumnRef', name: t.value }; }

    if (t.type === 'LPAREN') {
      advance();
      const expr = parseExpr();
      expect('RPAREN');
      return expr;
    }

    if (t.type === 'IDENT') {
      const name = advance().value.toLowerCase();
      if (name === 'classify') return parseClassify();
      expect('LPAREN');
      const args = [];
      if (peek().type !== 'RPAREN') {
        args.push(parseExpr());
        while (peek().type === 'COMMA') { advance(); args.push(parseExpr()); }
      }
      expect('RPAREN');
      return { type: 'FunctionCall', name, args };
    }

    throw new Error(`Unexpected token: ${t.type}${t.value ? ' (' + t.value + ')' : ''}`);
  }

  function parseClassify() {
    expect('LPAREN');
    const valueExpr = parseExpr();
    const thresholds = [];
    while (peek().type === 'COMMA') {
      advance();
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
      return isNaN(n) ? s : n;
    }

    case 'BinaryOp': {
      const l = evaluateAST(ast.left, row);
      const r = evaluateAST(ast.right, row);
      const ln = typeof l === 'number' ? l : (Number(l) || 0);
      const rn = typeof r === 'number' ? r : (Number(r) || 0);
      switch (ast.op) {
        case '+': {
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
      let result = ast.thresholds[0].label;
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
  const parsed = definitions.map(def => {
    try {
      return { name: def.name, ast: parseFormulaExpr(def.formula), error: null };
    } catch (e) {
      return { name: def.name, ast: null, error: e.message };
    }
  });

  const errors = parsed.filter(p => p.error).map(p => `${p.name}: ${p.error}`);

  const results = rows.map(row => {
    const computed = {};
    for (const p of parsed) {
      if (p.ast) {
        try {
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

// ─── App lifecycle ────────────────────────────────────────────────────────────

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (browserPool) browserPool.destroy();
  store.close();
});
