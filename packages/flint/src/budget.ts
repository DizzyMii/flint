import { NotImplementedError } from './errors.ts';
import type { Usage } from './types.ts';

export type BudgetLimits = {
  maxSteps?: number;
  maxTokens?: number;
  maxDollars?: number;
};

export type BudgetRemaining = {
  steps?: number;
  tokens?: number;
  dollars?: number;
};

export type ConsumeInput = Usage & { cost?: number };

export type Budget = {
  consume(x: ConsumeInput): void;
  remaining(): BudgetRemaining;
  assertNotExhausted(): void;
  readonly limits: BudgetLimits;
};

export function budget(limits: BudgetLimits): Budget {
  return {
    limits,
    consume(_x) {
      throw new NotImplementedError('budget.consume');
    },
    remaining() {
      throw new NotImplementedError('budget.remaining');
    },
    assertNotExhausted() {
      throw new NotImplementedError('budget.assertNotExhausted');
    },
  };
}
