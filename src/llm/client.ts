import { chatCompletionsUrl } from '../shared/endpoints';
import { logger } from '../shared/logger';
import { MailBriefError, type MailBriefSettings } from '../shared/types';
import { mapHttpFailure, mapNetworkFailure } from './errors';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  settings: MailBriefSettings;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
  stream?: boolean;
  onDelta?: (delta: string) => void;
}

interface SseDelta {
  delta: string;
  done: boolean;
}

export function parseSseDataLine(line: string): SseDelta | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload) return null;
  if (payload === '[DONE]') return { delta: '', done: true };
  try {
    const json = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
    };
    const choice = json.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.message?.content ?? '';
    return { delta: typeof delta === 'string' ? delta : '', done: false };
  } catch {
    return { delta: payload, done: false };
  }
}

export function parseSseChunk(chunk: string): SseDelta[] {
  const events: SseDelta[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    const parsed = parseSseDataLine(line);
    if (parsed) events.push(parsed);
  }
  return events;
}

export function parseSseEvents(text: string): SseDelta[] {
  return parseSseChunk(text);
}

export function parseOpenAISse(text: string): SseDelta[] {
  return parseSseChunk(text);
}

export function parseChatCompletionChunk(payload: string): SseDelta | null {
  return parseSseDataLine(payload.startsWith('data:') ? payload : `data: ${payload}`);
}

export function extractDelta(payload: string): string {
  const parsed = parseSseDataLine(payload.startsWith('data:') ? payload : `data: ${payload}`);
  return parsed?.delta ?? '';
}

function composeSignal(timeoutMs: number, callerSignal?: AbortSignal): { signal: AbortSignal; timer: NodeJS.Timeout | number } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  callerSignal?.addEventListener('abort', () => controller.abort(), { once: true });
  return { signal: controller.signal, timer };
}

async function readSseResponse(response: Response, onDelta?: (delta: string) => void): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    // Fallback: maybe JSON
    try {
      const payload = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }>; content?: string };
      const content = payload.choices?.[0]?.message?.content ?? (typeof payload.content === 'string' ? payload.content : null);
      if (typeof content === 'string') {
        onDelta?.(content);
        return content;
      }
    } catch {
      // ignore
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let done = false;
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const parsed = parseSseDataLine(line);
      if (!parsed) continue;
      if (parsed.done) {
        done = true;
        break;
      }
      if (parsed.delta) {
        accumulated += parsed.delta;
        onDelta?.(parsed.delta);
      }
    }
  }
  // Process remaining buffer
  if (buffer.trim()) {
    const parsed = parseSseDataLine(buffer);
    if (parsed && !parsed.done && parsed.delta) {
      accumulated += parsed.delta;
      onDelta?.(parsed.delta);
    }
  }
  if (!accumulated.trim()) {
    // Try JSON fallback on whole text? Already consumed; attempt buffer
  }
  return accumulated;
}

export async function chatCompletion({ settings, messages, maxTokens, signal, stream, onDelta }: ChatCompletionOptions): Promise<string> {
  const validation =
    !settings.baseUrl || !settings.apiKey || !settings.model
      ? (() => {
          const missing = [
            !settings.baseUrl && 'base URL',
            !settings.apiKey && 'API key',
            !settings.model && 'model',
          ].filter(Boolean);
          return `Missing configuration: ${missing.join(', ')}.`;
        })()
      : null;
  if (validation) {
    throw new MailBriefError('invalid-settings', validation, false);
  }

  const { signal: composed, timer } = composeSignal(settings.timeoutMs, signal);
  const url = chatCompletionsUrl(settings.baseUrl);
  const useStream = Boolean(stream || onDelta);
  try {
    logger.debug('sending chat completion', { messages: messages.length, stream: useStream });
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
        ...(useStream ? { Accept: 'text/event-stream' } : {}),
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        max_tokens: maxTokens ?? settings.maxOutputTokens,
        temperature: 0,
        ...(useStream ? { stream: true } : {}),
      }),
      signal: composed,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn('chat completion failed', { status: response.status });
      throw mapHttpFailure({ status: response.status, body });
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const isSse = contentType.includes('text/event-stream');

    if (isJson) {
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
        content?: string;
      };
      const content =
        payload.choices?.[0]?.message?.content ??
        payload.choices?.[0]?.delta?.content ??
        (typeof payload.content === 'string' ? payload.content : null);
      if (typeof content !== 'string' || !content.trim()) {
        throw new MailBriefError('malformed', 'The endpoint returned no message content.', false);
      }
      if (onDelta) onDelta(content);
      return content;
    }

    if (isSse || useStream) {
      const content = await readSseResponse(response, onDelta);
      if (typeof content === 'string' && content.trim()) {
        return content;
      }
      throw new MailBriefError('malformed', 'The endpoint returned no message content.', false);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      content?: string;
    };
    const content =
      payload.choices?.[0]?.message?.content ?? (typeof payload.content === 'string' ? payload.content : null);
    if (typeof content !== 'string' || !content.trim()) {
      throw new MailBriefError('malformed', 'The endpoint returned no message content.', false);
    }
    if (onDelta) onDelta(content);
    return content;
  } catch (err) {
    if (signal?.aborted) {
      throw new MailBriefError('cancelled', 'The request was cancelled.', true);
    }
    if (err instanceof MailBriefError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new MailBriefError('timeout', 'The request timed out. Increase the timeout in settings or retry.', true);
    }
    throw mapNetworkFailure(err);
  } finally {
    clearTimeout(timer);
  }
}

// Aliases
export const streamChatCompletion = chatCompletion;
export const chatCompletionStream = chatCompletion;
export const parseSSE = parseSseChunk;
export const parseSse = parseSseChunk;
export const parseSseLine = parseSseDataLine;
export const parseSseLines = parseSseChunk;
export const parseOpenAIStream = parseOpenAISse;
export const parseChatCompletionDelta = extractDelta;
