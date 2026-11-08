import { insertDefaults, type MigrationDb } from '@/db/migrations';
import { SYNC_TABLES } from '@/db/sync-tables';

/**
 * Ao sair da conta: apaga os dados deste aparelho e volta ao estado de app novo
 * (conta e categorias padrão). Os dados continuam na nuvem e voltam ao entrar de novo.
 */
export async function wipeLocalData(db: MigrationDb) {
  await db.withTransactionAsync(async () => {
    await db.execAsync('UPDATE sync_state SET applying = 1 WHERE id = 1');
    for (const t of [...SYNC_TABLES].reverse()) await db.execAsync(`DELETE FROM ${t}`);
    await db.execAsync(`DELETE FROM sync_outbox; DELETE FROM app_meta WHERE key LIKE 'sync.%';`);
    await insertDefaults(db);
    await db.execAsync('UPDATE sync_state SET applying = 0 WHERE id = 1');
  });
}
