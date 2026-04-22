# validate()

Validate a value against a Standard Schema.

`validate()` is a thin async wrapper around the Standard Schema `~validate` protocol. It normalizes both sync and async schema libraries into a `Promise<Result<T>>`.

## Signature

```ts
function validate<T>(
  value: unknown,
  schema: StandardSchemaV1<unknown, T>
): Promise<Result<T>>
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `value` | `unknown` | The value to validate |
| `schema` | `StandardSchemaV1<unknown, T>` | Any Standard Schema-compatible schema (Zod, Valibot, ArkType, etc.) |

## Return value

`Promise<Result<T>>` — `{ ok: true, value: T }` on success, `{ ok: false, error: ValidationError }` on failure.

## Example

```ts
import { validate } from 'flint';
import * as v from 'valibot';

const UserSchema = v.object({
  name: v.string(),
  age: v.number(),
});

const res = await validate({ name: 'Alice', age: 30 }, UserSchema);

if (res.ok) {
  console.log(res.value.name); // "Alice"
} else {
  console.error(res.error.message);
}
```

## Standard Schema compatibility

Works with any library that implements the Standard Schema spec:

- [Valibot](https://valibot.dev)
- [Zod](https://zod.dev)
- [ArkType](https://arktype.io)
- [TypeBox](https://github.com/sinclairzx81/typebox)

## validate() signature

```ts
function validate<T>(
  value: unknown,
  schema: StandardSchemaV1<unknown, T>
): Promise<Result<T>>
```

## Supported schema libraries

Any library implementing [Standard Schema v1](https://standardschema.dev):

```ts
// Zod
import { z } from 'zod';
const schema = z.object({ name: z.string() });

// Valibot
import * as v from 'valibot';
const schema = v.object({ name: v.string() });

// ArkType
import { type } from 'arktype';
const schema = type({ name: 'string' });

// All work identically with validate()
const result = await validate({ name: 'Alice' }, schema);
```

## Error on failure

Returns `{ ok: false, error: ValidationError }`. The `ValidationError.cause` contains the raw schema issues:

```ts
const result = await validate(42, stringSchema);
if (!result.ok) {
  console.log(result.error.code); // 'validation.failed'
  console.log(result.error.cause); // schema-specific issues array
}
```

## Using validate() standalone

`call()` uses `validate()` internally when a `schema` option is provided. You can also use it directly for any data validation that doesn't involve the LLM:

```ts
// Validate webhook payload
const body = await request.json();
const payload = await validate(body, WebhookSchema);
if (!payload.ok) return Response.json({ error: 'Invalid payload' }, { status: 400 });
```

## See also

- [call()](/primitives/call) — schema option uses validate() internally
- [tool()](/primitives/tool) — tool input is validated with validate()
- [Error Types](/reference/errors) — ValidationError
