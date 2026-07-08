const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── File operations ──────────────────────────────────────────────────────
  openFileDialog: ()        => ipcRenderer.invoke('open-file-dialog'),
  getLastFile:    ()        => ipcRenderer.invoke('get-last-file'),
  saveFile:       (payload) => ipcRenderer.invoke('save-file', payload),
  saveAsProject:  (payload) => ipcRenderer.invoke('save-as-project', payload),
  exportWorkbook: (payload) => ipcRenderer.invoke('export-workbook', payload),
  packageHandoff: ()        => ipcRenderer.invoke('package-handoff'),
  getCurrentPath: ()        => ipcRenderer.invoke('get-current-path'),
  openExternal:   (url)     => ipcRenderer.invoke('open-external', url),

  // ── Update check ──────────────────────────────────────────────────────────
  checkForUpdates:     ()    => ipcRenderer.invoke('check-for-updates'),
  openChangelogWindow: (url) => ipcRenderer.invoke('open-changelog-window', url),
  onMenuCheckUpdates:  (cb)  => ipcRenderer.on('menu-check-updates', () => cb()),
  onUpdateCheckResult: (cb)  => ipcRenderer.on('update-check-result', (e, result) => cb(result)),

  // ── Preferences (visible fields + tag library) ───────────────────────────
  getPrefs:  ()       => ipcRenderer.invoke('get-prefs'),
  savePrefs: (updates) => ipcRenderer.invoke('save-prefs', updates),

  // ── Rubrics ─────────────────────────────────────────────────────────────
  getRubricDir:  ()        => ipcRenderer.invoke('get-rubric-dir'),
  pickRubricDir: ()        => ipcRenderer.invoke('pick-rubric-dir'),
  loadRubrics:   ()        => ipcRenderer.invoke('load-rubrics'),
  assessRow:      (payload)  => ipcRenderer.invoke('assess-row', payload),
  assessRowLLM:   (payload)  => ipcRenderer.invoke('assess-row-llm', payload),
  readRubricFile:   (payload) => ipcRenderer.invoke('read-rubric-file', payload),
  writeRubricFile:  (payload) => ipcRenderer.invoke('write-rubric-file', payload),
  setFileRubricDir: (payload) => ipcRenderer.invoke('set-file-rubric-dir', payload),

  // ── Export, Screenshot, Links ──────────────────────────────────────────────
  exportFiltered:    (payload) => ipcRenderer.invoke('export-filtered', payload),
  captureScreenshot: (payload) => ipcRenderer.invoke('capture-screenshot', payload),
  checkLinks:        (payload) => ipcRenderer.invoke('check-links', payload),
  saveTextFile:      (payload) => ipcRenderer.invoke('save-text-file', payload),
  copyToClipboard:   (text)    => ipcRenderer.invoke('copy-to-clipboard', text),
  exportProgressPdf: (payload) => ipcRenderer.invoke('export-progress-pdf', payload),

  // ── Import/merge ───────────────────────────────────────────────────────────
  importAuditMergeOpen: () => ipcRenderer.invoke('import-audit-merge-open'),
  importAuditMergeReadSheet: (opts) => ipcRenderer.invoke('import-audit-merge-read-sheet', opts),

  // ── Formula evaluation ─────────────────────────────────────────────────────
  evaluateFormula: (payload) => ipcRenderer.invoke('evaluate-formula', payload),
  evaluateComputedColumns: (payload) => ipcRenderer.invoke('evaluate-computed-columns', payload),

  // ── Audit export ───────────────────────────────────────────────────────────
  exportAuditCsv:   (payload) => ipcRenderer.invoke('export-audit-csv', payload),
  exportRedirects:  (payload) => ipcRenderer.invoke('export-redirects', payload),
  exportNavTree:    (payload) => ipcRenderer.invoke('export-nav-tree', payload),

  // ── Sheet / Nav / Column mapping ────────────────────────────────────────────
  reloadSheet:   (payload) => ipcRenderer.invoke('reload-sheet', payload),
  loadNavFile:   ()        => ipcRenderer.invoke('load-nav-file'),
  saveColumnMap: (payload) => ipcRenderer.invoke('save-column-map', payload),

  // ── Events: main → renderer ──────────────────────────────────────────────
  onFileOpened:        (cb) => ipcRenderer.on('file-opened',           (e, d) => cb(d)),
  onMenuSave:          (cb) => ipcRenderer.on('menu-save',             ()     => cb()),
  onMenuSaveAsProject: (cb) => ipcRenderer.on('menu-save-as-project',  ()     => cb()),
  onMenuExportWorkbook: (cb) => ipcRenderer.on('menu-export-workbook', ()     => cb()),
  onMenuPackageHandoff: (cb) => ipcRenderer.on('menu-package-handoff', ()     => cb()),
  onSaveSuccess:       (cb) => ipcRenderer.on('save-success',          (e, d) => cb(d)),
  onMenuExportFiltered:(cb) => ipcRenderer.on('menu-export-filtered',  ()     => cb()),
  onMenuExportAudit:   (cb) => ipcRenderer.on('menu-export-audit',     ()     => cb()),
  onMenuImportMerge:   (cb) => ipcRenderer.on('menu-import-merge',    ()     => cb()),
  onMenuExportRedirects:(cb) => ipcRenderer.on('menu-export-redirects', ()   => cb()),
  onMenuSettings:      (cb) => ipcRenderer.on('menu-settings',          ()   => cb()),
  onMenuProjectSettings:(cb) => ipcRenderer.on('menu-project-settings', ()   => cb()),
  onMenuGlossary:      (cb) => ipcRenderer.on('menu-glossary',          ()   => cb()),
  onMenuContentTypeRegistry: (cb) => ipcRenderer.on('menu-content-type-registry', () => cb()),
  getDefaultContentTypeRegistry: () => ipcRenderer.invoke('get-default-content-type-registry'),
  onMenuPatternLibrary: (cb) => ipcRenderer.on('menu-pattern-library', () => cb()),
  getDefaultPatternLibrary: () => ipcRenderer.invoke('get-default-pattern-library'),
  onMenuDesignPatternLibrary: (cb) => ipcRenderer.on('menu-design-pattern-library', () => cb()),
  getDefaultDesignPatternLibrary: () => ipcRenderer.invoke('get-default-design-pattern-library'),
  onMenuGaKkeSettings: (cb) => ipcRenderer.on('menu-ga-kke-settings',   ()   => cb()),
  onMenuGaKkeRefresh:  (cb) => ipcRenderer.on('menu-ga-kke-refresh',    ()   => cb()),
  onMenuSuggestedKkeRecompute: (cb) => ipcRenderer.on('menu-suggested-kke-recompute', () => cb()),
  onMenuSuggestedKkeSettings:  (cb) => ipcRenderer.on('menu-suggested-kke-settings',  () => cb()),
  onMenuRubricBatch:           (cb) => ipcRenderer.on('menu-rubric-batch',            () => cb()),
  onMenuExportMigrationTracker:(cb) => ipcRenderer.on('menu-export-migration-tracker',() => cb()),
  onMenuExportDialog:          (cb) => ipcRenderer.on('menu-export-dialog',            () => cb()),
  exportMigrationTracker:      (payload) => ipcRenderer.invoke('export-migration-tracker', payload),
  openHelpWindow:      ()   => ipcRenderer.invoke('open-help-window'),
  listReportTemplates: (appliesTo) => ipcRenderer.invoke('list-report-templates', appliesTo),
  renderReportTemplate:(payload)   => ipcRenderer.invoke('render-report-template', payload),
  openTemplatesFolder: ()   => ipcRenderer.invoke('open-templates-folder'),
  onMenuPrehandoffCheck:(cb) => ipcRenderer.on('menu-prehandoff-check', ()   => cb()),
  onMenuSuggestUnreviewed:(cb) => ipcRenderer.on('menu-suggest-unreviewed', () => cb()),
  onMenuKkeVsSme:      (cb) => ipcRenderer.on('menu-kke-vs-sme',         ()   => cb()),
  onMenuAssigneeBrief: (cb) => ipcRenderer.on('menu-report-assignee-brief', () => cb()),
  onMenuWelcome:       (cb) => ipcRenderer.on('menu-welcome',           ()   => cb()),
  onMenuProductTour:   (cb) => ipcRenderer.on('menu-product-tour',      ()   => cb()),
  onMenuShortcuts:     (cb) => ipcRenderer.on('menu-shortcuts',         ()   => cb()),
  onMenuProgress:      (cb) => ipcRenderer.on('menu-progress',          ()   => cb()),
  onMenuAuditView:     (cb) => ipcRenderer.on('menu-audit-view',         ()   => cb()),
  onMenuTableView:     (cb) => ipcRenderer.on('menu-table-view',        ()   => cb()),
  onMenuNavTree:       (cb) => ipcRenderer.on('menu-nav-tree',          ()   => cb()),
  onMenuRedirectEditor:(cb) => ipcRenderer.on('menu-redirect-editor',   ()   => cb()),
  onMenuMenus:         (cb) => ipcRenderer.on('menu-menus',             ()   => cb()),
  onMenuSmeExport:     (cb) => ipcRenderer.on('menu-sme-export',        ()   => cb()),
  onMenuSmeImport:     (cb) => ipcRenderer.on('menu-sme-import',        ()   => cb()),
  onMenuSmeResolve:    (cb) => ipcRenderer.on('menu-sme-resolve',       ()   => cb()),
  smeExport:           (payload) => ipcRenderer.invoke('sme-export', payload),
  onMenuRedirectChainCheck: (cb) => ipcRenderer.on('menu-redirect-chain-check', () => cb()),
  onMenuNavCoverage:   (cb) => ipcRenderer.on('menu-nav-coverage',       ()   => cb()),
  onMenuSaveTemplate:  (cb) => ipcRenderer.on('menu-save-template',      ()   => cb()),
  onMenuLoadTemplate:  (cb) => ipcRenderer.on('menu-load-template',      ()   => cb()),
  smeExportMulti:      (payload) => ipcRenderer.invoke('sme-export-multi', payload),
  onMenuMergeAuditor:  (cb) => ipcRenderer.on('menu-merge-auditor',       ()   => cb()),
  onMenuNon200Triage:  (cb) => ipcRenderer.on('menu-non200-triage',       ()   => cb()),
  onMenuReportExecSummary:    (cb) => ipcRenderer.on('menu-report-executive-summary', () => cb()),
  onMenuReportContentInv:     (cb) => ipcRenderer.on('menu-report-content-inventory', () => cb()),
  onMenuReportSmeStatus:      (cb) => ipcRenderer.on('menu-report-sme-status',        () => cb()),
  onMenuReportRedirectMap:    (cb) => ipcRenderer.on('menu-report-redirect-map',       () => cb()),
  onMenuReportNetNew:         (cb) => ipcRenderer.on('menu-report-net-new',            () => cb()),
  onMenuReportMigration:      (cb) => ipcRenderer.on('menu-report-migration-checklist',() => cb()),
  onMenuReportNavIa:          (cb) => ipcRenderer.on('menu-report-nav-ia',              () => cb()),
  onMenuReportDesignPatterns: (cb) => ipcRenderer.on('menu-report-design-patterns',     () => cb()),
  onMenuReportContentCrosswalk: (cb) => ipcRenderer.on('menu-report-content-crosswalk',  () => cb()),
  exportReportHtml:           (payload) => ipcRenderer.invoke('export-report-html', payload),
  exportSitemapPdf:           (payload) => ipcRenderer.invoke('export-sitemap-pdf', payload),
  saveAuditTemplate:   (payload) => ipcRenderer.invoke('save-audit-template', payload),
  loadAuditTemplate:   ()        => ipcRenderer.invoke('load-audit-template'),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
