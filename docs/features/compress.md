# Compress & Pipeline

Reduce token count and shape message history before each LLM call.

A `Transform` is a function `(messages, ctx) => Promise<Message[]>`. Flint ships six built-in transforms. Combine them with `pipeline()`.

## Importing

```ts
import {
  pipeline,
  dedup,
  truncateToolResults,
  windowLast,
  windowFirst,
  summarize,
  orderForCache,
} from 'flint/compress';
```

## Transform type

```ts
type Transform = (messages: Message[], ctx: CompressCtx) => Promise<Message[]>;

type CompressCtx = {
  budget?: { remaining(): { tokens?: number } };
  model?: string;
};
```

## pipeline()

Compose transforms sequentially. Each transform receives the output of the previous one.

```ts
const compress = pipeline(
  dedup(),
  truncateToolResults({ maxChars: 2000 }),
  windowLast({ keep: 20 }),
);

const res = await call({ ..., compress });
```

## Built-in transforms

### dedup()

Remove duplicate messages (same role + content). System messages are always kept.

```ts
dedup(): Transform
```

### truncateToolResults(opts)

Truncate tool result messages that exceed `maxChars` characters.

```ts
truncateToolResults(opts: { maxChars: number }): Transform
```

`maxChars` must be > 50. Truncated messages get a suffix: `…[truncated, N chars dropped]`.

### windowLast(opts)

Keep only the last `keep` non-system messages, plus any messages matching `alwaysKeep` roles.

```ts
windowLast(opts: { keep: number; alwaysKeep?: Role[] }): Transform
```

### windowFirst(opts)

Keep only the first `keep` non-system messages, plus `alwaysKeep` roles.

```ts
windowFirst(opts: { keep: number; alwaysKeep?: Role[] }): Transform
```

### orderForCache()

Reorder messages to maximize prompt cache hit rate (system messages first, then history, then new user turn last). Use with prompt-cache-aware adapters.

```ts
orderForCache(): Transform
```

### summarize(opts)

Summarize older messages to reduce history length using an LLM call.

```ts
type SummarizeOpts = {
  when: (messages: Message[]) => boolean;
  adapter: ProviderAdapter;
  model: string;
  keepLast?: number;       // default: 4
  promptPrefix?: string;   // override the summarization prompt
};

summarize(opts: SummarizeOpts): Transform
```

`when` controls the trigger condition. `keepLast` controls how many recent messages are preserved in full after summarization.

## Example — full pipeline

```ts
import { pipeline, dedup, truncateToolResults, windowLast, orderForCache } from 'flint/compress';
import { agent } from 'flint';
import { budget } from 'flint/budget';

const compress = pipeline(
  dedup(),
  truncateToolResults({ maxChars: 4000 }),
  windowLast({ keep: 30, alwaysKeep: ['system'] }),
  orderForCache(),
);

const out = await agent({
  adapter,
  model: 'claude-opus-4-7',
  messages,
  tools,
  budget: budget({ maxSteps: 20, maxDollars: 1.00 }),
  compress,
});
```

## Writing a custom transform

```ts
import type { Transform } from 'flint/compress';

const redactSecrets: Transform = async (messages) => {
  return messages.map((msg) => ({
    ...msg,
    content: typeof msg.content === 'string'
      ? msg.content.replace(/sk-[a-z0-9]+/g, '[REDACTED]')
      : msg.content,
  }));
};
```

## compress() pipeline signature

```ts
type Transform = (messages: Message[], ctx: CompressCtx) => Promise<Message[]> | Message[];
type CompressCtx = { budget?: Budget; model: string };
```

## Available transforms

| Transform | Description |
|-----------|-------------|
| `dedup()` | Remove consecutive duplicate messages |
| `windowLast(n)` | Keep only the last N messages |
| `windowFirst(n)` | Keep the first N messages (preserve system prompt) |
| `truncateToolResults(maxLen)` | Truncate tool result content to maxLen characters |
| `orderForCache()` | Re-order messages to maximize cache hits (system prompt first, stable content before dynamic) |
| `summarize(adapter, model)` | Replace old messages with an LLM-generated summary |

## pipeline() combinator

Chain multiple transforms with `pipeline()`:

```ts
import { pipeline, dedup, truncateToolResults, orderForCache } from 'flint/compress';

const compress = pipeline(
  dedup(),
  truncateToolResults(2000),
  orderForCache(),
);

const res = await call({ ..., compress });
```

Transforms run left-to-right. Each receives the output of the previous.

## orderForCache() and prompt caching

`orderForCache()` moves the system message and static tool definitions to the top of the message list, where the Anthropic adapter adds cache breakpoints. Use it when you have a large, stable system prompt.

## truncateToolResults() for large tool outputs

Large tool results (HTML pages, file contents, API responses) can fill the context window. Truncate them:

```ts
import { truncateToolResults } from 'flint/compress';

const compress = truncateToolResults(4000); // keep first 4000 chars of each tool result
```

## Common mistakes

::: warning summarize() makes an LLM call
`summarize()` sends a request to the LLM to produce the summary. It consumes tokens and costs money. Don't use it in every call — use it when the message list grows past a threshold.
:::

## See also

- [Memory](/features/memory) — higher-level memory with auto-summarization
- [call()](/primitives/call) — compress option
- [agent()](/primitives/agent) — compress option applies to every step
