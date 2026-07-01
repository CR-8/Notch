import { useEffect, useState, useRef } from 'react';
import type { ImageElement } from '../types';

const IMAGE_TIMEOUT_MS = 8000;

interface ImageBlockProps {
  data: ImageElement;
}

export function ImageBlock({ data }: ImageBlockProps) {
  const imageUrl = data.url;
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(
    imageUrl ? 'loading' : 'error',
  );
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
      {state === 'error' ? null : (
        <div className="rounded-lg border border-[var(--color-hairline)] overflow-hidden bg-[var(--color-canvas-soft)]">
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
            className="w-full h-auto"
            loading="lazy"
          />
        </div>
      )}

      {data.caption && state === 'loaded' && (
        <figcaption className="text-[13px] text-[var(--color-ink-muted)] text-center mt-2 italic">
          {data.caption}
        </figcaption>
      )}
    </figure>
  );
}
