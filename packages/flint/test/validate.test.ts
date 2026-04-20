import { describe, expect, it } from 'vitest';
import { ValidationError } from '../src/errors.ts';
import { validate } from '../src/primitives/validate.ts';
import type { StandardSchemaV1 } from '../src/types.ts';

// Build a minimal StandardSchema-compliant schema for tests.
function okSchema<T>(value: T): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: () => ({ value }),
    },
  };
}

function failSchema(issueMessage: string): StandardSchemaV1<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: () => ({ issues: [{ message: issueMessage }] }),
    },
  };
}

function asyncOkSchema<T>(value: T): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: () => Promise.resolve({ value }),
    },
  };
}

describe('validate', () => {
  it('returns Result.ok with the schema value on success', async () => {
    const res = await validate('raw', okSchema({ n: 42 }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual({ n: 42 });
    }
  });

  it('returns Result.error(ValidationError) on issues', async () => {
    const res = await validate('raw', failSchema('bad thing'));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBeInstanceOf(ValidationError);
      expect((res.error as ValidationError).code).toBe('validation.failed');
    }
  });

  it('awaits async schema results', async () => {
    const res = await validate('raw', asyncOkSchema('ok'));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toBe('ok');
    }
  });

  it('attaches issues as error.cause', async () => {
    const res = await validate('raw', failSchema('no good'));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect((res.error as ValidationError).cause).toEqual([{ message: 'no good' }]);
    }
  });
});
