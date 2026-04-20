import { ParseError, ToolError } from '../errors.ts';
import type { Result, Tool } from '../types.ts';
import { validate } from './validate.ts';

export async function execute<Input, Output>(
  t: Tool<Input, Output>,
  rawInput: unknown,
): Promise<Result<Output>> {
  const parsed = await validate(rawInput, t.input);
  if (!parsed.ok) {
    return {
      ok: false,
      error: new ParseError(`Tool "${t.name}" input validation failed`, {
        code: 'parse.tool_input',
        cause: parsed.error,
      }),
    };
  }

  try {
    const output = await t.handler(parsed.value);
    return { ok: true, value: output };
  } catch (e) {
    return {
      ok: false,
      error: new ToolError(`Tool "${t.name}" handler threw`, {
        code: 'tool.handler_threw',
        cause: e,
      }),
    };
  }
}
