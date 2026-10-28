import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Inputs';
import { Alert } from '../components/ui/Alert';
import { AuthLayout } from './LoginPage';

const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '', role: 'planner' });
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = {
    full_name: form.full_name.trim().length < 2 ? 'Enter your full name.' : null,
    email: !emailValid(form.email) ? 'Enter a valid email address.' : null,
    password: form.password.length < 8 ? 'Use at least 8 characters.' : form.password.length > 72 ? 'Use at most 72 characters.' : null,
    confirm: form.confirm !== form.password ? 'Passwords do not match.' : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (touched ? errors[k] : null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (hasErrors) return;
    setLoading(true);
    try {
      await register({ full_name: form.full_name.trim(), email: form.email.trim(), password: form.password, role: form.role });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Accounts are stored in the SupplyGuard database with bcrypt-hashed passwords.">
      {error && (
        <Alert kind="error" className="mb-4">
          {error}
        </Alert>
      )}
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Full name" htmlFor="full_name" error={show('full_name')}>
          <Input id="full_name" autoComplete="name" value={form.full_name} onChange={set('full_name')} invalid={!!show('full_name')} />
        </Field>
        <Field label="Work email" htmlFor="reg_email" error={show('email')}>
          <Input id="reg_email" type="email" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!show('email')} />
        </Field>
        <Field label="Role" htmlFor="role" hint="Roles are informational in this release.">
          <Select id="role" value={form.role} onChange={set('role')}>
            <option value="planner">Production planner</option>
            <option value="operator">Operations</option>
            <option value="admin">Administrator</option>
            <option value="viewer">Viewer</option>
          </Select>
        </Field>
        <Field label="Password" htmlFor="reg_password" error={show('password')} hint="8 to 72 characters.">
          <Input id="reg_password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} invalid={!!show('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={show('confirm')}>
          <Input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} invalid={!!show('confirm')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" isLoading={loading} icon={ArrowRight} iconPosition="right">
          Create account
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-sky-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};
