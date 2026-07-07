'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TextAlign } from '@tiptap/extension-text-align';
import { Typography } from '@tiptap/extension-typography';
import { Highlight } from '@tiptap/extension-highlight';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Selection } from '@tiptap/extensions';
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension';

import '@/components/tiptap-node/blockquote-node/blockquote-node.scss';
import '@/components/tiptap-node/code-block-node/code-block-node.scss';
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss';
import '@/components/tiptap-node/list-node/list-node.scss';
import '@/components/tiptap-node/image-node/image-node.scss';
import '@/components/tiptap-node/heading-node/heading-node.scss';
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss';

import { Marked } from 'marked';
import { useMemo } from 'react';

const marked = new Marked({
  breaks: true,
});

function ReaderEditor({ content }: { content: string }) {
  const html = useMemo(() => {
    try {
      return marked.parse(content) as string;
    } catch {
      return `<p>${content}</p>`;
    }
  }, [content]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    editorProps: {
      attributes: {
        'aria-label': 'Document content',
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
    ],
    content: html,
  });

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}

export { ReaderEditor };
