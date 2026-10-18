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
}

function composeSignal(timeoutMs: number, callerSignal?: AbortSignal): { signal: AbortSignal; timer: NodeJS.Timeout | number } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  callerSignal?.addEventListener('abort', () => controller.abort(), { once: true });
  return { signal: controller.signal, timer };
}

export async function chatCompletion({ settings, messages, maxTokens, signal }: ChatCompletionOptions): Promise<string> {
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
    throw new Error(validation);
  }

  const { signal: composed, timer } = composeSignal(settings.timeoutMs, signal);
  const url = chatCompletionsUrl(settings.baseUrl);
  try {
    logger.debug('sending chat completion', { messages: messages.length });
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        max_tokens: maxTokens ?? settings.maxOutputTokens,
        temperature: 0,
      }),
      signal: composed,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn('chat completion failed', { status: response.status });
      throw mapHttpFailure({ status: response.status, body });
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
    return content;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && !signal?.aborted) {
      throw mapNetworkFailure(err);
    }
    throw mapNetworkFailure(err);
  } finally {
    clearTimeout(timer);
  }
}
