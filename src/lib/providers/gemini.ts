import type { ProviderAdapter, ProviderConfig, ChatProvider, EmbeddingProvider, ChatRequest, ChatChunk, TestResult } from '../types';
import { AIClientError, describeHttpError } from './errors';

const GeminiChatProvider = (cfg: ProviderConfig): ChatProvider => ({
  id: cfg.id,
  capabilities: { streaming: true, maxContextTokens: 1000000 },
  async *generate(req: ChatRequest) {
    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    // alt=sse makes Gemini stream Server-Sent Events ("data: {…}") instead of a
    // single JSON array; the parser below relies on that line framing.
    const url = `${baseUrl}/models/${req.model}:streamGenerateContent?alt=sse&key=${cfg.apiKey}`;

    const contents = req.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal: req.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AIClientError(describeHttpError('Gemini', res.status, text), 'API_ERROR', res.status);
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
        try {
          const parsed = JSON.parse(line.slice(6));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (text) yield { type: 'text', text };
        } catch { /* skip */ }
      }
    }
    yield { type: 'done' };
  },
});

const GeminiEmbeddingProvider = (cfg: ProviderConfig): EmbeddingProvider => ({
  id: cfg.id,
  model: cfg.embeddingModel || 'models/text-embedding-004',
  dimensions: cfg.embeddingDimensions || 768,
  async embed(texts: string[]) {
    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    const model = cfg.embeddingModel || 'text-embedding-004';
    const results: number[][] = [];

    for (const text of texts) {
      const url = `${baseUrl}/models/${model}:embedContent?key=${cfg.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new AIClientError(describeHttpError('Gemini', res.status, errText), 'API_ERROR', res.status);
      }

      const data = await res.json() as { embedding?: { values?: number[] } };
      if (!data.embedding?.values) throw new AIClientError('No embedding in response', 'API_ERROR');
      results.push(data.embedding.values);
    }

    return results;
  },
});

export function createGeminiAdapter(): ProviderAdapter {
  return {
    protocol: 'gemini',
    createChatProvider: (cfg) => GeminiChatProvider(cfg),
    createEmbeddingProvider: (cfg) => GeminiEmbeddingProvider(cfg),
    async testConnection(cfg: ProviderConfig): Promise<TestResult> {
      const t0 = Date.now();
      try {
        const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
        const url = `${baseUrl}/models/${cfg.chatModel}:generateContent?key=${cfg.apiKey}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          return { success: false, latencyMs: Date.now() - t0, error: describeHttpError('Gemini', res.status, text) };
        }

        // Also test embedding endpoint if configured
        let dimensions: number | undefined;
        if (cfg.embeddingModel) {
          const embedUrl = `${baseUrl}/models/${cfg.embeddingModel}:embedContent?key=${cfg.apiKey}`;
          const embedRes = await fetch(embedUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: { parts: [{ text: 'test' }] } }),
          });
          if (embedRes.ok) {
            const embedData = await embedRes.json() as { embedding?: { values?: number[] } };
            dimensions = embedData.embedding?.values?.length;
          }
        }

        return { success: true, latencyMs: Date.now() - t0, model: cfg.chatModel, dimensions };
      } catch (err) {
        return { success: false, latencyMs: Date.now() - t0, error: (err as Error).message };
      }
    },
  };
}
