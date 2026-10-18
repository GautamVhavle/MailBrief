import { logger, setDebugLogging } from '../shared/logger';
import { loadSettings, saveSettings } from '../shared/storage';
import { isSettingsReady } from '../shared/settings';
import { chatCompletion } from '../llm/client';
import { buildSystemPrompt, buildUserPrompt, CONNECTION_TEST_MESSAGES } from '../llm/prompt';
import { parseSummaryResponse, parseConnectionTestResponse } from '../llm/parse';
import { endpointMismatchError } from '../shared/endpoints';
import {
  MailBriefError,
  type Chunk,
  type MailBriefErrorShape,
  type MailBriefSettings,
  type ProgressEvent,
  type SummarizeRequest,
  type Summary,
} from '../shared/types';

export function toErrorShape(err: unknown): MailBriefErrorShape {
  if (err instanceof MailBriefError) {
    return { kind: err.kind, message: err.message, retryable: err.retryable, status: err.status };
  }
  return { kind: 'internal', message: (err as Error).message || 'Unexpected error.', retryable: true };
}

async function ensureConsent(settings: MailBriefSettings): Promise<MailBriefErrorShape | null> {
  if (!settings.consentGiven || settings.consentEndpoint !== settings.baseUrl) {
    const err = endpointMismatchError(settings.baseUrl);
    return { kind: err.kind, message: err.message, retryable: err.retryable };
  }
  return null;
}

export async function grantConsent(): Promise<void> {
  const settings = await loadSettings();
  const consentEndpoint = settings.baseUrl;
  if (!consentEndpoint) throw new MailBriefError('invalid-settings', 'Configure an endpoint before granting consent.', false);
  await saveSettings({ ...settings, consentGiven: true, consentEndpoint });
}

export async function revokeConsent(): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({ ...settings, consentGiven: false, consentEndpoint: '' });
}

async function summariseChunks(
  settings: MailBriefSettings,
  fileName: string,
  chunks: Chunk[],
  signal: AbortSignal | undefined,
  onProgress?: (event: ProgressEvent) => void
): Promise<string> {
  const system = buildSystemPrompt(settings.prompt);
  const isMulti = chunks.length > 1;

  if (!isMulti) {
    onProgress?.({ phase: 'chunk', done: 1, total: 1 });
    const user = buildUserPrompt({ fileName, text: chunks[0].text, phase: 'chunk' });
    return chatCompletion({ settings, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], signal });
  }

  const chunkSummaries: Array<{ index: number; text: string }> = [];
  for (const chunk of chunks) {
    signal?.throwIfAborted();
    onProgress?.({ phase: 'chunk', done: chunk.index + 1, total: chunks.length + 1 });
    const user = buildUserPrompt({
      fileName,
      text: chunk.text,
      phase: 'chunk',
      chunkIndex: chunk.index,
      chunkTotal: chunk.total,
    });
    const raw = await chatCompletion({
      settings,
      messages: [
        { role: 'system', content: `${system}\n\nYou are processing part ${chunk.index + 1} of ${chunk.total} of a longer document. Summarise only this part, following the JSON schema.` },
        { role: 'user', content: user },
      ],
      signal,
    });
    let summaryText: string;
    try {
      const parsed = parseSummaryResponse(raw, fileName);
      summaryText = [
        parsed.executiveSummary,
        ...parsed.keyPoints.map((p) => `• ${p}`),
        ...parsed.actionItems.map((a) => `• Action: ${a.text}`),
        ...parsed.decisions.map((d) => `• Decision: ${d}`),
        ...parsed.risks.map((r) => `• Risk: ${r}`),
      ].join('\n');
    } catch {
      summaryText = raw;
    }
    chunkSummaries.push({ index: chunk.index, text: summaryText });
  }

  onProgress?.({ phase: 'combine', done: chunks.length + 1, total: chunks.length + 1 });
  const combined = chunkSummaries.sort((a, b) => a.index - b.index).map((c) => c.text).join('\n\n---\n\n');
  const combineUser = buildUserPrompt({ fileName, text: combined, phase: 'combine' });
  return chatCompletion({
    settings,
    messages: [{ role: 'system', content: system }, { role: 'user', content: combineUser }],
    signal,
  });
}

export async function runSummarization(
  request: SummarizeRequest,
  signal?: AbortSignal,
  onProgress?: (event: ProgressEvent) => void
): Promise<Summary> {
  setDebugLogging(true);
  const settings = await loadSettings();
  const ready = isSettingsReady(settings);
  if (!ready.ok) throw new MailBriefError('invalid-settings', ready.reason ?? 'Settings incomplete.', false);

  const consentError = await ensureConsent(settings);
  if (consentError) throw new MailBriefError(consentError.kind, consentError.message, consentError.retryable);

  logger.info('summarisation started', { fileName: request.fileName, chunks: request.chunks.length });
  signal?.throwIfAborted();

  try {
    const raw = await summariseChunks(settings, request.fileName, request.chunks, signal, onProgress);
    signal?.throwIfAborted();
    const summary = parseSummaryResponse(raw, request.fileName);
    logger.info('summarisation completed', { fileName: request.fileName });
    return summary;
  } catch (err) {
    logger.warn('summarisation failed', { fileName: request.fileName, kind: err instanceof MailBriefError ? err.kind : 'unknown' });
    throw err;
  }
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const settings = await loadSettings();
  const ready = isSettingsReady(settings);
  if (!ready.ok) return { ok: false, message: ready.reason ?? 'Settings incomplete.' };
  try {
    const raw = await chatCompletion({
      settings,
      messages: CONNECTION_TEST_MESSAGES.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 16,
    });
    parseConnectionTestResponse(raw);
    return { ok: true, message: 'Connection succeeded. The endpoint responded to a chat completion.' };
  } catch (err) {
    const shape = toErrorShape(err);
    return { ok: false, message: shape.message };
  }
}
