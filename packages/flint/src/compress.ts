import type { ProviderAdapter } from './adapter.ts';
import { NotImplementedError } from './errors.ts';
import type { Message } from './types.ts';

export type CompressCtx = {
  budget?: { remaining(): { tokens?: number } };
  model?: string;
};

export type Transform = (messages: Message[], ctx: CompressCtx) => Promise<Message[]>;

export function pipeline(...transforms: Transform[]): Transform {
  return async (messages, ctx) => {
    let current = messages;
    for (const t of transforms) {
      current = await t(current, ctx);
    }
    return current;
  };
}

export function dedup(): Transform {
  return async (messages) => {
    const seen = new Set<string>();
    const result: Message[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        result.push(msg);
        continue;
      }
      const contentKey =
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const key = `${msg.role}:${contentKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(msg);
    }
    return result;
  };
}

export type TruncateOpts = { maxChars: number };

export function truncateToolResults(opts: TruncateOpts): Transform {
  if (opts.maxChars <= 50) {
    throw new TypeError(
      `truncateToolResults: maxChars must be > 50 (got ${opts.maxChars})`,
    );
  }
  const { maxChars } = opts;
  return async (messages) => {
    return messages.map((msg) => {
      if (msg.role !== 'tool') return msg;
      if (msg.content.length <= maxChars) return msg;
      const dropped = msg.content.length - maxChars;
      const marker = `…[truncated, ${dropped} chars dropped]`;
      const sliceLen = Math.max(0, maxChars - marker.length);
      return {
        ...msg,
        content: msg.content.slice(0, sliceLen) + marker,
      };
    });
  };
}

export type WindowOpts = {
  keep: number;
  alwaysKeep?: Array<Message['role']>;
};

function validateWindow(opts: WindowOpts, name: string): void {
  if (opts.keep < 0 || !Number.isInteger(opts.keep)) {
    throw new TypeError(`${name}: keep must be a non-negative integer (got ${opts.keep})`);
  }
}

function applyWindow(
  messages: Message[],
  keep: number,
  alwaysKeepRoles: Array<Message['role']>,
  take: 'first' | 'last',
): Message[] {
  // Partition with original indices
  const kept: Array<{ index: number; msg: Message }> = [];
  const eligible: Array<{ index: number; msg: Message }> = [];
  messages.forEach((msg, index) => {
    if (alwaysKeepRoles.includes(msg.role)) {
      kept.push({ index, msg });
    } else {
      eligible.push({ index, msg });
    }
  });

  const taken =
    take === 'last' ? eligible.slice(Math.max(0, eligible.length - keep)) : eligible.slice(0, keep);

  const merged = [...kept, ...taken].sort((a, b) => a.index - b.index);
  return merged.map((x) => x.msg);
}

export function windowLast(opts: WindowOpts): Transform {
  validateWindow(opts, 'windowLast');
  const alwaysKeepRoles = opts.alwaysKeep ?? ['system'];
  return async (messages) => applyWindow(messages, opts.keep, alwaysKeepRoles, 'last');
}

export function windowFirst(opts: WindowOpts): Transform {
  validateWindow(opts, 'windowFirst');
  const alwaysKeepRoles = opts.alwaysKeep ?? ['system'];
  return async (messages) => applyWindow(messages, opts.keep, alwaysKeepRoles, 'first');
}


export type SummarizeOpts = {
  when: (messages: Message[]) => boolean;
  adapter: ProviderAdapter;
  model: string;
  keepLast?: number;
};
export function summarize(_opts: SummarizeOpts): Transform {
  return async () => {
    throw new NotImplementedError('compress.summarize');
  };
}

export function orderForCache(): Transform {
  return async () => {
    throw new NotImplementedError('compress.orderForCache');
  };
}
