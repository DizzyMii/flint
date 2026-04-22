# stream()

Send a request to an LLM and receive chunks as they arrive via `AsyncIterable<StreamChunk>`.

`stream()` is the streaming counterpart to `call()`. It passes each chunk through as it arrives from the adapter, consuming budget on the `usage` chunk.

## Signature

```ts
function stream(options: StreamOptions): AsyncIterable<StreamChunk>
```

## StreamOptions

```ts
type StreamOptions = {
  // Required
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];

  // Optional
  budget?: Budget;
  compress?: Transform;
  tools?: Tool[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  cache?: 'auto' | 'off';
  logger?: Logger;
  signal?: AbortSignal;
};
```

Same options as `call()` except `schema` is not available (parse the assembled text yourself after streaming).

## StreamChunk

```ts
type StreamChunk =
  | { type: 'text';     delta: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'usage';    usage: Usage; cost?: number }
  | { type: 'end';      reason: StopReason };
```

| Chunk type | When it appears | What to do |
|---|---|---|
| `text` | As text tokens arrive | Append `delta` to your buffer |
| `tool_call` | When the model calls a tool | Queue the call for execution |
| `usage` | Once, at end of response | Update budget, log telemetry |
| `end` | Final chunk | Check `reason` — `'end'`, `'tool_call'`, `'max_tokens'`, `'stop_sequence'` |

## Return value

`AsyncIterable<StreamChunk>` — iterate with `for await`. Throws `TypeError` if required options are missing.

## Example

```ts
import { stream } from 'flint';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

let text = '';

for await (const chunk of stream({
  adapter,
  model: 'claude-opus-4-7',
  messages: [{ role: 'user', content: 'Write a haiku about TypeScript.' }],
})) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.delta);
    text += chunk.delta;
  }
  if (chunk.type === 'usage') {
    console.log('\nTokens:', chunk.usage);
  }
}
```

## StreamOptions reference

```ts
type StreamOptions = {
  // Required
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];

  // Same optional fields as CallOptions
  tools?: Tool[];
  schema?: StandardSchemaV1;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  cache?: CacheControl;
  budget?: Budget;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};
```

## StreamChunk variants

```ts
type StreamChunk =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'usage'; usage: Usage; cost?: number }
  | { type: 'end'; reason: StopReason };
```

| Chunk type | When emitted | Key fields |
|------------|-------------|-----------|
| `text` | Each text token | `delta` — the new text fragment |
| `tool_call` | When model calls a tool | `call` — `{ id, name, arguments }` |
| `usage` | After generation completes | `usage` — `{ input, output, cached? }`, `cost?` |
| `end` | Last chunk | `reason` — why generation stopped |

## Accumulating chunks into a full response

```ts
let fullText = '';
const toolCalls: ToolCall[] = [];
let usage: Usage = { input: 0, output: 0 };

for await (const chunk of stream({ adapter, model, messages })) {
  if (chunk.type === 'text') fullText += chunk.delta;
  if (chunk.type === 'tool_call') toolCalls.push(chunk.call);
  if (chunk.type === 'usage') usage = chunk.usage;
  if (chunk.type === 'end') console.log('Stop reason:', chunk.reason);
}
```

## Cancellation with AbortSignal

```ts
const controller = new AbortController();

// Cancel after 10 seconds
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  for await (const chunk of stream({ adapter, model, messages, signal: controller.signal })) {
    if (chunk.type === 'text') process.stdout.write(chunk.delta);
  }
} finally {
  clearTimeout(timeout);
}
```

## Budget consumption

Each `usage` chunk triggers `budget.consume()`. If the budget is exhausted during streaming, the generator throws `BudgetExhausted` on the next iteration.

```ts
const b = budget({ maxTokens: 1000 });
try {
  for await (const chunk of stream({ adapter, model, messages, budget: b })) {
    if (chunk.type === 'text') process.stdout.write(chunk.delta);
  }
} catch (err) {
  if (err instanceof BudgetExhausted) {
    console.log('Token limit reached mid-stream');
  }
}
```

Note: `stream()` throws rather than returning `Result<T>` because it's an async generator. Use try/catch for error handling.

## See also

- [call()](/primitives/call) — non-streaming variant
- [Budget](/features/budget) — token limits
- [Error Types](/reference/errors) — AdapterError, BudgetExhausted
