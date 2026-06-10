// ─── ExportService: SQLite → XLSX/CSV ────────────────────────────────────────
// Exports data from the DataStore back to spreadsheet formats for client
// deliverables and round-trip compatibility with the KKE Audit Tool.

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Reverse map: db column → friendly spreadsheet header
const DB_TO_HEADER = {
  url:                      'Address',
  crawled_at:               'Crawled At',
  status_code:              'Status Code',
  status:                   'Status',
  content_type:             'Content Type',
  reported_content_type:    'Content Type (Reported)',
  actual_content_type:      'Content Type (Actual)',
  content_type_mismatch:    'Content Type Mismatch',
  response_ms:              'Response Time',
  redirect_url:             'Redirect URL',
  redirect_type:            'Redirect Type',
  redirect_chain:           'Redirect Chain',
  last_modified:            'Last Modified',
  language:                 'Language',
  indexable:                'Indexability',
  indexability_status:      'Indexability Status',
  meta_robots:              'Meta Robots 1',
  robots_status:            'Robots Status',
  canonical:                'Canonical Link Element 1',
  title:                    'Title 1',
  title_length:             'Title 1 Length',
  meta_description:         'Meta Description 1',
  meta_description_length:  'Meta Description 1 Length',
  h1:                       'H1-1',
  h2:                       'H2-1',
  h2_2:                     'H2-2',
  word_count:               'Word Count',
  sentence_count:           'Sentence Count',
  avg_words_per_sentence:   'Avg Words Per Sentence',
  text_ratio:               'Text Ratio',
  flesch_score:             'Flesch Reading Ease',
  readability:              'Readability',
  depth:                    'Crawl Depth',
  folder_depth:             'Folder Depth',
  parent_url:               'Parent URL',
  inlinks:                  'Inlinks',
  unique_inlinks:           'Unique Inlinks',
  outlinks:                 'Outlinks',
  unique_outlinks:          'Unique Outlinks',
  external_outlinks:        'External Outlinks',
  discovered_via:           'Discovered Via',
  sitemap_orphan:           'Sitemap Orphan',
  sitemap_lastmod:          'Sitemap Lastmod',
  sitemap_priority:         'Sitemap Priority',
  kke_recommendation:       'KKE_Recommendation',
  tags:                     'Tags',
  notes:                    'Notes',
  group:                    'Group',
  primary_tag:              'Primary Tag',
  flagged:                  '_Flagged',
  assessed_at:              '_AssessedAt',
  assessment_result:        '_AssessmentResult',
  nav_id:                   'NavID',
  nav_destination:          'Nav Destination',
  computed_path:            'Computed Path',
  nav_sort_id:              'Nav_SortID',
  redirect_destination:     'Redirect_Destination',
  ga4_sessions:             'GA4 Sessions',
  ga4_pageviews:            'GA4 Pageviews',
  ga4_bounce_rate:          'GA4 Bounce Rate',
  ga4_avg_engagement_time:  'GA4 Avg Engagement Time',
  ai_assessment:            'AI Assessment',
  ai_assessed_at:           'AI Assessed At',
};

// Internal columns we don't export
const SKIP_COLUMNS = new Set([
  'row_order', 'screenshot_path'
]);

class ExportService {
  /**
   * Export the full project to XLSX with NavStructure and KKE_Settings sheets.
   *
   * @param {DataStore} store
   * @param {string} outputPath
   * @param {Object} opts
   * @param {string[]} opts.columns - specific columns to export (default: all)
   * @param {Object} opts.filters - same filter opts as DataStore.getPages()
   * @returns {{ success, rowCount, error? }}
   */
  static exportFull(store, outputPath, opts = {}) {
    try {
      const wb = XLSX.utils.book_new();

      // ─── Data sheet ──────────────────────────────────────────────────────
      const columns = store.getColumns();
      const extraFieldNames = store.getExtraFieldNames();

      // Build ordered header list
      const exportColumns = opts.columns || ExportService._buildColumnOrder(columns, extraFieldNames);
      const headers = exportColumns.map(col => DB_TO_HEADER[col] || col);

      // Fetch all pages (no pagination for export)
      const { rows } = store.getPages({
        ...opts.filters,
        limit: 999999,
        offset: 0,
        extraFields: extraFieldNames
      });

      const aoa = [headers];
      for (const row of rows) {
        aoa.push(exportColumns.map(col => {
          let val = row[col];
          // Convert booleans/integers back to readable text
          if (col === 'indexable') {
            val = val === 1 ? 'Indexable' : val === 0 ? 'Non-Indexable' : '';
          } else if (col === 'flagged') {
            val = val === 1 ? '1' : '';
          }
          return val ?? '';
        }));
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      // ─── NavStructure sheet ──────────────────────────────────────────────
      const navNodes = store.getNavNodes();
      if (navNodes.length > 0) {
        const navHeaders = ['ID', 'Number', 'ParentNumber', 'Label', 'Path', 'SortID', 'Computed Path', 'Breadcrumb', 'RefNodeID'];
        const navAoa = [navHeaders];
        for (const n of navNodes) {
          navAoa.push([
            n.id, n.number, n.parent_number || '',
            n.label, n.path || '', n.sort_id || '',
            n.computed_path || '', n.breadcrumb || '',
            n.ref_node_id || ''
          ]);
        }
        const navWs = XLSX.utils.aoa_to_sheet(navAoa);
        XLSX.utils.book_append_sheet(wb, navWs, 'NavStructure');
      }

      // ─── KKE_Settings sheet ──────────────────────────────────────────────
      const settings = store.getSettings();
      if (Object.keys(settings).length > 0) {
        const settingsAoa = [['Key', 'Value']];
        for (const [key, val] of Object.entries(settings)) {
          settingsAoa.push([key, val]);
        }
        const settingsWs = XLSX.utils.aoa_to_sheet(settingsAoa);
        XLSX.utils.book_append_sheet(wb, settingsWs, 'KKE_Settings');
      }

      XLSX.writeFile(wb, outputPath);

      store._recordHistory('export', outputPath, rows.length);
      return { success: true, rowCount: rows.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Export filtered rows to a separate XLSX.
   */
  static exportFiltered(store, outputPath, filterOpts, extraFieldNames = []) {
    try {
      const { rows } = store.getPages({
        ...filterOpts,
        limit: 999999,
        offset: 0,
        extraFields: extraFieldNames
      });

      if (rows.length === 0) {
        return { success: false, error: 'No rows match the current filters' };
      }

      // Use all non-empty columns from the rows
      const allKeys = new Set();
      for (const row of rows) {
        for (const key of Object.keys(row)) {
          if (!SKIP_COLUMNS.has(key)) allKeys.add(key);
        }
      }
      const exportCols = Array.from(allKeys);
      const headers = exportCols.map(col => DB_TO_HEADER[col] || col);

      const aoa = [headers];
      for (const row of rows) {
        aoa.push(exportCols.map(col => row[col] ?? ''));
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
      XLSX.writeFile(wb, outputPath);

      return { success: true, rowCount: rows.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Export redirect map as CSV.
   */
  static exportRedirects(store, outputPath) {
    try {
      const { rows } = store.getPages({
        limit: 999999,
        offset: 0
      });

      const redirectRows = rows.filter(r =>
        r.redirect_destination ||
        (r.kke_recommendation && r.kke_recommendation.toLowerCase() === 'kill')
      );

      const headers = ['Source URL', 'Destination URL', 'Status', 'Title'];
      const csvLines = [headers.join(',')];

      for (const row of redirectRows) {
        const vals = [
          row.url,
          row.redirect_destination || '',
          row.kke_recommendation || '',
          row.title || ''
        ].map(v => {
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? '"' + s.replace(/"/g, '""') + '"'
            : s;
        });
        csvLines.push(vals.join(','));
      }

      fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf8');
      return { success: true, rowCount: redirectRows.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Export audit decisions as CSV or JSON.
   */
  static exportAuditDecisions(store, outputPath, format = 'csv') {
    try {
      const { rows } = store.getPages({
        limit: 999999,
        offset: 0
      });

      // Only include rows that have been reviewed
      const reviewed = rows.filter(r => r.kke_recommendation);
      const auditCols = ['url', 'kke_recommendation', 'tags', 'notes', 'group', 'primary_tag'];
      const headers = auditCols.map(c => DB_TO_HEADER[c] || c);

      if (format === 'json') {
        const jsonRows = reviewed.map(r => {
          const obj = {};
          auditCols.forEach(c => { obj[DB_TO_HEADER[c] || c] = r[c] || ''; });
          return obj;
        });
        fs.writeFileSync(outputPath, JSON.stringify(jsonRows, null, 2), 'utf8');
      } else {
        const csvLines = [headers.join(',')];
        for (const row of reviewed) {
          const vals = auditCols.map(c => {
            const s = String(row[c] || '');
            return s.includes(',') || s.includes('"') || s.includes('\n')
              ? '"' + s.replace(/"/g, '""') + '"'
              : s;
          });
          csvLines.push(vals.join(','));
        }
        fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf8');
      }

      return { success: true, rowCount: reviewed.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /** Build default column order from stored column definitions */
  static _buildColumnOrder(columns, extraFieldNames) {
    const ordered = [];

    // Core columns from the columns table, in display order
    for (const col of columns) {
      if (!SKIP_COLUMNS.has(col.name)) {
        ordered.push(col.name);
      }
    }

    // Add any extra fields not already included
    for (const f of extraFieldNames) {
      if (!ordered.includes(f)) {
        ordered.push(f);
      }
    }

    // If columns table was empty, fall back to a sensible default
    if (ordered.length === 0) {
      return [
        'url', 'kke_recommendation', 'tags', 'notes', 'group',
        'title', 'meta_description', 'h1', 'status_code',
        'word_count', 'indexable', 'canonical'
      ];
    }

    return ordered;
  }
}

module.exports = ExportService;
