import type { ContentHierarchy, HeadingNode, NumberedItem, EnrichedBlock } from './types';

export interface TOCItem {
  level: number;
  number: string;
  text: string;
  id: string;
  children: TOCItem[];
}

export function buildTOC(hierarchy: ContentHierarchy): TOCItem[] {
  function mapNodes(nodes: HeadingNode[]): TOCItem[] {
    return nodes.map(n => ({
      level: n.level,
      number: n.number,
      text: n.text,
      id: n.id,
      children: mapNodes(n.children),
    }));
  }
  return mapNodes(hierarchy.toc);
}

export function renderTOCText(items: TOCItem[], indent = 0): string {
  let result = '';
  for (const item of items) {
    const prefix = '  '.repeat(indent);
    result += `${prefix}${item.number} ${item.text}\n`;
    if (item.children.length > 0) {
      result += renderTOCText(item.children, indent + 1);
    }
  }
  return result;
}

export function generateTOCMarkdown(hierarchy: ContentHierarchy): string {
  const items = buildTOC(hierarchy);
  const lines = ['## Table of Contents', ''];
  function walk(items: TOCItem[], depth = 0): void {
    for (const item of items) {
      const indent = '  '.repeat(depth);
      lines.push(`${indent}- ${item.number} ${item.text}`);
      walk(item.children, depth + 1);
    }
  }
  walk(items);
  lines.push('', '---', '');
  return lines.join('\n');
}

export function generateFigureReference(type: 'figure' | 'table' | 'diagram' | 'code', num: number, id: string): string {
  const labels = { figure: 'Figure', table: 'Table', diagram: 'Diagram', code: 'Listing' };
  return `<span class="ref-link" data-ref="${id}">${labels[type]} ${num}</span>`;
}

export function findNearestHeading(blocks: EnrichedBlock[], index: number): { text: string; number: string } | null {
  for (let i = index; i >= 0; i--) {
    const b = blocks[i];
    if (b.type === 'heading') {
      return { text: b.raw.replace(/^#+\s*/, '').trim(), number: b.number ?? '' };
    }
  }
  return null;
}
