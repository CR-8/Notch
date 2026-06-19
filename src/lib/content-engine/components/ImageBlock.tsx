import { useState } from 'react';
import type { ImageElement } from '../types';
import { Skeleton } from '@/components/ui/skeleton';

interface ImageBlockProps {
  data: ImageElement;
}

export function ImageBlock({ data }: ImageBlockProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const imageUrl = data.url;

  return (
    <figure className="my-6" data-image-kind={data.kind}>
      <div className="rounded-lg border border-[var(--color-hairline)] overflow-hidden bg-[var(--color-canvas-soft)]">
        {imageUrl ? (
          <>
            {!loaded && !error && (
              <div className="aspect-video flex items-center justify-center">
                <Skeleton className="w-full h-full" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={data.altText}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              className={`w-full h-auto ${loaded ? 'block' : 'hidden'}`}
              loading="lazy"
            />
            {error && (
              <div className="flex items-center justify-center h-48 text-[13px] text-[var(--color-ink-muted)]">
                <div className="text-center">
                  <p className="font-medium">Image unavailable</p>
                  <p className="text-[12px] mt-1">{data.altText}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-48 bg-gradient-to-br from-[var(--color-canvas-soft)] to-[var(--color-surface)]">
            <div className="text-center px-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                <span className="text-[20px] text-[var(--color-primary)]">🖼</span>
              </div>
              <p className="text-[13px] font-medium text-[var(--color-ink-muted)]">
                {data.caption || data.altText || 'Illustration'}
              </p>
              <p className="text-[11px] text-[var(--color-ink-faint)] mt-1">
                {data.prompt}
              </p>
            </div>
          </div>
        )}
      </div>

      {data.caption && (
        <figcaption className="text-[13px] text-[var(--color-ink-muted)] text-center mt-2 italic">
          {data.caption}
        </figcaption>
      )}
    </figure>
  );
}
