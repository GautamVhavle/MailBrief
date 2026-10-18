export interface MailBriefSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  prompt: string;
  includeDocumentTitle: boolean;
  maxFileBytes: number;
  maxExtractedChars: number;
  chunkChars: number;
  chunkOverlapChars: number;
  consentGiven: boolean;
  consentEndpoint: string;
  debug: boolean;
}

export interface ActionItem {
  text: string;
  owner?: string;
  deadline?: string;
}

export interface Summary {
  executiveSummary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  risks: string[];
  unansweredQuestions: string[];
  sourceFileName: string;
  generatedAt: string;
}

export type MailBriefErrorKind =
  | 'auth'
  | 'forbidden'
  | 'rate-limit'
  | 'server'
  | 'timeout'
  | 'context-limit'
  | 'malformed'
  | 'extraction'
  | 'ocr-required'
  | 'missing-url'
  | 'cancelled'
  | 'consent-required'
  | 'network'
  | 'invalid-settings'
  | 'unsupported-type'
  | 'too-large'
  | 'duplicate'
  | 'internal';

export interface MailBriefErrorShape {
  kind: MailBriefErrorKind;
  message: string;
  retryable: boolean;
  status?: number;
}

export class MailBriefError extends Error implements MailBriefErrorShape {
  readonly kind: MailBriefErrorKind;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(kind: MailBriefErrorKind, message: string, retryable = false, status?: number) {
    super(message);
    this.name = 'MailBriefError';
    this.kind = kind;
    this.retryable = retryable;
    this.status = status;
  }
}

export interface ExtractedDocument {
  fileName: string;
  mimeType: string;
  text: string;
  truncated: boolean;
  pageCount?: number;
}

export interface AttachmentRef {
  id: string;
  fileName: string;
  mimeType: string;
  url: string | null;
  container?: HTMLElement;
}

export interface Chunk {
  index: number;
  total: number;
  text: string;
}

export interface SummarizeRequest {
  id: string;
  fileName: string;
  mimeType: string;
  chunks: Chunk[];
}

export interface ProgressEvent {
  phase: 'chunk' | 'combine';
  done: number;
  total: number;
}

export interface SummarizeResult {
  ok: boolean;
  summary?: Summary;
  error?: MailBriefErrorShape;
}
