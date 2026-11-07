import Storage from 'expo-sqlite/kv-store';

/** Armazenamento chave-valor síncrono (Android/iOS): kv-store do expo-sqlite. */
export const kv = {
  get: (key: string): string | null => Storage.getItemSync(key),
  set: (key: string, value: string) => Storage.setItemSync(key, value),
};
