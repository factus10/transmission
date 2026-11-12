// ════════════════════════════════════════════════════════════════════════════
// Miro sitemap plan — what text lands on each card.
//
// Run with `npm test`. Same sandbox approach as sankey.test.js: renderer.js is
// lifted by source text, and the real (pure) layout module is require()d.
//
// WHAT THIS GUARDS. A collapsed section exports as a stacked block, and its
// card used to always carry a figure ("+3" or "3 pages hidden") unless the
// sitemap's Counts was Off. Someone who wanted a clean, label-only board and
// turned off the toolbar's Numbers (which only hides the 1.2.3 prefix, never
// exported) still got the counts. The export dialog now offers "Nothing (label
// only)" — hiddenLabel:'none'.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
const SitemapLayout = require(path.join(__dirname, '..', 'src', 'sitemap-layout.js'));

function extract(name) {
  const start = source.indexOf('\nfunction ' + name + '(');
  if (start < 0) throw new Error(`renderer.js has no top-level "function ${name}("`);
  const end = source.indexOf('\n}\n', start);
  return source.slice(start + 1, end + 3);
}

const sandbox = { window: { SitemapLayout }, state: { projectSettings: {} }, console };
vm.createContext(sandbox);
vm.runInContext(
  ['sitemapCountMode', 'countMiroDescendants', 'miroConnectorWidth', 'buildMiroSitemapPlan']
    .map(extract).join('\n') +
  '\nthis.buildMiroSitemapPlan = buildMiroSitemapPlan;',
  sandbox,
);

function baseData(countMode) {
  return {
    roots: [{
      id: 'r', label: 'Home', sub: '4 pages',
      children: [
        { id: 'a', label: 'About', sub: '2 pages', children: [
          { id: 'a1', label: 'Team' }, { id: 'a2', label: 'History' }, { id: 'a3', label: 'Jobs' },
        ] },
        { id: 'b', label: 'News', sub: '1 page' },
      ],
    }],
    initialCollapsed: ['a'],
    settings: { countMode, colorRules: [] },
  };
}

const subOf = (plan, id) => plan.shapes.find(s => s.nodeId === id).sub;

describe('collapsed-section label on a Miro card', () => {
  test("'count' says how many pages are hidden", () => {
    const plan = sandbox.buildMiroSitemapPlan(baseData('collapsed'), null, { hiddenLabel: 'count' });
    assert.equal(subOf(plan, 'a'), '3 pages hidden');
  });

  test("'plus' is the compact +N", () => {
    const plan = sandbox.buildMiroSitemapPlan(baseData('collapsed'), null, { hiddenLabel: 'plus' });
    assert.equal(subOf(plan, 'a'), '+3');
  });

  test("'none' leaves the card label-only but keeps the stacked block", () => {
    const plan = sandbox.buildMiroSitemapPlan(baseData('collapsed'), null, { hiddenLabel: 'none' });
    assert.equal(subOf(plan, 'a'), '');
    assert.equal(plan.shapes.filter(s => s.backing).length, 2, 'the stack still marks the folded section');
    assert.ok(plan.shapes.filter(s => s.nodeId).every(s => !s.sub), 'no card carries a figure');
  });

  test("'none' does not silence a Counts mode that labels every card", () => {
    const plan = sandbox.buildMiroSitemapPlan(baseData('pages'), null, { hiddenLabel: 'none' });
    assert.equal(subOf(plan, 'b'), '1 page');
    assert.equal(subOf(plan, 'a'), '', 'the folded card itself is still label-only');
  });

  test('Counts Off is label-only whatever the dialog says', () => {
    const plan = sandbox.buildMiroSitemapPlan(baseData('off'), null, { hiddenLabel: 'count' });
    assert.ok(plan.shapes.filter(s => s.nodeId).every(s => !s.sub));
  });
});
