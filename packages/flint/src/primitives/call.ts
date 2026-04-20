import type { NormalizedRequest, ProviderAdapter } from '../adapter.ts';
import type { Budget } from '../budget.ts';
import type { Transform } from '../compress.ts';
import { NotImplementedError } from '../errors.ts';
import type { Logger, Message, Result, StandardSchemaV1, StopReason, Usage } from '../types.ts';

export type CallOptions = Omit<NormalizedRequest, 'signal'> & {
  adapter: ProviderAdapter;
  budget?: Budget;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};

export type CallOutput<T = unknown> = {
  message: Message & { role: 'assistant' };
  value?: T;
  usage: Usage;
  cost?: number;
  stopReason: StopReason;
};

export async function call<T = unknown>(_options: CallOptions): Promise<Result<CallOutput<T>>> {
  throw new NotImplementedError('primitives.call');
}
