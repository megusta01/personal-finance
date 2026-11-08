import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Money, Text } from '@/components/ui';
import { formatMonthLong } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { GoalProgress } from './repository';

export function GoalCard({ goal: g, onPress }: { goal: GoalProgress; onPress?: () => void }) {
  const { colors } = useTheme();
  const pct = Math.min(100, Math.floor(g.ratio * 100));
  const name = (
    g.icon in Ionicons.glyphMap ? g.icon : 'flag-outline'
  ) as keyof typeof Ionicons.glyphMap;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Meta ${g.name}, ${pct}%`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: `${g.color}22` }]}>
          <Ionicons name={name} size={20} color={g.color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {g.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {g.accountName
              ? `Acompanha ${g.accountName}`
              : g.targetDate
                ? `Até ${formatMonthLong(g.targetDate.slice(0, 7)).toLowerCase()}`
                : 'Sem prazo'}
          </Text>
        </View>
        {g.done ? (
          <View style={[styles.badge, { backgroundColor: colors.incomeSoft }]}>
            <Ionicons name="checkmark" size={12} color={colors.income} />
            <Text variant="micro" tone="income">
              Concluída
            </Text>
          </View>
        ) : (
          <Text variant="heading" tabular>
            {pct}%
          </Text>
        )}
      </View>
      <View
        style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: pct }}
      >
        <View
          style={{ width: `${pct}%`, height: '100%', backgroundColor: g.color, borderRadius: 5 }}
        />
      </View>
      <View style={styles.between}>
        <Text variant="caption" tone="muted">
          <Money cents={g.savedCents} variant="caption" tone="default" /> de{' '}
          <Money cents={g.targetCents} variant="caption" tone="muted" />
        </Text>
        {!g.done && g.monthlyNeededCents !== null && (
          <Text variant="caption" tone="muted">
            guarde <Money cents={g.monthlyNeededCents} variant="caption" tone="default" />
            /mês
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
});
