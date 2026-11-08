import { nowTimestamp, parseLegacyDate, todayISO } from '@/lib/dates';
import {
  DEFAULT_ACCOUNT,
  DEFAULT_CATEGORIES,
  DEFAULT_SUBCATEGORIES,
  FALLBACK_CATEGORY,
  SYSTEM_CATEGORIES,
} from './seed';

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
  {
    version: 2,
    name: 'categorias de sistema, subcategorias padrão e índices para transferências',
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE categories ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX idx_transactions_to_account ON transactions (to_account_id);
        CREATE INDEX idx_categories_parent       ON categories (parent_id);
      `);

      const now = nowTimestamp();
      for (const c of SYSTEM_CATEGORIES) {
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, name, kind, icon, color, sort_order, is_system, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 999, 1, ?, ?)`,
          [c.id, c.name, c.kind, c.icon, c.color, now, now],
        );
      }

      // Subcategorias herdam tipo, ícone e cor da categoria pai (se ela ainda existir).
      for (const [i, sub] of DEFAULT_SUBCATEGORIES.entries()) {
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, name, kind, icon, color, parent_id, sort_order, created_at, updated_at)
           SELECT ?, ?, kind, icon, color, id, ?, ?, ?
             FROM categories
            WHERE id = ? AND deleted_at IS NULL`,
          [sub.id, sub.name, i, now, now, sub.parentId],
        );
      }
    },
  },
  {
    version: 3,
    name: 'cartões de crédito, compras parceladas e pagamento de fatura',
    up: async (db) => {
      // O SQLite não altera CHECK nem NOT NULL de colunas existentes, então a tabela
      // de transações é recriada (procedimento oficial: criar nova, copiar, trocar).
      // Nenhuma tabela aponta para `transactions`, então a troca é segura.
      await db.execAsync(`
        CREATE TABLE credit_cards (
          id                  TEXT PRIMARY KEY NOT NULL,
          name                TEXT NOT NULL,
          brand               TEXT NOT NULL CHECK (brand IN ('visa','mastercard','elo','amex','hipercard','other')),
          last_digits         TEXT CHECK (last_digits IS NULL OR last_digits GLOB '[0-9][0-9][0-9][0-9]'),
          color               TEXT NOT NULL,
          limit_cents         INTEGER NOT NULL CHECK (limit_cents >= 0),
          closing_day         INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
          due_day             INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
          payment_account_id  TEXT REFERENCES accounts(id),
          sort_order          INTEGER NOT NULL DEFAULT 0,
          archived_at         TEXT,
          created_at          TEXT NOT NULL,
          updated_at          TEXT NOT NULL,
          deleted_at          TEXT
        );
        CREATE INDEX idx_credit_cards_updated_at ON credit_cards (updated_at);

        CREATE TABLE transactions_v3 (
          id                    TEXT PRIMARY KEY NOT NULL,
          kind                  TEXT NOT NULL CHECK (kind IN ('income','expense','transfer','card_payment')),
          amount_cents          INTEGER NOT NULL CHECK (amount_cents > 0),
          description           TEXT NOT NULL,
          account_id            TEXT REFERENCES accounts(id),
          to_account_id         TEXT REFERENCES accounts(id),
          category_id           TEXT REFERENCES categories(id),
          occurred_on           TEXT NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
          status                TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending')),
          notes                 TEXT,
          origin                TEXT NOT NULL DEFAULT 'app',
          card_id               TEXT REFERENCES credit_cards(id),
          invoice_month         TEXT CHECK (invoice_month IS NULL OR invoice_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
          installment_group_id  TEXT,
          installment_number    INTEGER,
          installment_count     INTEGER,
          created_at            TEXT NOT NULL,
          updated_at            TEXT NOT NULL,
          deleted_at            TEXT,
          -- transferência tem destino; o resto não
          CHECK ((kind = 'transfer') = (to_account_id IS NOT NULL)),
          -- tudo sai de uma conta, menos compra/estorno no cartão
          CHECK (account_id IS NOT NULL OR (card_id IS NOT NULL AND kind IN ('income','expense'))),
          -- só lançamentos de cartão têm fatura, e todos eles têm
          CHECK ((card_id IS NULL) = (invoice_month IS NULL)),
          CHECK (kind <> 'card_payment' OR (card_id IS NOT NULL AND account_id IS NOT NULL)),
          CHECK (kind NOT IN ('transfer','card_payment') OR category_id IS NULL),
          CHECK (card_id IS NULL OR kind = 'card_payment' OR account_id IS NULL),
          CHECK ((installment_group_id IS NULL) = (installment_number IS NULL)
             AND (installment_number IS NULL) = (installment_count IS NULL)),
          CHECK (installment_number IS NULL OR (installment_number BETWEEN 1 AND installment_count))
        );

        INSERT INTO transactions_v3
          (id, kind, amount_cents, description, account_id, to_account_id, category_id, occurred_on,
           status, notes, origin, created_at, updated_at, deleted_at)
        SELECT id, kind, amount_cents, description, account_id, to_account_id, category_id, occurred_on,
               status, notes, origin, created_at, updated_at, deleted_at
          FROM transactions;

        DROP TABLE transactions;
        ALTER TABLE transactions_v3 RENAME TO transactions;

        CREATE INDEX idx_transactions_occurred_on ON transactions (occurred_on);
        CREATE INDEX idx_transactions_account     ON transactions (account_id);
        CREATE INDEX idx_transactions_to_account  ON transactions (to_account_id);
        CREATE INDEX idx_transactions_category    ON transactions (category_id);
        CREATE INDEX idx_transactions_updated_at  ON transactions (updated_at);
        CREATE INDEX idx_transactions_invoice     ON transactions (card_id, invoice_month);
        CREATE INDEX idx_transactions_installment ON transactions (installment_group_id);
      `);
    },
  },
  {
    version: 4,
    name: 'contas a pagar/receber e recorrências',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE recurrences (
          id               TEXT PRIMARY KEY NOT NULL,
          kind             TEXT NOT NULL CHECK (kind IN ('income','expense')),
          amount_cents     INTEGER NOT NULL CHECK (amount_cents > 0),
          variable_amount  INTEGER NOT NULL DEFAULT 0,
          description      TEXT NOT NULL,
          category_id      TEXT REFERENCES categories(id),
          account_id       TEXT REFERENCES accounts(id),
          card_id          TEXT REFERENCES credit_cards(id),
          frequency        TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','yearly')),
          interval_n       INTEGER NOT NULL DEFAULT 1 CHECK (interval_n BETWEEN 1 AND 36),
          start_on         TEXT NOT NULL CHECK (start_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
          end_on           TEXT,
          max_count        INTEGER CHECK (max_count IS NULL OR max_count >= 1),
          auto_pay         INTEGER NOT NULL DEFAULT 0,
          notes            TEXT,
          paused_at        TEXT,
          generated_until  TEXT,
          created_at       TEXT NOT NULL,
          updated_at       TEXT NOT NULL,
          deleted_at       TEXT,
          CHECK ((account_id IS NULL) <> (card_id IS NULL))
        );
        CREATE INDEX idx_recurrences_updated_at ON recurrences (updated_at);

        ALTER TABLE transactions ADD COLUMN due_on TEXT;
        ALTER TABLE transactions ADD COLUMN recurrence_id TEXT REFERENCES recurrences(id);
        CREATE INDEX idx_transactions_due        ON transactions (status, due_on);
        CREATE INDEX idx_transactions_recurrence ON transactions (recurrence_id);
      `);
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
