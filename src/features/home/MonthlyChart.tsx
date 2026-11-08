import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { formatBRL } from '@/lib/money';
import { formatMonthShort, type MonthKey } from '@/lib/dates';
import { usePrefs } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Point = { month: MonthKey; incomeCents: number; expenseCents: number };

const HEIGHT = 120;

/**
 * Entradas x saídas por mês, em barras lado a lado.
 * Feito com Views (sem biblioteca de gráfico): leve e igual em todas as plataformas.
 * O gráfico completo, com toque e detalhes, chega com o dashboard novo (Fase 5).
 */
export function MonthlyChart({ data, current }: { data: Point[]; current: MonthKey }) {
  const { colors } = useTheme();
  const { hideValues } = usePrefs();
  const max = Math.max(1, ...data.flatMap((d) => [d.incomeCents, d.expenseCents]));
  const hasData = data.some((d) => d.incomeCents || d.expenseCents);

  return (
    <View>
      <View style={styles.legend}>
        <Legend color={colors.chartIn} label="Entradas" />
        <Legend color={colors.chartOut} label="Saídas" />
      </View>
      <View style={[styles.plot, { borderBottomColor: colors.border }]}>
        {data.map((d) => {
          const label = `${formatMonthShort(d.month)}: entradas ${hideValues ? 'ocultas' : formatBRL(d.incomeCents)}, saídas ${hideValues ? 'ocultas' : formatBRL(d.expenseCents)}`;
          return (
            <View key={d.month} style={styles.group} accessible accessibilityLabel={label}>
              <Bar value={d.incomeCents} max={max} color={colors.chartIn} />
              <Bar value={d.expenseCents} max={max} color={colors.chartOut} />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d) => (
          <Text
            key={d.month}
            variant="micro"
            tone={d.month === current ? 'default' : 'subtle'}
            align="center"
            style={styles.label}
          >
            {formatMonthShort(d.month)}
          </Text>
        ))}
      </View>
      {!hasData && (
        <Text variant="caption" tone="subtle" align="center" style={{ marginTop: space.sm }}>
          Os meses aparecem aqui conforme você registra movimentações.
        </Text>
      )}
    </View>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const h = value > 0 ? Math.max(4, (value / max) * HEIGHT) : 2;
  return (
    <View
      style={{
        width: 10,
        height: h,
        backgroundColor: color,
        opacity: value > 0 ? 1 : 0.25,
        borderRadius: radius.sm / 2,
      }}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: space.lg, marginBottom: space.md },
  plot: {
    height: HEIGHT + 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xs,
  },
  group: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  labels: { flexDirection: 'row', paddingHorizontal: space.xs, marginTop: space.xs },
  label: { flex: 1, textTransform: 'capitalize' },
});
