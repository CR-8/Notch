/**
 * document-system — Notch Document Generation Subsystem
 *
 * This module is the canonical home for all document generation
 * logic. It provides a complete pipeline: prompt → markdown →
 * NDL AST → validation → transformation → rendering → export.
 *
 * The system is model-agnostic: AI models only generate standard
 * markdown; all presentation and metadata is derived from the AST.
 */

/* ── Schemas ──────────────────────────────────────────────────────────── */

export type {
  ASTNode,
  DocumentAST,
  DocumentMetadata,
  ContentHierarchy,
  HeadingNode,
  ParagraphNode,
  ListNode,
  ListItem,
  CodeNode,
  CodeLanguage,
  DiagramNode,
  DiagramKind,
  DiagramEngine,
  CalloutNode,
  CalloutKind,
  TableNode,
  ColumnDef,
  ImageNode,
  VideoNode,
  EmbedProvider,
  EquationNode,
  BlockquoteNode,
  ReferenceNode,
  ReferenceItem,
  DefinitionNode,
  ThematicBreakNode,
  SemanticBlockNode,
  SemanticBlockKind,
  TerminalNode,
  TerminalLine,
  FileTreeNode,
  FileTreeEntry,
  AccordionNode,
  AccordionPanel,
  ApiNode,
  ApiEndpoint,
  ValidationResult,
  ValidationEntry,
  ValidationSeverity,
  NodeRenderer,
  SourcePosition,
  BaseNode,
  NumberedItem,
} from './schemas';

/* ── Parser ───────────────────────────────────────────────────────────── */

export { parseDocument, extractTOCNodes, flattenHeadingIds } from './parser';

/* ── Validator ────────────────────────────────────────────────────────── */

export { validate, validateSingle } from './validator';
export type { ValidationOptions } from './validator';

/* ── Transformers ─────────────────────────────────────────────────────── */

export { transform, slugify, generateNodeId } from './transformers';
export type { TransformOptions } from './transformers';

/* ── Prompt Builder ───────────────────────────────────────────────────── */

export { buildPrompt } from './prompt';
export type { PromptBuilderOptions } from './prompt';
export { buildStructurePrompt } from './prompt/modules/structure';
export type { DocumentClass } from './prompt/modules/structure';

/* ── Renderer ─────────────────────────────────────────────────────────── */

export { DocumentRenderer } from './renderer';
export type { DocumentRendererProps } from './renderer';

/* ── Exporters ────────────────────────────────────────────────────────── */

export { exportToMarkdown } from './exporters/markdown';
export { exportToPrintHTML, exportToHTML, exportToMarkdownOnly } from './exporters/pdf';
export type { MarkdownExportOptions } from './exporters/markdown';
export type { PDFExportOptions } from './exporters/pdf';

/* ── Semantic Layer (empty for now) ───────────────────────────────────── */
