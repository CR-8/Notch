// ── Deterministic knowledge extractors ───────────────────────────────────────
// Real heuristic NLP (no LLM, no mocks). These guarantee that entities/concepts/
// timeline/relationships are populated even offline or when the model returns junk
// — the direct fix for the "No entities found" failure. The LLM extractor (see
// llm-extractor.ts) can supersede/augment these when a provider is configured.

import type {
  EntityType,
  ExtractedEntity,
  ExtractedConcept,
  ExtractedTimelineEvent,
  ExtractedRelationship,
  RelationKind,
  KnowledgeExtraction,
} from '../../capture/extraction/types';

// Curated technology/standard dictionary (lowercase key → canonical name + type).
// Deliberately covers the DevOps cluster the spec calls out, plus broad common tech.
const KNOWN_TERMS: Record<string, { name: string; type: EntityType }> = {
  devops: { name: 'DevOps', type: 'concept' },
  'ci/cd': { name: 'CI/CD', type: 'concept' },
  cicd: { name: 'CI/CD', type: 'concept' },
  'continuous integration': { name: 'Continuous Integration', type: 'concept' },
  'continuous delivery': { name: 'Continuous Delivery', type: 'concept' },
  'continuous deployment': { name: 'Continuous Deployment', type: 'concept' },
  containers: { name: 'Containers', type: 'technology' },
  container: { name: 'Containers', type: 'technology' },
  docker: { name: 'Docker', type: 'technology' },
  kubernetes: { name: 'Kubernetes', type: 'technology' },
  k8s: { name: 'Kubernetes', type: 'technology' },
  terraform: { name: 'Terraform', type: 'technology' },
  ansible: { name: 'Ansible', type: 'technology' },
  'infrastructure as code': { name: 'Infrastructure as Code', type: 'concept' },
  iac: { name: 'Infrastructure as Code', type: 'concept' },
  monitoring: { name: 'Monitoring', type: 'concept' },
  observability: { name: 'Observability', type: 'concept' },
  prometheus: { name: 'Prometheus', type: 'technology' },
  grafana: { name: 'Grafana', type: 'technology' },
  jenkins: { name: 'Jenkins', type: 'technology' },
  git: { name: 'Git', type: 'technology' },
  github: { name: 'GitHub', type: 'organization' },
  gitlab: { name: 'GitLab', type: 'organization' },
  aws: { name: 'AWS', type: 'organization' },
  azure: { name: 'Azure', type: 'product' },
  gcp: { name: 'Google Cloud', type: 'product' },
  microservices: { name: 'Microservices', type: 'concept' },
  api: { name: 'API', type: 'concept' },
  rest: { name: 'REST', type: 'standard' },
  graphql: { name: 'GraphQL', type: 'technology' },
  grpc: { name: 'gRPC', type: 'technology' },
  serverless: { name: 'Serverless', type: 'concept' },
  'machine learning': { name: 'Machine Learning', type: 'concept' },
  'neural network': { name: 'Neural Network', type: 'concept' },
  llm: { name: 'LLM', type: 'concept' },
  transformer: { name: 'Transformer', type: 'concept' },
  python: { name: 'Python', type: 'technology' },
  javascript: { name: 'JavaScript', type: 'technology' },
  typescript: { name: 'TypeScript', type: 'technology' },
  react: { name: 'React', type: 'technology' },
  postgresql: { name: 'PostgreSQL', type: 'technology' },
  redis: { name: 'Redis', type: 'technology' },
  kafka: { name: 'Kafka', type: 'technology' },
};

const STOPWORDS = new Set([
  'the',
  'this',
  'that',
  'these',
  'those',
  'a',
  'an',
  'and',
  'or',
  'but',
  'for',
  'with',
  'from',
  'into',
  'when',
  'while',
  'then',
  'than',
  'they',
  'their',
  'them',
  'it',
  'its',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'as',
  'at',
  'by',
  'of',
  'in',
  'on',
  'to',
  'we',
  'you',
  'he',
  'she',
  'i',
  'our',
  'your',
  'how',
  'what',
  'why',
  'which',
  'who',
  'where',
  'figure',
  'table',
  'section',
  'chapter',
]);

/** Type weight for salience scoring (Phase B). */
const TYPE_WEIGHT: Record<EntityType, number> = {
  technology: 1.2,
  concept: 1.1,
  organization: 0.9,
  product: 1.0,
  person: 0.8,
  standard: 1.0,
  place: 0.6,
  other: 0.5,
};

/** Confidence floor — entities below this are dropped (Phase B). */
const ENTITY_CONFIDENCE_THRESHOLD = 0.3;

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function _paragraphIndexAt(pos: number, boundaries: number[]): number {
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (pos >= boundaries[i]) return i;
  }
  return 0;
}

function findSource(
  text: string,
  term: string,
): { paragraphIndex: number; snippet: string } | undefined {
  const paras = text.split(/\n\s*\n/);
  const lower = term.toLowerCase();
  for (let i = 0; i < paras.length; i++) {
    const idx = paras[i].toLowerCase().indexOf(lower);
    if (idx !== -1) {
      const start = Math.max(0, idx - 20);
      const end = Math.min(paras[i].length, idx + term.length + 60);
      return { paragraphIndex: i, snippet: paras[i].slice(start, end).trim().slice(0, 120) };
    }
  }
  return undefined;
}

function firstSentenceWith(term: string, sentences: string[]): string {
  const lower = term.toLowerCase();
  const hit = sentences.find((s) => s.toLowerCase().includes(lower));
  return (hit ?? '').slice(0, 240);
}

// ── Entities (Phase B: salience + provenance) ────────────────────────────────

export function extractEntities(text: string, max = 24): ExtractedEntity[] {
  const sentences = splitSentences(text);
  const map = new Map<
    string,
    {
      name: string;
      type: EntityType;
      mentions: number;
      confidence: number;
      source?: { paragraphIndex: number; snippet: string };
    }
  >();

  const add = (key: string, name: string, type: EntityType, confidence: number) => {
    const existing = map.get(key);
    if (existing) {
      existing.mentions += 1;
      // Bump confidence toward the max of existing and new.
      existing.confidence = Math.max(
        existing.confidence,
        confidence * 0.9 + existing.confidence * 0.1,
      );
    } else {
      map.set(key, { name, type, mentions: 1, confidence, source: findSource(text, name) });
    }
  };

  const lowerText = text.toLowerCase();

  // 1. Known dictionary terms — high confidence (0.9).
  for (const [key, { name, type }] of Object.entries(KNOWN_TERMS)) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\b`, 'gi');
    const matches = [...lowerText.matchAll(re)];
    if (matches.length) {
      const existing = map.get(name.toLowerCase());
      if (existing) {
        existing.mentions += matches.length;
        existing.confidence = Math.min(1, existing.confidence + 0.05 * matches.length);
      } else {
        const source = findSource(text, name);
        map.set(name.toLowerCase(), {
          name,
          type,
          mentions: matches.length,
          confidence: 0.9,
          source,
        });
      }
    }
  }

  // 2. Acronyms (2–6 uppercase letters) — medium confidence (0.55).
  for (const m of text.matchAll(/\b([A-Z]{2,6}(?:\/[A-Z]{2,6})?)\b/g)) {
    const acr = m[1];
    if (STOPWORDS.has(acr.toLowerCase())) continue;
    const key = acr.toLowerCase();
    if (map.has(key)) {
      map.get(key)!.mentions += 1;
      continue;
    }
    add(key, acr, 'technology', 0.55);
  }

  // 3. Proper nouns — medium-high confidence (0.65) for multi-word, 0.5 for single.
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/);
    for (let i = 1; i < tokens.length; i++) {
      const raw = tokens[i].replace(/[^A-Za-z0-9&.-]/g, '');
      if (!/^[A-Z][a-zA-Z0-9]+/.test(raw)) continue;
      if (raw.length < 3 || STOPWORDS.has(raw.toLowerCase())) continue;
      let name = raw;
      let j = i + 1;
      while (j < tokens.length && /^[A-Z][a-zA-Z0-9]+/.test(tokens[j])) {
        name += ' ' + tokens[j].replace(/[^A-Za-z0-9&.-]/g, '');
        j++;
        if (name.split(' ').length >= 4) break;
      }
      const key = name.toLowerCase();
      const words = name.split(' ').length;
      const confidence = words >= 2 ? 0.65 : 0.5;
      if (!map.has(key)) add(key, name, guessType(name), confidence);
      else map.get(key)!.mentions += 1;
      i = j - 1;
    }
  }

  // Salience sort: mentions × type weight, filtered by confidence threshold.
  const ranked = [...map.values()]
    .filter(
      (e) => e.mentions >= 1 && e.name.length >= 2 && e.confidence >= ENTITY_CONFIDENCE_THRESHOLD,
    )
    .sort((a, b) => b.mentions * TYPE_WEIGHT[b.type] - a.mentions * TYPE_WEIGHT[a.type])
    .slice(0, max);

  return ranked.map((e) => ({
    name: e.name,
    type: e.type,
    mentions: e.mentions,
    confidence: Math.round(e.confidence * 100) / 100,
    source: e.source,
    description: firstSentenceWith(e.name, sentences),
  }));
}

function guessType(name: string): EntityType {
  if (/\b(Inc|Corp|LLC|Ltd|Foundation|University|Institute|Labs?)\b/.test(name))
    return 'organization';
  if (/^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(name) && name.split(' ').length === 2) return 'person';
  return 'other';
}

// ── Concepts (Phase B: confidence-gated) ─────────────────────────────────────

const CONCEPT_STARTS = new Set([
  'a',
  'an',
  'the',
  'one',
  'another',
  'other',
  'some',
  'each',
  'every',
  'this',
  'that',
  'these',
  'those',
  'such',
  'many',
  'most',
  'few',
  'several',
  'our',
  'their',
  'his',
  'her',
  'its',
  'my',
  'your',
  'first',
  'second',
  'third',
  'last',
  'next',
  'previous',
  'final',
  'key',
  'main',
  'major',
  'primary',
  'critical',
  'important',
  'significant',
  'common',
  'typical',
  'basic',
  'simple',
  'complex',
  'particular',
]);

const CONCEPT_FRAGMENT_WORDS = new Set([
  'drawback',
  'benefit',
  'advantage',
  'disadvantage',
  'limitation',
  'challenge',
  'problem',
  'solution',
  'issue',
  'concern',
  'risk',
  'implication',
  'consequence',
  'outcome',
  'result',
  'effect',
  'impact',
  'reason',
  'cause',
  'factor',
  'aspect',
  'feature',
  'component',
  'example',
  'case',
  'instance',
  'type',
  'kind',
  'category',
  'way',
  'method',
  'approach',
  'technique',
  'strategy',
  'tactic',
  'step',
  'phase',
  'stage',
  'part',
  'section',
  'portion',
]);

/** Signals a definition is substantive, not a throwaway "X is Y" filler. */
const HIGH_VALUE_DEFINITION_WORDS = new Set([
  'method',
  'technique',
  'process',
  'framework',
  'system',
  'approach',
  'paradigm',
  'protocol',
  'standard',
  'architecture',
  'practice',
  'principle',
  'concept',
  'model',
  'strategy',
  'tool',
  'platform',
  'language',
  'algorithm',
  'protocol',
  'mechanism',
  'pattern',
  'discipline',
  'methodology',
  'procedure',
  'workflow',
  'pipeline',
]);

const DEFINITION_RE =
  /\b([A-Z][A-Za-z0-9 /+-]{2,40}?)\s+(?:is|are|refers to|means|is defined as|describes|denotes)\s+(?:a|an|the|the process of|a set of|a way to)?\s*([^.!?]{10,200}[.!?])/g;

function isSentenceFragment(term: string): boolean {
  const lower = term.toLowerCase();
  const firstWord = lower.split(/\s+/)[0];
  if (CONCEPT_STARTS.has(firstWord)) return true;
  const lastWord = lower.split(/\s+/).pop() ?? '';
  if (CONCEPT_FRAGMENT_WORDS.has(lastWord)) return true;
  return false;
}

/** Score 0–1 for how genuine a definition sounds (Phase B). */
function conceptConfidence(term: string, definition: string): number {
  const defLower = definition.toLowerCase();
  let score = 0.5;

  // Definition length correlates with substance.
  if (definition.length > 80) score += 0.2;
  else if (definition.length > 50) score += 0.1;

  // High-value indicator words in definition signal a real concept.
  for (const w of HIGH_VALUE_DEFINITION_WORDS) {
    if (defLower.includes(w)) {
      score += 0.15;
      break;
    }
  }

  // Technical/multi-word terms are more likely true concepts.
  const words = term.split(/\s+/);
  if (words.length >= 2) score += 0.1;
  if (/[A-Z][a-z]+[A-Z]/.test(term)) score += 0.05; // CamelCase

  // Short/generic definitions are suspicious.
  if (definition.length < 30 && !defLower.includes('method') && !defLower.includes('technique'))
    score -= 0.2;

  return Math.max(0.1, Math.min(1, score));
}

export function extractConcepts(text: string, max = 16): ExtractedConcept[] {
  const out: ExtractedConcept[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(DEFINITION_RE)) {
    const concept = m[1].trim().replace(/\s+/g, ' ');
    if (concept.length < 3 || STOPWORDS.has(concept.toLowerCase())) continue;
    if (isSentenceFragment(concept)) continue;
    const key = concept.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rawDef = m[0].replace(/\s+/g, ' ').trim();
    const definition = rawDef.slice(0, 240);
    const conf = conceptConfidence(concept, definition);
    const source = findSource(text, concept);
    out.push({ concept, definition, confidence: Math.round(conf * 100) / 100, source });
    if (out.length >= max) break;
  }

  // Backfill from dictionary concepts — low confidence since no definition found.
  if (out.length < max) {
    const sentences = splitSentences(text);
    const lower = text.toLowerCase();
    for (const { name, type } of Object.values(KNOWN_TERMS)) {
      if (type !== 'concept') continue;
      const key = name.toLowerCase();
      if (seen.has(key) || !lower.includes(key)) continue;
      seen.add(key);
      const def = firstSentenceWith(name, sentences) || `${name} — referenced in this document.`;
      const source = findSource(text, name);
      out.push({ concept: name, definition: def, confidence: 0.4, source });
      if (out.length >= max) break;
    }
  }

  return out;
}

// ── Timeline (Phase B: confidence-gated) ──────────────────────────────────────

/** Temporal signal words that boost timeline confidence. */
const TEMPORAL_SIGNALS =
  /\b(in|from|since|until|during|between|after|before|around|by|as of)\s+(1[89]\d{2}|20\d{2})\b/i;

/** Year at start of a sentence (e.g. "2013 saw...", "2024 marked..."). */
const YEAR_START = /^(1[89]\d{2}|20\d{2})\b/;

/** Non-temporal contexts that produce false-positive year matches. */
const NON_TEMPORAL =
  /\b(copyright|publication|volume|issue|issn|doi|arxiv|page|pp\.|fig\.|table)\b/i;

/** Score 0–1 for how likely a sentence contains a genuine timeline event. */
function timelineConfidence(sentence: string): number {
  const lower = sentence.toLowerCase();
  // Non-temporal context → very low confidence.
  if (NON_TEMPORAL.test(sentence)) return 0.1;
  // Sentence starts with a year + temporal verb → high.
  if (YEAR_START.test(sentence) && /\b(saw|marked|witnessed|became|was|were)\b/.test(lower))
    return 0.9;
  // "In YEAR" / "since YEAR" etc. → high.
  if (TEMPORAL_SIGNALS.test(sentence)) return 0.85;
  // Contains launch/release/found temporal verbs → medium-high.
  if (
    /\b(launch|release|introduc|found|establish|created|debut|unveil|publish|announc|acqui|merged|born|died)\b/.test(
      lower,
    )
  )
    return 0.75;
  // Contains generic temporal verbs → medium.
  if (/\b(became|began|started|ended|transition|migrate|upgrade|adopt)\b/.test(lower)) return 0.6;
  // Year present but no temporal pattern → low.
  return 0.3;
}

const TIMELINE_CONFIDENCE_THRESHOLD = 0.25;

export function extractTimeline(text: string, max = 20): ExtractedTimelineEvent[] {
  const sentences = splitSentences(text);
  const out: ExtractedTimelineEvent[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const yearMatch = sentence.match(/\b(1[89]\d{2}|20\d{2})(?:-(0[1-9]|1[0-2]))?\b/);
    if (!yearMatch) continue;
    const year = yearMatch[2] ? `${yearMatch[1]}-${yearMatch[2]}` : yearMatch[1];
    const key = year + '|' + sentence.slice(0, 40);
    if (seen.has(key)) continue;

    const conf = timelineConfidence(sentence);
    // Phase B: confidence-gate — skip low-confidence matches.
    if (conf < TIMELINE_CONFIDENCE_THRESHOLD) continue;

    seen.add(key);
    out.push({
      year,
      event: sentence.slice(0, 200),
      significance: deriveSignificance(sentence),
      confidence: Math.round(conf * 100) / 100,
      source: { paragraphIndex: 0, snippet: sentence.slice(0, 100) },
    });
    if (out.length >= max) break;
  }

  return out.sort((a, b) => a.year.localeCompare(b.year));
}

function deriveSignificance(sentence: string): string {
  const lower = sentence.toLowerCase();
  if (/\b(launch|release|introduc|debut|unveil)/.test(lower))
    return 'Introduction / release milestone';
  if (/\b(acqui|merge|partner)/.test(lower)) return 'Strategic / ownership change';
  if (/\b(found|establish|created|born)/.test(lower)) return 'Origin / founding event';
  if (/\b(deprecat|discontinu|shut\s*down|end of life)/.test(lower))
    return 'End-of-life / deprecation';
  return 'Notable development';
}

// ── Relationships ────────────────────────────────────────────────────────────

const RELATION_VERBS: Array<{ re: RegExp; kind: RelationKind }> = [
  { re: /\b(uses|leverages|runs on|built on|powered by)\b/i, kind: 'uses' },
  { re: /\b(part of|component of|belongs to|within)\b/i, kind: 'part-of' },
  { re: /\b(depends on|requires|relies on|needs)\b/i, kind: 'depends-on' },
  { re: /\b(integrates with|connects to|works with|interoperates)\b/i, kind: 'integrates-with' },
  { re: /\b(manages|orchestrates|controls|provisions|deploys)\b/i, kind: 'manages' },
  { re: /\b(enables|allows|supports|provides)\b/i, kind: 'enables' },
];

export function extractRelationships(
  text: string,
  entities: ExtractedEntity[],
  max = 24,
): ExtractedRelationship[] {
  const sentences = splitSentences(text);
  const names = entities.map((e) => e.name).sort((a, b) => b.length - a.length);
  const out: ExtractedRelationship[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const present = names.filter((n) => new RegExp(`\\b${escapeRe(n)}\\b`, 'i').test(sentence));
    if (present.length < 2) continue;
    const verb = RELATION_VERBS.find((v) => v.re.test(sentence));
    const kind: RelationKind = verb?.kind ?? 'related-to';
    const [source, target] = present;
    const key = `${source}->${target}:${kind}`;
    if (seen.has(key) || source === target) continue;
    seen.add(key);
    out.push({ source, target, relation: kind });
    if (out.length >= max) break;
  }

  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

// ── Complexity ───────────────────────────────────────────────────────────────

export function estimateComplexity(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length;
  const longWords = words.filter((w) => w.length > 9).length / words.length;
  const sentences = splitSentences(text);
  const avgSentence = words.length / Math.max(1, sentences.length);
  // Blend: word length, share of long words, sentence length. Clamp 0–100.
  const score = avgLen * 6 + longWords * 120 + Math.min(avgSentence, 40) * 0.8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isProperTopic(term: string): boolean {
  const lower = term.toLowerCase();
  const words = lower.split(/\s+/);
  if (words.length > 6) return false;
  const firstWord = words[0];
  if (CONCEPT_STARTS.has(firstWord)) return false;
  const lastWord = words[words.length - 1];
  if (CONCEPT_FRAGMENT_WORDS.has(lastWord)) return false;
  if (words.length >= 3 && CONCEPT_FRAGMENT_WORDS.has(firstWord)) return false;
  return true;
}

export function extractTopics(
  entities: ExtractedEntity[],
  concepts: ExtractedConcept[],
  max = 8,
): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const c of concepts) {
    const t = c.concept.trim();
    if (t && !seen.has(t.toLowerCase()) && isProperTopic(t)) {
      seen.add(t.toLowerCase());
      topics.push(t);
    }
    if (topics.length >= max) return topics;
  }
  for (const e of entities) {
    if (e.type === 'concept' || e.type === 'technology') {
      if (!seen.has(e.name.toLowerCase()) && isProperTopic(e.name)) {
        seen.add(e.name.toLowerCase());
        topics.push(e.name);
      }
    }
    if (topics.length >= max) break;
  }
  return topics;
}

// ── Basic document class heuristic (Phase B: replaces old detectDocumentType) ─

const PAPER_SIGNALS =
  /\b(abstract|introduction|related work|methodology|experiment|evaluation|conclusion|references|arxiv|doi|proceedings|submitted|published|conference|preprint)\b/i;
const TUTORIAL_SIGNALS = /\b(step \d|how to|tutorial|guide|install|getting started|walkthrough)\b/i;
const REFERENCE_SIGNALS = /\b(api reference|parameters|returns|syntax|specification)\b/i;

function guessDocumentClass(text: string): string {
  const l = text.toLowerCase().slice(0, 5000);
  if (PAPER_SIGNALS.test(l) && /\b(abstract|introduction)\b/i.test(l)) return 'research-paper';
  if (TUTORIAL_SIGNALS.test(l)) return 'tutorial';
  if (REFERENCE_SIGNALS.test(l)) return 'reference';
  if (/\b(documentation|docs|configure|usage)\b/i.test(l)) return 'documentation';
  if (/\b(analysis|tradeoff|implication|conclusion)\b/i.test(l)) return 'analysis';
  if (/\b(announc|today|breaking|reported)\b/i.test(l)) return 'news';
  return 'general';
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/** Runs the full deterministic extraction pipeline on raw text. Pure. */
export function extractKnowledge(text: string): KnowledgeExtraction {
  const clean = (text ?? '').slice(0, 60000);
  const entities = extractEntities(clean);
  const concepts = extractConcepts(clean);
  const timeline = extractTimeline(clean);
  const relationships = extractRelationships(clean, entities);
  return {
    entities,
    concepts,
    timeline,
    relationships,
    topics: extractTopics(entities, concepts),
    documentType: guessDocumentClass(clean),
    complexity: estimateComplexity(clean),
  };
}
