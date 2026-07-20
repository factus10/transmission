# Transmission — Miro auth worker

A ~150-line Cloudflare Worker whose only job is to hold the Miro app's
**client secret** and perform the OAuth code→token exchange, so the desktop app
never ships that secret.

## Why it's needed

Miro requires the OAuth 2.0 authorization-code flow for all REST API access and
**does not support PKCE** — `code_challenge` / `code_verifier` appear nowhere in
their OpenAPI spec or docs. Without PKCE, the code→token exchange must present
`client_secret`. A desktop app embedding that secret makes it extractable from
the bundle by anyone, who could then publish a convincing fake "Transmission"
and harvest users' Miro tokens.

Transmission keeps a paste-your-own-token path for power users and as a
fallback, but that requires each person to create their own Miro app — too high
a bar for most users. This worker is what makes one-click **Connect to Miro**
possible.

## Setup (one time)

### 0. Create a Cloudflare account

Sign up at <https://dash.cloudflare.com/sign-up> — email and password, free.
**No credit card is required** for the Workers free plan.

Two things to know as you go through it:

- Cloudflare will offer to add a **website/domain**. **Skip it.** Workers don't
  need a domain; this worker will live on a free `*.workers.dev` URL.
- The first time you open **Workers & Pages** you'll be asked to choose a
  **`workers.dev` subdomain**. This is account-wide and effectively permanent,
  and it becomes part of every worker URL you ever deploy:
  `<worker-name>.<your-subdomain>.workers.dev`. Pick something you're happy to
  live with (e.g. `factus10`).

Then authorise the CLI — this opens a browser to approve the connection:

```bash
npx wrangler login
npx wrangler whoami     # should now show your account
```

**Free-tier headroom.** Workers KV allows 100,000 reads and 1,000 writes per
day. One Miro connection costs about 2 writes, 2 deletes, and a handful of
reads, so the write budget is the binding limit at roughly 250 connections per
day — far beyond what this needs.

### 1. Create the Miro app

Miro → **Profile settings → Your apps → Create new app**.

- Tick scopes **`boards:read`** and **`boards:write`**.
- Choose **non-expiring tokens**. This is *immutable after creation* — pick it
  now. With expiring tokens you'd also need refresh plumbing, which neither the
  worker nor the app implements.
- Leave the redirect URI blank for now; you'll fill it in at step 4.

Note the **Client ID** and **Client secret**.

### 2. Create the KV namespace

All `wrangler` commands below run **from this directory** (`server/miro-auth`,
relative to the repository root — note that while this feature is on a branch,
the only checkout of it is the git worktree, not the main clone):

```bash
cd "$(git rev-parse --show-toplevel)/server/miro-auth"
npx wrangler kv namespace create SESSIONS
```

Put the returned `id` into `wrangler.toml`, and your Client ID into
`MIRO_CLIENT_ID` in the same file. Neither is secret.

### 3. Set the secret and deploy

```bash
npx wrangler secret put MIRO_CLIENT_SECRET   # paste when prompted; never committed
npx wrangler deploy
```

Deploy prints the worker URL, e.g. `https://transmission-miro-auth.<you>.workers.dev`.

### 4. Register the redirect URI in Miro

Back in the Miro app settings, set the redirect URI to **exactly**:

```
https://transmission-miro-auth.<you>.workers.dev/callback
```

Miro matches this string exactly — a trailing slash difference will fail.

### 5. Point the app at the worker

Set `MIRO_AUTH_BASE` in `miro.js` to the worker URL (no trailing slash).

### 6. Verify

```bash
curl https://transmission-miro-auth.<you>.workers.dev/health
# {"ok":true}
```

Then use **Connect to Miro** in App Settings.

## Endpoints

| Route | Caller | Purpose |
|---|---|---|
| `POST /begin` | app | Registers `{sid, secretHash}` before the browser opens |
| `GET /start?s=` | browser | Redirects to Miro consent (only for a registered `sid`) |
| `GET /callback` | browser | Miro returns here; exchanges the code, stashes the token |
| `POST /claim` | app | Exchanges `{sid, secret}` for the token, once |
| `GET /health` | anyone | Liveness |

## Security notes

- **Two-value split.** `sid` travels through the browser, so it lands in history
  and possibly a referrer header. It cannot claim a token on its own — only the
  app holds `secret`, which never goes near the browser. `/claim` verifies
  `sha256(secret)` against the stored hash in constant time.
- **Nothing durable is stored.** Pending records live 15 minutes, tokens 5
  minutes, and a token is deleted on first successful claim. The worker holds
  no user data at rest beyond that window.
- **`/start` only redirects for a registered session**, so it can't be used as
  an open redirector into Miro's consent screen.
- **Errors are deliberately opaque.** Miro's token endpoint takes the secret as
  a *query parameter*, so its error bodies can echo a URL containing the
  secret — the worker never forwards Miro's response body or internal error
  text to the client.
- The worker never logs tokens. Don't add logging that does.

## If the worker is down

Users can still connect by pasting a token from their own Miro app — the
fallback path in App Settings. That's the reason for keeping it.
