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

## See also

- [call()](/primitives/call) — `call()` uses `validate()` internally when `schema` is provided
- [Tool input validation](/primitives/tool) — tools use Standard Schema for input types
