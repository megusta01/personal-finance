import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { schema } from './schema';

export const DATABASE_NAME = 'finance.db'; // mesmo arquivo da versão 1, para importar os dados antigos

export type AppDb = ExpoSQLiteDatabase<typeof schema>;

const DbContext = createContext<AppDb | null>(null);

/** Precisa ficar dentro do <SQLiteProvider>. */
export function DbProvider({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite]);
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): AppDb {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb precisa estar dentro de <DbProvider>');
  return db;
}

/**
 * Executa uma consulta e repete sempre que alguma das tabelas indicadas mudar.
 * (O useLiveQuery do Drizzle só observa a tabela principal; aqui somas e joins
 * também se atualizam sozinhos.)
 */
export function useDbQuery<T>(
  query: (db: AppDb) => T,
  tables: string[],
  deps: unknown[] = [],
): { data: T | undefined; error: Error | undefined } {
  const db = useDb();
  const [state, setState] = useState<{ data: T | undefined; error: Error | undefined }>(() => {
    try {
      return { data: query(db), error: undefined };
    } catch (e) {
      console.error('[useDbQuery]', e);
      return { data: undefined, error: e as Error };
    }
  });
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  });
  const tablesKey = tables.join(',');

  useEffect(() => {
    const run = () => {
      try {
        setState({ data: queryRef.current(db), error: undefined });
      } catch (e) {
        console.error('[useDbQuery]', e);
        setState((s) => ({ data: s.data, error: e as Error }));
      }
    };
    run();
    const watched = new Set(tablesKey.split(','));
    const sub = addDatabaseChangeListener(({ tableName }) => {
      if (watched.has(tableName)) run();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, tablesKey, ...deps]);

  return state;
}
