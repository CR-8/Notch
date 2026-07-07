import { log } from './logger';
import { getSettings, saveDocument, saveChunks } from './storage';
import { getChatProvider, getEmbeddingProvider } from './providers/registry';
import { getProvider } from './storage';
import { shouldRunOffline } from './privacy';
import { withRetry, withTimeout } from './client';
import { AIClientError } from './providers/errors';
import { deriveAutoTags, mergeTags } from './auto-tag';
import {
  buildOfflineCaptureMarkdown,
  rankChunksByKeywords,
  answerWithOfflineNLP,
} from './nlp-fallback';
import {
  normalise,
  parseCitations,
  retrieveTopK as _retrieveTopK,
  retrieveHybridTopK,
  buildRAGPrompt,
  expandQueryWithHistory,
  expandContext,
} from './retrieval';
import { chunkDocument } from './chunker';
import { db } from './db';
import type {
  Document,
  GenerationMode,
  Citation,
  DOMExtraction,
  ProviderConfig,
  Settings,
  ReadingLevel,
} from './types';
import type { RetrievedChunk } from './retrieval';

import { runCaptureEngine } from './capture/engine';
import { runContentEngine } from './content/engine';
import { runLayoutEngine } from './layout/engine';
import type { CompleteFn } from './content/types';

/* ── Helpers ─────────────────────────────────────────────────────────── */

function extractTitle(md: string): string {
  return md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
}

function extractSummaryAndKeyPoints(md: string): { summary: string; keyPoints: string[] } {
  const lines = md.split('\n');
  let inHeading = false;
  let summary = '';
  const keyPoints: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('# ')) {
      inHeading = true;
      continue;
    }

    if (inHeading && line.length > 0 && !line.startsWith('#')) {
      inHeading = false;
      summary = line.replace(/^[>\s]*/, '').trim();
      if (summary) break;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') && !trimmed.startsWith('- [') && trimmed.length > 3) {
      keyPoints.push(trimmed.slice(2).trim());
    }
  }

  // Fallback: use first substantial paragraph if no heading content found
  if (!summary) {
    for (const line of lines) {
      const t = line.trim();
      if (t.length > 40 && !t.startsWith('#') && !t.startsWith('-') && !t.startsWith('>')) {
        summary = t;
        break;
      }
    }
  }

  return { summary, keyPoints: keyPoints.slice(0, 8) };
}

function normalizeModelId(model: string | undefined, baseUrl?: string): string {
  const m = (model ?? '').trim();
  if (m) return m;
  const isOpenRouter = !!baseUrl && /openrouter\.ai/i.test(baseUrl);
  return isOpenRouter ? 'openrouter/free' : m;
}

async function resolveChatProvider(settings: Settings): Promise<ProviderConfig> {
  const { providerId } = settings.runtime.chat;
  if (providerId) {
    const provider = await getProvider(providerId);
    if (provider) return provider;
  }
  if (settings.provider && settings.apiKey) {
    const protocol =
      settings.provider === 'openai-compatible'
        ? 'openai'
        : (settings.provider as ProviderConfig['protocol']);
    return {
      id: settings.provider,
      label: settings.provider,
      protocol,
      baseUrl: settings.baseUrl || '',
      apiKey: settings.apiKey,
      extraHeaders: {},
      chatModel:
        normalizeModelId(settings.modelId, settings.baseUrl) ||
        (protocol === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini'),
      embeddingModel: '',
      embeddingDimensions: 0,
      enabled: true,
    };
  }
  throw new AIClientError('No valid provider configuration found', 'MISSING_KEY');
}

function resolveChatModel(settings: Settings, mode: GenerationMode): string {
  const { providerId, modeModels } = settings.runtime.chat;
  if (providerId && modeModels)
    return normalizeModelId(modeModels[mode] || modeModels.FAST, settings.baseUrl);
  return normalizeModelId(settings.modelId, settings.baseUrl) || 'gpt-4o-mini';
}

/* ── Main capture pipeline ───────────────────────────────────────────── */

export async function runCapturePipeline(
  extraction: DOMExtraction,
  mode: GenerationMode,
  tags: string[],
  onProgress?: (step: string, pct: number) => void,
): Promise<string> {
  const settings = await getSettings();
  const docId = crypto.randomUUID();

  onProgress?.('Extracting content...', 10);
  const capture = runCaptureEngine(extraction);

  // Build the document
  const doc: Document = {
    id: docId,
    title: capture.metadata.title,
    url: capture.metadata.url,
    domain: capture.metadata.domain,
    capturedAt: capture.metadata.capturedAt,
    wordCount: capture.metadata.wordCount,
    cleanedHtml: extraction.cleanedHtml,
    textContent: capture.rawContent,
    content: '',
    summary: '',
    keyPoints: [],
    entities: capture.entities.map((e, i) => ({ name: e.name, type: e.type, paragraphIndex: i })),
    timeline: capture.timeline.map((t, i) => ({
      date: t.year,
      description: t.event,
      significance: t.significance,
      paragraphIndex: i,
    })),
    concepts: capture.concepts.map((c, i) => ({
      term: c.concept,
      definition: c.definition,
      paragraphIndex: i,
    })),
    relationships: capture.relationships,
    topics: capture.topics,
    complexity: capture.complexity,
    documentType: capture.documentClass,
    tags,
    images: capture.images.map((i) => ({
      url: i.url,
      alt: i.alt,
      sectionIndex: 0,
      paragraphContext: i.paragraphContext,
    })),
    videos: capture.videos.map((v) => ({
      url: v.url,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      duration: v.duration,
    })),
    status: 'captured',
    starred: false,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveDocument(doc);

  // Generate content (AI or offline)
  onProgress?.('Generating document...', 20);
  let content: string;

  if (shouldRunOffline(settings)) {
    content = buildOfflineCaptureMarkdown(capture.metadata.title, capture.rawContent);
  } else {
    const provider = await resolveChatProvider(settings);
    const model = resolveChatModel(settings, mode);
    const chat = getChatProvider(provider);

    const complete: CompleteFn = (system, user) =>
      withRetry(() =>
        withTimeout(
          (async () => {
            let full = '';
            for await (const chunk of chat.generate({
              model,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
              ],
            })) {
              if (chunk.type === 'text' && chunk.text) full += chunk.text;
              if (chunk.type === 'error')
                throw new AIClientError(chunk.error ?? 'Generation failed');
            }
            return full;
          })(),
          90000,
        ),
      );

    try {
      const result = await runContentEngine({ capture, mode, complete });
      content = result.markdown;
      log.info('pipeline', `Content generated: ${result.wordCount} words`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.warn('pipeline', `AI generation failed (${reason}) — using raw text`, err);
      onProgress?.(`AI unavailable — saved raw text (${reason})`, 60);
      content = buildOfflineCaptureMarkdown(capture.metadata.title, capture.rawContent);
    }
  }

  onProgress?.('Content generated', 60);

  // Enrich: inject images, tables, diagrams, callouts, knowledge graphs
  const { enrichedMarkdown } = runLayoutEngine({
    markdown: content,
    title: capture.metadata.title,
    images: capture.images,
    tables: capture.tables,
    entities: capture.entities,
    relationships: capture.relationships,
    timeline: capture.timeline,
    concepts: capture.concepts,
    complexity: capture.complexity,
    isPdf: capture.metadata.isPdf,
  });
  content = enrichedMarkdown;

  // Update document with generated content
  doc.title = extractTitle(content) || doc.title;
  doc.content = content;
  doc.wordCount = Math.max(content.split(/\s+/).filter(Boolean).length, doc.wordCount);
  doc.readingTimeMinutes = Math.max(1, Math.round(doc.wordCount / 220));
  doc.diagramCount = (content.match(/```mermaid/g) ?? []).length;
  doc.calloutCount = (content.match(/\[!(NOTE|WARNING|TIP|INFO)\]/g) ?? []).length;

  // Extract summary and key points from generated content
  const extracted = extractSummaryAndKeyPoints(content);
  if (extracted.summary) doc.summary = extracted.summary;
  if (extracted.keyPoints.length > 0) doc.keyPoints = extracted.keyPoints;

  // Auto-tag
  doc.tags = mergeTags(
    tags,
    deriveAutoTags({
      entities: doc.entities,
      concepts: doc.concepts,
      domain: capture.metadata.domain,
    }),
  );

  // Chunk and save
  onProgress?.('Chunking...', 80);
  doc.status = 'chunked';
  doc.updatedAt = new Date().toISOString();
  await saveDocument(doc);

  const chunks = chunkDocument(docId, content, extraction.cleanedHtml);
  await saveChunks(chunks);
  log.info('pipeline', `Created ${chunks.length} chunks`);

  doc.status = 'ready';
  doc.updatedAt = new Date().toISOString();
  await saveDocument(doc);

  onProgress?.('Complete', 100);
  log.success('pipeline', `Captured: ${docId} — "${doc.title}"`);

  return docId;
}

/* ── RAG pipeline ─────────────────────────────────────────────────────── */

let abortController: AbortController | null = null;

export function abortRAG(): void {
  abortController?.abort();
}

export async function runRAGPipeline(
  query: string,
  documentId: string,
  onChunk?: (text: string) => void,
  readingLevel?: ReadingLevel,
): Promise<{ answer: string; citations: Citation[] }> {
  const settings = await getSettings();
  const { providerId: embedProviderId, version: embedVersion } = settings.runtime.embedding;

  const priorMessages = await db.messages.where('documentId').equals(documentId).toArray();
  priorMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const recentHistory = priorMessages.slice(-6).map((m) => ({ role: m.role, content: m.text }));

  const expandedQuery = expandQueryWithHistory(query, recentHistory);

  if (shouldRunOffline(settings)) {
    const docChunks = await db.chunks.where('noteId').equals(documentId).toArray();
    const ranked = rankChunksByKeywords(
      expandedQuery,
      docChunks.map((c) => ({ text: c.text, paragraphIndex: c.paragraphIndex })),
      6,
    );
    const answer = answerWithOfflineNLP(expandedQuery, ranked);
    onChunk?.(answer);
    const citations = parseCitations(
      answer,
      ranked.map((r) => {
        const orig =
          docChunks.find((c) => c.paragraphIndex === r.paragraphIndex && c.text === r.text) ??
          docChunks[0];
        return { ...orig, score: r.score, source: 'keyword' as const };
      }),
    );
    await persistConversationTurn(documentId, expandedQuery, answer, citations);
    return { answer, citations };
  }

  const provider = await resolveChatProvider(settings);
  const model = resolveChatModel(settings, 'BALANCED');
  const chat = getChatProvider(provider);

  let queryEmbedding: Float32Array | null = null;
  if (embedProviderId && embedVersion > 0) {
    try {
      const embedProvider = await getProvider(embedProviderId);
      if (embedProvider) {
        const embedder = getEmbeddingProvider(embedProvider);
        const [queryVec] = await embedder.embed([expandedQuery]);
        queryEmbedding = normalise(queryVec);
      }
    } catch {
      log.warn('pipeline', 'Vector embedding failed, using keyword-only search');
    }
  }

  let chunks: RetrievedChunk[] = [];
  try {
    chunks = await retrieveHybridTopK(expandedQuery, queryEmbedding, embedVersion, 6, documentId);
  } catch {
    log.warn('pipeline', 'Hybrid search failed, falling back to keyword');
  }

  if (chunks.length === 0) {
    const docChunks = await db.chunks.where('noteId').equals(documentId).toArray();
    const ranked = rankChunksByKeywords(
      expandedQuery,
      docChunks.map((c) => ({ text: c.text, paragraphIndex: c.paragraphIndex })),
      6,
    );
    chunks = ranked
      .map((r) => {
        const orig =
          docChunks.find((c) => c.paragraphIndex === r.paragraphIndex && c.text === r.text) ??
          docChunks[0];
        return { ...orig, score: r.score, source: 'keyword' as const };
      })
      .filter((c) => c != null);
  }

  chunks = await expandContext(chunks, 1, documentId);

  const prompt = buildRAGPrompt(expandedQuery, chunks, recentHistory, readingLevel);

  abortController = new AbortController();
  const signal = abortController.signal;

  let answer = '';
  try {
    for await (const chunk of chat.generate({
      model,
      messages: [
        { role: 'system', content: 'You are a precise question-answering assistant.' },
        { role: 'user', content: prompt },
      ],
    })) {
      if (signal.aborted) break;
      if (chunk.type === 'text' && chunk.text) {
        answer += chunk.text;
        onChunk?.(chunk.text);
      }
      if (chunk.type === 'error') throw new AIClientError(chunk.error ?? 'RAG failed');
    }
  } catch {
    if (signal.aborted) {
      await persistConversationTurn(
        documentId,
        expandedQuery,
        answer,
        parseCitations(answer, chunks),
      );
      return { answer, citations: parseCitations(answer, chunks) };
    }
    const docChunks = await db.chunks.where('noteId').equals(documentId).toArray();
    const ranked = rankChunksByKeywords(
      expandedQuery,
      docChunks.map((c) => ({ text: c.text, paragraphIndex: c.paragraphIndex })),
      6,
    );
    answer = answerWithOfflineNLP(expandedQuery, ranked);
    onChunk?.(answer);
  } finally {
    abortController = null;
  }

  const citations = parseCitations(answer, chunks);
  await persistConversationTurn(documentId, expandedQuery, answer, citations);
  return { answer, citations };
}

async function persistConversationTurn(
  documentId: string,
  query: string,
  answer: string,
  citations: Citation[],
): Promise<void> {
  const now = new Date().toISOString();
  await db.messages.bulkPut([
    {
      id: `${documentId}:${crypto.randomUUID()}`,
      documentId,
      role: 'user',
      text: query,
      citations: [],
      isError: false,
      createdAt: now,
    },
    {
      id: `${documentId}:${crypto.randomUUID()}`,
      documentId,
      role: 'assistant',
      text: answer,
      citations,
      isError: false,
      createdAt: now,
    },
  ]);
}

export async function generateEmbeddingsForDocument(documentId: string): Promise<void> {
  const settings = await getSettings();
  const {
    providerId: embedProviderId,
    model: embedModel,
    version: embedVersion,
  } = settings.runtime.embedding;
  if (!embedProviderId || !embedModel)
    throw new AIClientError('No embedding provider configured.', 'MISSING_KEY');

  const doc = await db.notes.get(documentId);
  if (!doc) throw new Error(`Document not found: ${documentId}`);

  const embedProvider = await getProvider(embedProviderId);
  if (!embedProvider) throw new AIClientError('Embedding provider not found.', 'MISSING_KEY');
  const embedder = getEmbeddingProvider(embedProvider);
  if (embedder.dimensions <= 0) return;

  const chunks = await db.chunks.where('noteId').equals(documentId).toArray();
  const texts = chunks.map((c) => c.text);
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const vectors = await withRetry(() => embedder.embed(batch));
    for (let j = 0; j < batch.length; j++) {
      await db.vectors.put({
        chunkId: chunks[i + j].id,
        embedding: normalise(vectors[j]),
        providerId: embedProviderId,
        embeddingModel: embedModel,
        dimensions: embedder.dimensions,
        embeddingVersion: embedVersion,
      });
    }
  }
  doc.embeddingsGenerated = true;
  doc.updatedAt = new Date().toISOString();
  await saveDocument(doc);
}

export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const { buildTranslatePrompt } = await import('./chat-actions');
  const settings = await getSettings();
  if (shouldRunOffline(settings))
    throw new AIClientError('Translation is unavailable in local-only mode.', 'API_ERROR');
  const provider = await resolveChatProvider(settings);
  const model = resolveChatModel(settings, 'FAST');
  const chat = getChatProvider(provider);
  let out = '';
  for await (const chunk of chat.generate({
    model,
    messages: [
      { role: 'system', content: 'You are a precise translator.' },
      { role: 'user', content: buildTranslatePrompt(text, targetLanguage) },
    ],
  })) {
    if (chunk.type === 'text' && chunk.text) out += chunk.text;
    if (chunk.type === 'error') throw new AIClientError(chunk.error ?? 'Translation failed');
  }
  return out.trim();
}
