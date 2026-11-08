import { sql, type SQL } from 'drizzle-orm';
import type { AppDb } from '@/db/client';
import { SYNC_TABLES, type SyncTable } from '@/db/sync-tables';
import { deleteMetaPrefix, getMeta, setMetaValue } from '@/features/catalog/meta';
import { nowTimestamp } from '@/lib/dates';
import type { Cursor, RemoteRow, RemoteStore } from './types';

/**
 * Sincronização "local primeiro":
 *
 *  1. Toda gravação do app entra na fila sync_outbox (gatilhos da migration 6).
 *  2. Enviar: lê a fila em lotes (pais antes dos filhos), manda as linhas para a nuvem e
 *     tira da fila só o que foi lido. Linha que sumiu do aparelho vira "excluída" na nuvem.
 *  3. Receber: baixa o que mudou na nuvem desde o último cursor de cada tabela e aplica tudo
 *     numa transação só, sem disparar a fila (sync_state.applying = 1).
 *
 * Conflitos: a última edição vence (updated_at). A nuvem ignora gravações mais antigas que
 * a dela; o aparelho ignora linhas que chegam mais antigas que a sua.
 */

export const PUSH_BATCH = 500;
export const PULL_PAGE = 1000;
/** Volta um pouco no cursor a cada recebimento: cobre gravações que terminaram fora de ordem. */
export const PULL_OVERLAP_MS = 2 * 60 * 1000;

const META_USER = 'sync.user_id';
const META_LAST = 'sync.last_at';
const cursorKey = (t: SyncTable) => `sync.cursor.${t}`;

/** Colunas que existem só na nuvem. */
const REMOTE_ONLY = new Set(['user_id', 'server_updated_at']);

type OutboxEntry = { tbl: SyncTable; row_id: string; ver: number };
type Row = Record<string, unknown>;

export type SyncResult = { pushed: number; pulled: number; linked: boolean };

const list = (values: (string | number)[]): SQL =>
  sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );

const tableOrder = sql.raw(
  `CASE tbl ${SYNC_TABLES.map((t, i) => `WHEN '${t}' THEN ${i}`).join(' ')} ELSE 99 END`,
);

function localColumns(db: AppDb, table: SyncTable): Set<string> {
  return new Set(
    db.all<{ name: string }>(sql.raw(`PRAGMA table_info(${table})`)).map((c) => c.name),
  );
}

export function pendingCount(db: AppDb): number {
  return db.get<{ n: number }>(sql`SELECT count(*) AS n FROM sync_outbox`)?.n ?? 0;
}

export function lastSyncAt(db: AppDb): string | null {
  return getMeta(db, META_LAST);
}

export function linkedUser(db: AppDb): string | null {
  return getMeta(db, META_USER);
}

/**
 * Primeira sincronização deste aparelho com esta conta: tudo o que já existe aqui
 * entra na fila (os dados do aparelho se juntam aos da conta) e os cursores zeram
 * (baixa tudo o que já está na nuvem).
 */
export function linkToUser(db: AppDb, userId: string): boolean {
  if (getMeta(db, META_USER) === userId) return false;
  db.run(sql`BEGIN`);
  try {
    deleteMetaPrefix(db, 'sync.');
    for (const t of SYNC_TABLES) {
      db.run(
        sql`INSERT OR IGNORE INTO sync_outbox (tbl, row_id) SELECT ${t}, id FROM ${sql.identifier(t)}`,
      );
    }
    setMetaValue(db, META_USER, userId);
    db.run(sql`COMMIT`);
  } catch (e) {
    db.run(sql`ROLLBACK`);
    throw e;
  }
  return true;
}

export async function push(db: AppDb, remote: RemoteStore): Promise<number> {
  let pushed = 0;
  // Limite de segurança: no pior caso, 200 lotes de 500 por rodada; o resto vai na próxima.
  for (let round = 0; round < 200; round++) {
    const batch = db.all<OutboxEntry>(
      sql`SELECT tbl, row_id, ver FROM sync_outbox ORDER BY ${tableOrder}, row_id LIMIT ${PUSH_BATCH}`,
    );
    if (!batch.length) break;

    for (const table of SYNC_TABLES) {
      const ids = batch.filter((e) => e.tbl === table).map((e) => e.row_id);
      if (!ids.length) continue;
      const rows = db.all<Row>(
        sql`SELECT * FROM ${sql.identifier(table)} WHERE id IN (${list(ids)})`,
      );
      if (rows.length) await remote.upsert(table, rows);
      const found = new Set(rows.map((r) => r.id as string));
      const gone = ids.filter((id) => !found.has(id));
      if (gone.length) await remote.markDeleted(table, gone, nowTimestamp());
      pushed += ids.length;
    }
    // Só sai da fila a versão que foi lida: se a linha mudou durante o envio, o ver subiu.
    db.run(
      sql`DELETE FROM sync_outbox WHERE (tbl, row_id, ver) IN (VALUES ${sql.join(
        batch.map((e) => sql`(${e.tbl}, ${e.row_id}, ${e.ver})`),
        sql`, `,
      )})`,
    );
  }
  return pushed;
}

function startCursor(db: AppDb, table: SyncTable): Cursor {
  const saved = getMeta(db, cursorKey(table));
  if (!saved) return { at: '1970-01-01T00:00:00.000Z', id: '' };
  const t = Date.parse(saved);
  return { at: new Date((Number.isNaN(t) ? 0 : t) - PULL_OVERLAP_MS).toISOString(), id: '' };
}

/** Baixa tudo o que mudou na nuvem (todas as tabelas) antes de mexer no banco. */
async function fetchChanges(db: AppDb, remote: RemoteStore) {
  const changes: { table: SyncTable; rows: RemoteRow[]; last?: string }[] = [];
  for (const table of SYNC_TABLES) {
    let cursor = startCursor(db, table);
    const rows: RemoteRow[] = [];
    for (;;) {
      const page = await remote.pullPage(table, cursor, PULL_PAGE);
      rows.push(...page);
      const tail = page[page.length - 1];
      if (!tail || page.length < PULL_PAGE) break;
      cursor = { at: tail.server_updated_at, id: tail.id };
    }
    changes.push({ table, rows, last: rows[rows.length - 1]?.server_updated_at });
  }
  return changes;
}

function toLocal(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return JSON.stringify(v);
}

/** Aplica as linhas recebidas. Devolve quantas mudaram algo no aparelho. */
function applyChanges(db: AppDb, changes: Awaited<ReturnType<typeof fetchChanges>>): number {
  let applied = 0;
  // As chaves estrangeiras ficam desligadas só durante a aplicação: um filho pode chegar
  // antes do pai (o pai vem na próxima rodada). PRAGMA foreign_keys não muda dentro de transação.
  db.run(sql`PRAGMA foreign_keys = OFF`);
  try {
    db.run(sql`BEGIN`);
    try {
      db.run(sql`UPDATE sync_state SET applying = 1 WHERE id = 1`);
      for (const { table, rows, last } of changes) {
        const cols = localColumns(db, table);
        for (const row of rows) {
          const local = db.get<{ updated_at: string }>(
            sql`SELECT updated_at FROM ${sql.identifier(table)} WHERE id = ${row.id}`,
          );
          if (local && local.updated_at >= row.updated_at) continue;
          const keys = Object.keys(row).filter((k) => cols.has(k) && !REMOTE_ONLY.has(k));
          const ident = keys.map((k) => sql.identifier(k));
          db.run(
            sql`INSERT INTO ${sql.identifier(table)} (${sql.join(ident, sql`, `)})
                VALUES (${list(keys.map((k) => toLocal(row[k])) as (string | number)[])})
                ON CONFLICT(id) DO UPDATE SET ${sql.join(
                  keys
                    .filter((k) => k !== 'id')
                    .map((k) => sql`${sql.identifier(k)} = excluded.${sql.identifier(k)}`),
                  sql`, `,
                )}`,
          );
          // A versão da nuvem venceu: a local (mais antiga) não precisa mais subir.
          db.run(sql`DELETE FROM sync_outbox WHERE tbl = ${table} AND row_id = ${row.id}`);
          applied++;
        }
        if (last) setMetaValue(db, cursorKey(table), last);
      }
      db.run(sql`UPDATE sync_state SET applying = 0 WHERE id = 1`);
      db.run(sql`COMMIT`);
    } catch (e) {
      db.run(sql`ROLLBACK`);
      throw e;
    }
  } finally {
    db.run(sql`PRAGMA foreign_keys = ON`);
  }
  return applied;
}

export async function pull(db: AppDb, remote: RemoteStore): Promise<number> {
  return applyChanges(db, await fetchChanges(db, remote));
}

/** Uma rodada completa: liga o aparelho à conta (se preciso), envia e recebe. */
export async function syncOnce(
  db: AppDb,
  remote: RemoteStore,
  userId: string,
): Promise<SyncResult> {
  const linked = linkToUser(db, userId);
  const pushed = await push(db, remote);
  const pulled = await pull(db, remote);
  setMetaValue(db, META_LAST, nowTimestamp());
  return { pushed, pulled, linked };
}
