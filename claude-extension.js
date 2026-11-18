// The Transmission MCP server packaged as a Claude desktop extension (.mcpb).
//
// Why this exists: the Claude Code route needs the `claude` CLI on the user's
// PATH (to register the plugin) and Node 22.13+ (to run the server), and a
// typical work laptop has neither. The Claude desktop app runs a node-type
// extension on its OWN bundled Node (24.x as of this writing, which has the
// node:sqlite module the server reads with), so packaging mcp/ as an extension
// needs nothing installed beyond the Claude app itself.
//
// The extension is built on demand from the bundled mcp/ folder, so it can never
// drift from the server this app ships. Its version is the app's version: the
// server's mirrors of renderer logic change with the app, and an app update
// should re-offer the extension.
//
// The skills travel as MCP prompts rather than skills (extensions are MCP
// servers only): the chat's "+" menu lists them. See mcp/lib/prompts.js.

const fs = require('fs');
const path = require('path');

const EXTENSION_NAME = 'transmission';
const CLAUDE_BUNDLE_ID = 'com.anthropic.claudefordesktop';

/** The extension manifest (MCPB manifest_version 0.3). */
function buildMcpbManifest(version) {
  return {
    manifest_version: '0.3',
    name: EXTENSION_NAME,
    display_name: 'Transmission',
    version: String(version),
    description: 'Ask questions of the content audit open in Transmission, and queue proposed changes for the auditor to accept or reject.',
    long_description: 'Connects Claude to the .transmission project open in the Transmission app. Claude can read rows, decisions, the sitemap, libraries, redirects and the change history, and count across them. It cannot edit the audit: the one write it has queues proposals, which appear in Transmission for the auditor to accept or reject.\n\nThe server follows whichever project Transmission has open. Keep Transmission running while you work.',
    author: { name: 'David Anderson' },
    license: 'MIT',
    icon: 'icon.png',
    server: {
      type: 'node',
      entry_point: 'start.js',
      mcp_config: {
        command: 'node',
        args: ['${__dirname}/start.js']
      }
    },
    tools_generated: true,
    prompts_generated: true,
    keywords: ['content-audit', 'content-strategy', 'migration'],
    compatibility: {
      platforms: ['darwin', 'win32'],
      runtimes: { node: '>=22.13.0' }
    }
  };
}

/** Files from the mcp/ folder that belong in the extension, as paths relative
 *  to it: the server, its lib/, and each skill's SKILL.md (the server reads them
 *  to serve its prompts — see mcp/lib/prompts.js). The plugin manifests, README
 *  and the sample generator are Claude Code material and stay out. */
function mcpbFileList(mcpDir) {
  const out = ['start.js', 'server.js'];
  const lib = path.join(mcpDir, 'lib');
  for (const f of fs.readdirSync(lib).sort()) {
    if (f.endsWith('.js')) out.push('lib/' + f);
  }
  const skills = path.join(mcpDir, 'skills');
  for (const d of fs.readdirSync(skills).sort()) {
    if (fs.existsSync(path.join(skills, d, 'SKILL.md'))) out.push(`skills/${d}/SKILL.md`);
  }
  return out;
}

/** Write `<outDir>/transmission.mcpb`; resolves to its path. */
async function writeMcpb({ mcpDir, iconPath, version, outDir }) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(buildMcpbManifest(version), null, 2));
  for (const rel of mcpbFileList(mcpDir)) zip.file(rel, fs.readFileSync(path.join(mcpDir, rel)));
  if (iconPath && fs.existsSync(iconPath)) zip.file('icon.png', fs.readFileSync(iconPath));
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, EXTENSION_NAME + '.mcpb');
  fs.writeFileSync(file, buf);
  return file;
}

/**
 * Is the extension installed in the Claude app, and at which version? Read from
 * the app's own install registry. Returns `{ installed, version, enabled }`;
 * an unreadable registry reads as not installed, which only costs the user an
 * install prompt they can accept again.
 */
function installedExtension(claudeSupportDir) {
  const none = { installed: false, version: null, enabled: false };
  let reg;
  try { reg = JSON.parse(fs.readFileSync(path.join(claudeSupportDir, 'extensions-installations.json'), 'utf8')); }
  catch (_) { return none; }
  const exts = (reg && reg.extensions) || {};
  // The id is derived from author + name (local.mcpb.<author>.<name>), so match
  // on the manifest name rather than guessing the id's spelling.
  const hit = Object.values(exts).find(e => e && e.manifest && e.manifest.name === EXTENSION_NAME && /^local\.mcpb\./.test(e.id || ''));
  if (!hit) return none;
  let enabled = true;
  try {
    const s = JSON.parse(fs.readFileSync(path.join(claudeSupportDir, 'Claude Extensions Settings', hit.id + '.json'), 'utf8'));
    if (s && s.isEnabled === false) enabled = false;
  } catch (_) { /* no settings file: enabled by default */ }
  return { installed: true, version: hit.version || (hit.manifest && hit.manifest.version) || null, enabled };
}

module.exports = { EXTENSION_NAME, CLAUDE_BUNDLE_ID, buildMcpbManifest, mcpbFileList, writeMcpb, installedExtension };
