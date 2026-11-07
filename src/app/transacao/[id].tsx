import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { useDb } from '@/db/client';
import { getTransaction } from '@/features/transactions/repository';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { useTheme } from '@/theme/ThemeProvider';

export default function EditarTransacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { colors } = useTheme();
  // Lido uma vez ao abrir: o formulário guarda a edição em andamento.
  const [tx] = useState(() => (id ? getTransaction(db, id) : undefined));

  if (!tx) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Transação não encontrada"
          message="Ela pode ter sido excluída."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return <TransactionForm editingId={tx.id} initial={tx} />;
}
