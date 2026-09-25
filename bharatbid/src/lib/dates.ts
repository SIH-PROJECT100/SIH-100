import { format, formatDistance, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const date = typeof iso === 'string' ? parseISO(iso) : new Date(iso);
    return format(date, 'dd MMM yyyy');
  } catch {
    return String(iso);
  }
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const date = typeof iso === 'string' ? parseISO(iso) : new Date(iso);
    return formatInTimeZone(date, 'Asia/Kolkata', 'dd MMM yyyy, HH:mm') + ' IST';
  } catch {
    return String(iso);
  }
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const date = typeof iso === 'string' ? parseISO(iso) : new Date(iso);
    return formatDistance(date, new Date(), { addSuffix: true });
  } catch {
    return String(iso);
  }
}

export function formatBoth(iso?: string | null): string {
  if (!iso) return '—';
  return `${formatDateTime(iso)} · ${formatRelative(iso)}`;
}
