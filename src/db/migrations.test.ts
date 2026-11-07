import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { LATEST_VERSION, migrate, type MigrationDb } from './migrations';
import { DEFAULT_CATEGORIES } from './seed';

/** Adapta o better-sqlite3 (síncrono) para a interface assíncrona do expo-sqlite. */
function adapter(raw: Database.Database): MigrationDb {
  return {
    execAsync: async (s) => void raw.exec(s),
    runAsync: async (s, p) => raw.prepare(s).run(...p),
    getAllAsync: async <T>(s: string, p: (string | number | null)[] = []) =>
      raw.prepare(s).all(...p) as T[],
    getFirstAsync: async <T>(s: string, p: (string | number | null)[] = []) =>
      (raw.prepare(s).get(...p) as T | undefined) ?? null,
    withTransactionAsync: async (task) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

/** Cria um banco igual ao da versão 1 do app (services/database.js). */
function legacyDb() {
  const raw = new Database(':memory:');
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
    const raw = new Database(':memory:');
    const db = adapter(raw);
    expect(await migrate(db)).toEqual({ from: 0, to: LATEST_VERSION });
    expect(await migrate(db)).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION });

    const cats = raw.prepare('SELECT count(*) n FROM categories').get() as { n: number };
    expect(cats.n).toBe(DEFAULT_CATEGORIES.length);
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
    const raw = new Database(':memory:');
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
});
