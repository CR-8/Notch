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

  // Lazy-load mermaid — always use 'default' (light) theme so arrows/lines
  // are visible regardless of the reader's dark/light mode. The diagram sits
  // on a white card background so contrast is always correct.
  useEffect(() => {
    import('mermaid').then((mod) => {
      mod.default.initialize({
        theme: 'default',
        securityLevel: 'strict',
        startOnLoad: false,
      });
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    let cancelled = false;

    import('mermaid').then(({ default: mermaid }) => mermaid.render(id, code))
      .then(({ svg }) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        if (errorRef.current) errorRef.current.style.display = 'none';
      })
      .catch(() => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        if (errorRef.current) errorRef.current.style.display = 'block';
      });

    return () => { cancelled = true; };
  }, [code, id, ready]);

  return (
    // White card — ensures arrows and lines are always visible in both
    // dark and light reader modes since mermaid renders with dark strokes.
    <div className="my-4 border border-[#e0e0e0] bg-white p-4 overflow-x-auto">
      <div ref={containerRef} />
      <div ref={errorRef} style={{ display: 'none' }}>
        <span className="font-mono text-xs text-danger">[DIAGRAM ERROR]</span>
        <pre className="font-mono text-xs text-[#666] mt-2 whitespace-pre-wrap break-all">{code}</pre>
      </div>
    </div>
  );
}
