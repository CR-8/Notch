import { useMemo, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '@/lib/sanitize';
import { renderMath } from '@/lib/markdown/math';
import type {
  EnrichedBlock,
  EnrichedDocument,
  DiagramElement,
  CalloutElement,
  ImageElement,
} from '../types';
import { parseToEnrichedAST } from '../ast';
import { buildTOC } from '../hierarchy';
import type { TOCItem } from '../hierarchy';
import { DiagramBlock } from './DiagramBlock';
import { RichCodeBlock } from './RichCodeBlock';
import { CalloutBlock } from './CalloutBlock';
import { RichTable } from './RichTable';
import { ImageBlock } from './ImageBlock';
import { HierarchyNav } from './HierarchyNav';

interface ContentRendererProps {
  content: string;
  theme: 'light' | 'dark';
  enriched?: EnrichedDocument;
  showToc?: boolean;
  showHierarchyNav?: boolean;
  onNavigate?: (id: string) => void;
}

marked.use({
  gfm: true,
  breaks: false,
});

export function ContentRenderer({
  content,
  theme,
  enriched: externalEnriched,
  showToc = false,
  showHierarchyNav = false,
  onNavigate,
}: ContentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigateRef = useRef<((id: string) => void) | null>(null);

  const { blocks, hierarchy } = useMemo(() => {
    if (externalEnriched) {
      return { blocks: externalEnriched.blocks, hierarchy: externalEnriched.hierarchy };
    }
    return parseToEnrichedAST(content ?? '');
  }, [content, externalEnriched]);

  const toc = useMemo(() => buildTOC(hierarchy), [hierarchy]);

  // Problem 7: sequential figure numbers across diagrams + images, by document order.
  const figureNumbers = useMemo(() => {
    const map = new Map<number, number>();
    let n = 0;
    blocks.forEach((b, i) => {
      if (b.type === 'diagram' || b.type === 'image') {
        n += 1;
        map.set(i, n);
      }
    });
    return map;
  }, [blocks]);

  const handleNavigate = useCallback(
    (id: string) => {
      if (onNavigate) {
        onNavigate(id);
        return;
      }
      const el = containerRef.current?.querySelector(`#${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [onNavigate],
  );
  useEffect(() => {
    navigateRef.current = handleNavigate;
  }, [handleNavigate]);

  // Render heading blocks with numbers
  const renderBlock = useCallback(
    (block: EnrichedBlock, index: number): React.ReactNode => {
      switch (block.type) {
        case 'heading': {
          if (!block.level) return null;
          const text = block.raw.replace(/^#{1,6}\s*/, '');
          const prefix = block.number ? `${block.number} ` : '';
          const headingTags = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const;
          const hLevel = block.level as 1 | 2 | 3 | 4 | 5 | 6;
          const HeadingTag = headingTags[hLevel];
          return (
            <HeadingTag
              key={index}
              id={block.id}
              data-heading-number={block.number ?? ''}
              className={`notion-heading-level-${block.level} group relative`}
            >
              <a
                href={`#${block.id}`}
                className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 text-[var(--color-ink-faint)] no-underline transition-opacity text-[14px]"
              >
                #
              </a>
              {prefix}
              {text}
            </HeadingTag>
          );
        }

        case 'paragraph': {
          const html = marked.parse(renderMath(block.raw), { async: false });
          return (
            <div
              key={index}
              className="notion-paragraph"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          );
        }

        case 'diagram': {
          if (!block.data || !('kind' in block.data)) return null;
          return (
            <DiagramBlock
              key={index}
              data={block.data as DiagramElement}
              theme={theme}
              number={figureNumbers.get(index)}
            />
          );
        }

        case 'code': {
          if (!block.data || !('language' in block.data)) {
            const lang = block.raw.match(/^```(\w+)/)?.[1] ?? '';
            const code = block.raw.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
            return (
              <RichCodeBlock
                key={index}
                data={{ type: 'code', language: lang, content: code, showLineNumbers: true }}
                number={hierarchy.codeBlocks.find((c) => c.id === block.id)?.number}
              />
            );
          }
          return (
            <RichCodeBlock
              key={index}
              data={block.data}
              number={hierarchy.codeBlocks.find((c) => c.id === block.id)?.number}
            />
          );
        }

        case 'callout': {
          if (!block.data || !('kind' in block.data)) return null;
          return <CalloutBlock key={index} data={block.data as CalloutElement} />;
        }

        case 'rich_table': {
          if (!block.data || !('columns' in block.data)) return null;
          return (
            <RichTable
              key={index}
              data={block.data}
              number={hierarchy.tables.find((t) => t.id === block.id)?.number}
            />
          );
        }

        case 'blockquote': {
          const html = marked.parse(renderMath(block.raw), { async: false });
          return (
            <blockquote
              key={index}
              className="border-l-3 border-[var(--color-primary)] pl-4 my-4 text-[var(--color-ink-muted)] italic"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          );
        }

        case 'list':
        case 'reference': {
          const html = marked.parse(renderMath(block.raw), { async: false });
          return <div key={index} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
        }

        case 'image': {
          if (!block.data || !('kind' in block.data)) return null;
          return <ImageBlock key={index} data={block.data as ImageElement} />;
        }

        default:
          return null;
      }
    },
    [hierarchy, theme, figureNumbers],
  );

  return (
    <div className="flex gap-6" ref={containerRef}>
      {showHierarchyNav && toc.length > 0 && (
        <div className="hidden xl:block w-[200px] shrink-0">
          <div className="sticky top-4">
            <HierarchyNav hierarchy={hierarchy} toc={toc} onNavigate={handleNavigate} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {showToc && toc.length > 0 && (
          <div className="mb-8 p-4 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)]">
            <h2 className="text-[14px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-3">
              Table of Contents
            </h2>
            <nav className="space-y-0.5">{renderTOCItems(toc, navigateRef)}</nav>
          </div>
        )}

        <div className="notion-prose">{blocks.map((block, i) => renderBlock(block, i))}</div>
      </div>
    </div>
  );
}

function renderTOCItems(
  items: TOCItem[],
  navigateRef: React.RefObject<((id: string) => void) | null>,
  depth = 0,
): React.ReactNode {
  if (depth > 4) return null;
  return (
    <ul className="list-none space-y-0.5">
      {items.map((item, i) => (
        <li key={i}>
          <button
            onClick={() => {
              navigateRef.current?.(item.id);
            }}
            className="w-full text-left flex items-center gap-2 px-2 py-0.5 rounded text-[12px] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)] transition-colors"
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            <span className="text-[10px] text-[var(--color-ink-faint)] shrink-0 font-mono w-5">
              {item.number}
            </span>
            <span className="truncate">{item.text}</span>
          </button>
          {item.children.length > 0 && renderTOCItems(item.children, navigateRef, depth + 1)}
        </li>
      ))}
    </ul>
  );
}
