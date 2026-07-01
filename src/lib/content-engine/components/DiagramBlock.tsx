import { useEffect, useState, useId } from 'react';
import type { DiagramElement } from '../types';
import { autoFixMermaid } from '../mermaid/fixer';
import { validateMermaidCode } from '../mermaid/validator';
import { getMermaidConfig } from '../mermaid/themes';
import { Skeleton } from '@/components/ui/skeleton';
import { sanitizeSvg } from '@/lib/sanitize';
import { getSettings } from '@/lib/storage';

interface DiagramBlockProps {
  data: DiagramElement;
  theme: 'light' | 'dark';
  number?: number;
}

export function DiagramBlock({ data, theme, number }: DiagramBlockProps) {
  const rawId = useId();
  const id = 'dgm-' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const [status, setStatus] = useState<
    'loading' | 'rendered' | 'error' | 'unavailable' | 'validating' | 'disabled'
  >('loading');
  const [_errorMessage, setErrorMessage] = useState('');
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [mermaidReady, setMermaidReady] = useState(false);

  const isPlantUML = data.kind === 'plantuml';
  const isMermaid = !isPlantUML;

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setStatus('loading');
        setSvgContent(null);
        setErrorMessage('');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data.content]);

  useEffect(() => {
    if (!isMermaid) return;
    let cancelled = false;
    void import('mermaid')
      .then((mod) => {
        if (cancelled) return;
        const config = getMermaidConfig(theme);
        mod.default.initialize({ ...config, securityLevel: 'strict', startOnLoad: false });
        setMermaidReady(true);
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [isMermaid, theme]);

  useEffect(() => {
    const cancelledRef = { current: false };
    if (isPlantUML) {
      void (async (cRef: { current: boolean }) => {
        try {
          const settings = await getSettings();
          if (cRef.current) return;
          if (!settings.allowRemotePlantUml || settings.localOnly) {
            setStatus('disabled');
            return;
          }
          // @ts-expect-error - plantuml-encoder has no types
          const encoder = (await import('plantuml-encoder')) as {
            default: { encode: (s: string) => string };
          };
          if (cRef.current) return;
          const encoded = encoder.default.encode(data.content);
          const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const rawSvg = await res.text();
          if (cRef.current) return;
          setSvgContent(sanitizeSvg(rawSvg));
          setErrorMessage('');
          setStatus('rendered');
        } catch (err) {
          if (cRef.current) return;
          setSvgContent(null);
          setErrorMessage(err instanceof Error ? err.message : 'PlantUML failed');
          setStatus('error');
        }
      })(cancelledRef);
      return () => {
        cancelledRef.current = true;
      };
    }
    if (!mermaidReady) return;

    const validation = validateMermaidCode(data.content);
    const fixed = !validation.valid ? autoFixMermaid(data.content, validation).fixed : data.content;

    void (async () => {
      await Promise.resolve();
      setStatus('validating');
      try {
        const { default: mermaid } = await import('mermaid');
        if (cancelledRef.current) return;
        const config = getMermaidConfig(theme);
        mermaid.initialize({ ...config, securityLevel: 'strict', startOnLoad: false });
        const { svg } = await mermaid.render(id, fixed);
        if (cancelledRef.current) return;
        setSvgContent(svg);
        setErrorMessage('');
        setStatus('rendered');
      } catch (err) {
        if (cancelledRef.current) return;
        setSvgContent(null);
        setErrorMessage(err instanceof Error ? err.message : 'Rendering failed');
        setStatus('error');
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [data.content, id, mermaidReady, isPlantUML, theme]);

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
          <div dangerouslySetInnerHTML={{ __html: svgContent }} className="w-full" />
        )}
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
