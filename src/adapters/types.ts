import type { AttachmentRef } from '../shared/types';

export interface HostAdapter {
  readonly name: string;
  findAttachments(root: ParentNode): AttachmentRef[];
}
