// ════════════════════════════════════════════════════════════════════════════
// Transmission — Miro OAuth token-exchange worker
//
// WHY THIS EXISTS
// Miro requires the OAuth authorization-code flow and does not support PKCE
// (no code_challenge anywhere in their API surface). Exchanging the auth code
// for a token therefore needs the app's client_secret. Shipping that secret
// inside a desktop bundle would make it extractable by anyone, so the exchange
// happens here instead: the secret lives only in this worker's bindings, and
// the desktop app never sees it.
//
// The alternative — every user creating their own Miro app — works but is far
// too high a bar for non-technical users. That path still exists in the app as
// a paste-a-token fallback; this worker is what makes one-click Connect
// possible.
//
// FLOW
//   1. App generates `sid` (public) + `secret` (private, never leaves the app),
//      then POSTs { sid, secretHash } to /begin.
//   2. App opens the user's browser at /start?s=<sid>.
//   3. /start redirects to Miro's consent screen with state=<sid>.
//   4. Miro redirects the browser back to /callback?code=…&state=<sid>.
//   5. /callback exchanges the code for a token and stashes it under <sid>
//      with a short TTL, then shows a "you can close this tab" page.
//   6. App POSTs { sid, secret } to /claim; the worker checks the hash,
//      returns the token ONCE, and deletes the record.
//
// Why the two-value split: `sid` travels through the browser, so it lands in
// browser history and possibly a referrer header. On its own it cannot claim
// the token — only the app holds `secret`, and it never goes near the browser.
//
// BINDINGS (see wrangler.toml)
//   MIRO_CLIENT_ID      var    — not secret
//   MIRO_CLIENT_SECRET  secret — `wrangler secret put MIRO_CLIENT_SECRET`
//   SESSIONS            KV     — short-lived pending/-token records
// ════════════════════════════════════════════════════════════════════════════

const PENDING_TTL = 900;   // 15 min to complete consent in the browser
const TOKEN_TTL = 300;     // 5 min for the app to claim after consent
const SID_RE = /^[A-Za-z0-9_-]{32,128}$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const html = (body, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Transmission &amp; Miro</title>
     <style>
       body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
            display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;
            background:#f0f2f5;color:#1a1d23}
       .card{background:#fff;border:1px solid #c8cdd6;border-radius:10px;padding:32px 40px;
             max-width:420px;text-align:center;box-shadow:0 2px 14px rgba(0,0,0,.06)}
       h1{font-size:17px;margin:0 0 10px}
       p{font-size:13px;line-height:1.55;color:#4a5060;margin:0}
     </style>
     <div class="card">${body}</div>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time compare so a wrong secret cannot be narrowed down by timing.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const redirectUriFor = (url) => new URL('/callback', url.origin).toString();

// Turns Miro's token-endpoint error into something diagnostic but safe to show.
//
// The constraint: Miro takes client_secret as a QUERY parameter, so its error
// bodies can echo a URL containing the secret. So this never passes text
// through — it matches a whitelist of known OAuth error codes and renders our
// own wording. Anything unrecognised degrades to the bare HTTP status.
const OAUTH_ERROR_HELP = {
  invalid_client: 'The app credentials were rejected — check MIRO_CLIENT_SECRET on the worker.',
  invalid_grant: 'The authorisation code was already used or has expired — start again.',
  invalid_request: 'The token request was malformed.',
  unauthorized_client: 'This app is not allowed to use this grant type.',
  redirect_uri_mismatch: 'The redirect URI does not match the one registered in Miro.',
  unsupported_grant_type: 'The grant type is not supported.',
};

function safeOauthError(bodyText, status) {
  let code = '';
  try {
    const b = JSON.parse(bodyText);
    // Only ever read the identifier field, never a message or description.
    const raw = String((b && (b.error || b.code)) || '');
    if (/^[a-z_]{3,40}$/.test(raw)) code = raw;
  } catch (e) { /* non-JSON body — fall through to the status */ }
  if (code && OAUTH_ERROR_HELP[code]) return `${OAUTH_ERROR_HELP[code]} (${code})`;
  if (code) return `Miro reported: ${code}`;
  return `Miro returned HTTP ${status}.`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // ── 1. App registers a pending session before opening the browser ──────
      if (url.pathname === '/begin' && request.method === 'POST') {
        const { sid, secretHash } = await request.json().catch(() => ({}));
        if (!SID_RE.test(sid || '') || !/^[a-f0-9]{64}$/.test(secretHash || '')) {
          return json({ error: 'bad request' }, 400);
        }
        await env.SESSIONS.put(`p:${sid}`, secretHash, { expirationTtl: PENDING_TTL });
        return json({ ok: true });
      }

      // ── 2. Browser lands here; bounce to Miro's consent screen ────────────
      if (url.pathname === '/start') {
        const sid = url.searchParams.get('s') || '';
        if (!SID_RE.test(sid)) return html('<h1>Invalid link</h1><p>Start the connection again from Transmission.</p>', 400);
        // Only proceed for a session the app actually registered, so this is
        // not an open redirector into Miro's consent screen.
        if (!(await env.SESSIONS.get(`p:${sid}`))) {
          return html('<h1>This link has expired</h1><p>Start the connection again from Transmission.</p>', 410);
        }
        const auth = new URL('https://miro.com/oauth/authorize');
        auth.searchParams.set('response_type', 'code');
        auth.searchParams.set('client_id', env.MIRO_CLIENT_ID);
        auth.searchParams.set('redirect_uri', redirectUriFor(url));
        auth.searchParams.set('state', sid);
        return Response.redirect(auth.toString(), 302);
      }

      // ── 3. Miro redirects back with the code ─────────────────────────────
      if (url.pathname === '/callback') {
        const sid = url.searchParams.get('state') || '';
        const code = url.searchParams.get('code') || '';
        const denied = url.searchParams.get('error');
        if (denied) return html('<h1>Connection cancelled</h1><p>Nothing was changed. You can close this tab.</p>');
        if (!SID_RE.test(sid) || !code) return html('<h1>Invalid response</h1><p>Start the connection again from Transmission.</p>', 400);

        const secretHash = await env.SESSIONS.get(`p:${sid}`);
        if (!secretHash) return html('<h1>This link has expired</h1><p>Start the connection again from Transmission.</p>', 410);

        // Miro takes these as QUERY parameters on a POST — not a form body.
        const ex = new URL('https://api.miro.com/v1/oauth/token');
        ex.searchParams.set('grant_type', 'authorization_code');
        ex.searchParams.set('client_id', env.MIRO_CLIENT_ID);
        ex.searchParams.set('client_secret', env.MIRO_CLIENT_SECRET);
        ex.searchParams.set('code', code);
        ex.searchParams.set('redirect_uri', redirectUriFor(url));

        const res = await fetch(ex.toString(), { method: 'POST' });
        if (!res.ok) {
          // Miro's body can echo the request URL, and that URL carries the
          // client secret — so never render it wholesale. Instead lift only the
          // short OAuth error identifier, which is what actually diagnoses the
          // failure (`invalid_client` = bad/missing secret, `invalid_grant` =
          // stale or reused code, `redirect_uri_mismatch` = registration).
          // A generic failure here cost real debugging time once already.
          return html(
            '<h1>Miro rejected the connection</h1>' +
            `<p>${safeOauthError(await res.text().catch(() => ''), res.status)}</p>` +
            '<p>Please try again from Transmission.</p>', 502);
        }
        const tok = await res.json();
        if (!tok || !tok.access_token) return html('<h1>No token returned</h1><p>Please try again from Transmission.</p>', 502);

        await env.SESSIONS.put(`t:${sid}`, JSON.stringify({
          secretHash,
          access_token: tok.access_token,
          team_id: tok.team_id || null,
          user_id: tok.user_id || null,
          scope: tok.scope || '',
          // Present only if the Miro app was created with EXPIRING tokens. The
          // app warns when it sees these, since it has no refresh plumbing.
          refresh_token: tok.refresh_token || null,
          expires_in: tok.expires_in || null,
        }), { expirationTtl: TOKEN_TTL });
        await env.SESSIONS.delete(`p:${sid}`);

        return html('<h1>Connected to Miro</h1><p>You can close this tab and return to Transmission.</p>');
      }

      // ── 4. App claims the token, once ────────────────────────────────────
      if (url.pathname === '/claim' && request.method === 'POST') {
        const { sid, secret } = await request.json().catch(() => ({}));
        if (!SID_RE.test(sid || '') || typeof secret !== 'string') return json({ error: 'bad request' }, 400);

        const raw = await env.SESSIONS.get(`t:${sid}`);
        if (!raw) return json({ status: 'pending' }, 202);   // not authorised yet, or expired

        const rec = JSON.parse(raw);
        if (!timingSafeEqual(rec.secretHash, await sha256Hex(secret))) {
          return json({ error: 'forbidden' }, 403);
        }
        // Single use: the token exists in KV for at most one successful claim.
        await env.SESSIONS.delete(`t:${sid}`);
        return json({
          status: 'ok',
          access_token: rec.access_token,
          team_id: rec.team_id,
          scope: rec.scope,
          expires_in: rec.expires_in,
          has_refresh_token: !!rec.refresh_token,
        });
      }

      if (url.pathname === '/health') return json({ ok: true });

      return json({ error: 'not found' }, 404);
    } catch (err) {
      // Never surface internals — an error string here could carry the URL the
      // secret was sent on.
      return json({ error: 'server error' }, 500);
    }
  },
};
