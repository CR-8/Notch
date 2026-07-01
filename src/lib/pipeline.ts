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
import { normalise, parseCitations, retrieveTopK, buildRAGPrompt } from './retrieval';
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

// ── Engine imports ──────────────────────────────────────────────────────
import { runCaptureEngine } from './capture/engine';
import { runContentEngine } from './content/engine';
import { runLayoutEngine } from './layout/engine';
import type { CompleteFn } from './content/types';

function extractFrontmatter(md: string): {
  title: string;
  summary: string;
  keyPoints: string[];
  entities: Document['entities'];
  timeline: Document['timeline'];
  concepts: Document['concepts'];
} {
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const summaryMatch = md.match(/^##\s+(?:SUMMARY|Summary)\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);

  const keyPoints: string[] = [];
  const kpMatch = md.match(/^##\s+Key Points\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  if (kpMatch) {
    for (const line of kpMatch[1].split('\n')) {
      const m = line.match(/^\s*[*-]\s+(.*)/);
      if (m?.[1]?.trim()) keyPoints.push(m[1].trim());
    }
  }

  const entities: Document['entities'] = [];
  const entMatch = md.match(/^##\s+Key Entities\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  if (entMatch) {
    entMatch[1].split('\n').forEach((line, i) => {
      const m = line.match(/^\s*[*-]\s+\*\*([^*:]+?)\*\*\s*(?:\(([^)]*)\))?\s*[:—–-]?\s*(.*)/);
      if (m?.[1]?.trim())
        entities.push({ name: m[1].trim(), type: m[2]?.trim() || 'other', paragraphIndex: i });
    });
  }

  const timeline: Document['timeline'] = [];
  const tlMatch = md.match(/^##\s+Timeline\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  if (tlMatch) {
    tlMatch[1].split('\n').forEach((line, i) => {
      const m = line.match(/^\s*[*-]\s+\*\*([^*]+)\*\*:?\s+(.*)/);
      if (m) timeline.push({ date: m[1].trim(), description: m[2].trim(), paragraphIndex: i });
    });
  }

  const concepts: Document['concepts'] = [];
  const concMatch = md.match(/^##\s+Concepts\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  if (concMatch) {
    concMatch[1].split('\n').forEach((line, i) => {
      const m = line.match(/^\s*[*-]\s+\*\*([^*:]+):?\*\*:?\s+(.*)/);
      if (m) concepts.push({ term: m[1].trim(), definition: m[2].trim(), paragraphIndex: i });
    });
  }

  return {
    title: titleMatch?.[1]?.trim() ?? '',
    summary: summaryMatch?.[1]?.trim() ?? '',
    keyPoints,
    entities,
    timeline,
    concepts,
  };
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

// ── Main capture pipeline ───────────────────────────────────────────────

export async function runCapturePipeline(
  extraction: DOMExtraction,
  mode: GenerationMode,
  tags: string[],
  onProgress?: (step: string, pct: number) => void,
): Promise<string> {
  const settings = await getSettings();
  const docId = crypto.randomUUID();

  // Engine 1: Capture
  onProgress?.('Extracting content...', 10);
  const capture = runCaptureEngine(extraction);

  // Save base document immediately
  const doc: Document = {
    id: docId,
    title: capture.metadata.title,
    url: capture.metadata.url,
    domain: capture.metadata.domain,
    capturedAt: capture.metadata.capturedAt,
    wordCount: capture.metadata.wordCount,
    cleanedHtml: extraction.cleanedHtml,
    textContent: capture.rawContent,
    summary: '',
    keyPoints: [],
    entities: [],
    timeline: [],
    concepts: [],
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
  onProgress?.('Saved base document', 20);

  // Engine 2: Content (if online)
  let structuredContent: string;
  doc.status = 'structuring';
  await saveDocument(doc);

  if (shouldRunOffline(settings)) {
    structuredContent = buildOfflineCaptureMarkdown(capture.metadata.title, capture.rawContent);
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
      const contentResult = await runContentEngine({ capture, mode, complete });
      structuredContent = contentResult.markdown;
      log.info('pipeline', `Content engine: ${contentResult.wordCount} words`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.warn(
        'pipeline',
        `AI structuring failed (${reason}) — saving raw text. Check the active provider's model id and API key.`,
        err,
      );
      onProgress?.(`AI structuring unavailable — saved raw text (${reason})`, 60);
      structuredContent = buildOfflineCaptureMarkdown(capture.metadata.title, capture.rawContent);
    }
  }

  onProgress?.('Content generation complete', 60);

  // Engine 3: Layout — enrich content with images, tables, diagrams, callouts
  const { enrichedMarkdown } = runLayoutEngine({
    markdown: structuredContent,
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
  structuredContent = enrichedMarkdown;

  onProgress?.('Layout complete', 75);

  // Parse frontmatter from generated content for metadata
  const frontmatter = extractFrontmatter(structuredContent);
  doc.title = frontmatter.title || doc.title;
  doc.summary = frontmatter.summary;
  doc.keyPoints = frontmatter.keyPoints;
  doc.entities = frontmatter.entities.length
    ? frontmatter.entities
    : capture.entities.map((e, i) => ({ name: e.name, type: e.type, paragraphIndex: i }));
  doc.timeline = frontmatter.timeline.length
    ? frontmatter.timeline
    : capture.timeline.map((t, i) => ({
        date: t.year,
        description: t.event,
        significance: t.significance,
        paragraphIndex: i,
      }));
  doc.concepts = frontmatter.concepts.length
    ? frontmatter.concepts
    : capture.concepts.map((c, i) => ({
        term: c.concept,
        definition: c.definition,
        paragraphIndex: i,
      }));
  doc.relationships = capture.relationships;
  doc.topics = capture.topics;
  doc.complexity = capture.complexity;
  doc.documentType = capture.documentClass;

  doc.content = structuredContent;
  doc.wordCount = Math.max(structuredContent.split(/\s+/).filter(Boolean).length, doc.wordCount);
  doc.readingTimeMinutes = Math.max(1, Math.round(doc.wordCount / 220));

  doc.enrichedContent = structuredContent;
  doc.diagramCount = (structuredContent.match(/```mermaid/g) ?? []).length;
  doc.calloutCount = (structuredContent.match(/\[!(NOTE|WARNING|TIP|INFO)\]/g) ?? []).length;

  // Auto-tag from extracted entities
  doc.tags = mergeTags(
    tags,
    deriveAutoTags({
      entities: doc.entities,
      concepts: doc.concepts,
      domain: capture.metadata.domain,
    }),
  );

  onProgress?.('Parsing structured data', 80);

  // Engine 4: Storage + Search
  doc.status = 'chunked';
  await saveDocument(doc);
  const chunks = chunkDocument(docId, structuredContent, extraction.cleanedHtml);
  await saveChunks(chunks);
  log.info('pipeline', `Created ${chunks.length} chunks for ${docId}`);

  onProgress?.('Chunked content', 85);

  // Generate embeddings (on-device or cloud). Never fatal: the document is
  // already chunked and usable, so an embedding failure (including loading the
  // on-device runtime in a context without a DOM) only disables semantic search
  // rather than aborting the whole capture.
  try {
    const { getOnDeviceConfig, embedOnDevice } = await import('./on-device');
    const onDeviceCfg = await getOnDeviceConfig();
    const hasOnDeviceEmbedding =
      onDeviceCfg.enabled &&
      onDeviceCfg.embeddingModelId &&
      onDeviceCfg.status[onDeviceCfg.embeddingModelId] === 'ready';
    const {
      providerId: embedProviderId,
      model: embedModel,
      version: embedVersion,
    } = settings.runtime.embedding;

    if (hasOnDeviceEmbedding && (!embedProviderId || !embedModel)) {
      doc.status = 'embedding';
      await saveDocument(doc);
      try {
        const texts = chunks.map((c) => c.text);
        const batchSize = 8;
        const modelId = onDeviceCfg.embeddingModelId!;
        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          const vectors = await embedOnDevice(batch, modelId);
          for (let j = 0; j < batch.length; j++) {
            await db.vectors.put({
              chunkId: chunks[i + j].id,
              embedding: normalise(vectors[j]),
              providerId: `local:${modelId}`,
              embeddingModel: modelId,
              dimensions: vectors[j].length,
              embeddingVersion: 1,
            });
          }
        }
        doc.embeddingsGenerated = true;
      } catch (err) {
        log.warn('pipeline', 'On-device embedding failed', err);
      }
    } else if (embedProviderId && embedModel) {
      doc.status = 'embedding';
      await saveDocument(doc);
      try {
        const embedProvider = await getProvider(embedProviderId);
        if (embedProvider) {
          const embedder = getEmbeddingProvider(embedProvider);
          if (embedder.dimensions > 0) {
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
          }
        }
      } catch (err) {
        log.warn('pipeline', 'Cloud embedding failed', err);
      }
    }
  } catch (err) {
    log.warn('pipeline', 'Embedding generation skipped (non-fatal)', err);
  }

  doc.status = 'ready';
  doc.updatedAt = new Date().toISOString();
  await saveDocument(doc);

  onProgress?.('Capture complete', 100);
  log.success('pipeline', `Capture complete: ${docId} - "${doc.title}"`);

  return docId;
}

// ── RAG pipeline ───────────────────────────────────────────────────────

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

  if (shouldRunOffline(settings)) {
    const docChunks = await db.chunks.where('noteId').equals(documentId).toArray();
    const ranked = rankChunksByKeywords(
      query,
      docChunks.map((c) => ({ text: c.text, paragraphIndex: c.paragraphIndex })),
      6,
    );
    const answer = answerWithOfflineNLP(query, ranked);
    onChunk?.(answer);
    const citations = parseCitations(
      answer,
      ranked.map((r, _i) => {
        const orig =
          docChunks.find((c) => c.paragraphIndex === r.paragraphIndex && c.text === r.text) ??
          docChunks[0];
        return { ...orig, score: r.score };
      }),
    );
    await persistConversationTurn(documentId, query, answer, citations);
    return { answer, citations };
  }

  const provider = await resolveChatProvider(settings);
  const model = resolveChatModel(settings, 'BALANCED');
  const chat = getChatProvider(provider);

  let chunks: RetrievedChunk[] = [];
  if (embedProviderId && embedVersion > 0) {
    try {
      const embedProvider = await getProvider(embedProviderId);
      if (embedProvider) {
        const embedder = getEmbeddingProvider(embedProvider);
        const [queryVec] = await embedder.embed([query]);
        chunks = await retrieveTopK(normalise(queryVec), embedVersion, 6, documentId);
      }
    } catch {
      log.warn('pipeline', 'Vector search failed, falling back to keyword');
    }
  }

  if (chunks.length === 0) {
    const docChunks = await db.chunks.where('noteId').equals(documentId).toArray();
    const ranked = rankChunksByKeywords(
      query,
      docChunks.map((c) => ({ text: c.text, paragraphIndex: c.paragraphIndex })),
      6,
    );
    chunks = ranked
      .map((r) => {
        const orig =
          docChunks.find((c) => c.paragraphIndex === r.paragraphIndex && c.text === r.text) ??
          docChunks[0];
        return { ...orig, score: r.score };
      })
      .filter((c) => c != null);
  }

  const prompt = buildRAGPrompt(query, chunks, recentHistory, readingLevel);

  let answer = '';
  try {
    for await (const chunk of chat.generate({
      model,
      messages: [
        { role: 'system', content: 'You are a precise question-answering assistant.' },
        { role: 'user', content: prompt },
      ],
    })) {
      if (chunk.type === 'text' && chunk.text) {
        answer += chunk.text;
        onChunk?.(chunk.text);
      }
      if (chunk.type === 'error') throw new AIClientError(chunk.error ?? 'RAG failed');
    }
  } catch {
    const { getOnDeviceConfig, generateOnDevice } = await import('./on-device');
    const onDevCfg = await getOnDeviceConfig();
    const readyChatId =
      onDevCfg.chatModelId && onDevCfg.status[onDevCfg.chatModelId] === 'ready'
        ? onDevCfg.chatModelId
        : null;
    if (readyChatId) {
      for await (const t of generateOnDevice(
        'You are a precise question-answering assistant.',
        prompt,
        readyChatId,
      )) {
        answer += t;
        onChunk?.(t);
      }
    } else {
      const docChunks = await db.chunks.where('noteId').equals(documentId).toArray();
      const ranked = rankChunksByKeywords(
        query,
        docChunks.map((c) => ({ text: c.text, paragraphIndex: c.paragraphIndex })),
        6,
      );
      answer = answerWithOfflineNLP(query, ranked);
      onChunk?.(answer);
    }
  }

  const citations = parseCitations(answer, chunks);
  await persistConversationTurn(documentId, query, answer, citations);
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
