# flint

Token-efficient agentic TypeScript runtime. Functions, not frameworks. Six core primitives — compose them yourself.

> v0 · under development · not yet published

No classes, no chains, no magic. JavaScript is the runtime — Flint gives you well-typed building blocks and stays out of the way.

## What you get

### Core (`flint`)

- 1 runtime dependency (`@standard-schema/spec`) — [`packages/flint/package.json`](packages/flint/package.json)
- 6 primitives: `call`, `stream`, `validate`, `tool`, `execute`, `count` — [`src/index.ts`](packages/flint/src/index.ts)
- `agent()` loop with step / token / dollar budget caps — [`src/agent.ts`](packages/flint/src/agent.ts), [`src/budget.ts`](packages/flint/src/budget.ts)
- 6 compress transforms + `pipeline()` combinator: `dedup`, `windowLast`, `windowFirst`, `truncateToolResults`, `summarize`, `orderForCache` — [`src/compress.ts`](packages/flint/src/compress.ts)
- 4 recipes: ReAct, retryValidate, reflect, summarize — [`src/recipes.ts`](packages/flint/src/recipes.ts)
- RAG: chunk, store, retrieve — [`src/rag.ts`](packages/flint/src/rag.ts)
- Conversation memory with async summarization — [`src/memory.ts`](packages/flint/src/memory.ts)
- Safety: injection detection, redaction, permissions, approval gates, boundary wrapping — [`src/safety/`](packages/flint/src/safety/)

### Adapters (zero runtime dependencies each)

- `@flint/adapter-anthropic` — prompt-cache aware, pure `fetch` + `ReadableStream`
- `@flint/adapter-openai-compat` — any OpenAI-compatible endpoint

### Graph

- `@flint/graph` — state-machine workflows with memory checkpointing, zero runtime deps

### Platform

- Node 20+ · Web API primitives only (`fetch`, `ReadableStream`, `TextDecoder`)

## Quick start

```ts
import { call, tool, agent, budget } from 'flint';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import * as v from 'valibot'; // any Standard Schema library works

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

// One-shot call
const res = await call({
  adapter,
  model: 'claude-opus-4-7',
  messages: [{ role: 'user', content: 'What is the capital of France?' }],
});
if (res.ok) console.log(res.value.message.content); // "Paris"

// Define a tool
const add = tool({
  name: 'add',
  description: 'Add two numbers',
  input: v.object({ a: v.number(), b: v.number() }),
  handler: ({ a, b }) => a + b,
});

// Agent loop with budget enforcement
const out = await agent({
  adapter,
  model: 'claude-opus-4-7',
  messages: [{ role: 'user', content: 'What is 123 + 456?' }],
  tools: [add],
  budget: budget({ maxSteps: 5, maxDollars: 0.10 }),
});
if (out.ok) console.log(out.value.message.content); // "579"
```

## Packages

| Package | Description |
|---|---|
| `flint` | Core primitives, agent loop, compress, memory, RAG, safety, recipes |
| `@flint/adapter-anthropic` | Anthropic Messages API — prompt-cache aware |
| `@flint/adapter-openai-compat` | Any OpenAI-compatible endpoint |
| `@flint/graph` | State-machine agent workflows |

v0 · under development · not yet published. See [`docs/superpowers/specs/`](docs/superpowers/specs/) for design documents.
