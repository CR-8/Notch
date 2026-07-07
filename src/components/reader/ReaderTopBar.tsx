import { ArrowLeft, Moon, Sun, Laptop, Download, Copy } from 'lucide-react';
import { goToLibrary } from '@/lib/navigation';
import type { AppearanceSettings } from '@/lib/types';

interface ReaderTopBarProps {
  title: string;
  folderName?: string;
  folderColor?: string;
  appearance: AppearanceSettings;
  onToggleTheme: () => void;
  onExportMd?: () => void;
  onCopyMd?: () => void;
}

export function ReaderTopBar({
  title,
  folderName,
  folderColor,
  appearance,
  onToggleTheme,
  onExportMd,
  onCopyMd,
}: ReaderTopBarProps) {
  const themeIcon = {
    dark: <Moon className="h-3.5 w-3.5" />,
    light: <Sun className="h-3.5 w-3.5" />,
    system: <Laptop className="h-3.5 w-3.5" />,
  }[appearance.theme];

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-hairline bg-canvas/80 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={goToLibrary}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-hover hover:text-ink-muted transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>

        {folderName && (
          <>
            <span
              className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-muted"
              style={folderColor ? { color: folderColor } : undefined}
            >
              {folderColor && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-sm"
                  style={{ backgroundColor: folderColor }}
                />
              )}
              {folderName}
            </span>
            <span className="text-[10px] text-ink-faint">/</span>
          </>
        )}

        <h1 className="truncate text-[13px] font-medium text-ink">{title}</h1>
      </div>

      <div className="flex items-center gap-0.5">
        {onCopyMd && (
          <button
            onClick={onCopyMd}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-hover hover:text-ink-muted transition-colors"
            aria-label="Copy markdown"
            title="Copy markdown"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        {onExportMd && (
          <button
            onClick={onExportMd}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-hover hover:text-ink-muted transition-colors"
            aria-label="Download markdown"
            title="Download markdown"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onToggleTheme}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-hover hover:text-ink-muted transition-colors"
          aria-label={`Theme: ${appearance.theme}`}
          title={`Theme: ${appearance.theme}`}
        >
          {themeIcon}
        </button>
      </div>
    </header>
  );
}
