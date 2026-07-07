import { db } from './db';
import { rankChunksByKeywords } from './nlp-fallback';
import type { DocumentChunk, Citation } from './types';

export interface RetrievedChunk extends DocumentChunk {
  score: number;
  source: 'vector' | 'keyword' | 'hybrid';
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0,
    normA = 0,
    normB = 0;
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
  const vectors = await db.vectors.where('embeddingVersion').equals(embeddingVersion).toArray();

  // When a note is given, restrict scoring to that document's chunks so a query
  // in the reader only retrieves from the document currently open.
  let allowedChunkIds: Set<string> | null = null;
  if (noteId) {
    const docChunkIds = await db.chunks.where('noteId').equals(noteId).primaryKeys();
    allowedChunkIds = new Set(docChunkIds);
  }

  const scored: Array<{ chunkId: string; score: number }> = [];

  for (const v of vectors) {
    if (allowedChunkIds && !allowedChunkIds.has(v.chunkId)) continue;
    const vec =
      v.embedding instanceof Float32Array
        ? v.embedding
        : new Float32Array(Object.values(v.embedding));
    const score = cosineSimilarity(queryEmbedding, vec);
    scored.push({ chunkId: v.chunkId, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const topK = scored.slice(0, k);

  const chunks = await db.chunks.bulkGet(topK.map((s) => s.chunkId));
  return chunks
    .filter((c): c is DocumentChunk => c != null)
    .map((c) => {
      const found = topK.find((s) => s.chunkId === c.id);
      return { ...c, score: found?.score ?? 0, source: 'vector' as const };
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
    prompt += `CONVERSATION HISTORY:\n${history.map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}\n\n`;
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

// ── Reciprocal Rank Fusion ─────────────────────────────────────────────
// Combines multiple ranked lists into a single ranking using RRF.
//   RRF score = Σ(1 / (k + rank(d, i)))
// The constant k mitigates high-rank dominance (k=60 is standard).

const RRF_K = 60;

export function reciprocalRankFusion(
  ...rankedLists: Array<{ chunkId: string; score: number; source: string }[]>
): Array<{ chunkId: string; score: number; source: string }> {
  const fused = new Map<string, { score: number; source: string }>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const rrfScore = 1 / (RRF_K + rank + 1);
      const existing = fused.get(item.chunkId);
      if (existing) {
        existing.score += rrfScore;
      } else {
        fused.set(item.chunkId, { score: rrfScore, source: item.source });
      }
    }
  }

  return Array.from(fused.entries())
    .map(([chunkId, { score, source }]) => ({ chunkId, score, source }))
    .sort((a, b) => b.score - a.score);
}

// ── Context window expansion ──────────────────────────────────────────
// Given a ranked list of chunk IDs, expand each hit with its immediate
// neighbors (prev/next chunks) for richer context.

export async function expandContext(
  chunks: RetrievedChunk[],
  windowSize: number = 1,
  noteId?: string,
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return chunks;

  const seen = new Set<string>();
  const allChunkIds = new Set(chunks.map((c) => c.id));

  // Collect neighbor IDs — fetch all chunks for this note once
  const neighborChunks = noteId
    ? await db.chunks.where('noteId').equals(noteId).toArray()
    : (await db.chunks.bulkGet(chunks.map((c) => c.id))).filter(
        (c): c is DocumentChunk => c != null,
      );

  const sorted = neighborChunks.sort((a, b) => a.paragraphIndex - b.paragraphIndex);

  for (const chunk of chunks) {
    const idx = sorted.findIndex((c) => c.id === chunk.id);
    if (idx === -1) continue;
    const start = Math.max(0, idx - windowSize);
    const end = Math.min(sorted.length, idx + windowSize + 1);
    for (let i = start; i < end; i++) {
      if (!allChunkIds.has(sorted[i].id)) {
        seen.add(sorted[i].id);
      }
    }
  }

  if (seen.size === 0) return chunks;

  const extra = (await db.chunks.bulkGet(Array.from(seen))).filter(
    (c): c is DocumentChunk => c != null,
  );
  const expanded = [
    ...chunks,
    ...extra.map((c) => ({ ...c, score: 0, source: 'hybrid' as const })),
  ];
  // Re-sort: keep scored chunks first, then append context chunks
  expanded.sort((a, b) => b.score - a.score);
  return expanded;
}

// ── Query expansion with conversation history ─────────────────────────
// Prepends prior user messages as conversational context to improve
// retrieval specificity for follow-up questions.

export function expandQueryWithHistory(
  query: string,
  history: Array<{ role: string; content: string }>,
): string {
  if (history.length === 0) return query;

  // Take the last 2 user turns and their answers for context
  const relevantHistory = history.slice(-4);
  const contextParts: string[] = [];

  for (const msg of relevantHistory) {
    if (msg.role === 'user') {
      contextParts.push(`previous question: ${msg.content}`);
    }
  }

  if (contextParts.length === 0) return query;

  const expanded = contextParts.join('; ') + '; current question: ' + query;
  // Keep it reasonable — truncate if over 512 chars
  return expanded.length > 512 ? expanded.slice(0, 512) : expanded;
}

// ── Hybrid retrieval ──────────────────────────────────────────────────
// Runs both vector and keyword retrieval, fuses them with RRF, then
// expands context windows.

export async function retrieveHybridTopK(
  query: string,
  queryEmbedding: Float32Array | null,
  embeddingVersion: number,
  k: number = 6,
  noteId?: string,
): Promise<RetrievedChunk[]> {
  const docChunks = noteId
    ? await db.chunks.where('noteId').equals(noteId).toArray()
    : await db.chunks.toArray();

  if (docChunks.length === 0) return [];

  const results: Array<{ chunkId: string; score: number; source: string }[]> = [];

  // 1. Vector search (if we have an embedding)
  if (queryEmbedding) {
    const scored = keywordSearch(query, docChunks, k);
    results.push(scored);
  }

  // 2. Keyword search
  const keywordResults = keywordSearch(query, docChunks, k * 2);
  results.push(keywordResults);

  // 3. Fuse with RRF
  const fused = reciprocalRankFusion(...results);
  const topIds = fused.slice(0, k);

  const chunkMap = new Map(docChunks.map((c) => [c.id, c]));
  const retrieved: RetrievedChunk[] = topIds
    .map((r) => {
      const chunk = chunkMap.get(r.chunkId);
      if (!chunk) return null;
      return { ...chunk, score: r.score, source: r.source as RetrievedChunk['source'] };
    })
    .filter((c): c is RetrievedChunk => c != null);

  return retrieved;
}

type KeywordResult = { chunkId: string; score: number; source: 'keyword' };

function keywordSearch(query: string, chunks: DocumentChunk[], k: number): KeywordResult[] {
  const ranked = rankChunksByKeywords(
    query,
    chunks.map((c) => ({ text: c.text, paragraphIndex: c.paragraphIndex })),
    k,
  );
  const chunkMap = new Map(chunks.map((c) => [c.id, c]));
  const results: KeywordResult[] = [];
  for (const r of ranked) {
    const id = chunks.find((c) => c.paragraphIndex === r.paragraphIndex)?.id;
    if (!id) continue;
    const chunk = chunkMap.get(id);
    if (!chunk) continue;
    results.push({ chunkId: chunk.id, score: r.score, source: 'keyword' });
  }
  return results;
}
