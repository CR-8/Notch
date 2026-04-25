import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { PlantUMLNodeView } from './PlantUMLNodeView';

const lowlight = createLowlight(common);

/**
 * Extended CodeBlockLowlight that intercepts fenced code blocks with
 * language "plantuml" and renders them via PlantUMLNodeView / PlantUMLBlock.
 * All other languages fall through to the standard lowlight renderer.
 */
export const PlantUMLExtension = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PlantUMLNodeView);
  },
}).configure({ lowlight });
