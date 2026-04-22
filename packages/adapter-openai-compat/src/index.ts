import type { NormalizedRequest, NormalizedResponse, ProviderAdapter } from 'flint';
import type { ContentPart, Message, StreamChunk, ToolCall } from 'flint';
import { AdapterError } from 'flint/errors';

export type OpenAICompatAdapterOptions = {
  apiKey?: string;
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  defaultHeaders?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// OpenAI API types (internal)
// ---------------------------------------------------------------------------

type OpenAITextContentPart = { type: 'text'; text: string };
type OpenAIImageUrlContentPart = { type: 'image_url'; image_url: { url: string } };
type OpenAIContentPart = OpenAITextContentPart | OpenAIImageUrlContentPart;

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OpenAIContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

type OpenAITool = {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

type OpenAIRequestBody = {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  max_tokens?: number;
  temperature?: number;
  stop?: string[];
  stream?: boolean;
};

type OpenAIUsage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };

type OpenAIResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string | null; tool_calls?: OpenAIToolCall[] };
    finish_reason: string;
  }>;
  usage: OpenAIUsage;
};

type OpenAIDeltaToolCall = {
  index: number;
  id?: string;
  type?: 'function';
  function?: { name?: string; arguments?: string };
};

type OpenAIStreamChunk = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string | null; tool_calls?: OpenAIDeltaToolCall[] };
    finish_reason: string | null;
  }>;
  usage?: OpenAIUsage | null;
};

// ---------------------------------------------------------------------------
// Stop reason mapping
// ---------------------------------------------------------------------------

function mapStopReason(
  reason: string | null | undefined,
): 'end' | 'tool_call' | 'max_tokens' {
  if (reason === 'tool_calls') return 'tool_call';
  if (reason === 'length') return 'max_tokens';
  // OpenAI reports both natural end and stop-sequence hits as 'stop' — cannot distinguish
  return 'end';
}

// ---------------------------------------------------------------------------
// Message normalization: Flint -> OpenAI
// ---------------------------------------------------------------------------

function normalizeMessages(messages: Message[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      out.push({ role: 'system', content: msg.content });
      continue;
    }

    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        out.push({ role: 'user', content: msg.content });
      } else {
        const parts: OpenAIContentPart[] = msg.content.map((part: ContentPart) => {
          if (part.type === 'text') return { type: 'text' as const, text: part.text };
          if (part.type === 'image') return { type: 'image_url' as const, image_url: { url: part.url } };
          return { type: 'image_url' as const, image_url: { url: `data:${part.mediaType};base64,${part.data}` } };
        });
        out.push({ role: 'user', content: parts });
      }
      continue;
    }

    if (msg.role === 'assistant') {
      out.push(
        msg.toolCalls && msg.toolCalls.length > 0
          ? {
              role: 'assistant',
              content: msg.content || null,
              tool_calls: msg.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
              })),
            }
          : { role: 'assistant', content: msg.content },
      );
      continue;
    }

    if (msg.role === 'tool') {
      out.push({ role: 'tool', content: msg.content, tool_call_id: msg.toolCallId });
      continue;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Build request body
// ---------------------------------------------------------------------------

function buildBody(req: NormalizedRequest, streaming: boolean): OpenAIRequestBody {
  const body: OpenAIRequestBody = { model: req.model, messages: normalizeMessages(req.messages) };
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.stopSequences && req.stopSequences.length > 0) body.stop = req.stopSequences;
  if (req.tools && req.tools.length > 0) {
    body.tools = req.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: (t.jsonSchema ?? { type: 'object' }) as Record<string, unknown>,
      },
    }));
  }
  if (streaming) body.stream = true;
  return body;
}

// ---------------------------------------------------------------------------
// SSE parsing
// ---------------------------------------------------------------------------

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string | null; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        let event: string | null = null;
        let data = '';
        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) event = line.slice(7).trim();
          else if (line.startsWith('data: ')) data = line.slice(6).trim();
        }
        if (data) yield { event, data };
      }
    }
    // Flush any remaining buffer content after stream closes
    if (buffer.trim()) {
      let event: string | null = null;
      let data = '';
      for (const line of buffer.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data = line.slice(6).trim();
      }
      if (data) yield { event, data };
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// HTTP error helper
// ---------------------------------------------------------------------------

async function throwHttpError(response: Response, label: string): Promise<never> {
  let errorBody: unknown;
  try { errorBody = await response.json(); } catch { errorBody = null; }
  const msg =
    errorBody != null && typeof errorBody === 'object' && 'error' in errorBody &&
    errorBody.error != null && typeof errorBody.error === 'object' && 'message' in errorBody.error
      ? String((errorBody.error as { message: unknown }).message)
      : `${label} ${response.status}`;
  throw new AdapterError(msg, { code: `adapter.http.${response.status}`, cause: { status: response.status, body: errorBody } });
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

export function openaiCompatAdapter(opts: OpenAICompatAdapterOptions): ProviderAdapter {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const baseUrl = opts.baseUrl.replace(/\/$/, '');

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(opts.defaultHeaders ?? {}),
    };
    if (opts.apiKey) headers['authorization'] = `Bearer ${opts.apiKey}`;
    return headers;
  }

  return {
    name: 'openai-compat',
    capabilities: { promptCache: false, structuredOutput: true, parallelTools: true },

    async call(req: NormalizedRequest): Promise<NormalizedResponse> {
      let response: Response;
      try {
        response = await fetchFn(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify(buildBody(req, false)),
          ...(req.signal != null ? { signal: req.signal } : {}),
        });
      } catch (e) {
        throw new AdapterError('Network error', { code: 'adapter.network', cause: e });
      }
      if (!response.ok) await throwHttpError(response, 'OpenAI-compat');

      const data = (await response.json()) as OpenAIResponse;
      const choice = data.choices[0];
      if (!choice) throw new AdapterError('Empty choices array', { code: 'adapter.parse' });

      const content = choice.message.content ?? '';
      const toolCalls: ToolCall[] = [];
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        for (const tc of choice.message.tool_calls) {
          let parsedArgs: unknown = {};
          try { parsedArgs = JSON.parse(tc.function.arguments); } catch { parsedArgs = {}; }
          toolCalls.push({ id: tc.id, name: tc.function.name, arguments: parsedArgs });
        }
      }

      return {
        message: { role: 'assistant', content, ...(toolCalls.length > 0 ? { toolCalls } : {}) },
        usage: { input: data.usage.prompt_tokens, output: data.usage.completion_tokens },
        stopReason: mapStopReason(choice.finish_reason),
        raw: data,
      };
    },

    async *stream(req: NormalizedRequest): AsyncIterable<StreamChunk> {
      let response: Response;
      try {
        response = await fetchFn(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify(buildBody(req, true)),
          ...(req.signal != null ? { signal: req.signal } : {}),
        });
      } catch (e) {
        throw new AdapterError('Network error', { code: 'adapter.network', cause: e });
      }
      if (!response.ok) await throwHttpError(response, 'OpenAI-compat');
      if (!response.body) throw new AdapterError('No response body', { code: 'adapter.network' });

      type ToolStash = { id: string; name: string; args: string };
      const toolStash = new Map<number, ToolStash>();
      let finalFinishReason: string | null = null;
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const { event, data } of parseSSE(response.body)) {
        if (event === 'error') {
          let parsed: { error?: { message?: string } } = {};
          try { parsed = JSON.parse(data) as { error?: { message?: string } }; } catch { /* use raw data */ }
          throw new AdapterError(parsed.error?.message ?? data, { code: 'adapter.stream', cause: parsed });
        }
        if (data === '[DONE]') break;
        let chunk: OpenAIStreamChunk;
        try { chunk = JSON.parse(data) as OpenAIStreamChunk; } catch { continue; }
        if (chunk.usage) { promptTokens = chunk.usage.prompt_tokens; completionTokens = chunk.usage.completion_tokens; }
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.finish_reason) finalFinishReason = choice.finish_reason;
        const delta = choice.delta;
        if (delta.content) yield { type: 'text', delta: delta.content };
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolStash.has(idx)) toolStash.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' });
            const stash = toolStash.get(idx);
            if (stash) {
              if (tc.id) stash.id = tc.id;
              if (tc.function?.name) stash.name = tc.function.name;
              if (tc.function?.arguments) stash.args += tc.function.arguments;
            }
          }
        }
      }

      for (const [, stash] of toolStash) {
        let parsedArgs: unknown = {};
        try { parsedArgs = JSON.parse(stash.args); } catch { parsedArgs = {}; }
        yield { type: 'tool_call', call: { id: stash.id, name: stash.name, arguments: parsedArgs } };
      }

      yield { type: 'usage', usage: { input: promptTokens, output: completionTokens } };
      yield { type: 'end', reason: mapStopReason(finalFinishReason) };
    },
  };
}
