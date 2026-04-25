import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { PlantUMLBlock } from './PlantUMLBlock';

/**
 * Tiptap ReactNodeView for code blocks.
 * - When language is "plantuml": renders PlantUMLBlock (SVG diagram via PlantUML server)
 * - Otherwise: renders a standard <pre><code> block with syntax highlighting
 */
export function PlantUMLNodeView({ node }: NodeViewProps) {
  const language: string = node.attrs.language ?? '';

  if (language === 'plantuml') {
    const code = node.textContent ?? '';
    return (
      <NodeViewWrapper>
        <PlantUMLBlock code={code} />
      </NodeViewWrapper>
    );
  }

  // Default: standard code block rendering (lowlight handles highlighting via CSS)
  return (
    <NodeViewWrapper as="pre">
      <NodeViewContent as="code" className={language ? `language-${language}` : ''} />
    </NodeViewWrapper>
  );
}
