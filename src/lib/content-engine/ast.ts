import { Lexer } from 'marked';
import type { Token, Tokens } from 'marked';
import type {
  EnrichedBlock,
  ContentHierarchy,
  HeadingNode,
  NumberedItem,
  CalloutElement,
  DiagramElement,
  CalloutKind,
  DiagramKind,
} from './types';

export interface ASTParseOptions {
  detectCallouts?: boolean;
  detectDiagrams?: boolean;
  numberingEnabled?: boolean;
}

const DEFAULT_OPTIONS: ASTParseOptions = {
  detectCallouts: true,
  detectDiagrams: true,
  numberingEnabled: true,
};

function isMermaidBlock(language: string): boolean {
  const mermaidLangs = new Set([
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
    'architecture',
  ]);
  return mermaidLangs.has(language.toLowerCase());
}

function hashText(text: string): string {
  const sample = text.slice(0, 64);
  let h = 5381;
  for (let i = 0; i < sample.length; i++) {
    h = ((h << 5) + h) ^ sample.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function detectCallout(raw: string): { kind: string; title: string; content: string } | null {
  const lines = raw.split('\n');
  const first = lines[0]?.trim();
  const match = first?.match(/^\[!(NOTE|WARNING|TIP|DANGER|INFO)\]\s*(.*)?$/i);
  if (!match) return null;
  const kind = match[1].toLowerCase();
  const title = match[2]?.trim() ?? '';
  const content = lines.slice(1).join('\n').trim();
  return { kind, title, content };
}

function generateId(prefix: string, text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${prefix}-${slug || hashText(text)}`;
}

function tokenToEnriched(
  token: Token,
  options: ASTParseOptions,
  state: { figureCount: number; tableCount: number; diagramCount: number; codeCount: number },
  warnings: string[],
): EnrichedBlock | null {
  try {
    switch (token.type) {
      case 'heading': {
        const t = token as Tokens.Heading;
        const text = t.text ?? t.raw.replace(/^#+\s*/, '').trim();
        const id = generateId('h', text);
        return { type: 'heading', raw: t.raw, level: t.depth, id };
      }

      case 'paragraph': {
        const t = token as Tokens.Paragraph;
        const raw = t.raw;

        if (options.detectCallouts) {
          const callout = detectCallout(raw);
          if (callout) {
            return {
              type: 'callout',
              raw,
              data: {
                type: 'callout',
                kind: callout.kind as CalloutKind,
                content: callout.content,
                title: callout.title,
              },
            };
          }
        }

        // Extract standalone image paragraphs as dedicated image blocks.
        const imgMatch = raw.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
        if (imgMatch) {
          const alt = imgMatch[1];
          const url = imgMatch[2];
          state.figureCount++;
          return {
            type: 'image',
            raw,
            id: `img-${state.figureCount}`,
            data: {
              type: 'image',
              kind: 'generic',
              prompt: '',
              caption: alt,
              altText: alt,
              placement: -1,
              id: `img-${state.figureCount}`,
              url,
            },
          };
        }

        return { type: 'paragraph', raw };
      }

      case 'code': {
        const t = token as Tokens.Code;
        const lang = (t.lang ?? '').toLowerCase();

        if (options.detectDiagrams && lang === 'mermaid') {
          state.diagramCount++;
          const id = `diagram-${state.diagramCount}`;
          return {
            type: 'diagram',
            raw: t.raw,
            id,
            data: {
              type: 'diagram',
              kind: 'flowchart',
              label: `Diagram ${state.diagramCount}`,
              content: t.text,
              caption: '',
              altText: '',
              placement: -1,
              id,
            },
          };
        }

        if (options.detectDiagrams && lang === 'plantuml') {
          state.diagramCount++;
          const id = `diagram-${state.diagramCount}`;
          return {
            type: 'diagram',
            raw: t.raw,
            id,
            data: {
              type: 'diagram',
              kind: 'plantuml',
              label: `UML Diagram ${state.diagramCount}`,
              content: t.text,
              caption: '',
              altText: '',
              placement: -1,
              id,
            },
          };
        }

        if (options.detectDiagrams && isMermaidBlock(lang)) {
          state.diagramCount++;
          const id = `diagram-${state.diagramCount}`;
          const kind =
            lang === 'sequencediagram'
              ? ('sequenceDiagram' as DiagramKind)
              : lang === 'classdiagram'
                ? ('classDiagram' as DiagramKind)
                : lang === 'statediagram'
                  ? ('stateDiagram' as DiagramKind)
                  : lang === 'erdiagram'
                    ? ('erDiagram' as DiagramKind)
                    : lang === 'gitgraph'
                      ? ('gitGraph' as DiagramKind)
                      : (lang as DiagramKind);
          return {
            type: 'diagram',
            raw: t.raw,
            id,
            data: {
              type: 'diagram',
              kind,
              label: `Diagram ${state.diagramCount}`,
              content: t.text,
              caption: '',
              altText: '',
              placement: -1,
              id,
            },
          };
        }

        state.codeCount++;
        const codeId = `code-${state.codeCount}`;
        return {
          type: 'code',
          raw: t.raw,
          id: codeId,
          data: {
            type: 'code',
            language: lang,
            content: t.text,
            showLineNumbers: true,
          },
        };
      }

      case 'list': {
        return { type: 'list', raw: (token as Tokens.List).raw };
      }

      case 'table': {
        const t = token as Tokens.Table;
        state.tableCount++;
        const tableId = `table-${state.tableCount}`;
        const columns = (t.header ?? []).map((h, i) => ({
          header: h.text ?? '',
          align: t.align[i] ?? 'left',
        }));
        const rows = (t.rows ?? []).map((row) => row.map((cell) => cell.text ?? ''));
        return {
          type: 'rich_table',
          raw: t.raw,
          id: tableId,
          data: {
            type: 'table',
            columns,
            rows,
            sortable: true,
            filterable: false,
          },
        };
      }

      case 'blockquote': {
        return { type: 'blockquote', raw: (token as Tokens.Blockquote).raw };
      }

      case 'space':
        return null;

      default:
        return { type: 'paragraph', raw: (token as { raw: string }).raw ?? '' };
    }
  } catch (err) {
    const raw = (token as { raw: string }).raw ?? '';
    warnings.push(err instanceof Error ? err.message : String(err));
    return { type: 'paragraph', raw };
  }
}

export function parseToEnrichedAST(
  md: string,
  options: ASTParseOptions = DEFAULT_OPTIONS,
): { blocks: EnrichedBlock[]; hierarchy: ContentHierarchy; warnings: string[] } {
  const warnings: string[] = [];
  const state = { figureCount: 0, tableCount: 0, diagramCount: 0, codeCount: 0 };

  let tokens: Token[];
  try {
    tokens = Lexer.lex(md);
  } catch {
    warnings.push('Failed to lex markdown');
    return {
      blocks: [{ type: 'paragraph', raw: md }],
      hierarchy: { toc: [], figures: [], tables: [], diagrams: [], codeBlocks: [] },
      warnings,
    };
  }

  const blocks: EnrichedBlock[] = [];
  for (const token of tokens) {
    const block = tokenToEnriched(token, options, state, warnings);
    if (block) blocks.push(block);
  }

  const hierarchy = buildHierarchy(blocks, state);

  return { blocks, hierarchy, warnings };
}

export function buildHierarchy(
  blocks: EnrichedBlock[],
  _state?: { figureCount: number; tableCount: number; diagramCount: number; codeCount: number },
): ContentHierarchy {
  const toc: HeadingNode[] = [];
  const stack: HeadingNode[] = [];
  const figures: NumberedItem[] = [];
  const tables: NumberedItem[] = [];
  const diagrams: NumberedItem[] = [];
  const codeBlocks: NumberedItem[] = [];

  let tableNum = 0;
  let diagNum = 0;
  let codeNum = 0;

  for (const block of blocks) {
    if (block.type === 'heading' && block.level) {
      const text = block.raw.replace(/^#+\s*/, '').trim() || '';
      const node: HeadingNode = {
        level: block.level,
        text,
        number: '',
        id: block.id ?? `h-${hashText(text)}`,
        children: [],
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= block.level) {
        stack.pop();
      }
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        toc.push(node);
      }
      stack.push(node);
    }

    if (block.type === 'diagram' && block.data && 'kind' in block.data) {
      diagNum++;
      const diagramData = block.data as DiagramElement;
      diagrams.push({
        type: 'diagram',
        number: diagNum,
        caption: diagramData.label || '',
        sectionIndex: blocks.indexOf(block),
        id: block.id ?? '',
      });
    }

    if (block.type === 'rich_table' && block.data && 'columns' in block.data) {
      tableNum++;
      tables.push({
        type: 'table',
        number: tableNum,
        caption: block.data.caption ?? '',
        sectionIndex: blocks.indexOf(block),
        id: block.id ?? '',
      });
    }

    if (block.type === 'code' && block.data && 'language' in block.data) {
      codeNum++;
      codeBlocks.push({
        type: 'code',
        number: codeNum,
        caption: block.data.caption ?? '',
        sectionIndex: blocks.indexOf(block),
        id: block.id ?? '',
      });
    }
  }

  // Assign section numbers
  assignNumbers(toc);

  return { toc, figures, tables, diagrams, codeBlocks };
}

function assignNumbers(nodes: HeadingNode[], prefix = ''): void {
  for (let i = 0; i < nodes.length; i++) {
    const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
    nodes[i].number = num;
    if (nodes[i].children.length > 0) {
      assignNumbers(nodes[i].children, num);
    }
  }
}

export function applyNumberingToBlocks(
  blocks: EnrichedBlock[],
  hierarchy: ContentHierarchy,
): EnrichedBlock[] {
  const headingMap = new Map<string, string>();
  flattenHeadings(hierarchy.toc, headingMap);

  return blocks.map((block) => {
    if (block.type === 'heading' && block.id && headingMap.has(block.id)) {
      return { ...block, number: headingMap.get(block.id) };
    }
    return block;
  });
}

function flattenHeadings(nodes: HeadingNode[], map: Map<string, string>): void {
  for (const node of nodes) {
    if (node.id) map.set(node.id, node.number);
    flattenHeadings(node.children, map);
  }
}

export function serializeEnrichedBlock(block: EnrichedBlock): string {
  switch (block.type) {
    case 'heading': {
      const hashes = '#'.repeat(block.level ?? 1);
      const prefix = block.number ? `${block.number} ` : '';
      const text = block.raw.replace(/^#{1,6}\s*/, '').trim();
      return `${hashes} ${prefix}${text}`;
    }
    case 'paragraph':
      return block.raw.trim();
    case 'code':
      return block.raw.trim();
    case 'list':
      return block.raw.trim();
    case 'blockquote':
      return block.raw.trim();
    case 'callout': {
      if (block.data && 'kind' in block.data) {
        const d = block.data as CalloutElement;
        const title = d.title ? ` ${d.title}` : '';
        return `[!${d.kind.toUpperCase()}]${title}\n${d.content}`;
      }
      return block.raw.trim();
    }
    case 'diagram': {
      if (block.data && 'kind' in block.data) {
        const d = block.data as DiagramElement;
        const lang = d.kind === 'plantuml' ? 'plantuml' : 'mermaid';
        return `\`\`\`${lang}\n${d.content}\n\`\`\``;
      }
      return block.raw.trim();
    }
    case 'rich_table':
      return block.raw.trim();
    case 'reference':
      return block.raw.trim();
    case 'video':
      return block.raw;
    case 'image':
      return block.raw;
    default:
      return block.raw.trim();
  }
}

export function serializeEnrichedDocument(blocks: EnrichedBlock[]): string {
  return blocks.map(serializeEnrichedBlock).join('\n\n');
}

export function stripNotchMarkers(markdown: string): string {
  return markdown
    .replace(/<!-- NOTCH-ANALYSIS -->[\s\S]*?<!-- \/NOTCH-ANALYSIS -->\n*/g, '')
    .replace(/<!-- NOTCH-DIAGRAMS -->[\s\S]*?<!-- \/NOTCH-DIAGRAMS -->\n*/g, '')
    .replace(/<!-- NOTCH-IMAGES -->[\s\S]*?<!-- \/NOTCH-IMAGES -->\n*/g, '');
}
