import { sql } from 'drizzle-orm';
import type { AppDb } from '@/db/client';

/** Metadados locais do app (tabela app_meta; não sincroniza). */
export function getMeta(db: AppDb, key: string): string | null {
  const row = db.get<{ value: string }>(sql`SELECT value FROM app_meta WHERE key = ${key}`);
  return row?.value ?? null;
}
