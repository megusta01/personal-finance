import { usePrefs } from '@/lib/prefs';
import { formatBRL, formatSigned } from '@/lib/money';
import { Text, type AppTextProps } from './Text';

type Props = Omit<AppTextProps, 'children'> & {
  cents: number;
  /**
   * income/expense: força + ou − (o valor é sempre positivo no banco);
   * auto: + para positivo, − para negativo; plain: só o sinal de negativo.
   */
  sign?: 'income' | 'expense' | 'auto' | 'plain';
  /** Respeita o "ocultar valores" (padrão: sim). */
  maskable?: boolean;
};

export const MASK = 'R$ ••••';

export function Money({ cents, sign = 'plain', maskable = true, tabular = true, ...rest }: Props) {
  const { hideValues } = usePrefs();
  const hidden = maskable && hideValues;
  let label: string;
  if (hidden) label = MASK;
  else if (sign === 'auto') label = formatSigned(cents);
  else if (sign === 'plain' || cents === 0) label = formatBRL(cents);
  else label = `${sign === 'income' ? '+' : '−'}${formatBRL(Math.abs(cents))}`;
  return (
    <Text tabular={tabular} accessibilityLabel={hidden ? 'Valor oculto' : label} {...rest}>
      {label}
    </Text>
  );
}
