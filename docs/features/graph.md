# Graph

A stateful graph DSL for multi-node agent workflows. Define typed nodes, conditional edges, and run the graph to completion — or stream events node-by-node.

## Install

```bash
npm install @flint/graph
```

## Importing

```ts
import { state, node, edge, graph, memoryCheckpointStore } from '@flint/graph';
```

> [!WARNING]
> **v0 API** — The graph DSL is at v0 stability. Types and function signatures may change between minor releases. Pin your version and review the changelog before upgrading.

---

## Core concepts

A graph has four building blocks:

| Concept | What it is |
|---|---|
| **State** | A typed object that flows through every node |
| **Node** | An async function that receives the state and returns an updated state |
| **Edge** | A directed connection between nodes, with an optional condition |
| **Graph** | A definition that ties state, nodes, and edges together, plus an `entry` node name |

**Terminal state** — a node with no outgoing edges is a terminal node. When the runner reaches it, execution stops and the final state is returned.

**Fan-out** — an edge can route to multiple nodes at once (`to: ['nodeA', 'nodeB']`). The targets run concurrently with a `Promise.all`, and their resulting states are shallow-merged before execution continues.

**Conditional routing** — supply a `when` predicate to an edge. The runner picks the first matching edge from a node. If no edge matches, the run fails with `graph.no_matching_edge`.

---

## Graph definition example

```ts
import { state, node, edge, graph } from '@flint/graph';
import { budget } from 'flint/budget';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import { call } from 'flint';

// 1. Define your state shape
type PipelineState = {
  input: string;
  draft: string;
  revised: string;
  approved: boolean;
};

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

// 2. Define nodes
const drafterNode = node<PipelineState>(async (st, ctx) => {
  const res = await call({
    adapter: ctx.adapter,
    model: ctx.model,
    messages: [{ role: 'user', content: `Draft a short reply to: ${st.input}` }],
  });
  if (!res.ok) throw res.error;
  return { ...st, draft: res.value.message.content };
});

const reviewerNode = node<PipelineState>(async (st, ctx) => {
  const res = await call({
    adapter: ctx.adapter,
    model: ctx.model,
    messages: [{ role: 'user', content: `Is this reply good? Reply "yes" or "no".\n\n${st.draft}` }],
  });
  if (!res.ok) throw res.error;
  const approved = res.value.message.content.toLowerCase().includes('yes');
  return { ...st, approved };
});

const reviserNode = node<PipelineState>(async (st, ctx) => {
  const res = await call({
    adapter: ctx.adapter,
    model: ctx.model,
    messages: [{ role: 'user', content: `Improve this reply:\n\n${st.draft}` }],
  });
  if (!res.ok) throw res.error;
  return { ...st, draft: res.value.message.content };
});

const finalizeNode = node<PipelineState>(async (st) => {
  return { ...st, revised: st.draft };
});

// 3. Define edges
const edges = [
  edge<PipelineState>('drafter', 'reviewer'),
  edge<PipelineState>('reviewer', 'finalizer', (st) => st.approved),
  edge<PipelineState>('reviewer', 'reviser', (st) => !st.approved),
  edge<PipelineState>('reviser', 'reviewer'),
  // 'finalizer' has no outgoing edge — it is the terminal node
];

// 4. Assemble the graph
const pipeline = graph<PipelineState>({
  state: state<PipelineState>(),
  entry: 'drafter',
  nodes: {
    drafter: drafterNode,
    reviewer: reviewerNode,
    reviser: reviserNode,
    finalizer: finalizeNode,
  },
  edges,
});

// 5. Run it
const res = await pipeline.run(
  { input: 'How do I reset my password?', draft: '', revised: '', approved: false },
  {
    adapter,
    model: 'claude-opus-4-7',
    budget: budget({ maxSteps: 20, maxDollars: 0.50 }),
  },
);

if (res.ok) {
  console.log(res.value.revised);
}
```

---

## API reference

### `state<S>()`

Create a typed state marker. This is a no-op at runtime — it exists to anchor the generic `S` type parameter on the graph definition.

```ts
function state<S>(): { readonly __type: 'state'; readonly __shape: S }
```

### `node<S>(fn)`

Define a node function.

```ts
function node<S>(fn: NodeFn<S>): Node<S>

type NodeFn<S> = (state: S, ctx: RunContext) => Promise<S> | S

type RunContext = {
  adapter: ProviderAdapter;
  model: string;
  budget: Budget;
  logger?: Logger;
  signal?: AbortSignal;
};
```

Nodes receive the current state and the run context (which includes the adapter and model). Return the updated state — do not mutate the incoming object.

### `edge<S>(from, to, when?)`

Define a directed connection.

```ts
function edge<S>(
  from: string | string[],
  to: string | string[],
  when?: EdgeCondition<S>,
): Edge<S>

type EdgeCondition<S> = (state: S) => boolean;
```

- `from` and `to` can be single node names or arrays of names.
- If `to` is an array with more than one name, the edge triggers a fan-out.
- `when` is optional; omitting it means the edge always matches.

### `graph<S>(def)`

Assemble a graph from a definition and return a `Graph<S>` with `run()` and `runStream()` methods.

```ts
function graph<S>(def: GraphDefinition<S>): Graph<S>

type GraphDefinition<S> = {
  state: { readonly __type: 'state'; readonly __shape: S };
  entry: string;
  nodes: Record<string, Node<S>>;
  edges: Edge<S>[];
};

type Graph<S> = {
  run(initialState: S, ctx: RunContext): Promise<Result<S>>;
  runStream(initialState: S, ctx: RunContext): AsyncIterable<GraphEvent<S>>;
};
```

---

## `runStream()`

`runStream()` returns an `AsyncIterable` that yields events as the graph executes. Use it to build live UIs, log progress, or implement custom checkpointing.

```ts
type GraphEvent<S> =
  | { type: 'enter'; node: string; state: S }
  | { type: 'exit';  node: string; state: S }
  | { type: 'edge';  from: string; to: string; state: S };
```

Each node execution emits:
1. `enter` — before the node function runs
2. `exit` — after the node function returns
3. `edge` — the transition that was taken

### Example

```ts
const stream = pipeline.runStream(initialState, {
  adapter,
  model: 'claude-opus-4-7',
  budget: budget({ maxSteps: 20 }),
});

for await (const event of stream) {
  if (event.type === 'enter') {
    console.log(`→ entering node: ${event.node}`);
  }
  if (event.type === 'exit') {
    console.log(`← exiting node:  ${event.node}`);
  }
  if (event.type === 'edge') {
    console.log(`  edge: ${event.from} → ${event.to}`);
  }
}
```

If a `BudgetExhausted` error occurs inside `runStream()`, it propagates as a thrown error from the iterator (not wrapped in a `Result`). Catch it at the `for await` level:

```ts
try {
  for await (const event of pipeline.runStream(initialState, ctx)) {
    // handle events
  }
} catch (err) {
  console.error('Graph run failed:', err);
}
```

---

## Memory checkpointing

`memoryCheckpointStore()` creates an in-memory store that saves graph state by run ID and node ID. This is useful for resuming failed runs or inspecting intermediate state during development.

```ts
function memoryCheckpointStore<S>(): CheckpointStore<S>

interface CheckpointStore<S> {
  save(runId: string, nodeId: string, state: S): Promise<void>;
  load(runId: string): Promise<{ nodeId: string; state: S } | null>;
  delete(runId: string): Promise<void>;
}
```

The built-in `memoryCheckpointStore` does not persist across process restarts. For production use, implement `CheckpointStore<S>` against a database or durable storage.

### Example

```ts
import { memoryCheckpointStore } from '@flint/graph';

const store = memoryCheckpointStore<PipelineState>();

// Manually checkpoint after each node using runStream
const runId = crypto.randomUUID();

for await (const event of pipeline.runStream(initialState, ctx)) {
  if (event.type === 'exit') {
    await store.save(runId, event.node, event.state);
  }
}

// Later: inspect or resume
const checkpoint = await store.load(runId);
if (checkpoint) {
  console.log(`Last completed node: ${checkpoint.nodeId}`);
  console.log('State at checkpoint:', checkpoint.state);
}

// Clean up when done
await store.delete(runId);
```

---

## See also

- [agent()](/primitives/agent) — single-agent loop; use inside node functions
- [call()](/primitives/call) — single LLM call; use inside node functions
- [Budget](/features/budget) — `RunContext` requires a budget
- [Safety](/features/safety) — apply safety utilities to tools used inside nodes
- [Recipes](/features/recipes) — simpler multi-step patterns without graph DSL overhead
