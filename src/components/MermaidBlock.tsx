import { useEffect, useRef, useId, useState } from 'react';

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const id = 'mermaid-' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'loading' | 'rendered' | 'error'>('loading');

  // Lazy-load mermaid — always use 'default' (light) theme so arrows/lines
  // are visible regardless of the reader's dark/light mode. The diagram sits
  // on a parchment card background so contrast remains consistent.
  useEffect(() => {
    import('mermaid').then((mod) => {
      mod.default.initialize({
        theme: 'default',
        securityLevel: 'strict',
        startOnLoad: false,
      });
      setReady(true);
      setStatus('loading');
    }).catch(() => {
      setStatus('error');
    });
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    let cancelled = false;
    setStatus('loading');

    import('mermaid').then(({ default: mermaid }) => mermaid.render(id, code))
      .then(({ svg }) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        if (errorRef.current) errorRef.current.style.display = 'none';
        setStatus('rendered');
      })
      .catch(() => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        if (errorRef.current) errorRef.current.style.display = 'block';
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [code, id, ready]);

  return (
    // Parchment card keeps line contrast high while matching the app theme.
    <div
      className="my-4 border border-border bg-[#f5ead3] p-4 overflow-x-auto"
      data-diagram-kind="mermaid"
      data-diagram-status={status}
    >
      <div ref={containerRef} />
      <div ref={errorRef} style={{ display: 'none' }}>
        <span className="font-mono text-xs text-danger">[DIAGRAM ERROR]</span>
        <pre className="font-mono text-xs text-muted mt-2 whitespace-pre-wrap break-all">{code}</pre>
      </div>
    </div>
  );
}
