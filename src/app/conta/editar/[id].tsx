import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { useDb } from '@/db/client';
import { AccountForm } from '@/features/accounts/AccountForm';
import { accountTransactionCount, getAccount } from '@/features/accounts/repository';
import { useTheme } from '@/theme/ThemeProvider';

export default function EditarConta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { colors } = useTheme();
  // Lido uma vez ao abrir: o formulário guarda a edição em andamento.
  const account = id ? getAccount(db, id) : undefined;

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

  return (
    <AccountForm
      editing={{
        id: account.id,
        archived: !!account.archivedAt,
        transactionCount: accountTransactionCount(db, account.id),
        values: account,
      }}
    />
  );
}
