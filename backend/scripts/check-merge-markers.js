const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BLOCKED_DIRS = new Set(['node_modules', '.git']);
const MARKER_REGEX = /^(<<<<<<<|=======|>>>>>>>)/m;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (BLOCKED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const jsFiles = walk(ROOT);
const flagged = [];

for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (MARKER_REGEX.test(content)) {
    flagged.push(path.relative(ROOT, file));
  }
}

if (flagged.length > 0) {
  console.error('❌ Merge conflict markers detected in:');
  flagged.forEach((file) => console.error(` - ${file}`));
  process.exit(1);
}

console.log(`✅ Merge marker check passed (${jsFiles.length} JS files scanned).`);
