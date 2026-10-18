import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');

if (process.env.MB_TEST_MANIFEST === '1') {
  const port = Number(process.env.MB_TEST_FIXTURE_PORT ?? 5199);
  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
  const localMatch = `http://127.0.0.1:${port}/*`;
  if (!manifest.content_scripts[0].matches.includes(localMatch)) {
    manifest.content_scripts[0].matches.push(localMatch);
  }
  if (Array.isArray(manifest.web_accessible_resources)) {
    for (const entry of manifest.web_accessible_resources) {
      if (Array.isArray(entry.matches) && !entry.matches.includes(localMatch)) {
        entry.matches.push(localMatch);
      }
    }
  }
  writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`test manifest written (added ${localMatch})`);
} else {
  console.log('production manifest kept');
}
