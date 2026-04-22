# Error Types

All Flint errors extend `FlintError`, which extends `Error`. Every `FlintError` has a `code` string for programmatic handling alongside the human-readable `message`.

```ts
import { FlintError } from 'flint/errors';

class FlintError extends Error {
  readonly code: string;  // e.g. 'adapter.call_failed', 'budget.steps'
}
```

## Error hierarchy

```
Error
└── FlintError (code: string)
    ├── AdapterError     — provider communication failures
    ├── ValidationError  — schema validation failures
    ├── ToolError        — tool execution failures
    ├── BudgetExhausted  — budget cap hit
    ├── ParseError       — response parsing failures
    ├── TimeoutError     — operation timed out
    └── NotImplementedError — adapter feature not supported
```

`DependencyCycleError` (from `@flint/landlord`) extends plain `Error`, not `FlintError`.

## Importing error classes

```ts
import {
  FlintError,
  AdapterError,
  ValidationError,
  ToolError,
  BudgetExhausted,
  ParseError,
  TimeoutError,
  NotImplementedError,
} from 'flint/errors';
```

---

## AdapterError

**When:** The provider request fails — network error, authentication failure, rate limit, invalid model name, provider outage.

**`code` values:** `'adapter.call_failed'`

**Thrown by:** `call()`, `stream()`

```ts
import { AdapterError } from 'flint/errors';

const res = await call({ adapter, model, messages });
if (!res.ok) {
  if (res.error instanceof AdapterError) {
    console.error('Provider failed:', res.error.message);
    console.error('Code:', res.error.code); // 'adapter.call_failed'
    // The original provider error is available via res.error.cause
    console.error('Cause:', res.error.cause);
  }
}
```

**Common causes and fixes:**

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` | Wrong or missing API key | Check `ANTHROPIC_API_KEY` |
| `429 Too Many Requests` | Rate limit hit | Add retry logic with backoff |
| `Network Error` | No internet / wrong baseURL | Check connectivity and adapter config |
| `Invalid model` | Model name typo | Check provider's model list |

---

## ValidationError

**When:** A response fails schema validation after `call()` with a `schema` option, or `validate()` receives invalid input.

**`code` values:** `'validation.failed'`

**Thrown by:** `call()` (when `schema` is set), `validate()`

```ts
import { ValidationError } from 'flint/errors';
import * as v from 'valibot';

const res = await call({
  adapter,
  model: 'claude-opus-4-7',
  messages,
  schema: v.object({ answer: v.number() }),
});

if (!res.ok) {
  if (res.error instanceof ValidationError) {
    console.error('Schema mismatch:', res.error.message);
    // The validation issues are in res.error.cause
  }
}
```

**Tip:** If validation keeps failing, log the raw `res.value.message.content` before adding the `schema` option to see what the model is actually returning.

---

## ToolError

**When:** A tool handler throws an exception, or input validation fails before the handler runs.

**`code` values:** `'tool.execution_failed'`, `'tool.validation_failed'`, `'tool.timeout'`

**Thrown by:** `execute()`

```ts
import { ToolError } from 'flint/errors';

const res = await execute(myTool, input);
if (!res.ok) {
  if (res.error instanceof ToolError) {
    if (res.error.code === 'tool.timeout') {
      console.error('Tool timed out');
    } else if (res.error.code === 'tool.validation_failed') {
      console.error('Invalid tool input:', res.error.message);
    } else {
      console.error('Tool failed:', res.error.message, res.error.cause);
    }
  }
}
```

**Note:** In an `agent()` loop, `ToolError` is caught internally and converted to a tool result message (`"Error: ..."`) that the model reads. The agent does not return early on tool errors — the model decides what to do next.

---

## BudgetExhausted

**When:** A budget cap (steps, tokens, or dollars) is reached.

**`code` values:** `'budget.steps'`, `'budget.tokens'`, `'budget.dollars'`

**Thrown by:** `call()`, `agent()`

```ts
import { BudgetExhausted } from 'flint/errors';

const res = await agent({ adapter, model, messages, tools, budget: myBudget });
if (!res.ok) {
  if (res.error instanceof BudgetExhausted) {
    switch (res.error.code) {
      case 'budget.steps':
        console.error('Agent exceeded max steps');
        break;
      case 'budget.tokens':
        console.error('Token limit reached');
        break;
      case 'budget.dollars':
        console.error('Dollar limit reached');
        break;
    }
  }
}
```

**Tip:** Use `budget.remaining()` before expensive calls to pre-check headroom.

---

## ParseError

**When:** The provider returns a response that cannot be parsed as expected — malformed JSON in structured output, unexpected response format.

**`code` values:** `'parse.response_json'`

**Thrown by:** `call()` internally when a `schema` is provided and the response content isn't valid JSON.

```ts
import { ParseError } from 'flint/errors';

const res = await call({ adapter, model, messages, schema: mySchema });
if (!res.ok) {
  if (res.error instanceof ParseError) {
    console.error('Could not parse LLM response as JSON:', res.error.message);
    // Try without schema to see the raw response
  }
}
```

---

## TimeoutError

**When:** A tool execution exceeds its `timeout` value (set in the `ToolSpec`).

**`code` values:** `'tool.timeout'` (surfaces as a `ToolError` with this code)

```ts
const slowTool = tool({
  name: 'slow',
  description: 'A potentially slow operation',
  input: v.object({ url: v.string() }),
  handler: fetchSomething,
  timeout: 5000, // ms — ToolError with code 'tool.timeout' if exceeded
});
```

---

## NotImplementedError

**When:** A method is called on an adapter that doesn't implement it — typically `count()` on an adapter that doesn't support token counting.

**`code` values:** `'not_implemented'`

This error is thrown (not returned as a Result) because it represents a programming error — you called a method that doesn't exist on this adapter. It will not occur in normal operation if you check `adapter.capabilities` first.

```ts
if (adapter.count) {
  const tokens = adapter.count(messages, model);
} else {
  // Adapter doesn't support counting — use heuristic fallback
  const { count } = await import('flint');
  const tokens = await count({ adapter, model, messages });
}
```

---

## DependencyCycleError (landlord)

**When:** `resolveOrder()` in `@flint/landlord` detects a circular dependency in the contract graph.

**Not a FlintError** — extends plain `Error`.

```ts
import { resolveOrder, DependencyCycleError } from '@flint/landlord';

try {
  const ordered = resolveOrder(contracts);
} catch (err) {
  if (err instanceof DependencyCycleError) {
    console.error('Cycle detected:', err.message);
    // message format: "Dependency cycle: roleA -> roleB -> roleA"
  }
}
```

---

## Error handling patterns

### Narrowing by class

```ts
import { AdapterError, BudgetExhausted, ValidationError } from 'flint/errors';

const res = await agent({ ... });
if (!res.ok) {
  if (res.error instanceof BudgetExhausted) {
    // Handle budget exhaustion specifically
  } else if (res.error instanceof AdapterError) {
    // Handle provider failure — maybe retry
  } else {
    // Unknown error — re-throw or log
    throw res.error;
  }
}
```

### Narrowing by code

```ts
if (!res.ok) {
  switch (res.error.code) {
    case 'budget.dollars':
      notifyUser('Spending limit reached');
      break;
    case 'adapter.call_failed':
      scheduleRetry();
      break;
    default:
      logger.error(res.error);
  }
}
```

### Safe re-throw

```ts
if (!res.ok) {
  // Only re-throw if it's not an expected "soft" failure
  if (!(res.error instanceof BudgetExhausted)) {
    throw res.error;
  }
  return handleBudgetExhausted(res.error);
}
```

## See also

- [Result<T>](/guide/faq#why-resultt-instead-of-throwing) — why Flint uses Result
- [Budget](/features/budget) — BudgetExhausted in context
- [Safety](/features/safety) — error-adjacent safety primitives
