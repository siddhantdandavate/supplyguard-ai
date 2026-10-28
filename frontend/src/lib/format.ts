const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const currencyExact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('en-US');

export const fmtMoney = (v: number | null | undefined) => (v == null ? '—' : currency.format(v));
export const fmtMoneyExact = (v: number | null | undefined) => (v == null ? '—' : currencyExact.format(v));
export const fmtNumber = (v: number | null | undefined) => (v == null ? '—' : number.format(v));
export const fmtPct = (v: number | null | undefined, digits = 0) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`);

export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(iso: string | null | undefined): string {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export function fmtDateShort(iso: string | null | undefined): string {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
}

export function fmtDateTime(iso: string | null | undefined): string {
  const d = parseDate(iso);
  return d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}

export function daysFromToday(iso: string | null | undefined): number | null {
  const d = parseDate(iso);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function relativeDays(iso: string | null | undefined): string {
  const n = daysFromToday(iso);
  if (n === null) return '—';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${Math.abs(n)} days ago`;
}

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const plural = (n: number, one: string, many = `${one}s`) => `${fmtNumber(n)} ${n === 1 ? one : many}`;
