import type { ProviderAdapter } from '../adapter.ts';
import { NotImplementedError } from '../errors.ts';
import type { Message } from '../types.ts';

export function count(
  _messages: Message[],
  _model: string,
  _adapter?: ProviderAdapter,
): number {
  throw new NotImplementedError('primitives.count');
}
