/**
 * Notch Document Language (NDL) — AST Type Definitions
 *
 * This file defines the complete type system for the NDL AST.
 * Every node in the document tree has a typed interface with
 * validation, transformation, and rendering contracts.
 */

import type { ReactNode } from 'react';

/* ── Source Position ──────────────────────────────────────────────────── */

export interface SourcePosition {
  startLine: number;
  endLine: number;
  startCol?: number;
  endCol?: number;
}

/* ── Base Node ────────────────────────────────────────────────────────── */

export interface BaseNode {
  type: string;
  id?: string;
  position?: SourcePosition;
  meta?: Record<string, unknown>;
}

/* ── Document ─────────────────────────────────────────────────────────── */

export interface DocumentAST {
  title: string;
  metadata: DocumentMetadata;
  nodes: ASTNode[];
  hierarchy: ContentHierarchy;
  warnings: string[];
}

export interface DocumentMetadata {
  sourceUrl?: string;
  sourceDomain?: string;
  wordCount: number;
  readingTimeMinutes: number;
  documentClass?: string;
  capturedAt?: string;
  tags?: string[];
  complexity?: number;
  qualityScore?: number;
}

export interface ContentHierarchy {
  toc: HeadingNode[];
  figures: NumberedItem[];
  tables: NumberedItem[];
  diagrams: NumberedItem[];
  codeBlocks: NumberedItem[];
}

export interface NumberedItem {
  type: 'figure' | 'table' | 'diagram' | 'code';
  number: number;
  caption: string;
  sectionIndex: number;
  id: string;
}

/* ── Heading ──────────────────────────────────────────────────────────── */

export interface HeadingNode extends BaseNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  number?: string;
  children: HeadingNode[];
}

/* ── Paragraph ────────────────────────────────────────────────────────── */

export interface ParagraphNode extends BaseNode {
  type: 'paragraph';
  html: string;
  raw: string;
}

/* ── List ─────────────────────────────────────────────────────────────── */

export interface ListItem {
  content: string;
  checked?: boolean;
  children?: ASTNode[];
}

export interface ListNode extends BaseNode {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
  start?: number;
}

/* ── Code Block ───────────────────────────────────────────────────────── */

export type CodeLanguage =
  | 'typescript'
  | 'tsx'
  | 'javascript'
  | 'jsx'
  | 'python'
  | 'rust'
  | 'go'
  | 'ruby'
  | 'java'
  | 'kotlin'
  | 'swift'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'php'
  | 'html'
  | 'css'
  | 'scss'
  | 'sql'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'xml'
  | 'markdown'
  | 'bash'
  | 'dockerfile'
  | 'graphql'
  | 'diff'
  | 'mermaid'
  | 'plantuml'
  | 'text';

export interface CodeNode extends BaseNode {
  type: 'code';
  language: CodeLanguage;
  content: string;
  filename?: string;
  highlightLines?: number[];
  showLineNumbers: boolean;
  diff?: boolean;
}

/* ── Diagram ──────────────────────────────────────────────────────────── */

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
  | 'quadrantChart'
  | 'zenuml'
  | 'architecture'
  | 'plantuml';

export type DiagramEngine = 'mermaid' | 'plantuml' | 'ascii';

export interface DiagramNode extends BaseNode {
  type: 'diagram';
  engine: DiagramEngine;
  kind: DiagramKind;
  content: string;
  caption?: string;
  label?: string;
}

/* ── Callout ──────────────────────────────────────────────────────────── */

export type CalloutKind =
  'note' | 'tip' | 'warning' | 'danger' | 'info' | 'important' | 'caution' | 'success' | 'question';

export interface CalloutNode extends BaseNode {
  type: 'callout';
  kind: CalloutKind;
  title?: string;
  html: string;
}

/* ── Table ────────────────────────────────────────────────────────────── */

export interface ColumnDef {
  header: string;
  align: 'left' | 'center' | 'right';
}

export interface TableNode extends BaseNode {
  type: 'table';
  columns: ColumnDef[];
  rows: string[][];
  caption?: string;
  sortable?: boolean;
}

/* ── Image ────────────────────────────────────────────────────────────── */

export interface ImageNode extends BaseNode {
  type: 'image';
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

/* ── Video / Audio / Embed ────────────────────────────────────────────── */

export type EmbedProvider = 'youtube' | 'vimeo' | 'html5' | 'audio' | 'pdf' | 'iframe';

export interface VideoNode extends BaseNode {
  type: 'video';
  provider: EmbedProvider;
  url: string;
  title?: string;
  caption?: string;
  posterUrl?: string;
  duration?: number;
}

/* ── Equation (KaTeX) ─────────────────────────────────────────────────── */

export interface EquationNode extends BaseNode {
  type: 'equation';
  content: string;
  displayMode: boolean;
}

/* ── Blockquote ───────────────────────────────────────────────────────── */

export interface BlockquoteNode extends BaseNode {
  type: 'blockquote';
  html: string;
  citation?: string;
}

/* ── Reference / Definition ───────────────────────────────────────────── */

export interface ReferenceItem {
  id: string;
  text: string;
  url?: string;
}

export interface ReferenceNode extends BaseNode {
  type: 'reference';
  items: ReferenceItem[];
}

export interface DefinitionNode extends BaseNode {
  type: 'definition';
  term: string;
  definition: string;
}

/* ── Thematic Break ───────────────────────────────────────────────────── */

export interface ThematicBreakNode extends BaseNode {
  type: 'thematic_break';
}

/* ── Semantic Blocks ──────────────────────────────────────────────────── */

export type SemanticBlockKind =
  | 'architecture'
  | 'performance'
  | 'security'
  | 'api'
  | 'example'
  | 'history'
  | 'future-work'
  | 'timeline'
  | 'definition';

export interface SemanticBlockNode extends BaseNode {
  type: 'semantic';
  kind: SemanticBlockKind;
  title?: string;
  html: string;
}

/* ── Terminal Session ─────────────────────────────────────────────────── */

export interface TerminalLine {
  prompt?: string;
  input?: string;
  output?: string;
}

export interface TerminalNode extends BaseNode {
  type: 'terminal';
  lines: TerminalLine[];
  sessionName?: string;
}

/* ── File Tree ────────────────────────────────────────────────────────── */

export interface FileTreeEntry {
  name: string;
  type: 'file' | 'directory';
  children?: FileTreeEntry[];
}

export interface FileTreeNode extends BaseNode {
  type: 'file_tree';
  entries: FileTreeEntry[];
  rootLabel?: string;
}

/* ── Accordion / Tabs ─────────────────────────────────────────────────── */

export interface AccordionPanel {
  title: string;
  content: string;
}

export interface AccordionNode extends BaseNode {
  type: 'accordion';
  panels: AccordionPanel[];
}

/* ── API Block ────────────────────────────────────────────────────────── */

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  path: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
}

export interface ApiNode extends BaseNode {
  type: 'api';
  endpoints: ApiEndpoint[];
}

/* ── Union Type ───────────────────────────────────────────────────────── */

export type ASTNode =
  | HeadingNode
  | ParagraphNode
  | ListNode
  | CodeNode
  | DiagramNode
  | CalloutNode
  | TableNode
  | ImageNode
  | VideoNode
  | EquationNode
  | BlockquoteNode
  | ReferenceNode
  | DefinitionNode
  | ThematicBreakNode
  | SemanticBlockNode
  | TerminalNode
  | FileTreeNode
  | AccordionNode
  | ApiNode;

/* ── Validation ───────────────────────────────────────────────────────── */

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationEntry[];
  warnings: ValidationEntry[];
}

export interface ValidationEntry {
  nodeId?: string;
  rule: string;
  message: string;
  severity: ValidationSeverity;
  position?: SourcePosition;
}

/* ── Renderer Contract ────────────────────────────────────────────────── */

export interface NodeRenderer<T extends ASTNode = ASTNode> {
  node: T;
  children?: ReactNode;
  theme: 'light' | 'dark';
}
