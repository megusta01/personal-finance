import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Sheet } from './Sheet';
import { Text } from './Text';

type Props = {
  visible: boolean;
  title: string;
  value: number;
  onSelect: (d: number) => void;
  onClose: () => void;
  hint?: string;
};

/** Escolha de um dia do mês (1 a 31), para fechamento e vencimento. */
export function DayPicker({ visible, title, value, onSelect, onClose, hint }: Props) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
          const selected = d === value;
          return (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityLabel={`Dia ${d}`}
              accessibilityState={{ selected }}
              onPress={() => {
                onSelect(d);
                onClose();
              }}
              style={styles.cell}
            >
              <View style={[styles.day, selected && { backgroundColor: colors.brand }]}>
                <Text
                  variant="bodyStrong"
                  tabular
                  style={{ color: selected ? colors.onBrand : colors.text }}
                >
                  {d}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {hint && (
        <Text
          variant="caption"
          tone="subtle"
          style={{ paddingHorizontal: space.xl, marginTop: space.sm }}
        >
          {hint}
        </Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.md },
  cell: { width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
