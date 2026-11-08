import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncTable } from '@/db/sync-tables';
import type { Cursor, RemoteRow, RemoteStore } from './types';

const UPSERT_CHUNK = 250;
const ID_CHUNK = 100;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Valor entre aspas para os filtros do PostgREST (datas têm ":" e "+"). */
const quoted = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export class RemoteError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function check(res: { error: { message: string; code?: string } | null; status: number }) {
  if (res.error) throw new RemoteError(res.error.message, res.error.code, res.status);
}

export function supabaseRemote(client: SupabaseClient, userId: string): RemoteStore {
  return {
    async upsert(table: SyncTable, rows) {
      for (const part of chunks(rows, UPSERT_CHUNK)) {
        check(
          await client.from(table).upsert(
            part.map((r) => ({ ...r, user_id: userId })),
            { onConflict: 'user_id,id' },
          ),
        );
      }
    },
    async markDeleted(table, ids, at) {
      for (const part of chunks(ids, ID_CHUNK)) {
        check(
          await client
            .from(table)
            .update({ deleted_at: at, updated_at: at })
            .eq('user_id', userId)
            .in('id', part),
        );
      }
    },
    async pullPage(table, after: Cursor, limit) {
      const res = await client
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .or(
          `server_updated_at.gt.${quoted(after.at)},and(server_updated_at.eq.${quoted(after.at)},id.gt.${quoted(after.id)})`,
        )
        .order('server_updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);
      check(res);
      return (res.data ?? []) as RemoteRow[];
    },
  };
}
