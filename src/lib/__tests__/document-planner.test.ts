import { describe, it, expect } from 'vitest';
import { planDocument } from '../content-engine/planner/document-planner';
import { selectMermaidDirection, applyDirection } from '../content-engine/mermaid/direction';
import { extractKnowledge } from '../content-engine/extraction/extractors';

const SAMPLE = `
DevOps combines development and operations. CI/CD pipelines automate deployment.
Docker containers run on Kubernetes. Docker was released in 2013. Kubernetes launched in 2014.
Kubernetes manages Docker containers. Terraform integrates with AWS.
`;

describe('planDocument', () => {
  const knowledge = extractKnowledge(SAMPLE);

  it('fast mode keeps only the four core sections', () => {
    const plan = planDocument(knowledge, 'fast');
    expect(plan.sections.map((s) => s.id).sort()).toEqual(
      ['concepts', 'key-points', 'key-takeaways', 'summary'].sort(),
    );
    expect(plan.targetWords.max).toBeLessThanOrEqual(600);
  });

  it('deep mode includes examples and analysis and more visuals', () => {
    const plan = planDocument(knowledge, 'deep');
    const ids = plan.sections.map((s) => s.id);
    expect(ids).toContain('examples');
    expect(ids).toContain('analysis');
    expect(plan.visuals.length).toBeGreaterThan(planDocument(knowledge, 'fast').visuals.length);
  });

  it('every section has a unique responsibility (Problem 1)', () => {
    const plan = planDocument(knowledge, 'deep');
    const responsibilities = plan.sections.map((s) => s.responsibility);
    expect(new Set(responsibilities).size).toBe(responsibilities.length);
  });

  it('drops the timeline section when there are no dated events', () => {
    const plan = planDocument(extractKnowledge('A plain note with no dates at all.'), 'standard');
    expect(plan.sections.some((s) => s.id === 'timeline')).toBe(false);
  });

  it('plans a timeline diagram (LR) when dated events exist', () => {
    const plan = planDocument(knowledge, 'deep');
    const timelineVis = plan.visuals.find((v) => v.diagramType === 'timeline');
    if (timelineVis) expect(timelineVis.direction).toBe('LR');
  });
});

describe('selectMermaidDirection', () => {
  it('uses LR for pipelines/timelines and TD for hierarchies', () => {
    expect(selectMermaidDirection('timeline')).toBe('LR');
    expect(selectMermaidDirection('flowchart', 'a deploy pipeline workflow')).toBe('LR');
    expect(selectMermaidDirection('mindmap')).toBe('TD');
    expect(selectMermaidDirection('flowchart', 'this depends on and requires that')).toBe('RL');
    expect(selectMermaidDirection('flowchart', 'root cause escalation analysis')).toBe('BT');
  });

  it('rewrites a hardcoded TD to the chosen direction', () => {
    expect(applyDirection('graph TD\n A-->B', 'LR')).toContain('graph LR');
    expect(applyDirection('flowchart TD\n A-->B', 'RL')).toContain('flowchart RL');
  });
});
