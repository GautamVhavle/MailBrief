import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const args = process.argv.slice(2);
const roots = args.length ? args : ['dist'];
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.json', '.css', '.txt', '.md', '.map']);

const patterns = [
  /sk-[A-Za-z0-9_-]{8,}/,
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /api[_-]?key["'\s:=]{1,6}[A-Za-z0-9._~+/=-]{8,}/i,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /test-key-123/,
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let failures = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    if (!TEXT_EXTENSIONS.has(extname(file))) continue;
    const content = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        console.error(`SECRET MARKER FOUND in ${file}: ${pattern}`);
        failures += 1;
      }
    }
  }
}

if (failures > 0) {
  console.error(`secret scan failed: ${failures} finding(s)`);
  process.exit(1);
}
console.log('secret scan passed');
