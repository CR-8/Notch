import { db } from '../lib/db';
import { getSettings, saveDocument, saveChunks, getProvider } from '../lib/storage';
import { getChatProvider, getEmbeddingProvider } from '../lib/providers/registry';
import { chunkDocument } from '../lib/chunker';
import { normalise, buildRAGPrompt, parseCitations, retrieveTopK } from '../lib/retrieval';
import { buildOfflineCaptureMarkdown, rankChunksByKeywords, answerWithOfflineNLP } from '../lib/nlp-fallback';
import { deriveAutoTags, mergeTags } from '../lib/auto-tag';
import { extractKnowledge } from '../lib/content-engine/extraction/extractors';
import { planDocument, type PlanDepth } from '../lib/content-engine/planner/document-planner';
import { generateDocument } from '../lib/content-engine/generator/orchestrator';
import type { CompleteFn } from '../lib/content-engine/generator/types';
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
  FAST: `You are a senior technical writer producing a concise professional knowledge note (300-600 words). Do NOT merely summarize — interpret.

Each section has ONE distinct job. NEVER repeat the same fact across sections.

# Document Title

## Summary
What is this document about? 2-4 sentences. Prose.

## Key Points
What are the most important facts? 5-8 bullets. Bullets only, never paragraphs.

## Concepts
What terminology must the reader understand? Definition list only: **Term** — definition. Do not re-explain elsewhere.

## Key Entities
What are the main entities (people, organizations, technologies, standards, products) mentioned? Bullet list with **Entity Name** (type): brief description. At minimum, list 3. Output ONLY if entities exist.

## Key Takeaways
What should the reader remember and do? 3-5 actionable bullets. Bullets only.

If a diagram genuinely aids understanding, include at most ONE \`\`\`mermaid block; pick the diagram type and direction from DIAGRAM RULES below.

Output ONLY valid markdown. No preamble.`,

  BALANCED: `You are a senior analyst writing a professional report (1000-2500 words). Interpret and explain — do not just summarize. The result must feel intentionally authored by an expert.

Each section has ONE distinct responsibility. NEVER repeat the same information across sections.

# Document Title (specific, not generic)

## Summary
What is this document about? 200-400 words, prose. The big picture only.

## Key Points
What are the most important facts? 5-10 bullets. Bullets only, never paragraphs.

## Concepts
What terminology must the reader understand? Definition list: **Term** — definition. No repeated explanations.

## Key Entities
What are the main entities (people, organizations, technologies, standards, products) mentioned? Bullet list with **Entity Name** (type): brief description. At minimum, list 5.

## Timeline
How did this evolve over time? Only if dated events exist. Each: **Year** — event — significance.

## Main Content
What is the actual explanation? Deep, hierarchical (### subsections). This is where detail lives — do not pre-empt it in earlier sections.

## Analysis
Why does this matter? Your interpretation: tradeoffs, implications, what changed. Not a recap.

## Key Takeaways
What should the reader remember and do? 4-6 actionable bullets. Bullets only.

Use 2-3 diagrams where they aid understanding (see DIAGRAM RULES). Use [!NOTE]/[!TIP]/[!WARNING] callouts and real markdown tables for comparisons.

Output ONLY valid markdown.`,

  DEEP: `You are a senior technical researcher and information architect producing a thorough whitepaper (3000-7000+ words). This must read like an expert authored it — interpret, argue, and synthesize. It must be SUBSTANTIALLY richer than a short summary.

Each section has ONE distinct responsibility. NEVER repeat information across sections — escalate depth as the document progresses.

# Document Title (specific and substantive)

## Summary
What is this document about? 300-400 words, prose. Orientation only.

## Key Points
The most important facts. 7-10 bullets. Bullets only.

## Concepts
Terminology the reader must understand. Definition list: **Term** — definition. Define once, never re-explain.

## Key Entities
What are the main entities (people, organizations, technologies, standards, products) mentioned? Bullet list with **Entity Name** (type): brief description. At minimum, list 8.

## Timeline
How did this evolve? Each: **Year** — event — significance. Only with real dated events.

## Main Content
The actual explanation, in depth. Hierarchical ### / #### subsections. Context, mechanisms, evidence. This is the core — most words live here.

## Examples
Where is this used in practice? Concrete case studies and real-world examples.

## Analysis
Why does this matter? Tradeoffs, counterarguments, limitations, implications. Your expert interpretation, not a recap.

## Key Takeaways
What should the reader remember and do? 5-8 actionable bullets. Bullets only.

Use 5-15 visuals total: diagrams, comparison tables, and a knowledge graph of the key entities. Use [!NOTE]/[!TIP]/[!WARNING] callouts. Prefer a visual over prose whenever it communicates better.

Output ONLY valid markdown. No preamble.`,
};

// Shared diagram guidance appended to every capture prompt (Problems 4 & 5):
// choose the diagram TYPE from the content and the DIRECTION from its role.
const DIAGRAM_RULES = `DIAGRAM RULES:
- Choose the diagram type from the content; never default to a flowchart:
  process/pipeline/CI-CD → flowchart · API/request-response → sequenceDiagram ·
  system/infrastructure → flowchart (architecture) or C4 · object model → classDiagram ·
  data/schema → erDiagram · history/evolution → timeline · concept breakdown → mindmap ·
  lifecycle/status → stateDiagram-v2 · entities & links → a graph "knowledge graph".
- Choose flow DIRECTION by role, never hardcode TD:
  LR for timelines, pipelines, workflows, processes ·
  TD for hierarchies, trees, org/structure breakdowns ·
  RL for dependency chains / reverse flows ·
  BT for root-cause / escalation trees.
- Write \`flowchart LR\` (or the correct direction) explicitly. Keep node labels short and quoted if they contain punctuation. Output valid Mermaid only.`;

// BUG-002: zero-config default so a new OpenRouter user can capture without first
// picking a model. `openrouter/free` is OpenRouter's own free auto-router — a real,
// valid model id.
export const OPENROUTER_DEFAULT_MODEL = 'openrouter/free';

/**
 * Supplies a default model ONLY when none is configured. It never rewrites an
 * explicit model id — any non-empty value the user chose (e.g. `openrouter/free`,
 * `openrouter/auto`, or any catalogue id) is passed through untouched. Pure.
 */
export function normalizeModelId(model: string | undefined, baseUrl?: string): string {
  const m = (model ?? '').trim();
  if (m) return m;
  const isOpenRouter = !!baseUrl && /openrouter\.ai/i.test(baseUrl);
  return isOpenRouter ? OPENROUTER_DEFAULT_MODEL : m;
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

${DIAGRAM_RULES}

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

  // ── Log raw extraction input ─────────────────────────────────────────────
  log.info('pipeline', `EXTRACTION INPUT: title="${extraction.title}", url="${extraction.url}", textContent.length=${extraction.textContent.length}, wordCount=${extraction.wordCount}, images=${extraction.images.length}, cleanedHtml.length=${extraction.cleanedHtml.length}`);

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
  log.info('pipeline', `Base document saved: ${docId}`);

  doc.status = 'structuring';
  await saveDocument(doc);

  // Stage 1 (Phase 1): extract structured knowledge up front so the planner can
  // decide the document shape BEFORE any content is generated.
  const knowledge = extractKnowledge(extraction.textContent);
  log.info('pipeline', `KNOWLEDGE EXTRACTION (raw text): entities=${knowledge.entities.length}, concepts=${knowledge.concepts.length}, timeline=${knowledge.timeline.length}, relationships=${knowledge.relationships.length}, topics=[${knowledge.topics.join(', ')}], documentType=${knowledge.documentType}, complexity=${knowledge.complexity}, input.length=${extraction.textContent.length}`);

  let structuredContent: string;

  if (shouldRunOffline(settings)) {
    // Offline / local-only lock: structure the page with the local keyword/TF-IDF
    // NLP — guarantees no API call leaves the device.
    structuredContent = buildOfflineCaptureMarkdown(extraction.title, extraction.textContent);
  } else {
    // Online: planner-driven, per-section generation (Phase 2). Each section is a
    // scoped call so sections can't rephrase each other; diagrams are generated and
    // validated/repaired. Falls back to the legacy single call if orchestration fails.
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
              if (chunk.type === 'error') throw new AIClientError(chunk.error ?? 'Generation failed');
            }
            return full;
          })(),
          90000,
        ),
      );

    try {
      const depth: PlanDepth = mode === 'FAST' ? 'fast' : mode === 'DEEP' ? 'deep' : 'standard';
      const plan = planDocument(knowledge, depth);
      log.info('pipeline', `PLAN: depth=${depth}, sections=${plan.sections.length}, targetWords=${plan.targetWords.min}–${plan.targetWords.max}, visuals=${plan.visuals.length}`);
      const generated = await generateDocument(extraction.title, plan, knowledge, extraction.textContent, complete, { onProgress });
      structuredContent = generated.markdown;
      log.info('pipeline', `GENERATION: orchestrated, structuredContent.length=${structuredContent.length}`);
    } catch (err) {
      // Resilience: never fail capture because orchestration hit a snag.
      log.warn('pipeline', 'Structured generation failed, using single-pass fallback', err);
      structuredContent = await complete(
        'You are a helpful assistant.',
        buildCapturePrompt(extraction.textContent, mode, imageText),
      );
      log.info('pipeline', `GENERATION: single-pass fallback, structuredContent.length=${structuredContent.length}`);
    }
  }

  onProgress?.('Structuring complete', 80);
  log.info('pipeline', `STRUCTURED CONTENT: length=${structuredContent.length}, first 200 chars="${structuredContent.slice(0, 200).replace(/\n/g, '\\n')}"`);

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

  // Extract entities from the "Key Entities" section with flexible regex that
  // handles multiple LLM output formats:
  //   **Name** (type): description
  //   **Name** (type) — description
  //   **Name** — description
  //   **Name**: description
  const entities: Document['entities'] = [];
  const entMatch = structuredContent.match(/^##\s+Key Entities\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  if (entMatch) {
    entMatch[1].split('\n').forEach((line, i) => {
      const m = line.match(/^\s*[*-]\s+\*\*([^*:]+?)\*\*\s*(?:\(([^)]*)\))?\s*[:—–-]?\s*(.*)/);
      if (m && m[1].trim()) entities.push({
        name: m[1].trim(),
        type: (m[2]?.trim() || 'other'),
        paragraphIndex: i,
      });
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

  // Backfill: run deterministic extraction on the generated structured content.
  // The AI-generated markdown often contains richer entity/concept data than the
  // raw page text (especially when Readability returns short or empty text).
  const knowledgeFromContent = extractKnowledge(structuredContent);

  // Backfill entities from Concepts section terms when Key Entities section
  // returned nothing — every concept is a potential entity.
  const conceptsAsEntities: Document['entities'] = concepts.length && !entities.length
    ? concepts.slice(0, 8).map((c, i) => ({
        name: c.term,
        type: 'concept' as const,
        paragraphIndex: c.paragraphIndex ?? i,
      }))
    : [];

  // Three-tier merge: LLM-parsed → deterministic-from-structured → raw-text.
  // The deterministic-from-structured pass catches entities/concepts that the
  // LLM mentions in the body but didn't list in the Key Entities section.
  const mergedEntities: Document['entities'] = entities.length
    ? entities
    : conceptsAsEntities.length
      ? conceptsAsEntities
      : knowledgeFromContent.entities.length
        ? knowledgeFromContent.entities.map((e, i) => ({ name: e.name, type: e.type, description: e.description, mentions: e.mentions, paragraphIndex: i }))
        : knowledge.entities.map((e, i) => ({ name: e.name, type: e.type, description: e.description, mentions: e.mentions, paragraphIndex: i }));
  const mergedConcepts: Document['concepts'] = concepts.length
    ? concepts
    : knowledgeFromContent.concepts.length
      ? knowledgeFromContent.concepts.map((c, i) => ({ term: c.concept, definition: c.definition, paragraphIndex: i }))
      : knowledge.concepts.map((c, i) => ({ term: c.concept, definition: c.definition, paragraphIndex: i }));
  const mergedTimeline: Document['timeline'] = timeline.length
    ? timeline
    : knowledgeFromContent.timeline.length
      ? knowledgeFromContent.timeline.map((t, i) => ({ date: t.year, description: t.event, significance: t.significance, paragraphIndex: i }))
      : knowledge.timeline.map((t, i) => ({ date: t.year, description: t.event, significance: t.significance, paragraphIndex: i }));

  log.info('pipeline', `PARSE RESULTS: titleMatch=${!!titleMatch}, summaryMatch=${!!summaryMatch}, keyPoints=${keyPoints.length}, entities_llm=${entities.length}, timeline_llm=${timeline.length}, concepts_llm=${concepts.length}`);
  log.info('pipeline', `BACKFILL RESULTS: knowledgeFromContent entities=${knowledgeFromContent.entities.length}, concepts=${knowledgeFromContent.concepts.length}, timeline=${knowledgeFromContent.timeline.length}`);
  log.info('pipeline', `MERGE RESULTS: mergedEntities=${mergedEntities.length}, mergedConcepts=${mergedConcepts.length}, mergedTimeline=${mergedTimeline.length}`);

  doc.title = titleMatch?.[1]?.trim() ?? doc.title;
  doc.summary = summaryMatch?.[1]?.trim() ?? '';
  doc.keyPoints = keyPoints;
  doc.entities = mergedEntities;
  doc.timeline = mergedTimeline;
  doc.concepts = mergedConcepts;
  // Structured intelligence: prefer extraction from generated content (richer),
  // fall back to raw-text extraction.
  const richExtraction = knowledgeFromContent.entities.length ? knowledgeFromContent : knowledge;
  doc.relationships = richExtraction.relationships;
  doc.topics = richExtraction.topics;
  doc.complexity = richExtraction.complexity;
  doc.documentType = richExtraction.documentType;
  log.info('pipeline', `META SET: relationships=${doc.relationships?.length ?? 0}, topics=[${doc.topics?.join(', ')}], complexity=${doc.complexity}, documentType=${doc.documentType}`);
  // Persist the full structured markdown so the reader can render the document body.
  doc.content = structuredContent;

  // Recompute wordCount from the actual rendered content, not the raw extraction.
  // The reader renders `doc.content`, so wordCount must reflect that content.
  const contentWordCount = structuredContent.split(/\s+/).filter(Boolean).length;
  if (contentWordCount < doc.wordCount * 0.5) {
    log.warn('pipeline', `content wordCount (${contentWordCount}) is <50% of raw wordCount (${doc.wordCount}) — using content-based count`);
  }
  doc.wordCount = Math.max(contentWordCount, doc.wordCount);

  // Guard: structuredContent must not be empty. If it is, the reader will show
  // nothing in the main content panel, even though metadata may be populated.
  if (!structuredContent || structuredContent.trim().length === 0) {
    log.error('pipeline', 'structuredContent is EMPTY — reader will show no content');
  }

  doc.readingTimeMinutes = Math.max(1, Math.round(doc.wordCount / 220));

  // Content Intelligence: store enriched version and analysis metadata
  // The enriched content includes diagrams, callouts, and structured elements
  doc.enrichedContent = structuredContent;
  doc.hasToc = structuredContent.includes('## Table of Contents');
  doc.hasNumbering = true;
  doc.diagramCount = (structuredContent.match(/```mermaid|```plantuml|```flowchart/g) ?? []).length;
  doc.calloutCount = (structuredContent.match(/\[!(NOTE|WARNING|TIP|DANGER|INFO)\]/g) ?? []).length;

  // LIB-5: auto-file the note with tags derived from its own structure.
  doc.tags = mergeTags(tags, deriveAutoTags({ entities: mergedEntities, concepts: mergedConcepts, domain: extraction.domain }));

  onProgress?.('Parsing structured data', 70);

  doc.status = 'chunked';
  await saveDocument(doc);

  const chunks = chunkDocument(docId, structuredContent, extraction.cleanedHtml);
  await saveChunks(chunks);
  log.info('offscreen', `Created ${chunks.length} chunks for ${docId}`);

  log.info('pipeline', `FINAL DOC: id=${docId}, title="${doc.title}", content.length=${doc.content?.length ?? 0}, enrichedContent.length=${doc.enrichedContent?.length ?? 0}, wordCount=${doc.wordCount}, entities=${doc.entities?.length ?? 0}, concepts=${doc.concepts?.length ?? 0}, timeline=${doc.timeline?.length ?? 0}, diagramCount=${doc.diagramCount}, tags=[${doc.tags.join(', ')}]`);

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
