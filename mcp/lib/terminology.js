// ─── Decision vocabulary: Migrate / Revise / Archive (MRA) vs Keep / Kill / Evolve (KKE) ──
//
// The app's canonical vocabulary is MRA: every value the code compares against
// ('Migrate', 'Revise', 'Archive') and every column key it reads
// ('MRA_Recommendation', 'Final_MRA', …) is MRA. KKE is the legacy vocabulary:
// the app reads it (old files, worksheets sent out before the rename, prefs,
// templates, rubric folders, MCP input) and writes MRA. The one KKE output is
// the SME export's per-worksheet "Keep / Kill / Evolve wording" option.
//
// Conversion is bidirectional and idempotent because the two value sets are
// disjoint: convert(v, 'mra') maps a KKE word to MRA and leaves an MRA word (or
// anything else) alone, and vice versa. So a file can be converted "to" a
// vocabulary without first knowing which one it is in.
//
// Consolidate and Exclude are the same word in both vocabularies.
//
// Loaded three ways — keep it dependency-free and DOM-free:
//   • renderer: <script src="terminology.js"> → window.Terminology
//   • main:     src/terminology.js, required by main.js
//   • MCP:      mcp/lib/terminology.js is a byte-identical copy (the mcp/ folder
//               ships on its own, outside the app bundle); a test asserts the two
//               files match.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Terminology = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TERMS = ['mra', 'kke'];
  const DEFAULT_TERM = 'mra';

  // value pairs: [mra, kke]
  const VALUE_PAIRS = [
    ['Migrate', 'Keep'],
    ['Revise', 'Evolve'],
    ['Archive', 'Kill']
  ];

  // column header pairs: [mra, kke]
  const HEADER_PAIRS = [
    ['MRA_Recommendation', 'KKE_Recommendation'],
    ['Final_MRA', 'Final_KKE'],
    ['Suggested_MRA', 'Suggested_KKE'],
    ['Suggested_MRA_Sources', 'Suggested_KKE_Sources'],
    ['GA_MRA_Recommendation', 'GA_KKE_Recommendation']
  ];

  // structural sheet pairs: [mra, kke]
  const SHEET_PAIRS = [
    ['MRA_Settings', 'KKE_Settings'],
    ['MRA_ChangeLog', 'KKE_ChangeLog'],
    ['MRA_Glossary', 'KKE_Glossary']
  ];

  // Migration_Track values: [mra, kke]
  const TRACK_PAIRS = [
    ['Archive/Redirect', 'Kill/Redirect']
  ];

  // Rubric status keys (lowercase, used as object keys and library file names): [mra, kke]
  const RUBRIC_KEY_PAIRS = [
    ['migrate', 'keep'],
    ['revise', 'evolve'],
    ['archive', 'kill']
  ];

  function normTerm(term) {
    return String(term || '').toLowerCase() === 'kke' ? 'kke' : 'mra';
  }

  // Build a case-insensitive lookup: lowercased word in EITHER vocabulary → the
  // spelling in the target vocabulary.
  function buildLookup(pairs, ci) {
    const out = { mra: new Map(), kke: new Map() };
    pairs.forEach(([m, k]) => {
      const km = ci ? k.toLowerCase() : k;
      const mm = ci ? m.toLowerCase() : m;
      out.mra.set(km, m); out.mra.set(mm, m);
      out.kke.set(mm, k); out.kke.set(km, k);
    });
    return out;
  }

  const VALUE_LOOKUP = buildLookup(VALUE_PAIRS, true);
  const HEADER_LOOKUP = buildLookup(HEADER_PAIRS, true);
  const SHEET_LOOKUP = buildLookup(SHEET_PAIRS, true);
  const TRACK_LOOKUP = buildLookup(TRACK_PAIRS, true);
  const RUBRIC_LOOKUP = buildLookup(RUBRIC_KEY_PAIRS, true);

  function lookup(table, v, term, ci) {
    if (v == null) return v;
    const s = String(v);
    const key = ci ? s.trim().toLowerCase() : s;
    const hit = table[normTerm(term)].get(key);
    return hit === undefined ? v : hit;
  }

  /** A decision value ('Keep' / 'Migrate' / 'Consolidate' / custom) in `term`. */
  function value(v, term) { return lookup(VALUE_LOOKUP, v, term, true); }

  /** A column header in `term`. Unrelated headers pass through. */
  function header(h, term) { return lookup(HEADER_LOOKUP, h, term, true); }

  /** A structural sheet name in `term`. */
  function sheet(name, term) { return lookup(SHEET_LOOKUP, name, term, true); }

  /** A Migration_Track value in `term`. */
  function track(v, term) { return lookup(TRACK_LOOKUP, v, term, true); }

  /** A rubric status key ('keep' / 'migrate' / 'exclude' …) in `term`. */
  function rubricKey(k, term) { return lookup(RUBRIC_LOOKUP, k, term, true); }

  /** Every spelling a sheet may have on disk (lowercased), for case-insensitive finds. */
  function sheetAliases(canonicalName) {
    const m = sheet(canonicalName, 'mra'), k = sheet(canonicalName, 'kke');
    return [String(m).toLowerCase(), String(k).toLowerCase()];
  }

  /** "Change: Keep" / "Keep" / "Approve" → the same shape in `term`. */
  function smeDecision(v, term) {
    if (v == null || v === '') return v;
    const s = String(v);
    const m = s.match(/^(\s*change\s*:\s*)(.*)$/i);
    if (m) return m[1] + value(m[2].trim(), term);
    return value(s, term);
  }

  /** Suggested_*_Sources JSON: translate each source's rec and the winner. */
  function sourcesJson(v, term) {
    if (!v || typeof v !== 'string' || v.charAt(0) !== '{') return v;
    let obj;
    try { obj = JSON.parse(v); } catch (_) { return v; }
    const fix = (x) => (typeof x === 'string' ? value(x, term) : x);
    if (obj && typeof obj === 'object') {
      ['winningRec', 'rec', 'recommendation'].forEach(k => { if (k in obj) obj[k] = fix(obj[k]); });
      if (Array.isArray(obj.sources)) {
        obj.sources = obj.sources.map(s => (s && typeof s === 'object') ? { ...s, rec: fix(s.rec) } : s);
      }
      if (obj.tally && typeof obj.tally === 'object') {
        const t = {};
        Object.keys(obj.tally).forEach(k => { t[value(k, term)] = obj.tally[k]; });
        obj.tally = t;
      }
    }
    return JSON.stringify(obj);
  }

  /**
   * The columns whose CELL VALUES carry the vocabulary, given a column map
   * (main's computeColumnMap result, or null). Header names are canonical MRA
   * spellings; callers look them up after headers have been converted.
   */
  function valueColumns(columnMap) {
    const cm = columnMap || {};
    const decision = new Set(['MRA_Recommendation', 'Final_MRA', 'Suggested_MRA', 'GA_MRA_Recommendation', '_AssessmentResult']);
    if (cm.kke) decision.add(header(cm.kke, 'mra'));
    if (cm.finalKke) decision.add(header(cm.finalKke, 'mra'));
    return {
      decision: [...decision],
      sme: [cm.smeDecision || 'SME_Decision'],
      track: ['Migration_Track'],
      sources: ['Suggested_MRA_Sources']
    };
  }

  /** Convert one row's vocabulary-bearing cells IN PLACE. `cols` uses `term`'s header names. */
  function convertRowCells(row, cols, term) {
    cols.decision.forEach(c => { if (c in row) row[c] = value(row[c], term); });
    cols.sme.forEach(c => { if (c in row) row[c] = smeDecision(row[c], term); });
    cols.track.forEach(c => { if (c in row) row[c] = track(row[c], term); });
    cols.sources.forEach(c => { if (c in row) row[c] = sourcesJson(row[c], term); });
  }

  function colsIn(cols, term) {
    const map = (arr) => arr.map(c => header(c, term));
    return {
      decision: map(cols.decision), sme: cols.sme.slice(), track: cols.track.slice(),
      sources: map(cols.sources)
    };
  }

  /**
   * Convert a table to `term`, IN PLACE: header names in `headers` and as row
   * keys, then cell values. A header is only renamed when its target name isn't
   * already present (never clobber a column). Returns `headers`.
   */
  function convertTableInPlace(headers, rows, term, columnMap) {
    term = normTerm(term);
    headers.forEach((h, i) => {
      const to = header(h, term);
      if (to === h || headers.includes(to)) return;
      headers[i] = to;
      rows.forEach(r => {
        if (r && Object.prototype.hasOwnProperty.call(r, h)) { r[to] = r[h]; delete r[h]; }
      });
    });
    const cols = colsIn(valueColumns(columnMap), term);
    rows.forEach(r => { if (r) convertRowCells(r, cols, term); });
    return headers;
  }

  /** Non-mutating version, for save paths (the renderer's payload must not change). */
  function convertTable(headers, rows, term, columnMap) {
    const h2 = headers.slice();
    const r2 = rows.map(r => (r && typeof r === 'object') ? { ...r } : r);
    convertTableInPlace(h2, r2, term, columnMap);
    return { headers: h2, rows: r2 };
  }

  /** Column map values (header names) in `term`. */
  function convertColumnMap(cm, term) {
    if (!cm || typeof cm !== 'object') return cm;
    const out = {};
    Object.keys(cm).forEach(k => { out[k] = typeof cm[k] === 'string' ? header(cm[k], term) : cm[k]; });
    return out;
  }

  /** Change-log entries {field, from, to, …} in `term` (copies). */
  function convertChangeLog(entries, term) {
    if (!Array.isArray(entries)) return entries;
    return entries.map(e => {
      if (!e || typeof e !== 'object') return e;
      const field = header(e.field, term);
      const canon = header(e.field, 'mra');
      let conv = (x) => x;
      if (/^(MRA_Recommendation|Final_MRA|Suggested_MRA|GA_MRA_Recommendation)$/.test(canon)) conv = (x) => value(x, term);
      else if (/^SME_Decision$/i.test(canon)) conv = (x) => smeDecision(x, term);
      else if (canon === 'Migration_Track') conv = (x) => track(x, term);
      return { ...e, field, from: conv(e.from), to: conv(e.to) };
    });
  }

  /**
   * projectSettings: normalize the handful of keys that store decision values or
   * vocabulary-bearing names. Returns a converted COPY (shallow where untouched).
   * Settings are always kept in MRA internally and saved in MRA — they are not a
   * spreadsheet column — so this only ever runs toward 'mra' on read.
   */
  function convertSettings(ps, term) {
    if (!ps || typeof ps !== 'object') return ps;
    const out = { ...ps };
    const vals = (arr) => Array.isArray(arr) ? arr.map(x => (typeof x === 'string' ? value(x, term) : x)) : arr;
    if (Array.isArray(out.kkeFilter)) out.kkeFilter = vals(out.kkeFilter);
    else if (typeof out.kkeFilter === 'string') out.kkeFilter = value(out.kkeFilter, term);
    const fixFieldFilters = (ffs) => Array.isArray(ffs) ? ffs.map(ff => {
      if (!ff || typeof ff !== 'object') return ff;
      const field = header(ff.field, term);
      const canon = header(ff.field, 'mra');
      const isDecision = /^(MRA_Recommendation|Final_MRA|Suggested_MRA|GA_MRA_Recommendation)$/.test(canon);
      return { ...ff, field, value: isDecision ? value(ff.value, term) : (canon === 'Migration_Track' ? track(ff.value, term) : ff.value) };
    }) : ffs;
    if (Array.isArray(out.fieldFilters)) out.fieldFilters = fixFieldFilters(out.fieldFilters);
    if (Array.isArray(out.savedFilters)) {
      out.savedFilters = out.savedFilters.map(f => {
        if (!f || typeof f !== 'object') return f;
        const g = { ...f };
        if (Array.isArray(g.kkeFilter)) g.kkeFilter = vals(g.kkeFilter);
        else if (typeof g.kkeFilter === 'string') g.kkeFilter = value(g.kkeFilter, term);
        if (Array.isArray(g.fieldFilters)) g.fieldFilters = fixFieldFilters(g.fieldFilters);
        return g;
      });
    }
    if (out.columnMap) out.columnMap = convertColumnMap(out.columnMap, term);
    if (out.rubrics && typeof out.rubrics === 'object') {
      const r = {};
      Object.keys(out.rubrics).forEach(k => {
        const nk = rubricKey(k, term);
        // never let a legacy key overwrite a non-blank canonical one
        if (r[nk] && String(r[nk]).trim()) return;
        r[nk] = out.rubrics[k];
      });
      out.rubrics = r;
    }
    if (out.consolidateReviewed && typeof out.consolidateReviewed === 'object') {
      const cr = {};
      Object.keys(out.consolidateReviewed).forEach(addr => {
        const sig = out.consolidateReviewed[addr];
        cr[addr] = typeof sig === 'string'
          ? sig.split('\u0000').map(p => value(p, term)).join('\u0000')
          : sig;
      });
      out.consolidateReviewed = cr;
    }
    if (out.treemapSettings && typeof out.treemapSettings === 'object' && out.treemapSettings.kke) {
      const tk = { ...out.treemapSettings.kke };
      if (tk.colorOverrides && typeof tk.colorOverrides === 'object') {
        const co = {};
        Object.keys(tk.colorOverrides).forEach(k => { co[value(k, term)] = tk.colorOverrides[k]; });
        tk.colorOverrides = co;
      }
      out.treemapSettings = { ...out.treemapSettings, kke: tk };
    }
    return out;
  }

  // ─── Display helpers (renderer) ────────────────────────────────────────────

  /** 'MRA' | 'KKE' — the abbreviation used where the UI names the decision. */
  function abbr(term) { return normTerm(term) === 'kke' ? 'KKE' : 'MRA'; }

  /** 'Migrate / Revise / Archive' | 'Keep / Kill / Evolve' */
  function fullName(term) {
    return normTerm(term) === 'kke' ? 'Keep / Kill / Evolve' : 'Migrate / Revise / Archive';
  }

  return {
    TERMS, DEFAULT_TERM, VALUE_PAIRS, HEADER_PAIRS, SHEET_PAIRS, TRACK_PAIRS, RUBRIC_KEY_PAIRS,
    normTerm, value, header, sheet, track, rubricKey, sheetAliases, smeDecision,
    sourcesJson, valueColumns,
    convertTableInPlace, convertTable, convertColumnMap, convertChangeLog, convertSettings,
    abbr, fullName
  };
});
