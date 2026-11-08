import type { AuthError } from '@supabase/supabase-js';
import type { MigrationDb } from '@/db/migrations';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import { setLastAccountId } from '@/lib/prefs';
import { supabase } from './client';
import { resetSyncStatus, waitForSync } from './service';
import { wipeLocalData } from './wipe';

/** Mensagens do Supabase Auth em português, com o que fazer. */
export function authMessage(e: unknown): string {
  const err = e as Partial<AuthError> & { message?: string };
  const code = err?.code ?? '';
  const msg = err?.message ?? String(e);
  const map: Record<string, string> = {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_confirmed: 'Confirme seu e-mail com o código que enviamos antes de entrar.',
    user_already_exists: 'Já existe uma conta com este e-mail. Entre com ela.',
    email_exists: 'Já existe uma conta com este e-mail. Entre com ela.',
    weak_password: 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.',
    same_password: 'A nova senha precisa ser diferente da atual.',
    otp_expired: 'Código inválido ou vencido. Peça um novo.',
    over_email_send_rate_limit: 'Muitos e-mails em pouco tempo. Espere um minuto e tente de novo.',
    over_request_rate_limit: 'Muitas tentativas. Espere um pouco e tente de novo.',
    email_address_invalid: 'Este e-mail não parece válido.',
    signup_disabled: 'A criação de contas está desligada neste projeto do Supabase.',
    validation_failed: 'Confira o e-mail e a senha.',
  };
  if (map[code]) return map[code];
  if (/fetch|network/i.test(msg)) return 'Sem conexão. Verifique a internet e tente de novo.';
  if (/rate limit/i.test(msg)) return map.over_email_send_rate_limit!;
  return msg;
}

function client() {
  if (!supabase) throw new Error('A sincronização não está configurada neste app.');
  return supabase;
}

export const MIN_PASSWORD = 8;

export function validateCredentials(email: string, password: string): string | null {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Digite um e-mail válido.';
  if (password.length < MIN_PASSWORD)
    return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  return null;
}

export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(authMessage(error));
}

/** Cria a conta. Se o projeto pede confirmação de e-mail, devolve needsCode = true. */
export async function signUp(email: string, password: string): Promise<{ needsCode: boolean }> {
  const { data, error } = await client().auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(authMessage(error));
  // Com "proteção contra enumeração", e-mail já cadastrado volta sem erro e sem identidades.
  if (data.user && data.user.identities?.length === 0)
    throw new Error('Já existe uma conta com este e-mail. Entre com ela.');
  return { needsCode: !data.session };
}

export async function verifySignupCode(email: string, code: string) {
  const { error } = await client().auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw new Error(authMessage(error));
}

export async function resendSignupCode(email: string) {
  const { error } = await client().auth.resend({ type: 'signup', email: email.trim() });
  if (error) throw new Error(authMessage(error));
}

export async function sendRecoveryCode(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(authMessage(error));
}

/** Confirma o código de recuperação (isso já entra na conta) e troca a senha. */
export async function resetPassword(email: string, code: string, newPassword: string) {
  const c = client();
  const v = await c.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
  if (v.error) throw new Error(authMessage(v.error));
  const u = await c.auth.updateUser({ password: newPassword });
  if (u.error) throw new Error(authMessage(u.error));
}

/**
 * Sai da conta neste aparelho e apaga os dados locais (eles continuam na nuvem).
 * Quem chama deve tentar sincronizar antes e avisar se ainda houver algo não enviado.
 */
export async function signOutAndWipe(mdb: MigrationDb) {
  await waitForSync();
  if (supabase) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  await wipeLocalData(mdb);
  setLastAccountId(DEFAULT_ACCOUNT.id);
  resetSyncStatus();
}

/** Usar outra conta neste aparelho: apaga os dados locais (da conta anterior) e mantém o login. */
export async function wipeForCurrentAccount(mdb: MigrationDb) {
  await waitForSync();
  await wipeLocalData(mdb);
  setLastAccountId(DEFAULT_ACCOUNT.id);
  resetSyncStatus();
}
