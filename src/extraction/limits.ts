import { MailBriefError } from '../shared/types';

export function enforceFileSize(byteLength: number, maxFileBytes: number): void {
  if (!Number.isFinite(byteLength) || byteLength < 0) {
    throw new MailBriefError('extraction', 'Attachment size could not be determined.', false);
  }
  if (byteLength > maxFileBytes) {
    throw new MailBriefError(
      'too-large',
      `Attachment is ${(byteLength / (1024 * 1024)).toFixed(1)} MB, which exceeds the ${Math.round(
        maxFileBytes / (1024 * 1024)
      )} MB limit. Increase the limit in settings or summarise a smaller file.`,
      false
    );
  }
}

export function enforceTextLength(charLength: number, maxExtractedChars: number): void {
  if (charLength > maxExtractedChars) {
    throw new MailBriefError(
      'too-large',
      `Extracted text is ${charLength.toLocaleString()} characters, exceeding the ${maxExtractedChars.toLocaleString()}-character limit.`,
      false
    );
  }
}
