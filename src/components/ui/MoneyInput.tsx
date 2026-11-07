import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { centsFromDigits, formatAmount } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { font, space } from '@/theme/tokens';
import { Text } from './Text';

type Props = {
  value: number;
  onChange: (cents: number) => void;
  color?: string;
  autoFocus?: boolean;
  error?: string;
};

/**
 * Campo de valor no estilo app de banco: os dígitos entram pela direita
 * (1 → 0,01; 12 → 0,12; 1234 → 12,34). Não tem como digitar vírgula errada.
 *
 * O TextInput fica invisível por cima do texto formatado: assim o valor
 * sempre aparece centralizado e com a fonte grande, em qualquer plataforma.
 */
export function MoneyInput({ value, onChange, color, autoFocus, error }: Props) {
  const { colors } = useTheme();
  const ref = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const display = formatAmount(value);
  const tint = color ?? colors.text;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => ref.current?.focus()} accessible={false} style={styles.row}>
        <Text variant="title" style={{ color: tint, opacity: 0.7, marginTop: 6 }}>
          R$
        </Text>
        <Text style={[styles.amount, { color: value === 0 ? colors.textSubtle : tint }]} tabular>
          {display}
        </Text>
        <View style={[styles.caret, { backgroundColor: focused ? tint : 'transparent' }]} />
        <TextInput
          ref={ref}
          value={display}
          onChangeText={(t) => onChange(centsFromDigits(t))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          autoFocus={autoFocus}
          caretHidden
          contextMenuHidden
          selection={{ start: display.length, end: display.length }}
          accessibilityLabel="Valor"
          accessibilityValue={{ text: `R$ ${display}` }}
          style={styles.hiddenInput}
        />
      </Pressable>
      {error && (
        <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, paddingVertical: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: space.sm,
    maxWidth: '100%',
  },
  amount: {
    fontFamily: font.extrabold,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -1,
    flexShrink: 1,
  },
  caret: { width: 2, height: 40, marginTop: 6, marginLeft: -4, borderRadius: 1 },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
  },
});
