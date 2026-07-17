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
      cardWidth: 148, cardHeight: 54,
      hGap: 40, vRow: 60, vlGap: 12, vlDrop: 32, vlHgap: 20, pad: 72,
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
      interactionHint: 'Click section card → collapse/expand'
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
        colorRules: S.colorRules,
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
    function matchesRule(node, depth, rule) {
      var c = rule.condition || {};
      switch (c.type) {
        case 'depth': return depth === c.value;
        case 'depthRange': return depth >= c.min && depth <= c.max;
        case 'parentId': return INDEX[node.id] && INDEX[node.id].parentId === c.parentId;
        case 'value': return (node.colorValue || '') === c.value;
        case 'external': return !!node.external;
        case 'field': return String((node.fields && node.fields[c.field]) || '') === c.value;
        case 'always': return true;
        default: return false;
      }
    }

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
    function distinctFieldValues(key) {
      var seen = {}, out = [];
      for (var id in INDEX) {
        var v = (INDEX[id].node.fields && INDEX[id].node.fields[key]) || '';
        if (!(v in seen)) { seen[v] = 1; out.push(v); }
      }
      out.sort(function (a, b) { if (a === '') return 1; if (b === '') return -1; return a < b ? -1 : a > b ? 1 : 0; });
      return out;
    }
    function resolveColor(node) {
      var ov = S.nodeOverrides[node.id];
      if (ov && ov.color) return ov.color;
      var depth = depthOf(node);
      for (var i = 0; i < S.colorRules.length; i++) {
        if (matchesRule(node, depth, S.colorRules[i])) return S.colorRules[i].color;
      }
      return FALLBACK_COLOR;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Layout — ported from prototype, generalized to N stacked roots.
    // Constants come from settings so the Layout tab can tune them live.
    // ════════════════════════════════════════════════════════════════════════
    function L() {
      return {
        CW: S.cardWidth, CH: S.cardHeight, H_GAP: S.hGap, V_ROW: S.vRow,
        VL_GAP: S.vlGap, VL_DROP: S.vlDrop, VL_HGAP: S.vlHgap, PAD: S.pad, SHADOW: 8
      };
    }

    function shouldBeVert(node, depth) {
      var ov = S.nodeOverrides[node.id];
      if (ov && ov.layout) return ov.layout === 'vert';
      if (S.vertDepth !== 99 && depth >= S.vertDepth) return true;
      if (S.childThresh !== 99 && depth >= 1 && node.children && node.children.length >= S.childThresh) return true;
      return false;
    }

    function subtreeBox(node, depth) {
      var k = L();
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

    var positions = {};
    function layoutNode(node, x, y, depth) {
      var k = L();
      var hasKids = node.children && node.children.length && !collapsed.has(node.id);
      if (!shouldBeVert(node, depth)) {
        var boxes = node.children && !collapsed.has(node.id) ? node.children.map(function (c) { return subtreeBox(c, depth + 1); }) : [];
        var totalW = boxes.reduce(function (s, b, i) { return s + b.w + (i > 0 ? k.H_GAP : 0); }, 0) || k.CW;
        var cardX = x + totalW / 2 - k.CW / 2;
        positions[node.id] = { x: cardX, y: y, depth: depth };
        if (hasKids) {
          var cx = x;
          node.children.forEach(function (c, i) { layoutNode(c, cx, y + k.CH + k.V_ROW, depth + 1); cx += boxes[i].w + k.H_GAP; });
        }
      } else {
        positions[node.id] = { x: x, y: y, depth: depth };
        if (hasKids) {
          var xcol = x + k.VL_HGAP;
          var cy = y + k.CH + k.VL_DROP;
          node.children.forEach(function (c) { layoutNode(c, xcol, cy, depth + 1); cy += subtreeBox(c, depth + 1).h + k.VL_GAP; });
        }
      }
    }

    var canvasW = 100, canvasH = 100;
    var rootHeadingY = {}; // rootIndex -> y of heading
    function computeLayout() {
      var k = L();
      positions = {};
      rootHeadingY = {};
      var yCursor = k.PAD;
      ROOTS.forEach(function (root, i) {
        if (ROOT_HEADINGS) { rootHeadingY[i] = yCursor; yCursor += HEADING_H; }
        layoutNode(root, k.PAD, yCursor, 0);
        var box = subtreeBox(root, 0);
        yCursor += box.h + ROOT_GAP;
      });
      var maxX = 0, maxY = 0;
      for (var id in positions) {
        var p = positions[id];
        maxX = Math.max(maxX, p.x + k.CW + 16);
        maxY = Math.max(maxY, p.y + k.CH);
      }
      canvasW = maxX + k.PAD;
      canvasH = maxY + k.PAD;
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
      var color = node.isMenuRoot ? '#94a3b8' : resolveColor(node);
      card.style.setProperty('--section-color', color);

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
        n.style.color = color;
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
        card.appendChild(dot);
        card.addEventListener('click', function (e) {
          e.stopPropagation();
          if (collapsed.has(node.id)) collapsed.delete(node.id); else collapsed.add(node.id);
          render(); pushState();
        });
      }

      // Right-click context menu (app mode only) for any node with children
      if (MODE === 'app' && node.children && node.children.length) {
        card.addEventListener('contextmenu', function (e) { openNodeContextMenu(e, node); });
      }

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
      ci.addEventListener('input', function () { setOverride(node.id, 'color', ci.value); });
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
    function setOverride(id, key, value) {
      var ov = S.nodeOverrides[id] || {};
      if (value === null || value === undefined || value === '') { delete ov[key]; }
      else { ov[key] = value; }
      if (Object.keys(ov).length) S.nodeOverrides[id] = ov; else delete S.nodeOverrides[id];
      removeCtx(); render(); pushState();
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
      if ($('legend-btn')) $('legend-btn').addEventListener('click', function (e) { e.stopPropagation(); this.classList.toggle('open'); });
      if ($('btn-settings')) $('btn-settings').addEventListener('click', function (e) { e.stopPropagation(); openSettings(); });
      if ($('btn-export-client')) $('btn-export-client').addEventListener('click', function () { emit({ type: 'export', format: 'client', state: currentState() }); });
      if ($('btn-export-pdf')) $('btn-export-pdf').addEventListener('click', function () { emit({ type: 'export', format: 'pdf', state: currentState() }); });

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
      ['vlHgap', 'Vertical indent'], ['pad', 'Canvas padding']
    ];
    function layoutTabHtml() {
      var rows = NUM_FIELDS.map(function (f) {
        return '<label class="sp-field"><span>' + f[1] + '</span><input type="number" data-key="' + f[0] + '" value="' + S[f[0]] + '"></label>';
      }).join('');
      return '<div class="sp-grid">' + rows + '</div>' +
        '<p class="sp-help">Layout dimensions in pixels. Changes preview live.</p>';
    }
    function wireLayoutTab() {
      Array.prototype.forEach.call(document.querySelectorAll('#sp-body input[data-key]'), function (inp) {
        inp.addEventListener('input', function () {
          var v = parseInt(inp.value, 10);
          if (!isNaN(v) && v >= 0) { S[inp.getAttribute('data-key')] = v; render(); pushState(); }
        });
      });
    }

    // ── Colors tab ──
    function condSummary(c) {
      if (!c) return '';
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
    function renderColorsTab() {
      var body = $('sp-body');
      var html = '<div class="sp-rules" id="sp-rules">';
      S.colorRules.forEach(function (rule, i) {
        html += '<div class="sp-rule" data-i="' + i + '">' +
          '<span class="sp-rule-move" title="Drag to reorder" draggable="true">☰</span>' +
          '<input type="color" class="sp-rule-color" value="' + rule.color + '">' +
          '<span class="sp-rule-label">' + esc(rule.label || '') + '<small>' + esc(condSummary(rule.condition)) + '</small></span>' +
          '<button class="sp-rule-del" title="Delete rule">✕</button>' +
          '</div>';
      });
      html += '</div>';
      html += '<div class="sp-rule-add">' +
        '<button class="sp-btn" id="sp-add-rule">+ Add rule</button>' +
        '<button class="sp-btn" id="sp-gen-depth">Color by depth</button>' +
        '<button class="sp-btn" id="sp-gen-section">Color by top-level section</button>' +
        '<button class="sp-btn" id="sp-mark-external">Mark external links</button>' +
        '</div>';
      if (DATA.fieldDefs && DATA.fieldDefs.length) {
        html += '<div class="sp-rule-add">' +
          '<select id="sp-field-select">' + DATA.fieldDefs.map(function (f) { return '<option value="' + f.key + '">' + esc(f.label) + '</option>'; }).join('') + '</select>' +
          '<button class="sp-btn" id="sp-gen-field">Color by field</button>' +
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
      html += '<p class="sp-help">Rules are evaluated top to bottom; first match wins. A node’s own color (right-click → Set color) overrides all rules.</p>';
      body.innerHTML = html;
      wireColorsTab();
    }
    function wireColorsTab() {
      Array.prototype.forEach.call(document.querySelectorAll('.sp-rule'), function (row) {
        var i = parseInt(row.getAttribute('data-i'), 10);
        row.querySelector('.sp-rule-color').addEventListener('input', function (e) { S.colorRules[i].color = e.target.value; render(); pushState(); });
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
        if (S.colorRules.some(function (r) { return r.condition && r.condition.type === 'external'; })) { flash(this, 'Already added'); return; }
        // Unshifted to the very top: external links should stand out regardless of
        // whatever depth/section scheme is already active, so it must win first-match.
        S.colorRules.unshift({ id: 'r-external', label: 'Links to another site', condition: { type: 'external' }, color: '#c77b1f' });
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
    function genDepthRules() {
      var pal = DATA.palette || ['#2d6a9f', '#1e7a4e', '#7a3a9f', '#9f6a1e', '#2d7a7a', '#7a2d2d'];
      var maxDepth = 0;
      for (var id in INDEX) { if (INDEX[id].depth > maxDepth) maxDepth = INDEX[id].depth; }
      var rules = [{ id: 'r-root', label: 'Homepage / root', condition: { type: 'depth', value: 0 }, color: (DATA.rootColor || '#1a3a6b') }];
      for (var d = 1; d <= maxDepth; d++) {
        rules.push({ id: 'r-depth-' + d, label: 'Depth ' + d, condition: { type: 'depth', value: d }, color: pal[(d - 1) % pal.length] });
      }
      rules.push({ id: 'r-fallback', label: 'Everything else', condition: { type: 'always' }, color: FALLBACK_COLOR });
      return rules;
    }
    function genSectionRules() {
      // Color a whole section by matching every node's colorValue (the renderer
      // stamps each node's top-level section label onto colorValue), so the
      // section node AND its descendants share one color.
      var pal = DATA.palette || ['#2d6a9f', '#1e7a4e', '#7a3a9f', '#9f6a1e', '#2d7a7a', '#7a2d2d'];
      var rules = [{ id: 'r-root', label: 'Homepage / root', condition: { type: 'depth', value: 0 }, color: (DATA.rootColor || '#1a3a6b') }];
      var seen = {};
      topLevelSections().forEach(function (sec, i) {
        var val = sec.colorValue || sec.label;
        if (seen[val]) return; seen[val] = 1;
        rules.push({ id: 'r-sec-' + sec.id, label: sec.label, condition: { type: 'value', value: val }, color: pal[i % pal.length] });
      });
      rules.push({ id: 'r-fallback', label: 'Everything else', condition: { type: 'always' }, color: FALLBACK_COLOR });
      return rules;
    }
    function genFieldRules(key) {
      // One value-rule per distinct value actually present for this field (including
      // blank, so gaps are visible), reusing a host-supplied color per value when
      // available (e.g. Page Status already has user-assigned colors elsewhere in the
      // app) and falling back to the palette otherwise.
      var pal = DATA.palette || ['#2d6a9f', '#1e7a4e', '#7a3a9f', '#9f6a1e', '#2d7a7a', '#7a2d2d'];
      var def = fieldDefOf(key) || {};
      var rules = distinctFieldValues(key).map(function (v, i) {
        var color = (def.valueColors && def.valueColors[v]) || pal[i % pal.length];
        return { id: 'r-field-' + key + '-' + i, label: fieldValueLabel(key, v), condition: { type: 'field', field: key, value: v }, color: color };
      });
      rules.push({ id: 'r-fallback', label: 'Everything else', condition: { type: 'always' }, color: FALLBACK_COLOR });
      return rules;
    }
    function topLevelSections() {
      // depth-1 nodes across all roots
      var out = [];
      ROOTS.forEach(function (root) { (root.children || []).forEach(function (c) { out.push(c); }); });
      return out;
    }

    function openRuleEditor() {
      var ov = document.createElement('div');
      ov.className = 'sp-overlay'; ov.style.zIndex = 2000;
      var sectsOpts = topLevelSections().map(function (s) { return '<option value="' + s.id + '">' + esc(s.label) + '</option>'; }).join('');
      var fieldOpt = (DATA.fieldDefs && DATA.fieldDefs.length) ? '<option value="field">A specific field value</option>' : '';
      ov.innerHTML =
        '<div class="sp-modal" style="width:340px;">' +
        '<div class="sp-head"><span>Add color rule</span><button class="sp-x" id="re-x">✕</button></div>' +
        '<div class="sp-body">' +
        '<label class="sp-field"><span>Applies to</span><select id="re-type">' +
        '<option value="depth">Nodes at depth</option>' +
        '<option value="depthRange">Depth range</option>' +
        '<option value="parentId">Children of a section</option>' +
        fieldOpt +
        '<option value="external">Links to another site</option>' +
        '<option value="always">All other nodes</option>' +
        '</select></label>' +
        '<div id="re-args"></div>' +
        '<label class="sp-field"><span>Label</span><input type="text" id="re-label" placeholder="e.g. Top-level sections"></label>' +
        '<label class="sp-field"><span>Color</span><input type="color" id="re-color" value="#2d6a9f"></label>' +
        '</div>' +
        '<div class="sp-foot"><span style="flex:1"></span><button class="sp-btn" id="re-cancel">Cancel</button><button class="sp-btn sp-primary" id="re-add">Add</button></div>' +
        '</div>';
      document.body.appendChild(ov);
      function renderArgs() {
        var t = ov.querySelector('#re-type').value;
        var box = ov.querySelector('#re-args');
        if (t === 'depth') box.innerHTML = '<label class="sp-field"><span>Depth</span><input type="number" id="re-depth" value="1" min="0"></label>';
        else if (t === 'depthRange') box.innerHTML = '<label class="sp-field"><span>Min depth</span><input type="number" id="re-min" value="1" min="0"></label><label class="sp-field"><span>Max depth</span><input type="number" id="re-max" value="2" min="0"></label>';
        else if (t === 'parentId') box.innerHTML = '<label class="sp-field"><span>Section</span><select id="re-parent">' + sectsOpts + '</select></label>';
        else if (t === 'field') {
          var fieldOpts = (DATA.fieldDefs || []).map(function (f) { return '<option value="' + f.key + '">' + esc(f.label) + '</option>'; }).join('');
          box.innerHTML = '<label class="sp-field"><span>Field</span><select id="re-field">' + fieldOpts + '</select></label>' +
                           '<label class="sp-field"><span>Value</span><select id="re-fieldval"></select></label>';
          var refreshFieldVals = function () {
            var fk = box.querySelector('#re-field').value;
            var vals = distinctFieldValues(fk);
            box.querySelector('#re-fieldval').innerHTML = vals.map(function (v) { return '<option value="' + esc(v) + '">' + esc(fieldValueLabel(fk, v)) + '</option>'; }).join('');
          };
          box.querySelector('#re-field').addEventListener('change', refreshFieldVals);
          refreshFieldVals();
        }
        else box.innerHTML = '';
      }
      renderArgs();
      ov.querySelector('#re-type').addEventListener('change', renderArgs);
      function close() { ov.remove(); }
      ov.querySelector('#re-x').addEventListener('click', close);
      ov.querySelector('#re-cancel').addEventListener('click', close);
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      ov.querySelector('#re-add').addEventListener('click', function () {
        var t = ov.querySelector('#re-type').value;
        var cond = { type: t };
        if (t === 'depth') cond.value = parseInt(ov.querySelector('#re-depth').value, 10) || 0;
        else if (t === 'depthRange') { cond.min = parseInt(ov.querySelector('#re-min').value, 10) || 0; cond.max = parseInt(ov.querySelector('#re-max').value, 10) || 0; }
        else if (t === 'parentId') cond.parentId = ov.querySelector('#re-parent').value;
        else if (t === 'field') { cond.field = ov.querySelector('#re-field').value; cond.value = ov.querySelector('#re-fieldval').value; }
        var rule = { id: 'r-' + Date.now(), label: ov.querySelector('#re-label').value || condSummary(cond), condition: cond, color: ov.querySelector('#re-color').value };
        // insert before any trailing 'always' rule
        var idx = S.colorRules.length;
        if (S.colorRules.length && S.colorRules[S.colorRules.length - 1].condition && S.colorRules[S.colorRules.length - 1].condition.type === 'always') idx = S.colorRules.length - 1;
        S.colorRules.splice(idx, 0, rule);
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
#toolbar{position:fixed;top:0;left:0;right:0;height:41px;z-index:100;display:flex;align-items:center;gap:9px;padding:0 14px;background:var(--white);border-bottom:1px solid var(--border);overflow-x:auto;}
#toolbar h1{font-size:13px;font-weight:700;white-space:nowrap;}
.spacer{flex:1;}
.tb-btn{padding:3px 10px;font-size:11px;font-family:inherit;border:1px solid var(--border-dk);border-radius:4px;background:var(--white);color:var(--text-mid);cursor:pointer;white-space:nowrap;transition:background .12s,color .12s;}
.tb-btn:hover{background:#eef0f4;color:var(--text);}
#zoom-label{font-size:11px;color:var(--text-dim);min-width:36px;text-align:right;}
.tb-sep{width:1px;height:18px;background:var(--border);flex-shrink:0;}
.tb-label{font-size:11px;color:var(--text-mid);display:flex;align-items:center;gap:4px;white-space:nowrap;cursor:pointer;}
#vd-wrap{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-mid);white-space:nowrap;}
#vd-wrap select{font-size:11px;font-family:inherit;border:1px solid var(--border-dk);border-radius:4px;padding:2px 6px;background:var(--white);color:var(--text);cursor:pointer;}
#legend-btn{position:relative;cursor:pointer;}
#legend-panel{display:none;position:absolute;top:calc(100% + 8px);right:0;background:var(--white);border:1px solid var(--border);border-radius:6px;padding:12px 14px;box-shadow:0 4px 16px rgba(0,0,0,.12);width:250px;font-size:11px;color:var(--text-mid);line-height:1.7;z-index:200;}
#legend-btn.open #legend-panel{display:block;}
.legend-row{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.legend-note{line-height:1.7;}
#legend-panel hr{border:none;border-top:1px solid var(--border);margin:7px 0;}
.l-card{width:38px;height:20px;border-radius:3px;border:1.5px solid var(--border);background:var(--white);flex-shrink:0;position:relative;}
.l-card.stacked::before,.l-card.stacked::after{content:'';position:absolute;inset:0;border-radius:3px;background:var(--white);border:1.5px solid var(--border);}
.l-card.stacked::before{transform:translate(3px,3px);z-index:-1;}
.l-card.stacked::after{transform:translate(6px,6px);z-index:-2;}
#viewport{position:fixed;top:41px;left:0;right:0;bottom:0;overflow:hidden;cursor:grab;user-select:none;}
#viewport.panning{cursor:grabbing;}
#canvas{position:absolute;top:0;left:0;transform-origin:0 0;}
#connector-svg{position:absolute;top:0;left:0;pointer-events:none;overflow:visible;}
#connector-svg path{fill:none;stroke:var(--border-dk);stroke-width:1.5;stroke-linejoin:round;}
#cards-layer{position:absolute;top:0;left:0;}
.root-heading{position:absolute;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:.05em;}
.node-card{position:absolute;width:148px;height:54px;background:var(--white);border:1.5px solid var(--border);border-radius:5px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 8px;text-align:center;transition:box-shadow .15s,border-color .15s;}
.node-card:hover{border-color:var(--border-dk);box-shadow:0 2px 10px rgba(0,0,0,.12);z-index:10;}
.node-card::after{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--section-color,var(--border));border-radius:5px 5px 0 0;}
.node-card.root{border:2px solid var(--c-root);}
.node-card.root::after{background:var(--c-root);height:5px;}
.node-card.menu-root{border:2px solid #94a3b8;background:#eef1f5;}
.node-card.menu-root::after{background:#94a3b8;}
.node-card.dashed{border-style:dashed;}
.node-card.has-override{outline:2px dashed #9aa0ab;outline-offset:3px;}
.node-card.stacked{box-shadow:4px 4px 0 0 var(--white),4px 4px 0 1.5px var(--border),8px 8px 0 0 var(--white),8px 8px 0 1.5px var(--border);}
.node-card.stacked:hover{box-shadow:4px 4px 0 0 var(--white),4px 4px 0 1.5px var(--border-dk),8px 8px 0 0 var(--white),8px 8px 0 1.5px var(--border-dk),0 2px 10px rgba(0,0,0,.12);}
.node-card.collapsible{cursor:pointer;}
.toggle-dot{position:absolute;bottom:5px;right:7px;width:15px;height:15px;border-radius:50%;background:#eef0f4;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-dim);transition:background .12s;}
.node-card.collapsible:hover .toggle-dot{background:#dde0e8;}
.node-num{font-size:10px;font-weight:600;letter-spacing:.04em;line-height:1;margin-bottom:3px;}
body.hide-numbers .node-num{display:none;}
.node-label{font-size:11.5px;font-weight:500;color:var(--text);line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.node-sub{font-size:9.5px;color:var(--text-dim);margin-top:2px;}
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
  #viewport{position:static;overflow:visible;top:0;}
  #canvas{transform:none!important;position:static;}
  body{background:#fff;overflow:visible;height:auto;}
}
`;

  function build(data) {
    var mode = (data && data.mode) || 'app';
    var title = (data && data.title) || 'Visual Sitemap';
    var dataJson = JSON.stringify(data || {}).replace(/<\//g, '<\\/');
    var engineSrc = sitemapEngine.toString();

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
