import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen-scroll flex items-center justify-center bg-slate-50 p-6" role="alert">
        <div className="w-full max-w-md rounded-lg border border-rose-200 bg-white p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-rose-50 p-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <h1 className="text-base font-semibold text-slate-900">Something went wrong</h1>
          </div>
          <p className="mt-3 text-sm text-slate-600">The page hit an unexpected error. Reloading usually fixes it; your data on the server is unaffected.</p>
          <pre className="mt-3 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-500">{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()} className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-sky-700 px-3.5 text-sm font-medium text-white hover:bg-sky-800">
            <RefreshCw className="h-4 w-4" aria-hidden /> Reload page
          </button>
        </div>
      </div>
    );
  }
}
