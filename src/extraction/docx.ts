import mammoth from 'mammoth';
import { MailBriefError } from '../shared/types';

export async function extractDocxText(buffer: ArrayBuffer, signal?: AbortSignal): Promise<{ text: string }> {
  signal?.throwIfAborted();
  try {
    const input =
      typeof Buffer === 'undefined'
        ? { arrayBuffer: buffer }
        : { buffer: Buffer.from(buffer) };
    const result = await mammoth.extractRawText(input as never);
    return { text: result.value };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MailBriefError('cancelled', 'DOCX extraction was cancelled.', false);
    }
    throw new MailBriefError('extraction', `The DOCX could not be parsed: ${(err as Error).message}`, false);
  }
}
