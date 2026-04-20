import { describe, expect, it } from 'vitest';
import {
  dedup,
  orderForCache,
  pinSystem,
  pipeline,
  summarize,
  truncateToolResults,
  windowFirst,
  windowLast,
} from '../src/compress.ts';
import { NotImplementedError } from '../src/errors.ts';
import type { Message } from '../src/types.ts';

describe('compress transforms', () => {
  const msgs: Message[] = [{ role: 'user', content: 'hi' }];

  it('pipeline returns a function that runs transforms', async () => {
    const p = pipeline();
    expect(typeof p).toBe('function');
    const result = await p(msgs, {});
    expect(result).toEqual(msgs);
  });

  const transforms = [
    ['dedup', dedup()],
    ['truncateToolResults', truncateToolResults({ maxChars: 10 })],
    ['windowLast', windowLast({ keep: 1 })],
    ['windowFirst', windowFirst({ keep: 1 })],
    ['pinSystem', pinSystem()],
    ['orderForCache', orderForCache()],
  ] as const;

  for (const [name, t] of transforms) {
    it(`${name} is a transform function`, async () => {
      expect(typeof t).toBe('function');
      await expect(t(msgs, {})).rejects.toThrow(NotImplementedError);
    });
  }

  it('summarize transform requires opts and stubs throw', async () => {
    const t = summarize({
      when: () => true,
      adapter: {
        name: 'x',
        capabilities: {},
        call: async () => ({}) as never,
        stream: async function* () {},
      },
      model: 'x',
    });
    expect(typeof t).toBe('function');
    await expect(t(msgs, {})).rejects.toThrow(NotImplementedError);
  });
});
