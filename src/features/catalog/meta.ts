import { sql } from 'drizzle-orm';
import type { AppDb } from '@/db/client';

/** Metadados locais do app (tabela app_meta; não sincroniza). */
export function getMeta(db: AppDb, key: string): string | null {
  const row = db.get<{ value: string }>(sql`SELECT value FROM app_meta WHERE key = ${key}`);
  return row?.value ?? null;
}

export function setMetaValue(db: AppDb, key: string, value: string) {
  db.run(
    sql`INSERT INTO app_meta (key, value) VALUES (${key}, ${value})
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}

/** Apaga as chaves que começam com o prefixo (ex.: 'sync.'). */
export function deleteMetaPrefix(db: AppDb, prefix: string) {
  db.run(sql`DELETE FROM app_meta WHERE substr(key, 1, ${prefix.length}) = ${prefix}`);
}
