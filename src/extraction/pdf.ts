import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { MailBriefError } from '../shared/types';

const workerSrc =
  typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function'
    ? chrome.runtime.getURL(workerUrl)
    : workerUrl;

if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
}

const MIN_SIGNAL_CHARS = 30;

export async function extractPdfText(buffer: ArrayBuffer, signal?: AbortSignal): Promise<{ text: string; pageCount: number }> {
  let document;
  try {
    document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MailBriefError('cancelled', 'PDF extraction was cancelled.', false);
    }
    throw new MailBriefError('extraction', `The PDF could not be parsed: ${(err as Error).message}`, false);
  }

  try {
    let text = '';
    const pageCount = document.numPages;
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      signal?.throwIfAborted();
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) text = text ? `${text}\n\n${pageText}` : pageText;
    }

    if (text.replace(/\s/g, '').length < MIN_SIGNAL_CHARS) {
      throw new MailBriefError(
        'ocr-required',
        'This PDF appears to be a scanned image with no extractable text. OCR is required to summarise it, which is not supported yet.',
        false
      );
    }
    return { text, pageCount };
  } finally {
    await document.destroy();
  }
}
