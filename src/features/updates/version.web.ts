import Constants from 'expo-constants';

export function versionLabel(): string {
  return `versão ${Constants.expoConfig?.version ?? '?'}`;
}
