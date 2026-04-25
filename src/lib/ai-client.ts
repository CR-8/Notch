import type { GenerationMode, GeminiModel, Settings } from './types';
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

// Maps each generation mode to its Gemini API model string
const MODE_TO_MODEL: Record<GenerationMode, GeminiModel> = {
  FAST:     'gemini-3.1-flash-lite-preview', // 500 RPD free — fastest, most quota
  BALANCED: 'gemma-3-12b-it',               // 14.4K RPD free — good quality
  DEEP:     'gemma-3-27b-it',               // 14.4K RPD free — best quality
};

// ─── Prompt Templates ────────────────────────────────────────────────────────

function buildFastPrompt(content: string, imageRefs: string): string {
  return `You are a document structuring assistant. Given the following web page content, produce a structured markdown document.

Requirements:
- Title: Extract or infer a clear document title
- Summary: 2-3 sentence summary
- Key Entities: List named people, organizations, technologies, and concepts with brief descriptions
- Main Content: Restructure the content into logical sections with ## headings
- For any ASCII art diagrams or flowcharts, convert them to fenced \`\`\`mermaid\`\`\` code blocks
- For any software architecture or sequence descriptions, convert them to fenced \`\`\`plantuml\`\`\` code blocks
- Place image references (provided as [IMG: url | alt | context]) adjacent to the most semantically relevant section
- Timeline: If the content is chronological, extract a timeline section

Output ONLY valid markdown. Do not include any preamble or explanation.

PAGE CONTENT:
${content}

IMAGE REFERENCES:
${imageRefs}`;
}

function buildDeepPrompt(content: string, imageRefs: string): string {
  return `You are an expert knowledge structuring assistant. Given the following web page content, produce a comprehensive structured markdown document suitable for a developer's knowledge base.

Requirements:
- Title: Extract or infer a precise document title
- Summary: 4-6 sentence executive summary
- Key Entities: Exhaustive list of named entities (people, orgs, technologies, concepts, APIs, tools) with types and descriptions
- Timeline: Chronological events if applicable, with dates
- Concepts: Deep explanations of key technical or conceptual terms
- Main Content: Restructure into logical sections with ## headings and ### sub-headings
- Code blocks: Preserve all code blocks with correct language identifiers
- Diagrams: Convert ALL ASCII art, flowcharts, and architecture descriptions to appropriate \`\`\`mermaid\`\`\` or \`\`\`plantuml\`\`\` fenced blocks
- Images: Place each image reference at the most semantically relevant position in the document
- Cross-references: Add internal markdown links between related sections where appropriate

Output ONLY valid markdown. Do not include any preamble or explanation.

PAGE CONTENT:
${content}

IMAGE REFERENCES:
${imageRefs}`;
}

function buildRAGPrompt(query: string, chunks: string): string {
  return `You are a precise question-answering assistant. Answer the user's question using ONLY the provided document excerpts.

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

async function callOllama(endpoint: string, model: string, prompt: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal,
  });
  if (!res.ok) {
    throw new AIClientError(`Ollama error: ${res.status} ${res.statusText}`, 'API_ERROR', res.status);
  }
  const data = await res.json();
  return data.response ?? '';
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
): Promise<string> {
  const imageRefsText = imageRefs
    .map(img => `[IMG: ${img.url} | ${img.alt} | ${img.paragraphContext}]`)
    .join('\n');

  const prompt = mode === 'DEEP'
    ? buildDeepPrompt(content, imageRefsText)
    : buildFastPrompt(content, imageRefsText);

  const { signal, clear } = withTimeout(30_000);
  try {
    if (!settings.apiKeys.gemini) {
      throw new AIClientError('No Gemini API key configured. Add your key in Settings.', 'MISSING_KEY');
    }
    const model = MODE_TO_MODEL[mode];
    return await callGemini(model, prompt, settings.apiKeys.gemini, signal);
  } catch (err) {
    if (err instanceof AIClientError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AIClientError('Request timed out after 30 seconds.', 'TIMEOUT');
    }
    throw new AIClientError(`Network error: ${(err as Error).message}`, 'NETWORK_ERROR');
  } finally {
    clear();
  }
}

export async function sendRAGRequest(
  query: string,
  chunks: Array<{ text: string; paragraphIndex: number }>,
  settings: Settings,
): Promise<string> {
  if (!settings.apiKeys.gemini) {
    throw new AIClientError('No Gemini API key configured.', 'MISSING_KEY');
  }

  const chunksText = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
  const prompt = buildRAGPrompt(query, chunksText);

  // RAG always uses FAST model to preserve quota
  const model = MODE_TO_MODEL['FAST'];

  const { signal, clear } = withTimeout(30_000);
  try {
    return await callGemini(model, prompt, settings.apiKeys.gemini, signal);
  } catch (err) {
    if (err instanceof AIClientError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AIClientError('Request timed out after 30 seconds.', 'TIMEOUT');
    }
    throw new AIClientError(`Network error: ${(err as Error).message}`, 'NETWORK_ERROR');
  } finally {
    clear();
  }
}
