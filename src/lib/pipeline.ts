import { db } from '../lib/db';
import { getSettings, saveDocument, saveChunks, getProvider, saveMessage } from '../lib/storage';
import { getChatProvider, getEmbeddingProvider } from '../lib/providers/registry';
import { chunkDocument } from '../lib/chunker';
import { normalise, buildRAGPrompt, parseCitations, retrieveTopK } from '../lib/retrieval';
import { withRetry, withTimeout } from '../lib/client';
import { log } from '../lib/logger';
import { AIClientError } from '../lib/providers/errors';
import type { RetrievedChunk } from '../lib/retrieval';
import type {
  Document,
  GenerationMode,
  Citation,
  DOMExtraction,
  ChatMessage,
  RuntimeMessage,
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

  BALANCED: `You are a knowledge structuring assistant. Produce a comprehensive markdown document.

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
2-3 sentence synthesis.

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
2-3 sentence synthesis of most important insights.

Output ONLY valid markdown. No preamble, no explanation.`,
};

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
  const { providerId, modeModels } = settings.runtime.chat;
  const model = modeModels[mode] || modeModels.FAST;

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

  const structuredContent = await withRetry(() =>
    withTimeout(
      (async () => {
        const provider = await getProvider(providerId);
        if (!provider) throw new AIClientError(`Provider ${providerId} not found`, 'MISSING_KEY');
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

  onProgress?.('AI structuring complete', 60);

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
  conversationId: string,
  onChunk?: (text: string) => void,
): Promise<{ answer: string; citations: Citation[] }> {
  const settings = await getSettings();
  const { providerId, modeModels } = settings.runtime.chat;
  const model = modeModels.BALANCED || modeModels.FAST;
  const { providerId: embedProviderId, version: embedVersion } = settings.runtime.embedding;

  const history = await db.messages
    .where('id')
    .startsWith(conversationId)
    .sortBy('createdAt');
  const recentHistory = history.slice(-6).map(m => ({ role: m.role, content: m.text }));

  let chunks: RetrievedChunk[] = [];
  if (embedProviderId && embedVersion > 0) {
    try {
      const embedProvider = await getProvider(embedProviderId);
      if (embedProvider) {
        const embedder = getEmbeddingProvider(embedProvider);
        const [queryVec] = await embedder.embed([query]);
        const queryEmbedding = normalise(queryVec);
        chunks = await retrieveTopK(queryEmbedding, embedVersion, 6);
      }
    } catch (err) {
      log.warn('offscreen', 'Vector search failed, falling back to keyword', err);
    }
  }

  if (chunks.length === 0) {
    const allChunks = await db.chunks.toArray();
    chunks = allChunks.map(c => ({ ...c, score: 0 })).slice(0, 6);
  }

  const prompt = buildRAGPrompt(query, chunks, recentHistory);

  const provider = await getProvider(providerId);
  if (!provider) throw new AIClientError(`Chat provider ${providerId} not found`, 'MISSING_KEY');
  const chat = getChatProvider(provider);

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

  const now = new Date().toISOString();
  await db.messages.bulkPut([
    { id: crypto.randomUUID(), role: 'user', text: query, citations: [], isError: false, createdAt: now },
    { id: crypto.randomUUID(), role: 'assistant', text: answer, citations, isError: false, createdAt: now },
  ]);

  return { answer, citations };
}
