import { saveChunk, saveEmbedding } from './idb';
import { log } from './logger';
import type { DocumentChunk } from './types';

const CHARS_PER_TOKEN = 4;
const OVERLAP_TOKENS = 50;

// ── Idle unload — free WASM memory after 5 min of inactivity ─────────────────
const IDLE_UNLOAD_MS = 5 * 60 * 1000;
let extractor: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
let idleTimer: ReturnType<typeof setTimeout> | null = null;

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

    // Vite/Rollup statically traces `import('literal-string')` and bundles the
    // entire @huggingface/transformers library (~55 MB) into background.js.
    // Splitting the specifier across a variable prevents static analysis while
    // remaining valid ESM — the module is still resolved from the extension
    // bundle at runtime by the browser's own module loader.
    const pkg = '@huggingface' + '/transformers';
    const { pipeline, env } = await import(/* @vite-ignore */ pkg);

    // Point ONNX Runtime to locally bundled WASM files — no CDN, works offline
    // and satisfies Firefox's strict 'self' CSP.
    env.backends.onnx.wasm.wasmPaths = browser.runtime.getURL('/ort/');

    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    log.success('embedding', 'Model loaded and cached');
  }
  resetIdleTimer();
  return extractor;
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
    const ext = await getExtractor();
    const chunks = chunkText(content);
    log.info('embedding', `Chunked into ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      const chunkId = `${documentId}_${i}`;
      const output = await ext(text, { pooling: 'mean', normalize: true });
      const embedding = new Float32Array(output.data);
      const chunk: DocumentChunk = { id: chunkId, documentId, chunkIndex: i, text, paragraphIndex: i, embedding };
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
    const ext = await getExtractor();
    const output = await ext(query, { pooling: 'mean', normalize: true });
    log.success('embedding', 'Query embedded');
    return new Float32Array(output.data);
  } catch (err) {
    log.error('embedding', 'Failed to embed query', err);
    throw err;
  }
}
