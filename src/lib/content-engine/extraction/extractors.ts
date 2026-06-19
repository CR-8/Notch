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
} from './types';

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
  'the', 'this', 'that', 'these', 'those', 'a', 'an', 'and', 'or', 'but', 'for',
  'with', 'from', 'into', 'when', 'while', 'then', 'than', 'they', 'their', 'them',
  'it', 'its', 'is', 'are', 'was', 'were', 'be', 'been', 'as', 'at', 'by', 'of',
  'in', 'on', 'to', 'we', 'you', 'he', 'she', 'i', 'our', 'your', 'how', 'what',
  'why', 'which', 'who', 'where', 'figure', 'table', 'section', 'chapter',
]);

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function firstSentenceWith(term: string, sentences: string[]): string {
  const lower = term.toLowerCase();
  const hit = sentences.find((s) => s.toLowerCase().includes(lower));
  return (hit ?? '').slice(0, 240);
}

// ── Entities ─────────────────────────────────────────────────────────────────

export function extractEntities(text: string, max = 24): ExtractedEntity[] {
  const sentences = splitSentences(text);
  const counts = new Map<string, { name: string; type: EntityType; mentions: number }>();

  const bump = (key: string, name: string, type: EntityType) => {
    const existing = counts.get(key);
    if (existing) existing.mentions += 1;
    else counts.set(key, { name, type, mentions: 1 });
  };

  const lowerText = text.toLowerCase();

  // 1. Known dictionary terms (multi-word first so "infrastructure as code" wins).
  for (const [key, { name, type }] of Object.entries(KNOWN_TERMS)) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\b`, 'gi');
    const m = lowerText.match(re);
    if (m) {
      const cur = counts.get(name.toLowerCase());
      if (cur) cur.mentions += m.length;
      else counts.set(name.toLowerCase(), { name, type, mentions: m.length });
    }
  }

  // 2. Acronyms (2–6 uppercase letters, optional slash like CI/CD).
  for (const m of text.matchAll(/\b([A-Z]{2,6}(?:\/[A-Z]{2,6})?)\b/g)) {
    const acr = m[1];
    if (STOPWORDS.has(acr.toLowerCase())) continue;
    if (counts.has(acr.toLowerCase())) continue;
    bump(acr.toLowerCase(), acr, 'technology');
  }

  // 3. Proper nouns: capitalized words/sequences not already captured. Skip the
  //    word that starts a sentence to avoid false positives.
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/);
    for (let i = 1; i < tokens.length; i++) {
      const raw = tokens[i].replace(/[^A-Za-z0-9&.-]/g, '');
      if (!/^[A-Z][a-zA-Z0-9]+/.test(raw)) continue;
      if (raw.length < 3 || STOPWORDS.has(raw.toLowerCase())) continue;
      // Greedily extend across following capitalized tokens (e.g. "Google Cloud").
      let name = raw;
      let j = i + 1;
      while (j < tokens.length && /^[A-Z][a-zA-Z0-9]+/.test(tokens[j])) {
        name += ' ' + tokens[j].replace(/[^A-Za-z0-9&.-]/g, '');
        j++;
        if (name.split(' ').length >= 4) break;
      }
      const key = name.toLowerCase();
      if (!counts.has(key)) bump(key, name, guessType(name));
      else counts.get(key)!.mentions += 1;
      i = j - 1;
    }
  }

  const ranked = [...counts.values()]
    .filter((e) => e.mentions >= 1 && e.name.length >= 2)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, max);

  return ranked.map((e) => ({
    name: e.name,
    type: e.type,
    mentions: e.mentions,
    description: firstSentenceWith(e.name, sentences),
  }));
}

function guessType(name: string): EntityType {
  if (/\b(Inc|Corp|LLC|Ltd|Foundation|University|Institute|Labs?)\b/.test(name)) return 'organization';
  if (/^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(name) && name.split(' ').length === 2) return 'person';
  return 'other';
}

// ── Concepts ─────────────────────────────────────────────────────────────────

// Stop-words that indicate a concept-term is actually a sentence fragment,
// not a true semantic concept. These words at the start of a matched term
// mean the regex caught a false-positive "X is/are Y" pattern in prose.
const CONCEPT_STARTS = new Set([
  'a', 'an', 'the', 'one', 'another', 'other', 'some', 'each', 'every',
  'this', 'that', 'these', 'those', 'such', 'many', 'most', 'few', 'several',
  'our', 'their', 'his', 'her', 'its', 'my', 'your',
  'first', 'second', 'third', 'last', 'next', 'previous', 'final',
  'key', 'main', 'major', 'primary', 'critical', 'important', 'significant',
  'common', 'typical', 'basic', 'simple', 'complex', 'particular',
]);

// Words that indicate the matched "concept" is actually a claim/discussion
// statement rather than a definable term.
const CONCEPT_FRAGMENT_WORDS = new Set([
  'drawback', 'benefit', 'advantage', 'disadvantage', 'limitation',
  'challenge', 'problem', 'solution', 'issue', 'concern', 'risk',
  'implication', 'consequence', 'outcome', 'result', 'effect', 'impact',
  'reason', 'cause', 'factor', 'aspect', 'feature', 'component',
  'example', 'case', 'instance', 'type', 'kind', 'category',
  'way', 'method', 'approach', 'technique', 'strategy', 'tactic',
  'step', 'phase', 'stage', 'part', 'section', 'portion',
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
    const definition = `${concept} ${/^(is|are)\b/.test(m[0].slice(concept.length).trim()) ? '' : ''}`.trim();
    out.push({ concept, definition: (m[0]).replace(/\s+/g, ' ').trim().slice(0, 240) });
    if (out.length >= max) break;
  }

  // Backfill from dictionary concepts present in the text but without a definition
  // sentence, so the glossary is never empty when known terms appear.
  if (out.length < max) {
    const sentences = splitSentences(text);
    const lower = text.toLowerCase();
    for (const { name, type } of Object.values(KNOWN_TERMS)) {
      if (type !== 'concept') continue;
      const key = name.toLowerCase();
      if (seen.has(key) || !lower.includes(key)) continue;
      seen.add(key);
      out.push({ concept: name, definition: firstSentenceWith(name, sentences) || `${name} — referenced in this document.` });
      if (out.length >= max) break;
    }
  }

  return out;
}

// ── Timeline ─────────────────────────────────────────────────────────────────

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
    seen.add(key);
    out.push({
      year,
      event: sentence.slice(0, 200),
      significance: deriveSignificance(sentence),
    });
    if (out.length >= max) break;
  }

  return out.sort((a, b) => a.year.localeCompare(b.year));
}

function deriveSignificance(sentence: string): string {
  const lower = sentence.toLowerCase();
  if (/\b(launch|release|introduc|debut|unveil)/.test(lower)) return 'Introduction / release milestone';
  if (/\b(acqui|merge|partner)/.test(lower)) return 'Strategic / ownership change';
  if (/\b(found|establish|created|born)/.test(lower)) return 'Origin / founding event';
  if (/\b(deprecat|discontinu|shut\s*down|end of life)/.test(lower)) return 'End-of-life / deprecation';
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

// ── Document classification & complexity ─────────────────────────────────────

export function detectDocumentType(text: string): string {
  const l = text.toLowerCase();
  if (/\b(step \d|how to|tutorial|guide|install|getting started)\b/.test(l)) return 'tutorial';
  if (/\b(api reference|parameters|returns|syntax|specification|spec)\b/.test(l)) return 'reference';
  if (/\b(announc|today|breaking|reported|according to)\b/.test(l)) return 'news';
  if (/\b(analysis|tradeoff|implication|we argue|in our view|conclusion)\b/.test(l)) return 'analysis';
  if (/\b(documentation|docs|configure|usage)\b/.test(l)) return 'documentation';
  return 'general';
}

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

export function extractTopics(entities: ExtractedEntity[], concepts: ExtractedConcept[], max = 8): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const c of concepts) {
    const t = c.concept.trim();
    if (t && !seen.has(t.toLowerCase()) && isProperTopic(t)) { seen.add(t.toLowerCase()); topics.push(t); }
    if (topics.length >= max) return topics;
  }
  for (const e of entities) {
    if (e.type === 'concept' || e.type === 'technology') {
      if (!seen.has(e.name.toLowerCase()) && isProperTopic(e.name)) { seen.add(e.name.toLowerCase()); topics.push(e.name); }
    }
    if (topics.length >= max) break;
  }
  return topics;
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
    documentType: detectDocumentType(clean),
    complexity: estimateComplexity(clean),
  };
}
