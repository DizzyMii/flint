# WS7: Depth Pass on Existing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand all 25 existing documentation pages with full TypeScript signatures, complete options tables, edge cases, cross-links, and "See also" sections. Every option in every options object documented — no "see source" cop-outs.

**Architecture:** Modify existing files only. No new files. Each task covers a logical group of related pages.

**Tech Stack:** VitePress markdown. All type information sourced from actual source code — types verified below.

**Verified key types:**
```ts
// call()
CallOptions = { adapter, model, messages, schema?, budget?, compress?, logger?, signal?, tools?, maxTokens?, temperature?, stopSequences?, cache? }
CallOutput = { message, value?, usage, cost?, stopReason }

// stream()
StreamOptions = { adapter, model, messages, budget?, compress?, logger?, signal?, tools?, schema?, maxTokens?, temperature?, stopSequences?, cache? }
StreamChunk = { type: 'text', delta } | { type: 'tool_call', call } | { type: 'usage', usage, cost? } | { type: 'end', reason }

// tool()
ToolSpec = { name, description, input, handler, permissions?, timeout?, jsonSchema? }
ToolPermissions = { destructive?, scopes?, network?, filesystem?, requireApproval? }

// execute()
execute(tool, rawInput) — validates input then runs handler with optional timeout

// count()
count(messages, model, adapter?) — uses adapter.count if available, else approxCount heuristic

// agent()
AgentOptions = { adapter, model, messages, tools?, budget, maxSteps?, onStep?, compress?, logger?, signal? }
AgentOutput = { message, steps, usage, cost }
Step = { messagesSent, assistant, toolCalls, toolResults, usage, cost? }

// budget()
BudgetLimits = { maxSteps?, maxTokens?, maxDollars? }
Budget = { limits, consume(x), assertNotExhausted(), remaining() }
```

---

### Task 1: Expand docs/primitives/call.md

**Files:**
- Modify: `docs/primitives/call.md`

- [ ] **Step 1: Read the current file**

Read `docs/primitives/call.md` to understand what's already there.

- [ ] **Step 2: Add full CallOptions table after the existing options section**

Find the section that documents call options and expand it. Append the following after the existing content (before any "See also" section, or at end of file):

```markdown
## CallOptions reference

```ts
type CallOptions<T = unknown> = {
  // Required
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];

  // Output schema — forces JSON response and validates against schema
  schema?: StandardSchemaV1<unknown, T>;

  // LLM call parameters
  tools?: Tool[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  cache?: CacheControl;

  // Flint features
  budget?: Budget;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `adapter` | `ProviderAdapter` | required | The LLM provider adapter |
| `model` | `string` | required | Model identifier (e.g. `'claude-opus-4-7'`) |
| `messages` | `Message[]` | required | Conversation history |
| `schema` | `StandardSchemaV1` | — | Validates response as JSON against schema. Sets `output.value` on success. |
| `tools` | `Tool[]` | — | Tools available for this call |
| `maxTokens` | `number` | — | Max output tokens (provider default if unset) |
| `temperature` | `number` | — | Sampling temperature 0-1 |
| `stopSequences` | `string[]` | — | Stop generation when any sequence is encountered |
| `cache` | `CacheControl` | — | Explicit cache control (adapter-specific) |
| `budget` | `Budget` | — | Budget to consume for this call |
| `compress` | `Transform` | — | Message transform applied before sending |
| `logger` | `Logger` | — | Receives debug/info/warn/error log entries |
| `signal` | `AbortSignal` | — | Cancels the request when aborted |

## CallOutput reference

```ts
type CallOutput<T = unknown> = {
  message: Message & { role: 'assistant' };
  value?: T;           // populated when schema is set and validation passes
  usage: Usage;        // { input, output, cached? } token counts
  cost?: number;       // USD cost (populated if adapter reports it)
  stopReason: StopReason; // 'end' | 'tool_call' | 'max_tokens' | 'stop_sequence'
};
```

## StopReason values

| Value | Meaning |
|-------|---------|
| `'end'` | Model finished naturally |
| `'tool_call'` | Model wants to call a tool — check `message.toolCalls` |
| `'max_tokens'` | Hit `maxTokens` limit or provider max |
| `'stop_sequence'` | Hit one of `stopSequences` |

## Schema validation

When `schema` is set, `call()`:
1. Expects the model response to be valid JSON
2. Parses the JSON
3. Validates against the schema
4. Returns `{ ok: false, error: ValidationError }` if validation fails, or `{ ok: false, error: ParseError }` if the response isn't JSON

```ts
import * as v from 'valibot';

const res = await call({
  adapter,
  model: 'claude-opus-4-7',
  messages: [{ role: 'user', content: 'Return JSON: { "score": 0-10 }' }],
  schema: v.object({ score: v.number() }),
});

if (res.ok) {
  console.log(res.value.value?.score); // typed as number
}
```

::: warning Schema validation applies after tool calls
If `stopReason === 'tool_call'`, schema validation is skipped — the message contains tool calls, not JSON output.
:::

## Common mistakes

::: warning Don't access res.value without checking res.ok first
`res.value` is only defined when `res.ok === true`. TypeScript enforces this, but be careful with type assertions.
:::

::: tip Use compress to manage context window costs
Pass a `compress` transform to trim redundant messages before they're sent. See [Compress & Pipeline](/features/compress).
:::

## See also

- [stream()](/primitives/stream) — streaming variant
- [agent()](/primitives/agent) — multi-step tool-calling loop
- [Budget](/features/budget) — step/token/dollar limits
- [Error Types](/reference/errors) — AdapterError, ValidationError, ParseError
```

- [ ] **Step 3: Commit**

```bash
git add docs/primitives/call.md
git commit -m "docs(primitives): expand call() with full CallOptions table and edge cases"
```

---

### Task 2: Expand docs/primitives/stream.md

**Files:**
- Modify: `docs/primitives/stream.md`

- [ ] **Step 1: Read the current file**

Read `docs/primitives/stream.md`.

- [ ] **Step 2: Append expanded content**

Append to `docs/primitives/stream.md`:

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add docs/primitives/stream.md
git commit -m "docs(primitives): expand stream() with StreamChunk variants and cancellation"
```

---

### Task 3: Expand docs/primitives/tool.md and docs/primitives/execute.md

**Files:**
- Modify: `docs/primitives/tool.md`
- Modify: `docs/primitives/execute.md`

- [ ] **Step 1: Read both files**

Read `docs/primitives/tool.md` and `docs/primitives/execute.md`.

- [ ] **Step 2: Append to tool.md**

```markdown
## ToolSpec reference

```ts
type ToolSpec<Input, Output> = {
  name: string;
  description: string;
  input: StandardSchemaV1<unknown, Input>;
  handler: (input: Input) => Promise<Output> | Output;
  permissions?: ToolPermissions;
  timeout?: number;
  jsonSchema?: Record<string, unknown>;
};
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Tool name sent to the LLM. Use snake_case. Must be unique within a call. |
| `description` | `string` | Explains to the LLM when and how to use the tool |
| `input` | `StandardSchemaV1` | Input schema — Zod, Valibot, ArkType, or any Standard Schema library |
| `handler` | `function` | The implementation. Receives typed, validated input. |
| `permissions` | `ToolPermissions` | Optional permission metadata for `requireApproval()` and `permissionedTools()` |
| `timeout` | `number` | Milliseconds before `TimeoutError`. Undefined = no timeout. |
| `jsonSchema` | `Record<string, unknown>` | Override the JSON Schema sent to the provider. Use when your schema library's output needs adjustment. |

## ToolPermissions

```ts
type ToolPermissions = {
  destructive?: boolean;   // true if the tool modifies state irreversibly
  scopes?: string[];       // custom permission scope strings
  network?: boolean;       // true if the tool makes network requests
  filesystem?: boolean;    // true if the tool accesses the filesystem
  requireApproval?: boolean; // always require human approval
};
```

Permissions are metadata only — they don't restrict execution unless you use `requireApproval()` or `permissionedTools()` from the safety module.

## Handler return types

The handler can return any serializable value. The agent loop serializes it to a tool result message:

```ts
// Returning a string — used as-is
handler: () => 'success'

// Returning an object — JSON.stringify'd
handler: () => ({ count: 42, items: ['a', 'b'] })

// Returning a number
handler: ({ a, b }) => a + b

// Async handler
handler: async ({ url }) => {
  const res = await fetch(url);
  return res.text();
}
```

## jsonSchema override

When your schema library generates JSON Schema that the LLM misinterprets, override with `jsonSchema`:

```ts
const myTool = tool({
  name: 'search',
  description: 'Search for items',
  input: v.object({ query: v.string(), limit: v.optional(v.number()) }),
  handler: search,
  jsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
    },
    required: ['query'],
  },
});
```

## Common mistakes

::: warning Tool names must match across calls
The LLM sends back the tool name exactly as you defined it. If you change a tool name between steps in a multi-turn conversation, the agent won't find the tool.
:::

## See also

- [execute()](/primitives/execute) — run tool handlers directly
- [Safety](/features/safety) — requireApproval, permissionedTools
- [Error Types](/reference/errors) — ToolError, TimeoutError
```

- [ ] **Step 3: Append to execute.md**

```markdown
## execute() signature

```ts
function execute<Input, Output>(
  tool: Tool<Input, Output>,
  rawInput: unknown
): Promise<Result<Output>>
```

`execute()` does two things in order:
1. **Validates** `rawInput` against `tool.input` using `validate()`
2. **Runs** `tool.handler(parsedInput)`, optionally with a timeout

## Error cases

| Error type | Code | When |
|------------|------|------|
| `ParseError` | `'parse.tool_input'` | Input fails schema validation |
| `ToolError` | `'tool.handler_threw'` | Handler throws an exception |
| `TimeoutError` | `'tool.timeout'` | Handler exceeds `tool.timeout` ms |

```ts
const res = await execute(myTool, rawInput);
if (!res.ok) {
  if (res.error.code === 'parse.tool_input') {
    // Input was wrong type — programming error
  } else if (res.error.code === 'tool.timeout') {
    // Handler ran too long
  } else {
    // Handler threw — res.error.cause has the original exception
    console.error(res.error.cause);
  }
}
```

## Using execute() for testing

`execute()` is the cleanest way to unit test tools — no LLM involved:

```ts
// test directly
const result = await execute(calculatorTool, { expression: '2 + 2' });
expect(result.ok).toBe(true);
expect(result.value).toBe(4);

// test validation
const invalid = await execute(calculatorTool, { expression: 123 });
expect(invalid.ok).toBe(false);
expect(invalid.error.code).toBe('parse.tool_input');
```

## Difference from calling the handler directly

`execute()` vs `tool.handler(input)`:
- `execute()` validates input first (catches type errors before they reach your handler)
- `execute()` wraps handler exceptions as `Result` (no uncaught promise rejections)
- `execute()` enforces the timeout (if set)
- `execute()` returns `Result<Output>` (never throws)

Use `execute()` in tests and anywhere you're calling tools outside the agent loop.

## See also

- [tool()](/primitives/tool) — defining tools
- [Testing](/guide/testing) — testing tools with execute()
- [Error Types](/reference/errors) — ParseError, ToolError, TimeoutError
```

- [ ] **Step 4: Commit**

```bash
git add docs/primitives/tool.md docs/primitives/execute.md
git commit -m "docs(primitives): expand tool() and execute() with full field tables"
```

---

### Task 4: Expand docs/primitives/validate.md, count.md, agent.md

**Files:**
- Modify: `docs/primitives/validate.md`
- Modify: `docs/primitives/count.md`
- Modify: `docs/primitives/agent.md`

- [ ] **Step 1: Read all three files**

Read each file.

- [ ] **Step 2: Append to validate.md**

```markdown
## validate() signature

```ts
function validate<T>(
  value: unknown,
  schema: StandardSchemaV1<unknown, T>
): Promise<Result<T>>
```

## Supported schema libraries

Any library implementing [Standard Schema v1](https://standardschema.dev):

```ts
// Zod
import { z } from 'zod';
const schema = z.object({ name: z.string() });

// Valibot
import * as v from 'valibot';
const schema = v.object({ name: v.string() });

// ArkType
import { type } from 'arktype';
const schema = type({ name: 'string' });

// All work identically with validate()
const result = await validate({ name: 'Alice' }, schema);
```

## Error on failure

Returns `{ ok: false, error: ValidationError }`. The `ValidationError.cause` contains the raw schema issues:

```ts
const result = await validate(42, stringSchema);
if (!result.ok) {
  console.log(result.error.code); // 'validation.failed'
  console.log(result.error.cause); // schema-specific issues array
}
```

## Using validate() standalone

`call()` uses `validate()` internally when a `schema` option is provided. You can also use it directly for any data validation that doesn't involve the LLM:

```ts
// Validate webhook payload
const body = await request.json();
const payload = await validate(body, WebhookSchema);
if (!payload.ok) return Response.json({ error: 'Invalid payload' }, { status: 400 });
```

## See also

- [call()](/primitives/call) — schema option uses validate() internally
- [tool()](/primitives/tool) — tool input is validated with validate()
- [Error Types](/reference/errors) — ValidationError
```

- [ ] **Step 3: Append to count.md**

```markdown
## count() signature

```ts
function count(
  messages: Message[],
  model: string,
  adapter?: ProviderAdapter
): number
```

## How token counting works

1. If `adapter.count` is implemented, calls it (exact count)
2. Otherwise, falls back to `approxCount` — a heuristic based on character counts

The heuristic is intentionally fast and synchronous. It assumes ~4 characters per token — accurate enough for budget pre-checks but not billing.

## Pre-flight budget check

Use `count()` before a potentially large call to verify headroom:

```ts
import { count } from 'flint';

const tokenEstimate = count(messages, model, adapter);
const remaining = myBudget.remaining();

if (remaining.tokens !== undefined && tokenEstimate > remaining.tokens) {
  console.warn(`Estimated ${tokenEstimate} tokens but only ${remaining.tokens} remain`);
  // Compress messages or return early
}
```

## Adapter support

Not all adapters implement `count`. Check `adapter.capabilities` or pass the adapter and let `count()` fall back silently:

```ts
// Safe either way — falls back to heuristic if adapter doesn't implement count
const n = count(messages, model, adapter);
```

## See also

- [Budget](/features/budget) — how token counts affect budget
- [Compress & Pipeline](/features/compress) — reduce message size before counting
```

- [ ] **Step 4: Append to agent.md**

```markdown
## AgentOptions reference

```ts
type AgentOptions = {
  // Required
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  budget: Budget;

  // Tools — static array or dynamic function
  tools?: Tool[] | ((ctx: ToolsCtx) => Tool[] | Promise<Tool[]>);

  // Optional
  maxSteps?: number;
  onStep?: (step: Step) => void;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};

type ToolsCtx = {
  messages: Message[];  // current message history
  step: number;         // current step index (0-based)
};
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `adapter` | `ProviderAdapter` | required | LLM provider |
| `model` | `string` | required | Model identifier |
| `messages` | `Message[]` | required | Initial message history |
| `budget` | `Budget` | required | Hard caps — enforced every step |
| `tools` | `Tool[] \| fn` | — | Static array or function called each step |
| `maxSteps` | `number` | `Infinity` | Hard cap on loop iterations (in addition to budget) |
| `onStep` | `(step: Step) => void` | — | Callback after each completed step |
| `compress` | `Transform` | — | Applied to messages before each LLM call |
| `logger` | `Logger` | — | Receives log entries during execution |
| `signal` | `AbortSignal` | — | Cancels on abort |

## AgentOutput reference

```ts
type AgentOutput = {
  message: Message & { role: 'assistant' };  // final assistant message
  steps: Step[];    // all completed tool-use steps
  usage: Usage;     // aggregated across all steps + final call
  cost: number;     // aggregated USD cost
};

type Step = {
  messagesSent: Message[];             // messages sent for this step
  assistant: Message & { role: 'assistant' }; // model response
  toolCalls: ToolCall[];               // tool calls made
  toolResults: Array<Message & { role: 'tool' }>; // results returned
  usage: Usage;
  cost?: number;
};
```

## Dynamic tools

Pass a function to load different tools per step based on conversation state:

```ts
const res = await agent({
  ...
  tools: async ({ messages, step }) => {
    if (step === 0) return [searchTool]; // only search on first step
    return [searchTool, writeTool];      // add write tool after first search
  },
});
```

## onStep callback

Use `onStep` for progress reporting without modifying the agent loop:

```ts
const res = await agent({
  ...
  onStep: (step) => {
    const toolNames = step.toolCalls.map(tc => tc.name).join(', ');
    console.log(`Step ${step.toolCalls.length > 0 ? toolNames : 'final'}: ${step.usage.output} tokens`);
  },
});
```

## Stop conditions

The agent loop exits when:
1. The model returns a response with no tool calls (`stopReason !== 'tool_call'`) → `{ ok: true }`
2. `budget` is exhausted → `{ ok: false, error: BudgetExhausted }`
3. `maxSteps` is reached → `{ ok: false, error: FlintError('agent.max_steps_exceeded') }`
4. `signal` is aborted → `{ ok: false, error: AdapterError }`
5. Any `call()` returns an error → `{ ok: false, error }` (propagated)

## Multi-turn continuation

Start from a prior conversation by passing the existing message history:

```ts
const existingHistory: Message[] = [
  { role: 'user', content: 'What files are in this directory?' },
  { role: 'assistant', content: '', toolCalls: [{ id: 'tc1', name: 'list_files', arguments: {} }] },
  { role: 'tool', content: '["README.md", "package.json"]', toolCallId: 'tc1' },
  { role: 'assistant', content: 'The directory contains README.md and package.json.' },
];

const res = await agent({
  adapter,
  model: 'claude-opus-4-7',
  messages: [...existingHistory, { role: 'user', content: 'Read the README' }],
  tools: [readFileTool],
  budget: budget({ maxSteps: 5 }),
});
```

## See also

- [call()](/primitives/call) — single-step variant
- [Budget](/features/budget) — required — step/token/dollar limits
- [Compress & Pipeline](/features/compress) — `compress` option for context management
- [Testing](/guide/testing) — testing agent loops with scriptedAdapter
```

- [ ] **Step 5: Commit**

```bash
git add docs/primitives/validate.md docs/primitives/count.md docs/primitives/agent.md
git commit -m "docs(primitives): expand validate(), count(), agent() with full references"
```

---

### Task 5: Expand features pages (budget, compress, memory, rag, recipes, safety, graph)

**Files:**
- Modify: `docs/features/budget.md`
- Modify: `docs/features/compress.md`
- Modify: `docs/features/memory.md`
- Modify: `docs/features/rag.md`
- Modify: `docs/features/recipes.md`
- Modify: `docs/features/safety.md`
- Modify: `docs/features/graph.md`

- [ ] **Step 1: Read all 7 files**

Read each file to understand current content.

- [ ] **Step 2: Append to budget.md**

```markdown
## Reusing a budget across calls

The `budget` object is stateful. Pass the same instance to multiple `call()` or `agent()` calls to enforce a cumulative cap:

```ts
const sessionBudget = budget({ maxDollars: 1.00 });

// Each call consumes from the same pool
const r1 = await agent({ ..., budget: sessionBudget });
const r2 = await agent({ ..., budget: sessionBudget });

console.log('Remaining:', sessionBudget.remaining());
// → { dollars: 0.78 } (if both calls spent $0.11 and $0.11)
```

## budget() throws on invalid options

`budget()` requires at least one limit. Passing an empty object throws:

```ts
budget({}); // TypeError: budget: at least one of maxSteps, maxTokens, or maxDollars must be set
```

## Dollar cost availability

`cost` is only available in `CallOutput` / `AgentOutput` if the adapter reports it. The Anthropic adapter always reports cost. If `adapter.capabilities.cost` is false, `cost` will be `undefined` and `maxDollars` will never be exhausted.

## Common mistakes

::: warning budget is required for agent()
`agent()` requires a `budget` argument. There's no default — this is intentional. Agents without budget limits can run indefinitely.
:::

## See also

- [agent()](/primitives/agent) — uses budget for loop control
- [call()](/primitives/call) — optional budget for single calls
- [Error Types](/reference/errors) — BudgetExhausted
```

- [ ] **Step 3: Append to compress.md**

```markdown
## compress() pipeline signature

```ts
type Transform = (messages: Message[], ctx: CompressCtx) => Promise<Message[]> | Message[];
type CompressCtx = { budget?: Budget; model: string };
```

## Available transforms

| Transform | Description |
|-----------|-------------|
| `dedup()` | Remove consecutive duplicate messages |
| `windowLast(n)` | Keep only the last N messages |
| `windowFirst(n)` | Keep the first N messages (preserve system prompt) |
| `truncateToolResults(maxLen)` | Truncate tool result content to maxLen characters |
| `orderForCache()` | Re-order messages to maximize cache hits (system prompt first, stable content before dynamic) |
| `summarize(adapter, model)` | Replace old messages with an LLM-generated summary |

## pipeline() combinator

Chain multiple transforms with `pipeline()`:

```ts
import { pipeline, dedup, truncateToolResults, orderForCache } from 'flint/compress';

const compress = pipeline(
  dedup(),
  truncateToolResults(2000),
  orderForCache(),
);

const res = await call({ ..., compress });
```

Transforms run left-to-right. Each receives the output of the previous.

## orderForCache() and prompt caching

`orderForCache()` moves the system message and static tool definitions to the top of the message list, where the Anthropic adapter adds cache breakpoints. Use it when you have a large, stable system prompt.

## truncateToolResults() for large tool outputs

Large tool results (HTML pages, file contents, API responses) can fill the context window. Truncate them:

```ts
import { truncateToolResults } from 'flint/compress';

const compress = truncateToolResults(4000); // keep first 4000 chars of each tool result
```

## Common mistakes

::: warning summarize() makes an LLM call
`summarize()` sends a request to the LLM to produce the summary. It consumes tokens and costs money. Don't use it in every call — use it when the message list grows past a threshold.
:::

## See also

- [Memory](/features/memory) — higher-level memory with auto-summarization
- [call()](/primitives/call) — compress option
- [agent()](/primitives/agent) — compress option applies to every step
```

- [ ] **Step 4: Append to memory.md**

```markdown
## Which memory primitive to use

| Primitive | Use when |
|-----------|---------|
| `messages()` | You want a simple array of messages with manual management |
| `scratchpad()` | You need free-form text scratch space for the agent's working notes |
| `conversationMemory()` | You want automatic summarization for long-running conversations |

## conversationMemory() options

```ts
type ConversationMemoryOptions = {
  adapter: ProviderAdapter;
  model: string;         // model used for auto-summarization
  maxMessages: number;   // trigger summarization when history exceeds this count
  keepLast: number;      // messages to keep verbatim after summarization
};
```

## Auto-summarization trigger

Summarization happens when `memory.add()` is called and `messages().length >= maxMessages`. It:
1. Takes the oldest `messages.length - keepLast` messages
2. Calls the LLM to summarize them
3. Replaces them with a single system message containing the summary
4. Retains the last `keepLast` messages verbatim

## Thread safety

`conversationMemory()` is not thread-safe. Don't call `memory.add()` concurrently from multiple async paths.

## See also

- [Compress & Pipeline](/features/compress) — alternative context management
- [agent()](/primitives/agent) — inject memory.messages() as agent messages
- [FAQ: multi-turn conversation](/guide/faq#can-i-reuse-a-budget-across-multiple-agent-calls)
```

- [ ] **Step 5: Append to rag.md**

```markdown
## chunk() options

```ts
function chunk(text: string, options?: { size?: number; overlap?: number }): Chunk[]

type Chunk = { text: string; index: number };
```

| Option | Default | Description |
|--------|---------|-------------|
| `size` | `512` | Target chunk size in characters |
| `overlap` | `64` | Characters of overlap between adjacent chunks |

Overlap helps retrieval: a sentence split across chunks still appears in full in at least one chunk.

## EmbeddingStore interface

```ts
type EmbeddingStore = {
  add(chunks: Chunk[], embedder: (text: string) => Promise<number[]>): Promise<void>;
  query(embedding: number[], topK: number): Promise<Array<{ text: string; score: number }>>;
};
```

Implement this to use any vector database. See [FAQ: Does Flint include a vector database?](/guide/faq#does-flint-include-a-vector-database)

## retrieve() options

```ts
function retrieve(
  store: EmbeddingStore,
  query: string,
  embedder: (text: string) => Promise<number[]>,
  options?: { topK?: number }
): Promise<Array<{ text: string; score: number }>>
```

`score` is the cosine similarity — 1.0 is identical, 0.0 is orthogonal. Filter by score threshold for quality control:

```ts
const results = await retrieve(store, query, embed, { topK: 10 });
const relevant = results.filter(r => r.score > 0.7);
```

## See also

- [Example: RAG Pipeline](/examples/rag-pipeline)
- [FAQ: How does Flint handle RAG?](/guide/faq#how-does-flint-handle-rag)
```

- [ ] **Step 6: Append to recipes.md**

```markdown
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

- [agent()](/primitives/agent) — the foundation all recipes build on
- [Examples: ReAct Pattern](/examples/react-pattern)
```

- [ ] **Step 7: Append to safety.md**

```markdown
## detectInjection() signature

```ts
function detectInjection(text: string): { score: number; matches: string[] }
```

`score` is 0–1. A score > 0.5 is a likely injection attempt. `matches` lists the patterns that fired.

## redact() signature

```ts
function redact(text: string, patterns?: RegExp[]): string
```

Built-in patterns detected: API keys (Anthropic, OpenAI, AWS, GitHub formats), email addresses, credit card numbers, SSNs, private key blocks, JWT tokens. Pass custom `patterns` to extend.

## requireApproval() signature

```ts
function requireApproval(
  tools: Tool[],
  approver: (toolName: string, input: unknown) => Promise<boolean>
): Tool[]
```

Returns wrapped tools. Before each execution, calls `approver`. If it returns `false`, the tool returns `"Tool execution denied by user"`.

## permissionedTools() signature

```ts
function permissionedTools(
  tools: Tool[],
  policy: (tool: Tool) => boolean
): Tool[]
```

Filters tools by a policy function. Use with `tool.permissions` to build role-based tool access:

```ts
const userTools = permissionedTools(allTools, (t) => !t.permissions?.destructive);
```

## trustBoundary() signature

```ts
function trustBoundary(
  adapter: ProviderAdapter,
  options: { threshold?: number } // default 0.7
): ProviderAdapter
```

Returns a wrapped adapter. After each LLM response, runs `detectInjection()` on the content. If `score >= threshold`, throws `AdapterError`.

## See also

- [FAQ: What is prompt injection detection?](/guide/faq#what-is-prompt-injection-detection)
- [Tool Approval Example](/examples/tool-approval)
- [Error Types](/reference/errors) — AdapterError
```

- [ ] **Step 8: Append to graph.md**

```markdown
## graph() API summary

```ts
// Build
const g = graph<State>()
  .node(name, handler)
  .edge(from, to | conditionFn)
  .fanOut(from, [to1, to2])
  .fanIn([from1, from2], to)
  .start(nodeName);

// Run
const result = await g.run(initialState);
const events = g.runStream(initialState, options?);
```

## Edge conditions

```ts
// Static edge
.edge('classify', 'next-node')

// Conditional edge — function receives current state
.edge('classify', (state) => state.category === 'A' ? 'node-a' : 'node-b')

// Terminal edge
.edge('final-node', '__end__')
```

## runStream() events

```ts
type GraphEvent<State> =
  | { type: 'node_start'; node: string; state: State }
  | { type: 'node_complete'; node: string; state: State; duration: number }
  | { type: 'workflow_complete'; state: State }
  | { type: 'workflow_error'; node: string; error: Error; state: State };
```

## Checkpointing

```ts
const events = g.runStream(initialState, {
  onCheckpoint: async (node, state) => {
    // Called after each node_complete — save to resume later
    await db.save(`checkpoint:${node}`, state);
  },
});

// Resume from a saved checkpoint
const savedState = await db.load('checkpoint:research');
const resumeEvents = g.runStream(savedState, { startFrom: 'synthesize' });
```

## See also

- [Example: Graph Workflow](/examples/graph-workflow)
- [FAQ: When should I use graph vs agent()?](/guide/faq#when-should-i-use-flintgraph-vs-agent)
- [Landlord](/landlord/) — for multi-agent parallel workflows
```

- [ ] **Step 9: Commit all features pages**

```bash
git add docs/features/budget.md docs/features/compress.md docs/features/memory.md \
        docs/features/rag.md docs/features/recipes.md docs/features/safety.md docs/features/graph.md
git commit -m "docs(features): depth pass on all 7 features pages"
```

---

### Task 6: Expand adapter pages and guide pages

**Files:**
- Modify: `docs/adapters/anthropic.md`
- Modify: `docs/adapters/openai-compat.md`
- Modify: `docs/adapters/custom.md`
- Modify: `docs/guide/index.md`
- Modify: `docs/guide/installation.md`
- Modify: `docs/guide/quick-start.md`

- [ ] **Step 1: Read all 6 files**

Read each file.

- [ ] **Step 2: Append to adapters/anthropic.md**

```markdown
## anthropicAdapter() options

```ts
function anthropicAdapter(options: {
  apiKey: string;
  baseURL?: string;       // default: https://api.anthropic.com
  defaultHeaders?: Record<string, string>;
  defaultModel?: string;  // used when model is not specified
}): ProviderAdapter
```

## Prompt caching details

The Anthropic adapter automatically adds `cache_control: { type: 'ephemeral' }` to:
1. The system message (if present)
2. Tool definitions

Cache TTL is 5 minutes. Cache hits reduce input token cost by ~90%.

On cache hits, `usage.cached` is populated:

```ts
const res = await call({ adapter, model: 'claude-opus-4-7', messages });
if (res.ok) {
  console.log('Input tokens:', res.value.usage.input);
  console.log('Cached tokens:', res.value.usage.cached ?? 0);
}
```

## Capabilities

```ts
adapter.capabilities = {
  streaming: true,
  toolCalling: true,
  vision: true,
  cost: true,           // reports USD cost in responses
  promptCaching: true,  // automatically managed
};
```

## Model compatibility

All `claude-*` models are supported. Prompt caching is supported on `claude-3-5-sonnet`, `claude-3-opus`, and `claude-opus-4-7`+. Older models (claude-2, claude-instant) are not cache-aware.

## Common mistakes

::: warning API key in source code
Never hardcode API keys. Use environment variables: `process.env.ANTHROPIC_API_KEY!`
:::

## See also

- [OpenAI-Compatible Adapter](/adapters/openai-compat)
- [Writing an Adapter](/adapters/custom)
- [FAQ: How does prompt caching work?](/guide/faq#how-does-prompt-caching-work-with-anthropic)
```

- [ ] **Step 3: Append to adapters/openai-compat.md**

```markdown
## openAICompatAdapter() options

```ts
function openAICompatAdapter(options: {
  apiKey: string;
  baseURL: string;
  defaultHeaders?: Record<string, string>;
}): ProviderAdapter
```

## Provider-specific configurations

**OpenAI:**
```ts
openAICompatAdapter({ apiKey: process.env.OPENAI_API_KEY!, baseURL: 'https://api.openai.com/v1' })
```

**Groq (fast inference):**
```ts
openAICompatAdapter({ apiKey: process.env.GROQ_API_KEY!, baseURL: 'https://api.groq.com/openai/v1' })
// Note: Groq has aggressive rate limits on free tier
```

**Together AI:**
```ts
openAICompatAdapter({ apiKey: process.env.TOGETHER_API_KEY!, baseURL: 'https://api.together.xyz/v1' })
```

**DeepSeek:**
```ts
openAICompatAdapter({ apiKey: process.env.DEEPSEEK_API_KEY!, baseURL: 'https://api.deepseek.com/v1' })
```

**Ollama (local):**
```ts
openAICompatAdapter({ apiKey: 'ollama', baseURL: 'http://localhost:11434/v1' })
// apiKey is required by the adapter but not validated by Ollama
```

## Capabilities

```ts
adapter.capabilities = {
  streaming: true,
  toolCalling: true,   // supported by most OpenAI-compat providers
  vision: false,       // varies by provider
  cost: false,         // most providers don't report cost
  promptCaching: false,
};
```

Cost and caching are not reported — `maxDollars` budgets won't trigger with this adapter.

## See also

- [Anthropic Adapter](/adapters/anthropic)
- [FAQ: Does Flint support local models?](/guide/faq#does-flint-support-local-models)
```

- [ ] **Step 4: Append to guide/installation.md**

```markdown
## Monorepo setup

In a monorepo, install at the workspace level:

```sh
pnpm add flint @flint/adapter-anthropic --filter my-app
# or
npm install flint @flint/adapter-anthropic -w packages/my-app
```

## Runtime support

| Runtime | Support |
|---------|---------|
| Node.js 20+ | ✓ Full support |
| Bun 1.0+ | ✓ Full support |
| Deno 1.40+ | ✓ Full support (use npm: specifier) |
| Browser | ✓ Core works; adapters require CORS |
| Cloudflare Workers | ✓ Use `fetch` — no Node.js specifics needed |
| AWS Lambda | ✓ Node.js 20 runtime |

## Common installation errors

**`ERR_REQUIRE_ESM`**: Add `"type": "module"` to `package.json`.

**`Cannot find module 'flint/budget'`**: Requires `moduleResolution: "bundler"` or `"node16"` in `tsconfig.json`.

**`Cannot find module '@standard-schema/spec'`**: Run `npm install` again — peer dependency may not have been auto-installed.

## See also

- [Quick Start](/guide/quick-start) — first working example
- [Setup](/guide/#setup) — API key and TypeScript config
```

- [ ] **Step 5: Append to guide/quick-start.md**

```markdown
## What just happened?

In the basic call example:
1. `anthropicAdapter()` creates a transport layer — pure `fetch`, no HTTP library
2. `call()` sends your messages to the Anthropic API and returns `Result<CallOutput>`
3. `res.ok` is `true` when the API call succeeded and any schema validation passed
4. `res.value.message.content` is the assistant's text response

In the agent loop example:
1. `budget({ maxSteps: 5, maxDollars: 0.10 })` creates a shared spending cap
2. `agent()` loops: call → execute tools → call again, until no tool calls or budget hit
3. `out.value.steps` contains every tool call and result from the loop
4. `out.value.usage` is the total token usage across all steps

## Common next steps

- Add more tools → [tool()](/primitives/tool)
- Handle errors by type → [Error Types](/reference/errors)
- Stream responses → [stream()](/primitives/stream)
- Enforce budgets → [Budget](/features/budget)
- Add safety → [Safety](/features/safety)

## See also

- [Flint vs LangChain](/guide/vs-langchain) — coming from another framework?
- [FAQ](/guide/faq) — design questions answered
- [Examples](/examples/basic-call) — more complete examples
```

- [ ] **Step 6: Commit**

```bash
git add docs/adapters/anthropic.md docs/adapters/openai-compat.md docs/adapters/custom.md \
        docs/guide/index.md docs/guide/installation.md docs/guide/quick-start.md
git commit -m "docs: depth pass on adapter and guide pages"
```

---

### Task 7: Add "See also" to all remaining pages without one

**Files:**
- Modify: `docs/guide/v0-status.md`
- Modify: `docs/STABILITY.md`
- Modify: all example pages that lack cross-links

- [ ] **Step 1: Read the files**

Read `docs/guide/v0-status.md`, `docs/STABILITY.md`, and all files under `docs/examples/`.

- [ ] **Step 2: Add See also to v0-status.md**

Append:

```markdown
## See also

- [Installation](/guide/installation) — runtime requirements
- [Guide](/guide/) — what Flint is and how it fits together
- [STABILITY.md](/STABILITY) — detailed stability policy
```

- [ ] **Step 3: Add See also to each existing example page**

For `docs/examples/basic-call.md`, append:
```markdown
## See also
- [call()](/primitives/call) — full API
- [agent()](/primitives/agent) — multi-step loop
- [Quick Start](/guide/quick-start)
```

For `docs/examples/tools.md`, append:
```markdown
## See also
- [tool()](/primitives/tool) — full tool spec
- [execute()](/primitives/execute) — test tools directly
- [agent()](/primitives/agent) — tool-using loop
```

For `docs/examples/agent.md`, append:
```markdown
## See also
- [agent()](/primitives/agent) — full API
- [Budget](/features/budget) — budget options
- [Testing](/guide/testing) — test agent loops
```

For `docs/examples/streaming.md`, append:
```markdown
## See also
- [stream()](/primitives/stream) — full API and StreamChunk types
- [Budget](/features/budget) — streaming budget consumption
```

For `docs/examples/react-pattern.md`, append:
```markdown
## See also
- [Recipes](/features/recipes) — react() API
- [agent()](/primitives/agent) — underlying loop
```

- [ ] **Step 4: Commit**

```bash
git add docs/guide/v0-status.md docs/STABILITY.md docs/examples/
git commit -m "docs: add See also cross-links to remaining pages"
```
