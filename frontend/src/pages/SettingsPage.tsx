import React, { useState } from 'react';
import { Database, KeyRound, LogOut, RefreshCw, Server, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, BASE_URL } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Inputs';
import { KeyValueList } from '../components/ui/KeyValue';
import { DataState } from '../components/ui/States';
import { ConfirmDialog } from '../components/ui/Modal';
import { fmtDate } from '../lib/format';

const roleDescriptions: Record<string, string> = {
  admin: 'Full access to all operations data and account administration.',
  planner: 'Plans production, triages disruptions and runs War Room scenarios.',
  operator: 'Executes shop-floor work and updates inventory.',
  viewer: 'Read-only access to dashboards and reports.',
};

export const SettingsPage: React.FC = () => {
  const { user, logout, setUser } = useAuth();
  const toast = useToast();
  const system = useFetch(() => api.getSystemInfo(), []);
  const [health, setHealth] = useState<{ ok: boolean; latency: number } | null>(null);
  const [pinging, setPinging] = useState(false);

  const [name, setName] = useState(user?.full_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const nameError = name.trim().length < 2 ? 'Enter at least 2 characters.' : null;

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwTouched, setPwTouched] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const pwErrors = {
    current: pw.current === '' ? 'Enter your current password.' : null,
    next: pw.next.length < 8 ? 'Use at least 8 characters.' : pw.next === pw.current ? 'Choose a different password.' : null,
    confirm: pw.confirm !== pw.next ? 'Passwords do not match.' : null,
  };
  const pwInvalid = Object.values(pwErrors).some(Boolean);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const ping = async () => {
    setPinging(true);
    const start = performance.now();
    try {
      await api.checkHealth();
      setHealth({ ok: true, latency: Math.round(performance.now() - start) });
    } catch {
      setHealth({ ok: false, latency: 0 });
    } finally {
      setPinging(false);
    }
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameError) return;
    setSavingName(true);
    try {
      const updated = await api.updateMe(name.trim());
      setUser(updated);
      toast.success('Profile updated', 'Your display name was saved.');
    } catch (err) {
      toast.error('Could not update profile', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwTouched(true);
    if (pwInvalid) return;
    setSavingPw(true);
    try {
      await api.changePassword(pw.current, pw.next);
      toast.success('Password changed', 'Use the new password next time you sign in.');
      setPw({ current: '', next: '', confirm: '' });
      setPwTouched(false);
    } catch (err) {
      toast.error('Could not change password', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your profile, account security and the API connection this workspace uses." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><UserIcon className="h-4 w-4 text-slate-500" aria-hidden /> Profile</span>} subtitle="How you appear across SupplyGuard">
          <KeyValueList
            columns={2}
            className="mb-5"
            items={[
              { label: 'Email', value: user?.email ?? '—' },
              { label: 'Role', value: <span className="flex items-center gap-2"><Badge tone="info" icon={false}>{user?.role}</Badge></span> },
              { label: 'Member since', value: fmtDate(user?.created_at) },
              { label: 'Account status', value: user?.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="critical">Inactive</Badge> },
            ]}
          />
          <p className="mb-4 text-xs text-slate-500">{roleDescriptions[user?.role ?? ''] ?? ''} Role changes are managed by an administrator and are not editable here.</p>
          <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Display name" htmlFor="name" error={name !== user?.full_name ? nameError : null} className="flex-1">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Button type="submit" isLoading={savingName} disabled={!!nameError || name.trim() === user?.full_name}>
              Save name
            </Button>
          </form>
        </Card>

        <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><KeyRound className="h-4 w-4 text-slate-500" aria-hidden /> Change password</span>} subtitle="Passwords are verified and re-hashed by the backend">
          <form onSubmit={savePassword} className="space-y-3" noValidate>
            <Field label="Current password" htmlFor="pw-current" error={pwTouched ? pwErrors.current : null}>
              <Input id="pw-current" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} invalid={pwTouched && !!pwErrors.current} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New password" htmlFor="pw-next" error={pwTouched ? pwErrors.next : null} hint="8 to 72 characters">
                <Input id="pw-next" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} invalid={pwTouched && !!pwErrors.next} />
              </Field>
              <Field label="Confirm new password" htmlFor="pw-confirm" error={pwTouched ? pwErrors.confirm : null}>
                <Input id="pw-confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} invalid={pwTouched && !!pwErrors.confirm} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" isLoading={savingPw}>
                Update password
              </Button>
            </div>
          </form>
        </Card>

        <Card
          title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Server className="h-4 w-4 text-slate-500" aria-hidden /> API connection</span>}
          subtitle="Runtime information reported by the backend"
          action={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={ping} isLoading={pinging}>Test connection</Button>}
        >
          <DataState loading={system.loading} error={system.error} onRetry={() => system.reload()}>
            {system.data && (
              <KeyValueList
                columns={2}
                items={[
                  { label: 'Service', value: `${system.data.app_name} v${system.data.version}` },
                  { label: 'API base URL', value: <span className="break-all">{BASE_URL.startsWith('/') ? `${window.location.origin}${BASE_URL}` : BASE_URL}</span> },
                  { label: 'Frontend', value: `${import.meta.env.MODE} build` },
                  { label: 'Health check', value: health ? (health.ok ? <Badge tone="success">Online · {health.latency} ms</Badge> : <Badge tone="critical">Unreachable</Badge>) : <span className="text-slate-500">Not tested yet</span> },
                  { label: 'Authentication', value: system.data.auth },
                  { label: 'Session lifetime', value: `${Math.round(system.data.token_lifetime_minutes / 60)} hours` },
                  { label: 'Interactive API docs', value: <a href={`${BASE_URL.replace(/\/api$/, '')}/docs`} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">Open /docs</a> },
                ]}
              />
            )}
          </DataState>
        </Card>

        <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Database className="h-4 w-4 text-slate-500" aria-hidden /> Data</span>} subtitle="Where operations data is stored">
          <DataState loading={system.loading} error={system.error} onRetry={() => system.reload()}>
            {system.data && (
              <>
                <KeyValueList
                  columns={2}
                  items={[
                    { label: 'Database engine', value: <span className="capitalize">{system.data.database_dialect === 'postgresql' ? 'PostgreSQL' : system.data.database_dialect}</span> },
                    { label: 'Target', value: <span className="break-all">{system.data.database_target}</span> },
                    { label: 'Mode', value: system.data.using_sqlite_fallback ? <Badge tone="high">SQLite fallback (local development)</Badge> : <Badge tone="success">Primary PostgreSQL</Badge> },
                    { label: 'Demonstration data', value: system.data.demo_data ? <Badge tone="info">Seeded demo records</Badge> : <Badge tone="neutral">Off</Badge> },
                  ]}
                />
                {system.data.using_sqlite_fallback && <p className="mt-3 text-xs text-slate-500">PostgreSQL was not reachable at startup, so the backend is using its local SQLite database. Set DATABASE_URL and restart the backend to use PostgreSQL.</p>}
              </>
            )}
          </DataState>
        </Card>
      </div>

      <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-slate-500" aria-hidden /> Session</span>}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">Signing out removes the access token from this browser. You can sign back in with the same credentials.</p>
          <Button variant="danger" icon={LogOut} onClick={() => setConfirmLogout(true)}>
            Sign out
          </Button>
        </div>
      </Card>

      <ConfirmDialog open={confirmLogout} title="Sign out" message="End your SupplyGuard session on this device?" confirmLabel="Sign out" tone="danger" onConfirm={logout} onCancel={() => setConfirmLogout(false)} />
    </div>
  );
};
