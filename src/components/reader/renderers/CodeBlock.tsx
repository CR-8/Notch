import { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  language: string;
  content: string;
  filename?: string;
  showLineNumbers?: boolean;
  number?: number;
  highlightLines?: number[];
  diff?: boolean;
}

const LANG_LABELS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  py: 'Python',
  rs: 'Rust',
  go: 'Go',
  rb: 'Ruby',
  java: 'Java',
  kt: 'Kotlin',
  swift: 'Swift',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  php: 'PHP',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  md: 'Markdown',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  sql: 'SQL',
  graphql: 'GraphQL',
  dockerfile: 'Dockerfile',
  toml: 'TOML',
  env: '.env',
  diff: 'Diff',
  mermaid: 'Mermaid',
  plantuml: 'PlantUML',
};

function CodeBlockComponent({
  language,
  content,
  filename,
  showLineNumbers = true,
  number,
  highlightLines = [],
  diff = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);

  const lines = content.split('\n');
  const lineCount = lines.length;
  const isLong = lineCount > 20;
  const langLabel = LANG_LABELS[language] || language || 'Text';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  const displayLines = collapsed && isLong ? lines.slice(0, 8) : lines;

  return (
    <div
      className={cn(
        'group/code my-6 overflow-hidden rounded-lg border border-hairline bg-canvas-soft',
        fullscreen && 'fixed inset-4 z-50 my-0 flex flex-col shadow-level-2',
      )}
      data-code-lang={language}
    >
      <div className="flex items-center justify-between gap-2 border-b border-hairline bg-surface px-3 py-1.5 text-[12px]">
        <div className="flex items-center gap-2 min-w-0">
          {number != null && (
            <span className="shrink-0 font-mono text-[10px] text-ink-faint">Listing {number}</span>
          )}
          <span className="inline-flex items-center gap-1 rounded bg-soft-cloud px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-muted">
            {langLabel}
          </span>
          {filename && <span className="truncate text-ink-muted">{filename}</span>}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/code:opacity-100">
          {diff && (
            <span className="mr-1 rounded bg-accent-orange/10 px-1.5 py-0.5 text-[10px] text-accent-orange">
              diff
            </span>
          )}

          <button
            onClick={() => setWrapLines(!wrapLines)}
            className={cn(
              'rounded px-1.5 py-1 text-[11px] font-medium hover:bg-surface-hover',
              wrapLines ? 'text-ink' : 'text-ink-faint hover:text-ink-muted',
            )}
            aria-label={wrapLines ? 'Disable word wrap' : 'Enable word wrap'}
            title={wrapLines ? 'Disable word wrap' : 'Enable word wrap'}
          >
            Wrap
          </button>

          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="rounded px-1.5 py-1 text-[11px] font-medium text-ink-faint hover:bg-surface-hover hover:text-ink-muted"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? 'Exit' : 'Full'}
          </button>

          <div className="mx-0.5 h-3 w-px bg-hairline" />

          <button
            onClick={handleCopy}
            className={cn(
              'rounded px-1.5 py-1 text-[11px] font-medium hover:bg-surface-hover',
              copied ? 'text-success' : 'text-ink-faint hover:text-ink-muted',
            )}
            aria-label={copied ? 'Copied' : 'Copy code'}
            title={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      </div>

      <div className={cn('overflow-auto', fullscreen && 'flex-1')}>
        <pre
          className={cn(
            'relative p-4 font-mono text-[13px] leading-relaxed',
            wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre',
          )}
        >
          {displayLines.map((line, i) => {
            const lineNum = i + 1;
            const isHighlighted = highlightLines.includes(lineNum);
            const isDiffAdd = diff && line.startsWith('+');
            const isDiffRemove = diff && line.startsWith('-');

            return (
              <div
                key={i}
                className={cn(
                  'flex min-h-[1.4em]',
                  isHighlighted && 'bg-primary/5 -mx-4 px-4',
                  isDiffAdd && 'bg-success/5 -mx-4 px-4',
                  isDiffRemove && 'bg-sale/5 -mx-4 px-4',
                )}
              >
                {showLineNumbers && (
                  <span
                    className="mr-4 min-w-[2.5rem] shrink-0 select-none text-right text-[11px] leading-relaxed text-ink-faint/40"
                    aria-hidden="true"
                  >
                    {lineNum}
                  </span>
                )}
                <span
                  className={cn('flex-1', isDiffAdd && 'text-success', isDiffRemove && 'text-sale')}
                >
                  {isDiffAdd ? line.slice(1) : isDiffRemove ? line.slice(1) : line || ' '}
                </span>
              </div>
            );
          })}
        </pre>
      </div>

      {isLong && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-1 border-t border-hairline bg-surface py-1.5 text-[11px] text-ink-faint hover:text-ink-muted transition-colors"
        >
          {collapsed ? (
            <>
              <span aria-hidden>▾</span>
              Show {lineCount - 8} more lines ({lineCount} total)
            </>
          ) : (
            <>
              <span aria-hidden>▸</span>
              Collapse
            </>
          )}
        </button>
      )}

      {fullscreen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          style={{ zIndex: 40 }}
          onClick={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}

export const CodeBlock = memo(CodeBlockComponent);
