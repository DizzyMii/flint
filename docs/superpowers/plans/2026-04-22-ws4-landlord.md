# WS4: Landlord Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 6 documentation pages for the `@flint/landlord` package and wire them into VitePress as a new nav section.

**Architecture:** New `docs/landlord/` directory with 6 markdown files + VitePress config updates. Content sourced from `packages/landlord/src/`.

**Tech Stack:** VitePress markdown, TypeScript code blocks matching real landlord API.

**Key types (from source):**
- `Contract` — `{ tenantId, role, objective, subPrompt, checkpoints, outputSchema, toolsAllowed?, toolsDenied?, dependsOn, maxRetries }`
- `Checkpoint` — `{ name, description, schema }`
- `OrchestratorConfig` — `{ adapter, landlordModel, tenantModel, budget?, outputDir?, onEvent? }`
- `OrchestrateResult` — `{ status, tenants, artifacts }`
- `LandlordEvent` — union of 7 event types
- `TenantOutcome` — `{ status: 'complete', artifacts } | { status: 'escalated', lastError, retriesExhausted }`

---

### Task 1: Create docs/landlord/index.md

**Files:**
- Create: `docs/landlord/index.md`

- [ ] **Step 1: Write the file**

Create `docs/landlord/index.md`:

````markdown
# What is Landlord?

`@flint/landlord` is an orchestration layer that decomposes a high-level goal into a set of isolated AI agent workers — called **tenants** — each with a defined role, objective, and output schema. Tenants run in parallel where their dependencies allow. The orchestrator (the "landlord") manages scheduling, validates progress at checkpoints, retries failed tenants, and collects artifacts.

## Mental model

```
prompt
  └── decompose()         ← LLM breaks goal into Contract[]
        └── resolveOrder()  ← topological sort by dependsOn
              └── Promise.all(runTenant per contract)
                    ├── tenant "researcher"   (independent)
                    ├── tenant "writer"       (depends on researcher)
                    └── tenant "reviewer"     (depends on writer)
                          └── OrchestrateResult { artifacts }
```

Each tenant is an isolated `agent()` loop with:
- Its own working directory (filesystem sandbox)
- Checkpoint tools it must call to prove progress
- A tool allowlist/denylist from the contract
- Retry-on-failure up to `maxRetries` times

## Install

```sh
npm install @flint/landlord
```

Requires `flint` as a peer dependency.

## Quick start

```ts
import { orchestrate } from '@flint/landlord';
import { standardTools } from '@flint/landlord/tools';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import { budget } from 'flint/budget';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

const result = await orchestrate(
  'Build a REST API for a todo app with CRUD endpoints and SQLite storage',
  (workDir) => standardTools(workDir), // each tenant gets sandboxed tools
  {
    adapter,
    landlordModel: 'claude-opus-4-7',   // model used to decompose the goal
    tenantModel: 'claude-opus-4-7',      // model used for each tenant
    budget: budget({ maxDollars: 2.00, maxSteps: 200 }),
    onEvent: (event) => {
      if (event.type === 'tenant_started') console.log(`▶ ${event.role} started`);
      if (event.type === 'checkpoint_passed') console.log(`✓ ${event.role}: ${event.checkpoint}`);
      if (event.type === 'tenant_complete') console.log(`✓ ${event.role} complete`);
      if (event.type === 'tenant_escalated') console.log(`✗ ${event.role} escalated: ${event}`);
    },
  }
);

if (result.ok) {
  console.log('Status:', result.value.status); // 'complete' or 'partial'
  console.log('Artifacts:', result.value.artifacts);
}
```

## Key concepts

| Term | Description |
|------|-------------|
| **Contract** | The specification for one tenant: role, objective, checkpoints, output schema, dependencies |
| **Checkpoint** | A milestone the tenant must reach, validated against a JSON Schema |
| **Tenant** | An `agent()` loop running a single contract in an isolated work directory |
| **Artifact** | The structured output a tenant produces by passing all its checkpoints |
| **Eviction** | When a tenant fails a checkpoint or runs out of budget — triggers retry |
| **Escalation** | When a tenant exhausts all retries — its dependents are cancelled |

## When to use landlord vs agent()

Use `agent()` when a single model can accomplish the goal in one continuous loop. Use landlord when:

- The work can be meaningfully parallelised across independent roles
- You need structured, validated output at each stage (not just a final message)
- You want automatic retry-on-failure with error context passed to retries
- The task is large enough that a single context window is a bottleneck

## See also

- [Contracts](/landlord/contract) — Contract and Checkpoint schemas
- [decompose()](/landlord/decompose) — how goals become contract lists
- [orchestrate()](/landlord/orchestrate) — full orchestration API
- [runTenant()](/landlord/tenant) — run a single tenant directly
- [Standard Tools](/landlord/tools) — bash, file, and web tools
````

- [ ] **Step 2: Commit**

```bash
git add docs/landlord/index.md
git commit -m "docs(landlord): add package overview page"
```

---

### Task 2: Create docs/landlord/contract.md

**Files:**
- Create: `docs/landlord/contract.md`

- [ ] **Step 1: Write the file**

Create `docs/landlord/contract.md`:

````markdown
# Contracts

A `Contract` is the specification given to a tenant before it starts. It defines the tenant's role, what it must produce, how to validate progress, and which other tenants it depends on.

## ContractSchema fields

```ts
type Contract = {
  tenantId: string;         // auto-generated UUID slice if omitted
  role: string;             // unique name used as dependency key
  objective: string;        // high-level goal in one sentence
  subPrompt: string;        // detailed instructions in the tenant's system prompt
  checkpoints: Checkpoint[];  // ordered milestones the tenant must hit
  outputSchema: Record<string, unknown>;  // JSON Schema for final artifact
  toolsAllowed?: string[];  // allowlist of tool names (undefined = all allowed)
  toolsDenied?: string[];   // denylist of tool names (undefined = none denied)
  dependsOn: string[];      // roles that must complete before this tenant starts
  maxRetries: number;       // max eviction+retry cycles (default: 3)
};
```

## Checkpoint fields

```ts
type Checkpoint = {
  name: string;        // identifier used as tool name suffix
  description: string; // when the tenant should call this checkpoint
  schema: Record<string, unknown>;  // JSON Schema the checkpoint data must satisfy
};
```

## Field reference

### `role`

A short, unique name for this tenant. Used as the dependency key in `dependsOn` and as the artifact key in `OrchestrateResult.artifacts`. Use kebab-case or camelCase consistently:

```ts
role: 'researcher'   // other tenants use dependsOn: ['researcher']
```

### `objective`

One sentence describing the tenant's goal. Injected into the system prompt:

```ts
objective: 'Research quantum computing and produce a structured summary with key concepts'
```

### `subPrompt`

The detailed task description the tenant receives as its user message. Be specific about expected output format:

```ts
subPrompt: `
  Research quantum computing. Cover:
  1. Core principles (superposition, entanglement, interference)
  2. Current hardware approaches (superconducting, photonic, trapped ion)
  3. Practical applications in the next 5 years

  When you have completed your research, call emit_checkpoint__research_complete
  with your findings as a JSON object.
`
```

### `checkpoints`

Ordered milestones. The tenant receives a tool named `emit_checkpoint__<name>` for each checkpoint. When called, the tool validates the input against the checkpoint's `schema`:

```ts
checkpoints: [
  {
    name: 'outline_complete',
    description: 'You have produced a structured outline with at least 3 sections',
    schema: {
      type: 'object',
      properties: {
        sections: { type: 'array', items: { type: 'string' }, minItems: 3 },
        title: { type: 'string' },
      },
      required: ['sections', 'title'],
    },
  },
  {
    name: 'draft_complete',
    description: 'You have written the full draft',
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string', minLength: 500 },
        wordCount: { type: 'number' },
      },
      required: ['content', 'wordCount'],
    },
  },
]
```

A tenant that finishes without calling all checkpoints is treated as failed and evicted.

### `outputSchema`

JSON Schema for the tenant's final artifact — the combined data from all passed checkpoints. Used for downstream dependency injection.

### `toolsAllowed` / `toolsDenied`

Filter which tools from `toolsFactory(workDir)` the tenant can access. `toolsAllowed` is an allowlist; `toolsDenied` is a denylist. If neither is set, all tools are available.

```ts
// Only allow file operations, no web or bash
toolsAllowed: ['file_read', 'file_write'],

// Allow everything except bash
toolsDenied: ['bash'],
```

### `dependsOn`

Roles that must complete (status: 'complete') before this tenant starts. If a dependency is escalated (all retries failed), this tenant is cancelled immediately:

```ts
dependsOn: ['researcher'],  // waits for 'researcher' to complete
```

Artifacts from completed dependencies are injected into the tenant's system prompt as context:
```
Context from dependencies:
{
  "researcher.key_concepts": [...],
  "researcher.timeline": "..."
}
```

### `maxRetries`

How many times to evict-and-retry before escalating. Default: `3`. Each retry receives the previous attempt's error as context in the system prompt.

## Manual contract construction

`decompose()` produces contracts automatically, but you can construct them manually for predictable workflows:

```ts
import { runTenant } from '@flint/landlord';
import type { Contract } from '@flint/landlord';

const researchContract: Contract = {
  tenantId: 'researcher-1',
  role: 'researcher',
  objective: 'Research a topic and produce structured findings',
  subPrompt: 'Research quantum computing. Call emit_checkpoint__findings_ready when done.',
  checkpoints: [{
    name: 'findings_ready',
    description: 'Research is complete and structured',
    schema: {
      type: 'object',
      properties: { summary: { type: 'string' }, sources: { type: 'array' } },
      required: ['summary'],
    },
  }],
  outputSchema: { type: 'object', properties: { summary: { type: 'string' } } },
  dependsOn: [],
  maxRetries: 2,
};
```

## See also

- [decompose()](/landlord/decompose) — auto-generate contracts from a prompt
- [orchestrate()](/landlord/orchestrate) — run multiple contracts
- [runTenant()](/landlord/tenant) — run a single contract
````

- [ ] **Step 2: Commit**

```bash
git add docs/landlord/contract.md
git commit -m "docs(landlord): add Contract and Checkpoint reference"
```

---

### Task 3: Create docs/landlord/decompose.md

**Files:**
- Create: `docs/landlord/decompose.md`

- [ ] **Step 1: Write the file**

Create `docs/landlord/decompose.md`:

````markdown
# decompose()

`decompose()` calls an LLM with a structured tool (`emit_plan`) to turn a free-form goal string into a `Contract[]`. Each contract represents one tenant's work.

## Signature

```ts
function decompose(
  prompt: string,
  ctx: {
    adapter: ProviderAdapter;
    model: string;
    budget?: Budget;
  }
): Promise<Result<Contract[]>>
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `string` | The high-level goal to decompose |
| `ctx.adapter` | `ProviderAdapter` | Adapter for the LLM call |
| `ctx.model` | `string` | Model to use for decomposition |
| `ctx.budget` | `Budget` (optional) | Budget to consume for this call |

## Basic usage

```ts
import { decompose } from '@flint/landlord';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

const result = await decompose(
  'Build a REST API with user authentication, CRUD operations, and API documentation',
  { adapter, model: 'claude-opus-4-7' }
);

if (result.ok) {
  for (const contract of result.value) {
    console.log(`${contract.role}: ${contract.objective}`);
    console.log(`  depends on: ${contract.dependsOn.join(', ') || 'nothing'}`);
  }
}
// → researcher: Research best practices for REST API auth
//     depends on: nothing
// → implementer: Implement the API with auth and CRUD
//     depends on: researcher
// → documenter: Write API documentation
//     depends on: implementer
```

## How it works

`decompose()` calls `call()` with:
1. A system prompt that instructs the model to act as the Landlord orchestrator
2. The user's goal as the user message
3. A single tool `emit_plan` that forces the model to return structured JSON

The model calls `emit_plan({ contracts: [...] })`. Each contract in the array is validated against `ContractSchema` (Zod). Malformed contracts are silently dropped. If the model doesn't call `emit_plan`, `decompose()` returns `{ ok: false }`.

## Writing effective decompose prompts

The quality of decomposition depends heavily on the prompt. Tips:

**Be specific about output format:**
```ts
await decompose(
  'Build a REST API. Each tenant should produce files in its work directory. ' +
  'The final tenant should produce an index.ts entry point.',
  { adapter, model }
);
```

**Specify the number of tenants:**
```ts
await decompose(
  'Create a 3-step pipeline: (1) research, (2) write, (3) review. No more tenants.',
  { adapter, model }
);
```

**Describe dependencies explicitly:**
```ts
await decompose(
  'Build a data pipeline where ingestion must complete before transformation, ' +
  'and transformation must complete before the report is generated.',
  { adapter, model }
);
```

## Inspecting the plan before running

Use `decompose()` directly to preview the plan without running tenants:

```ts
const plan = await decompose(myGoal, { adapter, model });
if (plan.ok) {
  console.log(JSON.stringify(plan.value, null, 2));
  // Review the contracts, then pass them to runTenant() or build orchestrate() manually
}
```

## Error cases

| Condition | Result |
|-----------|--------|
| LLM doesn't call `emit_plan` | `{ ok: false, error: Error('LLM did not call emit_plan') }` |
| All contracts are malformed | `{ ok: true, value: [] }` (empty array) |
| LLM call fails (network, budget) | `{ ok: false, error: AdapterError \| BudgetExhausted }` |

## See also

- [orchestrate()](/landlord/orchestrate) — runs decompose + execution together
- [Contracts](/landlord/contract) — Contract field reference
- [runTenant()](/landlord/tenant) — run a single contract directly
````

- [ ] **Step 2: Commit**

```bash
git add docs/landlord/decompose.md
git commit -m "docs(landlord): add decompose() reference"
```

---

### Task 4: Create docs/landlord/orchestrate.md

**Files:**
- Create: `docs/landlord/orchestrate.md`

- [ ] **Step 1: Write the file**

Create `docs/landlord/orchestrate.md`:

````markdown
# orchestrate()

`orchestrate()` runs the complete landlord pipeline: decompose a goal into contracts, sort by dependency, run all tenants in parallel (where dependencies allow), collect artifacts, and return the result.

## Signature

```ts
function orchestrate(
  prompt: string,
  toolsFactory: (workDir: string) => Tool[],
  config: OrchestratorConfig
): Promise<Result<OrchestrateResult>>
```

## OrchestratorConfig

```ts
type OrchestratorConfig = {
  adapter: ProviderAdapter;
  landlordModel: string;
  tenantModel: string;
  budget?: Budget;
  outputDir?: string;
  onEvent?: (event: LandlordEvent) => void;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `adapter` | `ProviderAdapter` | ✓ | Adapter for all LLM calls (decompose + tenants) |
| `landlordModel` | `string` | ✓ | Model used for `decompose()` |
| `tenantModel` | `string` | ✓ | Model used for each `runTenant()` |
| `budget` | `Budget` | — | Shared budget across the entire job. All calls consume from this pool. |
| `outputDir` | `string` | — | Base directory for tenant work dirs. Default: OS tmpdir + timestamp. |
| `onEvent` | `(e: LandlordEvent) => void` | — | Progress callback. Called synchronously from within the orchestrator. |

## OrchestrateResult

```ts
type OrchestrateResult = {
  status: 'complete' | 'partial';
  tenants: Record<string, TenantOutcome>;
  artifacts: Record<string, Record<string, unknown>>;
};

type TenantOutcome =
  | { status: 'complete'; artifacts: Record<string, unknown> }
  | { status: 'escalated'; lastError: string; retriesExhausted: number };
```

- `status: 'complete'` — all tenants finished successfully
- `status: 'partial'` — at least one tenant was escalated; others may have completed
- `artifacts` — keyed by role, contains the combined checkpoint outputs for each completed tenant

## LandlordEvent

```ts
type LandlordEvent =
  | { type: 'tenant_started'; role: string }
  | { type: 'checkpoint_passed'; role: string; checkpoint: string }
  | { type: 'checkpoint_failed'; role: string; checkpoint: string; reason: string }
  | { type: 'tenant_complete'; role: string }
  | { type: 'tenant_evicted'; role: string; reason: string; retry: number }
  | { type: 'tenant_escalated'; role: string }
  | { type: 'job_complete'; artifacts: Record<string, Record<string, unknown>> };
```

## Full example with progress logging

```ts
import { orchestrate } from '@flint/landlord';
import { standardTools } from '@flint/landlord/tools';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import { budget } from 'flint/budget';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
const b = budget({ maxDollars: 3.00, maxSteps: 300 });

const result = await orchestrate(
  'Write a technical blog post about WebAssembly with code examples',
  (workDir) => standardTools(workDir),
  {
    adapter,
    landlordModel: 'claude-opus-4-7',
    tenantModel: 'claude-opus-4-7',
    budget: b,
    outputDir: './output/wasm-post',
    onEvent: (event) => {
      switch (event.type) {
        case 'tenant_started':
          console.log(`▶ [${event.role}] started`);
          break;
        case 'checkpoint_passed':
          console.log(`  ✓ [${event.role}] checkpoint: ${event.checkpoint}`);
          break;
        case 'checkpoint_failed':
          console.log(`  ✗ [${event.role}] checkpoint failed: ${event.reason}`);
          break;
        case 'tenant_evicted':
          console.log(`  ↩ [${event.role}] evicted (retry ${event.retry}): ${event.reason}`);
          break;
        case 'tenant_escalated':
          console.log(`  ✗ [${event.role}] escalated — all retries exhausted`);
          break;
        case 'tenant_complete':
          console.log(`✓ [${event.role}] complete`);
          break;
        case 'job_complete':
          console.log('Job complete. Artifacts:', Object.keys(event.artifacts));
          break;
      }
    },
  }
);

console.log(`Budget used: $${(3.00 - (b.remaining().dollars ?? 0)).toFixed(4)}`);

if (!result.ok) {
  console.error('Orchestration failed:', result.error.message);
} else if (result.value.status === 'partial') {
  const escalated = Object.entries(result.value.tenants)
    .filter(([, o]) => o.status === 'escalated')
    .map(([role]) => role);
  console.warn('Partial result — escalated tenants:', escalated);
} else {
  console.log('All tenants complete');
  for (const [role, artifacts] of Object.entries(result.value.artifacts)) {
    console.log(`${role}:`, Object.keys(artifacts));
  }
}
```

## Dependency resolution

`orchestrate()` calls `resolveOrder()` (DFS topological sort) on the contracts before dispatching. If the contracts have a circular dependency, `orchestrate()` returns `{ ok: false, error: DependencyCycleError }` before any tenants start.

Independent tenants run via `Promise.all` — no artificial sequencing. Dependent tenants await a gate that resolves when their dependency completes.

## Artifact flow between tenants

When a tenant completes, its artifacts are stored. Dependent tenants that start later receive those artifacts injected into their system prompt:

```
Context from dependencies:
{
  "researcher.findings": "WebAssembly (Wasm) is a binary instruction format...",
  "researcher.sources": ["https://webassembly.org", "..."]
}
```

The injection key format is `<role>.<checkpointName>`.

## Failure and retry

When a tenant fails (checkpoint failed or agent error), it's **evicted**: the tenant restarts with:
- The previous error message injected as "Previous attempt failed. Retry context: ..."
- A fresh `agent()` loop (no accumulated message history from the failed attempt)

After `maxRetries` evictions, the tenant is **escalated**: its gate resolves with empty artifacts. Any tenant that `dependsOn` an escalated tenant is immediately cancelled (also escalated) without starting.

## See also

- [decompose()](/landlord/decompose) — how the prompt becomes contracts
- [runTenant()](/landlord/tenant) — run one contract directly
- [Contracts](/landlord/contract) — contract field reference
- [Standard Tools](/landlord/tools) — tools to pass via toolsFactory
````

- [ ] **Step 2: Commit**

```bash
git add docs/landlord/orchestrate.md
git commit -m "docs(landlord): add orchestrate() reference"
```

---

### Task 5: Create docs/landlord/tenant.md

**Files:**
- Create: `docs/landlord/tenant.md`

- [ ] **Step 1: Write the file**

Create `docs/landlord/tenant.md`:

````markdown
# runTenant()

`runTenant()` runs a single agent loop for one tenant contract. Used directly when you have manually constructed contracts or want to run a single tenant without full orchestration.

## Signature

```ts
function runTenant(
  contract: Contract,
  tools: Tool[],
  ctx: {
    adapter: ProviderAdapter;
    model: string;
    budget?: Budget;
    workDir: string;
  },
  retryContext?: string,
  sharedArtifacts?: Record<string, unknown>
): Promise<Result<Record<string, unknown>>>
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `contract` | `Contract` | The tenant's specification |
| `tools` | `Tool[]` | Tools available to the tenant (filtered by `contract.toolsAllowed`/`toolsDenied`) |
| `ctx.adapter` | `ProviderAdapter` | LLM adapter |
| `ctx.model` | `string` | Model to use |
| `ctx.budget` | `Budget` | Budget (defaults to `budget({ maxSteps: 100 })` if omitted) |
| `ctx.workDir` | `string` | Filesystem sandbox directory for this tenant |
| `retryContext` | `string` (optional) | Error from previous attempt, injected into system prompt |
| `sharedArtifacts` | `Record<string, unknown>` (optional) | Artifacts from dependency tenants |

## Returns

`Result<Record<string, unknown>>` — on success, the combined checkpoint artifacts keyed by checkpoint name. On failure, the error from the final failed step.

## Basic usage

```ts
import { runTenant } from '@flint/landlord';
import { standardTools } from '@flint/landlord/tools';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import { budget } from 'flint/budget';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
const workDir = await mkdtemp(join(tmpdir(), 'tenant-'));

const result = await runTenant(
  {
    tenantId: 'writer-1',
    role: 'writer',
    objective: 'Write a short story about a robot',
    subPrompt: 'Write a 200-word short story about a robot learning to paint. Call emit_checkpoint__story_written with the story text when done.',
    checkpoints: [{
      name: 'story_written',
      description: 'The story is complete',
      schema: {
        type: 'object',
        properties: { story: { type: 'string', minLength: 100 } },
        required: ['story'],
      },
    }],
    outputSchema: { type: 'object', properties: { story: { type: 'string' } } },
    dependsOn: [],
    maxRetries: 2,
  },
  standardTools(workDir),
  { adapter, model: 'claude-opus-4-7', workDir }
);

if (result.ok) {
  console.log(result.value.story_written); // { story: "..." }
}
```

## How the system prompt is constructed

`runTenant()` builds the tenant's system prompt from the contract:

```
You are a {role}.
Objective: {objective}

Checkpoints — call each tool when you reach the milestone:
- story_written: call `emit_checkpoint__story_written` when The story is complete

You also have filesystem and shell tools sandboxed to your working directory.
Checkpoint tools are how you declare structured results back to the orchestrator.

[Context from dependencies — if sharedArtifacts provided]
[Retry context — if retryContext provided]
```

The user message is `contract.subPrompt`.

## Checkpoint tools

For each checkpoint, `runTenant()` creates a tool named `emit_checkpoint__<name>`. When the agent calls this tool:
1. The checkpoint data is validated against the checkpoint's JSON Schema (tier-1: Ajv structural, tier-2: LLM semantic)
2. If it passes: artifacts are recorded, the tool returns success
3. If it fails: the tool returns a failure message with explanation; the agent can revise and retry

A tenant that ends without calling all checkpoint tools returns `{ ok: false }` with an error listing the missing checkpoints.

## Tool filtering

Before the tenant starts, tools are filtered by `contract.toolsAllowed` / `contract.toolsDenied`:

```ts
// Only file tools allowed
contract.toolsAllowed = ['file_read', 'file_write'];

// All tools except bash
contract.toolsDenied = ['bash'];
```

Checkpoint tools (the `emit_checkpoint__*` tools) are always included regardless of filtering.

## Retry context injection

When called with `retryContext`, the previous error is injected into the system prompt:

```
Previous attempt failed. Retry context:
Tenant finished without passing checkpoints: story_written
```

The agent uses this context to understand what went wrong and attempt a different approach.

## When to use directly vs orchestrate()

Use `runTenant()` directly when:
- You have manually constructed contracts and don't need decomposition
- You want to test a specific tenant in isolation
- You need custom retry logic or dependency management
- You're building a custom orchestrator

Use `orchestrate()` when you want the full pipeline: prompt → decompose → parallel execution → result.

## See also

- [orchestrate()](/landlord/orchestrate) — full pipeline
- [Contracts](/landlord/contract) — contract field reference
- [Standard Tools](/landlord/tools) — tools to pass to runTenant
````

- [ ] **Step 2: Commit**

```bash
git add docs/landlord/tenant.md
git commit -m "docs(landlord): add runTenant() reference"
```

---

### Task 6: Create docs/landlord/tools.md

**Files:**
- Create: `docs/landlord/tools.md`

- [ ] **Step 1: Write the file**

Create `docs/landlord/tools.md`:

````markdown
# Standard Tools

`@flint/landlord` ships three built-in tools for tenant agents. They are scoped to a `workDir` sandbox — tenants can read, write, and execute within their work directory but cannot escape it.

## Import

```ts
import { standardTools } from '@flint/landlord/tools';
// or import individually:
import { bashTool, fileReadTool, fileWriteTool, webFetchTool } from '@flint/landlord/tools';
```

## standardTools(workDir)

Returns all four tools pre-configured for the given work directory:

```ts
function standardTools(workDir: string): Tool[]
// returns [bashTool(workDir), fileReadTool(workDir), fileWriteTool(workDir), webFetchTool()]
```

Pass this factory to `orchestrate()`:

```ts
const result = await orchestrate(prompt, (workDir) => standardTools(workDir), config);
```

---

## bashTool

Executes shell commands with `workDir` as the current working directory.

**Tool name:** `bash`

**Input schema:**
```ts
{ command: string }  // the shell command to run
```

**Returns:** stdout + stderr as a string, or an error message if the command fails.

**Sandbox:** The command runs in a child process with `cwd: workDir`. Tenants cannot `cd` outside the work directory using relative paths, but absolute paths are not blocked — for stricter sandboxing, use `toolsDenied: ['bash']` and provide only file tools.

**Example tool call (from agent):**
```json
{ "name": "bash", "arguments": { "command": "npm init -y && npm install express" } }
```

**Example usage in orchestrate:**
```ts
// Allow bash for a code-writing tenant
const contract = {
  ...
  toolsAllowed: ['bash', 'file_read', 'file_write'],
};
```

---

## fileReadTool

Reads a file relative to `workDir`.

**Tool name:** `file_read`

**Input schema:**
```ts
{ path: string }  // relative path from workDir
```

**Returns:** File contents as a string, or an error message if the file doesn't exist.

**Security:** Rejects paths containing `../` (path traversal guard). The path must stay within `workDir`.

**Example:**
```json
{ "name": "file_read", "arguments": { "path": "src/index.ts" } }
```

---

## fileWriteTool

Writes or creates a file relative to `workDir`. Creates parent directories automatically.

**Tool name:** `file_write`

**Input schema:**
```ts
{ path: string; content: string }
```

**Returns:** Success confirmation or error message.

**Security:** Same path traversal guard as `fileReadTool`.

**Example:**
```json
{ "name": "file_write", "arguments": { "path": "src/server.ts", "content": "import express..." } }
```

---

## webFetchTool

Performs an HTTP GET request and returns the response body.

**Tool name:** `web_fetch`

**Input schema:**
```ts
{ url: string }
```

**Returns:** Response body truncated to ~8000 characters to prevent context overflow. Returns error message on network failure.

**Example:**
```json
{ "name": "web_fetch", "arguments": { "url": "https://api.github.com/repos/microsoft/typescript/releases/latest" } }
```

---

## Custom tools

Combine standard tools with your own:

```ts
import { standardTools } from '@flint/landlord/tools';
import { tool } from 'flint';
import * as v from 'valibot';

const dbQueryTool = tool({
  name: 'db_query',
  description: 'Run a read-only SQL query',
  input: v.object({ sql: v.string() }),
  handler: async ({ sql }) => {
    const rows = await db.query(sql);
    return JSON.stringify(rows.slice(0, 50)); // limit output size
  },
});

const result = await orchestrate(
  prompt,
  (workDir) => [...standardTools(workDir), dbQueryTool],
  config
);
```

## Restricting tools per tenant

Use `contract.toolsAllowed` or `contract.toolsDenied` to restrict which tools a tenant can use:

```ts
// Researcher tenant: only web fetch, no file writes or bash
{ role: 'researcher', toolsAllowed: ['web_fetch'], ... }

// Writer tenant: file tools only, no web or bash
{ role: 'writer', toolsAllowed: ['file_read', 'file_write'], ... }

// Reviewer tenant: read-only
{ role: 'reviewer', toolsAllowed: ['file_read', 'web_fetch'], ... }
```

## See also

- [orchestrate()](/landlord/orchestrate) — pass toolsFactory
- [runTenant()](/landlord/tenant) — pass tools array directly
- [Contracts](/landlord/contract) — toolsAllowed / toolsDenied fields
````

- [ ] **Step 2: Commit**

```bash
git add docs/landlord/tools.md
git commit -m "docs(landlord): add Standard Tools reference"
```

---

### Task 7: Wire Landlord into VitePress config

**Files:**
- Modify: `docs/.vitepress/config.ts`

- [ ] **Step 1: Read config.ts**

Read `docs/.vitepress/config.ts` to see the current nav and sidebar structure.

- [ ] **Step 2: Add Landlord nav item**

In the `nav` array, add after the Examples entry and before the v0 dropdown:
```ts
{ text: 'Landlord', link: '/landlord/' },
```

- [ ] **Step 3: Add Landlord sidebar**

In the `sidebar` object, add a new entry:
```ts
'/landlord/': [
  {
    text: 'Landlord',
    items: [
      { text: 'What is Landlord?', link: '/landlord/' },
      { text: 'Contracts', link: '/landlord/contract' },
      { text: 'decompose()', link: '/landlord/decompose' },
      { text: 'orchestrate()', link: '/landlord/orchestrate' },
      { text: 'runTenant()', link: '/landlord/tenant' },
      { text: 'Standard Tools', link: '/landlord/tools' },
    ],
  },
],
```

- [ ] **Step 4: Commit**

```bash
git add docs/.vitepress/config.ts
git commit -m "docs(config): add Landlord nav section with 6 pages"
```
