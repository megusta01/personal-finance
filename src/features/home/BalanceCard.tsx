import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Money, Text } from '@/components/ui';
import { formatMonthShort, type MonthKey } from '@/lib/dates';
import { setHideValues, usePrefs } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Props = {
  balanceCents: number;
  incomeCents: number;
  expenseCents: number;
  month: MonthKey;
};

/** A peça de destaque do app: saldo em verde-petróleo com um fio de latão. */
export function BalanceCard({ balanceCents, incomeCents, expenseCents, month }: Props) {
  const { colors } = useTheme();
  const { hideValues } = usePrefs();
  const m = formatMonthShort(month);

  return (
    <View style={[styles.card, { backgroundColor: colors.heroBg }]}>
      {/* moeda estilizada no canto: dois anéis concêntricos */}
      <View
        pointerEvents="none"
        style={[styles.ring, styles.ringOuter, { borderColor: colors.heroLine }]}
      />
      <View
        pointerEvents="none"
        style={[styles.ring, styles.ringInner, { borderColor: colors.heroLine }]}
      />

      <View style={styles.top}>
        <Text variant="caption" tone="heroMuted">
          Saldo disponível
        </Text>
        <Pressable
          onPress={() => setHideValues(!hideValues)}
          accessibilityRole="button"
          accessibilityLabel={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          hitSlop={12}
        >
          <Ionicons
            name={hideValues ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.heroMuted}
          />
        </Pressable>
      </View>

      <Money
        cents={balanceCents}
        variant="display"
        tone="hero"
        style={{ marginTop: space.xs }}
        adjustsFontSizeToFit
        numberOfLines={1}
      />

      <View style={[styles.line, { backgroundColor: colors.heroLine }]} />

      <View style={styles.split}>
        <View style={styles.col}>
          <Text variant="caption" tone="heroMuted">
            Entradas em {m}
          </Text>
          <Money cents={incomeCents} sign="income" variant="bodyStrong" tone="hero" />
        </View>
        <View style={styles.col}>
          <Text variant="caption" tone="heroMuted">
            Saídas em {m}
          </Text>
          <Money cents={expenseCents} sign="expense" variant="bodyStrong" tone="hero" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: space.xl,
    paddingTop: space.lg + 2,
    overflow: 'hidden',
  },
  ring: { position: 'absolute', borderRadius: 999, opacity: 0.35 },
  ringOuter: { width: 220, height: 220, right: -90, top: -110, borderWidth: 1.5 },
  ringInner: { width: 150, height: 150, right: -55, top: -75, borderWidth: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  line: { height: 1.5, width: 36, borderRadius: 1, marginVertical: space.lg, opacity: 0.9 },
  split: { flexDirection: 'row', gap: space.lg },
  col: { flex: 1, gap: 2 },
});
