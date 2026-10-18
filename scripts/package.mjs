import { createReadStream, createWriteStream, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ZipArchive } from 'archiver';

const root = process.cwd();
const dist = join(root, 'dist');
const version = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')).version;
const zipName = `mailbrief-${version}.zip`;
const output = join(root, zipName);

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) entries.push(...walk(full));
    else entries.push(full);
  }
  return entries;
}

const files = walk(dist);
const output_stream = createWriteStream(output);
const archive = new ZipArchive({ zlib: { level: 9 } });

const done = new Promise((resolve, reject) => {
  output_stream.on('close', resolve);
  archive.on('error', reject);
});
archive.pipe(output_stream);

for (const file of files) {
  archive.append(createReadStream(file), { name: file.slice(dist.length + 1).split('\\').join('/') });
}
await archive.finalize();
await done;

const size = statSync(output).size;
console.log(`packaged ${zipName} (${(size / 1024).toFixed(1)} KiB, ${files.length} files)`);

const hash = createHash('sha256').update(readFileSync(output)).digest('hex');
console.log(`sha256 ${hash}`);
