import { motion } from 'motion/react';
import {
  PanelLeft,
  PanelRight,
  Search,
  Moon,
  Sun,
  Laptop,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { goToLibrary } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { AppearanceSettings } from '@/lib/types';
import { IconButton } from './parts/IconButton';

export interface ReaderHeaderProps {
  title: string;
  folderName?: string;
  folderColor?: string;
  appearance: AppearanceSettings;
  aiReady: boolean;
  sidebarOpen: boolean;
  panelOpen: boolean;
  isFullscreen: boolean;
  immersive: boolean;
  onToggleSidebar: () => void;
  onTogglePanel: () => void;
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onToggleFullscreen: () => void;
  onExport: () => void;
  onCopy: () => void;
  onOpenSettings: () => void;
}

const THEME_ICON = {
  dark: <Moon className="h-4 w-4" />,
  light: <Sun className="h-4 w-4" />,
  system: <Laptop className="h-4 w-4" />,
} as const;

export function ReaderHeader({
  title,
  folderName,
  folderColor,
  appearance,
  aiReady,
  sidebarOpen,
  panelOpen,
  isFullscreen,
  immersive,
  onToggleSidebar,
  onTogglePanel,
  onToggleTheme,
  onOpenSearch,
  onToggleFullscreen,
  onExport,
  onCopy,
  onOpenSettings,
}: ReaderHeaderProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <motion.header
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        className={cn(
          'reader-glass pointer-events-auto absolute left-1/2 top-3 z-30 -translate-x-1/2',
          'flex items-center gap-1 rounded-2xl px-2 py-1.5',
          'w-[calc(100%-1.5rem)] max-w-[980px]',
        )}
      >
        {/* Left cluster — navigation + context */}
        <div className="flex min-w-0 items-center gap-1">
          <IconButton label="Back to library" onClick={goToLibrary} tooltipSide="bottom">
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            shortcut="["
            active={sidebarOpen}
            onClick={onToggleSidebar}
          >
            <PanelLeft className="h-4 w-4" />
          </IconButton>

          <div className="mx-1 h-4 w-px bg-hairline" aria-hidden />

          <div className="flex min-w-0 items-center gap-1.5">
            {folderName && (
              <>
                <span
                  className="hidden items-center gap-1.5 text-[12px] font-medium text-ink-muted sm:inline-flex"
                  style={folderColor ? { color: folderColor } : undefined}
                >
                  {folderColor && (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: folderColor }}
                    />
                  )}
                  {folderName}
                </span>
                <span className="hidden text-[11px] text-ink-faint sm:inline">/</span>
              </>
            )}
            <h1 className="truncate text-[13px] font-medium text-ink" title={title}>
              {title}
            </h1>
          </div>
        </div>

        {/* Right cluster — actions */}
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="Search" shortcut="⌘K" onClick={onOpenSearch}>
            <Search className="h-4 w-4" />
          </IconButton>

          {/* AI status — real signal from configured providers */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={aiReady ? 'AI ready' : 'AI not configured'}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <span className="relative flex h-1.5 w-1.5">
                  {aiReady && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  )}
                  <span
                    className={cn(
                      'relative inline-flex h-1.5 w-1.5 rounded-full',
                      aiReady ? 'bg-success' : 'bg-accent-orange',
                    )}
                  />
                </span>
                <span className="font-mono text-[11px] font-medium tracking-wide">AI</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {aiReady ? 'AI ready' : 'AI not configured — add a provider in Settings'}
            </TooltipContent>
          </Tooltip>

          <div className="mx-1 h-4 w-px bg-hairline" aria-hidden />

          <IconButton label={`Theme: ${appearance.theme}`} onClick={onToggleTheme}>
            {THEME_ICON[appearance.theme]}
          </IconButton>
          <IconButton
            label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            shortcut="F"
            active={isFullscreen}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </IconButton>
          <IconButton label="Copy as Markdown" onClick={onCopy}>
            <Copy className="h-4 w-4" />
          </IconButton>
          <IconButton label="Export Markdown" onClick={onExport}>
            <Download className="h-4 w-4" />
          </IconButton>
          <IconButton label="Settings" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </IconButton>

          {!immersive && (
            <>
              <div className="mx-1 h-4 w-px bg-hairline" aria-hidden />
              <IconButton
                label={panelOpen ? 'Hide panel' : 'Show panel'}
                shortcut="]"
                active={panelOpen}
                onClick={onTogglePanel}
              >
                <PanelRight className="h-4 w-4" />
              </IconButton>
            </>
          )}
        </div>
      </motion.header>
    </TooltipProvider>
  );
}
