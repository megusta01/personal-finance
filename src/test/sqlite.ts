/// <reference types="node" />
/**
 * Banco SQLite para os testes, usando o SQLite que já vem no Node (node:sqlite).
 * Não precisa compilar nada (diferente do better-sqlite3), então `npm install`
 * funciona em qualquer sistema, inclusive Windows sem Visual Studio.
 *
 * Requer Node 22.13+ (ou 24+), onde node:sqlite está disponível.
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite/driver';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { AppDb } from '@/db/client';
import type { MigrationDb } from '@/db/migrations';
import { schema } from '@/db/schema';

export type RawDb = DatabaseSync;

export function openTestDb(): RawDb {
  return new DatabaseSync(':memory:');
}

const args = (p: unknown[] = []) => p as SQLInputValue[];

/** Interface assíncrona que as migrations usam (a mesma do expo-sqlite). */
export function migrationDb(raw: RawDb): MigrationDb {
  return {
    execAsync: async (s) => void raw.exec(s),
    runAsync: async (s, p) => raw.prepare(s).run(...args(p)),
    getAllAsync: async <T>(s: string, p: unknown[] = []) => raw.prepare(s).all(...args(p)) as T[],
    getFirstAsync: async <T>(s: string, p: unknown[] = []) =>
      (raw.prepare(s).get(...args(p)) as T | undefined) ?? null,
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

/**
 * Drizzle com o MESMO driver do app (expo-sqlite), apontado para um cliente falso
 * que implementa só as chamadas síncronas que o driver usa.
 */
export function testDrizzle(raw: RawDb): AppDb {
  const client = {
    prepareSync(sql: string) {
      const stmt = raw.prepare(sql);
      const returnsRows = stmt.columns().length > 0;
      return {
        executeSync(params: unknown[]) {
          if (!returnsRows) {
            const r = stmt.run(...args(params));
            return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
          }
          const rows = stmt.all(...args(params));
          return { getAllSync: () => rows, getFirstSync: () => rows[0] ?? null };
        },
        executeForRawResultSync(params: unknown[]) {
          stmt.setReturnArrays(true);
          try {
            const rows = stmt.all(...args(params));
            return { getAllSync: () => rows };
          } finally {
            stmt.setReturnArrays(false);
          }
        },
      };
    },
  };
  return drizzle(client as unknown as SQLiteDatabase, { schema });
}
