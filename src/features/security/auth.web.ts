export const lockSupported = false;
export type LockAvailability = { ok: true; label: string } | { ok: false; reason: string };
export async function lockAvailability(): Promise<LockAvailability> {
  return { ok: false, reason: 'Disponível só no app de celular.' };
}
export async function authenticate(_promptMessage?: string) {
  return true;
}
