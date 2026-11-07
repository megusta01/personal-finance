import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { radius } from '@/theme/tokens';

/** Quadrado na cor da conta com o ícone do tipo (diferente do círculo das categorias). */
export function AccountIcon({
  icon,
  color,
  size = 40,
}: {
  icon: string;
  color: string;
  size?: number;
}) {
  const name = (
    icon in Ionicons.glyphMap ? icon : 'wallet-outline'
  ) as keyof typeof Ionicons.glyphMap;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size > 36 ? radius.md : radius.sm,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={size * 0.5} color="#F6F1E6" />
    </View>
  );
}
