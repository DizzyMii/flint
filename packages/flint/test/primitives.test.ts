import { describe, expect, it } from 'vitest';
import { call } from '../src/primitives/call.ts';
import { stream } from '../src/primitives/stream.ts';
import { validate } from '../src/primitives/validate.ts';
import { tool } from '../src/primitives/tool.ts';
import { execute } from '../src/primitives/execute.ts';
import { count } from '../src/primitives/count.ts';
import { NotImplementedError } from '../src/errors.ts';
import type { ProviderAdapter } from '../src/adapter.ts';

const mockAdapter: ProviderAdapter = {
  name: 'mock',
  capabilities: {},
  async call() {
    throw new Error('should not reach');
  },
  async *stream() {
    // no-op
  },
};

describe('primitives', () => {
  it('call is a function and stub throws NotImplementedError', async () => {
    expect(typeof call).toBe('function');
    await expect(
      call({ adapter: mockAdapter, model: 'x', messages: [] }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('stream is a function and stub throws on iteration', async () => {
    expect(typeof stream).toBe('function');
    const iter = stream({ adapter: mockAdapter, model: 'x', messages: [] });
    await expect(async () => {
      for await (const _ of iter) {
        // unreachable
      }
    }).rejects.toThrow(NotImplementedError);
  });

  it('validate is a function and stub throws', () => {
    expect(typeof validate).toBe('function');
    const fakeSchema = {
      '~standard': { version: 1, vendor: 'x', validate: () => ({ value: undefined }) },
    } as never;
    expect(() => validate('x', fakeSchema)).toThrow(NotImplementedError);
  });

  it('tool returns a Tool with name/description/input/handler', () => {
    expect(typeof tool).toBe('function');
    const fakeSchema = {
      '~standard': { version: 1, vendor: 'x', validate: () => ({ value: { n: 1 } }) },
    } as never;
    const t = tool({
      name: 'add',
      description: 'add',
      input: fakeSchema,
      handler: async (x: { n: number }) => x.n + 1,
    });
    expect(t.name).toBe('add');
    expect(t.description).toBe('add');
    expect(typeof t.handler).toBe('function');
  });

  it('execute is a function and stub throws', async () => {
    const fakeSchema = {
      '~standard': { version: 1, vendor: 'x', validate: () => ({ value: {} }) },
    } as never;
    const t = tool({ name: 'x', description: 'x', input: fakeSchema, handler: () => 1 });
    await expect(execute(t, {})).rejects.toThrow(NotImplementedError);
  });

  it('count is a function and stub throws', () => {
    expect(typeof count).toBe('function');
    expect(() => count([], 'm')).toThrow(NotImplementedError);
  });
});
