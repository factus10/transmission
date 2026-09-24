// ════════════════════════════════════════════════════════════════════════════
// Reports phase 3 — landing pages, the audit-team appendix, findings blocks
//
// Run with `npm test`. Same sandbox approach as the other suites — see
// docs/dev/TESTING.md. Background: docs/dev/REPORT_REVIEW.md.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

const EXTRACTED = ['normalizeSourceHost', 'makeLandingPageTest', 'stripAuditorAppendix', 'auditorAppendixHtml',
  'reportFindingsHtml', 'buildStatusNodes'];

function extract(name) {
  const start = source.indexOf('\nfunction ' + name + '(');
  if (start < 0) throw new Error(`renderer.js has no top-level "function ${name}(" — renamed, or no longer declared at column 0?`);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start + 1, end + 3);
}

const PRELUDE = String.raw`
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
var state = null;
`;
vm.runInThisContext(PRELUDE + '\n' + EXTRACTED.map(extract).join('\n\n'));

const U = (p) => 'https://www.uni.edu' + p;
const row = (p, over) => Object.assign({ Address: U(p), Sitemap_ID: '' }, over);

describe('extraction', () => {
  test('every lifted function is present', () => {
    for (const n of EXTRACTED) assert.equal(typeof globalThis[n], 'function', n);
  });
});

describe('makeLandingPageTest — broad audiences are expected on landing pages', () => {
  test('a page with URLs beneath it is a landing page; a leaf is a detail page', () => {
    state = { urlColumn: 'Address', navNodes: [] };
    const rows = [row('/'), row('/admissions'), row('/admissions/graduate'), row('/news/story')];
    const isLanding = makeLandingPageTest(rows);
    assert.equal(isLanding(rows[0]), true, 'the site root');
    assert.equal(isLanding(rows[1]), true, '/admissions has /admissions/graduate beneath it');
    assert.equal(isLanding(rows[2]), false);
    assert.equal(isLanding(rows[3]), false, '/news/story is a leaf even though /news is not crawled');
  });
  test('a sitemap node with children makes its page a landing page', () => {
    state = { urlColumn: 'Address', navNodes: [{ id: 'n1', children: [{ id: 'n2', children: [] }] }] };
    const r = row('/programs-overview', { Sitemap_ID: 'n1' });
    assert.equal(makeLandingPageTest([r])(r), true);
  });
  test('trailing slashes and www. do not break the match', () => {
    state = { urlColumn: 'Address', navNodes: [] };
    const rows = [row('/about/'), { Address: 'https://uni.edu/about/team', Sitemap_ID: '' }];
    assert.equal(makeLandingPageTest(rows)(rows[0]), true);
  });
});

describe('the audit-team appendix', () => {
  test('is dropped by stripAuditorAppendix and kept otherwise', () => {
    const body = '<p>client</p>' + auditorAppendixHtml([{ title: 'Worklist', html: '<table>rows</table>' }]);
    assert.ok(body.includes('For the audit team'));
    assert.equal(stripAuditorAppendix(body), '<p>client</p>');
  });
  test('renders nothing when every section is empty', () => {
    assert.equal(auditorAppendixHtml([{ title: 'x', html: '' }]), '');
  });
});

describe('reportFindingsHtml', () => {
  test('drops blank items and renders nothing when empty', () => {
    assert.equal(reportFindingsHtml(['', null], ['']), '');
    const html = reportFindingsHtml(['A <b>', ''], ['Do it']);
    assert.ok(html.includes('A &lt;b>'), 'strings are escaped');
    assert.ok(html.includes('<ol><li>Do it</li></ol>'));
  });
});

describe('buildStatusNodes — the pages Build Status counts', () => {
  test('excludes headers, phased, external links and aliases; keeps fragments', () => {
    state = { navNodes: [
      { id: 'a' }, { id: 'h', nodeType: 'Header' }, { id: 'p', phase: 'Future' },
      { id: 'x', url: 'https://other' }, { id: 'r', refNodeId: 'a' }, { id: 'f', nodeType: 'Fragment' },
    ] };
    assert.deepEqual(buildStatusNodes().map(n => n.id), ['a', 'f']);
  });
});
