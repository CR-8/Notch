import type { LayoutInput } from './types';

function sanitizeLabel(s: string): string {
  return s
    .replace(/["\n\r]/g, ' ')
    .replace(/[<>[\]{}()|]/g, '')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

export function buildKnowledgeGraph(md: string, input: LayoutInput): string {
  if (input.relationships.length === 0 && input.entities.length < 4) return md;

  if (md.includes('```mermaid')) return md;

  const lines = ['graph LR'];
  const ids = new Map<string, string>();
  let nodeCounter = 0;

  function ensure(name: string): string {
    const key = name.toLowerCase();
    if (!ids.has(key)) {
      ids.set(key, `N${nodeCounter++}`);
    }
    return ids.get(key)!;
  }

  if (input.relationships.length > 0) {
    for (const r of input.relationships.slice(0, 16)) {
      const a = ensure(r.source);
      const b = ensure(r.target);
      lines.push(
        `  ${a}["${sanitizeLabel(r.source)}"] -->|${sanitizeLabel(r.relation)}| ${b}["${sanitizeLabel(r.target)}"]`,
      );
    }
  } else {
    const center = input.entities[0].name;
    const c = ensure(center);
    for (const e of input.entities.slice(1, 10)) {
      const n = ensure(e.name);
      if (lines.length === 1) lines.push(`  ${c}["${sanitizeLabel(center)}"]`);
      lines.push(`  ${n}["${sanitizeLabel(e.name)}"]`);
      lines.push(`  ${c} --> ${n}`);
    }
  }

  const mermaid = lines.join('\n');

  const sections = md.split(/(?=^##\s)/m);
  if (sections.length >= 2) {
    const lastIdx = sections.length - 1;
    sections.splice(
      lastIdx,
      0,
      `\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n*Knowledge graph showing entity relationships.*\n`,
    );
    return sections.join('');
  }

  return md + `\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n*Knowledge graph.*\n`;
}
