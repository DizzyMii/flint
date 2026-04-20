import { describe, expect, it } from 'vitest';
import {
  dedup,
  orderForCache,
  pipeline,
  summarize,
  truncateToolResults,
  windowFirst,
  windowLast,
} from '../src/compress.ts';
import { NotImplementedError } from '../src/errors.ts';
import type { ContentPart, Message } from '../src/types.ts';

describe('compress transforms', () => {
  const msgs: Message[] = [{ role: 'user', content: 'hi' }];

  it('pipeline returns a function that runs transforms', async () => {
    const p = pipeline();
    expect(typeof p).toBe('function');
    const result = await p(msgs, {});
    expect(result).toEqual(msgs);
  });

  const transforms = [
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

describe('dedup', () => {
  it('returns empty array for empty input', async () => {
    const t = dedup();
    const out = await t([], {});
    expect(out).toEqual([]);
  });

  it('leaves unique messages unchanged', async () => {
    const t = dedup();
    const msgs: Message[] = [
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'c' },
    ];
    const out = await t(msgs, {});
    expect(out).toEqual(msgs);
  });

  it('drops duplicate user messages, keeping first occurrence', async () => {
    const t = dedup();
    const msgs: Message[] = [
      { role: 'user', content: 'dup' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'dup' },
    ];
    const out = await t(msgs, {});
    expect(out).toEqual([
      { role: 'user', content: 'dup' },
      { role: 'assistant', content: 'reply' },
    ]);
  });

  it('preserves all system messages even when content duplicates', async () => {
    const t = dedup();
    const msgs: Message[] = [
      { role: 'system', content: 'x' },
      { role: 'user', content: 'hi' },
      { role: 'system', content: 'x' },
    ];
    const out = await t(msgs, {});
    expect(out).toEqual(msgs);
  });

  it('treats ContentPart[] as duplicate via deep equality', async () => {
    const t = dedup();
    const parts: ContentPart[] = [{ type: 'text', text: 'same' }];
    const msgs: Message[] = [
      { role: 'user', content: parts },
      { role: 'user', content: [...parts] }, // different array, same content
    ];
    const out = await t(msgs, {});
    expect(out).toHaveLength(1);
  });

  it('ignores toolCalls when computing duplicate key', async () => {
    const t = dedup();
    const msgs: Message[] = [
      {
        role: 'assistant',
        content: 'same',
        toolCalls: [{ id: 'a', name: 'x', arguments: {} }],
      },
      {
        role: 'assistant',
        content: 'same',
        toolCalls: [{ id: 'b', name: 'x', arguments: {} }],
      },
    ];
    const out = await t(msgs, {});
    expect(out).toHaveLength(1);
  });

  it('does not mutate input array', async () => {
    const t = dedup();
    const msgs: Message[] = [
      { role: 'user', content: 'dup' },
      { role: 'user', content: 'dup' },
    ];
    const copy = [...msgs];
    await t(msgs, {});
    expect(msgs).toEqual(copy);
  });
});

describe('truncateToolResults', () => {
  it('throws TypeError when maxChars is too small', () => {
    expect(() => truncateToolResults({ maxChars: 50 })).toThrow(TypeError);
  });

  it('leaves short tool results unchanged', async () => {
    const t = truncateToolResults({ maxChars: 1000 });
    const msgs: Message[] = [
      { role: 'tool', content: 'short result', toolCallId: 'c1' },
    ];
    const out = await t(msgs, {});
    expect(out).toEqual(msgs);
  });

  it('truncates long tool results with marker', async () => {
    const t = truncateToolResults({ maxChars: 100 });
    const longContent = 'x'.repeat(500);
    const msgs: Message[] = [
      { role: 'tool', content: longContent, toolCallId: 'c1' },
    ];
    const out = await t(msgs, {});
    const resultContent = out[0]?.content;
    expect(typeof resultContent).toBe('string');
    if (typeof resultContent === 'string') {
      expect(resultContent.length).toBeLessThanOrEqual(100);
      expect(resultContent).toContain('truncated');
      expect(resultContent).toContain('400'); // 500 - (100 - markerLen)
    }
  });

  it('preserves toolCallId in truncated message', async () => {
    const t = truncateToolResults({ maxChars: 100 });
    const msgs: Message[] = [
      { role: 'tool', content: 'x'.repeat(500), toolCallId: 'my-id' },
    ];
    const out = await t(msgs, {});
    expect(out[0]).toMatchObject({ toolCallId: 'my-id' });
  });

  it('does not truncate non-tool messages', async () => {
    const t = truncateToolResults({ maxChars: 100 });
    const longContent = 'x'.repeat(500);
    const msgs: Message[] = [
      { role: 'user', content: longContent },
      { role: 'assistant', content: longContent },
      { role: 'system', content: longContent },
    ];
    const out = await t(msgs, {});
    expect(out[0]?.content).toBe(longContent);
    expect(out[1]?.content).toBe(longContent);
    expect(out[2]?.content).toBe(longContent);
  });

  it('does not mutate input', async () => {
    const t = truncateToolResults({ maxChars: 100 });
    const msg: Message = {
      role: 'tool',
      content: 'x'.repeat(500),
      toolCallId: 'c1',
    };
    const original = { ...msg };
    await t([msg], {});
    expect(msg).toEqual(original);
  });
});

describe('windowLast', () => {
  const fixture: Message[] = [
    { role: 'system', content: 'sys1' },
    { role: 'user', content: 'u1' },
    { role: 'assistant', content: 'a1' },
    { role: 'user', content: 'u2' },
    { role: 'assistant', content: 'a2' },
    { role: 'user', content: 'u3' },
  ];

  it('throws TypeError when keep is negative', () => {
    expect(() => windowLast({ keep: -1 })).toThrow(TypeError);
  });

  it('keep: 0, alwaysKeep: [] returns empty', async () => {
    const t = windowLast({ keep: 0, alwaysKeep: [] });
    const out = await t(fixture, {});
    expect(out).toEqual([]);
  });

  it('default alwaysKeep preserves system messages', async () => {
    const t = windowLast({ keep: 2 });
    const out = await t(fixture, {});
    expect(out).toEqual([
      { role: 'system', content: 'sys1' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' },
    ]);
  });

  it('keeps last N non-system messages when alwaysKeep is default', async () => {
    const t = windowLast({ keep: 3 });
    const out = await t(fixture, {});
    expect(out.map((m) => (m as { content: string }).content)).toEqual([
      'sys1',
      'u2',
      'a2',
      'u3',
    ]);
  });

  it('preserves multiple system messages at original positions', async () => {
    const t = windowLast({ keep: 1 });
    const msgs: Message[] = [
      { role: 'system', content: 's1' },
      { role: 'user', content: 'u1' },
      { role: 'system', content: 's2' },
      { role: 'user', content: 'u2' },
      { role: 'user', content: 'u3' },
    ];
    const out = await t(msgs, {});
    expect(out).toEqual([
      { role: 'system', content: 's1' },
      { role: 'system', content: 's2' },
      { role: 'user', content: 'u3' },
    ]);
  });

  it('explicit empty alwaysKeep strips system too', async () => {
    const t = windowLast({ keep: 2, alwaysKeep: [] });
    const out = await t(fixture, {});
    expect(out).toEqual([
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' },
    ]);
  });

  it('does not mutate input array', async () => {
    const t = windowLast({ keep: 2 });
    const copy = [...fixture];
    await t(fixture, {});
    expect(fixture).toEqual(copy);
  });

  it('keep greater than messages length returns everything eligible', async () => {
    const t = windowLast({ keep: 100 });
    const out = await t(fixture, {});
    expect(out).toEqual(fixture);
  });
});

describe('windowFirst', () => {
  const fixture: Message[] = [
    { role: 'system', content: 'sys1' },
    { role: 'user', content: 'u1' },
    { role: 'assistant', content: 'a1' },
    { role: 'user', content: 'u2' },
    { role: 'assistant', content: 'a2' },
    { role: 'user', content: 'u3' },
  ];

  it('throws TypeError when keep is negative', () => {
    expect(() => windowFirst({ keep: -1 })).toThrow(TypeError);
  });

  it('keep: 0, alwaysKeep: [] returns empty', async () => {
    const t = windowFirst({ keep: 0, alwaysKeep: [] });
    const out = await t(fixture, {});
    expect(out).toEqual([]);
  });

  it('default alwaysKeep preserves system messages', async () => {
    const t = windowFirst({ keep: 2 });
    const out = await t(fixture, {});
    expect(out).toEqual([
      { role: 'system', content: 'sys1' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
    ]);
  });

  it('takes first N eligible', async () => {
    const t = windowFirst({ keep: 1 });
    const out = await t(fixture, {});
    expect(out).toEqual([
      { role: 'system', content: 'sys1' },
      { role: 'user', content: 'u1' },
    ]);
  });

  it('does not mutate input', async () => {
    const t = windowFirst({ keep: 2 });
    const copy = [...fixture];
    await t(fixture, {});
    expect(fixture).toEqual(copy);
  });
});
