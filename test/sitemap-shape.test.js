// ════════════════════════════════════════════════════════════════════════════
// Sitemap shape check — is this tree a diagram, or a wall of specks?
//
// Run with `npm test`. Same sandbox approach as sankey.test.js — see that
// file's header for why renderer.js is lifted by source text rather than
// require()d, and for the extraction constraints that come with it.
//
// WHAT THIS GUARDS. "Create Sitemap from Audit" derives hierarchy from URL
// segments. On a flat CMS — every article at `/some-long-slug` — that produces
// one top-level section per page, and the Visual Sitemap then laid the result
// out at ~38,000 × 105,000 px. The old fit-to-screen clamped the zoom UP to 10%
// and centred the canvas, so every card sat off the left edge: a real 1,755-node
// audit opened with 0 of 1,755 cards inside the viewport, which reads as "the
// sitemap was never built".
//
// The measurement is the whole point of the feature, so the tests run the REAL
// layout engine (src/sitemap-layout.js, which is genuinely pure and therefore
// require()-able) rather than a stub. A stubbed layout would let the predicted
// canvas drift away from the rendered one — exactly the failure the shape check
// exists to make visible.
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
const SitemapLayout = require(path.join(__dirname, '..', 'src', 'sitemap-layout.js'));

const EXTRACTED = [
  'measureSitemapLayout',
  'sitemapFitVerdict',
  'computeSitemapShape',
  'projectSitemapShape',
  'sitemapShapeNeedsAttention',
  'applyGroupNavRoots',
];

function extract(name) {
  const decl = '\nfunction ' + name + '(';
  const start = source.indexOf(decl);
  if (start < 0) {
    throw new Error(`renderer.js has no top-level "function ${name}(" — renamed, or no longer declared at column 0?`);
  }
  const end = source.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`could not find the closing brace of ${name}()`);
  return source.slice(start + 1, end + 3);
}

/** The two thresholds and the artifact list are lifted from renderer.js by text
 *  too, so a change to either is reflected here rather than silently diverging
 *  from what the app uses. */
function extractConst(name) {
  const re = new RegExp('^const ' + name + '\\s*=\\s*([\\s\\S]*?);\\s*$', 'm');
  const m = source.match(re);
  if (!m) throw new Error(`renderer.js has no top-level "const ${name} =" — renamed?`);
  return `const ${name} = ${m[1]};`;
}

const PRELUDE = String.raw`
var window = { innerWidth: 1600, innerHeight: 1000, SitemapLayout: null };
function sitemapEffectiveSettings() {
  return {
    vertDepth: 2, childThresh: 3, cardWidth: 148, cardHeight: 70,
    hGap: 40, vRow: 60, vlGap: 12, vlDrop: 32, vlHgap: 20, pad: 72,
    nodeOverrides: {},
  };
}
var state = null;
`;

vm.runInThisContext(
  PRELUDE + '\n' +
  [
    extractConst('SITEMAP_ARTIFACT_SLUGS'),
    extractConst('SITEMAP_FIT_UNUSABLE'),
    extractConst('SITEMAP_FIT_CROWDED'),
    extractConst('SITEMAP_MANY_ROOTS'),
  ].join('\n') + '\n' +
  EXTRACTED.map(extract).join('\n\n')
);

window.SitemapLayout = SitemapLayout;

// ── fixtures ────────────────────────────────────────────────────────────────

let _id = 0;
function node(label, over = {}) {
  _id++;
  return Object.assign({
    id: String(_id).padStart(5, '0'),
    number: String(_id),
    label,
    path: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    parentNumber: '',
    children: [],
  }, over);
}

/** Build state from a list of roots, wiring parentNumber and flattening. */
function setTree(roots, rows = []) {
  const all = [];
  (function walk(nodes, parent) {
    nodes.forEach(n => {
      n.parentNumber = parent ? parent.number : '';
      all.push(n);
      walk(n.children || [], n);
    });
  })(roots, null);
  state = { navTree: roots, navNodes: all, editedRows: rows, projectSettings: {} };
  return state;
}

function page(sitemapId) { return { Sitemap_ID: sitemapId }; }

// ── tests ───────────────────────────────────────────────────────────────────

describe('extraction', () => {
  test('every function still lifts out of renderer.js', () => {
    EXTRACTED.forEach(n => assert.ok(extract(n).length > 0, n));
  });
});

describe('computeSitemapShape — the flat-site case', () => {
  test('a tree of one-page roots reports them all as singletons', () => {
    const roots = [];
    const rows = [];
    for (let i = 0; i < 60; i++) {
      const n = node('Article ' + i);
      roots.push(n);
      rows.push(page(n.id));
    }
    setTree(roots, rows);
    const shape = computeSitemapShape();

    assert.equal(shape.roots, 60);
    assert.equal(shape.singletons.length, 60);
    assert.equal(shape.artifacts.length, 0);
  });

  test('a root with zero assigned pages still counts as a singleton', () => {
    // <= 1 page, not == 1: an empty leaf section is the same shape problem.
    setTree([node('Orphan')], []);
    assert.equal(computeSitemapShape().singletons.length, 1);
  });

  test('a root with children is never a singleton, however few pages it has', () => {
    const child = node('Team');
    const root = node('About', { children: [child] });
    setTree([root], [page(child.id)]);
    assert.equal(computeSitemapShape().singletons.length, 0);
  });

  test('pages are counted including Kill and Consolidate rows', () => {
    // The question is "is this section one page", which is about the tree's
    // shape — not about what survives the migration.
    const n = node('Retired');
    setTree([n], [
      { Sitemap_ID: n.id, KKE_Recommendation: 'Kill' },
      { Sitemap_ID: n.id, KKE_Recommendation: 'Kill' },
    ]);
    assert.equal(computeSitemapShape().singletons.length, 0, 'two Kill pages is still two pages');
  });
});

describe('computeSitemapShape — crawl artifacts', () => {
  test('tag / category / wp-content roots are classified as artifacts, not singletons', () => {
    const tag = node('Tag', { path: 'tag' });
    const cat = node('Category', { path: 'category' });
    const wp  = node('Wp Content', { path: 'wp-content' });
    const real = node('Academics', { path: 'academics' });
    setTree([tag, cat, wp, real], [page(tag.id), page(real.id)]);

    const shape = computeSitemapShape();
    assert.deepEqual(shape.artifacts.map(n => n.path).sort(), ['category', 'tag', 'wp-content']);
    assert.deepEqual(shape.singletons.map(n => n.path), ['academics']);
  });

  test('an artifact root is flagged even when the tree is otherwise healthy', () => {
    const tag = node('Tag', { path: 'tag' });
    const a = node('About', { path: 'about', children: [node('Team')] });
    setTree([a, tag], [page(a.children[0].id), page(tag.id)]);
    const shape = computeSitemapShape();
    assert.equal(shape.verdict, 'ok', 'a two-section tree renders fine');
    assert.ok(sitemapShapeNeedsAttention(shape), 'but the artifact section still warrants a warning');
  });
});

describe('computeSitemapShape — the render prediction', () => {
  test('a small tree is legible; a flat 500-root tree is not', () => {
    const small = [node('About', { children: [node('Team'), node('History')] }), node('Academics')];
    setTree(small, []);
    const ok = computeSitemapShape();
    assert.equal(ok.verdict, 'ok');
    assert.ok(ok.fitScale > SITEMAP_FIT_CROWDED, `expected a readable fit, got ${ok.fitScale}`);

    const many = [];
    for (let i = 0; i < 500; i++) many.push(node('Page ' + i));
    setTree(many, []);
    const bad = computeSitemapShape();
    assert.equal(bad.verdict, 'unusable');
    assert.ok(bad.fitScale < SITEMAP_FIT_UNUSABLE, `expected an unusable fit, got ${bad.fitScale}`);
    // The regression that started all this: the canvas is taller than any
    // viewport by orders of magnitude, so a fit clamped to 10% cannot show it.
    assert.ok(bad.canvasH > 50000, `expected a huge canvas, got ${bad.canvasH}`);
  });

  test('measure:false skips the layout but still classifies the tree', () => {
    const many = [];
    for (let i = 0; i < 100; i++) many.push(node('Page ' + i));
    setTree(many, []);

    const quick = computeSitemapShape({ measure: false });
    assert.equal(quick.fitScale, null);
    assert.equal(quick.verdict, null);
    assert.equal(quick.canvasW, 0);
    assert.equal(quick.singletons.length, 100, 'the cheap path still finds the singletons');
    assert.ok(sitemapShapeNeedsAttention(quick), 'and still warns, via the root-count fallback');
  });

  test('an unmeasurable tree reports "unknown", never "fine"', () => {
    // If the layout module were ever missing, reporting fitScale 1 / verdict
    // "ok" would make the check confidently declare a 105,000px tree healthy.
    // Not measuring and saying so is the only safe failure.
    const many = [];
    for (let i = 0; i < 200; i++) many.push(node('Page ' + i));
    setTree(many, []);

    const real = window.SitemapLayout;
    window.SitemapLayout = null;
    try {
      const shape = computeSitemapShape();
      assert.equal(shape.fitScale, null);
      assert.equal(shape.verdict, null);
      assert.ok(sitemapShapeNeedsAttention(shape), 'and it still warns, via the root count');
    } finally {
      window.SitemapLayout = real;
    }
    assert.equal(sitemapFitVerdict(null), null);
  });

  test('an unmeasured healthy tree does not warn', () => {
    setTree([node('About', { children: [node('Team')] }), node('Academics')], []);
    assert.equal(sitemapShapeNeedsAttention(computeSitemapShape({ measure: false })), false);
  });

  test('the site-root probe is measured, not assumed', () => {
    // A root box trades height for width. It is reported as a real measurement
    // because whether it helps depends on the tree — asserting "it never helps"
    // in the UI would be a claim the numbers sometimes contradict.
    const many = [];
    for (let i = 0; i < 500; i++) many.push(node('Page ' + i));
    setTree(many, []);
    const shape = computeSitemapShape();
    assert.ok(shape.withSiteRoot.canvasW > shape.canvasW, 'wrapping in a root widens the canvas');
    assert.ok(shape.withSiteRoot.canvasH < shape.canvasH, 'and shortens it');
  });
});

describe('computeSitemapShape — over-wide branches', () => {
  test('a node with many children is reported, and a collapsed one is not', () => {
    const kids = [];
    for (let i = 0; i < 30; i++) kids.push(node('Kid ' + i));
    const wide = node('Directory', { children: kids });
    setTree([wide], []);
    assert.deepEqual(computeSitemapShape().wide.map(w => w.node.label), ['Directory']);

    wide.collapse = 'Y';
    assert.equal(computeSitemapShape().wide.length, 0, 'already collapsed — nothing to fix');
  });

  test('wide branches are reported worst-first', () => {
    const mk = (label, n) => {
      const kids = [];
      for (let i = 0; i < n; i++) kids.push(node(label + ' kid ' + i));
      return node(label, { children: kids });
    };
    setTree([mk('Small', 13), mk('Huge', 40), mk('Mid', 20)], []);
    assert.deepEqual(computeSitemapShape().wide.map(w => w.node.label), ['Huge', 'Mid', 'Small']);
  });
});

describe('projectSitemapShape — what the fixes would actually buy', () => {
  /** 500 one-page roots — the flat-site shape, at the scale that broke. */
  function flatSite() {
    const roots = [], rows = [];
    for (let i = 0; i < 500; i++) {
      const n = node('Article ' + i);
      roots.push(n);
      rows.push(page(n.id));
    }
    return setTree(roots, rows);
  }

  test('grouping shortens the canvas without widening it', () => {
    flatSite();
    const shape = computeSitemapShape();
    const projected = projectSitemapShape(shape, ['singletons']);

    assert.equal(projected.roots, 1, 'every root moved under the one bucket');
    assert.ok(projected.canvasH < shape.canvasH / 10,
      `expected a far shorter canvas (was ${shape.canvasH}, projected ${projected.canvasH})`);
    assert.ok(projected.canvasW <= shape.canvasW,
      `grouping must not widen the canvas (was ${shape.canvasW}, projected ${projected.canvasW})`);
    assert.ok(projected.fitScale > shape.fitScale, 'and it must improve the fit');
  });

  test('the bucket must be collapsed — expanded, it is not a fix at all', () => {
    // The regression this guards, measured on the audit that prompted the work:
    // a depth-0 node lays its children out in ONE horizontal row (the engine's
    // vertical flip needs depth >= 1), so an expanded bucket of 456 sections
    // produced an ~86,000 px-wide canvas and moved the fit from 0.7% to 1.7% —
    // trading height for width and fixing nothing.
    flatSite();
    const shape = computeSitemapShape();
    const bucketed = [{ id: 'B', label: 'Unsorted', children: shape.singletons }];

    const expanded = measureSitemapLayout(bucketed, new Set());
    const collapsed = measureSitemapLayout(bucketed, new Set(['B']));

    assert.ok(expanded.canvasW > 50000,
      `an expanded bucket should sprawl sideways, got ${expanded.canvasW}`);
    assert.ok(collapsed.canvasW < 1000,
      `a collapsed bucket is one card wide, got ${collapsed.canvasW}`);
    assert.ok(collapsed.fitScale > expanded.fitScale * 10,
      'collapsing is what actually recovers the fit');
    // And the projection must model the collapsed one.
    assert.equal(projectSitemapShape(shape, ['singletons']).canvasW, collapsed.canvasW);
  });

  test('projecting changes nothing about the real tree', () => {
    const st = flatSite();
    const before = st.navTree.length;
    const shape = computeSitemapShape();
    projectSitemapShape(shape, ['singletons', 'artifacts', 'wide']);
    assert.equal(st.navTree.length, before, 'the projection must be non-mutating');
    assert.equal(computeSitemapShape().roots, before);
  });

  test('selecting nothing projects the tree unchanged', () => {
    flatSite();
    const shape = computeSitemapShape();
    const projected = projectSitemapShape(shape, []);
    assert.equal(projected.roots, shape.roots);
    assert.equal(projected.canvasW, shape.canvasW);
  });

  test('dropping artifacts removes exactly those roots', () => {
    const tag = node('Tag', { path: 'tag' });
    const a = node('About', { path: 'about', children: [node('Team')] });
    const b = node('Academics', { path: 'academics', children: [node('Majors')] });
    setTree([a, tag, b], []);
    const shape = computeSitemapShape();
    assert.equal(projectSitemapShape(shape, ['artifacts']).roots, 2);
  });

  test('a projection can still be unusable — the tool must be able to say so', () => {
    // The honest case, and the reason the projection exists: on a real audit
    // every repair together still left 88 sections and a 2.4% fit. A dialog
    // that only offered fixes would have implied a cure it cannot deliver.
    const roots = [], rows = [];
    for (let i = 0; i < 120; i++) {
      const sec = node('Section ' + i, { children: [node('Child ' + i + 'a'), node('Child ' + i + 'b')] });
      roots.push(sec);
      rows.push(page(sec.children[0].id), page(sec.children[1].id));
    }
    setTree(roots, rows);
    const shape = computeSitemapShape();
    assert.equal(shape.singletons.length, 0, 'these are real sections, not singletons');
    const projected = projectSitemapShape(shape, ['singletons', 'artifacts', 'wide']);
    assert.equal(projected.verdict, 'unusable',
      'nothing automatic fixes 120 genuine top-level sections');
  });
});

describe('applyGroupNavRoots — the repair', () => {
  test('moves the chosen roots into the bucket and leaves the rest alone', () => {
    const a = node('Alpha'), b = node('Beta'), keep = node('Academics');
    const bucket = node('Unsorted', { number: '99' });
    setTree([a, b, keep, bucket], []);

    applyGroupNavRoots(bucket, [a, b]);

    assert.deepEqual(state.navTree.map(n => n.label), ['Academics', 'Unsorted']);
    assert.deepEqual(bucket.children.map(n => n.label), ['Alpha', 'Beta']);
    assert.equal(a.parentNumber, '99');
    assert.equal(b.parentNumber, '99');
    assert.equal(keep.parentNumber, '', 'an untouched root keeps its top-level parent');
  });

  test('a node that is not at the top level is still adopted, not duplicated', () => {
    // splice(-1) would otherwise chop the wrong element off the end.
    const orphan = node('Orphan');
    const bucket = node('Unsorted', { number: '99' });
    const other = node('Other');
    setTree([other, bucket], []);

    applyGroupNavRoots(bucket, [orphan]);

    assert.deepEqual(state.navTree.map(n => n.label), ['Other', 'Unsorted'],
      'no existing root was spliced away');
    assert.deepEqual(bucket.children.map(n => n.label), ['Orphan']);
  });
});
