import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/db/client';
import { migrate, MIGRATIONS } from '@/db/migrations';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import { createAccount, getAccount, totalBalance } from '@/features/accounts/repository';
import { setBudget, listBudgets } from '@/features/budgets/repository';
import { createCard, saveCardPurchase } from '@/features/cards/repository';
import { addGoalEntry, createGoal, listGoals } from '@/features/goals/repository';
import { createRecurrence } from '@/features/recurrences/repository';
import {
  createTransaction,
  deleteTransaction,
  listAllTransactions,
} from '@/features/transactions/repository';
import { migrationDb, openTestDb, testDrizzle, type RawDb } from '@/test/sqlite';
import { createBackup, describeBackup, parseBackup, restoreBackup } from './backup';
import { csvCell, exportCsv } from './csv';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

async function freshDb(): Promise<{ db: AppDb; raw: RawDb }> {
  const raw = openTestDb();
  await migrate(migrationDb(raw));
  return { db: testDrizzle(raw), raw };
}

function fill(db: AppDb) {
  const nu = createAccount(db, {
    name: 'Nubank',
    type: 'checking',
    color: '#000',
    icon: 'x',
    initialBalanceCents: 100000,
    includeInTotal: true,
  });
  createTransaction(db, {
    kind: 'expense',
    amountCents: 4590,
    description: 'Almoço; com "aspas"',
    categoryId: 'sub-food-restaurant',
    accountId: nu,
    occurredOn: '2026-11-08',
    notes: 'linha 1\nlinha 2',
  });
  const gone = createTransaction(db, {
    kind: 'income',
    amountCents: 100,
    description: 'excluída',
    categoryId: 'cat-inc-other',
    accountId: nu,
    occurredOn: '2026-11-08',
  });
  deleteTransaction(db, gone);
  createTransaction(db, {
    kind: 'transfer',
    amountCents: 20000,
    description: 'Saque',
    accountId: nu,
    toAccountId: DEFAULT_ACCOUNT.id,
    occurredOn: '2026-11-07',
  });
  const card = createCard(db, {
    name: 'Roxinho',
    brand: 'mastercard',
    color: '#000',
    limitCents: 500000,
    closingDay: 3,
    dueDay: 10,
  });
  saveCardPurchase(db, {
    cardId: card,
    kind: 'expense',
    totalCents: 30000,
    installments: 3,
    description: 'Fone',
    categoryId: 'cat-exp-shopping',
    purchasedOn: '2026-11-08',
  });
  createRecurrence(
    db,
    {
      kind: 'expense',
      amountCents: 150000,
      variableAmount: false,
      description: 'Aluguel',
      accountId: nu,
      frequency: 'monthly',
      interval: 1,
      startOn: '2026-11-05',
      autoPay: false,
    },
    '2026-11-08',
  );
  setBudget(db, 'cat-exp-food', 80000);
  const g = createGoal(db, {
    name: 'Viagem',
    targetCents: 500000,
    color: '#000',
    icon: 'airplane-outline',
  });
  addGoalEntry(db, g, 25000, '2026-11-01');
  return { nu };
}

describe('backup', () => {
  let src: AppDb;
  beforeEach(async () => {
    src = (await freshDb()).db;
  });

  it('ida e volta: restaura tudo num banco vazio, igual ao original', async () => {
    const { nu } = fill(src);
    const text = JSON.stringify(createBackup(src, '2.4.0'));
    const backup = parseBackup(text);
    expect(describeBackup(backup)).toMatchObject({
      schemaVersion: MIGRATIONS.length,
      transactions: 7,
    });

    const { db: dest } = await freshDb();
    createTransaction(dest, {
      kind: 'expense',
      amountCents: 1,
      description: 'vai sumir',
      categoryId: 'cat-exp-other',
      accountId: DEFAULT_ACCOUNT.id,
      occurredOn: '2026-01-01',
    });
    restoreBackup(dest, backup);

    expect(totalBalance(dest)).toBe(totalBalance(src));
    expect(getAccount(dest, nu)?.balanceCents).toBe(getAccount(src, nu)?.balanceCents);
    expect(
      listAllTransactions(dest)
        .map((r) => r.id)
        .sort(),
    ).toEqual(
      listAllTransactions(src)
        .map((r) => r.id)
        .sort(),
    );
    expect(listAllTransactions(dest).some((r) => r.description === 'vai sumir')).toBe(false);
    expect(listBudgets(dest)).toHaveLength(1);
    expect(listGoals(dest)[0]?.savedCents).toBe(25000);
  });

  it('recusa arquivos que não são backup, ou de versão mais nova', () => {
    expect(() => parseBackup('oi')).toThrow(/não é um backup/);
    expect(() => parseBackup('{"format":"outro"}')).toThrow(/não é um backup/);
    const b = createBackup(src);
    expect(() => parseBackup(JSON.stringify({ ...b, schemaVersion: 99 }))).toThrow(/mais nova/);
    expect(() => parseBackup(JSON.stringify({ ...b, tables: { hackers: [] } }))).toThrow(
      /desconhecida/,
    );
  });

  it('se algo falhar no meio, nada muda', async () => {
    fill(src);
    const b = createBackup(src);
    // referência quebrada: transação apontando para conta que não existe
    b.tables.transactions!.push({
      ...b.tables.transactions![0]!,
      id: 'quebrada',
      account_id: 'nao-existe',
    });
    const { db: dest } = await freshDb();
    createTransaction(dest, {
      kind: 'expense',
      amountCents: 777,
      description: 'fica',
      categoryId: 'cat-exp-other',
      accountId: DEFAULT_ACCOUNT.id,
      occurredOn: '2026-01-01',
    });
    expect(() => restoreBackup(dest, b)).toThrow();
    expect(listAllTransactions(dest).map((r) => r.description)).toEqual(['fica']);
  });

  it('aceita backup de uma versão anterior do app (colunas a menos)', async () => {
    fill(src);
    const b = createBackup(src);
    // simula backup da versão 3: sem due_on/recurrence_id e sem tabelas novas
    b.schemaVersion = 3;
    b.tables.transactions = b.tables
      .transactions!.filter((r) => !r.recurrence_id)
      .map(({ due_on: _d, recurrence_id: _r, ...rest }) => rest);
    delete b.tables.recurrences;
    delete b.tables.budgets;
    delete b.tables.goals;
    delete b.tables.goal_entries;
    const { db: dest } = await freshDb();
    restoreBackup(dest, parseBackup(JSON.stringify(b)));
    expect(listAllTransactions(dest).length).toBeGreaterThan(0);
    expect(listAllTransactions(dest).every((r) => r.dueOn === null)).toBe(true);
  });
});

describe('CSV', () => {
  it('formato do Excel em português, escapando ; aspas e quebras de linha', async () => {
    const { db } = await freshDb();
    fill(db);
    const csv = exportCsv(db);
    expect(csv.startsWith('﻿Data;Descrição;Tipo;Valor;')).toBe(true);
    const lines = csv.split('\r\n');
    expect(lines).toContain('07/11/2026;Saque;Transferência;200,00;;;Nubank;Carteira;;;;Pago;;');
    expect(csv).toContain(
      '08/11/2026;"Almoço; com ""aspas""";Despesa;-45,90;Alimentação;Restaurante;Nubank;;;;;Pago;;"linha 1\nlinha 2"',
    );
    expect(csv).toContain(';Fone;Despesa;-100,00;Compras;;;;Roxinho;Dezembro de 2026;1/3;Pago;;');
    expect(csv).toContain('Aluguel;Despesa;-1.500,00;Outros;;Nubank;;;;;A pagar;05/11/2026;');
    expect(csv).not.toContain('excluída');
  });
  it('célula', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell(null)).toBe('');
    expect(csvCell('ok')).toBe('ok');
  });
});
