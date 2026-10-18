// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { gmailAdapter } from '../../src/adapters/gmail';
import { outlookAdapter } from '../../src/adapters/outlook';
import type { AttachmentRef } from '../../src/shared/types';

const gmailDom = `
<div role="list" aria-label="Attachments">
  <div role="listitem" class="aQH" data-message-id="1">
    <span class="aZh" title="q3-report.pdf">q3-report.pdf</span>
    <div role="button" aria-label="Download q3-report.pdf" tabindex="0"></div>
    <a href="/attachments/q3-report.pdf">Download</a>
  </div>
  <div role="listitem" class="aQH" data-message-id="2">
    <span class="aZh" title="scanned.pdf">scanned.pdf</span>
    <div role="button" aria-label="Download scanned.pdf" tabindex="0"></div>
    <a href="/attachments/scanned.pdf">Download</a>
  </div>
  <div role="listitem">
    <div role="button" aria-label="Download">Download</div>
    <a href="/attachments/missing-name.pdf">Download</a>
  </div>
</div>
<div role="button" aria-label="Attach files"></div>
`;

const outlookDom = `
<div role="list" aria-label="Attachments">
  <div role="listitem" aria-label="Attachment contract.docx">
    <span class="fileName" title="contract.docx">contract.docx</span>
    <button role="button" aria-label="Download contract.docx"></button>
    <a href="/attachments/contract.docx">Download</a>
  </div>
  <div role="listitem" aria-label="Attachment notes.txt">
    <span class="fileName" title="notes.txt">notes.txt</span>
    <button role="button" aria-label="Download notes.txt"></button>
    <a href="/attachments/notes.txt">Download</a>
  </div>
</div>
<button role="button" aria-label="New message"></button>
`;

function toRefs(refs: AttachmentRef[]): Array<Pick<AttachmentRef, 'fileName' | 'url' | 'id'>> {
  return refs.map((r) => ({ fileName: r.fileName, url: r.url, id: r.id }));
}

describe('gmailAdapter', () => {
  it('detects attachment cards with filenames and URLs', () => {
    const refs = gmailAdapter.findAttachments(new DOMParser().parseFromString(gmailDom, 'text/html').body);
    expect(refs.length).toBe(2);
    const first = toRefs(refs)[0];
    expect(first.fileName).toBe('q3-report.pdf');
    expect(first.url?.endsWith('/attachments/q3-report.pdf')).toBe(true);
  });

  it('does not treat unrelated buttons as attachments', () => {
    const refs = gmailAdapter.findAttachments(new DOMParser().parseFromString(gmailDom, 'text/html').body);
    const attachButton = refs.find((r) => r.fileName === 'Attach files');
    expect(attachButton).toBeUndefined();
  });

  it('deduplicates the same attachment', () => {
    const doubled = `${gmailDom}`;
    const refs = gmailAdapter.findAttachments(new DOMParser().parseFromString(doubled, 'text/html').body);
    expect(refs.filter((r) => r.fileName === 'q3-report.pdf')).toHaveLength(1);
  });
});

describe('outlookAdapter', () => {
  it('detects attachment cards with filenames and URLs', () => {
    const refs = outlookAdapter.findAttachments(new DOMParser().parseFromString(outlookDom, 'text/html').body);
    expect(refs.length).toBe(2);
    const names = refs.map((r) => r.fileName).sort();
    expect(names).toEqual(['contract.docx', 'notes.txt']);
    expect(refs[0].url?.endsWith('/attachments/contract.docx')).toBe(true);
  });

  it('ignores unrelated buttons', () => {
    const refs = outlookAdapter.findAttachments(new DOMParser().parseFromString(outlookDom, 'text/html').body);
    expect(refs.find((r) => r.fileName === 'New message')).toBeUndefined();
  });
});
