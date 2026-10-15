'use strict';
// Rubric parsing, shared by the app (main.js requires this file from the bundled
// mcp/ folder) and the MCP server. One parser, so the app's assessment and a
// Claude session reading the same rubric can never disagree about what it says.
//
// A rubric is one Markdown document per decision (keep, kill, evolve, exclude,
// consolidate) with up to three sections:
//
//   ## Field Rules     - bullets in the field-rule grammar ("Word Count < 300"),
//                        evaluated per page by the app's rubric assessment.
//   ## Content Rules   - free-text bullets, sent to the model by the app's
//                        per-page AI assessment.
//   ## Patterns        - the holistic form, for a Claude session working across
//                        the whole audit. Each `### Name` block holds labelled
//                        bullets:
//                          - Applies when: <condition>   (repeatable; ALL must hold)
//                          - Unless: <condition>         (repeatable; ANY excludes)
//                          - Judgment: <what needs a person or the page text>
//                          - Then: <Decision> → <target>
//                          - Cite: <evidence to show>
//                          - Ask instead: <when to ask rather than propose>
//
// Conditions use the field-rule grammar. They are also translated to the MCP
// server's filter objects where an equivalent operator exists, so a session
// can run them as queries directly.

const RUBRIC_STATUSES = ['keep', 'kill', 'evolve', 'exclude', 'consolidate'];

// The per-page assessment (one row, no neighbours) can't name a consolidation
// target, so it never offers Consolidate. Patterns are where Consolidate lives.
const PAGE_LEVEL_STATUSES = ['keep', 'kill', 'evolve', 'exclude'];

const PATTERN_LABELS = {
  'applies when': 'appliesWhen',
  'when': 'appliesWhen',
  'unless': 'unless',
  'judgment': 'judgment',
  'judgement': 'judgment',
  'then': 'then',
  'cite': 'cite',
  'ask instead': 'askInstead',
  'ask': 'askInstead',
  'notes': 'notes'
};

function parseSingleCondition(text) {
  const ops = [
    { pattern: /^(.+?)\s+is not empty$/i,       op: 'is_not_empty', noVal: true },
    { pattern: /^(.+?)\s+is empty$/i,            op: 'is_empty', noVal: true },
    { pattern: /^(.+?)\s+is not\s+(.+)$/i,       op: 'is_not' },
    { pattern: /^(.+?)\s+is\s+(.+)$/i,           op: 'is' },
    { pattern: /^(.+?)\s+not contains\s+(.+)$/i, op: 'not_contains' },
    { pattern: /^(.+?)\s+contains\s+(.+)$/i,     op: 'contains' },
    { pattern: /^(.+?)\s+starts with\s+(.+)$/i,  op: 'starts_with' },
    { pattern: /^(.+?)\s+ends with\s+(.+)$/i,    op: 'ends_with' },
    { pattern: /^(.+?)\s*>=\s*(.+)$/,            op: 'gte' },
    { pattern: /^(.+?)\s*<=\s*(.+)$/,            op: 'lte' },
    { pattern: /^(.+?)\s*>\s*(.+)$/,             op: 'gt' },
    { pattern: /^(.+?)\s*<\s*(.+)$/,             op: 'lt' },
  ];
  for (const { pattern, op, noVal } of ops) {
    const m = text.match(pattern);
    if (m) return { field: m[1].trim(), op, value: noVal ? '' : m[2].trim() };
  }
  return { field: text, op: 'truthy', value: '' };
}

/** "Field >= X and Field < Y" → compound; otherwise single. */
function parseFieldRule(text) {
  const andParts = text.split(/\s+and\s+/i);
  if (andParts.length > 1) {
    return { type: 'compound', conditions: andParts.map(parseSingleCondition), raw: text };
  }
  return { type: 'single', ...parseSingleCondition(text), raw: text };
}

// Rubric operator → the sidebar / MCP field-filter operator. `gte`/`lte` have no
// equivalent (the filter vocabulary is shared with the app and has only strict
// ordering), so they come back with `filter: null` and the reason.
const OP_TO_FILTER = {
  is: 'equals', is_not: 'not-equals', is_empty: 'is-blank', is_not_empty: 'is-not-blank',
  contains: 'contains', not_contains: 'not-contains', starts_with: 'starts-with',
  ends_with: 'ends-with', gt: 'greater-than', lt: 'less-than'
};

/** One condition → `{field, operator, value}` for query_rows/aggregate, or null. */
function conditionToFilter(cond) {
  const operator = OP_TO_FILTER[cond.op];
  if (!operator) return null;
  const f = { field: cond.field, operator };
  if (operator !== 'is-blank' && operator !== 'is-not-blank') f.value = cond.value;
  return f;
}

/** A rule's conditions as filters: `{filters:[…]}` when every part translates,
 *  else `{filters:null, untranslated:[raw…]}`. */
function ruleToFilters(rule) {
  const conds = rule.type === 'compound' ? rule.conditions : [rule];
  const filters = conds.map(conditionToFilter);
  if (filters.every(Boolean)) return { filters };
  return {
    filters: null,
    untranslated: conds.filter((c, i) => !filters[i]).map(c => `${c.field} ${c.op === 'gte' ? '>=' : c.op === 'lte' ? '<=' : c.op} ${c.value}`.trim())
  };
}

/** "Consolidate → parent", "Kill -> homepage", "Evolve" → {decision, target}. */
function parseThen(text) {
  const t = String(text || '').trim();
  const m = t.match(/^([A-Za-z][\w /]*?)\s*(?:→|->|=>|\binto\b|\bto\b)\s*(.+)$/);
  if (m) return { decision: m[1].trim(), target: m[2].trim(), raw: t };
  return { decision: t, target: '', raw: t };
}

function newPattern(name) {
  return { name, appliesWhen: [], unless: [], judgment: [], then: null, cite: [], askInstead: [], notes: [] };
}

/** Parse one rubric document. Unknown `##` sections are ignored (and reset the
 *  current section, so a later heading can't capture another section's bullets). */
function parseRubricText(content) {
  const fieldRules = [];
  const contentRules = [];
  const patterns = [];
  let section = null;
  let pattern = null;

  for (const line of String(content || '').split('\n')) {
    const trimmed = line.trim();
    if (/^##\s+field\s+rules/i.test(trimmed)) { section = 'field'; pattern = null; continue; }
    if (/^##\s+content\s+rules/i.test(trimmed)) { section = 'content'; pattern = null; continue; }
    if (/^##\s+patterns/i.test(trimmed)) { section = 'patterns'; pattern = null; continue; }
    if (/^##\s+/.test(trimmed)) { section = null; pattern = null; continue; }
    if (/^#\s+/.test(trimmed)) continue;   // the document title

    if (section === 'patterns' && /^###\s+/.test(trimmed)) {
      pattern = newPattern(trimmed.replace(/^###\s+/, '').trim());
      patterns.push(pattern);
      continue;
    }
    if (!(trimmed.startsWith('- ') || trimmed.startsWith('* '))) continue;
    const ruleText = trimmed.slice(2).trim();
    if (!ruleText) continue;

    if (section === 'field') fieldRules.push(parseFieldRule(ruleText));
    else if (section === 'content') contentRules.push(ruleText);
    else if (section === 'patterns' && pattern) {
      const m = ruleText.match(/^([A-Za-z ]+?)\s*:\s*(.*)$/);
      const key = m && PATTERN_LABELS[m[1].trim().toLowerCase()];
      if (!key) { pattern.notes.push(ruleText); continue; }
      const val = m[2].trim();
      if (!val) continue;
      if (key === 'appliesWhen' || key === 'unless') {
        const rule = parseFieldRule(val);
        pattern[key].push({ raw: val, ...ruleToFilters(rule) });
      } else if (key === 'then') {
        pattern.then = parseThen(val);
      } else {
        pattern[key].push(val);
      }
    }
  }
  return { fieldRules, contentRules, patterns };
}

/** `{status: markdown}` → `{status: parsed}` for every known status, skipping
 *  blanks. `statuses` narrows it (the per-page assessment passes PAGE_LEVEL_STATUSES). */
function parseRubricSet(texts, statuses = RUBRIC_STATUSES) {
  const out = {};
  for (const s of statuses) {
    out[s] = parseRubricText((texts && texts[s]) || '');
  }
  return out;
}

module.exports = {
  RUBRIC_STATUSES, PAGE_LEVEL_STATUSES,
  parseRubricText, parseRubricSet, parseFieldRule, parseSingleCondition,
  conditionToFilter, ruleToFilters, parseThen
};
