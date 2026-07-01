import type { ContentFrame, GenerationMode, Settings } from './types';
import { log } from './logger';
import { sanitizeAiResponse, formatMarkdown, formatChatResponse } from './sanitize';

// ─── Typed Errors ──────────────────────────────────────────────────────────────

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

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_CAPTURE_CONTENT_CHARS = 18_000;
const MAX_CAPTURE_IMAGE_REFS_CHARS = 4_000;
const QUOTA_RETRY_LIMIT = 2;
const FRAME_TARGET_CHARS = 14_000;
const MAX_FRAMES = 8;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaExceeded(err: AIClientError): boolean {
  return err.status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(err.message);
}

function parseRetryDelay(err: AIClientError): number {
  const msMatch = err.message.match(/retry.?in\s+([0-9.]+)\s*ms/i);
  if (msMatch) {
    const v = Math.ceil(Number(msMatch[1]));
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 1500;
}

// ─── Content Fragmentation ─────────────────────────────────────────────────────

function fragmentIntoFrames(content: string, targetChars: number): string[] {
  if (content.length <= targetChars) return [content];

  const paragraphs = content.split(/\n\n+/);
  const frames: string[] = [];
  let currentFrame = '';

  for (const para of paragraphs) {
    const candidate = currentFrame ? `${currentFrame}\n\n${para}` : para;
    if (candidate.length > targetChars && currentFrame.length > 0) {
      frames.push(currentFrame);
      currentFrame = para;
    } else {
      currentFrame = candidate;
    }
  }
  if (currentFrame) frames.push(currentFrame);

  const finalFrames: string[] = [];
  for (const frame of frames) {
    if (frame.length <= targetChars) {
      finalFrames.push(frame);
    } else {
      const lines = frame.split('\n');
      let chunk = '';
      for (const line of lines) {
        const candidate = chunk ? `${chunk}\n${line}` : line;
        if (candidate.length > targetChars && chunk.length > 0) {
          finalFrames.push(chunk);
          chunk = line;
        } else {
          chunk = candidate;
        }
      }
      if (chunk) finalFrames.push(chunk);
    }
  }
  return finalFrames.slice(0, MAX_FRAMES);
}

function reassembleFrameResponses(responses: string[]): string {
  if (responses.length === 0) return '';
  if (responses.length === 1) return responses[0];

  const continuationParts: string[] = [];
  for (let i = 1; i < responses.length; i++) {
    const stripped = responses[i]
      .replace(/^#\s+.+\n*/m, '')
      .replace(
        /^##\s+(?:SUMMARY|Key Points|Key Entities|Timeline|Concepts)\s*\n[\s\S]*?(?=\n##\s|\n*$)/gim,
        '',
      )
      .trim();
    if (stripped) continuationParts.push(stripped);
  }

  return continuationParts.length === 0
    ? responses[0]
    : `${responses[0]}\n\n${continuationParts.join('\n\n')}`;
}

// ─── Prompt Templates ──────────────────────────────────────────────────────────

function buildCapturePrompt(content: string, imageRefs: string, frame?: ContentFrame): string {
  const frameHint =
    frame && frame.total > 1
      ? frame.index === 0
        ? `\n\n[FRAME ${frame.index + 1}/${frame.total}] Include: title, summary, key points, key entities, concepts, timeline, and main content sections.`
        : `\n\n[FRAME ${frame.index + 1}/${frame.total}] Continue main content only. Do NOT repeat title, summary, key points, entities, concepts, or timeline.`
      : '';

  return `You are a document structuring assistant. Given the following web page content, produce a clean, well-formatted markdown document.${frameHint}

FORMATTING RULES:
- Use ATX-style headings (# for title, ## for main sections, ### for subsections)
- Keep headings short and descriptive (max 60 characters)
- Use bullet points (-) for lists, not numbered lists unless sequence matters
- Wrap lines at 100 characters max for readability
- Use bold for emphasis sparingly, only on key terms first use
- Add blank line before and after code blocks
- Use semantic spacing: one blank line between major sections

STRUCTURE (use these exact headings):
# Document Title

## Summary
2-3 sentence overview of the document's purpose and content.

## Key Points
- First key point (start with action verbs when possible)
- Second key point
- Third key point
- Add more as needed (3-7 bullets max)

## Key Entities
Named people, organizations, technologies, products, and concepts encountered.

## Concepts
Key technical terms or concepts that need explanation (term: brief definition).

## Timeline (if applicable)
Chronological events with dates or relative time markers.

## Main Content
Logical sections covering the document's substance. Use ### for subsections.

## Images
Reference images near their most relevant section with clear context.

## Key Takeaways
2-3 sentence closing summary of the most important insights.

Output ONLY valid markdown. No preamble, no explanations.

PAGE CONTENT:
${content}

IMAGE REFERENCES:
${imageRefs}`;
}

function buildRAGPrompt(query: string, chunks: string): string {
  return `You are a precise question-answering assistant. Answer the user's question using ONLY the provided document excerpts.

RESPONSE FORMAT:
- Start with direct answer (1-2 sentences)
- Follow with supporting details if needed
- Cite each fact with [N] where N is the excerpt number in brackets
- Use bullet points for multiple pieces of information
- Keep answers focused and complete

RULES:
- If the answer is not in the excerpts, state: "I cannot find that in this document."
- Never hallucinate or infer information not present in the excerpts
- Answer exactly what was asked - don't over-explain
- Be direct: lead with the answer, then support

DOCUMENT EXCERPTS:
${chunks}

USER QUESTION:
${query}

YOUR ANSWER:`;
}

function buildDeepPrompt(content: string, imageRefs: string, frame?: ContentFrame): string {
  const frameHint =
    frame && frame.total > 1
      ? frame.index === 0
        ? `\n\n[FRAME ${frame.index + 1}/${frame.total}] Include full structure: title, summary, key points, entities, concepts, timeline, and main content.`
        : `\n\n[FRAME ${frame.index + 1}/${frame.total}] Continue main content only. Do NOT repeat title, summary, points, entities, concepts, or timeline.`
      : '';

  return `You are an expert knowledge structuring assistant. Produce a comprehensive, well-formatted markdown document.${frameHint}

FORMATTING RULES:
- Use ATX-style headings (# ## ###) - no underline-style headings
- Wrap long lines at 100 characters for readability
- Use consistent bullet style: dash (-) not asterisk
- Bold only for first occurrence of key terms
- Use tables for structured data comparisons
- Code blocks must have language identifiers
- Add semantic blank lines between sections

STRUCTURE (in this order):
# Document Title (clear, specific)

## Summary
4-6 sentence executive summary covering what, why, and so what.

## Key Points
- High-signal bullet (lead with insight, not topic)
- Second major insight
- Additional key points (3-7 total)
- End with actionable or surprising insight

## Key Entities
People, organizations, technologies, APIs, products, locations. Format: **Name** (type): brief description

## Concepts
Technical terms requiring explanation. Format: **Term**: clear definition

## Timeline
Chronological sequence of events. Format: Date - Event description

## Main Content
Hierarchical sections (## and ###) covering the document thoroughly. Include:
- Problem/Context
- Solutions/Approaches
- Results/Outcomes
- Implications

## Code Examples (if applicable)
Preserve with correct syntax highlighting.

## Diagrams
- Flowcharts → mermaid
- UML → plantuml
- Architecture → mermaid with flowchart TB/LR

## Images
Place near relevant content with descriptive caption.

## Key Takeaways
2-3 sentence synthesis: what this means for the reader.

Output ONLY valid markdown. No preamble, no explanation.

PAGE CONTENT:
${content}

IMAGE REFERENCES:
${imageRefs}`;
}

// ─── API Callers ──────────────────────────────────────────────────────────────

interface LLMResponse {
  content: string;
  model: string;
  cached: boolean;
}

async function callOpenAICompatible(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  signal: AbortSignal,
): Promise<LLMResponse> {
  // Default to Anthropic if no baseUrl provided
  const resolvedBaseUrl = baseUrl.trim() || 'https://api.anthropic.com';

  // Determine endpoint based on provider and model
  let endpoint: string;
  const isOpenCodeZen = resolvedBaseUrl.includes('opencode.ai/zen');

  if (isOpenCodeZen) {
    // OpenCode Zen uses different endpoints based on model type
    // Claude models use /messages, GPT models use /responses, others use /chat/completions
    const base = resolvedBaseUrl.endsWith('/') ? resolvedBaseUrl.slice(0, -1) : resolvedBaseUrl;
    if (
      model.includes('claude') ||
      model.includes('opus') ||
      model.includes('sonnet') ||
      model.includes('haiku')
    ) {
      endpoint = `${base}/v1/messages`;
    } else if (model.includes('gpt-') || model.includes('gemini')) {
      endpoint = `${base}/v1/responses`;
    } else {
      endpoint = `${base}/v1/chat/completions`;
    }
  } else {
    endpoint = resolvedBaseUrl.endsWith('/')
      ? `${resolvedBaseUrl}v1/chat/completions`
      : `${resolvedBaseUrl}/v1/chat/completions`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: isOpenCodeZen ? `opencode/${model}` : model, // OpenCode Zen requires opencode/ prefix
      messages,
      temperature: 0.3,
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new AIClientError(
      `API error ${res.status}: ${body || res.statusText}`,
      'API_ERROR',
      res.status,
    );
    log.error('ai-client', `${model} failed (${res.status})`, err);
    throw err;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string; refusal?: string } }>;
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number };
  };

  const rawContent = data.choices?.[0]?.message?.content;
  if (typeof rawContent !== 'string' || rawContent.length === 0) {
    throw new AIClientError('Empty response from model', 'API_ERROR');
  }

  return {
    content: rawContent,
    model: data.model ?? model,
    cached: (data.usage?.cached_tokens ?? 0) > 0,
  };
}

async function callWithFallback(
  baseUrl: string,
  models: string[],
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  signal: AbortSignal,
): Promise<LLMResponse> {
  let lastError: AIClientError | null = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= QUOTA_RETRY_LIMIT; attempt++) {
      try {
        return await callOpenAICompatible(baseUrl, model, messages, apiKey, signal);
      } catch (err) {
        if (!(err instanceof AIClientError)) throw err;
        lastError = err;

        if (isQuotaExceeded(err) && attempt < QUOTA_RETRY_LIMIT) {
          const waitMs = parseRetryDelay(err) + Math.floor(Math.random() * 300);
          log.warn('ai-client', `Quota hit on ${model}; retrying in ${waitMs}ms`);
          await sleep(waitMs);
          continue;
        }

        if (isQuotaExceeded(err)) {
          log.warn('ai-client', `Quota exhausted on ${model}; trying next model`);
          break;
        }

        throw err;
      }
    }
  }

  throw lastError ?? new AIClientError('All models failed', 'API_ERROR');
}

// ─── Timeout ───────────────────────────────────────────────────────────────────

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function sendCaptureRequest(
  content: string,
  imageRefs: Array<{ url: string; alt: string; paragraphContext: string }>,
  mode: GenerationMode,
  settings: Settings,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  const { signal, clear } = withTimeout(300_000);
  try {
    if (!settings.apiKey) {
      throw new AIClientError('No API key configured. Add your key in Settings.', 'MISSING_KEY');
    }

    if (settings.provider === 'offline') {
      throw new AIClientError('Offline provider cannot be used for capture.', 'API_ERROR');
    }

    const imageRefsText = imageRefs
      .map((img) => `[IMG: ${img.url} | ${img.alt} | ${img.paragraphContext}]`)
      .join('\n');
    const cappedImageRefs =
      imageRefsText.length > MAX_CAPTURE_IMAGE_REFS_CHARS
        ? imageRefsText.slice(0, MAX_CAPTURE_IMAGE_REFS_CHARS)
        : imageRefsText;

    // Build message for single or multi-frame
    const buildMessages = (frameContent: string, frame?: ContentFrame) => {
      const prompt =
        mode === 'DEEP'
          ? buildDeepPrompt(frameContent, cappedImageRefs, frame)
          : buildCapturePrompt(frameContent, cappedImageRefs, frame);
      return [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: prompt },
      ];
    };

    const models = settings.modelId
      ? [settings.modelId]
      : ['claude-3-5-sonnet-20241022', 'openai/gpt-4o'];

    if (settings.provider === 'openai-compatible') {
      const singleContent =
        content.length > FRAME_TARGET_CHARS ? content.slice(0, MAX_CAPTURE_CONTENT_CHARS) : content;
      const messages = buildMessages(singleContent);
      const response = await callWithFallback(
        settings.baseUrl!,
        models,
        messages,
        settings.apiKey,
        signal,
      );
      const sanitized = sanitizeAiResponse(response.content);
      return formatMarkdown(sanitized);
    }

    // Multi-frame for large content
    const frames = fragmentIntoFrames(content, FRAME_TARGET_CHARS);
    if (frames.length === 1) {
      const cappedContent =
        content.length > MAX_CAPTURE_CONTENT_CHARS
          ? content.slice(0, MAX_CAPTURE_CONTENT_CHARS)
          : content;
      const messages = buildMessages(cappedContent);
      const response = await callWithFallback(
        settings.baseUrl!,
        models,
        messages,
        settings.apiKey,
        signal,
      );
      const sanitized = sanitizeAiResponse(response.content);
      return formatMarkdown(sanitized);
    }

    log.info('ai-client', `Fragmenting content into ${frames.length} frames`);
    const responses: string[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame: ContentFrame = { index: i, total: frames.length };
      const cappedContent =
        frames[i].length > MAX_CAPTURE_CONTENT_CHARS
          ? frames[i].slice(0, MAX_CAPTURE_CONTENT_CHARS)
          : frames[i];

      onProgress?.(i + 1, frames.length);
      const messages = buildMessages(cappedContent, frame);
      const response = await callWithFallback(
        settings.baseUrl!,
        models,
        messages,
        settings.apiKey,
        signal,
      );
      responses.push(response.content);
    }

    const reassembled = reassembleFrameResponses(responses);
    log.success(
      'ai-client',
      `Reassembled ${frames.length} frames into ${reassembled.length} chars`,
    );
    const sanitized = sanitizeAiResponse(reassembled);
    return formatMarkdown(sanitized);
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
  if (!settings.apiKey) {
    throw new AIClientError('No API key configured.', 'MISSING_KEY');
  }

  const chunksText = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');

  const messages = [
    { role: 'system' as const, content: 'You are a precise question-answering assistant.' },
    { role: 'user' as const, content: buildRAGPrompt(query, chunksText) },
  ];

  const models = settings.modelId
    ? [settings.modelId]
    : ['claude-3-5-sonnet-20241022', 'openai/gpt-4o'];

  const { signal, clear } = withTimeout(120_000);
  try {
    const response = await callWithFallback(
      settings.baseUrl!,
      models,
      messages,
      settings.apiKey,
      signal,
    );
    const sanitized = sanitizeAiResponse(response.content);
    return formatChatResponse(sanitized);
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
