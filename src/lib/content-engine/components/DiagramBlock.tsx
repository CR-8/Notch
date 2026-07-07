import { useEffect, useState, useId, useRef } from 'react';
import type { DiagramElement } from '../types';
import { autoFixMermaid } from '../mermaid/fixer';
import { validateMermaidCode } from '../mermaid/validator';
import { getMermaidConfig } from '../mermaid/themes';
import { Skeleton } from '@/components/ui/skeleton';
import { sanitizeSvg } from '@/lib/sanitize';
import { getSettings } from '@/lib/storage';
import { Lightbox } from '@/components/reader/renderers/Lightbox';

interface DiagramBlockProps {
  data: DiagramElement;
  theme: 'light' | 'dark';
  number?: number;
}

const svgCache = new Map<string, string>();

let mermaidModule: {
  render: (id: string, text: string) => Promise<{ svg: string }>;
  initialize: (config: Record<string, unknown>) => void;
} | null = null;
let mermaidLoadPromise: Promise<void> | null = null;

function loadMermaid(): Promise<void> {
  if (mermaidModule) return Promise.resolve();
  if (mermaidLoadPromise) return mermaidLoadPromise;
  mermaidLoadPromise = import('mermaid').then((mod) => {
    mermaidModule = mod.default;
  });
  return mermaidLoadPromise;
}

function initMermaid(theme: 'light' | 'dark'): void {
  if (!mermaidModule) return;
  const config = getMermaidConfig(theme);
  mermaidModule.initialize({ ...config, securityLevel: 'strict', startOnLoad: false });
}

export function DiagramBlock({ data, theme, number }: DiagramBlockProps) {
  const rawId = useId();
  const id = 'dgm-' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const [status, setStatus] = useState<
    'loading' | 'validating' | 'rendered' | 'error' | 'unavailable' | 'disabled'
  >('loading');
  const [_errorMessage, setErrorMessage] = useState('');
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const cancelledRef = useRef(false);

  const isPlantUML = data.kind === 'plantuml';
  const isMermaid = !isPlantUML;
  const cacheKey = isMermaid ? `m:${data.content}` : `p:${data.content}`;

  useEffect(() => {
    cancelledRef.current = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setStatus('loading');
    setSvgContent(null);
    setErrorMessage('');
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      cancelledRef.current = true;
    };
  }, [data.content]);

  useEffect(() => {
    if (isPlantUML) {
      void (async () => {
        try {
          const settings = await getSettings();
          if (cancelledRef.current) return;
          if (!settings.allowRemotePlantUml || settings.localOnly) {
            setStatus('disabled');
            return;
          }
          const encoder = (await import('plantuml-encoder')) as {
            default: { encode: (s: string) => string };
          };
          if (cancelledRef.current) return;
          const encoded = encoder.default.encode(data.content);
          const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const rawSvg = await res.text();
          if (cancelledRef.current) return;
          setSvgContent(sanitizeSvg(rawSvg));
          setErrorMessage('');
          setStatus('rendered');
        } catch (err) {
          if (cancelledRef.current) return;
          setSvgContent(null);
          setErrorMessage(err instanceof Error ? err.message : 'PlantUML failed');
          setStatus('error');
        }
      })();
      return;
    }

    const cached = svgCache.get(cacheKey);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSvgContent(cached);
      setStatus('rendered');
      return;
    }

    const validation = validateMermaidCode(data.content);
    const fixed = !validation.valid ? autoFixMermaid(data.content, validation).fixed : data.content;

    void loadMermaid().then(() => {
      if (cancelledRef.current) return;
      initMermaid(theme);
      setStatus('validating');
      if (!mermaidModule) {
        setStatus('unavailable');
        return;
      }
      mermaidModule
        .render(id, fixed)
        .then(({ svg }) => {
          if (cancelledRef.current) return;
          svgCache.set(cacheKey, svg);
          setSvgContent(svg);
          setErrorMessage('');
          setStatus('rendered');
        })
        .catch((err: Error) => {
          if (cancelledRef.current) return;
          setSvgContent(null);
          setErrorMessage(err.message);
          setStatus('error');
        });
    });
  }, [data.content, id, isPlantUML, theme, cacheKey]);

  if (status === 'error' || status === 'unavailable') return null;

  if (status === 'disabled') {
    return (
      <figure className="my-6" data-diagram-type={data.kind} data-diagram-status="disabled">
        <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] p-4 overflow-x-auto">
          <p className="text-[12px] text-[var(--color-ink-muted)] mb-2">
            PlantUML diagram — remote rendering is off. Enable it in Settings → General to render
            this on plantuml.com.
          </p>
          <pre className="font-mono text-[12px] text-[var(--color-ink-muted)] whitespace-pre-wrap break-all">
            {data.content}
          </pre>
        </div>
        {(data.caption || number) && (
          <figcaption className="text-[13px] text-[var(--color-ink-muted)] text-center mt-2">
            {number ? (
              <span className="font-semibold not-italic text-[var(--color-ink)]">
                Figure {number}
                {data.caption ? ' — ' : ''}
              </span>
            ) : null}
            <span className="italic">{data.caption}</span>
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <figure className="my-6" data-diagram-type={data.kind} data-diagram-status={status}>
      <div
        className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] p-4 overflow-x-auto min-h-[100px] flex items-center justify-center"
        data-diagram-id={data.id}
      >
        {status === 'loading' && <Skeleton className="h-32 w-full" />}
        {status === 'validating' && <Skeleton className="h-24 w-3/4" />}
        {status === 'rendered' && svgContent && (
          <button
            type="button"
            data-zoomable
            onClick={() => setZoom(true)}
            aria-label="Enlarge diagram"
            title="Click to enlarge"
            className="w-full"
          >
            <div dangerouslySetInnerHTML={{ __html: svgContent }} className="w-full" />
          </button>
        )}
      </div>

      {svgContent && (
        <Lightbox open={zoom} onClose={() => setZoom(false)} label={data.caption || 'Diagram'}>
          <div
            style={{ width: 'min(1100px, 92vw)' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </Lightbox>
      )}

      {(data.caption || number) && (
        <figcaption className="text-[13px] text-[var(--color-ink-muted)] text-center mt-2">
          {number ? (
            <span className="font-semibold not-italic text-[var(--color-ink)]">
              Figure {number}
              {data.caption ? ' — ' : ''}
            </span>
          ) : null}
          <span className="italic">{data.caption}</span>
        </figcaption>
      )}
    </figure>
  );
}
