# Building signed/notarized macOS binaries for Transmission

Adapted from the sibling PCL app's build doc (`~/Documents/Apple Dev/BUILD-SIGNED-BINARIES.md`)
for this repo. Credentials themselves stay in `~/Documents/Apple Dev/` (private,
mode 700, outside any git repo) — this doc only references that folder by path.
Don't copy the actual credential values into any file that's tracked by git,
don't paste them into a chat transcript, and don't read/paste the private key's
contents — only ever reference its file path.

## What's in `~/Documents/Apple Dev/`

| File | What it is |
|---|---|
| `AuthKey_*.p8` | App Store Connect API private key (notarization). The Key ID is the string in the filename after `AuthKey_`. Use the file path as the credential — never read or paste its contents. |
| `uuid.txt` | Team ID, Key ID, and Issuer UUID for the API key — read this file directly when you need the actual values, don't copy them elsewhere. |
| `Certificates.p12` / `developerID_application.cer` | The Developer ID Application signing certificate. Already installed in this Mac's login keychain — you shouldn't need these files directly for a normal build. |

This is the same Apple Developer account/Team used by the sibling PCL app, so
the same identity and API key work for both.

## Before you start: confirm the identity is installed

```bash
security find-identity -v -p codesigning
```

This should list exactly one `"Developer ID Application: <Name> (<TEAM_ID>)"`
identity. That parenthesized team ID matches the "Team ID" line in
`uuid.txt`. If nothing is listed, the cert isn't in the keychain (or has
expired) — re-import `Certificates.p12` from that folder, or ask the user;
don't try to work around a missing identity.

## Environment variables to set

Read the real values from `uuid.txt` and the `AuthKey_*.p8` filename — don't
hardcode them into any script or doc that leaves that folder.

```bash
export APPLE_SIGNING_IDENTITY="<Name> (<TEAM_ID>)"        # from `security find-identity`, common name only —
                                                            # do NOT include the "Developer ID Application: " prefix
export APPLE_API_KEY="/Users/david/Documents/Apple Dev/AuthKey_<KEY_ID>.p8"
export APPLE_API_KEY_ID="<KEY_ID>"                         # from the filename / uuid.txt
export APPLE_API_ISSUER="<ISSUER_UUID>"                    # "Issuer UUID" line in uuid.txt
```

electron-builder auto-detects these and runs `@electron/notarize` whenever
`APPLE_API_KEY`/`APPLE_API_KEY_ID`/`APPLE_API_ISSUER` are set. Unlike PCL,
this repo's `package.json` does **not** force `mac.identity` to `null` in the
base `build` config — so the plain `build`/`build:arm`/`build:intel` scripts
already sign automatically whenever a matching identity is found via
`APPLE_SIGNING_IDENTITY`. There's no separate signed/unsigned script split
here the way PCL has `dist:mac` vs `dist:mac:signed`.

## After the build: publishing

`scripts/publish-release.sh` (`npm run release:publish`) takes it from here —
both GitHub releases and the update manifest. Run it from the project dir after
a successful build:

```bash
npm run release:publish -- --manifest-notes /path/to/notes.txt
```

Omit `--manifest-notes` to create and verify the releases but leave the manifest
alone; `--dry-run` runs every check and publishes nothing. Re-running is safe:
an existing release is reused and its assets re-uploaded with `--clobber`, which
is the recovery path for an interrupted upload.

It refuses to publish artifacts that are not shippable (unstapled dmg or app,
Gatekeeper rejection, a bundle whose version does not match the one being
released, a non-universal binary, or a `dist/` still holding other versions'
files), uploads each asset separately, verifies byte counts against the local
files before publishing the draft, and asserts `releases/latest` resolves to the
new tag on both repos before the manifest is touched. See the release section of
CLAUDE.md for why each of those exists — every one traces to a release that
broke.

**Clear `dist/` before building.** The notarization loop below globs
`dist/*.dmg`, so artifacts left from earlier versions get submitted to Apple
again — one wasted round trip each, and a stale file sitting where a glob might
pick it up.

## Building in GitHub Actions instead

`.github/workflows/build-mac.yml` (*Build signed macOS app*) does the whole
signed build on a GitHub-hosted Mac. It runs on any `v*` tag push, or by hand
from the Actions tab (`gh workflow run build-mac.yml --ref <branch>`). It:

1. runs `npm ci` and `npm test`, and for a tag checks it matches `package.json` and `package-lock.json`;
2. imports the signing cert into a throwaway keychain;
3. builds the universal app (electron-builder signs, notarizes and staples the `.app`);
4. notarizes and staples the `.dmg` itself, as `build-signed-mac.sh` does;
5. runs `publish-release.sh`'s artifact checks: dmg and app stapled, Gatekeeper `Notarized Developer ID`, bundle version, universal binary;
6. uploads the `.dmg` and `.zip` as the `transmission-mac` artifact, kept 30 days.

It **does not publish**. Download the artifact into an empty `dist/` and
release as usual:

```bash
rm -f dist/*.dmg dist/*.zip
gh run download <run-id> --name transmission-mac --dir dist
npm run release:publish -- --manifest-notes release-notes/<version>.txt
```

It reads five repository secrets, the same names the ts2068-disk-browser
workflow uses. Set each from the file in `~/Documents/Apple Dev/` without
pasting a value: `base64 -i <file> | gh secret set <NAME>`, or
`gh secret set <NAME>` to type it at a hidden prompt.

| Secret | Value |
|---|---|
| `MAC_CERT_P12_BASE64` | base64 of `Certificates.p12` (Developer ID Application cert + private key) |
| `MAC_CERT_PASSWORD` | that `.p12`'s password |
| `APPLE_API_KEY_BASE64` | base64 of `AuthKey_<KEY_ID>.p8` |
| `APPLE_API_KEY_ID` | the Key ID (`uuid.txt`) |
| `APPLE_API_ISSUER` | the Issuer UUID (`uuid.txt`) |

The sandbox workaround below doesn't apply on a hosted runner. That runner has
no `com.apple.provenance` problem, so the workflow builds in place.

## Which build command to run

`cd ~/Documents/github/transmission` (or whichever worktree) first.

- **`npm run build`** (or `build:arm` / `build:intel`) — normal path, run this
  if you're in a regular unsandboxed terminal (not through an agent's
  tool-mediated Bash).
- **`npm run build:signed:sandboxed`** — use this if you're a Claude Code
  session running Bash through the harness's sandboxed tool execution. See
  "Why the sandboxed variant exists" below for why this matters — using the
  plain `build` from inside a mediated Bash tool will fail codesign partway
  through.

Both need the four env vars above set in the same shell invocation. The
sandboxed variant's output lands in `dist/` in the project directory (copied
back from its scratch build dir); the plain variant writes directly to `dist/`.

## Why the sandboxed variant exists

Building directly in the project directory from inside a tool-mediated Bash
environment (Claude Code's sandboxed command execution) fails codesign with:

```
resource fork, Finder information, or similar detritus not allowed
```

Root cause (confirmed empirically, on this exact repo, across several
independent attempts — including a from-scratch `node_modules`, a single-arch
build with no universal/lipo-merge step, and an `afterPack` hook that
byte-copies every file to try to strip the attribute before signing): every
file written through the sandboxed execution path — even a trivial
`echo hi > file.txt` — picks up a `com.apple.provenance` extended attribute
that `xattr -d`/`-c` report removing but don't actually remove, since it's
tied to the file's copy-on-write lineage at the filesystem level, not a
normal removable attribute. This is specific to agent-mediated tool
execution, not macOS or Electron in general — a normal Terminal.app session
won't hit this for most files, though see the caveat below.

`npm run build:signed:sandboxed` runs `scripts/build-signed-mac.sh`, which
rsyncs the project to a scratch `/tmp` dir, runs `npm install` + the real
signed build there, and copies back only the sealed `.dmg`/`.zip` — never the
loose `.app` bundle, which would get re-tainted by being copied back through
the same sandboxed path. The `.dmg`/`.zip` are opaque containers; copying the
container file doesn't touch the signed bytes sealed inside it. The
`afterPack` hook (`scripts/afterPack.js`) also strips `com.apple.provenance`
from every file in the packaged `.app` as a general defensive measure, which
covers the documented macOS-Sequoia-era version of this same-named issue for
anyone building outside this sandbox.

**Caveat found while adapting this doc for Transmission:** the `afterPack`
hook alone (without also building in the scratch `/tmp` dir) was NOT
sufficient here — it reported stripping `com.apple.provenance` from the
packaged app's files, but the specific file that trips codesign
(`Transmission Helper (GPU)`, one of Electron's own helper apps) still
carried the attribute afterward and still failed signing, reproducing
identically across a fresh `node_modules` install, a single-arch build, and
even a normal (non-agent) Terminal.app run in this project directory. Use
`build:signed:sandboxed` — the scratch-`/tmp`-plus-copy-back-only-the-archive
approach — rather than relying on `afterPack` by itself.

If you're not sure whether your Bash tool calls are sandboxed, just default
to `build:signed:sandboxed` — it works either way, just slower (fresh
`npm install` in `/tmp`).

## Verifying the result

```bash
cd ~/Documents/github/transmission/dist
APP=$(mktemp -d) && ditto *.zip "$APP" 2>/dev/null || hdiutil attach *.dmg -mountpoint "$APP"

codesign --verify --deep --strict "$APP"/*.app   # should print nothing (success)
spctl -a -vvv "$APP"/*.app                        # should say: accepted, source=Notarized Developer ID
xcrun stapler validate "$APP"/*.app                # should say: The validate action worked!
xcrun stapler validate *.dmg                       # ditto — the CONTAINER, see below
```

### The .dmg needs its own ticket

electron-builder notarizes and staples the **app**, then wraps it in a disk
image — so the container itself carries no ticket. The app inside is stapled
either way, which is why this went unnoticed for years: Gatekeeper is happy
when the app launches. The gap only shows on a machine with **no network**,
where macOS can't reach Apple to assess the unnotarized container and opening
the image fails.

`build:signed:sandboxed` now submits the `.dmg` separately and staples it,
after copying the artifacts back. It adds a few minutes (a real notarization
round trip) and is skipped with a warning if `APPLE_API_KEY` / `APPLE_API_KEY_ID`
/ `APPLE_API_ISSUER` aren't set.

Doing it by hand, if you built some other way:

```bash
xcrun notarytool submit dist/Transmission-X.Y.Z-universal.dmg \
  --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" --wait
xcrun stapler staple dist/Transmission-X.Y.Z-universal.dmg
```

`stapler staple` on a dmg that was never *submitted* fails with `Could not find
base64 encoded ticket in response` / `Error 65` — that means the container has
no ticket of its own, not that the app is unsigned. Submit first.

The `.zip` needs nothing extra: it contains the already-stapled `.app`, and a
zip can't carry a ticket itself.

## Other gotchas already worked through

- `mac.identity` is **not** overridden anywhere in this repo's `package.json`
  (unlike PCL, which forces it to `null` in the base config and overrides it
  per signed script) — electron-builder resolves it automatically from
  `APPLE_SIGNING_IDENTITY` when set. Don't add an `identity` key to
  `build.mac` to "fix" this; there's nothing to fix.
- Pass just the common name to `APPLE_SIGNING_IDENTITY` — not the
  `"Developer ID Application: "` prefix; electron-builder rejects the
  prefixed form.
- Windows/Linux packaging is configured in `package.json`'s devDependencies
  (`electron-builder`) but has never actually been run for this app — don't
  assume it works without testing.
- electron-builder 26 does **not** read `APPLE_SIGNING_IDENTITY` itself (it
  reads `CSC_NAME`, otherwise auto-discovers the keychain's Developer ID
  identity). With exactly one such identity installed, auto-discovery picks
  it, so the variable is harmless but not what's choosing the cert. If a
  second identity ever appears, set `CSC_NAME` to the common name.

## Upgrading Electron

Electron supports only its latest three majors. Since the release after 2.20.0 the app is on
**Electron 44** (Chromium 152, Node 24) with electron-builder 26 and
better-sqlite3 13. Things that bit, or had to be checked, on the 29 → 44 jump:

- **better-sqlite3 13 is N-API.** It ships per-arch prebuilds
  (`prebuilds/darwin-arm64.node`, `darwin-x64.node`) that load in plain Node
  and in any Electron, so `electron-rebuild` finds nothing to compile. The
  universal merge then sees the same two `.node` files in both arch builds and
  refuses them unless they're covered by `build.mac.x64ArchFiles` — that rule
  is in `package.json` for this reason. The non-mac prebuilds and the bundled
  SQLite source are excluded from `files`.
- **The `electron` package no longer downloads its binary on `npm install`**
  (Electron 42). It downloads the first time `electron` runs. To fetch it up
  front, or to repair a half-installed one, run `npx install-electron --no`.
- Read `docs/breaking-changes.md` in the electron repo for every major skipped,
  and grep `main.js`, `preload.js`, `miro.js` and `src/renderer.js` for each
  API named. On this jump the ones that touched the app were: the main-process
  `clipboard` API turning async (44), `console-message` on `WebContents`
  moving its fields onto the event (35; the `<webview>` DOM event still
  carries `e.message`, which is what the diagram engines use), and the
  long-removed `<webview>` `new-window` event (22), replaced by
  `setWindowOpenHandler`.
- **Coming in 45/46:** `safeStorage.encryptString` / `decryptString` /
  `isEncryptionAvailable` are deprecated in 45 and removed in 46. `miro.js`
  uses them; move it to the `*Async` variants before going past 45.
  `decryptStringAsync()` reads data the sync API wrote, so no token migration
  is needed.
- Verify an unsigned universal package before spending a notarization round
  trip: `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --universal --dir --publish never`.
