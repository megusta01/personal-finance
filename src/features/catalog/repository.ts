import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { AppDb } from '@/db/client';
import { accounts, categories, type CategoryKind } from '@/db/schema';

export function listCategories(db: AppDb, kind: CategoryKind) {
  return db
    .select()
    .from(categories)
    .where(
      and(eq(categories.kind, kind), isNull(categories.deletedAt), isNull(categories.archivedAt)),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
}

export function listAccounts(db: AppDb) {
  return db
    .select()
    .from(accounts)
    .where(and(isNull(accounts.deletedAt), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.name))
    .all();
}

export function getMeta(db: AppDb, key: string): string | null {
  const row = db.get<{ value: string }>(sql`SELECT value FROM app_meta WHERE key = ${key}`);
  return row?.value ?? null;
}
