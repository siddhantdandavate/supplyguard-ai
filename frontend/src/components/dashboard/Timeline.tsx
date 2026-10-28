import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Flag, PackageCheck, PackageX, Truck } from 'lucide-react';
import { TimelineEvent } from '../../types/api';
import { fmtDateShort, relativeDays } from '../../lib/format';

const kindIcon: Record<TimelineEvent['kind'], React.ComponentType<{ className?: string }>> = {
  today: Flag,
  original_eta: Truck,
  revised_eta: PackageX,
  order_due: CalendarClock,
  projected_completion: PackageCheck,
};

const sevDot: Record<TimelineEvent['severity'], string> = {
  critical: 'bg-rose-600',
  high: 'bg-amber-500',
  medium: 'bg-yellow-500',
  low: 'bg-slate-400',
  info: 'bg-sky-600',
};

export const Timeline: React.FC<{ events: TimelineEvent[] }> = ({ events }) => {
  if (events.length === 0) return <p className="text-sm text-slate-500">No upcoming dates to show.</p>;
  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {events.map((e, i) => {
        const Icon = kindIcon[e.kind];
        const isToday = e.kind === 'today';
        const link = e.disruption_id ? `/disruptions/${e.disruption_id}` : e.order_id ? `/orders/${e.order_id}` : null;
        const body = (
          <div className={`flex items-start gap-3 ${isToday ? 'font-semibold text-sky-800' : ''}`}>
            <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${isToday ? 'text-sky-700' : 'text-slate-400'}`} aria-hidden />
            <div className="min-w-0">
              <div className="text-sm text-slate-800">{e.label}</div>
              <div className="text-xs text-slate-500">
                {fmtDateShort(e.date)} · {relativeDays(e.date)}
              </div>
            </div>
          </div>
        );
        return (
          <li key={`${e.kind}-${e.date}-${i}`} className="relative mb-4 pl-5 last:mb-0">
            <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${sevDot[e.severity]}`} aria-hidden />
            {link ? (
              <Link to={link} className="block rounded-md -mx-1 px-1 hover:bg-slate-50">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
};
