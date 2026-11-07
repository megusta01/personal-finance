import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/db/client';
import { migrate } from '@/db/migrations';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import {
  createTransaction,
  deleteTransaction,
  listByMonth,
  monthlySeries,
  monthTotals,
  signedAmount,
} from '@/features/transactions/repository';
import { migrationDb, openTestDb, testDrizzle } from '@/test/sqlite';
import {
  adjustBalance,
  archiveAccount,
  createAccount,
  deleteAccount,
  getAccount,
  listAccountsWithBalance,
  totalBalance,
  type AccountInput,
} from './repository';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

let db: AppDb;
beforeEach(async () => {
  const raw = openTestDb();
  await migrate(migrationDb(raw));
  db = testDrizzle(raw);
});

const acc = (over: Partial<AccountInput> = {}): AccountInput => ({
  name: 'Nubank',
  type: 'checking',
  institution: 'Nubank',
  color: '#5E6AD2',
  icon: 'card-outline',
  initialBalanceCents: 100000,
  includeInTotal: true,
  ...over,
});
const day = '2026-11-07';

describe('contas', () => {
  it('cada conta tem seu saldo; transferências movem dinheiro sem mudar o total', () => {
    const nu = createAccount(db, acc());
    createTransaction(db, {
      kind: 'expense',
      amountCents: 2000,
      description: 'Café',
      categoryId: 'cat-exp-food',
      accountId: nu,
      occurredOn: day,
    });
    createTransaction(db, {
      kind: 'transfer',
      amountCents: 30000,
      description: 'Saque',
      accountId: nu,
      toAccountId: DEFAULT_ACCOUNT.id,
      occurredOn: day,
    });

    expect(getAccount(db, nu)?.balanceCents).toBe(100000 - 2000 - 30000);
    expect(getAccount(db, DEFAULT_ACCOUNT.id)?.balanceCents).toBe(30000);
    expect(totalBalance(db)).toBe(100000 - 2000);
  });

  it('conta fora do total não entra na soma', () => {
    createAccount(
      db,
      acc({
        name: 'Reserva',
        type: 'investment',
        initialBalanceCents: 500000,
        includeInTotal: false,
      }),
    );
    expect(totalBalance(db)).toBe(0);
    expect(listAccountsWithBalance(db)).toHaveLength(2);
  });

  it('totais do mês: sem conta ignoram transferências; com conta contam como entrada/saída', () => {
    const nu = createAccount(db, acc());
    createTransaction(db, {
      kind: 'transfer',
      amountCents: 5000,
      description: 'Transferência',
      accountId: nu,
      toAccountId: DEFAULT_ACCOUNT.id,
      occurredOn: day,
    });
    expect(monthTotals(db, '2026-11')).toEqual({ incomeCents: 0, expenseCents: 0 });
    expect(monthlySeries(db, '2026-11', 1)[0]).toMatchObject({ incomeCents: 0, expenseCents: 0 });
    expect(monthTotals(db, '2026-11', nu)).toEqual({ incomeCents: 0, expenseCents: 5000 });
    expect(monthTotals(db, '2026-11', DEFAULT_ACCOUNT.id)).toEqual({
      incomeCents: 5000,
      expenseCents: 0,
    });

    const [row] = listByMonth(db, { month: '2026-11', accountId: DEFAULT_ACCOUNT.id });
    expect(row).toMatchObject({
      kind: 'transfer',
      accountName: 'Nubank',
      toAccountName: 'Carteira',
    });
    expect(signedAmount(row!, DEFAULT_ACCOUNT.id)).toBe(5000);
    expect(signedAmount(row!, nu)).toBe(-5000);
    expect(signedAmount(row!)).toBe(0);
  });

  it('transferência para a mesma conta é recusada', () => {
    expect(() =>
      createTransaction(db, {
        kind: 'transfer',
        amountCents: 100,
        description: 'x',
        accountId: DEFAULT_ACCOUNT.id,
        toAccountId: DEFAULT_ACCOUNT.id,
        occurredOn: day,
      }),
    ).toThrow(/contas diferentes/);
  });

  it('ajustar saldo cria um lançamento com a diferença', () => {
    const nu = createAccount(db, acc({ initialBalanceCents: 10000 }));
    adjustBalance(db, nu, 12550, day);
    expect(getAccount(db, nu)?.balanceCents).toBe(12550);
    adjustBalance(db, nu, 5000, day);
    expect(getAccount(db, nu)?.balanceCents).toBe(5000);
    expect(adjustBalance(db, nu, 5000, day)).toBeNull();
    // ajuste muda o saldo, mas não aparece como entrada/saída do mês
    expect(monthTotals(db, '2026-11')).toEqual({ incomeCents: 0, expenseCents: 0 });
    expect(monthlySeries(db, '2026-11', 1)[0]).toMatchObject({ incomeCents: 0, expenseCents: 0 });
    const rows = listByMonth(db, { month: '2026-11', accountId: nu });
    expect(rows.map((r) => [r.kind, r.amountCents, r.categoryName])).toEqual(
      expect.arrayContaining([
        ['income', 2550, 'Ajuste de saldo'],
        ['expense', 7550, 'Ajuste de saldo'],
      ]),
    );
  });

  it('não exclui conta com movimentações, mas permite arquivar; e sempre sobra uma ativa', () => {
    const nu = createAccount(db, acc());
    const tx = createTransaction(db, {
      kind: 'expense',
      amountCents: 100,
      description: 'x',
      categoryId: 'cat-exp-food',
      accountId: nu,
      occurredOn: day,
    });
    expect(() => deleteAccount(db, nu)).toThrow(/Arquive/);
    archiveAccount(db, nu);
    expect(listAccountsWithBalance(db).map((a) => a.id)).toEqual([DEFAULT_ACCOUNT.id]);
    expect(listAccountsWithBalance(db, { archived: true }).map((a) => a.id)).toEqual([nu]);
    expect(() => archiveAccount(db, DEFAULT_ACCOUNT.id)).toThrow(/pelo menos uma/);
    deleteTransaction(db, tx);
    deleteAccount(db, nu);
    expect(getAccount(db, nu)).toBeUndefined();
  });
});
