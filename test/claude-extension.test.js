// The .mcpb desktop extension built from mcp/ (claude-extension.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const ext = require('../claude-extension');

const MCP = path.join(__dirname, '..', 'mcp');

test('manifest is a node extension running start.js, versioned as given', () => {
  const m = ext.buildMcpbManifest('2.21.0');
  assert.strictEqual(m.manifest_version, '0.3');
  assert.strictEqual(m.name, 'transmission');
  assert.strictEqual(m.version, '2.21.0');
  assert.strictEqual(m.server.type, 'node');
  assert.strictEqual(m.server.entry_point, 'start.js');
  assert.deepStrictEqual(m.server.mcp_config.args, ['${__dirname}/start.js']);
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

// The bug this pins: Claude's built-in Node loads an extension's entry with
// import() (see test/fixtures/claude-node-host.js), so a server that only starts
// when `require.main === module` loads, never reads a message, and Claude
// reports it cannot connect. `node server.js` — what every other test does —
// cannot see that.
test('the packaged entry point answers when loaded the way the Claude app loads it', async () => {
  const { execFileSync } = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpb-run-'));
  const file = await ext.writeMcpb({ mcpDir: MCP, version: '1.2.3', outDir: dir });
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const root = path.join(dir, 'unpacked');
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), await entry.async('nodebuffer'));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const msgs = path.join(dir, 'msgs.jsonl');
  fs.writeFileSync(msgs, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-ai', version: '0' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'prompts/list' }
  ].map(m => JSON.stringify(m)).join('\n') + '\n');
  const host = path.join(__dirname, 'fixtures', 'claude-node-host.js');
  const run = entryPoint => execFileSync(process.execPath, [host, path.join(root, entryPoint), msgs],
    { encoding: 'utf8', env: { ...process.env, HOME: dir } })
    .split('\n').filter(Boolean).map(l => JSON.parse(l));

  const replies = run(manifest.server.entry_point);
  assert.deepStrictEqual(replies.map(r => r.id), [1, 2, 3]);
  assert.strictEqual(replies[0].result.serverInfo.name, 'transmission');
  assert.ok(replies[1].result.tools.length > 0);
  assert.ok(replies[2].result.prompts.length > 0);
  // And the harness really does reproduce the failure: server.js alone is silent.
  assert.deepStrictEqual(run('server.js'), []);
  fs.rmSync(dir, { recursive: true, force: true });
});
