const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'was',
  'were',
  'will',
  'with',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'how',
  'can',
  'could',
  'should',
  'would',
]);

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildIdf(corpus: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const docFreq = new Map<string, number>();
  const n = Math.max(1, corpus.length);

  for (const tokens of corpus) {
    for (const token of new Set(tokens)) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  for (const [token, df] of docFreq.entries()) {
    idf.set(token, Math.log((1 + n) / (1 + df)) + 1);
  }

  return idf;
}

function scoreTokens(
  queryTokens: string[],
  textTokens: string[],
  idf: Map<string, number>,
): number {
  if (queryTokens.length === 0 || textTokens.length === 0) return 0;

  const tf = new Map<string, number>();
  for (const token of textTokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const token of queryTokens) {
    const freq = tf.get(token) ?? 0;
    if (freq === 0) continue;
    const weight = idf.get(token) ?? 1;
    score += (1 + Math.log(freq)) * weight;
  }

  return score;
}

export function rankChunksByKeywords(
  query: string,
  chunks: Array<{ text: string; paragraphIndex: number; source?: 'document' | 'history' }>,
  k = 5,
): Array<{ text: string; paragraphIndex: number; score: number; source: 'document' | 'history' }> {
  const queryTokens = tokenize(query);
  const tokenizedChunks = chunks.map((c) => tokenize(c.text));
  const idf = buildIdf(tokenizedChunks);

  const scored = chunks.map((chunk, i) => {
    const tokens = tokenizedChunks[i];
    const keywordScore = scoreTokens(queryTokens, tokens, idf);
    const sourceBoost = (chunk.source ?? 'document') === 'document' ? 0.1 : 0;

    return {
      text: chunk.text,
      paragraphIndex: chunk.paragraphIndex,
      score: keywordScore + sourceBoost,
      source: chunk.source ?? 'document',
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const withSignal = scored.filter((s) => s.score > 0);
  if (withSignal.length > 0) return withSignal.slice(0, Math.min(k, withSignal.length));
  return scored.slice(0, Math.min(k, scored.length));
}

export function answerWithOfflineNLP(
  query: string,
  rankedChunks: Array<{ text: string; paragraphIndex: number; source: 'document' | 'history' }>,
): string {
  if (rankedChunks.length === 0) {
    return 'I cannot find that in this document.';
  }

  const queryTokens = tokenize(query);
  // Adaptive sentence limit based on query complexity
  const maxSentences = Math.min(5, Math.max(2, Math.ceil(queryTokens.length / 4)));

  const sentenceCandidates: Array<{ sentence: string; score: number; citation: number }> = [];

  for (let i = 0; i < rankedChunks.length; i++) {
    const chunk = rankedChunks[i];
    const sentences = splitSentences(chunk.text);

    for (const sentence of sentences) {
      const sentenceTokens = tokenize(sentence);
      const overlap = scoreTokens(queryTokens, sentenceTokens, new Map());
      const sentenceScore = overlap + Math.min(1, sentence.length / 240);
      if (sentenceScore <= 0) continue;
      sentenceCandidates.push({ sentence, score: sentenceScore, citation: i + 1 });
    }
  }

  sentenceCandidates.sort((a, b) => b.score - a.score);

  const selected: Array<{ sentence: string; citation: number }> = [];
  const seen = new Set<string>();

  for (const candidate of sentenceCandidates) {
    const key = candidate.sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push({ sentence: candidate.sentence, citation: candidate.citation });
    if (selected.length >= maxSentences) break;
  }

  if (selected.length === 0) {
    const fallback = rankedChunks[0].text.trim().slice(0, 240);
    return `${fallback}${fallback.endsWith('.') ? '' : '.'} [1]`;
  }

  return selected
    .map((s) => `${s.sentence}${s.sentence.endsWith('.') ? '' : '.'} [${s.citation}]`)
    .join(' ');
}

function topTerms(text: string, limit = 6): string[] {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

export function buildOfflineCaptureMarkdown(title: string, content: string): string {
  const clean = content.replace(/\s+/g, ' ').trim();
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 40);

  const summarySentences = splitSentences(clean).slice(0, 3);
  const summary = summarySentences.join(' ').trim() || clean.slice(0, 450);
  const terms = topTerms(content, 8);
  const keyPoints =
    summarySentences.length > 0
      ? summarySentences.map((sentence) => `- ${sentence}`)
      : terms
          .slice(0, 3)
          .map((term) => `- ${term}: key topic mentioned repeatedly in this source.`);

  return [
    `# ${title || 'Imported Document'}`,
    '',
    '## SUMMARY',
    summary,
    '',
    '## KEY POINTS',
    ...keyPoints,
    '',
    '## Key Entities',
    ...terms.map((term) => `- **${term}:** (Concept) Mentioned repeatedly in this source.`),
    '',
    '## Main Content',
    ...paragraphs,
  ].join('\n');
}
