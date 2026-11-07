import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

export function ColorPicker({
  colors: palette,
  value,
  onChange,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Cor">
      {palette.map((c) => {
        const selected = c.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={`Cor ${c}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(c)}
            style={[styles.swatchRing, { borderColor: selected ? colors.text : 'transparent' }]}
          >
            <View style={[styles.swatch, { backgroundColor: c }]}>
              {selected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconPicker({
  icons,
  value,
  color,
  onChange,
}: {
  icons: IconName[];
  value: string;
  color: string;
  onChange: (i: IconName) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Ícone">
      {icons.map((i) => {
        const selected = i === value;
        return (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityLabel={i.replace(/-outline$/, '').replace(/-/g, ' ')}
            accessibilityState={{ selected }}
            onPress={() => onChange(i)}
            style={[
              styles.icon,
              {
                backgroundColor: selected ? `${color}26` : colors.surface,
                borderColor: selected ? color : colors.border,
              },
            ]}
          >
            <Ionicons name={i} size={22} color={selected ? color : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatchRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
