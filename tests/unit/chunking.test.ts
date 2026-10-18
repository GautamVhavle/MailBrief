import { describe, expect, it } from 'vitest';
import { chunkText, orderedJoin } from '../../src/extraction/chunking';

describe('chunkText', () => {
  it('returns a single chunk when text fits', () => {
    const chunks = chunkText('Short document.\n\nIt fits in one chunk.', { size: 6000, overlap: 200 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].total).toBe(1);
    expect(chunks[0].text).toContain('Short document');
  });

  it('splits long text into deterministic ordered chunks', () => {
    const paragraph = 'This is a long paragraph that will not fit inside a single chunk. '.repeat(20);
    const text = `${paragraph}\n\nSecond paragraph with more content to make things longer. `.repeat(15);
    const a = chunkText(text, { size: 500, overlap: 100 });
    const b = chunkText(text, { size: 500, overlap: 100 });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(1);
    a.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.text.length).toBeLessThanOrEqual(500 + 1);
    });
  });

  it('reassembles chunks in deterministic order', () => {
    const paragraph = 'Ordered reassembly must preserve content when chunks are shuffled. '.repeat(30);
    const chunks = chunkText(paragraph, { size: 400, overlap: 50 });
    const shuffled = [...chunks].reverse();
    const joined = orderedJoin(shuffled);
    expect(joined).toBe(orderedJoin(chunks));
  });

  it('respects chunk size boundaries including overlap', () => {
    const text = Array.from({ length: 50 }, (_, i) => `Paragraph ${i} with some sentences inside it.`).join('\n\n');
    const chunks = chunkText(text, { size: 300, overlap: 60 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(300);
    }
  });

  it('handles empty and whitespace-only text', () => {
    expect(chunkText('', { size: 100, overlap: 10 })).toEqual([]);
    expect(chunkText('   \n\n  ', { size: 100, overlap: 10 })).toEqual([]);
  });

  it('rejects invalid options', () => {
    expect(() => chunkText('text', { size: 0, overlap: 0 })).toThrow();
    expect(() => chunkText('text', { size: 100, overlap: 200 })).toThrow();
  });
});
