import type { AttachmentRef } from '../shared/types';
import type { HostAdapter } from './types';

const ATTACHMENT_ARIA = /attach|download/i;
const OUTLOOK_ATTACHMENT_HREF = /(attachmentId|\/attachments\/|GetFileAttachment|attachment\.aspx)/i;

const CONTAINER_CANDIDATES = '[role="listitem"], [class*="attachment" i], [data-convid], section';

function labelToFilename(label: string): string | null {
  const cleaned = label
    .replace(/^(download|save|open|preview|remove|delete|attachment|file):?\s*/i, '')
    .replace(/^(attachment|file)\s+/i, '')
    .replace(/\s*(attachment|file)\s*$/i, '')
    .replace(/\s*\(\s*[\d.]+\s*(kb|mb|gb)\s*\)\s*$/i, '')
    .trim();
  return cleaned.length > 0 && cleaned.length < 200 ? cleaned : null;
}

function filenameFromElement(root: Element): string | null {
  const candidates = root.querySelectorAll(
    '[class*="fileName" i], [class*="file-name" i], span[title], [aria-label]'
  );
  for (const el of Array.from(candidates)) {
    const title = el.getAttribute('title');
    if (title && title.length > 0 && title.length < 200) return title;
    const aria = el.getAttribute('aria-label') ?? '';
    const fromAria = labelToFilename(aria);
    if (fromAria) return fromAria;
  }
  const texts = Array.from(root.querySelectorAll('span, div'))
    .map((el) => el.textContent?.trim() ?? '')
    .filter((t) => t.length > 0 && t.length < 200 && !ATTACHMENT_ARIA.test(t));
  return texts[0] ?? null;
}

function resolveDownloadUrl(root: Element): string | null {
  for (const link of Array.from(root.querySelectorAll('a[href]'))) {
    const href = link.getAttribute('href') ?? '';
    if (!href || href.startsWith('javascript:') || href === '#') continue;
    try {
      const resolved = new URL(href, window.location.origin);
      if (OUTLOOK_ATTACHMENT_HREF.test(resolved.href)) return resolved.href;
    } catch {
      /* ignore */
    }
  }
  const button = root.querySelector('[role="button"][aria-href]');
  const href = button?.getAttribute('aria-href') ?? '';
  if (href && !href.startsWith('javascript:') && href !== '#') {
    try {
      return new URL(href, window.location.origin).href;
    } catch {
      return null;
    }
  }
  return null;
}

function containerFor(candidate: Element): Element {
  const closest = candidate.closest(CONTAINER_CANDIDATES);
  if (closest) return closest;
  let el: Element | null = candidate.parentElement;
  let depth = 0;
  while (el && depth < 5) {
    if (el.querySelector('[role="button"], a[href], [role="listitem"]')) return el;
    el = el.parentElement;
    depth += 1;
  }
  return candidate.parentElement ?? candidate;
}

function collectFromContainer(container: Element): AttachmentRef | null {
  const aria =
    (container.getAttribute('aria-label') ?? '') ||
    (container.querySelector('[role="button"]')?.getAttribute('aria-label') ?? '');
  const fileName = labelToFilename(aria) ?? filenameFromElement(container);
  if (!fileName) return null;

  const url = resolveDownloadUrl(container);
  const id = `${fileName}|${url ?? 'no-url'}`;
  return { id, fileName, mimeType: guessMimeType(fileName), url, container: container as HTMLElement };
}

export const outlookAdapter: HostAdapter = {
  name: 'outlook',

  findAttachments(root: ParentNode): AttachmentRef[] {
    const refs: AttachmentRef[] = [];
    const seen = new Set<string>();

    const elements = root.querySelectorAll('[role="button"][aria-label], [role="listitem"][aria-label], a[href]');
    for (const el of Array.from(elements)) {
      const aria = el.getAttribute('aria-label') ?? '';
      const href = el.getAttribute('href') ?? '';
      const matches = ATTACHMENT_ARIA.test(aria) || OUTLOOK_ATTACHMENT_HREF.test(href);
      if (!matches) continue;
      const container = containerFor(el);
      const ref = collectFromContainer(container);
      if (ref && !seen.has(ref.id)) {
        seen.add(ref.id);
        refs.push(ref);
      }
    }

    return refs;
  },
};

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}
