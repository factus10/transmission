// ════════════════════════════════════════════════════════════════════════════
// Sidebar "Site order" sort
//
// Run with `npm test`. Same sandbox approach as the other suites — see
// docs/dev/TESTING.md.
//
// WHAT THIS GUARDS. The point of site order is that a section reads as a block:
// its landing page directly above everything under it. A plain string sort
// breaks that ("/about-us" lands between "/about" and "/about/team"), and so
// would ordering placed pages by a stale parentNumber instead of the tree the
// editor actually shows.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

const EXTRACTED = ['normalizeSourceHost', 'navDisplayOrder', 'urlTreeKey', 'compareUrlTreeKeys', 'sortRowsBySiteOrder'];

function extract(name) {
  const start = source.indexOf('\nfunction ' + name + '(');
  if (start < 0) throw new Error(`renderer.js has no top-level "function ${name}(" — renamed, or no longer declared at column 0?`);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start + 1, end + 3);
}

const PRELUDE = String.raw`
const _siteOrderCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
var state = null;
`;
vm.runInThisContext(PRELUDE + '\n' + EXTRACTED.map(extract).join('\n\n'));

const U = (p, host = 'example.edu') => `https://${host}${p}`;
function run(rows, navTree = []) {
  state = { navTree };
  const list = rows.map((r, i) => ({ row: r, origIndex: i }));
  const depth = sortRowsBySiteOrder(list, 'Address');
  return { urls: list.map(fr => fr.row.Address.replace('https://', '')), depth, list };
}

describe('extraction', () => {
  test('every lifted function is present', () => {
    for (const n of EXTRACTED) assert.equal(typeof globalThis[n], 'function', n);
  });
});

describe('unplaced pages follow the URL hierarchy', () => {
  test('a section stays contiguous (segment-wise, not string-wise)', () => {
    const { urls } = run([
      { Address: U('/about-us') }, { Address: U('/about/team') },
      { Address: U('/about') }, { Address: U('/academics') }, { Address: U('/') },
    ]);
    assert.deepEqual(urls, [
      'example.edu/', 'example.edu/about', 'example.edu/about/team',
      'example.edu/about-us', 'example.edu/academics',
    ]);
  });
  test('numbers sort numerically and a bare page precedes its query variants', () => {
    const { urls } = run([
      { Address: U('/news/page/10') }, { Address: U('/news/page/2') },
      { Address: U('/news?sort=new') }, { Address: U('/news') },
    ]);
    assert.deepEqual(urls, [
      'example.edu/news', 'example.edu/news?sort=new',
      'example.edu/news/page/2', 'example.edu/news/page/10',
    ]);
  });
  test('sites are grouped, www. folded', () => {
    const { urls } = run([
      { Address: U('/b', 'beta.edu') }, { Address: U('/z', 'www.alpha.edu') }, { Address: U('/a', 'alpha.edu') },
    ]);
    assert.deepEqual(urls, ['alpha.edu/a', 'www.alpha.edu/z', 'beta.edu/b']);
  });
  test('indent is path depth', () => {
    const { depth } = run([{ Address: U('/') }, { Address: U('/a/b/c') }]);
    assert.equal(depth.get(0), 0);
    assert.equal(depth.get(1), 2);
  });
});

describe('placed pages follow the sitemap, before unplaced ones', () => {
  const tree = [
    { id: 'n1', children: [{ id: 'n3', children: [] }] },
    { id: 'n2', children: [] },
  ];
  test('sitemap display order wins over URL order', () => {
    const { urls, depth } = run([
      { Address: U('/zzz-unplaced') },
      { Address: U('/second'), Sitemap_ID: 'n2' },
      { Address: U('/child'), Sitemap_ID: 'n3' },
      { Address: U('/first'), Sitemap_ID: 'n1' },
      { Address: U('/aaa-unplaced') },
    ], tree);
    assert.deepEqual(urls, [
      'example.edu/first', 'example.edu/child', 'example.edu/second',
      'example.edu/aaa-unplaced', 'example.edu/zzz-unplaced',
    ]);
    assert.equal(depth.get(2), 1, 'child node is indented one level');
  });
  test('a Sitemap_ID that no longer exists counts as unplaced', () => {
    const { urls } = run([{ Address: U('/b'), Sitemap_ID: 'gone' }, { Address: U('/a'), Sitemap_ID: 'n2' }], tree);
    assert.deepEqual(urls, ['example.edu/a', 'example.edu/b']);
  });
});
