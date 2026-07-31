#!/bin/bash
set -euo pipefail

# Publish a built release: GitHub releases on both repos, then the update
# manifest. Everything AFTER scripts/build-signed-mac.sh.
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
#   2. Large uploads to the transmission-updates mirror have intermittently
#      404'd or dropped an asset mid-flight. A release with one of its two
#      assets looks published and is broken.
#
# So: create as an explicit draft, upload each asset ON ITS OWN, verify every
# byte count against the local file, and only then publish. After publishing,
# assert the API agrees this tag is `latest`. The manifest -- the thing that
# actually tells running copies an update exists -- is written LAST and only
# once both repos have passed all of that.
#
# Usage:
#   scripts/publish-release.sh [options]
#
#     --manifest-notes <file>  Prose for the manifest's `notes` field (what the
#                              user sees in the update dialog). Without it the
#                              script publishes the releases and stops, telling
#                              you what is left. This is deliberately not
#                              auto-generated from the changelog: the changelog
#                              is a developer record, the manifest note is a
#                              paragraph written for the person being asked to
#                              update.
#     --notes-file <file>      Release body. Defaults to this version's section
#                              extracted from CHANGELOG.md.
#     --title <text>           Release title. Defaults to
#                              "Transmission <version>".
#     --updates-repo <path>    Checkout of factus10/transmission-updates.
#                              Default: ../transmission-updates
#     --dry-run                Run every check, publish nothing.
#
# Version comes from package.json -- bump it and promote the changelog first.

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRIMARY_REPO="factus10/transmission"
MIRROR_REPO="factus10/transmission-updates"
UPDATES_DIR="$(cd "$PROJECT_DIR/.." && pwd)/transmission-updates"

NOTES_FILE=""
MANIFEST_NOTES=""
TITLE=""
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --notes-file)     NOTES_FILE="$2"; shift 2 ;;
    --manifest-notes) MANIFEST_NOTES="$2"; shift 2 ;;
    --title)          TITLE="$2"; shift 2 ;;
    --updates-repo)   UPDATES_DIR="$2"; shift 2 ;;
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
DMG="$PROJECT_DIR/dist/Transmission-$VERSION-universal.dmg"
ZIP="$PROJECT_DIR/dist/Transmission-$VERSION-universal-mac.zip"

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

[ -f "$DMG" ] || die "missing $(basename "$DMG") — run npm run build:signed:sandboxed"
[ -f "$ZIP" ] || die "missing $(basename "$ZIP") — run npm run build:signed:sandboxed"
ok "both artifacts present"

# Stale artifacts from earlier versions make build-signed-mac.sh re-notarize
# every dmg it finds, and make it easy to upload the wrong file by glob.
STRAY="$(ls "$PROJECT_DIR"/dist/*.dmg "$PROJECT_DIR"/dist/*.zip 2>/dev/null \
         | grep -v -- "-$VERSION-" || true)"
if [ -n "$STRAY" ]; then
  echo "$STRAY" | sed 's/^/        /'
  die "dist/ holds artifacts for other versions — rm them and rebuild, or they get re-notarized and risk being uploaded"
fi
ok "dist/ holds only $VERSION artifacts"

# ── The binary is actually shippable ────────────────────────────────────────
say "Verifying the signed artifacts"

xcrun stapler validate "$DMG" >/dev/null 2>&1 \
  || die "dmg is not stapled — it cannot be opened offline on first use"
ok "dmg carries a notarization ticket"

MOUNT="$(mktemp -d /tmp/transmission-verify-XXXXXX)"
cleanup() { hdiutil detach "$MOUNT" -quiet >/dev/null 2>&1 || true; rm -rf "$MOUNT"; }
trap cleanup EXIT
hdiutil attach "$DMG" -nobrowse -quiet -mountpoint "$MOUNT" \
  || die "could not mount $(basename "$DMG")"
APP="$MOUNT/Transmission.app"
[ -d "$APP" ] || die "no Transmission.app inside the dmg"

xcrun stapler validate "$APP" >/dev/null 2>&1 || die "the .app inside the dmg is not stapled"
ok "app carries a notarization ticket"

spctl -a -vvv -t install "$APP" 2>&1 | grep -q "source=Notarized Developer ID" \
  || die "Gatekeeper does not accept the app as Notarized Developer ID"
ok "Gatekeeper accepts it"

APP_VERSION="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist")"
[ "$APP_VERSION" = "$VERSION" ] \
  || die "the bundle says $APP_VERSION but we are releasing $VERSION — stale artifact"
ok "bundle version is $VERSION"

ARCHS="$(lipo -archs "$APP/Contents/MacOS/Transmission")"
case "$ARCHS" in
  *x86_64*arm64*|*arm64*x86_64*) ok "universal ($ARCHS)" ;;
  *) die "not a universal binary: $ARCHS" ;;
esac
cleanup; trap - EXIT

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
  for f in "$DMG" "$ZIP"; do
    printf '   uploading %s ...\n' "$(basename "$f")"
    run gh release upload "$TAG" "$f" --repo "$repo" --clobber
  done

  if [ "$DRY_RUN" = 1 ]; then warn "dry run — skipping asset verification"; return 0; fi

  # Byte-for-byte against the local file, because a truncated upload still
  # reports state=uploaded for whatever made it across.
  node - "$repo" "$TAG" "$DMG" "$ZIP" <<'NODE'
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
publish_to "$MIRROR_REPO"

# ── The manifest, last ──────────────────────────────────────────────────────
#
# This is what tells every running copy an update exists. Publishing it before
# the assets are up and `latest` is correct hands users a dead Download button.
if [ -z "$MANIFEST_NOTES" ]; then
  say "Releases done — manifest NOT published"
  cat <<EOS
   No --manifest-notes given, so the update manifest was left alone. Users will
   not be offered $VERSION until it is published. To finish:

     scripts/publish-release.sh --manifest-notes <file>

   (re-running is safe: existing releases are reused and re-verified)
EOS
  exit 0
fi

[ -f "$MANIFEST_NOTES" ] || die "--manifest-notes $MANIFEST_NOTES not found"
[ -d "$UPDATES_DIR/.git" ] || die "$UPDATES_DIR is not a git checkout (use --updates-repo)"

say "Publishing the update manifest"

( cd "$UPDATES_DIR" && git pull --quiet )
ok "updates repo synced"

npm --prefix "$PROJECT_DIR" run --silent changelog:html >/dev/null \
  || die "changelog:html failed (needs node_modules — npm install --ignore-scripts)"
GENERATED="$PROJECT_DIR/dist/changelog.html"
[ -f "$GENERATED" ] || die "changelog generator produced no output"

# Section count must go UP by exactly one; anything else means the generator
# dropped history rather than appending to it.
node - "$UPDATES_DIR/changelog.html" "$GENERATED" "$VERSION" <<'NODE'
const fs = require('fs');
const [live, next, version] = process.argv.slice(2);
const count = (p) => (fs.readFileSync(p, 'utf8').match(/<h2 id="\d+--/g) || []).length;
const before = count(live), after = count(next);
if (after !== before + 1) {
  console.error(`   changelog sections went ${before} -> ${after}; expected exactly one more`);
  process.exit(1);
}
const slug = version.replace(/\./g, '');
if (!fs.readFileSync(next, 'utf8').includes(`id="${slug}--`)) {
  console.error(`   regenerated changelog has no section for ${version}`);
  process.exit(1);
}
console.log(`   ok   changelog sections ${before} -> ${after}, ${version} present`);
NODE
[ $? -eq 0 ] || die "changelog regeneration looks wrong — not publishing"

if [ "$DRY_RUN" = 1 ]; then warn "dry run — manifest not written"; exit 0; fi

cp "$GENERATED" "$UPDATES_DIR/changelog.html"
node - "$UPDATES_DIR/update-manifest.json" "$VERSION" "$MANIFEST_NOTES" <<'NODE'
const fs = require('fs');
const [file, version, notesFile] = process.argv.slice(2);
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
m.version = version;
m.publishedAt = new Date().toISOString().slice(0, 10);
m.notes = fs.readFileSync(notesFile, 'utf8').trim();
// main.js refuses to act on a manifest whose URLs are not on these hosts, so a
// typo here silently disables updates for everyone.
const trusted = (u) => /^https:\/\/(factus10\.github\.io|github\.com)\//.test(u);
for (const k of ['changelogUrl', 'downloadUrl']) {
  if (!trusted(m[k])) { console.error(`   ${k} is not on a trusted host: ${m[k]}`); process.exit(1); }
}
fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
console.log(`   ok   manifest -> ${version} (${m.notes.length} chars of notes)`);
NODE
[ $? -eq 0 ] || die "manifest update failed"

( cd "$UPDATES_DIR" \
  && git add update-manifest.json changelog.html \
  && git commit -q -m "$VERSION" \
  && git push --quiet origin HEAD )
ok "manifest and changelog pushed"

say "Waiting for GitHub Pages to serve $VERSION"
for i in $(seq 1 60); do
  SERVED="$(curl -s --max-time 5 https://factus10.github.io/transmission-updates/update-manifest.json \
            | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).version)}catch(e){console.log('')}})" || true)"
  [ "$SERVED" = "$VERSION" ] && break
  sleep 10
done
[ "$SERVED" = "$VERSION" ] || die "Pages still serving '$SERVED' after 10 minutes — check the updates repo"
ok "Pages serving $VERSION"

say "Released $TAG"
echo "   primary: https://github.com/$PRIMARY_REPO/releases/tag/$TAG"
echo "   mirror:  https://github.com/$MIRROR_REPO/releases/tag/$TAG"
