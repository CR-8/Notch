import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { MermaidBlock } from './MermaidBlock';

/**
 * Tiptap ReactNodeView for code blocks.
 * - When language is "mermaid": renders MermaidBlock (SVG diagram)
 * - Otherwise: renders a standard <pre><code> block with syntax highlighting
 */
export function MermaidNodeView({ node }: NodeViewProps) {
  const language: string = node.attrs.language ?? '';

  if (language === 'mermaid') {
    const code = node.textContent ?? '';
    return (
      <NodeViewWrapper>
        <MermaidBlock code={code} />
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
