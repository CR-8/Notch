import { useEffect, useState, useId } from 'react';

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const rawId = useId();
  const id = 'mermaid-' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'loading' | 'rendered' | 'error'>('loading');
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('mermaid').then((mod) => {
      if (cancelled) return;
      mod.default.initialize({
        theme: 'default',
        securityLevel: 'strict',
        startOnLoad: false,
      });
      setReady(true);
      setStatus('loading');
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setStatus('loading');

    import('mermaid').then(({ default: mermaid }) => mermaid.render(id, code))
      .then(({ svg }) => {
        if (cancelled) return;
        setSvgContent(svg);
        setStatus('rendered');
      })
      .catch(() => {
        if (cancelled) return;
        setSvgContent(null);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [code, id, ready]);

  return (
    <div
      className="my-4 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] p-4 overflow-x-auto"
      data-diagram-kind="mermaid"
      data-diagram-status={status}
    >
      {status === 'rendered' && svgContent && (
        <div dangerouslySetInnerHTML={{ __html: svgContent }} />
      )}
      {status === 'loading' && (
        <div className="animate-pulse h-24 bg-[var(--color-hairline)] rounded" />
      )}
      {status === 'error' && (
        <>
          <span className="text-[12px] font-medium text-[var(--color-destructive)]">Diagram failed to render</span>
          <pre className="font-mono text-[12px] text-[var(--color-ink-muted)] mt-2 whitespace-pre-wrap break-all">{code}</pre>
        </>
      )}
    </div>
  );
}
