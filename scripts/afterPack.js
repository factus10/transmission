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

module.exports = async function afterPack(context) {
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
