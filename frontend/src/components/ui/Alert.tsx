import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type Kind = 'info' | 'success' | 'warning' | 'error';

const kinds: Record<Kind, { wrap: string; icon: React.ReactNode }> = {
  info: { wrap: 'border-sky-200 bg-sky-50 text-sky-900', icon: <Info className="h-4 w-4 text-sky-600" aria-hidden /> },
  success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> },
  warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-900', icon: <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> },
  error: { wrap: 'border-rose-200 bg-rose-50 text-rose-900', icon: <AlertCircle className="h-4 w-4 text-rose-600" aria-hidden /> },
};

export const Alert: React.FC<{ kind?: Kind; title?: string; children?: React.ReactNode; className?: string }> = ({ kind = 'info', title, children, className = '' }) => (
  <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${kinds[kind].wrap} ${className}`} role={kind === 'error' ? 'alert' : 'status'}>
    <span className="mt-0.5 flex-shrink-0">{kinds[kind].icon}</span>
    <div className="min-w-0">
      {title && <div className="font-semibold">{title}</div>}
      {children && <div className={title ? 'mt-0.5 text-[13px] opacity-90' : ''}>{children}</div>}
    </div>
  </div>
);
