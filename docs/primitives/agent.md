# agent()

Run an agentic loop: the model reasons, calls tools, receives results, and repeats until it reaches a terminal state or a budget limit is hit.

## Signature

```ts
function agent(options: AgentOptions): Promise<Result<AgentOutput>>
```

## AgentOptions

```ts
type AgentOptions = {
  // Required
  adapter: ProviderAdapter;
  model: string;
  messages: Message[];
  budget: Budget;

  // Optional
  tools?: ToolsParam;
  maxSteps?: number;
  onStep?: (step: Step) => void;
  compress?: Transform;
  logger?: Logger;
  signal?: AbortSignal;
};

type ToolsParam = Tool[] | ((ctx: ToolsCtx) => Tool[] | Promise<Tool[]>);
type ToolsCtx = { messages: Message[]; step: number };
```

| Option | Type | Required | Description |
|---|---|---|---|
| `adapter` | `ProviderAdapter` | Yes | LLM provider adapter |
| `model` | `string` | Yes | Model identifier |
| `messages` | `Message[]` | Yes | Initial conversation history |
| `budget` | `Budget` | **Yes** | Hard cap on steps, tokens, or dollars |
| `tools` | `ToolsParam` | No | Available tools; can be a function for dynamic tools |
| `maxSteps` | `number` | No | Additional step cap (budget's `maxSteps` is the primary cap) |
| `onStep` | `(step: Step) => void` | No | Called after each completed step |
| `compress` | `Transform` | No | Message transform applied before each call |
| `logger` | `Logger` | No | Debug logger |
| `signal` | `AbortSignal` | No | Cancellation signal |

## AgentOutput

```ts
type AgentOutput = {
  message: Message & { role: 'assistant' };
  steps: Step[];
  usage: Usage;   // aggregated across all steps
  cost: number;   // aggregated across all steps
};

type Step = {
  messagesSent: Message[];
  assistant: Message & { role: 'assistant' };
  toolCalls: ToolCall[];
  toolResults: Array<Message & { role: 'tool' }>;
  usage: Usage;
  cost?: number;
};
```

## Return value

`Promise<Result<AgentOutput>>` — never throws.

Failure cases:
- `BudgetExhausted` — any budget limit was hit
- `AdapterError` — network or API error
- `FlintError` with code `'agent.max_steps_exceeded'` — `maxSteps` was reached without a terminal response

## Example

```ts
import { tool, agent } from 'flint';
import { budget } from 'flint/budget';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import * as v from 'valibot';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

const search = tool({
  name: 'search',
  description: 'Search the web',
  input: v.object({ query: v.string() }),
  handler: async ({ query }) => `Results for: ${query}`,
});

const out = await agent({
  adapter,
  model: 'claude-opus-4-7',
  messages: [{ role: 'user', content: 'Find the latest TypeScript release.' }],
  tools: [search],
  budget: budget({ maxSteps: 10, maxDollars: 0.50 }),
  onStep: (step) => {
    console.log(`Step ${step.toolCalls.length} tool calls`);
  },
});

if (out.ok) {
  console.log(out.value.message.content);
  console.log(`Completed in ${out.value.steps.length} steps`);
  console.log(`Total cost: $${out.value.cost.toFixed(4)}`);
}
```

## Dynamic tools

Pass a function instead of an array to supply different tools per step:

```ts
const out = await agent({
  adapter,
  model: 'claude-opus-4-7',
  messages,
  tools: ({ step }) => step < 3 ? [searchTool] : [searchTool, writeTool],
  budget: budget({ maxSteps: 6 }),
});
```

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
