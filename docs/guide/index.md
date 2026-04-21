# What is Flint?

Flint is a token-efficient agentic TypeScript runtime. It gives you a minimal, composable set of typed building blocks for AI agents — and then stays out of the way.

## The core idea

Most AI agent frameworks abstract away the LLM interaction behind chains, classes, and hidden state. Flint inverts this: you get six plain functions and compose them yourself using ordinary TypeScript. The framework doesn't run your agent — JavaScript does.

```ts
import { call, tool, agent } from 'flint';
import { budget } from 'flint/budget';
import { anthropicAdapter } from '@flint/adapter-anthropic';
```

## What Flint is not

- **Not a RAG framework** — RAG utilities are included but minimal; bring your own vector database.
- **Not an orchestration platform** — no server, no deployment, no hosted runtime.
- **Not opinionated about prompt engineering** — Flint doesn't template your prompts.

## Packages

| Package | Role |
|---|---|
| `flint` | Core: primitives, agent loop, budget, compress, memory, RAG, recipes, safety |
| `@flint/adapter-anthropic` | Anthropic Messages API — prompt-cache aware |
| `@flint/adapter-openai-compat` | Any OpenAI-compatible endpoint |
| `@flint/graph` | State-machine agent workflows |

## Design principles

**One runtime dependency.** The `flint` core depends only on `@standard-schema/spec`. Adapters have zero runtime dependencies.

**Standard Schema for tool inputs.** Use Zod, Valibot, ArkType, or any Standard Schema-compatible library for tool input validation. Flint doesn't bundle a schema library.

**Results, not exceptions.** All public async functions return `Result<T>` — a discriminated union `{ ok: true; value: T } | { ok: false; error: Error }`. No try/catch at the call site.

**Web API primitives only.** Requires Node 20+ but uses only `fetch`, `ReadableStream`, and `TextDecoder` — works in edge runtimes.
