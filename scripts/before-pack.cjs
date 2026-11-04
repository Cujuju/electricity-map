const { existsSync } = require('node:fs');
const { join } = require('node:path');

// Like Spillway, fail packaging rather than silently omit redistributed notices.
module.exports = (context) => {
  for (const file of [
    'dist/licenses/npm-renderer.txt',
    'licenses/Spillway.txt',
    'THIRD_PARTY_NOTICES.md',
    'dist/icons/blue.png',
    'dist/icons/purple.png',
  ]) {
    if (!existsSync(join(context.packager.projectDir, file)))
      throw new Error(`Missing redistribution notice: ${file}. Run npm run build.`);
  }
};
