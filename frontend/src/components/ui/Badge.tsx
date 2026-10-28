import React from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Circle, Info, MinusCircle } from 'lucide-react';

export type Tone = 'critical' | 'high' | 'medium' | 'low' | 'success' | 'info' | 'neutral';

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
  /** Show an icon so status is not communicated by colour alone. */
  icon?: boolean;
}

const tones: Record<Tone, string> = {
  critical: 'bg-rose-50 text-rose-800 border-rose-200',
  high: 'bg-amber-50 text-amber-800 border-amber-200',
  medium: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  low: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

const icons: Record<Tone, React.ComponentType<{ className?: string }>> = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: Circle,
  low: CheckCircle2,
  success: CheckCircle2,
  info: Info,
  neutral: MinusCircle,
};

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children, className = '', size = 'md', icon = true }) => {
  const Icon = icons[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border font-medium ${tones[tone]} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
      } ${className}`}
    >
      {icon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />}
      {children}
    </span>
  );
};

export const riskTone = (level: string): Tone => {
  switch (level) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'neutral';
  }
};

export const statusTone = (status: string): Tone => {
  switch (status) {
    case 'active':
    case 'delayed':
      return 'critical';
    case 'mitigated':
    case 'in_progress':
      return 'info';
    case 'resolved':
    case 'completed':
    case 'healthy':
      return 'success';
    case 'scheduled':
      return 'neutral';
    case 'low':
      return 'high';
    default:
      return 'neutral';
  }
};
