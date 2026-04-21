# Examples

Runnable code examples for Flint. Full annotated examples live in the [documentation](https://dizzymii.github.io/flint/examples/basic-call).

## Quick reference

| Example | Description |
|---|---|
| [Basic call](https://dizzymii.github.io/flint/examples/basic-call) | One-shot `call()` with and without schema validation |
| [Tool use](https://dizzymii.github.io/flint/examples/tools) | Define tools; inspect tool calls in the response |
| [Agent loop](https://dizzymii.github.io/flint/examples/agent) | Multi-step `agent()` with `onStep` callback |
| [Streaming](https://dizzymii.github.io/flint/examples/streaming) | `stream()` with chunk handling and budget tracking |
| [ReAct pattern](https://dizzymii.github.io/flint/examples/react-pattern) | `react()` recipe for structured reasoning |

## Running locally

```sh
pnpm install
ANTHROPIC_API_KEY=sk-ant-... node examples/basic-call.ts
```

Runnable `.ts` files will be added to this directory as the library stabilizes past v0.
