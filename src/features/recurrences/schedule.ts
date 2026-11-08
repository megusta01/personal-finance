/**
 * Datas de uma recorrência (funções puras).
 *
 * - Mensal: no dia escolhido; se o mês não tiver esse dia (31 em abril), usa o último dia.
 *   O dia original não se perde: depois de 30/04, o próximo continua sendo 31/05.
 * - Anual: mesma data; 29/02 vira 28/02 em anos comuns.
 * - Semanal: a cada N semanas a partir da data de início.
 * - Término opcional: até uma data (inclusive) ou depois de N ocorrências.
 */
import { addDays, differenceInCalendarDays, getDaysInMonth, parseISO } from 'date-fns';
import { toISODate, type ISODate } from '@/lib/dates';

export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export type Schedule = {
  frequency: Frequency;
  /** A cada quantas semanas/meses/anos (1 = toda). */
  interval: number;
  /** Primeira ocorrência. Define o dia do mês / dia da semana / data no ano. */
  startOn: ISODate;
  endOn?: ISODate | null;
  /** Número máximo de ocorrências (contando desde o início). */
  count?: number | null;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function monthDate(year: number, monthIndex: number, day: number): ISODate {
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  const last = getDaysInMonth(new Date(y, m, 1));
  return `${y}-${pad(m + 1)}-${pad(Math.min(day, last))}`;
}

/** n-ésima ocorrência (0 = a primeira), sem considerar término. */
export function nthOccurrence(s: Schedule, n: number): ISODate {
  const start = parseISO(s.startOn);
  const step = n * Math.max(1, s.interval);
  switch (s.frequency) {
    case 'weekly':
      return toISODate(addDays(start, step * 7));
    case 'monthly':
      return monthDate(start.getFullYear(), start.getMonth() + step, start.getDate());
    case 'yearly':
      return monthDate(start.getFullYear() + step, start.getMonth(), start.getDate());
  }
}

/** Índice aproximado da primeira ocorrência em/depois de `from` (para não percorrer desde o início). */
function firstIndexFrom(s: Schedule, from: ISODate): number {
  if (from <= s.startOn) return 0;
  const days = differenceInCalendarDays(parseISO(from), parseISO(s.startOn));
  const every = Math.max(1, s.interval);
  const approx =
    s.frequency === 'weekly'
      ? days / (7 * every)
      : s.frequency === 'monthly'
        ? days / (31 * every)
        : days / (366 * every);
  return Math.max(0, Math.floor(approx) - 1);
}

export type Occurrence = { index: number; date: ISODate };

/** Ocorrências entre `from` e `to` (inclusive), respeitando início e término. */
export function occurrencesBetween(s: Schedule, from: ISODate, to: ISODate): Occurrence[] {
  const out: Occurrence[] = [];
  const last = s.endOn && s.endOn < to ? s.endOn : to;
  for (let i = firstIndexFrom(s, from); ; i++) {
    if (s.count && i >= s.count) break;
    const date = nthOccurrence(s, i);
    if (date > last) break;
    if (date >= from) out.push({ index: i, date });
    if (i > 5000) break; // trava de segurança
  }
  return out;
}

/** Próxima ocorrência a partir de `from` (inclusive), ou null se a recorrência acabou. */
export function nextOccurrence(s: Schedule, from: ISODate): ISODate | null {
  const horizon = toISODate(addDays(parseISO(from), 366 * Math.max(1, s.interval) + 31));
  return occurrencesBetween(s, from, horizon)[0]?.date ?? null;
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Descrição curta em português: "Todo mês no dia 10", "A cada 2 semanas, às sextas"… */
export function describeSchedule(s: Schedule): string {
  const d = parseISO(s.startOn);
  const n = Math.max(1, s.interval);
  let base: string;
  switch (s.frequency) {
    case 'weekly': {
      const wd = d.getDay();
      const weekend = wd === 0 || wd === 6; // "sábado"/"domingo" são masculinos
      base =
        n === 1
          ? `${weekend ? 'Todo' : 'Toda'} ${WEEKDAYS[wd]}`
          : `A cada ${n} semanas, ${weekend ? 'aos' : 'às'} ${WEEKDAYS[wd]}s`;
      break;
    }
    case 'monthly':
      base = n === 1 ? `Todo mês no dia ${d.getDate()}` : `A cada ${n} meses no dia ${d.getDate()}`;
      break;
    case 'yearly':
      base =
        n === 1
          ? `Todo ano em ${d.getDate()} de ${MONTHS[d.getMonth()]}`
          : `A cada ${n} anos em ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
      break;
  }
  if (s.count) return `${base}, ${s.count} vezes`;
  if (s.endOn) {
    const e = parseISO(s.endOn);
    return `${base}, até ${pad(e.getDate())}/${pad(e.getMonth() + 1)}/${e.getFullYear()}`;
  }
  return base;
}
