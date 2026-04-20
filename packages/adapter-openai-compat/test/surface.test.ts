import { describe, expect, it } from 'vitest';
import { openaiCompatAdapter } from '../src/index.ts';
import { NotImplementedError } from 'flint/errors';

describe('openaiCompatAdapter', () => {
  it('produces a ProviderAdapter with name="openai-compat"', () => {
    const a = openaiCompatAdapter({ baseUrl: 'https://example.com' });
    expect(a.name).toBe('openai-compat');
    expect(a.capabilities.structuredOutput).toBe(true);
  });

  it('call stub throws NotImplementedError', async () => {
    const a = openaiCompatAdapter({ baseUrl: 'https://example.com' });
    await expect(
      a.call({ model: 'x', messages: [] }),
    ).rejects.toThrow(NotImplementedError);
  });

  it('stream stub throws on iteration', async () => {
    const a = openaiCompatAdapter({ baseUrl: 'https://example.com' });
    await expect(async () => {
      for await (const _ of a.stream({ model: 'x', messages: [] })) {
        // unreachable
      }
    }).rejects.toThrow(NotImplementedError);
  });
});
