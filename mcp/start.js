'use strict';
// Entry point for the Claude desktop extension (claude-extension.js).
//
// server.js starts itself only when it is the main module (`node server.js`, the
// Claude Code plugin route). The Claude app does not run an extension that way:
// its built-in Node loads the entry through a host script with `import()`, so
// `require.main === module` is false there and server.js would load, never read
// stdin, and leave Claude reporting that it could not connect. This file has no
// such guard — loading it is starting the server.
require('./server').main();
