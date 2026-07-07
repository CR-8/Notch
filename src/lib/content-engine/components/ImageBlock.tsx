import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ImageElement } from '../types';
import { Lightbox } from '@/components/reader/renderers/Lightbox';

const IMAGE_TIMEOUT_MS = 8000;

interface ImageBlockProps {
  data: ImageElement;
}

export function ImageBlock({ data }: ImageBlockProps) {
  const imageUrl = data.url;
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(
    imageUrl ? 'loading' : 'error',
  );
  const [zoom, setZoom] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!imageUrl) return;
    timerRef.current = setTimeout(() => {
      setState('error');
    }, IMAGE_TIMEOUT_MS);
    return () => clearTimeout(timerRef.current);
  }, [imageUrl]);

  if (!imageUrl) return null;

  return (
    <figure className="my-6" data-image-kind={data.kind}>
      {state === 'error' ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] py-12 text-[var(--color-ink-faint)]">
          <span className="text-[13px]">Image failed to load</span>
          {data.altText && (
            <span className="max-w-[300px] text-center text-[11px]">{data.altText}</span>
          )}
        </div>
      ) : (
        <button
          type="button"
          data-zoomable
          onClick={() => state === 'loaded' && setZoom(true)}
          aria-label="Enlarge image"
          title={state === 'loaded' ? 'Click to enlarge' : undefined}
          className="relative block w-full overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)]"
        >
          {state === 'loading' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-hairline)] border-t-[var(--color-ink-muted)]" />
            </span>
          )}
          <img
            src={imageUrl}
            alt={data.altText}
            onLoad={() => {
              clearTimeout(timerRef.current);
              setState('loaded');
            }}
            onError={() => {
              clearTimeout(timerRef.current);
              setState('error');
            }}
            className={cn('h-auto w-full', state === 'loading' && 'opacity-0')}
            loading="lazy"
          />
        </button>
      )}

      {data.caption && state === 'loaded' && (
        <figcaption className="mt-2 text-center text-[13px] italic text-[var(--color-ink-muted)]">
          {data.caption}
        </figcaption>
      )}

      <Lightbox
        open={zoom}
        onClose={() => setZoom(false)}
        label={data.caption || data.altText || 'Image'}
      >
        <img src={imageUrl} alt={data.altText} />
      </Lightbox>
    </figure>
  );
}
