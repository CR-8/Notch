import { Fragment } from 'react';
import { parseInline } from '../../markdown/inline-md';

/** Renders the inline-markdown subset (bold/italic/code/link) as React nodes. */
export function InlineMarkdown({ text }: { text: string }) {
  const tokens = parseInline(text);
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'bold':
            return (
              <strong key={i} className="font-semibold text-[var(--color-ink)]">
                {t.text}
              </strong>
            );
          case 'italic':
            return <em key={i}>{t.text}</em>;
          case 'code':
            return (
              <code
                key={i}
                className="px-1 py-0.5 rounded bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)] font-mono text-[12px]"
              >
                {t.text}
              </code>
            );
          case 'link':
            return (
              <a
                key={i}
                href={t.href}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-primary)] underline"
              >
                {t.text}
              </a>
            );
          default:
            return <Fragment key={i}>{t.text}</Fragment>;
        }
      })}
    </>
  );
}
