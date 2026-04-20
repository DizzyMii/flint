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

export type WindowOpts = { keep: number; alwaysKeep?: Array<Message['role']> };
export function windowLast(_opts: WindowOpts): Transform {
  return async () => {
    throw new NotImplementedError('compress.windowLast');
  };
}

export function windowFirst(_opts: WindowOpts): Transform {
  return async () => {
    throw new NotImplementedError('compress.windowFirst');
  };
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
