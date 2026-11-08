import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Chip,
  ConfirmDialog,
  DatePickerSheet,
  Field,
  FormLayout,
  Money,
  MoneyInput,
  Surface,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import type { CreditCard } from '@/db/schema';
import { ACCOUNT_TYPE_META } from '@/features/accounts/meta';
import { listAccountsWithBalance } from '@/features/accounts/repository';
import { deleteTransaction, restoreTransaction } from '@/features/transactions/repository';
import {
  formatDateField,
  formatDateShort,
  formatMonthLong,
  todayISO,
  type MonthKey,
} from '@/lib/dates';
import { space } from '@/theme/tokens';
import { invoiceSummary, saveInvoicePayment } from './repository';

type Props = {
  card: CreditCard;
  invoiceMonth: MonthKey;
  editing?: {
    id: string;
    amountCents: number;
    accountId: string;
    paidOn: string;
    notes: string | null;
  };
};

/** Pagar (total ou parte) de uma fatura com dinheiro de uma conta. */
export function InvoicePaymentForm({ card, invoiceMonth, editing }: Props) {
  const db = useDb();
  const toast = useToast();
  const { data } = useDbQuery(
    (d) => ({
      invoice: invoiceSummary(d, card, invoiceMonth),
      accounts: listAccountsWithBalance(d),
    }),
    ['transactions', 'accounts'],
    [card.id, invoiceMonth],
  );
  const invoice = data?.invoice;
  // Ao editar, o próprio pagamento não conta como "já pago".
  const remaining = invoice ? invoice.remainingCents + (editing?.amountCents ?? 0) : 0;

  const [amount, setAmount] = useState(
    () =>
      editing?.amountCents ?? Math.max(0, invoiceSummary(db, card, invoiceMonth).remainingCents),
  );
  const [accountId, setAccountId] = useState(editing?.accountId ?? card.paymentAccountId ?? '');
  const [paidOn, setPaidOn] = useState(editing?.paidOn ?? todayISO());
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [dateOpen, setDateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accounts = data?.accounts ?? [];
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? accounts[0];

  const save = () => {
    if (!selectedAccount) return setError('Cadastre uma conta para pagar a fatura.');
    try {
      saveInvoicePayment(
        db,
        {
          cardId: card.id,
          invoiceMonth,
          accountId: selectedAccount.id,
          amountCents: amount,
          paidOn,
          notes,
        },
        editing?.id,
      );
      toast({
        message: editing
          ? 'Pagamento atualizado'
          : amount >= remaining
            ? 'Fatura paga'
            : 'Pagamento registrado',
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = () => {
    if (!editing) return;
    deleteTransaction(db, editing.id);
    setConfirmDelete(false);
    toast({
      message: 'Pagamento excluído',
      actionLabel: 'Desfazer',
      onAction: () => restoreTransaction(db, editing.id),
      duration: 6000,
    });
    router.back();
  };

  return (
    <FormLayout
      title={editing ? 'Editar pagamento' : 'Pagar fatura'}
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
            label={editing ? 'Salvar alterações' : 'Confirmar pagamento'}
            disabled={amount <= 0}
            onPress={save}
          />
        </>
      }
    >
      <Surface style={{ padding: space.lg, gap: 2 }}>
        <Text variant="caption" tone="muted">
          {card.name}, fatura de {formatMonthLong(invoiceMonth).toLowerCase()}
        </Text>
        <Text variant="bodyStrong">
          {remaining > 0 ? 'Falta pagar ' : 'Nada a pagar '}
          <Money cents={Math.max(0, remaining)} variant="bodyStrong" maskable={false} />
        </Text>
        {invoice && (
          <Text variant="caption" tone="subtle">
            Vence em {formatDateShort(invoice.dates.dueDate)}
          </Text>
        )}
      </Surface>

      <Field label="Valor do pagamento">
        <MoneyInput
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setError(null);
          }}
          accessibilityLabel="Valor do pagamento"
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space.sm,
            justifyContent: 'center',
          }}
        >
          {remaining > 0 && (
            <Chip
              label="Valor total"
              selected={amount === remaining}
              onPress={() => setAmount(remaining)}
            />
          )}
        </View>
        {amount > 0 && amount < remaining && (
          <Text variant="caption" tone="muted" align="center">
            Pagamento parcial. O restante continua em aberto nesta fatura (o banco pode cobrar
            juros).
          </Text>
        )}
        {remaining > 0 && amount > remaining && (
          <Text variant="caption" tone="muted" align="center">
            Valor acima da fatura. A diferença fica como crédito no cartão.
          </Text>
        )}
      </Field>

      <Field label="Sai da conta">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {accounts.map((a) => (
            <Chip
              key={a.id}
              icon={ACCOUNT_TYPE_META[a.type].icon}
              label={a.name}
              selected={selectedAccount?.id === a.id}
              onPress={() => setAccountId(a.id)}
            />
          ))}
        </View>
        {selectedAccount && (
          <Text variant="caption" tone="subtle">
            Saldo em {selectedAccount.name}:{' '}
            <Money cents={selectedAccount.balanceCents} variant="caption" tone="subtle" />
          </Text>
        )}
      </Field>

      <Field label="Data do pagamento">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip
            label="Hoje"
            selected={paidOn === todayISO()}
            onPress={() => setPaidOn(todayISO())}
          />
          <Chip
            icon="calendar-outline"
            label={paidOn === todayISO() ? 'Outra data' : formatDateField(paidOn)}
            selected={paidOn !== todayISO()}
            onPress={() => setDateOpen(true)}
          />
        </View>
      </Field>

      <TextField
        label="Observação"
        placeholder="Opcional"
        value={notes}
        onChangeText={setNotes}
        maxLength={500}
      />

      {editing && (
        <Button
          label="Excluir pagamento"
          variant="danger"
          icon="trash-outline"
          onPress={() => setConfirmDelete(true)}
        />
      )}

      <DatePickerSheet
        visible={dateOpen}
        value={paidOn}
        onSelect={setPaidOn}
        onClose={() => setDateOpen(false)}
      />
      <ConfirmDialog
        visible={confirmDelete}
        title="Excluir este pagamento?"
        message="O valor volta para a conta e a fatura fica em aberto de novo."
        confirmLabel="Excluir"
        destructive
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </FormLayout>
  );
}
