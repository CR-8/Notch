import type { ContentFrame, StitchedDocument, TOCEntry } from './types';

export class StitchingEngine {
  stitch(frames: ContentFrame[]): StitchedDocument {
    const sorted = [...frames]
      .filter(f => f.status === 'complete' || f.status === 'regenerating')
      .sort((a, b) => a.index - b.index);

    const mergedMarkdown = this.buildMergedMarkdown(sorted);
    const tocEntries = this.buildTOC(sorted);
    const diagramCount = this.countByPattern(mergedMarkdown, /```(?:mermaid|plantuml)/g);
    const imageCount = this.countByPattern(mergedMarkdown, /!\[.*?\]\(.*?\)/g);
    const tableCount = this.countByPattern(mergedMarkdown, /\n\|.+\|\n\|[-:| ]+\|\n/g);
    const wordCount = mergedMarkdown.split(/\s+/).filter(Boolean).length;

    return {
      frames: sorted,
      mergedMarkdown,
      diagramCount,
      imageCount,
      tableCount,
      wordCount,
      tocEntries,
    };
  }

  private buildMergedMarkdown(frames: ContentFrame[]): string {
    const parts: string[] = [];
    let sectionNumber = 0;

    for (const frame of frames) {
      sectionNumber++;
      const heading = frame.title;
      const content = frame.sourceText;

      let processed = content;

      processed = this.ensureSectionHeading(processed, heading, sectionNumber);

      processed = this.resolveCrossReferences(processed, frames);

      processed = this.normalizeDiagramFences(processed);

      processed = this.mergeSubFrames(processed, frame);

      parts.push(processed.trim());
    }

    return parts.join('\n\n');
  }

  private ensureSectionHeading(content: string, title: string, sectionNumber: number): string {
    const headingMatch = content.match(/^#{1,4}\s+.+$/m);
    if (headingMatch) {
      return content.replace(
        /^(#{1,4})\s+.+$/m,
        `$1 ${sectionNumber}. ${title}`,
      );
    }
    return `## ${sectionNumber}. ${title}\n\n${content}`;
  }

  private resolveCrossReferences(content: string, frames: ContentFrame[]): string {
    const frameMap = new Map<string, ContentFrame>();
    for (const f of frames) {
      frameMap.set(f.title.toLowerCase(), f);
      frameMap.set(f.id, f);
    }

    return content.replace(
      /\[\[([^\]]+)\]\]/g,
      (match, ref: string) => {
        const lowerRef = ref.trim().toLowerCase();
        for (const [key, frame] of frameMap) {
          if (key.includes(lowerRef) || lowerRef.includes(key)) {
            const sectionNum = frames.indexOf(frame) + 1;
            return `[${ref}](#section-${sectionNum})`;
          }
        }
        const related = frames.find(f =>
          f.relationships.some(r => r.includes(ref)),
        );
        if (related) {
          const sectionNum = frames.indexOf(related) + 1;
          return `[${ref}](#section-${sectionNum})`;
        }
        return match;
      },
    );
  }

  private normalizeDiagramFences(content: string): string {
    let result = content;

    result = result.replace(/```(flowchart|graph)\s/g, '```mermaid\nflowchart ');
    result = result.replace(/```(sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|architecture|block|packet|quadrantChart|requirementDiagram|sankey|xychart)\s/g, '```mermaid\n$1 ');
    result = result.replace(/```plantuml\s/g, '```plantuml\n');

    result = result.replace(/```mermaid\n```mermaid/g, '```mermaid');
    result = result.replace(/```plantuml\n```plantuml/g, '```plantuml');

    return result;
  }

  private mergeSubFrames(content: string, frame: ContentFrame): string {
    if (frame.subFrames.length === 0) return content;

    const subContents = frame.subFrames
      .filter(sf => sf.status === 'complete')
      .map(sf => sf.sourceText.trim());

    if (subContents.length === 0) return content;

    return `${content}\n\n${subContents.join('\n\n')}`;
  }

  private buildTOC(frames: ContentFrame[]): TOCEntry[] {
    const entries: TOCEntry[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const sectionNumber = i + 1;
      const level = this.inferHeadingLevel(frame.title, frame.sourceText);

      entries.push({
        level,
        title: frame.title,
        number: `${sectionNumber}`,
        frameIndex: frame.index,
      });

      if (frame.subFrames.length > 0) {
        for (let j = 0; j < frame.subFrames.length; j++) {
          const sub = frame.subFrames[j];
          if (sub.status === 'complete') {
            entries.push({
              level: level + 1,
              title: sub.title,
              number: `${sectionNumber}.${j + 1}`,
              frameIndex: sub.index,
            });
          }
        }
      }
    }

    return entries;
  }

  private inferHeadingLevel(title: string, content: string): number {
    const match = content.match(/^(#{1,4})\s+/m);
    if (match) return match[1].length;
    if (title.length > 0) return 2;
    return 1;
  }

  private countByPattern(text: string, pattern: RegExp): number {
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
  }
}

export function createStitchingEngine(): StitchingEngine {
  return new StitchingEngine();
}
