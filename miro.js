// ─── Miro integration ─────────────────────────────────────────────────────────
//
// Token handling and a thin REST client for the Miro v2 API.
//
// AUTH MODEL — two paths, and why.
// Miro requires the OAuth authorization-code flow and does NOT support PKCE
// (no code_challenge anywhere in their API surface). The code→token exchange
// therefore needs the app's client_secret, which must not ship inside a desktop
// bundle where anyone could extract it and impersonate this app.
//
//  1. Connect to Miro (default) — the secret lives in a small Cloudflare Worker
//     (server/miro-auth) that performs the exchange. The user clicks once,
//     authorises in their browser, and we claim the token. See that README.
//
//  2. Paste a token (fallback) — the user creates their own Miro app and pastes
//     the token from "Install app and get OAuth token". No infrastructure
//     involved, so it still works if the worker is unreachable, and it lets a
//     power user scope a token to a different team. Kept deliberately.
//
// Either way a token is scoped to ONE Miro team; multi-team users connect once
// per team.
//
// STORAGE — deliberately NOT prefs.json.
// prefs.json is cleartext and get-prefs ships its whole contents to the
// renderer on every startup (see claudeApiKey). A write-scoped Miro token
// should not live under those rules. It is encrypted with Electron's
// safeStorage (Keychain on macOS) into its own file, and it is never returned
// to the renderer — the renderer can set it, ask whether one exists, clear it,
// and ask main to make calls on its behalf, but cannot read it back.

const { safeStorage, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const MIRO_API_BASE = 'https://api.miro.com';
const TOKEN_FILENAME = 'miro-token.bin';

// Token-exchange worker (server/miro-auth). Holds the Miro client secret so the
// desktop bundle doesn't have to — see that README for why this exists at all.
// Empty string disables one-click Connect and leaves only the paste path.
const MIRO_AUTH_BASE = 'https://transmission-miro-auth.factus10.workers.dev';

let tokenPath = null;

// Called once from main.js after app is ready (safeStorage needs a ready app,
// and app.getPath('userData') is main-process-only).
function init(userDataPath) {
  tokenPath = path.join(userDataPath, TOKEN_FILENAME);
}

// ─── Token storage ────────────────────────────────────────────────────────────

function encryptionAvailable() {
  try { return safeStorage.isEncryptionAvailable(); }
  catch (e) { return false; }
}

function hasToken() {
  try { return !!tokenPath && fs.existsSync(tokenPath); }
  catch (e) { return false; }
}

// Returns the decrypted token, or '' if absent/unreadable. Main-process only —
// this value must never cross the IPC boundary.
function getToken() {
  if (!hasToken()) return '';
  try {
    return safeStorage.decryptString(fs.readFileSync(tokenPath));
  } catch (e) {
    // Encrypted with a different OS keychain entry (e.g. restored from another
    // machine's backup). Unrecoverable — treat as absent so the UI prompts for
    // a fresh paste rather than failing every call with a confusing 401.
    return '';
  }
}

function setToken(token) {
  const clean = String(token || '').trim();
  if (!clean) throw new Error('Token is empty');
  if (!tokenPath) throw new Error('Miro storage not initialized');
  if (!encryptionAvailable()) {
    // Refuse rather than silently falling back to cleartext. A user who thinks
    // a credential is encrypted and finds out otherwise is worse off than one
    // told up front that this machine cannot store it safely.
    throw new Error('This system cannot store credentials securely (OS encryption unavailable)');
  }
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, safeStorage.encryptString(clean));
  // Owner-only. Defence in depth — the contents are already encrypted.
  try { fs.chmodSync(tokenPath, 0o600); } catch (e) { /* best effort */ }
}

function clearToken() {
  try { if (hasToken()) fs.unlinkSync(tokenPath); } catch (e) { /* ignore */ }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── One-click connect ────────────────────────────────────────────────────────
//
// Opens the user's browser at the worker, which bounces to Miro's consent
// screen and stashes the resulting token; we then claim it. The `sid` travels
// through the browser (so it's in history); `secret` never leaves this process,
// and the worker requires it to release the token.

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let _connectAbort = null;
function cancelConnect() { if (_connectAbort) _connectAbort.cancelled = true; }

function connectConfigured() { return !!MIRO_AUTH_BASE; }

async function authFetch(apiPath, opts = {}) {
  const res = await net.fetch(MIRO_AUTH_BASE + apiPath, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let body = null;
  if (text) { try { body = JSON.parse(text); } catch (e) { /* non-JSON */ } }
  return { status: res.status, body };
}

// Resolves once the user finishes consent in the browser, or throws on
// timeout/cancel. Stores the token on success — the token itself is never
// returned to the caller, matching the rest of this module.
async function connectViaBrowser({ timeoutMs = 180000, onStatus } = {}) {
  if (!connectConfigured()) throw new Error('One-click connect is not configured in this build');
  if (!encryptionAvailable()) {
    throw new Error('This system cannot store credentials securely (OS encryption unavailable)');
  }

  const sid = b64url(crypto.randomBytes(32));
  const secret = b64url(crypto.randomBytes(32));
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

  const begin = await authFetch('/begin', { method: 'POST', body: { sid, secretHash } });
  if (begin.status !== 200) throw new Error('Could not reach the Transmission auth service');

  await shell.openExternal(`${MIRO_AUTH_BASE}/start?s=${encodeURIComponent(sid)}`);
  if (onStatus) onStatus('waiting');

  const ticket = { cancelled: false };
  _connectAbort = ticket;
  const deadline = Date.now() + timeoutMs;
  try {
    for (;;) {
      if (ticket.cancelled) throw new Error('Connection cancelled');
      if (Date.now() > deadline) throw new Error('Timed out waiting for Miro authorisation');
      await sleep(1500);
      if (ticket.cancelled) throw new Error('Connection cancelled');

      let r;
      try { r = await authFetch('/claim', { method: 'POST', body: { sid, secret } }); }
      catch (e) { continue; }                       // transient network blip; keep polling

      if (r.status === 202) continue;               // consent not finished yet
      if (r.status === 403) throw new Error('Authorisation could not be verified — please try again');
      if (r.status !== 200 || !r.body || !r.body.access_token) continue;

      setToken(r.body.access_token);
      return {
        teamId: r.body.team_id || null,
        scope: r.body.scope || '',
        // Only present if the Miro app was created with EXPIRING tokens. There
        // is no refresh plumbing here by design, so surface it rather than let
        // the user discover it when the token silently dies in an hour.
        expiring: !!r.body.expires_in || !!r.body.has_refresh_token,
      };
    }
  } finally {
    if (_connectAbort === ticket) _connectAbort = null;
  }
}

// ─── REST client ──────────────────────────────────────────────────────────────

// Miro returns errors as { type, code, message, status }. Surface the message
// where there is one; fall back to a status-specific explanation, since the
// raw codes ("tooManyRequests") are not useful to a end user.
function describeError(status, body) {
  const msg = body && typeof body.message === 'string' ? body.message : '';
  if (status === 401) return 'Token rejected by Miro (expired, revoked, or mistyped)';
  // A token carries the scopes it was minted with, so widening permissions on
  // the Miro app is not enough — the user has to reinstall to get a new token.
  // Say so, or they will change the checkbox and retry the same dead token.
  if (status === 403) {
    return 'Token lacks permission for this call (needs boards:write). '
         + 'Tick the scope on your Miro app, reinstall it to mint a new token, and paste that.';
  }
  if (status === 404) return msg || 'Not found';
  if (status === 429) return 'Miro rate limit exceeded — wait a minute and retry';
  return msg || `Miro API error ${status}`;
}


// Rate limiting. Miro allows 100,000 credits/minute per user+app, and EVERY
// item creation costs 100 — including items inside a bulk call, which is billed
// per item rather than per request. So bulk buys round trips and atomicity, not
// throughput: the ceiling is a flat ~1,000 items/minute however you batch.
//
// We pace proactively against a self-imposed budget rather than reacting to
// 429s, because a 429 mid-export leaves a half-drawn board. The window is a
// rolling 60s (Miro does not document rolling vs fixed, so assume the stricter
// reading) and we sit ~15% under the real ceiling.
const CREDITS_PER_ITEM = 100;
const CREDIT_BUDGET_PER_MIN = 85000;

function createCreditLimiter(perMinute = CREDIT_BUDGET_PER_MIN) {
  const spends = [];   // { t, credits }
  return async function take(credits) {
    for (;;) {
      const now = Date.now();
      while (spends.length && now - spends[0].t > 60000) spends.shift();
      const spent = spends.reduce((s, e) => s + e.credits, 0);
      if (spent + credits <= perMinute) { spends.push({ t: now, credits }); return; }
      // Wait for the oldest spend to age out of the window.
      await sleep(Math.max(250, 60000 - (now - spends[0].t) + 50));
    }
  };
}

// Single choke point for Miro HTTP. Follows the house pattern in main.js:
// throw here, catch at the ipcMain.handle boundary, return { error }.
async function miroFetch(apiPath, opts = {}) {
  const token = getToken();
  if (!token) throw new Error('No Miro token saved');

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };
  if (opts.body) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await net.fetch(MIRO_API_BASE + apiPath, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs || 20000),
    });
  } catch (e) {
    // Network-level failure: offline, DNS, TLS, or our own timeout.
    throw new Error(e.name === 'TimeoutError' ? 'Miro request timed out' : `Could not reach Miro (${e.message})`);
  }

  // Miro does not document a Retry-After, but it does send X-RateLimit-Reset
  // (unix seconds). Prefer Retry-After if it turns out to be present, fall back
  // to the reset time, then to a plain backoff. Retried in place so callers
  // never see a transient 429 — the proactive limiter should make this rare.
  if (response.status === 429 && (opts.retries == null || opts.retries > 0)) {
    const retriesLeft = (opts.retries == null ? 3 : opts.retries) - 1;
    const retryAfter = Number(response.headers.get('retry-after'));
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    let waitMs = 5000;
    if (retryAfter > 0) waitMs = retryAfter * 1000;
    else if (reset > 0) waitMs = Math.max(1000, reset * 1000 - Date.now());
    await sleep(Math.min(waitMs + Math.random() * 500, 65000));
    return miroFetch(apiPath, Object.assign({}, opts, { retries: retriesLeft }));
  }

  const text = await response.text();
  let body = null;
  if (text) { try { body = JSON.parse(text); } catch (e) { /* non-JSON error page */ } }

  if (!response.ok) throw new Error(describeError(response.status, body));
  return body;
}

// ─── Operations ───────────────────────────────────────────────────────────────

// Validates the token and reports what it can see. Doubles as the "Test
// connection" action: a 200 here proves the token is live and has boards:read.
async function testConnection() {
  const body = await miroFetch('/v2/boards?limit=50');
  const boards = (body && Array.isArray(body.data) ? body.data : []).map(b => ({
    id: b.id,
    name: b.name || '(untitled)',
    viewLink: b.viewLink || '',
  }));
  return {
    boards,
    total: body && typeof body.total === 'number' ? body.total : boards.length,
  };
}

async function listBoards() {
  return (await testConnection()).boards;
}

// Creates a board in the token's team. Needed both for "export to a new board"
// (usually preferable to appending a 400-node tree to an existing one) and as
// the way out of a freshly-installed app whose team has no boards yet.
// Note: Miro's free plan caps a team at 3 boards.
async function createBoard(name, description) {
  const board = await miroFetch('/v2/boards', {
    method: 'POST',
    body: {
      name: String(name || 'Untitled').slice(0, 60),
      description: String(description || '').slice(0, 300),
    },
  });
  return {
    id: board && board.id,
    name: board && board.name,
    viewLink: (board && board.viewLink) || '',
  };
}

// Reports what the token actually is: which team it was installed into, which
// user created it, and the scopes it was minted with. This is the answer to
// "connected but I see no boards" — almost always the app went into a
// different team than the one holding the user's boards, or the app simply
// has not been given access to any existing board yet.
async function tokenInfo() {
  const b = await miroFetch('/v1/oauth-token');
  return {
    type: b && b.type,
    scopes: (b && b.scopes) || [],
    team: b && b.team ? { id: b.team.id, name: b.team.name } : null,
    organization: b && b.organization ? { id: b.organization.id, name: b.organization.name } : null,
    user: b && b.user ? { id: b.user.id, name: b.user.name } : null,
    createdBy: b && b.createdBy ? { id: b.createdBy.id, name: b.createdBy.name } : null,
  };
}

// ─── Item creation ────────────────────────────────────────────────────────────

// A frame to hold the whole diagram. Frame position is board coordinates and
// addresses the frame's CENTRE; its children are then positioned relative to
// the frame's TOP-LEFT. That asymmetry is the single easiest thing to get
// wrong here, so callers should lay out in top-left space and let the frame
// absorb the translation.
async function createFrame(boardId, { title, x = 0, y = 0, width, height, fillColor }) {
  const frame = await miroFetch(`/v2/boards/${encodeURIComponent(boardId)}/frames`, {
    method: 'POST',
    body: {
      data: { title: String(title || 'Frame').slice(0, 200), format: 'custom', type: 'freeform' },
      style: fillColor ? { fillColor } : undefined,
      position: { x, y },
      geometry: { width, height },
    },
  });
  return { id: frame && frame.id, x, y, width, height };
}

const BULK_MAX = 20;   // hard API limit, not a tuning knob

// Bulk create. The endpoint takes a BARE JSON ARRAY (not an object wrapper),
// caps at 20 items, and is TRANSACTIONAL — one bad item rolls back the whole
// batch, so a retry must resend the entire chunk rather than the failed item.
//
// Worth knowing: bulk is billed Level 2 PER ITEM, so 20 items in one call
// costs exactly what 20 separate calls cost. It buys round trips and
// atomicity, never rate-limit headroom.
async function createItemsBulk(boardId, items) {
  if (!items.length) return [];
  if (items.length > BULK_MAX) throw new Error(`Bulk create takes at most ${BULK_MAX} items`);
  const body = await miroFetch(`/v2/boards/${encodeURIComponent(boardId)}/items/bulk`, {
    method: 'POST',
    body: items,
    timeoutMs: 30000,
  });
  return (body && Array.isArray(body.data) ? body.data : []);
}

// Builds one bulk-create entry for a sitemap node. Note every style value is a
// STRING, including the numeric ones — Miro rejects real numbers here.
// Miro's borderStyle enum is exactly normal|dotted|dashed, so the app offers
// only the three CSS line styles that round-trip. 'solid' is spelled 'normal'.
const MIRO_BORDER_STYLE = { solid: 'normal', normal: 'normal', dashed: 'dashed', dotted: 'dotted' };

function shapeItem({ text, sub, x, y, width, height, fillColor, borderColor, borderWidth, borderStyle, shape, fontSize, parentId }) {
  let content = `<p>${escapeMiroHtml(text || '')}</p>`;
  // Second paragraph carries the "+N hidden" note on collapsed nodes, mirroring
  // the sub-line the app card shows.
  if (sub) content += `<p>${escapeMiroHtml(sub)}</p>`;
  return {
    type: 'shape',
    data: { content: content, shape: shape || 'round_rectangle' },
    style: {
      fillColor: fillColor || '#ffffff',
      borderColor: borderColor || '#1a1a1a',
      borderWidth: String(borderWidth || 1),
      borderStyle: MIRO_BORDER_STYLE[borderStyle] || 'normal',
      color: '#1a1a1a',
      fontSize: String(fontSize || 12),
      textAlign: 'center',
      textAlignVertical: 'middle',
    },
    position: { x, y },
    geometry: { width, height },
    ...(parentId ? { parent: { id: parentId } } : {}),
  };
}

// Miro's content field accepts a small HTML subset; anything else is escaped
// and shows up as literal markup. Sitemap labels are arbitrary client text, so
// they must be escaped rather than trusted.
function escapeMiroHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Connectors have NO bulk endpoint — one call each. For a sitemap that is
// roughly half the total item cost of an export.
async function createConnector(boardId, { startId, endId, strokeColor, shape }) {
  const c = await miroFetch(`/v2/boards/${encodeURIComponent(boardId)}/connectors`, {
    method: 'POST',
    body: {
      startItem: { id: String(startId), snapTo: 'bottom' },
      endItem: { id: String(endId), snapTo: 'top' },
      shape: shape || 'elbowed',
      style: {
        strokeColor: strokeColor || '#9aa0ab',
        strokeWidth: '1.0',
        strokeStyle: 'normal',
        startStrokeCap: 'none',
        endStrokeCap: 'none',
      },
    },
  });
  return { id: c && c.id };
}

async function listItems(boardId, limit = 50) {
  const body = await miroFetch(`/v2/boards/${encodeURIComponent(boardId)}/items?limit=${limit}`);
  return (body && Array.isArray(body.data) ? body.data : []);
}

async function deleteBoard(boardId) {
  await miroFetch(`/v2/boards/${encodeURIComponent(boardId)}`, { method: 'DELETE' });
}

// Proves boards:WRITE (which testConnection cannot — read and write are
// separate scopes) and, in the same call, answers the open question about
// colour fidelity: #8fd14f is deliberately NOT one of the 16 values Miro's
// docs list for fillColor. If this shape comes back green, arbitrary hex is
// honoured and the sitemap's colour rules carry across intact.
async function createProbeShape(boardId) {
  if (!boardId) throw new Error('No board selected');
  const shape = await miroFetch(`/v2/boards/${encodeURIComponent(boardId)}/shapes`, {
    method: 'POST',
    body: {
      data: { content: '<p>Transmission connection test</p>', shape: 'round_rectangle' },
      style: {
        fillColor: '#8fd14f',       // off-palette on purpose — see above
        borderColor: '#1a1a1a',
        borderWidth: '2.0',
        color: '#1a1a1a',
        fontSize: '14',
        textAlign: 'center',
        textAlignVertical: 'middle',
      },
      position: { x: 0, y: 0 },
      geometry: { width: 240, height: 60 },
    },
  });
  return {
    itemId: shape && shape.id,
    // What Miro actually stored, so the caller can compare against what we
    // sent rather than trusting the request to have been honoured verbatim.
    fillColor: shape && shape.style && shape.style.fillColor,
  };
}

async function deleteItem(boardId, itemId) {
  await miroFetch(`/v2/boards/${encodeURIComponent(boardId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });
}

// ─── Sitemap export ───────────────────────────────────────────────────────────

let _cancelled = false;
function cancelExport() { _cancelled = true; }
function throwIfCancelled() { if (_cancelled) throw new Error('Export cancelled'); }

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Runs `worker` over `items` with bounded concurrency. Connectors have no bulk
// endpoint, so this is how ~400 of them get created without either serialising
// (slow) or firing all at once (which just burns the credit budget faster and
// hits the ceiling sooner).
async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      throwIfCancelled();
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

// plan = { frame: {title, width, height}, shapes: [...], edges: [[parentId, childId]] }
//
// Shape coordinates arrive in the layout's own top-left-origin space and are
// sent verbatim as frame-relative positions — verified against a live board:
// Miro stores and returns child coordinates in exactly that space, so no
// translation is needed. The frame itself is centre-positioned at the board
// origin, which is what absorbs the offset.
async function exportSitemap(boardId, plan, onProgress) {
  _cancelled = false;
  const take = createCreditLimiter();
  const report = (phase, done, total) => { try { onProgress && onProgress({ phase, done, total }); } catch (e) {} };

  const totalItems = 1 + plan.shapes.length + plan.edges.length;
  let created = 0;
  const bump = (n, phase) => { created += n; report(phase, created, totalItems); };

  // 1. Frame sized to the computed canvas.
  await take(CREDITS_PER_ITEM);
  const frame = await createFrame(boardId, {
    title: plan.frame.title,
    x: 0, y: 0,
    width: Math.max(100, Math.ceil(plan.frame.width)),
    height: Math.max(100, Math.ceil(plan.frame.height)),
  });
  bump(1, 'frame');

  // 2. Shapes, 20 per call. Bulk is transactional, so a failed chunk is retried
  //    whole; response order matches request order, which is what lets us map
  //    node ids to Miro item ids positionally.
  const idMap = {};
  const chunks = chunk(plan.shapes, BULK_MAX);
  for (const group of chunks) {
    throwIfCancelled();
    await take(CREDITS_PER_ITEM * group.length);
    const items = group.map(sp => shapeItem({
      text: sp.text, sub: sp.sub,
      x: sp.x, y: sp.y, width: sp.w, height: sp.h,
      fillColor: sp.fill, borderColor: sp.border, borderWidth: sp.borderWidth,
      borderStyle: sp.borderStyle, shape: sp.shape,
      fontSize: sp.fontSize,
      parentId: frame.id,
    }));
    const res = await createItemsBulk(boardId, items);
    // Backing "stack" shapes carry no nodeId — they are decoration behind a
    // collapsed node and must never become a connector endpoint.
    res.forEach((it, i) => { if (group[i] && group[i].nodeId) idMap[group[i].nodeId] = it.id; });
    bump(group.length, 'shapes');
  }

  // 3. Connectors, one call each, bounded concurrency.
  const edges = plan.edges.filter(([a, b]) => idMap[a] && idMap[b]);
  const skippedEdges = plan.edges.length - edges.length;
  let edgeFailures = 0;
  await pool(edges, 5, async ([parentId, childId]) => {
    await take(CREDITS_PER_ITEM);
    try {
      await createConnector(boardId, {
        startId: idMap[parentId], endId: idMap[childId],
        strokeColor: plan.connectorColor || '#9aa0ab',
      });
    } catch (e) {
      // One failed connector should not abandon a finished board — count it and
      // report honestly at the end rather than throwing away the whole export.
      edgeFailures++;
    }
    bump(1, 'connectors');
  });

  return {
    frameId: frame.id,
    shapes: Object.keys(idMap).length,
    connectors: edges.length - edgeFailures,
    edgeFailures,
    skippedEdges,
  };
}

module.exports = {
  init,
  exportSitemap,
  cancelExport,
  connectViaBrowser,
  cancelConnect,
  connectConfigured,
  hasToken,
  setToken,
  clearToken,
  encryptionAvailable,
  testConnection,
  tokenInfo,
  listBoards,
  createBoard,
  createFrame,
  createItemsBulk,
  shapeItem,
  createConnector,
  listItems,
  deleteBoard,
  BULK_MAX,
  createProbeShape,
  deleteItem,
  miroFetch,
  MIRO_API_BASE,
};
