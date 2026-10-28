import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, crumbs, actions, badge }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-slate-500">
          {crumbs.map((c, i) => (
            <React.Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
              {c.to ? (
                <Link to={c.to} className="hover:text-slate-800 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="text-slate-700">{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {badge}
      </div>
      {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
    </div>
    {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
