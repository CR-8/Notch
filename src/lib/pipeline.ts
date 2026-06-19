import { db } from '../lib/db';
import { getSettings, saveDocument, saveChunks, getProvider } from '../lib/storage';
import { getChatProvider, getEmbeddingProvider } from '../lib/providers/registry';
import { chunkDocument } from '../lib/chunker';
import { normalise, buildRAGPrompt, parseCitations, retrieveTopK } from '../lib/retrieval';
import { buildOfflineCaptureMarkdown, rankChunksByKeywords, answerWithOfflineNLP } from '../lib/nlp-fallback';
import { deriveAutoTags, mergeTags } from '../lib/auto-tag';
import { shouldRunOffline } from '../lib/privacy';
import { readingLevelInstruction, buildTranslatePrompt } from '../lib/chat-actions';
import { withRetry, withTimeout } from '../lib/client';
import { log } from '../lib/logger';
import { AIClientError } from '../lib/providers/errors';
import type { RetrievedChunk } from '../lib/retrieval';
import type {
  Document,
  GenerationMode,
  Citation,
  DOMExtraction,
  ProviderConfig,
  Settings,
  ReadingLevel,
} from '../lib/types';

const MODE_PROMPTS: Record<GenerationMode, string> = {
  FAST: `You are a document structuring assistant. Produce a well-formatted markdown document from the web page content below.

STRUCTURE:
# Document Title

## Summary
2-3 sentence overview.

## Key Points
- Bullet points (3-5)

## Key Entities
List named people, organizations, technologies.

## Concepts
Key technical terms with brief definitions.

## Main Content
Logical sections covering the document's substance.

Output ONLY valid markdown. No preamble.`,

  BALANCED: `You are a knowledge structuring assistant. Produce a comprehensive, publication-quality markdown document.

STRUCTURE:
# Document Title (clear, specific)

## Summary
3-4 sentence executive summary.

## Key Points
- 4-6 high-signal bullets. Lead with insight, not topic.

## Key Entities
**Name** (type): description for each entity.

## Concepts
**Term**: clear definition.

## Timeline (if applicable)
Chronological events with dates.

## Main Content
Hierarchical sections (### subsections) covering: problem/context, solutions/approach, results/outcomes, implications.

## Key Takeaways
- 3-5 bullets, each a single self-contained insight (BUG-010: bullets, never a paragraph).

FORMATTING RULES:
- Use \`\`\`mermaid fences for any diagrams (flowcharts, sequence diagrams, etc.)
- Use [!NOTE], [!WARNING], [!TIP], [!DANGER], [!INFO] for callouts
- Use standard markdown tables for structured data

Output ONLY valid markdown.`,

  DEEP: `You are an expert knowledge structuring assistant. Produce a thorough, publication-quality markdown document.

STRUCTURE:
# Document Title

## Summary
4-6 sentence executive summary covering what, why, and so what.

## Key Points
- 5-7 high-signal bullets with supporting detail

## Key Entities
**Name** (type): description for each entity.

## Concepts
**Term**: clear definition.

## Timeline
Chronological sequence of events with dates.

## Main Content
Thorough coverage using hierarchical sections:
- Context / Background
- Core Content / Arguments
- Evidence / Examples
- Analysis / Implications

## Key Takeaways
- 4-6 bullets, each a single self-contained insight (BUG-010: bullets, never a paragraph).

FORMATTING RULES (CRITICAL):
1. Use \`\`\`mermaid fences for diagrams wherever they improve understanding:
   - \`\`\`mermaid for flowcharts (processes, workflows, decision trees)
   - \`\`\`mermaid for sequenceDiagram (API interactions, service communication)
   - \`\`\`mermaid for classDiagram (object models, software designs)
   - \`\`\`mermaid for erDiagram (database systems, relationships)
   - \`\`\`mermaid for timeline (historical events, roadmaps)
   - \`\`\`mermaid for mindmap (knowledge breakdowns)
   - \`\`\`mermaid for gantt (project timelines, schedules)
   - \`\`\`mermaid for pie (distributions, proportions)
   - \`\`\`mermaid for journey (user journeys, experiences)
   - \`\`\`mermaid for gitGraph (version control flows)
   - \`\`\`mermaid for quadrantChart (prioritization matrices)
   - \`\`\`mermaid for requirementDiagram (requirements engineering)

2. Use \`\`\`plantuml for UML diagrams when relationships are complex:
   - class diagrams for detailed object models
   - sequence diagrams for complex interactions
   - activity diagrams for business processes
   - component diagrams for system architecture

3. Use GFM callouts for emphasis:
   - [!NOTE] for additional information
   - [!WARNING] for important cautions
   - [!TIP] for best practices
   - [!DANGER] for critical warnings
   - [!INFO] for background context

4. Use tables for:
   - Feature comparisons
   - Data comparisons
   - Specification lists
   - Metrics and statistics
   - Configuration options

5. NEVER generate raw text when a visual would improve understanding.
   ALWAYS prefer diagrams, tables, and structured formatting.

Output ONLY valid markdown. No preamble, no explanation.`,
};

// BUG-002: a real OpenRouter free model. The placeholder ids below are NOT valid
// model slugs and 404 at the API — map them to this when the endpoint is OpenRouter.
export const OPENROUTER_FREE_MODEL = 'google/gemini-2.0-flash-exp:free';
const INVALID_MODEL_ALIASES = new Set(['openrouter/free', 'free', 'openrouter', 'auto', 'default']);

/** Replaces invalid/placeholder model ids with a working default. Pure. */
export function normalizeModelId(model: string | undefined, baseUrl?: string): string {
  const m = (model ?? '').trim();
  const isOpenRouter = !!baseUrl && /openrouter\.ai/i.test(baseUrl);
  if ((!m || INVALID_MODEL_ALIASES.has(m.toLowerCase())) && isOpenRouter) {
    return OPENROUTER_FREE_MODEL;
  }
  return m;
}

async function resolveChatProvider(settings: Settings): Promise<ProviderConfig> {
  const { providerId } = settings.runtime.chat;

  if (providerId) {
    const provider = await getProvider(providerId);
    if (provider) return provider;
  }

  if (settings.provider && settings.apiKey) {
    const providerId = settings.provider;
    const protocol: ProviderConfig['protocol'] =
      providerId === 'openai-compatible' ? 'openai' :
      providerId as ProviderConfig['protocol'];
    return {
      id: providerId,
      label:
        providerId === 'openai-compatible' ? 'OpenAI Compatible' :
        providerId.charAt(0).toUpperCase() + providerId.slice(1),
      protocol,
      baseUrl: settings.baseUrl || '',
      apiKey: settings.apiKey,
      extraHeaders: {},
      chatModel: normalizeModelId(settings.modelId, settings.baseUrl) || (protocol === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini'),
      embeddingModel: '',
      embeddingDimensions: 0,
      enabled: true,
    };
  }

  throw new AIClientError('No valid provider configuration found', 'MISSING_KEY');
}

function resolveChatModel(settings: Settings, mode: GenerationMode): string {
  const { providerId, modeModels } = settings.runtime.chat;
  if (providerId && modeModels) {
    return normalizeModelId(modeModels[mode] || modeModels.FAST, settings.baseUrl);
  }
  return normalizeModelId(settings.modelId, settings.baseUrl) || 'gpt-4o-mini';
}

export function buildCapturePrompt(content: string, mode: GenerationMode, images: string): string {
  return `${MODE_PROMPTS[mode]}

PAGE CONTENT:
${content.slice(0, 20000)}

${images ? `IMAGE REFERENCES:\n${images}` : ''}`;
}

export async function runCapturePipeline(
  extraction: DOMExtraction,
  mode: GenerationMode,
  tags: string[],
  onProgress?: (step: string, pct: number) => void,
): Promise<string> {
  const settings = await getSettings();

  onProgress?.('Structuring with AI...', 20);

  const imageText = extraction.images
    .map(i => `[IMG: ${i.url} | ${i.alt}]`)
    .join('\n')
    .slice(0, 4000);

  const docId = crypto.randomUUID();

  const doc: Document = {
    id: docId,
    title: extraction.title,
    url: extraction.url,
    domain: extraction.domain,
    capturedAt: new Date().toISOString(),
    wordCount: extraction.wordCount,
    cleanedHtml: extraction.cleanedHtml,
    textContent: extraction.textContent,
    summary: '',
    keyPoints: [],
    entities: [],
    timeline: [],
    concepts: [],
    tags,
    images: extraction.images.map(i => ({
      url: i.url,
      alt: i.alt,
      sectionIndex: 0,
      paragraphContext: i.paragraphContext,
    })),
    status: 'captured',
    starred: false,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveDocument(doc);
  onProgress?.('Saved base document', 30);

  doc.status = 'structuring';
  await saveDocument(doc);

  let structuredContent: string;

  if (shouldRunOffline(settings)) {
    // Offline / local-only lock: structure the page with the local keyword/TF-IDF
    // NLP — guarantees no API call leaves the device.
    structuredContent = buildOfflineCaptureMarkdown(extraction.title, extraction.textContent);
  } else {
    const provider = await resolveChatProvider(settings);
    const model = resolveChatModel(settings, mode);

    structuredContent = await withRetry(() =>
      withTimeout(
        (async () => {
          const chat = getChatProvider(provider);
          const prompt = buildCapturePrompt(extraction.textContent, mode, imageText);

          let fullResponse = '';
          for await (const chunk of chat.generate({
            model,
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: prompt },
            ],
          })) {
            if (chunk.type === 'text' && chunk.text) fullResponse += chunk.text;
            if (chunk.type === 'error') throw new AIClientError(chunk.error ?? 'Generation failed');
          }
          return fullResponse;
        })(),
        120000,
      ),
    );
  }

  onProgress?.('Structuring complete', 60);

  const titleMatch = structuredContent.match(/^#\s+(.+)$/m);
  const summaryMatch = structuredContent.match(/^##\s+(?:SUMMARY|Summary)\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);

  const keyPoints: string[] = [];
  const kpMatch = structuredContent.match(/^##\s+Key Points\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  if (kpMatch) {
    for (const line of kpMatch[1].split('\n')) {
      const m = line.match(/^\s*[*-]\s+(.*)/);
      if (m?.[1]?.trim()) keyPoints.push(m[1].trim());
    }
  }

  const entities: Document['entities'] = [];
  const entMatch = structuredContent.match(/^##\s+Key Entities\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  if (entMatch) {
    entMatch[1].split('\n').forEach((line, i) => {
      const m = line.match(/^\s*[*-]\s+\*\*([^*:]+):?\*\*:?\s+\(([^)]+)\)\s+(.*)/);
      if (m) entities.push({ name: m[1].trim(), type: m[2].trim(), paragraphIndex: i });
    });
  }

  const timeline: Document['timeline'] = [];
  const tlMatch = structuredContent.match(/^##\s+Timeline\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  if (tlMatch) {
    tlMatch[1].split('\n').forEach((line, i) => {
      const m = line.match(/^\s*[*-]\s+\*\*([^*]+)\*\*:?\s+(.*)/);
      if (m) timeline.push({ date: m[1].trim(), description: m[2].trim(), paragraphIndex: i });
    });
  }

  const concepts: Document['concepts'] = [];
  const concMatch = structuredContent.match(/^##\s+Concepts\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  if (concMatch) {
    concMatch[1].split('\n').forEach((line, i) => {
      const m = line.match(/^\s*[*-]\s+\*\*([^*:]+):?\*\*:?\s+(.*)/);
      if (m) concepts.push({ term: m[1].trim(), definition: m[2].trim(), paragraphIndex: i });
    });
  }

  doc.title = titleMatch?.[1]?.trim() ?? doc.title;
  doc.summary = summaryMatch?.[1]?.trim() ?? '';
  doc.keyPoints = keyPoints;
  doc.entities = entities;
  doc.timeline = timeline;
  doc.concepts = concepts;
  // Persist the full structured markdown so the reader can render the document body.
  doc.content = structuredContent;

  // Content Intelligence: store enriched version and analysis metadata
  // The enriched content includes diagrams, callouts, and structured elements
  doc.enrichedContent = structuredContent;
  doc.hasToc = structuredContent.includes('## Table of Contents');
  doc.hasNumbering = true;
  doc.diagramCount = (structuredContent.match(/```mermaid|```plantuml|```flowchart/g) ?? []).length;
  doc.calloutCount = (structuredContent.match(/\[!(NOTE|WARNING|TIP|DANGER|INFO)\]/g) ?? []).length;

  // LIB-5: auto-file the note with tags derived from its own structure.
  doc.tags = mergeTags(tags, deriveAutoTags({ entities, concepts, domain: extraction.domain }));

  onProgress?.('Parsing structured data', 70);

  doc.status = 'chunked';
  await saveDocument(doc);

  const chunks = chunkDocument(docId, structuredContent, extraction.cleanedHtml);
  await saveChunks(chunks);
  log.info('offscreen', `Created ${chunks.length} chunks for ${docId}`);

  onProgress?.('Chunked content', 80);

  const { providerId: embedProviderId, model: embedModel, version: embedVersion } = settings.runtime.embedding;
  if (embedProviderId && embedModel) {
    doc.status = 'embedding';
    await saveDocument(doc);

    try {
      const embedProvider = await getProvider(embedProviderId);
      if (embedProvider) {
        const embedder = getEmbeddingProvider(embedProvider);
        if (embedder.dimensions > 0) {
          const texts = chunks.map(c => c.text);
          const batchSize = 10;

          for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const vectors = await withRetry(() => embedder.embed(batch));

            for (let j = 0; j < batch.length; j++) {
              const chunkId = chunks[i + j].id;
              await db.vectors.put({
                chunkId,
                embedding: normalise(vectors[j]),
                providerId: embedProviderId,
                embeddingModel: embedModel,
                dimensions: embedder.dimensions,
                embeddingVersion: embedVersion,
              });
            }
          }
          doc.embeddingsGenerated = true;
          log.info('offscreen', `Embedded ${chunks.length} chunks for ${docId}`);
        }
      }
    } catch (err) {
      log.warn('offscreen', `Embedding failed for ${docId}, will retry later`, err);
    }
  }

  doc.status = 'ready';
  doc.updatedAt = new Date().toISOString();
  await saveDocument(doc);

  onProgress?.('Capture complete', 100);
  log.success('offscreen', `Capture complete: ${docId} - "${doc.title}"`);

  return docId;
}

export async function runRAGPipeline(
  query: string,
  documentId: string,
  onChunk?: (text: string) => void,
  readingLevel?: ReadingLevel,
): Promise<{ answer: string; citations: Citation[] }> {
  const settings = await getSettings();
  const { providerId: embedProviderId, version: embedVersion } = settings.runtime.embedding;

  // Conversation history is scoped to the document being read.
  const priorMessages = await db.messages.where('documentId').equals(documentId).toArray();
  priorMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const recentHistory = priorMessages.slice(-6).map(m => ({ role: m.role, content: m.text }));

  // ── Offline / local-only lock: answer locally with keyword/TF-IDF NLP. ──────
  if (shouldRunOffline(settings)) {
    const docChunks = await db.chunks.where('noteId').equals(documentId).toArray();
    const ranked = rankChunksByKeywords(
      query,
      docChunks.map(c => ({ text: c.text, paragraphIndex: c.paragraphIndex })),
      6,
    );
    const rankedFull: RetrievedChunk[] = ranked.map(r => {
      const orig = docChunks.find(c => c.paragraphIndex === r.paragraphIndex && c.text === r.text) ?? docChunks[0];
      return { ...orig, score: r.score };
    });
    const answer = answerWithOfflineNLP(query, ranked);
    onChunk?.(answer);
    const citations = parseCitations(answer, rankedFull);
    await persistConversationTurn(documentId, query, answer, citations);
    return { answer, citations };
  }

  const provider = await resolveChatProvider(settings);
  const model = resolveChatModel(settings, 'BALANCED');
  const chat = getChatProvider(provider);

  // Vector retrieval, restricted to the open document.
  let chunks: RetrievedChunk[] = [];
  if (embedProviderId && embedVersion > 0) {
    try {
      const embedProvider = await getProvider(embedProviderId);
      if (embedProvider) {
        const embedder = getEmbeddingProvider(embedProvider);
        const [queryVec] = await embedder.embed([query]);
        const queryEmbedding = normalise(queryVec);
        chunks = await retrieveTopK(queryEmbedding, embedVersion, 6, documentId);
      }
    } catch (err) {
      log.warn('offscreen', 'Vector search failed, falling back to keyword', err);
    }
  }

  // Keyword fallback (or no embeddings configured): rank this document's chunks.
  if (chunks.length === 0) {
    const docChunks = await db.chunks.where('noteId').equals(documentId).toArray();
    const ranked = rankChunksByKeywords(
      query,
      docChunks.map(c => ({ text: c.text, paragraphIndex: c.paragraphIndex })),
      6,
    );
    chunks = ranked.map(r => {
      const orig = docChunks.find(c => c.paragraphIndex === r.paragraphIndex && c.text === r.text) ?? docChunks[0];
      return { ...orig, score: r.score };
    }).filter(c => c != null);
  }

  const styleInstruction = readingLevel ? readingLevelInstruction(readingLevel) : undefined;
  const prompt = buildRAGPrompt(query, chunks, recentHistory, styleInstruction);

  let answer = '';
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

  const citations = parseCitations(answer, chunks);
  await persistConversationTurn(documentId, query, answer, citations);

  return { answer, citations };
}

// CHAT-6: translate arbitrary text via the active chat provider. Blocked when
// local-only is locked (translation needs a cloud/local model, not extractive NLP).
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const settings = await getSettings();
  if (shouldRunOffline(settings)) {
    throw new AIClientError('Translation is unavailable in local-only mode.', 'API_ERROR');
  }

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

async function persistConversationTurn(
  documentId: string,
  query: string,
  answer: string,
  citations: Citation[],
): Promise<void> {
  const now = new Date().toISOString();
  await db.messages.bulkPut([
    { id: `${documentId}:${crypto.randomUUID()}`, documentId, role: 'user', text: query, citations: [], isError: false, createdAt: now },
    { id: `${documentId}:${crypto.randomUUID()}`, documentId, role: 'assistant', text: answer, citations, isError: false, createdAt: now },
  ]);
}

// Embed an already-captured document's chunks on demand (reader "Generate
// Embeddings" action). Requires an embedding provider to be configured.
export async function generateEmbeddingsForDocument(documentId: string): Promise<void> {
  const settings = await getSettings();
  const { providerId: embedProviderId, model: embedModel, version: embedVersion } = settings.runtime.embedding;
  if (!embedProviderId || !embedModel) {
    throw new AIClientError('No embedding provider configured. Add one in Settings.', 'MISSING_KEY');
  }

  const doc = await db.notes.get(documentId);
  if (!doc) throw new Error(`Document not found: ${documentId}`);

  const embedProvider = await getProvider(embedProviderId);
  if (!embedProvider) throw new AIClientError('Embedding provider not found.', 'MISSING_KEY');

  const embedder = getEmbeddingProvider(embedProvider);
  if (embedder.dimensions <= 0) return;

  const chunks = await db.chunks.where('noteId').equals(documentId).toArray();
  const texts = chunks.map(c => c.text);
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
  log.info('offscreen', `Generated embeddings for ${documentId} (${chunks.length} chunks)`);
}
