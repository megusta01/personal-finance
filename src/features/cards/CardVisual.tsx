import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import type { CardBrand } from '@/db/schema';
import { radius, space } from '@/theme/tokens';
import { BRAND_LABEL } from './meta';

const INK = '#F6F1E6';

type Props = {
  name: string;
  brand: CardBrand;
  lastDigits?: string | null;
  color: string;
  compact?: boolean;
};

/** Desenho do cartão (proporção de cartão real). Sem logotipos de bandeira: só o nome. */
export function CardVisual({ name, brand, lastDigits, color, compact }: Props) {
  if (compact) {
    return (
      <View style={[styles.mini, { backgroundColor: color }]}>
        <View style={styles.miniChip} />
      </View>
    );
  }
  return (
    <View
      style={[styles.card, { backgroundColor: color }]}
      accessible
      accessibilityLabel={`Cartão ${name}, ${BRAND_LABEL[brand]}${lastDigits ? `, final ${lastDigits}` : ''}`}
    >
      <View pointerEvents="none" style={styles.sheen} />
      <View style={styles.top}>
        <Text variant="heading" style={{ color: INK }} numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" style={{ color: INK, opacity: 0.85 }}>
          {BRAND_LABEL[brand]}
        </Text>
      </View>
      <View style={styles.chip} />
      <Text variant="bodyStrong" tabular style={{ color: INK, letterSpacing: 2 }}>
        {lastDigits ? `••••  ••••  ••••  ${lastDigits}` : '••••  ••••  ••••  ••••'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1.586,
    borderRadius: radius.xl,
    padding: space.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sheen: {
    position: 'absolute',
    width: '140%',
    height: '70%',
    right: '-60%',
    top: '-25%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  chip: { width: 42, height: 32, borderRadius: 6, backgroundColor: '#D9AE52', opacity: 0.9 },
  mini: { width: 40, height: 28, borderRadius: 5, padding: 4, justifyContent: 'center' },
  miniChip: { width: 9, height: 7, borderRadius: 1.5, backgroundColor: '#D9AE52' },
});
