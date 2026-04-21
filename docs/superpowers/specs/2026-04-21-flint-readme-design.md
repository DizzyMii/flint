# Flint README — Design

**Date:** 2026-04-21
**Scope:** Full rewrite of the root `README.md` using approach C (pitch + proof + quick start). All claims are verified from source and `package.json` — no unverified numbers (the "40-80% compression" figure is excluded until benchmarked).

---

## Structure

```
# flint                          ← name + tagline
Philosophy (2 sentences)
## What you get                  ← claims list, 3 groups
## Quick start                   ← 30-line code snippet
## Packages                      ← 4-row table
Status line                      ← v0 · under development
```

---

## Section: Hero

```md
# flint

Token-efficient agentic TypeScript runtime. Functions, not frameworks.
Five core primitives — compose them yourself.

> v0 · under development · not yet published
```

---

## Section: Philosophy

Two sentences below the tagline:

> No classes, no chains, no magic. JavaScript is the runtime — Flint gives you well-typed building blocks and stays out of the way.

---

## Section: What you get

Bullet list, three groups. Evidence shown in parens — each claim is directly verifiable from source or `package.json`.

### Core (`flint`)

- 1 runtime dependency (`@standard-schema/spec`) — `packages/flint/package.json`
- 5 primitives: `call`, `stream`, `validate`, `tool`, `execute` — `src/index.ts`
- `agent()` loop with step / token / dollar budget caps — `src/agent.ts`, `src/budget.ts`
- 6 compress transforms: `dedup`, `windowLast`, `windowFirst`, `truncateToolResults`, `summarize`, `orderForCache` — `src/compress.ts`
- 4 recipes under 50 lines each: ReAct, retryValidate, reflect, summarize — `src/recipes.ts`
- RAG: chunk, embed, store, retrieve — `src/rag.ts`
- Conversation memory with async summarization — `src/memory.ts`
- Safety: injection detection, redaction, permissions, approval gates, boundary wrapping — `src/safety/`

### Adapters (zero runtime dependencies each)

- `@flint/adapter-anthropic` — prompt-cache aware, pure `fetch` + `ReadableStream`
- `@flint/adapter-openai-compat` — any OpenAI-compatible endpoint

### Graph

- `@flint/graph` — state-machine workflows with memory checkpointing, zero runtime deps

### Platform

- Node 20+ · Web API primitives only (`fetch`, `ReadableStream`, `TextDecoder`)

---

## Section: Quick start

Uses Valibot as the schema library (implements `@standard-schema/spec`; any compatible library works).

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

---

## Section: Packages table

| Package | Description |
|---|---|
| `flint` | Core primitives, agent loop, compress, memory, RAG, safety, recipes |
| `@flint/adapter-anthropic` | Anthropic Messages API — prompt-cache aware |
| `@flint/adapter-openai-compat` | Any OpenAI-compatible endpoint |
| `@flint/graph` | State-machine agent workflows |

---

## Section: Status

`v0 · under development · not yet published. See` `docs/superpowers/specs/` `for design documents.`

---

## Files touched

| File | Action |
|---|---|
| `README.md` | Full rewrite |

No other files change. No new packages, no new tests, no source changes.

---

## Claim verification matrix

Every claim in the README maps to a verifiable source:

| Claim | Source |
|---|---|
| 1 runtime dependency | `packages/flint/package.json` → `dependencies` |
| 5 primitives | `packages/flint/src/index.ts` → named exports |
| `agent()` budget caps | `packages/flint/src/budget.ts` + `src/agent.ts` |
| 6 compress transforms | `packages/flint/src/compress.ts` → exported functions |
| 4 recipes | `packages/flint/src/recipes.ts` → exported functions |
| RAG functions | `packages/flint/src/rag.ts` → exported functions |
| Memory + summarization | `packages/flint/src/memory.ts` → `conversationMemory` |
| Safety exports | `packages/flint/src/safety/index.ts` → exports |
| Adapter zero deps | `packages/adapter-anthropic/package.json` → no `dependencies` field |
| Pure fetch + ReadableStream | `packages/adapter-anthropic/src/index.ts` → no SDK imports |
| Graph zero deps | `packages/graph/package.json` → no `dependencies` field |
| Node 20+ | `packages/flint/package.json` → `engines.node` |
| Web API only | All source files — no `node:` imports in adapter or graph |
