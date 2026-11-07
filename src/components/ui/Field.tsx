import type { ReactNode } from 'react';
import { View } from 'react-native';
import { space } from '@/theme/tokens';
import { Text } from './Text';

/** Rótulo + conteúdo + erro, para campos que não são TextField (chips, seletores…). */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
