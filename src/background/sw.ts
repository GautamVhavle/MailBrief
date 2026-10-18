import { PORT_NAME } from '../shared/constants';
import { logger } from '../shared/logger';
import type { ProgressEvent, SummarizeRequest } from '../shared/types';
import { grantConsent, revokeConsent, runSummarization, testConnection, toErrorShape } from './orchestrator';

const inFlight = new Map<string, AbortController>();
const inflightByKey = new Map<string, string>();
const portRequests = new Map<chrome.runtime.Port, Set<string>>();

interface PortMessage {
  type: string;
  id?: string;
  fileName?: string;
  mimeType?: string;
  chunks?: SummarizeRequest['chunks'];
}

function sendMessage(port: chrome.runtime.Port, message: unknown): void {
  try {
    port.postMessage(message);
  } catch (err) {
    logger.warn('postMessage failed', { reason: String(err) });
  }
}

function forgetRequest(id: string): void {
  const controller = inFlight.get(id);
  if (controller) {
    controller.abort();
    inFlight.delete(id);
  }
  for (const [key, value] of [...inflightByKey]) {
    if (value === id) inflightByKey.delete(key);
  }
  for (const requests of portRequests.values()) {
    requests.delete(id);
  }
}

function handleSummarize(port: chrome.runtime.Port, message: PortMessage): void {
  const id = message.id ?? crypto.randomUUID();
  const key = `${message.fileName ?? ''}|${message.mimeType ?? ''}`;

  const existing = inflightByKey.get(key);
  if (existing && inFlight.has(existing)) {
    sendMessage(port, {
      type: 'mailbrief/result',
      id,
      ok: false,
      error: { kind: 'duplicate', message: 'This attachment is already being summarised.', retryable: true },
    });
    return;
  }

  const controller = new AbortController();
  inFlight.set(id, controller);
  inflightByKey.set(key, id);
  let owned = portRequests.get(port);
  if (!owned) {
    owned = new Set();
    portRequests.set(port, owned);
  }
  owned.add(id);

  const onProgress = (event: ProgressEvent): void => {
    sendMessage(port, { type: 'mailbrief/progress', id, ...event });
  };

  runSummarization({ id, fileName: message.fileName ?? '', mimeType: message.mimeType ?? '', chunks: message.chunks ?? [] }, controller.signal, onProgress)
    .then((summary) => {
      sendMessage(port, { type: 'mailbrief/result', id, ok: true, summary });
    })
    .catch((err: unknown) => {
      sendMessage(port, { type: 'mailbrief/result', id, ok: false, error: toErrorShape(err) });
    })
    .finally(() => {
      inFlight.delete(id);
      if (inflightByKey.get(key) === id) inflightByKey.delete(key);
      portRequests.get(port)?.delete(id);
    });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;
  logger.info('port connected', { sender: port.sender?.url });

  port.onMessage.addListener((message: PortMessage) => {
    switch (message.type) {
      case 'mailbrief/summarize':
        handleSummarize(port, message);
        break;
      case 'mailbrief/cancel':
        if (message.id) forgetRequest(message.id);
        break;
      case 'mailbrief/consent-grant':
        grantConsent()
          .then(() => sendMessage(port, { type: 'mailbrief/consent', id: message.id, granted: true }))
          .catch((err: unknown) => sendMessage(port, { type: 'mailbrief/consent', id: message.id, granted: false, error: toErrorShape(err) }));
        break;
      case 'mailbrief/consent-revoke':
        revokeConsent()
          .then(() => sendMessage(port, { type: 'mailbrief/consent', granted: false }))
          .catch(() => sendMessage(port, { type: 'mailbrief/consent', granted: false }));
        break;
      case 'mailbrief/test-connection':
        testConnection()
          .then((result) => sendMessage(port, { type: 'mailbrief/connection-result', id: message.id, ...result }))
          .catch((err: unknown) =>
            sendMessage(port, { type: 'mailbrief/connection-result', id: message.id, ok: false, message: toErrorShape(err).message })
          );
        break;
      default:
        logger.warn('unknown message type', { type: message.type });
    }
  });

  port.onDisconnect.addListener(() => {
    logger.info('port disconnected', { sender: port.sender?.url });
    const owned = portRequests.get(port);
    if (owned) {
      for (const id of owned) {
        const controller = inFlight.get(id);
        if (controller) {
          controller.abort();
          inFlight.delete(id);
        }
        for (const [key, value] of [...inflightByKey]) {
          if (value === id) inflightByKey.delete(key);
        }
      }
      portRequests.delete(port);
    }
  });
});
