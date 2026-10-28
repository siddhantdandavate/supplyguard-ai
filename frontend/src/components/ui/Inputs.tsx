import React from 'react';
import { Search, X } from 'lucide-react';

const base =
  'w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 disabled:bg-slate-50 disabled:text-slate-500';

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, children, className = '' }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-700">
      {label}
    </label>
    {children}
    {error ? (
      <p className="mt-1 text-xs text-rose-600" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    ) : null}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className = '', invalid, ...props }, ref) => (
    <input ref={ref} className={`${base} h-9 ${invalid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : ''} ${className}`} aria-invalid={invalid || undefined} {...props} />
  ),
);
Input.displayName = 'Input';

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...props }) => (
  <select className={`${base} h-9 pr-8 ${className}`} {...props}>
    {children}
  </select>
);

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, className = '', placeholder = 'Search…', ...props }) => (
  <div className={`relative ${className}`}>
    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
    <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${base} h-9 pl-8 pr-8`} aria-label={props['aria-label'] ?? placeholder} {...props} />
    {value && (
      <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Clear search">
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, id }) => (
  <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
    <input id={id} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);
