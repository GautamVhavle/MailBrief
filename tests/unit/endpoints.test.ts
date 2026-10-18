import { describe, expect, it } from 'vitest';
import { chatCompletionsUrl, normalizeBaseUrl, validateBaseUrl } from '../../src/shared/endpoints';

describe('normalizeBaseUrl', () => {
  it('trims whitespace and trailing slashes', () => {
    expect(normalizeBaseUrl('  https://api.example.com/v1/  ')).toEqual({ baseUrl: 'https://api.example.com/v1' });
    expect(normalizeBaseUrl('https://api.example.com')).toEqual({ baseUrl: 'https://api.example.com' });
  });

  it('rejects empty URLs', () => {
    expect(normalizeBaseUrl('').error).toBe('Base URL is required.');
  });

  it('rejects invalid URLs', () => {
    expect(normalizeBaseUrl('not a url').error).toBeDefined();
  });

  it('rejects non-http protocols', () => {
    expect(normalizeBaseUrl('ftp://files.example.com').error).toBe('Base URL must use http or https.');
  });

  it('rejects plain HTTP on remote hosts', () => {
    const result = normalizeBaseUrl('http://api.example.com/v1');
    expect(result.error).toContain('HTTPS is required');
  });

  it('allows plain HTTP on localhost and 127.0.0.1', () => {
    expect(normalizeBaseUrl('http://localhost:11434/v1')).toEqual({ baseUrl: 'http://localhost:11434/v1' });
    expect(normalizeBaseUrl('http://127.0.0.1:5000')).toEqual({ baseUrl: 'http://127.0.0.1:5000' });
  });

  it('rejects embedded credentials', () => {
    expect(normalizeBaseUrl('https://user:pass@example.com/v1').error).toContain('Credentials');
  });
});

describe('chatCompletionsUrl', () => {
  it('appends /v1/chat/completions when no version segment exists', () => {
    expect(chatCompletionsUrl('https://api.example.com')).toBe('https://api.example.com/v1/chat/completions');
  });

  it('does not duplicate the version segment', () => {
    expect(chatCompletionsUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1/chat/completions');
  });

  it('keeps custom version prefixes', () => {
    expect(chatCompletionsUrl('http://localhost:11434/v2')).toBe('http://localhost:11434/v2/chat/completions');
  });
});

describe('validateBaseUrl', () => {
  it('passes for a valid HTTPS endpoint', () => {
    const result = validateBaseUrl('https://api.openai.com/v1');
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.chatCompletionsUrl).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('collects errors for invalid endpoints', () => {
    const result = validateBaseUrl('http://example.com');
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
