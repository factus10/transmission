'use strict';

// codesign rejects files carrying certain extended attributes ("resource
// fork, Finder information, or similar detritus not allowed"). On recent
// macOS, files copied from the official (signed/notarized) Electron
// download carry a `com.apple.provenance` xattr that trips this check --
// and `xattr -d`/`-c` report success removing it but silently leave it in
// place, since it's tied to the file's copy-on-write lineage at the
// filesystem level, not a normal removable attribute.
//
// The only reliable fix found: materialize a genuinely new file (a plain
// byte copy via Node's fs, not a metadata-preserving `cp`/`ditto`) so the
// new inode has no xattrs at all, then swap it in.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function hasProvenance(file) {
  try {
    return execFileSync('xattr', [file]).toString().includes('com.apple.provenance');
  } catch {
    return false;
  }
}

function stripProvenance(file) {
  const stat = fs.statSync(file);
  const tmp = `${file}.transmission-strip-tmp`;
  const data = fs.readFileSync(file);
  fs.writeFileSync(tmp, data);
  fs.chmodSync(tmp, stat.mode);
  fs.renameSync(tmp, file);
}

// package.json packs exactly one better-sqlite3 prebuild, `${platform}-${arch}`.
// electron-builder expands ${platform} to the platform it is RUNNING on, not the
// one it is building for (and ignores a platform-level `files` entry for
// node_modules), so a cross-build — Windows from a Mac — packs the wrong binary
// and the app can't open a project. Fail that build here instead of shipping it.
// Build each platform on its own OS: a Mac for the dmgs, the Windows workflow
// (.github/workflows/build-windows.yml) for the installer.
function checkSqlitePrebuild(context) {
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const dir = path.join(resources, 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'prebuilds');
  const want = `${context.electronPlatformName}-${archName(context.arch)}.node`;
  const got = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.node')) : [];
  if (got.length !== 1 || got[0] !== want) {
    throw new Error(`[afterPack] expected exactly the SQLite prebuild ${want}, packed: ${got.join(', ') || 'none'}. `
      + `Build ${context.electronPlatformName} on ${context.electronPlatformName}; cross-building packs the host's binary.`);
  }
}

function archName(arch) {
  // electron-builder's Arch enum: 0 ia32, 1 x64, 2 armv7l, 3 arm64, 4 universal.
  return typeof arch === 'string' ? arch : ['ia32', 'x64', 'armv7l', 'arm64', 'universal'][arch];
}

module.exports = async function afterPack(context) {
  checkSqlitePrebuild(context);
  if (context.electronPlatformName !== 'darwin') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  let stripped = 0;
  for (const file of listFilesRecursive(appPath)) {
    if (hasProvenance(file)) {
      stripProvenance(file);
      stripped += 1;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[afterPack] stripped com.apple.provenance from ${stripped} file(s) in ${appName}`);
};
