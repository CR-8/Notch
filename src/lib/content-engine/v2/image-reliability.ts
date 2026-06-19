import type { PlannedImage, ContentFrame, ValidationIssue } from './types';

export interface ImageVerificationResult {
  id: string;
  url: string;
  accessible: boolean;
  statusCode?: number;
  contentType?: string;
  sizeBytes?: number;
  error?: string;
  retryCount: number;
}

export interface ImageFallback {
  id: string;
  originalUrl: string;
  fallbackType: 'placeholder' | 'generated' | 'removed' | 'caption_only';
  content: string;
}

export interface ImageReliabilityReport {
  verified: ImageVerificationResult[];
  failed: ImageVerificationResult[];
  fallbacks: ImageFallback[];
  totalImages: number;
  healthyPercentage: number;
}

const PLACEHOLDER_COLORS = [
  '#4A90D9', '#7B61FF', '#F5A623', '#D0021B',
  '#7ED321', '#50E3C2', '#B8E986', '#FF6B6B',
];

export class ImageReliabilityEngine {
  private maxRetries = 3;
  private retryDelay = 1000;
  private verifiedCache = new Map<string, ImageVerificationResult>();

  setMaxRetries(retries: number): void {
    this.maxRetries = retries;
  }

  async verifyImage(url: string): Promise<ImageVerificationResult> {
    const cached = this.verifiedCache.get(url);
    if (cached) return cached;

    let retryCount = 0;
    let lastError: string | undefined;

    while (retryCount <= this.maxRetries) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });

        const contentType = response.headers.get('content-type') ?? undefined;
        const contentLength = response.headers.get('content-length');
        const sizeBytes = contentLength ? parseInt(contentLength, 10) : undefined;

        const result: ImageVerificationResult = {
          id: `img-${url.slice(-32)}`,
          url,
          accessible: response.ok,
          statusCode: response.status,
          contentType,
          sizeBytes,
          retryCount,
        };

        const isImage = contentType ? contentType.startsWith('image/') : response.ok;
        if (response.ok && isImage) {
          this.verifiedCache.set(url, result);
          return result;
        }

        lastError = contentType ? `Not an image: ${contentType}` : `HTTP ${response.status}`;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        retryCount++;

        if (retryCount <= this.maxRetries) {
          await this.delay(this.retryDelay * retryCount);
        }
      }
    }

    const result: ImageVerificationResult = {
      id: `img-${url.slice(-32)}`,
      url,
      accessible: false,
      error: lastError,
      retryCount: Math.min(retryCount, this.maxRetries),
    };

    this.verifiedCache.set(url, result);
    return result;
  }

  async verifyAll(images: PlannedImage[]): Promise<ImageReliabilityReport> {
    const results = await Promise.allSettled(
      images.map(img => this.verifyImage(img.prompt)),
    );

    const verified: ImageVerificationResult[] = [];
    const failed: ImageVerificationResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.accessible) {
          verified.push(result.value);
        } else {
          failed.push(result.value);
        }
      } else {
        failed.push({
          id: 'unknown',
          url: 'unknown',
          accessible: false,
          error: result.reason?.toString(),
          retryCount: this.maxRetries,
        });
      }
    }

    const totalImages = verified.length + failed.length;
    const healthyPercentage = totalImages > 0 ? (verified.length / totalImages) * 100 : 0;

    const fallbacks = failed.map(f => this.generateFallback(f, images));

    return {
      verified,
      failed,
      fallbacks,
      totalImages,
      healthyPercentage,
    };
  }

  generateFallback(
    failedImage: ImageVerificationResult,
    allImages: PlannedImage[],
  ): ImageFallback {
    const planned = allImages.find(img => img.prompt === failedImage.url);

    if (planned) {
      return {
        id: planned.id,
        originalUrl: failedImage.url,
        fallbackType: 'placeholder',
        content: this.createPlaceholderMarkdown(planned),
      };
    }

    return {
      id: failedImage.id,
      originalUrl: failedImage.url,
      fallbackType: 'caption_only',
      content: `*[Image: ${failedImage.url} — could not be loaded]*`,
    };
  }

  generateFallbacksForDocument(markdown: string): string {
    const imagePattern = /!\[([^\]]*)\]\(([^)]*)\)/g;
    return markdown.replace(imagePattern, (match, alt: string, url: string) => {
      const existingFallback = /^PLACEHOLDER_IMAGE:/.test(url);
      if (existingFallback) return match;

      const colorIndex = url.length % PLACEHOLDER_COLORS.length;
      const color = PLACEHOLDER_COLORS[colorIndex];

      const placeholderMarkdown = [
        `<div align="center" style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 12px 0;">`,
        `  <div style="width: 100%; height: 120px; background: linear-gradient(135deg, ${color}22, ${color}44); border-radius: 6px; display: flex; align-items: center; justify-content: center;">`,
        `    <span style="color: ${color}; font-size: 14px; font-weight: 500;">📷 ${alt || 'Image'}</span>`,
        `  </div>`,
        `  <p style="color: #666; font-size: 12px; margin-top: 8px;">${alt || url}</p>`,
        `</div>`,
      ].join('\n');

      return placeholderMarkdown;
    });
  }

  validateImagePlaceholders(markdown: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const unresolvedPattern = /\[PLACEHOLDER_IMAGE:([^\]]+)\]/g;
    let match: RegExpExecArray | null;

    while ((match = unresolvedPattern.exec(markdown)) !== null) {
      issues.push({
        type: 'image_reliability',
        location: match[0],
        description: `Unresolved image placeholder for: ${match[1]}`,
        severity: 'error',
        fixSuggestion: `Replace placeholder with actual rendered image or remove the reference`,
      });
    }

    const imagePattern = /<div[^>]*>[\s\S]*?<\/div>/g;
    let divMatch: RegExpExecArray | null;
    while ((divMatch = imagePattern.exec(markdown)) !== null) {
      if (divMatch[0].includes('PLACEHOLDER_IMAGE')) {
        issues.push({
          type: 'image_reliability',
          location: `position ${divMatch.index}`,
          description: 'Generated HTML placeholder still in document — images are not fully resolved',
          severity: 'warning',
          fixSuggestion: 'Ensure all image URLs resolve before final export',
        });
      }
    }

    return issues;
  }

  clearCache(): void {
    this.verifiedCache.clear();
  }

  getCacheStats(): { size: number; healthy: number; failed: number } {
    let healthy = 0;
    let failed = 0;

    for (const result of this.verifiedCache.values()) {
      if (result.accessible) healthy++;
      else failed++;
    }

    return { size: this.verifiedCache.size, healthy, failed };
  }

  private createPlaceholderMarkdown(planned: PlannedImage): string {
    const caption = planned.caption || planned.altText || 'Image';
    return [
      `<!-- NOTCH-PLACEHOLDER: ${planned.id} -->`,
      `<div align="center" class="notch-image-placeholder notch-image-${planned.kind}" data-image-id="${planned.id}">`,
      `  <div class="notch-placeholder-inner">`,
      `    <span class="notch-placeholder-icon">🖼️</span>`,
      `    <span class="notch-placeholder-label">${caption}</span>`,
      `    <span class="notch-placeholder-kind">${planned.kind}</span>`,
      `    <span class="notch-placeholder-prompt">${planned.prompt}</span>`,
      `  </div>`,
      `</div>`,
      `<!-- /NOTCH-PLACEHOLDER -->`,
    ].join('\n');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createImageReliabilityEngine(): ImageReliabilityEngine {
  return new ImageReliabilityEngine();
}
