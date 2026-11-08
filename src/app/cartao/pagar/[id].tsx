import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { useDb } from '@/db/client';
import { InvoicePaymentForm } from '@/features/cards/InvoicePaymentForm';
import { currentInvoice, getCard } from '@/features/cards/repository';
import { useTheme } from '@/theme/ThemeProvider';

/** Parâmetros: id do cartão e fatura ("AAAA-MM"; padrão: a fatura da vez). */
export default function PagarFatura() {
  const { id, fatura } = useLocalSearchParams<{ id: string; fatura?: string }>();
  const db = useDb();
  const { colors } = useTheme();
  const [state] = useState(() => {
    const card = id ? getCard(db, id) : undefined;
    if (!card) return null;
    const month = fatura && /^\d{4}-\d{2}$/.test(fatura) ? fatura : currentInvoice(db, card).month;
    return { card, month };
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
  return <InvoicePaymentForm card={state.card} invoiceMonth={state.month} />;
}
