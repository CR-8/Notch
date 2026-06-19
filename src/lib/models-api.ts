/**
 * Live model discovery for OpenAI-compatible endpoints (OpenRouter, Groq, Together,
 * Ollama, …). Hits `GET {baseUrl}/models` — the standard OpenAI list endpoint — and
 * normalises the response. OpenRouter additionally returns names, context length and
 * pricing, which we surface so the picker can flag free models.
 */

export interface ModelOption {
  id: string;
  name: string;
  contextLength?: number;
  /** True when both prompt and completion pricing are 0 (OpenRouter free tier). */
  free?: boolean;
}

interface RawModel {
  id: string;
  name?: string;
  context_length?: number;
  top_provider?: { context_length?: number };
  pricing?: { prompt?: string | number; completion?: string | number };
}

function buildModelsEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/models`;
}

function isFree(pricing?: RawModel['pricing']): boolean | undefined {
  if (!pricing) return undefined;
  const n = (v: string | number | undefined) => (v === undefined ? NaN : Number(v));
  const prompt = n(pricing.prompt);
  const completion = n(pricing.completion);
  if (Number.isNaN(prompt) && Number.isNaN(completion)) return undefined;
  return prompt === 0 && completion === 0;
}

/** Normalises a raw `/models` payload into sorted `ModelOption`s. Pure. */
export function parseModelsResponse(json: unknown): ModelOption[] {
  const data = (json as { data?: RawModel[] })?.data;
  if (!Array.isArray(data)) return [];
  const options = data
    .filter((m) => m && typeof m.id === 'string' && m.id.length > 0)
    .map((m) => ({
      id: m.id,
      name: m.name?.trim() || m.id,
      contextLength: m.context_length ?? m.top_provider?.context_length,
      free: isFree(m.pricing),
    }));
  // Free models first, then alphabetical by id — keeps the no-cost options handy.
  options.sort((a, b) => {
    if (!!a.free !== !!b.free) return a.free ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return options;
}

/**
 * Fetches the available models for an endpoint. The API key is optional (OpenRouter's
 * list is public) but sent when present so private/gated catalogues resolve too.
 * Throws on network/HTTP failure so the caller can show a precise message.
 */
export async function fetchAvailableModels(
  baseUrl: string,
  apiKey?: string,
  signal?: AbortSignal,
): Promise<ModelOption[]> {
  if (!baseUrl.trim()) throw new Error('No endpoint URL configured');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;

  const res = await fetch(buildModelsEndpoint(baseUrl), { method: 'GET', headers, signal });
  if (!res.ok) {
    throw new Error(`Could not load models (HTTP ${res.status}). Check the endpoint URL and API key.`);
  }
  const json = await res.json().catch(() => null);
  const models = parseModelsResponse(json);
  if (models.length === 0) throw new Error('Endpoint returned no models.');
  return models;
}
