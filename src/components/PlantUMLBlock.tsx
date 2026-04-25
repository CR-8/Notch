import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
// @ts-ignore
import plantumlEncoder from 'plantuml-encoder';

interface PlantUMLBlockProps {
  code: string;
}

export function PlantUMLBlock({ code }: PlantUMLBlockProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setSvg(null);

    const encoded = plantumlEncoder.encode(code);
    const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setSvg(text);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [code]);

  return (
    // White card — PlantUML server renders with dark strokes, needs light bg
    <div className="my-4 border border-[#e0e0e0] bg-white p-4 overflow-x-auto">
      {loading && <Skeleton className="h-32 w-full" />}

      {!loading && !error && svg && (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      )}

      {!loading && error && (
        <>
          <span className="font-mono text-xs text-danger">[DIAGRAM UNAVAILABLE]</span>
          <pre className="font-mono text-xs text-[#666] mt-2 whitespace-pre-wrap break-all">{code}</pre>
        </>
      )}
    </div>
  );
}
