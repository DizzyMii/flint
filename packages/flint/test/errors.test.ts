import { describe, expect, it } from 'vitest';
import {
  AdapterError,
  BudgetExhausted,
  FlintError,
  NotImplementedError,
  ParseError,
  TimeoutError,
  ToolError,
  ValidationError,
} from '../src/errors.ts';

describe('errors', () => {
  it('FlintError has code and optional cause', () => {
    const cause = new Error('root');
    const e = new FlintError('msg', { code: 'test.code', cause });
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('test.code');
    expect(e.cause).toBe(cause);
    expect(e.name).toBe('FlintError');
  });

  it('all subclasses extend FlintError and set name', () => {
    const cases: Array<[string, FlintError]> = [
      ['AdapterError', new AdapterError('x', { code: 'adapter.http.500' })],
      ['ValidationError', new ValidationError('x', { code: 'validation.failed' })],
      ['ToolError', new ToolError('x', { code: 'tool.failed' })],
      ['BudgetExhausted', new BudgetExhausted('x', { code: 'budget.tokens' })],
      ['ParseError', new ParseError('x', { code: 'parse.json' })],
      ['TimeoutError', new TimeoutError('x', { code: 'timeout' })],
      ['NotImplementedError', new NotImplementedError('x')],
    ];
    for (const [name, err] of cases) {
      expect(err).toBeInstanceOf(FlintError);
      expect(err.name).toBe(name);
    }
  });

  it('NotImplementedError has a fixed code', () => {
    expect(new NotImplementedError('x').code).toBe('not_implemented');
  });
});
