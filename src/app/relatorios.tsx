import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  CategoryIcon,
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
import { FlowChart, PaceChart, ShareBar, type Slice } from '@/features/reports/charts';
import {
  cumulativeSpending,
  REPORT_TABLES,
  topExpenses,
  totalsByCategory,
  type CategoryTotal,
} from '@/features/reports/repository';
import { monthlySeries } from '@/features/transactions/repository';
import { TransactionItem } from '@/features/transactions/TransactionItem';
import { formatMonthLong, monthKey, shiftMonth, todayISO } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { usePrefs } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const MAX_SLICES = 6;

export default function Relatorios() {
  const { colors } = useTheme();
  const today = todayISO();
  const current = monthKey(new Date());
  const [month, setMonth] = useState(current);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [open, setOpen] = useState<string | null>(null);

  const { data } = useDbQuery(
    (db) => ({
      totals: totalsByCategory(db, kind, month),
      subs: open ? totalsByCategory(db, kind, month, open) : [],
      top: kind === 'expense' ? topExpenses(db, month, 5) : [],
      pace: kind === 'expense' ? cumulativeSpending(db, month) : [],
      pacePrev: kind === 'expense' ? cumulativeSpending(db, shiftMonth(month, -1)) : [],
      flow: monthlySeries(db, month, 12),
    }),
    REPORT_TABLES,
    [kind, month, open],
  );

  const totals = (data?.totals ?? []).filter((t) => t.cents > 0 || t.previousCents > 0);
  const total = totals.reduce((s, t) => s + t.cents, 0);
  const prevTotal = totals.reduce((s, t) => s + t.previousCents, 0);
  const delta = total - prevTotal;
  const max = Math.max(1, ...totals.map((t) => t.cents));

  // Fatias: as maiores categorias; o resto vira "Outras" (nunca uma cor inventada).
  const positive = totals.filter((t) => t.cents > 0);
  const slices: Slice[] = positive
    .slice(0, MAX_SLICES)
    .map((t) => ({ key: t.categoryId, label: t.name, cents: t.cents, color: t.color }));
  const rest = positive.slice(MAX_SLICES).reduce((s, t) => s + t.cents, 0);
  if (rest > 0)
    slices.push({ key: 'outras', label: 'Outras', cents: rest, color: colors.chartRef });

  const isCurrent = month === current;
  const untilDay = isCurrent ? Number(today.slice(8, 10)) : (data?.pace.length ?? 30);
  const noun = kind === 'expense' ? 'gastos' : 'receitas';

  return (
    <Screen back title="Relatórios">
      <View
        style={[styles.monthBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <IconButton
          icon="chevron-back"
          label="Mês anterior"
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
        />
        <Text variant="heading" accessibilityLiveRegion="polite">
          {formatMonthLong(month)}
        </Text>
        <IconButton
          icon="chevron-forward"
          label="Próximo mês"
          disabled={isCurrent}
          color={isCurrent ? colors.textSubtle : colors.text}
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
        />
      </View>

      <Segmented
        accessibilityLabel="Tipo"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setOpen(null);
        }}
        options={[
          { value: 'expense', label: 'Despesas' },
          { value: 'income', label: 'Receitas' },
        ]}
      />

      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="muted">
          Total de {noun} em {formatMonthLong(month).split(' ')[0]!.toLowerCase()}
        </Text>
        <Money cents={total} variant="display" />
        {prevTotal > 0 && (
          <DeltaText delta={delta} base={prevTotal} kind={kind} month={shiftMonth(month, -1)} />
        )}
      </View>

      {totals.length === 0 ? (
        <Surface>
          <EmptyState
            icon="pie-chart-outline"
            title={`Sem ${noun} neste mês`}
            message="Os relatórios aparecem conforme você registra movimentações."
          />
        </Surface>
      ) : (
        <>
          <ShareBar slices={slices} />

          <SectionHeader title="Por categoria" />
          <Surface>
            {totals.map((t, i) => (
              <View key={t.categoryId}>
                {i > 0 && <Divider inset={64} />}
                <CategoryRow
                  item={t}
                  total={total}
                  max={max}
                  kind={kind}
                  expanded={open === t.categoryId}
                  onToggle={() => setOpen((o) => (o === t.categoryId ? null : t.categoryId))}
                />
                {open === t.categoryId && (data?.subs.length ?? 0) > 0 && (
                  <View style={[styles.subs, { backgroundColor: colors.surfaceMuted }]}>
                    {data!.subs
                      .filter((s) => s.cents > 0)
                      .map((s) => (
                        <View key={s.categoryId} style={styles.subRow}>
                          <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                            {s.name}
                          </Text>
                          <Text variant="caption" tone="muted" tabular>
                            {t.cents > 0 ? `${Math.round((s.cents / t.cents) * 100)}%` : ''}
                          </Text>
                          <Money
                            cents={s.cents}
                            variant="caption"
                            tone="default"
                            style={{ minWidth: 92, textAlign: 'right' }}
                          />
                        </View>
                      ))}
                  </View>
                )}
              </View>
            ))}
          </Surface>
        </>
      )}

      {kind === 'expense' && total > 0 && (
        <>
          <SectionHeader title="Ritmo do mês" />
          <Surface style={{ padding: space.lg }}>
            <PaceChart
              current={data?.pace ?? []}
              previous={data?.pacePrev ?? []}
              untilDay={untilDay}
              currentLabel={formatMonthLong(month).split(' ')[0]!}
              previousLabel={formatMonthLong(shiftMonth(month, -1)).split(' ')[0]!}
            />
          </Surface>
        </>
      )}

      <SectionHeader title="Entradas e saídas em 12 meses" />
      <Surface style={{ padding: space.lg }}>
        <FlowChart data={data?.flow ?? []} current={month} />
      </Surface>

      {(data?.top.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Maiores gastos" />
          <Surface>
            {data!.top.map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Divider inset={68} />}
                <TransactionItem
                  item={t}
                  showDate
                  onPress={(id) => router.push(`/transacao/${id}`)}
                />
              </View>
            ))}
          </Surface>
        </>
      )}

      <Text variant="caption" tone="subtle">
        Compras no cartão entram na data de cada parcela. Transferências, pagamentos de fatura,
        ajustes de saldo e contas ainda a pagar ficam de fora.
      </Text>
    </Screen>
  );
}

function DeltaText({
  delta,
  base,
  kind,
  month,
}: {
  delta: number;
  base: number;
  kind: 'expense' | 'income';
  month: string;
}) {
  const { hideValues } = usePrefs();
  const pct = Math.round((Math.abs(delta) / base) * 100);
  const name = formatMonthLong(month).split(' ')[0]!.toLowerCase();
  if (delta === 0)
    return (
      <Text variant="caption" tone="muted">
        Igual a {name}.
      </Text>
    );
  // Para despesas, gastar menos é bom; para receitas, receber mais é bom.
  const good = kind === 'expense' ? delta < 0 : delta > 0;
  const word = delta > 0 ? 'a mais' : 'a menos';
  return (
    <Text variant="caption" tone={good ? 'income' : 'expense'}>
      {delta > 0 ? '▲' : '▼'} {pct}% {word} que {name}
      {hideValues ? '' : ` (${formatBRL(Math.abs(delta))})`}
    </Text>
  );
}

function CategoryRow({
  item,
  total,
  max,
  kind,
  expanded,
  onToggle,
}: {
  item: CategoryTotal;
  total: number;
  max: number;
  kind: 'expense' | 'income';
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const pct = total > 0 ? Math.round((item.cents / total) * 100) : 0;
  const diff = item.cents - item.previousCents;
  const good = kind === 'expense' ? diff < 0 : diff > 0;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityHint="Mostra as subcategorias"
      style={({ pressed }) => [styles.catRow, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <CategoryIcon icon={item.icon} color={item.color} size={36} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.between}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {item.name}
          </Text>
          <Money cents={item.cents} variant="bodyStrong" />
        </View>
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View
            style={{
              width: `${(item.cents / max) * 100}%`,
              height: '100%',
              backgroundColor: item.color,
              borderRadius: 3,
            }}
          />
        </View>
        <View style={styles.between}>
          <Text variant="caption" tone="muted">
            {pct}% do total
          </Text>
          {item.previousCents > 0 || item.cents > 0 ? (
            <Text variant="caption" tone={diff === 0 ? 'subtle' : good ? 'income' : 'expense'}>
              {diff === 0
                ? 'igual ao mês anterior'
                : item.previousCents === 0
                  ? 'novo neste mês'
                  : `${diff > 0 ? '▲' : '▼'} ${formatBRL(Math.abs(diff))}`}
            </Text>
          ) : null}
        </View>
      </View>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={colors.textSubtle}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xs,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  subs: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    borderRadius: radius.md,
    paddingVertical: space.xs,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
