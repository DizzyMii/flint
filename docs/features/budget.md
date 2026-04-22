# Budget

Enforce hard limits on agent spend — steps, tokens, and dollars.

A `Budget` tracks usage across one or more `call()` or `agent()` calls and throws `BudgetExhausted` when a limit is hit.

## Creating a budget

```ts
import { budget } from 'flint/budget';

const b = budget({
  maxSteps: 10,       // max number of LLM calls
  maxTokens: 50_000,  // max total tokens (input + output + cached)
  maxDollars: 0.50,   // max spend in USD
});
```

At least one limit must be set. All limits are optional individually.

## BudgetLimits

```ts
type BudgetLimits = {
  maxSteps?: number;
  maxTokens?: number;
  maxDollars?: number;
};
```

## Budget interface

```ts
type Budget = {
  readonly limits: BudgetLimits;
  consume(x: ConsumeInput): void;
  assertNotExhausted(): void;
  remaining(): BudgetRemaining;
};

type ConsumeInput = Partial<Usage> & { cost?: number };

type BudgetRemaining = {
  steps?: number;
  tokens?: number;
  dollars?: number;
};
```

You rarely call `consume()` or `assertNotExhausted()` directly — `call()` and `agent()` do it for you. Use `remaining()` to inspect headroom.

## Checking remaining budget

```ts
const b = budget({ maxSteps: 5, maxDollars: 0.10 });

await agent({ ..., budget: b });

const rem = b.remaining();
console.log(`Steps left: ${rem.steps}`);    // 5 - steps used
console.log(`Dollars left: $${rem.dollars?.toFixed(4)}`);
```

## BudgetExhausted

When a limit is hit, `call()` or `agent()` returns `{ ok: false, error: BudgetExhausted }`.

```ts
import { BudgetExhausted } from 'flint/errors';

const res = await agent({ ..., budget: b });

if (!res.ok) {
  if (res.error instanceof BudgetExhausted) {
    console.log('Hit budget limit:', res.error.message);
  }
}
```

`BudgetExhausted.code` is one of `'budget.steps'`, `'budget.tokens'`, `'budget.dollars'`.

## Reusing a budget

A budget is stateful. To share a limit across multiple agent calls (e.g. total session cost):

```ts
const sessionBudget = budget({ maxDollars: 1.00 });

await agent({ ..., budget: sessionBudget });
await agent({ ..., budget: sessionBudget }); // continues depleting the same budget
```

## Reusing a budget across calls

The `budget` object is stateful. Pass the same instance to multiple `call()` or `agent()` calls to enforce a cumulative cap:

```ts
const sessionBudget = budget({ maxDollars: 1.00 });

// Each call consumes from the same pool
const r1 = await agent({ ..., budget: sessionBudget });
const r2 = await agent({ ..., budget: sessionBudget });

console.log('Remaining:', sessionBudget.remaining());
// → { dollars: 0.78 } (if both calls spent $0.11 and $0.11)
```

## budget() throws on invalid options

`budget()` requires at least one limit. Passing an empty object throws:

```ts
budget({}); // TypeError: budget: at least one of maxSteps, maxTokens, or maxDollars must be set
```

## Dollar cost availability

`cost` is only available in `CallOutput` / `AgentOutput` if the adapter reports it. The Anthropic adapter always reports cost. If `adapter.capabilities.cost` is false, `cost` will be `undefined` and `maxDollars` will never be exhausted.

## Common mistakes

::: warning budget is required for agent()
`agent()` requires a `budget` argument. There's no default — this is intentional. Agents without budget limits can run indefinitely.
:::

## See also

- [agent()](/primitives/agent) — uses budget for loop control
- [call()](/primitives/call) — optional budget for single calls
- [Error Types](/reference/errors) — BudgetExhausted
