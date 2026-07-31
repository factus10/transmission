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
// Unlike the box-tree sitemap engine, this one has NO in-webview settings
// panel, no collapse/expand, no per-node color overrides — depth and coloring
// are chosen once, host-side, before the view opens (see
// openTreemapConfigDialog() in renderer.js). The engine just lays out and
// renders whatever tree it's handed; deeper levels the host chose not to show
// have already been rolled up into aggregate leaf values before the data ever
// reaches here.
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

    var MSG_PREFIX = '@@TREEMAP@@';
    function emit(obj) {
      if (MODE !== 'app') return;
      try { console.log(MSG_PREFIX + JSON.stringify(obj)); } catch (e) {}
    }

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

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
      if (!isContainer) box.style.background = node.color || '#9aa0ab';
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
      if ($('legend-btn')) $('legend-btn').addEventListener('click', function (e) { e.stopPropagation(); this.classList.toggle('open'); });
      if ($('btn-export-client')) $('btn-export-client').addEventListener('click', function () { emit({ type: 'export', format: 'client' }); });
      if ($('btn-export-pdf')) $('btn-export-pdf').addEventListener('click', function () { emit({ type: 'export', format: 'pdf' }); });
      document.addEventListener('click', function () {
        var lb = $('legend-btn'); if (lb) lb.classList.remove('open');
      });
    }
    function fillLegend() {
      var el = $('legend-body');
      if (!el) return;
      var entries = DATA.legend || [];
      if (!entries.length) { el.innerHTML = '<div class="legend-note">No legend for this view.</div>'; return; }
      el.innerHTML = entries.map(function (e) {
        return '<div class="legend-row"><div class="l-sw" style="background:' + esc(e.color) + '"></div> ' + esc(e.label) + '</div>';
      }).join('');
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
body.printing #viewport{position:static;top:0;overflow:visible;}
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
.legend-row .l-sw{width:12px;height:12px;border-radius:3px;flex-shrink:0;}
.legend-note{font-size:11px;color:var(--text-dim);}
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
