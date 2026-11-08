/**
 * Tabelas que sincronizam com a nuvem, na ordem "pais antes dos filhos"
 * (é a ordem de envio e de recebimento). app_meta e as tabelas do sync ficam só no aparelho.
 */
export const SYNC_TABLES = [
  'accounts',
  'categories',
  'credit_cards',
  'recurrences',
  'transactions',
  'budgets',
  'goals',
  'goal_entries',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

/**
 * Carimbo "do começo dos tempos" para registros que o próprio app cria sozinho
 * (contas/categorias padrão e ocorrências de recorrência ainda não tocadas).
 * Como o sync usa "a última edição vence", esses registros sempre perdem para
 * qualquer edição de verdade feita em outro aparelho.
 */
export const SYNC_EPOCH = '1970-01-01T00:00:00.000Z';

/** Cria/recria os gatilhos que põem na fila de envio toda gravação feita pelo app. */
export function outboxTriggersSql(table: SyncTable): string {
  const when = `WHEN (SELECT applying FROM sync_state WHERE id = 1) = 0`;
  // Atualiza no lugar (ver + 1) em vez de apagar e inserir: é a gravação mais barata possível,
  // e o envio só tira da fila a versão que leu.
  const body = `INSERT INTO sync_outbox (tbl, row_id) VALUES ('${table}', NEW.id)
    ON CONFLICT (tbl, row_id) DO UPDATE SET ver = ver + 1;`;
  return `
    DROP TRIGGER IF EXISTS sync_${table}_ins;
    DROP TRIGGER IF EXISTS sync_${table}_upd;
    CREATE TRIGGER sync_${table}_ins AFTER INSERT ON ${table} ${when} BEGIN ${body} END;
    CREATE TRIGGER sync_${table}_upd AFTER UPDATE ON ${table} ${when} BEGIN ${body} END;
  `;
}
