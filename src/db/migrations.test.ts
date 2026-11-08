import { describe, expect, it } from 'vitest';
import { migrationDb as adapter, openTestDb } from '@/test/sqlite';
import { LATEST_VERSION, migrate, MIGRATIONS } from './migrations';
import { DEFAULT_CATEGORIES, DEFAULT_SUBCATEGORIES, SYSTEM_CATEGORIES } from './seed';

/** Cria um banco igual ao da versão 1 do app (services/database.js). */
function legacyDb() {
  const raw = openTestDb();
  raw.exec(`CREATE TABLE transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, valor REAL NOT NULL,
    tipo TEXT NOT NULL, data TEXT NOT NULL)`);
  const ins = raw.prepare(
    'INSERT INTO transacoes (descricao, valor, tipo, data) VALUES (?, ?, ?, ?)',
  );
  ins.run('Salário', 5000.5, 'receita', '05/11/2026 09:00:00');
  ins.run('Mercado', 312.37, 'despesa', '06/11/2026 18:42:10');
  ins.run('  Café ', 0.1, 'despesa', '11/27/2025, 4:29:00 PM');
  ins.run('Zerada', 0, 'despesa', '06/11/2026 18:42:10');
  ins.run('Data estranha', 10, 'despesa', 'quinta-feira');
  return raw;
}

describe('migrate', () => {
  it('cria a estrutura num banco novo e é idempotente', async () => {
    const raw = openTestDb();
    const db = adapter(raw);
    expect(await migrate(db)).toEqual({ from: 0, to: LATEST_VERSION });
    expect(await migrate(db)).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION });

    const cats = raw.prepare('SELECT count(*) n FROM categories').get() as { n: number };
    expect(cats.n).toBe(
      DEFAULT_CATEGORIES.length + SYSTEM_CATEGORIES.length + DEFAULT_SUBCATEGORIES.length,
    );
    const accs = raw.prepare('SELECT count(*) n FROM accounts').get() as { n: number };
    expect(accs.n).toBe(1);
  });

  it('importa os dados da versão 1 sem perder centavos', async () => {
    const raw = legacyDb();
    await migrate(adapter(raw));

    const rows = raw
      .prepare(
        'SELECT id, kind, amount_cents, description, occurred_on FROM transactions ORDER BY id',
      )
      .all() as Record<string, unknown>[];

    expect(rows).toHaveLength(4); // a transação zerada é ignorada
    expect(rows).toContainEqual(
      expect.objectContaining({
        id: 'legacy-1',
        kind: 'income',
        amount_cents: 500050,
        occurred_on: '2026-11-05',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        id: 'legacy-2',
        kind: 'expense',
        amount_cents: 31237,
        occurred_on: '2026-11-06',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        id: 'legacy-3',
        description: 'Café',
        amount_cents: 10,
        occurred_on: '2025-11-27',
      }),
    );

    const meta = Object.fromEntries(
      (
        raw.prepare('SELECT key, value FROM app_meta').all() as { key: string; value: string }[]
      ).map((r) => [r.key, r.value]),
    );
    expect(meta.legacy_imported_count).toBe('4');
    expect(meta.legacy_skipped_count).toBe('1');

    // a tabela antiga continua guardada como backup
    const backup = raw.prepare('SELECT count(*) n FROM legacy_transacoes_v1').get() as {
      n: number;
    };
    expect(backup.n).toBe(5);
  });

  it('as restrições do banco barram dados inválidos', async () => {
    const raw = openTestDb();
    await migrate(adapter(raw));
    const insert = (amount: number, date: string) =>
      raw
        .prepare(
          `INSERT INTO transactions (id, kind, amount_cents, description, account_id, occurred_on, created_at, updated_at)
           VALUES (?, 'expense', ?, 'x', 'acc-default-wallet', ?, 'now', 'now')`,
        )
        .run(`t-${amount}-${date}`, amount, date);

    expect(() => insert(-100, '2026-11-07')).toThrow();
    expect(() => insert(100, '07/11/2026')).toThrow();
    expect(() => insert(100, '2026-11-07')).not.toThrow();
  });

  it('atualiza um banco da versão 1 (com dados) para a atual sem perder nada', async () => {
    const raw = openTestDb();
    const db = adapter(raw);
    // Estado do celular depois da Fase 1: só a migration 1 aplicada.
    await MIGRATIONS[0]!.up(db);
    raw.exec('PRAGMA user_version = 1');
    raw.exec(`INSERT INTO categories (id, name, kind, icon, color, created_at, updated_at)
              VALUES ('minha-cat', 'Minha categoria', 'expense', 'cart-outline', '#123456', 'x', 'x')`);
    raw.exec(`INSERT INTO transactions (id, kind, amount_cents, description, account_id, category_id, occurred_on, created_at, updated_at)
              VALUES ('t1', 'expense', 1000, 'Teste', 'acc-default-wallet', 'minha-cat', '2026-11-07', 'x', 'x')`);

    expect(await migrate(db)).toEqual({ from: 1, to: LATEST_VERSION });

    const t = raw
      .prepare("SELECT amount_cents, category_id FROM transactions WHERE id = 't1'")
      .get();
    expect(t).toMatchObject({ amount_cents: 1000, category_id: 'minha-cat' });
    const mine = raw.prepare("SELECT is_system FROM categories WHERE id = 'minha-cat'").get();
    expect(mine).toMatchObject({ is_system: 0 });
    const sub = raw
      .prepare("SELECT parent_id, color FROM categories WHERE id = 'sub-food-delivery'")
      .get();
    expect(sub).toMatchObject({ parent_id: 'cat-exp-food', color: '#E07A3F' });
  });

  it('atualiza um banco da versão 2 (com transferência e subcategoria) para a 3', async () => {
    const raw = openTestDb();
    const db = adapter(raw);
    await MIGRATIONS[0]!.up(db);
    await MIGRATIONS[1]!.up(db);
    raw.exec('PRAGMA user_version = 2');
    raw.exec(`INSERT INTO accounts (id, name, type, color, icon, created_at, updated_at)
              VALUES ('nu', 'Nubank', 'checking', '#000', 'card', 'x', 'x')`);
    raw.exec(`INSERT INTO transactions (id, kind, amount_cents, description, account_id, to_account_id, occurred_on, created_at, updated_at)
              VALUES ('tr', 'transfer', 500, 'Saque', 'nu', 'acc-default-wallet', '2026-11-07', 'x', 'x')`);
    raw.exec(`INSERT INTO transactions (id, kind, amount_cents, description, account_id, category_id, occurred_on, notes, created_at, updated_at, deleted_at)
              VALUES ('ex', 'expense', 6790, 'Pizza', 'nu', 'sub-food-delivery', '2026-11-07', 'obs', 'x', 'y', 'z')`);

    expect(await migrate(db)).toEqual({ from: 2, to: LATEST_VERSION });

    const rows = raw.prepare('SELECT * FROM transactions ORDER BY id').all() as Record<
      string,
      unknown
    >[];
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'ex',
        kind: 'expense',
        amount_cents: 6790,
        category_id: 'sub-food-delivery',
        notes: 'obs',
        deleted_at: 'z',
        card_id: null,
      }),
      expect.objectContaining({
        id: 'tr',
        kind: 'transfer',
        to_account_id: 'acc-default-wallet',
        invoice_month: null,
      }),
    ]);
    const indexes = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'transactions'")
      .all() as { name: string }[];
    expect(indexes.map((i) => i.name)).toEqual(
      expect.arrayContaining(['idx_transactions_occurred_on', 'idx_transactions_invoice']),
    );
    expect(raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('atualiza um banco da versão 3 (com compra parcelada) para a 4', async () => {
    const raw = openTestDb();
    const db = adapter(raw);
    for (const m of MIGRATIONS.slice(0, 3)) await m.up(db);
    raw.exec('PRAGMA user_version = 3');
    raw.exec(`INSERT INTO credit_cards (id, name, brand, color, limit_cents, closing_day, due_day, created_at, updated_at)
              VALUES ('c1', 'Nu', 'visa', '#000', 100000, 3, 10, 'x', 'x')`);
    raw.exec(`INSERT INTO transactions (id, kind, amount_cents, description, category_id, occurred_on, card_id, invoice_month,
                installment_group_id, installment_number, installment_count, created_at, updated_at)
              VALUES ('g-1', 'expense', 5000, 'Fone', 'cat-exp-shopping', '2026-11-08', 'c1', '2026-12', 'g', 1, 2, 'x', 'x')`);

    expect(await migrate(db)).toEqual({ from: 3, to: LATEST_VERSION });
    expect(
      raw
        .prepare(
          "SELECT installment_number, due_on, recurrence_id FROM transactions WHERE id = 'g-1'",
        )
        .get(),
    ).toEqual({
      installment_number: 1,
      due_on: null,
      recurrence_id: null,
    });
    expect(raw.prepare('SELECT count(*) AS n FROM recurrences').get()).toEqual({ n: 0 });
    expect(raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
