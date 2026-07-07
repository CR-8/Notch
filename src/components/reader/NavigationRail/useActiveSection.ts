import { useState, useEffect, useRef } from 'react';

export interface SectionObserver {
  activeId: string | null;
  sectionIds: string[];
}

export function useActiveSection(
  containerRef: React.RefObject<HTMLElement | null>,
  headingIds: string[],
  offset = 120,
): SectionObserver {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || headingIds.length === 0) return;

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        setActiveId(visible[0].target.id);
        return;
      }

      const scrollTop = el.scrollTop;
      let closest: string | null = null;
      let closestDist = Infinity;

      for (const id of headingIds) {
        const heading = el.querySelector(`#${CSS.escape(id)}`);
        if (!heading) continue;
        const dist = Math.abs(heading.offsetTop - scrollTop - offset);
        if (dist < closestDist) {
          closestDist = dist;
          closest = id;
        }
      }

      if (closest) setActiveId(closest);
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      root: el,
      rootMargin: `-${offset}px 0px -40% 0px`,
      threshold: [0, 0.25, 0.5],
    });

    for (const id of headingIds) {
      const heading = el.querySelector(`#${CSS.escape(id)}`);
      if (heading) observerRef.current.observe(heading);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [containerRef, headingIds, offset]);

  return { activeId, sectionIds: headingIds };
}
