import { describe, expect, it } from 'vitest';
import { redactString } from '../../src/shared/logger';

describe('redactString', () => {
  it('masks API key patterns', () => {
    expect(redactString('key sk-abcdef123456 present')).toBe('key sk-abcdef123456[REDACTED] present');
  });

  it('masks bearer tokens', () => {
    const out = redactString('Authorization: Bearer abcdefghijkl') as string;
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('Bearer abcdefghijkl');
  });

  it('masks long strings', () => {
    const out = redactString('x'.repeat(100)) as string;
    expect(out).toContain('…');
    expect(out.length).toBeLessThan(100);
  });

  it('returns non-string values untouched', () => {
    expect(redactString(42)).toBe(42);
    expect(redactString(null)).toBe(null);
  });

  it('redacts JSON-style api key fields', () => {
    expect(redactString('"apiKey": "sk-testvalue123"')).toContain('[REDACTED]');
  });
});
