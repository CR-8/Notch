import type { ProviderAdapter, ProviderConfig, ChatProvider, EmbeddingProvider, ChatRequest, ChatChunk, TestResult } from '../types';

const MockChatProvider = (cfg: ProviderConfig): ChatProvider => ({
  id: cfg.id,
  capabilities: { streaming: true, maxContextTokens: 100000 },
  async *generate(_req: ChatRequest) {
    yield { type: 'text', text: 'This is a mock response for testing purposes. ' };
    yield { type: 'text', text: 'It simulates a streaming LLM response.' };
    yield { type: 'done' };
  },
});

const MockEmbeddingProvider = (cfg: ProviderConfig): EmbeddingProvider => ({
  id: cfg.id,
  model: cfg.embeddingModel || 'mock-embedding',
  dimensions: cfg.embeddingDimensions || 4,
  async embed(texts: string[]) {
    return texts.map(() => [0.1, 0.2, 0.3, 0.4]);
  },
});

export function createMockAdapter(): ProviderAdapter {
  return {
    protocol: 'openai', // mock reuses the openai protocol slot but with a different id
    createChatProvider: (cfg) => MockChatProvider(cfg),
    createEmbeddingProvider: (cfg) => MockEmbeddingProvider(cfg),
    async testConnection(): Promise<TestResult> {
      return { success: true, latencyMs: 0, model: 'mock-model', dimensions: 4 };
    },
  };
}
