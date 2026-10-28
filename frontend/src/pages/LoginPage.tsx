import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Inputs';
import { Alert } from '../components/ui/Alert';

const DEMO_ACCOUNTS = [
  { label: 'Planner', email: 'planner@supplyguard.io', password: 'password123', who: 'Sarah Jenkins' },
  { label: 'Admin', email: 'admin@supplyguard.io', password: 'admin123', who: 'Marcus Vance' },
];

const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const SHOW_DEMO = (import.meta.env.VITE_SHOW_DEMO_ACCOUNTS ?? 'true').toLowerCase() !== 'false';

export const AuthLayout: React.FC<{ children: React.ReactNode; title: string; subtitle: string }> = ({ children, title, subtitle }) => (
  <div className="screen-scroll scroll-thin bg-slate-50">
   <div className="flex min-h-full">
    <aside className="hidden w-[46%] flex-col justify-between bg-navy-900 p-10 text-slate-300 lg:flex">
      <div className="flex items-center gap-2.5">
        <div className="rounded-md bg-sky-600 p-1.5 text-white">
          <ShieldAlert className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">SupplyGuard AI</div>
          <div className="text-xs text-slate-400">Production Rescue Planner</div>
        </div>
      </div>
      <div className="max-w-md">
        <h2 className="text-3xl font-semibold leading-tight text-white">Turn a supplier delay into a decision, not a scramble.</h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          SupplyGuard calculates material shortages from a late shipment, traces the production orders and customer commitments it puts at risk, and compares recovery strategies side by side in the What-If War Room.
        </p>
        <ul className="mt-6 space-y-2 text-sm">
          {['Shortage and schedule impact computed from live inventory and order data', 'Cost versus delivery trade-off for every recovery option', 'A recommended plan with the remaining risk spelled out'].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400" aria-hidden />
              <span className="text-slate-300">{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-xs text-slate-500">FastAPI · SQLAlchemy · React · Recharts</div>
    </aside>
    <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 lg:hidden">
          <div className="rounded-md bg-navy-900 p-1.5 text-white">
            <ShieldAlert className="h-4 w-4" aria-hidden />
          </div>
          <span className="text-sm font-semibold text-slate-900">SupplyGuard AI</span>
        </div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
   </div>
  </div>
);

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const from = location.state?.from && location.state.from !== '/login' ? location.state.from : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailError = touched && !emailValid(email) ? 'Enter a valid email address.' : null;
  const passwordError = touched && password.length === 0 ? 'Password is required.' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!emailValid(email) || !password) return;
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Use your SupplyGuard account to open the control center.">
      {SHOW_DEMO && (
      <div className="mb-5 rounded-md border border-slate-200 bg-white p-3">
        <div className="mb-2 text-xs font-medium text-slate-600">Demo accounts (seeded demonstration data)</div>
        <div className="flex gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                setEmail(a.email);
                setPassword(a.password);
                setError(null);
              }}
              className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs hover:border-sky-300 hover:bg-sky-50"
            >
              <span className="block font-semibold text-slate-800">{a.label}</span>
              <span className="block text-slate-500">{a.who}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      {error && (
        <Alert kind="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Work email" htmlFor="email" error={emailError}>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" invalid={!!emailError} />
        </Field>
        <Field label="Password" htmlFor="password" error={passwordError}>
          <div className="relative">
            <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" invalid={!!passwordError} />
            <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" className="w-full" isLoading={loading} icon={ArrowRight} iconPosition="right">
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        New here?{' '}
        <Link to="/register" className="font-medium text-sky-700 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
};
