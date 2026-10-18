import { applyTruncation } from '../shared/settings';
import { MIME_TYPES } from '../shared/constants';
import { MailBriefError, type AttachmentRef, type ExtractedDocument } from '../shared/types';
import { enforceFileSize, enforceTextLength } from './limits';
import { decodeText } from './text';
import { extractPdfText } from './pdf';
import { extractDocxText } from './docx';

const EXTENSION_MAP: Record<string, 'pdf' | 'docx' | 'txt'> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
  text: 'txt',
  md: 'txt',
  csv: 'txt',
};

export function mimeForAttachment(ref: Pick<AttachmentRef, 'fileName' | 'mimeType'>): string {
  const declared = ref.mimeType?.toLowerCase() ?? '';
  if (Object.values(MIME_TYPES).includes(declared as (typeof MIME_TYPES)[keyof typeof MIME_TYPES])) {
    return declared;
  }
  const ext = ref.fileName.split('.').pop()?.toLowerCase() ?? '';
  const mapped = EXTENSION_MAP[ext];
  return mapped ? MIME_TYPES[mapped as keyof typeof MIME_TYPES] : declared || 'application/octet-stream';
}

export interface ExtractLimits {
  maxFileBytes: number;
  maxExtractedChars: number;
}

type Kind = 'pdf' | 'docx' | 'txt';

function kindForMime(mime: string): Kind | null {
  switch (mime) {
    case MIME_TYPES.pdf:
      return 'pdf';
    case MIME_TYPES.docx:
      return 'docx';
    case MIME_TYPES.txt:
      return 'txt';
    default:
      return null;
  }
}

export async function extractAttachment(
  bytes: ArrayBuffer,
  ref: AttachmentRef,
  limits: ExtractLimits,
  signal?: AbortSignal
): Promise<ExtractedDocument> {
  enforceFileSize(bytes.byteLength, limits.maxFileBytes);

  const mime = mimeForAttachment(ref);
  const kind = kindForMime(mime);
  if (!kind) {
    throw new MailBriefError(
      'unsupported-type',
      `File type "${mime || 'unknown'}" is not supported. Supported types: PDF, DOCX, TXT.`,
      false
    );
  }

  let text: string;
  let pageCount: number | undefined;
  switch (kind) {
    case 'txt':
      text = decodeText(bytes);
      break;
    case 'pdf': {
      const out = await extractPdfText(bytes, signal);
      text = out.text;
      pageCount = out.pageCount;
      break;
    }
    case 'docx': {
      const out = await extractDocxText(bytes, signal);
      text = out.text;
      break;
    }
  }

  text = text.trim();
  if (!text) {
    throw new MailBriefError('extraction', 'No text content was found in this attachment.', false);
  }

  const { text: limited, truncated } = applyTruncation(text, limits.maxExtractedChars);
  enforceTextLength(limited.length, limits.maxExtractedChars);

  return { fileName: ref.fileName, mimeType: mime, text: limited, truncated, pageCount };
}

export function createExtractLimits(maxFileBytes: number, maxExtractedChars: number): ExtractLimits {
  return { maxFileBytes, maxExtractedChars };
}
