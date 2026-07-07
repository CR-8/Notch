import type {
  ProviderAdapter,
  ProviderConfig,
  ChatProvider,
  EmbeddingProvider,
  ChatRequest,
  TestResult,
} from '../types';
import { AIClientError, describeHttpError } from './errors';

type OpenAIStreamChunk = {
  choices?: Array<{
    delta?: { content?: string };
  }>;
};

function buildChatEndpoint(baseUrl: string): string {
  const url = baseUrl.replace(/\/+$/, '');
  return `${url}/chat/completions`;
}

function buildEmbeddingEndpoint(baseUrl: string): string {
  const url = baseUrl.replace(/\/+$/, '');
  return `${url}/embeddings`;
}

const OpenAICompatibleChatProvider = (cfg: ProviderConfig): ChatProvider => ({
  id: cfg.id,
  capabilities: { streaming: true, maxContextTokens: 128000 },
  async *generate(req: ChatRequest) {
    const endpoint = buildChatEndpoint(cfg.baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      ...cfg.extraHeaders,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: 0.3,
        stream: true,
      }),
      signal: req.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AIClientError(
        describeHttpError('OpenAI-compatible', res.status, text),
        'API_ERROR',
        res.status,
      );
    }

    const reader = res.body?.getReader();
    if (!reader) throw new AIClientError('No response body', 'API_ERROR');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          yield { type: 'done' };
          return;
        }
        try {
          const parsed = JSON.parse(data) as OpenAIStreamChunk;
          const content = parsed.choices?.[0]?.delta?.content ?? '';
          if (content) yield { type: 'text', text: content };
        } catch {
          /* skip */
        }
      }
    }
    yield { type: 'done' };
  },
});

const OpenAICompatibleEmbeddingProvider = (cfg: ProviderConfig): EmbeddingProvider => ({
  id: cfg.id,
  model: cfg.embeddingModel,
  dimensions: cfg.embeddingDimensions || 1536,
  async embed(texts: string[]) {
    const endpoint = buildEmbeddingEndpoint(cfg.baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      ...cfg.extraHeaders,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.embeddingModel,
        input: texts,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AIClientError(
        describeHttpError('Embedding', res.status, text),
        'API_ERROR',
        res.status,
      );
    }

    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  },
});

export function createOpenAIAdapter(): ProviderAdapter {
  return {
    protocol: 'openai',
    createChatProvider: (cfg) => OpenAICompatibleChatProvider(cfg),
    createEmbeddingProvider: (cfg) =>
      cfg.embeddingModel
        ? OpenAICompatibleEmbeddingProvider(cfg)
        : {
            id: cfg.id,
            model: '',
            dimensions: 0,
            embed: () => {
              throw new Error('No embedding model configured');
            },
          },
    async testConnection(cfg: ProviderConfig): Promise<TestResult> {
      const t0 = Date.now();
      try {
        const endpoint = buildChatEndpoint(cfg.baseUrl);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        };
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: cfg.chatModel,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1,
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          return {
            success: false,
            latencyMs: Date.now() - t0,
            error: describeHttpError('OpenAI-compatible', res.status, text),
          };
        }
        const data = (await res.json()) as { model?: string };
        return {
          success: true,
          latencyMs: Date.now() - t0,
          model: data.model ?? cfg.chatModel,
          dimensions: cfg.embeddingDimensions,
        };
      } catch (err) {
        return { success: false, latencyMs: Date.now() - t0, error: (err as Error).message };
      }
    },
  };
}
