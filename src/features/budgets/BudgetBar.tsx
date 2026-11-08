import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import type { BudgetLevel } from './repository';

const LABEL: Record<BudgetLevel, string> = { ok: 'Dentro', attention: 'Atenção', over: 'Estourou' };
const ICON = { ok: 'checkmark-circle', attention: 'alert-circle', over: 'close-circle' } as const;

/** Barra de orçamento: cor + ícone + texto (a situação nunca depende só da cor). */
export function BudgetBar({
  ratio,
  level,
  height = 8,
}: {
  ratio: number;
  level: BudgetLevel;
  height?: number;
}) {
  const { colors } = useTheme();
  const color =
    level === 'over' ? colors.danger : level === 'attention' ? colors.accent : colors.brand;
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: colors.surfaceMuted,
        overflow: 'hidden',
      }}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(ratio, 1) * 100) }}
    >
      <View
        style={{
          width: `${Math.min(ratio, 1) * 100}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export function BudgetBadge({ level }: { level: BudgetLevel }) {
  const { colors } = useTheme();
  const color =
    level === 'over' ? colors.danger : level === 'attention' ? colors.accent : colors.brand;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={ICON[level]} size={14} color={color} />
      <Text variant="micro" style={{ color }}>
        {LABEL[level]}
      </Text>
    </View>
  );
}
