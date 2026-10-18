import { describe, expect, it } from 'vitest';
import { mapHttpFailure, mapNetworkFailure } from '../../src/llm/errors';
import { MailBriefError } from '../../src/shared/types';

describe('mapHttpFailure', () => {
  it('maps 401 to auth', () => {
    const err = mapHttpFailure({ status: 401, body: 'unauthorized' });
    expect(err.kind).toBe('auth');
    expect(err.retryable).toBe(false);
    expect(err.status).toBe(401);
  });

  it('maps 403 to forbidden', () => {
    expect(mapHttpFailure({ status: 403, body: '' }).kind).toBe('forbidden');
  });

  it('maps 429 to a retryable rate limit', () => {
    const err = mapHttpFailure({ status: 429, body: 'too many requests' });
    expect(err.kind).toBe('rate-limit');
    expect(err.retryable).toBe(true);
  });

  it('maps 5xx to a retryable server error', () => {
    const err = mapHttpFailure({ status: 502, body: 'bad gateway' });
    expect(err.kind).toBe('server');
    expect(err.retryable).toBe(true);
  });

  it('maps context-length 400 bodies to context-limit', () => {
    const err = mapHttpFailure({ status: 400, body: '{"error":"maximum context length exceeded"}' });
    expect(err.kind).toBe('context-limit');
  });

  it('maps other 400s to server errors', () => {
    const err = mapHttpFailure({ status: 400, body: 'invalid request' });
    expect(err.kind).toBe('server');
    expect(err.status).toBe(400);
  });
});

describe('mapNetworkFailure', () => {
  it('maps abort errors to timeout', () => {
    const err = mapNetworkFailure(new DOMException('Aborted', 'AbortError'));
    expect(err.kind).toBe('timeout');
    expect(err.retryable).toBe(true);
  });

  it('maps TypeErrors to actionable network errors', () => {
    const err = mapNetworkFailure(new TypeError('Failed to fetch'));
    expect(err.kind).toBe('network');
    expect(err.retryable).toBe(true);
    expect(err.message).toContain('CORS');
  });

  it('passes MailBriefErrors through unchanged', () => {
    const original = new MailBriefError('malformed', 'bad json');
    expect(mapNetworkFailure(original)).toBe(original);
  });
});
