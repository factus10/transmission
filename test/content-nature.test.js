// ════════════════════════════════════════════════════════════════════════════
// Content_Nature: Record ('Content Object') vs Fragment
//
// Run with `npm test`.
//
// 'Content Object' used to mean two things: a structured record that renders
// as its own page (the default registry seeds News/Article/Event with it) and,
// through a UI label, an embeddable fragment with no URL. isFragmentRow() took
// the second reading, so every registry-seeded news post was dropped from
// redirects and placement checks. These tests pin the split and the one-time
// repair of existing files.
//
// Same source-lifting sandbox as the other suites — see test/sankey.test.js.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

function extract(name) {
  const decl = '\nfunction ' + name + '(';
  const start = source.indexOf(decl);
  if (start < 0) throw new Error(`renderer.js has no top-level "function ${name}("`);
  const end = source.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`could not find the closing brace of ${name}()`);
  return source.slice(start + 1, end + 3);
}
function extractConstArrayLine(name) {
  const m = source.match(new RegExp('\\nconst ' + name + ' = \\[.*\\];\\n'));
  if (!m) throw new Error(`${name} is no longer a one-line top-level const array`);
  return m[0];
}

const PRELUDE = String.raw`
var state = null;
var logged = [];
function logChange(i, field, from, to) { logged.push({ i, field, from, to }); }
function kkeCol() { return 'KKE_Recommendation'; }
function lookupContentTypeRegistry() { return null; }
`;

vm.runInThisContext(
  PRELUDE +
  extractConstArrayLine('CONTENT_NATURE_OPTIONS') +
  extract('statusCodeCol') + extract('isFragmentRow') + extract('contentNatureLabel') +
  extract('splitContentObjectFragments') + extract('deriveMigrationTrackSuggestion')
);

function seed(rows, { headers, projectSettings } = {}) {
  logged = [];
  state = {
    headers: headers || ['Address', 'Status Code', 'Content_Nature'],
    editedRows: rows.map(r => ({ ...r })),
    projectSettings: projectSettings || {},
  };
  globalThis.state = state;
}

describe('isFragmentRow', () => {
  test('a Record (Content Object) is not a fragment; Fragment is', () => {
    assert.equal(isFragmentRow({ Content_Nature: 'Content Object' }), false);
    assert.equal(isFragmentRow({ Content_Nature: 'Fragment' }), true);
    assert.equal(isFragmentRow({ Content_Nature: '' }), false);
  });
});

describe('splitContentObjectFragments — the one-time repair', () => {
  test('crawled Content Object rows stay records; uncrawled ones keep their fragment treatment', () => {
    seed([
      { Address: 'https://x.edu/news/a', 'Status Code': '200', Content_Nature: 'Content Object' },
      { Address: 'https://x.edu/old',    'Status Code': '301', Content_Nature: 'Content Object' },
      { Address: 'cms-record-17',        'Status Code': '',    Content_Nature: 'Content Object' },
      { Address: 'https://x.edu/p',      'Status Code': '200', Content_Nature: 'Page' },
    ]);
    const out = splitContentObjectFragments();
    assert.deepEqual(out, { records: 2, fragments: 1 });
    assert.deepEqual(state.editedRows.map(r => r.Content_Nature),
      ['Content Object', 'Content Object', 'Fragment', 'Page']);
    assert.deepEqual(logged, [{ i: 2, field: 'Content_Nature', from: 'Content Object', to: 'Fragment' }]);
    assert.equal(state.projectSettings.contentNatureSplit, true);
  });

  test('with no Status Code column at all, nothing changes behavior: all become Fragment', () => {
    seed([{ Address: 'a', Content_Nature: 'Content Object' }], { headers: ['Address', 'Content_Nature'] });
    assert.deepEqual(splitContentObjectFragments(), { records: 0, fragments: 1 });
    assert.equal(state.editedRows[0].Content_Nature, 'Fragment');
  });

  test('runs once — a later hand-set Record on an uncrawled row is not overridden', () => {
    seed([{ Address: 'a', 'Status Code': '', Content_Nature: 'Content Object' }],
         { projectSettings: { contentNatureSplit: true } });
    assert.deepEqual(splitContentObjectFragments(), { records: 0, fragments: 0 });
    assert.equal(state.editedRows[0].Content_Nature, 'Content Object');
  });

  test('a file with nothing to split still sets the flag', () => {
    seed([{ Address: 'a', 'Status Code': '200', Content_Nature: 'Page' }]);
    splitContentObjectFragments();
    assert.equal(state.projectSettings.contentNatureSplit, true);
  });
});

describe('labels and track suggestion', () => {
  test('every option has a label, and Content Object reads as Record', () => {
    for (const v of CONTENT_NATURE_OPTIONS) assert.ok(contentNatureLabel(v));
    assert.equal(contentNatureLabel('Content Object', true), 'Record');
    assert.equal(contentNatureLabel('Fragment', true), 'Fragment');
    assert.equal(contentNatureLabel('Something custom'), 'Something custom');
  });

  test('Keep + Fragment suggests Migrate Records, same as Keep + Record', () => {
    assert.equal(deriveMigrationTrackSuggestion({ KKE_Recommendation: 'Keep', Content_Nature: 'Fragment' }), 'Migrate Records');
    assert.equal(deriveMigrationTrackSuggestion({ KKE_Recommendation: 'Keep', Content_Nature: 'Content Object' }), 'Migrate Records');
  });
});
