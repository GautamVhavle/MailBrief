import { PORT_NAME } from '../shared/constants';
import { logger } from '../shared/logger';
import { loadSettings } from '../shared/storage';
import { chunkText } from '../extraction/chunking';
import { extractAttachment } from '../extraction';
import { adapterForHost } from '../adapters';
import { mountAttachmentControl, type StageEvent } from './ui/AttachmentControl';
import { MailBriefError, type AttachmentRef, type MailBriefErrorShape, type Summary } from '../shared/types';

const adapter = adapterForHost(window.location.hostname);
if (!adapter) {
  throw new Error(`MailBrief: unsupported host ${window.location.hostname}`);
}
logger.info('content script initialised', { host: adapter.name });

interface PortResponse {
  type: string;
  id?: string;
  ok?: boolean;
  summary?: Summary;
  error?: MailBriefErrorShape;
  phase?: 'chunk' | 'combine';
  done?: number;
  total?: number;
  granted?: boolean;
}

function requestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PendingRequest {
  resolve: (summary: Summary) => void;
  reject: (err: Error) => void;
  onProgress?: (event: StageEvent) => void;
  onError?: (error: MailBriefErrorShape) => void;
}

class Summarizer {
  private port: chrome.runtime.Port | null = null;
  private pending = new Map<string, PendingRequest>();

  private connect(): chrome.runtime.Port {
    if (!this.port) {
      this.port = chrome.runtime.connect({ name: PORT_NAME });
      this.port.onMessage.addListener((message: PortResponse) => this.handleMessage(message));
    }
    return this.port;
  }

  private handleMessage(message: PortResponse): void {
    if (!message.id) return;
    const entry = this.pending.get(message.id);
    if (!entry) return;
    if (message.type === 'mailbrief/progress') {
      entry.onProgress?.({ stage: message.phase === 'combine' ? 'combine' : 'chunk', done: message.done ?? 0, total: message.total ?? 1 });
      return;
    }
    if (message.type !== 'mailbrief/result') return;
    this.pending.delete(message.id);
    if (message.ok && message.summary) {
      entry.resolve(message.summary);
    } else {
      const shape = message.error ?? { kind: 'internal', message: 'No response from the extension.', retryable: true };
      entry.onError?.(shape);
      entry.reject(new MailBriefError(shape.kind, shape.message, shape.retryable));
    }
  }

  async summarize(
    fileName: string,
    mimeType: string,
    url: string | null,
    onProgress: (p: StageEvent) => void
  ): Promise<Summary> {
    if (!url) {
      throw new MailBriefError('missing-url', 'No download URL was found for this attachment. Gmail/Outlook may have changed their layout.', false);
    }
    onProgress({ stage: 'fetching' });
    const settings = await loadSettings();
    const response = await fetch(url);
    if (!response.ok) {
      throw new MailBriefError('network', `The attachment could not be downloaded (HTTP ${response.status}).`, true);
    }
    const bytes = await response.arrayBuffer();

    onProgress({ stage: 'extracting' });
    const extracted = await extractAttachment(bytes, { id: fileName, fileName, mimeType, url }, {
      maxFileBytes: settings.maxFileBytes,
      maxExtractedChars: settings.maxExtractedChars,
    });

    const chunks = chunkText(extracted.text, { size: settings.chunkChars, overlap: settings.chunkOverlapChars });
    if (chunks.length === 0) {
      throw new MailBriefError('extraction', 'No text content was found in this attachment.', false);
    }

    onProgress({ stage: 'chunk', done: 1, total: chunks.length });

    return new Promise<Summary>((resolve, reject) => {
      const reqId = requestId();
      const port = this.connect();
      this.pending.set(reqId, {
        resolve,
        reject,
        onProgress,
      });
      port.postMessage({
        type: 'mailbrief/summarize',
        id: reqId,
        fileName: extracted.fileName,
        mimeType: extracted.mimeType,
        chunks,
      });
    });
  }

  cancelAll(): void {
    for (const reqId of this.pending.keys()) {
      this.port?.postMessage({ type: 'mailbrief/cancel', id: reqId });
      this.pending.delete(reqId);
    }
  }

  grantConsent(): Promise<void> {
    const port = this.connect();
    return new Promise<void>((resolve, reject) => {
      const reqId = requestId();
      const timer = setTimeout(() => {
        port.onMessage.removeListener(listener);
        reject(new MailBriefError('internal', 'Consent request timed out.', true));
      }, 10_000);
      const listener = (message: PortResponse): void => {
        if (message.type === 'mailbrief/consent' && message.id === reqId) {
          clearTimeout(timer);
          port.onMessage.removeListener(listener);
          if (message.granted) {
            resolve();
          } else {
            reject(new MailBriefError('consent-required', 'Consent could not be recorded.', false));
          }
        }
      };
      port.onMessage.addListener(listener);
      port.postMessage({ type: 'mailbrief/consent-grant', id: reqId });
    });
  }
}

const summarizer = new Summarizer();
const mountedRoots = new Set<string>();
let settingsEndpoint: string | null = null;
let settingsConsentGiven = false;
let settingsLoaded = false;

async function ensureSettings(): Promise<void> {
  if (settingsLoaded) return;
  try {
    const settings = await loadSettings();
    settingsEndpoint = settings.baseUrl || null;
    settingsConsentGiven =
      Boolean(settings.consentGiven) && settings.consentEndpoint === settings.baseUrl;
    settingsLoaded = true;
  } catch (err) {
    logger.warn('settings load failed', { reason: String(err) });
  }
}

function mountFor(ref: AttachmentRef): void {
  if (mountedRoots.has(ref.id) || !ref.container) return;
  if (ref.container.querySelector('.mbx-host')) return;
  mountedRoots.add(ref.id);
  logger.info('mounting summarise control', { fileName: ref.fileName });

  mountAttachmentControl({
    container: ref.container,
    id: ref.id,
    fileName: ref.fileName,
    url: ref.url,
    endpoint: settingsEndpoint,
    consentGiven: settingsConsentGiven,
    onSummarize: (url, onProgress) => summarizer.summarize(ref.fileName, ref.mimeType, url, onProgress),
    onError: (errorId, error) => {
      logger.warn('summarisation error', { id: errorId, kind: error.kind });
    },
    onConsentGrant: () => summarizer.grantConsent(),
    onDismiss: (dismissId: string) => {
      mountedRoots.delete(dismissId);
    },
  });
}

async function scan(): Promise<void> {
  await ensureSettings();
  for (const ref of adapter.findAttachments(document)) {
    mountFor(ref);
  }
}

let scanScheduled = false;
function scheduleScan(): void {
  if (scanScheduled) return;
  scanScheduled = true;
  setTimeout(() => {
    scanScheduled = false;
    void (async () => {
      try {
        await scan();
      } catch (err) {
        logger.warn('scan failed', { reason: String(err) });
      }
    })();
  }, 250);
}

void scan();

const observer = new MutationObserver(() => scheduleScan());
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('beforeunload', () => {
  observer.disconnect();
  summarizer.cancelAll();
});
