import { MailBriefError } from './types';

export interface EndpointValidation {
  ok: boolean;
  errors: string[];
  normalizedBase: string;
  chatCompletionsUrl: string;
}

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function normalizeBaseUrl(raw: string): { baseUrl: string; error?: string } {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return { baseUrl: '', error: 'Base URL is required.' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { baseUrl: '', error: 'Base URL must be a valid absolute URL.' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { baseUrl: '', error: 'Base URL must use http or https.' };
  }
  if (url.protocol !== 'https:' && !isLocalhost(url.hostname)) {
    return {
      baseUrl: '',
      error: 'HTTPS is required for remote endpoints. Plain HTTP is only allowed on localhost.',
    };
  }
  if (url.username || url.password) {
    return { baseUrl: '', error: 'Credentials must not be embedded in the URL; use the API key field.' };
  }
  const base = `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
  return { baseUrl: base };
}

export function chatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  const hasV1 = /\/v\d+$/.test(normalized);
  return hasV1 ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`;
}

export function validateBaseUrl(raw: string): EndpointValidation {
  const { baseUrl, error } = normalizeBaseUrl(raw);
  if (error) {
    return { ok: false, errors: [error], normalizedBase: '', chatCompletionsUrl: '' };
  }
  return {
    ok: true,
    errors: [],
    normalizedBase: baseUrl,
    chatCompletionsUrl: chatCompletionsUrl(baseUrl),
  };
}

export function endpointMismatchError(endpoint: string): MailBriefError {
  return new MailBriefError(
    'consent-required',
    `Destination endpoint has not been acknowledged yet. Consent is required before the first request to ${endpoint}.`
  );
}
