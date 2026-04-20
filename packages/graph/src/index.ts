import type { ProviderAdapter } from 'flint';
import type { Logger, Result } from 'flint';
import type { Budget } from 'flint/budget';
import { NotImplementedError } from 'flint/errors';

export type NodeFn<S, _Input = S> = (state: S, ctx: RunContext) => Promise<S> | S;

export type Node<S> = {
  readonly __type: 'node';
  readonly fn: NodeFn<S>;
};

export function node<S>(fn: NodeFn<S>): Node<S> {
  return { __type: 'node', fn };
}

export type EdgeCondition<S> = (state: S) => boolean;

export type Edge<S> = {
  readonly __type: 'edge';
  readonly from: string | string[];
  readonly to: string | string[];
  readonly when?: EdgeCondition<S>;
};

export function edge<S>(
  from: string | string[],
  to: string | string[],
  when?: EdgeCondition<S>,
): Edge<S> {
  return { __type: 'edge', from, to, ...(when ? { when } : {}) };
}

export function state<S>(): { readonly __type: 'state'; readonly __shape: S } {
  return { __type: 'state', __shape: undefined as S };
}

export type GraphDefinition<S> = {
  state: { readonly __type: 'state'; readonly __shape: S };
  entry: string;
  nodes: Record<string, Node<S>>;
  edges: Edge<S>[];
};

export type RunContext = {
  adapter: ProviderAdapter;
  model: string;
  budget: Budget;
  logger?: Logger;
  signal?: AbortSignal;
};

export type GraphEvent<S> =
  | { type: 'enter'; node: string; state: S }
  | { type: 'exit'; node: string; state: S }
  | { type: 'edge'; from: string; to: string; state: S };

export type Graph<S> = {
  run(initialState: S, ctx: RunContext): Promise<Result<S>>;
  runStream(initialState: S, ctx: RunContext): AsyncIterable<GraphEvent<S>>;
};

export function graph<S>(_def: GraphDefinition<S>): Graph<S> {
  return {
    async run(_initial, _ctx) {
      throw new NotImplementedError('graph.run');
    },
    async *runStream(_initial, _ctx) {
      // biome-ignore lint/correctness/useYield: stub throws before yield
      throw new NotImplementedError('graph.runStream');
    },
  };
}

export interface CheckpointStore<S> {
  save(runId: string, nodeId: string, state: S): Promise<void>;
  load(runId: string): Promise<{ nodeId: string; state: S } | null>;
  delete(runId: string): Promise<void>;
}

export function memoryCheckpointStore<S>(): CheckpointStore<S> {
  return {
    async save() {
      throw new NotImplementedError('graph.memoryCheckpointStore.save');
    },
    async load() {
      throw new NotImplementedError('graph.memoryCheckpointStore.load');
    },
    async delete() {
      throw new NotImplementedError('graph.memoryCheckpointStore.delete');
    },
  };
}
