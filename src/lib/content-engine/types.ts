// ── Content Intelligence Engine — Core Types ──────────────────────────────────

export type DiagramKind =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram'
  | 'erDiagram'
  | 'journey'
  | 'gantt'
  | 'pie'
  | 'mindmap'
  | 'timeline'
  | 'gitGraph'
  | 'architecture'
  | 'plantuml';

export type UMLKind =
  | 'class'
  | 'sequence'
  | 'activity'
  | 'usecase'
  | 'component'
  | 'deployment';

export type ImageKind =
  | 'concept_illustration'
  | 'technical_illustration'
  | 'architecture_visualization'
  | 'infographic'
  | 'workflow_image'
  | 'chart_image'
  | 'screenshot'
  | 'generic';

export type VisualElement = DiagramElement | ImageElement;

export interface DiagramElement {
  type: 'diagram';
  kind: DiagramKind;
  label: string;
  content: string;
  caption: string;
  altText: string;
  placement: number;
  id: string;
}

export interface ImageElement {
  type: 'image';
  kind: ImageKind;
  prompt: string;
  caption: string;
  altText: string;
  placement: number;
  id: string;
  url?: string;
}

export interface VideoElement {
  type: 'video';
  url: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  duration?: number;
  chapterMarkers?: ChapterMarker[];
  placement: number;
  id: string;
}

export interface ChapterMarker {
  time: number;
  title: string;
}

export type CalloutKind = 'note' | 'warning' | 'tip' | 'danger' | 'info';

export interface CalloutElement {
  type: 'callout';
  kind: CalloutKind;
  content: string;
  title?: string;
}

export interface CodeBlockElement {
  type: 'code';
  language: string;
  content: string;
  showLineNumbers: boolean;
  caption?: string;
}

export interface RichTableColumn {
  header: string;
  align: 'left' | 'center' | 'right';
  width?: string;
}

export interface RichTableElement {
  type: 'table';
  columns: RichTableColumn[];
  rows: string[][];
  caption?: string;
  sortable: boolean;
  filterable: boolean;
}

export interface ReferenceElement {
  type: 'reference';
  kind: 'citation' | 'footnote' | 'crossref';
  label: string;
  target: string;
  text: string;
}

// ── Semantic Analysis ─────────────────────────────────────────────────────────

export interface SemanticTopic {
  name: string;
  importance: number;
  sections: number[];
}

export interface SemanticRelationship {
  source: string;
  target: string;
  type: string;
  description: string;
}

export interface SemanticSystem {
  name: string;
  components: string[];
  interactions: string[];
  architecture: string;
}

export interface SemanticProcess {
  name: string;
  steps: string[];
  decisionPoints: string[];
  actors: string[];
}

export interface SemanticAnalysis {
  topics: SemanticTopic[];
  concepts: string[];
  entities: string[];
  relationships: SemanticRelationship[];
  systems: SemanticSystem[];
  processes: SemanticProcess[];
  architectures: string[];
  timelines: string[];
  dependencies: string[];
}

// ── Quality Evaluation ────────────────────────────────────────────────────────

export type QualitySeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export interface QualityIssue {
  type: string;
  severity: QualitySeverity;
  section: number;
  message: string;
  suggestion: string;
}

export interface VisualOpportunity {
  type: 'diagram' | 'image' | 'chart' | 'table';
  reason: string;
  sectionIndex: number;
  context: string;
  recommendedKind: DiagramKind | ImageKind | 'comparison_table' | 'chart';
  label: string;
}

export interface EducationGap {
  sectionIndex: number;
  concept: string;
  suggestion: string;
}

export interface QualityEvaluation {
  score: number;
  issues: QualityIssue[];
  visualOpportunities: VisualOpportunity[];
  educationGaps: EducationGap[];
  completenessScore: number;
  readabilityScore: number;
  structuralScore: number;
  visualScore: number;
}

// ── Content Hierarchy ─────────────────────────────────────────────────────────

export interface HeadingNode {
  level: number;
  text: string;
  number: string;
  id: string;
  children: HeadingNode[];
  pageBreak?: boolean;
}

export interface NumberedItem {
  type: 'figure' | 'table' | 'diagram' | 'code';
  number: number;
  caption: string;
  sectionIndex: number;
  id: string;
}

export interface ContentHierarchy {
  toc: HeadingNode[];
  figures: NumberedItem[];
  tables: NumberedItem[];
  diagrams: NumberedItem[];
  codeBlocks: NumberedItem[];
}

// ── Enriched Document ─────────────────────────────────────────────────────────

export interface EnrichedBlock {
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'table' | 'blockquote'
    | 'diagram' | 'image' | 'video' | 'callout' | 'rich_table' | 'reference';
  raw: string;
  level?: number;
  number?: string;
  id?: string;
  children?: EnrichedBlock[];
  data?: DiagramElement | ImageElement | VideoElement | CalloutElement
    | CodeBlockElement | RichTableElement | ReferenceElement;
}

export interface EnrichedDocument {
  original: string;
  blocks: EnrichedBlock[];
  hierarchy: ContentHierarchy;
  semanticAnalysis: SemanticAnalysis;
  qualityEvaluation: QualityEvaluation;
}

// ── Visual Plan ───────────────────────────────────────────────────────────────

export interface VisualPlan {
  diagrams: DiagramElement[];
  images: ImageElement[];
  videos: VideoElement[];
  callouts: CalloutElement[];
  richTables: RichTableElement[];
  references: ReferenceElement[];
}

// ── Export ────────────────────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'html' | 'markdown';

export interface ExportOptions {
  format: ExportFormat;
  includeToc: boolean;
  includeNumbering: boolean;
  includeCaptions: boolean;
  includeDiagrams: boolean;
  includeImages: boolean;
  pageSize: 'a4' | 'letter';
  dpi: number;
  theme: 'light' | 'dark';
  pageNumbers: boolean;
  headers: boolean;
  footers: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'pdf',
  includeToc: true,
  includeNumbering: true,
  includeCaptions: true,
  includeDiagrams: true,
  includeImages: true,
  pageSize: 'a4',
  dpi: 300,
  theme: 'light',
  pageNumbers: true,
  headers: true,
  footers: true,
};

// ── Pipeline Messages ─────────────────────────────────────────────────────────

export interface GenerateDocumentRequest {
  documentId: string;
  mode: 'FAST' | 'BALANCED' | 'DEEP';
}

export interface GenerateDocumentProgress {
  stage: string;
  pct: number;
}

export interface GenerateDocumentResult {
  documentId: string;
  enriched: EnrichedDocument;
}
