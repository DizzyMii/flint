import { NotImplementedError } from 'flint/errors';
import { describe, expect, it } from 'vitest';
import { anthropicAdapter } from '../src/index.ts';

describe('anthropicAdapter', () => {
  it('produces a ProviderAdapter with name="anthropic"', () => {
    const a = anthropicAdapter({ apiKey: 'test' });
    expect(a.name).toBe('anthropic');
    expect(a.capabilities.promptCache).toBe(true);
  });

  it('call stub throws NotImplementedError', async () => {
    const a = anthropicAdapter({ apiKey: 'test' });
    await expect(a.call({ model: 'x', messages: [] })).rejects.toThrow(NotImplementedError);
  });

  it('stream stub throws on iteration', async () => {
    const a = anthropicAdapter({ apiKey: 'test' });
    await expect(async () => {
      for await (const _ of a.stream({ model: 'x', messages: [] })) {
        // unreachable
      }
    }).rejects.toThrow(NotImplementedError);
  });
});
