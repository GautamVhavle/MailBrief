import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const port = Number(process.argv[2] ?? 5199);
const fixturesDir = join(process.cwd(), 'tests', 'fixtures');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const rel = normalize(url.pathname).replace(/^([/\\])+/, '');
    const file = join(fixturesDir, rel);
    if (!file.startsWith(fixturesDir)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`fixture server on http://127.0.0.1:${port}`);
});
