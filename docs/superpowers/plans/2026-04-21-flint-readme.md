# Flint README Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sparse root `README.md` with a full rewrite: hero, philosophy, verified claims list, quick-start snippet, packages table, and status line.

**Architecture:** Single-file change. All claims are backed by direct source or `package.json` evidence listed in the claim verification matrix in `docs/superpowers/specs/2026-04-21-flint-readme-design.md`. No unverified numbers (the "40-80% compression" figure is excluded; "Deno/Bun/edge/browser" runtime claims are narrowed to "Node 20+ · Web API primitives only" since no cross-runtime CI exists).

**Tech Stack:** Markdown only. No source code changes, no new tests, no new packages.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `README.md` | Rewrite | Full content replacement per design spec |

---

### Task 1: Verify claims against source

Before writing a word, spot-check each claim to confirm it's still true. This is the "red" phase — if anything is wrong, adjust the README content in Task 2 rather than writing a false claim.

**Files:**
- Read: `packages/flint/package.json`
- Read: `packages/flint/src/index.ts`
- Read: `packages/flint/src/compress.ts`
- Read: `packages/flint/src/recipes.ts`
- Read: `packages/flint/src/rag.ts`
- Read: `packages/flint/src/safety/index.ts`
- Read: `packages/adapter-anthropic/package.json`
- Read: `packages/adapter-openai-compat/package.json`
- Read: `packages/graph/package.json`

- [ ] **Step 1: Verify `flint` runtime dep count**

Open `packages/flint/package.json`. Confirm `dependencies` has exactly one entry: `"@standard-schema/spec": "1.0.0"`. If more deps exist, update the claim in Task 2 to list them all.

- [ ] **Step 2: Verify 5 primitives**

Open `packages/flint/src/index.ts`. Confirm these five are exported: `call`, `stream`, `validate`, `tool`, `execute`. If any are missing or renamed, adjust Task 2 accordingly.

- [ ] **Step 3: Verify 6 compress transforms**

Open `packages/flint/src/compress.ts`. Confirm these six functions are exported: `dedup`, `windowLast`, `windowFirst`, `truncateToolResults`, `summarize`, `orderForCache`. If any differ, adjust Task 2.

- [ ] **Step 4: Verify 4 recipes**

Open `packages/flint/src/recipes.ts`. Confirm these four async functions are exported: `react`, `retryValidate`, `reflect`, `summarize`. If any differ, adjust Task 2.

- [ ] **Step 5: Verify RAG exports**

Open `packages/flint/src/rag.ts`. Confirm `chunk`, `memoryStore`, and `retrieve` are exported. Note: embedding is provided via the `Embedder` interface, not a standalone function — the claim should say "chunk, store, retrieve" not "embed". Adjust Task 2 if needed.

- [ ] **Step 6: Verify safety exports**

Open `packages/flint/src/safety/index.ts`. Confirm exports include: `boundary`/`untrusted` (boundary wrapping), `redact`/`secretPatterns` (redaction), `permissionedTools` (permissions), `requireApproval` (approval gates), and something for injection detection. Adjust the safety claim in Task 2 if the exact capabilities differ.

- [ ] **Step 7: Verify adapter zero-dep claims**

Open `packages/adapter-anthropic/package.json` and `packages/adapter-openai-compat/package.json`. Confirm neither has a `dependencies` field (only `devDependencies` and `peerDependencies`). Adjust Task 2 if either has runtime deps.

- [ ] **Step 8: Verify graph zero-dep claim**

Open `packages/graph/package.json`. Confirm no `dependencies` field. Adjust Task 2 if it has runtime deps.

- [ ] **Step 9: Verify Node 20+ engine**

Open `packages/flint/package.json`. Confirm `"engines": { "node": ">=20" }` is present. Adjust Task 2 if different.

---

### Task 2: Write the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README.md with the following content**

> Note: If any claim verification in Task 1 found a discrepancy, apply the adjustment described in that step before writing.

```markdown
# flint

Token-efficient agentic TypeScript runtime. Functions, not frameworks. Five core primitives — compose them yourself.

> v0 · under development · not yet published

No classes, no chains, no magic. JavaScript is the runtime — Flint gives you well-typed building blocks and stays out of the way.

## What you get

### Core (`flint`)

- 1 runtime dependency (`@standard-schema/spec`) — [`packages/flint/package.json`](packages/flint/package.json)
- 5 primitives: `call`, `stream`, `validate`, `tool`, `execute` — [`src/index.ts`](packages/flint/src/index.ts)
- `agent()` loop with step / token / dollar budget caps — [`src/agent.ts`](packages/flint/src/agent.ts), [`src/budget.ts`](packages/flint/src/budget.ts)
- 6 compress transforms: `dedup`, `windowLast`, `windowFirst`, `truncateToolResults`, `summarize`, `orderForCache` — [`src/compress.ts`](packages/flint/src/compress.ts)
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with verified claims and quick start"
```

---

## Self-Review

**Spec coverage:**
- Hero + tagline ✓ Task 2 Step 1
- Philosophy (2 sentences) ✓ Task 2 Step 1
- Claims list (3 groups, inline evidence) ✓ Task 2 Step 1
- Quick start snippet ✓ Task 2 Step 1
- Packages table ✓ Task 2 Step 1
- Status line ✓ Task 2 Step 1
- Claim verification before writing ✓ Task 1

**Placeholder scan:** None — full README content is written out in Task 2 Step 1.

**Type consistency:** N/A — documentation only.

**Deliberate departures from old README:**
- Removed "Deno, Bun, edge, browser" — not verified by tests or CI
- Removed "Universal runtime" language — narrowed to "Node 20+ · Web API primitives only"
- Changed `chunk/embed/store/retrieve` to `chunk/store/retrieve` — `embed` is an interface, not a function
