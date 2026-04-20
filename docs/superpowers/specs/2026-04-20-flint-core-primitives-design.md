# Flint Core Primitives — Design

**Date:** 2026-04-20
**Plan:** 2 of 10 (see `2026-04-20-flint-scaffold-design.md` §Implementation staging)
**Scope:** Replace stubs with real implementations for `call`, `stream`, `validate`, `execute`, `count`, add `approxCount` and `mockAdapter`. Budget remains stubbed.
**Status:** Approved, pending user review

## Goal

Make every primitive in `packages/flint/src/primitives/` work end-to-end against a `mockAdapter`, so later plans (agent loop, recipes, real provider adapters) can build on a verified runtime surface. After Plan 2, a user can call any provider by writing an adapter and get a functioning single-request pipeline with schema validation, streaming, token counting, and compress-transform support.

## Files touched

All under `packages/flint/`:

- **Modified** (stubs → real impl):
  - `src/primitives/call.ts`
  - `src/primitives/stream.ts`
  - `src/primitives/validate.ts`
  - `src/primitives/execute.ts`
  - `src/primitives/count.ts`
- **New:**
  - `src/primitives/approx-count.ts` — heuristic token counter, pure function
  - `src/testing/mock-adapter.ts` — adapter implementation for tests
- **Modified:**
  - `package.json` — add `./testing` subpath export
  - `tsup.config.ts` — add `src/testing/mock-adapter.ts` entry
  - `src/index.ts` — no change (same names exported); `flint/testing` is a separate subpath
- **New tests** (replace the single `test/primitives.test.ts` with per-primitive files):
  - `test/call.test.ts`
  - `test/stream.test.ts`
  - `test/validate.test.ts`
  - `test/execute.test.ts`
  - `test/count.test.ts`
  - `test/mock-adapter.test.ts`
- **Deleted:** `test/primitives.test.ts` (superseded by per-primitive tests)

Budget stays stubbed — its wiring and real semantics are Plan 3.

## `call` — single request primitive

### Contract

```typescript
async function call<T = unknown>(options: CallOptions): Promise<Result<CallOutput<T>>>
```

### Algorithm

```
1. Input check: options.adapter, options.model, options.messages must exist
   → missing: throw TypeError (programmer error, not Result)

2. Compress (optional):
   if options.compress:
     messages = await options.compress(options.messages, { budget: options.budget, model: options.model })
   else:
     messages = options.messages

3. Budget pre-check (optional):
   if options.budget: options.budget.assertNotExhausted()
     (stub throws NotImplementedError in Plan 2 — tests don't pass a budget)

4. Build request:
   req: NormalizedRequest = {
     model, messages,
     tools: options.tools,
     schema: options.schema,
     maxTokens, temperature, stopSequences,
     cache: options.cache,
     signal: options.signal,
   }
   (omit undefined fields to respect exactOptionalPropertyTypes)

5. Call adapter:
   try:
     resp = await options.adapter.call(req)
   catch (e):
     return Result.error(new AdapterError(e.message, { code: 'adapter.call_failed', cause: e }))

6. Budget post-consume (optional):
   if options.budget:
     options.budget.consume({ ...resp.usage, cost: resp.cost })

7. Schema validation (optional, only when no tool call returned):
   let value: T | undefined
   if options.schema and resp.stopReason !== 'tool_call':
     parsed: unknown
     try:
       parsed = JSON.parse(resp.message.content)
     catch (e):
       return Result.error(new ParseError('Response content is not JSON', {
         code: 'parse.response_json',
         cause: e,
       }))
     validated = await validate(parsed, options.schema)
     if !validated.ok:
       return Result.error(validated.error)
     value = validated.value

8. Return Result.ok({
     message: resp.message,
     value,
     usage: resp.usage,
     cost: resp.cost,
     stopReason: resp.stopReason,
   })
```

### Error categories

| Situation | Outcome |
|---|---|
| Missing adapter/model/messages | Throw `TypeError` |
| Adapter throws (network, 4xx, 5xx) | `Result.error(AdapterError)` |
| Schema validation fails | `Result.error(ValidationError)` |
| Response content not valid JSON (with schema) | `Result.error(ParseError)` code `parse.response_json` |
| Budget exhausted (Plan 3 wiring) | `Result.error(BudgetExhausted)` |
| Compress transform throws | Propagates (caller's responsibility — transforms are user code) |

### Rationale for schema-when-no-tool-call

When the model returns a tool call, content is typically empty or a preamble. Validating it against the user's schema would spuriously fail. The agent loop (`agent()`) calls `call` repeatedly until `stopReason === 'end'`, so schema validation on the final text-only response is the correct hook point. Users running a single `call` with tools and expecting structured output should inspect `stopReason` themselves.

## `stream` — streaming primitive

### Contract

```typescript
async function* stream(options: StreamOptions): AsyncIterable<StreamChunk>
```

### Algorithm

```
1. Input check + compress + budget pre-check: same as call (steps 1-3)

2. Build NormalizedRequest: same as call step 4

3. inner = options.adapter.stream(req)

4. for await (chunk of inner):
     if chunk.type === 'usage' and options.budget:
       options.budget.consume({ ...chunk.usage, cost: chunk.cost })
     yield chunk
```

### Error handling — throws, not Result

Async iterables can't carry `Result` in the same way as one-shot returns. `stream` throws on:
- Adapter iterator throws mid-stream
- Budget assertion fails (Plan 3)

Callers wrap the `for await` in `try/catch`. This is the **one primitive** that uses throws for runtime errors. Documented in the JSDoc.

### Schema validation in stream

Not performed by `stream`. Streaming + structured output is handled by a future recipe (deferred). Plan 2's `stream` is pass-through with budget accounting.

## `validate` — schema check

### Contract

```typescript
async function validate<T>(value: unknown, schema: StandardSchemaV1<T>): Promise<Result<T>>
```

### Algorithm

```
1. result = schema['~standard'].validate(value)
2. if result is a Promise: result = await result
3. if 'issues' in result:
     return Result.error(
       new ValidationError('Schema validation failed', {
         code: 'validation.failed',
         cause: result.issues,
       })
     )
4. return Result.ok(result.value)
```

Async by contract. Works with sync schemas (Zod parse is sync; `await` on a non-Promise is fine) and async schemas (Valibot async refinements, custom async validators).

## `execute` — run a tool

### Contract

```typescript
async function execute<Input, Output>(
  tool: Tool<Input, Output>,
  rawInput: unknown,
): Promise<Result<Output>>
```

### Algorithm

```
1. parsed = await validate(rawInput, tool.input)
2. if !parsed.ok:
     return Result.error(
       new ParseError('Tool input validation failed', {
         code: 'parse.tool_input',
         cause: parsed.error,
       })
     )
3. try:
     output = await tool.handler(parsed.value)
     return Result.ok(output)
   catch (e):
     return Result.error(
       new ToolError(`Tool "${tool.name}" handler threw`, {
         code: 'tool.handler_threw',
         cause: e,
       })
     )
```

## `count` and `approxCount`

### `count`

```typescript
function count(messages: Message[], model: string, adapter?: ProviderAdapter): number {
  if (adapter?.count) return adapter.count(messages, model);
  return approxCount(messages);
}
```

### `approxCount` (pure heuristic, own file `approx-count.ts`)

```
APPROX_CHARS_PER_TOKEN = 3.5
ROLE_OVERHEAD = 4      // tokens to represent "role: ..." wrapping

for each message in messages:
  total += ROLE_OVERHEAD
  if typeof content === 'string':
    total += ceil(content.length / APPROX_CHARS_PER_TOKEN)
  else if Array.isArray(content):
    for each part:
      if part.type === 'text': total += ceil(part.text.length / APPROX_CHARS_PER_TOKEN)
      else: total += 512  // image heuristic; most providers charge per-image flat
  if message.toolCalls:
    for each call:
      total += ROLE_OVERHEAD
      total += ceil(JSON.stringify(call.arguments).length / APPROX_CHARS_PER_TOKEN)

return total
```

Intentionally under-counts by ~10% so budgets err on the side of fitting rather than overflowing. Real adapters with `adapter.count` use provider-specific tokenizers.

## `mockAdapter`

### Subpath

Exported from `flint/testing`, not `flint`. Users import it only in test files:

```typescript
import { mockAdapter, scriptedAdapter } from 'flint/testing';
```

### Contract

```typescript
export type MockAdapter = ProviderAdapter & {
  calls: NormalizedRequest[];
};

export function mockAdapter(opts: {
  name?: string;
  capabilities?: AdapterCapabilities;
  onCall: (req: NormalizedRequest, callIndex: number) => NormalizedResponse | Promise<NormalizedResponse>;
  onStream?: (req: NormalizedRequest, callIndex: number) => AsyncIterable<StreamChunk>;
  count?: (messages: Message[], model: string) => number;
}): MockAdapter;

export function scriptedAdapter(
  responses: NormalizedResponse[],
  opts?: { name?: string; capabilities?: AdapterCapabilities },
): MockAdapter;
```

### Behavior

- `mockAdapter.calls` appends `req` on every `call()` or `stream()` invocation. Tests assert on this.
- `callIndex` starts at 0 and increments per `call` or `stream` invocation (they share the counter).
- Default `onStream`: takes `onCall(req, i)` response, yields `{ type: 'text', delta: <content> }` then `{ type: 'usage', usage }` then `{ type: 'end', reason: stopReason }`. Ignores tool calls (tests wanting streaming tool calls supply their own `onStream`).
- `scriptedAdapter(responses)` is sugar for `mockAdapter({ onCall: (_, i) => responses[i] ?? throw })`.

## Tests

Seven new test files under `packages/flint/test/`. Each covers behavior, not implementation. No real network. No provider SDKs.

### `call.test.ts`

- Happy path: `call({ adapter: mockAdapter({ onCall: () => res }), model, messages })` returns `Result.ok` with `res.message`, `res.usage`, `res.stopReason`
- Adapter throws → `Result.error(AdapterError)` with `code: 'adapter.call_failed'`, cause attached
- `schema` + `stopReason: 'end'` + JSON content matches schema → `Result.ok` with `value` populated
- `schema` + `stopReason: 'end'` + JSON content fails schema → `Result.error(ValidationError)`
- `schema` + `stopReason: 'end'` + non-JSON content → `Result.error(ParseError)` with `code: 'parse.response_json'`
- `schema` + `stopReason: 'tool_call'` → validation skipped; `value` is `undefined`; message's `toolCalls` preserved
- `compress` runs before adapter call: verify `mockAdapter.calls[0].messages` matches post-compress shape
- Missing `adapter` / `model` / `messages` → throws `TypeError` (programmer error)
- `signal` forwarded to adapter via `req.signal`

### `stream.test.ts`

- Happy path: yields chunks emitted by adapter, in order
- Adapter throws mid-stream → `for await` re-throws
- `compress` runs before first chunk yielded (verify via `adapter.calls[0]`)
- Aborting signal before first chunk: adapter sees it in `req.signal`

### `validate.test.ts`

- Sync schema returns value → `Result.ok(value)`
- Sync schema returns issues → `Result.error(ValidationError)` with issues in `cause`
- Async schema (returns Promise) → awaited, same Result semantics
- Schema that throws → propagates (user bug, not a Result case)

### `execute.test.ts`

- Valid input + handler returns value → `Result.ok(value)`
- Valid input + handler throws → `Result.error(ToolError)` with `code: 'tool.handler_threw'`, cause attached
- Invalid input → `Result.error(ParseError)` with `code: 'parse.tool_input'`; handler never invoked
- Handler returns promise → awaited correctly

### `count.test.ts`

- `count(messages, model)` with no adapter → returns `approxCount(messages)`
- `count(messages, model, adapter)` with `adapter.count` set → dispatches to adapter's count
- `count(messages, model, adapter)` with no `adapter.count` → falls back to `approxCount`
- `approxCount` on empty array → returns 0
- `approxCount` monotonic: adding messages never decreases the count
- `approxCount` on tool-call message: accounts for JSON-stringified arguments

### `mock-adapter.test.ts`

- `calls` history captures `req`s
- `callIndex` increments across `call` and `stream`
- `scriptedAdapter([a, b, c])` returns responses in order
- Default `onStream` emits expected chunk sequence for a text-only response
- `onStream` override is used when supplied

### Test infrastructure notes

- No `mockAdapter` → `mockAdapter` recursion: tests import `mockAdapter` from `flint/testing` via the source path `../src/testing/mock-adapter.ts` (no build step needed; test files use `.ts` imports like every other test in the scaffold).
- `test/primitives.test.ts` is deleted in this plan; its assertions are now spread across the six per-primitive files.

## Out of scope for Plan 2

- Budget implementation (Plan 3)
- `agent()` loop (Plan 3)
- Real provider adapters (Plans 8, 9)
- Streaming schema validation (future)
- Retry / backoff on adapter errors (not in spec — recipes territory)
- Structured logging (user-provided `logger` is threaded but no default logger ships)

## Success criteria

1. All primitives implemented; no `NotImplementedError` thrown for primitive functions (budget stubs still throw — that's Plan 3)
2. `pnpm --filter flint test` passes with 7 new test files, 40+ new tests
3. `pnpm --filter flint typecheck` zero errors
4. `pnpm --filter flint build` produces updated `dist/` with `testing/mock-adapter.js` under the new subpath
5. `flint/testing` is importable from a consumer via subpath export
6. No new runtime dependencies added to the `flint` package (still just `@standard-schema/spec` types-only)
