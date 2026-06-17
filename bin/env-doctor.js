#!/usr/bin/env node

// Shebang entry point — resolves to the compiled dist bundle.
// tsup is configured to emit the shebang in the bundle itself,
// so this file just forwards to the dist output.

import('../dist/index.js').catch(err => {
  process.stderr.write(
    '\nenv-doctor: Failed to load. Did you run `npm run build`?\n' +
    String(err) + '\n\n'
  );
  process.exit(3);
});
