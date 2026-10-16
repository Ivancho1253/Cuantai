import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Decimal from 'decimal.js';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const formatQuantity = (value: string | number | null | undefined) => {
  if (value == null) return '—';
  const [integer, fraction] = new Decimal(value).toFixed().split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
};
export const number = (value: string | number | null | undefined, digits = 2) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(Number(value));
export const compact = (value: string | number | null | undefined) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
        Number(value),
      );
export const dateLabel = (value: string) =>
  value
    ? new Date(value).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'Fecha no informada';
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/data/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'No se pudo completar la solicitud');
  return data as T;
}

export const dateTimeLabel = (value: string) =>
  value
    ? `${new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(value))} UTC`
    : 'Fecha no informada';
