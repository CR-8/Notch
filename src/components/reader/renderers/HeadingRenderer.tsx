import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

interface HeadingRendererProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  id: string;
  number?: string;
  text: string;
}

const sizes: Record<number, string> = {
  1: 'text-[28px] leading-[1.15] tracking-[-0.02em] mt-10 mb-4',
  2: 'text-[22px] leading-[1.25] tracking-[-0.015em] mt-9 mb-3',
  3: 'text-[18px] leading-[1.3] tracking-[-0.01em] mt-7 mb-2',
  4: 'text-[16px] leading-[1.35] tracking-[-0.005em] mt-6 mb-2 font-semibold',
  5: 'text-[15px] leading-[1.4] mt-5 mb-1.5 font-semibold',
  6: 'text-[14px] leading-[1.4] mt-5 mb-1 font-semibold text-ink-muted',
};

export function HeadingRenderer({ level, id, number, text }: HeadingRendererProps) {
  const { addToast } = useToast();
  // tsc widens the template literal to `string` for JSX resolution, so the
  // assertion is required here despite what no-unnecessary-type-assertion thinks.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  const handleCopyLink = () => {
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => addToast('Link copied to clipboard', 'success'))
      .catch(() => {});
  };

  if (!text) return null;

  return (
    <Tag
      id={id}
      className={cn('group relative scroll-mt-24 font-display font-bold text-ink', sizes[level])}
      data-heading-number={number}
    >
      <a
        href={`#${id}`}
        onClick={(e) => {
          e.preventDefault();
          handleCopyLink();
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.history.replaceState(null, '', `#${id}`);
          }
        }}
        className="absolute -left-6 top-0 select-none font-mono text-[0.7em] font-normal leading-[inherit] text-ink-faint opacity-0 transition-opacity duration-200 hover:text-primary group-hover:opacity-100"
        aria-label={`Link to ${text}`}
      >
        #
      </a>
      {number && (
        <span className="mr-2 font-mono text-[0.72em] font-semibold tabular-nums text-primary">
          {number}
        </span>
      )}
      {text}
    </Tag>
  );
}
