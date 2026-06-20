import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Convierte ISO UTC a valor para input datetime-local (siempre hora Chile). */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/** Convierte datetime-local (hora Chile) a ISO UTC para guardar en BD. */
export function fromDatetimeLocalValue(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const [, ys, ms, ds, hs, mins] = m;
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  const h = Number(hs);
  const mi = Number(mins);
  const tz = 'America/Santiago';

  let lo = Date.UTC(y, mo - 1, d - 1, 3, 0);
  let hi = Date.UTC(y, mo - 1, d + 1, 8, 0);

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = fmt.formatToParts(new Date(mid));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
    let ph = get('hour');
    if (ph === 24) ph = 0;
    const py = get('year');
    const pmo = get('month');
    const pd = get('day');
    const pmi = get('minute');

    const cmp = py !== y ? py - y : pmo !== mo ? pmo - mo : pd !== d ? pd - d : ph !== h ? ph - h : pmi - mi;
    if (cmp === 0) return new Date(mid).toISOString();
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending_approval: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    published: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    manual_required: 'bg-orange-100 text-orange-800',
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...fetchOptions, headers });
  const data = await res.json();
  if (!res.ok) {
    const msg = typeof data.error === 'string'
      ? data.error
      : data.error?.fieldErrors
        ? Object.entries(data.error.fieldErrors as Record<string, string[]>)
            .map(([k, v]) => `${k}: ${v.join(', ')}`)
            .join('\n')
        : data.message || JSON.stringify(data.error) || 'Error en la solicitud';
    throw new Error(msg);
  }
  return data as T;
}
