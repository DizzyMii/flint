import { NotImplementedError } from '../errors.ts';
import type { Result, StandardSchemaV1 } from '../types.ts';

export function validate<T>(_value: unknown, _schema: StandardSchemaV1<T>): Result<T> {
  throw new NotImplementedError('primitives.validate');
}
