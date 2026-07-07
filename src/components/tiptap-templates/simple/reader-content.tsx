'use client';

import { useMemo } from 'react';
import { parseToEnrichedAST } from '@/lib/content-engine/ast';
import { DiagramBlock } from '@/lib/content-engine/components/DiagramBlock';
import { CalloutBlock } from '@/lib/content-engine/components/CalloutBlock';
import { ReaderEditor } from './reader-editor';
import type { DiagramElement, CalloutElement } from '@/lib/content-engine/types';

function ReaderContent({ content, theme }: { content: string; theme: 'light' | 'dark' }) {
  const { blocks } = useMemo(() => parseToEnrichedAST(content ?? ''), [content]);

  const rendered = useMemo(() => {
    const elements: React.ReactNode[] = [];
    let markdownChunks: string[] = [];

    function flushMarkdown() {
      if (markdownChunks.length > 0) {
        const key = `md-${elements.length}`;
        elements.push(
          <div key={key} className="reader-tiptap-chunk">
            <ReaderEditor content={markdownChunks.join('\n\n')} />
          </div>,
        );
        markdownChunks = [];
      }
    }

    blocks.forEach((block, i) => {
      switch (block.type) {
        case 'diagram': {
          flushMarkdown();
          if (block.data && 'kind' in block.data) {
            elements.push(
              <DiagramBlock key={`dgm-${i}`} data={block.data as DiagramElement} theme={theme} />,
            );
          }
          break;
        }

        case 'callout': {
          flushMarkdown();
          if (block.data && 'kind' in block.data) {
            elements.push(
              <CalloutBlock key={`callout-${i}`} data={block.data as CalloutElement} />,
            );
          }
          break;
        }

        default:
          markdownChunks.push(block.raw);
      }
    });

    flushMarkdown();
    return elements;
  }, [blocks, theme]);

  return <div className="notion-prose">{rendered}</div>;
}

export { ReaderContent };
