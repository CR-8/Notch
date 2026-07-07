export type GenerationMode = 'FAST' | 'BALANCED' | 'DEEP';
export type ViewMode = 'compact' | 'comfortable' | 'detailed';
export type ReadingLevel = 'simple' | 'technical';
export type ProviderProtocol = 'openai' | 'anthropic' | 'gemini';
export type CaptureStatus =
  'captured' | 'structuring' | 'chunked' | 'embedding' | 'ready' | 'failed';

export interface Entity {
  name: string;
  type: string;
  paragraphIndex: number;
  // Content Intelligence: richer extraction fields (optional, backward-compat).
  description?: string;
  mentions?: number;
}

export interface TimelineEvent {
  date: string;
  description: string;
  paragraphIndex: number;
  significance?: string;
}

export interface DocumentRelationship {
  source: string;
  target: string;
  relation: string;
}

export interface Concept {
  term: string;
  definition: string;
  paragraphIndex: number;
}

export interface ImageRef {
  url: string;
  alt: string;
  sectionIndex: number;
  paragraphContext: string;
}

export interface VideoRef {
  url: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  duration?: number;
}

export interface Document {
  id: string;
  title: string;
  url: string;
  domain: string;
  capturedAt: string;
  wordCount: number;
  cleanedHtml: string;
  textContent: string;
  summary: string;
  keyPoints: string[];
  entities: Entity[];
  timeline: TimelineEvent[];
  concepts: Concept[];
  tags: string[];
  images: ImageRef[];
  videos: VideoRef[];
  status: CaptureStatus;
  starred: boolean;
  archived: boolean;
  /** LIB-7: read/unread state — set true when the reader loads the document */
  isRead?: boolean;
  createdAt: string;
  updatedAt: string;
  // Backward-compat fields
  content?: string;
  keyEntities?: Entity[];
  folder?: string;
  embeddingsGenerated?: boolean;
  // Content Intelligence Engine fields
  enrichedContent?: string;
  relationships?: DocumentRelationship[];
  topics?: string[];
  complexity?: number;
  documentType?: string;
  readingTimeMinutes?: number;
  qualityScore?: number;
  diagramCount?: number;
  imageCount?: number;
  calloutCount?: number;
  hasToc?: boolean;
  hasNumbering?: boolean;
}

export interface DocumentChunk {
  id: string;
  noteId: string;
  text: string;
  paragraphIndex: number;
  charStart: number;
  charEnd: number;
  heading: string;
}

export interface VectorRecord {
  chunkId: string;
  embedding: Float32Array;
  providerId: string;
  embeddingModel: string;
  dimensions: number;
  embeddingVersion: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  documentId?: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  isError?: boolean;
  createdAt: string;
}

export interface Citation {
  noteId: string;
  chunkId: string;
  paragraphIndex: number;
  text: string;
}

export interface DOMExtraction {
  title: string;
  url: string;
  domain: string;
  textContent: string;
  cleanedHtml: string;
  images: Array<{ url: string; alt: string; paragraphContext: string }>;
  videos: Array<{
    url: string;
    title: string;
    description: string;
    thumbnailUrl?: string;
    duration?: number;
  }>;
  wordCount: number;
  metaDescription: string;
  /** Number of heading elements (h1–h6) on the page — used by the popup page card */
  headingCount?: number;
  /** CAP-7: set when the page appears to be paywalled or unreadable */
  isPaywalled?: boolean;
  /** CAP-7: signal that triggered paywall detection */
  paywallSignal?: string;
  /** CAP-3: if the user triggered a selection-only capture, this is the selected text */
  selectionText?: string;
  /** CAP-4: YouTube video ID when captured from youtube.com/watch */
  youtubeVideoId?: string;
  /** CAP-4: whether a YouTube transcript was successfully extracted */
  hasTranscript?: boolean;
  /** True when content was extracted directly from a PDF file (not DOM) */
  isPdf?: boolean;
  /** True when the PDF is detected as an academic research paper */
  isPaper?: boolean;
}

export interface ProviderConfig {
  id: string;
  label: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  extraHeaders: Record<string, string>;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  enabled: boolean;
}

export interface AIRuntimeConfig {
  chat: { providerId: string; modeModels: { FAST: string; BALANCED: string; DEEP: string } };
  embedding: { providerId: string; model: string; dimensions: number; version: number };
}

export interface Settings {
  runtime: AIRuntimeConfig;
  defaults: { tags: string[] };
  // PRIV-3: when true, all work stays on-device — no network calls ever.
  localOnly?: boolean;
  // When true, PlantUML diagrams are rendered by sending their source to the
  // public plantuml.com service. Off by default (local-first); always
  // suppressed when localOnly is set.
  allowRemotePlantUml?: boolean;
  // Backward-compat fields
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
  modelId?: string;
  defaultMode?: GenerationMode;
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  fontFamily: 'mono' | 'serif' | 'sans';
  fontSize: 'sm' | 'md' | 'lg';
  accentColor: string;
}

export interface TestResult {
  success: boolean;
  latencyMs: number;
  model?: string;
  dimensions?: number;
  error?: string;
}

export interface ChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
}

export interface ChatChunk {
  type: 'text' | 'done' | 'error';
  text?: string;
  error?: string;
}

export interface ChatProvider {
  readonly id: string;
  readonly capabilities: { streaming: boolean; maxContextTokens: number };
  generate(req: ChatRequest): AsyncIterable<ChatChunk>;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface ProviderAdapter {
  protocol: ProviderProtocol;
  createChatProvider(cfg: ProviderConfig): ChatProvider;
  createEmbeddingProvider(cfg: ProviderConfig): EmbeddingProvider;
  testConnection(cfg: ProviderConfig): Promise<TestResult>;
}

export interface ContentFrame {
  index: number;
  total: number;
}

export type Folder = { id: string; name: string; color: string; createdAt: string };
export type TagColorMap = Record<string, string>;
export type DocumentMeta = {
  id: string;
  title: string;
  url: string;
  domain: string;
  capturedAt: string;
  wordCount: number;
  summary: string;
  tags: string[];
  folder?: string;
  isStarred: boolean;
  isArchived: boolean;
  isRead: boolean;
  mode: GenerationMode;
  provider: string;
  // Knowledge intelligence fields (surfaced from Content Intelligence Engine)
  entityCount?: number;
  conceptCount?: number;
  hasTimeline?: boolean;
  diagramCount?: number;
  imageCount?: number;
  readingTimeMinutes?: number;
  documentType?: string;
  qualityScore?: number;
  topEntities?: string[];
  topConcepts?: string[];
};
export type DocumentHighlight = {
  id: string;
  documentId: string;
  text: string;
  paragraphIndex: number;
  paragraphId?: string;
  createdAt: string;
};

export type RuntimeMessage =
  | {
      type: 'CAPTURE_PAGE';
      payload: { mode: GenerationMode; tags: string[]; tabId?: number; url?: string };
    }
  | {
      type: 'CAPTURE_SELECTION';
      payload: {
        mode: GenerationMode;
        tags: string[];
        tabId?: number;
        url?: string;
        selectionText: string;
      };
    }
  | { type: 'CAPTURE_PROGRESS'; payload: { step: string; pct: number } }
  | { type: 'CAPTURE_COMPLETE'; payload: { documentId: string } }
  | { type: 'CAPTURE_ERROR'; payload: { error: string } }
  | { type: 'PAYWALL_DETECTED'; payload: { signal: string; url: string } }
  | {
      type: 'RAG_QUERY';
      payload: { documentId: string; query: string; readingLevel?: ReadingLevel };
    }
  | { type: 'RAG_RESPONSE'; payload: { answer: string; citations: Citation[] } }
  | { type: 'RAG_CHUNK'; payload: { chunk: string; documentId: string } }
  | { type: 'RAG_ERROR'; payload: { error: string } }
  | { type: 'GENERATE_EMBEDDINGS'; payload: { documentId: string } }
  | { type: 'IMPORT_PDF'; payload: { fileName: string; bytes: number[]; tags: string[] } }
  | { type: 'TRANSLATE'; payload: { text: string; targetLanguage: string } }
  | { type: 'TRANSLATE_RESULT'; payload: { translated: string } }
  | { type: 'TRANSLATE_ERROR'; payload: { error: string } }
  | { type: 'EXTRACT_DOM'; payload: Record<string, never> }
  | { type: 'DOM_PAYLOAD'; payload: DOMExtraction }
  | { type: 'STORAGE_QUOTA_WARNING'; payload: { usedBytes: number; quotaBytes: number } }
  | { type: 'TEST_CONNECTION'; payload: { providerId: string } }
  | { type: 'TEST_CONNECTION_RESULT'; payload: { providerId: string; result: TestResult } }
  | { type: 'RE_EMBED_ALL'; payload: { providerId: string; model: string } }
  | { type: 'RE_EMBED_PROGRESS'; payload: { done: number; total: number } };
