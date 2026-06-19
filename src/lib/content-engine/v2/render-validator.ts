import type { RenderValidationResult, ValidationIssue, ContentFrame, StitchedDocument } from './types';
import { MermaidValidatorV2 } from './mermaid-validator';
import { UMLValidator } from './uml-validator';

export class RenderValidator {
  private mermaidValidator: MermaidValidatorV2;
  private umlValidator: UMLValidator;

  constructor() {
    this.mermaidValidator = new MermaidValidatorV2();
    this.umlValidator = new UMLValidator();
  }

  validate(document: StitchedDocument): RenderValidationResult {
    const brokenImages = this.validateImages(document.mergedMarkdown);
    const brokenDiagrams = this.validateDiagrams(document.mergedMarkdown);
    const invalidReferences = this.validateReferences(document.mergedMarkdown, document.tocEntries);
    const emptySections = this.validateEmptySections(document.mergedMarkdown, document.frames);
    const warnings = this.collectWarnings(brokenImages, brokenDiagrams, invalidReferences, emptySections);

    const valid =
      brokenImages.filter(i => i.severity === 'error').length === 0 &&
      brokenDiagrams.filter(i => i.severity === 'error').length === 0 &&
      invalidReferences.filter(i => i.severity === 'error').length === 0 &&
      emptySections.filter(i => i.severity === 'error').length === 0;

    return {
      valid,
      brokenImages,
      brokenDiagrams,
      invalidReferences,
      emptySections,
      warnings,
    };
  }

  validatePartial(frames: ContentFrame[]): RenderValidationResult {
    const merged = frames.map(f => f.sourceText).join('\n\n');
    const tocEntries = frames.map((f, i) => ({
      level: 2,
      title: f.title,
      number: `${i + 1}`,
      frameIndex: f.index,
    }));

    return this.validate({
      frames,
      mergedMarkdown: merged,
      diagramCount: 0,
      imageCount: 0,
      tableCount: 0,
      wordCount: 0,
      tocEntries,
    });
  }

  private validateImages(markdown: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const imagePattern = /!\[([^\]]*)\]\(([^)]*)\)/g;
    let match: RegExpExecArray | null;

    while ((match = imagePattern.exec(markdown)) !== null) {
      const altText = match[1];
      const url = match[2];
      const position = match.index;

      if (!url || url.trim() === '') {
        issues.push({
          type: 'image',
          location: `position ${position}`,
          description: 'Image has empty URL',
          severity: 'warning',
          fixSuggestion: 'Provide a valid image URL or remove the empty image reference',
        });
        continue;
      }

      if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
        issues.push({
          type: 'image',
          location: url,
          description: 'Relative image path may not resolve in exported document',
          severity: 'warning',
          fixSuggestion: 'Use absolute URLs or ensure relative paths resolve at export time',
        });
      }

      if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('/') && !url.startsWith('./') && !url.startsWith('../')) {
        issues.push({
          type: 'image',
          location: url,
          description: 'Unrecognized image URL format — may not render',
          severity: 'warning',
          fixSuggestion: 'Use http/https URLs or data URIs',
        });
      }

      if (!altText) {
        issues.push({
          type: 'image',
          location: url,
          description: 'Image missing alt text',
          severity: 'warning',
          fixSuggestion: 'Add descriptive alt text for accessibility',
        });
      }
    }

    const placeholderPattern = /\[PLACEHOLDER_IMAGE:([^\]]+)\]/g;
    while ((match = placeholderPattern.exec(markdown)) !== null) {
      issues.push({
        type: 'image',
        location: match[1],
        description: `Unresolved image placeholder: ${match[1]}`,
        severity: 'error',
        fixSuggestion: `Replace with actual image for: ${match[1]}`,
      });
    }

    return issues;
  }

  private validateDiagrams(markdown: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const mermaidPattern = /```mermaid\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = mermaidPattern.exec(markdown)) !== null) {
      const code = match[1].trim();
      const position = match.index;

      if (!code) {
        issues.push({
          type: 'diagram',
          location: `position ${position}`,
          description: 'Empty Mermaid diagram block',
          severity: 'error',
          fixSuggestion: 'Provide valid Mermaid syntax or remove the empty block',
        });
        continue;
      }

      const validation = this.mermaidValidator.validate(code);
      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => `Line ${e.line}: ${e.message}`).join('; ');
        issues.push({
          type: 'diagram',
          location: `position ${position}`,
          description: `Mermaid diagram validation failed: ${errorMessages}`,
          severity: 'error',
          fixSuggestion: validation.suggestions[0] ?? 'Check Mermaid syntax documentation',
        });
      }

      for (const warning of validation.warnings) {
        issues.push({
          type: 'diagram',
          location: `position ${position}`,
          description: warning,
          severity: 'warning',
          fixSuggestion: 'Review diagram structure',
        });
      }
    }

    const plantumlPattern = /```plantuml\n([\s\S]*?)```/g;
    while ((match = plantumlPattern.exec(markdown)) !== null) {
      const code = match[1].trim();
      const position = match.index;

      if (!code) {
        issues.push({
          type: 'diagram',
          location: `position ${position}`,
          description: 'Empty PlantUML diagram block',
          severity: 'error',
          fixSuggestion: 'Provide valid PlantUML syntax or remove the empty block',
        });
        continue;
      }

      const validation = this.umlValidator.validate(code);
      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => `Line ${e.line}: ${e.message}`).join('; ');
        issues.push({
          type: 'diagram',
          location: `position ${position}`,
          description: `PlantUML validation failed: ${errorMessages}`,
          severity: 'error',
          fixSuggestion: 'Check PlantUML syntax documentation',
        });
      }
    }

    return issues;
  }

  private validateReferences(markdown: string, tocEntries: Array<{ title: string; number: string }>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const anchorPattern = /\]\(#([^)]+)\)/g;
    let match: RegExpExecArray | null;

    const existingAnchors = new Set<string>();
    const tocTitleMap = new Map<string, string>();
    for (const entry of tocEntries) {
      const slug = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      existingAnchors.add(`section-${entry.number}`);
      existingAnchors.add(slug);
      tocTitleMap.set(slug, entry.title);
    }

    const headingPattern = /^#{1,4}\s+(.+)$/gm;
    while ((match = headingPattern.exec(markdown)) !== null) {
      const headingSlug = match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      existingAnchors.add(headingSlug);
    }

    const refPattern = /\]\(#([^)]+)\)/g;
    while ((match = refPattern.exec(markdown)) !== null) {
      const anchor = match[1].trim();
      if (!existingAnchors.has(anchor)) {
        issues.push({
          type: 'reference',
          location: `#${anchor}`,
          description: `Broken anchor reference: "${anchor}" does not match any section heading`,
          severity: 'error',
          fixSuggestion: `Ensure a heading with slug "${anchor}" exists, or correct the reference`,
        });
      }
    }

    const seeAlsoPattern = /see\s+(Section|Figure|Table|Chapter)\s+(\d+(?:\.\d+)*)/gi;
    while ((match = seeAlsoPattern.exec(markdown)) !== null) {
      const refType = match[1];
      const refNum = match[2];

      const sectionExists = tocEntries.some(e => e.number === refNum || e.number.startsWith(refNum + '.'));
      if (!sectionExists && refType.toLowerCase() === 'section') {
        issues.push({
          type: 'reference',
          location: `${refType} ${refNum}`,
          description: `Cross-reference to ${refType} ${refNum} not found in document`,
          severity: 'warning',
          fixSuggestion: `Update reference to point to an existing section number`,
        });
      }
    }

    return issues;
  }

  private validateEmptySections(markdown: string, frames: ContentFrame[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const frame of frames) {
      if (frame.status !== 'complete') continue;

      const content = frame.sourceText.trim();
      const headingOnly = /^#{1,4}\s+.+$/m.test(content) && !content.replace(/^#{1,4}\s+.+$/gm, '').trim();

      if (headingOnly || !content) {
        issues.push({
          type: 'empty_section',
          location: `Frame "${frame.title}" (index ${frame.index})`,
          description: `Section "${frame.title}" has no content beyond its heading`,
          severity: 'error',
          fixSuggestion: 'Generate content for this section or remove it from the document',
        });
      }

      const wordCount = content.split(/\s+/).filter(Boolean).length;
      if (wordCount > 0 && wordCount < 10) {
        issues.push({
          type: 'empty_section',
          location: `Frame "${frame.title}" (index ${frame.index})`,
          description: `Section "${frame.title}" has very little content (${wordCount} words)`,
          severity: 'warning',
          fixSuggestion: 'Expand the section content or consider merging with an adjacent section',
        });
      }
    }

    return issues;
  }

  private collectWarnings(...groups: ValidationIssue[][]): string[] {
    const warnings: string[] = [];

    const totalErrors = groups.reduce((sum, g) => sum + g.filter(i => i.severity === 'error').length, 0);
    const totalWarnings = groups.reduce((sum, g) => sum + g.filter(i => i.severity === 'warning').length, 0);

    if (totalErrors > 0) warnings.push(`Found ${totalErrors} validation error(s) that must be fixed before export`);
    if (totalWarnings > 0) warnings.push(`Found ${totalWarnings} validation warning(s) — review recommended`);

    const diagramIssues = groups[1];
    if (diagramIssues && diagramIssues.length > 0) {
      const brokenDiagrams = diagramIssues.filter(i => i.severity === 'error').length;
      if (brokenDiagrams > 0) warnings.push(`${brokenDiagrams} diagram(s) failed validation — they may not render`);
    }

    return warnings;
  }
}

export function createRenderValidator(): RenderValidator {
  return new RenderValidator();
}
