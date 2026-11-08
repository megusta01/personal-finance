import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export const lockSupported = Platform.OS === 'android' || Platform.OS === 'ios';

export type LockAvailability = { ok: true; label: string } | { ok: false; reason: string };

/** Verifica se dá para usar biometria (ou, na falta dela, a senha/PIN do aparelho). */
export async function lockAvailability(): Promise<LockAvailability> {
  if (!lockSupported) return { ok: false, reason: 'Disponível só no app de celular.' };
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return {
      ok: false,
      reason: 'Configure uma senha, PIN ou biometria no celular para usar o bloqueio.',
    };
  }
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const bio = level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
  return {
    ok: true,
    label:
      bio && hasFace ? 'reconhecimento facial' : bio && hasFinger ? 'digital' : 'senha do celular',
  };
}

/** Pede a autenticação. Se a biometria falhar, o sistema oferece a senha do aparelho. */
export async function authenticate(promptMessage = 'Desbloquear o Finanças'): Promise<boolean> {
  if (!lockSupported) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar senha',
    disableDeviceFallback: false,
  });
  return result.success;
}
