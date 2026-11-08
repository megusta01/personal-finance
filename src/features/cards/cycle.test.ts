import { describe, expect, it } from 'vitest';
import {
  dayInMonth,
  installmentDate,
  invoiceDates,
  invoiceMonthFor,
  invoiceStatus,
  splitInstallments,
} from './cycle';

// Fecha dia 3, vence dia 10 (mesmo mês)
const sameMonth = { closingDay: 3, dueDay: 10 };
// Fecha dia 25, vence dia 5 (mês seguinte)
const nextMonth = { closingDay: 25, dueDay: 5 };

describe('em qual fatura cai a compra', () => {
  it('fecha 3 / vence 10', () => {
    expect(invoiceMonthFor('2026-11-02', sameMonth)).toBe('2026-11'); // antes do fechamento
    expect(invoiceMonthFor('2026-11-03', sameMonth)).toBe('2026-12'); // no dia do fechamento → próxima
    expect(invoiceMonthFor('2026-11-20', sameMonth)).toBe('2026-12');
    expect(invoiceMonthFor('2026-12-31', sameMonth)).toBe('2027-01');
  });
  it('fecha 25 / vence 5 do mês seguinte', () => {
    expect(invoiceMonthFor('2026-11-24', nextMonth)).toBe('2026-12');
    expect(invoiceMonthFor('2026-11-25', nextMonth)).toBe('2027-01');
    expect(invoiceMonthFor('2026-12-26', nextMonth)).toBe('2027-02');
  });
  it('fechamento no dia 31 em fevereiro vira dia 28/29', () => {
    const c = { closingDay: 31, dueDay: 10 };
    expect(dayInMonth('2027-02', 31)).toBe('2027-02-28');
    expect(invoiceMonthFor('2027-02-27', c)).toBe('2027-03');
    expect(invoiceMonthFor('2027-02-28', c)).toBe('2027-04');
  });
});

describe('datas da fatura', () => {
  it('fecha 3 / vence 10', () => {
    expect(invoiceDates('2026-12', sameMonth)).toEqual({
      periodStart: '2026-11-03',
      closingDate: '2026-12-03',
      dueDate: '2026-12-10',
    });
  });
  it('fecha 25 / vence 5', () => {
    expect(invoiceDates('2027-01', nextMonth)).toEqual({
      periodStart: '2026-11-25',
      closingDate: '2026-12-25',
      dueDate: '2027-01-05',
    });
  });
  it('é coerente com invoiceMonthFor em todos os dias do ano', () => {
    for (const cycle of [
      sameMonth,
      nextMonth,
      { closingDay: 31, dueDay: 7 },
      { closingDay: 1, dueDay: 1 },
    ]) {
      for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const inv = invoiceDates(invoiceMonthFor(iso, cycle), cycle);
        expect(
          iso >= inv.periodStart && iso < inv.closingDate,
          `${iso} ${JSON.stringify(cycle)}`,
        ).toBe(true);
      }
    }
  });
});

describe('parcelas', () => {
  it('divide em centavos e joga a sobra na primeira', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitInstallments(10000, 1)).toEqual([10000]);
    expect(splitInstallments(99999, 10).reduce((a, b) => a + b)).toBe(99999);
  });
  it('recusa casos impossíveis', () => {
    expect(() => splitInstallments(2, 3)).toThrow();
    expect(() => splitInstallments(100, 0)).toThrow();
  });
  it('datas mensais, ajustando fim de mês', () => {
    expect(installmentDate('2026-01-31', 0)).toBe('2026-01-31');
    expect(installmentDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(installmentDate('2026-01-31', 2)).toBe('2026-03-31');
    expect(installmentDate('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('situação da fatura', () => {
  const dates = invoiceDates('2026-12', sameMonth); // 03/11 a 03/12, vence 10/12
  const t = (totalCents: number, paidCents = 0) => ({
    totalCents,
    paidCents,
    hasItems: totalCents !== 0,
  });
  it('cobre o ciclo inteiro', () => {
    expect(invoiceStatus(dates, '2026-11-01', t(100))).toBe('future');
    expect(invoiceStatus(dates, '2026-11-20', t(100))).toBe('open');
    expect(invoiceStatus(dates, '2026-12-05', t(100))).toBe('closed');
    expect(invoiceStatus(dates, '2026-12-05', t(100, 100))).toBe('paid');
    expect(invoiceStatus(dates, '2026-12-11', t(100, 40))).toBe('overdue');
    expect(invoiceStatus(dates, '2026-12-11', t(0))).toBe('empty');
  });
});
