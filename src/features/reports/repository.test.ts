import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/db/client';
import { migrate } from '@/db/migrations';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import { adjustBalance, createAccount } from '@/features/accounts/repository';
import {
  budgetStatus,
  budgetSummary,
  deleteBudget,
  levelOf,
  projectByPace,
  setBudget,
} from '@/features/budgets/repository';
import { createCard, saveCardPurchase } from '@/features/cards/repository';
import {
  addGoalEntry,
  createGoal,
  deleteGoalEntry,
  getGoal,
  listGoalEntries,
  listGoals,
  progressOf,
} from '@/features/goals/repository';
import { createTransaction, type TransactionInput } from '@/features/transactions/repository';
import { migrationDb, openTestDb, testDrizzle } from '@/test/sqlite';
import { cumulativeSpending, topExpenses, totalsByCategory } from './repository';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

let db: AppDb;
const W = DEFAULT_ACCOUNT.id;
beforeEach(async () => {
  const raw = openTestDb();
  await migrate(migrationDb(raw));
  db = testDrizzle(raw);
});

type Cat = Extract<TransactionInput, { kind: 'income' | 'expense' }>;
const spend = (cents: number, categoryId: string, on: string, over: Partial<Cat> = {}) =>
  createTransaction(db, {
    kind: 'expense',
    amountCents: cents,
    description: 'x',
    categoryId,
    accountId: W,
    occurredOn: on,
    ...over,
  });

describe('relatórios', () => {
  it('soma subcategorias no pai, compara com o mês anterior e ignora o que não é gasto real', () => {
    spend(5000, 'sub-food-delivery', '2026-11-03');
    spend(3000, 'cat-exp-food', '2026-11-04');
    spend(10000, 'cat-exp-transport', '2026-11-05');
    spend(4000, 'cat-exp-food', '2026-10-10');
    spend(2500, 'cat-exp-pets', '2026-10-12'); // só no mês anterior
    spend(999, 'cat-exp-health', '2026-11-20', { status: 'pending' }); // a pagar não conta
    adjustBalance(db, W, -100000, '2026-11-06'); // ajuste não conta
    const card = createCard(db, {
      name: 'Nu',
      brand: 'visa',
      color: '#000',
      limitCents: 100000,
      closingDay: 3,
      dueDay: 10,
    });
    saveCardPurchase(db, {
      cardId: card,
      kind: 'expense',
      totalCents: 6000,
      installments: 3,
      description: 'Fone',
      categoryId: 'cat-exp-shopping',
      purchasedOn: '2026-11-08',
    });

    const rows = totalsByCategory(db, 'expense', '2026-11');
    expect(rows.map((r) => [r.categoryId, r.cents, r.previousCents])).toEqual([
      ['cat-exp-transport', 10000, 0],
      ['cat-exp-food', 8000, 4000],
      ['cat-exp-shopping', 2000, 0],
      ['cat-exp-pets', 0, 2500],
    ]);
    expect(rows[1]).toMatchObject({ name: 'Alimentação', icon: 'restaurant-outline' });

    const subs = totalsByCategory(db, 'expense', '2026-11', 'cat-exp-food');
    expect(subs.map((r) => [r.name, r.cents])).toEqual([
      ['Delivery', 5000],
      ['Alimentação (sem subcategoria)', 3000],
    ]);

    expect(topExpenses(db, '2026-11', 2).map((r) => r.amountCents)).toEqual([10000, 5000]);
    const cum = cumulativeSpending(db, '2026-11');
    expect(cum).toHaveLength(30);
    expect([cum[2], cum[4], cum[29]]).toEqual([5000, 18000, 20000]);
  });
});

describe('orçamentos', () => {
  it('acompanha gasto por categoria (com subcategorias), nível e projeção pelo ritmo', () => {
    setBudget(db, 'cat-exp-food', 10000);
    const t = setBudget(db, 'cat-exp-transport', 5000);
    expect(setBudget(db, 'cat-exp-transport', 6000)).toBe(t); // atualiza, não duplica
    spend(7000, 'sub-food-delivery', '2026-11-02');
    spend(1500, 'cat-exp-food', '2026-11-05');
    spend(6500, 'cat-exp-transport', '2026-11-06');

    const s = budgetStatus(db, '2026-11', '2026-11-10');
    expect(s.map((b) => [b.categoryId, b.spentCents, b.level])).toEqual([
      ['cat-exp-transport', 6500, 'over'],
      ['cat-exp-food', 8500, 'attention'],
    ]);
    expect(s[1]?.projectedCents).toBe(25500); // 8.500 em 10 dias → 25.500 em 30
    expect(budgetSummary(s)).toMatchObject({ limitCents: 16000, spentCents: 15000, over: 1 });
    expect(() => setBudget(db, 'sub-food-delivery', 100)).toThrow();
    expect(() => setBudget(db, 'cat-inc-salary', 100)).toThrow();
    deleteBudget(db, t);
    expect(budgetStatus(db, '2026-11')).toHaveLength(1);
  });

  it('níveis e projeção', () => {
    expect([levelOf(0.5), levelOf(0.8), levelOf(1), levelOf(1.01)]).toEqual([
      'ok',
      'attention',
      'attention',
      'over',
    ]);
    expect(projectByPace(1000, '2026-10', '2026-11-08')).toBe(1000);
  });
});

describe('metas', () => {
  it('com aportes: progresso, quanto guardar por mês e não deixa retirar demais', () => {
    const id = createGoal(db, {
      name: 'Viagem',
      targetCents: 600000,
      targetDate: '2027-04-30',
      color: '#2F8FC4',
      icon: 'airplane-outline',
    });
    addGoalEntry(db, id, 100000, '2026-11-01');
    const e = addGoalEntry(db, id, 50000, '2026-11-05');
    addGoalEntry(db, id, -30000, '2026-11-06');
    const p = progressOf(db, getGoal(db, id)!, '2026-11-08');
    expect(p).toMatchObject({
      savedCents: 120000,
      remainingCents: 480000,
      monthsLeft: 6,
      monthlyNeededCents: 80000,
      done: false,
    });
    expect(() => addGoalEntry(db, id, -200000)).toThrow(/retirar/);
    deleteGoalEntry(db, e);
    expect(listGoalEntries(db, id)).toHaveLength(2);
    addGoalEntry(db, id, 600000);
    expect(listGoals(db)[0]).toMatchObject({ done: true, monthlyNeededCents: null });
  });

  it('vinculada a uma conta acompanha o saldo dela', () => {
    const acc = createAccount(db, {
      name: 'Reserva',
      type: 'savings',
      color: '#000',
      icon: 'x',
      initialBalanceCents: 300000,
      includeInTotal: false,
    });
    const id = createGoal(db, {
      name: 'Reserva de emergência',
      targetCents: 1200000,
      color: '#000',
      icon: 'shield-outline',
      accountId: acc,
    });
    expect(listGoals(db)[0]).toMatchObject({
      savedCents: 300000,
      accountName: 'Reserva',
      ratio: 0.25,
    });
    expect(() => addGoalEntry(db, id, 100)).toThrow(/conta/);
  });
});
