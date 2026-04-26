import type { ContentFrame, GenerationMode, GeminiModel, Settings } from './types';
import { log } from './logger';

// ─── Typed Errors ────────────────────────────────────────────────────────────

export class AIClientError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_KEY' | 'API_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR',
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AIClientError';
  }
}

// ─── Model Mapping ────────────────────────────────────────────────────────────

// Ordered model fallback chains by generation mode.
// If a model returns 429 quota exhaustion, the next model is tried automatically.
const MODE_TO_MODEL_CHAIN: Record<Exclude<GenerationMode, 'LOCAL'>, GeminiModel[]> = {
  FAST: ['gemini-3.1-flash-lite-preview', 'gemma-3-27b-it'],
  BALANCED: ['gemma-3-12b-it', 'gemma-3-4b-it'],
  DEEP: ['gemma-3-27b-it' , 'gemma-3-12b-it'],
};

const RAG_MODEL_CHAIN: GeminiModel[] = ['gemma-3-12b-it', 'gemini-3.1-flash-lite-preview'];

const MAX_CAPTURE_CONTENT_CHARS = 18_000;
const MAX_CAPTURE_IMAGE_REFS_CHARS = 4_000;
const QUOTA_RETRY_LIMIT = 2;

function trimForQuota(input: string, maxChars: number, label: string): string {
  if (input.length <= maxChars) return input;

  const headChars = Math.floor(maxChars * 0.75);
  const tailChars = maxChars - headChars;
  const removed = input.length - maxChars;
  log.warn('ai-client', `${label} is large (${input.length} chars). Trimming ${removed} chars to reduce token usage.`);

  return [
    input.slice(0, headChars),
    '',
    `[TRUNCATED ${removed} CHARACTERS TO STAY WITHIN FREE-TIER QUOTA]`,
    '',
    input.slice(-tailChars),
  ].join('\n');
}

function isQuotaExceededError(err: AIClientError): boolean {
  if (err.status === 429) return true;
  return /RESOURCE_EXHAUSTED|quota exceeded|quota/i.test(err.message);
}

function parseRetryDelayMs(message: string): number {
  const msMatch = message.match(/retry in\s+([0-9.]+)ms/i);
  if (msMatch) {
    const parsed = Math.ceil(Number(msMatch[1]));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const secMatch = message.match(/"retryDelay"\s*:\s*"([0-9.]+)s"/i);
  if (secMatch) {
    const parsed = Math.ceil(Number(secMatch[1]) * 1000);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 1200;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Prompt Templates ─────────────────────────────────────────────────────────

function buildFastPrompt(content: string, imageRefs: string, frame?: ContentFrame): string {
  const frameHint = frame && frame.total > 1
    ? `\n\n[FRAME ${frame.index + 1} of ${frame.total}] This is segment ${frame.index + 1} of a larger document. ${frame.index === 0 ? 'Include full structure: title, summary, key points, entities, concepts, timeline, diagrams, images, and main content.' : 'Continue the main content. Do NOT repeat the title, summary, key points, entities, concepts, or timeline — only add new content sections.'}\n`
    : '';
  return `You are a document structuring assistant. Given the following web page content, produce a structured markdown document.${frameHint}

Requirements:
  - Title: Extract or infer a clear document title as the top-level # heading
  - Summary: 2-3 sentence summary under ## Summary
  - Key Points: 3-5 concise bullets under ## Key Points
  - Key Entities: List named people, organizations, technologies, and concepts
  - Main Content: Restructure into logical sections with ## headings
  - Diagrams: Convert flowcharts and block diagrams to \`\`\`mermaid\`\`\` blocks, and UML/use-case/sequence/class diagrams to \`\`\`plantuml\`\`\` blocks
  - Images/Photos: Keep image references near the most relevant section and preserve their alt text/captions
  - Timeline: Extract chronological events if applicable

Output ONLY valid markdown. No preamble or explanation.

PAGE CONTENT:
${content}

IMAGE REFERENCES:
${imageRefs}`;
}

function buildDeepPrompt(content: string, imageRefs: string, frame?: ContentFrame): string {
  const frameHint = frame && frame.total > 1
    ? `\n\n[FRAME ${frame.index + 1} of ${frame.total}] This is segment ${frame.index + 1} of a larger document. ${frame.index === 0 ? 'Include full structure: title, summary, key entities, concepts, timeline, and main content.' : 'Continue the main content sections only. Do NOT repeat title, summary, entities, concepts, or timeline — only add new content.'}\n`
    : '';
  return `You are an expert knowledge structuring assistant. Produce a comprehensive structured markdown document for a developer knowledge base.${frameHint}

Requirements:
- Title: Precise document title as the top-level # heading
- Summary: 4-6 sentence executive summary under ## Summary
- Key Points: 3-7 high-signal bullets under ## Key Points
- Key Entities: Exhaustive list (people, orgs, technologies, concepts, APIs) with types
- Timeline: Chronological events with dates
- Concepts: Deep explanations of key technical terms
- Main Content: Logical sections with ## and ### headings
- Code blocks: Preserve with correct language identifiers
- Diagrams: Convert ALL ASCII art, flowcharts, and block diagrams to \`\`\`mermaid\`\`\`; convert UML, use-case, sequence, and class diagrams to \`\`\`plantuml\`\`\`
- Images/Photos: Place image references contextually beside the most relevant section and preserve their alt text

Output ONLY valid markdown. No preamble or explanation.

PAGE CONTENT:
${content}

IMAGE REFERENCES:
${imageRefs}`;
}

function buildRAGPrompt(query: string, chunks: string): string {
  return `You are a precise question-answering assistant. Answer using ONLY the provided document excerpts.

Rules:
- Cite each piece of information with [N] where N is the excerpt number
- If the answer is not in the excerpts, say "I cannot find that in this document."
- Be concise and direct
- Do not hallucinate information not present in the excerpts

DOCUMENT EXCERPTS:
${chunks}

USER QUESTION:
${query}`;
}

// ─── Gemini API Caller ────────────────────────────────────────────────────────

async function callGemini(model: string, prompt: string, apiKey: string, signal: AbortSignal): Promise<string> {
  log.info('ai-client', `Calling Gemini model: ${model}`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new AIClientError(
      `Gemini API error ${res.status}: ${body || res.statusText}`,
      'API_ERROR',
      res.status,
    );
    log.error('ai-client', `Gemini ${model} failed`, err);
    throw err;
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  log.success('ai-client', `Gemini ${model} responded (${text.length} chars)`);
  return text;
}

async function callGeminiWithFallback(
  models: GeminiModel[],
  prompt: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<string> {
  let lastError: AIClientError | null = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= QUOTA_RETRY_LIMIT; attempt++) {
      try {
        return await callGemini(model, prompt, apiKey, signal);
      } catch (err) {
        if (!(err instanceof AIClientError)) throw err;

        lastError = err;
        const quotaHit = isQuotaExceededError(err);
        const hasNextRetry = attempt < QUOTA_RETRY_LIMIT;

        if (quotaHit && hasNextRetry) {
          const waitMs = parseRetryDelayMs(err.message) + Math.floor(Math.random() * 350) + 200;
          log.warn('ai-client', `Quota hit on ${model}; retrying in ${waitMs}ms (attempt ${attempt + 1}/${QUOTA_RETRY_LIMIT})`);
          await sleep(waitMs);
          continue;
        }

        if (quotaHit) {
          log.warn('ai-client', `Quota still exhausted on ${model}; trying fallback model.`);
          break;
        }

        // For non-quota API errors, fail fast instead of silently hopping models.
        throw err;
      }
    }
  }

  throw lastError ?? new AIClientError('All Gemini fallback models failed.', 'API_ERROR');
}

function normalizeOllamaEndpoint(endpoint: string): string {
  const base = endpoint.trim().replace(/\/$/, '');
  return base.endsWith('/api/generate') ? base : `${base}/api/generate`;
}

async function callOllama(prompt: string, settings: Settings, signal: AbortSignal): Promise<string> {
  const url = normalizeOllamaEndpoint(settings.ollamaEndpoint || 'http://localhost:11434');
  const model = settings.ollamaModel || 'llama3';
  log.info('ai-client', `Calling Ollama model: ${model}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        num_predict: 512,
      },
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new AIClientError(
      `Ollama API error ${res.status}: ${body || res.statusText}`,
      'API_ERROR',
      res.status,
    );
    log.error('ai-client', 'Ollama call failed', err);
    throw err;
  }

  const data = await res.json();
  const text = (data.response ?? '').toString();
  if (!text) {
    throw new AIClientError('Ollama returned an empty response.', 'API_ERROR');
  }

  log.success('ai-client', `Ollama ${model} responded (${text.length} chars)`);
  return text;
}

// ─── Timeout Helper ───────────────────────────────────────────────────────────

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendCaptureRequest(
  content: string,
  imageRefs: Array<{ url: string; alt: string; paragraphContext: string }>,
  mode: GenerationMode,
  settings: Settings,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  const { signal, clear } = withTimeout(300_000);
  try {
    const provider = settings.provider ?? 'gemini';

    if (provider === 'ollama') {
      const imageRefsText = imageRefs
        .map(img => `[IMG: ${img.url} | ${img.alt} | ${img.paragraphContext}]`)
        .join('\n');
      const prompt = mode === 'DEEP'
        ? buildDeepPrompt(content, imageRefsText)
        : buildFastPrompt(content, imageRefsText);
      return await callOllama(prompt, settings, signal);
    }

    if (provider !== 'gemini') {
      throw new AIClientError(`Provider ${provider} is not supported by sendCaptureRequest.`, 'API_ERROR');
    }

    if (!settings.apiKeys.gemini) {
      throw new AIClientError('No Gemini API key configured. Add your key in Settings.', 'MISSING_KEY');
    }

    const cappedContent = trimForQuota(content, MAX_CAPTURE_CONTENT_CHARS, 'Capture content');
    const imageRefsText = trimForQuota(
      imageRefs.map((img) => `[IMG: ${img.url} | ${img.alt} | ${img.paragraphContext}]`).join('\n'),
      MAX_CAPTURE_IMAGE_REFS_CHARS,
      'Image references',
    );

    const prompt = mode === 'DEEP'
      ? buildDeepPrompt(cappedContent, imageRefsText)
      : buildFastPrompt(cappedContent, imageRefsText);

    const effectiveMode: Exclude<GenerationMode, 'LOCAL'> = mode === 'LOCAL' ? 'BALANCED' : mode;
    const modelChain = MODE_TO_MODEL_CHAIN[effectiveMode];
    return await callGeminiWithFallback(modelChain, prompt, settings.apiKeys.gemini, signal);
  } catch (err) {
    if (err instanceof AIClientError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AIClientError('Request timed out after 5 minutes.', 'TIMEOUT');
    }
    throw new AIClientError(`Network error: ${(err as Error).message}`, 'NETWORK_ERROR');
  } finally {
    clear();
  }
}

export async function sendRAGRequest(
  query: string,
  chunks: Array<{ text: string; paragraphIndex: number; source?: 'document' | 'history' }>,
  settings: Settings,
): Promise<string> {
  const chunksText = chunks
    .map((c, i) => {
      const sourceLabel = c.source === 'history' ? 'conversation history' : 'document';
      return `[${i + 1}] (${sourceLabel}) ${c.text}`;
    })
    .join('\n\n');
  const prompt = buildRAGPrompt(query, chunksText);

  const { signal, clear } = withTimeout(120_000);
  try {
    const provider = settings.provider ?? 'gemini';
    if (provider === 'ollama') {
      return await callOllama(prompt, settings, signal);
    }

    if (provider !== 'gemini') {
      throw new AIClientError(`Provider ${provider} is not supported by sendRAGRequest.`, 'API_ERROR');
    }

    if (!settings.apiKeys.gemini) {
      throw new AIClientError('No Gemini API key configured.', 'MISSING_KEY');
    }

    return await callGeminiWithFallback(RAG_MODEL_CHAIN, prompt, settings.apiKeys.gemini, signal);
  } catch (err) {
    if (err instanceof AIClientError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AIClientError('RAG query timed out after 2 minutes.', 'TIMEOUT');
    }
    throw new AIClientError(`Network error: ${(err as Error).message}`, 'NETWORK_ERROR');
  } finally {
    clear();
  }
}
