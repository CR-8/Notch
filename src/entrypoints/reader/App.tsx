import { useState, useEffect, useCallback, startTransition } from 'react';
import type { Document, Folder } from '@/lib/types';
import {
  getDocument,
  getFolders,
  getAppearance,
  saveAppearance,
  markDocumentRead,
  getEnabledProvider,
} from '@/lib/storage';
import { applyAppearance, watchAppearance } from '@/lib/theme';
import { goToLibrary } from '@/lib/navigation';
import { downloadMarkdown } from '@/lib/export';
import { log } from '@/lib/logger';
import type { AppearanceSettings } from '@/lib/types';
import { useToast } from '@/components/ui/toast';
import { ReaderLayout } from '@/components/reader/ReaderLayout';
import {
  MarkdownRenderer,
  type ParsedDocument,
} from '@/components/reader/renderers/MarkdownRenderer';

export default function ReaderApp() {
  const { addToast } = useToast();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    theme: 'dark',
    fontFamily: 'sans',
    fontSize: 'md',
    accentColor: '#111111',
  });
  const [folder, setFolder] = useState<Folder | null>(null);
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [aiReady, setAiReady] = useState(false);

  useEffect(() => {
    void getAppearance().then((a) => {
      setAppearance(a);
      applyAppearance(a);
    });
    void getEnabledProvider().then((p) => setAiReady(Boolean(p?.apiKey)));
    return watchAppearance((a) => {
      setAppearance(a);
      applyAppearance(a);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const order: Record<AppearanceSettings['theme'], AppearanceSettings['theme']> = {
      dark: 'light',
      light: 'system',
      system: 'dark',
    };
    const next = { ...appearance, theme: order[appearance.theme] };
    setAppearance(next);
    applyAppearance(next);
    void saveAppearance(next);
  }, [appearance]);

  const loadDocument = useCallback(() => {
    setLoading(true);
    setError(null);
    const id = new URLSearchParams(window.location.search).get('documentId');
    if (!id) {
      setError('No document ID provided.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const [result, folders] = await Promise.all([getDocument(id), getFolders()]);
        if (!result) {
          log.warn('READER', `Document not found: ${id}`);
          setError(`Document not found: ${id}`);
        } else {
          if (!result.content && !result.enrichedContent && result.textContent) {
            log.warn('READER', 'content is empty, using textContent as fallback');
            result.content = result.textContent;
          }
          setDoc(result);
          if (result.folder) {
            const f = folders.find((f) => f.id === result.folder) ?? null;
            setFolder(f);
          }
          if (!result.isRead) void markDocumentRead(id);
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    startTransition(() => {
      loadDocument();
    });
  }, [loadDocument]);

  const handleTocReady = useCallback((data: ParsedDocument) => {
    setParsed(data);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas-soft">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-primary" />
          <span className="text-[13px] font-medium text-ink-muted">Loading document...</span>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    const errorTitle = !doc ? 'Document not found' : 'Something went wrong';
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-canvas-soft">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sale/10">
          <span className="text-[18px] font-bold text-sale">!</span>
        </div>
        <span className="text-[15px] font-semibold text-ink">{errorTitle}</span>
        {error && <span className="text-[13px] text-ink-muted">{error}</span>}
        <div className="flex gap-3">
          <button
            onClick={loadDocument}
            className="rounded-full bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary-active"
          >
            Retry
          </button>
          <button
            onClick={goToLibrary}
            className="rounded-full border border-hairline bg-surface px-5 py-2 text-[14px] font-medium text-ink transition-colors hover:bg-surface-hover"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const renderContent = doc.enrichedContent ?? doc.content ?? doc.textContent ?? doc.summary ?? '';

  const themeVal =
    appearance.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : appearance.theme === 'dark'
        ? 'dark'
        : 'light';

  const handleCopy = () => {
    const body = doc.enrichedContent ?? doc.content ?? doc.textContent ?? '';
    const md = `# ${doc.title}\n\n${body}`;
    navigator.clipboard
      .writeText(md)
      .then(() => addToast('Markdown copied to clipboard', 'success'))
      .catch(() => addToast('Failed to copy markdown', 'error'));
  };

  return (
    <ReaderLayout
      doc={doc}
      parsed={parsed}
      appearance={appearance}
      aiReady={aiReady}
      folderName={folder?.name}
      folderColor={folder?.color}
      onToggleTheme={toggleTheme}
      onExport={() => downloadMarkdown(doc)}
      onCopy={handleCopy}
    >
      <MarkdownRenderer content={renderContent} theme={themeVal} onTocReady={handleTocReady} />
    </ReaderLayout>
  );
}
