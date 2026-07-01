import type {
  ProviderAdapter,
  ProviderConfig,
  ChatProvider,
  ChatRequest,
  TestResult,
} from '../types';
import { AIClientError, describeHttpError } from './errors';

type AnthropicStreamEvent =
  | { type: 'content_block_delta'; delta?: { text?: string } }
  | { type: 'message_stop' }
  | { type: string; delta?: { text?: string } };

const AnthropicChatProvider = (cfg: ProviderConfig): ChatProvider => ({
  id: cfg.id,
  capabilities: { streaming: true, maxContextTokens: 200000 },
  async *generate(req: ChatRequest) {
    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    const systemMsg = req.messages.find((m) => m.role === 'system')?.content ?? '';
    const msgs = req.messages.filter((m) => m.role !== 'system');

    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        ...cfg.extraHeaders,
      },
      body: JSON.stringify({
        model: req.model,
        system: systemMsg,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 4096,
        stream: true,
      }),
      signal: req.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AIClientError(
        describeHttpError('Anthropic', res.status, text),
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
        try {
          const parsed = JSON.parse(line.slice(6)) as AnthropicStreamEvent;
          if (parsed.type === 'content_block_delta') {
            const text = parsed.delta?.text ?? '';
            if (text) yield { type: 'text', text };
          }
          if (parsed.type === 'message_stop') {
            yield { type: 'done' };
            return;
          }
        } catch {
          /* skip */
        }
      }
    }
    yield { type: 'done' };
  },
});

export function createAnthropicAdapter(): ProviderAdapter {
  return {
    protocol: 'anthropic',
    createChatProvider: (cfg) => AnthropicChatProvider(cfg),
    createEmbeddingProvider: () => {
      throw new Error('Anthropic does not provide embedding endpoints');
    },
    async testConnection(cfg: ProviderConfig): Promise<TestResult> {
      const t0 = Date.now();
      try {
        const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
        const res = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': cfg.apiKey,
            'anthropic-version': '2023-06-01',
          },
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
            error: describeHttpError('Anthropic', res.status, text),
          };
        }
        const data = (await res.json()) as { model?: string };
        return { success: true, latencyMs: Date.now() - t0, model: data.model ?? cfg.chatModel };
      } catch (err) {
        return { success: false, latencyMs: Date.now() - t0, error: (err as Error).message };
      }
    },
  };
}
