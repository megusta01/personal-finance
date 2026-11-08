import { and, desc, eq, gte, inArray, isNull, like, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { randomUUID } from 'expo-crypto';
import type { AppDb } from '@/db/client';
import { accounts, categories, creditCards, transactions, type TransactionKind } from '@/db/schema';
import { ADJUSTMENT_CATEGORY } from '@/db/seed';
import { categoryFamilyIds } from '@/features/categories/repository';
import { monthRange, nowTimestamp, shiftMonth, type ISODate, type MonthKey } from '@/lib/dates';

export { totalBalance } from '@/features/accounts/repository';

export const TX_TABLES = ['transactions', 'categories', 'accounts', 'credit_cards'];

type Common = {
  amountCents: number;
  description: string;
  accountId: string;
  occurredOn: ISODate;
  notes?: string | null;
};

export type TransactionInput =
  | (Common & { kind: 'income' | 'expense'; categoryId: string })
  | (Common & { kind: 'transfer'; toAccountId: string });

const alive = isNull(transactions.deletedAt);
const toAccount = alias(accounts, 'to_account');
const parentCategory = alias(categories, 'parent_category');

/** Linha pronta para a lista: transação + categoria (e categoria pai) + contas. */
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
      parentCategoryName: parentCategory.name,
      accountId: transactions.accountId,
      accountName: accounts.name,
      toAccountId: transactions.toAccountId,
      toAccountName: toAccount.name,
      cardId: transactions.cardId,
      cardName: creditCards.name,
      invoiceMonth: transactions.invoiceMonth,
      installmentGroupId: transactions.installmentGroupId,
      installmentNumber: transactions.installmentNumber,
      installmentCount: transactions.installmentCount,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(toAccount, eq(toAccount.id, transactions.toAccountId))
    .leftJoin(creditCards, eq(creditCards.id, transactions.cardId));
}

export type TransactionRow = ReturnType<ReturnType<typeof listSelect>['all']>[number];

export type KindFilter = 'all' | TransactionKind;

export type MonthFilter = {
  month: MonthKey;
  kind?: KindFilter;
  search?: string;
  /** Movimentações que saem OU entram nessa conta. */
  accountId?: string | null;
  /** A categoria e todas as subcategorias dela. */
  categoryId?: string | null;
  /** Compras, estornos e pagamentos de fatura desse cartão. */
  cardId?: string | null;
};

function filterWhere(db: AppDb, f: Omit<MonthFilter, 'month'>): SQL[] {
  const term = f.search?.trim().replace(/[%_]/g, '');
  const out: (SQL | undefined)[] = [
    f.kind && f.kind !== 'all' ? eq(transactions.kind, f.kind) : undefined,
    term
      ? or(like(transactions.description, `%${term}%`), like(transactions.notes, `%${term}%`))
      : undefined,
    f.accountId
      ? or(eq(transactions.accountId, f.accountId), eq(transactions.toAccountId, f.accountId))
      : undefined,
    f.categoryId
      ? inArray(transactions.categoryId, categoryFamilyIds(db, f.categoryId))
      : undefined,
    f.cardId ? eq(transactions.cardId, f.cardId) : undefined,
  ];
  return out.filter((x): x is SQL => !!x);
}

export function listByMonth(db: AppDb, { month, ...filters }: MonthFilter): TransactionRow[] {
  const [from, to] = monthRange(month);
  return listSelect(db)
    .where(
      and(
        alive,
        gte(transactions.occurredOn, from),
        lte(transactions.occurredOn, to),
        ...filterWhere(db, filters),
      ),
    )
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .all();
}

/** Itens de uma fatura do cartão: compras, estornos e pagamentos. */
export function listInvoiceItems(
  db: AppDb,
  cardId: string,
  invoiceMonth: MonthKey,
): TransactionRow[] {
  return listSelect(db)
    .where(and(alive, eq(transactions.cardId, cardId), eq(transactions.invoiceMonth, invoiceMonth)))
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

/**
 * "Ajuste de saldo" corrige o saldo da conta, mas não é ganho nem gasto de verdade:
 * fica fora dos totais de entradas/saídas e do gráfico (continua no saldo e no extrato).
 */
const notAdjustment = sql`coalesce(${transactions.categoryId}, '') not in (${ADJUSTMENT_CATEGORY.income}, ${ADJUSTMENT_CATEGORY.expense})`;

const sumWhen = (cond: SQL) =>
  sql<number>`coalesce(sum(case when ${cond} then ${transactions.amountCents} else 0 end), 0)`;
const incomeSum = sumWhen(sql`${transactions.kind} = 'income'`);
const expenseSum = sumWhen(sql`${transactions.kind} = 'expense'`);

/**
 * Entradas e saídas do mês (pagas).
 * Sem conta: só receitas e despesas (transferência entre contas e ajuste de saldo não são ganho nem gasto).
 * Com conta: transferências recebidas contam como entrada e as enviadas como saída.
 */
export function monthTotals(
  db: AppDb,
  month: MonthKey,
  accountId?: string | null,
  cardId?: string | null,
): Totals {
  const [from, to] = monthRange(month);
  const range = [
    alive,
    eq(transactions.status, 'paid'),
    gte(transactions.occurredOn, from),
    lte(transactions.occurredOn, to),
  ];
  if (cardId && !accountId) {
    // Visão do cartão: compras são saídas; estornos e pagamentos de fatura, entradas.
    const row = db
      .select({
        incomeCents: sumWhen(sql`${transactions.kind} in ('income', 'card_payment')`),
        expenseCents: expenseSum,
      })
      .from(transactions)
      .where(and(...range, eq(transactions.cardId, cardId)))
      .get();
    return { incomeCents: row?.incomeCents ?? 0, expenseCents: row?.expenseCents ?? 0 };
  }
  if (!accountId) {
    const row = db
      .select({ incomeCents: incomeSum, expenseCents: expenseSum })
      .from(transactions)
      .where(and(...range, notAdjustment))
      .get();
    return { incomeCents: row?.incomeCents ?? 0, expenseCents: row?.expenseCents ?? 0 };
  }
  const row = db
    .select({
      incomeCents: sumWhen(
        sql`(${transactions.kind} = 'income' and ${transactions.accountId} = ${accountId}) or (${transactions.kind} = 'transfer' and ${transactions.toAccountId} = ${accountId})`,
      ),
      expenseCents: sumWhen(
        sql`(${transactions.kind} in ('expense', 'transfer', 'card_payment') and ${transactions.accountId} = ${accountId})`,
      ),
    })
    .from(transactions)
    .where(
      and(
        ...range,
        or(eq(transactions.accountId, accountId), eq(transactions.toAccountId, accountId)),
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
        notAdjustment,
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

export function countTransactions(db: AppDb): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(transactions)
    .where(alive)
    .get();
  return row?.n ?? 0;
}

/** Lançamentos de conta não têm nada de cartão (limpa ao converter uma compra de cartão em conta). */
const NO_CARD = {
  cardId: null,
  invoiceMonth: null,
  installmentGroupId: null,
  installmentNumber: null,
  installmentCount: null,
};

function clean(input: TransactionInput) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('O valor precisa ser maior que zero.');
  }
  const base = {
    kind: input.kind,
    amountCents: input.amountCents,
    description: input.description.trim(),
    accountId: input.accountId,
    occurredOn: input.occurredOn,
    notes: input.notes?.trim() || null,
  };
  if (input.kind === 'transfer') {
    if (!input.toAccountId || input.toAccountId === input.accountId) {
      throw new Error('Escolha contas diferentes para a origem e o destino.');
    }
    return { ...base, toAccountId: input.toAccountId, categoryId: null, ...NO_CARD };
  }
  return { ...base, toAccountId: null, categoryId: input.categoryId, ...NO_CARD };
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

/** Valor da linha do ponto de vista de uma conta (ou do total, sem conta). */
export function signedAmount(
  row: Pick<TransactionRow, 'kind' | 'amountCents' | 'accountId' | 'toAccountId'>,
  accountId?: string | null,
  cardId?: string | null,
): number {
  if (row.kind === 'income') return row.amountCents;
  if (row.kind === 'expense') return -row.amountCents;
  if (row.kind === 'card_payment') {
    // Na conta, o pagamento é saída; na visão do cartão, abate a fatura; no total, é neutro.
    if (accountId) return -row.amountCents;
    if (cardId) return row.amountCents;
    return 0;
  }
  if (!accountId) return 0; // transferência não muda o total
  return row.toAccountId === accountId ? row.amountCents : -row.amountCents;
}
