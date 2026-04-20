import { describe, expect, it } from 'vitest';
import { budget } from '../src/budget.ts';
import { NotImplementedError } from '../src/errors.ts';

describe('budget', () => {
  it('budget() is a function', () => {
    expect(typeof budget).toBe('function');
  });

  it('returns an object with consume/remaining/assertNotExhausted', () => {
    const b = budget({ maxSteps: 5, maxTokens: 1000, maxDollars: 0.1 });
    expect(typeof b.consume).toBe('function');
    expect(typeof b.remaining).toBe('function');
    expect(typeof b.assertNotExhausted).toBe('function');
  });

  it('consume throws NotImplementedError (stub)', () => {
    const b = budget({ maxSteps: 5 });
    expect(() => b.consume({ input: 1, output: 1 })).toThrow(NotImplementedError);
  });

  it('remaining throws NotImplementedError (stub)', () => {
    const b = budget({ maxSteps: 5 });
    expect(() => b.remaining()).toThrow(NotImplementedError);
  });

  it('assertNotExhausted throws NotImplementedError (stub)', () => {
    const b = budget({ maxSteps: 5 });
    expect(() => b.assertNotExhausted()).toThrow(NotImplementedError);
  });
});
