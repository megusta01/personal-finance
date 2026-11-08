import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { useDb } from '@/db/client';
import { InvoicePaymentForm } from '@/features/cards/InvoicePaymentForm';
import { getCard, getCardPurchase } from '@/features/cards/repository';
import { getTransaction } from '@/features/transactions/repository';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Abre o formulário certo para cada tipo de lançamento:
 * pagamento de fatura, compra no cartão (todas as parcelas juntas) ou lançamento de conta.
 */
export default function EditarTransacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { colors } = useTheme();
  // Lido uma vez ao abrir: o formulário guarda a edição em andamento.
  const [state] = useState(() => {
    const tx = id ? getTransaction(db, id) : undefined;
    if (!tx) return null;
    if (tx.kind === 'card_payment') {
      const card = tx.cardId ? getCard(db, tx.cardId) : undefined;
      return card && tx.invoiceMonth && tx.accountId
        ? ({
            type: 'payment',
            tx,
            card,
            invoiceMonth: tx.invoiceMonth,
            accountId: tx.accountId,
          } as const)
        : null;
    }
    if (tx.cardId) {
      const purchase = getCardPurchase(db, tx.id);
      return purchase ? ({ type: 'purchase', purchase } as const) : null;
    }
    return { type: 'account', tx } as const;
  });

  if (!state) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Lançamento não encontrado"
          message="Ele pode ter sido excluído."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  if (state.type === 'payment') {
    const { tx } = state;
    return (
      <InvoicePaymentForm
        card={state.card}
        invoiceMonth={state.invoiceMonth}
        editing={{
          id: tx.id,
          amountCents: tx.amountCents,
          accountId: state.accountId,
          paidOn: tx.occurredOn,
          notes: tx.notes,
        }}
      />
    );
  }

  if (state.type === 'purchase') {
    const p = state.purchase;
    return (
      <TransactionForm
        editingId={p.firstId}
        editingCardPurchase
        initial={{
          kind: p.kind,
          amountCents: p.totalCents,
          description: p.description,
          categoryId: p.categoryId,
          cardId: p.cardId,
          installments: p.installments,
          occurredOn: p.purchasedOn,
          notes: p.notes,
          recurrenceId: p.recurrenceId,
        }}
      />
    );
  }

  const { tx } = state;
  if (tx.kind === 'card_payment' || !tx.accountId) return null;
  return (
    <TransactionForm
      editingId={tx.id}
      initial={{
        kind: tx.kind,
        amountCents: tx.amountCents,
        description: tx.description,
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        toAccountId: tx.toAccountId,
        occurredOn: tx.occurredOn,
        notes: tx.notes,
        status: tx.status,
        dueOn: tx.dueOn,
        recurrenceId: tx.recurrenceId,
      }}
    />
  );
}
