/**
 * No navegador usamos o localStorage: abrir o kv-store do expo-sqlite ao mesmo tempo
 * que o banco principal dispara uma condição de corrida no worker wasm ("Invalid VFS state").
 */
export const kv = {
  get: (key: string): string | null => globalThis.localStorage?.getItem(key) ?? null,
  set: (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
};
