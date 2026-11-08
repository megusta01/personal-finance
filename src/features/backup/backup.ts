/**
 * Backup completo (JSON) e restauração. Funções puras sobre o banco; ler/gravar arquivo
 * fica em files.ts.
 *
 * Formato: { format, version, schemaVersion, appVersion, createdAt, tables: { nome: linhas[] } }.
 * A restauração aceita backups de versões anteriores do app: insere só as colunas que
 * existem hoje (as novas ficam com o valor padrão). Backup de versão MAIS NOVA é recusado.
 */
import { sql } from 'drizzle-orm';
import type { AppDb } from '@/db/client';
import { LATEST_VERSION } from '@/db/migrations';

export const BACKUP_FORMAT = 'financas-backup';
export const BACKUP_VERSION = 1;

/** Em ordem de dependência (quem é referenciado vem antes). */
export const BACKUP_TABLES = [
  'accounts',
  'categories',
  'credit_cards',
  'recurrences',
  'transactions',
  'budgets',
  'goals',
  'goal_entries',
] as const;

type Row = Record<string, unknown>;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  schemaVersion: number;
  appVersion?: string;
  createdAt: string;
  tables: Partial<Record<(typeof BACKUP_TABLES)[number], Row[]>>;
};

function tableExists(db: AppDb, name: string) {
  return !!db.get(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${name}`);
}

function columnsOf(db: AppDb, table: string): string[] {
  return db.all<{ name: string }>(sql.raw(`PRAGMA table_info(${table})`)).map((c) => c.name);
}

export function createBackup(db: AppDb, appVersion?: string): Backup {
  const version = db.get<{ user_version: number }>(sql`PRAGMA user_version`)?.user_version ?? 0;
  const tables: Backup['tables'] = {};
  for (const t of BACKUP_TABLES) {
    if (!tableExists(db, t)) continue;
    // Inclui os registros excluídos (deleted_at): o sync vai precisar deles.
    tables[t] = db.all<Row>(sql.raw(`SELECT * FROM ${t}`));
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: version,
    appVersion,
    createdAt: new Date().toISOString(),
    tables,
  };
}

export type BackupInfo = {
  createdAt: string;
  schemaVersion: number;
  counts: Record<string, number>;
  transactions: number;
};

/** Lê e valida o arquivo. Lança erro com mensagem para a pessoa se não for um backup válido. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new Error('Este arquivo não é um backup do app (não é um JSON válido).');
  }
  const b = data as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || typeof b.tables !== 'object' || b.tables === null) {
    throw new Error('Este arquivo não é um backup do app.');
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new Error(
      'Este backup foi feito por uma versão mais nova do app. Atualize o app antes de restaurar.',
    );
  }
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > LATEST_VERSION) {
    throw new Error(
      'Este backup foi feito por uma versão mais nova do app. Atualize o app antes de restaurar.',
    );
  }
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(name))
      throw new Error(`Tabela desconhecida no backup: ${name}.`);
    if (
      !Array.isArray(rows) ||
      rows.some((r) => typeof r !== 'object' || r === null || typeof (r as Row).id !== 'string')
    ) {
      throw new Error('O backup está corrompido (linhas inválidas).');
    }
  }
  return b as Backup;
}

export function describeBackup(b: Backup): BackupInfo {
  const counts: Record<string, number> = {};
  for (const t of BACKUP_TABLES) counts[t] = b.tables[t]?.length ?? 0;
  const transactions = (b.tables.transactions ?? []).filter((r) => !r.deleted_at).length;
  return { createdAt: b.createdAt, schemaVersion: b.schemaVersion, counts, transactions };
}

/**
 * Substitui todos os dados pelos do backup, numa transação: ou entra tudo, ou nada muda.
 */
export function restoreBackup(db: AppDb, backup: Backup) {
  db.run(sql`BEGIN`);
  try {
    for (const t of [...BACKUP_TABLES].reverse()) {
      if (tableExists(db, t)) db.run(sql.raw(`DELETE FROM ${t}`));
    }
    for (const t of BACKUP_TABLES) {
      const rows = backup.tables[t];
      if (!rows?.length || !tableExists(db, t)) continue;
      const cols = new Set(columnsOf(db, t));
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => cols.has(k));
        const values = keys.map((k) => {
          const v = row[k];
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (v === undefined) return null;
          if (typeof v === 'object' && v !== null)
            throw new Error('O backup está corrompido (valor inválido).');
          return v as string | number | null;
        });
        db.run(
          sql`INSERT INTO ${sql.identifier(t)} (${sql.join(
            keys.map((k) => sql.identifier(k)),
            sql`, `,
          )}) VALUES (${sql.join(
            values.map((v) => sql`${v}`),
            sql`, `,
          )})`,
        );
      }
    }
    const broken = db.all(sql`PRAGMA foreign_key_check`);
    if (broken.length)
      throw new Error('O backup está incompleto (há referências quebradas). Nada foi alterado.');
    db.run(sql`COMMIT`);
  } catch (e) {
    db.run(sql`ROLLBACK`);
    throw e;
  }
}

export function backupFileName(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `financas-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}
