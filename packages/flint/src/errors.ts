type FlintErrorOptions = {
  code: string;
  cause?: unknown;
};

export class FlintError extends Error {
  readonly code: string;
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, { cause: opts.cause });
    this.code = opts.code;
    this.name = 'FlintError';
  }
}

export class AdapterError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'AdapterError';
  }
}

export class ValidationError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'ValidationError';
  }
}

export class ToolError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'ToolError';
  }
}

export class BudgetExhausted extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'BudgetExhausted';
  }
}

export class ParseError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'ParseError';
  }
}

export class TimeoutError extends FlintError {
  constructor(message: string, opts: FlintErrorOptions) {
    super(message, opts);
    this.name = 'TimeoutError';
  }
}

export class NotImplementedError extends FlintError {
  constructor(what: string) {
    super(`Not implemented: ${what}`, { code: 'not_implemented' });
    this.name = 'NotImplementedError';
  }
}
