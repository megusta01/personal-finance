import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, FormLayout, Text, TextField, useToast } from '@/components/ui';
import { resendSignupCode, verifySignupCode } from '@/features/sync/account';

const RESEND_AFTER_S = 60;

/** Confirmação do e-mail de uma conta nova, com o código que o Supabase envia. */
export default function Codigo() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifySignupCode(email, code);
      toast({ message: 'E-mail confirmado. Enviando seus dados para a nuvem…' });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await resendSignupCode(email);
      setWait(RESEND_AFTER_S);
      toast({ message: 'Enviamos um código novo' });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <FormLayout
      title="Confirme seu e-mail"
      onClose={() => router.back()}
      footer={
        <>
          {error && (
            <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          <Button
            size="lg"
            label="Confirmar"
            loading={busy}
            disabled={code.trim().length < 6}
            onPress={confirm}
          />
        </>
      }
    >
      <Text tone="muted">
        Enviamos um código para <Text variant="bodyStrong">{email}</Text>. Digite-o abaixo para
        ativar a conta.
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
        autoFocus
        returnKeyType="done"
        onSubmitEditing={confirm}
      />
      <Button
        variant="ghost"
        label={wait > 0 ? `Reenviar código em ${wait}s` : 'Reenviar código'}
        disabled={wait > 0}
        onPress={resend}
      />
      <Text variant="caption" tone="subtle">
        Não chegou? Veja a caixa de spam. Se o e-mail trouxer um link em vez de código, toque no
        link para confirmar e depois entre com seu e-mail e senha.
      </Text>
    </FormLayout>
  );
}
