# landlord

Multi-agent orchestrator built on [Flint](https://dizzymii.github.io/flint) primitives. Decomposes a natural-language prompt into a dependency-ordered plan, runs each sub-task as an isolated tenant agent with checkpoint validation, and collects structured artifacts.

## Install

```sh
npm install landlord flint
```

## Quick start

```ts
import { orchestrate } from 'landlord';
import { standardTools } from 'landlord/tools';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });

const result = await orchestrate(
  'Build a REST API that stores and retrieves notes',
  (workDir) => standardTools(workDir),
  {
    adapter,
    landlordModel: 'claude-opus-4-7',
    tenantModel: 'claude-sonnet-4-6',
  },
);

if (result.ok) {
  console.log(result.value.status);    // 'complete' | 'partial'
  console.log(result.value.artifacts); // per-role output artifacts
}
```

## API

### `orchestrate(prompt, toolsFactory, config)`

Decomposes `prompt` into a contract plan, resolves dependency order, and runs all tenants in parallel with retry/eviction.

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `string` | Natural-language job description |
| `toolsFactory` | `(workDir: string) => Tool[]` | Called once per tenant with that tenant's working directory |
| `config.adapter` | `ProviderAdapter` | Flint adapter (Anthropic, OpenAI-compat, etc.) |
| `config.landlordModel` | `string` | Model for decomposition |
| `config.tenantModel` | `string` | Model for tenant agents |
| `config.budget` | `Budget` (optional) | Shared budget across all tenants |
| `config.outputDir` | `string` (optional) | Base directory for tenant working dirs (defaults to a temp dir) |
| `config.onEvent` | `(event: LandlordEvent) => void` (optional) | Progress callbacks |

### `decompose(prompt, ctx)`

Lower-level: returns the raw `Contract[]` plan without running tenants.

### `runTenant(contract, tools, ctx)`

Lower-level: runs a single tenant agent and returns its artifacts.

### `tools` subpath

```ts
import { standardTools, bashTool, fileReadTool, fileWriteTool, webFetchTool } from 'landlord/tools';
```

All tools are factory functions that accept a `workDir` string and return a scoped `Tool`.

## License

MIT
