#!/bin/bash
set -euo pipefail

# Publish a built release: the GitHub release, then the site deploy that
# announces it. Everything AFTER scripts/build-signed-mac.sh.
#
# This exists because the manual sequence has two traps that have each bitten
# a real release, and both are silent -- the release looks fine and users get
# the wrong thing.
#
#   1. `gh release create` with assets creates a DRAFT, uploads, then publishes.
#      Interrupt it (a 10-minute tool timeout did exactly this) and you are left
#      with a drafted release carrying zero assets. A draft is not eligible to be
#      "latest", so github.com/<repo>/releases/latest keeps pointing at the
#      PREVIOUS version -- while the manifest says a new one exists. Every user
#      then gets told to update and handed the old build.
#
#   2. Large uploads have intermittently 404'd or dropped an asset mid-flight
#      (seen on the old transmission-updates mirror). A release missing one of
#      its assets looks published and is broken.
#
# So: create as an explicit draft, upload each asset ON ITS OWN, verify every
# byte count against the local file, and only then publish. After publishing,
# assert the API agrees this tag is `latest`.
#
# The update manifest -- the thing that tells running copies an update exists
# -- is no longer written here. .github/workflows/pages.yml rebuilds the public
# site when a release is published, and scripts/build-site.js derives the
# manifest from the published releases: it only announces a release that has
# both dmgs AND a release-notes/<version>.txt on main. So the notes file is the
# "announce" switch, and this script just waits for the site to serve it.
#
# Usage:
#   scripts/publish-release.sh [options]
#
#     --notes-file <file>      Release body. Defaults to this version's section
#                              extracted from CHANGELOG.md.
#     --title <text>           Release title. Defaults to
#                              "Transmission <version>".
#     --dry-run                Run every check, publish nothing.
#
# Version comes from package.json -- bump it and promote the changelog first.
# The update-dialog note is release-notes/<version>.txt; commit it to main
# before running this to announce the release, or after to hold it back.

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRIMARY_REPO="factus10/transmission"
SITE_URL="https://factus10.github.io/transmission"

NOTES_FILE=""
TITLE=""
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --notes-file)     NOTES_FILE="$2"; shift 2 ;;
    --manifest-notes|--updates-repo)
      echo "$1 is gone: the site deploy announces a release once release-notes/<version>.txt is on main" >&2; exit 2 ;;
    --title)          TITLE="$2"; shift 2 ;;
    --dry-run)        DRY_RUN=1; shift ;;
    -h|--help)        sed -n '1,50p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32mok\033[0m   %s\n' "$*"; }
warn() { printf '   \033[33mwarn\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mFAILED:\033[0m %s\n' "$*" >&2; exit 1; }
run()  { if [ "$DRY_RUN" = 1 ]; then printf '   (dry-run) %s\n' "$*"; else "$@"; fi; }

VERSION="$(node -p "require('$PROJECT_DIR/package.json').version")"
TAG="v$VERSION"
[ -n "$TITLE" ] || TITLE="Transmission $VERSION"
# One dmg per architecture. arm64 is Apple Silicon; x64 is Intel, whose binary
# lipo reports as x86_64. Both are separate single-arch builds — never a
# universal one, which nearly doubles the download for everyone. No zips since
# 2.26.0: nothing consumed them (updates link to the release page and installs
# are from the dmg), and they took a two-arch CI build past the 0.5 GB of
# Actions storage.
ARCHES=(arm64 x64)
ARTIFACTS=()
for a in "${ARCHES[@]}"; do
  ARTIFACTS+=("$PROJECT_DIR/dist/Transmission-$VERSION-$a.dmg")
done

say "Releasing $TAG"
[ "$DRY_RUN" = 1 ] && warn "dry run — nothing will be published"

# ── Preconditions ───────────────────────────────────────────────────────────
say "Preconditions"

command -v gh >/dev/null   || die "gh CLI not found"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated"
ok "gh authenticated"

# package-lock drifts from package.json often enough to be worth asserting.
LOCK_VERSION="$(node -p "require('$PROJECT_DIR/package-lock.json').version")"
[ "$LOCK_VERSION" = "$VERSION" ] \
  || die "package-lock.json is $LOCK_VERSION but package.json is $VERSION — bump both"
ok "package.json and package-lock.json both $VERSION"

# The changelog must already describe this version. Shipping while the entries
# still sit under [Unreleased] is how a published changelog ends up calling
# shipped features unreleased.
grep -q "^## \[$VERSION\]" "$PROJECT_DIR/CHANGELOG.md" \
  || die "CHANGELOG.md has no '## [$VERSION]' section — promote [Unreleased] first"
ok "CHANGELOG.md has a [$VERSION] section"

for f in "${ARTIFACTS[@]}"; do
  [ -f "$f" ] || die "missing $(basename "$f") — run npm run build:signed:sandboxed"
done
ok "all ${#ARTIFACTS[@]} artifacts present (${ARCHES[*]})"

# Stale artifacts from earlier versions make build-signed-mac.sh re-notarize
# every dmg it finds, and make it easy to upload the wrong file by glob.
STRAY="$(ls "$PROJECT_DIR"/dist/*.dmg "$PROJECT_DIR"/dist/*.zip 2>/dev/null \
         | grep -v -- "-$VERSION-" || true)"
if [ -n "$STRAY" ]; then
  echo "$STRAY" | sed 's/^/        /'
  die "dist/ holds artifacts for other versions — rm them and rebuild, or they get re-notarized and risk being uploaded"
fi
ok "dist/ holds only $VERSION artifacts"

# The audit skills, as zips for Claude's Settings → Skills upload, built fresh
# from mcp/skills so a release always carries the skills of the code it ships.
# Rebuilt into a cleared folder: a skill renamed or removed since the last
# release must not linger as an asset.
SKILLS_DIR="$PROJECT_DIR/dist/skills"
rm -rf "$SKILLS_DIR"
node "$PROJECT_DIR/scripts/package-skills.js" --out "$SKILLS_DIR" --prefix transmission-skill- >/dev/null \
  || die "packaging the skills failed (node scripts/package-skills.js)"
SKILL_ZIPS=()
for f in "$SKILLS_DIR"/transmission-skill-*.zip; do [ -f "$f" ] && SKILL_ZIPS+=("$f"); done
[ ${#SKILL_ZIPS[@]} -gt 0 ] || die "no skill zips were built"
ok "${#SKILL_ZIPS[@]} skill zips built"

# ── The binary is actually shippable ────────────────────────────────────────
say "Verifying the signed artifacts"

MOUNT="$(mktemp -d /tmp/transmission-verify-XXXXXX)"
cleanup() { hdiutil detach "$MOUNT" -quiet >/dev/null 2>&1 || true; }
trap 'cleanup; rm -rf "$MOUNT"' EXIT

for a in "${ARCHES[@]}"; do
  DMG="$PROJECT_DIR/dist/Transmission-$VERSION-$a.dmg"
  case "$a" in arm64) WANT=arm64; LABEL="Apple Silicon" ;; x64) WANT=x86_64; LABEL="Intel" ;; esac
  printf '   -- %s (%s)\n' "$(basename "$DMG")" "$LABEL"

  xcrun stapler validate "$DMG" >/dev/null 2>&1 \
    || die "$a dmg is not stapled — it cannot be opened offline on first use"
  ok "dmg carries a notarization ticket"

  hdiutil attach "$DMG" -nobrowse -quiet -mountpoint "$MOUNT" \
    || die "could not mount $(basename "$DMG")"
  APP="$MOUNT/Transmission.app"
  [ -d "$APP" ] || die "no Transmission.app inside $(basename "$DMG")"

  xcrun stapler validate "$APP" >/dev/null 2>&1 || die "the .app inside the $a dmg is not stapled"
  ok "app carries a notarization ticket"

  spctl -a -vvv -t install "$APP" 2>&1 | grep -q "source=Notarized Developer ID" \
    || die "Gatekeeper does not accept the $a app as Notarized Developer ID"
  ok "Gatekeeper accepts it"

  APP_VERSION="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist")"
  [ "$APP_VERSION" = "$VERSION" ] \
    || die "the $a bundle says $APP_VERSION but we are releasing $VERSION — stale artifact"
  ok "bundle version is $VERSION"

  # The file name is only a label: a dmg renamed (or misnamed by the builder)
  # would otherwise hand Intel users an app that won't launch.
  ARCHS="$(lipo -archs "$APP/Contents/MacOS/Transmission")"
  [ "$ARCHS" = "$WANT" ] || die "$(basename "$DMG") should be $WANT-only, got: $ARCHS"
  ok "$LABEL binary ($ARCHS)"

  # SQLite is the one native module, and it ships one prebuild per arch
  # (package.json `files` keeps only darwin-${arch}). The wrong one means the app
  # opens but can't open a project.
  PREBUILDS="$(ls "$APP/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/prebuilds/" 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
  [ "$PREBUILDS" = "darwin-$a.node" ] \
    || die "$(basename "$DMG") carries SQLite prebuilds '$PREBUILDS', expected darwin-$a.node"
  ok "SQLite module is darwin-$a"

  cleanup
done
rm -rf "$MOUNT"; trap - EXIT

# ── Release notes ───────────────────────────────────────────────────────────
if [ -z "$NOTES_FILE" ]; then
  # No .md suffix: BSD mktemp (macOS) requires the X's to be the LAST characters
  # of the template and fails with a misleading "File exists" otherwise — only
  # GNU mktemp accepts a trailing suffix. Nothing downstream cares about the
  # extension. (Caught on the script's first real run, 2.14.0.)
  NOTES_FILE="$(mktemp /tmp/transmission-notes-XXXXXX)"
  awk -v v="^## \\\\[$VERSION\\\\]" '
    $0 ~ v {f=1; next}
    /^## \[/ {f=0}
    f {print}
  ' "$PROJECT_DIR/CHANGELOG.md" > "$NOTES_FILE"
  [ -s "$NOTES_FILE" ] || die "extracted empty release notes for $VERSION"
  # A release page lists one dmg per architecture side by side, and someone
  # who lands there from the update prompt has to pick one. Unquoted heredoc:
  # the file names carry $VERSION.
  cat >> "$NOTES_FILE" <<EOS

---

**Which file to download.** \`Transmission-$VERSION-arm64.dmg\` is for Macs with Apple Silicon (M1 or later). \`Transmission-$VERSION-x64.dmg\` is for Intel Macs. Not sure which you have? Apple menu → About This Mac: a "Chip" line says Apple Silicon, a "Processor" line names an Intel CPU.
EOS
  cat >> "$NOTES_FILE" <<'EOS'

**Skills for Claude.** The `transmission-skill-*.zip` files are the audit playbooks as Claude skills. Upload each in **Claude → Settings → Capabilities → Skills → Upload skill** and the Claude desktop app uses them on its own when a question calls for one. They need the Transmission extension (✦ → Open in Claude).
EOS
  ok "release notes extracted from CHANGELOG.md ($(wc -c < "$NOTES_FILE" | tr -d ' ') bytes)"
else
  [ -f "$NOTES_FILE" ] || die "--notes-file $NOTES_FILE not found"
  ok "release notes from $NOTES_FILE"
fi

# ── Publish to one repo, safely ─────────────────────────────────────────────
#
# Draft -> upload each asset alone -> verify bytes -> publish -> assert latest.
# Re-running against a half-finished release is the recovery path, so an
# existing release is reused with --clobber rather than treated as an error.
publish_to() {
  repo="$1"
  say "Publishing to $repo"

  if gh release view "$TAG" --repo "$repo" >/dev/null 2>&1; then
    warn "release $TAG already exists — reusing it (assets will be re-uploaded)"
  else
    run gh release create "$TAG" --repo "$repo" --title "$TITLE" \
        --notes-file "$NOTES_FILE" --draft
    ok "created $TAG as a draft"
  fi

  # One at a time: a combined upload that dies partway leaves a drafted release
  # with an incomplete asset set, and gh reports nothing useful about which.
  for f in "${ARTIFACTS[@]}" "${SKILL_ZIPS[@]}"; do
    printf '   uploading %s ...\n' "$(basename "$f")"
    run gh release upload "$TAG" "$f" --repo "$repo" --clobber
  done

  if [ "$DRY_RUN" = 1 ]; then warn "dry run — skipping asset verification"; return 0; fi

  # Byte-for-byte against the local file, because a truncated upload still
  # reports state=uploaded for whatever made it across.
  node - "$repo" "$TAG" "${ARTIFACTS[@]}" "${SKILL_ZIPS[@]}" <<'NODE'
const { execSync } = require('child_process');
const fs = require('fs');
const [repo, tag, ...files] = process.argv.slice(2);
const remote = JSON.parse(
  execSync(`gh release view ${tag} --repo ${repo} --json assets`).toString()).assets;
let bad = 0;
for (const f of files) {
  const name = f.split('/').pop();
  const local = fs.statSync(f).size;
  const a = remote.find(x => x.name === name);
  if (!a) { console.log(`   MISSING  ${name}`); bad++; continue; }
  if (a.size !== local || a.state !== 'uploaded') {
    console.log(`   BAD      ${name} local=${local} remote=${a.size} state=${a.state}`); bad++;
  } else {
    console.log(`   ok   ${name} (${local} bytes)`);
  }
}
process.exit(bad ? 1 : 0);
NODE
  [ $? -eq 0 ] || die "$repo: asset verification failed — release left as a draft on purpose"

  run gh release edit "$TAG" --repo "$repo" --draft=false
  ok "published $TAG"

  # The whole point: a draft is not eligible to be `latest`, and the manifest's
  # Download button resolves through /releases/latest.
  LATEST="$(gh api "repos/$repo/releases/latest" --jq .tag_name)"
  [ "$LATEST" = "$TAG" ] || die "$repo: /releases/latest is $LATEST, expected $TAG"
  ok "/releases/latest resolves to $TAG"
}

publish_to "$PRIMARY_REPO"

# ── Announce: the site deploy, last ─────────────────────────────────────────
#
# Publishing the release fired .github/workflows/pages.yml. It announces this
# version only if release-notes/$VERSION.txt is already on main.
git -C "$PROJECT_DIR" fetch --quiet origin main || die "git fetch origin main failed"
if ! git -C "$PROJECT_DIR" cat-file -e "origin/main:release-notes/$VERSION.txt" 2>/dev/null; then
  say "Released $TAG — NOT announced"
  cat <<EOS
   release-notes/$VERSION.txt is not on origin/main, so the site deploy leaves
   the update manifest on the previous version. To announce $VERSION:

     commit release-notes/$VERSION.txt to main, then: gh workflow run pages.yml

   https://github.com/$PRIMARY_REPO/releases/tag/$TAG
EOS
  exit 0
fi
ok "release-notes/$VERSION.txt is on main"

if [ "$DRY_RUN" = 1 ]; then warn "dry run — not waiting for the site"; exit 0; fi

# A re-run against an already-published release fires no release event, so ask
# for a deploy explicitly. A duplicate deploy is harmless (they queue).
run gh workflow run pages.yml --repo "$PRIMARY_REPO" --ref main >/dev/null \
  && ok "site deploy requested" \
  || warn "could not start pages.yml; the release event's deploy should still run"

say "Waiting for the site to announce $VERSION"
for i in $(seq 1 60); do
  SERVED="$(curl -s --max-time 5 "$SITE_URL/update-manifest.json?t=$(date +%s)" \
            | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).version)}catch(e){console.log('')}})" || true)"
  [ "$SERVED" = "$VERSION" ] && break
  sleep 10
done
[ "$SERVED" = "$VERSION" ] || die "site still serving '$SERVED' after 10 minutes — check the Publish site workflow: gh run list --workflow pages.yml"
ok "update manifest announces $VERSION"

say "Released $TAG"
echo "   https://github.com/$PRIMARY_REPO/releases/tag/$TAG"
