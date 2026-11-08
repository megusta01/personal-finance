import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { migrate } from '@/db/migrations';
import { migrationDb, openTestDb, testDrizzle } from '@/test/sqlite';
import { buildRemoteSchemaSql, type LocalColumn } from './remoteSchema';

describe('SQL da nuvem', () => {
  it('supabase/schema.sql está em dia com as tabelas do app (atualize com npm run supabase:sql)', async () => {
    const raw = openTestDb();
    await migrate(migrationDb(raw));
    const db = testDrizzle(raw);
    const text = buildRemoteSchemaSql((t) =>
      db.all<LocalColumn>(sql.raw(`PRAGMA table_info(${t})`)),
    );
    await expect(text).toMatchFileSnapshot('../../../supabase/schema.sql');
  });
});
