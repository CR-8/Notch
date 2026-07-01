import { describe, it, expect } from 'vitest';
import {
  extractEntities,
  extractConcepts,
  extractTimeline,
  extractRelationships,
  estimateComplexity,
  extractTopics,
  extractKnowledge,
} from '../content-engine/extraction/extractors';

const DEVOPS = `
DevOps is a set of practices that combines software development and IT operations.
CI/CD pipelines automate building and testing. Docker packages applications into containers.
Kubernetes orchestrates those containers across a cluster. Terraform provisions infrastructure
as code. Teams use Monitoring and observability tools like Prometheus and Grafana.
Docker was first released in 2013. Kubernetes was launched in 2014 by Google.
Kubernetes manages Docker containers. Terraform integrates with AWS.
`;

describe('extractEntities', () => {
  it('finds the DevOps technology cluster (fixes "No entities found")', () => {
    const names = extractEntities(DEVOPS).map((e) => e.name);
    expect(names).toContain('DevOps');
    expect(names).toContain('Docker');
    expect(names).toContain('Kubernetes');
    expect(names).toContain('Terraform');
    expect(names).toContain('CI/CD');
  });

  it('counts mentions and attaches a description sentence', () => {
    const docker = extractEntities(DEVOPS).find((e) => e.name === 'Docker')!;
    expect(docker.mentions).toBeGreaterThanOrEqual(2);
    expect(docker.description.toLowerCase()).toContain('docker');
  });
});

describe('extractConcepts', () => {
  it('captures definitional statements', () => {
    const concepts = extractConcepts(DEVOPS);
    expect(concepts.some((c) => /devops/i.test(c.concept))).toBe(true);
  });

  it('rejects sentence fragments as concepts', () => {
    const text = `
      One major drawback is that this approach can be computationally expensive.
      A resampling technique where datasets are sampled with replacement.
      Another critical implication is the increased model complexity.
      Bagging is an ensemble method that reduces variance.
      Boosting is a sequential ensemble technique.
    `;
    const concepts = extractConcepts(text);
    const terms = concepts.map((c) => c.concept);
    // Should capture real concepts
    expect(terms).toContain('Bagging');
    expect(terms).toContain('Boosting');
    // Should NOT capture sentence fragments
    expect(terms).not.toContain('One Major Drawback');
    expect(terms).not.toContain('A Resampling Technique');
    expect(terms).not.toContain('Another Critical Implication');
  });
});

describe('extractTimeline', () => {
  it('extracts dated events sorted chronologically with significance', () => {
    const tl = extractTimeline(DEVOPS);
    expect(tl.length).toBeGreaterThanOrEqual(2);
    expect(tl[0].year <= tl[1].year).toBe(true);
    expect(tl[0].significance.length).toBeGreaterThan(0);
  });
});

describe('extractRelationships', () => {
  it('links entities that co-occur with a relation verb', () => {
    const entities = extractEntities(DEVOPS);
    const rels = extractRelationships(DEVOPS, entities);
    expect(rels.some((r) => r.relation === 'manages' || r.relation === 'integrates-with')).toBe(
      true,
    );
  });
});

describe('complexity', () => {
  it('returns a bounded complexity score', () => {
    const c = estimateComplexity(DEVOPS);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(100);
  });
});

describe('extractTopics', () => {
  it('produces noun-phrase topics not sentence fragments', () => {
    const topics = extractTopics(
      [
        {
          name: 'Machine Learning',
          type: 'concept',
          mentions: 5,
          description: '',
          confidence: 0.9,
        },
        {
          name: 'Ensemble Learning',
          type: 'concept',
          mentions: 3,
          description: '',
          confidence: 0.8,
        },
        {
          name: 'Random Forest',
          type: 'technology',
          mentions: 4,
          description: '',
          confidence: 0.85,
        },
        { name: 'Docker', type: 'technology', mentions: 2, description: '', confidence: 0.75 },
      ],
      [
        { concept: 'Machine Learning', definition: 'A method of data analysis', confidence: 0.9 },
        { concept: 'Bagging', definition: 'Bootstrap aggregating', confidence: 0.8 },
        { concept: 'One Major Drawback', definition: 'A drawback is that...', confidence: 0.2 },
        {
          concept: 'Another Critical Implication',
          definition: 'An implication is...',
          confidence: 0.15,
        },
      ],
    );
    expect(topics).toContain('Machine Learning');
    expect(topics).toContain('Ensemble Learning');
    expect(topics).toContain('Random Forest');
    expect(topics).toContain('Bagging');
    // Should not contain sentence fragments
    expect(topics).not.toContain('One Major Drawback');
    expect(topics).not.toContain('Another Critical Implication');
  });

  it('returns empty for no valid topics', () => {
    const topics = extractTopics([], []);
    expect(topics).toEqual([]);
  });
});

describe('extractKnowledge', () => {
  it('returns a fully populated extraction for obvious content', () => {
    const k = extractKnowledge(DEVOPS);
    expect(k.entities.length).toBeGreaterThan(0);
    expect(k.timeline.length).toBeGreaterThan(0);
    expect(k.topics.length).toBeGreaterThan(0);
    // Confidence and provenance fields are populated (Phase B)
    expect(k.entities[0].confidence).toBeGreaterThan(0);
    expect(k.timeline[0].confidence).toBeGreaterThan(0);
    expect(k.timeline[0].source).toBeDefined();
    expect(k.concepts[0].confidence).toBeGreaterThan(0);
    // Topics should be clean noun phrases
    k.topics.forEach((t) => {
      expect(t.split(/\s+/)[0].toLowerCase()).not.toBe('one');
      expect(t.split(/\s+/)[0].toLowerCase()).not.toBe('another');
      expect(t.split(/\s+/)[0].toLowerCase()).not.toBe('a');
    });
  });

  it('never throws on empty input', () => {
    const k = extractKnowledge('');
    expect(k.entities).toEqual([]);
  });
});
