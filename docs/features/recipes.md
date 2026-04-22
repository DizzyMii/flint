# Recipes

High-level agent patterns built on `agent()` and `call()`.

Recipes are pre-composed workflows for common LLM tasks. Each is a standalone async function — import only what you need.

## Importing

```ts
import { react, retryValidate, reflect, summarize } from 'flint/recipes';
```

---

## `react()`

Run a ReAct (Reason + Act) agent loop. The model thinks step-by-step, calls tools when needed, and stops when it produces a final answer with no tool calls.

### Signature

```ts
function react(opts: ReactOptions): Promise<Result<AgentOutput>>

type ReactOptions = {
  adapter: ProviderAdapter;
  model: string;
  question: string;
  tools: Tool[];
  budget: Budget;
  maxSteps?: number;
};
```

| Option | Type | Required | Description |
|---|---|---|---|
| `adapter` | `ProviderAdapter` | Yes | LLM provider adapter |
| `model` | `string` | Yes | Model identifier |
| `question` | `string` | Yes | The user's question |
| `tools` | `Tool[]` | Yes | Tools the agent can call |
| `budget` | `Budget` | Yes | Hard cap on steps, tokens, or dollars |
| `maxSteps` | `number` | No | Additional step cap |

### Example

```ts
import { tool } from 'flint';
import { budget } from 'flint/budget';
import { react } from 'flint/recipes';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import * as v from 'valibot';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

const search = tool({
  name: 'search',
  description: 'Search the web for information',
  input: v.object({ query: v.string() }),
  handler: async ({ query }) => `Results for: ${query}`,
});

const res = await react({
  adapter,
  model: 'claude-opus-4-7',
  question: 'What is the population of Tokyo?',
  tools: [search],
  budget: budget({ maxSteps: 8, maxDollars: 0.25 }),
});

if (res.ok) {
  console.log(res.value.message.content);
}
```

---

## `retryValidate()`

Call the model and validate structured output against a schema, automatically retrying with corrective feedback on validation failures.

### Signature

```ts
function retryValidate<T>(options: RetryValidateOptions<T>): Promise<Result<T>>

type RetryValidateOptions<T> = {
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  schema: StandardSchemaV1<unknown, T>;
  maxAttempts: number;
};
```

| Option | Type | Required | Description |
|---|---|---|---|
| `adapter` | `ProviderAdapter` | Yes | LLM provider adapter |
| `model` | `string` | Yes | Model identifier |
| `messages` | `Message[]` | Yes | Initial conversation history |
| `schema` | `StandardSchemaV1<unknown, T>` | Yes | Schema to validate the response against |
| `maxAttempts` | `number` | Yes | Max number of attempts before giving up |

On each failed attempt, the error message is appended to the conversation and the model is asked to correct its output. Retries only happen for `validation.failed` and `parse.response_json` errors — other errors (e.g. network failures) return immediately.

### Example

```ts
import { retryValidate } from 'flint/recipes';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import * as v from 'valibot';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

const PersonSchema = v.object({
  name: v.string(),
  age: v.number(),
  city: v.string(),
});

const res = await retryValidate({
  adapter,
  model: 'claude-opus-4-7',
  messages: [
    {
      role: 'user',
      content: 'Extract the person info: "Alice, 30, from Paris"',
    },
  ],
  schema: PersonSchema,
  maxAttempts: 3,
});

if (res.ok) {
  console.log(res.value); // { name: 'Alice', age: 30, city: 'Paris' }
}
```

---

## `reflect()`

Generate text with iterative self-critique. The model drafts a response, a critic function evaluates it, and the model revises based on the critique — up to `maxRevisions` times.

### Signature

```ts
function reflect(opts: ReflectOptions): Promise<Result<string>>

type Critique = { ok: boolean; critique: string };

type ReflectOptions = {
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  critic: (draft: string) => Promise<Critique>;
  maxRevisions: number;
};
```

| Option | Type | Required | Description |
|---|---|---|---|
| `adapter` | `ProviderAdapter` | Yes | LLM provider adapter |
| `model` | `string` | Yes | Model identifier |
| `messages` | `Message[]` | Yes | Initial conversation (task prompt) |
| `critic` | `(draft: string) => Promise<Critique>` | Yes | Function that evaluates a draft; return `{ ok: true }` to accept |
| `maxRevisions` | `number` | Yes | Max number of revision rounds |

If the critic returns `{ ok: true }` at any point, the current draft is returned immediately. If `maxRevisions` is exhausted without the critic approving, the last draft is still returned as `{ ok: true, value: lastDraft }`.

### Example

```ts
import { reflect } from 'flint/recipes';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

const res = await reflect({
  adapter,
  model: 'claude-opus-4-7',
  messages: [
    {
      role: 'user',
      content: 'Write a haiku about the ocean.',
    },
  ],
  critic: async (draft) => {
    const hasSeasonWord = /spring|summer|autumn|winter|snow|bloom|heat/i.test(draft);
    return hasSeasonWord
      ? { ok: true, critique: '' }
      : { ok: false, critique: 'A haiku should include a seasonal reference (kigo).' };
  },
  maxRevisions: 3,
});

if (res.ok) {
  console.log(res.value);
}
```

---

## `summarize()`

Summarize long text using a map-reduce approach. The text is split into chunks, each chunk is summarized individually, and then the chunk summaries are combined into a single overall summary.

### Signature

```ts
function summarize(opts: SummarizeOptions): Promise<Result<string>>

type SummarizeOptions = {
  adapter: ProviderAdapter;
  model: string;
  text: string;
  chunkSize: number;
};
```

| Option | Type | Required | Description |
|---|---|---|---|
| `adapter` | `ProviderAdapter` | Yes | LLM provider adapter |
| `model` | `string` | Yes | Model identifier |
| `text` | `string` | Yes | Text to summarize |
| `chunkSize` | `number` | Yes | Characters per chunk |

If the text fits in a single chunk, only one call is made. If the text is empty, `{ ok: true, value: '' }` is returned without any LLM calls.

### Example

```ts
import { summarize } from 'flint/recipes';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

const longText = '...'; // a multi-page document

const res = await summarize({
  adapter,
  model: 'claude-opus-4-7',
  text: longText,
  chunkSize: 4000,
});

if (res.ok) {
  console.log(res.value); // concise summary
}
```

---

## react() options

```ts
function react(options: {
  adapter: ProviderAdapter;
  model: string;
  tools: Tool[];
  budget: Budget;
  systemPrompt?: string;
}): (question: string) => Promise<Result<string>>
```

`react()` returns a function. Call it with a question to run the ReAct (Reason + Act) loop.

## retryValidate() options

```ts
function retryValidate<T>(options: {
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  schema: StandardSchemaV1<unknown, T>;
  budget: Budget;
  maxRetries?: number; // default: 3
}): Promise<Result<T>>
```

On validation failure, sends the validation error back to the model and retries. Useful when structured output requires a few attempts.

## reflect() options

```ts
function reflect(options: {
  adapter: ProviderAdapter;
  model: string;
  response: string;
  instruction?: string;  // default: "Review and improve the response"
  budget: Budget;
}): Promise<Result<string>>
```

Sends the response back to the model with a reflection prompt. Returns the improved version.

## See also

- [agent()](/primitives/agent) — the agentic loop recipes are built on
- [call()](/primitives/call) — single-step LLM call used by `retryValidate`, `reflect`, and `summarize`
- [tool()](/primitives/tool) — define tools for `react()`
- [Budget](/features/budget) — control cost and step limits
- [Safety](/features/safety) — inject safety checks into tool calls
- [Examples: ReAct Pattern](/examples/react-pattern)
