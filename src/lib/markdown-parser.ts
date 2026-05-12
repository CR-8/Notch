import { Lexer } from 'marked';
import type { Token, Tokens } from 'marked';
import { escapeHtmlFull, sanitizeCodeLanguage, validateStructuralFences } from './sanitize';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParseWarning {
  line: number;
  message: string;
  raw: string;
}

export interface DocBlock {
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'table' | 'blockquote' | 'unknown';
  raw: string;
  // type-specific fields
  level?: number;                                    // heading
  language?: string;                                 // code
  alignment?: ('left' | 'center' | 'right')[];      // table columns
  children?: DocBlock[];                             // list items / nested lists
  depth?: number;                                    // list nesting depth (0-based)
  paragraphId?: string;                              // stable hash-based ID for paragraphs
}

export interface ParseResult {
  blocks: DocBlock[];
  warnings: ParseWarning[];
}

// ── Stable paragraph ID ───────────────────────────────────────────────────────

/**
 * Compute a simple djb2-style hash of the first 64 chars of text.
 * Returns a hex string. Pure synchronous — no SubtleCrypto needed here.
 */
function hashText(text: string): string {
  const sample = text.slice(0, 64);
  let h = 5381;
  for (let i = 0; i < sample.length; i++) {
    h = ((h << 5) + h) ^ sample.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h.toString(16).padStart(8, '0');
}

// ── Token → DocBlock conversion ───────────────────────────────────────────────

function convertListItems(items: Tokens.ListItem[], depth: number): DocBlock[] {
  const result: DocBlock[] = [];
  for (const item of items) {
    // Check if this list item contains a nested list
    const nestedList = item.tokens?.find((t): t is Tokens.List => t.type === 'list');
    const children: DocBlock[] = nestedList
      ? convertListItems(nestedList.items, depth + 1)
      : [];

    result.push({
      type: 'list',
      raw: item.raw,
      depth,
      children: children.length > 0 ? children : undefined,
    });
  }
  return result;
}

function tokenToDocBlock(token: Token, warnings: ParseWarning[]): DocBlock | null {
  try {
    switch (token.type) {
      case 'heading': {
        const t = token as Tokens.Heading;
        return { type: 'heading', raw: t.raw, level: t.depth };
      }

      case 'paragraph': {
        const t = token as Tokens.Paragraph;
        const id = hashText(t.text ?? t.raw);
        return { type: 'paragraph', raw: t.raw, paragraphId: id };
      }

      case 'code': {
        const t = token as Tokens.Code;
        return { type: 'code', raw: t.raw, language: sanitizeCodeLanguage(t.lang ?? '') };
      }

      case 'list': {
        const t = token as Tokens.List;
        const children = convertListItems(t.items, 0);
        return { type: 'list', raw: t.raw, depth: 0, children };
      }

      case 'table': {
        const t = token as Tokens.Table;
        const alignment = t.align.map((a): 'left' | 'center' | 'right' => {
          if (a === 'center') return 'center';
          if (a === 'right') return 'right';
          return 'left';
        });
        return { type: 'table', raw: t.raw, alignment };
      }

      case 'blockquote': {
        const t = token as Tokens.Blockquote;
        return { type: 'blockquote', raw: t.raw };
      }

      case 'space':
        // Skip whitespace-only tokens
        return null;

      default:
        // Unknown token type — emit as unknown block
        return { type: 'unknown', raw: (token as any).raw ?? '' };
    }
  } catch (err) {
    const raw = (token as any).raw ?? '';
    warnings.push({
      line: 0,
      message: err instanceof Error ? err.message : String(err),
      raw,
    });
    return { type: 'unknown', raw };
  }
}

// ── parseMarkdown ─────────────────────────────────────────────────────────────

export function parseMarkdown(md: string): ParseResult {
  const blocks: DocBlock[] = [];
  const warnings: ParseWarning[] = [];

  // Validate and repair structural fences before parsing
  const fenceResult = validateStructuralFences(md);
  if (!fenceResult.valid) {
    warnings.push({
      line: 0,
      message: `Repaired ${fenceResult.unclosedFences} unclosed code fence(s)`,
      raw: '',
    });
  }
  const safeMd = fenceResult.repaired;

  let tokens: Token[];
  try {
    tokens = Lexer.lex(safeMd);
  } catch (err) {
    warnings.push({
      line: 0,
      message: err instanceof Error ? err.message : String(err),
      raw: md,
    });
    return { blocks: [{ type: 'unknown', raw: md }], warnings };
  }

  for (const token of tokens) {
    let block: DocBlock | null = null;
    try {
      block = tokenToDocBlock(token, warnings);
    } catch (err) {
      const raw = (token as any).raw ?? '';
      warnings.push({
        line: 0,
        message: err instanceof Error ? err.message : String(err),
        raw,
      });
      block = { type: 'unknown', raw };
    }
    if (block !== null) {
      blocks.push(block);
    }
  }

  return { blocks, warnings };
}

// ── serializeToMarkdown ───────────────────────────────────────────────────────

function serializeBlock(block: DocBlock): string {
  switch (block.type) {
    case 'heading': {
      const hashes = '#'.repeat(block.level ?? 1);
      // Extract text from raw (strip leading hashes + space)
      const text = block.raw.replace(/^#{1,6}\s*/, '').trim();
      return `${hashes} ${text}`;
    }

    case 'paragraph': {
      const text = block.raw.trim();
      const id = block.paragraphId ?? hashText(text.slice(0, 64));
      // Emit with data-paragraph-id as an HTML comment so it survives round-trips
      return `${text}\n<!-- paragraph-id: ${id} -->`;
    }

    case 'code': {
      const lang = block.language ?? '';
      // If raw already has fences, use it directly
      if (block.raw.startsWith('```')) {
        return block.raw.trim();
      }
      return `\`\`\`${lang}\n${block.raw.trim()}\n\`\`\``;
    }

    case 'list': {
      return serializeListBlock(block, 0);
    }

    case 'table': {
      return block.raw.trim();
    }

    case 'blockquote': {
      return block.raw.trim();
    }

    case 'unknown': {
      return `<pre data-fallback="true">${escapeHtmlFull(block.raw)}</pre>`;
    }

    default:
      return block.raw.trim();
  }
}

function serializeListBlock(block: DocBlock, indentLevel: number): string {
  const indent = '  '.repeat(indentLevel);
  const lines: string[] = [];

  if (block.children && block.children.length > 0) {
    for (const child of block.children) {
      // Extract the text from the child's raw (strip list marker)
      const text = child.raw.replace(/^[\s]*[-*+]\s+/, '').replace(/^\s*\d+\.\s+/, '').split('\n')[0].trim();
      lines.push(`${indent}- ${text}`);
      if (child.children && child.children.length > 0) {
        for (const grandchild of child.children) {
          lines.push(serializeListBlock(grandchild, indentLevel + 1));
        }
      }
    }
  } else {
    // Leaf list item
    const text = block.raw.replace(/^[\s]*[-*+]\s+/, '').replace(/^\s*\d+\.\s+/, '').split('\n')[0].trim();
    lines.push(`${indent}- ${text}`);
  }

  return lines.join('\n');
}

export function serializeToMarkdown(result: ParseResult): string {
  return result.blocks.map(serializeBlock).join('\n\n');
}
