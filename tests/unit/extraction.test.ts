import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractAttachment, mimeForAttachment } from '../../src/extraction';
import { decodeText } from '../../src/extraction/text';
import { enforceFileSize, enforceTextLength } from '../../src/extraction/limits';
import { applyTruncation } from '../../src/shared/settings';
import { MailBriefError } from '../../src/shared/types';

const attDir = join(process.cwd(), 'tests', 'fixtures', 'attachments');
const readFixture = (name: string): ArrayBuffer => {
  const buf = readFileSync(join(attDir, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

describe('decodeText', () => {
  it('decodes UTF-8 text', () => {
    const buffer = new TextEncoder().encode('héllo wörld\n').buffer as ArrayBuffer;
    expect(decodeText(buffer)).toBe('héllo wörld\n');
  });

  it('strips a leading BOM', () => {
    const buffer = new TextEncoder().encode('\uFEFFplain').buffer as ArrayBuffer;
    expect(decodeText(buffer)).toBe('plain');
  });
});

describe('limits', () => {
  it('rejects files over the size limit', () => {
    try {
      enforceFileSize(21 * 1024 * 1024, 20 * 1024 * 1024);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MailBriefError);
      expect((err as MailBriefError).kind).toBe('too-large');
    }
  });

  it('allows files at exactly the limit', () => {
    expect(() => enforceFileSize(20 * 1024 * 1024, 20 * 1024 * 1024)).not.toThrow();
  });

  it('rejects extracted text over the character limit', () => {
    expect(() => enforceTextLength(100_001, 100_000)).toThrow(MailBriefError);
  });
});

describe('applyTruncation', () => {
  it('marks oversized text deterministically', () => {
    const text = 'x'.repeat(250_000);
    const a = applyTruncation(text, 100_000);
    const b = applyTruncation(text, 100_000);
    expect(a).toEqual(b);
    expect(a.truncated).toBe(true);
    expect(a.text.length).toBeLessThan(text.length);
    expect(a.text).toContain('[truncated: showing the first 100,000 of 250,000 characters]');
  });

  it('leaves short text untouched', () => {
    const result = applyTruncation('short', 100);
    expect(result).toEqual({ text: 'short', truncated: false });
  });
});

describe('mimeForAttachment', () => {
  it('prefers the declared mime type when supported', () => {
    expect(mimeForAttachment({ fileName: 'a.bin', mimeType: 'application/pdf' })).toBe('application/pdf');
  });

  it('falls back to the file extension', () => {
    expect(mimeForAttachment({ fileName: 'a.docx', mimeType: '' })).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(mimeForAttachment({ fileName: 'a.txt', mimeType: 'application/octet-stream' })).toBe('text/plain');
  });

  it('returns octet-stream for unknown types', () => {
    expect(mimeForAttachment({ fileName: 'a.xyz', mimeType: '' })).toBe('application/octet-stream');
  });
});

describe('extractAttachment', () => {
  it('extracts text from TXT fixtures', async () => {
    const doc = await extractAttachment(readFixture('notes.txt'), { id: 'x', fileName: 'notes.txt', mimeType: 'text/plain', url: null }, {
      maxFileBytes: 20 * 1024 * 1024,
      maxExtractedChars: 100_000,
    });
    expect(doc.text).toContain('Shipped the reporting dashboard');
    expect(doc.truncated).toBe(false);
  });

  it('extracts text from a real PDF fixture', async () => {
    const doc = await extractAttachment(readFixture('q3-report.pdf'), { id: 'x', fileName: 'q3-report.pdf', mimeType: 'application/pdf', url: null }, {
      maxFileBytes: 20 * 1024 * 1024,
      maxExtractedChars: 100_000,
    });
    expect(doc.pageCount).toBe(2);
    expect(doc.text).toContain('Q3 revenue grew 12 percent');
    expect(doc.text).toContain('renewal draft');
  });

  it('raises ocr-required for scanned PDFs without text', async () => {
    await expect(
      extractAttachment(readFixture('scanned.pdf'), { id: 'x', fileName: 'scanned.pdf', mimeType: 'application/pdf', url: null }, {
        maxFileBytes: 20 * 1024 * 1024,
        maxExtractedChars: 100_000,
      })
    ).rejects.toMatchObject({ kind: 'ocr-required' });
  });

  it('extracts text from a DOCX fixture', async () => {
    const doc = await extractAttachment(readFixture('contract.docx'), { id: 'x', fileName: 'contract.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', url: null }, {
      maxFileBytes: 20 * 1024 * 1024,
      maxExtractedChars: 100_000,
    });
    expect(doc.text).toContain('renewal fee increases by 5 percent');
    expect(doc.text).toContain('liability is capped');
  });

  it('enforces the file size limit before parsing', async () => {
    await expect(
      extractAttachment(readFixture('large.txt'), { id: 'x', fileName: 'large.txt', mimeType: 'text/plain', url: null }, {
        maxFileBytes: 1000,
        maxExtractedChars: 100_000,
      })
    ).rejects.toMatchObject({ kind: 'too-large' });
  });

  it('truncates extracted text deterministically', async () => {
    const doc = await extractAttachment(readFixture('large.txt'), { id: 'x', fileName: 'large.txt', mimeType: 'text/plain', url: null }, {
      maxFileBytes: 20 * 1024 * 1024,
      maxExtractedChars: 5_000,
    });
    expect(doc.truncated).toBe(true);
    expect(doc.text).toContain('[truncated');
  });

  it('rejects unsupported types', async () => {
    await expect(
      extractAttachment(readFixture('notes.txt'), { id: 'x', fileName: 'archive.zip', mimeType: 'application/zip', url: null }, {
        maxFileBytes: 20 * 1024 * 1024,
        maxExtractedChars: 100_000,
      })
    ).rejects.toMatchObject({ kind: 'unsupported-type' });
  });
});
