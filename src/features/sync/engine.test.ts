import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/db/client';
import { migrate } from '@/db/migrations';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import { SYNC_EPOCH } from '@/db/sync-tables';
import { createBackup, restoreBackup } from '@/features/backup/backup';
import { setBudget } from '@/features/budgets/repository';
import { getCategory, updateCategory } from '@/features/categories/repository';
import { createRecurrence, occurrenceId } from '@/features/recurrences/repository';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
  type TransactionInput,
} from '@/features/transactions/repository';
import { asUser, cloudRemote, openCloud, type Cloud } from '@/test/cloud';
import { migrationDb, openTestDb, testDrizzle } from '@/test/sqlite';
import { linkedUser, pendingCount, PULL_PAGE, syncOnce } from './engine';
import { wipeLocalData } from './wipe';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

const ANA = '11111111-1111-4111-8111-111111111111';
const BIA = '22222222-2222-4222-8222-222222222222';
const W = DEFAULT_ACCOUNT.id;

type Device = { db: AppDb; raw: ReturnType<typeof openTestDb>; sync(): Promise<unknown> };

let cloud: Cloud;
let clock = Date.parse('2026-11-08T12:00:00.000Z');
/** Avança o relógio: cada edição tem um horário diferente e conhecido. */
const tick = (ms = 1000) => {
  clock += ms;
  vi.setSystemTime(clock);
};

async function device(user = ANA): Promise<Device> {
  const raw = openTestDb();
  await migrate(migrationDb(raw));
  const db = testDrizzle(raw);
  return { db, raw, sync: () => syncOnce(db, cloudRemote(cloud, user), user) };
}

type Cat = Extract<TransactionInput, { kind: 'income' | 'expense' }>;
const expense = (over: Partial<Cat> = {}): TransactionInput =>
  ({
    kind: 'expense',
    amountCents: 1000,
    description: 'Café',
    categoryId: 'cat-exp-food',
    accountId: W,
    occurredOn: '2026-11-08',
    ...over,
  }) as TransactionInput;

/** Lê direto do banco, inclusive excluídos (o repositório esconde os excluídos). */
const rowOf = (d: Device, table: string, id: string) =>
  d.db.get<{ deleted_at: string | null; description?: string }>(
    sql`SELECT * FROM ${sql.identifier(table)} WHERE id = ${id}`,
  );

const cloudRows = async (table: string, user = ANA) =>
  asUser(
    cloud.pg,
    user,
    async (tx) => (await tx.query<Record<string, unknown>>(`select * from public.${table}`)).rows,
  );

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  tick();
  cloud = await openCloud();
  await cloud.addUser(ANA);
  await cloud.addUser(BIA);
});
afterEach(() => vi.useRealTimers());

describe('sincronização', () => {
  it('põe as tabelas na publicação do Realtime (quando ela existe, como no Supabase)', async () => {
    const { readFileSync } = await import('node:fs');
    const { SCHEMA_SQL_PATH } = await import('@/test/cloud');
    await cloud.pg.exec('create publication supabase_realtime');
    await cloud.pg.exec(readFileSync(SCHEMA_SQL_PATH, 'utf8'));
    await cloud.pg.exec(readFileSync(SCHEMA_SQL_PATH, 'utf8')); // de novo: sem erro
    const res = await cloud.pg.query<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`,
    );
    expect(res.rows.map((r) => r.tablename)).toEqual([
      'accounts',
      'budgets',
      'categories',
      'credit_cards',
      'goal_entries',
      'goals',
      'recurrences',
      'transactions',
    ]);
  });

  it('o SQL da nuvem pode ser rodado de novo sem erro', async () => {
    const { readFileSync } = await import('node:fs');
    const { SCHEMA_SQL_PATH } = await import('@/test/cloud');
    await cloud.pg.exec(readFileSync(SCHEMA_SQL_PATH, 'utf8'));
  });

  it('leva um lançamento de um aparelho para o outro, com edição e exclusão', async () => {
    const a = await device();
    const b = await device();
    const id = createTransaction(a.db, expense());
    await a.sync();
    await b.sync();
    expect(getTransaction(b.db, id)?.description).toBe('Café');

    tick();
    updateTransaction(b.db, id, expense({ description: 'Café da manhã', amountCents: 1500 }));
    await b.sync();
    await a.sync();
    expect(getTransaction(a.db, id)).toMatchObject({
      description: 'Café da manhã',
      amountCents: 1500,
    });

    tick();
    deleteTransaction(a.db, id);
    await a.sync();
    await b.sync();
    expect(rowOf(b, 'transactions', id)?.deleted_at).toBeTruthy();
    expect(pendingCount(a.db)).toBe(0);
    expect(pendingCount(b.db)).toBe(0);
  });

  it('conflito: vence a última edição, não importa quem sincroniza primeiro', async () => {
    const a = await device();
    const b = await device();
    const id = createTransaction(a.db, expense());
    await a.sync();
    await b.sync();

    tick();
    updateTransaction(a.db, id, expense({ description: 'Editado no A' }));
    tick();
    updateTransaction(b.db, id, expense({ description: 'Editado no B (mais novo)' }));
    // B envia primeiro; depois A tenta enviar a versão mais antiga.
    await b.sync();
    await a.sync();
    await b.sync();
    expect(getTransaction(a.db, id)?.description).toBe('Editado no B (mais novo)');
    expect(getTransaction(b.db, id)?.description).toBe('Editado no B (mais novo)');
    const [row] = await cloudRows('transactions');
    expect(row?.description).toBe('Editado no B (mais novo)');
  });

  it('cada pessoa só vê e só grava os próprios dados (RLS)', async () => {
    const a = await device(ANA);
    createTransaction(a.db, expense({ description: 'Segredo da Ana' }));
    await a.sync();
    const bia = await device(BIA);
    await bia.sync();
    const desc = bia.db.all<{ description: string }>(sql`SELECT description FROM transactions`);
    expect(desc).toEqual([]);
    expect(await cloudRows('transactions', BIA)).toEqual([]);
    // Tentar gravar em nome de outra pessoa falha.
    await expect(
      asUser(cloud.pg, BIA, (tx) =>
        tx.query(
          `insert into public.goals (user_id, id, name, target_cents, color, icon, created_at, updated_at)
           values ($1, 'g', 'x', 1, '#000', 'x', 'a', 'a')`,
          [ANA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('no primeiro login, os dados do aparelho se juntam aos da conta', async () => {
    const a = await device();
    const fromA = createTransaction(a.db, expense({ description: 'Do celular' }));
    await a.sync();
    // Um aparelho que já tinha dados antes de entrar na conta.
    const b = await device();
    const fromB = createTransaction(b.db, expense({ description: 'Do tablet' }));
    expect(linkedUser(b.db)).toBeNull();
    await b.sync();
    await a.sync();
    expect(linkedUser(b.db)).toBe(ANA);
    for (const d of [a, b]) {
      expect(getTransaction(d.db, fromA)?.description).toBe('Do celular');
      expect(getTransaction(d.db, fromB)?.description).toBe('Do tablet');
    }
    // As 40+ categorias padrão não duplicaram (mesmo ID nos dois aparelhos).
    const n = (await cloudRows('categories')).length;
    const local = a.db.get<{ n: number }>(sql`SELECT count(*) AS n FROM categories`)?.n;
    expect(n).toBe(local);
  });

  it('categoria padrão renomeada num aparelho não volta ao nome antigo por causa de um aparelho novo', async () => {
    const a = await device();
    tick();
    updateCategory(a.db, 'cat-exp-groceries', {
      name: 'Supermercado',
      icon: 'cart-outline',
      color: '#2E8B57',
    });
    await a.sync();
    tick(60_000);
    const novo = await device(); // instalado depois: categorias padrão com carimbo antigo
    await novo.sync();
    await a.sync();
    expect(getCategory(novo.db, 'cat-exp-groceries')?.name).toBe('Supermercado');
    expect(getCategory(a.db, 'cat-exp-groceries')?.name).toBe('Supermercado');
  });

  it('ocorrência de recorrência paga num aparelho não é sobrescrita pela gerada no outro', async () => {
    const a = await device();
    const input = {
      kind: 'expense' as const,
      amountCents: 12000,
      description: 'Internet',
      categoryId: 'cat-exp-utilities',
      accountId: W,
      cardId: null,
      frequency: 'monthly' as const,
      interval: 1,
      startOn: '2026-11-10',
      variableAmount: false,
      autoPay: false,
    };
    const rid = createRecurrence(a.db, input, '2026-11-08');
    const occ = occurrenceId(rid, '2026-11-10');
    expect(getTransaction(a.db, occ)?.updatedAt).toBe(SYNC_EPOCH);
    await a.sync();
    tick();
    a.db.run(
      sql`UPDATE transactions SET status = 'paid', updated_at = ${new Date().toISOString()} WHERE id = ${occ}`,
    );
    // B recebe a recorrência antes da edição, gera as próprias ocorrências e sincroniza depois.
    const b = await device();
    await b.sync();
    const { generateAll } = await import('@/features/recurrences/repository');
    generateAll(b.db, '2026-11-08');
    await a.sync();
    await b.sync();
    expect(getTransaction(b.db, occ)?.status).toBe('paid');
    expect(getTransaction(a.db, occ)?.status).toBe('paid');
  });

  it('orçamento criado nos dois aparelhos para a mesma categoria vira um só', async () => {
    const a = await device();
    const b = await device();
    await a.sync();
    await b.sync();
    tick();
    setBudget(a.db, 'cat-exp-food', 50000);
    tick();
    setBudget(b.db, 'cat-exp-food', 60000);
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) {
      const rows = d.db.all<{ amount_cents: number }>(
        sql`SELECT amount_cents FROM budgets WHERE deleted_at IS NULL`,
      );
      expect(rows).toEqual([{ amount_cents: 60000 }]);
    }
    expect((await cloudRows('budgets')).length).toBe(1);
  });

  it('o que muda durante o envio fica na fila para a próxima rodada', async () => {
    const a = await device();
    const id = createTransaction(a.db, expense());
    let edited = false;
    const remote = cloudRemote(cloud, ANA, {
      beforeUpsert: (table) => {
        if (table === 'transactions' && !edited) {
          edited = true;
          tick();
          updateTransaction(a.db, id, expense({ description: 'Mudou no meio' }));
        }
      },
    });
    await syncOnce(a.db, remote, ANA);
    // A edição feita no meio do envio não se perdeu: subiu na volta seguinte do mesmo envio.
    expect(edited).toBe(true);
    expect(pendingCount(a.db)).toBe(0);
    const rows = await cloudRows('transactions');
    expect(rows.find((r) => r.id === id)?.description).toBe('Mudou no meio');
  });

  it('envia e recebe em lotes quando há muitos registros', async () => {
    const a = await device();
    const many = PULL_PAGE + 150;
    a.db.run(sql`BEGIN`);
    for (let i = 0; i < many; i++) createTransaction(a.db, expense({ description: `n${i}` }));
    a.db.run(sql`COMMIT`);
    await a.sync();
    const b = await device();
    await b.sync();
    const n = b.db.get<{ n: number }>(sql`SELECT count(*) AS n FROM transactions`)?.n;
    expect(n).toBe(many);
  });

  it('restaurar um backup com a conta ligada exclui na nuvem o que não está no backup', async () => {
    const a = await device();
    const keep = createTransaction(a.db, expense({ description: 'Fica' }));
    await a.sync();
    const backup = JSON.parse(JSON.stringify(createBackup(a.db)));
    tick();
    const extra = createTransaction(a.db, expense({ description: 'Depois do backup' }));
    await a.sync();
    tick();
    restoreBackup(a.db, backup);
    await a.sync();
    const b = await device();
    await b.sync();
    expect(rowOf(b, 'transactions', keep)?.deleted_at).toBeNull();
    expect(rowOf(b, 'transactions', extra)?.deleted_at).toBeTruthy();
  });

  it('sair da conta apaga os dados do aparelho; entrar de novo traz tudo de volta', async () => {
    const a = await device();
    const id = createTransaction(a.db, expense());
    tick();
    updateCategory(a.db, 'cat-exp-food', {
      name: 'Comida',
      icon: 'restaurant-outline',
      color: '#C0392B',
    });
    await a.sync();
    await wipeLocalData(migrationDb(a.raw));
    expect(getTransaction(a.db, id)).toBeUndefined();
    expect(getCategory(a.db, 'cat-exp-food')?.name).toBe('Alimentação');
    expect(linkedUser(a.db)).toBeNull();
    expect(pendingCount(a.db)).toBe(0);
    tick();
    await a.sync();
    expect(getTransaction(a.db, id)?.description).toBe('Café');
    expect(getCategory(a.db, 'cat-exp-food')?.name).toBe('Comida');
  });
});
