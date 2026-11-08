/**
 * Regras de ciclo do cartão de crédito (funções puras, sem banco).
 *
 * Convenções (iguais às dos bancos brasileiros):
 *  - A fatura é identificada pelo mês de VENCIMENTO: "fatura de dezembro" vence em dezembro.
 *  - Compras feitas a partir do dia de fechamento entram na fatura seguinte
 *    (por isso o "melhor dia de compra" é o próprio dia do fechamento).
 *  - Dias que não existem no mês (ex.: 31 em fevereiro) viram o último dia do mês.
 *  - Se o vencimento é depois do fechamento no calendário (fecha 3, vence 10), os dois
 *    caem no mesmo mês; senão (fecha 25, vence 5), o vencimento é no mês seguinte.
 */
import { getDaysInMonth } from 'date-fns';
import { shiftMonth, type ISODate, type MonthKey } from '@/lib/dates';

export type CardCycle = { closingDay: number; dueDay: number };

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** "2026-02" + 31 → "2026-02-28" */
export function dayInMonth(month: MonthKey, day: number): ISODate {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = getDaysInMonth(new Date(y, m - 1, 1));
  return `${month}-${pad(Math.min(Math.max(1, day), last))}`;
}

/** Meses entre o fechamento e o vencimento da mesma fatura (0 ou 1). */
function dueOffset({ closingDay, dueDay }: CardCycle) {
  return dueDay > closingDay ? 0 : 1;
}

/** Em qual fatura (mês de vencimento) cai uma compra feita em `date`. */
export function invoiceMonthFor(date: ISODate, cycle: CardCycle): MonthKey {
  const month = date.slice(0, 7);
  const closing = dayInMonth(month, cycle.closingDay);
  const closingMonth = date >= closing ? shiftMonth(month, 1) : month;
  return shiftMonth(closingMonth, dueOffset(cycle));
}

export type InvoiceDates = {
  /** Primeiro dia que entra nesta fatura (= fechamento anterior). */
  periodStart: ISODate;
  /** Dia do fechamento: compras a partir dele já vão para a próxima. */
  closingDate: ISODate;
  dueDate: ISODate;
};

export function invoiceDates(invoiceMonth: MonthKey, cycle: CardCycle): InvoiceDates {
  const closingMonth = shiftMonth(invoiceMonth, -dueOffset(cycle));
  return {
    periodStart: dayInMonth(shiftMonth(closingMonth, -1), cycle.closingDay),
    closingDate: dayInMonth(closingMonth, cycle.closingDay),
    dueDate: dayInMonth(invoiceMonth, cycle.dueDay),
  };
}

/** Fatura aberta hoje (a que recebe uma compra feita hoje). */
export function openInvoiceMonth(today: ISODate, cycle: CardCycle): MonthKey {
  return invoiceMonthFor(today, cycle);
}

/**
 * Divide um valor em parcelas de centavos inteiros.
 * A diferença de arredondamento vai para a primeira parcela, como fazem os bancos.
 * 100,00 em 3x → 33,34 + 33,33 + 33,33
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new Error('Valor inválido.');
  if (!Number.isInteger(count) || count < 1 || count > 48)
    throw new Error('Número de parcelas inválido.');
  if (totalCents < count) throw new Error('Cada parcela precisa ter pelo menos 1 centavo.');
  const base = Math.floor(totalCents / count);
  const rest = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + rest : base));
}

/** Data de cada parcela: mesma data da compra, um mês depois a cada parcela. */
export function installmentDate(purchaseDate: ISODate, index: number): ISODate {
  const month = shiftMonth(purchaseDate.slice(0, 7), index);
  return dayInMonth(month, Number(purchaseDate.slice(8, 10)));
}

export type InvoiceStatus = 'future' | 'open' | 'closed' | 'paid' | 'overdue' | 'empty';

/**
 * Situação da fatura:
 *  - future: ainda nem abriu (só tem parcelas futuras);
 *  - open: aberta, recebendo compras;
 *  - closed: fechada, aguardando pagamento até o vencimento;
 *  - paid: total pago (ou crédito);
 *  - overdue: venceu com saldo em aberto;
 *  - empty: sem lançamentos.
 */
export function invoiceStatus(
  dates: InvoiceDates,
  today: ISODate,
  totals: { totalCents: number; paidCents: number; hasItems: boolean },
): InvoiceStatus {
  if (!totals.hasItems && totals.paidCents === 0) return 'empty';
  const remaining = totals.totalCents - totals.paidCents;
  if (today < dates.periodStart) return 'future';
  if (today < dates.closingDate) return 'open';
  if (remaining <= 0) return 'paid';
  if (today > dates.dueDate) return 'overdue';
  return 'closed';
}

/** "Melhor dia de compra" = dia do fechamento. */
export function bestPurchaseDay(cycle: CardCycle) {
  return cycle.closingDay;
}
