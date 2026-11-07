import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { icon?: string | null; color?: string | null; size?: number };

/** Círculo com o ícone da categoria, num fundo bem claro da própria cor. */
export function CategoryIcon({ icon, color, size = 40 }: Props) {
  const { colors, scheme } = useTheme();
  const tint = color ?? colors.textMuted;
  const name = (
    icon && icon in Ionicons.glyphMap ? icon : 'pricetag-outline'
  ) as keyof typeof Ionicons.glyphMap;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${tint}${scheme === 'dark' ? '33' : '1F'}`,
      }}
    >
      <Ionicons name={name} size={size * 0.48} color={tint} />
    </View>
  );
}
