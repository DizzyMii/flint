# count()

Count tokens in a message array.

`count()` delegates to the adapter's token counter when available, and falls back to `approxCount()` — a heuristic based on character length — when the adapter does not implement counting.

## Signature

```ts
function count(
  messages: Message[],
  model: string,
  adapter?: ProviderAdapter
): number
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `messages` | `Message[]` | Messages to count |
| `model` | `string` | Model identifier (affects tokenization for some adapters) |
| `adapter` | `ProviderAdapter` | Optional — if provided, uses `adapter.count()` when available |

## Return value

`number` — estimated token count. When no adapter is provided, uses the built-in heuristic (`~chars / 4`).

## Example

```ts
import { count } from 'flint';

const messages = [
  { role: 'user' as const, content: 'What is the capital of France?' },
];

const tokens = count(messages, 'claude-opus-4-7');
console.log(tokens); // approximate count
```

## Heuristic fallback

When no adapter is provided, `count()` internally uses a `chars / 4` heuristic. This is fast and dependency-free, but not accurate for all languages and models. The heuristic is applied automatically — there is no separate export for it.

## count() signature

```ts
function count(
  messages: Message[],
  model: string,
  adapter?: ProviderAdapter
): number
```

## How token counting works

1. If `adapter.count` is implemented, calls it (exact count)
2. Otherwise, falls back to `approxCount` — a heuristic based on character counts

The heuristic is intentionally fast and synchronous. It assumes ~4 characters per token — accurate enough for budget pre-checks but not billing.

## Pre-flight budget check

Use `count()` before a potentially large call to verify headroom:

```ts
import { count } from 'flint';

const tokenEstimate = count(messages, model, adapter);
const remaining = myBudget.remaining();

if (remaining.tokens !== undefined && tokenEstimate > remaining.tokens) {
  console.warn(`Estimated ${tokenEstimate} tokens but only ${remaining.tokens} remain`);
  // Compress messages or return early
}
```

## Adapter support

Not all adapters implement `count`. Check `adapter.capabilities` or pass the adapter and let `count()` fall back silently:

```ts
// Safe either way — falls back to heuristic if adapter doesn't implement count
const n = count(messages, model, adapter);
```

## See also

- [Budget](/features/budget) — how token counts affect budget
- [Compress & Pipeline](/features/compress) — reduce message size before counting
