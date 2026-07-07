/**
 * NDL Parser — Converts markdown to typed NDL AST
 *
 * Uses marked lexer for tokenization, then transforms tokens
 * into typed AST nodes. Detects callouts, diagrams, equations,
 * semantic blocks, and media automatically.
 */

import { Lexer } from 'marked';
import type { Token, Tokens } from 'marked';
import { renderMath } from '@/lib/markdown/math';
import {
  type ASTNode,
  type DocumentAST,
  type HeadingNode,
  type ParagraphNode,
  type ListNode,
  type CodeNode,
  type DiagramNode,
  type CalloutNode,
  type CalloutKind,
  type TableNode,
  type ColumnDef,
  type ImageNode,
  type VideoNode,
  type EmbedProvider,
  type EquationNode,
  type BlockquoteNode,
  type ReferenceNode,
  type ThematicBreakNode,
  type SemanticBlockNode,
  type SemanticBlockKind,
  type TerminalNode,
  type FileTreeNode,
  type AccordionNode,
  type ApiNode,
  type CodeLanguage,
  type DiagramKind,
  type DiagramEngine,
  type ContentHierarchy,
  type DocumentMetadata,
} from '../schemas';

/* ── Constants ────────────────────────────────────────────────────────── */

const CALLOUT_PATTERN =
  /^\[!(NOTE|WARNING|TIP|DANGER|INFO|IMPORTANT|CAUTION|SUCCESS|QUESTION)\]\s*(.*)?$/i;
const DIAGRAM_FIRST_LINE =
  /^(graph\s+(TB|TD|BT|RL|LR)|flowchart\s+(TB|TD|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|zenuml|architecture)\b/i;
const MATH_BLOCK = /^\$\$[\s\S]*?\$\$/;
const MATH_INLINE = /(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g;
const VIDEO_PATTERN = /^@\[(youtube|vimeo|video|audio|pdf)\]\(([^)]+)\)/;
const SEMANTIC_FENCE = /^:::$/;

const CALLOUT_KIND_MAP: Record<string, CalloutKind> = {
  NOTE: 'note',
  WARNING: 'warning',
  TIP: 'tip',
  DANGER: 'danger',
  INFO: 'info',
  IMPORTANT: 'important',
  CAUTION: 'caution',
  SUCCESS: 'success',
  QUESTION: 'question',
};

const SEMANTIC_KIND_MAP: Record<string, SemanticBlockKind> = {
  architecture: 'architecture',
  performance: 'performance',
  security: 'security',
  api: 'api',
  example: 'example',
  history: 'history',
  'future-work': 'future-work',
  timeline: 'timeline',
  definition: 'definition',
};

const DIAGRAM_KIND_MAP: Record<string, DiagramKind> = {
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

const LANG_NORMALIZE: Record<string, CodeLanguage> = {
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
  cs: 'csharp',
  'c#': 'csharp',
};

/* ── Helpers ──────────────────────────────────────────────────────────── */

function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < Math.min(text.length, 64); i++) {
    h = ((h << 5) + h) ^ text.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function generateId(prefix: string, text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${prefix}-${slug || hashText(text)}`;
}

function normalizeLanguage(lang: string): CodeLanguage {
  const lower = lang.toLowerCase().trim();
  return LANG_NORMALIZE[lower] || (lower as CodeLanguage);
}

function detectCallout(raw: string): { kind: CalloutKind; title: string; content: string } | null {
  const lines = raw.split('\n').map((l) => l.replace(/^>\s*/, ''));
  const first = lines[0]?.trim();
  if (!first) return null;
  const match = first.match(CALLOUT_PATTERN);
  if (!match) return null;
  const kind = CALLOUT_KIND_MAP[match[1].toUpperCase()];
  if (!kind) return null;
  return { kind, title: match[2]?.trim() ?? '', content: lines.slice(1).join('\n').trim() };
}

function detectDiagram(code: string): { kind: DiagramKind; engine: DiagramEngine } | null {
  const firstLine = code.trim().split('\n')[0]?.trim() ?? '';
  if (DIAGRAM_FIRST_LINE.test(firstLine)) {
    const typeKey = firstLine.replace(/[\s].*$/, '').toLowerCase();
    return { kind: DIAGRAM_KIND_MAP[typeKey] ?? 'flowchart', engine: 'mermaid' };
  }
  return null;
}

function detectInlineDiagram(
  content: string,
): { code: string; kind: DiagramKind; engine: DiagramEngine; remaining: string } | null {
  const lines = content.split('\n');
  const first = lines[0]?.trim() ?? '';
  if (!DIAGRAM_FIRST_LINE.test(first)) return null;
  let end = 1;
  while (end < lines.length) {
    const l = lines[end];
    if (l.trim() === '' || l[0] === ' ' || l[0] === '\t') end++;
    else break;
  }
  if (end === 1) return null;
  const typeKey = first.replace(/[\s].*$/, '').toLowerCase();
  const kind = DIAGRAM_KIND_MAP[typeKey] ?? 'flowchart';
  return {
    code: lines.slice(0, end).join('\n'),
    kind,
    engine: 'mermaid',
    remaining: lines.slice(end).join('\n').trim(),
  };
}

function isMermaidBlock(language: string): boolean {
  return [
    'mermaid',
    'flowchart',
    'sequencediagram',
    'classdiagram',
    'statediagram',
    'erdiagram',
    'journey',
    'gantt',
    'pie',
    'mindmap',
    'timeline',
    'gitgraph',
    'quadrantchart',
    'zenuml',
  ].includes(language.toLowerCase());
}

/* ── Main Parser ──────────────────────────────────────────────────────── */

export function parseDocument(content: string): DocumentAST {
  const warnings: string[] = [];
  let tokens: Token[];

  try {
    tokens = Lexer.lex(content);
  } catch {
    warnings.push('Failed to lex markdown');
    return {
      title: '',
      metadata: emptyMetadata(),
      nodes: [],
      hierarchy: emptyHierarchy(),
      warnings,
    };
  }

  const title = extractTitle(content);
  const flatNodes: ASTNode[] = [];
  let diagramCount = 0;
  let figureCount = 0;
  let tableCount = 0;
  let codeCount = 0;
  let blockCount = 0;

  for (const token of tokens) {
    const node = tokenToNode(
      token,
      { diagramCount, figureCount, tableCount, codeCount, blockCount },
      warnings,
    );
    if (!node) continue;

    if (node.type === 'callout') {
      blockCount++;
      const callout = node;
      const diagram = detectInlineDiagram(callout.html);
      if (diagram) {
        diagramCount++;
        flatNodes.push({
          type: 'diagram',
          engine: 'mermaid',
          kind: diagram.kind,
          content: diagram.code,
          label: `Diagram ${diagramCount}`,
        });
        if (diagram.remaining) {
          flatNodes.push({ ...node, html: diagram.remaining });
        }
        continue;
      }
    }

    flatNodes.push(node);
    if (node.type === 'diagram') diagramCount++;
    if (node.type === 'code') codeCount++;
    if (node.type === 'image') figureCount++;
    if (node.type === 'table') tableCount++;
    blockCount++;
  }

  const headings = extractHeadings(flatNodes);
  const hierarchy = buildHierarchy(headings, flatNodes);
  const metadata = buildMetadata(content, flatNodes);

  return {
    title,
    metadata,
    nodes: flatNodes,
    hierarchy,
    warnings,
  };
}

function tokenToNode(
  token: Token,
  state: {
    diagramCount: number;
    figureCount: number;
    tableCount: number;
    codeCount: number;
    blockCount: number;
  },
  warnings: string[],
): ASTNode | null {
  try {
    switch (token.type) {
      case 'heading': {
        const t = token as Tokens.Heading;
        const text = t.text || t.raw.replace(/^#+\s*/, '').trim();
        const id = generateId('h', text);
        return { type: 'heading', level: t.depth as HeadingNode['level'], text, id } as HeadingNode;
      }

      case 'paragraph': {
        const raw = (token as Tokens.Paragraph).raw;
        const callout = detectCallout(raw);
        if (callout) {
          return {
            type: 'callout',
            kind: callout.kind,
            title: callout.title,
            html: callout.content,
          };
        }

        const imgMatch = raw.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
        if (imgMatch) {
          state.figureCount++;
          return {
            type: 'image',
            url: imgMatch[2],
            alt: imgMatch[1],
            caption: '',
          };
        }

        const videoMatch = raw.trim().match(VIDEO_PATTERN);
        if (videoMatch) {
          return {
            type: 'video',
            provider: videoMatch[1] as EmbedProvider,
            url: videoMatch[2],
          };
        }

        return { type: 'paragraph', html: raw, raw };
      }

      case 'code': {
        const t = token as Tokens.Code;
        const lang = (t.lang ?? '').toLowerCase();

        if (isMermaidBlock(lang) || lang === 'mermaid') {
          state.diagramCount++;
          const detected = detectDiagram(t.text);
          return {
            type: 'diagram',
            engine: 'mermaid',
            kind: detected?.kind ?? 'flowchart',
            content: t.text,
            label: `Diagram ${state.diagramCount}`,
          };
        }

        if (lang === 'plantuml') {
          state.diagramCount++;
          return {
            type: 'diagram',
            engine: 'plantuml',
            kind: 'plantuml',
            content: t.text,
            label: `Diagram ${state.diagramCount}`,
          };
        }

        state.codeCount++;
        return {
          type: 'code',
          language: normalizeLanguage(lang),
          content: t.text,
          showLineNumbers: true,
        };
      }

      case 'list': {
        const t = token as Tokens.List;
        const items = t.items.map((item) => {
          const text = item.text || item.raw.replace(/^[-*+]\s+/, '').trim();
          const checked = 'checked' in item ? (item as Tokens.Task).checked : undefined;
          return { content: text, checked };
        });
        return {
          type: 'list',
          ordered: t.ordered,
          items,
          start: t.start ?? undefined,
        } as ListNode;
      }

      case 'table': {
        const t = token as Tokens.Table;
        state.tableCount++;
        const columns: ColumnDef[] = (t.header ?? []).map((h, i) => ({
          header: h.text ?? '',
          align: t.align[i] ?? 'left',
        }));
        const rows = (t.rows ?? []).map((row) => row.map((cell) => cell.text ?? ''));
        return {
          type: 'table',
          columns,
          rows,
          sortable: true,
        };
      }

      case 'blockquote': {
        const raw = (token as Tokens.Blockquote).raw;
        const stripped = raw
          .split('\n')
          .map((l) => l.replace(/^>\s?/, ''))
          .join('\n');
        const callout = detectCallout(stripped);
        if (callout) {
          return {
            type: 'callout',
            kind: callout.kind,
            title: callout.title,
            html: callout.content,
          };
        }
        return { type: 'blockquote', html: raw };
      }

      case 'space':
        return null;

      default:
        return null;
    }
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : String(err));
    return null;
  }
}

/* ── Hierarchy Builder ───────────────────────────────────────────────── */

function extractHeadings(nodes: ASTNode[]): HeadingNode[] {
  const headings: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const node of nodes) {
    if (node.type !== 'heading') continue;
    const h = node;
    const headingNode: HeadingNode = {
      type: 'heading',
      level: h.level,
      text: h.text,
      id: h.id,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(headingNode);
    } else {
      headings.push(headingNode);
    }
    stack.push(headingNode);
  }

  return headings;
}

function buildHierarchy(headings: HeadingNode[], nodes: ASTNode[]): ContentHierarchy {
  const figures: ContentHierarchy['figures'] = [];
  const tables: ContentHierarchy['tables'] = [];
  const diagrams: ContentHierarchy['diagrams'] = [];
  const codeBlocks: ContentHierarchy['codeBlocks'] = [];
  let figNum = 0;
  let tabNum = 0;
  let dgmNum = 0;
  let codNum = 0;

  for (const node of nodes) {
    if (node.type === 'image') {
      figNum++;
      figures.push({
        type: 'figure',
        number: figNum,
        caption: '',
        sectionIndex: 0,
        id: node.id ?? `fig-${figNum}`,
      });
    }
    if (node.type === 'table') {
      tabNum++;
      tables.push({
        type: 'table',
        number: tabNum,
        caption: '',
        sectionIndex: 0,
        id: node.id ?? `tbl-${tabNum}`,
      });
    }
    if (node.type === 'diagram') {
      dgmNum++;
      diagrams.push({
        type: 'diagram',
        number: dgmNum,
        caption: '',
        sectionIndex: 0,
        id: node.id ?? `dgm-${dgmNum}`,
      });
    }
    if (node.type === 'code') {
      codNum++;
      codeBlocks.push({
        type: 'code',
        number: codNum,
        caption: '',
        sectionIndex: 0,
        id: node.id ?? `cod-${codNum}`,
      });
    }
  }

  assignNumbers(headings);
  return { toc: headings, figures, tables, diagrams, codeBlocks };
}

function assignNumbers(nodes: HeadingNode[], prefix = '') {
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].number = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
    if (nodes[i].children.length > 0) {
      assignNumbers(nodes[i].children, nodes[i].number);
    }
  }
}

/* ── Metadata ─────────────────────────────────────────────────────────── */

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? '';
}

function emptyMetadata(): DocumentMetadata {
  return { wordCount: 0, readingTimeMinutes: 0 };
}

function emptyHierarchy(): ContentHierarchy {
  return { toc: [], figures: [], tables: [], diagrams: [], codeBlocks: [] };
}

function buildMetadata(content: string, nodes: ASTNode[]): DocumentMetadata {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return {
    wordCount,
    readingTimeMinutes: Math.max(1, Math.round(wordCount / 220)),
    tags: [],
  };
}

/* ── Public Helpers ───────────────────────────────────────────────────── */

export function extractTOCNodes(doc: DocumentAST): HeadingNode[] {
  return doc.hierarchy.toc;
}

export function flattenHeadingIds(doc: DocumentAST): string[] {
  const ids: string[] = [];
  function walk(nodes: HeadingNode[]) {
    for (const n of nodes) {
      if (n.id) ids.push(n.id);
      walk(n.children);
    }
  }
  walk(doc.hierarchy.toc);
  return ids;
}
