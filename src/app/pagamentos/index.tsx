import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Divider,
  EmptyState,
  IconButton,
  Money,
  Screen,
  SectionHeader,
  Segmented,
  Surface,
  Text,
} from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { BILL_TABLES, billsSummary, listBillGroups } from '@/features/bills/repository';
import { BillRow } from '@/features/bills/BillRow';
import { todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function Pagamentos() {
  const { colors } = useTheme();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const today = todayISO();
  const { data } = useDbQuery(
    (db) => ({ groups: listBillGroups(db, kind, today), summary: billsSummary(db, today) }),
    BILL_TABLES,
    [kind, today],
  );
  const groups = data?.groups ?? [];
  const s = data?.summary;

  return (
    <Screen
      back
      title="A pagar e a receber"
      right={
        <IconButton
          icon="repeat"
          label="Recorrências"
          background={colors.brandSoft}
          color={colors.brand}
          onPress={() => router.push('/recorrencias')}
        />
      }
    >
      <Segmented
        accessibilityLabel="Tipo"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'A pagar' },
          { value: 'income', label: 'A receber' },
        ]}
      />

      {s && (
        <View style={styles.summary}>
          <SummaryBox
            label={kind === 'expense' ? 'Falta pagar este mês' : 'Falta receber este mês'}
            cents={kind === 'expense' ? s.payableThisMonthCents : s.receivableThisMonthCents}
          />
          {kind === 'expense' && s.overdueCount > 0 ? (
            <SummaryBox
              label={s.overdueCount === 1 ? '1 conta vencida' : `${s.overdueCount} contas vencidas`}
              cents={s.overdueCents}
              danger
            />
          ) : kind === 'expense' && s.invoicesThisMonthCents > 0 ? (
            <SummaryBox label="Faturas de cartão no mês" cents={s.invoicesThisMonthCents} />
          ) : null}
        </View>
      )}

      {groups.length === 0 ? (
        <Surface>
          <EmptyState
            icon={kind === 'expense' ? 'checkmark-done-outline' : 'cash-outline'}
            title={kind === 'expense' ? 'Nada a pagar por enquanto' : 'Nada a receber por enquanto'}
            message="Lançamentos marcados como “a pagar” e as recorrências dos próximos 45 dias aparecem aqui."
            actionLabel={kind === 'expense' ? 'Nova conta a pagar' : 'Novo valor a receber'}
            onAction={() =>
              router.push({ pathname: '/transacao/nova', params: { tipo: kind, pendente: '1' } })
            }
          />
        </Surface>
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ gap: space.md }}>
            <SectionHeader
              title={g.title}
              action={
                <Money
                  cents={g.totalCents}
                  variant="caption"
                  tone={g.key === 'overdue' ? 'expense' : 'muted'}
                />
              }
            />
            <Surface style={g.key === 'overdue' ? { borderColor: colors.expense } : undefined}>
              {g.items.map((t, i) => (
                <View key={t.id}>
                  {i > 0 && <Divider inset={68} />}
                  <BillRow item={t} overdue={g.key === 'overdue'} />
                </View>
              ))}
            </Surface>
          </View>
        ))
      )}
    </Screen>
  );
}

function SummaryBox({ label, cents, danger }: { label: string; cents: number; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: danger ? colors.expenseSoft : colors.surface,
          borderColor: danger ? colors.expense : colors.border,
        },
      ]}
    >
      <Text variant="caption" tone={danger ? 'expense' : 'muted'}>
        {label}
      </Text>
      <Money cents={cents} variant="heading" tone={danger ? 'expense' : 'default'} />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: space.md },
  box: {
    flex: 1,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: 2,
  },
});
