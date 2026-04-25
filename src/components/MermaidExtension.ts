import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { MermaidNodeView } from './MermaidNodeView';

const lowlight = createLowlight(common);

/**
 * Extended CodeBlockLowlight that intercepts fenced code blocks with
 * language "mermaid" and renders them via MermaidNodeView / MermaidBlock.
 * All other languages fall through to the standard lowlight renderer.
 */
export const MermaidExtension = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
}).configure({ lowlight });
