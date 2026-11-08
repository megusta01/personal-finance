import { describe, expect, it } from 'vitest';
import {
  describeSchedule,
  nextOccurrence,
  nthOccurrence,
  occurrencesBetween,
  type Schedule,
} from './schedule';

const dates = (s: Schedule, from: string, to: string) =>
  occurrencesBetween(s, from, to).map((o) => o.date);

describe('mensal', () => {
  it('dia 31 vira o último dia em meses curtos, sem perder o dia original', () => {
    const s: Schedule = { frequency: 'monthly', interval: 1, startOn: '2026-01-31' };
    expect(dates(s, '2026-01-01', '2026-06-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
    ]);
  });
  it('a cada 3 meses', () => {
    const s: Schedule = { frequency: 'monthly', interval: 3, startOn: '2026-11-10' };
    expect(dates(s, '2026-11-01', '2027-12-31')).toEqual([
      '2026-11-10',
      '2027-02-10',
      '2027-05-10',
      '2027-08-10',
      '2027-11-10',
    ]);
  });
  it('começa a contar do meio sem pular nada', () => {
    const s: Schedule = { frequency: 'monthly', interval: 1, startOn: '2020-03-05' };
    expect(dates(s, '2026-11-01', '2027-01-31')).toEqual([
      '2026-11-05',
      '2026-12-05',
      '2027-01-05',
    ]);
    expect(occurrencesBetween(s, '2026-11-01', '2026-11-30')[0]?.index).toBe(80);
  });
});

describe('semanal e anual', () => {
  it('semanal a cada 2 semanas', () => {
    const s: Schedule = { frequency: 'weekly', interval: 2, startOn: '2026-11-06' };
    expect(dates(s, '2026-11-01', '2026-12-15')).toEqual([
      '2026-11-06',
      '2026-11-20',
      '2026-12-04',
    ]);
  });
  it('anual em 29/02', () => {
    const s: Schedule = { frequency: 'yearly', interval: 1, startOn: '2024-02-29' };
    expect(dates(s, '2024-01-01', '2028-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });
});

describe('término', () => {
  it('por número de vezes', () => {
    const s: Schedule = { frequency: 'monthly', interval: 1, startOn: '2026-11-15', count: 3 };
    expect(dates(s, '2026-01-01', '2027-12-31')).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
    ]);
    expect(nextOccurrence(s, '2027-01-16')).toBeNull();
  });
  it('por data (inclusive)', () => {
    const s: Schedule = {
      frequency: 'monthly',
      interval: 1,
      startOn: '2026-11-15',
      endOn: '2027-01-15',
    };
    expect(dates(s, '2026-01-01', '2027-12-31')).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
    ]);
  });
  it('próxima ocorrência', () => {
    const s: Schedule = { frequency: 'monthly', interval: 1, startOn: '2026-01-10' };
    expect(nextOccurrence(s, '2026-11-08')).toBe('2026-11-10');
    expect(nextOccurrence(s, '2026-11-10')).toBe('2026-11-10');
    expect(nthOccurrence(s, 0)).toBe('2026-01-10');
  });
});

describe('descrição', () => {
  it('em português', () => {
    expect(describeSchedule({ frequency: 'monthly', interval: 1, startOn: '2026-11-10' })).toBe(
      'Todo mês no dia 10',
    );
    expect(
      describeSchedule({ frequency: 'monthly', interval: 1, startOn: '2026-11-10', count: 12 }),
    ).toBe('Todo mês no dia 10, 12 vezes');
    expect(describeSchedule({ frequency: 'yearly', interval: 1, startOn: '2026-03-20' })).toBe(
      'Todo ano em 20 de março',
    );
    expect(describeSchedule({ frequency: 'weekly', interval: 1, startOn: '2026-11-06' })).toBe(
      'Toda sexta',
    );
    expect(describeSchedule({ frequency: 'weekly', interval: 1, startOn: '2026-11-08' })).toBe(
      'Todo domingo',
    );
    expect(describeSchedule({ frequency: 'weekly', interval: 2, startOn: '2026-11-06' })).toBe(
      'A cada 2 semanas, às sextas',
    );
  });
});
