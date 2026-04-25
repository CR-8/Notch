import { useEffect, useRef, useId } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid once at module level with dark theme from design system
mermaid.initialize({
  theme: 'dark',
  themeVariables: {
    background: '#000000',
    primaryColor: '#5E6AD2',
    primaryTextColor: '#EAEAEA',
    lineColor: '#666666',
    edgeLabelBackground: '#0F0F0F',
    fontFamily: 'JetBrains Mono',
  },
  securityLevel: 'strict',
  startOnLoad: false,
});

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  // useId returns something like ":r0:" — sanitize for mermaid
  const id = 'mermaid-' + rawId.replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    mermaid.render(id, code).then(({ svg }) => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = svg;
      if (errorRef.current) errorRef.current.style.display = 'none';
    }).catch(() => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      if (errorRef.current) errorRef.current.style.display = 'block';
    });

    return () => { cancelled = true; };
  }, [code, id]);

  return (
    <div className="border border-border p-3 my-4">
      {/* SVG render target */}
      <div ref={containerRef} />

      {/* Error fallback — hidden until render fails */}
      <div ref={errorRef} style={{ display: 'none' }}>
        <span className="font-mono text-xs text-danger">[DIAGRAM ERROR]</span>
        <pre className="font-mono text-xs text-muted mt-2 whitespace-pre-wrap break-all">{code}</pre>
      </div>
    </div>
  );
}
