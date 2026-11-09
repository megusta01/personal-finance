import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { SYNC_TABLES } from '@/db/sync-tables';
import type { LiveSource } from './live';

/** Escuta, num canal só, as mudanças das tabelas do app que pertencem à pessoa logada. */
export function supabaseLiveSource(client: SupabaseClient): LiveSource {
  return (userId, onEvent, onStatus) => {
    onStatus('connecting');
    let channel = client.channel(`financas-sync-${userId}`, {
      config: { postgres_changes_options: { wait: true } },
    });
    for (const table of SYNC_TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = (payload.new ?? {}) as Record<string, unknown>;
          onEvent({ table: payload.table, id: row.id, updatedAt: row.updated_at });
        },
      );
    }
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') onStatus('live');
      else if (status === 'CLOSED') onStatus('off');
      else onStatus('error', err?.message ?? status);
    });
    return () => {
      void client.removeChannel(channel);
    };
  };
}
