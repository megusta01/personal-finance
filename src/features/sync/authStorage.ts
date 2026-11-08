import Storage from 'expo-sqlite/kv-store';

/** Onde o login fica guardado no celular (kv-store do expo-sqlite, assíncrono). */
export const authStorage = {
  getItem: (key: string) => Storage.getItem(key),
  setItem: (key: string, value: string) => Storage.setItem(key, value),
  removeItem: (key: string) => Storage.removeItem(key),
};
