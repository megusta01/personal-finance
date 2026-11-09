import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useDb } from '@/db/client';
import { SYNC_TABLES } from '@/db/sync-tables';
import { supabase } from './client';
import { pendingCount } from './engine';
import { startLive } from './live';
import { supabaseLiveSource } from './liveSupabase';
import { requestSync, setLiveStatus } from './service';
import { useSession } from './session';

const WATCHED = new Set<string>(SYNC_TABLES);
const EVERY_MS = 5 * 60 * 1000;
// Curto para o outro aparelho ver a mudança quase na hora (a atualização ao vivo avisa ele).
const AFTER_CHANGE_MS = 1200;

/**
 * Sincroniza sozinho enquanto houver login: ao entrar, ao voltar para o app,
 * a cada 5 minutos, logo depois de cada alteração e, com a atualização ao vivo,
 * assim que outro aparelho muda alguma coisa.
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

  // Atualização ao vivo: conectada só com o app em primeiro plano (no celular, a conexão
  // em segundo plano gastaria bateria e o sistema a derruba de qualquer jeito).
  useEffect(() => {
    if (!userId || !supabase) return;
    const source = supabaseLiveSource(supabase);
    let stop: (() => void) | null = null;
    const connect = () => {
      stop ??= startLive(db, userId, source, () => void requestSync(db, 'live'), setLiveStatus);
    };
    const disconnect = () => {
      stop?.();
      stop = null;
    };
    if (Platform.OS === 'web' || AppState.currentState === 'active') connect();
    const app = AppState.addEventListener('change', (s) => {
      if (Platform.OS === 'web') return;
      if (s === 'active') connect();
      else if (s === 'background') disconnect();
    });
    return () => {
      app.remove();
      disconnect();
    };
  }, [db, userId]);

  return null;
}
