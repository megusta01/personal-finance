import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { useDb } from '@/db/client';
import { CardForm } from '@/features/cards/CardForm';
import { cardTransactionCount, getCard } from '@/features/cards/repository';
import { useTheme } from '@/theme/ThemeProvider';

export default function EditarCartao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { colors } = useTheme();
  const [state] = useState(() => {
    const card = id ? getCard(db, id) : undefined;
    return card ? { card, transactionCount: cardTransactionCount(db, card.id) } : null;
  });
  if (!state) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Cartão não encontrado"
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }
  return <CardForm editing={state} />;
}
