import { MailBriefError, type MailBriefErrorKind } from '../shared/types';

interface HttpFailure {
  status: number;
  body: string;
}

function classifyBody(body: string): { kind: MailBriefErrorKind | null; message?: string } {
  const lower = body.toLowerCase();
  const contextSignals = ['context_length_exceeded', 'context length', 'maximum context', 'too many tokens', 'token limit exceeded'];
  if (contextSignals.some((s) => lower.includes(s))) {
    return { kind: 'context-limit', message: 'The document is too long for this model’s context window.' };
  }
  const jsonSignals = ['invalid json', 'parse error', 'unexpected token'];
  if (jsonSignals.some((s) => lower.includes(s))) {
    return { kind: 'malformed', message: 'The model returned a response that could not be parsed.' };
  }
  return { kind: null };
}

export function mapHttpFailure({ status, body }: HttpFailure): MailBriefError {
  const classified = classifyBody(body);
  switch (status) {
    case 401:
      return new MailBriefError('auth', 'Authentication failed. Check the API key in settings.', false, status);
    case 403:
      return new MailBriefError('forbidden', 'Access denied by the endpoint. Verify the API key permissions.', false, status);
    case 429:
      return new MailBriefError('rate-limit', 'Rate limit hit. Wait a moment and try again.', true, status);
    case 400:
      if (classified.kind) return new MailBriefError(classified.kind, classified.message ?? body.slice(0, 160), false, status);
      return new MailBriefError('server', `The endpoint rejected the request (400). ${body.slice(0, 160)}`, false, status);
    default:
      if (status >= 500) {
        return new MailBriefError('server', `The endpoint returned a server error (${status}). Try again later.`, true, status);
      }
      return new MailBriefError('server', `Unexpected HTTP status ${status}.`, true, status);
  }
}

export function mapNetworkFailure(err: unknown): MailBriefError {
  if (err instanceof MailBriefError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new MailBriefError('timeout', 'The request timed out. Increase the timeout in settings or retry.', true);
  }
  if (err instanceof TypeError) {
    return new MailBriefError(
      'network',
      'Could not reach the endpoint. For browser extensions the target server must allow cross-origin (CORS) requests. A local proxy or CORS-enabled endpoint is recommended.',
      true
    );
  }
  return new MailBriefError('internal', `Unexpected error: ${(err as Error).message}`, false);
}
