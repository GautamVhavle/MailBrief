import { DEFAULT_SETTINGS, LIMITS, TRUNCATION_MARKER } from './constants';
import { MailBriefError, type MailBriefSettings } from './types';
import { validateBaseUrl } from './endpoints';

export interface SettingsValidation {
  ok: boolean;
  errors: string[];
  settings: MailBriefSettings;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function sanitizeSettings(input: unknown): SettingsValidation {
  const errors: string[] = [];
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

  const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl : '';
  const endpointCheck = validateBaseUrl(baseUrl);
  if (baseUrl && !endpointCheck.ok) {
    errors.push(...endpointCheck.errors);
  }

  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
  const model = typeof raw.model === 'string' && raw.model.trim() !== '' ? raw.model.trim() : DEFAULT_SETTINGS.model;

  const timeoutMs = clampInt(raw.timeoutMs, LIMITS.timeoutMs.min, LIMITS.timeoutMs.max, DEFAULT_SETTINGS.timeoutMs);
  const maxOutputTokens = clampInt(
    raw.maxOutputTokens,
    LIMITS.maxOutputTokens.min,
    LIMITS.maxOutputTokens.max,
    DEFAULT_SETTINGS.maxOutputTokens
  );
  const maxFileBytes = clampInt(
    raw.maxFileBytes,
    LIMITS.maxFileBytes.min,
    LIMITS.maxFileBytes.max,
    DEFAULT_SETTINGS.maxFileBytes
  );
  const maxExtractedChars = clampInt(
    raw.maxExtractedChars,
    LIMITS.maxExtractedChars.min,
    LIMITS.maxExtractedChars.max,
    DEFAULT_SETTINGS.maxExtractedChars
  );
  const chunkChars = clampInt(raw.chunkChars, LIMITS.chunkChars.min, LIMITS.chunkChars.max, DEFAULT_SETTINGS.chunkChars);
  const chunkOverlapChars = clampInt(
    raw.chunkOverlapChars,
    LIMITS.chunkOverlapChars.min,
    LIMITS.chunkOverlapChars.max,
    DEFAULT_SETTINGS.chunkOverlapChars
  );
  if (chunkOverlapChars >= chunkChars) {
    errors.push('Chunk overlap must be smaller than chunk size.');
  }

  const prompt = typeof raw.prompt === 'string' ? raw.prompt : DEFAULT_SETTINGS.prompt;

  const settings: MailBriefSettings = {
    baseUrl: endpointCheck.ok ? endpointCheck.normalizedBase : baseUrl.trim().replace(/\/+$/, ''),
    apiKey,
    model,
    timeoutMs,
    maxOutputTokens,
    prompt,
    includeDocumentTitle: typeof raw.includeDocumentTitle === 'boolean' ? raw.includeDocumentTitle : true,
    maxFileBytes,
    maxExtractedChars,
    chunkChars,
    chunkOverlapChars,
    consentGiven: typeof raw.consentGiven === 'boolean' ? raw.consentGiven : false,
    consentEndpoint: typeof raw.consentEndpoint === 'string' ? raw.consentEndpoint : '',
    debug: typeof raw.debug === 'boolean' ? raw.debug : false,
  };

  if (settings.consentGiven && settings.consentEndpoint !== settings.baseUrl) {
    settings.consentGiven = false;
    errors.push('Saved consent does not match the current endpoint; acknowledge the destination again.');
  }

  return { ok: errors.length === 0, errors, settings };
}

export function isSettingsReady(settings: MailBriefSettings): { ok: boolean; reason?: string } {
  const check = validateBaseUrl(settings.baseUrl);
  if (!check.ok) return { ok: false, reason: check.errors[0] ?? 'Invalid base URL.' };
  if (!settings.apiKey) return { ok: false, reason: 'API key is required.' };
  if (!settings.model) return { ok: false, reason: 'Model name is required.' };
  return { ok: true };
}

export function applyTruncation(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  const marker = TRUNCATION_MARKER(maxChars, text.length);
  const head = text.slice(0, Math.max(0, maxChars - marker.length));
  return { text: `${head}${marker}`, truncated: true };
}

export function settingsError(message: string): MailBriefError {
  return new MailBriefError('invalid-settings', message, false);
}
