/**
 * Markdown Exporter — converts NDL AST back to clean markdown
 *
 * Generates well-formatted markdown with proper heading hierarchy,
 * numbered sections, GFM tables, mermaid blocks, callouts, etc.
 */

import type {
  DocumentAST,
  ASTNode,
  HeadingNode,
  ListItem,
  ColumnDef,
  ReferenceItem,
  TerminalLine,
  FileTreeEntry,
  AccordionPanel,
  ApiEndpoint,
  ContentHierarchy,
} from '../schemas';

/* ── Export Options ───────────────────────────────────────────────────── */

export interface MarkdownExportOptions {
  numberedHeadings: boolean;
  includeMetadata: boolean;
  includeWarnings: boolean;
  lineWidth: number;
}

const DEFAULT_OPTIONS: MarkdownExportOptions = {
  numberedHeadings: true,
  includeMetadata: false,
  includeWarnings: false,
  lineWidth: 80,
};

/* ── Export Function ──────────────────────────────────────────────────── */

export function exportToMarkdown(
  doc: DocumentAST,
  options: Partial<MarkdownExportOptions> = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  if (opts.includeMetadata) {
    lines.push('---');
    lines.push(`title: "${doc.title}"`);
    lines.push(`word_count: ${doc.metadata.wordCount}`);
    lines.push(`reading_time: ${doc.metadata.readingTimeMinutes}`);
    if (doc.metadata.documentClass) lines.push(`class: ${doc.metadata.documentClass}`);
    if (doc.metadata.sourceUrl) lines.push(`source: ${doc.metadata.sourceUrl}`);
    if (doc.metadata.tags && doc.metadata.tags.length > 0)
      lines.push(`tags: [${doc.metadata.tags.join(', ')}]`);
    lines.push('---');
    lines.push('');
  }

  for (let i = 0; i < doc.nodes.length; i++) {
    const node = doc.nodes[i];
    const md = nodeToMarkdown(node, i, doc.nodes, opts);
    if (md) lines.push(md);
  }

  if (opts.includeWarnings && doc.warnings.length > 0) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Warnings');
    for (const w of doc.warnings) {
      lines.push(`- ⚠ ${w}`);
    }
  }

  return lines.join('\n').trim() + '\n';
}

function nodeToMarkdown(
  node: ASTNode,
  index: number,
  allNodes: ASTNode[],
  opts: MarkdownExportOptions,
): string {
  switch (node.type) {
    case 'heading':
      return headingToMarkdown(node, opts);
    case 'paragraph':
      return (node as any).raw ?? '';
    case 'list':
      return listToMarkdown(node as any);
    case 'code':
      return codeToMarkdown(node as any);
    case 'diagram':
      return diagramToMarkdown(node as any);
    case 'callout':
      return calloutToMarkdown(node as any);
    case 'table':
      return tableToMarkdown(node as any);
    case 'image':
      return imageToMarkdown(node as any);
    case 'video':
      return videoToMarkdown(node as any);
    case 'equation':
      return equationToMarkdown(node as any);
    case 'blockquote':
      return (node as any).html ?? '';
    case 'reference':
      return referenceToMarkdown(node as any);
    case 'thematic_break':
      return '---';
    case 'semantic':
      return semanticToMarkdown(node as any);
    case 'terminal':
      return terminalToMarkdown(node as any);
    case 'file_tree':
      return fileTreeToMarkdown(node as any);
    case 'accordion':
      return accordionToMarkdown(node as any);
    case 'api':
      return apiToMarkdown(node as any);
    default:
      return '';
  }
}

function headingToMarkdown(h: HeadingNode, opts: MarkdownExportOptions): string {
  const prefix = '#'.repeat(h.level);
  const number = opts.numberedHeadings && h.number ? `${h.number} ` : '';
  const id = h.id ? ` {#${h.id}}` : '';
  return `\n${prefix} ${number}${h.text}${id}\n`;
}

function listToMarkdown(l: any): string {
  return l.items
    .map((item: ListItem, i: number) => {
      const prefix = l.ordered ? `${l.start ? l.start + i : i + 1}.` : '-';
      if (item.checked !== undefined) {
        return item.checked ? `  ${prefix} [x] ${item.content}` : `  ${prefix} [ ] ${item.content}`;
      }
      return `  ${prefix} ${item.content}`;
    })
    .join('\n');
}

function codeToMarkdown(c: any): string {
  return `\`\`\`${c.language}\n${c.content}\n\`\`\``;
}

function diagramToMarkdown(d: any): string {
  const lines: string[] = [];
  lines.push(`\`\`\`${d.engine}`);
  if (d.caption) lines.push(`---\n# ${d.caption}`);
  lines.push(d.content);
  lines.push('```');
  return lines.join('\n');
}

function calloutToMarkdown(c: any): string {
  const lines: string[] = [];
  const title = c.title ? ` ${c.title}` : '';
  lines.push(`> [!${c.kind.toUpperCase()}]${title}`);
  for (const line of c.html.split('\n')) {
    lines.push(`> ${line}`);
  }
  return lines.join('\n');
}

function tableToMarkdown(t: any): string {
  const lines: string[] = [];
  const headers = t.columns.map((col: ColumnDef) => col.header).join(' | ');
  const aligns = t.columns
    .map((col: ColumnDef) => {
      switch (col.align) {
        case 'center':
          return ':---:';
        case 'right':
          return '---:';
        default:
          return '---';
      }
    })
    .join(' | ');
  lines.push(`| ${headers} |`);
  lines.push(`| ${aligns} |`);
  for (const row of t.rows) {
    lines.push(`| ${row.join(' | ')} |`);
  }
  return lines.join('\n');
}

function imageToMarkdown(img: any): string {
  const alt = img.alt || '';
  return `![${alt}](${img.url})`;
}

function videoToMarkdown(v: any): string {
  return `@[${v.provider}](${v.url})`;
}

function equationToMarkdown(eq: any): string {
  return eq.displayMode ? `$$\n${eq.content}\n$$` : `$${eq.content}$`;
}

function referenceToMarkdown(ref: any): string {
  return ref.items
    .map((item: ReferenceItem, i: number) => {
      return `${i + 1}. ${item.url ? `[${item.text}](${item.url})` : item.text}`;
    })
    .join('\n');
}

function semanticToMarkdown(s: any): string {
  const lines: string[] = [];
  lines.push(`::: ${s.kind}`);
  if (s.title) lines.push(`# ${s.title}`);
  lines.push(s.html);
  lines.push(':::');
  return lines.join('\n');
}

function terminalToMarkdown(t: any): string {
  const lines: string[] = [];
  lines.push('```terminal');
  for (const line of t.lines as TerminalLine[]) {
    if (line.prompt) lines.push(`${line.prompt} ${line.input ?? ''}`);
    else if (line.input) lines.push(`$ ${line.input}`);
    else if (line.output) lines.push(line.output);
  }
  lines.push('```');
  return lines.join('\n');
}

function fileTreeToMarkdown(ft: any): string {
  function renderEntry(entry: FileTreeEntry, depth: number): string {
    const indent = '  '.repeat(depth);
    const icon = entry.type === 'directory' ? '/' : '';
    let result = `${indent}- ${entry.name}${icon}`;
    if (entry.children) {
      for (const child of entry.children) {
        result += '\n' + renderEntry(child, depth + 1);
      }
    }
    return result;
  }
  return ft.entries.map((e: FileTreeEntry) => renderEntry(e, 0)).join('\n');
}

function accordionToMarkdown(a: any): string {
  return a.panels
    .map((panel: AccordionPanel) => {
      return `<details>\n<summary>${panel.title}</summary>\n\n${panel.content}\n\n</details>`;
    })
    .join('\n\n');
}

function apiToMarkdown(api: any): string {
  return api.endpoints
    .map((ep: ApiEndpoint) => {
      const lines: string[] = [];
      lines.push(`### \`${ep.method} ${ep.path}\``);
      lines.push('');
      lines.push(ep.description);
      if (ep.requestBody) {
        lines.push('');
        lines.push('**Request:**');
        lines.push('```json');
        lines.push(ep.requestBody);
        lines.push('```');
      }
      if (ep.responseBody) {
        lines.push('');
        lines.push('**Response:**');
        lines.push('```json');
        lines.push(ep.responseBody);
        lines.push('```');
      }
      return lines.join('\n');
    })
    .join('\n\n');
}
