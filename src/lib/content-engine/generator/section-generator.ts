// ── Per-section generator (Problem 1 — kills cross-section repetition) ────────
// Each section is generated in its OWN call that sees only its responsibility plus
// the relevant slice of extracted knowledge. Because no call can see what the other
// sections say, sections cannot rephrase each other.

import type { KnowledgeExtraction } from '../extraction/types';
import type { SectionPlan, PlanDepth } from '../planner/document-planner';
import type { CompleteFn, GeneratedSection } from './types';

export interface SectionGenInput {
  section: SectionPlan;
  knowledge: KnowledgeExtraction;
  sourceText: string;
  title: string;
  depth: PlanDepth;
}

const FORMAT_RULES: Record<SectionPlan['format'], string> = {
  prose: 'Write flowing prose in full paragraphs. No bullet lists.',
  bullets: 'Output Markdown bullet points only (`- `). Never write paragraphs. Each bullet is one self-contained idea.',
  definitions: 'Output a Markdown definition list, one per line: `**Term** — definition.` No paragraphs, no repetition.',
  timeline: 'Output one bullet per event: `- **<year>** — <event> — <significance>`. Chronological order.',
};

function knowledgeContext(section: SectionPlan, k: KnowledgeExtraction): string {
  switch (section.id) {
    case 'concepts':
      return k.concepts.length
        ? 'Known concepts to define (ground your definitions in these, add others you find):\n' +
          k.concepts.map((c) => `- ${c.concept}`).join('\n')
        : '';
    case 'timeline':
      return k.timeline.length
        ? 'Dated events extracted from the source:\n' +
          k.timeline.map((t) => `- ${t.year}: ${t.event}`).join('\n')
        : '';
    case 'key-points':
    case 'summary':
      return k.entities.length
        ? 'Key entities detected: ' + k.entities.slice(0, 12).map((e) => e.name).join(', ')
        : '';
    case 'analysis':
      return k.relationships.length
        ? 'Detected relationships (use for tradeoff/implication analysis):\n' +
          k.relationships.map((r) => `- ${r.source} ${r.relation} ${r.target}`).join('\n')
        : '';
    default:
      return '';
  }
}

/** Builds the isolated prompt for one section. Pure — unit testable. */
export function buildSectionPrompt(input: SectionGenInput): { system: string; user: string } {
  const { section, knowledge, sourceText, title } = input;
  const ctx = knowledgeContext(section, knowledge);

  const system = [
    'You are a senior technical writer composing ONE section of a professional report.',
    `The document is titled: "${title}".`,
    `This section is "${section.title}". Its ONLY job: ${section.responsibility}`,
    'Write ONLY this section. Do NOT restate other sections, do NOT add a heading, do NOT add preamble.',
    `${FORMAT_RULES[section.format]}`,
    `Target length: about ${section.targetWords} words.`,
    'Interpret and explain like an expert — never just paraphrase the source.',
  ].join('\n');

  const user = [
    ctx ? ctx + '\n' : '',
    'SOURCE CONTENT:',
    sourceText.slice(0, 14000),
  ].join('\n');

  return { system, user };
}

/** Deterministic fallback body when the model call fails — never empty. */
function fallbackBody(input: SectionGenInput): string {
  const { section, knowledge } = input;
  switch (section.format) {
    case 'definitions':
      return knowledge.concepts.slice(0, 8).map((c) => `**${c.concept}** — ${c.definition}`).join('\n')
        || '_No concepts were extracted from this document._';
    case 'timeline':
      return knowledge.timeline.map((t) => `- **${t.year}** — ${t.event} — ${t.significance}`).join('\n')
        || '_No dated events were found._';
    case 'bullets':
      return knowledge.entities.slice(0, 6).map((e) => `- ${e.name}: ${e.description || e.type}`).join('\n')
        || '_No key points available._';
    default:
      return '_This section could not be generated; please retry._';
  }
}

export async function generateSection(input: SectionGenInput, complete: CompleteFn): Promise<GeneratedSection> {
  const { section } = input;
  try {
    const { system, user } = buildSectionPrompt(input);
    const text = (await complete(system, user)).trim();
    // Strip a leading heading if the model added one despite instructions.
    const body = text.replace(/^#{1,6}\s+.*\n+/, '').trim();
    return { id: section.id, title: section.title, markdown: body || fallbackBody(input) };
  } catch {
    return { id: section.id, title: section.title, markdown: fallbackBody(input) };
  }
}
