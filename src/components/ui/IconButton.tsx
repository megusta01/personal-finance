import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Props = Omit<PressableProps, 'style'> & {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  background?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Botão só com ícone; sempre com rótulo de acessibilidade e área de toque de 44pt. */
export function IconButton({ icon, label, color, background, size = 22, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background,
        },
        pressed && { opacity: 0.6 },
        style,
      ]}
      {...rest}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}
