import type { HostAdapter } from './types';
import { gmailAdapter } from './gmail';
import { outlookAdapter } from './outlook';
import { genericAdapter } from './generic';
import { HOSTS } from '../shared/constants';

export function adapterForHost(hostname: string): HostAdapter {
  if (hostname.endsWith(HOSTS.gmail)) return gmailAdapter;
  if (hostname.endsWith(HOSTS.outlookOffice) || hostname.endsWith(HOSTS.outlookLive)) return outlookAdapter;
  return genericAdapter;
}

export { gmailAdapter, outlookAdapter };
export type { HostAdapter };
