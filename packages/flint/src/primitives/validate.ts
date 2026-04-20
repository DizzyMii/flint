import { ValidationError } from '../errors.ts';
import type { Result, StandardSchemaV1 } from '../types.ts';

export async function validate<T>(
  value: unknown,
  schema: StandardSchemaV1<unknown, T>,
): Promise<Result<T>> {
  let result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    result = await result;
  }

  if ('issues' in result && result.issues !== undefined) {
    return {
      ok: false,
      error: new ValidationError('Schema validation failed', {
        code: 'validation.failed',
        cause: result.issues,
      }),
    };
  }

  return { ok: true, value: result.value };
}
