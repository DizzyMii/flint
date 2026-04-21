# @flint/adapter-anthropic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a zero-dependency Anthropic HTTP adapter for Flint with prompt caching support via `fetch` and the Web Streams API.

**Architecture:** A single `anthropicAdapter(opts)` factory converts Flint `NormalizedRequest` → Anthropic `/v1/messages` body, posts over `fetch`, and maps the response (or SSE stream) back to Flint types. Prompt caching is injected when `req.cache === 'auto'` by attaching `cache_control` blocks to the system and/or last tool. The adapter has no `count` method — core falls back to `approxCount`.

**Tech Stack:** TypeScript (strict, ESM), Vitest, Web Fetch API, ReadableStream/TextDecoder SSE parsing, no new runtime dependencies.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/flint/src/types.ts` | Modify | Add `jsonSchema?: Record<string, unknown>` to `Tool` |
| `packages/flint/src/primitives/tool.ts` | Modify | Add `jsonSchema?` to `ToolSpec`, pass through in `tool()` |
| `packages/adapter-anthropic/src/index.ts` | Rewrite | Full adapter implementation |
| `packages/adapter-anthropic/test/surface.test.ts` | Rewrite | 25 behavior tests with mock fetch |

---

### Task 1: Add `jsonSchema` to `Tool` and `ToolSpec`

**Files:**
- Modify: `packages/flint/src/types.ts` (line 30-37)
- Modify: `packages/flint/src/primitives/tool.ts` (line 3-21)

- [ ] **Step 1: Add `jsonSchema?` to `Tool` type in `types.ts`**

In `packages/flint/src/types.ts`, change the `Tool` type from:

```ts
export type Tool<Input = unknown, Output = unknown> = {
  name: string;
  description: string;
  input: StandardSchemaV1<unknown, Input>;
  handler: (input: Input) => Promise<Output> | Output;
  permissions?: ToolPermissions;
  timeout?: number;
};
```

To:

```ts
export type Tool<Input = unknown, Output = unknown> = {
  name: string;
  description: string;
  input: StandardSchemaV1<unknown, Input>;
  handler: (input: Input) => Promise<Output> | Output;
  permissions?: ToolPermissions;
  timeout?: number;
  jsonSchema?: Record<string, unknown>;
};
```

- [ ] **Step 2: Add `jsonSchema?` to `ToolSpec` and pass through in `tool.ts`**

In `packages/flint/src/primitives/tool.ts`, change to:

```ts
import type { StandardSchemaV1, Tool, ToolPermissions } from '../types.ts';

export type ToolSpec<Input, Output> = {
  name: string;
  description: string;
  input: StandardSchemaV1<unknown, Input>;
  handler: (input: Input) => Promise<Output> | Output;
  permissions?: ToolPermissions;
  timeout?: number;
  jsonSchema?: Record<string, unknown>;
};

export function tool<Input, Output>(spec: ToolSpec<Input, Output>): Tool<Input, Output> {
  return {
    name: spec.name,
    description: spec.description,
    input: spec.input,
    handler: spec.handler,
    ...(spec.permissions !== undefined ? { permissions: spec.permissions } : {}),
    ...(spec.timeout !== undefined ? { timeout: spec.timeout } : {}),
    ...(spec.jsonSchema !== undefined ? { jsonSchema: spec.jsonSchema } : {}),
  };
}
```

- [ ] **Step 3: Run flint typecheck to verify no breakage**

Run: `npx pnpm@9.15.0 --filter flint typecheck`
Expected: Exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/flint/src/types.ts packages/flint/src/primitives/tool.ts
git commit -m "feat(flint): add optional jsonSchema to Tool for adapter-specific schema needs"
```

---

### Task 2: Write Failing Tests for the Anthropic Adapter

**Files:**
- Rewrite: `packages/adapter-anthropic/test/surface.test.ts`

- [ ] **Step 1: Replace surface.test.ts with full behavior test suite**

Write `packages/adapter-anthropic/test/surface.test.ts`:

```ts
import { AdapterError } from 'flint/errors';
import { describe, expect, it, vi } from 'vitest';
import { anthropicAdapter } from '../src/index.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof globalThis.fetch;
}

function mockFetchText(status: number, text: string): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue(
    new Response(text, {
      status,
      headers: { 'content-type': 'text/plain' },
    }),
  ) as unknown as typeof globalThis.fetch;
}

function makeStreamFetch(sseText: string): typeof globalThis.fetch {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(sseText);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return vi.fn().mockResolvedValue(
    new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }),
  ) as unknown as typeof globalThis.fetch;
}

function makeErrorStreamFetch(status: number, body: string): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue(
    new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof globalThis.fetch;
}

const OK_RESPONSE = {
  id: 'msg_01',
  type: 'message',
  role: 'assistant',
  content: [{ type: 'text', text: 'Hello!' }],
  model: 'claude-3-5-haiku-20241022',
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5 },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('anthropicAdapter — capabilities', () => {
  it('has name "anthropic"', () => {
    const a = anthropicAdapter({ apiKey: 'test' });
    expect(a.name).toBe('anthropic');
  });

  it('capabilities: promptCache, structuredOutput, parallelTools all true', () => {
    const a = anthropicAdapter({ apiKey: 'test' });
    expect(a.capabilities).toEqual({
      promptCache: true,
      structuredOutput: true,
      parallelTools: true,
    });
  });

  it('count method is undefined', () => {
    const a = anthropicAdapter({ apiKey: 'test' });
    expect(a.count).toBeUndefined();
  });
});

describe('anthropicAdapter — call: request shape', () => {
  it('POSTs to /v1/messages with correct URL and method', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'sk-test', fetch: fetchFn });
    await a.call({ model: 'claude-3-5-haiku-20241022', messages: [] });
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.method).toBe('POST');
  });

  it('sends anthropic-version and x-api-key headers', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'sk-my-key', fetch: fetchFn });
    await a.call({ model: 'claude-3-5-haiku-20241022', messages: [] });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['x-api-key']).toBe('sk-my-key');
    expect(headers['content-type']).toBe('application/json');
  });

  it('uses custom baseUrl when provided', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', baseUrl: 'https://proxy.example.com', fetch: fetchFn });
    await a.call({ model: 'm', messages: [] });
    const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://proxy.example.com/v1/messages');
  });

  it('uses custom fetch when provided', async () => {
    const customFetch = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: customFetch });
    await a.call({ model: 'm', messages: [] });
    expect(customFetch).toHaveBeenCalledOnce();
  });

  it('system messages joined into Anthropic system string', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    await a.call({
      model: 'm',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'system', content: 'Be concise.' },
      ],
    });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe('You are helpful.\nBe concise.');
  });

  it('user message with string content maps to text block', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    await a.call({
      model: 'm',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]);
  });

  it('user message with ContentPart[] maps to text + image blocks', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    await a.call({
      model: 'm',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Look at this' },
            { type: 'image', url: 'https://example.com/img.png' },
          ],
        },
      ],
    });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'Look at this' },
      { type: 'image', source: { type: 'url', url: 'https://example.com/img.png' } },
    ]);
  });

  it('assistant message with toolCalls maps to text + tool_use blocks', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    await a.call({
      model: 'm',
      messages: [
        {
          role: 'assistant',
          content: 'Using tool',
          toolCalls: [{ id: 'tc_1', name: 'search', arguments: { q: 'cats' } }],
        },
      ],
    });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Using tool' },
        { type: 'tool_use', id: 'tc_1', name: 'search', input: { q: 'cats' } },
      ],
    });
  });

  it('tool message maps to user role with tool_result block', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    await a.call({
      model: 'm',
      messages: [{ role: 'tool', content: '{"result":42}', toolCallId: 'tc_1' }],
    });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'tc_1', content: '{"result":42}' }],
    });
  });

  it('max_tokens defaults to 4096 when not provided', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    await a.call({ model: 'm', messages: [] });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBe(4096);
  });

  it('tools include input_schema from jsonSchema, fallback to {type:object}', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    const tools = [
      {
        name: 'search',
        description: 'Search the web',
        input: { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: {} }) } } as never,
        handler: async () => 'result',
        jsonSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
      },
      {
        name: 'noop',
        description: 'Does nothing',
        input: { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: {} }) } } as never,
        handler: async () => null,
        // no jsonSchema — should fallback
      },
    ];
    await a.call({ model: 'm', messages: [], tools });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.tools[0].input_schema).toEqual({
      type: 'object',
      properties: { q: { type: 'string' } },
      required: ['q'],
    });
    expect(body.tools[1].input_schema).toEqual({ type: 'object' });
  });
});

describe('anthropicAdapter — call: prompt caching', () => {
  it('cache:auto wraps system as array with cache_control block', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    await a.call({
      model: 'm',
      messages: [{ role: 'system', content: 'Be helpful.' }],
      cache: 'auto',
    });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.system).toEqual([
      { type: 'text', text: 'Be helpful.', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('cache:auto adds cache_control to last tool definition', async () => {
    const fetchFn = mockFetch(200, OK_RESPONSE);
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    const tools = [
      {
        name: 'tool1',
        description: 'First tool',
        input: { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: {} }) } } as never,
        handler: async () => null,
      },
      {
        name: 'tool2',
        description: 'Second tool',
        input: { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: {} }) } } as never,
        handler: async () => null,
      },
    ];
    await a.call({ model: 'm', messages: [], tools, cache: 'auto' });
    const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.tools[0].cache_control).toBeUndefined();
    expect(body.tools[1].cache_control).toEqual({ type: 'ephemeral' });
  });
});

describe('anthropicAdapter — call: response mapping', () => {
  it('text-only response: message.content is joined string, no toolCalls', async () => {
    const fetchFn = mockFetch(200, {
      ...OK_RESPONSE,
      content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'World' }],
      stop_reason: 'end_turn',
    });
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    const result = await a.call({ model: 'm', messages: [] });
    expect(result.message.content).toBe('Hello World');
    expect(result.message.toolCalls).toBeUndefined();
  });

  it('response with tool_use blocks: toolCalls populated, stopReason tool_call', async () => {
    const fetchFn = mockFetch(200, {
      ...OK_RESPONSE,
      content: [
        { type: 'text', text: 'Using search' },
        { type: 'tool_use', id: 'tu_1', name: 'search', input: { q: 'dogs' } },
      ],
      stop_reason: 'tool_use',
    });
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    const result = await a.call({ model: 'm', messages: [] });
    expect(result.message.toolCalls).toEqual([{ id: 'tu_1', name: 'search', arguments: { q: 'dogs' } }]);
    expect(result.stopReason).toBe('tool_call');
  });

  it('stop_reason end_turn → stopReason end', async () => {
    const fetchFn = mockFetch(200, { ...OK_RESPONSE, stop_reason: 'end_turn' });
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    const result = await a.call({ model: 'm', messages: [] });
    expect(result.stopReason).toBe('end');
  });

  it('stop_reason max_tokens → stopReason max_tokens', async () => {
    const fetchFn = mockFetch(200, { ...OK_RESPONSE, stop_reason: 'max_tokens' });
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    const result = await a.call({ model: 'm', messages: [] });
    expect(result.stopReason).toBe('max_tokens');
  });

  it('usage: input_tokens/output_tokens → input/output; cache tokens → cached', async () => {
    const fetchFn = mockFetch(200, {
      ...OK_RESPONSE,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 30,
        cache_read_input_tokens: 20,
      },
    });
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    const result = await a.call({ model: 'm', messages: [] });
    expect(result.usage).toEqual({ input: 100, output: 50, cached: 50 });
  });

  it('HTTP 429 throws AdapterError with code adapter.http.429', async () => {
    const fetchFn = mockFetchText(429, 'rate limited');
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    await expect(a.call({ model: 'm', messages: [] })).rejects.toThrow(AdapterError);
    await expect(a.call({ model: 'm', messages: [] })).rejects.toMatchObject({
      code: 'adapter.http.429',
    });
  });

  it('HTTP 500 throws AdapterError with code adapter.http.500', async () => {
    const fetchFn = mockFetchText(500, 'internal error');
    const a = anthropicAdapter({ apiKey: 'k', fetch: fetchFn });
    await expect(a.call({ model: 'm', messages: [] })).rejects.toThrow(AdapterError);
    await expect(a.call({ model: 'm', messages: [] })).rejects.toMatchObject({
      code: 'adapter.http.500',
    });
  });
});

describe('anthropicAdapter — stream', () => {
  function buildSSE(events: Array<{ event: string; data: unknown }>): string {
    return events.map(e => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('');
  }

  const baseStreamEvents = [
    { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } } },
    { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
  ];

  const baseStreamEnd = (inputTokens: number, outputTokens: number) => [
    { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
    { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: outputTokens } } },
    { event: 'message_stop', data: { type: 'message_stop' } },
  ];

  it('stream parses text_delta events into text chunks in order', async () => {
    const sseText = buildSSE([
      ...baseStreamEvents,
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' World' } } },
      ...baseStreamEnd(10, 2),
    ]);
    const a = anthropicAdapter({ apiKey: 'k', fetch: makeStreamFetch(sseText) });
    const chunks: unknown[] = [];
    for await (const chunk of a.stream({ model: 'm', messages: [] })) {
      chunks.push(chunk);
    }
    const textChunks = chunks.filter((c: unknown) => (c as { type: string }).type === 'text');
    expect(textChunks).toEqual([
      { type: 'text', delta: 'Hello' },
      { type: 'text', delta: ' World' },
    ]);
  });

  it('stream parses tool_use: content_block_start + input_json_delta + content_block_stop → tool_call chunk', async () => {
    const sseText = buildSSE([
      { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 20, output_tokens: 0 } } } },
      { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tu_42', name: 'search', input: {} } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"q":' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '"cats"}' } } },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
      { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 10 } } },
      { event: 'message_stop', data: { type: 'message_stop' } },
    ]);
    const a = anthropicAdapter({ apiKey: 'k', fetch: makeStreamFetch(sseText) });
    const chunks: unknown[] = [];
    for await (const chunk of a.stream({ model: 'm', messages: [] })) {
      chunks.push(chunk);
    }
    const toolChunks = chunks.filter((c: unknown) => (c as { type: string }).type === 'tool_call');
    expect(toolChunks).toEqual([
      { type: 'tool_call', call: { id: 'tu_42', name: 'search', arguments: { q: 'cats' } } },
    ]);
  });

  it('stream emits usage and end chunks on message_stop', async () => {
    const sseText = buildSSE([
      ...baseStreamEvents,
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } } },
      ...baseStreamEnd(10, 5),
    ]);
    const a = anthropicAdapter({ apiKey: 'k', fetch: makeStreamFetch(sseText) });
    const chunks: unknown[] = [];
    for await (const chunk of a.stream({ model: 'm', messages: [] })) {
      chunks.push(chunk);
    }
    const usageChunk = chunks.find((c: unknown) => (c as { type: string }).type === 'usage');
    const endChunk = chunks.find((c: unknown) => (c as { type: string }).type === 'end');
    expect(usageChunk).toMatchObject({ type: 'usage', usage: { output: 5 } });
    expect(endChunk).toEqual({ type: 'end', reason: 'end' });
  });

  it('stream throws AdapterError on 4xx response', async () => {
    const a = anthropicAdapter({ apiKey: 'k', fetch: makeErrorStreamFetch(401, '{"error":"unauthorized"}') });
    await expect(async () => {
      for await (const _ of a.stream({ model: 'm', messages: [] })) { /* empty */ }
    }).rejects.toThrow(AdapterError);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (stub throws NotImplementedError)**

Run: `npx pnpm@9.15.0 --filter @flint/adapter-anthropic test`
Expected: Many failures — tests expect real behavior but stubs throw `NotImplementedError`.

---

### Task 3: Implement `packages/adapter-anthropic/src/index.ts`

**Files:**
- Rewrite: `packages/adapter-anthropic/src/index.ts`

- [ ] **Step 1: Write the full implementation**

Write `packages/adapter-anthropic/src/index.ts`:

```ts
import { AdapterError } from 'flint/errors';
import type {
  NormalizedRequest,
  NormalizedResponse,
  ProviderAdapter,
} from 'flint';
import type { ContentPart, StopReason, StreamChunk, ToolCall, Usage } from 'flint';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

export type AnthropicAdapterOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

// ─── Anthropic wire types ─────────────────────────────────────────────────────

type AnthropicCacheControl = { type: 'ephemeral' };

type AnthropicTextBlock = { type: 'text'; text: string; cache_control?: AnthropicCacheControl };
type AnthropicImageBlock = { type: 'image'; source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string } };
type AnthropicToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
type AnthropicToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string };

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  cache_control?: AnthropicCacheControl;
};

type AnthropicSystemBlock = { type: 'text'; text: string; cache_control?: AnthropicCacheControl };
type AnthropicSystem = string | AnthropicSystemBlock[];

type AnthropicBody = {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: AnthropicSystem;
  tools?: AnthropicTool[];
  temperature?: number;
  stop_sequences?: string[];
  stream?: boolean;
};

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

type AnthropicResponseBody = {
  id: string;
  type: string;
  role: string;
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
  >;
  model: string;
  stop_reason: string;
  usage: AnthropicUsage;
};

// ─── SSE event types ──────────────────────────────────────────────────────────

type SSEMessageStartData = { type: 'message_start'; message: { usage: { input_tokens: number; output_tokens: number } } };
type SSEContentBlockStartData = { type: 'content_block_start'; index: number; content_block: { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown } };
type SSEContentBlockDeltaData = { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string } };
type SSEContentBlockStopData = { type: 'content_block_stop'; index: number };
type SSEMessageDeltaData = { type: 'message_delta'; delta: { stop_reason: string; stop_sequence: string | null }; usage: { output_tokens: number } };
type SSEMessageStopData = { type: 'message_stop' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapStopReason(raw: string): StopReason {
  if (raw === 'end_turn') return 'end';
  if (raw === 'tool_use') return 'tool_call';
  if (raw === 'max_tokens') return 'max_tokens';
  if (raw === 'stop_sequence') return 'stop_sequence';
  return 'end';
}

function mapContentPartToBlock(part: ContentPart): AnthropicContentBlock {
  if (part.type === 'text') {
    return { type: 'text', text: part.text };
  }
  if (part.type === 'image') {
    return { type: 'image', source: { type: 'url', url: part.url } };
  }
  // image_b64
  return { type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.data } };
}

function buildBody(req: NormalizedRequest, stream: boolean): AnthropicBody {
  const messages: AnthropicMessage[] = [];
  const systemParts: string[] = [];

  for (const msg of req.messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
      continue;
    }
    if (msg.role === 'user') {
      const content: AnthropicContentBlock[] =
        typeof msg.content === 'string'
          ? [{ type: 'text', text: msg.content }]
          : msg.content.map(mapContentPartToBlock);
      messages.push({ role: 'user', content });
      continue;
    }
    if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const blocks: AnthropicContentBlock[] = [{ type: 'text', text: msg.content }];
        for (const tc of msg.toolCalls) {
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
        }
        messages.push({ role: 'assistant', content: blocks });
      } else {
        messages.push({ role: 'assistant', content: msg.content });
      }
      continue;
    }
    if (msg.role === 'tool') {
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: msg.toolCallId, content: msg.content }],
      });
      continue;
    }
  }

  const body: AnthropicBody = {
    model: req.model,
    max_tokens: req.maxTokens ?? 4096,
    messages,
    stream,
  };

  if (req.temperature !== undefined) {
    body.temperature = req.temperature;
  }
  if (req.stopSequences !== undefined && req.stopSequences.length > 0) {
    body.stop_sequences = req.stopSequences;
  }

  // System
  if (systemParts.length > 0) {
    const systemText = systemParts.join('\n');
    if (req.cache === 'auto') {
      body.system = [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }];
    } else {
      body.system = systemText;
    }
  }

  // Tools
  if (req.tools && req.tools.length > 0) {
    const tools: AnthropicTool[] = req.tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.jsonSchema ?? { type: 'object' },
    }));

    if (req.cache === 'auto' && tools.length > 0) {
      const lastIdx = tools.length - 1;
      const last = tools[lastIdx];
      if (last !== undefined) {
        tools[lastIdx] = { ...last, cache_control: { type: 'ephemeral' } };
      }
    }

    body.tools = tools;
  }

  return body;
}

function mapUsage(raw: AnthropicUsage): Usage {
  const cached = (raw.cache_creation_input_tokens ?? 0) + (raw.cache_read_input_tokens ?? 0);
  const usage: Usage = { input: raw.input_tokens, output: raw.output_tokens };
  if (cached > 0) {
    usage.cached = cached;
  }
  return usage;
}

// ─── Adapter factory ──────────────────────────────────────────────────────────

export function anthropicAdapter(opts: AnthropicAdapterOptions): ProviderAdapter {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = {
    'anthropic-version': ANTHROPIC_VERSION,
    'x-api-key': opts.apiKey,
    'content-type': 'application/json',
  };

  return {
    name: 'anthropic',
    capabilities: { promptCache: true, structuredOutput: true, parallelTools: true },

    async call(req: NormalizedRequest): Promise<NormalizedResponse> {
      const body = buildBody(req, false);
      const resp = await fetchFn(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new AdapterError(`Anthropic ${resp.status}: ${text}`, {
          code: `adapter.http.${resp.status}`,
        });
      }

      const data = (await resp.json()) as AnthropicResponseBody;

      const textParts: string[] = [];
      const toolCalls: ToolCall[] = [];

      for (const block of data.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          toolCalls.push({ id: block.id, name: block.name, arguments: block.input });
        }
      }

      const message: NormalizedResponse['message'] = {
        role: 'assistant',
        content: textParts.join(''),
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      };

      return {
        message,
        usage: mapUsage(data.usage),
        stopReason: mapStopReason(data.stop_reason),
      };
    },

    async *stream(req: NormalizedRequest): AsyncIterable<StreamChunk> {
      const body = buildBody(req, true);
      const resp = await fetchFn(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new AdapterError(`Anthropic ${resp.status}: ${text}`, {
          code: `adapter.http.${resp.status}`,
        });
      }

      if (!resp.body) {
        throw new AdapterError('Anthropic stream: no response body', { code: 'adapter.stream.nobody' });
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Track state for tool_use blocks accumulation
      const toolBlocks = new Map<number, { id: string; name: string }>();
      const toolJsonBuffers = new Map<number, string>();
      let finalInputTokens = 0;
      let finalOutputTokens = 0;
      let finalStopReason = 'end_turn';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 2);

          // Parse event name and data
          let eventName = '';
          let dataLine = '';

          for (const line of chunk.split('\n')) {
            if (line.startsWith('event: ')) {
              eventName = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataLine = line.slice(6).trim();
            }
          }

          if (!dataLine) continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (eventName === 'message_start') {
            const d = parsed as SSEMessageStartData;
            finalInputTokens = d.message.usage.input_tokens;
          } else if (eventName === 'content_block_start') {
            const d = parsed as SSEContentBlockStartData;
            if (d.content_block.type === 'tool_use') {
              const tb = d.content_block as { type: 'tool_use'; id: string; name: string };
              toolBlocks.set(d.index, { id: tb.id, name: tb.name });
              toolJsonBuffers.set(d.index, '');
            }
          } else if (eventName === 'content_block_delta') {
            const d = parsed as SSEContentBlockDeltaData;
            if (d.delta.type === 'text_delta') {
              yield { type: 'text', delta: d.delta.text };
            } else if (d.delta.type === 'input_json_delta') {
              const existing = toolJsonBuffers.get(d.index) ?? '';
              toolJsonBuffers.set(d.index, existing + d.delta.partial_json);
            }
          } else if (eventName === 'content_block_stop') {
            const d = parsed as SSEContentBlockStopData;
            const tool = toolBlocks.get(d.index);
            if (tool !== undefined) {
              const rawJson = toolJsonBuffers.get(d.index) ?? '';
              let args: unknown = {};
              try {
                args = JSON.parse(rawJson);
              } catch {
                args = {};
              }
              yield { type: 'tool_call', call: { id: tool.id, name: tool.name, arguments: args } };
              toolBlocks.delete(d.index);
              toolJsonBuffers.delete(d.index);
            }
          } else if (eventName === 'message_delta') {
            const d = parsed as SSEMessageDeltaData;
            finalOutputTokens = d.usage.output_tokens;
            finalStopReason = d.delta.stop_reason;
          } else if (eventName === 'message_stop') {
            const usage: Usage = { input: finalInputTokens, output: finalOutputTokens };
            yield { type: 'usage', usage };
            yield { type: 'end', reason: mapStopReason(finalStopReason) };
            return;
          }
        }
      }
    },
  };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx pnpm@9.15.0 --filter @flint/adapter-anthropic test`
Expected: All tests pass.

- [ ] **Step 3: Run typecheck**

Run: `npx pnpm@9.15.0 --filter @flint/adapter-anthropic typecheck`
Expected: Exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/adapter-anthropic/src/index.ts packages/adapter-anthropic/test/surface.test.ts
git commit -m "feat(adapter-anthropic): implement Anthropic HTTP adapter with prompt caching"
```

---

### Task 4: Full Repo Verify + Lint + Build + Tag

**Files:** No new files.

- [ ] **Step 1: Run full repo test suite**

Run: `npx pnpm@9.15.0 test`
Expected: All tests pass (284 + new adapter tests).

- [ ] **Step 2: Run full repo typecheck**

Run: `npx pnpm@9.15.0 typecheck`
Expected: Exit 0, no errors.

- [ ] **Step 3: Run full repo lint**

Run: `npx pnpm@9.15.0 lint`
Expected: Exit 0, no errors. If lint fails, run `npx pnpm@9.15.0 format` and commit as `style: biome fixes for plan 9`.

- [ ] **Step 4: Build the adapter**

Run: `npx pnpm@9.15.0 --filter @flint/adapter-anthropic build`
Expected: `packages/adapter-anthropic/dist/index.js` is created.

- [ ] **Step 5: Tag the release**

```bash
git tag -a v0.8.0 -m "v0.8.0 — @flint/adapter-anthropic with prompt caching"
```

Do NOT push.
