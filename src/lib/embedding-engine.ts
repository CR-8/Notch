import { saveChunk, saveEmbedding } from './idb';
import { log } from './logger';
import { ensureRuntimePolyfills } from './runtime-polyfills';
import type { DocumentChunk } from './types';

const CHARS_PER_TOKEN = 4;
const OVERLAP_TOKENS = 50;
const HASH_EMBEDDING_DIM = 384;

// ── Idle unload — free WASM memory after 5 min of inactivity ─────────────────
const IDLE_UNLOAD_MS = 5 * 60 * 1000;
let extractor: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let embeddingBackend: 'transformers' | 'hash' | null = null;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    extractor = null;
    idleTimer = null;
    log.info('embedding', 'Extractor unloaded after idle timeout');
  }, IDLE_UNLOAD_MS);
}

async function getExtractor() {
  if (!extractor) {
    log.info('embedding', 'Loading Xenova/all-MiniLM-L6-v2 (~23 MB, first use only)');
    ensureRuntimePolyfills();

    const transformersModuleUrl = browser.runtime.getURL('/vendor/transformers.web.js');
    const { pipeline, env } = await import(/* @vite-ignore */ transformersModuleUrl);

    // Point ONNX Runtime to locally bundled WASM files — no CDN, works offline
    // and satisfies Firefox's strict 'self' CSP.
    env.backends.onnx.wasm.wasmPaths = browser.runtime.getURL('/ort/');
    env.allowLocalModels = true;
    env.useBrowserCache = true;

    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    embeddingBackend = 'transformers';
    log.success('embedding', 'Model loaded and cached');
  }
  resetIdleTimer();
  return extractor;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toHashEmbedding(text: string, dim = HASH_EMBEDDING_DIM): Float32Array {
  const vector = new Float32Array(dim);
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length > 1);

  for (const token of tokens) {
    const idx = hashString(token) % dim;
    const sign = (hashString(`${token}#sign`) & 1) === 0 ? 1 : -1;
    vector[idx] += sign;
  }

  let norm = 0;
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i];
  }

  if (norm > 0) {
    const scale = 1 / Math.sqrt(norm);
    for (let i = 0; i < vector.length; i++) {
      vector[i] *= scale;
    }
  }

  return vector;
}

async function embedText(text: string): Promise<Float32Array> {
  if (embeddingBackend !== 'hash') {
    try {
      const ext = await getExtractor();
      const output = await ext(text, { pooling: 'mean', normalize: true });
      embeddingBackend = 'transformers';
      return new Float32Array(output.data);
    } catch (err) {
      embeddingBackend = 'hash';
      extractor = null;
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      log.warn('embedding', 'Transformer backend unavailable, using local hash embeddings', err);
    }
  }

  return toHashEmbedding(text);
}

// ── Chunking ──────────────────────────────────────────────────────────────────

export function chunkText(content: string, maxTokens = 512): string[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      chunks.push(paragraph.trim());
    } else {
      const sentences = paragraph.split(/(?<=[\.\!\?])\s+/).filter(s => s.trim().length > 0);
      let current = '';
      for (const sentence of sentences) {
        if ((current + ' ' + sentence).trim().length <= maxChars) {
          current = current ? current + ' ' + sentence : sentence;
        } else {
          if (current) {
            chunks.push(current.trim());
            current = current.slice(-overlapChars) + ' ' + sentence;
          } else {
            chunks.push(sentence.trim());
            current = '';
          }
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }

  if (chunks.length > 1) {
    const overlapped: string[] = [chunks[0]];
    for (let i = 1; i < chunks.length; i++) {
      overlapped.push(chunks[i - 1].slice(-overlapChars) + ' ' + chunks[i]);
    }
    return overlapped;
  }
  return chunks;
}

// ── Embedding ─────────────────────────────────────────────────────────────────

export async function embedDocument(documentId: string, content: string): Promise<void> {
  log.info('embedding', `Embedding document ${documentId}`);
  try {
    const chunks = chunkText(content);
    log.info('embedding', `Chunked into ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      const chunkId = `${documentId}_${i}`;
      const embedding = await embedText(text);
      const chunk: DocumentChunk = {
        id: chunkId,
        documentId,
        chunkIndex: i,
        text,
        paragraphIndex: i,
        embedding,
        source: 'document',
      };
      await saveChunk(chunk);
      await saveEmbedding(chunkId, documentId, embedding);
    }
    log.success('embedding', `Document ${documentId} embedded (${chunks.length} chunks)`);
  } catch (err) {
    log.error('embedding', `Failed to embed document ${documentId}`, err);
    throw err;
  }
}

export async function embedQuery(query: string): Promise<Float32Array> {
  log.info('embedding', 'Embedding query');
  try {
    const embedding = await embedText(query);
    log.success('embedding', 'Query embedded');
    return embedding;
  } catch (err) {
    log.error('embedding', 'Failed to embed query', err);
    throw err;
  }
}

export async function embedHistoryTurn(documentId: string, query: string, answer: string): Promise<void> {
  const text = `User: ${query}\nAssistant: ${answer}`;
  try {
    const embedding = await embedText(text);
    const chunkId = `${documentId}_history_${crypto.randomUUID()}`;
    const chunk: DocumentChunk = {
      id: chunkId,
      documentId,
      chunkIndex: Date.now(),
      text,
      paragraphIndex: -1,
      embedding,
      source: 'history',
    };

    await saveChunk(chunk);
    await saveEmbedding(chunkId, documentId, embedding);
    log.info('embedding', `Saved history embedding for ${documentId}`);
  } catch (err) {
    log.warn('embedding', 'Failed to embed chat history turn', err);
  }
}
