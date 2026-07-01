export type DocumentClass =
  | 'research-paper'
  | 'tutorial'
  | 'reference'
  | 'documentation'
  | 'analysis'
  | 'news'
  | 'blog-post'
  | 'general';

export interface ClassificationSignal {
  re: RegExp;
  weight: number;
  label: string;
}

export interface ClassificationResult {
  documentClass: DocumentClass;
  confidence: number;
  signals: string[];
  scores: Record<DocumentClass, number>;
}

const CLASS_SIGNALS: Record<DocumentClass, ClassificationSignal[]> = {
  'research-paper': [
    {
      re: /\b(abstract|introduction|related work|methodology|experiment|evaluation|conclusion|references)\b/i,
      weight: 3,
      label: 'paper-structure',
    },
    {
      re: /\b(arxiv|doi|proceedings|conference|preprint|submitted|published|accepted)\b/i,
      weight: 2,
      label: 'paper-meta',
    },
    {
      re: /\b(figure \d|table \d|algorithm|equation|dataset|baseline|state-of-the-art|sota)\b/i,
      weight: 1.5,
      label: 'paper-content',
    },
    {
      re: /\b(proposed method|our approach|we introduce|we present|this paper)\b/i,
      weight: 2,
      label: 'paper-claims',
    },
  ],
  tutorial: [
    {
      re: /\b(step \d|how to|tutorial|guide|walkthrough|hands-on)\b/i,
      weight: 3,
      label: 'tutorial-type',
    },
    {
      re: /\b(install|getting started|prerequisites|setup|configuration)\b/i,
      weight: 2,
      label: 'tutorial-setup',
    },
    {
      re: /\b(you will learn|by the end|in this tutorial|follow along)\b/i,
      weight: 2,
      label: 'tutorial-goal',
    },
    {
      re: /\b(example|exercise|practice|demo|playground|try it)\b/i,
      weight: 1,
      label: 'tutorial-practice',
    },
  ],
  reference: [
    {
      re: /\b(api reference|parameters|returns|syntax|specification|spec)\b/i,
      weight: 3,
      label: 'ref-type',
    },
    {
      re: /\b(function|method|class|interface|type|enum|module)\b/i,
      weight: 1.5,
      label: 'ref-code',
    },
    { re: /\b(throws|exception|error|return value|example)\b/i, weight: 1, label: 'ref-detail' },
    { re: /\b(type|interface|extends|implements|abstract)\b/i, weight: 1, label: 'ref-oo' },
  ],
  documentation: [
    {
      re: /\b(documentation|docs|read the docs|user guide|manual)\b/i,
      weight: 2.5,
      label: 'docs-type',
    },
    {
      re: /\b(configure|usage|how it works|overview|architecture)\b/i,
      weight: 1.5,
      label: 'docs-overview',
    },
    {
      re: /\b(option|flag|argument|property|attribute|field)\b/i,
      weight: 1,
      label: 'docs-options',
    },
    {
      re: /\b(see also|note|tip|warning|caution|important)\b/i,
      weight: 1,
      label: 'docs-admonition',
    },
  ],
  analysis: [
    {
      re: /\b(analysis|tradeoff|implication|we argue|in our view|conclusion)\b/i,
      weight: 2.5,
      label: 'analysis-type',
    },
    {
      re: /\b(however|therefore|thus|consequently|nevertheless|furthermore)\b/i,
      weight: 1,
      label: 'analysis-reasoning',
    },
    {
      re: /\b(advantage|disadvantage|pro|con|benefit|drawback|limitation)\b/i,
      weight: 2,
      label: 'analysis-eval',
    },
    {
      re: /\b(compared to|in contrast|on the other hand|alternatively)\b/i,
      weight: 1.5,
      label: 'analysis-comparison',
    },
  ],
  news: [
    {
      re: /\b(announc|today|yesterday|breaking|reported|according to)\b/i,
      weight: 2.5,
      label: 'news-timing',
    },
    {
      re: /\b(source said|official|statement|press release|leak|rumor)\b/i,
      weight: 1.5,
      label: 'news-source',
    },
    { re: /\b(reveal|unveil|launch|release|introduc|debut)\b/i, weight: 1.5, label: 'news-event' },
    {
      re: /\b(analysis|reaction|impact|industry|market|shares)\b/i,
      weight: 1,
      label: 'news-impact',
    },
  ],
  'blog-post': [
    {
      re: /\b(i think|i believe|in my opinion|my take|personal)\b/i,
      weight: 2,
      label: 'blog-opinion',
    },
    {
      re: /\b(i have been|i started|my experience|i learned|i discovered)\b/i,
      weight: 2,
      label: 'blog-narrative',
    },
    { re: /\b(read more|subscribe|comments|share|like this)\b/i, weight: 1.5, label: 'blog-cta' },
    {
      re: /\b(tips|tricks|lessons|things i wish|what i learned)\b/i,
      weight: 1.5,
      label: 'blog-advice',
    },
  ],
  general: [],
};

export function classifyDocument(
  text: string,
  hints?: { isPaper?: boolean; wordCount?: number },
): ClassificationResult {
  const head = text.slice(0, 8000);
  const lower = head.toLowerCase();

  const scores: Record<string, number> = {};
  const signals: string[] = [];

  for (const [docClass, sigs] of Object.entries(CLASS_SIGNALS)) {
    let total = 0;
    for (const sig of sigs) {
      const matches = lower.match(sig.re);
      if (matches) {
        total += matches.length * sig.weight;
        signals.push(`${sig.label}×${matches.length}`);
      }
    }
    scores[docClass] = total;
  }

  if (hints?.isPaper) scores['research-paper'] = (scores['research-paper'] ?? 0) + 5;

  if (hints?.wordCount !== undefined && hints.wordCount < 300) {
    scores['research-paper'] = (scores['research-paper'] ?? 0) * 0.3;
    scores['blog-post'] = (scores['blog-post'] ?? 0) + 1;
  }

  if (hints?.wordCount !== undefined && hints.wordCount > 4000) {
    scores['blog-post'] = (scores['blog-post'] ?? 0) * 0.3;
  }

  let best: DocumentClass = 'general';
  let bestScore = -1;
  let secondScore = -1;

  for (const [docClass, score] of Object.entries(scores)) {
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      best = docClass as DocumentClass;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const gap = bestScore - secondScore;
  const confidence =
    totalScore > 0
      ? Math.min(1, (bestScore / totalScore) * 0.6 + Math.min(gap / (bestScore || 1), 1) * 0.4)
      : 0.2;

  return {
    documentClass: best === 'general' && hints?.isPaper ? 'research-paper' : best,
    confidence: Math.round(confidence * 100) / 100,
    signals,
    scores: scores,
  };
}

export function documentClassLabel(dc: DocumentClass): string {
  const labels: Record<DocumentClass, string> = {
    'research-paper': 'Research Paper',
    tutorial: 'Tutorial',
    reference: 'Reference',
    documentation: 'Documentation',
    analysis: 'Analysis',
    news: 'News',
    'blog-post': 'Blog Post',
    general: 'General',
  };
  return labels[dc];
}
