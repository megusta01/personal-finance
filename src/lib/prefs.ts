import { kv } from './kv';
import { useSyncExternalStore } from 'react';

/**
 * Preferências do aparelho (não sincronizam): tema e "ocultar valores".
 * Guardadas num armazenamento chave-valor síncrono (ver kv.ts) — assim o tema
 * certo já aparece no primeiro quadro, sem piscar.
 */

export type ThemePref = 'system' | 'light' | 'dark';

type Prefs = {
  theme: ThemePref;
  hideValues: boolean;
  /** Lembretes de vencimento (desligados até a pessoa ligar e permitir notificações). */
  remindersEnabled: boolean;
  reminderHour: number;
  /** Avisar também N dias antes (0 = só no dia). */
  reminderDaysBefore: number;
};

const KEYS = {
  theme: 'pref.theme',
  hideValues: 'pref.hideValues',
  remindersEnabled: 'pref.reminders',
  reminderHour: 'pref.reminderHour',
  reminderDaysBefore: 'pref.reminderDaysBefore',
} as const;

function readInt(key: string, fallback: number, min: number, max: number) {
  const n = Number(kv.get(key));
  return Number.isInteger(n) && n >= min && n <= max && kv.get(key) !== null ? n : fallback;
}

function read(): Prefs {
  const prefs: Prefs = {
    theme: 'system',
    hideValues: false,
    remindersEnabled: false,
    reminderHour: 9,
    reminderDaysBefore: 1,
  };
  try {
    const t = kv.get(KEYS.theme);
    if (t === 'light' || t === 'dark' || t === 'system') prefs.theme = t;
    prefs.hideValues = kv.get(KEYS.hideValues) === '1';
    prefs.remindersEnabled = kv.get(KEYS.remindersEnabled) === '1';
    prefs.reminderHour = readInt(KEYS.reminderHour, 9, 0, 23);
    prefs.reminderDaysBefore = readInt(KEYS.reminderDaysBefore, 1, 0, 7);
  } catch {
    // sem armazenamento disponível: usa o padrão
  }
  return prefs;
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

export function setReminderPrefs(
  p: Partial<Pick<Prefs, 'remindersEnabled' | 'reminderHour' | 'reminderDaysBefore'>>,
) {
  current = { ...current, ...p };
  try {
    if (p.remindersEnabled !== undefined)
      kv.set(KEYS.remindersEnabled, p.remindersEnabled ? '1' : '0');
    if (p.reminderHour !== undefined) kv.set(KEYS.reminderHour, String(p.reminderHour));
    if (p.reminderDaysBefore !== undefined)
      kv.set(KEYS.reminderDaysBefore, String(p.reminderDaysBefore));
  } catch {}
  emit();
}

/** Leitura fora de componentes (ex.: ao agendar lembretes). */
export function getPrefs(): Prefs {
  return current;
}

export function subscribePrefs(l: () => void) {
  return subscribe(l);
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
