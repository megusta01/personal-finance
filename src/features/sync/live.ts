import { sql } from 'drizzle-orm';
import type { AppDb } from '@/db/client';
import { SYNC_TABLES, type SyncTable } from '@/db/sync-tables';

/**
 * Atualização ao vivo: a nuvem avisa na hora quando uma linha da pessoa muda
 * (Supabase Realtime, "postgres_changes"). O aviso não é aplicado direto: ele só dispara
 * um recebimento normal (mesmo cursor, mesma regra de "a última edição vence").
 * Avisos de mudanças que este aparelho já tem (inclusive as que ele mesmo enviou) são ignorados.
 */

export type LiveStatus = 'off' | 'connecting' | 'live' | 'error';

export type LiveEvent = { table: string; id?: unknown; updatedAt?: unknown };

/** Liga a escuta para uma conta; devolve a função que desliga. */
export type LiveSource = (
  userId: string,
  onEvent: (e: LiveEvent) => void,
  onStatus: (s: LiveStatus, detail?: string) => void,
) => () => void;

const KNOWN = new Set<string>(SYNC_TABLES);

/** O aviso traz algo que este aparelho ainda não tem? */
export function isNewerThanLocal(db: AppDb, e: LiveEvent): boolean {
  if (!KNOWN.has(e.table)) return false;
  if (typeof e.id !== 'string' || typeof e.updatedAt !== 'string') return true; // na dúvida, busca
  const local = db.get<{ updated_at: string }>(
    sql`SELECT updated_at FROM ${sql.identifier(e.table as SyncTable)} WHERE id = ${e.id}`,
  );
  return !local || local.updated_at < e.updatedAt;
}

/**
 * Começa a escutar. onPull é chamado (com uma pequena espera para juntar avisos em sequência)
 * quando chega algo novo, e também sempre que a conexão fica pronta, para pegar o que
 * mudou enquanto ela estava caída.
 */
export function startLive(
  db: AppDb,
  userId: string,
  source: LiveSource,
  onPull: () => void,
  onStatus: (s: LiveStatus, detail?: string) => void,
  debounceMs = 300,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const stop = source(
    userId,
    (e) => {
      if (stopped || !isNewerThanLocal(db, e)) return;
      clearTimeout(timer);
      timer = setTimeout(onPull, debounceMs);
    },
    (s, detail) => {
      if (stopped) return;
      onStatus(s, detail);
      if (s === 'live') onPull();
    },
  );
  return () => {
    stopped = true;
    clearTimeout(timer);
    stop();
    onStatus('off');
  };
}
