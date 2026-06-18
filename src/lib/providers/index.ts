export { AIClientError } from './errors';
export {
  getAdapter,
  getChatProvider,
  getEmbeddingProvider,
  testProviderConnection,
  listProtocols,
  PRESETS,
} from './registry';
export { createOpenAIAdapter } from './openai';
export { createAnthropicAdapter } from './anthropic';
export { createGeminiAdapter } from './gemini';
export { createMockAdapter } from './mock';
