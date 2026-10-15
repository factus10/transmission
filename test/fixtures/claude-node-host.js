// A stand-in for the Claude desktop app's `nodeHost.js`, which is how Claude runs
// a node-type extension on its built-in runtime (read out of Claude.app's
// app.asar, .vite/build/mcp-runtime/nodeHost.js). The parts that matter:
//   - it loads the entry point with `import(pathToFileURL(entry))`, NOT as the
//     main module, so a CommonJS `require.main === module` guard is false;
//   - it replaces process.stdin's methods with those of a fresh Readable, and
//     pushes each incoming message into it as one line;
//   - it captures process.stdout.write instead of letting it reach the fd.
//
// Usage: node claude-node-host.js <entry.js> <messages.jsonl>
// Pushes each line of the messages file once the entry has loaded, prints what
// the server writes, and exits after a short settle.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pathToFileURL } = require('node:url');

const entry = path.resolve(process.argv[2]);
const messages = fs.readFileSync(process.argv[3], 'utf8').split('\n').filter(Boolean);

const realWrite = process.stdout.write.bind(process.stdout);
const fakeIn = new Readable({ read() {} });
for (const m of ['read', 'push', 'unshift', 'pause', 'resume', 'pipe', 'unpipe', 'on', 'once', 'removeListener', 'removeAllListeners', 'setEncoding', 'destroy', 'isPaused']) {
  if (typeof fakeIn[m] === 'function') process.stdin[m] = fakeIn[m].bind(fakeIn);
}
process.stdout.write = (chunk, enc, cb) => { realWrite(chunk); if (typeof enc === 'function') enc(); else if (cb) cb(); return true; };
process.argv = ['node', entry];

import(pathToFileURL(entry).toString())
  .then(() => {
    for (const m of messages) fakeIn.push(m + '\n');
    setTimeout(() => process.exit(0), 1500);
  })
  .catch(e => { process.stderr.write('import-failed: ' + e.message + '\n'); process.exit(1); });
