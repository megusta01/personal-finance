import { kv } from './kv';
import { useSyncExternalStore } from 'react';

/**
 * Preferências do aparelho (não sincronizam): tema e "ocultar valores".
 * Guardadas num armazenamento chave-valor síncrono (ver kv.ts) — assim o tema
 * certo já aparece no primeiro quadro, sem piscar.
 */

export type ThemePref = 'system' | 'light' | 'dark';

type Prefs = { theme: ThemePref; hideValues: boolean };

const KEYS = { theme: 'pref.theme', hideValues: 'pref.hideValues' } as const;

function read(): Prefs {
  let theme: ThemePref = 'system';
  let hideValues = false;
  try {
    const t = kv.get(KEYS.theme);
    if (t === 'light' || t === 'dark' || t === 'system') theme = t;
    hideValues = kv.get(KEYS.hideValues) === '1';
  } catch {
    // sem armazenamento disponível: usa o padrão
  }
  return { theme, hideValues };
}

let current = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setThemePref(theme: ThemePref) {
  current = { ...current, theme };
  try {
    kv.set(KEYS.theme, theme);
  } catch {}
  emit();
}

export function setHideValues(hideValues: boolean) {
  current = { ...current, hideValues };
  try {
    kv.set(KEYS.hideValues, hideValues ? '1' : '0');
  } catch {}
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

/** Última conta usada num lançamento: vira o padrão do próximo. */
const LAST_ACCOUNT_KEY = 'pref.lastAccountId';

export function getLastAccountId(): string | null {
  try {
    return kv.get(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function setLastAccountId(id: string) {
  try {
    kv.set(LAST_ACCOUNT_KEY, id);
  } catch {}
}
