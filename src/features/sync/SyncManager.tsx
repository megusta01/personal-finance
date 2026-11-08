import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDb } from '@/db/client';
import { SYNC_TABLES } from '@/db/sync-tables';
import { pendingCount } from './engine';
import { requestSync } from './service';
import { useSession } from './session';

const WATCHED = new Set<string>(SYNC_TABLES);
const EVERY_MS = 5 * 60 * 1000;
const AFTER_CHANGE_MS = 3000;

/**
 * Sincroniza sozinho enquanto houver login: ao entrar, ao voltar para o app,
 * a cada 5 minutos e alguns segundos depois de cada alteração.
 */
export function SyncManager() {
  const db = useDb();
  const { session } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    void requestSync(db, 'start');
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void requestSync(db, 'resume');
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void requestSync(db, 'timer');
    }, EVERY_MS);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const changes = addDatabaseChangeListener(({ tableName }) => {
      if (!WATCHED.has(tableName)) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (pendingCount(db) > 0) void requestSync(db, 'change');
      }, AFTER_CHANGE_MS);
    });
    return () => {
      app.remove();
      clearInterval(timer);
      clearTimeout(debounce);
      changes.remove();
    };
  }, [db, userId]);

  return null;
}
