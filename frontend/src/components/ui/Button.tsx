import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-sky-700 text-white hover:bg-sky-800 focus-visible:ring-sky-600 shadow-sm',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400 shadow-sm',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500 shadow-sm',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400',
  outline: 'border border-sky-700 text-sky-800 hover:bg-sky-50 focus-visible:ring-sky-600',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  isLoading = false,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    {...props}
  >
    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon && iconPosition === 'left' ? <Icon className="h-4 w-4" aria-hidden /> : null}
    {children && <span>{children}</span>}
    {!isLoading && Icon && iconPosition === 'right' ? <Icon className="h-4 w-4" aria-hidden /> : null}
  </button>
);
