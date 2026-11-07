import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/db/client';
import { migrate } from '@/db/migrations';
import { schema } from '@/db/schema';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import {
  createTransaction,
  deleteTransaction,
  listByMonth,
  monthTotals,
  monthlySeries,
  restoreTransaction,
  totalBalance,
  updateTransaction,
  type TransactionInput,
} from './repository';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

let db: AppDb;

beforeEach(async () => {
  const raw = new Database(':memory:');
  // mesmo adaptador simples dos testes de migration
  await migrate({
    execAsync: async (s) => void raw.exec(s),
    runAsync: async (s, p) => raw.prepare(s).run(...p),
    getAllAsync: async <T>(s: string, p: (string | number | null)[] = []) =>
      raw.prepare(s).all(...p) as T[],
    getFirstAsync: async <T>(s: string, p: (string | number | null)[] = []) =>
      (raw.prepare(s).get(...p) as T | undefined) ?? null,
    withTransactionAsync: async (task) => {
      raw.exec('BEGIN');
      await task();
      raw.exec('COMMIT');
    },
  });
  // O driver do better-sqlite3 tem a mesma API síncrona do driver do expo-sqlite.
  db = drizzle(raw, { schema }) as unknown as AppDb;
});

const base = (over: Partial<TransactionInput>): TransactionInput => ({
  kind: 'expense',
  amountCents: 1000,
  description: 'Teste',
  categoryId: 'cat-exp-food',
  accountId: DEFAULT_ACCOUNT.id,
  occurredOn: '2026-11-07',
  ...over,
});

describe('transações', () => {
  it('calcula saldo e totais do mês', () => {
    createTransaction(
      db,
      base({
        kind: 'income',
        amountCents: 500000,
        categoryId: 'cat-inc-salary',
        occurredOn: '2026-11-05',
      }),
    );
    createTransaction(db, base({ amountCents: 31237, occurredOn: '2026-11-06' }));
    createTransaction(db, base({ amountCents: 9990, occurredOn: '2026-10-20' }));

    expect(totalBalance(db)).toBe(500000 - 31237 - 9990);
    expect(monthTotals(db, '2026-11')).toEqual({ incomeCents: 500000, expenseCents: 31237 });
    expect(monthTotals(db, '2026-10')).toEqual({ incomeCents: 0, expenseCents: 9990 });
  });

  it('editar uma despesa mantém o tipo escolhido (bug da versão 1)', () => {
    const id = createTransaction(db, base({ description: 'Luz' }));
    updateTransaction(db, id, base({ description: 'Conta de luz', amountCents: 18990 }));
    const [row] = listByMonth(db, { month: '2026-11' });
    expect(row).toMatchObject({
      kind: 'expense',
      description: 'Conta de luz',
      amountCents: 18990,
      categoryName: 'Alimentação',
    });
  });

  it('exclusão é suave e pode ser desfeita', () => {
    const id = createTransaction(db, base({}));
    deleteTransaction(db, id);
    expect(listByMonth(db, { month: '2026-11' })).toHaveLength(0);
    expect(totalBalance(db)).toBe(0);
    restoreTransaction(db, id);
    expect(listByMonth(db, { month: '2026-11' })).toHaveLength(1);
  });

  it('filtra por tipo e busca', () => {
    createTransaction(db, base({ description: 'Padaria' }));
    createTransaction(db, base({ description: 'Uber' }));
    createTransaction(
      db,
      base({ kind: 'income', categoryId: 'cat-inc-salary', description: 'Salário' }),
    );
    expect(listByMonth(db, { month: '2026-11', kind: 'income' }).map((r) => r.description)).toEqual(
      ['Salário'],
    );
    expect(listByMonth(db, { month: '2026-11', search: 'pada' }).map((r) => r.description)).toEqual(
      ['Padaria'],
    );
  });

  it('série mensal inclui meses vazios', () => {
    createTransaction(db, base({ amountCents: 100, occurredOn: '2026-09-01' }));
    const s = monthlySeries(db, '2026-11', 3);
    expect(s.map((m) => [m.month, m.expenseCents])).toEqual([
      ['2026-09', 100],
      ['2026-10', 0],
      ['2026-11', 0],
    ]);
  });

  it('recusa valor zero ou negativo', () => {
    expect(() => createTransaction(db, base({ amountCents: 0 }))).toThrow();
    expect(() => createTransaction(db, base({ amountCents: -5 }))).toThrow();
  });
});
