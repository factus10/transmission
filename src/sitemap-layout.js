// ════════════════════════════════════════════════════════════════════════════
// Visual Sitemap layout engine — the pure geometry, shared by two consumers.
//
// This was extracted from sitemap-template.js's `sitemapEngine` so that the
// box-tree geometry has exactly ONE implementation. Two things need it and
// they run in different worlds:
//
//   1. The sitemap webview (app / client / print). Runs under its own context
//      with the engine inlined as a string, so it gets this module the same
//      way — see `__source` below.
//   2. Host-side callers in the renderer (the Miro exporter), which need every
//      node's x/y WITHOUT rendering anything.
//
// Consumer 2 is only possible because this code is genuinely pure: it reads
// the node tree, the settings constants, and the collapsed set, and nothing
// else. There is no getBoundingClientRect, no offsetWidth, no getComputedStyle,
// no canvas text measurement anywhere in it. Card dimensions are fixed settings
// (cardWidth/cardHeight) and the two-line label clamp is pure CSS that never
// feeds back into geometry. Keep it that way — the moment this file measures a
// DOM node, the exporter breaks and the two views silently drift apart.
//
// Authored as a real function so it can be BOTH called directly (renderer) and
// stringified into the webview document (Function.prototype.toString) — the
// same trick sitemap-template.js uses for the engine, and for the same reason:
// the app document's CSP forbids inline script, but the webview has its own.
//
// Exposed:
//   window.SitemapLayout.create(opts) -> layout instance
//   window.SitemapLayout.__source     -> source text, for webview injection
// ════════════════════════════════════════════════════════════════════════════
(function () {

  function sitemapLayoutCore() {
    'use strict';

    var ROOT_GAP = 72;        // vertical gap between stacked root trees
    var HEADING_H = 30;       // height reserved for a root heading (menus mode)
    var SHADOW = 8;           // extra bulk of a "stacked" card's shadow

    // opts:
    //   roots        — array of root nodes, or a function returning it (pass a
    //                  function when the caller swaps the tree between computes)
    //   settings     — the live settings object (cardWidth, hGap, vertDepth,
    //                  childThresh, nodeOverrides, …). Held by REFERENCE so the
    //                  webview's settings panel edits take effect without
    //                  re-creating the instance.
    //   collapsed    — a live Set of collapsed node ids, also by reference.
    //   rootHeadings — stack roots under headings (menus sitemap).
    function create(opts) {
      opts = opts || {};
      var settings = opts.settings || {};
      var collapsed = opts.collapsed || new Set();
      var rootHeadings = !!opts.rootHeadings;
      var headingH = rootHeadings ? (opts.headingH == null ? HEADING_H : opts.headingH) : 0;
      var rootGap = opts.rootGap == null ? ROOT_GAP : opts.rootGap;
      var getRoots = (typeof opts.roots === 'function')
        ? opts.roots
        : function () { return opts.roots || []; };

      // Layout constants, read live off settings so the Layout tab can tune
      // all nine of them without a rebuild.
      function consts() {
        return {
          CW: settings.cardWidth, CH: settings.cardHeight,
          H_GAP: settings.hGap, V_ROW: settings.vRow,
          VL_GAP: settings.vlGap, VL_DROP: settings.vlDrop,
          VL_HGAP: settings.vlHgap, PAD: settings.pad,
          SHADOW: SHADOW
        };
      }

      // Horizontal (children in a row) vs vertical (children in a column).
      // Per-node override wins; then depth threshold; then child-count
      // threshold. 99 means "off" for either threshold.
      function shouldBeVert(node, depth) {
        var ov = (settings.nodeOverrides || {})[node.id];
        if (ov && ov.layout) return ov.layout === 'vert';
        // A top-level node is exempt from the child-count rule below, so a
        // homepage's sections fan out across the top in the classic sitemap
        // shape. That exemption is wrong for a root carrying a long flat list
        // (Eberly's "User": 106 profiles in one 15,000px row), so roots get
        // their own, much higher bar. 0 / unset = off.
        if (depth === 0 && settings.rootVertOver > 0 && node.children && node.children.length > settings.rootVertOver) return true;
        if (settings.vertDepth !== 99 && depth >= settings.vertDepth) return true;
        if (settings.childThresh !== 99 && depth >= 1 && node.children && node.children.length >= settings.childThresh) return true;
        return false;
      }

      // Bounding box of a node's whole subtree. Recursive and side-effect free.
      function subtreeBox(node, depth) {
        var k = consts();
        var hasKids = node.children && node.children.length && !collapsed.has(node.id);
        var isStacked = node.stacked || (collapsed.has(node.id) && node.children && node.children.length);
        if (!hasKids) return { w: k.CW + (isStacked ? k.SHADOW : 0), h: k.CH + (isStacked ? k.SHADOW : 0) };
        if (shouldBeVert(node, depth)) {
          var cb = node.children.map(function (c) { return subtreeBox(c, depth + 1); });
          var colH = cb.reduce(function (s, b, i) { return s + b.h + (i > 0 ? k.VL_GAP : 0); }, 0);
          var maxW = cb.reduce(function (m, b) { return Math.max(m, b.w); }, 0);
          return { w: Math.max(k.CW, k.VL_HGAP + maxW), h: k.CH + k.VL_DROP + colH };
        } else {
          var boxes = node.children.map(function (c) { return subtreeBox(c, depth + 1); });
          var totalW = boxes.reduce(function (s, b, i) { return s + b.w + (i > 0 ? k.H_GAP : 0); }, 0);
          var maxH = boxes.reduce(function (m, b) { return Math.max(m, b.h); }, 0);
          return { w: Math.max(k.CW, totalW), h: k.CH + k.V_ROW + maxH };
        }
      }

      // Walks the tree assigning absolute top-left coordinates.
      // Returns { positions, canvasW, canvasH, rootHeadingY }; positions maps
      // node id -> { x, y, depth }, in a top-left-origin, y-down space.
      function compute() {
        var k = consts();
        var positions = {};
        var rootHeadingY = {};

        function layoutNode(node, x, y, depth) {
          var hasKids = node.children && node.children.length && !collapsed.has(node.id);
          if (!shouldBeVert(node, depth)) {
            var boxes = node.children && !collapsed.has(node.id)
              ? node.children.map(function (c) { return subtreeBox(c, depth + 1); })
              : [];
            var totalW = boxes.reduce(function (s, b, i) { return s + b.w + (i > 0 ? k.H_GAP : 0); }, 0) || k.CW;
            // Parent sits centred over the span of its children — or, with
            // parentAlign 'left', at its left edge, so the root anchors the
            // top-left corner and the tree spills out to the right. Connectors
            // need no special case: every level anchors the same way, so a
            // parent's centre line lands exactly on its first child's.
            var cardX = settings.parentAlign === 'left' ? x : x + totalW / 2 - k.CW / 2;
            positions[node.id] = { x: cardX, y: y, depth: depth };
            if (hasKids) {
              var cx = x;
              node.children.forEach(function (c, i) {
                layoutNode(c, cx, y + k.CH + k.V_ROW, depth + 1);
                cx += boxes[i].w + k.H_GAP;
              });
            }
          } else {
            positions[node.id] = { x: x, y: y, depth: depth };
            if (hasKids) {
              var xcol = x + k.VL_HGAP;
              var cy = y + k.CH + k.VL_DROP;
              node.children.forEach(function (c) {
                layoutNode(c, xcol, cy, depth + 1);
                cy += subtreeBox(c, depth + 1).h + k.VL_GAP;
              });
            }
          }
        }

        var roots = getRoots();
        var yCursor = k.PAD;
        roots.forEach(function (root, i) {
          if (rootHeadings) { rootHeadingY[i] = yCursor; yCursor += headingH; }
          layoutNode(root, k.PAD, yCursor, 0);
          yCursor += subtreeBox(root, 0).h + rootGap;
        });

        var maxX = 0, maxY = 0;
        for (var id in positions) {
          var p = positions[id];
          maxX = Math.max(maxX, p.x + k.CW + 16);
          maxY = Math.max(maxY, p.y + k.CH);
        }

        return {
          positions: positions,
          canvasW: maxX + k.PAD,
          canvasH: maxY + k.PAD,
          rootHeadingY: rootHeadingY
        };
      }

      // ── Colour resolution ──────────────────────────────────────────────
      // Also pure, and also needed by both consumers: the webview paints cards
      // with it, the exporter needs the same hex to send to Miro. Kept here so
      // the two can never disagree about what colour a node is.

      var index = null;   // id -> { depth, parentId }; built lazily, per compute
      function reindex() {
        index = {};
        function walk(node, depth, parentId) {
          index[node.id] = { depth: depth, parentId: parentId };
          if (node.children) node.children.forEach(function (c) { walk(c, depth + 1, node.id); });
        }
        getRoots().forEach(function (r) { walk(r, 0, null); });
      }
      function depthOf(node) {
        if (!index) reindex();
        var e = index[node.id];
        return e ? e.depth : 0;
      }
      // ── Rule evaluation ────────────────────────────────────────────────
      // Two rule shapes are accepted, deliberately:
      //
      //   legacy  { condition: {type, …}, color: '#hex' }
      //   generic { when: [ {source, key, op, value}, … ], style: {…} }
      //
      // Legacy is what every existing project has persisted in
      // projectSettings.sitemapSettings.*.colorRules, and those keep working
      // untouched — a legacy rule is just a one-condition rule whose outcome
      // sets the top band, which is exactly what `color` meant.
      //
      // In the generic form conditions are ANDed (an empty list always
      // matches), and `source` says where the value comes from:
      //   tree — depth / colorValue / external / parentId (structure)
      //   node — node.fields[key]      (sitemap node properties)
      //   row  — node.rowFields[key]   (DOMINANT value across the audit rows
      //          assigned to this node), with node.rowFieldSets[key] holding
      //          every distinct value so the 'any-is' operator can ask
      //          "does ANY assigned row have this value" — the case that
      //          matters for flagging (one Kill inside an otherwise Keep
      //          section should still be visible).

      function condValue(node, depth, c) {
        if (c.source === 'row') return (node.rowFields && node.rowFields[c.key]) || '';
        if (c.source === 'node') return (node.fields && node.fields[c.key]) || '';
        // tree
        if (c.key === 'depth') return depth;
        if (c.key === 'external') return !!node.external;
        if (c.key === 'parentId') return (index[node.id] && index[node.id].parentId) || '';
        if (c.key === 'colorValue') return node.colorValue || '';
        return '';
      }

      function evalGeneric(node, depth, c) {
        var op = c.op || 'is';
        if (op === 'any-is') {
          var set = (node.rowFieldSets && node.rowFieldSets[c.key]) || [];
          return set.indexOf(c.value) !== -1;
        }
        var v = condValue(node, depth, c);
        var sv = typeof v === 'string' ? v : String(v);
        switch (op) {
          case 'is': return sv === String(c.value);
          case 'is-not': return sv !== String(c.value);
          case 'contains': return sv.toLowerCase().indexOf(String(c.value).toLowerCase()) !== -1;
          case 'not-contains': return sv.toLowerCase().indexOf(String(c.value).toLowerCase()) === -1;
          case 'in': return (c.value || []).indexOf(sv) !== -1;
          case 'blank': return sv === '';
          case 'not-blank': return sv !== '';
          case 'gte': return Number(v) >= Number(c.value);
          case 'lte': return Number(v) <= Number(c.value);
          case 'is-true': return v === true;
          default: return false;
        }
      }

      function evalLegacy(node, depth, c) {
        switch (c.type) {
          case 'depth': return depth === c.value;
          case 'depthRange': return depth >= c.min && depth <= c.max;
          case 'parentId': return index[node.id] && index[node.id].parentId === c.parentId;
          case 'value': return (node.colorValue || '') === c.value;
          case 'external': return !!node.external;
          case 'field': return String((node.fields && node.fields[c.field]) || '') === c.value;
          case 'always': return true;
          default: return false;
        }
      }

      function matchesRule(node, depth, rule) {
        if (rule.when) {
          var conds = rule.when;
          if (!conds.length) return true;              // no conditions = always
          for (var i = 0; i < conds.length; i++) {
            var c = conds[i];
            var ok = c.source ? evalGeneric(node, depth, c) : evalLegacy(node, depth, c);
            if (!ok) return false;                     // ANDed
          }
          return true;
        }
        return evalLegacy(node, depth, rule.condition || {});
      }

      // The style a legacy `color` implies: it drove the card's top band, so
      // that is what it keeps driving. Anything wanting the heavy-outline look
      // sets `border`/`borderWidth` instead and hides the band.
      function legacyStyle(rule) { return { band: rule.color }; }

      var BASE_STYLE = {
        fill: '#ffffff', border: '#c8cdd6', borderWidth: '1.5px',
        borderStyle: 'solid', band: '#c8cdd6', text: '#1a1d23'
      };

      // PER-PROPERTY CASCADE, not first-rule-wins.
      //
      // Rules are still read top to bottom, but each style property is claimed
      // by the FIRST matching rule that actually sets it — a rule that only
      // sets `borderStyle` does not stop a later rule from setting the colour.
      // That is what lets one dimension be encoded by colour and another by
      // line style, in separate rules, without every combination needing its
      // own rule (which is the combinatorial explosion this avoids).
      //
      // Backward compatible: legacy `{condition, color}` rules only ever set
      // `band`, so for them "first rule that sets band" and "first matching
      // rule" are the same rule, and existing projects render unchanged.
      function resolveStyle(node, base) {
        if (!index) reindex();
        var out = {};
        var b = base || settings.baseCardStyle || BASE_STYLE;
        for (var k in b) out[k] = b[k];

        var claimed = {};
        var rules = settings.colorRules || [];
        var depth = depthOf(node);
        for (var i = 0; i < rules.length; i++) {
          if (!matchesRule(node, depth, rules[i])) continue;
          var st = rules[i].style || legacyStyle(rules[i]);
          for (var p in st) {
            if (claimed[p]) continue;                      // an earlier rule already set it
            if (st[p] == null || st[p] === '') continue;   // unset = "don't care", fall through
            out[p] = st[p];
            claimed[p] = true;
          }
        }

        // A per-node colour override is the user pointing at one box and
        // saying "this one". It beats every rule, and it means the band.
        var ov = (settings.nodeOverrides || {})[node.id];
        if (ov && ov.color) out.band = ov.color;
        return out;
      }

      // Back-compat: callers that only want "the colour of this node" get the
      // band, which is what resolveColor has always returned.
      function resolveColor(node, fallback) {
        var st = resolveStyle(node);
        return st.band && st.band !== 'none' ? st.band : (fallback || '#9aa0ab');
      }

      // ── Connector styling ──────────────────────────────────────────────────
      // Lives here, next to the geometry, for the same reason the geometry
      // does: the webview draws the lines and the Miro exporter re-derives
      // them, and a board that disagrees with the screen is the failure mode
      // this whole module exists to prevent.

      function connectorColor() {
        return settings.connectorColor || '#9aa0ab';
      }

      // Largest subtree volume in the tree, which normalizes the scale. Walks
      // ALL nodes, not just visible ones: collapsing a section must not
      // re-scale every remaining line, or the diagram silently changes meaning
      // when someone folds a branch.
      var _maxVol = null;
      function maxVolume() {
        if (_maxVol !== null) return _maxVol;
        var m = 0;
        function walk(n) {
          var v = Number(n.vol);
          if (isFinite(v) && v > m) m = v;
          (n.children || []).forEach(walk);
        }
        getRoots().forEach(walk);
        _maxVol = m;
        return m;
      }

      // Thickness for a line carrying `vol` pages.
      //
      // The scale is compressed (sqrt), not linear. Sitemap volumes are wildly
      // skewed — a 400-page section beside a 3-page leaf — and a linear map
      // spends its whole range on the one big branch, leaving everything else
      // an indistinguishable hairline. sqrt keeps the small branches legible
      // while the big one still reads as biggest.
      //
      // Volume mode with no usable numbers (menus, or a project whose pages
      // were never assigned to the tree) degrades to the base width rather
      // than drawing every line at the cap.
      function connectorWidthFor(node) {
        var base = Number(settings.connectorWidth);
        if (!isFinite(base) || base <= 0) base = 1.5;
        if (settings.connectorWeight !== 'volume') return base;

        var max = Number(settings.connectorMaxWidth);
        if (!isFinite(max) || max <= base) max = Math.max(base, 12);

        var top = maxVolume();
        if (!top) return base;
        var v = Number(node && node.vol);
        if (!isFinite(v) || v <= 0) return base;
        return base + (max - base) * Math.sqrt(v / top);
      }

      // Flattens the tree to the nodes that are actually VISIBLE — i.e. the
      // same set compute() assigns positions to (a collapsed node's descendants
      // are laid out nowhere and must not be exported). Returns parent links so
      // callers can build edges without re-walking.
      function visibleNodes() {
        var out = [];
        function walk(node, depth, parent) {
          out.push({ node: node, depth: depth, parent: parent });
          if (node.children && node.children.length && !collapsed.has(node.id)) {
            node.children.forEach(function (c) { walk(c, depth + 1, node); });
          }
        }
        getRoots().forEach(function (r) { walk(r, 0, null); });
        return out;
      }

      return {
        consts: consts,
        shouldBeVert: shouldBeVert,
        subtreeBox: subtreeBox,
        compute: compute,
        reindex: reindex,
        depthOf: depthOf,
        resolveColor: resolveColor,
        resolveStyle: resolveStyle,
        matchesRule: matchesRule,
        visibleNodes: visibleNodes,
        connectorColor: connectorColor,
        connectorWidthFor: connectorWidthFor,
        maxVolume: maxVolume
      };
    }

    // Branches that open collapsed because they are too big to draw usefully:
    // every node below the top level with more than `autoCollapseOver` direct
    // children (0 / unset = off). A client sitemap shows "News", not 1,378
    // headlines; the collapsed card still says how many pages it hides.
    //
    // Roots are never auto-collapsed — collapsing a homepage would hide the
    // whole site. A wide root is what `rootVertOver` is for.
    //
    // Shared so the webview, the exports and the host's shape check agree on
    // exactly which nodes this is. It is a DISPLAY default: the host must not
    // write it back to the nodes' own Collapse flags.
    function autoCollapseIds(roots, settings) {
      var over = settings && settings.autoCollapseOver;
      var out = [];
      if (!(over > 0)) return out;
      (function walk(nodes, depth) {
        (nodes || []).forEach(function (n) {
          var kids = n.children || [];
          if (depth >= 1 && kids.length > over) out.push(n.id);
          walk(kids, depth + 1);
        });
      })(roots, 0);
      return out;
    }

    return { create: create, autoCollapseIds: autoCollapseIds, ROOT_GAP: ROOT_GAP, HEADING_H: HEADING_H, SHADOW: SHADOW };
  }

  var api = sitemapLayoutCore();
  // Source text for the webview, which cannot require() this file. build() in
  // sitemap-template.js injects it ahead of the engine.
  api.__source = sitemapLayoutCore.toString();

  if (typeof window !== 'undefined') window.SitemapLayout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
