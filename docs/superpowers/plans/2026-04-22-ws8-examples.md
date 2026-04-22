# WS8: New Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 5 new example pages under `docs/examples/` covering RAG pipeline, multi-agent with landlord, tool approval flow, memory-backed agent, and graph workflow.

**Architecture:** 5 new markdown files + VitePress config update.

**Tech Stack:** VitePress markdown, TypeScript code blocks matching real Flint API.

---

### Task 1: Create docs/examples/rag-pipeline.md

**Files:**
- Create: `docs/examples/rag-pipeline.md`

- [ ] **Step 1: Write the file**

Create `docs/examples/rag-pipeline.md`:

````markdown
# RAG Pipeline

This example builds a complete Retrieval-Augmented Generation (RAG) pipeline: chunk a document, embed and store chunks, retrieve relevant context at query time, and pass it to the LLM.

## What this demonstrates

- `chunk()` — splitting text into overlapping segments
- `memoryStore()` — in-memory vector store
- `retrieve()` — cosine similarity search
- Injecting retrieved context into `call()` messages

## The embedder

You supply the embedding function. This example uses a mock — swap in OpenAI or any other provider:

```ts
import { call } from 'flint';
import { chunk, memoryStore, retrieve } from 'flint/rag';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

// In production: replace with a real embedding API
async function embed(text: string): Promise<number[]> {
  // OpenAI example:
  // const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  // return res.data[0].embedding;

  // Mock: hash-based pseudo-embedding for demonstration
  const hash = [...text].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return Array.from({ length: 8 }, (_, i) => Math.sin(hash + i));
}
```

## Step 1: Chunk the document

```ts
const document = `
WebAssembly (Wasm) is a binary instruction format for a stack-based virtual machine.
Wasm is designed as a portable compilation target for programming languages, enabling
deployment on the web for client and server applications.

Key features of WebAssembly:
- Near-native performance
- Language agnostic (compiles from C, C++, Rust, Go, and many others)
- Runs in all modern browsers
- Memory-safe sandbox execution
- Interoperability with JavaScript

WebAssembly use cases include:
- High-performance web applications (games, video editing, CAD)
- Serverless functions
- Plugin systems
- Cryptography
`;

const chunks = chunk(document, {
  size: 150,    // target chunk size in characters
  overlap: 30,  // characters of overlap between adjacent chunks
});

console.log(`Created ${chunks.length} chunks`);
// → Created 5 chunks
```

## Step 2: Embed and store

```ts
const store = memoryStore();
await store.add(chunks, embed);
console.log(`Stored ${chunks.length} embeddings`);
```

## Step 3: Retrieve relevant chunks

```ts
const query = 'What programming languages does WebAssembly support?';

const results = await retrieve(store, query, embed, { topK: 3 });

console.log('Relevant chunks:');
for (const result of results) {
  console.log(`  [score: ${result.score.toFixed(3)}] ${result.text.slice(0, 80)}...`);
}
```

## Step 4: Inject context and call the LLM

```ts
const context = results.map((r, i) => `[${i + 1}] ${r.text}`).join('\n\n');

const res = await call({
  adapter,
  model: 'claude-opus-4-7',
  messages: [
    {
      role: 'system',
      content: `You are a helpful assistant. Answer based on the provided context only.\n\nContext:\n${context}`,
    },
    {
      role: 'user',
      content: query,
    },
  ],
});

if (res.ok) {
  console.log(res.value.message.content);
  // → "WebAssembly supports C, C++, Rust, Go, and many other programming languages..."
}
```

## Complete pipeline function

```ts
import { call } from 'flint';
import { chunk, memoryStore, retrieve } from 'flint/rag';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function buildRagPipeline(documents: string[], embedFn: (text: string) => Promise<number[]>) {
  const store = memoryStore();

  // Index all documents
  for (const doc of documents) {
    const chunks = chunk(doc, { size: 512, overlap: 64 });
    await store.add(chunks, embedFn);
  }

  return async function query(question: string) {
    const results = await retrieve(store, question, embedFn, { topK: 5 });
    const context = results.map(r => r.text).join('\n\n');

    return call({
      adapter,
      model: 'claude-opus-4-7',
      messages: [
        { role: 'system', content: `Answer based on this context:\n\n${context}` },
        { role: 'user', content: question },
      ],
    });
  };
}

// Usage
const ask = await buildRagPipeline([document], embed);
const answer = await ask('What are WebAssembly use cases?');
if (answer.ok) console.log(answer.value.message.content);
```

## Production considerations

For production RAG, swap `memoryStore()` for a real vector database:

```ts
import type { EmbeddingStore } from 'flint/rag';

// Implement the EmbeddingStore interface for your database
const pgvectorStore: EmbeddingStore = {
  async add(chunks, embedder) { /* INSERT INTO embeddings */ },
  async query(embedding, topK) { /* SELECT ... ORDER BY cosine_distance */ },
};
```

See [RAG](/features/rag) for the full API and `EmbeddingStore` interface.

## See also

- [RAG](/features/rag) — full RAG API
- [call()](/primitives/call) — LLM call with messages
- [FAQ: How does Flint handle RAG?](/guide/faq#how-does-flint-handle-rag)
````

- [ ] **Step 2: Commit**

```bash
git add docs/examples/rag-pipeline.md
git commit -m "docs(examples): add RAG pipeline example"
```

---

### Task 2: Create docs/examples/multi-agent.md

**Files:**
- Create: `docs/examples/multi-agent.md`

- [ ] **Step 1: Write the file**

Create `docs/examples/multi-agent.md`:

````markdown
# Multi-Agent with Landlord

This example uses `@flint/landlord` to run a 3-tenant pipeline: a researcher, a writer, and a reviewer working sequentially with artifact handoff between stages.

## What this demonstrates

- `orchestrate()` — full landlord pipeline
- `Contract` construction with dependencies
- `LandlordEvent` progress callbacks
- Artifact flow between dependent tenants

## The pipeline

```
researcher ──→ writer ──→ reviewer
(independent)  (depends on researcher)  (depends on writer)
```

## Setup

```ts
import { orchestrate } from '@flint/landlord';
import { standardTools } from '@flint/landlord/tools';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import { budget } from 'flint/budget';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
```

## Run the pipeline

```ts
const result = await orchestrate(
  // The goal — decompose() turns this into contracts automatically
  'Write a technical article about WebAssembly for a developer audience. ' +
  'Include: core concepts, use cases, and a Rust code example. ' +
  'The pipeline should have a researcher, writer, and reviewer.',
  (workDir) => standardTools(workDir),
  {
    adapter,
    landlordModel: 'claude-opus-4-7',
    tenantModel: 'claude-opus-4-7',
    budget: budget({ maxDollars: 2.00, maxSteps: 200 }),
    outputDir: './output/wasm-article',
    onEvent: (event) => {
      switch (event.type) {
        case 'tenant_started':
          console.log(`\n▶ ${event.role}`);
          break;
        case 'checkpoint_passed':
          console.log(`  ✓ ${event.checkpoint}`);
          break;
        case 'tenant_evicted':
          console.log(`  ↩ retry ${event.retry}: ${event.reason.slice(0, 80)}`);
          break;
        case 'tenant_escalated':
          console.error(`  ✗ ${event.role} failed`);
          break;
      }
    },
  }
);
```

## Read the results

```ts
if (!result.ok) {
  console.error('Failed:', result.error.message);
  process.exit(1);
}

const { status, tenants, artifacts } = result.value;
console.log('\nStatus:', status);

for (const [role, outcome] of Object.entries(tenants)) {
  if (outcome.status === 'complete') {
    console.log(`${role}: complete`);
    console.log('  artifacts:', Object.keys(outcome.artifacts));
  } else {
    console.log(`${role}: escalated — ${outcome.lastError}`);
  }
}

// Access specific artifacts
if (artifacts.writer) {
  console.log('\nFinal article:');
  console.log(artifacts.writer.draft_complete?.content ?? 'No content');
}
```

## Expected output

```
▶ researcher
  ✓ research_complete

▶ writer
  ✓ outline_complete
  ✓ draft_complete

▶ reviewer
  ✓ review_complete

Status: complete
researcher: complete
  artifacts: [ 'research_complete' ]
writer: complete
  artifacts: [ 'outline_complete', 'draft_complete' ]
reviewer: complete
  artifacts: [ 'review_complete' ]
```

## Manual contract construction

If you want full control over the contracts instead of using `decompose()`, use `runTenant()` directly:

```ts
import { runTenant } from '@flint/landlord';
import { standardTools } from '@flint/landlord/tools';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workDir = await mkdtemp(join(tmpdir(), 'researcher-'));

const researchResult = await runTenant(
  {
    tenantId: 'researcher-1',
    role: 'researcher',
    objective: 'Research WebAssembly thoroughly',
    subPrompt: 'Research WebAssembly: core concepts, use cases, language support. Call emit_checkpoint__research_complete with structured findings.',
    checkpoints: [{
      name: 'research_complete',
      description: 'Research is complete',
      schema: {
        type: 'object',
        properties: {
          concepts: { type: 'array', items: { type: 'string' } },
          useCases: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
        required: ['concepts', 'summary'],
      },
    }],
    outputSchema: { type: 'object' },
    dependsOn: [],
    maxRetries: 2,
  },
  standardTools(workDir),
  { adapter, model: 'claude-opus-4-7', workDir }
);
```

## See also

- [What is Landlord?](/landlord/) — concepts and mental model
- [orchestrate()](/landlord/orchestrate) — full API reference
- [Contracts](/landlord/contract) — contract field reference
- [Standard Tools](/landlord/tools) — bash, file, and web tools
````

- [ ] **Step 2: Commit**

```bash
git add docs/examples/multi-agent.md
git commit -m "docs(examples): add multi-agent landlord example"
```

---

### Task 3: Create docs/examples/tool-approval.md

**Files:**
- Create: `docs/examples/tool-approval.md`

- [ ] **Step 1: Write the file**

Create `docs/examples/tool-approval.md`:

````markdown
# Tool Approval Flow

This example shows how to gate destructive tool calls behind a human approval step using `requireApproval()`.

## What this demonstrates

- `requireApproval()` — wrapping tools with an approval callback
- Handling approval denial gracefully
- Building a CLI confirmation prompt

## Setup

```ts
import { agent, tool } from 'flint';
import { budget } from 'flint/budget';
import { requireApproval } from 'flint/safety';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import * as v from 'valibot';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
```

## Define the tools

```ts
const deleteFile = tool({
  name: 'delete_file',
  description: 'Delete a file from the filesystem',
  input: v.object({ path: v.string() }),
  handler: async ({ path }) => {
    await import('node:fs/promises').then(fs => fs.unlink(path));
    return `Deleted ${path}`;
  },
  permissions: { destructive: true, filesystem: true },
});

const readFile = tool({
  name: 'read_file',
  description: 'Read a file',
  input: v.object({ path: v.string() }),
  handler: async ({ path }) => import('node:fs/promises').then(fs => fs.readFile(path, 'utf-8')),
  permissions: { filesystem: true },
});
```

## Build the approval callback

```ts
const rl = readline.createInterface({ input: stdin, output: stdout });

async function askUser(toolName: string, input: unknown): Promise<boolean> {
  const answer = await rl.question(
    `\n⚠️  Agent wants to call: ${toolName}(${JSON.stringify(input)})\nAllow? [y/N] `
  );
  return answer.trim().toLowerCase() === 'y';
}
```

## Wrap destructive tools with approval

```ts
// Only gate tools with permissions.destructive === true
const safeTools = requireApproval(
  [deleteFile, readFile],
  async (toolName, input) => {
    const t = [deleteFile, readFile].find(t => t.name === toolName);
    if (t?.permissions?.destructive) {
      return askUser(toolName, input);
    }
    return true; // auto-approve non-destructive tools
  }
);
```

## Run the agent

```ts
const res = await agent({
  adapter,
  model: 'claude-opus-4-7',
  messages: [
    {
      role: 'user',
      content: 'Clean up the temp directory by deleting all .tmp files, then show me what\'s left.',
    },
  ],
  tools: safeTools,
  budget: budget({ maxSteps: 10 }),
});

rl.close();

if (res.ok) {
  console.log('\nAgent:', res.value.message.content);
}
```

## Example interaction

```
Agent wants to call: delete_file({"path":"./temp/cache.tmp"})
Allow? [y/N] y

Agent wants to call: delete_file({"path":"./temp/session.tmp"})
Allow? [y/N] n

Agent: I deleted cache.tmp but you denied deleting session.tmp.
The remaining files in temp/ are: session.tmp, readme.txt
```

## What happens when denied

When the approval callback returns `false`, the tool returns an error message to the agent: `"Tool execution denied by user"`. The agent receives this as a tool result and typically adjusts its plan:

```
Tool result: Error: Tool execution denied by user
Agent: I understand you'd like to keep session.tmp. I'll leave it in place.
```

## See also

- [Safety](/features/safety) — full safety API including requireApproval
- [tool()](/primitives/tool) — ToolPermissions type
- [agent()](/primitives/agent) — agent loop API
````

- [ ] **Step 2: Commit**

```bash
git add docs/examples/tool-approval.md
git commit -m "docs(examples): add tool approval flow example"
```

---

### Task 4: Create docs/examples/memory-agent.md

**Files:**
- Create: `docs/examples/memory-agent.md`

- [ ] **Step 1: Write the file**

Create `docs/examples/memory-agent.md`:

````markdown
# Memory-Backed Agent

This example builds a multi-turn conversational agent that persists context across calls using `conversationMemory()` with automatic summarization.

## What this demonstrates

- `conversationMemory()` — persistent conversation state
- Automatic summarization when context grows large
- Multi-turn conversation loop
- Inspecting memory state

## Setup

```ts
import { agent } from 'flint';
import { budget } from 'flint/budget';
import { conversationMemory } from 'flint/memory';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
```

## Create conversation memory

```ts
const memory = conversationMemory({
  adapter,
  model: 'claude-haiku-4-5-20251001', // cheaper model for summarization
  maxMessages: 20,    // summarize when history exceeds 20 messages
  keepLast: 6,        // keep 6 most recent messages verbatim after summarizing
});
```

## Send a message and persist the response

```ts
async function chat(userMessage: string): Promise<string> {
  // Get current messages from memory (includes any prior summary)
  const messages = await memory.messages();

  const res = await agent({
    adapter,
    model: 'claude-opus-4-7',
    messages: [
      { role: 'system', content: 'You are a helpful coding assistant. Remember context from earlier in our conversation.' },
      ...messages,
      { role: 'user', content: userMessage },
    ],
    budget: budget({ maxSteps: 5, maxDollars: 0.20 }),
  });

  if (!res.ok) throw res.error;

  // Persist both the user message and assistant response
  await memory.add({ role: 'user', content: userMessage });
  await memory.add(res.value.message);

  return res.value.message.content;
}
```

## Multi-turn conversation

```ts
console.log(await chat("I'm building a REST API in TypeScript. What framework should I use?"));
// → "For TypeScript REST APIs, I'd recommend Express with type definitions..."

console.log(await chat("What about input validation? I want type-safe request parsing."));
// → "Since you're using Express, Zod works great for request validation..."
// (agent remembers "Express" from the previous turn)

console.log(await chat("Show me a minimal example with one endpoint."));
// → "Here's a minimal Express + Zod endpoint..."
// (agent remembers the full context)
```

## Inspect memory state

```ts
const currentMessages = await memory.messages();
console.log(`Messages in memory: ${currentMessages.length}`);

// Check if a summary exists (created after maxMessages is exceeded)
const hasSummary = currentMessages.some(m => m.role === 'system' && m.content.includes('Summary'));
console.log('Has summary:', hasSummary);
```

## How auto-summarization works

When `memory.messages()` returns more messages than `maxMessages`, the next call to `memory.add()` triggers a summarization:

1. An LLM call (using the `model` from options) summarizes the oldest messages
2. The summary is prepended as a system message
3. The oldest messages are dropped, keeping the last `keepLast` messages verbatim

This keeps the context window manageable for long conversations without losing important context.

## Persistent storage

For conversations that survive process restarts, serialize and restore memory:

```ts
// Save
const snapshot = await memory.export(); // returns serializable object
await fs.writeFile('memory.json', JSON.stringify(snapshot));

// Restore
const saved = JSON.parse(await fs.readFile('memory.json', 'utf-8'));
const memory = conversationMemory({ adapter, model: 'claude-haiku-4-5-20251001', maxMessages: 20, keepLast: 6 });
await memory.import(saved);
```

## See also

- [Memory](/features/memory) — full memory API
- [agent()](/primitives/agent) — agent loop
- [compress()](/features/compress) — alternative context management via message compression
````

- [ ] **Step 2: Commit**

```bash
git add docs/examples/memory-agent.md
git commit -m "docs(examples): add memory-backed agent example"
```

---

### Task 5: Create docs/examples/graph-workflow.md

**Files:**
- Create: `docs/examples/graph-workflow.md`

- [ ] **Step 1: Write the file**

Create `docs/examples/graph-workflow.md`:

````markdown
# Graph Workflow with Checkpointing

This example uses `@flint/graph` to build a 4-node workflow with a conditional branch and checkpoint-based resumption.

## What this demonstrates

- `graph()` — building a typed state-machine workflow
- Node definitions and edge conditions
- Fan-out and conditional branching
- `runStream()` events
- Checkpointing to resume after failure

## The workflow

```
start
  └── classify
        ├── [simple query] ──→ quick-answer ──→ end
        └── [complex query] ──→ research ──→ synthesize ──→ end
```

## Setup

```ts
import { graph } from '@flint/graph';
import { call } from 'flint';
import { budget } from 'flint/budget';
import { anthropicAdapter } from '@flint/adapter-anthropic';
import * as v from 'valibot';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });

type WorkflowState = {
  query: string;
  complexity?: 'simple' | 'complex';
  quickAnswer?: string;
  researchNotes?: string;
  finalAnswer?: string;
};
```

## Define nodes

```ts
async function classifyNode(state: WorkflowState): Promise<WorkflowState> {
  const res = await call({
    adapter,
    model: 'claude-haiku-4-5-20251001',
    messages: [
      { role: 'system', content: 'Classify the query as "simple" (factual, one-sentence answer) or "complex" (requires research). Reply with only the word.' },
      { role: 'user', content: state.query },
    ],
    schema: v.picklist(['simple', 'complex']),
  });
  if (!res.ok) throw res.error;
  return { ...state, complexity: res.value.value };
}

async function quickAnswerNode(state: WorkflowState): Promise<WorkflowState> {
  const res = await call({
    adapter,
    model: 'claude-haiku-4-5-20251001',
    messages: [{ role: 'user', content: state.query }],
  });
  if (!res.ok) throw res.error;
  return { ...state, finalAnswer: res.value.message.content };
}

async function researchNode(state: WorkflowState): Promise<WorkflowState> {
  const res = await call({
    adapter,
    model: 'claude-opus-4-7',
    messages: [
      { role: 'system', content: 'Research this topic thoroughly and produce detailed notes.' },
      { role: 'user', content: state.query },
    ],
  });
  if (!res.ok) throw res.error;
  return { ...state, researchNotes: res.value.message.content };
}

async function synthesizeNode(state: WorkflowState): Promise<WorkflowState> {
  const res = await call({
    adapter,
    model: 'claude-opus-4-7',
    messages: [
      { role: 'system', content: 'Synthesize the research notes into a clear, concise answer.' },
      { role: 'user', content: `Research notes:\n${state.researchNotes}\n\nOriginal question: ${state.query}` },
    ],
  });
  if (!res.ok) throw res.error;
  return { ...state, finalAnswer: res.value.message.content };
}
```

## Build the graph

```ts
const workflow = graph<WorkflowState>()
  .node('classify', classifyNode)
  .node('quick-answer', quickAnswerNode)
  .node('research', researchNode)
  .node('synthesize', synthesizeNode)
  // Conditional routing after classify
  .edge('classify', (state) => state.complexity === 'simple' ? 'quick-answer' : 'research')
  .edge('quick-answer', '__end__')
  .edge('research', 'synthesize')
  .edge('synthesize', '__end__')
  .start('classify');
```

## Run with event streaming

```ts
const initialState: WorkflowState = {
  query: 'What is the time complexity of quicksort in the worst case, and why?',
};

const events = workflow.runStream(initialState);

for await (const event of events) {
  switch (event.type) {
    case 'node_start':
      console.log(`→ ${event.node}`);
      break;
    case 'node_complete':
      console.log(`  ✓ ${event.node} (${event.duration}ms)`);
      if (event.node === 'classify') {
        console.log(`  complexity: ${event.state.complexity}`);
      }
      break;
    case 'workflow_complete':
      console.log('\nFinal answer:');
      console.log(event.state.finalAnswer);
      break;
    case 'workflow_error':
      console.error('Error at', event.node, ':', event.error.message);
      break;
  }
}
```

## Expected output

```
→ classify
  ✓ classify (340ms)
  complexity: complex
→ research
  ✓ research (2100ms)
→ synthesize
  ✓ synthesize (890ms)

Final answer:
Quicksort has O(n²) worst-case time complexity, which occurs when the pivot
selection consistently produces maximally unbalanced partitions...
```

## Checkpointing for resumption

```ts
import { writeFile, readFile } from 'node:fs/promises';

// Save checkpoint after each node
const events = workflow.runStream(initialState, {
  onCheckpoint: async (node, state) => {
    await writeFile(`checkpoint-${node}.json`, JSON.stringify(state));
  },
});

// Resume from a checkpoint after failure
const savedState = JSON.parse(await readFile('checkpoint-research.json', 'utf-8'));
const resumeEvents = workflow.runStream(savedState, { startFrom: 'synthesize' });
```

## See also

- [Graph](/features/graph) — full graph API
- [agent()](/primitives/agent) — simpler alternative for open-ended tasks
- [FAQ: When should I use graph vs agent()?](/guide/faq#when-should-i-use-flintgraph-vs-agent)
````

- [ ] **Step 2: Commit**

```bash
git add docs/examples/graph-workflow.md
git commit -m "docs(examples): add graph workflow with checkpointing example"
```

---

### Task 6: Add new examples to VitePress sidebar

**Files:**
- Modify: `docs/.vitepress/config.ts`

- [ ] **Step 1: Add 5 new entries to the examples sidebar**

In `docs/.vitepress/config.ts`, find the `/examples/` sidebar section and append:

```ts
{ text: 'Basic Call', link: '/examples/basic-call' },
{ text: 'Tool Use', link: '/examples/tools' },
{ text: 'Agent Loop', link: '/examples/agent' },
{ text: 'Streaming', link: '/examples/streaming' },
{ text: 'ReAct Pattern', link: '/examples/react-pattern' },
{ text: 'RAG Pipeline', link: '/examples/rag-pipeline' },
{ text: 'Multi-Agent (Landlord)', link: '/examples/multi-agent' },
{ text: 'Tool Approval Flow', link: '/examples/tool-approval' },
{ text: 'Memory-Backed Agent', link: '/examples/memory-agent' },
{ text: 'Graph Workflow', link: '/examples/graph-workflow' },
```

- [ ] **Step 2: Commit**

```bash
git add docs/.vitepress/config.ts
git commit -m "docs(config): add 5 new examples to sidebar"
```
