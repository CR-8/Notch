import { saveChunk, saveEmbedding } from './idb';
import { log } from './logger';
import type { DocumentChunk } from './types';

// Token approximation: 1 token ≈ 4 characters
const CHARS_PER_TOKEN = 10;
const OVERLAP_TOKENS = 800;

// Lazy-loaded pipeline — cached after first use
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    log.info('embedding', 'Loading Xenova/all-MiniLM-L6-v2 (~23 MB, first use only)');
    // Dynamic import avoids static bundling of the WASM module
    const { pipeline } = await import('@xenova/transformers');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    log.success('embedding', 'Model loaded and cached');
  }
  return extractor;
}

export function chunkText(content: string, maxTokens = 512): string[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;

  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      chunks.push(paragraph.trim());
    } else {
      const sentences = paragraph.split(/(?<=[\.\!\?])\s+/).filter((s) => s.trim().length > 0);
      let current = '';

      for (const sentence of sentences) {
        if ((current + ' ' + sentence).trim().length <= maxChars) {
          current = current ? current + ' ' + sentence : sentence;
        } else {
          if (current) {
            chunks.push(current.trim());
            const overlapText = current.slice(-overlapChars);
            current = overlapText + ' ' + sentence;
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
      const overlap = chunks[i - 1].slice(-overlapChars);
      overlapped.push(overlap + ' ' + chunks[i]);
    }
    return overlapped;
  }

  return chunks;
}

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

      const chunk: DocumentChunk = {
        id: chunkId,
        documentId,
        chunkIndex: i,
        text,
        paragraphIndex: i,
        embedding,
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
    const ext = await getExtractor();
    const output = await ext(query, { pooling: 'mean', normalize: true });
    log.success('embedding', 'Query embedded');
    return new Float32Array(output.data);
  } catch (err) {
    log.error('embedding', 'Failed to embed query', err);
    throw err;
  }
}
