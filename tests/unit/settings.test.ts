import { describe, expect, it } from 'vitest';
import { sanitizeSettings, isSettingsReady } from '../../src/shared/settings';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';

describe('sanitizeSettings', () => {
  it('fills defaults for empty input', () => {
    const { ok, settings, errors } = sanitizeSettings({});
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
    expect(settings.model).toBe(DEFAULT_SETTINGS.model);
    expect(settings.maxFileBytes).toBe(20 * 1024 * 1024);
    expect(settings.maxExtractedChars).toBe(100_000);
    expect(settings.timeoutMs).toBe(DEFAULT_SETTINGS.timeoutMs);
  });

  it('normalizes the base URL', () => {
    const { settings } = sanitizeSettings({ baseUrl: 'https://api.example.com/v1///' });
    expect(settings.baseUrl).toBe('https://api.example.com/v1');
  });

  it('rejects plain HTTP remote URLs', () => {
    const { ok, errors } = sanitizeSettings({ baseUrl: 'http://api.example.com' });
    expect(ok).toBe(false);
    expect(errors[0]).toContain('HTTPS');
  });

  it('clamps numeric limits into their allowed ranges', () => {
    const { settings } = sanitizeSettings({
      timeoutMs: 999_999_999,
      maxOutputTokens: 1,
      maxFileBytes: 5,
      chunkChars: 100,
      chunkOverlapChars: 50,
    });
    expect(settings.timeoutMs).toBe(300_000);
    expect(settings.maxOutputTokens).toBe(64);
    expect(settings.maxFileBytes).toBe(10 * 1024);
    expect(settings.chunkChars).toBe(1000);
    expect(settings.chunkOverlapChars).toBe(50);
  });

  it('rejects overlap larger than chunk size', () => {
    const { ok, errors } = sanitizeSettings({ chunkChars: 1000, chunkOverlapChars: 2000 });
    expect(ok).toBe(false);
    expect(errors[0]).toContain('overlap');
  });

  it('resets consent when it does not match the current endpoint', () => {
    const { ok, settings } = sanitizeSettings({
      baseUrl: 'https://api.example.com/v1',
      consentGiven: true,
      consentEndpoint: 'https://other.example.com/v1',
    });
    expect(settings.consentGiven).toBe(false);
    expect(ok).toBe(false);
  });

  it('keeps consent when it matches the endpoint', () => {
    const { ok, settings } = sanitizeSettings({
      baseUrl: 'https://api.example.com/v1',
      consentGiven: true,
      consentEndpoint: 'https://api.example.com/v1',
    });
    expect(ok).toBe(true);
    expect(settings.consentGiven).toBe(true);
  });

  it('rejects unknown junk input', () => {
    const { ok } = sanitizeSettings(null);
    expect(ok).toBe(true);
  });
});

describe('isSettingsReady', () => {
  it('reports missing API key', () => {
    const result = isSettingsReady({ ...DEFAULT_SETTINGS, baseUrl: 'https://api.example.com/v1', apiKey: '' });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('API key');
  });

  it('reports invalid base URL', () => {
    const result = isSettingsReady({ ...DEFAULT_SETTINGS, baseUrl: '' });
    expect(result.ok).toBe(false);
  });

  it('passes for a complete configuration', () => {
    const result = isSettingsReady({
      ...DEFAULT_SETTINGS,
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
    });
    expect(result.ok).toBe(true);
  });
});
