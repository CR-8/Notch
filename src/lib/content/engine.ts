import type { CaptureResult } from '../capture/types';
import type { GenerationMode, ContentResult, CompleteFn } from './types';
import { buildPrompt } from '@/document-system/prompt';
import { log } from '../logger';

export interface ContentEngineInput {
  capture: CaptureResult;
  mode: GenerationMode;
  complete: CompleteFn;
}

export async function runContentEngine(input: ContentEngineInput): Promise<ContentResult> {
  const { capture, mode, complete } = input;

  const system = buildPrompt({
    mode,
    docClass: capture.documentClass,
    sourceContent: [
      `SOURCE TITLE: ${capture.metadata.title || ''}`,
      `SOURCE URL: ${capture.metadata.url || ''}`,
      `SOURCE DOMAIN: ${capture.metadata.domain || ''}`,
      `DOCUMENT TYPE: ${capture.documentClass || 'general'}`,
      `WORD COUNT: ${capture.metadata.wordCount || 0}`,
      '',
      capture.rawContent.slice(0, 24000),
    ].join('\n'),
  });

  const markdown = await complete(system, '');

  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? capture.metadata.title;
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

  log.info('content', `Generated: "${title}" ${wordCount} words, class=${capture.documentClass}`);

  return { title, markdown, wordCount };
}
