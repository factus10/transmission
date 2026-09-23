// ════════════════════════════════════════════════════════════════════════════
// Sitemap layout — parentAlign ('center' | 'left')
//
// src/sitemap-layout.js is pure and exported for Node, so it's required
// directly (see sitemap-shape.test.js). Left alignment puts each parent at the
// left edge of its children's span, so the root anchors the top-left corner.
// The connector bus relies on one invariant that this guards: a left-aligned
// parent's centre line lands exactly on its first child's, at every level.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const SitemapLayout = require(path.join(__dirname, '..', 'src', 'sitemap-layout.js'));

const BASE = { vertDepth: 99, childThresh: 99, cardWidth: 100, cardHeight: 50,
  hGap: 20, vRow: 40, vlGap: 10, vlDrop: 30, vlHgap: 20, pad: 10 };

function tree() {
  return [{ id: 'r', children: [
    { id: 'a', children: [{ id: 'a1', children: [] }, { id: 'a2', children: [] }] },
    { id: 'b', children: [] },
  ] }];
}
function layout(extra) {
  return SitemapLayout.create({ roots: tree(), settings: Object.assign({}, BASE, extra) }).compute();
}

describe('parentAlign', () => {
  test('default is centred (unchanged behavior)', () => {
    const { positions } = layout({});
    // r spans a(2 leaves: 100+20+100=220) + 20 + b(100) = 340 → centred card at 10+170-50
    assert.equal(positions.r.x, 10 + 340 / 2 - 50);
    assert.equal(positions.a.x, 10 + 220 / 2 - 50);
  });
  test("'left' anchors every parent at the left of its span", () => {
    const { positions } = layout({ parentAlign: 'left' });
    assert.equal(positions.r.x, 10);
    assert.equal(positions.a.x, 10);
    assert.equal(positions.a1.x, 10);
  });
  test('the connector invariant: parent and first child share a centre line', () => {
    const { positions } = layout({ parentAlign: 'left' });
    assert.equal(positions.r.x, positions.a.x);
    assert.equal(positions.a.x, positions.a1.x);
  });
  test('siblings and depths are unaffected', () => {
    const c = layout({}).positions, l = layout({ parentAlign: 'left' }).positions;
    for (const id of ['a1', 'a2', 'b']) assert.equal(l[id].x, c[id].x, id);
    for (const id of Object.keys(c)) assert.equal(l[id].y, c[id].y, id);
  });
  test('the canvas does not grow', () => {
    assert.equal(layout({ parentAlign: 'left' }).canvasW, layout({}).canvasW);
  });
});
