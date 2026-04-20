# Flint Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Flint monorepo scaffold — four packages, every public type/interface defined, every primitive exported as a stub that throws `NotImplementedError` — so subsequent module plans can slot real implementations behind a verified public surface.

**Architecture:** pnpm workspaces monorepo with `flint` (core, zero-dep), `@flint/adapter-anthropic`, `@flint/adapter-openai-compat`, `@flint/graph`. TypeScript strict, ESM-only, tsup for build, vitest for test, biome for lint/format, changesets for versioning. Core is universal-runtime (Web standards only, no `node:` imports).

**Tech Stack:** TypeScript 5.5+, pnpm 9+, Node 20 LTS floor, tsup, vitest, biome, changesets, Standard Schema v1 (`@standard-schema/spec`).

**Reference spec:** `docs/superpowers/specs/2026-04-20-flint-scaffold-design.md`

---

## File map

```
flint/
├── .changeset/config.json
├── .gitignore
├── biome.json
├── LICENSE
├── package.json                              # root workspace
├── pnpm-workspace.yaml
├── README.md
├── tsconfig.base.json
├── examples/README.md                        # placeholder
├── packages/
│   ├── flint/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts                      # root exports
│   │   │   ├── types.ts                      # Message, Tool, Result, etc.
│   │   │   ├── errors.ts
│   │   │   ├── adapter.ts                    # ProviderAdapter interface
│   │   │   ├── budget.ts
│   │   │   ├── compress.ts
│   │   │   ├── memory.ts
│   │   │   ├── rag.ts
│   │   │   ├── agent.ts
│   │   │   ├── recipes.ts
│   │   │   └── primitives/
│   │   │       ├── call.ts
│   │   │       ├── stream.ts
│   │   │       ├── validate.ts
│   │   │       ├── tool.ts
│   │   │       ├── execute.ts
│   │   │       └── count.ts
│   │   └── test/
│   │       ├── surface.test.ts               # every export resolves + stubs throw
│   │       ├── errors.test.ts
│   │       └── types.test.ts               # type-level checks
│   ├── adapter-anthropic/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/index.ts
│   │   └── test/surface.test.ts
│   ├── adapter-openai-compat/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/index.ts
│   │   └── test/surface.test.ts
│   └── graph/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       ├── src/index.ts
│       └── test/surface.test.ts
└── docs/
    └── superpowers/
        ├── specs/2026-04-20-flint-scaffold-design.md   (exists)
        └── plans/2026-04-20-flint-scaffold.md          (this file)
```

Every `src/*.ts` in `packages/flint/` corresponds to a subpath export in the core package.json. Stub functions throw `NotImplementedError`. Types and interfaces are complete and final.

---

## Task 1: Initialize repo and root config

**Files:**
- Create: `.gitignore`
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `biome.json`
- Create: `README.md`
- Create: `LICENSE`
- Create: `examples/README.md`

- [ ] **Step 1: Initialize git**

Run at repo root `C:/Users/KadeHeglin/Downloads/Projects/Flint/`:

```bash
git init
git branch -M main
```

Expected: `Initialized empty Git repository` then silent rename.

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
.DS_Store
.env
.env.local
*.log
.turbo/
coverage/
.vitest-cache/
.tsbuildinfo
```

- [ ] **Step 3: Write root `package.json`**

```json
{
  "name": "flint-monorepo",
  "private": true,
  "version": "0.0.0",
  "description": "Token-efficient agentic TypeScript runtime",
  "type": "module",
  "license": "MIT",
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "lint": "biome check .",
    "format": "biome format --write .",
    "changeset": "changeset",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "@changesets/cli": "2.27.11",
    "@types/node": "22.10.2",
    "tsup": "8.3.5",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 4: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "examples/*"
```

- [ ] **Step 5: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 6: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "files": {
    "ignore": ["dist", "node_modules", "coverage", ".changeset"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useImportType": "error",
        "noDefaultExport": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

- [ ] **Step 7: Write `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026 Flint contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 8: Write `README.md`**

```markdown
# Flint

Token-efficient agentic TypeScript runtime. Functions, not frameworks. Five core primitives (`call`, `stream`, `validate`, `tool`, `execute`), plus an `agent()` loop and `@flint/graph` for branching workflows. Universal runtime (Node 20+, Deno, Bun, edge, browser). Provider-agnostic.

**Status:** v0 under development. Not yet published.

See `docs/superpowers/specs/` for design documents.
```

- [ ] **Step 9: Write `examples/README.md` (placeholder)**

```markdown
# Examples

Runnable examples for each v0 recipe ship here once the recipes are implemented.
```

- [ ] **Step 10: Install and commit**

```bash
pnpm install
git add .
git commit -m "chore: initialize monorepo (pnpm + TS + biome + changesets)"
```

Expected: `pnpm install` completes without errors. Commit succeeds.

---

## Task 2: Set up changesets

**Files:**
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`

- [ ] **Step 1: Write `.changeset/config.json`**

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [["flint", "@flint/*"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

- [ ] **Step 2: Write `.changeset/README.md`**

```markdown
# Changesets

Run `pnpm changeset` to record a version bump for a change. See https://github.com/changesets/changesets for details.
```

- [ ] **Step 3: Commit**

```bash
git add .changeset
git commit -m "chore: configure changesets for linked versioning"
```

---

## Task 3: Scaffold core package (`flint`) skeleton

**Files:**
- Create: `packages/flint/package.json`
- Create: `packages/flint/tsconfig.json`
- Create: `packages/flint/tsup.config.ts`
- Create: `packages/flint/src/index.ts` (temporary empty export)
- Create: `packages/flint/test/surface.test.ts` (temporary smoke)

- [ ] **Step 1: Write `packages/flint/package.json`**

```json
{
  "name": "flint",
  "version": "0.0.0",
  "description": "Token-efficient agentic TypeScript runtime — core primitives",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "files": ["dist", "README.md", "LICENSE"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@standard-schema/spec": "1.0.0"
  },
  "devDependencies": {
    "tsup": "8.3.5",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

Note: `@standard-schema/spec` is a types-only package (interface definitions). Core still has **zero runtime dependencies** — the import compiles away.

- [ ] **Step 2: Write `packages/flint/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Write `packages/flint/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/memory.ts',
    'src/rag.ts',
    'src/compress.ts',
    'src/recipes.ts',
    'src/budget.ts',
    'src/errors.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  splitting: false,
  sourcemap: true,
});
```

- [ ] **Step 4: Write placeholder `packages/flint/src/index.ts`**

```ts
export {};
```

- [ ] **Step 5: Write placeholder `packages/flint/test/surface.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

describe('flint package', () => {
  it('imports without error', async () => {
    const mod = await import('../src/index.ts');
    expect(mod).toBeDefined();
  });
});
```

- [ ] **Step 6: Install and run smoke test**

```bash
pnpm install
pnpm --filter flint test
```

Expected: one passing test.

- [ ] **Step 7: Commit**

```bash
git add packages/flint
git commit -m "chore(flint): scaffold core package skeleton"
```

---

## Task 4: Core types — `types.ts`

**Files:**
- Create: `packages/flint/src/types.ts`
- Create: `packages/flint/test/types.test.ts`

- [ ] **Step 1: Write failing type test `packages/flint/test/types.test.ts`**

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type {
  ContentPart,
  Message,
  Result,
  Tool,
  ToolCall,
} from '../src/types.ts';

describe('types surface', () => {
  it('Message union is exhaustive', () => {
    const sys: Message = { role: 'system', content: 'x' };
    const usr: Message = { role: 'user', content: 'x' };
    const asst: Message = { role: 'assistant', content: 'x' };
    const tool: Message = { role: 'tool', content: 'x', toolCallId: 'id' };
    expectTypeOf(sys).toMatchTypeOf<Message>();
    expectTypeOf(usr).toMatchTypeOf<Message>();
    expectTypeOf(asst).toMatchTypeOf<Message>();
    expectTypeOf(tool).toMatchTypeOf<Message>();
  });

  it('ToolCall has id/name/arguments', () => {
    const tc: ToolCall = { id: '1', name: 'fn', arguments: {} };
    expectTypeOf(tc).toMatchTypeOf<ToolCall>();
  });

  it('Result is discriminated union', () => {
    const ok: Result<number> = { ok: true, value: 1 };
    const err: Result<number> = { ok: false, error: new Error('x') };
    expectTypeOf(ok).toMatchTypeOf<Result<number>>();
    expectTypeOf(err).toMatchTypeOf<Result<number>>();
  });

  it('ContentPart covers text and images', () => {
    const t: ContentPart = { type: 'text', text: 'x' };
    const u: ContentPart = { type: 'image', url: 'https://x' };
    const b: ContentPart = { type: 'image_b64', data: 'x', mediaType: 'image/png' };
    expectTypeOf(t).toMatchTypeOf<ContentPart>();
    expectTypeOf(u).toMatchTypeOf<ContentPart>();
    expectTypeOf(b).toMatchTypeOf<ContentPart>();
  });

  it('Tool exposes name/description/input/handler', () => {
    // type-level only
    type T = Tool<{ a: number }, string>;
    type _Name = T['name'];       // string
    type _Desc = T['description']; // string
    expectTypeOf<T['name']>().toEqualTypeOf<string>();
  });
});
```

- [ ] **Step 2: Run typecheck, confirm FAIL**

```bash
pnpm --filter flint typecheck
```

Expected: errors — `types.ts` does not exist.

- [ ] **Step 3: Write `packages/flint/src/types.ts`**

```ts
import type { StandardSchemaV1 } from '@standard-schema/spec';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'image_b64'; data: string; mediaType: string };

export type ToolCall = {
  id: string;
  name: string;
  arguments: unknown;
};

export type Message =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; content: string; toolCallId: string };

export type Tool<Input = unknown, Output = unknown> = {
  name: string;
  description: string;
  input: StandardSchemaV1<Input>;
  handler: (input: Input) => Promise<Output> | Output;
};

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type Usage = {
  input: number;
  output: number;
  cached?: number;
};

export type StopReason = 'end' | 'tool_call' | 'max_tokens' | 'stop_sequence';

export type StreamChunk =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'usage'; usage: Usage; cost?: number }
  | { type: 'end'; reason: StopReason };

export type Logger = {
  debug?(msg: string, meta?: unknown): void;
  info?(msg: string, meta?: unknown): void;
  warn?(msg: string, meta?: unknown): void;
  error?(msg: string, meta?: unknown): void;
};

export type { StandardSchemaV1 };
```

- [ ] **Step 4: Run typecheck, confirm PASS**

```bash
pnpm --filter flint typecheck
pnpm --filter flint test
```

Expected: no type errors; tests pass (type-level tests via `expectTypeOf` compile clean).

- [ ] **Step 5: Commit**

```bash
git add packages/flint/src/types.ts packages/flint/test/types.test.ts
git commit -m "feat(flint): add core types (Message, Tool, Result, etc.)"
```

---

## Task 5: Core errors — `errors.ts`

**Files:**
- Create: `packages/flint/src/errors.ts`
- Create: `packages/flint/test/errors.test.ts`

- [ ] **Step 1: Write failing test `packages/flint/test/errors.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  AdapterError,
  BudgetExhausted,
  FlintError,
  NotImplementedError,
  ParseError,
  TimeoutError,
  ToolError,
  ValidationError,
} from '../src/errors.ts';

describe('errors', () => {
  it('FlintError has code and optional cause', () => {
    const cause = new Error('root');
    const e = new FlintError('msg', { code: 'test.code', cause });
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('test.code');
    expect(e.cause).toBe(cause);
    expect(e.name).toBe('FlintError');
  });

  it('all subclasses extend FlintError and set name', () => {
    const cases: Array<[string, FlintError]> = [
      ['AdapterError', new AdapterError('x', { code: 'adapter.http.500' })],
      ['ValidationError', new ValidationError('x', { code: 'validation.failed' })],
      ['ToolError', new ToolError('x', { code: 'tool.failed' })],
      ['BudgetExhausted', new BudgetExhausted('x', { code: 'budget.tokens' })],
      ['ParseError', new ParseError('x', { code: 'parse.json' })],
      ['TimeoutError', new TimeoutError('x', { code: 'timeout' })],
      ['NotImplementedError', new NotImplementedError('x')],
    ];
    for (const [name, err] of cases) {
      expect(err).toBeInstanceOf(FlintError);
      expect(err.name).toBe(name);
    }
  });

  it('NotImplementedError has a fixed code', () => {
    expect(new NotImplementedError('x').code).toBe('not_implemented');
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pnpm --filter flint test
```

Expected: import errors — `errors.ts` does not exist.

- [ ] **Step 3: Write `packages/flint/src/errors.ts`**

```ts
type FlintErrorOptions = {
  code: string;
  cause?: unknown;
};

export class FlintError extends Error {
  readonly code: string;
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, { cause: opts.cause });
    this.code = opts.code;
    this.name = 'FlintError';
  }
}

export class AdapterError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'AdapterError';
  }
}

export class ValidationError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'ValidationError';
  }
}

export class ToolError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'ToolError';
  }
}

export class BudgetExhausted extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'BudgetExhausted';
  }
}

export class ParseError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'ParseError';
  }
}

export class TimeoutError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'TimeoutError';
  }
}

export class NotImplementedError extends FlintError {
  constructor(what: string) {
    super(`Not implemented: ${what}`, { code: 'not_implemented' });
    this.name = 'NotImplementedError';
  }
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
pnpm --filter flint test
```

Expected: errors tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/flint/src/errors.ts packages/flint/test/errors.test.ts
git commit -m "feat(flint): add FlintError hierarchy"
```

---

## Task 6: Core adapter interface — `adapter.ts`

**Files:**
- Create: `packages/flint/src/adapter.ts`

- [ ] **Step 1: Write `packages/flint/src/adapter.ts`**

```ts
import type { Message, StreamChunk, Tool, Usage, StopReason, StandardSchemaV1 } from './types.ts';

export type NormalizedRequest = {
  model: string;
  messages: Message[];
  tools?: Tool[];
  schema?: StandardSchemaV1;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  cache?: 'auto' | 'off';
  signal?: AbortSignal;
};

export type NormalizedResponse = {
  message: Message & { role: 'assistant' };
  usage: Usage;
  cost?: number;
  stopReason: StopReason;
  raw?: unknown;
};

export type AdapterCapabilities = {
  promptCache?: boolean;
  structuredOutput?: boolean;
  parallelTools?: boolean;
};

export interface ProviderAdapter {
  readonly name: string;
  readonly capabilities: AdapterCapabilities;
  call(req: NormalizedRequest): Promise<NormalizedResponse>;
  stream(req: NormalizedRequest): AsyncIterable<StreamChunk>;
  count?(messages: Message[], model: string): number;
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter flint typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/flint/src/adapter.ts
git commit -m "feat(flint): define ProviderAdapter interface"
```

---

## Task 7: Core budget — `budget.ts`

**Files:**
- Create: `packages/flint/src/budget.ts`
- Create: `packages/flint/test/budget.test.ts`

- [ ] **Step 1: Write failing test `packages/flint/test/budget.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { budget } from '../src/budget.ts';
import { NotImplementedError } from '../src/errors.ts';

describe('budget', () => {
  it('budget() is a function', () => {
    expect(typeof budget).toBe('function');
  });

  it('returns an object with consume/remaining/assertNotExhausted', () => {
    const b = budget({ maxSteps: 5, maxTokens: 1000, maxDollars: 0.1 });
    expect(typeof b.consume).toBe('function');
    expect(typeof b.remaining).toBe('function');
    expect(typeof b.assertNotExhausted).toBe('function');
  });

  it('consume throws NotImplementedError (stub)', () => {
    const b = budget({ maxSteps: 5 });
    expect(() => b.consume({ input: 1, output: 1 })).toThrow(NotImplementedError);
  });

  it('remaining throws NotImplementedError (stub)', () => {
    const b = budget({ maxSteps: 5 });
    expect(() => b.remaining()).toThrow(NotImplementedError);
  });

  it('assertNotExhausted throws NotImplementedError (stub)', () => {
    const b = budget({ maxSteps: 5 });
    expect(() => b.assertNotExhausted()).toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pnpm --filter flint test
```

Expected: import error — `budget.ts` does not exist.

- [ ] **Step 3: Write `packages/flint/src/budget.ts`**

```ts
import { NotImplementedError } from './errors.ts';
import type { Usage } from './types.ts';

export type BudgetLimits = {
  maxSteps?: number;
  maxTokens?: number;
  maxDollars?: number;
};

export type BudgetRemaining = {
  steps?: number;
  tokens?: number;
  dollars?: number;
};

export type ConsumeInput = Usage & { cost?: number };

export type Budget = {
  consume(x: ConsumeInput): void;
  remaining(): BudgetRemaining;
  assertNotExhausted(): void;
  readonly limits: BudgetLimits;
};

export function budget(limits: BudgetLimits): Budget {
  return {
    limits,
    consume(_x) {
      throw new NotImplementedError('budget.consume');
    },
    remaining() {
      throw new NotImplementedError('budget.remaining');
    },
    assertNotExhausted() {
      throw new NotImplementedError('budget.assertNotExhausted');
    },
  };
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
pnpm --filter flint test
```

Expected: budget tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/flint/src/budget.ts packages/flint/test/budget.test.ts
git commit -m "feat(flint): scaffold budget primitive (stub)"
```

---

## Task 8: Core compress — `compress.ts`

**Files:**
- Create: `packages/flint/src/compress.ts`
- Create: `packages/flint/test/compress.test.ts`

- [ ] **Step 1: Write failing test `packages/flint/test/compress.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  dedup,
  orderForCache,
  pinSystem,
  pipeline,
  summarize,
  truncateToolResults,
  windowFirst,
  windowLast,
} from '../src/compress.ts';
import { NotImplementedError } from '../src/errors.ts';
import type { Message } from '../src/types.ts';

describe('compress transforms', () => {
  const msgs: Message[] = [{ role: 'user', content: 'hi' }];

  it('pipeline returns a function that runs transforms', async () => {
    const p = pipeline();
    expect(typeof p).toBe('function');
    await expect(p(msgs, {})).rejects.toThrow(NotImplementedError);
  });

  const transforms = [
    ['dedup', dedup()],
    ['truncateToolResults', truncateToolResults({ maxChars: 10 })],
    ['windowLast', windowLast({ keep: 1 })],
    ['windowFirst', windowFirst({ keep: 1 })],
    ['pinSystem', pinSystem()],
    ['orderForCache', orderForCache()],
  ] as const;

  for (const [name, t] of transforms) {
    it(`${name} is a transform function`, async () => {
      expect(typeof t).toBe('function');
      await expect(t(msgs, {})).rejects.toThrow(NotImplementedError);
    });
  }

  it('summarize transform requires opts and stubs throw', async () => {
    const t = summarize({
      when: () => true,
      adapter: { name: 'x', capabilities: {}, call: async () => ({}) as never, stream: async function* () {} },
      model: 'x',
    });
    expect(typeof t).toBe('function');
    await expect(t(msgs, {})).rejects.toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pnpm --filter flint test
```

Expected: import error.

- [ ] **Step 3: Write `packages/flint/src/compress.ts`**

```ts
import type { ProviderAdapter } from './adapter.ts';
import { NotImplementedError } from './errors.ts';
import type { Message } from './types.ts';

export type CompressCtx = {
  budget?: { remaining(): { tokens?: number } };
  model?: string;
};

export type Transform = (messages: Message[], ctx: CompressCtx) => Promise<Message[]>;

export function pipeline(..._transforms: Transform[]): Transform {
  return async (_messages, _ctx) => {
    throw new NotImplementedError('compress.pipeline');
  };
}

export function dedup(): Transform {
  return async () => {
    throw new NotImplementedError('compress.dedup');
  };
}

export type TruncateOpts = { maxChars: number };
export function truncateToolResults(_opts: TruncateOpts): Transform {
  return async () => {
    throw new NotImplementedError('compress.truncateToolResults');
  };
}

export type WindowOpts = { keep: number; alwaysKeep?: Array<Message['role']> };
export function windowLast(_opts: WindowOpts): Transform {
  return async () => {
    throw new NotImplementedError('compress.windowLast');
  };
}

export function windowFirst(_opts: WindowOpts): Transform {
  return async () => {
    throw new NotImplementedError('compress.windowFirst');
  };
}

export function pinSystem(): Transform {
  return async () => {
    throw new NotImplementedError('compress.pinSystem');
  };
}

export type SummarizeOpts = {
  when: (messages: Message[]) => boolean;
  adapter: ProviderAdapter;
  model: string;
  keepLast?: number;
};
export function summarize(_opts: SummarizeOpts): Transform {
  return async () => {
    throw new NotImplementedError('compress.summarize');
  };
}

export function orderForCache(): Transform {
  return async () => {
    throw new NotImplementedError('compress.orderForCache');
  };
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
pnpm --filter flint test
```

- [ ] **Step 5: Commit**

```bash
git add packages/flint/src/compress.ts packages/flint/test/compress.test.ts
git commit -m "feat(flint): scaffold compress module (stubs)"
```

---

## Task 9: Core memory — `memory.ts`

**Files:**
- Create: `packages/flint/src/memory.ts`
- Create: `packages/flint/test/memory.test.ts`

- [ ] **Step 1: Write failing test `packages/flint/test/memory.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { conversationMemory, messages, scratchpad } from '../src/memory.ts';
import { NotImplementedError } from '../src/errors.ts';

describe('memory', () => {
  it('messages() returns helpers', () => {
    const m = messages();
    expect(typeof m.push).toBe('function');
    expect(typeof m.slice).toBe('function');
    expect(typeof m.replace).toBe('function');
    expect(typeof m.all).toBe('function');
    expect(() => m.push({ role: 'user', content: 'x' })).toThrow(NotImplementedError);
  });

  it('scratchpad() returns helpers', () => {
    const p = scratchpad();
    expect(typeof p.note).toBe('function');
    expect(typeof p.notes).toBe('function');
    expect(typeof p.clear).toBe('function');
    expect(() => p.note('x')).toThrow(NotImplementedError);
  });

  it('conversationMemory() returns helpers', () => {
    const mem = conversationMemory({
      max: 10,
      summarizeAt: 8,
      summarizer: async () => 'summary',
    });
    expect(typeof mem.append).toBe('function');
    expect(typeof mem.messages).toBe('function');
    expect(typeof mem.summary).toBe('function');
    expect(typeof mem.clear).toBe('function');
    expect(() => mem.append({ role: 'user', content: 'x' })).toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pnpm --filter flint test
```

- [ ] **Step 3: Write `packages/flint/src/memory.ts`**

```ts
import { NotImplementedError } from './errors.ts';
import type { Message } from './types.ts';

export type Messages = {
  push(m: Message): void;
  slice(from: number, to?: number): Message[];
  replace(index: number, m: Message): void;
  all(): Message[];
  clear(): void;
};

export function messages(): Messages {
  return {
    push() {
      throw new NotImplementedError('memory.messages.push');
    },
    slice() {
      throw new NotImplementedError('memory.messages.slice');
    },
    replace() {
      throw new NotImplementedError('memory.messages.replace');
    },
    all() {
      throw new NotImplementedError('memory.messages.all');
    },
    clear() {
      throw new NotImplementedError('memory.messages.clear');
    },
  };
}

export type Scratchpad = {
  note(text: string): void;
  notes(): string[];
  clear(): void;
};

export function scratchpad(): Scratchpad {
  return {
    note() {
      throw new NotImplementedError('memory.scratchpad.note');
    },
    notes() {
      throw new NotImplementedError('memory.scratchpad.notes');
    },
    clear() {
      throw new NotImplementedError('memory.scratchpad.clear');
    },
  };
}

export type ConversationMemoryOpts = {
  max: number;
  summarizeAt: number;
  summarizer: (messages: Message[]) => Promise<string>;
};

export type ConversationMemory = {
  append(m: Message): void;
  messages(): Message[];
  summary(): string | undefined;
  clear(): void;
};

export function conversationMemory(_opts: ConversationMemoryOpts): ConversationMemory {
  return {
    append() {
      throw new NotImplementedError('memory.conversationMemory.append');
    },
    messages() {
      throw new NotImplementedError('memory.conversationMemory.messages');
    },
    summary() {
      throw new NotImplementedError('memory.conversationMemory.summary');
    },
    clear() {
      throw new NotImplementedError('memory.conversationMemory.clear');
    },
  };
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
pnpm --filter flint test
```

- [ ] **Step 5: Commit**

```bash
git add packages/flint/src/memory.ts packages/flint/test/memory.test.ts
git commit -m "feat(flint): scaffold memory module (stubs)"
```

---

## Task 10: Core RAG — `rag.ts`

**Files:**
- Create: `packages/flint/src/rag.ts`
- Create: `packages/flint/test/rag.test.ts`

- [ ] **Step 1: Write failing test `packages/flint/test/rag.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { chunk, memoryStore, retrieve } from '../src/rag.ts';
import { NotImplementedError } from '../src/errors.ts';

describe('rag', () => {
  it('memoryStore() returns VectorStore methods', () => {
    const s = memoryStore();
    expect(typeof s.upsert).toBe('function');
    expect(typeof s.query).toBe('function');
    expect(typeof s.delete).toBe('function');
  });

  it('memoryStore methods throw NotImplementedError', async () => {
    const s = memoryStore();
    await expect(s.upsert([])).rejects.toThrow(NotImplementedError);
    await expect(s.query([0], 5)).rejects.toThrow(NotImplementedError);
    await expect(s.delete([])).rejects.toThrow(NotImplementedError);
  });

  it('chunk() is a function and stub throws', () => {
    expect(typeof chunk).toBe('function');
    expect(() => chunk('x', { size: 100, overlap: 10 })).toThrow(NotImplementedError);
  });

  it('retrieve() is a function and stub throws', async () => {
    expect(typeof retrieve).toBe('function');
    const store = memoryStore();
    const embedder = { embed: async (_: string[]) => [[0]], dimensions: 1 };
    await expect(retrieve('q', { embedder, store, k: 3 })).rejects.toThrow(
      NotImplementedError,
    );
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pnpm --filter flint test
```

- [ ] **Step 3: Write `packages/flint/src/rag.ts`**

```ts
import { NotImplementedError } from './errors.ts';

export type Doc = {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
};

export type Match = {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type Filter = Record<string, unknown>;

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

export interface VectorStore {
  upsert(docs: Doc[]): Promise<void>;
  query(vec: number[], k: number, filter?: Filter): Promise<Match[]>;
  delete(ids: string[]): Promise<void>;
}

export function memoryStore(): VectorStore {
  return {
    async upsert() {
      throw new NotImplementedError('rag.memoryStore.upsert');
    },
    async query() {
      throw new NotImplementedError('rag.memoryStore.query');
    },
    async delete() {
      throw new NotImplementedError('rag.memoryStore.delete');
    },
  };
}

export type ChunkOpts = {
  size: number;
  overlap?: number;
};

export function chunk(_text: string, _opts: ChunkOpts): string[] {
  throw new NotImplementedError('rag.chunk');
}

export type RetrieveOpts = {
  embedder: Embedder;
  store: VectorStore;
  k: number;
  filter?: Filter;
};

export async function retrieve(_query: string, _opts: RetrieveOpts): Promise<Match[]> {
  throw new NotImplementedError('rag.retrieve');
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
pnpm --filter flint test
```

- [ ] **Step 5: Commit**

```bash
git add packages/flint/src/rag.ts packages/flint/test/rag.test.ts
git commit -m "feat(flint): scaffold rag module (stubs)"
```

---

## Task 11: Core primitives — `call`, `stream`, `validate`, `tool`, `execute`, `count`

**Files:**
- Create: `packages/flint/src/primitives/call.ts`
- Create: `packages/flint/src/primitives/stream.ts`
- Create: `packages/flint/src/primitives/validate.ts`
- Create: `packages/flint/src/primitives/tool.ts`
- Create: `packages/flint/src/primitives/execute.ts`
- Create: `packages/flint/src/primitives/count.ts`
- Create: `packages/flint/test/primitives.test.ts`

- [ ] **Step 1: Write failing test `packages/flint/test/primitives.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { call } from '../src/primitives/call.ts';
import { stream } from '../src/primitives/stream.ts';
import { validate } from '../src/primitives/validate.ts';
import { tool } from '../src/primitives/tool.ts';
import { execute } from '../src/primitives/execute.ts';
import { count } from '../src/primitives/count.ts';
import { NotImplementedError } from '../src/errors.ts';
import type { ProviderAdapter } from '../src/adapter.ts';

const mockAdapter: ProviderAdapter = {
  name: 'mock',
  capabilities: {},
  async call() {
    throw new Error('should not reach');
  },
  async *stream() {
    // no-op
  },
};

describe('primitives', () => {
  it('call is a function and stub throws NotImplementedError', async () => {
    expect(typeof call).toBe('function');
    await expect(
      call({ adapter: mockAdapter, model: 'x', messages: [] }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('stream is a function and stub throws on iteration', async () => {
    expect(typeof stream).toBe('function');
    const iter = stream({ adapter: mockAdapter, model: 'x', messages: [] });
    await expect(async () => {
      for await (const _ of iter) {
        // unreachable
      }
    }).rejects.toThrow(NotImplementedError);
  });

  it('validate is a function and stub throws', () => {
    expect(typeof validate).toBe('function');
    const fakeSchema = {
      '~standard': { version: 1, vendor: 'x', validate: () => ({ value: undefined }) },
    } as never;
    expect(() => validate('x', fakeSchema)).toThrow(NotImplementedError);
  });

  it('tool returns a Tool with name/description/input/handler', () => {
    expect(typeof tool).toBe('function');
    const fakeSchema = {
      '~standard': { version: 1, vendor: 'x', validate: () => ({ value: { n: 1 } }) },
    } as never;
    const t = tool({
      name: 'add',
      description: 'add',
      input: fakeSchema,
      handler: async (x: { n: number }) => x.n + 1,
    });
    expect(t.name).toBe('add');
    expect(t.description).toBe('add');
    expect(typeof t.handler).toBe('function');
  });

  it('execute is a function and stub throws', async () => {
    const fakeSchema = {
      '~standard': { version: 1, vendor: 'x', validate: () => ({ value: {} }) },
    } as never;
    const t = tool({ name: 'x', description: 'x', input: fakeSchema, handler: () => 1 });
    await expect(execute(t, {})).rejects.toThrow(NotImplementedError);
  });

  it('count is a function and stub throws', () => {
    expect(typeof count).toBe('function');
    expect(() => count([], 'm')).toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pnpm --filter flint test
```

- [ ] **Step 3: Write each primitive stub**

`packages/flint/src/primitives/call.ts`:

```ts
import type { ProviderAdapter, NormalizedRequest } from '../adapter.ts';
import type { Transform } from '../compress.ts';
import type { Budget } from '../budget.ts';
import { NotImplementedError } from '../errors.ts';
import type { Logger, Message, Result, StandardSchemaV1, StopReason, Usage } from '../types.ts';

export type CallOptions = Omit<NormalizedRequest, 'signal'> & {
  adapter: ProviderAdapter;
  budget?: Budget;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};

export type CallOutput<T = unknown> = {
  message: Message & { role: 'assistant' };
  value?: T;
  usage: Usage;
  cost?: number;
  stopReason: StopReason;
};

export async function call<T = unknown>(
  _options: CallOptions,
): Promise<Result<CallOutput<T>>> {
  throw new NotImplementedError('primitives.call');
}
```

`packages/flint/src/primitives/stream.ts`:

```ts
import type { ProviderAdapter, NormalizedRequest } from '../adapter.ts';
import type { Transform } from '../compress.ts';
import type { Budget } from '../budget.ts';
import { NotImplementedError } from '../errors.ts';
import type { Logger, StreamChunk } from '../types.ts';

export type StreamOptions = Omit<NormalizedRequest, 'signal'> & {
  adapter: ProviderAdapter;
  budget?: Budget;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};

export async function* stream(
  _options: StreamOptions,
): AsyncIterable<StreamChunk> {
  throw new NotImplementedError('primitives.stream');
}
```

`packages/flint/src/primitives/validate.ts`:

```ts
import { NotImplementedError } from '../errors.ts';
import type { Result, StandardSchemaV1 } from '../types.ts';

export function validate<T>(_value: unknown, _schema: StandardSchemaV1<T>): Result<T> {
  throw new NotImplementedError('primitives.validate');
}
```

`packages/flint/src/primitives/tool.ts`:

```ts
import type { StandardSchemaV1, Tool } from '../types.ts';

export type ToolSpec<Input, Output> = {
  name: string;
  description: string;
  input: StandardSchemaV1<Input>;
  handler: (input: Input) => Promise<Output> | Output;
};

export function tool<Input, Output>(spec: ToolSpec<Input, Output>): Tool<Input, Output> {
  return {
    name: spec.name,
    description: spec.description,
    input: spec.input,
    handler: spec.handler,
  };
}
```

Note: `tool()` is the one primitive that is **not** a stub. It's a pure constructor with no logic to defer. Returning a shaped object is the whole job.

`packages/flint/src/primitives/execute.ts`:

```ts
import { NotImplementedError } from '../errors.ts';
import type { Result, Tool } from '../types.ts';

export async function execute<Input, Output>(
  _tool: Tool<Input, Output>,
  _rawInput: unknown,
): Promise<Result<Output>> {
  throw new NotImplementedError('primitives.execute');
}
```

`packages/flint/src/primitives/count.ts`:

```ts
import type { ProviderAdapter } from '../adapter.ts';
import { NotImplementedError } from '../errors.ts';
import type { Message } from '../types.ts';

export function count(
  _messages: Message[],
  _model: string,
  _adapter?: ProviderAdapter,
): number {
  throw new NotImplementedError('primitives.count');
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
pnpm --filter flint test
```

Expected: all primitives tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/flint/src/primitives packages/flint/test/primitives.test.ts
git commit -m "feat(flint): scaffold primitives (call/stream/validate/tool/execute/count)"
```

---

## Task 12: Core agent — `agent.ts`

**Files:**
- Create: `packages/flint/src/agent.ts`
- Create: `packages/flint/test/agent.test.ts`

- [ ] **Step 1: Write failing test `packages/flint/test/agent.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { agent } from '../src/agent.ts';
import { NotImplementedError } from '../src/errors.ts';
import { budget } from '../src/budget.ts';
import type { ProviderAdapter } from '../src/adapter.ts';

const mockAdapter: ProviderAdapter = {
  name: 'mock',
  capabilities: {},
  async call() {
    throw new Error('should not reach');
  },
  async *stream() {
    // no-op
  },
};

describe('agent', () => {
  it('is a function and stub throws NotImplementedError', async () => {
    expect(typeof agent).toBe('function');
    await expect(
      agent({
        adapter: mockAdapter,
        model: 'm',
        messages: [],
        budget: budget({ maxSteps: 5 }),
      }),
    ).rejects.toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pnpm --filter flint test
```

- [ ] **Step 3: Write `packages/flint/src/agent.ts`**

```ts
import type { ProviderAdapter } from './adapter.ts';
import type { Budget } from './budget.ts';
import type { Transform } from './compress.ts';
import { NotImplementedError } from './errors.ts';
import type { Logger, Message, Result, Tool, ToolCall, Usage } from './types.ts';

export type Step = {
  messagesSent: Message[];
  assistant: Message & { role: 'assistant' };
  toolCalls: ToolCall[];
  toolResults: Array<Message & { role: 'tool' }>;
  usage: Usage;
  cost?: number;
};

export type AgentOutput = {
  message: Message & { role: 'assistant' };
  steps: Step[];
  usage: Usage;
  cost: number;
};

export type ToolsParam =
  | Tool[]
  | ((ctx: { messages: Message[]; step: number }) => Tool[] | Promise<Tool[]>);

export type AgentOptions = {
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  tools?: ToolsParam;
  budget: Budget;
  maxSteps?: number;
  onStep?: (step: Step) => void;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};

export async function agent(_options: AgentOptions): Promise<Result<AgentOutput>> {
  throw new NotImplementedError('agent');
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
pnpm --filter flint test
```

- [ ] **Step 5: Commit**

```bash
git add packages/flint/src/agent.ts packages/flint/test/agent.test.ts
git commit -m "feat(flint): scaffold agent loop primitive (stub)"
```

---

## Task 13: Core recipes — `recipes.ts`

**Files:**
- Create: `packages/flint/src/recipes.ts`
- Create: `packages/flint/test/recipes.test.ts`

- [ ] **Step 1: Write failing test `packages/flint/test/recipes.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { react, retryValidate, reflect, summarize } from '../src/recipes.ts';
import { NotImplementedError } from '../src/errors.ts';
import { budget } from '../src/budget.ts';
import type { ProviderAdapter } from '../src/adapter.ts';

const mockAdapter: ProviderAdapter = {
  name: 'mock',
  capabilities: {},
  async call() {
    throw new Error('unused');
  },
  async *stream() {},
};

const fakeSchema = {
  '~standard': { version: 1, vendor: 'x', validate: () => ({ value: undefined }) },
} as never;

describe('recipes', () => {
  it('react is a function and stub throws', async () => {
    expect(typeof react).toBe('function');
    await expect(
      react({
        adapter: mockAdapter,
        model: 'm',
        question: 'q',
        tools: [],
        budget: budget({ maxSteps: 5 }),
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('retryValidate is a function and stub throws', async () => {
    expect(typeof retryValidate).toBe('function');
    await expect(
      retryValidate({
        adapter: mockAdapter,
        model: 'm',
        messages: [],
        schema: fakeSchema,
        maxAttempts: 3,
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('reflect is a function and stub throws', async () => {
    expect(typeof reflect).toBe('function');
    await expect(
      reflect({
        adapter: mockAdapter,
        model: 'm',
        messages: [],
        critic: async () => ({ ok: true, critique: '' }),
        maxRevisions: 2,
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('summarize is a function and stub throws', async () => {
    expect(typeof summarize).toBe('function');
    await expect(
      summarize({ adapter: mockAdapter, model: 'm', text: 'x', chunkSize: 100 }),
    ).rejects.toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
pnpm --filter flint test
```

- [ ] **Step 3: Write `packages/flint/src/recipes.ts`**

```ts
import type { ProviderAdapter } from './adapter.ts';
import type { Budget } from './budget.ts';
import { NotImplementedError } from './errors.ts';
import type { Message, Result, StandardSchemaV1, Tool } from './types.ts';
import type { AgentOutput } from './agent.ts';

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
  schema: StandardSchemaV1<T>;
  maxAttempts: number;
};
export async function retryValidate<T>(
  _opts: RetryValidateOptions<T>,
): Promise<Result<T>> {
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
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
pnpm --filter flint test
```

- [ ] **Step 5: Commit**

```bash
git add packages/flint/src/recipes.ts packages/flint/test/recipes.test.ts
git commit -m "feat(flint): scaffold recipes (react/retryValidate/reflect/summarize stubs)"
```

---

## Task 14: Wire core subpath exports

**Files:**
- Modify: `packages/flint/src/index.ts`
- Modify: `packages/flint/package.json` (exports field)
- Modify: `packages/flint/tsup.config.ts` (entries)
- Create: `packages/flint/test/surface.test.ts` (replaces placeholder)

- [ ] **Step 1: Rewrite `packages/flint/src/index.ts` with root exports**

```ts
export { call } from './primitives/call.ts';
export { stream } from './primitives/stream.ts';
export { validate } from './primitives/validate.ts';
export { tool } from './primitives/tool.ts';
export { execute } from './primitives/execute.ts';
export { count } from './primitives/count.ts';
export { agent } from './agent.ts';

export type {
  ContentPart,
  Logger,
  Message,
  Result,
  Role,
  StopReason,
  StreamChunk,
  Tool,
  ToolCall,
  Usage,
  StandardSchemaV1,
} from './types.ts';

export type {
  AdapterCapabilities,
  NormalizedRequest,
  NormalizedResponse,
  ProviderAdapter,
} from './adapter.ts';

export type { CallOptions, CallOutput } from './primitives/call.ts';
export type { StreamOptions } from './primitives/stream.ts';
export type { ToolSpec } from './primitives/tool.ts';
export type { AgentOptions, AgentOutput, Step, ToolsParam } from './agent.ts';
```

- [ ] **Step 2: Update `packages/flint/package.json` exports field**

Replace the `exports` object with:

```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./memory": { "types": "./dist/memory.d.ts", "import": "./dist/memory.js" },
  "./rag": { "types": "./dist/rag.d.ts", "import": "./dist/rag.js" },
  "./compress": { "types": "./dist/compress.d.ts", "import": "./dist/compress.js" },
  "./recipes": { "types": "./dist/recipes.d.ts", "import": "./dist/recipes.js" },
  "./budget": { "types": "./dist/budget.d.ts", "import": "./dist/budget.js" },
  "./errors": { "types": "./dist/errors.d.ts", "import": "./dist/errors.js" }
}
```

- [ ] **Step 3: Verify `tsup.config.ts` entries are complete**

The config from Task 3 Step 3 already lists every subpath entry. Re-confirm it matches:

```ts
entry: [
  'src/index.ts',
  'src/memory.ts',
  'src/rag.ts',
  'src/compress.ts',
  'src/recipes.ts',
  'src/budget.ts',
  'src/errors.ts',
],
```

No change needed if Task 3 was done correctly.

- [ ] **Step 4: Overwrite `packages/flint/test/surface.test.ts` with the full surface test**

```ts
import { describe, expect, it } from 'vitest';

describe('public surface (source)', () => {
  it('root exports resolve', async () => {
    const mod = await import('../src/index.ts');
    for (const name of [
      'call',
      'stream',
      'validate',
      'tool',
      'execute',
      'count',
      'agent',
    ]) {
      expect(typeof (mod as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('memory subpath resolves', async () => {
    const mod = await import('../src/memory.ts');
    expect(typeof mod.messages).toBe('function');
    expect(typeof mod.scratchpad).toBe('function');
    expect(typeof mod.conversationMemory).toBe('function');
  });

  it('rag subpath resolves', async () => {
    const mod = await import('../src/rag.ts');
    expect(typeof mod.memoryStore).toBe('function');
    expect(typeof mod.chunk).toBe('function');
    expect(typeof mod.retrieve).toBe('function');
  });

  it('compress subpath resolves', async () => {
    const mod = await import('../src/compress.ts');
    for (const name of [
      'pipeline',
      'dedup',
      'truncateToolResults',
      'windowLast',
      'windowFirst',
      'pinSystem',
      'summarize',
      'orderForCache',
    ]) {
      expect(typeof (mod as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('recipes subpath resolves', async () => {
    const mod = await import('../src/recipes.ts');
    for (const name of ['react', 'retryValidate', 'reflect', 'summarize']) {
      expect(typeof (mod as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('budget subpath resolves', async () => {
    const mod = await import('../src/budget.ts');
    expect(typeof mod.budget).toBe('function');
  });

  it('errors subpath resolves', async () => {
    const mod = await import('../src/errors.ts');
    for (const name of [
      'FlintError',
      'AdapterError',
      'ValidationError',
      'ToolError',
      'BudgetExhausted',
      'ParseError',
      'TimeoutError',
      'NotImplementedError',
    ]) {
      expect(typeof (mod as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
```

- [ ] **Step 5: Build and test**

```bash
pnpm --filter flint build
pnpm --filter flint test
pnpm --filter flint typecheck
```

Expected: build produces `dist/{index,memory,rag,compress,recipes,budget,errors}.js` + `.d.ts`. Tests pass. No type errors.

- [ ] **Step 6: Sanity-check bundle size**

```bash
ls -la packages/flint/dist/
```

Expected: each file exists. Report `index.js` size so we can track bundle-size target (under 25 KB minified post-tsup).

- [ ] **Step 7: Commit**

```bash
git add packages/flint
git commit -m "feat(flint): wire subpath exports for all modules"
```

---

## Task 15: Scaffold `@flint/adapter-anthropic`

**Files:**
- Create: `packages/adapter-anthropic/package.json`
- Create: `packages/adapter-anthropic/tsconfig.json`
- Create: `packages/adapter-anthropic/tsup.config.ts`
- Create: `packages/adapter-anthropic/src/index.ts`
- Create: `packages/adapter-anthropic/test/surface.test.ts`

- [ ] **Step 1: Write `packages/adapter-anthropic/package.json`**

```json
{
  "name": "@flint/adapter-anthropic",
  "version": "0.0.0",
  "description": "Flint adapter for Anthropic (prompt-cache aware)",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "files": ["dist", "README.md", "LICENSE"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "flint": "workspace:*"
  },
  "devDependencies": {
    "flint": "workspace:*",
    "tsup": "8.3.5",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Write `packages/adapter-anthropic/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Write `packages/adapter-anthropic/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  splitting: false,
  sourcemap: true,
  external: ['flint'],
});
```

- [ ] **Step 4: Write `packages/adapter-anthropic/src/index.ts`**

```ts
import { NotImplementedError } from 'flint/errors';
import type {
  NormalizedRequest,
  NormalizedResponse,
  ProviderAdapter,
} from 'flint';
import type { Message, StreamChunk } from 'flint';

export type AnthropicAdapterOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export function anthropicAdapter(_opts: AnthropicAdapterOptions): ProviderAdapter {
  return {
    name: 'anthropic',
    capabilities: {
      promptCache: true,
      structuredOutput: true,
      parallelTools: true,
    },
    async call(_req: NormalizedRequest): Promise<NormalizedResponse> {
      throw new NotImplementedError('adapter-anthropic.call');
    },
    async *stream(_req: NormalizedRequest): AsyncIterable<StreamChunk> {
      throw new NotImplementedError('adapter-anthropic.stream');
    },
    count(_messages: Message[], _model: string): number {
      throw new NotImplementedError('adapter-anthropic.count');
    },
  };
}
```

- [ ] **Step 5: Write `packages/adapter-anthropic/test/surface.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { anthropicAdapter } from '../src/index.ts';
import { NotImplementedError } from 'flint/errors';

describe('anthropicAdapter', () => {
  it('produces a ProviderAdapter with name="anthropic"', () => {
    const a = anthropicAdapter({ apiKey: 'test' });
    expect(a.name).toBe('anthropic');
    expect(a.capabilities.promptCache).toBe(true);
  });

  it('call stub throws NotImplementedError', async () => {
    const a = anthropicAdapter({ apiKey: 'test' });
    await expect(
      a.call({ model: 'x', messages: [] }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('stream stub throws on iteration', async () => {
    const a = anthropicAdapter({ apiKey: 'test' });
    await expect(async () => {
      for await (const _ of a.stream({ model: 'x', messages: [] })) {
        // unreachable
      }
    }).rejects.toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 6: Install (so workspace link registers), build flint first, then test**

```bash
pnpm install
pnpm --filter flint build
pnpm --filter @flint/adapter-anthropic test
```

Expected: tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/adapter-anthropic
git commit -m "feat(adapter-anthropic): scaffold package (stub)"
```

---

## Task 16: Scaffold `@flint/adapter-openai-compat`

**Files:**
- Create: `packages/adapter-openai-compat/package.json`
- Create: `packages/adapter-openai-compat/tsconfig.json`
- Create: `packages/adapter-openai-compat/tsup.config.ts`
- Create: `packages/adapter-openai-compat/src/index.ts`
- Create: `packages/adapter-openai-compat/test/surface.test.ts`

- [ ] **Step 1: Write `packages/adapter-openai-compat/package.json`**

```json
{
  "name": "@flint/adapter-openai-compat",
  "version": "0.0.0",
  "description": "Flint adapter for OpenAI-compatible endpoints (OpenAI, Groq, Together, DeepSeek, Ollama, etc.)",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "files": ["dist", "README.md", "LICENSE"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "flint": "workspace:*"
  },
  "devDependencies": {
    "flint": "workspace:*",
    "tsup": "8.3.5",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Write `packages/adapter-openai-compat/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Write `packages/adapter-openai-compat/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  splitting: false,
  sourcemap: true,
  external: ['flint'],
});
```

- [ ] **Step 4: Write `packages/adapter-openai-compat/src/index.ts`**

```ts
import { NotImplementedError } from 'flint/errors';
import type {
  NormalizedRequest,
  NormalizedResponse,
  ProviderAdapter,
} from 'flint';
import type { Message, StreamChunk } from 'flint';

export type OpenAICompatAdapterOptions = {
  apiKey?: string;
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  defaultHeaders?: Record<string, string>;
};

export function openaiCompatAdapter(
  _opts: OpenAICompatAdapterOptions,
): ProviderAdapter {
  return {
    name: 'openai-compat',
    capabilities: {
      promptCache: false,
      structuredOutput: true,
      parallelTools: true,
    },
    async call(_req: NormalizedRequest): Promise<NormalizedResponse> {
      throw new NotImplementedError('adapter-openai-compat.call');
    },
    async *stream(_req: NormalizedRequest): AsyncIterable<StreamChunk> {
      throw new NotImplementedError('adapter-openai-compat.stream');
    },
    count(_messages: Message[], _model: string): number {
      throw new NotImplementedError('adapter-openai-compat.count');
    },
  };
}
```

- [ ] **Step 5: Write `packages/adapter-openai-compat/test/surface.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { openaiCompatAdapter } from '../src/index.ts';
import { NotImplementedError } from 'flint/errors';

describe('openaiCompatAdapter', () => {
  it('produces a ProviderAdapter with name="openai-compat"', () => {
    const a = openaiCompatAdapter({ baseUrl: 'https://example.com' });
    expect(a.name).toBe('openai-compat');
    expect(a.capabilities.structuredOutput).toBe(true);
  });

  it('call stub throws NotImplementedError', async () => {
    const a = openaiCompatAdapter({ baseUrl: 'https://example.com' });
    await expect(
      a.call({ model: 'x', messages: [] }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('stream stub throws on iteration', async () => {
    const a = openaiCompatAdapter({ baseUrl: 'https://example.com' });
    await expect(async () => {
      for await (const _ of a.stream({ model: 'x', messages: [] })) {
        // unreachable
      }
    }).rejects.toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 6: Install, build flint, test**

```bash
pnpm install
pnpm --filter flint build
pnpm --filter @flint/adapter-openai-compat test
```

- [ ] **Step 7: Commit**

```bash
git add packages/adapter-openai-compat
git commit -m "feat(adapter-openai-compat): scaffold package (stub)"
```

---

## Task 17: Scaffold `@flint/graph`

**Files:**
- Create: `packages/graph/package.json`
- Create: `packages/graph/tsconfig.json`
- Create: `packages/graph/tsup.config.ts`
- Create: `packages/graph/src/index.ts`
- Create: `packages/graph/test/surface.test.ts`

- [ ] **Step 1: Write `packages/graph/package.json`**

```json
{
  "name": "@flint/graph",
  "version": "0.0.0",
  "description": "State-machine agent flows for Flint",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "files": ["dist", "README.md", "LICENSE"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "flint": "workspace:*"
  },
  "devDependencies": {
    "flint": "workspace:*",
    "tsup": "8.3.5",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Write `packages/graph/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Write `packages/graph/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  splitting: false,
  sourcemap: true,
  external: ['flint'],
});
```

- [ ] **Step 4: Write `packages/graph/src/index.ts`**

```ts
import { NotImplementedError } from 'flint/errors';
import type { Budget } from 'flint/budget';
import type { ProviderAdapter } from 'flint';
import type { Logger, Result } from 'flint';

export type NodeFn<S, _Input = S> = (
  state: S,
  ctx: RunContext,
) => Promise<S> | S;

export type Node<S> = {
  readonly __type: 'node';
  readonly fn: NodeFn<S>;
};

export function node<S>(fn: NodeFn<S>): Node<S> {
  return { __type: 'node', fn };
}

export type EdgeCondition<S> = (state: S) => boolean;

export type Edge<S> = {
  readonly __type: 'edge';
  readonly from: string | string[];
  readonly to: string | string[];
  readonly when?: EdgeCondition<S>;
};

export function edge<S>(
  from: string | string[],
  to: string | string[],
  when?: EdgeCondition<S>,
): Edge<S> {
  return { __type: 'edge', from, to, ...(when ? { when } : {}) };
}

export function state<S>(): { readonly __type: 'state'; readonly __shape: S } {
  return { __type: 'state', __shape: undefined as S };
}

export type GraphDefinition<S> = {
  state: { readonly __type: 'state'; readonly __shape: S };
  entry: string;
  nodes: Record<string, Node<S>>;
  edges: Edge<S>[];
};

export type RunContext = {
  adapter: ProviderAdapter;
  model: string;
  budget: Budget;
  logger?: Logger;
  signal?: AbortSignal;
};

export type GraphEvent<S> =
  | { type: 'enter'; node: string; state: S }
  | { type: 'exit'; node: string; state: S }
  | { type: 'edge'; from: string; to: string; state: S };

export type Graph<S> = {
  run(initialState: S, ctx: RunContext): Promise<Result<S>>;
  runStream(initialState: S, ctx: RunContext): AsyncIterable<GraphEvent<S>>;
};

export function graph<S>(_def: GraphDefinition<S>): Graph<S> {
  return {
    async run(_initial, _ctx) {
      throw new NotImplementedError('graph.run');
    },
    async *runStream(_initial, _ctx) {
      throw new NotImplementedError('graph.runStream');
    },
  };
}

export interface CheckpointStore<S> {
  save(runId: string, nodeId: string, state: S): Promise<void>;
  load(runId: string): Promise<{ nodeId: string; state: S } | null>;
  delete(runId: string): Promise<void>;
}

export function memoryCheckpointStore<S>(): CheckpointStore<S> {
  return {
    async save() {
      throw new NotImplementedError('graph.memoryCheckpointStore.save');
    },
    async load() {
      throw new NotImplementedError('graph.memoryCheckpointStore.load');
    },
    async delete() {
      throw new NotImplementedError('graph.memoryCheckpointStore.delete');
    },
  };
}
```

- [ ] **Step 5: Write `packages/graph/test/surface.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  edge,
  graph,
  memoryCheckpointStore,
  node,
  state,
} from '../src/index.ts';
import { NotImplementedError } from 'flint/errors';
import { budget } from 'flint/budget';
import type { ProviderAdapter } from 'flint';

const mockAdapter: ProviderAdapter = {
  name: 'mock',
  capabilities: {},
  async call() {
    throw new Error('unused');
  },
  async *stream() {},
};

describe('graph surface', () => {
  it('node/edge/state return shaped values', () => {
    const s = state<{ x: number }>();
    expect(s.__type).toBe('state');
    const n = node<{ x: number }>(async (st) => ({ ...st, x: st.x + 1 }));
    expect(n.__type).toBe('node');
    const e = edge<{ x: number }>('a', 'b', (st) => st.x > 0);
    expect(e.__type).toBe('edge');
    expect(e.from).toBe('a');
    expect(e.to).toBe('b');
  });

  it('graph() returns run/runStream stubs that throw', async () => {
    type S = { x: number };
    const g = graph<S>({
      state: state<S>(),
      entry: 'a',
      nodes: { a: node<S>(async (s) => s) },
      edges: [],
    });
    const ctx = { adapter: mockAdapter, model: 'm', budget: budget({ maxSteps: 1 }) };
    await expect(g.run({ x: 0 }, ctx)).rejects.toThrow(NotImplementedError);
  });

  it('memoryCheckpointStore() returns stubs', async () => {
    const s = memoryCheckpointStore<{ x: number }>();
    await expect(s.save('r', 'n', { x: 0 })).rejects.toThrow(NotImplementedError);
    await expect(s.load('r')).rejects.toThrow(NotImplementedError);
    await expect(s.delete('r')).rejects.toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 6: Install, build flint, test**

```bash
pnpm install
pnpm --filter flint build
pnpm --filter @flint/graph test
```

- [ ] **Step 7: Commit**

```bash
git add packages/graph
git commit -m "feat(graph): scaffold @flint/graph package (stubs)"
```

---

## Task 18: Full repo verification and tag

**Files:**
- None created; this task runs the whole pipeline.

- [ ] **Step 1: Install from scratch (sanity)**

```bash
rm -rf node_modules packages/*/node_modules
pnpm install
```

Expected: clean install, no peer warnings.

- [ ] **Step 2: Build all packages**

```bash
pnpm build
```

Expected: every package produces a `dist/` directory. `packages/flint/dist` has 7 `.js` files and 7 `.d.ts` files (index + 6 subpaths).

- [ ] **Step 3: Typecheck all**

```bash
pnpm typecheck
```

Expected: zero errors.

- [ ] **Step 4: Test all**

```bash
pnpm test
```

Expected: all suites pass across all four packages.

- [ ] **Step 5: Lint**

```bash
pnpm lint
```

Expected: no errors. If there are style warnings, run `pnpm format` and inspect the diff.

- [ ] **Step 6: Verify published artifact shape for `flint`**

```bash
cd packages/flint && pnpm pack --pack-destination /tmp && cd ../..
tar -tzf /tmp/flint-0.0.0.tgz | head -40
```

Expected: tarball contains `package/dist/index.js`, `package/dist/memory.js`, `package/dist/rag.js`, `package/dist/compress.js`, `package/dist/recipes.js`, `package/dist/budget.js`, `package/dist/errors.js` and matching `.d.ts` files. Delete the tarball when done: `rm /tmp/flint-0.0.0.tgz`.

- [ ] **Step 7: Check core bundle size**

```bash
ls -la packages/flint/dist/index.js packages/flint/dist/*.js
```

Record `index.js` size. Target: under 25 KB unminified source output (tsup ships non-minified for libs). If exceeded, inspect for unexpected includes.

- [ ] **Step 8: Commit any lint/format fixups (if step 5 touched files)**

```bash
git status
# if modified files exist:
git add -A
git commit -m "chore: apply biome formatting"
```

- [ ] **Step 9: Tag v0.0.0**

```bash
git tag -a v0.0.0 -m "v0.0.0 — scaffold complete, every public surface stubbed"
```

- [ ] **Step 10: Final report**

Print to stdout a summary of:
- Total packages: 4
- Total source files under `packages/*/src/`: (run `find packages -path '*/src/*.ts' | wc -l`)
- Total passing tests: (from `pnpm test` output)
- Core `dist/index.js` size in bytes
- Commit count since repo init: `git rev-list --count HEAD`

No commit needed for this step — just verification output.

---

## Self-review checklist (for the implementer to run at end)

- [ ] `pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint` all pass from clean
- [ ] Every file in the File Map exists
- [ ] No file in `packages/flint/src/` imports anything with a `node:` prefix
- [ ] No file has a default export
- [ ] Every primitive stub throws `NotImplementedError` (not a generic `Error`)
- [ ] `tool()` is the only non-stub in primitives (pure constructor)
- [ ] Every adapter stub implements `ProviderAdapter` shape (name, capabilities, call, stream, count)
- [ ] All public exports match subpath exports declared in `packages/flint/package.json`
- [ ] Changeset config lists `flint` and `@flint/*` as linked
- [ ] Core has zero runtime dependencies other than `@standard-schema/spec` (types-only)
- [ ] `git log --oneline` shows one commit per task (~18 commits)
