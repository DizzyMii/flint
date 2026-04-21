# @flint/adapter-openai-compat Implementation Design

**Date:** 2026-04-21
**Scope:** Replace the stub implementation with a full OpenAI Chat Completions adapter using pure `fetch`. Mirrors the structure of `@flint/adapter-anthropic`.

---

## Goal

Make `@flint/adapter-openai-compat` functional for any OpenAI-compatible endpoint (OpenAI, Groq, Together, DeepSeek, Ollama, etc.) by implementing `call()`, `stream()`, and omitting `count()` (falls back to `approxCount` in core).

---

## Architecture

Single `packages/adapter-openai-compat/src/index.ts`. Same internal structure as the Anthropic adapter:

1. **Internal OpenAI types** — private to the file, typed per the Chat Completions API
2. **`normalizeMessages()`** — converts Flint `Message[]` to OpenAI messages array
3. **`buildBody()`** — assembles the full request body
4. **`parseSSE()`** — parses OpenAI's SSE format (simpler than Anthropic's)
5. **`call()`** — non-streaming request/response
6. **`stream()`** — streaming request with SSE parsing

No `count` method on the adapter object — core falls back to `approxCount`.

---

## Message Normalization

Flint `Message` → OpenAI Chat Completions message. Key differences from the Anthropic adapter:

| Flint role | OpenAI shape |
|---|---|
| `system` | `{ role: 'system', content: string }` — stays **inline** (not hoisted to a separate field) |
| `user` (string) | `{ role: 'user', content: string }` |
| `user` (ContentPart[]) | `{ role: 'user', content: OpenAIContentPart[] }` — `image` → `image_url`, `image_b64` → data-URI `image_url` |
| `assistant` | `{ role: 'assistant', content: string \| null, tool_calls?: OpenAIToolCall[] }` — arguments serialized as JSON string |
| `tool` | `{ role: 'tool', content: string, tool_call_id: string }` |

Tool calls in assistant messages: `{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }`.

Image content parts:
- `{ type: 'image', url }` → `{ type: 'image_url', image_url: { url } }`
- `{ type: 'image_b64', data, mediaType }` → `{ type: 'image_url', image_url: { url: 'data:${mediaType};base64,${data}' } }`

---

## Request Body

```ts
{
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];         // { type: 'function', function: { name, description, parameters } }
  max_tokens?: number;
  temperature?: number;
  stop?: string[];
  stream?: boolean;
  stream_options?: { include_usage: true };  // needed to get usage in stream
}
```

Tools use `t.jsonSchema ?? { type: 'object' }` for `parameters`, mirroring Anthropic.

`stream_options: { include_usage: true }` is sent when streaming so usage tokens arrive in the final chunk.

---

## Stop Reason Mapping

| OpenAI `finish_reason` | Flint `StopReason` |
|---|---|
| `"stop"` | `"end"` |
| `"tool_calls"` | `"tool_call"` |
| `"length"` | `"max_tokens"` |
| `"content_filter"` | `"end"` |
| anything else | `"end"` |

---

## SSE Parsing

OpenAI SSE is simpler than Anthropic — only `data:` lines, no `event:` prefix:

```
data: {"id":"chatcmpl-x","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}
data: {"id":"chatcmpl-x","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}
data: [DONE]
```

`parseSSE()` yields parsed JSON objects, stops on `[DONE]`.

### Streaming tool calls

OpenAI sends tool call arguments incrementally across multiple deltas, keyed by `index`:

```
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"add","arguments":""}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"a\":"}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}}]}}]}
```

Same stash pattern as Anthropic: accumulate `args` string per `index`. Emit all stashed tool calls in index order when `finish_reason === 'tool_calls'` is seen — that is the definitive signal that all arguments have been fully streamed.

---

## Error Handling

Mirrors Anthropic adapter exactly:

- Network/fetch failure → `AdapterError('Network error', { code: 'adapter.network', cause: e })`
- Non-2xx response → parse `error.message` from body if present, fall back to `"OpenAI ${status}"` → `AdapterError(msg, { code: 'adapter.http.${status}' })`
- SSE `[DONE]` on error → `AdapterError` with `code: 'adapter.stream'`
- No response body on stream → `AdapterError('No response body', { code: 'adapter.network' })`

---

## Capabilities

```ts
capabilities: {
  promptCache: false,      // OpenAI has no prompt caching API; req.cache is ignored
  structuredOutput: true,  // structured output supported
  parallelTools: true,     // parallel tool calls supported
}
```

---

## Tests

Rewrite `packages/adapter-openai-compat/test/surface.test.ts` from 3 stub tests to ~25 behavior tests using mock `fetch`. Structure mirrors `@flint/adapter-anthropic/test/surface.test.ts`:

1. **Shape** — name, capabilities, no `count` method
2. **`call()` HTTP** — correct URL, Authorization header, Content-Type, custom `defaultHeaders`, custom `baseUrl`
3. **`call()` messages** — system inline, user string, user with image, assistant with tool calls, tool result message
4. **`call()` response** — text content, tool calls (parsed from JSON string), stop reasons, usage mapping
5. **`call()` errors** — HTTP 4xx/5xx with error body, network error, missing `choices`
6. **`stream()` basics** — text deltas, `end` chunk, usage chunk
7. **`stream()` tool calls** — argument accumulation across deltas, emits `tool_call` chunk
8. **`stream()` errors** — non-2xx before stream, no response body

---

## File Map

| File | Action |
|---|---|
| `packages/adapter-openai-compat/src/index.ts` | Full rewrite |
| `packages/adapter-openai-compat/test/surface.test.ts` | Full rewrite (3 → ~25 tests) |

No other files change. No new packages, no changes to `flint` core.
