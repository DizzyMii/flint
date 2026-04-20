import type { NormalizedRequest, ProviderAdapter } from '../adapter.ts';
import type { Budget } from '../budget.ts';
import type { Transform } from '../compress.ts';
import { NotImplementedError } from '../errors.ts';
import type { Logger, StreamChunk } from '../types.ts';

export type StreamOptions = Omit<NormalizedRequest, 'signal'> & {
  adapter: ProviderAdapter;
  budget?: Budget;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};

export async function* stream(_options: StreamOptions): AsyncIterable<StreamChunk> {
  // biome-ignore lint/correctness/useYield: stub throws before yield
  throw new NotImplementedError('primitives.stream');
}
