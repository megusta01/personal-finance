import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** "versão 3.0.0" ou "versão 3.0.0 · atualizada em 09/11/2026 14:32" (quando veio do EAS Update). */
export function versionLabel(): string {
  const base = `versão ${Constants.expoConfig?.version ?? '?'}`;
  if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.createdAt) return base;
  return `${base} · atualizada em ${format(Updates.createdAt, "dd/MM/yyyy HH'h'mm", { locale: ptBR })}`;
}
