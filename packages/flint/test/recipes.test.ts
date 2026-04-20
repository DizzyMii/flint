import { describe, expect, it, vi } from 'vitest';
import { budget } from '../src/budget.ts';
import { AdapterError, ValidationError } from '../src/errors.ts';
import { react, reflect, retryValidate, summarize } from '../src/recipes.ts';
import { mockAdapter, scriptedAdapter } from '../src/testing/mock-adapter.ts';

// ─── helpers ────────────────────────────────────────────────────────────────

function okResponse(content: string) {
  return {
    message: { role: 'assistant' as const, content },
    usage: { input: 10, output: 5 },
    stopReason: 'end' as const,
  };
}

function toolCallResponse(content: string) {
  return {
    message: {
      role: 'assistant' as const,
      content,
      toolCalls: [{ id: 'tc1', name: 'search', arguments: { q: 'test' } }],
    },
    usage: { input: 10, output: 5 },
    stopReason: 'tool_call' as const,
  };
}

function makeSchema<T>(value: T) {
  return {
    '~standard': {
      version: 1 as const,
      vendor: 'test',
      validate: (_v: unknown) => ({ value }),
    },
  };
}

function makeFailingSchema(message: string) {
  return {
    '~standard': {
      version: 1 as const,
      vendor: 'test',
      validate: (_v: unknown) => ({ issues: [{ message }] }),
    },
  };
}

// ─── react ──────────────────────────────────────────────────────────────────

describe('react', () => {
  it('returns ok with final answer on happy path', async () => {
    const adapter = scriptedAdapter([
      okResponse('The answer is 42.'),
    ]);
    const result = await react({
      adapter,
      model: 'test-model',
      question: 'What is the answer?',
      tools: [],
      budget: budget({ maxSteps: 5 }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.message.content).toBe('The answer is 42.');
      expect(result.value.steps).toHaveLength(0);
    }
  });

  it('prepends ReAct system message before user question', async () => {
    const adapter = scriptedAdapter([okResponse('done')]);
    await react({
      adapter,
      model: 'test-model',
      question: 'Test question',
      tools: [],
      budget: budget({ maxSteps: 5 }),
    });
    const req = adapter.calls[0];
    expect(req).toBeDefined();
    expect(req!.messages[0]?.role).toBe('system');
    expect(req!.messages[0]?.content).toContain('ReAct');
    expect(req!.messages[1]?.role).toBe('user');
    expect(req!.messages[1]?.content).toBe('Test question');
  });

  it('propagates adapter error as Result.error', async () => {
    const adapter = mockAdapter({
      onCall: async () => { throw new Error('network error'); },
    });
    const result = await react({
      adapter,
      model: 'test-model',
      question: 'q',
      tools: [],
      budget: budget({ maxSteps: 5 }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AdapterError);
    }
  });

  it('respects maxSteps by forwarding it to agent', async () => {
    // Each call returns a tool-call to keep iterating, last is a terminal answer
    const adapter = scriptedAdapter([
      toolCallResponse('thinking...'),
      okResponse('final answer'),
    ]);
    // Use a tool so agent actually runs tool steps
    const searchTool = {
      name: 'search',
      description: 'search',
      input: makeSchema('') as never,
      handler: async () => 'result',
    };
    const result = await react({
      adapter,
      model: 'test-model',
      question: 'q',
      tools: [searchTool],
      budget: budget({ maxSteps: 10 }),
      maxSteps: 2,
    });
    expect(result.ok).toBe(true);
  });

  it('succeeds with empty tools array', async () => {
    const adapter = scriptedAdapter([okResponse('no tools needed')]);
    const result = await react({
      adapter,
      model: 'test-model',
      question: 'Simple question',
      tools: [],
      budget: budget({ maxSteps: 3 }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.message.content).toBe('no tools needed');
    }
  });
});

// ─── retryValidate ──────────────────────────────────────────────────────────

describe('retryValidate', () => {
  it('returns value on first valid response', async () => {
    const adapter = scriptedAdapter([okResponse('{"name":"Alice"}')]);
    const schema = makeSchema({ name: 'Alice' });
    const result = await retryValidate({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Give me JSON' }],
      schema: schema as never,
      maxAttempts: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Alice' });
    }
  });

  it('retries on validation failure and succeeds on second attempt', async () => {
    // First: returns invalid JSON (causes ParseError) → second: valid JSON
    const adapter = scriptedAdapter([
      okResponse('not-valid-json'),
      okResponse('{"name":"Bob"}'),
    ]);
    const schema = makeSchema({ name: 'Bob' });
    const result = await retryValidate({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Give me JSON' }],
      schema: schema as never,
      maxAttempts: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Bob' });
    }
    expect(adapter.calls).toHaveLength(2);
  });

  it('appends feedback message after validation failure', async () => {
    const adapter = scriptedAdapter([
      okResponse('not-valid-json'),
      okResponse('{}'),
    ]);
    const schema = makeSchema({});
    await retryValidate({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Give me JSON' }],
      schema: schema as never,
      maxAttempts: 3,
    });
    // Second call should have extra messages appended
    const secondCall = adapter.calls[1];
    expect(secondCall!.messages.length).toBeGreaterThan(1);
    // Should contain a user feedback message
    const userMessages = secondCall!.messages.filter((m) => m.role === 'user');
    expect(userMessages.length).toBeGreaterThanOrEqual(2);
    const lastUser = userMessages[userMessages.length - 1];
    expect(lastUser!.content).toContain('validation');
  });

  it('returns error after maxAttempts exhausted', async () => {
    const adapter = scriptedAdapter([
      okResponse('bad'),
      okResponse('bad'),
      okResponse('bad'),
    ]);
    const schema = makeFailingSchema('must be object');
    const result = await retryValidate({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'q' }],
      schema: schema as never,
      maxAttempts: 3,
    });
    expect(result.ok).toBe(false);
    expect(adapter.calls).toHaveLength(3);
  });

  it('immediately returns non-retryable adapter error', async () => {
    const adapter = mockAdapter({
      onCall: async () => { throw new Error('fatal'); },
    });
    const schema = makeSchema({});
    const result = await retryValidate({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'q' }],
      schema: schema as never,
      maxAttempts: 5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AdapterError);
    }
    // Should NOT have retried
    expect(adapter.calls).toHaveLength(1);
  });

  it('does not mutate original messages array', async () => {
    const adapter = scriptedAdapter([
      okResponse('bad'),
      okResponse('{}'),
    ]);
    const schema = makeSchema({});
    const original = [{ role: 'user' as const, content: 'q' }];
    const originalLen = original.length;
    await retryValidate({
      adapter,
      model: 'test-model',
      messages: original,
      schema: schema as never,
      maxAttempts: 3,
    });
    expect(original).toHaveLength(originalLen);
  });

  it('handles tool-call response by appending feedback and retrying', async () => {
    // First response is a tool call, second is valid JSON
    const adapter = scriptedAdapter([
      toolCallResponse(''),
      okResponse('{"x":1}'),
    ]);
    const schema = makeSchema({ x: 1 });
    const result = await retryValidate({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'q' }],
      schema: schema as never,
      maxAttempts: 3,
    });
    expect(result.ok).toBe(true);
    expect(adapter.calls).toHaveLength(2);
  });
});

// ─── reflect ────────────────────────────────────────────────────────────────

describe('reflect', () => {
  it('returns draft immediately when critic approves on first try', async () => {
    const adapter = scriptedAdapter([okResponse('great draft')]);
    const critic = vi.fn().mockResolvedValue({ ok: true, critique: '' });
    const result = await reflect({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Write something' }],
      critic,
      maxRevisions: 2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('great draft');
    }
    expect(critic).toHaveBeenCalledTimes(1);
    expect(adapter.calls).toHaveLength(1);
  });

  it('revises when critic rejects and approves on second', async () => {
    const adapter = scriptedAdapter([
      okResponse('rough draft'),
      okResponse('polished draft'),
    ]);
    const critic = vi.fn()
      .mockResolvedValueOnce({ ok: false, critique: 'too rough' })
      .mockResolvedValueOnce({ ok: true, critique: '' });
    const result = await reflect({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Write something' }],
      critic,
      maxRevisions: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('polished draft');
    }
    expect(adapter.calls).toHaveLength(2);
  });

  it('appends critique message before revision', async () => {
    const adapter = scriptedAdapter([
      okResponse('draft v1'),
      okResponse('draft v2'),
    ]);
    const critic = vi.fn()
      .mockResolvedValueOnce({ ok: false, critique: 'needs more detail' })
      .mockResolvedValueOnce({ ok: true, critique: '' });
    await reflect({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Write' }],
      critic,
      maxRevisions: 3,
    });
    const secondCall = adapter.calls[1]!;
    const userMessages = secondCall.messages.filter((m) => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1];
    expect(lastUser!.content).toContain('needs more detail');
  });

  it('propagates adapter error immediately', async () => {
    const adapter = mockAdapter({
      onCall: async () => { throw new Error('network down'); },
    });
    const critic = vi.fn();
    const result = await reflect({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Write' }],
      critic,
      maxRevisions: 2,
    });
    expect(result.ok).toBe(false);
    expect(critic).not.toHaveBeenCalled();
  });

  it('returns best-effort last draft after maxRevisions without approval', async () => {
    const adapter = scriptedAdapter([
      okResponse('draft1'),
      okResponse('draft2'),
      okResponse('draft3'),
    ]);
    const critic = vi.fn().mockResolvedValue({ ok: false, critique: 'not good enough' });
    const result = await reflect({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Write' }],
      critic,
      maxRevisions: 2,
    });
    // After maxRevisions+1 iterations with no approval, returns last draft
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('draft3');
    }
  });

  it('calls critic with draft text content', async () => {
    const adapter = scriptedAdapter([okResponse('my specific draft text')]);
    const critic = vi.fn().mockResolvedValue({ ok: true, critique: '' });
    await reflect({
      adapter,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Write' }],
      critic,
      maxRevisions: 2,
    });
    expect(critic).toHaveBeenCalledWith('my specific draft text');
  });
});

// ─── summarize ──────────────────────────────────────────────────────────────

describe('summarize', () => {
  it('returns empty string for empty text', async () => {
    const adapter = scriptedAdapter([]);
    const result = await summarize({
      adapter,
      model: 'test-model',
      text: '',
      chunkSize: 100,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('');
    }
    expect(adapter.calls).toHaveLength(0);
  });

  it('returns single chunk summary directly', async () => {
    const adapter = scriptedAdapter([okResponse('a concise summary')]);
    const result = await summarize({
      adapter,
      model: 'test-model',
      text: 'short text',
      chunkSize: 1000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('a concise summary');
    }
    expect(adapter.calls).toHaveLength(1);
  });

  it('combines multiple chunk summaries for long text', async () => {
    // 3 chunks → 3 summaries + 1 combine call = 4 total
    const adapter = scriptedAdapter([
      okResponse('summary1'),
      okResponse('summary2'),
      okResponse('summary3'),
      okResponse('final combined summary'),
    ]);
    // Force 3 chunks by using chunkSize=5 on 15-char text
    const result = await summarize({
      adapter,
      model: 'test-model',
      text: 'abcdeabcdeabcde',
      chunkSize: 5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('final combined summary');
    }
    expect(adapter.calls).toHaveLength(4);
  });

  it('propagates error from a chunk summary call', async () => {
    const adapter = mockAdapter({
      onCall: async (_req, index) => {
        if (index === 1) throw new Error('chunk call failed');
        return okResponse('ok');
      },
    });
    // Force 2 chunks
    const result = await summarize({
      adapter,
      model: 'test-model',
      text: 'abcdeabcde',
      chunkSize: 5,
    });
    expect(result.ok).toBe(false);
  });

  it('propagates error from final combine call', async () => {
    const adapter = scriptedAdapter([
      okResponse('s1'),
      okResponse('s2'),
    ]);
    // Adapter runs out of responses, causing error on combine call
    const result = await summarize({
      adapter,
      model: 'test-model',
      text: 'abcdeabcde',
      chunkSize: 5,
    });
    // scriptedAdapter throws when out of responses
    expect(result.ok).toBe(false);
  });

  it('sends summarize prompt with chunk content', async () => {
    const adapter = scriptedAdapter([okResponse('summary')]);
    await summarize({
      adapter,
      model: 'test-model',
      text: 'Hello world',
      chunkSize: 1000,
    });
    const req = adapter.calls[0]!;
    const userMsg = req.messages.find((m) => m.role === 'user');
    expect(userMsg!.content).toContain('Hello world');
    expect(userMsg!.content).toContain('Summarize');
  });

  it('sends combine prompt with chunk summaries', async () => {
    const adapter = scriptedAdapter([
      okResponse('chunk1-summary'),
      okResponse('chunk2-summary'),
      okResponse('combined'),
    ]);
    await summarize({
      adapter,
      model: 'test-model',
      text: 'abcdeabcde',
      chunkSize: 5,
    });
    const combineReq = adapter.calls[2]!;
    const userMsg = combineReq.messages.find((m) => m.role === 'user');
    expect(userMsg!.content).toContain('chunk1-summary');
    expect(userMsg!.content).toContain('chunk2-summary');
    expect(userMsg!.content).toContain('Combine');
  });
});
