import type { ProviderAdapter } from './adapter.ts';
import { agent } from './agent.ts';
import type { AgentOutput } from './agent.ts';
import type { Budget } from './budget.ts';
import { FlintError } from './errors.ts';
import { call } from './primitives/call.ts';
import { chunk } from './rag.ts';
import type { Message, Result, StandardSchemaV1, Tool } from './types.ts';

export type ReactOptions = {
  adapter: ProviderAdapter;
  model: string;
  question: string;
  tools: Tool[];
  budget: Budget;
  maxSteps?: number;
};

const REACT_SYSTEM =
  'You are a ReAct agent. Think step by step. Use tools when needed. When you have the final answer, respond without calling tools.';

export async function react(opts: ReactOptions): Promise<Result<AgentOutput>> {
  const { adapter, model, question, tools, budget, maxSteps } = opts;
  const messages: Message[] = [
    { role: 'system', content: REACT_SYSTEM },
    { role: 'user', content: question },
  ];
  return agent({
    adapter,
    model,
    messages,
    tools,
    budget,
    ...(maxSteps !== undefined ? { maxSteps } : {}),
  });
}

export type RetryValidateOptions<T> = {
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  schema: StandardSchemaV1<unknown, T>;
  maxAttempts: number;
};

export async function retryValidate<T>(options: RetryValidateOptions<T>): Promise<Result<T>> {
  const { adapter, model, schema, maxAttempts } = options;
  const convo: Message[] = [...options.messages];
  let lastRes: Result<T> | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await call({ adapter, model, messages: convo, schema });

    if (res.ok && res.value.value !== undefined) {
      return { ok: true, value: res.value.value };
    }

    if (!res.ok) {
      const err = res.error;
      const code = err instanceof FlintError ? err.code : '';
      if (code === 'validation.failed' || code === 'parse.response_json') {
        const assistantMsg = convo[convo.length - 1];
        if (assistantMsg?.role === 'assistant') convo.push(assistantMsg);
        convo.push({
          role: 'user',
          content: `Your previous response failed validation: ${err.message}. Please correct it and respond with valid output.`,
        });
        lastRes = { ok: false, error: err } as Result<T>;
        continue;
      }
      return { ok: false, error: err } as Result<T>;
    }

    // res.ok but no value — tool-call response
    convo.push(res.value.message);
    convo.push({
      role: 'user',
      content: 'You must produce a direct response matching the schema, not call tools.',
    });
    lastRes = undefined;
  }

  return lastRes ?? { ok: false, error: new Error('retryValidate: maxAttempts exhausted') as never };
}

export type Critique = { ok: boolean; critique: string };
export type ReflectOptions = {
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  critic: (draft: string) => Promise<Critique>;
  maxRevisions: number;
};

export async function reflect(opts: ReflectOptions): Promise<Result<string>> {
  const { adapter, model, critic, maxRevisions } = opts;
  const convo: Message[] = [...opts.messages];
  let lastDraft = '';

  for (let i = 0; i <= maxRevisions; i++) {
    const res = await call({ adapter, model, messages: convo });
    if (!res.ok) return res;

    lastDraft = res.value.message.content;
    const crit = await critic(lastDraft);
    if (crit.ok) return { ok: true, value: lastDraft };

    convo.push(res.value.message);
    convo.push({ role: 'user', content: `Critique: ${crit.critique}. Please revise.` });
  }

  return { ok: true, value: lastDraft };
}

export type SummarizeOptions = {
  adapter: ProviderAdapter;
  model: string;
  text: string;
  chunkSize: number;
};

export async function summarize(opts: SummarizeOptions): Promise<Result<string>> {
  const { adapter, model, text, chunkSize } = opts;
  const chunks = chunk(text, { size: chunkSize });

  if (chunks.length === 0) return { ok: true, value: '' };

  const summaries: string[] = [];
  for (const c of chunks) {
    const res = await call({
      adapter,
      model,
      messages: [{ role: 'user', content: `Summarize the following text concisely, preserving key facts:\n\n${c}` }],
    });
    if (!res.ok) return res;
    summaries.push(res.value.message.content);
  }

  if (chunks.length === 1) return { ok: true, value: summaries[0] as string };

  const combineRes = await call({
    adapter,
    model,
    messages: [{ role: 'user', content: `Combine these chunk summaries into one concise overall summary:\n\n${summaries.join('\n\n---\n\n')}` }],
  });
  if (!combineRes.ok) return combineRes;
  return { ok: true, value: combineRes.value.message.content };
}
