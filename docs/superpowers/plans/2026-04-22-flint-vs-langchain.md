# Flint vs LangChain README Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `## Flint vs LangChain` section to `README.md` with a narrative block and four side-by-side code comparisons (install, basic call, tool definition, agent loop).

**Architecture:** Single file edit to `README.md`. New section inserted between `## Packages` table and `## Why Flint`. No tests — this is documentation only.

**Tech Stack:** Markdown, TypeScript code blocks (illustrative, not executed)

---

### Task 1: Add the Flint vs LangChain section to README.md

**Files:**
- Modify: `README.md` — insert new section between the `## Packages` table and `## Why Flint`

- [ ] **Step 1: Insert the narrative heading and paragraph**

In `README.md`, immediately before the line `## Why Flint`, insert:

```
## Flint vs LangChain

LangChain models everything as a class hierarchy — LLMs, chains, tools, and agents are objects you instantiate and compose. You learn LangChain's abstractions, then use them to talk to models. Flint is plain async functions: `call`, `tool`, `agent`. You learn the provider API once; Flint adds thin, well-typed helpers on top. LangChain's modular package system means installing 3+ packages with dozens of transitive dependencies per provider; Flint has one runtime dependency (`@standard-schema/spec`). Where LangChain throws on errors, Flint returns `Result<T>` — no try/catch at call sites.
```

- [ ] **Step 2: Add the Install comparison**

Immediately after the narrative paragraph, insert:

```
### Install

**LangChain**
```sh
npm install langchain @langchain/anthropic @langchain/core
```

**Flint**
```sh
npm install flint @flint/adapter-anthropic
```
```

- [ ] **Step 3: Add the Basic LLM call comparison**

After the Install section, insert:

```
### Basic LLM call

**LangChain**
```ts
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';

const llm = new ChatAnthropic({
  model: 'claude-opus-4-7',
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const res = await llm.invoke([new HumanMessage('What is the capital of France?')]);
console.log(res.content); // "Paris"
```

**Flint**
```ts
import { call } from 'flint';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
const res = await call({
  adapter,
  model: 'claude-opus-4-7',
  messages: [{ role: 'user', content: 'What is the capital of France?' }],
});
if (res.ok) console.log(res.value.message.content); // "Paris"
```
```

- [ ] **Step 4: Add the Tool definition comparison**

After the Basic LLM call section, insert:

```
### Tool definition

**LangChain**
```ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const add = tool(({ a, b }) => String(a + b), {
  name: 'add',
  description: 'Add two numbers',
  schema: z.object({ a: z.number(), b: z.number() }),
});
```

**Flint**
```ts
import { tool } from 'flint';
import * as v from 'valibot'; // any Standard Schema library works

const add = tool({
  name: 'add',
  description: 'Add two numbers',
  input: v.object({ a: v.number(), b: v.number() }),
  handler: ({ a, b }) => a + b,
});
```
```

- [ ] **Step 5: Add the Agent loop comparison**

After the Tool definition section, insert:

```
### Agent loop

**LangChain**
```ts
import { ChatAnthropic } from '@langchain/anthropic';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

const llm = new ChatAnthropic({ model: 'claude-opus-4-7' });
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant.'],
  ['placeholder', '{chat_history}'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);
const agent = createToolCallingAgent({ llm, tools: [add], prompt });
const executor = new AgentExecutor({ agent, tools: [add] });
const result = await executor.invoke({ input: 'What is 123 + 456?' });
console.log(result.output); // "579"
```

**Flint**
```ts
import { agent } from 'flint';
import { budget } from 'flint/budget';

const out = await agent({
  adapter,
  model: 'claude-opus-4-7',
  messages: [{ role: 'user', content: 'What is 123 + 456?' }],
  tools: [add],
  budget: budget({ maxSteps: 5, maxDollars: 0.10 }),
});
if (out.ok) console.log(out.value.message.content); // "579"
```
```

- [ ] **Step 6: Verify structure**

Confirm `README.md` now has this order:

```
## Packages
(table)

## Flint vs LangChain
(narrative paragraph)

### Install
(LangChain block, Flint block)

### Basic LLM call
(LangChain block, Flint block)

### Tool definition
(LangChain block, Flint block)

### Agent loop
(LangChain block, Flint block)

## Why Flint
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs(readme): add Flint vs LangChain comparison section"
```
