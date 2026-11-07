import { and, desc, eq, gte, inArray, isNull, like, lte, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { AppDb } from '@/db/client';
import { accounts, categories, transactions, type TransactionKind } from '@/db/schema';
import { monthRange, nowTimestamp, shiftMonth, type ISODate, type MonthKey } from '@/lib/dates';

export const TX_TABLES = ['transactions', 'categories', 'accounts'];

export type TransactionInput = {
  kind: Exclude<TransactionKind, 'transfer'>;
  amountCents: number;
  description: string;
  categoryId: string;
  accountId: string;
  occurredOn: ISODate;
  notes?: string | null;
};

const alive = isNull(transactions.deletedAt);

/** Linha pronta para a lista: transação + categoria + conta. */
function listSelect(db: AppDb) {
  return db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amountCents: transactions.amountCents,
      description: transactions.description,
      occurredOn: transactions.occurredOn,
      status: transactions.status,
      notes: transactions.notes,
      createdAt: transactions.createdAt,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      accountId: transactions.accountId,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId));
}

export type TransactionRow = ReturnType<ReturnType<typeof listSelect>['all']>[number];

export type MonthFilter = {
  month: MonthKey;
  kind?: 'income' | 'expense' | 'all';
  search?: string;
};

export function listByMonth(
  db: AppDb,
  { month, kind = 'all', search }: MonthFilter,
): TransactionRow[] {
  const [from, to] = monthRange(month);
  const term = search?.trim();
  return listSelect(db)
    .where(
      and(
        alive,
        gte(transactions.occurredOn, from),
        lte(transactions.occurredOn, to),
        kind === 'all' ? undefined : eq(transactions.kind, kind),
        term ? like(transactions.description, `%${term.replace(/[%_]/g, '')}%`) : undefined,
      ),
    )
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .all();
}

export function listRecent(db: AppDb, limit = 5): TransactionRow[] {
  return listSelect(db)
    .where(alive)
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit)
    .all();
}

export function getTransaction(db: AppDb, id: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), alive))
    .get();
}

export type Totals = { incomeCents: number; expenseCents: number };

const incomeSum = sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactions.amountCents} else 0 end), 0)`;
const expenseSum = sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' then ${transactions.amountCents} else 0 end), 0)`;

export function monthTotals(db: AppDb, month: MonthKey): Totals {
  const [from, to] = monthRange(month);
  const row = db
    .select({ incomeCents: incomeSum, expenseCents: expenseSum })
    .from(transactions)
    .where(
      and(
        alive,
        eq(transactions.status, 'paid'),
        gte(transactions.occurredOn, from),
        lte(transactions.occurredOn, to),
      ),
    )
    .get();
  return { incomeCents: row?.incomeCents ?? 0, expenseCents: row?.expenseCents ?? 0 };
}

/** Entradas e saídas dos últimos `count` meses, do mais antigo ao atual (meses vazios aparecem zerados). */
export function monthlySeries(
  db: AppDb,
  current: MonthKey,
  count = 6,
): (Totals & { month: MonthKey })[] {
  const first = shiftMonth(current, -(count - 1));
  const [from] = monthRange(first);
  const [, to] = monthRange(current);
  const month = sql<string>`substr(${transactions.occurredOn}, 1, 7)`;
  const rows = db
    .select({ month, incomeCents: incomeSum, expenseCents: expenseSum })
    .from(transactions)
    .where(
      and(
        alive,
        eq(transactions.status, 'paid'),
        gte(transactions.occurredOn, from),
        lte(transactions.occurredOn, to),
      ),
    )
    .groupBy(month)
    .all();
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: count }, (_, i) => {
    const key = shiftMonth(first, i);
    const r = byMonth.get(key);
    return { month: key, incomeCents: r?.incomeCents ?? 0, expenseCents: r?.expenseCents ?? 0 };
  });
}

/**
 * Saldo atual: saldo inicial das contas que entram no total + receitas − despesas já pagas.
 * Transferências entre contas não mudam o total (entram na Fase 2, com saldo por conta).
 */
export function totalBalance(db: AppDb): number {
  const included = db
    .select({ id: accounts.id, initial: accounts.initialBalanceCents })
    .from(accounts)
    .where(and(isNull(accounts.deletedAt), eq(accounts.includeInTotal, true)))
    .all();
  if (included.length === 0) return 0;
  const ids = included.map((a) => a.id);
  const initial = included.reduce((s, a) => s + a.initial, 0);
  const row = db
    .select({ incomeCents: incomeSum, expenseCents: expenseSum })
    .from(transactions)
    .where(and(alive, eq(transactions.status, 'paid'), inArray(transactions.accountId, ids)))
    .get();
  return initial + (row?.incomeCents ?? 0) - (row?.expenseCents ?? 0);
}

export function countTransactions(db: AppDb): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(transactions)
    .where(alive)
    .get();
  return row?.n ?? 0;
}

function clean(input: TransactionInput) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('O valor precisa ser maior que zero.');
  }
  return {
    kind: input.kind,
    amountCents: input.amountCents,
    description: input.description.trim(),
    categoryId: input.categoryId,
    accountId: input.accountId,
    occurredOn: input.occurredOn,
    notes: input.notes?.trim() || null,
  };
}

export function createTransaction(db: AppDb, input: TransactionInput): string {
  const id = randomUUID();
  const now = nowTimestamp();
  db.insert(transactions)
    .values({ id, ...clean(input), status: 'paid', origin: 'app', createdAt: now, updatedAt: now })
    .run();
  return id;
}

export function updateTransaction(db: AppDb, id: string, input: TransactionInput) {
  db.update(transactions)
    .set({ ...clean(input), updatedAt: nowTimestamp() })
    .where(eq(transactions.id, id))
    .run();
}

/** Exclusão suave: o registro some do app mas fica marcado para o sync avisar os outros aparelhos. */
export function deleteTransaction(db: AppDb, id: string) {
  const now = nowTimestamp();
  db.update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(transactions.id, id))
    .run();
}

/** Desfaz a exclusão (usado no "Desfazer" logo depois de excluir). */
export function restoreTransaction(db: AppDb, id: string) {
  db.update(transactions)
    .set({ deletedAt: null, updatedAt: nowTimestamp() })
    .where(eq(transactions.id, id))
    .run();
}
