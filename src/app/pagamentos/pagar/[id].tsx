import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Chip,
  DatePickerSheet,
  EmptyState,
  Field,
  FormLayout,
  MoneyInput,
  Surface,
  Text,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import { ACCOUNT_TYPE_META } from '@/features/accounts/meta';
import { listActiveAccounts } from '@/features/accounts/repository';
import { markBillPaid, markBillUnpaid } from '@/features/bills/repository';
import { getRecurrence } from '@/features/recurrences/repository';
import { getTransaction } from '@/features/transactions/repository';
import { daysAgoISO, formatDateField, formatDateShort, todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Marcar uma conta como paga (ou um valor como recebido), confirmando valor, data e conta. */
export default function PagarConta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const [tx] = useState(() => (id ? getTransaction(db, id) : undefined));
  const [rule] = useState(() =>
    tx?.recurrenceId ? getRecurrence(db, tx.recurrenceId) : undefined,
  );
  const { data: accounts } = useDbQuery((d) => listActiveAccounts(d), ['accounts']);
  const [amount, setAmount] = useState(tx?.amountCents ?? 0);
  const [paidOn, setPaidOn] = useState(todayISO());
  const [accountId, setAccountId] = useState(tx?.accountId ?? '');
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tx || tx.status !== 'pending' || !tx.accountId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="checkmark-done-outline"
          title="Nada a pagar aqui"
          message="Este lançamento já foi pago ou excluído."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const isIncome = tx.kind === 'income';
  const due = tx.dueOn ?? tx.occurredOn;
  const yesterday = daysAgoISO(1);

  const confirm = () => {
    try {
      const { previous } = markBillPaid(db, tx.id, { paidOn, amountCents: amount, accountId });
      toast({
        message: isIncome ? 'Marcado como recebido' : 'Conta paga',
        actionLabel: 'Desfazer',
        onAction: () =>
          markBillUnpaid(db, tx.id, {
            amountCents: previous.amountCents,
            accountId: previous.accountId,
          }),
        duration: 6000,
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <FormLayout
      title={isIncome ? 'Confirmar recebimento' : 'Pagar conta'}
      onClose={() => router.back()}
      footer={
        <>
          {error && (
            <Text variant="caption" tone="danger" align="center">
              {error}
            </Text>
          )}
          <Button
            size="lg"
            label={isIncome ? 'Marcar como recebido' : 'Marcar como paga'}
            disabled={amount <= 0 || !accountId}
            onPress={confirm}
          />
        </>
      }
    >
      <Surface style={{ padding: space.lg, gap: 2 }}>
        <Text variant="bodyStrong">{tx.description}</Text>
        <Text variant="caption" tone={due < todayISO() ? 'expense' : 'muted'}>
          {due < todayISO() ? 'Venceu' : 'Vence'} em {formatDateShort(due)}
        </Text>
      </Surface>

      <Field label={isIncome ? 'Valor recebido' : 'Valor pago'}>
        <MoneyInput
          value={amount}
          onChange={setAmount}
          color={isIncome ? colors.income : undefined}
          accessibilityLabel="Valor"
        />
        {rule?.variableAmount && (
          <View
            style={{
              flexDirection: 'row',
              gap: space.sm,
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.brandSoft,
            }}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.brand} />
            <Text variant="caption" style={{ flex: 1 }}>
              Esta conta muda de valor. Confira o valor certo na conta antes de confirmar.
            </Text>
          </View>
        )}
      </Field>

      <Field label={isIncome ? 'Recebido em' : 'Pago em'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip
            label="Hoje"
            selected={paidOn === todayISO()}
            onPress={() => setPaidOn(todayISO())}
          />
          <Chip
            label="Ontem"
            selected={paidOn === yesterday}
            onPress={() => setPaidOn(yesterday)}
          />
          <Chip
            icon="calendar-outline"
            label={
              paidOn !== todayISO() && paidOn !== yesterday ? formatDateField(paidOn) : 'Outra data'
            }
            selected={paidOn !== todayISO() && paidOn !== yesterday}
            onPress={() => setDateOpen(true)}
          />
        </View>
      </Field>

      <Field label={isIncome ? 'Entrou na conta' : 'Saiu da conta'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(accounts ?? []).map((a) => (
            <Chip
              key={a.id}
              icon={ACCOUNT_TYPE_META[a.type].icon}
              label={a.name}
              selected={accountId === a.id}
              onPress={() => setAccountId(a.id)}
            />
          ))}
        </View>
      </Field>

      <DatePickerSheet
        visible={dateOpen}
        value={paidOn}
        onSelect={setPaidOn}
        onClose={() => setDateOpen(false)}
      />
    </FormLayout>
  );
}
