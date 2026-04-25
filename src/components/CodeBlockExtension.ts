import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { UnifiedCodeNodeView } from './UnifiedCodeNodeView';

const lowlight = createLowlight(common);

/**
 * Single CodeBlockLowlight extension that dispatches to:
 * - MermaidBlock   for ```mermaid
 * - PlantUMLBlock  for ```plantuml
 * - Standard pre/code for everything else
 *
 * Replaces the two separate MermaidExtension / PlantUMLExtension registrations
 * which caused a Tiptap node-name conflict (both extended CodeBlockLowlight,
 * so only the last one registered was active).
 */
export const CodeBlockExtension = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(UnifiedCodeNodeView);
  },
}).configure({ lowlight });
