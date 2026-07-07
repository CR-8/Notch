/**
 * NDL Transformers — Post-parse node transformations
 *
 * Normalizes language identifiers, enriches block metadata,
 * sets auto-generated IDs on all nodes, and inlines math
 * rendering data.
 */

import {
  type ASTNode,
  type DocumentAST,
  type DocumentMetadata,
  type CodeLanguage,
  type ContentHierarchy,
} from '../schemas';
import { validateSingle } from '../validator';

/* ── Pipeline ─────────────────────────────────────────────────────────── */

export interface TransformOptions {
  numberHeadings: boolean;
  generateIds: boolean;
  normalizeLanguages: boolean;
  detectDiagrams: boolean;
  enrichMetadata: boolean;
}

const DEFAULT_OPTIONS: TransformOptions = {
  numberHeadings: true,
  generateIds: true,
  normalizeLanguages: true,
  detectDiagrams: true,
  enrichMetadata: true,
};

export function transform(doc: DocumentAST, options: Partial<TransformOptions> = {}): DocumentAST {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let nodes = [...doc.nodes];

  if (opts.normalizeLanguages) {
    nodes = nodes.map(normalizeCodeLanguage);
  }

  if (opts.generateIds) {
    nodes = nodes.map((n, i) => assignId(n, i));
  }

  if (opts.detectDiagrams) {
    nodes = inlineDiagramDetection(nodes);
  }

  const warnings: string[] = [];
  for (const n of nodes) {
    const v = validateSingle(n);
    if (v) warnings.push(v.message);
  }

  const metadata = opts.enrichMetadata ? enrichDocumentMetadata(nodes, doc.metadata) : doc.metadata;

  return {
    ...doc,
    nodes,
    metadata,
    warnings: [...doc.warnings, ...warnings],
  };
}

/* ── Language Normalization ───────────────────────────────────────────── */

const LANGUAGE_ALIASES: Record<string, CodeLanguage> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  kt: 'kotlin',
  rs: 'rust',
  cpp: 'cpp',
  'c++': 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  'c#': 'csharp',
  fs: 'fsharp',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  lua: 'lua',
  r: 'r',
  scala: 'scala',
  groovy: 'groovy',
  pl: 'perl',
  pm: 'perl',
  swift: 'swift',
  dart: 'dart',
  clj: 'clojure',
  coffee: 'coffeescript',
  tf: 'terraform',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

function normalizeCodeLanguage(node: ASTNode): ASTNode {
  if (node.type !== 'code') return node;
  const code = node as any;
  if (!code.language) {
    code.language = 'text';
    return code;
  }
  const alias = LANGUAGE_ALIASES[code.language.toLowerCase()];
  if (alias) {
    code.language = alias;
  }
  return code;
}

/* ── ID Generation ────────────────────────────────────────────────────── */

const ID_PREFIXES: Record<string, string> = {
  heading: 'h',
  paragraph: 'p',
  list: 'l',
  code: 'code',
  diagram: 'dgm',
  callout: 'callout',
  table: 'tbl',
  image: 'fig',
  video: 'vid',
  equation: 'eq',
  blockquote: 'bq',
  reference: 'ref',
  definition: 'def',
  thematic_break: 'hr',
  semantic: 'sem',
  terminal: 'term',
  file_tree: 'tree',
  accordion: 'acc',
  api: 'api',
};

function assignId(node: ASTNode, index: number): ASTNode {
  if (node.id) return node;
  const prefix = ID_PREFIXES[node.type] ?? 'node';
  const text = extractText(node)
    .slice(0, 32)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  node.id = text ? `${prefix}-${text}` : `${prefix}-${index}`;
  return node;
}

function extractText(node: ASTNode): string {
  const n = node as any;
  return n.text || n.alt || n.content?.slice(0, 64) || n.html?.slice(0, 64) || '';
}

/* ── Inline Diagram Detection ─────────────────────────────────────────── */

function inlineDiagramDetection(nodes: ASTNode[]): ASTNode[] {
  const result: ASTNode[] = [];
  for (const node of nodes) {
    if (node.type !== 'callout' && node.type !== 'paragraph') {
      result.push(node);
      continue;
    }

    const html = (node as any).html ?? '';
    if (!html.trim()) {
      result.push(node);
      continue;
    }

    const lines = html.split('\n');
    const diagramLineIdx = lines.findIndex((l: string) =>
      /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)/.test(
        l.trim(),
      ),
    );

    if (diagramLineIdx === -1) {
      result.push(node);
      continue;
    }

    let diagEnd = diagramLineIdx + 1;
    while (diagEnd < lines.length && (lines[diagEnd][0] === ' ' || lines[diagEnd][0] === '\t')) {
      diagEnd++;
    }

    const codeContent = lines.slice(diagramLineIdx, diagEnd).join('\n');
    const remaining = lines.slice(diagEnd).join('\n').trim();

    result.push({
      type: 'diagram',
      engine: 'mermaid',
      kind: detectDiagramKind(codeContent),
      content: codeContent,
    } as any);

    if (remaining) {
      result.push({ ...node, html: remaining });
    }
  }
  return result;
}

function detectDiagramKind(code: string): any {
  const firstLine = code.trim().split('\n')[0] ?? '';
  const word = firstLine.replace(/[\s].*$/, '').toLowerCase();
  const map: Record<string, string> = {
    graph: 'flowchart',
    flowchart: 'flowchart',
    sequencediagram: 'sequenceDiagram',
    classdiagram: 'classDiagram',
    statediagram: 'stateDiagram',
    erdiagram: 'erDiagram',
    journey: 'journey',
    gantt: 'gantt',
    pie: 'pie',
    mindmap: 'mindmap',
    timeline: 'timeline',
    gitgraph: 'gitGraph',
    quadrantchart: 'quadrantChart',
    zenuml: 'zenuml',
    architecture: 'architecture',
  };
  return map[word] ?? 'flowchart';
}

/* ── Metadata Enrichment ──────────────────────────────────────────────── */

function enrichDocumentMetadata(nodes: ASTNode[], existing: DocumentMetadata): DocumentMetadata {
  let codeBlockCount = 0;
  let diagramCount = 0;
  let imageCount = 0;
  let tableCount = 0;
  let calloutCount = 0;
  const totalWords = existing.wordCount;

  for (const n of nodes) {
    switch (n.type) {
      case 'code':
        codeBlockCount++;
        break;
      case 'diagram':
        diagramCount++;
        break;
      case 'image':
        imageCount++;
        break;
      case 'table':
        tableCount++;
        break;
      case 'callout':
        calloutCount++;
        break;
    }
  }

  const complexity = calculateComplexity(nodes);

  return {
    ...existing,
    wordCount: totalWords,
    readingTimeMinutes: Math.max(1, Math.round(totalWords / 220)),
    tags: deriveTags(existing),
    complexity,
    qualityScore: calculateQualityScore(nodes),
  };
}

function calculateComplexity(nodes: ASTNode[]): number {
  const weights = {
    code: 3,
    diagram: 4,
    table: 2,
    callout: 1,
    equation: 5,
    semantic: 3,
    api: 4,
    terminal: 2,
  };
  let score = 1;
  for (const n of nodes) {
    const w = (weights as any)[n.type] ?? 1;
    score += w;
  }
  return Math.min(10, Math.round(score / 3));
}

function calculateQualityScore(nodes: ASTNode[]): number {
  let score = 7;
  const hasCode = nodes.some((n) => n.type === 'code');
  const hasDiagram = nodes.some((n) => n.type === 'diagram');
  const hasTable = nodes.some((n) => n.type === 'table');
  const hasCallout = nodes.some((n) => n.type === 'callout');
  const hasImage = nodes.some((n) => n.type === 'image');

  if (hasCode) score += 0.5;
  if (hasDiagram) score += 0.5;
  if (hasTable) score += 0.5;
  if (hasCallout) score += 0.3;
  if (hasImage) score += 0.2;

  return Math.min(10, parseFloat(score.toFixed(1)));
}

function deriveTags(existing: DocumentMetadata): string[] {
  return existing.tags ?? [];
}

/* ── Re-exported hash/ID helpers ──────────────────────────────────────── */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function generateNodeId(type: string, index: number, text: string): string {
  const prefix = ID_PREFIXES[type] ?? 'node';
  const slug = slugify(text);
  return slug ? `${prefix}-${slug}` : `${prefix}-${index}`;
}
