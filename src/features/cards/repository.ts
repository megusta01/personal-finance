import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { AppDb } from '@/db/client';
import { creditCards, transactions, type CardBrand, type CreditCard } from '@/db/schema';
import { FALLBACK_CATEGORY } from '@/db/seed';
import { nowTimestamp, shiftMonth, todayISO, type ISODate, type MonthKey } from '@/lib/dates';
import {
  installmentDate,
  invoiceDates,
  invoiceMonthFor,
  invoiceStatus,
  openInvoiceMonth,
  splitInstallments,
  type InvoiceDates,
  type InvoiceStatus,
} from './cycle';

export const CARD_TABLES = ['credit_cards', 'transactions', 'categories', 'accounts'];

const alive = isNull(transactions.deletedAt);

// ---------------------------------------------------------------- cartões

export type CardInput = {
  name: string;
  brand: CardBrand;
  lastDigits?: string | null;
  color: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  paymentAccountId?: string | null;
};

function cleanCard(input: CardInput) {
  const name = input.name.trim();
  if (!name) throw new Error('Dê um nome para o cartão.');
  const lastDigits = input.lastDigits?.trim() || null;
  if (lastDigits && !/^\d{4}$/.test(lastDigits))
    throw new Error('Informe exatamente os 4 últimos dígitos.');
  for (const d of [input.closingDay, input.dueDay]) {
    if (!Number.isInteger(d) || d < 1 || d > 31)
      throw new Error('Os dias precisam estar entre 1 e 31.');
  }
  if (!Number.isInteger(input.limitCents) || input.limitCents < 0)
    throw new Error('Limite inválido.');
  return { ...input, name, lastDigits, paymentAccountId: input.paymentAccountId || null };
}

export function listCards(db: AppDb, { archived = false } = {}): CreditCard[] {
  return db
    .select()
    .from(creditCards)
    .where(
      and(
        isNull(creditCards.deletedAt),
        archived ? isNotNull(creditCards.archivedAt) : isNull(creditCards.archivedAt),
      ),
    )
    .orderBy(asc(creditCards.sortOrder), asc(creditCards.createdAt))
    .all();
}

export function getCard(db: AppDb, id: string): CreditCard | undefined {
  return db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.id, id), isNull(creditCards.deletedAt)))
    .get();
}

export function createCard(db: AppDb, input: CardInput): string {
  const id = randomUUID();
  const now = nowTimestamp();
  const last = db
    .select({ max: sql<number>`coalesce(max(${creditCards.sortOrder}), 0)` })
    .from(creditCards)
    .get();
  db.insert(creditCards)
    .values({
      id,
      ...cleanCard(input),
      sortOrder: (last?.max ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

/** Mudar fechamento/vencimento vale para compras novas; as já lançadas ficam na fatura em que caíram. */
export function updateCard(db: AppDb, id: string, input: CardInput) {
  db.update(creditCards)
    .set({ ...cleanCard(input), updatedAt: nowTimestamp() })
    .where(eq(creditCards.id, id))
    .run();
}

export function cardTransactionCount(db: AppDb, id: string): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(transactions)
    .where(and(alive, eq(transactions.cardId, id)))
    .get();
  return row?.n ?? 0;
}

export function archiveCard(db: AppDb, id: string) {
  const now = nowTimestamp();
  db.update(creditCards)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(creditCards.id, id))
    .run();
}

export function unarchiveCard(db: AppDb, id: string) {
  db.update(creditCards)
    .set({ archivedAt: null, updatedAt: nowTimestamp() })
    .where(eq(creditCards.id, id))
    .run();
}

export function deleteCard(db: AppDb, id: string) {
  if (cardTransactionCount(db, id) > 0)
    throw new Error('Este cartão tem lançamentos. Arquive em vez de excluir.');
  const now = nowTimestamp();
  db.update(creditCards)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(creditCards.id, id))
    .run();
}

// ---------------------------------------------------------------- limite e faturas

const charges = sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' then ${transactions.amountCents} else 0 end), 0)`;
const refunds = sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactions.amountCents} else 0 end), 0)`;
const payments = sql<number>`coalesce(sum(case when ${transactions.kind} = 'card_payment' then ${transactions.amountCents} else 0 end), 0)`;

/**
 * Limite usado = tudo que foi comprado (inclusive parcelas futuras) − estornos − pagamentos.
 * É assim que os bancos calculam: uma compra em 10x ocupa o valor cheio do limite.
 */
export function cardUsage(
  db: AppDb,
  card: CreditCard,
): { usedCents: number; availableCents: number } {
  const row = db
    .select({ charges, refunds, payments })
    .from(transactions)
    .where(and(alive, eq(transactions.cardId, card.id)))
    .get();
  const usedCents = (row?.charges ?? 0) - (row?.refunds ?? 0) - (row?.payments ?? 0);
  return { usedCents, availableCents: card.limitCents - usedCents };
}

export type InvoiceSummary = {
  month: MonthKey;
  dates: InvoiceDates;
  status: InvoiceStatus;
  /** Compras − estornos. */
  totalCents: number;
  paidCents: number;
  /** Quanto falta pagar (negativo = crédito para a próxima). */
  remainingCents: number;
  itemCount: number;
};

export function invoiceSummary(
  db: AppDb,
  card: CreditCard,
  month: MonthKey,
  today: ISODate = todayISO(),
): InvoiceSummary {
  const row = db
    .select({
      charges,
      refunds,
      payments,
      items: sql<number>`sum(case when ${transactions.kind} <> 'card_payment' then 1 else 0 end)`,
    })
    .from(transactions)
    .where(and(alive, eq(transactions.cardId, card.id), eq(transactions.invoiceMonth, month)))
    .get();
  const totalCents = (row?.charges ?? 0) - (row?.refunds ?? 0);
  const paidCents = row?.payments ?? 0;
  const itemCount = row?.items ?? 0;
  const dates = invoiceDates(month, card);
  return {
    month,
    dates,
    status: invoiceStatus(dates, today, { totalCents, paidCents, hasItems: itemCount > 0 }),
    totalCents,
    paidCents,
    remainingCents: totalCents - paidCents,
    itemCount,
  };
}

/** Faturas com algum lançamento, mais a aberta hoje, em ordem. */
export function invoiceMonths(
  db: AppDb,
  card: CreditCard,
  today: ISODate = todayISO(),
): MonthKey[] {
  const rows = db
    .selectDistinct({ m: transactions.invoiceMonth })
    .from(transactions)
    .where(and(alive, eq(transactions.cardId, card.id)))
    .all();
  const set = new Set(rows.map((r) => r.m).filter((m): m is string => !!m));
  set.add(openInvoiceMonth(today, card));
  return [...set].sort();
}

/**
 * Fatura "da vez" para destacar: a mais antiga ainda não paga que já fechou (ou venceu);
 * se não houver, a aberta.
 */
export function currentInvoice(
  db: AppDb,
  card: CreditCard,
  today: ISODate = todayISO(),
): InvoiceSummary {
  const open = openInvoiceMonth(today, card);
  for (const m of invoiceMonths(db, card, today)) {
    if (m >= open) break;
    const s = invoiceSummary(db, card, m, today);
    if (s.status === 'closed' || s.status === 'overdue') return s;
  }
  return invoiceSummary(db, card, open, today);
}

export type CardOverview = CreditCard & {
  usedCents: number;
  availableCents: number;
  current: InvoiceSummary;
};

export function listCardsOverview(db: AppDb, today: ISODate = todayISO()): CardOverview[] {
  return listCards(db).map((c) => ({
    ...c,
    ...cardUsage(db, c),
    current: currentInvoice(db, c, today),
  }));
}

// ---------------------------------------------------------------- compras

export type CardPurchaseInput = {
  cardId: string;
  /** expense = compra; income = estorno/crédito na fatura. */
  kind: 'expense' | 'income';
  totalCents: number;
  installments: number;
  description: string;
  categoryId?: string | null;
  purchasedOn: ISODate;
  notes?: string | null;
};

/** Linhas existentes de uma compra (todas as parcelas, inclusive excluídas). */
function purchaseRows(db: AppDb, txId: string) {
  const first = db.select().from(transactions).where(eq(transactions.id, txId)).get();
  if (!first) return [];
  if (!first.installmentGroupId) return [first];
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.installmentGroupId, first.installmentGroupId))
    .orderBy(asc(transactions.installmentNumber))
    .all();
}

export type CardPurchase = {
  firstId: string;
  cardId: string;
  kind: 'expense' | 'income';
  totalCents: number;
  installments: number;
  description: string;
  categoryId: string | null;
  purchasedOn: ISODate;
  notes: string | null;
  /** Assinatura no cartão gerada por recorrência. */
  recurrenceId: string | null;
};

/** Junta as parcelas de volta numa compra só (para editar). */
export function getCardPurchase(db: AppDb, txId: string): CardPurchase | undefined {
  const rows = purchaseRows(db, txId).filter((r) => !r.deletedAt);
  const first = rows[0];
  if (!first || !first.cardId || first.kind === 'card_payment' || first.kind === 'transfer')
    return undefined;
  return {
    firstId: first.id,
    cardId: first.cardId,
    kind: first.kind,
    totalCents: rows.reduce((s, r) => s + r.amountCents, 0),
    installments: rows.length,
    description: first.description,
    categoryId: first.categoryId,
    purchasedOn: first.occurredOn,
    notes: first.notes,
    recurrenceId: first.recurrenceId,
  };
}

/**
 * Cria (ou regrava) uma compra no cartão. Compras parceladas viram uma linha por parcela,
 * cada uma na fatura certa, com IDs previsíveis (`grupo-1`, `grupo-2`…) — assim editar
 * reaproveita as mesmas linhas, o que facilita o sync depois.
 */
export function saveCardPurchase(
  db: AppDb,
  input: CardPurchaseInput,
  existingTxId?: string,
): string {
  const card = getCard(db, input.cardId);
  if (!card) throw new Error('Cartão não encontrado.');
  if (input.kind === 'income' && input.installments !== 1)
    throw new Error('Estorno não pode ser parcelado.');
  const amounts = splitInstallments(input.totalCents, input.installments);
  const description = input.description.trim();
  const categoryId = input.categoryId || FALLBACK_CATEGORY[input.kind];
  const notes = input.notes?.trim() || null;
  const now = nowTimestamp();
  const existing = existingTxId ? purchaseRows(db, existingTxId) : [];

  const base = (i: number) => {
    const occurredOn = installmentDate(input.purchasedOn, i);
    return {
      kind: input.kind,
      amountCents: amounts[i]!,
      description,
      accountId: null,
      toAccountId: null,
      categoryId,
      occurredOn,
      status: 'paid' as const,
      notes,
      cardId: card.id,
      updatedAt: now,
      deletedAt: null,
    };
  };
  // A 1ª parcela cai na fatura da data da compra; as seguintes, uma por mês.
  const firstInvoice = invoiceMonthFor(input.purchasedOn, card);
  const invoiceOf = (i: number) => shiftMonth(firstInvoice, i);

  // À vista: uma linha, sem grupo.
  if (amounts.length === 1) {
    const keep = existing.find((r) => !r.installmentGroupId) ?? existing[0];
    const id = keep?.id ?? randomUUID();
    const values = {
      ...base(0),
      invoiceMonth: firstInvoice,
      installmentGroupId: null,
      installmentNumber: null,
      installmentCount: null,
    };
    if (keep) db.update(transactions).set(values).where(eq(transactions.id, id)).run();
    else
      db.insert(transactions)
        .values({ id, ...values, origin: 'app', createdAt: now })
        .run();
    const others = existing.filter((r) => r.id !== id).map((r) => r.id);
    if (others.length)
      db.update(transactions)
        .set({ deletedAt: now, updatedAt: now })
        .where(inArray(transactions.id, others))
        .run();
    return id;
  }

  // Parcelado.
  const groupId = existing.find((r) => r.installmentGroupId)?.installmentGroupId ?? randomUUID();
  const ids = amounts.map((_, i) => `${groupId}-${i + 1}`);
  const existingIds = new Set(existing.map((r) => r.id));
  amounts.forEach((_, i) => {
    const values = {
      ...base(i),
      invoiceMonth: invoiceOf(i),
      installmentGroupId: groupId,
      installmentNumber: i + 1,
      installmentCount: amounts.length,
    };
    const id = ids[i]!;
    const known =
      existingIds.has(id) ||
      !!db.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, id)).get();
    if (known) db.update(transactions).set(values).where(eq(transactions.id, id)).run();
    else
      db.insert(transactions)
        .values({ id, ...values, origin: 'app', createdAt: now })
        .run();
  });
  const stale = existing.map((r) => r.id).filter((id) => !ids.includes(id));
  if (stale.length)
    db.update(transactions)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(transactions.id, stale))
      .run();
  // Parcelas extras de uma edição anterior com mais parcelas (ex.: era 10x, virou 6x).
  db.update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(transactions.installmentGroupId, groupId),
        sql`${transactions.installmentNumber} > ${amounts.length}`,
        alive,
      ),
    )
    .run();
  return ids[0]!;
}

/** Exclui a compra inteira (todas as parcelas). Retorna os IDs para o "Desfazer". */
export function deleteCardPurchase(db: AppDb, txId: string): string[] {
  const ids = purchaseRows(db, txId)
    .filter((r) => !r.deletedAt)
    .map((r) => r.id);
  const now = nowTimestamp();
  if (ids.length)
    db.update(transactions)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(transactions.id, ids))
      .run();
  return ids;
}

export function restoreRows(db: AppDb, ids: string[]) {
  if (!ids.length) return;
  db.update(transactions)
    .set({ deletedAt: null, updatedAt: nowTimestamp() })
    .where(inArray(transactions.id, ids))
    .run();
}

// ---------------------------------------------------------------- pagamento de fatura

export type InvoicePaymentInput = {
  cardId: string;
  invoiceMonth: MonthKey;
  accountId: string;
  amountCents: number;
  paidOn: ISODate;
  notes?: string | null;
};

/** Pagamento sai da conta e abate a fatura. Não conta como despesa (as compras já contaram). */
export function saveInvoicePayment(
  db: AppDb,
  input: InvoicePaymentInput,
  existingId?: string,
): string {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    throw new Error('O valor precisa ser maior que zero.');
  if (!getCard(db, input.cardId)) throw new Error('Cartão não encontrado.');
  const now = nowTimestamp();
  const values = {
    kind: 'card_payment' as const,
    amountCents: input.amountCents,
    description: 'Pagamento de fatura',
    accountId: input.accountId,
    toAccountId: null,
    categoryId: null,
    occurredOn: input.paidOn,
    status: 'paid' as const,
    notes: input.notes?.trim() || null,
    cardId: input.cardId,
    invoiceMonth: input.invoiceMonth,
    updatedAt: now,
  };
  if (existingId) {
    db.update(transactions).set(values).where(eq(transactions.id, existingId)).run();
    return existingId;
  }
  const id = randomUUID();
  db.insert(transactions)
    .values({ id, ...values, origin: 'app', createdAt: now })
    .run();
  return id;
}
