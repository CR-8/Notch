export type GenerationMode = 'FAST' | 'BALANCED' | 'DEEP';
export type ViewMode = 'compact' | 'comfortable' | 'detailed';
export type ReadingLevel = 'simple' | 'technical';
export type ProviderProtocol = 'openai' | 'anthropic' | 'gemini';
export type CaptureStatus = 'captured' | 'structuring' | 'chunked' | 'embedding' | 'ready' | 'failed';

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
  status: CaptureStatus;
  starred: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  // Backward-compat fields
  content?: string;
  keyEntities?: Entity[];
  folder?: string;
  embeddingsGenerated?: boolean;
  // Content Intelligence Engine fields
  enrichedContent?: string;
  semanticAnalysis?: string; // JSON string of SemanticAnalysis
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
  pageBreakPrefs?: string;
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
  wordCount: number;
  metaDescription: string;
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

export interface ModeModels {
  FAST: string;
  BALANCED: string;
  DEEP: string;
}

export interface AIRuntimeConfig {
  chat: { providerId: string; modeModels: ModeModels };
  embedding: { providerId: string; model: string; dimensions: number; version: number };
}

export interface Settings {
  runtime: AIRuntimeConfig;
  defaults: { tags: string[] };
  // PRIV-3: when true, all work stays on-device — no network calls ever.
  localOnly?: boolean;
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

// ── Backward-compat aliases ──────────────────────────────────────────────────
export type LLMProvider = string; // replaced by provider abstraction
export type AIModel = { id: string; name: string; contextWindow: number };
export const SUPPORTED_MODELS: AIModel[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000 },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000 },
  { id: 'openai/gpt-4o', name: 'GPT-4o (OpenRouter)', contextWindow: 128000 },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', contextWindow: 200000 },
  { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (OpenRouter)', contextWindow: 1000000 },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Free (OpenRouter)', contextWindow: 1000000 },
  { id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek V3 (OpenRouter)', contextWindow: 64000 },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B (OpenRouter)', contextWindow: 32000 },
  { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', contextWindow: 1000000 },
  { id: 'local/custom', name: 'Custom Endpoint', contextWindow: 0 },
];
export type Folder = { id: string; name: string; color: string; createdAt: string };
export type TagColorMap = Record<string, string>;
export type DocumentMeta = {
  id: string; title: string; url: string; domain: string; capturedAt: string;
  wordCount: number; summary: string; tags: string[]; folder?: string;
  isStarred: boolean; isArchived: boolean; isRead: boolean; mode: GenerationMode; provider: string;
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
  id: string; documentId: string; text: string; paragraphIndex: number;
  paragraphId?: string; createdAt: string;
};

export type RuntimeMessage =
  | { type: 'CAPTURE_PAGE'; payload: { mode: GenerationMode; tags: string[]; tabId?: number; url?: string } }
  | { type: 'CAPTURE_PROGRESS'; payload: { step: string; pct: number } }
  | { type: 'CAPTURE_COMPLETE'; payload: { documentId: string } }
  | { type: 'CAPTURE_ERROR'; payload: { error: string } }
  | { type: 'RAG_QUERY'; payload: { documentId: string; query: string; readingLevel?: ReadingLevel } }
  | { type: 'RAG_RESPONSE'; payload: { answer: string; citations: Citation[] } }
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
  | { type: 'RE_EMBED_PROGRESS'; payload: { done: number; total: number } }
  // Content Intelligence Engine message types
  | { type: 'ENRICH_DOCUMENT'; payload: { documentId: string; mode: 'FAST' | 'BALANCED' | 'DEEP' } }
  | { type: 'ENRICH_COMPLETE'; payload: { documentId: string; enriched: boolean; diagramCount: number; calloutCount: number } }
  | { type: 'ENRICH_ERROR'; payload: { error: string } }
  | { type: 'EXPORT_ENHANCED_PDF'; payload: { documentId: string; options: { title: string; includeToc: boolean; includePageNumbers: boolean } } }
  | { type: 'EXPORT_ENHANCED_PROGRESS'; payload: { step: string; pct: number } }
  | { type: 'EXPORT_ENHANCED_COMPLETE'; payload: { pdfBytes: number[] } }
  | { type: 'EXPORT_ENHANCED_ERROR'; payload: { error: string } };
