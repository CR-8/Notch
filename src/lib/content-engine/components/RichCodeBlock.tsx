import { useState, useCallback } from 'react';
import type { CodeBlockElement } from '../types';

interface RichCodeBlockProps {
  data: CodeBlockElement;
  number?: number;
}

const COPY_DURATION = 2000;

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript', ts: 'TypeScript', py: 'Python', rb: 'Ruby',
  go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', swift: 'Swift',
  c: 'C', cpp: 'C++', cs: 'C#', php: 'PHP', r: 'R',
  sql: 'SQL', html: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass',
  sh: 'Shell', bash: 'Bash', zsh: 'Zsh', ps1: 'PowerShell',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', toml: 'TOML',
  md: 'Markdown', mermaid: 'Mermaid', plantuml: 'PlantUML',
  dockerfile: 'Dockerfile', graphql: 'GraphQL',
};

export function RichCodeBlock({ data, number }: RichCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const lines = data.content.split('\n');
  const langLabel = LANGUAGE_LABELS[data.language] || data.language || 'Code';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.content);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_DURATION);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = data.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_DURATION);
    }
  }, [data.content]);

  return (
    <div className="my-6 group" data-code-lang={data.language}>
      {data.caption && (
        <p className="text-[13px] text-[var(--color-ink-muted)] mb-1.5 font-medium">
          {number ? `Listing ${number}: ` : ''}{data.caption}
        </p>
      )}

      <div className="rounded-lg border border-[var(--color-hairline)] overflow-hidden bg-[var(--color-canvas-soft)]">
        <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--color-surface)] border-b border-[var(--color-hairline)]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--color-ink-muted)] uppercase tracking-wider">
              {langLabel}
            </span>
            {data.language && (
              <span className="text-[10px] font-mono text-[var(--color-ink-faint)]">
                .{data.language}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[11px] px-2 py-0.5 rounded text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
            <button
              onClick={handleCopy}
              className="text-[11px] px-2 py-0.5 rounded text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="hover:bg-[var(--color-surface-hover)]/50">
                    {data.showLineNumbers && (
                      <td className="select-none text-right px-3 py-0 text-[12px] leading-[1.6] text-[var(--color-ink-faint)] border-r border-[var(--color-hairline)] align-top w-[3rem] min-w-[3rem]">
                        <span>{i + 1}</span>
                      </td>
                    )}
                    <td className="px-4 py-0 text-[13px] leading-[1.6] font-mono text-[var(--color-ink)] whitespace-pre">
                      {line || ' '}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
