import type { MailBriefSettings } from './types';

export const PORT_NAME = 'mailbrief';

export const DEFAULT_SETTINGS: MailBriefSettings = {
  baseUrl: '',
  apiKey: '',
  model: 'gpt-4o-mini',
  timeoutMs: 60_000,
  maxOutputTokens: 1024,
  prompt: '',
  includeDocumentTitle: true,
  maxFileBytes: 20 * 1024 * 1024,
  maxExtractedChars: 100_000,
  chunkChars: 6000,
  chunkOverlapChars: 200,
  consentGiven: false,
  consentEndpoint: '',
  debug: false,
};

export const LIMITS = {
  maxFileBytes: { min: 10 * 1024, max: 50 * 1024 * 1024 },
  maxExtractedChars: { min: 1_000, max: 2_000_000 },
  timeoutMs: { min: 2_000, max: 300_000 },
  maxOutputTokens: { min: 64, max: 16_384 },
  chunkChars: { min: 1_000, max: 50_000 },
  chunkOverlapChars: { min: 0, max: 5_000 },
} as const;

export const SUPPORTED_HOSTS = ['mail.google.com', 'outlook.office.com', 'outlook.live.com'] as const;

export const MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
} as const;

export const HOSTS = {
  gmail: 'mail.google.com',
  outlookOffice: 'outlook.office.com',
  outlookLive: 'outlook.live.com',
} as const;

export const STORAGE_KEY = 'mailbrief-settings-v1';

export const TRUNCATION_MARKER = (shown: number, total: number): string =>
  `\n\n[truncated: showing the first ${shown.toLocaleString()} of ${total.toLocaleString()} characters]`;
