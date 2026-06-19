import { describe, it, expect } from 'vitest';
import { buildSectionPrompt, generateSection } from '../content-engine/generator/section-generator';
import {
  buildKnowledgeGraphMermaid,
  buildTimelineMermaid,
  validateAndRepair,
  generateVisual,
} from '../content-engine/generator/diagram-generator';
import { assembleDocument, generateDocument } from '../content-engine/generator/orchestrator';
import { extractCodeBlock } from '../content-engine/generator/types';
import { extractKnowledge } from '../content-engine/extraction/extractors';
import { planDocument } from '../content-engine/planner/document-planner';
import type { CompleteFn } from '../content-engine/generator/types';

const SAMPLE = `
DevOps combines development and operations. CI/CD pipelines automate deployment.
Docker containers run on Kubernetes. Docker was released in 2013. Kubernetes launched in 2014.
Kubernetes manages Docker containers. Terraform integrates with AWS.
`;
const knowledge = extractKnowledge(SAMPLE);

describe('section-generator', () => {
  it('scopes the prompt to a single responsibility and forbids headings', () => {
    const section = { id: 'summary', title: 'Summary', responsibility: 'What is this about?', format: 'prose', targetWords: 200, required: true } as const;
    const { system } = buildSectionPrompt({ section, knowledge, sourceText: SAMPLE, title: 'X', depth: 'standard' });
    expect(system).toContain('What is this about?');
    expect(system).toContain('Do NOT');
  });

  it('falls back to extracted data when the model call throws', async () => {
    const failing: CompleteFn = async () => { throw new Error('boom'); };
    const section = { id: 'concepts', title: 'Concepts', responsibility: 'terms', format: 'definitions', targetWords: 180, required: true } as const;
    const out = await generateSection({ section, knowledge, sourceText: SAMPLE, title: 'X', depth: 'standard' }, failing);
    expect(out.markdown.length).toBeGreaterThan(0);
  });

  it('strips a stray heading the model adds anyway', async () => {
    const complete: CompleteFn = async () => '## Summary\nThis is the body.';
    const section = { id: 'summary', title: 'Summary', responsibility: 'x', format: 'prose', targetWords: 100, required: true } as const;
    const out = await generateSection({ section, knowledge, sourceText: SAMPLE, title: 'X', depth: 'fast' }, complete);
    expect(out.markdown).toBe('This is the body.');
  });
});

describe('diagram-generator', () => {
  it('builds a valid knowledge graph from relationships', () => {
    const code = buildKnowledgeGraphMermaid(knowledge);
    expect(code).toMatch(/^graph (LR|TD)/);
    expect(validateAndRepair(code)).not.toBe('');
  });

  it('builds a valid timeline from dated events', () => {
    const code = buildTimelineMermaid(knowledge, 'History');
    expect(code).toMatch(/^timeline/);
    expect(validateAndRepair(code)).not.toBe('');
  });

  it('generates deterministic diagrams without calling the model', async () => {
    let called = false;
    const complete: CompleteFn = async () => { called = true; return ''; };
    const vis = { id: 'v1', kind: 'diagram', diagramType: 'knowledge-graph', direction: 'LR', title: 'Map', rationale: 'r', sectionRef: 'main-content' } as const;
    const out = await generateVisual(vis, knowledge, SAMPLE, 'X', complete);
    expect(called).toBe(false);
    expect(out.mermaid).not.toBe('');
  });

  it('extracts mermaid from a fenced block and repairs invalid code', async () => {
    const complete: CompleteFn = async () => '```mermaid\nflowchart LR\n A[Start] --> B[End]\n```';
    const vis = { id: 'v2', kind: 'diagram', diagramType: 'flowchart', direction: 'LR', title: 'Flow', rationale: 'r', sectionRef: 'main-content' } as const;
    const out = await generateVisual(vis, knowledge, SAMPLE, 'X', complete);
    expect(out.mermaid).toContain('flowchart LR');
  });
});

describe('extractCodeBlock', () => {
  it('pulls inner code from a fenced block', () => {
    expect(extractCodeBlock('```mermaid\nA\n```', 'mermaid')).toBe('A');
  });
});

describe('assembleDocument', () => {
  it('numbers figures sequentially and attaches captions', () => {
    const { markdown, figureCount } = assembleDocument(
      'Doc',
      [{ id: 'main-content', title: 'Main Content', markdown: 'Body.' }],
      [{ id: 'v1', title: 'Map', mermaid: 'graph LR\n N0-->N1', caption: 'why', sectionRef: 'main-content' }],
    );
    expect(figureCount).toBe(1);
    expect(markdown).toContain('# Doc');
    expect(markdown).toContain('```mermaid');
    expect(markdown).toContain('*Figure 1 — Map.* why');
  });
});

describe('generateDocument (orchestration)', () => {
  it('produces an assembled document with sections and a deterministic visual', async () => {
    const complete: CompleteFn = async (_s, _u) => 'Generated section body about the topic.';
    const plan = planDocument(knowledge, 'standard');
    const doc = await generateDocument('DevOps Overview', plan, knowledge, SAMPLE, complete);
    expect(doc.markdown).toContain('# DevOps Overview');
    expect(doc.sections.length).toBe(plan.sections.length);
    expect(doc.wordCount).toBeGreaterThan(0);
    // At least the deterministic knowledge-graph/timeline visual should survive.
    expect(doc.diagramCount).toBeGreaterThanOrEqual(1);
  });
});
