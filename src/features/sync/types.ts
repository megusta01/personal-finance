import type { SyncTable } from '@/db/sync-tables';

export type RemoteRow = Record<string, unknown> & {
  id: string;
  updated_at: string;
  server_updated_at: string;
};

/** Posição no "histórico de mudanças" de uma tabela na nuvem. */
export type Cursor = { at: string; id: string };

/**
 * O que o sync precisa da nuvem. A implementação de verdade usa o Supabase
 * (supabaseRemote.ts); os testes usam um Postgres de verdade rodando em memória (pglite).
 */
export interface RemoteStore {
  /** Grava (cria ou atualiza) linhas da pessoa logada. A nuvem ignora versões mais antigas. */
  upsert(table: SyncTable, rows: Record<string, unknown>[]): Promise<void>;
  /** Marca como excluídas linhas que não existem mais no aparelho. */
  markDeleted(table: SyncTable, ids: string[], at: string): Promise<void>;
  /** Próximas linhas alteradas depois do cursor, em ordem (server_updated_at, id). */
  pullPage(table: SyncTable, after: Cursor, limit: number): Promise<RemoteRow[]>;
}
