import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextType {
  notify: (kind: ToastKind, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const styles: Record<ToastKind, { wrap: string; icon: React.ReactNode }> = {
  success: { wrap: 'border-emerald-200 bg-white', icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden /> },
  error: { wrap: 'border-rose-200 bg-white', icon: <AlertCircle className="h-5 w-5 text-rose-600" aria-hidden /> },
  info: { wrap: 'border-sky-200 bg-white', icon: <Info className="h-5 w-5 text-sky-600" aria-hidden /> },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, title, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      notify,
      success: (t: string, m?: string) => notify('success', t, m),
      error: (t: string, m?: string) => notify('error', t, m),
      info: (t: string, m?: string) => notify('info', t, m),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg ${styles[t.kind].wrap}`}>
            {styles[t.kind].icon}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">{t.title}</div>
              {t.message && <div className="mt-0.5 text-xs text-slate-600">{t.message}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
