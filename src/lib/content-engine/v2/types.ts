// ── V2 Content Intelligence Engine — Core Types ──────────────────────────────

export type DepthMode = 'fast' | 'standard' | 'deep';

export interface DepthConfig {
  minWords: number;
  maxWords: number;
  maxDiagrams: number;
  maxImages: number;
  diagramMultiplier: number;
  imageMultiplier: number;
  maxTables: number;
  maxCallouts: number;
  includeCodeExamples: boolean;
  includeCaseStudies: boolean;
  includeReferences: boolean;
  includeUML: boolean;
  chunkSize: number;
  chunkOverlap: number;
  maxFrames: number;
  passes: GenerationPass[];
}

export type GenerationPass =
  | 'structure'
  | 'content'
  | 'visuals'
  | 'examples'
  | 'references'
  | 'merge';

export const DEPTH_CONFIGS: Record<DepthMode, DepthConfig> = {
  fast: {
    minWords: 300,
    maxWords: 1200,
    maxDiagrams: 2,
    maxImages: 2,
    diagramMultiplier: 1,
    imageMultiplier: 1,
    maxTables: 2,
    maxCallouts: 2,
    includeCodeExamples: false,
    includeCaseStudies: false,
    includeReferences: false,
    includeUML: false,
    chunkSize: 1024,
    chunkOverlap: 64,
    maxFrames: 5,
    passes: ['structure', 'content', 'merge'],
  },
  standard: {
    minWords: 1000,
    maxWords: 2500,
    maxDiagrams: 5,
    maxImages: 4,
    diagramMultiplier: 2,
    imageMultiplier: 2,
    maxTables: 5,
    maxCallouts: 5,
    includeCodeExamples: true,
    includeCaseStudies: false,
    includeReferences: true,
    includeUML: false,
    chunkSize: 2048,
    chunkOverlap: 128,
    maxFrames: 15,
    passes: ['structure', 'content', 'visuals', 'examples', 'merge'],
  },
  deep: {
    minWords: 3000,
    maxWords: 10000,
    maxDiagrams: 20,
    maxImages: 15,
    diagramMultiplier: 5,
    imageMultiplier: 5,
    maxTables: 15,
    maxCallouts: 10,
    includeCodeExamples: true,
    includeCaseStudies: true,
    includeReferences: true,
    includeUML: true,
    chunkSize: 4096,
    chunkOverlap: 256,
    maxFrames: 50,
    passes: ['structure', 'content', 'visuals', 'examples', 'references', 'merge'],
  },
};

// ── Frame System ─────────────────────────────────────────────────────────────

export interface ContentFrame {
  id: string;
  index: number;
  title: string;
  topic: string;
  context: string;
  sourceText: string;
  relationships: string[];
  metadata: FrameMetadata;
  qualityScore?: FrameQualityScore;
  status: FrameStatus;
  regenerateCount: number;
  subFrames: ContentFrame[];
}

export interface FrameMetadata {
  wordCount: number;
  sectionIndex: number;
  hasCode: boolean;
  hasDiagrams: boolean;
  hasTables: boolean;
  hasLists: boolean;
  entities: string[];
  keyTerms: string[];
  importance: number;
}

export type FrameStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'regenerating';

export interface FrameQualityScore {
  content: number;
  visual: number;
  educational: number;
  technical: number;
  overall: number;
  issues: string[];
}

export const FRAME_QUALITY_THRESHOLD = 0.65;

// ── Chunking ─────────────────────────────────────────────────────────────────

export type ChunkStrategy = 'query' | 'semantic' | 'full';

export interface ChunkResult {
  chunks: TextChunk[];
  strategy: ChunkStrategy;
  totalTokens: number;
}

export interface TextChunk {
  id: string;
  text: string;
  index: number;
  heading: string;
  wordCount: number;
  score?: number;
}

// ── Diagram Planning ─────────────────────────────────────────────────────────

export interface PlannedDiagram {
  id: string;
  type: DiagramPlanType;
  reason: string;
  sectionRef: string;
  mermaidTemplate: string;
  plantumlFallback: string;
  priority: number;
}

export type DiagramPlanType =
  | 'architecture'
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'er'
  | 'mindmap'
  | 'timeline'
  | 'gantt'
  | 'component'
  | 'deployment'
  | 'state'
  | 'journey'
  | 'pie'
  | 'gitgraph';

export interface DiagramPlanResult {
  diagrams: PlannedDiagram[];
  totalNeeded: number;
  totalPossible: number;
}

// ── Image Planning ───────────────────────────────────────────────────────────

export interface PlannedImage {
  id: string;
  kind: ImagePlanKind;
  prompt: string;
  sectionRef: string;
  caption: string;
  altText: string;
  priority: number;
}

export type ImagePlanKind =
  | 'concept'
  | 'architecture'
  | 'infographic'
  | 'workflow'
  | 'technical'
  | 'screenshot'
  | 'chart';

// ── Multi-Pass State ─────────────────────────────────────────────────────────

export interface PassState {
  currentPass: GenerationPass;
  passIndex: number;
  totalPasses: number;
  progress: number;
  completed: string[];
}

export interface PassResult {
  pass: GenerationPass;
  success: boolean;
  output: string;
  warnings: string[];
  errors: string[];
}

// ── Stitching ─────────────────────────────────────────────────────────────────

export interface StitchedDocument {
  frames: ContentFrame[];
  mergedMarkdown: string;
  diagramCount: number;
  imageCount: number;
  tableCount: number;
  wordCount: number;
  tocEntries: TOCEntry[];
}

export interface TOCEntry {
  level: number;
  title: string;
  number: string;
  frameIndex: number;
}

// ── Rendering Validation ─────────────────────────────────────────────────────

export interface RenderValidationResult {
  valid: boolean;
  brokenImages: ValidationIssue[];
  brokenDiagrams: ValidationIssue[];
  invalidReferences: ValidationIssue[];
  emptySections: ValidationIssue[];
  warnings: string[];
}

export interface ValidationIssue {
  type: string;
  location: string;
  description: string;
  severity: 'error' | 'warning';
  fixSuggestion: string;
}

// ── Export ────────────────────────────────────────────────────────────────────

export interface V2ExportOptions {
  depthMode: DepthMode;
  includeToc: boolean;
  includePageNumbers: boolean;
  includeFootnotes: boolean;
  dpi: number;
  pageSize: 'a4' | 'letter';
  theme: 'light' | 'dark';
  validateBeforeExport: boolean;
}
