/**
 * Exportação para planilha (CSV) no formato que o Excel em português abre direto:
 * separador ";", vírgula decimal, datas dd/mm/aaaa, UTF-8 com BOM (acentos corretos).
 */
import type { AppDb } from '@/db/client';
import { listAllTransactions, type TransactionRow } from '@/features/transactions/repository';
import { formatDateShort, formatMonthLong } from '@/lib/dates';
import { formatAmount } from '@/lib/money';

const KIND_LABEL = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
  card_payment: 'Pagamento de fatura',
} as const;

export const CSV_HEADER = [
  'Data',
  'Descrição',
  'Tipo',
  'Valor',
  'Categoria',
  'Subcategoria',
  'Conta',
  'Conta de destino',
  'Cartão',
  'Fatura',
  'Parcela',
  'Situação',
  'Vencimento',
  'Observação',
];

export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Valor com sinal: saídas negativas, entradas positivas; transferência e pagamento de fatura sem sinal. */
function signedValue(r: TransactionRow) {
  const v = formatAmount(r.amountCents);
  return r.kind === 'expense' ? `-${v}` : v;
}

export function transactionsToCsv(rows: TransactionRow[]): string {
  const lines = [CSV_HEADER.join(';')];
  for (const r of rows) {
    const sub = r.parentCategoryName ? r.categoryName : '';
    const cat = r.parentCategoryName ?? r.categoryName ?? '';
    lines.push(
      [
        formatDateShort(r.occurredOn),
        r.description,
        KIND_LABEL[r.kind],
        signedValue(r),
        cat,
        sub,
        r.accountName ?? '',
        r.toAccountName ?? '',
        r.cardName ?? '',
        r.invoiceMonth ? formatMonthLong(r.invoiceMonth) : '',
        r.installmentNumber ? `${r.installmentNumber}/${r.installmentCount}` : '',
        r.status === 'pending' ? (r.kind === 'income' ? 'A receber' : 'A pagar') : 'Pago',
        r.dueOn ? formatDateShort(r.dueOn) : '',
        r.notes ?? '',
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function exportCsv(db: AppDb, range?: { from?: string; to?: string }) {
  return transactionsToCsv(listAllTransactions(db, range));
}

export function csvFileName(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `financas-lancamentos-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.csv`;
}
