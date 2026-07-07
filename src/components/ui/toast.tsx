import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  // Notion ex-toast: white feature-card surface + medium shadow. Status is carried
  // by the sticker palette (affirmative green) rather than a coloured fill.
  const accent = {
    success: 'var(--color-accent-green)',
    error: 'var(--color-destructive)',
    info: 'var(--color-primary)',
  }[toast.type];

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  }[toast.type];

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-level-2 cursor-pointer"
      onClick={() => onRemove(toast.id)}
    >
      <span className="text-[14px] leading-none shrink-0" style={{ color: accent }}>
        {icon}
      </span>
      <p className="text-[14px] leading-snug text-[var(--color-ink)] flex-1">{toast.message}</p>
      <button className="text-[16px] leading-none text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] shrink-0">
        ×
      </button>
    </div>
  );
}
