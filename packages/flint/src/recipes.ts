import type { ProviderAdapter } from './adapter.ts';
import type { AgentOutput } from './agent.ts';
import type { Budget } from './budget.ts';
import { NotImplementedError } from './errors.ts';
import type { Message, Result, StandardSchemaV1, Tool } from './types.ts';

export type ReactOptions = {
  adapter: ProviderAdapter;
  model: string;
  question: string;
  tools: Tool[];
  budget: Budget;
  maxSteps?: number;
};
export async function react(_opts: ReactOptions): Promise<Result<AgentOutput>> {
  throw new NotImplementedError('recipes.react');
}

export type RetryValidateOptions<T> = {
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  schema: StandardSchemaV1<unknown, T>;
  maxAttempts: number;
};
export async function retryValidate<T>(_opts: RetryValidateOptions<T>): Promise<Result<T>> {
  throw new NotImplementedError('recipes.retryValidate');
}

export type Critique = { ok: boolean; critique: string };
export type ReflectOptions = {
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  critic: (draft: string) => Promise<Critique>;
  maxRevisions: number;
};
export async function reflect(_opts: ReflectOptions): Promise<Result<string>> {
  throw new NotImplementedError('recipes.reflect');
}

export type SummarizeOptions = {
  adapter: ProviderAdapter;
  model: string;
  text: string;
  chunkSize: number;
};
export async function summarize(_opts: SummarizeOptions): Promise<Result<string>> {
  throw new NotImplementedError('recipes.summarize');
}
