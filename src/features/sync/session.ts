import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { supabase } from './client';

/** Login atual (undefined enquanto o Supabase lê a sessão guardada). */
let current: Session | null | undefined = supabase ? undefined : null;
const listeners = new Set<() => void>();

function set(s: Session | null) {
  current = s;
  listeners.forEach((l) => l());
}

if (supabase) {
  supabase.auth
    .getSession()
    .then(({ data }) => set(data.session))
    .catch(() => set(null));
  supabase.auth.onAuthStateChange((_event, s) => set(s));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useSession(): { session: Session | null; loading: boolean } {
  const s = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
  return { session: s ?? null, loading: s === undefined };
}

export function currentSession(): Session | null {
  return current ?? null;
}
