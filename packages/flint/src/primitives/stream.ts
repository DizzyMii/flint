import type { ProviderAdapter, NormalizedRequest } from '../adapter.ts';
import type { Transform } from '../compress.ts';
import type { Budget } from '../budget.ts';
import { NotImplementedError } from '../errors.ts';
import type { Logger, StreamChunk } from '../types.ts';

export type StreamOptions = Omit<NormalizedRequest, 'signal'> & {
  adapter: ProviderAdapter;
  budget?: Budget;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};

export async function* stream(
  _options: StreamOptions,
): AsyncIterable<StreamChunk> {
  throw new NotImplementedError('primitives.stream');
}
