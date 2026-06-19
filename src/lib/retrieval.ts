import { db } from './db';
import type { DocumentChunk, Citation } from './types';

export interface RetrievedChunk extends DocumentChunk {
  score: number;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function normalise(vec: number[]): Float32Array {
  const f32 = new Float32Array(vec);
  let norm = 0;
  for (let i = 0; i < f32.length; i++) norm += f32[i] * f32[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return f32;
  for (let i = 0; i < f32.length; i++) f32[i] /= norm;
  return f32;
}

export async function retrieveTopK(
  queryEmbedding: Float32Array,
  embeddingVersion: number,
  k: number = 6,
  noteId?: string,
): Promise<RetrievedChunk[]> {
  const vectors = await db.vectors
    .where('embeddingVersion')
    .equals(embeddingVersion)
    .toArray();

  // When a note is given, restrict scoring to that document's chunks so a query
  // in the reader only retrieves from the document currently open.
  let allowedChunkIds: Set<string> | null = null;
  if (noteId) {
    const docChunkIds = await db.chunks.where('noteId').equals(noteId).primaryKeys();
    allowedChunkIds = new Set(docChunkIds as string[]);
  }

  const scored: Array<{ chunkId: string; score: number }> = [];

  for (const v of vectors) {
    if (allowedChunkIds && !allowedChunkIds.has(v.chunkId)) continue;
    const vec = v.embedding instanceof Float32Array
      ? v.embedding
      : new Float32Array(Object.values(v.embedding));
    const score = cosineSimilarity(queryEmbedding, vec);
    scored.push({ chunkId: v.chunkId, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const topK = scored.slice(0, k);

  const chunks = await db.chunks.bulkGet(topK.map(s => s.chunkId));
  return chunks
    .filter((c): c is DocumentChunk => c != null)
    .map(c => {
      const found = topK.find(s => s.chunkId === c.id);
      return { ...c, score: found?.score ?? 0 };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildRAGPrompt(
  query: string,
  chunks: RetrievedChunk[],
  history: Array<{ role: string; content: string }> = [],
  styleInstruction?: string,
): string {
  const chunksText = chunks
    .map((c, i) => `[${i + 1}] ${c.text}${c.heading ? ` (from section: ${c.heading})` : ''}`)
    .join('\n\n---\n\n');

  let prompt = `You are a precise question-answering assistant. Answer using ONLY the provided note excerpts.\n\n`;
  prompt += `RULES:\n- Lead with a direct answer (1-2 sentences)\n- Support with details and cite each fact as [N]\n- If the answer is not in the excerpts, say so\n- Never hallucinate or infer outside the excerpts\n`;
  if (styleInstruction) prompt += `- ${styleInstruction}\n`;
  prompt += `\n`;

  if (history.length > 0) {
    prompt += `CONVERSATION HISTORY:\n${history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}\n\n`;
  }

  prompt += `NOTE EXCERPTS:\n${chunksText}\n\nUSER QUESTION:\n${query}\n\nYOUR ANSWER:`;
  return prompt;
}

export function parseCitations(answer: string, chunks: RetrievedChunk[]): Citation[] {
  const matches = [...answer.matchAll(/\[(\d+)\]/g)];
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const match of matches) {
    const n = parseInt(match[1], 10);
    const chunk = chunks[n - 1];
    if (!chunk || seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    citations.push({
      noteId: chunk.noteId,
      chunkId: chunk.id,
      paragraphIndex: chunk.paragraphIndex,
      text: chunk.text.slice(0, 200),
    });
  }

  return citations;
}
