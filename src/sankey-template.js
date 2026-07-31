// ════════════════════════════════════════════════════════════════════════════
// Sankey (content flow) engine template
//
// Produces a fully self-contained HTML document showing how the audit's pages
// flow from the CURRENT site's organization into the NEW sitemap — including
// the pages that don't arrive anywhere (retired, out of scope, not yet placed).
// Same "standalone HTML string, three run modes" pattern as
// sitemap-template.js / treemap-template.js (see sitemap-template.js's header
// comment for the full CSP/webview rationale), reused here so the flow diagram
// gets the same in-app view / client-shareable export / print-PDF trio free.
//
// Unlike the treemap — where depth and colouring are chosen once host-side
// because changing them re-rolls the aggregation — ALL of this view's toggles
// are pure re-reads of data the host already sent, so they live in the engine.
// That matters most for the CLIENT export: the person you hand the file to gets
// every reading of the migration you had, with no app.
//
// The diagram is chosen by two independent controls, and the host precomputes
// every combination into DATA.views, keyed "from|shape":
//   from  — what the LEFT column is: 'section' (current-site section, from the
//           URL path) or 'site' (which source site it came from; offered only
//           on a multi-site consolidation, where it is usually the better read)
//   shape — what follows it: 'dec' (→ Decision), 'new' (→ New sitemap),
//           'both' (→ Decision → New)
// Each graph is a few dozen nodes, so shipping all of them costs nothing next
// to a round trip a static export could not make anyway.
//
// Layer counts are NOT fixed — layout()/render() derive them from the data, so
// adding a shape is a host-side change only.
//
// Layout is a layered Sankey: node heights proportional to page count, ordering
// settled by iterated barycentre relaxation (the standard crossing-reduction
// heuristic), links drawn as cubic Béziers whose stroke-width IS the value.
// Written from scratch rather than pulled from d3-sankey — see the Dependencies
// table in CLAUDE.md: d3 was deliberately removed from this app, and the whole
// point of the engine-template pattern is a document that depends on nothing.
//
// Run modes (data.mode): 'app' (toolbar + export), 'client' (view-only),
// 'print' (static, document.title='READY' once laid out).
//
// Exposed: window.SankeyTemplate.build(data) -> html string
// ════════════════════════════════════════════════════════════════════════════
(function () {

  // ── The engine. Authored as a normal function; stringified into the doc.
  //    References ONLY window/document/globals — no closure over this file.
  function sankeyEngine() {
    'use strict';
    var DATA = window.__SANKEY_DATA__ || {};
    var MODE = DATA.mode || 'app';
    var VIEWS = DATA.views || {};
    var LEGENDS = DATA.legends || {};
    var CANVAS_W = DATA.canvasWidth || 1010;
    var CANVAS_H = DATA.canvasHeight || 660;

    // Room for the labels drawn outside the flow. Sized per render from the
    // longest label — a multi-site audit's left column reads "Alpha University
    // › Academics", which a fixed gutter clips to nonsense.
    var GUT_L = 118, GUT_R = 176;
    var NODE_W = 15, NODE_PAD = 10, PAD_T = 34, PAD_B = 14;

    // The diagram is picked by two independent controls: WHAT the left column
    // is (froms) and HOW MANY columns follow it (shapes). The host precomputes
    // every combination it wants offered, keyed "from|shape".
    var FROMS = DATA.froms || [{ key: 'section', label: 'Current section' }];
    var SHAPES = DATA.shapes || [{ key: 'both', label: 'Decision → New' }];
    var from = DATA.defaultFrom || FROMS[0].key;
    var shape = DATA.defaultShape || SHAPES[0].key;
    var colorBy = DATA.defaultColorBy || 'decision';
    function viewKey() { return from + '|' + shape; }

    var MSG_PREFIX = '@@SANKEY@@';
    function emit(obj) {
      if (MODE !== 'app') return;
      try { console.log(MSG_PREFIX + JSON.stringify(obj)); } catch (e) {}
    }
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
    function plural(n) { return n + (n === 1 ? ' page' : ' pages'); }

    // ════════════════════════════════════════════════════════════════════════
    // Graph prep — resolve link endpoints to node objects, total each node.
    // Works on a COPY so toggling views/colours never accumulates state.
    // ════════════════════════════════════════════════════════════════════════
    function prepare(v) {
      var nodes = (v.nodes || []).map(function (n) {
        return { id: n.id, label: n.label, layer: n.layer, color: n.color, terminal: !!n.terminal, value: 0, in: [], out: [] };
      });
      var byId = {};
      nodes.forEach(function (n) { byId[n.id] = n; });
      var links = [];
      (v.links || []).forEach(function (l) {
        var s = byId[l.s], t = byId[l.t];
        if (!s || !t || !(l.value > 0)) return;
        var link = { s: s, t: t, value: l.value, colors: l.colors || {}, decision: l.decision || '', section: l.section || '' };
        s.out.push(link); t.in.push(link); links.push(link);
      });
      nodes.forEach(function (n) {
        var i = 0, o = 0;
        n.in.forEach(function (l) { i += l.value; });
        n.out.forEach(function (l) { o += l.value; });
        n.value = Math.max(i, o);
      });
      // A node with no surviving links would render as a stray block.
      nodes = nodes.filter(function (n) { return n.value > 0; });
      var layers = 0;
      nodes.forEach(function (n) { if (n.layer + 1 > layers) layers = n.layer + 1; });
      return { nodes: nodes, links: links, layers: layers, columns: v.columns || [] };
    }

    // ════════════════════════════════════════════════════════════════════════
    // Layout. Heights are value*ky with ky picked so the FULLEST column just
    // fits — every column then shares one scale, which is what lets a band's
    // thickness be read as a page count anywhere in the diagram.
    // ════════════════════════════════════════════════════════════════════════
    function layout(g) {
      var byLayer = [];
      for (var i = 0; i < g.layers; i++) {
        byLayer.push(g.nodes.filter(function (n) { return n.layer === i; }));
      }
      byLayer = byLayer.filter(function (l) { return l.length; });
      if (!byLayer.length) return byLayer;

      var maxTotal = 0, maxCount = 0;
      byLayer.forEach(function (l) {
        var t = 0; l.forEach(function (n) { t += n.value; });
        if (t > maxTotal) maxTotal = t;
        if (l.length > maxCount) maxCount = l.length;
      });

      // Gaps must never eat the column. At the fixed 10px a 60-node column
      // (5 sites × 12 sections, an ordinary consolidation audit) spends 590 of
      // its 612 usable pixels on padding and leaves 22px for every band put
      // together. Cap total gap at 35% of the column and shrink from there.
      var usable = CANVAS_H - PAD_T - PAD_B;
      var pad = NODE_PAD;
      if (maxCount > 1) pad = Math.max(1, Math.min(NODE_PAD, (usable * 0.35) / (maxCount - 1)));

      var ky = Infinity;
      byLayer.forEach(function (l) {
        var avail = usable - (l.length - 1) * pad;
        if (maxTotal > 0) ky = Math.min(ky, avail / maxTotal);
      });
      if (!isFinite(ky) || ky <= 0) ky = 1;
      g.nodes.forEach(function (n) { n.h = Math.max(2, n.value * ky); });

      var span = byLayer.length > 1 ? (CANVAS_W - NODE_W) / (byLayer.length - 1) : 0;
      byLayer.forEach(function (l, i) { l.forEach(function (n) { n.x = i * span; }); });

      // Seed: terminal buckets ("Retired", "Out of scope") sink to the bottom,
      // everything else by size. Seeding matters — relaxation is a local
      // heuristic and will not climb out of a bad starting order.
      byLayer.forEach(function (l) {
        l.sort(function (a, b) { return (a.terminal === b.terminal) ? (b.value - a.value) : (a.terminal ? 1 : -1); });
        stack(l);
      });
      function stack(l) { var y = PAD_T; l.forEach(function (n) { n.y = y; y += n.h + pad; }); }
      function center(n) { return n.y + n.h / 2; }

      for (var it = 0; it < 12; it++) {
        for (var a = 1; a < byLayer.length; a++) relax(byLayer[a], true);
        for (var b = byLayer.length - 2; b >= 0; b--) relax(byLayer[b], false);
      }
      function relax(l, fromLeft) {
        l.forEach(function (n) {
          var ls = fromLeft ? n.in : n.out;
          if (!ls.length) return;
          var sum = 0, tot = 0;
          ls.forEach(function (lk) {
            var other = fromLeft ? lk.s : lk.t;
            sum += center(other) * lk.value; tot += lk.value;
          });
          if (tot > 0) n.y += ((sum / tot) - center(n)) * 0.85;
        });
        l.sort(function (p, q) { return p.y - q.y; });
        resolve(l);
      }
      // Push apart downward, then — if that ran past the bottom — back up.
      function resolve(l) {
        var y = PAD_T;
        l.forEach(function (n) { if (n.y < y) n.y = y; y = n.y + n.h + pad; });
        var over = (y - pad) - (CANVAS_H - PAD_B);
        if (over > 0) {
          y = CANVAS_H - PAD_B;
          for (var i = l.length - 1; i >= 0; i--) {
            var n = l[i];
            if (n.y + n.h > y) n.y = y - n.h;
            y = n.y - pad;
          }
        }
      }

      // Stack each node's link endpoints, ordered by where the other end sits,
      // so ribbons leaving a node don't cross each other at the node itself.
      g.nodes.forEach(function (n) {
        var unit = n.h / Math.max(n.value, 1);
        n.out.sort(function (p, q) { return center(p.t) - center(q.t); });
        n.in.sort(function (p, q) { return center(p.s) - center(q.s); });
        var y = n.y;
        n.out.forEach(function (l) { l.w = l.value * unit; l.sy = y + l.w / 2; y += l.w; });
        y = n.y;
        n.in.forEach(function (l) { l.tw = l.value * unit; l.ty = y + l.tw / 2; y += l.tw; });
      });
      return byLayer;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Render
    // ════════════════════════════════════════════════════════════════════════
    var G = null, byLayer = null;

    function render() {
      var v = VIEWS[viewKey()];
      if (!v) { return; }
      G = prepare(v);

      // Size the gutters to the labels they must hold. A multi-site left column
      // reads "Alpha University › Academics"; at the old fixed 118px that was
      // clipped to about half. Estimated, not measured — close enough, and it
      // avoids a layout pass purely to size a margin.
      var lastL = 0;
      G.nodes.forEach(function (n) { if (n.layer + 1 > lastL) lastL = n.layer + 1; });
      var wide = function (layerTest) {
        var m = 0;
        G.nodes.forEach(function (n) { if (layerTest(n) && n.label.length > m) m = n.label.length; });
        return Math.round(m * 5.9) + 18;
      };
      GUT_L = Math.max(110, Math.min(320, wide(function (n) { return n.layer === 0; })));
      GUT_R = Math.max(150, Math.min(320, wide(function (n) { return n.layer === lastL - 1; })));

      byLayer = layout(G);

      var canvas = $('canvas'), svg = $('links');
      var totalW = GUT_L + CANVAS_W + GUT_R;
      canvas.style.width = totalW + 'px';
      canvas.style.height = CANVAS_H + 'px';
      var old = canvas.querySelectorAll('.sk-node,.sk-lbl,.sk-colhdr');
      for (var i = 0; i < old.length; i++) old[i].remove();
      svg.innerHTML = '';
      svg.setAttribute('width', totalW);
      svg.setAttribute('height', CANVAS_H);

      var lastLayer = byLayer.length - 1;

      byLayer.forEach(function (l, li) {
        if (!l.length) return;
        var h = document.createElement('div');
        h.className = 'sk-colhdr';
        h.textContent = G.columns[li] || '';
        if (li === 0) { h.style.left = '0px'; h.style.width = (GUT_L - 12) + 'px'; h.style.textAlign = 'right'; }
        else if (li === lastLayer) { h.style.left = (GUT_L + l[0].x + NODE_W + 10) + 'px'; }
        else { h.style.left = (GUT_L + l[0].x - 34) + 'px'; }
        h.style.top = '10px';
        canvas.appendChild(h);
      });

      G.links.forEach(function (l) {
        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var x0 = GUT_L + l.s.x + NODE_W, x1 = GUT_L + l.t.x, cx = (x0 + x1) / 2;
        p.setAttribute('d', 'M' + x0 + ',' + l.sy + ' C' + cx + ',' + l.sy + ' ' + cx + ',' + l.ty + ' ' + x1 + ',' + l.ty);
        p.setAttribute('stroke', l.colors[colorBy] || '#9aa0ab');
        p.setAttribute('stroke-width', Math.max(1, l.w));
        p.setAttribute('stroke-opacity', '0.34');
        p.__link = l;
        svg.appendChild(p);
        p.addEventListener('mouseenter', function (e) { focusLink(l, p, e); });
        p.addEventListener('mousemove', moveTip);
        p.addEventListener('mouseleave', unfocus);
      });

      // Labels are two lines tall but a block can be a few pixels tall, so in a
      // crowded column they overlap into mush. Walk each column top-down and
      // give each label only the room actually left below the previous one:
      // full label, name only, or nothing. The block, its colour and its
      // tooltip stay regardless — nothing becomes unreachable, only unlabelled.
      var LBL_FULL = 27, LBL_NAME = 15;
      var lastBottom = {};

      G.nodes.slice().sort(function (a, b) { return (a.layer - b.layer) || (a.y - b.y); }).forEach(function (n) {
        var d = document.createElement('div');
        d.className = 'sk-node';
        d.__node = n;
        d.style.left = (GUT_L + n.x) + 'px';
        d.style.top = n.y + 'px';
        d.style.width = NODE_W + 'px';
        d.style.height = n.h + 'px';
        d.style.background = n.color || '#9aa0ab';
        canvas.appendChild(d);
        d.addEventListener('mouseenter', function (e) { focusNode(n, e); });
        d.addEventListener('mousemove', moveTip);
        d.addEventListener('mouseleave', unfocus);

        var prev = lastBottom[n.layer];
        var mid = n.y + n.h / 2;
        var room = mid - (prev === undefined ? -Infinity : prev);
        var height = room >= LBL_FULL ? LBL_FULL : (room >= LBL_NAME ? LBL_NAME : 0);
        if (!height) return;

        var lbl = document.createElement('div');
        lbl.className = 'sk-lbl';
        lbl.innerHTML = '<b>' + esc(n.label) + '</b>'
          + (height === LBL_FULL ? '<span>' + plural(n.value) + '</span>' : '');
        lbl.style.top = (mid - height / 2) + 'px';
        if (n.layer === 0) {
          lbl.style.left = '0px'; lbl.style.width = (GUT_L - 12) + 'px'; lbl.style.textAlign = 'right';
        } else {
          lbl.style.left = (GUT_L + n.x + NODE_W + 8) + 'px';
          lbl.style.maxWidth = (GUT_R - 14) + 'px';
        }
        canvas.appendChild(lbl);
        lastBottom[n.layer] = mid + height / 2;
      });

      fillLegend();
    }

    // ── Hover isolation ─────────────────────────────────────────────────────
    function nodeEls() { return $('canvas').querySelectorAll('.sk-node'); }
    function focusLink(l, p, e) {
      document.body.classList.add('focused');
      p.classList.add('hot');
      var els = nodeEls();
      for (var i = 0; i < els.length; i++) {
        if (els[i].__node === l.s || els[i].__node === l.t) els[i].classList.add('hot');
      }
      var extra = l.decision ? '<br>' + esc(l.decision) : '';
      showTip('<b>' + esc(l.s.label) + ' → ' + esc(l.t.label) + '</b><br>' + plural(l.value) + extra, e);
    }
    function focusNode(n, e) {
      document.body.classList.add('focused');
      var keep = [n];
      n.in.forEach(function (l) { keep.push(l.s); });
      n.out.forEach(function (l) { keep.push(l.t); });
      var els = nodeEls();
      for (var i = 0; i < els.length; i++) {
        if (keep.indexOf(els[i].__node) >= 0) els[i].classList.add('hot');
      }
      var paths = $('links').querySelectorAll('path');
      for (var j = 0; j < paths.length; j++) {
        var lk = paths[j].__link;
        if (lk && (lk.s === n || lk.t === n)) paths[j].classList.add('hot');
      }
      var lines = [];
      if (n.out.length) lines.push('<u>Goes to</u> ' + listOf(n.out, 't'));
      if (n.in.length) lines.push('<u>Comes from</u> ' + listOf(n.in, 's'));
      showTip('<b>' + esc(n.label) + '</b> · ' + plural(n.value) + (lines.length ? '<br>' + lines.join('<br>') : ''), e);
    }
    function listOf(links, end) {
      return links.slice().sort(function (a, b) { return b.value - a.value; }).slice(0, 6)
        .map(function (l) { return esc(l[end].label) + ' (' + l.value + ')'; }).join(', ')
        + (links.length > 6 ? ', …' : '');
    }
    function unfocus() {
      document.body.classList.remove('focused');
      var hot = document.querySelectorAll('.hot');
      for (var i = 0; i < hot.length; i++) hot[i].classList.remove('hot');
      $('tip').style.display = 'none';
    }
    function showTip(html, e) { var t = $('tip'); t.innerHTML = html; t.style.display = 'block'; moveTip(e); }
    function moveTip(e) {
      var t = $('tip');
      t.style.left = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 12) + 'px';
      t.style.top = Math.min(e.clientY + 16, window.innerHeight - t.offsetHeight - 10) + 'px';
    }

    // ── Pan / zoom / fit — ported from the Visual Sitemap engine ─────────────
    var scale = 1, tx = 0, ty = 0, panning = false, sx = 0, sy = 0, stx = 0, sty = 0;
    function applyXform() {
      $('canvas').style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      var zl = $('zoom-label');
      if (zl) zl.textContent = Math.round(scale * 100) + '%';
    }
    function setupPanZoom() {
      var viewport = $('viewport');
      viewport.addEventListener('wheel', function (e) {
        e.preventDefault();
        var r = viewport.getBoundingClientRect();
        var mx = e.clientX - r.left, my = e.clientY - r.top, MAX = 80;
        var raw = Math.max(-MAX, Math.min(MAX, e.deltaY));
        var ns = Math.min(3, Math.max(0.10, scale * (1 + (raw / MAX) * 0.18)));
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
      var totalW = GUT_L + CANVAS_W + GUT_R;
      var vw = viewport.clientWidth, vh = viewport.clientHeight, margin = 24;
      if (!vw || !vh) return;
      var s = Math.min((vw - margin * 2) / totalW, (vh - margin * 2) / CANVAS_H);
      scale = Math.max(0.10, Math.min(1, s));
      tx = (vw - totalW * scale) / 2;
      ty = Math.max(margin, (vh - CANVAS_H * scale) / 2);
      applyXform();
    }

    // ── Toolbar ─────────────────────────────────────────────────────────────
    function wireToolbar() {
      // Shape is a button group (few, and worth seeing all at once); From is a
      // select, and the host omits it entirely on a single-site audit.
      SHAPES.forEach(function (sh) {
        var b = $('btn-shape-' + sh.key);
        if (!b) return;
        b.addEventListener('click', function () {
          if (shape === sh.key || !VIEWS[from + '|' + sh.key]) return;
          shape = sh.key;
          SHAPES.forEach(function (o) {
            var e = $('btn-shape-' + o.key);
            if (e) e.classList.toggle('on', o.key === shape);
          });
          unfocus(); render(); fitToScreen();
        });
      });

      var fs = $('fromsel');
      if (fs) fs.addEventListener('change', function () {
        if (!VIEWS[this.value + '|' + shape]) return;
        from = this.value;
        syncColorByLabels();
        unfocus(); render(); fitToScreen();
      });

      var cb = $('colorby');
      if (cb) cb.addEventListener('change', function () { colorBy = this.value; unfocus(); render(); });

      // These belong here, NOT in syncColorByLabels() — that runs again on every
      // axis change, so wiring them there stacked a fresh listener per switch:
      // two toggles per Legend click (panel never opens), two emits per Export.
      if ($('btn-fit')) $('btn-fit').addEventListener('click', fitToScreen);
      if ($('legend-btn')) $('legend-btn').addEventListener('click', function (e) { e.stopPropagation(); this.classList.toggle('open'); });
      if ($('btn-export-client')) $('btn-export-client').addEventListener('click', function () { emit({ type: 'export', format: 'client' }); });
      if ($('btn-export-pdf')) $('btn-export-pdf').addEventListener('click', function () { emit({ type: 'export', format: 'pdf' }); });
      document.addEventListener('click', function () {
        var lb = $('legend-btn'); if (lb) lb.classList.remove('open');
      });

      syncColorByLabels();
    }

    // "Color by current section" / "…by source site" — the second option names
    // whatever the left column currently is, or it reads as a stale label.
    // Called on every axis change, so it must stay free of side effects.
    function syncColorByLabels() {
      var cb = $('colorby');
      if (!cb) return;
      var f = FROMS.filter(function (x) { return x.key === from; })[0];
      var opt = cb.querySelector('option[value="source"]');
      if (opt && f) opt.textContent = 'Color by ' + f.label.toLowerCase();
    }
    function fillLegend() {
      var el = $('legend-body');
      if (!el) return;
      // Colouring by source means colouring by whatever the left column is, so
      // the legend follows `from`, not a fixed key.
      var entries = LEGENDS[colorBy === 'decision' ? 'decision' : from] || [];
      if (!entries.length) { el.innerHTML = '<div class="legend-note">No legend for this view.</div>'; return; }
      el.innerHTML = entries.map(function (e) {
        return '<div class="legend-row"><div class="l-sw" style="background:' + esc(e.color) + '"></div> ' + esc(e.label) + '</div>';
      }).join('');
    }

    // ── Print readiness ─────────────────────────────────────────────────────
    function markReady() {
      if (MODE !== 'print') return;
      var canvas = $('canvas');
      canvas.style.transform = 'none';
      var totalW = GUT_L + CANVAS_W + GUT_R;
      var st = document.getElementById('print-page-style') || document.createElement('style');
      st.id = 'print-page-style';
      st.textContent = '@page { size: ' + (totalW + 96) + 'px ' + (CANVAS_H + 96) + 'px; margin: 48px; }';
      document.head.appendChild(st);
      document.body.classList.add('print-ready');
      document.title = 'READY';
    }

    function init() {
      wireToolbar();
      setupPanZoom();
      render();
      markReady();
      // Two frames: the webview reports a zero-height viewport on the first.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { if (MODE !== 'print') fitToScreen(); });
      });
      window.addEventListener('resize', function () { if (MODE !== 'print') fitToScreen(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  // ── Static CSS (no interpolation → safe as a template literal) ──
  var CSS = `
:root{--bg:#f0f2f5;--white:#fff;--border:#c8cdd6;--border-dk:#9aa0ab;--text:#1a1d23;--text-mid:#4a5060;--text-dim:#8890a0;--accent:#2d6a9f;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{width:100%;height:100%;overflow:hidden;background:var(--bg);font-family:"Inter","IBM Plex Sans",system-ui,sans-serif;font-size:13px;color:var(--text);}
#toolbar{position:fixed;top:0;left:0;right:0;height:41px;z-index:100;display:flex;align-items:center;gap:9px;padding:0 14px;background:var(--white);border-bottom:1px solid var(--border);overflow-x:auto;}
#toolbar h1{font-size:13px;font-weight:700;white-space:nowrap;}
.spacer{flex:1;}
.tb-btn{padding:3px 10px;font-size:11px;font-family:inherit;border:1px solid var(--border-dk);border-radius:4px;background:var(--white);color:var(--text-mid);cursor:pointer;white-space:nowrap;transition:background .12s,color .12s;}
.tb-btn:hover{background:#eef0f4;color:var(--text);}
.tb-btn.on{background:#e7edf5;border-color:var(--accent);color:var(--accent);font-weight:600;}
select.tb-btn{padding:3px 6px;}
#zoom-label{font-size:11px;color:var(--text-dim);min-width:36px;text-align:right;}
.tb-sep{width:1px;height:18px;background:var(--border);flex-shrink:0;}
#viewport{position:absolute;top:41px;left:0;right:0;bottom:0;overflow:hidden;cursor:grab;background:var(--bg);}
#viewport.panning{cursor:grabbing;}
body.printing #viewport{position:static;top:0;overflow:visible;}
#canvas{position:relative;transform-origin:0 0;background:var(--white);}
svg#links{position:absolute;top:0;left:0;overflow:visible;}
svg#links path{fill:none;transition:stroke-opacity .12s;}
.sk-node{position:absolute;border-radius:2px;cursor:pointer;transition:opacity .12s;}
.sk-node:hover{filter:brightness(1.12);}
.sk-lbl{position:absolute;font-size:11px;color:var(--text-mid);white-space:nowrap;pointer-events:none;line-height:1.25;overflow:hidden;text-overflow:ellipsis;}
.sk-lbl b{font-weight:600;color:var(--text);display:block;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;}
.sk-lbl span{color:var(--text-dim);font-size:10px;}
.sk-colhdr{position:absolute;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim);white-space:nowrap;}
body.focused svg#links path{stroke-opacity:.07!important;}
body.focused svg#links path.hot{stroke-opacity:.62!important;}
body.focused .sk-node{opacity:.28;}
body.focused .sk-node.hot{opacity:1;}
#tip{position:fixed;z-index:200;display:none;background:#1a1d23;color:#fff;font-size:11px;padding:6px 9px;border-radius:4px;pointer-events:none;max-width:320px;line-height:1.45;box-shadow:0 4px 14px rgba(0,0,0,.28);}
#tip b{font-weight:600;}
#tip u{text-decoration:none;color:#9aa8bd;}
#legend-btn{position:relative;cursor:pointer;}
/* Fixed, not absolute: #toolbar sets overflow-x:auto, and per spec a non-visible
   value on one axis forces the other to auto — so an absolutely-positioned panel
   hanging below the 41px bar was clipped to a sliver. Matches sitemap-template.js,
   which has always positioned its legend this way. max-height keeps a long legend
   (20 capped sections, or many custom KKE states) on screen. */
#legend-panel{display:none;position:fixed;top:47px;right:14px;background:var(--white);border:1px solid var(--border);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.14);padding:10px 12px;min-width:180px;max-height:calc(100vh - 60px);overflow-y:auto;z-index:400;cursor:default;}
#legend-btn.open #legend-panel{display:block;}
.legend-row{display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 0;color:var(--text-mid);}
.legend-row .l-sw{width:12px;height:12px;border-radius:3px;flex-shrink:0;}
.legend-note{font-size:11px;color:var(--text-dim);}
#hint{position:fixed;bottom:9px;left:14px;font-size:10.5px;color:var(--text-dim);z-index:60;pointer-events:none;}
@media print{
  #toolbar,#hint,#tip{display:none!important;}
  #viewport{position:static;overflow:visible;top:0;}
  #canvas{transform:none!important;position:static;}
  body{background:#fff;overflow:visible;height:auto;}
}
`;

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function build(data) {
    var mode = (data && data.mode) || 'app';
    var title = (data && data.title) || 'Content Flow';
    var froms = (data && data.froms) || [{ key: 'section', label: 'Current section' }];
    var shapes = (data && data.shapes) || [{ key: 'both', label: 'Decision → New' }];
    var defaultFrom = (data && data.defaultFrom) || froms[0].key;
    var defaultShape = (data && data.defaultShape) || shapes[0].key;
    var dataJson = JSON.stringify(data || {}).replace(/<\//g, '<\\/');
    var engineSrc = sankeyEngine.toString();

    var toolbar = '';
    if (mode !== 'print') {
      toolbar += '<div id="toolbar">';
      toolbar += '<h1>' + escAttr(title) + '</h1><span class="spacer"></span>';
      // Only worth a control when there's a choice — a single-site audit has
      // exactly one sensible left column and shouldn't be asked about it.
      if (froms.length > 1) {
        toolbar += '<select class="tb-btn" id="fromsel">'
          + froms.map(function (f) {
              return '<option value="' + escAttr(f.key) + '"' + (f.key === defaultFrom ? ' selected' : '') + '>'
                + escAttr(f.label) + '</option>';
            }).join('')
          + '</select>';
      }
      if (shapes.length > 1) {
        toolbar += shapes.map(function (sh) {
          return '<button class="tb-btn' + (sh.key === defaultShape ? ' on' : '') + '" id="btn-shape-'
            + escAttr(sh.key) + '">' + escAttr(sh.label) + '</button>';
        }).join('');
        toolbar += '<div class="tb-sep"></div>';
      }
      toolbar += '<select class="tb-btn" id="colorby">'
        + '<option value="decision">Color by decision</option>'
        + '<option value="source">Color by source</option>'
        + '</select>';
      toolbar += '<div class="tb-sep"></div>';
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

    var hint = mode === 'print' ? ''
      : '<div id="hint">Hover a band or block to isolate its flow · drag to pan · scroll to zoom</div>';

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
      + '<title>' + escAttr(title) + '</title>'
      + '<style>' + CSS + '</style></head><body'
      + (mode === 'print' ? ' class="printing"' : '') + '>'
      + toolbar
      + '<div id="viewport"><div id="canvas"><svg id="links"></svg></div></div>'
      + '<div id="tip"></div>'
      + hint
      + '<script>window.__SANKEY_DATA__=' + dataJson + ';<\/script>'
      + '<script>(' + engineSrc + ')();<\/script>'
      + '</body></html>';
    return html;
  }

  window.SankeyTemplate = { build: build };
})();
