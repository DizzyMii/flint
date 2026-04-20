import type { StandardSchemaV1, Tool } from '../types.ts';

export type ToolSpec<Input, Output> = {
  name: string;
  description: string;
  input: StandardSchemaV1<Input>;
  handler: (input: Input) => Promise<Output> | Output;
};

export function tool<Input, Output>(spec: ToolSpec<Input, Output>): Tool<Input, Output> {
  return {
    name: spec.name,
    description: spec.description,
    input: spec.input,
    handler: spec.handler,
  };
}
