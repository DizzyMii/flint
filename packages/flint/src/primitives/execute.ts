import { NotImplementedError } from '../errors.ts';
import type { Result, Tool } from '../types.ts';

export async function execute<Input, Output>(
  _tool: Tool<Input, Output>,
  _rawInput: unknown,
): Promise<Result<Output>> {
  throw new NotImplementedError('primitives.execute');
}
