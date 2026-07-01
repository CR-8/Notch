import type { LayoutInput } from './types';
import { validateMermaidCode } from '../content-engine/mermaid/validator';
import { autoFixMermaid } from '../content-engine/mermaid/fixer';

const FLOWCHART_SIGNALS =
  /\b(pipeline|workflow|process|deploy|stage|step|ci\/cd|build|test|release)\b/i;
const SEQUENCE_SIGNALS =
  /\b(request|response|api|client|server|call|message|event|handler|endpoint)\b/i;
const ARCHITECTURE_SIGNALS =
  /\b(architecture|system|infrastructure|platform|service|component|layer|module)\b/i;
const STATE_SIGNALS = /\b(state|status|transition|phase|lifecycle|cycle|stage)\b/i;

function detectDiagramType(text: string): string | null {
  const signals: Array<{ re: RegExp; type: string }> = [
    { re: FLOWCHART_SIGNALS, type: 'flowchart' },
    { re: SEQUENCE_SIGNALS, type: 'sequence' },
    { re: ARCHITECTURE_SIGNALS, type: 'architecture' },
    { re: STATE_SIGNALS, type: 'state' },
  ];

  let bestType: string | null = null;
  let bestCount = 0;

  for (const { re, type } of signals) {
    const matches = text.match(re);
    const count = matches ? matches.length : 0;
    if (count > bestCount) {
      bestCount = count;
      bestType = type;
    }
  }

  return bestCount >= 2 ? bestType : null;
}

function sanitizeLabel(s: string): string {
  return s.replace(/["\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

function buildFlowchart(input: LayoutInput): string {
  const entities = input.entities.slice(0, 6);
  if (entities.length < 2) return '';

  const lines = ['flowchart LR'];
  for (let i = 0; i < entities.length - 1; i++) {
    const a = `N${i}["${sanitizeLabel(entities[i].name)}"]`;
    const b = `N${i + 1}["${sanitizeLabel(entities[i + 1].name)}"]`;
    if (i === 0) lines.push(`  ${a}`);
    lines.push(`  ${b}`);
    lines.push(`  N${i} --> N${i + 1}`);
  }
  return lines.join('\n');
}

function buildSequence(input: LayoutInput): string {
  const lines = ['sequenceDiagram'];
  const participants = input.entities.slice(0, 4);
  if (participants.length < 2) return '';

  for (const p of participants) {
    const id = p.name.replace(/[^a-zA-Z]/g, '');
    lines.push(`  participant ${id} as "${sanitizeLabel(p.name)}"`);
  }

  for (let i = 0; i < participants.length - 1; i++) {
    const from = participants[i].name.replace(/[^a-zA-Z]/g, '');
    const to = participants[i + 1].name.replace(/[^a-zA-Z]/g, '');
    lines.push(
      `  ${from}->>${to}: ${sanitizeLabel(input.relationships[i]?.relation || 'Interact')}`,
    );
  }

  return lines.join('\n');
}

function buildArchitecture(input: LayoutInput): string {
  const entities = input.entities.slice(0, 8);
  if (entities.length < 2) return '';

  const lines = ['flowchart TB'];
  for (const e of entities) {
    lines.push(`  ${e.name.replace(/[^a-zA-Z0-9]/g, '')}["${sanitizeLabel(e.name)}"]`);
  }
  for (const r of input.relationships.slice(0, 10)) {
    const a = r.source.replace(/[^a-zA-Z0-9]/g, '');
    const b = r.target.replace(/[^a-zA-Z0-9]/g, '');
    lines.push(`  ${a} -->|${sanitizeLabel(r.relation)}| ${b}`);
  }
  return lines.join('\n');
}

function buildStateDiagram(input: LayoutInput): string {
  const entities = input.entities.slice(0, 4);
  if (entities.length < 2) return '';
  const lines = ['stateDiagram-v2'];
  lines.push(`  [*] --> ${entities[0].name.replace(/[^a-zA-Z]/g, '')}`);
  for (let i = 0; i < entities.length - 1; i++) {
    const a = entities[i].name.replace(/[^a-zA-Z]/g, '');
    const b = entities[i + 1].name.replace(/[^a-zA-Z]/g, '');
    lines.push(`  ${a} --> ${b}`);
  }
  return lines.join('\n');
}

function validateAndRepair(code: string): string {
  if (!code.trim()) return '';
  const v1 = validateMermaidCode(code);
  if (v1.valid) return code;
  const { fixed } = autoFixMermaid(code, v1);
  return validateMermaidCode(fixed).valid ? fixed : '';
}

export function detectAndGenerateDiagrams(md: string, input: LayoutInput): string {
  let result = md;

  if (result.includes('```mermaid')) return result;

  const combined =
    result +
    ' ' +
    input.entities.map((e) => e.name).join(' ') +
    ' ' +
    input.relationships.map((r) => r.source + ' ' + r.target).join(' ');
  const diagramType = detectDiagramType(combined);

  if (!diagramType) return result;

  let mermaid: string;
  switch (diagramType) {
    case 'flowchart':
      mermaid = buildFlowchart(input);
      break;
    case 'sequence':
      mermaid = buildSequence(input);
      break;
    case 'architecture':
      mermaid = buildArchitecture(input);
      break;
    case 'state':
      mermaid = buildStateDiagram(input);
      break;
    default:
      mermaid = buildFlowchart(input);
  }

  mermaid = validateAndRepair(mermaid);
  if (!mermaid) return result;

  const sections = result.split(/(?=^##\s)/m);
  if (sections.length >= 2) {
    const midIdx = Math.floor(sections.length / 2);
    sections.splice(
      midIdx,
      0,
      `\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n*Figure — ${diagramType} diagram of key entities and relationships.*\n`,
    );
    result = sections.join('');
  } else {
    result += `\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n*Figure — ${diagramType} diagram.*\n`;
  }

  return result;
}
