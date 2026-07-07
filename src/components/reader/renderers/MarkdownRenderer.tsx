import { useMemo, useCallback, useEffect } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '@/lib/sanitize';
import { renderMath } from '@/lib/markdown/math';
import { parseToEnrichedAST, applyNumberingToBlocks } from '@/lib/content-engine/ast';
import { buildTOC } from '@/lib/content-engine/hierarchy';
import type { TOCItem } from '@/lib/content-engine/hierarchy';
import { DiagramBlock } from '@/lib/content-engine/components/DiagramBlock';
import { ImageBlock } from '@/lib/content-engine/components/ImageBlock';
import { RichTable } from '@/lib/content-engine/components/RichTable';
import type {
  EnrichedBlock,
  DiagramElement,
  CalloutElement,
  ImageElement,
} from '@/lib/content-engine/types';
import { CodeBlock } from './CodeBlock';
import { CalloutRenderer } from './CalloutRenderer';
import { HeadingRenderer } from './HeadingRenderer';

export interface ParsedDocument {
  blocks: EnrichedBlock[];
  toc: TOCItem[];
  headingIds: string[];
  warnings: string[];
}

marked.use({ gfm: true, breaks: false });

export function parseDocument(content: string): ParsedDocument {
  const { blocks, hierarchy, warnings } = parseToEnrichedAST(content ?? '');
  const numbered = applyNumberingToBlocks(blocks, hierarchy);
  const toc = buildTOC(hierarchy);
  const headingIds = numbered.filter((b) => b.type === 'heading' && b.id).map((b) => b.id!);

  return { blocks: numbered, toc, headingIds, warnings };
}

export function MarkdownRenderer({
  content,
  theme,
  onTocReady,
}: {
  content: string;
  theme: 'light' | 'dark';
  onTocReady?: (data: ParsedDocument) => void;
}) {
  const parsed = useMemo(() => parseDocument(content), [content]);

  useEffect(() => {
    onTocReady?.(parsed);
  }, [parsed, onTocReady]);

  const figureNumbers = useMemo(() => {
    const map = new Map<number, number>();
    let n = 0;
    parsed.blocks.forEach((b, i) => {
      if (b.type === 'diagram' || b.type === 'image') {
        n += 1;
        map.set(i, n);
      }
    });
    return map;
  }, [parsed.blocks]);

  const codeNumbers = useMemo(() => {
    const map = new Map<number, number>();
    let n = 0;
    parsed.blocks.forEach((b, i) => {
      if (b.type === 'code') {
        n += 1;
        map.set(i, n);
      }
    });
    return map;
  }, [parsed.blocks]);

  const renderBlock = useCallback(
    (block: EnrichedBlock, index: number): React.ReactNode => {
      switch (block.type) {
        case 'heading': {
          if (!block.level) return null;
          const text = block.raw
            .replace(/^#{1,6}\s*/, '')
            .replace(/[*_~`]+/g, '')
            .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');
          // BUG-003: if the source heading already carries a section number
          // (e.g. "4.2 Diplomatic Leverage"), keep the author's number and drop
          // our computed one so only a single numbering system ever shows.
          const hasOwnNumber = /^\d+(\.\d+)*\.?\s+\S/.test(text);
          return (
            <HeadingRenderer
              key={`h-${index}`}
              level={Math.min(block.level, 6) as 1 | 2 | 3 | 4 | 5 | 6}
              id={block.id ?? `h-${index}`}
              number={hasOwnNumber ? undefined : block.number}
              text={text}
            />
          );
        }

        case 'paragraph': {
          const html = marked.parse(renderMath(block.raw), { async: false });
          return (
            <div
              key={`p-${index}`}
              className="reader-paragraph"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          );
        }

        case 'diagram': {
          if (!block.data || !('kind' in block.data)) return null;
          return (
            <DiagramBlock
              key={`dgm-${index}`}
              data={block.data as DiagramElement}
              theme={theme}
              number={figureNumbers.get(index)}
            />
          );
        }

        case 'code': {
          const lang = (block.data as { language: string }).language;
          const codeContent = (block.data as { content: string }).content;
          return (
            <CodeBlock
              key={`code-${index}`}
              language={lang}
              content={codeContent}
              showLineNumbers
              number={codeNumbers.get(index)}
            />
          );
        }

        case 'callout': {
          if (!block.data || !('kind' in block.data)) return null;
          const calloutData = block.data as CalloutElement;
          const html = marked.parse(renderMath(calloutData.content), { async: false });
          return (
            <CalloutRenderer
              key={`callout-${index}`}
              kind={calloutData.kind}
              content={sanitizeHtml(html)}
              title={calloutData.title}
            />
          );
        }

        case 'rich_table': {
          if (!block.data || !('columns' in block.data)) return null;
          return <RichTable key={`table-${index}`} data={block.data} />;
        }

        case 'blockquote': {
          const html = marked.parse(renderMath(block.raw), { async: false });
          return (
            <blockquote
              key={`bq-${index}`}
              className="my-6 border-l-2 border-ink/20 pl-5 text-[14px] leading-relaxed text-ink-muted"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          );
        }

        case 'list': {
          const html = marked.parse(renderMath(block.raw), { async: false });
          return (
            <div
              key={`list-${index}`}
              className="reader-list"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          );
        }

        case 'reference': {
          const html = marked.parse(renderMath(block.raw), { async: false });
          return (
            <div
              key={`ref-${index}`}
              className="text-[14px] leading-relaxed text-ink-muted my-4"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          );
        }

        case 'image': {
          if (!block.data || !('kind' in block.data)) return null;
          return <ImageBlock key={`img-${index}`} data={block.data as ImageElement} />;
        }

        default:
          return null;
      }
    },
    [theme, figureNumbers, codeNumbers],
  );

  return (
    <div className="reader-content">{parsed.blocks.map((block, i) => renderBlock(block, i))}</div>
  );
}
