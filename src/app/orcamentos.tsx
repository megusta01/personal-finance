import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  CategoryIcon,
  Chip,
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
import { BudgetBadge, BudgetBar } from '@/features/budgets/BudgetBar';
import {
  BUDGET_TABLES,
  budgetStatus,
  budgetSummary,
  levelOf,
  type BudgetStatus,
} from '@/features/budgets/repository';
import { totalsByCategory } from '@/features/reports/repository';
import { formatMonthLong, monthKey, shiftMonth, todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function Orcamentos() {
  const { colors } = useTheme();
  const current = monthKey(new Date());
  const [month, setMonth] = useState(current);
  const today = todayISO();
  const { data } = useDbQuery(
    (db) => {
      const status = budgetStatus(db, month, today);
      const budgeted = new Set(status.map((s) => s.categoryId));
      // Categorias com gasto e sem orçamento: sugestões para definir.
      const unbudgeted = totalsByCategory(db, 'expense', month).filter(
        (t) => t.cents > 0 && !budgeted.has(t.categoryId),
      );
      return { status, unbudgeted };
    },
    BUDGET_TABLES,
    [month, today],
  );
  const status = data?.status ?? [];
  const summary = budgetSummary(status);
  const isCurrent = month === current;

  return (
    <Screen
      back
      title="Orçamentos"
      right={
        <IconButton
          icon="add"
          label="Novo orçamento"
          background={colors.brandSoft}
          color={colors.brand}
          onPress={() => router.push('/orcamento/editar')}
        />
      }
    >
      <View
        style={[styles.monthBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <IconButton
          icon="chevron-back"
          label="Mês anterior"
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
        />
        <Text variant="heading">{formatMonthLong(month)}</Text>
        <IconButton
          icon="chevron-forward"
          label="Próximo mês"
          disabled={isCurrent}
          color={isCurrent ? colors.textSubtle : colors.text}
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
        />
      </View>

      {status.length === 0 ? (
        <Surface>
          <EmptyState
            icon="speedometer-outline"
            title="Nenhum orçamento ainda"
            message="Defina quanto quer gastar por mês em cada categoria. O app avisa quando estiver chegando perto do limite."
            actionLabel="Criar orçamento"
            onAction={() => router.push('/orcamento/editar')}
          />
        </Surface>
      ) : (
        <>
          <Surface style={{ padding: space.lg, gap: space.md }}>
            <View style={styles.between}>
              <Text variant="caption" tone="muted">
                Gasto nas categorias com orçamento
              </Text>
              <BudgetBadge level={levelOf(summary.ratio)} />
            </View>
            <Text variant="title">
              <Money cents={summary.spentCents} variant="title" />{' '}
              <Text variant="body" tone="muted">
                de <Money cents={summary.limitCents} variant="body" tone="muted" />
              </Text>
            </Text>
            <BudgetBar ratio={summary.ratio} level={levelOf(summary.ratio)} height={10} />
            {summary.over > 0 && (
              <Text variant="caption" tone="danger">
                {summary.over === 1
                  ? '1 categoria passou do limite.'
                  : `${summary.over} categorias passaram do limite.`}
              </Text>
            )}
          </Surface>

          <Surface>
            {status.map((b, i) => (
              <View key={b.id}>
                {i > 0 && <Divider inset={68} />}
                <BudgetRow b={b} showPace={isCurrent} />
              </View>
            ))}
          </Surface>
        </>
      )}

      {(data?.unbudgeted.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Sem orçamento" />
          <Text variant="caption" tone="muted" style={{ marginTop: -space.sm }}>
            Categorias com gasto neste mês. Toque para definir um limite.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {data!.unbudgeted.slice(0, 8).map((t) => (
              <Chip
                key={t.categoryId}
                icon="add"
                label={t.name}
                onPress={() =>
                  router.push({
                    pathname: '/orcamento/editar',
                    params: { categoria: t.categoryId },
                  })
                }
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function BudgetRow({ b, showPace }: { b: BudgetStatus; showPace: boolean }) {
  const { colors } = useTheme();
  const paceOver = showPace && b.level !== 'over' && b.projectedCents > b.limitCents;
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/orcamento/editar', params: { categoria: b.categoryId } })
      }
      accessibilityRole="button"
      accessibilityHint="Editar orçamento"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <CategoryIcon icon={b.icon} color={b.color} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.between}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {b.name}
          </Text>
          <BudgetBadge level={b.level} />
        </View>
        <BudgetBar ratio={b.ratio} level={b.level} />
        <View style={styles.between}>
          <Text variant="caption" tone="muted">
            <Money cents={b.spentCents} variant="caption" tone="default" /> de{' '}
            <Money cents={b.limitCents} variant="caption" tone="muted" />
          </Text>
          <Text variant="caption" tone={b.remainingCents < 0 ? 'danger' : 'muted'}>
            {b.remainingCents < 0 ? 'passou ' : 'restam '}
            <Money
              cents={Math.abs(b.remainingCents)}
              variant="caption"
              tone={b.remainingCents < 0 ? 'danger' : 'muted'}
            />
          </Text>
        </View>
        {paceOver && (
          <Text variant="caption" style={{ color: colors.accent }}>
            No ritmo atual, chega a{' '}
            <Money
              cents={b.projectedCents}
              variant="caption"
              style={{ color: colors.accent, fontWeight: '700' }}
            />{' '}
            no fim do mês.
          </Text>
        )}
      </View>
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
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
