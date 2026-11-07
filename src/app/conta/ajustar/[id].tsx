import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  EmptyState,
  Field,
  FormLayout,
  Money,
  MoneyInput,
  Segmented,
  Surface,
  Text,
  useToast,
} from '@/components/ui';
import { useDb } from '@/db/client';
import { adjustBalance, getAccount } from '@/features/accounts/repository';
import { formatSigned } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** "Ajustar saldo": a pessoa informa o saldo real (do app do banco) e o app lança a diferença. */
export default function AjustarSaldo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const [account] = useState(() => (id ? getAccount(db, id) : undefined));
  const [abs, setAbs] = useState(() => Math.abs(account?.balanceCents ?? 0));
  const [negative, setNegative] = useState((account?.balanceCents ?? 0) < 0);

  if (!account) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Conta não encontrada"
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const target = negative ? -abs : abs;
  const diff = target - account.balanceCents;

  const save = () => {
    adjustBalance(db, account.id, target);
    toast({ message: 'Saldo ajustado' });
    router.back();
  };

  return (
    <FormLayout
      title="Ajustar saldo"
      onClose={() => router.back()}
      footer={
        <Button
          size="lg"
          label={diff === 0 ? 'O saldo já está certo' : 'Ajustar saldo'}
          disabled={diff === 0}
          onPress={save}
        />
      }
    >
      <Surface style={{ padding: space.lg, gap: 2 }}>
        <Text variant="caption" tone="muted">
          Saldo no app, em {account.name}
        </Text>
        <Money cents={account.balanceCents} variant="heading" maskable={false} />
      </Surface>

      <Field label="Saldo real hoje" hint="Confira no app do banco e digite o valor exato.">
        <MoneyInput
          value={abs}
          onChange={setAbs}
          color={negative ? colors.expense : undefined}
          prefix={negative ? '−R$' : 'R$'}
          accessibilityLabel="Saldo real"
          autoFocus
        />
        <Segmented
          accessibilityLabel="Sinal do saldo"
          value={negative ? 'neg' : 'pos'}
          onChange={(v) => setNegative(v === 'neg')}
          options={[
            { value: 'pos', label: 'Positivo' },
            { value: 'neg', label: 'Negativo', activeColor: colors.expense },
          ]}
        />
      </Field>

      {diff !== 0 && (
        <Text tone="muted" align="center">
          Vamos lançar{' '}
          <Text variant="bodyStrong" tone={diff > 0 ? 'income' : 'expense'}>
            {formatSigned(diff)}
          </Text>{' '}
          como &quot;Ajuste de saldo&quot; com a data de hoje. O histórico anterior não muda.
        </Text>
      )}
    </FormLayout>
  );
}
