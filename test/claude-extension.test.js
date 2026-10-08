// The .mcpb desktop extension built from mcp/ (claude-extension.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const ext = require('../claude-extension');

const MCP = path.join(__dirname, '..', 'mcp');

test('manifest is a node extension running server.js, versioned as given', () => {
  const m = ext.buildMcpbManifest('2.21.0');
  assert.strictEqual(m.manifest_version, '0.3');
  assert.strictEqual(m.name, 'transmission');
  assert.strictEqual(m.version, '2.21.0');
  assert.strictEqual(m.server.type, 'node');
  assert.strictEqual(m.server.entry_point, 'server.js');
  assert.deepStrictEqual(m.server.mcp_config.args, ['${__dirname}/server.js']);
  // node:sqlite is unflagged from 22.13; the server cannot run on less.
  assert.strictEqual(m.compatibility.runtimes.node, '>=22.13.0');
});

test('the package holds the server, everything it requires and the skill texts, and nothing Claude-Code-only', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpb-'));
  const file = await ext.writeMcpb({ mcpDir: MCP, iconPath: path.join(__dirname, '..', 'assets', 'icon.png'), version: '1.2.3', outDir: dir });
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files).filter(n => !zip.files[n].dir).sort();
  assert.ok(names.includes('manifest.json') && names.includes('server.js') && names.includes('icon.png'));
  assert.ok(!names.some(n => /\.claude-plugin|sample\/|README/.test(n)), names.join(', '));
  // The prompts are read from the skills at request time, so every SKILL.md must travel.
  const { PROMPTS } = require('../mcp/lib/prompts');
  for (const p of PROMPTS) assert.ok(names.includes(`skills/${p.name}/SKILL.md`), `${p.name} SKILL.md missing`);
  // Every relative require in the packaged files resolves inside the package.
  for (const n of names.filter(n => n.endsWith('.js'))) {
    const src = await zip.file(n).async('string');
    for (const [, rel] of src.matchAll(/require\('(\.{1,2}\/[^']+)'\)/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(n), rel)).replace(/(\.js)?$/, '.js');
      assert.ok(names.includes(target), `${n} requires ${rel}, which is not in the package`);
    }
  }
  assert.strictEqual(JSON.parse(await zip.file('manifest.json').async('string')).version, '1.2.3');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('installedExtension reads Claude\'s registry by manifest name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-support-'));
  assert.deepStrictEqual(ext.installedExtension(dir), { installed: false, version: null, enabled: false });
  const id = 'local.mcpb.david-anderson.transmission';
  fs.writeFileSync(path.join(dir, 'extensions-installations.json'), JSON.stringify({ extensions: {
    'local.mcpb.someone.other': { id: 'local.mcpb.someone.other', version: '9', manifest: { name: 'other' } },
    [id]: { id, version: '2.20.0', manifest: { name: 'transmission', version: '2.20.0' } }
  } }));
  assert.deepStrictEqual(ext.installedExtension(dir), { installed: true, version: '2.20.0', enabled: true });
  fs.mkdirSync(path.join(dir, 'Claude Extensions Settings'));
  fs.writeFileSync(path.join(dir, 'Claude Extensions Settings', id + '.json'), JSON.stringify({ isEnabled: false }));
  assert.strictEqual(ext.installedExtension(dir).enabled, false);
  fs.rmSync(dir, { recursive: true, force: true });
});
