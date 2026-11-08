import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDb } from '@/db/client';
import { generateAll } from '@/features/recurrences/repository';

/** Na web: só cria as ocorrências das recorrências (não há lembretes). */
export function BackgroundJobs() {
  const db = useDb();
  useEffect(() => {
    const refresh = () => {
      try {
        generateAll(db);
      } catch (e) {
        console.warn('[recorrências]', e);
      }
    };
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [db]);
  return null;
}
