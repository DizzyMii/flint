# Flint — Initial Scaffold Design

**Date:** 2026-04-20
**Scope:** v0 scaffold and architecture for Flint, a token-efficient agentic TypeScript runtime
**Status:** Approved, pending user review

## Positioning

Flint is a **direct contender to LangChain.js** for TypeScript AI apps — built to fix the problems developers complain about most. It takes data in and returns data out through a small set of primitives. No classes, no chains, no decorators, no module-level state. Provider-agnostic by construction: core code never names a provider.

Three pillars:
1. **Heavy token optimization** — compress transforms, prefix-cache-aware ordering, step/token/cost budgets, lazy tool schemas, tool-result compression, structured output reuse, token counting.
2. **Agentic-first** — a loop primitive (`agent()`) for the 80% case and a graph module (`@flint/graph`) for branching workflows.
3. **Functions, not frameworks** — every primitive is a plain function. No hidden runtime, no Runnable base class, no callback manager, no LCEL, no inheritance.

### LangChain problems this design fixes

| LangChain pain | Flint answer |
|---|---|
| Abstraction soup (chains, runnables, LCEL, callback manager) | Six root primitives. Compose with plain function calls and `await`. |
| Heavy dependency tree across `langchain-core`, `-community`, `langgraph`, etc. | Core has zero runtime deps. Each adapter is opt-in. |
| Hidden complexity — prompts injected behind the scenes | Nothing runs that you didn't pass in. `onStep` / event streams expose every call. |
| Weak TypeScript types (loose `any`, runtime surprises) | Strict mode + `exactOptionalPropertyTypes`. Tool input/output types flow end-to-end. Standard Schema for user-side schemas. |
| Token usage is bloated and opaque | Token opt is a first-class pillar: `compress`, `count`, budgets, cache-aware ordering. |
| Observability is an afterthought / paid (LangSmith) | `onStep` on `agent()`, event streams on graph. Users plug in any backend (OTel, file, custom). No vendor lock-in. |
| Frequent breaking changes across sub-packages | Linked versioning via changesets; core + adapters move together. Adapter protocol is stable by design. |
| Awkward streaming API divergent from non-streaming | `call` vs `stream` — same params, different return. Unified `StreamChunk` shape. |
| Class-based agents hard to compose or subclass | `agent()` is one function. Want different behavior? Write your own in 30 lines using the same primitives. |
| Poor universal-runtime story (Node-heavy) | Core runs unchanged on Node, Deno, Bun, Workers, browsers — no `node:` imports. |

## Repository structure

Hybrid monorepo: one core package, adapters and graph are separate packages so users install only what they use.

```
flint/
├── packages/
│   ├── flint/                      # core — zero runtime dependencies
│   ├── adapter-anthropic/          # Anthropic HTTP adapter (prompt-cache aware)
│   ├── adapter-openai-compat/      # OpenAI-protocol HTTP adapter
│   └── graph/                      # @flint/graph — state-machine agents
├── examples/                       # runnable examples per recipe
├── docs/
├── pnpm-workspace.yaml
├── biome.json
├── tsconfig.base.json
├── .changeset/
└── package.json
```

### Core package exports

- `flint` — root primitives: `call`, `stream`, `validate`, `tool`, `execute`, `agent`, `count`
- `flint/memory` — conversation, scratchpad, messages helpers
- `flint/rag` — `Embedder`, `VectorStore`, in-memory store, `chunk`, `retrieve`
- `flint/compress` — pipeline + transforms + cache-aware ordering
- `flint/recipes` — `react`, `retryValidate`, `reflect`, `summarize`
- `flint/budget` — budget primitive
- `flint/errors` — typed error hierarchy

### Provider agnosticism

Core defines a `ProviderAdapter` interface. No provider name appears anywhere in core code. Adapters are values passed via the `adapter:` parameter on `call` / `stream` / `agent`. Adding a new provider never requires a core change.

## Tooling

| Concern | Choice |
|---|---|
| Package manager | pnpm workspaces |
| Build | tsup (ESM only, DTS output) |
| Test | vitest |
| Lint/format | biome |
| TypeScript | strict mode, `moduleResolution: bundler`, target ES2022 |
| Module format | ESM only (no CJS) |
| Node floor | 20 LTS |
| Release | changesets |
| License | MIT |
| Host | public GitHub |

**Universal runtime:** core must run unchanged on Node 20+, Deno, Bun, Cloudflare Workers / Vercel Edge, and modern browsers. No `node:` imports in core. Relies on Web-standard `fetch`, `ReadableStream`, `crypto.subtle`, `TextEncoder`.

## Core primitive contract

### Data shape

Normalized on OpenAI's message format (the most widely interoperable):

```typescript
type Role = 'system' | 'user' | 'assistant' | 'tool';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'image_b64'; data: string; mediaType: string };

type Message =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; content: string; toolCallId: string };

type ToolCall = {
  id: string;
  name: string;
  arguments: unknown;   // parsed JSON; adapters are responsible for parsing
};
```

### Provider adapter interface

```typescript
interface ProviderAdapter {
  name: string;
  call(req: NormalizedRequest): Promise<NormalizedResponse>;
  stream(req: NormalizedRequest): AsyncIterable<StreamChunk>;
  count?(messages: Message[], model: string): number;
  capabilities: {
    promptCache?: boolean;
    structuredOutput?: boolean;
    parallelTools?: boolean;
  };
}

interface NormalizedRequest {
  model: string;
  messages: Message[];
  tools?: Tool[];
  schema?: StandardSchemaV1;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  cache?: 'auto' | 'off';
  signal?: AbortSignal;
}

interface NormalizedResponse {
  message: Message & { role: 'assistant' };
  usage: { input: number; output: number; cached?: number };
  cost?: number;
  stopReason: 'end' | 'tool_call' | 'max_tokens' | 'stop_sequence';
  raw?: unknown;  // provider-specific response for escape hatches
}
```

### Primitives

```typescript
call({ adapter, model, messages, tools?, schema?, budget?, compress?, signal? })
  → Promise<Result<CallOutput>>

stream({ adapter, model, messages, tools?, budget?, compress?, signal? })
  → AsyncIterable<StreamChunk>

validate<T>(value: unknown, schema: StandardSchemaV1<T>) → Result<T>

tool<I, O>({
  name: string;
  description: string;
  input: StandardSchemaV1<I>;
  handler: (input: I) => Promise<O> | O;
}) → Tool<I, O>

execute<I, O>(tool: Tool<I, O>, rawInput: unknown) → Promise<Result<O>>

agent({
  adapter, model, messages, tools?, budget, maxSteps?,
  onStep?, compress?, signal?
}) → Promise<Result<AgentOutput>>

count(messages: Message[], model: string, adapter?: ProviderAdapter) → number
```

### Schema interop

Standardize on [Standard Schema v1](https://standardschema.dev). Users bring Zod, Valibot, ArkType, or any compliant library. Core stays zero-dep.

### Error handling

Two-tier:
- **`Result<T>`** returned from primitives where failure is routine (validation, tool exec, budget exhaustion, adapter 4xx/5xx). Shape: `{ ok: true; value: T } | { ok: false; error: FlintError }`.
- **Throws** for programmer errors (missing required config, invalid adapter, bad schema type).

This means users never `try/catch` for expected failures. Loops exit cleanly on budget exhaustion.

### Token counting

`count()` dispatches to `adapter.count` when available; otherwise falls back to `approxCount()` — pure JS BPE heuristic, ~5% accurate, zero deps.

## Agentic layer

### `agent()` — loop primitive (in core)

Think → (tool call? execute → observe → loop : return).

Semantics:
- Budget checked before every `call`; exhaustion returns `Result.error` with `BudgetExhausted`.
- `maxSteps` default: 10. Exceeded → `Result.error` with `MaxStepsError`.
- Parallel tool calls execute via `Promise.all` when the model returns multiple.
- `compress` pipeline runs per-step before each `call`, not mutating the canonical message list.
- `onStep` callback receives `{ call, toolCalls, toolResults, usage, cost, messagesSent }`.
- `tools` accepts `Tool[] | ((ctx) => Tool[] | Promise<Tool[]>)` for lazy gating.

Return shape:
```typescript
type AgentOutput = {
  message: Message & { role: 'assistant' };
  steps: Step[];
  usage: { input: number; output: number; cached?: number };
  cost: number;
};
```

### `@flint/graph` — state machine

Functions-not-classes even here:

```typescript
import { graph, node, edge, state } from '@flint/graph';

const researchFlow = graph({
  state: state<{ query: string; draft?: string; critique?: string }>(),
  entry: 'draft',
  nodes: {
    draft: node(async (s, ctx) => ({ ...s, draft: await write(s.query, ctx) })),
    review: node(async (s, ctx) => ({ ...s, critique: await critique(s.draft!, ctx) })),
    done: node(async (s) => s),
  },
  edges: [
    edge('draft', 'review'),
    edge('review', 'done', (s) => s.critique!.includes('LGTM')),
    edge('review', 'draft'),  // else loop
  ],
});

const result = await researchFlow.run(
  { query: 'Write a haiku about TypeScript' },
  { adapter, model, budget },
);
```

Features:
- Typed state inferred through nodes
- Conditional edges (predicate → next node); first matching edge wins
- Loops (budget-enforced)
- Parallel branches: `edge('a', ['b', 'c'])` fans out, `edge(['b', 'c'], 'd')` joins
- `flow.runStream(...)` yields `{ type: 'enter' | 'exit' | 'edge', node, state }` for observability
- Optional checkpointing via `CheckpointStore` interface; in-memory default, users plug in Redis/etc.

### Loop vs graph

- Use `agent()` for unbounded tool-using loops with one model and one goal. 80% case.
- Use graph for multi-step workflows with branching logic, specialized nodes, parallel fan-out, or human-in-the-loop checkpoints.

## Token optimization layer

### Compress module

`flint/compress` — composable transforms on `Message[]`:

```typescript
import { pipeline, dedup, truncateToolResults, summarize, windowLast } from 'flint/compress';

const compress = pipeline(
  dedup(),
  truncateToolResults({ maxChars: 2000 }),
  windowLast({ keep: 20, alwaysKeep: ['system'] }),
  summarize({
    when: (msgs) => count(msgs) > 8000,
    adapter,
    model: 'haiku',
  }),
);
```

A transform is `(messages: Message[], ctx: CompressCtx) => Promise<Message[]>`. Users write their own trivially.

Shipped transforms in v0: `dedup`, `truncateToolResults`, `windowLast`, `windowFirst`, `summarize`, `pinSystem`.

### Cache-aware ordering

`flint/compress/cache`:
- `orderForCache(messages)` — reorders so stable prefix (system, long-lived context) comes first, volatile tail comes last
- Adapters with `capabilities.promptCache: true` auto-opt-in when `cache: 'auto'` is passed on `call`

### Budgets

`flint/budget`:

```typescript
const b = budget({ maxSteps: 10, maxTokens: 100_000, maxDollars: 0.50 });
b.consume({ input, output, cost });
b.assertNotExhausted();  // throws internally; wrapped to Result at call site
b.remaining();           // { steps, tokens, dollars }
```

Budget is a value, passed through `call` / `agent` / `graph.run`. Adapters report `usage` and `cost` in responses; the budget consumes automatically.

### Lazy tool schemas

`tools` param accepts `Tool[] | ((ctx) => Tool[] | Promise<Tool[]>)`. The function form runs per-step, letting users send the model only tools relevant to the current state.

### Structured output reuse

Adapters advertise `capabilities.structuredOutput`. Core passes `schema` through when supported. Cache reuse is the adapter's responsibility.

## Memory

`flint/memory` — three types, all plain objects returned from factory functions:

```typescript
// Conversation memory with auto-summarize on overflow
const mem = conversationMemory({
  max: 40,
  summarizeAt: 30,
  summarizer: (msgs) => call({ adapter, model: 'haiku', messages: [...] }),
});
mem.append(msg); mem.messages(); mem.summary(); mem.clear();

// Scratchpad for agent loops
const pad = scratchpad();
pad.note('plan: ...'); pad.notes(); pad.clear();

// Lean working-array helper
const msgs = messages();
msgs.push(msg); msgs.slice(from, to); msgs.replace(id, newMsg);
```

No classes. `conversationMemory()` returns an object literal of functions closing over private state.

## RAG

`flint/rag` — interfaces plus one in-memory store:

```typescript
interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

interface VectorStore {
  upsert(docs: Doc[]): Promise<void>;
  query(vec: number[], k: number, filter?: Filter): Promise<Match[]>;
  delete(ids: string[]): Promise<void>;
}

// Ships: memoryStore() — in-memory cosine search
// Helpers: chunk(text, opts), retrieve(query, { embedder, store, k })
```

Users plug in real backends (pgvector, Pinecone, LanceDB, etc.) by implementing `VectorStore`. No real backends ship in v0.

## Recipes

`flint/recipes` — each under 50 lines, built from primitives:

- **`react(options)`** — reason-act-observe loop. Thin wrapper on `agent()` with a ReAct prompt template.
- **`retryValidate({ schema, maxAttempts })`** — `call` → `validate` → retry with validation error fed back on fail.
- **`reflect({ critic, maxRevisions })`** — produce → critique → revise loop.
- **`summarize({ adapter, model, chunkSize })`** — map-reduce summarization using the compress module.

## Errors

`flint/errors`:

```
FlintError (base, extends Error)
├── AdapterError       (network, provider 4xx/5xx)
├── ValidationError    (schema mismatch)
├── ToolError          (handler threw or returned bad shape)
├── BudgetExhausted    (step / token / cost)
├── ParseError         (tool args JSON parse failed)
└── TimeoutError
```

Every error carries `cause` and a string `code` for matching (`'budget.steps'`, `'budget.tokens'`, `'adapter.http.429'`, etc.).

## Testing

- Vitest for everything, unit and integration.
- Core has no network. All adapter-shape tests use a `mockAdapter` helper that replays recorded fixtures.
- Real provider integration tests live under `packages/adapter-*/test/integration/` and skip by default. They run only when `FLINT_RUN_INTEGRATION=1` and the relevant provider key is set.
- Property tests (via `fast-check` as a dev dep only, not a runtime dep) on compress transforms for message-order invariants.

## DX conventions

- `camelCase` everywhere
- Option objects for any primitive with more than 2 arguments
- Named exports only, no defaults
- User-provided `logger?: Logger` param on primitives that benefit; core ships a no-op logger
- No side effects at import: every file pure, no module-level state, no monkey-patching
- Types are trusted at internal boundaries; runtime validation happens only at user-facing boundaries (adapter responses, tool inputs, user-provided schema data)

## Implementation staging

The user chose **scaffold first, fill in later**. This spec describes the target v0 architecture. Implementation is split across plans:

1. **Plan 1 (this spec → writing-plans):** the scaffold itself. Repo setup, workspace config, all four packages created, every public type/interface defined, every primitive exported as a stub that throws `NotImplementedError`. Build + test infrastructure runs clean. No real logic.
2. **Plan 2:** core primitives (`call`, `stream`, `validate`, `tool`, `execute`, `count`) + `mockAdapter` for tests. Makes everything below it actually work.
3. **Plan 3:** `agent()` loop + budget + errors.
4. **Plan 4:** compress module + cache-aware ordering.
5. **Plan 5:** memory + RAG.
6. **Plan 6:** recipes.
7. **Plan 7:** `@flint/graph`.
8. **Plan 8:** `@flint/adapter-anthropic`.
9. **Plan 9:** `@flint/adapter-openai-compat`.
10. **Plan 10:** examples, docs, and v0 release.

Each plan has its own spec when we get to it.

## Out of scope for v0

- Real RAG backends (only the in-memory store ships)
- Provider adapters beyond Anthropic and OpenAI-compat
- Persistent checkpoint stores for graph (in-memory only in v0)
- `chainOfThought`, `planExecute`, `routeToTool`, `parallelAgents` recipes (future work)
- Observability integrations (OpenTelemetry, LangSmith-style dashboards)
- Browser-specific optimizations (Web Workers, etc.) beyond the universal baseline

## Success criteria for v0

1. `pnpm install && pnpm build && pnpm test` passes at repo root
2. A 20-line example using `agent()` with the Anthropic adapter actually runs
3. The same example with the OpenAI-compat adapter against a local Ollama server runs
4. `@flint/graph` example with a branching flow runs
5. Core package bundle size is under 25 KB minified (sanity check on zero-dep claim)
6. All four v0 recipes have a passing example in `examples/`
7. Type inference works end-to-end: tool input types flow into `execute`, schema types flow into `call({ schema })` output
