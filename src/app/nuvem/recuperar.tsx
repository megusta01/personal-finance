import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, FormLayout, Text, TextField, useToast } from '@/components/ui';
import { MIN_PASSWORD, resetPassword, sendRecoveryCode } from '@/features/sync/account';

/** Esqueci a senha: código por e-mail e senha nova, sem sair do app. */
export default function Recuperar() {
  const params = useLocalSearchParams<{ email?: string }>();
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Digite um e-mail válido.');
    setBusy(true);
    setError(null);
    try {
      await sendRecoveryCode(email);
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (password.length < MIN_PASSWORD)
      return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email, code, password);
      toast({ message: 'Senha trocada. Você já está conectado.' });
      router.dismissTo('/nuvem');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormLayout
      title="Recuperar senha"
      onClose={() => router.back()}
      footer={
        <>
          {error && (
            <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          {step === 'email' ? (
            <Button
              size="lg"
              label="Enviar código"
              loading={busy}
              disabled={!email.trim()}
              onPress={send}
            />
          ) : (
            <Button
              size="lg"
              label="Trocar senha"
              loading={busy}
              disabled={code.length < 6 || !password}
              onPress={save}
            />
          )}
        </>
      }
    >
      {step === 'email' ? (
        <>
          <Text tone="muted">
            Digite o e-mail da sua conta. Vamos enviar um código para você criar uma senha nova.
          </Text>
          <TextField
            label="E-mail"
            placeholder="voce@exemplo.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={send}
          />
        </>
      ) : (
        <>
          <Text tone="muted">
            Enviamos um código para <Text variant="bodyStrong">{email.trim()}</Text>.
          </Text>
          <TextField
            label="Código"
            placeholder="123456"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={10}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
          <TextField
            label="Senha nova"
            placeholder={`Pelo menos ${MIN_PASSWORD} caracteres`}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Button variant="ghost" label="Reenviar código" onPress={send} />
        </>
      )}
    </FormLayout>
  );
}
