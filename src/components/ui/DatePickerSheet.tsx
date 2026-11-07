import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMonthLong, fromISODate, toISODate, todayISO, type ISODate } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

type Props = {
  visible: boolean;
  value: ISODate;
  onSelect: (d: ISODate) => void;
  onClose: () => void;
};

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Calendário próprio: igual no Android, iOS e web (também servirá para vencimentos). */
export function DatePickerSheet({ visible, value, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState(() => startOfMonth(fromISODate(value)));
  const today = todayISO();

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  });
  const title = formatMonthLong(format(cursor, 'yyyy-MM'));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setCursor(startOfMonth(fromISODate(value)))}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityLabel="Fechar calendário"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg },
        ]}
      >
        <View style={styles.header}>
          <IconButton
            icon="chevron-back"
            label="Mês anterior"
            onPress={() => setCursor((c) => addMonths(c, -1))}
          />
          <Text variant="heading" accessibilityLiveRegion="polite">
            {title}
          </Text>
          <IconButton
            icon="chevron-forward"
            label="Próximo mês"
            onPress={() => setCursor((c) => addMonths(c, 1))}
          />
        </View>
        <View style={styles.grid}>
          {WEEKDAYS.map((w, i) => (
            <View key={i} style={styles.cell}>
              <Text variant="micro" tone="subtle">
                {w}
              </Text>
            </View>
          ))}
          {days.map((d) => {
            const iso = toISODate(d);
            const selected = iso === value;
            const inMonth = isSameMonth(d, cursor);
            const isToday = iso === today;
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityLabel={format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                accessibilityState={{ selected }}
                onPress={() => {
                  onSelect(iso);
                  onClose();
                }}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.day,
                    selected && { backgroundColor: colors.brand },
                    !selected && isToday && { borderWidth: 1.5, borderColor: colors.brand },
                  ]}
                >
                  <Text
                    variant="bodyStrong"
                    tabular
                    style={{
                      color: selected ? colors.onBrand : inMonth ? colors.text : colors.textSubtle,
                      opacity: inMonth ? 1 : 0.5,
                    }}
                  >
                    {format(d, 'd')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
