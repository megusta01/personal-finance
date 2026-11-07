import {
  addMonths,
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfMonth,
  endOfMonth,
  subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Datas de lançamento são guardadas como "AAAA-MM-DD" (data local, sem fuso).
 * Assim "dia 5" é sempre dia 5, em qualquer fuso e em qualquer aparelho.
 * Carimbos de tempo (created_at/updated_at) usam ISO 8601 em UTC.
 */
export type ISODate = string; // "2026-11-07"
export type MonthKey = string; // "2026-11"

export function toISODate(d: Date): ISODate {
  return format(d, 'yyyy-MM-dd');
}

export function fromISODate(s: ISODate): Date {
  return parseISO(s);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function daysAgoISO(days: number): ISODate {
  return toISODate(subDays(new Date(), days));
}

export function nowTimestamp(): string {
  return new Date().toISOString();
}

export function monthKey(d: Date): MonthKey {
  return format(d, 'yyyy-MM');
}

export function monthKeyOf(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  return monthKey(addMonths(parseISO(`${key}-01`), delta));
}

/** Primeiro e último dia do mês, inclusivos: ["2026-11-01", "2026-11-30"] */
export function monthRange(key: MonthKey): [ISODate, ISODate] {
  const first = parseISO(`${key}-01`);
  return [toISODate(startOfMonth(first)), toISODate(endOfMonth(first))];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Novembro de 2026" */
export function formatMonthLong(key: MonthKey): string {
  return capitalize(format(parseISO(`${key}-01`), "MMMM 'de' yyyy", { locale: ptBR }));
}

/** "nov" */
export function formatMonthShort(key: MonthKey): string {
  return format(parseISO(`${key}-01`), 'MMM', { locale: ptBR }).replace('.', '');
}

/** "Hoje", "Ontem" ou "Sexta, 6 de novembro" */
export function formatDayHeading(date: ISODate, { relative = true } = {}): string {
  const d = parseISO(date);
  if (relative && isToday(d)) return 'Hoje';
  if (relative && isYesterday(d)) return 'Ontem';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const pattern = sameYear ? "EEEE, d 'de' MMMM" : "EEEE, d 'de' MMMM 'de' yyyy";
  return capitalize(format(d, pattern, { locale: ptBR }).replace('-feira', ''));
}

/** "06/11/2026" */
export function formatDateShort(date: ISODate): string {
  return format(parseISO(date), 'dd/MM/yyyy');
}

/** "Hoje", "Ontem" ou "6 de nov." para campos de formulário */
export function formatDateField(date: ISODate): string {
  const d = parseISO(date);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "d 'de' MMM 'de' yyyy", { locale: ptBR });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Lê as datas que a versão antiga do app gravava com toLocaleDateString/TimeString,
 * por exemplo "07/11/2026 16:29:00" (pt-BR) ou "11/7/2026, 4:29:00 PM" (en-US).
 * Quando dia e mês são ambíguos (ambos ≤ 12), assume o padrão brasileiro dd/mm.
 */
export function parseLegacyDate(raw: string): { date: ISODate; timestamp: string } | null {
  const m = raw
    .trim()
    .match(
      /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/,
    );
  if (!m) return null;

  const [, a, b, c] = m;
  let year: number, month: number, day: number;

  if (a!.length === 4) {
    // 2026-11-07
    year = +a!;
    month = +b!;
    day = +c!;
  } else {
    year = +c!;
    if (year < 100) year += 2000;
    const first = +a!;
    const second = +b!;
    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      month = first;
      day = second;
    } else {
      day = first;
      month = second;
    }
  }

  let hour = m[4] ? +m[4] : 12;
  const minute = m[5] ? +m[5] : 0;
  const second = m[6] ? +m[6] : 0;
  const ampm = m[7]?.toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  const d = new Date(year, month - 1, day, hour, minute, second);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return { date: toISODate(d), timestamp: d.toISOString() };
}
