import type { Frequency } from './schedule';

export type RepeatKey = 'none' | 'w1' | 'w2' | 'm1' | 'm2' | 'm3' | 'm6' | 'y1';

/** Opções de "Repetir" mostradas como chips. */
export const REPEAT_OPTIONS: {
  key: RepeatKey;
  label: string;
  frequency?: Frequency;
  interval?: number;
}[] = [
  { key: 'none', label: 'Não repete' },
  { key: 'm1', label: 'Todo mês', frequency: 'monthly', interval: 1 },
  { key: 'w1', label: 'Toda semana', frequency: 'weekly', interval: 1 },
  { key: 'w2', label: 'A cada 2 semanas', frequency: 'weekly', interval: 2 },
  { key: 'm2', label: 'A cada 2 meses', frequency: 'monthly', interval: 2 },
  { key: 'm3', label: 'A cada 3 meses', frequency: 'monthly', interval: 3 },
  { key: 'm6', label: 'A cada 6 meses', frequency: 'monthly', interval: 6 },
  { key: 'y1', label: 'Todo ano', frequency: 'yearly', interval: 1 },
];

export function repeatKeyOf(frequency: Frequency, interval: number): RepeatKey | null {
  return (
    REPEAT_OPTIONS.find((o) => o.frequency === frequency && o.interval === interval)?.key ?? null
  );
}
