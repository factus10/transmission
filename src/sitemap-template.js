// ════════════════════════════════════════════════════════════════════════════
// Visual Sitemap engine template
//
// Produces a fully self-contained HTML document implementing the interactive
// box-tree sitemap (ported from the visual-sitemap-v15 prototype and extended
// per docs handoff: color-rule engine, settings panel, legend editor, three
// run modes).
//
// Why a string template rather than rendering in the renderer directly: the
// app document runs under a strict CSP (`script-src 'self'`) that forbids inline
// scripts AND eval. The same engine must drive (a) the live in-app view, (b) the
// client-shareable export, and (c) the print/PDF source. An Electron <webview>
// (and an exported .html opened in a browser, and the hidden print window) each
// run in their own context, free of the host CSP — so the engine ships as one
// standalone HTML string reused for all three.
//
// The engine body is authored as a real function (`sitemapEngine`) for full
// editor support, then inlined via Function.prototype.toString() — this is NOT
// eval (it never runs in the app document) and avoids all the backtick/${}
// escaping pain of hand-concatenating the script. Data is injected as a JSON
// blob on `window.__SITEMAP_DATA__`; the engine reads it on load.
//
// Run modes (data.mode):
//   'app'    — full strategist UI: thresholds, settings panel, node context menu,
//              export buttons. Reports state/exports to the host via console
//              messages (the host listens on the webview 'console-message' event).
//   'client' — view/explore only: collapse/expand, pan/zoom, fit, numbers, legend.
//              No settings, no context menu, no export. Persists the viewer's
//              own changes to localStorage.
//   'print'  — static, all-expanded, print CSS + dynamic @page size, sets
//              document.title='READY' once laid out (PDF handler waits on it).
//
// Exposed: window.SitemapTemplate.build(data) -> html string
// ════════════════════════════════════════════════════════════════════════════
(function () {

  // ── The engine. Authored as a normal function; stringified into the doc.
  //    References ONLY window/document/globals — no closure over this file.
  function sitemapEngine() {
    'use strict';
    var DATA = window.__SITEMAP_DATA__ || {};
    var MODE = DATA.mode || 'app';
    var ROOTS = DATA.roots || [];
    var META = DATA.meta || {};
    var ROOT_HEADINGS = !!DATA.rootHeadings;

    // ── Effective settings (app defaults already merged with project overrides
    //    by the host). Kept mutable; edits flow back to the host (app mode) or
    //    localStorage (client mode).
    var S = Object.assign({
      vertDepth: 2, childThresh: 3,
      cardWidth: 148, cardHeight: 70,
      hGap: 40, vRow: 60, vlGap: 12, vlDrop: 32, vlHgap: 20, pad: 72,
      cardRadius: 5, cardPadX: 7, cardPadY: 5,
      showNumbers: true,
      colorRules: [],
      legendLabels: {},
      nodeOverrides: {}
    }, DATA.settings || {});
    var APP_DEFAULTS = DATA.appDefaults || null;
    S.nodeOverrides = S.nodeOverrides || {};
    S.colorRules = S.colorRules || [];

    var FALLBACK_COLOR = '#9aa0ab';
    var ROOT_GAP = 72;          // vertical gap between stacked root trees
    var HEADING_H = ROOT_HEADINGS ? 30 : 0;

    var DEFAULT_LEGEND = {
      singlePage: 'Single page',
      multiplePage: 'Multiple pages of the same type',
      rootNode: 'Homepage / site root',
      colorBand: 'Color band = node depth (customizable)',
      interactionHint: 'Click the +/− on a card → collapse/expand'
    };
    function legend(k) { return (S.legendLabels && S.legendLabels[k]) || DEFAULT_LEGEND[k]; }

    // Client-mode persistence namespace (per project, so projects don't collide).
    var LS_KEY = 'sitemap-state-' + (DATA.storageKey || 'default');

    // ── Local interaction state
    var collapsed = new Set();
    var showNumbers = S.showNumbers !== false;

    // In client mode, restore the viewer's last session (overrides their start state).
    if (MODE === 'client') {
      try {
        var saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        if (saved) {
          (saved.collapsed || []).forEach(function (id) { collapsed.add(id); });
          if (typeof saved.showNumbers === 'boolean') showNumbers = saved.showNumbers;
        } else if (DATA.initialCollapsed) {
          DATA.initialCollapsed.forEach(function (id) { collapsed.add(id); });
        }
      } catch (e) {}
    } else if (DATA.initialCollapsed) {
      // app + print both honor the caller's collapse state (print = what-you-see).
      DATA.initialCollapsed.forEach(function (id) { collapsed.add(id); });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Host messaging (app mode). The host listens on the webview's
    // 'console-message' event for lines tagged with PREFIX.
    // ════════════════════════════════════════════════════════════════════════
    var MSG_PREFIX = '@@SITEMAP@@';
    function emit(obj) {
      if (MODE !== 'app') return;
      try { console.log(MSG_PREFIX + JSON.stringify(obj)); } catch (e) {}
    }
    function currentState() {
      return {
        collapsed: [].concat.apply([], [Array.from(collapsed)]),
        showNumbers: showNumbers,
        settings: serializableSettings()
      };
    }
    function serializableSettings() {
      return {
        vertDepth: S.vertDepth, childThresh: S.childThresh,
        cardWidth: S.cardWidth, cardHeight: S.cardHeight,
        hGap: S.hGap, vRow: S.vRow, vlGap: S.vlGap, vlDrop: S.vlDrop,
        vlHgap: S.vlHgap, pad: S.pad,
        showNumbers: showNumbers,
        cardRadius: S.cardRadius, cardPadX: S.cardPadX, cardPadY: S.cardPadY,
        colorRules: S.colorRules,
        baseCardStyle: S.baseCardStyle,
        legendLabels: S.legendLabels,
        nodeOverrides: S.nodeOverrides
      };
    }
    function pushState() {
      if (MODE === 'app') emit({ type: 'state', state: currentState() });
      else if (MODE === 'client') {
        try { localStorage.setItem(LS_KEY, JSON.stringify({ collapsed: Array.from(collapsed), showNumbers: showNumbers })); } catch (e) {}
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Index nodes (id -> {node, depth, parentId, rootIndex}) and numbering
    // ════════════════════════════════════════════════════════════════════════
    var INDEX = {};
    var numMap = {};
    function indexTree(node, depth, parentId, rootIndex) {
      INDEX[node.id] = { node: node, depth: depth, parentId: parentId, rootIndex: rootIndex };
      if (node.children) node.children.forEach(function (c) { indexTree(c, depth + 1, node.id, rootIndex); });
    }
    function buildNums(node, prefix, idx) {
      var n = (node.root || node.isMenuRoot) ? '' : (prefix ? prefix + '.' + idx : '' + idx);
      numMap[node.id] = n;
      if (node.children) node.children.forEach(function (c, i) { buildNums(c, n, i + 1); });
    }
    function reindex() {
      INDEX = {}; numMap = {};
      ROOTS.forEach(function (r, i) { indexTree(r, 0, null, i); buildNums(r, '', 0); });
    }
    reindex();

    function depthOf(node) { var e = INDEX[node.id]; return e ? e.depth : 0; }

    // ════════════════════════════════════════════════════════════════════════
    // Color resolution: node override > first matching rule > fallback
    // ════════════════════════════════════════════════════════════════════════
    // Rule matching lives in sitemap-layout.js alongside the geometry, so the
    // exporter resolves a node to exactly the colour drawn here. See the note
    // there on precedence.

    // Generic "color by any host-declared field" support. The engine has no
    // built-in knowledge of which fields exist — the host (renderer.js) passes
    // DATA.fieldDefs = [{key, label, valueLabels?, valueColors?}], and every
    // node carries its raw field values on node.fields. Adding a new colorable
    // dimension is a host-side change only; nothing here needs to change.
    function fieldDefOf(key) {
      return (DATA.fieldDefs || []).filter(function (f) { return f.key === key; })[0];
    }
    function fieldValueLabel(key, val) {
      var def = fieldDefOf(key);
      if (def && def.valueLabels && (val in def.valueLabels)) return def.valueLabels[val];
      return val || '(none)';
    }
    // Where a field's value lives depends on its declared source: node fields
    // sit on node.fields, spreadsheet-derived ones on node.rowFields (the
    // dominant value across the audit rows assigned to that node).
    function fieldSourceOf(key) {
      var def = fieldDefOf(key);
      return (def && def.source) || 'node';
    }
    function nodeFieldValue(node, key) {
      var bag = fieldSourceOf(key) === 'row' ? node.rowFields : node.fields;
      return (bag && bag[key]) || '';
    }
    function distinctFieldValues(key) {
      var seen = {}, out = [];
      for (var id in INDEX) {
        var v = nodeFieldValue(INDEX[id].node, key);
        if (!(v in seen)) { seen[v] = 1; out.push(v); }
      }
      out.sort(function (a, b) { if (a === '') return 1; if (b === '') return -1; return a < b ? -1 : a > b ? 1 : 0; });
      return out;
    }
    // How many nodes actually carry each value — shown in the generator so a
    // dimension with no data reads as empty rather than silently producing a
    // one-rule "(none)" scheme.
    function fieldCoverage(key) {
      var total = 0, filled = 0;
      for (var id in INDEX) { total++; if (nodeFieldValue(INDEX[id].node, key)) filled++; }
      return { total: total, filled: filled };
    }
    function resolveColor(node) { return LAYOUT.resolveColor(node, FALLBACK_COLOR); }

    // ════════════════════════════════════════════════════════════════════════
    // Layout — ported from prototype, generalized to N stacked roots.
    // Constants come from settings so the Layout tab can tune them live.
    // ════════════════════════════════════════════════════════════════════════
    // Geometry lives in sitemap-layout.js so the Miro exporter can compute the
    // same positions host-side without a DOM. Injected ahead of this engine as
    // window.__SITEMAP_LAYOUT__; `S` and `collapsed` are passed by reference so
    // settings-panel edits and collapse toggles are picked up on next compute.
    var LAYOUT = window.__SITEMAP_LAYOUT__.create({
      roots: function () { return ROOTS; },
      settings: S,
      collapsed: collapsed,
      rootHeadings: ROOT_HEADINGS,
      headingH: HEADING_H,
      rootGap: ROOT_GAP
    });

    function L() { return LAYOUT.consts(); }
    function shouldBeVert(node, depth) { return LAYOUT.shouldBeVert(node, depth); }

    var positions = {};
    var canvasW = 100, canvasH = 100;
    var rootHeadingY = {}; // rootIndex -> y of heading
    function computeLayout() {
      var r = LAYOUT.compute();
      positions = r.positions;
      canvasW = r.canvasW;
      canvasH = r.canvasH;
      rootHeadingY = r.rootHeadingY;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Connectors
    // ════════════════════════════════════════════════════════════════════════
    function addPath(svg, d) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', d);
      svg.appendChild(el);
    }
    function drawConnectors(svg, node, depth) {
      var k = L();
      var hasKids = node.children && node.children.length && !collapsed.has(node.id);
      if (!hasKids) return;
      var pp = positions[node.id], kids = node.children;
      if (shouldBeVert(node, depth)) {
        var railX = pp.x + k.VL_HGAP * 0.5;
        var pBotX = pp.x + k.CW / 2, pBotY = pp.y + k.CH;
        var elbowY = pBotY + k.VL_DROP * 0.55;
        var lastMidY = positions[kids[kids.length - 1].id].y + k.CH / 2;
        addPath(svg, 'M ' + pBotX + ' ' + pBotY + ' L ' + pBotX + ' ' + elbowY);
        if (Math.abs(pBotX - railX) > 1) addPath(svg, 'M ' + pBotX + ' ' + elbowY + ' L ' + railX + ' ' + elbowY);
        addPath(svg, 'M ' + railX + ' ' + elbowY + ' L ' + railX + ' ' + lastMidY);
        kids.forEach(function (c) { var cy = positions[c.id].y + k.CH / 2; addPath(svg, 'M ' + railX + ' ' + cy + ' L ' + positions[c.id].x + ' ' + cy); });
      } else {
        var px = pp.x + k.CW / 2, py = pp.y + k.CH, midY = py + k.V_ROW / 2;
        var firstX = positions[kids[0].id].x + k.CW / 2;
        var lastX = positions[kids[kids.length - 1].id].x + k.CW / 2;
        addPath(svg, 'M ' + px + ' ' + py + ' L ' + px + ' ' + midY);
        if (kids.length > 1) addPath(svg, 'M ' + firstX + ' ' + midY + ' L ' + lastX + ' ' + midY);
        kids.forEach(function (c) { var cx = positions[c.id].x + k.CW / 2; addPath(svg, 'M ' + cx + ' ' + midY + ' L ' + cx + ' ' + positions[c.id].y); });
      }
      kids.forEach(function (c) { drawConnectors(svg, c, depth + 1); });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Render
    // ════════════════════════════════════════════════════════════════════════
    var ctxMenu = null;
    function removeCtx() { if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; } }

    function render() {
      computeLayout();
      // Global look settings (not per-rule): corner radius and inner padding
      // describe how a card is drawn, not what it means, so they live in the
      // Layout tab rather than the rule engine.
      var cl0 = document.getElementById('cards-layer');
      if (cl0) {
        cl0.style.setProperty('--card-radius', (S.cardRadius == null ? 5 : S.cardRadius) + 'px');
        cl0.style.setProperty('--card-pad-x', (S.cardPadX == null ? 7 : S.cardPadX) + 'px');
        cl0.style.setProperty('--card-pad-y', (S.cardPadY == null ? 5 : S.cardPadY) + 'px');
      }
      var k = L();
      var canvas = document.getElementById('canvas');
      canvas.style.width = canvasW + 'px';
      canvas.style.height = canvasH + 'px';

      var svg = document.getElementById('connector-svg');
      svg.setAttribute('width', canvasW);
      svg.setAttribute('height', canvasH);
      svg.innerHTML = '';

      var cl = document.getElementById('cards-layer');
      cl.innerHTML = '';

      ROOTS.forEach(function (root, i) { drawConnectors(svg, root, 0); });

      // Root headings (menus mode)
      if (ROOT_HEADINGS) {
        ROOTS.forEach(function (root, i) {
          var h = document.createElement('div');
          h.className = 'root-heading';
          h.style.left = k.PAD + 'px';
          h.style.top = (rootHeadingY[i] || 0) + 'px';
          h.textContent = root.label || ('Menu ' + (i + 1));
          cl.appendChild(h);
        });
      }

      ROOTS.forEach(function (root) { renderCards(root); });
      updateNumbersVisibility();
      if (MODE === 'print') setTimeout(markReady, 30);
    }

    function renderCards(node) {
      var k = L();
      var pos = positions[node.id];
      if (!pos) return;
      var isCollapsedWithKids = collapsed.has(node.id) && node.children && node.children.length;
      var card = document.createElement('div');
      var cls = 'node-card';
      if (node.root) cls += ' root';
      if (node.isMenuRoot) cls += ' menu-root';
      if (node.stacked || isCollapsedWithKids) cls += ' stacked';
      if (node.collapsible) cls += ' collapsible';
      if (node.menu === false) cls += ' dashed';
      card.className = cls;
      card.style.left = pos.x + 'px';
      card.style.top = pos.y + 'px';
      card.style.width = k.CW + 'px';
      card.style.height = k.CH + 'px';
      // Full style, not just a colour: rules can drive fill, border and text as
      // well as the top band, which is what makes the "white box, heavy
      // coloured outline" convention expressible. Legacy `color` rules resolve
      // to a band and look exactly as they did.
      // `accent` is the node's identifying colour whichever convention is in
      // play — the band in band mode, the border in outline mode. The number
      // span below is tinted with it, so it must be defined for every branch.
      var accent;
      if (node.isMenuRoot) {
        accent = '#94a3b8';
        card.style.setProperty('--section-color', accent);
      } else {
        var st = LAYOUT.resolveStyle(node);
        accent = (st.band && st.band !== 'none') ? st.band : st.border;
        card.style.setProperty('--section-color', st.band || 'transparent');
        card.style.setProperty('--card-fill', st.fill);
        card.style.setProperty('--card-border', st.border);
        card.style.setProperty('--card-bw', st.borderWidth);
        card.style.setProperty('--card-text', st.text);
        card.style.setProperty('--card-bs', st.borderStyle || 'solid');
        if (!st.band || st.band === 'none') card.classList.add('no-band');
      }

      var ov = S.nodeOverrides[node.id];
      if (MODE === 'app' && ov && (ov.layout || ov.color)) {
        card.classList.add('has-override');
        var parts = [];
        if (ov.layout) parts.push('layout: ' + ov.layout);
        if (ov.color) parts.push('color: ' + ov.color);
        card.title = 'Override (' + parts.join(', ') + ') — right-click to change';
      }

      if (showNumbers && numMap[node.id]) {
        var n = document.createElement('span');
        n.className = 'node-num';
        n.style.color = accent;
        n.textContent = numMap[node.id];
        card.appendChild(n);
      }
      var lbl = document.createElement('span');
      lbl.className = 'node-label';
      lbl.textContent = node.label;
      card.appendChild(lbl);
      if (node.sub) {
        var s = document.createElement('span');
        s.className = 'node-sub';
        s.textContent = node.sub;
        card.appendChild(s);
      }
      if (node.collapsible) {
        var dot = document.createElement('span');
        dot.className = 'toggle-dot';
        dot.textContent = collapsed.has(node.id) ? '+' : '−';
        dot.title = collapsed.has(node.id) ? 'Expand this branch' : 'Collapse this branch';
        // ONLY the +/- toggles the branch. The whole card used to be the
        // target, so an errant left-click while reaching for right-click → Set
        // color would collapse the entire subtree you were trying to colour.
        dot.addEventListener('click', function (e) {
          e.stopPropagation();
          if (collapsed.has(node.id)) collapsed.delete(node.id); else collapsed.add(node.id);
          render(); pushState();
        });
        card.appendChild(dot);
      }

      // Right-click context menu (app mode only) for any node with children
      if (MODE === 'app' && node.children && node.children.length) {
        card.addEventListener('contextmenu', function (e) { openNodeContextMenu(e, node); });
      }

      // Long labels clip to two lines, so keep the full text reachable on
      // hover. Appended rather than assigned: the override branch above may
      // already have set a title, and that information is worth keeping too.
      var fullLabel = node.label || '';
      if (fullLabel) card.title = card.title ? (fullLabel + '\n' + card.title) : fullLabel;

      document.getElementById('cards-layer').appendChild(card);
      if (node.children) node.children.forEach(renderCards);
    }

    function updateNumbersVisibility() {
      document.body.classList.toggle('hide-numbers', !showNumbers);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Node context menu — layout + color override
    // ════════════════════════════════════════════════════════════════════════
    function openNodeContextMenu(e, node) {
      e.preventDefault(); e.stopPropagation();
      removeCtx();
      var ov = S.nodeOverrides[node.id] || {};
      var curLayout = ov.layout || 'auto';
      var menu = document.createElement('div');
      menu.className = 'ctx-menu';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';

      function item(label, active, onClick) {
        var b = document.createElement('button');
        b.className = 'ctx-item' + (active ? ' active' : '');
        b.textContent = label + (active ? '   ✓' : '');
        b.addEventListener('click', function (ev) { ev.stopPropagation(); onClick(); });
        menu.appendChild(b);
      }
      function sep() { var d = document.createElement('div'); d.className = 'ctx-sep'; menu.appendChild(d); }

      item('↔  Force horizontal', curLayout === 'horiz', function () { setOverride(node.id, 'layout', curLayout === 'horiz' ? null : 'horiz'); });
      item('↕  Force vertical', curLayout === 'vert', function () { setOverride(node.id, 'layout', curLayout === 'vert' ? null : 'vert'); });
      if (curLayout !== 'auto') item('✕  Clear layout override', false, function () { setOverride(node.id, 'layout', null); });
      sep();
      // Color picker
      var colorRow = document.createElement('label');
      colorRow.className = 'ctx-item ctx-color';
      colorRow.innerHTML = '🎨  Set color';
      var ci = document.createElement('input');
      ci.type = 'color';
      ci.value = (ov.color || resolveColor(node));
      // Live preview while dragging: apply the colour and repaint at most once
      // per frame, without closing the menu or spamming the host with a state
      // message per micro-move. Commit (pushState) on `change`, when the OS
      // colour panel is dismissed.
      var colorRAF = null;
      ci.addEventListener('input', function () {
        setOverride(node.id, 'color', ci.value, { keepOpen: true, defer: true, silent: true });
        if (!colorRAF) colorRAF = requestAnimationFrame(function () { colorRAF = null; render(); });
      });
      ci.addEventListener('change', function () {
        if (colorRAF) { cancelAnimationFrame(colorRAF); colorRAF = null; }
        setOverride(node.id, 'color', ci.value, { keepOpen: true });
      });
      ci.addEventListener('click', function (ev) { ev.stopPropagation(); });
      colorRow.appendChild(ci);
      menu.appendChild(colorRow);
      if (ov.color) item('✕  Clear color override', false, function () { setOverride(node.id, 'color', null); });

      document.body.appendChild(menu);
      // keep on-screen
      var r = menu.getBoundingClientRect();
      if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 6) + 'px';
      if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 6) + 'px';
      ctxMenu = menu;
    }
    // opts: keepOpen — don't tear down the context menu (the colour picker needs
    //       this, or dragging a slider fires `input`, closes the menu, and takes
    //       the native colour panel bound to the input down with it);
    //       defer — skip the immediate render (caller renders itself, e.g. via
    //       requestAnimationFrame to coalesce a slider drag);
    //       silent — don't pushState (live preview; commit happens on change).
    function setOverride(id, key, value, opts) {
      opts = opts || {};
      var ov = S.nodeOverrides[id] || {};
      if (value === null || value === undefined || value === '') { delete ov[key]; }
      else { ov[key] = value; }
      if (Object.keys(ov).length) S.nodeOverrides[id] = ov; else delete S.nodeOverrides[id];
      if (!opts.keepOpen) removeCtx();
      if (!opts.defer) render();
      if (!opts.silent) pushState();
    }

    // ════════════════════════════════════════════════════════════════════════
    // Pan + zoom + fit
    // ════════════════════════════════════════════════════════════════════════
    var scale = 1, tx = 0, ty = 0;
    var panning = false, sx = 0, sy = 0, stx = 0, sty = 0;
    function applyXform() {
      var canvas = document.getElementById('canvas');
      canvas.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      var zl = document.getElementById('zoom-label');
      if (zl) zl.textContent = Math.round(scale * 100) + '%';
    }
    function setupPanZoom() {
      var viewport = document.getElementById('viewport');
      viewport.addEventListener('wheel', function (e) {
        e.preventDefault();
        var r = viewport.getBoundingClientRect();
        var mx = e.clientX - r.left, my = e.clientY - r.top;
        var MAX = 80;
        var raw = Math.max(-MAX, Math.min(MAX, e.deltaY));
        var factor = 1 + (raw / MAX) * 0.18;
        var ns = Math.min(3, Math.max(0.10, scale * factor));
        tx = mx - (mx - tx) * (ns / scale);
        ty = my - (my - ty) * (ns / scale);
        scale = ns; applyXform();
      }, { passive: false });
      viewport.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || e.target.closest('.node-card') || e.target.closest('.ctx-menu')) return;
        panning = true; viewport.classList.add('panning');
        sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
        viewport.setPointerCapture(e.pointerId);
      });
      viewport.addEventListener('pointermove', function (e) {
        if (!panning) return;
        tx = stx + (e.clientX - sx); ty = sty + (e.clientY - sy); applyXform();
      });
      viewport.addEventListener('pointerup', function () { panning = false; viewport.classList.remove('panning'); });
    }
    function fitToScreen() {
      var viewport = document.getElementById('viewport');
      var vw = viewport.clientWidth, vh = viewport.clientHeight, margin = 32;
      var s = Math.min((vw - margin * 2) / canvasW, (vh - margin * 2) / canvasH);
      scale = Math.max(0.10, Math.min(1, s));
      tx = (vw - canvasW * scale) / 2; ty = Math.max(margin, (vh - canvasH * scale) / 2);
      applyXform();
    }

    // ════════════════════════════════════════════════════════════════════════
    // Toolbar wiring + settings panel + legend
    // ════════════════════════════════════════════════════════════════════════
    function expandAll() { collapsed.clear(); render(); pushState(); }
    function collapseAll() {
      function mark(n) { if (n.collapsible) collapsed.add(n.id); if (n.children) n.children.forEach(mark); }
      ROOTS.forEach(mark); render(); pushState();
    }

    function $(id) { return document.getElementById(id); }
    function wireToolbar() {
      if ($('btn-fit')) $('btn-fit').addEventListener('click', fitToScreen);
      if ($('btn-expand')) $('btn-expand').addEventListener('click', expandAll);
      if ($('btn-collapse')) $('btn-collapse').addEventListener('click', collapseAll);
      if ($('btn-reset')) $('btn-reset').addEventListener('click', function () {
        collapsed.clear();
        if (DATA.initialCollapsed) DATA.initialCollapsed.forEach(function (id) { collapsed.add(id); });
        render(); pushState(); fitToScreen();
      });
      var sn = $('show-numbers');
      if (sn) {
        sn.checked = showNumbers;
        sn.addEventListener('change', function (e) { showNumbers = e.target.checked; updateNumbersVisibility(); render(); pushState(); });
      }
      var vd = $('vd-select');
      if (vd) { vd.value = String(S.vertDepth); vd.addEventListener('change', function () { S.vertDepth = parseInt(this.value, 10); render(); pushState(); fitToScreen(); }); }
      var ct = $('ct-select');
      if (ct) { ct.value = String(S.childThresh); ct.addEventListener('change', function () { S.childThresh = parseInt(this.value, 10); render(); pushState(); fitToScreen(); }); }
      if ($('legend-btn')) $('legend-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        var opening = !this.classList.contains('open');
        this.classList.toggle('open');
        // The panel is position:fixed (see CSS), so anchor it under the button
        // each open — the button's x shifts with window width and toolbar scroll.
        if (opening) {
          var r = this.getBoundingClientRect();
          var lp = $('legend-panel');
          lp.style.top = (r.bottom + 8) + 'px';
          lp.style.right = Math.max(6, window.innerWidth - r.right) + 'px';
          lp.style.left = 'auto';
        }
      });
      if ($('btn-settings')) $('btn-settings').addEventListener('click', function (e) { e.stopPropagation(); openSettings(); });
      if ($('btn-export-client')) $('btn-export-client').addEventListener('click', function () { emit({ type: 'export', format: 'client', state: currentState() }); });
      if ($('btn-export-pdf')) $('btn-export-pdf').addEventListener('click', function () { emit({ type: 'export', format: 'pdf', state: currentState() }); });
      if ($('btn-export-miro')) $('btn-export-miro').addEventListener('click', function () { emit({ type: 'export', format: 'miro', state: currentState() }); });

      document.addEventListener('click', function () {
        removeCtx();
        var lb = $('legend-btn'); if (lb) lb.classList.remove('open');
      });
      var hint = $('hint');
      if (hint) setTimeout(function () { hint.style.opacity = '0'; }, 4000);
    }

    function fillLegend() {
      var el = $('legend-body');
      if (!el) return;
      el.innerHTML =
        '<div class="legend-row"><div class="l-card"></div> ' + esc(legend('singlePage')) + '</div>' +
        '<div class="legend-row"><div class="l-card stacked"></div> ' + esc(legend('multiplePage')) + '</div>' +
        '<div class="legend-row"><div class="l-card" style="border:2px solid #1a3a6b"></div> ' + esc(legend('rootNode')) + '</div>' +
        '<hr>' +
        '<div class="legend-note">' + esc(legend('interactionHint')) + '<br><b>Scroll</b> to zoom &middot; <b>Drag</b> to pan<br>' + esc(legend('colorBand')) + '</div>';
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

    // ── Settings modal (Layout / Colors / Legend) ──
    var settingsTab = 'layout';
    function openSettings() {
      var ov = document.createElement('div');
      ov.className = 'sp-overlay';
      ov.id = 'sp-overlay';
      ov.innerHTML =
        '<div class="sp-modal">' +
        '  <div class="sp-head"><span>Sitemap settings</span><button class="sp-x" id="sp-close">✕</button></div>' +
        '  <div class="sp-tabs">' +
        '    <button data-tab="layout" class="sp-tab">Layout</button>' +
        '    <button data-tab="colors" class="sp-tab">Colors</button>' +
        '    <button data-tab="legend" class="sp-tab">Legend</button>' +
        '  </div>' +
        '  <div class="sp-body" id="sp-body"></div>' +
        '  <div class="sp-foot">' +
        '    <button class="sp-btn" id="sp-savedefaults">Save as my defaults</button>' +
        '    <span style="flex:1"></span>' +
        '    <button class="sp-btn" id="sp-reset">Reset to defaults</button>' +
        '    <button class="sp-btn sp-primary" id="sp-done">Done</button>' +
        '  </div>' +
        '</div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) closeSettings(); });
      $('sp-close').addEventListener('click', closeSettings);
      $('sp-done').addEventListener('click', closeSettings);
      $('sp-savedefaults').addEventListener('click', function () {
        emit({ type: 'saveDefaults', settings: serializableSettings() });
        flash($('sp-savedefaults'), 'Saved ✓');
      });
      $('sp-reset').addEventListener('click', function () {
        if (!APP_DEFAULTS) return;
        ['vertDepth', 'childThresh', 'cardWidth', 'cardHeight', 'hGap', 'vRow', 'vlGap', 'vlDrop', 'vlHgap', 'pad'].forEach(function (kk) {
          if (APP_DEFAULTS[kk] != null) S[kk] = APP_DEFAULTS[kk];
        });
        if (APP_DEFAULTS.colorRules) S.colorRules = JSON.parse(JSON.stringify(APP_DEFAULTS.colorRules));
        if (APP_DEFAULTS.legendLabels) S.legendLabels = Object.assign({}, APP_DEFAULTS.legendLabels);
        render(); fillLegend(); pushState(); renderSettingsBody();
      });
      Array.prototype.forEach.call(ov.querySelectorAll('.sp-tab'), function (t) {
        t.addEventListener('click', function () { settingsTab = t.getAttribute('data-tab'); renderSettingsBody(); });
      });
      renderSettingsBody();
    }
    function closeSettings() { var o = $('sp-overlay'); if (o) o.remove(); }
    function flash(btn, txt) { var old = btn.textContent; btn.textContent = txt; setTimeout(function () { btn.textContent = old; }, 1200); }

    function renderSettingsBody() {
      Array.prototype.forEach.call(document.querySelectorAll('.sp-tab'), function (t) {
        t.classList.toggle('active', t.getAttribute('data-tab') === settingsTab);
      });
      var body = $('sp-body');
      if (settingsTab === 'layout') body.innerHTML = layoutTabHtml(), wireLayoutTab();
      else if (settingsTab === 'colors') renderColorsTab();
      else renderLegendTab();
    }

    var NUM_FIELDS = [
      ['cardWidth', 'Card width'], ['cardHeight', 'Card height'],
      ['hGap', 'Horizontal gap'], ['vRow', 'Vertical row gap'],
      ['vlGap', 'Vertical list gap'], ['vlDrop', 'Vertical drop'],
      ['vlHgap', 'Vertical indent'], ['pad', 'Canvas padding'],
      ['cardRadius', 'Corner radius'], ['cardPadX', 'Padding L/R'], ['cardPadY', 'Padding top/btm']
    ];
    function layoutTabHtml() {
      var rows = NUM_FIELDS.map(function (f) {
        return '<label class="sp-field"><span>' + f[1] + '</span><input type="number" data-key="' + f[0] + '" value="' + S[f[0]] + '"></label>';
      }).join('');
      return '<div class="sp-grid">' + rows + '</div>' +
        '<p class="sp-help">Layout dimensions in pixels. Changes preview live. ' +
        'Note for Miro export: corner radius exports as square vs rounded only (Miro has no radius setting), ' +
        'and inner padding is app-only \u2014 Miro centres shape text itself.</p>';
    }
    function wireLayoutTab() {
      Array.prototype.forEach.call(document.querySelectorAll('#sp-body input[data-key]'), function (inp) {
        inp.addEventListener('input', function () {
          var key = inp.getAttribute('data-key');
          var v = parseInt(inp.value, 10);
          if (isNaN(v) || v < 0) return;
          // Padding eats the label's room; the card is already tight enough that
          // an unbounded value silently clips every label. Cap rather than let
          // the user discover that the hard way.
          if (key === 'cardPadX') v = Math.min(v, Math.floor(S.cardWidth / 3));
          if (key === 'cardPadY') v = Math.min(v, Math.floor(S.cardHeight / 3));
          if (key === 'cardRadius') v = Math.min(v, Math.floor(Math.min(S.cardWidth, S.cardHeight) / 2));
          if (String(v) !== inp.value) inp.value = String(v);
          S[key] = v; render(); pushState();
        });
      });
    }

    // ── Colors tab ──
    //
    // A rule is { label, when: [conditions], style: {...} }, evaluated top to
    // bottom, first match wins, style merged over the base card style. The
    // older { condition, color } shape is still accepted everywhere (it means
    // "set the top band to this colour") so existing projects open unchanged;
    // legacyToWhen() is the only place that needs to know the difference.

    var OPS = [
      { op: 'is', label: 'is' },
      { op: 'is-not', label: 'is not' },
      { op: 'any-is', label: 'any page is', rowOnly: true },
      { op: 'contains', label: 'contains' },
      { op: 'not-contains', label: 'does not contain' },
      { op: 'blank', label: 'is blank', noValue: true },
      { op: 'not-blank', label: 'is set', noValue: true }
    ];

    function legacyToWhen(rule) {
      if (rule.when) return rule.when;
      var c = rule.condition || {};
      return c.type === 'always' ? [] : [c];
    }
    function ruleStyleOf(rule) {
      return rule.style || { band: rule.color };
    }

    function condSummary(c) {
      if (!c) return '';
      if (c.source) {
        var d = fieldDefOf(c.key);
        var name = d ? d.label : (c.key === 'depth' ? 'Depth' : c.key);
        var opDef = OPS.filter(function (o) { return o.op === c.op; })[0];
        var opLabel = opDef ? opDef.label : c.op;
        if (opDef && opDef.noValue) return name + ' ' + opLabel;
        return name + ' ' + opLabel + ' ' + fieldValueLabel(c.key, c.value);
      }
      switch (c.type) {
        case 'depth': return 'Depth = ' + c.value;
        case 'depthRange': return 'Depth ' + c.min + '–' + c.max;
        case 'parentId': return 'Child of ' + (INDEX[c.parentId] ? INDEX[c.parentId].node.label : c.parentId);
        case 'value': return 'Tag: ' + c.value;
        case 'external': return 'Links to another site';
        case 'field': { var def = fieldDefOf(c.field); return (def ? def.label : c.field) + ': ' + fieldValueLabel(c.field, c.value); }
        case 'always': return 'All other nodes';
        default: return c.type;
      }
    }
    function ruleSummary(rule) {
      var w = legacyToWhen(rule);
      if (!w.length) return 'All other nodes';
      return w.map(condSummary).join('  ·  and  ·  ');
    }
    // A miniature of the card the rule produces, so the list reads as what you
    // will actually see rather than a row of undifferentiated colour chips.
    function stylePreviewHtml(rule) {
      var st = ruleStyleOf(rule);
      var base = S.baseCardStyle || {};
      var fill = st.fill || base.fill || '#ffffff';
      var border = st.border || base.border || '#c8cdd6';
      var bw = st.borderWidth || base.borderWidth || '1.5px';
      var band = st.band == null ? base.band : st.band;
      var bandHtml = (band && band !== 'none')
        ? '<i style="position:absolute;top:0;left:0;right:0;height:3px;background:' + esc(band) + ';border-radius:3px 3px 0 0"></i>' : '';
      var bs = st.borderStyle || base.borderStyle || 'solid';
      return '<span class="sp-rule-prev" style="background:' + esc(fill) + ';border:' + esc(bw) + ' ' + esc(bs) + ' ' + esc(border) +
        ';border-radius:' + (S.cardRadius == null ? 5 : S.cardRadius) + 'px">' + bandHtml + '</span>';
    }
    function renderColorsTab() {
      var body = $('sp-body');

      // Style mode. "Outline" is the convention most sitemap decks use — white
      // box, heavy coloured border — and reads better at 400 nodes than filled
      // boxes, which turn into a quilt.
      var mode = (S.baseCardStyle && S.baseCardStyle.band === 'none') ? 'outline' : 'band';
      var html = '<div class="sp-stylemode">' +
        '<span>Card style</span>' +
        '<button class="sp-seg' + (mode === 'band' ? ' on' : '') + '" id="sp-mode-band">Colour band</button>' +
        '<button class="sp-seg' + (mode === 'outline' ? ' on' : '') + '" id="sp-mode-outline">Heavy outline</button>' +
        '</div>';

      html += '<div class="sp-rules" id="sp-rules">';
      S.colorRules.forEach(function (rule, i) {
        html += '<div class="sp-rule" data-i="' + i + '">' +
          '<span class="sp-rule-move" title="Drag to reorder" draggable="true">☰</span>' +
          stylePreviewHtml(rule) +
          '<span class="sp-rule-label">' + esc(rule.label || '(unnamed)') + '<small>' + esc(ruleSummary(rule)) + '</small></span>' +
          '<button class="sp-rule-edit" title="Edit rule">✎</button>' +
          '<button class="sp-rule-del" title="Delete rule">✕</button>' +
          '</div>';
      });
      if (!S.colorRules.length) html += '<p class="sp-help" style="padding:10px">No rules yet — use a generator below to start.</p>';
      html += '</div>';
      html += '<div class="sp-rule-add">' +
        '<button class="sp-btn" id="sp-add-rule">+ Add rule</button>' +
        '<button class="sp-btn" id="sp-gen-depth">By depth</button>' +
        '<button class="sp-btn" id="sp-gen-section">By section</button>' +
        '<button class="sp-btn" id="sp-mark-external">Mark external</button>' +
        '</div>';
      if (DATA.fieldDefs && DATA.fieldDefs.length) {
        // Coverage in the option label answers "why did colouring by Content
        // Type give me one grey rule" before the user has to ask it.
        html += '<div class="sp-rule-add">' +
          '<select id="sp-field-select" style="flex:1;min-width:0">' + DATA.fieldDefs.map(function (f) {
            var cov = fieldCoverage(f.key);
            var note = cov.filled ? (cov.filled + '/' + cov.total) : 'no data';
            return '<option value="' + esc(f.key) + '"' + (cov.filled ? '' : ' disabled') + '>' + esc(f.label) + ' — ' + note + '</option>';
          }).join('') + '</select>' +
          '<button class="sp-btn" id="sp-gen-field">Colour by this</button>' +
          '</div>';
      }
      // node color overrides list
      var ovIds = Object.keys(S.nodeOverrides).filter(function (id) { return S.nodeOverrides[id].color; });
      if (ovIds.length) {
        html += '<div class="sp-subhead">Node color overrides</div><div class="sp-overrides">';
        ovIds.forEach(function (id) {
          var node = INDEX[id] ? INDEX[id].node : null;
          html += '<div class="sp-ovrow"><span class="sw" style="background:' + S.nodeOverrides[id].color + '"></span>' +
            '<span class="sp-ovlabel">' + esc(node ? node.label : id) + '</span>' +
            '<button class="sp-ov-del" data-id="' + id + '">✕</button></div>';
        });
        html += '</div>';
      }
      html += '<p class="sp-help">Rules are read top to bottom. Each property (colour, fill, line style) is taken from the first matching rule that sets it, so you can encode one dimension by colour and another by line style in separate rules. A node’s own colour (right-click → Set color) overrides all rules.</p>';
      body.innerHTML = html;
      wireColorsTab();
    }
    // Switches the whole scheme between the two conventions in place, keeping
    // each rule's colour: in band mode the colour is the top strip; in outline
    // mode it becomes a 3px border and the strip is dropped.
    function applyStyleMode(mode) {
      var outline = mode === 'outline';
      S.baseCardStyle = outline
        ? { fill: '#ffffff', border: '#c8cdd6', borderWidth: '3px', band: 'none', text: '#1a1d23' }
        : { fill: '#ffffff', border: '#c8cdd6', borderWidth: '1.5px', band: '#c8cdd6', text: '#1a1d23' };
      S.colorRules = S.colorRules.map(function (r) {
        var st = ruleStyleOf(r);
        var colour = st.band && st.band !== 'none' ? st.band : st.border;
        if (!colour) return r;
        return {
          id: r.id, label: r.label, when: legacyToWhen(r),
          style: outline
            ? { border: colour, borderWidth: '3px', band: 'none' }
            : { band: colour, borderWidth: '1.5px' }
        };
      });
      render(); pushState(); renderColorsTab();
    }

    function wireColorsTab() {
      $('sp-mode-band').addEventListener('click', function () { applyStyleMode('band'); });
      $('sp-mode-outline').addEventListener('click', function () { applyStyleMode('outline'); });

      Array.prototype.forEach.call(document.querySelectorAll('.sp-rule'), function (row) {
        var i = parseInt(row.getAttribute('data-i'), 10);
        row.querySelector('.sp-rule-edit').addEventListener('click', function () { openRuleEditor(i); });
        row.querySelector('.sp-rule-del').addEventListener('click', function () { S.colorRules.splice(i, 1); render(); pushState(); renderColorsTab(); });
        var grip = row.querySelector('.sp-rule-move');
        grip.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(i)); row.classList.add('dragging'); });
        grip.addEventListener('dragend', function () { row.classList.remove('dragging'); });
        row.addEventListener('dragover', function (e) { e.preventDefault(); });
        row.addEventListener('drop', function (e) {
          e.preventDefault();
          var from = parseInt(e.dataTransfer.getData('text/plain'), 10);
          var to = i;
          if (from === to || isNaN(from)) return;
          var moved = S.colorRules.splice(from, 1)[0];
          S.colorRules.splice(to, 0, moved);
          render(); pushState(); renderColorsTab();
        });
      });
      $('sp-add-rule').addEventListener('click', function () { openRuleEditor(); });
      $('sp-gen-depth').addEventListener('click', function () { S.colorRules = genDepthRules(); render(); pushState(); renderColorsTab(); });
      $('sp-gen-section').addEventListener('click', function () { S.colorRules = genSectionRules(); render(); pushState(); renderColorsTab(); });
      $('sp-mark-external').addEventListener('click', function () {
        var hasExternal = S.colorRules.some(function (r) {
          if (r.condition && r.condition.type === 'external') return true;
          return (r.when || []).some(function (c) { return c.key === 'external' || c.type === 'external'; });
        });
        if (hasExternal) { flash(this, 'Already added'); return; }
        // Unshifted to the very top: external links should stand out regardless of
        // whatever depth/section scheme is already active, so it must win first-match.
        S.colorRules.unshift({ id: 'r-external', label: 'Links to another site', when: [{ source: 'tree', key: 'external', op: 'is-true' }], style: styleFor('#c77b1f') });
        render(); pushState(); renderColorsTab();
      });
      if ($('sp-gen-field')) {
        $('sp-gen-field').addEventListener('click', function () {
          S.colorRules = genFieldRules($('sp-field-select').value);
          render(); pushState(); renderColorsTab();
        });
      }
      Array.prototype.forEach.call(document.querySelectorAll('.sp-ov-del'), function (b) {
        b.addEventListener('click', function () { setOverride(b.getAttribute('data-id'), 'color', null); renderColorsTab(); });
      });
    }
    // Every generator emits rules through this, so a generated scheme always
    // matches the currently selected card style instead of resetting it.
    function styleFor(colour) {
      var outline = S.baseCardStyle && S.baseCardStyle.band === 'none';
      return outline
        ? { border: colour, borderWidth: '3px', band: 'none' }
        : { band: colour, borderWidth: '1.5px' };
    }

    function genDepthRules() {
      var pal = DATA.palette || ['#2d6a9f', '#1e7a4e', '#7a3a9f', '#9f6a1e', '#2d7a7a', '#7a2d2d'];
      var maxDepth = 0;
      for (var id in INDEX) { if (INDEX[id].depth > maxDepth) maxDepth = INDEX[id].depth; }
      var rules = [{ id: 'r-root', label: 'Homepage / root', when: [{ source: 'tree', key: 'depth', op: 'is', value: 0 }], style: styleFor(DATA.rootColor || '#1a3a6b') }];
      for (var d = 1; d <= maxDepth; d++) {
        rules.push({ id: 'r-depth-' + d, label: 'Depth ' + d, when: [{ source: 'tree', key: 'depth', op: 'is', value: d }], style: styleFor(pal[(d - 1) % pal.length]) });
      }
      rules.push({ id: 'r-fallback', label: 'Everything else', when: [], style: styleFor(FALLBACK_COLOR) });
      return rules;
    }
    function genSectionRules() {
      // Color a whole section by matching every node's colorValue (the renderer
      // stamps each node's top-level section label onto colorValue), so the
      // section node AND its descendants share one color.
      var pal = DATA.palette || ['#2d6a9f', '#1e7a4e', '#7a3a9f', '#9f6a1e', '#2d7a7a', '#7a2d2d'];
      var rules = [{ id: 'r-root', label: 'Homepage / root', when: [{ source: 'tree', key: 'depth', op: 'is', value: 0 }], style: styleFor(DATA.rootColor || '#1a3a6b') }];
      var seen = {};
      topLevelSections().forEach(function (sec, i) {
        var val = sec.colorValue || sec.label;
        if (seen[val]) return; seen[val] = 1;
        rules.push({ id: 'r-sec-' + sec.id, label: sec.label, when: [{ source: 'tree', key: 'colorValue', op: 'is', value: val }], style: styleFor(pal[i % pal.length]) });
      });
      rules.push({ id: 'r-fallback', label: 'Everything else', when: [], style: styleFor(FALLBACK_COLOR) });
      return rules;
    }
    function genFieldRules(key) {
      // One value-rule per distinct value actually present for this field (including
      // blank, so gaps are visible), reusing a host-supplied color per value when
      // available (e.g. Page Status already has user-assigned colors elsewhere in the
      // app) and falling back to the palette otherwise.
      var pal = DATA.palette || ['#2d6a9f', '#1e7a4e', '#7a3a9f', '#9f6a1e', '#2d7a7a', '#7a2d2d'];
      var def = fieldDefOf(key) || {};
      var src = fieldSourceOf(key);
      var rules = distinctFieldValues(key).map(function (v, i) {
        var color = (def.valueColors && def.valueColors[v]) || pal[i % pal.length];
        return { id: 'r-field-' + key + '-' + i, label: fieldValueLabel(key, v), when: [{ source: src, key: key, op: 'is', value: v }], style: styleFor(color) };
      });
      rules.push({ id: 'r-fallback', label: 'Everything else', when: [], style: styleFor(FALLBACK_COLOR) });
      return rules;
    }
    function topLevelSections() {
      // depth-1 nodes across all roots
      var out = [];
      ROOTS.forEach(function (root) { (root.children || []).forEach(function (c) { out.push(c); }); });
      return out;
    }

    // Rule editor. Handles both add (no index) and edit (index of the rule).
    // Conditions are ANDed and built from one flat list of dimensions:
    // structural ones the engine knows natively, plus every field the host
    // declared — node properties and spreadsheet-derived columns alike.
    function ruleDimensions() {
      var dims = [
        { v: 'tree:depth', label: 'Depth', kind: 'number' },
        { v: 'tree:colorValue', label: 'Top-level section', kind: 'section' },
        { v: 'tree:external', label: 'Links to another site', kind: 'bool' }
      ];
      (DATA.fieldDefs || []).forEach(function (f) {
        dims.push({ v: (f.source || 'node') + ':' + f.key, label: f.label, kind: 'field', key: f.key, source: f.source || 'node' });
      });
      return dims;
    }

    function openRuleEditor(editIndex) {
      var editing = typeof editIndex === 'number';
      var existing = editing ? S.colorRules[editIndex] : null;
      var dims = ruleDimensions();
      var conds = existing ? legacyToWhen(existing).map(function (c) {
        // Normalise a legacy condition into the generic shape for editing, so
        // the editor only ever deals with one representation.
        if (c.source) return { source: c.source, key: c.key, op: c.op || 'is', value: c.value };
        if (c.type === 'depth') return { source: 'tree', key: 'depth', op: 'is', value: c.value };
        if (c.type === 'external') return { source: 'tree', key: 'external', op: 'is-true' };
        if (c.type === 'value') return { source: 'tree', key: 'colorValue', op: 'is', value: c.value };
        if (c.type === 'field') return { source: fieldSourceOf(c.field), key: c.field, op: 'is', value: c.value };
        return { source: 'tree', key: 'depth', op: 'is', value: 0 };
      }) : [];

      var st0 = existing ? ruleStyleOf(existing) : {};
      var colour0 = (st0.band && st0.band !== 'none' ? st0.band : st0.border) || '#2d6a9f';
      // A new rule sets a colour by default; an existing one only if it has one.
      // Without this, every rule would claim the colour property and a
      // line-style-only rule could never fall through to a colour rule below it.
      var colourSet = existing ? !!((st0.band && st0.band !== 'none') || st0.border) : true;

      var ov = document.createElement('div');
      ov.className = 'sp-overlay'; ov.style.zIndex = 2000;
      ov.innerHTML =
        '<div class="sp-modal" style="width:430px;">' +
        '<div class="sp-head"><span>' + (editing ? 'Edit' : 'Add') + ' colour rule</span><button class="sp-x" id="re-x">✕</button></div>' +
        '<div class="sp-body">' +
        '<label class="sp-field"><span>Label</span><input type="text" id="re-label" placeholder="e.g. Articles" value="' + esc(existing ? (existing.label || '') : '') + '"></label>' +
        '<div class="sp-subhead" style="margin-top:4px">Applies when <small style="font-weight:400">(all must match)</small></div>' +
        '<div id="re-conds"></div>' +
        '<button class="sp-btn" id="re-add-cond" style="margin-top:6px">+ Add condition</button>' +
        '<p class="sp-help" id="re-anyhint" style="margin-top:6px"></p>' +
        '<div class="sp-subhead" style="margin-top:10px">Appearance</div>' +
        '<label class="sp-field"><span>Colour</span>' +
        '<span style="display:flex;gap:6px;align-items:center;flex:1">' +
        '<input type="checkbox" id="re-colour-on"' + (colourSet ? ' checked' : '') + ' title="Uncheck to leave colour to another rule">' +
        '<input type="color" id="re-colour" value="' + esc(colour0) + '"' + (colourSet ? '' : ' disabled') + '>' +
        '</span></label>' +
        '<label class="sp-field"><span>Line style</span><select id="re-linestyle">' +
        ['', 'solid', 'dashed', 'dotted'].map(function (v) {
          var lbl = v === '' ? '— leave unset —' : (v.charAt(0).toUpperCase() + v.slice(1));
          return '<option value="' + v + '"' + ((st0.borderStyle || '') === v ? ' selected' : '') + '>' + lbl + '</option>';
        }).join('') + '</select></label>' +
        '<label class="sp-field"><span>Fill</span><input type="color" id="re-fill" value="' + esc(st0.fill || (S.baseCardStyle && S.baseCardStyle.fill) || '#ffffff') + '"></label>' +
        '</div>' +
        '<div class="sp-foot"><span style="flex:1"></span><button class="sp-btn" id="re-cancel">Cancel</button>' +
        '<button class="sp-btn sp-primary" id="re-save">' + (editing ? 'Save' : 'Add') + '</button></div>' +
        '</div>';
      document.body.appendChild(ov);

      function valueControl(c, idx) {
        var dim = dims.filter(function (d) { return d.v === c.source + ':' + c.key; })[0];
        var opDef = OPS.filter(function (o) { return o.op === c.op; })[0];
        if (c.op === 'is-true' || (opDef && opDef.noValue)) return '<span class="re-val-none">—</span>';
        if (dim && dim.kind === 'number') return '<input type="number" class="re-val" data-i="' + idx + '" value="' + esc(String(c.value == null ? 0 : c.value)) + '" min="0">';
        if (dim && dim.kind === 'section') {
          return '<select class="re-val" data-i="' + idx + '">' + topLevelSections().map(function (sc) {
            var v = sc.colorValue || sc.label;
            return '<option value="' + esc(v) + '"' + (v === c.value ? ' selected' : '') + '>' + esc(sc.label) + '</option>';
          }).join('') + '</select>';
        }
        if (dim && dim.kind === 'field') {
          var vals = distinctFieldValues(dim.key);
          return '<select class="re-val" data-i="' + idx + '">' + vals.map(function (v) {
            return '<option value="' + esc(v) + '"' + (v === c.value ? ' selected' : '') + '>' + esc(fieldValueLabel(dim.key, v)) + '</option>';
          }).join('') + '</select>';
        }
        return '<input type="text" class="re-val" data-i="' + idx + '" value="' + esc(String(c.value == null ? '' : c.value)) + '">';
      }

      function renderConds() {
        var box = ov.querySelector('#re-conds');
        if (!conds.length) {
          box.innerHTML = '<p class="sp-help">No conditions — this rule matches every node (use it as the catch-all, last in the list).</p>';
        } else {
          box.innerHTML = conds.map(function (c, i) {
            var dimV = c.source + ':' + c.key;
            var isRow = c.source === 'row';
            return '<div class="re-cond" data-i="' + i + '">' +
              '<select class="re-dim" data-i="' + i + '">' + dims.map(function (d) {
                return '<option value="' + esc(d.v) + '"' + (d.v === dimV ? ' selected' : '') + '>' + esc(d.label) + '</option>';
              }).join('') + '</select>' +
              '<select class="re-op" data-i="' + i + '">' + OPS.filter(function (o) {
                return !o.rowOnly || isRow;          // "any page is" only means something for row data
              }).map(function (o) {
                return '<option value="' + o.op + '"' + (o.op === c.op ? ' selected' : '') + '>' + esc(o.label) + '</option>';
              }).join('') + '</select>' +
              valueControl(c, i) +
              '<button class="re-cond-del" data-i="' + i + '" title="Remove">✕</button>' +
              '</div>';
          }).join('');
        }
        // Explain any-is where it applies, since it is the non-obvious one.
        var hasAny = conds.some(function (c) { return c.op === 'any-is'; });
        ov.querySelector('#re-anyhint').textContent = hasAny
          ? '“any page is” matches when ANY audit row on the node has that value — use it to flag a section that merely contains something.'
          : 'Row fields use the node’s dominant value (what its pages mostly are).';

        Array.prototype.forEach.call(ov.querySelectorAll('.re-dim'), function (sel) {
          sel.addEventListener('change', function () {
            var i = +sel.getAttribute('data-i');
            var parts = sel.value.split(':');
            conds[i].source = parts[0]; conds[i].key = parts.slice(1).join(':');
            if (conds[i].key === 'external') conds[i].op = 'is-true';
            else if (conds[i].op === 'is-true') conds[i].op = 'is';
            if (conds[i].source !== 'row' && conds[i].op === 'any-is') conds[i].op = 'is';
            conds[i].value = undefined;
            renderConds();
          });
        });
        Array.prototype.forEach.call(ov.querySelectorAll('.re-op'), function (sel) {
          sel.addEventListener('change', function () { conds[+sel.getAttribute('data-i')].op = sel.value; renderConds(); });
        });
        Array.prototype.forEach.call(ov.querySelectorAll('.re-val'), function (inp) {
          inp.addEventListener('input', function () {
            var i = +inp.getAttribute('data-i');
            conds[i].value = inp.type === 'number' ? (parseInt(inp.value, 10) || 0) : inp.value;
          });
          inp.addEventListener('change', function () {
            var i = +inp.getAttribute('data-i');
            conds[i].value = inp.type === 'number' ? (parseInt(inp.value, 10) || 0) : inp.value;
          });
        });
        Array.prototype.forEach.call(ov.querySelectorAll('.re-cond-del'), function (b) {
          b.addEventListener('click', function () { conds.splice(+b.getAttribute('data-i'), 1); renderConds(); });
        });
      }
      renderConds();

      var colourOn = ov.querySelector('#re-colour-on');
      if (colourOn) {
        colourOn.addEventListener('change', function () {
          ov.querySelector('#re-colour').disabled = !colourOn.checked;
        });
      }

      ov.querySelector('#re-add-cond').addEventListener('click', function () {
        conds.push({ source: 'tree', key: 'depth', op: 'is', value: 1 });
        renderConds();
      });

      function close() { ov.remove(); }
      ov.querySelector('#re-x').addEventListener('click', close);
      ov.querySelector('#re-cancel').addEventListener('click', close);
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

      ov.querySelector('#re-save').addEventListener('click', function () {
        // Default a select-backed condition to its first option when the user
        // never touched it, rather than saving an undefined value that matches
        // nothing and looks like a broken rule.
        conds.forEach(function (c) {
          if (c.value !== undefined || c.op === 'is-true') return;
          var dim = dims.filter(function (d) { return d.v === c.source + ':' + c.key; })[0];
          if (dim && dim.kind === 'field') c.value = distinctFieldValues(dim.key)[0] || '';
          else if (dim && dim.kind === 'section') { var t = topLevelSections()[0]; c.value = t ? (t.colorValue || t.label) : ''; }
          else if (dim && dim.kind === 'number') c.value = 0;
          else c.value = '';
        });
        // Unset properties are "don't care" and fall through to the next
        // matching rule that sets them — this is what makes colour-in-one-rule
        // and line-style-in-another work regardless of their order.
        var style = ov.querySelector('#re-colour-on').checked
          ? styleFor(ov.querySelector('#re-colour').value)
          : {};
        var fill = ov.querySelector('#re-fill').value;
        if (fill && fill.toLowerCase() !== ((S.baseCardStyle && S.baseCardStyle.fill) || '#ffffff').toLowerCase()) style.fill = fill;
        // Left unset, this property falls through to whatever later rule claims
        // it — that is what lets colour and line style live in separate rules.
        var ls = ov.querySelector('#re-linestyle').value;
        if (ls) style.borderStyle = ls;
        var rule = {
          id: existing ? existing.id : ('r-' + (S.colorRules.length + 1) + '-' + conds.length),
          label: ov.querySelector('#re-label').value || (conds.length ? conds.map(condSummary).join(' and ') : 'All other nodes'),
          when: conds,
          style: style
        };
        if (editing) S.colorRules[editIndex] = rule;
        else {
          // Insert above any catch-all, or it would never be reached.
          var idx = S.colorRules.length;
          for (var i = 0; i < S.colorRules.length; i++) {
            if (!legacyToWhen(S.colorRules[i]).length) { idx = i; break; }
          }
          S.colorRules.splice(idx, 0, rule);
        }
        close(); render(); pushState(); renderColorsTab();
      });
    }

    // ── Legend tab ──
    var LEGEND_FIELDS = [
      ['singlePage', 'Single page'], ['multiplePage', 'Multiple pages'],
      ['rootNode', 'Homepage / root'], ['colorBand', 'Color band'], ['interactionHint', 'Interaction hint']
    ];
    function renderLegendTab() {
      var body = $('sp-body');
      var html = LEGEND_FIELDS.map(function (f) {
        return '<label class="sp-field sp-field-col"><span>' + f[1] + '</span>' +
          '<input type="text" data-lkey="' + f[0] + '" value="' + esc(legend(f[0])) + '" placeholder="' + esc(DEFAULT_LEGEND[f[0]]) + '"></label>';
      }).join('');
      body.innerHTML = '<div class="sp-grid sp-grid-1">' + html + '</div><p class="sp-help">Legend text shown to clients. Leave blank to use the default (shown as placeholder).</p>';
      Array.prototype.forEach.call(document.querySelectorAll('#sp-body input[data-lkey]'), function (inp) {
        inp.addEventListener('input', function () {
          S.legendLabels = S.legendLabels || {};
          var v = inp.value.trim();
          if (v) S.legendLabels[inp.getAttribute('data-lkey')] = v; else delete S.legendLabels[inp.getAttribute('data-lkey')];
          fillLegend(); pushState();
        });
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Print readiness — size the @page to the canvas so the PDF is one page
    // ════════════════════════════════════════════════════════════════════════
    function markReady() {
      if (MODE !== 'print') return;
      // Reset transform; lay content flush at 0,0 for printing
      var canvas = document.getElementById('canvas');
      canvas.style.transform = 'none';
      var w = Math.ceil(canvasW), h = Math.ceil(canvasH);
      var st = document.getElementById('print-page-style') || document.createElement('style');
      st.id = 'print-page-style';
      st.textContent = '@page { size: ' + (w + 96) + 'px ' + (h + 96) + 'px; margin: 48px; }';
      document.head.appendChild(st);
      document.body.classList.add('print-ready');
      document.title = 'READY';
    }

    // ════════════════════════════════════════════════════════════════════════
    // Init
    // ════════════════════════════════════════════════════════════════════════
    function init() {
      fillLegend();
      wireToolbar();
      setupPanZoom();
      render();
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (MODE !== 'print') fitToScreen(); }); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  // ── Static CSS (no interpolation → safe as a template literal) ──
  var CSS = `
:root{--bg:#f0f2f5;--white:#fff;--border:#c8cdd6;--border-dk:#9aa0ab;--text:#1a1d23;--text-mid:#4a5060;--text-dim:#8890a0;--c-root:#1a3a6b;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{width:100%;height:100%;overflow:hidden;background:var(--bg);font-family:"Inter","IBM Plex Sans",system-ui,sans-serif;font-size:13px;color:var(--text);}
body{display:flex;flex-direction:column;}
/* Toolbar wraps to extra rows on narrow windows instead of scrolling horizontally
   (overflow-x:auto hid the right-hand export buttons off-screen). The flex-column
   body then keeps #viewport filling whatever height is left below the wrapped bar,
   so no fixed toolbar height to keep in sync. */
#toolbar{z-index:100;display:flex;flex-wrap:wrap;align-items:center;gap:9px;padding:6px 14px;background:var(--white);border-bottom:1px solid var(--border);}
#toolbar h1{font-size:13px;font-weight:700;white-space:nowrap;margin:0 4px 0 0;}
.spacer{display:none;}
.tb-btn{padding:3px 10px;font-size:11px;font-family:inherit;border:1px solid var(--border-dk);border-radius:4px;background:var(--white);color:var(--text-mid);cursor:pointer;white-space:nowrap;transition:background .12s,color .12s;}
.tb-btn:hover{background:#eef0f4;color:var(--text);}
#zoom-label{font-size:11px;color:var(--text-dim);min-width:36px;text-align:right;}
.tb-sep{width:1px;height:18px;background:var(--border);flex-shrink:0;}
.tb-label{font-size:11px;color:var(--text-mid);display:flex;align-items:center;gap:4px;white-space:nowrap;cursor:pointer;}
#vd-wrap{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-mid);white-space:nowrap;}
#vd-wrap select{font-size:11px;font-family:inherit;border:1px solid var(--border-dk);border-radius:4px;padding:2px 6px;background:var(--white);color:var(--text);cursor:pointer;}
#legend-btn{position:relative;cursor:pointer;}
/* Fixed, not absolute, and JS-anchored on open: the toolbar now wraps to extra
   rows on narrow windows, so its height (and the Legend button's position) is
   variable. wireToolbar() anchors this panel's top/right under the button when
   it opens, so it always sits below the button whatever row it wrapped to; the
   top:49px here is only the initial resting spot. (A fixed panel also can't be
   clipped by the toolbar — the historical issue #9.) */
#legend-panel{display:none;position:fixed;top:49px;right:14px;background:var(--white);border:1px solid var(--border);border-radius:6px;padding:12px 14px;box-shadow:0 4px 16px rgba(0,0,0,.12);width:250px;font-size:11px;color:var(--text-mid);line-height:1.7;z-index:400;}
#legend-btn.open #legend-panel{display:block;}
.legend-row{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.legend-note{line-height:1.7;}
#legend-panel hr{border:none;border-top:1px solid var(--border);margin:7px 0;}
.l-card{width:38px;height:20px;border-radius:3px;border:1.5px solid var(--border);background:var(--white);flex-shrink:0;position:relative;}
.l-card.stacked::before,.l-card.stacked::after{content:'';position:absolute;inset:0;border-radius:3px;background:var(--white);border:1.5px solid var(--border);}
.l-card.stacked::before{transform:translate(3px,3px);z-index:-1;}
.l-card.stacked::after{transform:translate(6px,6px);z-index:-2;}
#viewport{flex:1;min-height:0;overflow:hidden;cursor:grab;user-select:none;}
#viewport.panning{cursor:grabbing;}
#canvas{position:absolute;top:0;left:0;transform-origin:0 0;}
#connector-svg{position:absolute;top:0;left:0;pointer-events:none;overflow:visible;}
#connector-svg path{fill:none;stroke:var(--border-dk);stroke-width:1.5;stroke-linejoin:round;}
#cards-layer{position:absolute;top:0;left:0;}
.root-heading{position:absolute;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:.05em;}
.node-card{position:absolute;width:148px;height:54px;background:var(--card-fill,var(--white));border:var(--card-bw,1.5px) var(--card-bs,solid) var(--card-border,var(--border));border-radius:var(--card-radius,5px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:var(--card-pad-y,5px) var(--card-pad-x,7px);text-align:center;overflow:hidden;transition:box-shadow .15s,border-color .15s;}
.node-card:hover{border-color:var(--border-dk);box-shadow:0 2px 10px rgba(0,0,0,.12);z-index:10;}
.node-card::after{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--section-color,var(--border));border-radius:var(--card-radius,5px) var(--card-radius,5px) 0 0;}
/* Outline convention: rules that set a border instead of a band hide the strip. */
.node-card.no-band::after{display:none;}
.node-card .node-label{color:var(--card-text,var(--text));}
.node-card.root{border:2px solid var(--c-root);}
.node-card.root::after{background:var(--c-root);height:5px;}
.node-card.menu-root{border:2px solid #94a3b8;background:#eef1f5;}
.node-card.menu-root::after{background:#94a3b8;}
.node-card.dashed{border-style:dashed;}
.node-card.has-override{outline:2px dashed #9aa0ab;outline-offset:3px;}
.node-card.stacked{box-shadow:4px 4px 0 0 var(--white),4px 4px 0 1.5px var(--border),8px 8px 0 0 var(--white),8px 8px 0 1.5px var(--border);}
.node-card.stacked:hover{box-shadow:4px 4px 0 0 var(--white),4px 4px 0 1.5px var(--border-dk),8px 8px 0 0 var(--white),8px 8px 0 1.5px var(--border-dk),0 2px 10px rgba(0,0,0,.12);}
.toggle-dot{position:absolute;bottom:4px;right:6px;width:18px;height:18px;border-radius:50%;background:#eef0f4;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;color:var(--text-dim);cursor:pointer;transition:background .12s,border-color .12s,transform .08s;}
.node-card.collapsible:hover .toggle-dot{background:#dde0e8;}
.toggle-dot:hover{background:#cfd4de;border-color:var(--border-dk);transform:scale(1.12);color:var(--text);}
.node-num{font-size:10px;font-weight:600;letter-spacing:.04em;line-height:1;margin-bottom:2px;flex:0 0 auto;}
body.hide-numbers .node-num{display:none;}
.node-label{font-size:11.5px;font-weight:500;color:var(--text);line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:0 1 auto;min-height:0;overflow-wrap:anywhere;}
.node-sub{font-size:9.5px;color:var(--text-dim);line-height:1.25;margin-top:1px;flex:0 0 auto;}
#hint{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(26,29,35,.75);color:rgba(255,255,255,.85);font-size:11px;padding:5px 14px;border-radius:20px;pointer-events:none;z-index:200;white-space:nowrap;transition:opacity .6s;}
.ctx-menu{position:fixed;background:#fff;border:1px solid #c8cdd6;border-radius:5px;box-shadow:0 4px 16px rgba(0,0,0,.15);z-index:1000;font-size:11px;overflow:hidden;min-width:185px;padding:2px 0;}
.ctx-item{display:flex;align-items:center;gap:6px;width:100%;padding:7px 12px;border:none;background:none;text-align:left;cursor:pointer;font-size:11px;font-family:inherit;color:#4a5060;}
.ctx-item.active{color:#1a1d23;font-weight:600;}
.ctx-item:hover{background:#f0f2f5;}
.ctx-color input{margin-left:auto;width:26px;height:18px;border:1px solid #c8cdd6;border-radius:3px;padding:0;cursor:pointer;background:none;}
.ctx-sep{border-top:1px solid #e8eaed;margin:2px 0;}
.sp-overlay{position:fixed;inset:0;background:rgba(20,24,33,.35);z-index:1500;display:flex;align-items:center;justify-content:center;}
.sp-modal{width:430px;max-width:92vw;max-height:88vh;background:#fff;border-radius:8px;box-shadow:0 12px 48px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;}
.sp-head{display:flex;align-items:center;padding:11px 14px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px;}
.sp-head span{flex:1;}
.sp-x{border:none;background:none;font-size:14px;cursor:pointer;color:var(--text-dim);}
.sp-tabs{display:flex;gap:2px;padding:8px 12px 0;border-bottom:1px solid var(--border);}
/* Colours tab: style-mode segmented control, rule rows, condition builder. */
.sp-stylemode{display:flex;align-items:center;gap:6px;padding:10px 12px 0;font-size:11px;color:var(--text-mid);}
.sp-seg{border:1px solid var(--border);background:#fff;padding:4px 10px;font-size:11px;font-family:inherit;cursor:pointer;border-radius:4px;color:var(--text-mid);}
.sp-seg.on{background:#eef1f8;border-color:#4F46E5;color:#1a1d23;font-weight:600;}
.sp-rule-prev{position:relative;display:inline-block;width:30px;height:20px;border-radius:4px;flex:0 0 auto;box-sizing:border-box;}
.sp-rule-edit{border:none;background:none;cursor:pointer;color:var(--text-dim);font-size:12px;padding:2px 4px;}
.sp-rule-edit:hover{color:var(--text);}
.re-cond{display:flex;align-items:center;gap:4px;margin-bottom:5px;}
.re-cond select,.re-cond input{font-family:inherit;font-size:11px;padding:3px 4px;border:1px solid var(--border);border-radius:3px;background:#fff;min-width:0;}
.re-cond .re-dim{flex:1.3;}
.re-cond .re-op{flex:1;}
.re-cond .re-val{flex:1.3;}
.re-val-none{flex:1.3;color:var(--text-dim);font-size:11px;text-align:center;}
.re-cond-del{border:none;background:none;cursor:pointer;color:var(--text-dim);font-size:11px;padding:2px 4px;flex:0 0 auto;}
.re-cond-del:hover{color:#c0392b;}
.sp-tab{border:none;background:none;padding:6px 12px;font-size:12px;font-family:inherit;cursor:pointer;color:var(--text-mid);border-bottom:2px solid transparent;}
.sp-tab.active{color:var(--text);font-weight:600;border-bottom-color:#4F46E5;}
.sp-body{padding:14px;overflow:auto;flex:1;}
.sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;}
.sp-grid-1{grid-template-columns:1fr;}
.sp-field{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:var(--text-mid);}
.sp-field-col{flex-direction:column;align-items:stretch;gap:3px;}
.sp-field span{white-space:nowrap;}
.sp-field input,.sp-field select{font-size:12px;font-family:inherit;border:1px solid var(--border-dk);border-radius:4px;padding:3px 6px;width:90px;}
.sp-field-col input{width:100%;}
.sp-help{font-size:11px;color:var(--text-dim);margin-top:12px;line-height:1.5;}
.sp-foot{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid var(--border);}
.sp-btn{padding:5px 11px;font-size:12px;font-family:inherit;border:1px solid var(--border-dk);border-radius:5px;background:#fff;color:var(--text-mid);cursor:pointer;}
.sp-btn:hover{background:#eef0f4;}
.sp-primary{background:#4F46E5;border-color:#4F46E5;color:#fff;}
.sp-primary:hover{background:#4338ca;}
.sp-rules{display:flex;flex-direction:column;gap:6px;}
.sp-rule{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:5px;background:#fafbfc;}
.sp-rule.dragging{opacity:.4;}
.sp-rule-move{cursor:grab;color:var(--text-dim);font-size:12px;}
.sp-rule-color{width:28px;height:22px;border:1px solid var(--border-dk);border-radius:3px;padding:0;cursor:pointer;background:none;}
.sp-rule-label{flex:1;display:flex;flex-direction:column;font-size:12px;color:var(--text);}
.sp-rule-label small{color:var(--text-dim);font-size:10px;}
.sp-rule-del,.sp-ov-del{border:none;background:none;color:var(--text-dim);cursor:pointer;font-size:12px;}
.sp-rule-del:hover,.sp-ov-del:hover{color:#c0392b;}
.sp-rule-add{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
.sp-subhead{font-size:11px;font-weight:600;color:var(--text-mid);margin:16px 0 6px;text-transform:uppercase;letter-spacing:.04em;}
.sp-overrides{display:flex;flex-direction:column;gap:4px;}
.sp-ovrow{display:flex;align-items:center;gap:8px;font-size:12px;}
.sp-ovrow .sw{width:14px;height:14px;border-radius:3px;border:1px solid var(--border-dk);}
.sp-ovlabel{flex:1;}
@media print{
  #toolbar,#hint,.ctx-menu,.sp-overlay{display:none!important;}
  /* Revert the screen-mode flex-column layout so print keeps its original static
     flow (the PDF export renders this mode). */
  #viewport{position:static;flex:none;overflow:visible;top:0;}
  #canvas{transform:none!important;position:static;}
  body{background:#fff;overflow:visible;height:auto;display:block;}
}
`;

  function build(data) {
    var mode = (data && data.mode) || 'app';
    var title = (data && data.title) || 'Visual Sitemap';
    var dataJson = JSON.stringify(data || {}).replace(/<\//g, '<\\/');
    var engineSrc = sitemapEngine.toString();
    // The webview cannot require() src/sitemap-layout.js, so its source is
    // inlined ahead of the engine. Same file, same geometry, one implementation.
    var layoutSrc = (typeof window !== 'undefined' && window.SitemapLayout && window.SitemapLayout.__source) || '';
    if (!layoutSrc) throw new Error('SitemapLayout not loaded — sitemap-layout.js must load before sitemap-template.js');

    // Toolbar varies by mode.
    var toolbar = '';
    if (mode !== 'print') {
      toolbar += '<div id="toolbar">';
      toolbar += '<h1>' + escAttr(title) + '</h1><span class="spacer"></span>';
      if (mode === 'app') {
        toolbar += '<div id="vd-wrap">Vertical from depth '
          + '<select id="vd-select"><option value="1">1 — all vertical</option><option value="2">2 (recommended)</option><option value="3">3</option><option value="4">4</option><option value="99">— off</option></select>'
          + ' &nbsp;or if children ≥ '
          + '<select id="ct-select"><option value="2">2</option><option value="3">3 (recommended)</option><option value="4">4</option><option value="99">— off</option></select>'
          + '</div><div class="tb-sep"></div>';
      }
      toolbar += '<label class="tb-label"><input type="checkbox" id="show-numbers" checked style="accent-color:#1a1d23"> Numbers</label>';
      toolbar += '<div class="tb-sep"></div>';
      toolbar += '<button class="tb-btn" id="btn-expand">Expand all</button>';
      toolbar += '<button class="tb-btn" id="btn-collapse">Collapse all</button>';
      if (mode === 'client') toolbar += '<button class="tb-btn" id="btn-reset">Reset view</button>';
      toolbar += '<button class="tb-btn" id="btn-fit">Fit</button>';
      toolbar += '<span id="zoom-label">100%</span>';
      toolbar += '<div class="tb-sep"></div>';
      if (mode === 'app') {
        toolbar += '<button class="tb-btn" id="btn-settings">Settings</button>';
      }
      toolbar += '<div class="tb-btn" id="legend-btn">Legend<div id="legend-panel"><div id="legend-body"></div></div></div>';
      if (mode === 'app') {
        toolbar += '<div class="tb-sep"></div>';
        toolbar += '<button class="tb-btn" id="btn-export-client">Export HTML</button>';
        toolbar += '<button class="tb-btn" id="btn-export-pdf">Export PDF</button>';
        toolbar += '<button class="tb-btn" id="btn-export-miro">Export to Miro</button>';
      }
      toolbar += '</div>';
    }

    var hint = (mode === 'print') ? '' : '<div id="hint">Scroll to zoom · Drag to pan · Click section cards to collapse</div>';

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
      + '<title>' + escAttr(title) + '</title>'
      + '<style>' + CSS + '</style></head><body'
      + (mode === 'print' ? ' class="printing"' : '') + '>'
      + toolbar
      + '<div id="viewport"><div id="canvas"><svg id="connector-svg"></svg><div id="cards-layer"></div></div></div>'
      + hint
      + '<script>window.__SITEMAP_DATA__=' + dataJson + ';<\/script>'
      + '<script>window.__SITEMAP_LAYOUT__=(' + layoutSrc + ')();<\/script>'
      + '<script>(' + engineSrc + ')();<\/script>'
      + '</body></html>';
    return html;
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  window.SitemapTemplate = { build: build };
})();
