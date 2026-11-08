import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  EmptyState,
  IconButton,
  Money,
  Screen,
  SectionHeader,
  Surface,
  Text,
} from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { CardVisual } from '@/features/cards/CardVisual';
import { STATUS_META } from '@/features/cards/meta';
import {
  CARD_TABLES,
  cardUsage,
  currentInvoice,
  getCard,
  invoiceMonths,
  invoiceSummary,
} from '@/features/cards/repository';
import { listInvoiceItems } from '@/features/transactions/repository';
import { TransactionItem } from '@/features/transactions/TransactionItem';
import { formatDateShort, formatMonthLong, shiftMonth, todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function CartaoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const today = todayISO();
  const [month, setMonth] = useState<string | null>(null);

  const { data } = useDbQuery(
    (db) => {
      const card = getCard(db, id);
      if (!card) return null;
      const selected = month ?? currentInvoice(db, card, today).month;
      return {
        card,
        usage: cardUsage(db, card),
        months: invoiceMonths(db, card, today),
        invoice: invoiceSummary(db, card, selected, today),
        items: listInvoiceItems(db, card.id, selected),
      };
    },
    CARD_TABLES,
    [id, month],
  );

  if (data === null || (data === undefined && !id)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Cartão não encontrado"
          message="Ele pode ter sido excluído."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }
  if (!data) return null;

  const { card, usage, months, invoice, items } = data;
  const first = months[0]!;
  const last = months[months.length - 1]!;
  const usedPct =
    card.limitCents > 0 ? Math.min(1, Math.max(0, usage.usedCents / card.limitCents)) : 0;
  const status = STATUS_META[invoice.status];
  const statusColor = {
    brand: colors.brand,
    income: colors.income,
    expense: colors.expense,
    muted: colors.textMuted,
    accent: colors.accent,
  }[status.tone];
  const canPay = invoice.remainingCents > 0 && invoice.status !== 'future' && !card.archivedAt;

  return (
    <Screen
      back
      title={card.name}
      right={
        <IconButton
          icon="create-outline"
          label="Editar cartão"
          onPress={() => router.push(`/cartao/editar/${card.id}`)}
        />
      }
    >
      <CardVisual
        name={card.name}
        brand={card.brand}
        lastDigits={card.lastDigits}
        color={card.color}
      />

      <View style={{ gap: space.sm }}>
        <View style={styles.between}>
          <Text variant="caption" tone="muted">
            Limite disponível
          </Text>
          <Text variant="caption" tone="muted">
            de <Money cents={card.limitCents} variant="caption" tone="muted" />
          </Text>
        </View>
        <Money
          cents={usage.availableCents}
          variant="title"
          tone={usage.availableCents < 0 ? 'expense' : 'default'}
        />
        <View
          style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Limite usado"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(usedPct * 100) }}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${usedPct * 100}%`,
                backgroundColor: usedPct > 0.9 ? colors.expense : card.color,
              },
            ]}
          />
        </View>
        <Text variant="caption" tone="subtle">
          Usado: <Money cents={usage.usedCents} variant="caption" tone="subtle" /> (inclui parcelas
          futuras)
        </Text>
      </View>

      <View
        style={[styles.monthBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <IconButton
          icon="chevron-back"
          label="Fatura anterior"
          disabled={invoice.month <= first}
          color={invoice.month <= first ? colors.textSubtle : colors.text}
          onPress={() => setMonth(shiftMonth(invoice.month, -1))}
        />
        <View style={{ alignItems: 'center' }}>
          <Text variant="caption" tone="muted">
            Fatura de
          </Text>
          <Text variant="heading" accessibilityLiveRegion="polite">
            {formatMonthLong(invoice.month)}
          </Text>
        </View>
        <IconButton
          icon="chevron-forward"
          label="Próxima fatura"
          disabled={invoice.month >= last}
          color={invoice.month >= last ? colors.textSubtle : colors.text}
          onPress={() => setMonth(shiftMonth(invoice.month, 1))}
        />
      </View>

      <Surface style={{ padding: space.lg, gap: space.md }}>
        <View style={styles.between}>
          <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
            <Text variant="micro" style={{ color: statusColor }}>
              {status.label}
            </Text>
          </View>
          <Text variant="caption" tone="muted">
            Fecha {formatDateShort(invoice.dates.closingDate)}, vence{' '}
            {formatDateShort(invoice.dates.dueDate)}
          </Text>
        </View>
        <View>
          <Text variant="caption" tone="muted">
            {invoice.status === 'paid'
              ? 'Total da fatura'
              : invoice.paidCents > 0
                ? 'Falta pagar'
                : 'Valor da fatura'}
          </Text>
          <Money
            cents={
              invoice.status === 'paid' || invoice.paidCents === 0
                ? invoice.totalCents
                : invoice.remainingCents
            }
            variant="display"
            tone={invoice.status === 'overdue' ? 'expense' : 'default'}
          />
        </View>
        {invoice.paidCents > 0 && (
          <Text variant="caption" tone="muted">
            Total <Money cents={invoice.totalCents} variant="caption" tone="muted" />, pago{' '}
            <Money cents={invoice.paidCents} variant="caption" tone="income" />
            {invoice.remainingCents < 0 ? ' (sobrou crédito)' : ''}
          </Text>
        )}
        {invoice.status === 'open' && (
          <Text variant="caption" tone="subtle">
            Compras até {formatDateShort(shiftDay(invoice.dates.closingDate, -1))} entram nesta
            fatura.
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button
            label="Nova compra"
            icon="add"
            variant="secondary"
            style={{ flex: 1 }}
            disabled={!!card.archivedAt}
            onPress={() =>
              router.push({ pathname: '/transacao/nova', params: { cartao: card.id } })
            }
          />
          <Button
            label="Pagar fatura"
            icon="checkmark-circle-outline"
            style={{ flex: 1 }}
            disabled={!canPay}
            onPress={() =>
              router.push({
                pathname: '/cartao/pagar/[id]',
                params: { id: card.id, fatura: invoice.month },
              })
            }
          />
        </View>
      </Surface>

      <SectionHeader title={items.length ? `Lançamentos (${items.length})` : 'Lançamentos'} />
      <Surface>
        {items.length ? (
          items.map((t, i) => (
            <View key={t.id}>
              {i > 0 && <Divider inset={68} />}
              <TransactionItem
                item={t}
                cardId={card.id}
                showDate
                onPress={(txId) => router.push(`/transacao/${txId}`)}
              />
            </View>
          ))
        ) : (
          <EmptyState
            icon="card-outline"
            title="Nenhum lançamento nesta fatura"
            message="Compras no cartão aparecem aqui conforme a data de fechamento."
          />
        )}
      </Surface>

      {months.length > 1 && (
        <FutureHint months={months} current={invoice.month} onPick={setMonth} />
      )}
    </Screen>
  );
}

function shiftDay(iso: string, delta: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Atalho para as faturas com lançamento (útil para ver parcelas futuras). */
function FutureHint({
  months,
  current,
  onPick,
}: {
  months: string[];
  current: string;
  onPick: (m: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption" tone="muted">
        Outras faturas
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {months
          .filter((m) => m !== current)
          .map((m) => (
            <Pressable
              key={m}
              onPress={() => onPick(m)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.monthChip,
                { borderColor: colors.border, backgroundColor: colors.surface },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text variant="caption">{formatMonthLong(m)}</Text>
            </Pressable>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xs,
  },
  badge: { paddingHorizontal: space.sm + 2, paddingVertical: 3, borderRadius: radius.pill },
  monthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
