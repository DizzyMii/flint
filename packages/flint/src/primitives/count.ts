import type { ProviderAdapter } from '../adapter.ts';
import type { Message } from '../types.ts';
import { approxCount } from './approx-count.ts';

export function count(messages: Message[], model: string, adapter?: ProviderAdapter): number {
  if (adapter?.count) {
    return adapter.count(messages, model);
  }
  return approxCount(messages);
}
