import { describe, expect, it } from 'vitest';
import { react, retryValidate, reflect, summarize } from '../src/recipes.ts';
import { NotImplementedError } from '../src/errors.ts';
import { budget } from '../src/budget.ts';
import type { ProviderAdapter } from '../src/adapter.ts';

const mockAdapter: ProviderAdapter = {
  name: 'mock',
  capabilities: {},
  async call() {
    throw new Error('unused');
  },
  async *stream() {},
};

const fakeSchema = {
  '~standard': { version: 1, vendor: 'x', validate: () => ({ value: undefined }) },
} as never;

describe('recipes', () => {
  it('react is a function and stub throws', async () => {
    expect(typeof react).toBe('function');
    await expect(
      react({
        adapter: mockAdapter,
        model: 'm',
        question: 'q',
        tools: [],
        budget: budget({ maxSteps: 5 }),
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('retryValidate is a function and stub throws', async () => {
    expect(typeof retryValidate).toBe('function');
    await expect(
      retryValidate({
        adapter: mockAdapter,
        model: 'm',
        messages: [],
        schema: fakeSchema,
        maxAttempts: 3,
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('reflect is a function and stub throws', async () => {
    expect(typeof reflect).toBe('function');
    await expect(
      reflect({
        adapter: mockAdapter,
        model: 'm',
        messages: [],
        critic: async () => ({ ok: true, critique: '' }),
        maxRevisions: 2,
      }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('summarize is a function and stub throws', async () => {
    expect(typeof summarize).toBe('function');
    await expect(
      summarize({ adapter: mockAdapter, model: 'm', text: 'x', chunkSize: 100 }),
    ).rejects.toThrow(NotImplementedError);
  });
});
