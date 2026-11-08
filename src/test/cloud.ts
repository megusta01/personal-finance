/// <reference types="node" />
/**
 * "Nuvem" para os testes: um Postgres de verdade em memória (pglite) com o mesmo
 * supabase/schema.sql que vai para o Supabase, mais um esboço do schema auth
 * (auth.users e auth.uid()) e do papel `authenticated`, para o RLS valer de verdade.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { SyncTable } from '@/db/sync-tables';
import type { Cursor, RemoteRow, RemoteStore } from '@/features/sync/types';

export const SCHEMA_SQL_PATH = join(process.cwd(), 'supabase/schema.sql');

const AUTH_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  grant usage on schema public, auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated;
`;

export type Cloud = { pg: PGlite; addUser(id: string): Promise<void> };

export async function openCloud(schemaSql = readFileSync(SCHEMA_SQL_PATH, 'utf8')): Promise<Cloud> {
  const pg = new PGlite();
  await pg.exec(AUTH_STUB);
  await pg.exec(schemaSql);
  return {
    pg,
    addUser: async (id) => void (await pg.query('insert into auth.users (id) values ($1)', [id])),
  };
}

/** Roda como a pessoa logada (papel authenticated + id no "JWT"), como faria o PostgREST. */
export async function asUser<T>(pg: PGlite, userId: string, fn: (tx: Transaction) => Promise<T>) {
  return pg.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    return fn(tx);
  });
}

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

const normalize = (row: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'bigint' ? Number(v) : v;
  return out as RemoteRow;
};

/** Mesmo contrato do supabaseRemote, falando direto com o Postgres. */
export function cloudRemote(
  cloud: Cloud,
  userId: string,
  hooks: { beforeUpsert?: (table: SyncTable) => void } = {},
): RemoteStore & { calls: { upsert: number; pull: number } } {
  const calls = { upsert: 0, pull: 0 };
  return {
    calls,
    async upsert(table, rows) {
      calls.upsert++;
      hooks.beforeUpsert?.(table);
      await asUser(cloud.pg, userId, async (tx) => {
        for (const row of rows) {
          const keys = Object.keys(row);
          const cols = ['user_id', ...keys];
          const values = [userId, ...keys.map((k) => row[k])];
          const set = keys
            .filter((k) => k !== 'id')
            .map((k) => `${q(k)} = excluded.${q(k)}`)
            .join(', ');
          await tx.query(
            `insert into public.${table} (${cols.map(q).join(', ')})
             values (${values.map((_, i) => `$${i + 1}`).join(', ')})
             on conflict (user_id, id) do update set ${set}`,
            values,
          );
        }
      });
    },
    async markDeleted(table, ids, at) {
      await asUser(cloud.pg, userId, (tx) =>
        tx.query(`update public.${table} set deleted_at = $1, updated_at = $1 where id = any($2)`, [
          at,
          ids,
        ]),
      );
    },
    async pullPage(table, after: Cursor, limit) {
      calls.pull++;
      return asUser(cloud.pg, userId, async (tx) => {
        const res = await tx.query<Record<string, unknown>>(
          `select t.*, to_json(t.server_updated_at) #>> '{}' as server_updated_at
             from public.${table} t
            where (t.server_updated_at, t.id) > ($1::timestamptz, $2)
            order by t.server_updated_at, t.id
            limit $3`,
          [after.at, after.id, limit],
        );
        return res.rows.map(normalize);
      });
    },
  };
}
