// ─── ImportService: XLSX/CSV → SQLite ────────────────────────────────────────
// Reads spreadsheet files via SheetJS, maps columns to the pages table,
// imports NavStructure and KKE_Settings sheets, and stores everything in
// the DataStore.

const XLSX = require('xlsx');
const path = require('path');
const DataStore = require('./datastore');

// ─── Column mapping: spreadsheet header → core DB column ─────────────────────
// Keys are lowercase for case-insensitive matching.

const HEADER_MAP = {
  // URL
  'address':            'url',
  'url':                'url',
  'link':               'url',
  'website':            'url',
  'href':               'url',
  'uri':                'url',

  // HTTP basics
  'status code':        'status_code',
  'status_code':        'status_code',
  'status':             'status',
  'content type':       'content_type',
  'content_type':       'content_type',
  'reported_content_type': 'reported_content_type',
  'response time':      'response_ms',
  'response_ms':        'response_ms',
  'last-modified':      'last_modified',
  'last modified':      'last_modified',
  'last_modified':      'last_modified',

  // Redirect
  'redirect url':       'redirect_url',
  'redirect_url':       'redirect_url',
  'redirect type':      'redirect_type',
  'redirect_type':      'redirect_type',

  // Indexability
  'indexability':       'indexable',
  'indexability status': 'indexability_status',
  'indexability_status': 'indexability_status',
  'indexable':          'indexable',
  'meta robots 1':      'meta_robots',
  'meta robots':        'meta_robots',
  'meta_robots':        'meta_robots',
  'robots_status':      'robots_status',

  // Content: crawled
  'title 1':            'title',
  'title':              'title',
  'title 1 length':     'title_length',
  'title_length':       'title_length',
  'meta description 1': 'meta_description',
  'meta description':   'meta_description',
  'meta_description':   'meta_description',
  'meta description 1 length': 'meta_description_length',
  'meta_description_length':   'meta_description_length',
  'h1-1':               'h1',
  'h1':                 'h1',
  'h2-1':               'h2',
  'h2':                 'h2',
  'h2-2':               'h2_2',
  'h2_2':               'h2_2',
  'canonical link element 1': 'canonical',
  'canonical':          'canonical',
  'lang':               'language',
  'language':           'language',

  // Content: computed
  'word count':         'word_count',
  'word_count':         'word_count',
  'sentence count':     'sentence_count',
  'sentence_count':     'sentence_count',
  'avg words per sentence': 'avg_words_per_sentence',
  'text ratio':         'text_ratio',
  'text_ratio':         'text_ratio',
  'flesch reading ease':'flesch_score',
  'flesch_score':       'flesch_score',
  'readability':        'readability',

  // IA signals
  'crawl depth':        'depth',
  'depth':              'depth',
  'folder depth':       'folder_depth',
  'folder_depth':       'folder_depth',

  // Link counts
  'inlinks':            'inlinks',
  'unique inlinks':     'unique_inlinks',
  'unique_inlinks':     'unique_inlinks',
  'outlinks':           'outlinks',
  'unique outlinks':    'unique_outlinks',
  'unique_outlinks':    'unique_outlinks',
  'external outlinks':  'external_outlinks',
  'external_outlinks':  'external_outlinks',

  // KKE audit fields
  'kke_recommendation': 'kke_recommendation',
  'kke recommendation': 'kke_recommendation',
  'kke rec':            'kke_recommendation',
  'kke':                'kke_recommendation',
  'recommendation':     'kke_recommendation',
  'kke_decision':       'kke_recommendation',
  'kke decision':       'kke_recommendation',
  'tags':               'tags',
  'kke tags':           'tags',
  'audit tags':         'tags',
  'notes':              'notes',
  'notes/rationale':    'notes',
  'rationale':          'notes',
  'mra_notes':          'notes',
  'mra notes':          'notes',
  'audit notes':        'notes',
  'group':              'group',
  'audit group':        'group',
  'page group':         'group',
  'primary tag':        'primary_tag',
  'primary_tag':        'primary_tag',
  'main tag':           'primary_tag',

  // Flagged / assessment (internal columns from KKE Audit Tool)
  '_flagged':           'flagged',
  '_assessedat':        'assessed_at',
  '_assessmentresult':  'assessment_result',

  // Nav columns
  'navid':              'nav_id',
  'nav destination':    'nav_destination',
  'computed path':      'computed_path',
  'nav_sortid':         'nav_sort_id',

  // Redirect destination
  'redirect_destination': 'redirect_destination',
  'redirect destination': 'redirect_destination',

  // GA4
  'ga4_sessions':       'ga4_sessions',
  'ga4_pageviews':      'ga4_pageviews',
  'ga4_bounce_rate':    'ga4_bounce_rate',
  'ga4_avg_engagement_time': 'ga4_avg_engagement_time',
  'ga4_avg_engagement':      'ga4_avg_engagement_time',
};

class ImportService {
  /**
   * Import an XLSX/CSV file into a DataStore.
   *
   * @param {DataStore} store - an already-opened DataStore
   * @param {string} xlsxPath - path to the spreadsheet
   * @param {Object} opts
   * @param {string} opts.sheetName - specific sheet to import (default: first data sheet)
   * @param {Object} opts.columnOverrides - manual header→db column overrides
   * @returns {{ rowCount, headers, columnMap, dataSheets, projectSettings, hasNav }}
   */
  static importFile(store, xlsxPath, opts = {}) {
    const workbook = XLSX.readFile(xlsxPath, { type: 'file', cellDates: true });
    const allSheetNames = workbook.SheetNames;

    // Structural sheets
    const structuralNames = new Set(['navstructure', 'kke_settings']);
    const dataSheets = allSheetNames.filter(s => !structuralNames.has(s.toLowerCase()));

    // Pick data sheet
    const sheetName = (opts.sheetName && allSheetNames.includes(opts.sheetName))
      ? opts.sheetName
      : (dataSheets[0] || allSheetNames[0]);

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false
    });

    if (rawData.length < 2) {
      throw new Error(`Sheet "${sheetName}" has no data rows.`);
    }

    const headers = rawData[0].map(String);
    const overrides = opts.columnOverrides || {};

    // Build column mapping: spreadsheet header → db column
    const columnMap = {};
    const mappedCoreColumns = new Set();
    for (const header of headers) {
      const lower = header.toLowerCase().trim();
      // Check manual overrides first
      if (overrides[header]) {
        columnMap[header] = overrides[header];
      } else if (HEADER_MAP[lower]) {
        columnMap[header] = HEADER_MAP[lower];
      } else {
        columnMap[header] = header; // stored as extra field
      }

      if (DataStore.CORE_COLUMNS.has(columnMap[header])) {
        mappedCoreColumns.add(columnMap[header]);
      }
    }

    // Import rows
    const rows = [];
    for (let i = 1; i < rawData.length; i++) {
      const rawRow = rawData[i];
      const row = { discovered_via: 'import', row_order: i };

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const dbCol = columnMap[header];
        let value = rawRow[j] ?? '';

        // Type coercion for known numeric/boolean columns
        if (dbCol === 'status_code' || dbCol === 'word_count' || dbCol === 'response_ms' || dbCol === 'depth') {
          const n = parseInt(value, 10);
          value = isNaN(n) ? null : n;
        } else if (dbCol === 'indexable') {
          // Handle "Indexable" / "Non-Indexable" text values
          if (typeof value === 'string') {
            const lower = value.toLowerCase().trim();
            if (lower === 'indexable' || lower === 'true' || lower === '1') value = 1;
            else if (lower === 'non-indexable' || lower === 'false' || lower === '0' || lower === 'noindex') value = 0;
            else value = null;
          }
        } else if (dbCol === 'flagged') {
          value = (value === '1' || value === 'true' || value === true) ? 1 : 0;
        }

        row[dbCol] = value;
      }

      // Skip rows without a URL
      if (!row.url || String(row.url).trim() === '') continue;
      row.url = String(row.url).trim();

      rows.push(row);
    }

    // Bulk insert
    store.insertPages(rows);

    // Register columns (both core and extra)
    const allColumnNames = headers.map(h => columnMap[h]);
    store.registerColumns(allColumnNames, 'import');

    // ─── NavStructure sheet ──────────────────────────────────────────────────
    let hasNav = false;
    const navSheetName = allSheetNames.find(s => s.toLowerCase() === 'navstructure');
    if (navSheetName) {
      const navNodes = ImportService._parseNavSheet(workbook.Sheets[navSheetName]);
      if (navNodes && navNodes.length > 0) {
        store.setNavNodes(navNodes);
        hasNav = true;
      }
    }

    // ─── KKE_Settings sheet ──────────────────────────────────────────────────
    let projectSettings = {};
    const settingsSheetName = allSheetNames.find(s => s.toLowerCase() === 'kke_settings');
    if (settingsSheetName) {
      projectSettings = ImportService._parseSettingsSheet(workbook.Sheets[settingsSheetName]);
      store.setSettings(projectSettings);
    }

    // Record history
    store._recordHistory('import', xlsxPath, rows.length);

    return {
      rowCount: rows.length,
      headers,
      columnMap,
      dataSheets,
      sheetName,
      projectSettings,
      hasNav
    };
  }

  /** Parse NavStructure sheet into flat node array */
  static _parseNavSheet(worksheet) {
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, defval: '', raw: false
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
      refNodeId:    h.indexOf('RefNodeID')
    };

    if (idx.number === -1 || idx.label === -1 || idx.id === -1) return null;

    const nodes = [];
    for (let i = 1; i < rawData.length; i++) {
      const r = rawData[i];
      const number = String(r[idx.number] || '');
      if (!number) continue;

      nodes.push({
        id:            String(r[idx.id] || ''),
        number,
        parent_number: idx.parentNumber >= 0 ? String(r[idx.parentNumber] || '') : '',
        label:         String(r[idx.label] || ''),
        path:          idx.path >= 0        ? String(r[idx.path] || '')         : '',
        sort_id:       idx.sortID >= 0      ? String(r[idx.sortID] || '')       : '',
        computed_path: idx.computedPath >= 0 ? String(r[idx.computedPath] || '') : '',
        breadcrumb:    idx.breadcrumb >= 0  ? String(r[idx.breadcrumb] || '')   : '',
        ref_node_id:   idx.refNodeId >= 0   ? String(r[idx.refNodeId] || '')   : ''
      });
    }
    return nodes;
  }

  /** Parse KKE_Settings sheet into key/value object */
  static _parseSettingsSheet(worksheet) {
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
    const settings = {};
    for (let i = 0; i < rawData.length; i++) {
      const key = String(rawData[i][0] || '').trim();
      const val = String(rawData[i][1] || '');
      if (key) settings[key] = val;
    }
    return settings;
  }
}

module.exports = ImportService;
