// ════════════════════════════════════════════════════════════════════════════
// Treemap engine template
//
// Produces a fully self-contained HTML document implementing an interactive
// squarified treemap (Bruls/Huizing/van Wijk) of the sitemap, sized by page
// count and colored by KKE composition, top-level section, or a tracked build
// field. Same "standalone HTML string, three run modes" pattern as
// sitemap-template.js (see that file's header comment for the full CSP/webview
// rationale) — reused here so the treemap gets the same in-app view /
// client-shareable export / print-PDF trio for free.
//
// Unlike the box-tree sitemap engine, this one has no collapse/expand and no
// layout settings: WHAT is drawn (depth, and which dimension decides colour) is
// chosen once host-side before the view opens, because changing either re-rolls
// the aggregation (see openTreemapConfigDialog() in renderer.js). The engine
// just lays out and renders whatever tree it's handed; deeper levels the host
// chose not to show have already been rolled up into aggregate leaf values
// before the data ever reaches here.
//
// WHICH colours are used, though, is pure presentation, so it lives here and
// round-trips to the host like the sitemap engine's settings do:
//   • Legend colours   — recolour a whole category (a section, a KKE decision,
//                        a Page Status) from the Legend panel. Keyed by
//                        node.colorKey, which the host stamps on every node.
//   • Per-box override — right-click one box. Keyed by node id, and it wins.
// Both are reported back as {type:'state'} and persisted per project, so a
// client's palette survives closing the view — and both are baked into the
// data blob of every export, so the HTML/PDF/PNG match what's on screen.
//
// Run modes (data.mode): same contract as sitemap-template.js — 'app' (full
// toolbar + export), 'client' (view-only, no export), 'print' (static,
// document.title='READY' once laid out).
//
// Exposed: window.TreemapTemplate.build(data) -> html string
// ════════════════════════════════════════════════════════════════════════════
(function () {

  // ── The engine. Authored as a normal function; stringified into the doc.
  //    References ONLY window/document/globals — no closure over this file.
  function treemapEngine() {
    'use strict';
    var DATA = window.__TREEMAP_DATA__ || {};
    var MODE = DATA.mode || 'app';
    var ROOTS = DATA.roots || [];
    var CANVAS_W = DATA.canvasWidth || 1100;
    var CANVAS_H = DATA.canvasHeight || 680;
    var HEADER_H = 22;   // reserved label strip on a container (has-children) box
    var PAD = 3;         // inset padding between a container's header and its children

    // Colour overrides. COLOR_OV recolours a whole legend category; NODE_OV
    // recolours one box and wins over it. Copied out of DATA so a re-render
    // never mutates the shipped blob.
    var COLOR_OV = Object.assign({}, DATA.colorOverrides || {});
    var NODE_OV = Object.assign({}, DATA.nodeOverrides || {});
    var DEFAULT_COLOR = '#9aa0ab';

    var MSG_PREFIX = '@@TREEMAP@@';
    function emit(obj) {
      if (MODE !== 'app') return;
      try { console.log(MSG_PREFIX + JSON.stringify(obj)); } catch (e) {}
    }
    function currentState() { return { colorOverrides: COLOR_OV, nodeOverrides: NODE_OV }; }
    function pushState() { emit({ type: 'state', state: currentState() }); }

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

    /** A box's fill: its own override, else its category's, else what the host
     *  computed. `colorKey` may legitimately be '' (a blank Page Status is a
     *  real category), so membership is tested rather than truthiness. */
    function colorOf(node) {
      if (node.id && Object.prototype.hasOwnProperty.call(NODE_OV, node.id)) return NODE_OV[node.id];
      var k = node.colorKey;
      if (k !== undefined && Object.prototype.hasOwnProperty.call(COLOR_OV, k)) return COLOR_OV[k];
      return node.color || DEFAULT_COLOR;
    }
    /** Legend swatch for a category — the override if one is set. */
    function legendColorOf(entry) {
      var k = (entry.key !== undefined ? entry.key : entry.label);
      if (Object.prototype.hasOwnProperty.call(COLOR_OV, k)) return COLOR_OV[k];
      return entry.color || DEFAULT_COLOR;
    }
    // <input type="color"> only accepts #rrggbb, so anything else (a named
    // colour, an rgb()) has to be normalized or the swatch silently shows black.
    function toHex(c) {
      var s = String(c || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
      if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
      var m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
      if (m) {
        return '#' + [1, 2, 3].map(function (i) {
          var v = Math.max(0, Math.min(255, parseInt(m[i], 10))).toString(16);
          return v.length === 1 ? '0' + v : v;
        }).join('');
      }
      return DEFAULT_COLOR;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Squarified treemap layout — Bruls/Huizing/van Wijk. Mutates each node
    // with _x/_y/_w/_h (design-space units, before the pan/zoom transform).
    // ════════════════════════════════════════════════════════════════════════
    function worstRatio(areas, sum, side) {
      if (!areas.length || sum <= 0 || side <= 0) return Infinity;
      var maxA = areas[0], minA = areas[0];
      for (var i = 1; i < areas.length; i++) { if (areas[i] > maxA) maxA = areas[i]; if (areas[i] < minA) minA = areas[i]; }
      var s2 = side * side, sum2 = sum * sum;
      return Math.max((s2 * maxA) / sum2, sum2 / (s2 * minA));
    }
    function squarify(nodes, x, y, w, h) {
      if (!nodes.length) return;
      if (nodes.length === 1) { nodes[0]._x = x; nodes[0]._y = y; nodes[0]._w = w; nodes[0]._h = h; return; }
      var total = 0;
      for (var i = 0; i < nodes.length; i++) total += Math.max(0, nodes[i].value || 0);
      var scale = total > 0 ? (w * h) / total : 0;
      var remaining = nodes.slice();
      var rx = x, ry = y, rw = w, rh = h;
      while (remaining.length) {
        var side = Math.min(rw, rh);
        var row = [remaining[0]];
        var rowSum = Math.max(0, remaining[0].value || 0) * scale;
        var best = worstRatio([rowSum], rowSum, side);
        var k = 1;
        while (k < remaining.length) {
          var addArea = Math.max(0, remaining[k].value || 0) * scale;
          var areas = row.map(function (n) { return Math.max(0, n.value || 0) * scale; }).concat([addArea]);
          var testSum = rowSum + addArea;
          var testWorst = worstRatio(areas, testSum, side);
          if (testWorst > best) break;
          row.push(remaining[k]); rowSum = testSum; best = testWorst; k++;
        }
        if (rw >= rh) {
          var stripW = rh > 0 ? rowSum / rh : 0;
          var cy = ry;
          row.forEach(function (n) {
            var area = Math.max(0, n.value || 0) * scale;
            var itemH = rowSum > 0 ? (area / rowSum) * rh : 0;
            n._x = rx; n._y = cy; n._w = stripW; n._h = itemH;
            cy += itemH;
          });
          rx += stripW; rw -= stripW;
        } else {
          var stripH = rw > 0 ? rowSum / rw : 0;
          var cx = rx;
          row.forEach(function (n) {
            var area = Math.max(0, n.value || 0) * scale;
            var itemW = rowSum > 0 ? (area / rowSum) * rw : 0;
            n._x = cx; n._y = ry; n._w = itemW; n._h = stripH;
            cx += itemW;
          });
          ry += stripH; rh -= stripH;
        }
        remaining = remaining.slice(row.length);
      }
    }
    // Nodes must be sorted descending by value for squarify to produce sane
    // aspect ratios; sort at every level, then recurse into any box roomy
    // enough to usefully show its children (else it renders as a flat leaf
    // using its own already-correct rolled-up value/color).
    var MIN_CONTAINER_W = 70, MIN_CONTAINER_H = 50;
    function layout(nodes, x, y, w, h) {
      var sorted = nodes.slice().sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
      squarify(sorted, x, y, w, h);
      sorted.forEach(function (n) {
        if (n.children && n.children.length && n._w >= MIN_CONTAINER_W && n._h >= MIN_CONTAINER_H) {
          layout(n.children, n._x + PAD, n._y + HEADER_H, n._w - PAD * 2, n._h - HEADER_H - PAD);
        }
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Render
    // ════════════════════════════════════════════════════════════════════════
    function renderBox(node) {
      var isContainer = !!(node.children && node.children.length && node._w >= MIN_CONTAINER_W && node._h >= MIN_CONTAINER_H);
      var box = document.createElement('div');
      box.className = 'tm-box' + (isContainer ? ' tm-container' : ' tm-leaf');
      box.style.left = node._x + 'px';
      box.style.top = node._y + 'px';
      box.style.width = Math.max(0, node._w) + 'px';
      box.style.height = Math.max(0, node._h) + 'px';
      if (!isContainer) box.style.background = colorOf(node);
      // A container is structural chrome, not a semantic colour, so it isn't
      // recolourable — right-click only offers the leaves that carry meaning.
      if (!isContainer && MODE === 'app') {
        box.__node = node;
        box.addEventListener('contextmenu', function (e) { e.preventDefault(); openBoxMenu(node, e); });
      }
      var titleParts = [node.label];
      if (node.subtitle) titleParts.push(node.subtitle);
      box.title = titleParts.join(' — ');

      if (node._w >= 34 && node._h >= 16) {
        var lbl = document.createElement('span');
        lbl.className = 'tm-label';
        lbl.textContent = node.label;
        box.appendChild(lbl);
        if (!isContainer && node.subtitle && node._h >= 32 && node._w >= 60) {
          var sub = document.createElement('span');
          sub.className = 'tm-sub';
          sub.textContent = node.subtitle;
          box.appendChild(sub);
        }
      }
      $('canvas').appendChild(box);
      if (isContainer) node.children.forEach(renderBox);
    }
    /** Flattened, laid-out boxes in draw order (containers before their
     *  children, so a board that honours creation order stacks them the same
     *  way the DOM does). Valid only after render(). */
    function exportBoxes() {
      var out = [];
      (function walk(nodes) {
        (nodes || []).forEach(function (n) {
          if (!(n._w > 0) || !(n._h > 0)) return;
          var isContainer = !!(n.children && n.children.length && n._w >= MIN_CONTAINER_W && n._h >= MIN_CONTAINER_H);
          out.push({
            id: n.id, label: n.label || '', subtitle: n.subtitle || '',
            color: isContainer ? '' : colorOf(n),
            container: isContainer,
            x: n._x, y: n._y, w: n._w, h: n._h,
          });
          if (isContainer) walk(n.children);
        });
      })(ROOTS);
      return { boxes: out, width: CANVAS_W, height: CANVAS_H, legend: (DATA.legend || []).map(function (e) {
        return { label: e.label, color: legendColorOf(e) };
      }) };
    }

    function render() {
      $('canvas').innerHTML = '';
      $('canvas').style.width = CANVAS_W + 'px';
      $('canvas').style.height = CANVAS_H + 'px';
      layout(ROOTS, 0, 0, CANVAS_W, CANVAS_H);
      ROOTS.forEach(renderBox);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Pan + zoom + fit — ported near-verbatim from the Visual Sitemap engine
    // ════════════════════════════════════════════════════════════════════════
    var scale = 1, tx = 0, ty = 0;
    var panning = false, sx = 0, sy = 0, stx = 0, sty = 0;
    function applyXform() {
      var canvas = $('canvas');
      canvas.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      var zl = $('zoom-label');
      if (zl) zl.textContent = Math.round(scale * 100) + '%';
    }
    function setupPanZoom() {
      var viewport = $('viewport');
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
        if (e.button !== 0) return;
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
      var viewport = $('viewport');
      var vw = viewport.clientWidth, vh = viewport.clientHeight, margin = 32;
      var s = Math.min((vw - margin * 2) / CANVAS_W, (vh - margin * 2) / CANVAS_H);
      scale = Math.max(0.10, Math.min(1, s));
      tx = (vw - CANVAS_W * scale) / 2; ty = Math.max(margin, (vh - CANVAS_H * scale) / 2);
      applyXform();
    }

    // ════════════════════════════════════════════════════════════════════════
    // Toolbar + legend
    // ════════════════════════════════════════════════════════════════════════
    function wireToolbar() {
      if ($('btn-fit')) $('btn-fit').addEventListener('click', fitToScreen);
      // The legend panel is also the colour editor in app mode, so a click
      // inside it (on a swatch) must not close it.
      if ($('legend-btn')) $('legend-btn').addEventListener('click', function (e) { e.stopPropagation(); this.classList.toggle('open'); });
      if ($('legend-panel')) $('legend-panel').addEventListener('click', function (e) { e.stopPropagation(); });
      if ($('btn-export-client')) $('btn-export-client').addEventListener('click', function () { emit({ type: 'export', format: 'client', state: currentState() }); });
      if ($('btn-export-pdf')) $('btn-export-pdf').addEventListener('click', function () { emit({ type: 'export', format: 'pdf', state: currentState() }); });
      if ($('btn-export-png')) $('btn-export-png').addEventListener('click', function () { emit({ type: 'export', format: 'png', state: currentState() }); });
      // Miro gets the geometry this engine just computed rather than a
      // host-side re-implementation of squarify() — the board is then the same
      // picture as the screen by construction, the way the box-tree sitemap
      // achieves it by sharing src/sitemap-layout.js.
      if ($('btn-export-miro')) $('btn-export-miro').addEventListener('click', function () {
        emit({ type: 'export', format: 'miro', state: currentState(), geometry: exportBoxes() });
      });
      document.addEventListener('click', function () {
        var lb = $('legend-btn'); if (lb) lb.classList.remove('open');
        closeBoxMenu();
      });
    }

    function fillLegend() {
      var el = $('legend-body');
      if (!el) return;
      var entries = DATA.legend || [];
      if (!entries.length) { el.innerHTML = '<div class="legend-note">No legend for this view.</div>'; return; }
      var editable = MODE === 'app';
      el.innerHTML = entries.map(function (e, i) {
        var c = legendColorOf(e);
        var sw = editable
          ? '<input type="color" class="l-sw l-pick" data-i="' + i + '" value="' + esc(toHex(c)) + '">'
          : '<div class="l-sw" style="background:' + esc(c) + '"></div>';
        return '<div class="legend-row">' + sw + ' <span class="l-name">' + esc(e.label) + '</span></div>';
      }).join('')
        + (editable ? '<div class="legend-foot">'
            + '<button type="button" class="l-reset" id="btn-color-reset">Reset colors</button>'
            + '<span class="legend-note">Right-click a box to recolor just it.</span></div>' : '');
      if (!editable) return;

      var picks = el.querySelectorAll('.l-pick');
      for (var p = 0; p < picks.length; p++) {
        picks[p].addEventListener('input', function () {
          var e2 = entries[parseInt(this.getAttribute('data-i'), 10)];
          if (!e2) return;
          COLOR_OV[e2.key !== undefined ? e2.key : e2.label] = this.value;
          render(); pushState();
        });
      }
      var rst = $('btn-color-reset');
      if (rst) rst.addEventListener('click', function () {
        COLOR_OV = {}; NODE_OV = {};
        render(); fillLegend(); pushState();
      });
    }

    // ── Per-box override ────────────────────────────────────────────────────
    function closeBoxMenu() { var m = $('box-menu'); if (m) m.remove(); }
    function openBoxMenu(node, e) {
      closeBoxMenu();
      var m = document.createElement('div');
      m.id = 'box-menu';
      m.className = 'ctx-menu';
      m.innerHTML =
        '<div class="ctx-title">' + esc(node.label) + '</div>' +
        '<label class="ctx-row"><span>Color</span>' +
          '<input type="color" id="ctx-color" value="' + esc(toHex(colorOf(node))) + '"></label>' +
        '<button type="button" class="ctx-btn" id="ctx-reset">Reset to category color</button>';
      document.body.appendChild(m);
      // Keep the menu on screen when the box is near the right/bottom edge.
      var mw = m.offsetWidth, mh = m.offsetHeight;
      m.style.left = Math.max(4, Math.min(e.clientX, window.innerWidth - mw - 6)) + 'px';
      m.style.top = Math.max(4, Math.min(e.clientY, window.innerHeight - mh - 6)) + 'px';
      m.addEventListener('click', function (ev) { ev.stopPropagation(); });
      m.addEventListener('contextmenu', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
      $('ctx-color').addEventListener('input', function () {
        NODE_OV[node.id] = this.value;
        render(); pushState();
      });
      $('ctx-reset').addEventListener('click', function () {
        delete NODE_OV[node.id];
        render(); pushState(); closeBoxMenu();
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Print readiness — size the @page to the fixed canvas so the PDF is one page
    // ════════════════════════════════════════════════════════════════════════
    function markReady() {
      if (MODE !== 'print') return;
      var canvas = $('canvas');
      canvas.style.transform = 'none';
      var st = document.getElementById('print-page-style') || document.createElement('style');
      st.id = 'print-page-style';
      st.textContent = '@page { size: ' + (CANVAS_W + 96) + 'px ' + (CANVAS_H + 96) + 'px; margin: 48px; }';
      document.head.appendChild(st);
      document.body.classList.add('print-ready');
      // Bare content box, for the PNG exporter: it sizes an offscreen window to
      // this and screenshots it, so unlike @page there is no margin to add.
      window.__EXPORT_SIZE__ = { w: Math.ceil(CANVAS_W), h: Math.ceil(CANVAS_H) };
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
      markReady();
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (MODE !== 'print') fitToScreen(); }); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  // ── Static CSS (no interpolation → safe as a template literal) ──
  var CSS = `
:root{--bg:#f0f2f5;--white:#fff;--border:#c8cdd6;--border-dk:#9aa0ab;--text:#1a1d23;--text-mid:#4a5060;--text-dim:#8890a0;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{width:100%;height:100%;overflow:hidden;background:var(--bg);font-family:"Inter","IBM Plex Sans",system-ui,sans-serif;font-size:13px;color:var(--text);}
#toolbar{position:fixed;top:0;left:0;right:0;height:41px;z-index:100;display:flex;align-items:center;gap:9px;padding:0 14px;background:var(--white);border-bottom:1px solid var(--border);overflow-x:auto;}
#toolbar h1{font-size:13px;font-weight:700;white-space:nowrap;}
.spacer{flex:1;}
.tb-btn{padding:3px 10px;font-size:11px;font-family:inherit;border:1px solid var(--border-dk);border-radius:4px;background:var(--white);color:var(--text-mid);cursor:pointer;white-space:nowrap;transition:background .12s,color .12s;}
.tb-btn:hover{background:#eef0f4;color:var(--text);}
#zoom-label{font-size:11px;color:var(--text-dim);min-width:36px;text-align:right;}
.tb-sep{width:1px;height:18px;background:var(--border);flex-shrink:0;}
#viewport{position:absolute;top:41px;left:0;right:0;bottom:0;overflow:hidden;cursor:grab;background:var(--bg);}
#viewport.panning{cursor:grabbing;}
/* Print mode must lay out flush at 0,0 ON SCREEN too — the PNG exporter
   screenshots this document in a window sized to the canvas, and a screen
   capture never sees the print stylesheet. */
body.printing{background:#fff;overflow:visible;height:auto;}
body.printing #viewport{position:static;top:0;overflow:visible;}
body.printing #canvas{transform:none!important;position:static;}
#canvas{position:relative;transform-origin:0 0;background:var(--white);}
.tm-box{position:absolute;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;padding:4px 6px;}
.tm-container{border:1px solid var(--border-dk);background:#e8eaef;}
.tm-leaf{border:1px solid rgba(255,255,255,0.7);}
.tm-label{font-size:11px;font-weight:600;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tm-container>.tm-label{color:var(--text-mid);text-shadow:none;}
.tm-sub{font-size:10px;color:#fff;opacity:0.9;text-shadow:0 1px 2px rgba(0,0,0,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#legend-btn{position:relative;cursor:pointer;}
/* Fixed, not absolute: #toolbar sets overflow-x:auto, and per spec a non-visible
   value on one axis forces the other to auto — so an absolutely-positioned panel
   hanging below the 41px bar was clipped to a sliver. Matches sitemap-template.js,
   which has always positioned its legend this way. */
#legend-panel{display:none;position:fixed;top:47px;right:14px;background:var(--white);border:1px solid var(--border);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.14);padding:10px 12px;min-width:180px;max-height:calc(100vh - 60px);overflow-y:auto;z-index:400;cursor:default;}
#legend-btn.open #legend-panel{display:block;}
.legend-row{display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 0;color:var(--text-mid);}
.legend-row .l-sw{width:14px;height:14px;border-radius:3px;flex-shrink:0;border:1px solid rgba(0,0,0,.14);}
.legend-row .l-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
/* An <input type="color"> carries a thick native bezel that would dwarf a 14px
   swatch, so the padding/border are stripped and the well is stretched to fill. */
input.l-pick,input#ctx-color{padding:0;cursor:pointer;background:none;-webkit-appearance:none;appearance:none;}
input.l-pick::-webkit-color-swatch-wrapper,input#ctx-color::-webkit-color-swatch-wrapper{padding:0;}
input.l-pick::-webkit-color-swatch,input#ctx-color::-webkit-color-swatch{border:none;border-radius:2px;}
.legend-foot{margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:6px;align-items:flex-start;}
.l-reset{padding:2px 8px;font-size:11px;font-family:inherit;border:1px solid var(--border-dk);border-radius:4px;background:var(--white);color:var(--text-mid);cursor:pointer;}
.l-reset:hover{background:#eef0f4;color:var(--text);}
.legend-note{font-size:11px;color:var(--text-dim);}
.ctx-menu{position:fixed;z-index:500;background:var(--white);border:1px solid var(--border);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.18);padding:8px 10px;min-width:190px;font-size:12px;}
.ctx-title{font-weight:600;color:var(--text);margin-bottom:6px;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ctx-row{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--text-mid);margin-bottom:6px;}
.ctx-row input[type=color]{width:26px;height:20px;border:1px solid var(--border-dk);border-radius:3px;}
.ctx-btn{width:100%;padding:3px 8px;font-size:11px;font-family:inherit;border:1px solid var(--border-dk);border-radius:4px;background:var(--white);color:var(--text-mid);cursor:pointer;}
.ctx-btn:hover{background:#eef0f4;color:var(--text);}
@media print{
  #toolbar{display:none!important;}
  #viewport{position:static;overflow:visible;top:0;}
  #canvas{transform:none!important;position:static;}
  body{background:#fff;overflow:visible;height:auto;}
}
`;

  function build(data) {
    var mode = (data && data.mode) || 'app';
    var title = (data && data.title) || 'Treemap';
    var dataJson = JSON.stringify(data || {}).replace(/<\//g, '<\\/');
    var engineSrc = treemapEngine.toString();

    var toolbar = '';
    if (mode !== 'print') {
      toolbar += '<div id="toolbar">';
      toolbar += '<h1>' + escAttr(title) + '</h1><span class="spacer"></span>';
      toolbar += '<button class="tb-btn" id="btn-fit">Fit</button>';
      toolbar += '<span id="zoom-label">100%</span>';
      toolbar += '<div class="tb-sep"></div>';
      toolbar += '<div class="tb-btn" id="legend-btn">Legend<div id="legend-panel"><div id="legend-body"></div></div></div>';
      if (mode === 'app') {
        toolbar += '<div class="tb-sep"></div>';
        toolbar += '<button class="tb-btn" id="btn-export-client">Export HTML</button>';
        toolbar += '<button class="tb-btn" id="btn-export-pdf">Export PDF</button>';
        toolbar += '<button class="tb-btn" id="btn-export-png">Export PNG</button>';
        toolbar += '<button class="tb-btn" id="btn-export-miro">Export to Miro</button>';
      }
      toolbar += '</div>';
    }

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
      + '<title>' + escAttr(title) + '</title>'
      + '<style>' + CSS + '</style></head><body'
      + (mode === 'print' ? ' class="printing"' : '') + '>'
      + toolbar
      + '<div id="viewport"><div id="canvas"></div></div>'
      + '<script>window.__TREEMAP_DATA__=' + dataJson + ';<\/script>'
      + '<script>(' + engineSrc + ')();<\/script>'
      + '</body></html>';
    return html;
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  window.TreemapTemplate = { build: build };
})();
