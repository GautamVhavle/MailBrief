import type { AttachmentRef } from '../shared/types';
import type { HostAdapter } from './types';

const ACTION_ARIA = /download|save (this|the) file|attachment|open file/i;

const CONTAINER_CANDIDATES = '[role="listitem"], [class*="attachment" i], li, section, td';

function labelToFilename(label: string): string | null {
  const cleaned = label
    .replace(/^(download|save|open|preview|remove|delete):?\s*/i, '')
    .replace(/\s*(attachment|file)\s*$/i, '')
    .replace(/\s*\(\s*[\d.]+\s*(kb|mb|gb)\s*\)\s*$/i, '')
    .trim();
  return cleaned.length > 0 && cleaned.length < 200 ? cleaned : null;
}

function filenameFromElement(root: Element): string | null {
  for (const el of Array.from(root.querySelectorAll('[title], [class*="file" i], span, div'))) {
    const title = el.getAttribute('title');
    if (title && title.length > 0 && title.length < 200) return title;
    const aria = el.getAttribute('aria-label') ?? '';
    const fromAria = labelToFilename(aria);
    if (fromAria) return fromAria;
  }
  const text = Array.from(root.querySelectorAll('span, div'))
    .map((el) => el.textContent?.trim() ?? '')
    .filter((t) => t.length > 0 && t.length < 200 && !ACTION_ARIA.test(t));
  return text[0] ?? null;
}

function resolveUrl(root: Element): string | null {
  const anchor = root.querySelector('a[href]');
  const href = anchor?.getAttribute('href') ?? '';
  if (!href || href.startsWith('javascript:') || href === '#') return null;
  try {
    return new URL(href, window.location.origin).href;
  } catch {
    return null;
  }
}

function guessMime(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'txt') return 'text/plain';
  return 'application/octet-stream';
}

export const genericAdapter: HostAdapter = {
  name: 'generic',

  findAttachments(root: ParentNode): AttachmentRef[] {
    const refs: AttachmentRef[] = [];
    const seen = new Set<string>();
    const elements = root.querySelectorAll('[role="button"][aria-label], button[aria-label], a[href]');

    for (const el of Array.from(elements)) {
      const aria = el.getAttribute('aria-label') ?? '';
      if (!ACTION_ARIA.test(aria)) continue;

      const container =
        el.closest(CONTAINER_CANDIDATES) ??
        (el.parentElement?.querySelector('[role="button"], a[href]') ? el.parentElement : null) ??
        el;
      if (!container || refs.some((r) => r.container === container)) continue;

      const fileName = labelToFilename(aria) ?? filenameFromElement(container);
      if (!fileName) continue;

      const url = resolveUrl(container);
      const id = `${fileName}|${url ?? 'no-url'}`;
      if (seen.has(id)) continue;
      seen.add(id);
      refs.push({ id, fileName, mimeType: guessMime(fileName), url, container: container as HTMLElement });
    }
    return refs;
  },
};
