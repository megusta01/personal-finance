import { getDaysInMonth, parseISO } from 'date-fns';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@/db/client';
import { budgets, categories } from '@/db/schema';
import { totalsByCategory } from '@/features/reports/repository';
import { monthKey, nowTimestamp, todayISO, type ISODate, type MonthKey } from '@/lib/dates';

export const BUDGET_TABLES = ['budgets', 'transactions', 'categories'];

export type BudgetLevel = 'ok' | 'attention' | 'over';

export type BudgetStatus = {
  id: string;
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  /** 0..n (1 = 100%). */
  ratio: number;
  level: BudgetLevel;
  /** No mês atual: quanto vai dar no fim do mês mantendo o ritmo. */
  projectedCents: number;
};

/** Nível: até 80% ok; de 80% a 100% atenção; acima de 100% estourado. */
export function levelOf(ratio: number): BudgetLevel {
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'attention';
  return 'ok';
}

/** Projeção pelo ritmo: gasto até hoje ÷ dias passados × dias do mês. Mês fechado = o próprio gasto. */
export function projectByPace(spentCents: number, month: MonthKey, today: ISODate): number {
  if (monthKey(parseISO(today)) !== month) return spentCents;
  const day = Number(today.slice(8, 10));
  const days = getDaysInMonth(parseISO(`${month}-01`));
  return Math.round((spentCents / day) * days);
}

export function listBudgets(db: AppDb) {
  return db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      amountCents: budgets.amountCents,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
    })
    .from(budgets)
    .innerJoin(categories, eq(categories.id, budgets.categoryId))
    .where(and(isNull(budgets.deletedAt), isNull(categories.deletedAt)))
    .all();
}

export function budgetStatus(
  db: AppDb,
  month: MonthKey,
  today: ISODate = todayISO(),
): BudgetStatus[] {
  const spent = new Map(totalsByCategory(db, 'expense', month).map((t) => [t.categoryId, t.cents]));
  return listBudgets(db)
    .map((b) => {
      const spentCents = spent.get(b.categoryId) ?? 0;
      const ratio = spentCents / b.amountCents;
      return {
        id: b.id,
        categoryId: b.categoryId,
        name: b.name,
        icon: b.icon,
        color: b.color,
        limitCents: b.amountCents,
        spentCents,
        remainingCents: b.amountCents - spentCents,
        ratio,
        level: levelOf(ratio),
        projectedCents: projectByPace(spentCents, month, today),
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export function budgetSummary(status: BudgetStatus[]) {
  const limit = status.reduce((s, b) => s + b.limitCents, 0);
  const spent = status.reduce((s, b) => s + b.spentCents, 0);
  return {
    limitCents: limit,
    spentCents: spent,
    ratio: limit ? spent / limit : 0,
    over: status.filter((b) => b.level === 'over').length,
  };
}

/** Define (ou atualiza) o orçamento mensal de uma categoria principal de despesa. */
export const budgetIdFor = (categoryId: string) => `budget:${categoryId}`;

export function setBudget(db: AppDb, categoryId: string, amountCents: number): string {
  if (!Number.isInteger(amountCents) || amountCents <= 0)
    throw new Error('O valor precisa ser maior que zero.');
  const cat = db.select().from(categories).where(eq(categories.id, categoryId)).get();
  if (!cat || cat.kind !== 'expense' || cat.parentId)
    throw new Error('Escolha uma categoria principal de despesa.');
  const now = nowTimestamp();
  const existing = db
    .select()
    .from(budgets)
    .where(and(eq(budgets.categoryId, categoryId), isNull(budgets.deletedAt)))
    .get();
  if (existing) {
    db.update(budgets)
      .set({ amountCents, updatedAt: now })
      .where(eq(budgets.id, existing.id))
      .run();
    return existing.id;
  }
  // ID fixo por categoria: dois aparelhos criando o orçamento da mesma categoria
  // viram um registro só no sync (em vez de dois orçamentos para a mesma categoria).
  const id = budgetIdFor(categoryId);
  db.insert(budgets)
    .values({ id, categoryId, amountCents, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: budgets.id,
      set: { categoryId, amountCents, updatedAt: now, deletedAt: null },
    })
    .run();
  return id;
}

export function deleteBudget(db: AppDb, id: string) {
  const now = nowTimestamp();
  db.update(budgets).set({ deletedAt: now, updatedAt: now }).where(eq(budgets.id, id)).run();
}
