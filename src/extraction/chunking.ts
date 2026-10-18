import type { Chunk } from '../shared/types';

interface ChunkOptions {
  size: number;
  overlap: number;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitLongParagraph(paragraph: string, size: number): string[] {
  if (paragraph.length <= size) return [paragraph];
  const parts: string[] = [];
  let rest = paragraph;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('. ', size);
    if (cut < size * 0.5) cut = rest.lastIndexOf(' ', size);
    if (cut <= 0) cut = size;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function chunkText(text: string, options: ChunkOptions): Chunk[] {
  const { size, overlap } = options;
  if (size <= 0 || overlap < 0 || overlap >= size) {
    throw new Error('Invalid chunking options.');
  }
  const trimmed = text.trim();
  if (!trimmed) return [];

  const atoms: string[] = [];
  for (const paragraph of splitParagraphs(trimmed)) {
    atoms.push(...splitLongParagraph(paragraph, size));
  }
  if (atoms.length === 0) return [];
  if (atoms.join('\n\n').length <= size) {
    return [{ index: 0, total: 1, text: atoms.join('\n\n') }];
  }

  const chunks: string[] = [];
  let current = '';
  for (const atom of atoms) {
    if (current && `${current}\n\n${atom}`.length > size) {
      chunks.push(current);
      const tail = current.slice(-overlap).trimStart();
      const withTail = tail ? `${tail}\n\n${atom}` : atom;
      current = withTail.length <= size ? withTail : atom;
    } else {
      current = current ? `${current}\n\n${atom}` : atom;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((text, index) => ({ index, total: chunks.length, text }));
}

export function orderedJoin(chunks: Chunk[]): string {
  return [...chunks]
    .sort((a, b) => a.index - b.index)
    .map((c) => c.text)
    .join('\n\n');
}
