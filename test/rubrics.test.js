// Rubric parsing (mcp/lib/rubrics.js) — shared by the app's assessment and the
// MCP server — and the MCP server's get_rubrics / @url_parent.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../mcp/lib/rubrics');
const { Project } = require('../mcp/lib/project');

const ROOT = path.join(__dirname, '..');

test('field and content rules parse as the app always parsed them', () => {
  const p = R.parseRubricText(fs.readFileSync(path.join(ROOT, 'rubrics', 'evolve.md'), 'utf8'));
  assert.ok(p.fieldRules.length >= 10);
  assert.ok(p.contentRules.length >= 5);
  const wc = p.fieldRules.find(r => r.raw.startsWith('Word Count >= 50'));
  assert.equal(wc.type, 'compound');
  assert.deepEqual(wc.conditions.map(c => c.op), ['gte', 'lte']);
  assert.deepEqual(p.patterns, []);
});

test('an unknown ## section resets the current one rather than inheriting it', () => {
  // Before Patterns existed, every ## heading but two left `section` untouched,
  // so bullets under "## Notes" after Content Rules became content rules.
  const p = R.parseRubricText('# X\n## Content Rules\n- real rule\n## Notes\n- not a rule\n');
  assert.deepEqual(p.contentRules, ['real rule']);
});

test('patterns parse into conditions-with-filters, judgment, then, cite, askInstead', () => {
  const p = R.parseRubricText(fs.readFileSync(path.join(ROOT, 'rubrics', 'consolidate.md'), 'utf8'));
  assert.equal(p.fieldRules.length, 0);
  const thin = p.patterns[0];
  assert.match(thin.name, /Thin child page/);
  assert.deepEqual(thin.appliesWhen.map(c => c.filters), [
    [{ field: 'Word Count', operator: 'less-than', value: '300' }],
    [{ field: '@url_parent', operator: 'is-not-blank' }],
    [{ field: 'Status Code', operator: 'equals', value: '200' }]
  ]);
  assert.deepEqual(thin.unless.map(c => c.filters[0].value), ['Form', 'Listing']);
  assert.deepEqual(thin.then, { decision: 'Consolidate', target: 'parent', raw: 'Consolidate → parent' });
  assert.equal(thin.judgment.length, 1);
  assert.equal(thin.cite.length, 1);
  assert.equal(thin.askInstead.length, 1);
});

test('>= and <= have no filter operator: reported, not mistranslated', () => {
  const r = R.ruleToFilters(R.parseFieldRule('Word Count >= 50 and Status Code is 200'));
  assert.equal(r.filters, null);
  assert.deepEqual(r.untranslated, ['Word Count >= 50']);
});

test('then: arrow forms and a bare decision', () => {
  assert.deepEqual(R.parseThen('Kill -> homepage'), { decision: 'Kill', target: 'homepage', raw: 'Kill -> homepage' });
  assert.deepEqual(R.parseThen('Consolidate into the strongest sibling').target, 'the strongest sibling');
  assert.deepEqual(R.parseThen('Evolve'), { decision: 'Evolve', target: '', raw: 'Evolve' });
});

test('unlabelled pattern bullets are kept as notes, not dropped', () => {
  const p = R.parseRubricText('## Patterns\n### A\n- Applies when: Word Count < 10\n- just a remark\n');
  assert.deepEqual(p.patterns[0].notes, ['just a remark']);
});

test('the per-page assessment never sees Consolidate', () => {
  assert.ok(!R.PAGE_LEVEL_STATUSES.includes('consolidate'));
  assert.ok(R.RUBRIC_STATUSES.includes('consolidate'));
});

// ── MCP server side ──

function project(rows, settings = {}) {
  return new Project('/tmp/x.transmission', 'stamp', {
    meta: {}, settings, parseErrors: [], changelogCount: 0,
    headers: ['Address', 'Title 1', 'Status Code', 'Word Count', 'KKE_Recommendation'],
    rows, navNodes: []
  });
}

test('@url_parent walks up to the nearest crawled ancestor, homepage last', () => {
  const p = project([
    { Address: 'https://a.edu/' },
    { Address: 'https://a.edu/about/' },
    { Address: 'https://a.edu/about/team/people/jo' },      // /about/team is not crawled
    { Address: 'https://a.edu/news' },
    { Address: 'https://a.edu/news?page=2' },
    { Address: 'https://b.edu/x' }                            // no ancestor on its own host
  ]);
  const v = u => p.value(p.rows.find(r => r.Address === u), '@url_parent');
  assert.equal(v('https://a.edu/about/team/people/jo'), 'https://a.edu/about/');
  assert.equal(v('https://a.edu/about/'), 'https://a.edu/');
  assert.equal(v('https://a.edu/news?page=2'), 'https://a.edu/');   // query strings aren't children
  assert.equal(v('https://a.edu/'), '');
  assert.equal(v('https://b.edu/x'), '');
});

test('get_rubrics: source none until the project carries its own', () => {
  const r = project([]).getRubrics();
  assert.equal(r.source, 'none');
  assert.match(r.note, /Copy from my library/);
});

test('get_rubrics: parsed project rubrics with ready-made filters', () => {
  const consolidate = fs.readFileSync(path.join(ROOT, 'rubrics', 'consolidate.md'), 'utf8');
  const p = project([], { rubrics: { consolidate, kill: '# Kill\n## Field Rules\n- Word Count < 50\n' }, rubricsUpdatedAt: '2026-10-15T00:00:00Z' });
  const r = p.getRubrics();
  assert.equal(r.source, 'project');
  assert.deepEqual(Object.keys(r.rubrics).sort(), ['consolidate', 'kill']);
  assert.deepEqual(r.rubrics.kill.fieldRules[0].filters, [{ field: 'Word Count', operator: 'less-than', value: '50' }]);
  assert.equal(r.rubrics.consolidate.patterns[0].then.decision, 'Consolidate');
  assert.deepEqual(Object.keys(p.getRubrics({ statuses: ['Consolidate'] }).rubrics), ['consolidate']);
});

test('a pattern\'s filters run as-is against the project', () => {
  const consolidate = fs.readFileSync(path.join(ROOT, 'rubrics', 'consolidate.md'), 'utf8');
  const p = project([
    { Address: 'https://a.edu/programs', 'Status Code': '200', 'Word Count': '1200' },
    { Address: 'https://a.edu/programs/minor', 'Status Code': '200', 'Word Count': '140' },
    { Address: 'https://a.edu/programs/major', 'Status Code': '200', 'Word Count': '900' },
    { Address: 'https://a.edu/orphan', 'Status Code': '200', 'Word Count': '80' }
  ], { rubrics: { consolidate } });
  const pat = p.getRubrics().rubrics.consolidate.patterns[0];
  const filters = pat.appliesWhen.flatMap(c => c.filters);
  const hits = p.queryRows({ filters, columns: ['@url_parent'] });
  assert.deepEqual(hits.rows.map(r => r.Address), ['https://a.edu/programs/minor']);
  assert.equal(hits.rows[0]['@url_parent'], 'https://a.edu/programs');
});
