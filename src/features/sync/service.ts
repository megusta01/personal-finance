import { useSyncExternalStore } from 'react';
import type { AppDb } from '@/db/client';
import { generateAll } from '@/features/recurrences/repository';
import { supabase } from './client';
import { linkedUser, syncOnce, type SyncResult } from './engine';
import { currentSession } from './session';
import { RemoteError, supabaseRemote } from './supabaseRemote';

export type SyncErrorKind =
  'offline' | 'unavailable' | 'setup' | 'auth' | 'other-account' | 'unknown';

export type SyncStatus = {
  running: boolean;
  error: { kind: SyncErrorKind; message: string; at: number } | null;
  last: SyncResult | null;
};

let status: SyncStatus = { running: false, error: null, last: null };
const listeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => status,
    () => status,
  );
}

class OtherAccountError extends Error {}

/** Traduz o erro para algo que a pessoa entenda e saiba o que fazer. */
export function describeSyncError(e: unknown): { kind: SyncErrorKind; message: string } {
  if (e instanceof OtherAccountError)
    return {
      kind: 'other-account',
      message:
        'Os dados deste aparelho são de outra conta. Para usar esta conta aqui, apague os dados do aparelho (eles continuam na outra conta, na nuvem).',
    };
  const msg = e instanceof Error ? e.message : String(e);
  if (e instanceof RemoteError) {
    if (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42703' || e.code === 'PGRST204')
      return {
        kind: 'setup',
        message:
          'As tabelas da nuvem não estão criadas ou estão desatualizadas. Rode o arquivo supabase/schema.sql no SQL Editor do Supabase (veja o README).',
      };
    if (e.status === 401 || e.code === 'PGRST301' || e.code === 'PGRST303' || /JWT/i.test(msg))
      return { kind: 'auth', message: 'Sua sessão expirou. Entre de novo na sua conta.' };
    // A nuvem está acordando, reiniciando ou recarregando a estrutura do banco (PGRST002, 5xx).
    if (e.code === 'PGRST002' || (e.status !== undefined && e.status >= 500))
      return {
        kind: 'unavailable',
        message:
          'A nuvem está iniciando ou ocupada no momento. Tentamos de novo sozinhos em instantes.',
      };
    if (e.code === '42501')
      return {
        kind: 'setup',
        message:
          'A nuvem recusou a gravação (permissões). Rode de novo o supabase/schema.sql e tente outra vez.',
      };
  }
  if (/network|fetch|timeout|abort|offline|internet/i.test(msg) || e instanceof TypeError)
    return { kind: 'offline', message: 'Sem conexão. Tentamos de novo quando a internet voltar.' };
  return { kind: 'unknown', message: `Não foi possível sincronizar: ${msg}` };
}

let inflight: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 15_000;

/** Falha passageira: tenta de novo com espera crescente (15 s, 30 s, 1 min… até 5 min). */
function scheduleRetry(db: AppDb) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void requestSync(db, 'timer');
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 5 * 60_000);
}
let again = false;

/**
 * Pede uma sincronização. Se já houver uma rodando, marca para rodar de novo no fim
 * (assim nada que mudou durante a rodada fica para trás). Nunca lança erro: o erro vai
 * para o status, que a tela de sincronização mostra.
 *
 * reason 'change' (gravação local) é ignorado por 1 minuto depois de uma falha de rede,
 * para não ficar tentando a cada toque sem internet.
 */
export function requestSync(
  db: AppDb,
  reason: 'manual' | 'start' | 'resume' | 'timer' | 'change' = 'manual',
): Promise<void> {
  const session = currentSession();
  if (!supabase || !session) return Promise.resolve();
  if (
    reason === 'change' &&
    (status.error?.kind === 'offline' || status.error?.kind === 'unavailable') &&
    Date.now() - status.error.at < 60_000
  )
    return Promise.resolve();
  if (status.error?.kind === 'other-account' && reason !== 'manual') return Promise.resolve();
  if (inflight) {
    again = true;
    return inflight;
  }
  const client = supabase;
  inflight = (async () => {
    do {
      again = false;
      setStatus({ running: true });
      try {
        const userId = currentSession()?.user.id;
        if (!userId) break;
        const linked = linkedUser(db);
        if (linked && linked !== userId) throw new OtherAccountError();
        const result = await syncOnce(db, supabaseRemote(client, userId), userId);
        // Recorrências que chegaram de outro aparelho: cria as ocorrências daqui.
        if (result.pulled) {
          try {
            generateAll(db);
          } catch (e) {
            console.warn('[sync] generateAll', e);
          }
        }
        setStatus({ error: null, last: result });
        retryDelay = 15_000;
      } catch (e) {
        const d = describeSyncError(e);
        if (d.kind === 'unknown') console.warn('[sync]', e);
        setStatus({ error: { ...d, at: Date.now() } });
        if (d.kind === 'unavailable' || d.kind === 'offline') scheduleRetry(db);
        break;
      }
    } while (again);
  })().finally(() => {
    inflight = null;
    setStatus({ running: false });
  });
  return inflight;
}

/** Espera a sincronização em andamento terminar (antes de sair da conta, por exemplo). */
export async function waitForSync() {
  while (inflight) await inflight;
}

export function resetSyncStatus() {
  setStatus({ running: false, error: null, last: null });
}
