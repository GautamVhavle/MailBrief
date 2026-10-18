import type { AttachmentRef } from '../shared/types';
import type { HostAdapter } from './types';

const DOWNLOAD_ARIA = /download|save (this|the) file/i;
const ATTACHMENT_ARIA = /attachment/i;

const CONTAINER_CANDIDATES = '[role="listitem"], .aQH, [class*="attachment" i], [data-message-id]';

function stripDownloadPrefix(label: string): string {
  return label.replace(/^download:?\s*/i, '').replace(/\s*\([^)]*kb\)\s*$/i, '').trim();
}

function labelFromAria(aria: string): string | null {
  if (DOWNLOAD_ARIA.test(aria)) return stripDownloadPrefix(aria);
  return null;
}

function filenameFromTitle(root: Element): string | null {
  const titled = root.querySelector('[title]');
  const title = titled?.getAttribute('title') ?? '';
  return title && title !== 'null' ? title.trim() : null;
}

function filenameFromText(root: Element): string | null {
  const candidate = root.querySelector('span.aZh, [class*="filename" i], [class*="file-name" i]');
  const text = candidate?.textContent?.trim();
  if (text && text.length < 200) return text;
  const direct = Array.from(root.querySelectorAll('span,div'))
    .map((el) => el.textContent?.trim() ?? '')
    .find((t) => t.length > 0 && t.length < 200 && !DOWNLOAD_ARIA.test(t) && !ATTACHMENT_ARIA.test(t));
  return direct ?? null;
}

function resolveDownloadUrl(root: Element): string | null {
  for (const link of Array.from(root.querySelectorAll('a[href]'))) {
    const href = link.getAttribute('href') ?? '';
    if (!href || href.startsWith('javascript:') || href === '#') continue;
    try {
      const resolved = new URL(href, window.location.origin);
      return resolved.href;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function containerFor(candidate: Element): Element {
  const closest = candidate.closest(CONTAINER_CANDIDATES);
  if (closest) return closest;
  let el: Element | null = candidate.parentElement;
  let depth = 0;
  while (el && depth < 4) {
    if (el.querySelector('[role="button"], a[href]')) return el;
    el = el.parentElement;
    depth += 1;
  }
  return candidate.parentElement ?? candidate;
}

function collectFromContainer(container: Element): AttachmentRef | null {
  const button = container.querySelector('[role="button"], [role="link"]');
  const aria = (button?.getAttribute('aria-label') ?? '') || '';
  let fileName = labelFromAria(aria) ?? filenameFromTitle(container) ?? filenameFromText(container);

  const downloadLink = container.querySelector('a[href]');
  const downloadLabel = (downloadLink?.getAttribute('aria-label') ?? '') || (downloadLink?.textContent?.trim() ?? '');
  if (!fileName && DOWNLOAD_ARIA.test(downloadLabel)) fileName = stripDownloadPrefix(downloadLabel);
  if (!fileName) {
    const img = container.querySelector('img[alt]');
    const alt = img?.getAttribute('alt') ?? '';
    if (alt && alt.length < 200) fileName = alt;
  }
  if (!fileName) return null;

  const url = resolveDownloadUrl(container);
  const mimeType = guessMimeType(fileName);
  const id = `${fileName}|${url ?? 'no-url'}`;
  return { id, fileName, mimeType, url, container: container as HTMLElement };
}

export const gmailAdapter: HostAdapter = {
  name: 'gmail',

  findAttachments(root: ParentNode): AttachmentRef[] {
    const refs: AttachmentRef[] = [];
    const seen = new Set<string>();

    const buttons = root.querySelectorAll('[role="button"][aria-label], [role="link"][aria-label]');
    for (const el of Array.from(buttons)) {
      const aria = el.getAttribute('aria-label') ?? '';
      const isAttachmentAction = DOWNLOAD_ARIA.test(aria) || ATTACHMENT_ARIA.test(aria);
      if (!isAttachmentAction) continue;
      const container = containerFor(el);
      const ref = collectFromContainer(container);
      if (ref && !seen.has(ref.id)) {
        seen.add(ref.id);
        refs.push(ref);
      }
    }

    for (const link of Array.from(root.querySelectorAll('a[href]'))) {
      const href = link.getAttribute('href') ?? '';
      try {
        const resolved = new URL(href, window.location.origin);
        if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') continue;
      } catch {
        continue;
      }
      const container = containerFor(link);
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
