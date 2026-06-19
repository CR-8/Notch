import { useEffect, useState, useId } from 'react';
import type { DiagramElement } from '../types';
import { autoFixMermaid, validateMermaidCode, getMermaidConfig } from '../mermaid/index';
import { Skeleton } from '@/components/ui/skeleton';

interface DiagramBlockProps {
  data: DiagramElement;
  theme: 'light' | 'dark';
  number?: number;
}

export function DiagramBlock({ data, theme, number }: DiagramBlockProps) {
  const rawId = useId();
  const id = 'dgm-' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const [status, setStatus] = useState<'loading' | 'rendered' | 'error' | 'unavailable' | 'validating'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [mermaidReady, setMermaidReady] = useState(false);

  const isPlantUML = data.kind === 'plantuml';
  const isMermaid = !isPlantUML;

  useEffect(() => {
    if (!isMermaid) return;
    let cancelled = false;
    import('mermaid').then((mod) => {
      if (cancelled) return;
      const config = getMermaidConfig(theme);
      mod.default.initialize({ ...config, securityLevel: 'strict', startOnLoad: false });
      setMermaidReady(true);
    }).catch(() => {
      if (!cancelled) setStatus('unavailable');
    });
    return () => { cancelled = true; };
  }, [isMermaid, theme]);

  useEffect(() => {
    if (!isMermaid || !mermaidReady) return;
    let cancelled = false;
    import('mermaid').then((mod) => {
      if (cancelled) return;
      const config = getMermaidConfig(theme);
      mod.default.initialize({ ...config, securityLevel: 'strict', startOnLoad: false });
    });
    return () => { cancelled = true; };
  }, [isMermaid, mermaidReady, theme]);

  useEffect(() => {
    if (isPlantUML) {
      setStatus('loading');
      renderPlantUML();
      return;
    }
    if (!mermaidReady) return;
    setStatus('validating');
    let cancelled = false;

    const validation = validateMermaidCode(data.content);
    const fixed = !validation.valid
      ? autoFixMermaid(data.content, validation).fixed
      : data.content;

    import('mermaid').then(({ default: mermaid }) => mermaid.render(id, fixed))
      .then(({ svg }) => {
        if (cancelled) return;
        setSvgContent(svg);
        setErrorMessage('');
        setStatus('rendered');
      })
      .catch((err) => {
        if (cancelled) return;
        setSvgContent(null);
        setErrorMessage(err instanceof Error ? err.message : 'Rendering failed');
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [data.content, id, mermaidReady, isPlantUML]);

  async function renderPlantUML() {
    let cancelled = false;
    try {
      // @ts-ignore - plantuml-encoder has no types
      const encoder = await import('plantuml-encoder');
      const encoded = encoder.default.encode(data.content);
      const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const svg = await res.text();
      if (cancelled) return;
      setSvgContent(svg);
      setErrorMessage('');
      setStatus('rendered');
    } catch (err) {
      if (cancelled) return;
      setSvgContent(null);
      setErrorMessage(err instanceof Error ? err.message : 'PlantUML failed');
      setStatus('error');
    }
    return () => { cancelled = true; };
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
        {status === 'error' && (
          <div className="w-full text-center">
            <p className="text-[12px] font-medium text-[var(--color-destructive)]">
              {isPlantUML ? 'UML Diagram' : 'Diagram'} failed to render
            </p>
            {errorMessage && (
              <p className="text-[11px] text-[var(--color-ink-muted)] mt-1 font-mono">{errorMessage}</p>
            )}
          </div>
        )}
        {status === 'unavailable' && (
          <div className="w-full text-center">
            <p className="text-[12px] font-medium text-[var(--color-ink-muted)]">Diagram renderer unavailable</p>
            <pre className="font-mono text-[11px] text-[var(--color-ink-muted)] mt-2 whitespace-pre-wrap break-all text-left bg-[var(--color-canvas)] p-3 rounded border border-[var(--color-hairline)]">
              {data.content}
            </pre>
          </div>
        )}
      </div>

      {(status === 'error') && (
        <div className="mt-1 rounded-lg border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-3">
          <pre className="font-mono text-[11px] text-[var(--color-ink-muted)] whitespace-pre-wrap break-all">
            {data.content}
          </pre>
        </div>
      )}

      {(data.caption || number) && (
        <figcaption className="text-[13px] text-[var(--color-ink-muted)] text-center mt-2">
          {number ? <span className="font-semibold not-italic text-[var(--color-ink)]">Figure {number}{data.caption ? ' — ' : ''}</span> : null}
          <span className="italic">{data.caption}</span>
        </figcaption>
      )}
    </figure>
  );
}
