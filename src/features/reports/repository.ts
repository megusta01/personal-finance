import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { AppDb } from '@/db/client';
import { categories, transactions } from '@/db/schema';
import { ADJUSTMENT_CATEGORY } from '@/db/seed';
import { listByMonth, type TransactionRow } from '@/features/transactions/repository';
import { monthRange, shiftMonth, type MonthKey } from '@/lib/dates';

export const REPORT_TABLES = [
  'transactions',
  'categories',
  'budgets',
  'goals',
  'goal_entries',
  'accounts',
  'credit_cards',
];

const parent = alias(categories, 'parent');

export type CategoryTotal = {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  cents: number;
  /** Mesmo período do mês anterior (para comparar). */
  previousCents: number;
};

/** Filtros comuns: pagos, não excluídos, sem ajuste de saldo, sem transferências/pagamentos de fatura. */
function realMoney(kind: 'income' | 'expense', month: MonthKey) {
  const [from, to] = monthRange(month);
  return and(
    isNull(transactions.deletedAt),
    eq(transactions.status, 'paid'),
    eq(transactions.kind, kind),
    gte(transactions.occurredOn, from),
    lte(transactions.occurredOn, to),
    sql`coalesce(${transactions.categoryId}, '') not in (${ADJUSTMENT_CATEGORY.income}, ${ADJUSTMENT_CATEGORY.expense})`,
  );
}

function groupTotals(db: AppDb, kind: 'income' | 'expense', month: MonthKey, parentId?: string) {
  // Sem parentId: agrupa na categoria principal (subcategorias somam no pai).
  // Com parentId: detalha as subcategorias daquele pai (o próprio pai vira "Sem subcategoria").
  const key = parentId
    ? sql<string>`${categories.id}`
    : sql<string>`coalesce(${categories.parentId}, ${categories.id})`;
  const where = parentId
    ? and(
        realMoney(kind, month),
        sql`(${categories.id} = ${parentId} or ${categories.parentId} = ${parentId})`,
      )
    : realMoney(kind, month);
  return db
    .select({
      categoryId: key,
      name: sql<string>`case when ${categories.parentId} is null or ${parentId ?? null} is not null then ${categories.name} else ${parent.name} end`,
      icon: sql<string>`coalesce(${parent.icon}, ${categories.icon})`,
      color: sql<string>`coalesce(${parent.color}, ${categories.color})`,
      cents: sql<number>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(parent, eq(parent.id, categories.parentId))
    .where(where)
    .groupBy(key)
    .all();
}

/**
 * Totais por categoria no mês, do maior para o menor, com o mês anterior ao lado.
 * Inclui compras no cartão (na data de cada parcela).
 */
export function totalsByCategory(
  db: AppDb,
  kind: 'income' | 'expense',
  month: MonthKey,
  parentId?: string,
): CategoryTotal[] {
  const now = groupTotals(db, kind, month, parentId);
  const before = new Map(
    groupTotals(db, kind, shiftMonth(month, -1), parentId).map((r) => [r.categoryId, r.cents]),
  );
  const rows = now.map((r) => ({
    ...r,
    name: parentId && r.categoryId === parentId ? `${r.name} (sem subcategoria)` : r.name,
    previousCents: before.get(r.categoryId) ?? 0,
  }));
  // Categorias que tinham gasto no mês anterior e zeraram neste também aparecem (comparação honesta).
  for (const [id, cents] of before) {
    if (rows.some((r) => r.categoryId === id)) continue;
    const c = db.select().from(categories).where(eq(categories.id, id)).get();
    if (c)
      rows.push({
        categoryId: id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        cents: 0,
        previousCents: cents,
      });
  }
  return rows.sort((a, b) => b.cents - a.cents || b.previousCents - a.previousCents);
}

/** Maiores despesas do mês (compras no cartão contam pela parcela). */
export function topExpenses(db: AppDb, month: MonthKey, limit = 5): TransactionRow[] {
  return listByMonth(db, { month, kind: 'expense' })
    .filter((r) => r.status === 'paid' && r.categoryId !== ADJUSTMENT_CATEGORY.expense)
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, limit);
}

/** Gasto acumulado dia a dia no mês (para comparar o ritmo com o mês anterior). */
export function cumulativeSpending(db: AppDb, month: MonthKey): number[] {
  const rows = db
    .select({
      day: sql<number>`cast(substr(${transactions.occurredOn}, 9, 2) as integer)`,
      cents: sql<number>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .where(realMoney('expense', month))
    .groupBy(sql`substr(${transactions.occurredOn}, 9, 2)`)
    .all();
  const [, last] = monthRange(month);
  const days = Number(last.slice(8, 10));
  const byDay = new Map(rows.map((r) => [r.day, r.cents]));
  const out: number[] = [];
  let acc = 0;
  for (let d = 1; d <= days; d++) {
    acc += byDay.get(d) ?? 0;
    out.push(acc);
  }
  return out;
}
