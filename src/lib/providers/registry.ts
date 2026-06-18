import type { ProviderAdapter, ProviderConfig, ChatProvider, EmbeddingProvider, TestResult } from '../types';
import { log } from '../logger';
import { createOpenAIAdapter } from './openai';
import { createAnthropicAdapter } from './anthropic';
import { createGeminiAdapter } from './gemini';
import { createMockAdapter } from './mock';

const _adapters = new Map<string, ProviderAdapter>();

function register(adapter: ProviderAdapter): void {
  _adapters.set(adapter.protocol, adapter);
  log.info('providers', `Registered adapter: ${adapter.protocol}`);
}

register(createOpenAIAdapter());
register(createAnthropicAdapter());
register(createGeminiAdapter());
register(createMockAdapter());

export function getAdapter(protocol: string): ProviderAdapter {
  const a = _adapters.get(protocol);
  if (!a) throw new Error(`Unknown provider protocol: ${protocol}`);
  return a;
}

export function getChatProvider(cfg: ProviderConfig): ChatProvider {
  return getAdapter(cfg.protocol).createChatProvider(cfg);
}

export function getEmbeddingProvider(cfg: ProviderConfig): EmbeddingProvider {
  return getAdapter(cfg.protocol).createEmbeddingProvider(cfg);
}

export function testProviderConnection(cfg: ProviderConfig): Promise<TestResult> {
  return getAdapter(cfg.protocol).testConnection(cfg);
}

export function listProtocols(): string[] {
  return Array.from(_adapters.keys());
}

export const PRESETS: Array<{
  label: string;
  protocol: 'openai' | 'anthropic' | 'gemini';
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
}> = [
  {
    label: 'Gemini',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    chatModel: 'gemini-2.0-flash',
    embeddingModel: 'models/text-embedding-004',
    embeddingDimensions: 768,
  },
  {
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    chatModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
    embeddingDimensions: 1536,
  },
  {
    label: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    chatModel: 'anthropic/claude-3.5-sonnet',
    embeddingModel: '',
    embeddingDimensions: 0,
  },
  {
    label: 'Groq',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    chatModel: 'llama-3.3-70b-versatile',
    embeddingModel: '',
    embeddingDimensions: 0,
  },
  {
    label: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    chatModel: 'claude-sonnet-4-20250514',
    embeddingModel: '',
    embeddingDimensions: 0,
  },
  {
    label: 'Ollama (Local)',
    protocol: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    chatModel: 'llama3.2',
    embeddingModel: 'nomic-embed-text',
    embeddingDimensions: 768,
  },
];
