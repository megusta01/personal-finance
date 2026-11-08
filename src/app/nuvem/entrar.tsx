import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { Button, Chip, FormLayout, Segmented, Text, TextField, useToast } from '@/components/ui';
import { MIN_PASSWORD, signIn, signUp, validateCredentials } from '@/features/sync/account';
import { space } from '@/theme/tokens';

type Mode = 'entrar' | 'criar';

export default function Entrar() {
  const params = useLocalSearchParams<{ modo?: string }>();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(params.modo === 'criar' ? 'criar' : 'entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const creating = mode === 'criar';

  const submit = async () => {
    const invalid = validateCredentials(email, password);
    if (invalid && creating) return setError(invalid);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Digite um e-mail válido.');
    setError(null);
    setBusy(true);
    try {
      if (creating) {
        const { needsCode } = await signUp(email, password);
        if (needsCode) {
          router.replace({ pathname: '/nuvem/codigo', params: { email: email.trim() } });
          return;
        }
        toast({ message: 'Conta criada. Enviando seus dados para a nuvem…' });
      } else {
        await signIn(email, password);
        toast({ message: 'Conectado. Sincronizando seus dados…' });
      }
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormLayout
      title={creating ? 'Criar conta' : 'Entrar'}
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
            label={creating ? 'Criar conta' : 'Entrar'}
            loading={busy}
            disabled={!email.trim() || !password}
            onPress={submit}
          />
        </>
      }
    >
      <Segmented<Mode>
        accessibilityLabel="Entrar ou criar conta"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: 'entrar', label: 'Entrar' },
          { value: 'criar', label: 'Criar conta' },
        ]}
      />
      <TextField
        label="E-mail"
        placeholder="voce@exemplo.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Senha"
        placeholder={creating ? `Pelo menos ${MIN_PASSWORD} caracteres` : 'Sua senha'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={creating ? 'new-password' : 'current-password'}
        textContentType={creating ? 'newPassword' : 'password'}
        returnKeyType="go"
        onSubmitEditing={submit}
        hint={creating ? 'Use uma senha que você não usa em outros lugares.' : undefined}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip
          icon={show ? 'eye-off-outline' : 'eye-outline'}
          label={show ? 'Esconder senha' : 'Mostrar senha'}
          selected={show}
          onPress={() => setShow((v) => !v)}
        />
        {!creating && (
          <Chip
            icon="key-outline"
            label="Esqueci minha senha"
            onPress={() =>
              router.push({ pathname: '/nuvem/recuperar', params: { email: email.trim() } })
            }
          />
        )}
      </View>
      {creating && (
        <Text variant="caption" tone="muted">
          O que já está neste aparelho vai junto para a conta nova. Depois, é só entrar com o mesmo
          e-mail em outro aparelho.
        </Text>
      )}
    </FormLayout>
  );
}
