import { nowTimestamp, parseLegacyDate, todayISO } from '@/lib/dates';
import { DEFAULT_ACCOUNT, DEFAULT_CATEGORIES, FALLBACK_CATEGORY } from './seed';

/**
 * Migrations versionadas com PRAGMA user_version.
 *
 * Regras:
 *  - nunca edite uma migration que já foi publicada; crie a próxima;
 *  - cada migration roda dentro de uma transação junto com a troca de versão,
 *    então ou ela é aplicada inteira ou nada muda.
 *
 * O tipo MigrationDb é o subconjunto do SQLiteDatabase do expo-sqlite que usamos,
 * o que permite testar as migrations no Node com node:sqlite (ver src/test/sqlite.ts).
 */

type Bind = string | number | null;

export interface MigrationDb {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: Bind[]): Promise<unknown>;
  getAllAsync<T>(source: string, params: Bind[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: Bind[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

type Migration = { version: number; name: string; up: (db: MigrationDb) => Promise<void> };

async function tableExists(db: MigrationDb, name: string) {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name],
  );
  return !!row;
}

export async function setMeta(db: MigrationDb, key: string, value: string) {
  await db.runAsync(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

type LegacyRow = {
  id: number;
  descricao: string | null;
  valor: number | null;
  tipo: string | null;
  data: string | null;
};

/** Copia as transações da versão 1 (tabela `transacoes`) para o novo formato. */
export async function importLegacyTransactions(db: MigrationDb) {
  if (!(await tableExists(db, 'transacoes'))) return { imported: 0, skipped: 0 };

  const rows = await db.getAllAsync<LegacyRow>(
    'SELECT id, descricao, valor, tipo, data FROM transacoes ORDER BY id',
    [],
  );
  const now = nowTimestamp();
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const amount = Math.round(Math.abs(Number(row.valor)) * 100);
    if (!Number.isFinite(amount) || amount === 0) {
      skipped++;
      continue;
    }
    const kind = row.tipo === 'receita' ? 'income' : 'expense';
    const parsed = row.data ? parseLegacyDate(row.data) : null;
    const description = row.descricao?.trim() || 'Sem descrição';

    await db.runAsync(
      `INSERT OR IGNORE INTO transactions
        (id, kind, amount_cents, description, account_id, category_id, occurred_on, status, origin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', 'legacy', ?, ?)`,
      [
        `legacy-${row.id}`,
        kind,
        amount,
        description,
        DEFAULT_ACCOUNT.id,
        FALLBACK_CATEGORY[kind],
        parsed?.date ?? todayISO(),
        parsed?.timestamp ?? now,
        now,
      ],
    );
    imported++;
  }

  // A tabela antiga é mantida com outro nome, como cópia de segurança.
  await db.execAsync('ALTER TABLE transacoes RENAME TO legacy_transacoes_v1');
  await setMeta(db, 'legacy_imported_count', String(imported));
  await setMeta(db, 'legacy_skipped_count', String(skipped));
  await setMeta(db, 'legacy_imported_at', now);
  return { imported, skipped };
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'estrutura inicial: contas, categorias, transações',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE app_meta (
          key   TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE accounts (
          id                     TEXT PRIMARY KEY NOT NULL,
          name                   TEXT NOT NULL,
          type                   TEXT NOT NULL CHECK (type IN ('checking','savings','wallet','investment','other')),
          institution            TEXT,
          color                  TEXT NOT NULL,
          icon                   TEXT NOT NULL,
          initial_balance_cents  INTEGER NOT NULL DEFAULT 0,
          include_in_total       INTEGER NOT NULL DEFAULT 1,
          sort_order             INTEGER NOT NULL DEFAULT 0,
          archived_at            TEXT,
          created_at             TEXT NOT NULL,
          updated_at             TEXT NOT NULL,
          deleted_at             TEXT
        );

        CREATE TABLE categories (
          id           TEXT PRIMARY KEY NOT NULL,
          name         TEXT NOT NULL,
          kind         TEXT NOT NULL CHECK (kind IN ('income','expense')),
          icon         TEXT NOT NULL,
          color        TEXT NOT NULL,
          parent_id    TEXT REFERENCES categories(id),
          sort_order   INTEGER NOT NULL DEFAULT 0,
          archived_at  TEXT,
          created_at   TEXT NOT NULL,
          updated_at   TEXT NOT NULL,
          deleted_at   TEXT
        );

        CREATE TABLE transactions (
          id             TEXT PRIMARY KEY NOT NULL,
          kind           TEXT NOT NULL CHECK (kind IN ('income','expense','transfer')),
          amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0),
          description    TEXT NOT NULL,
          account_id     TEXT NOT NULL REFERENCES accounts(id),
          to_account_id  TEXT REFERENCES accounts(id),
          category_id    TEXT REFERENCES categories(id),
          occurred_on    TEXT NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
          status         TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending')),
          notes          TEXT,
          origin         TEXT NOT NULL DEFAULT 'app',
          created_at     TEXT NOT NULL,
          updated_at     TEXT NOT NULL,
          deleted_at     TEXT,
          CHECK ((kind = 'transfer') = (to_account_id IS NOT NULL))
        );

        CREATE INDEX idx_transactions_occurred_on ON transactions (occurred_on);
        CREATE INDEX idx_transactions_account     ON transactions (account_id);
        CREATE INDEX idx_transactions_category    ON transactions (category_id);
        CREATE INDEX idx_transactions_updated_at  ON transactions (updated_at);
        CREATE INDEX idx_accounts_updated_at      ON accounts (updated_at);
        CREATE INDEX idx_categories_updated_at    ON categories (updated_at);
      `);

      const now = nowTimestamp();
      await db.runAsync(
        `INSERT OR IGNORE INTO accounts (id, name, type, color, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          DEFAULT_ACCOUNT.id,
          DEFAULT_ACCOUNT.name,
          DEFAULT_ACCOUNT.type,
          DEFAULT_ACCOUNT.color,
          DEFAULT_ACCOUNT.icon,
          now,
          now,
        ],
      );
      for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, name, kind, icon, color, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.name, c.kind, c.icon, c.color, i, now, now],
        );
      }

      await importLegacyTransactions(db);
    },
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export async function migrate(db: MigrationDb): Promise<{ from: number; to: number }> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const from = row?.user_version ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version <= from) continue;
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${Math.trunc(m.version)}`);
    });
  }
  return { from, to: Math.max(from, LATEST_VERSION) };
}
