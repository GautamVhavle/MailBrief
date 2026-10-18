import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, draw) {
  const raw = Buffer.alloc(size * (size + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = draw(x, y, size);
      const offset = y * (size + 1) + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function icon(size) {
  return png(size, (x, y, s) => {
    const pad = Math.max(1, Math.round(s * 0.12));
    if (x < pad || y < pad || x >= s - pad || y >= s - pad) return [26, 115, 232];
    const mid = s / 2;
    const flap = Math.abs(x - mid) + Math.abs(y - mid);
    if (flap < s * 0.22 && y > s * 0.28 && y < s * 0.62) return [255, 255, 255];
    const body = x > s * 0.2 && x < s * 0.8 && y > s * 0.32 && y < s * 0.78;
    return body ? [255, 255, 255] : [26, 115, 232];
  });
}

mkdirSync(join(root, 'public', 'icons'), { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(root, 'public', `icons/icon${size}.png`), icon(size));
}
console.log('icons generated');
