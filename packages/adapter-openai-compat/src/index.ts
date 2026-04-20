import { NotImplementedError } from 'flint/errors';
import type {
  NormalizedRequest,
  NormalizedResponse,
  ProviderAdapter,
} from 'flint';
import type { Message, StreamChunk } from 'flint';

export type OpenAICompatAdapterOptions = {
  apiKey?: string;
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  defaultHeaders?: Record<string, string>;
};

export function openaiCompatAdapter(
  _opts: OpenAICompatAdapterOptions,
): ProviderAdapter {
  return {
    name: 'openai-compat',
    capabilities: {
      promptCache: false,
      structuredOutput: true,
      parallelTools: true,
    },
    async call(_req: NormalizedRequest): Promise<NormalizedResponse> {
      throw new NotImplementedError('adapter-openai-compat.call');
    },
    async *stream(_req: NormalizedRequest): AsyncIterable<StreamChunk> {
      throw new NotImplementedError('adapter-openai-compat.stream');
    },
    count(_messages: Message[], _model: string): number {
      throw new NotImplementedError('adapter-openai-compat.count');
    },
  };
}
