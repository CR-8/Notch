import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { MermaidBlock } from './MermaidBlock';
import { PlantUMLBlock } from './PlantUMLBlock';

/**
 * Unified node view for all fenced code blocks.
 * Dispatches to the appropriate renderer based on the language attribute.
 */
export function UnifiedCodeNodeView({ node }: NodeViewProps) {
  const language: string = node.attrs.language ?? '';
  const code = node.textContent ?? '';

  if (language === 'mermaid') {
    return (
      <NodeViewWrapper>
        <MermaidBlock code={code} />
      </NodeViewWrapper>
    );
  }

  if (language === 'plantuml') {
    return (
      <NodeViewWrapper>
        <PlantUMLBlock code={code} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="pre">
      <NodeViewContent as="code" className={language ? `language-${language}` : ''} />
    </NodeViewWrapper>
  );
}
