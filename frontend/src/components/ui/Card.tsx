import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: 'default' | 'critical' | 'accent';
}

export const Card: React.FC<CardProps> = ({ title, subtitle, action, children, className = '', bodyClassName = 'p-5', tone = 'default' }) => {
  const border = tone === 'critical' ? 'border-rose-200' : tone === 'accent' ? 'border-sky-200' : 'border-slate-200';
  return (
    <section className={`rounded-lg border bg-white shadow-card ${border} ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            {typeof title === 'string' ? <h2 className="text-sm font-semibold text-slate-900">{title}</h2> : title}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
};
