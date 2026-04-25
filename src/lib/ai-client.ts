import type { GenerationMode, Settings } from './types';
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
const MODE_TO_MODEL: Record<GenerationMode, string> = {
  FAST:     'gemini-2.0-flash-lite',   // Free tier — fastest
  BALANCED: 'gemma-3-12b-it',           // 14.4K RPD free — good quality
  DEEP:     'gemma-3-27b-it',           // 14.4K RPD free — best quality
  LOCAL:    'gemini-2.0-flash-lite',    // Local mode falls back to FAST
};

// ─── Segmentation / Framing ───────────────────────────────────────────────────
/**
 * Like frame synchronisation in computer networking:
 * - Each segment is a "frame" with a header (position metadata) and payload (content slice)
 * - MAX_CHARS is the safe payload size per frame (~6000 words ≈ 24000 chars for Gemma)
 * - OVERLAP_CHARS ensures context continuity across frame boundaries (like sliding window)
 */
const MAX_CHARS = 20_000;   // ~5000 words — safe for all models incl. Gemma 4
const OVERLAP_CHARS = 1_000; // Overlap between frames to avoid mid-sentence cuts

interface ContentFrame {
  index: number;    // Frame number (0-based)
  total: number;    // Total frames in this transmission
  content: string;  // Payload
}

/**
 * Split content into overlapping frames.
 * Uses paragraph boundaries for clean splits (like byte stuffing for alignment).
 */
function frameContent(content: string): ContentFrame[] {
  if (content.length <= MAX_CHARS) {
    return [{ index: 0, total: 1, content }];
  }

  const frames: string[] = [];
  let offset = 0;

  while (offset < content.length) {
    let end = Math.min(offset + MAX_CHARS, content.length);
    const isLast = end >= content.length;

    // Snap to nearest paragraph boundary (only when not the final frame)
    if (!isLast) {
      const searchFrom = Math.max(offset, end - 800);
      const nextPara = content.indexOf('\n\n', searchFrom);
      if (nextPara !== -1 && nextPara <= end + 800) {
        end = nextPara;
      }
    }

    const slice = content.slice(offset, end).trim();
    if (slice.length > 0) frames.push(slice);

    // CRITICAL: stop when we've consumed all content — do not loop over the
    // overlap tail one byte at a time (this was the 1006-frame bug)
    if (isLast) break;

    // Always advance by at least half a frame so we can't stall
    offset = Math.max(offset + Math.floor(MAX_CHARS / 2), end - OVERLAP_CHARS);
  }

  return frames.map((content, index) => ({ index, total: frames.length, content }));
}

/**
 * Reassemble framed AI responses into a single coherent document.
 * Strategy (like frame reassembly in networking):
 * 1. Parse sections from each frame response
 * 2. Keep SUMMARY / Key Entities / Timeline / Concepts from frame 0 (most complete context)
 * 3. Collect all "content" sections and deduplicate overlapping paragraphs
 * 4. Stitch into final document
 */
function reassembleFrames(responses: string[], originalTitle: string): string {
  log.info('ai-client', `Reassembling ${responses.length} frames into final document`);

  // Helper: extract a named section from markdown
  function extractSection(md: string, name: string): string {
    const re = new RegExp(`^##\\s+${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|\\s*$)`, 'im');
    return md.match(re)?.[1]?.trim() ?? '';
  }

  // Helper: extract the title from markdown
  function extractTitle(md: string): string {
    return md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? originalTitle;
  }

  // Helper: extract everything AFTER the known structural sections — the "main content"
  function extractMainContent(md: string): string {
    // Remove title line
    let body = md.replace(/^#\s+.+\n/m, '');
    // Remove known sections
    for (const section of ['SUMMARY', 'Summary', 'Key Entities', 'Timeline', 'Concepts']) {
      body = body.replace(new RegExp(`##\\s+${section}[\\s\\S]*?(?=\\n##\\s|$)`, 'im'), '');
    }
    return body.trim();
  }

  const first = responses[0];
  const title = extractTitle(first);
  const summary = extractSection(first, '(?:SUMMARY|Summary)');
  const entities = extractSection(first, 'Key Entities');
  const timeline = extractSection(first, 'Timeline');
  const concepts = extractSection(first, 'Concepts');

  // Collect main content blocks from all frames, deduplicate by paragraph
  const seenParagraphs = new Set<string>();
  const contentBlocks: string[] = [];

  for (const response of responses) {
    const mainContent = extractMainContent(response);
    const paragraphs = mainContent.split(/\n\n+/);
    for (const para of paragraphs) {
      const key = para.trim().slice(0, 80); // Use first 80 chars as dedup key
      if (key.length < 10) continue;        // Skip tiny fragments
      if (!seenParagraphs.has(key)) {
        seenParagraphs.add(key);
        contentBlocks.push(para.trim());
      }
    }
  }

  log.info('ai-client', `Frame reassembly: ${contentBlocks.length} unique content blocks from ${responses.length} frames`);

  // Stitch everything back together
  const parts: string[] = [];
  parts.push(`# ${title}\n`);
  if (summary) parts.push(`## Summary\n\n${summary}\n`);
  if (entities) parts.push(`## Key Entities\n\n${entities}\n`);
  if (timeline) parts.push(`## Timeline\n\n${timeline}\n`);
  if (concepts) parts.push(`## Concepts\n\n${concepts}\n`);
  if (contentBlocks.length > 0) parts.push(contentBlocks.join('\n\n'));

  return parts.join('\n');
}

// ─── Prompt Templates ─────────────────────────────────────────────────────────

function buildFastPrompt(content: string, imageRefs: string, frame?: ContentFrame): string {
  const frameHint = frame && frame.total > 1
    ? `\n\n[FRAME ${frame.index + 1} of ${frame.total}] This is segment ${frame.index + 1} of a larger document. ${frame.index === 0 ? 'Include full structure: title, summary, entities, concepts, timeline, and main content.' : 'Continue the main content. Do NOT repeat the title, summary, or entities — only add new content sections.'}\n`
    : '';
  return `You are a document structuring assistant. Given the following web page content, produce a structured markdown document.${frameHint}

Requirements:
- Title: Extract or infer a clear document title (## heading)
- Summary: 2-3 sentence summary
- Key Entities: List named people, organizations, technologies, and concepts
- Main Content: Restructure into logical sections with ## headings
- Convert ASCII diagrams to \`\`\`mermaid\`\`\` blocks
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
- Title: Precise document title
- Summary: 4-6 sentence executive summary
- Key Entities: Exhaustive list (people, orgs, technologies, concepts, APIs) with types
- Timeline: Chronological events with dates
- Concepts: Deep explanations of key technical terms
- Main Content: Logical sections with ## and ### headings
- Code blocks: Preserve with correct language identifiers
- Diagrams: Convert ALL ASCII art to \`\`\`mermaid\`\`\` or \`\`\`plantuml\`\`\`
- Images: Position contextually

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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  log.info('ai-client', `→ POST ${url.split('?')[0]} (prompt: ${prompt.length} chars)`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      }),
      signal,
    });
  } catch (fetchErr) {
    const msg = (fetchErr as Error).message;
    log.error('ai-client', `Network error calling ${model}: ${msg}`, fetchErr);
    throw new AIClientError(`Network error: ${msg}`, 'NETWORK_ERROR');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error('ai-client', `API error ${res.status} from ${model}: ${body.slice(0, 300)}`);
    throw new AIClientError(
      `Gemini API error ${res.status}: ${body || res.statusText}`,
      'API_ERROR',
      res.status,
    );
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!text) {
    const finishReason = data.candidates?.[0]?.finishReason ?? 'unknown';
    log.warn('ai-client', `${model} returned empty text. finishReason: ${finishReason}`, data);
  } else {
    log.success('ai-client', `← ${model} OK (${text.length} chars, finishReason: ${data.candidates?.[0]?.finishReason})`);
  }

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
  if (!settings.apiKeys.gemini) {
    throw new AIClientError('No Gemini API key configured. Add your key in Settings.', 'MISSING_KEY');
  }

  const model = MODE_TO_MODEL[mode];
  const imageRefsText = imageRefs
    .map(img => `[IMG: ${img.url} | ${img.alt} | ${img.paragraphContext}]`)
    .join('\n');

  // Frame the content
  const frames = frameContent(content);
  log.info('ai-client', `Content segmentation: ${content.length} chars → ${frames.length} frame(s) (model: ${model}, mode: ${mode})`);

  if (frames.length === 1) {
    // Single frame — fast path, no reassembly needed
    log.info('ai-client', `Single-frame capture (${content.length} chars) → ${model}`);
    const prompt = mode === 'DEEP'
      ? buildDeepPrompt(content, imageRefsText)
      : buildFastPrompt(content, imageRefsText);
    const { signal, clear } = withTimeout(300_000);
    try {
      return await callGemini(model, prompt, settings.apiKeys.gemini, signal);
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

  // Multi-frame path: send each frame sequentially, collect responses
  log.info('ai-client', `Multi-frame capture: ${frames.length} frames × ${model}`);
  const responses: string[] = [];

  for (const frame of frames) {
    log.info('ai-client', `Sending frame ${frame.index + 1}/${frame.total} (${frame.content.length} chars)`);
    onProgress?.(frame.index, frame.total);

    const prompt = mode === 'DEEP'
      ? buildDeepPrompt(frame.content, frame.index === 0 ? imageRefsText : '[Images included in frame 1]', frame)
      : buildFastPrompt(frame.content, frame.index === 0 ? imageRefsText : '[Images included in frame 1]', frame);

    const { signal, clear } = withTimeout(300_000);
    try {
      const response = await callGemini(model, prompt, settings.apiKeys.gemini, signal);
      responses.push(response);
      log.success('ai-client', `Frame ${frame.index + 1}/${frame.total} complete (${response.length} chars)`);
    } catch (err) {
      log.error('ai-client', `Frame ${frame.index + 1}/${frame.total} failed`, err);
      if (err instanceof AIClientError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AIClientError(`Frame ${frame.index + 1} timed out after 5 minutes.`, 'TIMEOUT');
      }
      throw new AIClientError(`Network error on frame ${frame.index + 1}: ${(err as Error).message}`, 'NETWORK_ERROR');
    } finally {
      clear();
    }
  }

  onProgress?.(frames.length, frames.length);
  return reassembleFrames(responses, '');
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

  // RAG always uses BALANCED model to preserve quota
  const model = MODE_TO_MODEL['BALANCED'];
  log.info('ai-client', `RAG query → ${model} (${chunks.length} chunks, query: "${query.slice(0, 60)}${query.length > 60 ? '…' : ''}")`);

  const { signal, clear } = withTimeout(120_000);
  try {
    return await callGemini(model, prompt, settings.apiKeys.gemini, signal);
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
