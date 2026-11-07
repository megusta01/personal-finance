import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { type as typeScale, type Palette, type TypeVariant } from '@/theme/tokens';

type Tone =
  | 'default'
  | 'muted'
  | 'subtle'
  | 'brand'
  | 'income'
  | 'expense'
  | 'danger'
  | 'onBrand'
  | 'hero'
  | 'heroMuted';

const toneColor = (c: Palette, tone: Tone) =>
  ({
    default: c.text,
    muted: c.textMuted,
    subtle: c.textSubtle,
    brand: c.brand,
    income: c.income,
    expense: c.expense,
    danger: c.danger,
    onBrand: c.onBrand,
    hero: c.heroText,
    heroMuted: c.heroMuted,
  })[tone];

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  /** Números com largura fixa, para valores alinharem em listas. */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
};

export function Text({
  variant = 'body',
  tone = 'default',
  tabular,
  align,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        typeScale[variant],
        { color: toneColor(colors, tone), textAlign: align },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}
