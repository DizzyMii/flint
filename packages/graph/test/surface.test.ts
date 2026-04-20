import { describe, expect, it } from 'vitest';
import {
  edge,
  graph,
  memoryCheckpointStore,
  node,
  state,
} from '../src/index.ts';
import { NotImplementedError } from 'flint/errors';
import { budget } from 'flint/budget';
import type { ProviderAdapter } from 'flint';

const mockAdapter: ProviderAdapter = {
  name: 'mock',
  capabilities: {},
  async call() {
    throw new Error('unused');
  },
  async *stream() {},
};

describe('graph surface', () => {
  it('node/edge/state return shaped values', () => {
    const s = state<{ x: number }>();
    expect(s.__type).toBe('state');
    const n = node<{ x: number }>(async (st) => ({ ...st, x: st.x + 1 }));
    expect(n.__type).toBe('node');
    const e = edge<{ x: number }>('a', 'b', (st) => st.x > 0);
    expect(e.__type).toBe('edge');
    expect(e.from).toBe('a');
    expect(e.to).toBe('b');
  });

  it('graph() returns run/runStream stubs that throw', async () => {
    type S = { x: number };
    const g = graph<S>({
      state: state<S>(),
      entry: 'a',
      nodes: { a: node<S>(async (s) => s) },
      edges: [],
    });
    const ctx = { adapter: mockAdapter, model: 'm', budget: budget({ maxSteps: 1 }) };
    await expect(g.run({ x: 0 }, ctx)).rejects.toThrow(NotImplementedError);
  });

  it('memoryCheckpointStore() returns stubs', async () => {
    const s = memoryCheckpointStore<{ x: number }>();
    await expect(s.save('r', 'n', { x: 0 })).rejects.toThrow(NotImplementedError);
    await expect(s.load('r')).rejects.toThrow(NotImplementedError);
    await expect(s.delete('r')).rejects.toThrow(NotImplementedError);
  });
});
