import type { StitchedDocument, V2ExportOptions, DepthMode, RenderValidationResult } from './types';
import { DEPTH_CONFIGS } from './types';
import { RenderValidator } from './render-validator';
import { ImageReliabilityEngine } from './image-reliability';
import { generatePDFDocument } from '../export/pdf-exporter';
import type { EnrichedDocument } from '../types';
import { parseToEnrichedAST } from '../ast';

export interface ExportResult {
  success: boolean;
  data: Uint8Array | null;
  format: 'pdf' | 'html' | 'markdown';
  pageCount?: number;
  validation: RenderValidationResult;
  errors: string[];
  warnings: string[];
}

export interface ExportProgress {
  stage: string;
  percent: number;
  message: string;
}

export type ExportStage =
  | 'validating'
  | 'resolving_images'
  | 'building_pdf'
  | 'building_html'
  | 'finalizing'
  | 'complete'
  | 'failed';

export class ExportPipeline {
  private validator: RenderValidator;
  private imageEngine: ImageReliabilityEngine;
  private onProgress?: (progress: ExportProgress) => void;

  constructor(onProgress?: (progress: ExportProgress) => void) {
    this.validator = new RenderValidator();
    this.imageEngine = new ImageReliabilityEngine();
    this.onProgress = onProgress;
  }

  setProgressCallback(callback: (progress: ExportProgress) => void): void {
    this.onProgress = callback;
  }

  async export(
    document: StitchedDocument,
    content: string,
    options: V2ExportOptions,
  ): Promise<ExportResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.reportProgress('validating', 10, 'Validating document before export');

      const validation = options.validateBeforeExport
        ? this.validator.validate(document)
        : { valid: true, brokenImages: [], brokenDiagrams: [], invalidReferences: [], emptySections: [], warnings: [] };

      if (!validation.valid) {
        const errorCount = [
          ...validation.brokenImages,
          ...validation.brokenDiagrams,
          ...validation.invalidReferences,
          ...validation.emptySections,
        ].filter(i => i.severity === 'error').length;

        if (errorCount > 0) {
          errors.push(`Validation failed: ${errorCount} error(s) found`);
        }
      }

      warnings.push(...validation.warnings);

      this.reportProgress('resolving_images', 30, 'Resolving image reliability');

      for (const warning of validation.brokenImages) {
        if (warning.severity === 'warning') {
          warnings.push(`Image issue: ${warning.description}`);
        }
      }

      this.reportProgress('building_pdf', 50, 'Building PDF document');

      let data: Uint8Array | null = null;
      let pageCount: number | undefined;

      switch (options.depthMode) {
        case 'fast':
        case 'standard':
        case 'deep':
          data = await this.buildPDF(document, content, options);
          pageCount = data ? this.estimatePageCount(data) : undefined;
          break;
      }

      if (!data) {
        errors.push('Failed to generate document data');
      }

      this.reportProgress('finalizing', 90, 'Finalizing export');

      return {
        success: errors.length === 0 && data !== null,
        data,
        format: 'pdf',
        pageCount,
        validation,
        errors,
        warnings,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Export failed: ${message}`);
      this.reportProgress('failed', 0, `Export failed: ${message}`);

      return {
        success: false,
        data: null,
        format: 'pdf',
        validation: {
          valid: false,
          brokenImages: [],
          brokenDiagrams: [],
          invalidReferences: [],
          emptySections: [],
          warnings: [],
        },
        errors,
        warnings,
      };
    }
  }

  async exportWithFallback(
    document: StitchedDocument,
    content: string,
    options: V2ExportOptions,
  ): Promise<ExportResult> {
    const result = await this.export(document, content, options);

    if (!result.success && result.errors.length > 0) {
      const fallbackOptions: V2ExportOptions = {
        ...options,
        depthMode: 'fast',
        validateBeforeExport: false,
      };

      const fallbackResult = await this.export(document, content, fallbackOptions);
      if (fallbackResult.success) {
        fallbackResult.warnings.push('Document exported with fast mode fallback due to export failures');
      }
      return fallbackResult;
    }

    return result;
  }

  private async buildPDF(
    document: StitchedDocument,
    content: string,
    options: V2ExportOptions,
  ): Promise<Uint8Array> {
    const enrichedDoc = this.buildEnrichedDocument(document, content);

    const pdfOptions = {
      title: document.tocEntries[0]?.title ?? 'Document',
      subtitle: `Generated at ${options.depthMode} depth`,
      author: 'NOTCH Content Engine V2',
      date: new Date().toLocaleDateString(),
      pageSize: options.pageSize,
      dpi: options.dpi,
      theme: options.theme,
      includeToc: options.includeToc,
      includePageNumbers: options.includePageNumbers,
      includeHeaders: options.includeFootnotes,
      includeFooters: options.includePageNumbers,
      fontSize: options.depthMode === 'deep' ? 9 : 10,
    };

    return generatePDFDocument(document.mergedMarkdown, pdfOptions);
  }

  private buildEnrichedDocument(document: StitchedDocument, content: string): EnrichedDocument {
    const { blocks, hierarchy, warnings } = parseToEnrichedAST(document.mergedMarkdown);

    return {
      original: content,
      blocks,
      hierarchy,
      semanticAnalysis: {
        topics: [],
        concepts: [],
        entities: [],
        relationships: [],
        systems: [],
        processes: [],
        architectures: [],
        timelines: [],
        dependencies: [],
      },
      qualityEvaluation: {
        score: 1,
        issues: [],
        visualOpportunities: [],
        educationGaps: [],
        completenessScore: 1,
        readabilityScore: 1,
        structuralScore: 1,
        visualScore: 1,
      },
    };
  }

  private estimatePageCount(data: Uint8Array): number {
    try {
      const text = new TextDecoder().decode(data.slice(0, 1024));
      const sizeMatch = text.match(/\/Type\s*\/Page[^}]*/g);
      return sizeMatch ? sizeMatch.length : 1;
    } catch {
      return 1;
    }
  }

  generateHTML(
    document: StitchedDocument,
    options: V2ExportOptions,
  ): string {
    const tocHtml = options.includeToc
      ? this.buildTOCHTML(document)
      : '';

    const resolvedMarkdown = this.imageEngine.generateFallbacksForDocument(
      document.mergedMarkdown,
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${document.tocEntries[0]?.title ?? 'Document'}</title>
  <style>
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1a1a1a;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
    h2 { font-size: 1.5em; margin-top: 1.5em; }
    h3 { font-size: 1.2em; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
    code { font-family: 'Courier New', monospace; font-size: 0.9em; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f8f8f8; }
    blockquote { border-left: 3px solid #4A90D9; margin: 1em 0; padding: 8px 16px; background: #f8f9fa; }
    .toc { background: #f8f9fa; padding: 16px 24px; border-radius: 8px; margin-bottom: 2em; }
    .toc h2 { margin-top: 0; }
    .notch-image-placeholder { padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 12px 0; }
    .notch-placeholder-inner { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .notch-placeholder-icon { font-size: 24px; }
    .notch-placeholder-label { font-weight: 600; color: #333; }
    .notch-placeholder-kind { font-size: 0.8em; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .notch-placeholder-prompt { font-size: 0.85em; color: #888; font-style: italic; }
    .page-number { text-align: center; color: #999; font-size: 0.85em; margin-top: 2em; }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1a; color: #e0e0e0; }
      pre { background: #2a2a2a; }
      table th { background: #333; }
      th, td { border-color: #444; }
      blockquote { background: #222; }
      .toc { background: #222; }
      .notch-image-placeholder { background: #2a2a2a; }
    }
  </style>
</head>
<body>
  <h1>${document.tocEntries[0]?.title ?? 'Document'}</h1>
  ${tocHtml}
  ${this.convertToHTML(resolvedMarkdown)}
  ${options.includePageNumbers ? '<p class="page-number">Generated by NOTCH Content Intelligence Engine V2</p>' : ''}
</body>
</html>`;
  }

  private buildTOCHTML(document: StitchedDocument): string {
    if (document.tocEntries.length === 0) return '';

    const items = document.tocEntries.map(entry => {
      const indent = (entry.level - 1) * 16;
      const fontSize = entry.level <= 2 ? '16px' : '14px';
      const fontWeight = entry.level <= 2 ? '600' : '400';
      return `<div style="margin-left: ${indent}px; font-size: ${fontSize}; font-weight: ${fontWeight}; padding: 2px 0;">
        <a href="#section-${entry.number}" style="color: #4A90D9; text-decoration: none;">
          ${entry.number}. ${entry.title}
        </a>
      </div>`;
    }).join('\n');

    return `<div class="toc"><h2>Table of Contents</h2>${items}</div>`;
  }

  private convertToHTML(markdown: string): string {
    let html = markdown;

    html = html.replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>');

    html = html.replace(/`{3}(\w*)\n([\s\S]*?)`{3}/g, (_, lang, code) => {
      const langClass = lang ? ` class="language-${lang}"` : '';
      return `<pre${langClass}><code>${this.escapeHTML(code.trim())}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');

    html = html.replace(/\n{2,}/g, '</p><p>');
    html = `<p>${html}</p>`;

    html = html.replace(/<li>([\s\S]*?)<\/li>/g, (match) => {
      return `<ul>${match}</ul>`;
    });

    return html;
  }

  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private reportProgress(stage: ExportStage, percent: number, message: string): void {
    this.onProgress?.({ stage, percent, message });
  }
}

export function createExportPipeline(
  onProgress?: (progress: ExportProgress) => void,
): ExportPipeline {
  return new ExportPipeline(onProgress);
}
