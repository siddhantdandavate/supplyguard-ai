import React from 'react';
import { AlertCircle, Inbox, Loader2, LucideIcon, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const Spinner: React.FC<{ label?: string; className?: string }> = ({ label = 'Loading', className = '' }) => (
  <div className={`flex items-center gap-2 text-sm text-slate-500 ${className}`} role="status" aria-live="polite">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
    <span>{label}…</span>
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} aria-hidden />
);

export const LoadingBlock: React.FC<{ rows?: number; label?: string }> = ({ rows = 4, label = 'Loading' }) => (
  <div className="space-y-3 p-5" role="status" aria-live="polite" aria-label={label}>
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className={`h-4 ${i % 3 === 0 ? 'w-3/4' : i % 3 === 1 ? 'w-full' : 'w-1/2'}`} />
    ))}
  </div>
);

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon = Inbox, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
    <div className="rounded-full bg-slate-100 p-3 text-slate-500">
      <Icon className="h-6 w-6" aria-hidden />
    </div>
    <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
    {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, className = '' }) => (
  <div className={`flex flex-col items-center justify-center px-6 py-10 text-center ${className}`} role="alert">
    <div className="rounded-full bg-rose-50 p-3 text-rose-600">
      <AlertCircle className="h-6 w-6" aria-hidden />
    </div>
    <h3 className="mt-3 text-sm font-semibold text-slate-900">Could not load data</h3>
    <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
    {onRetry && (
      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-4">
        Try again
      </Button>
    )}
  </div>
);

interface DataStateProps {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: React.ReactNode;
  children: React.ReactNode;
  loadingRows?: number;
}

/** Renders loading / error / empty states, otherwise children. */
export const DataState: React.FC<DataStateProps> = ({ loading, error, onRetry, isEmpty, empty, children, loadingRows }) => {
  if (loading) return <LoadingBlock rows={loadingRows} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children}</>;
};
