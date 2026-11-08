import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Money, Text } from '@/components/ui';
import { formatBRL } from '@/lib/money';
import { formatMonthShort, type MonthKey } from '@/lib/dates';
import { usePrefs } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/**
 * Gráficos dos relatórios. Regras seguidas (guia de visualização):
 *  - marcas finas, pontas arredondadas, 2px de respiro entre segmentos;
 *  - legenda sempre que há 2+ séries, e rótulos diretos; nada só pela cor;
 *  - grade e eixos discretos; um eixo só;
 *  - toque mostra o valor (o equivalente ao "hover" no celular).
 */

// ------------------------------------------------------------- barra 100%

export type Slice = { key: string; label: string; cents: number; color: string };

/** Barra única dividida em fatias (parte do todo). Os nomes e valores ficam na lista abaixo dela. */
export function ShareBar({ slices, height = 14 }: { slices: Slice[]; height?: number }) {
  const { colors } = useTheme();
  const total = slices.reduce((s, x) => s + x.cents, 0);
  if (total <= 0)
    return (
      <View style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceMuted }} />
    );
  return (
    <View
      style={{ flexDirection: 'row', height, gap: 2 }}
      accessible
      accessibilityLabel={slices
        .map((s) => `${s.label} ${Math.round((s.cents / total) * 100)}%`)
        .join(', ')}
    >
      {slices.map((s, i) => (
        <View
          key={s.key}
          style={{
            flex: s.cents / total,
            minWidth: 3,
            backgroundColor: s.color,
            borderTopLeftRadius: i === 0 ? height / 2 : 2,
            borderBottomLeftRadius: i === 0 ? height / 2 : 2,
            borderTopRightRadius: i === slices.length - 1 ? height / 2 : 2,
            borderBottomRightRadius: i === slices.length - 1 ? height / 2 : 2,
          }}
        />
      ))}
    </View>
  );
}

// ------------------------------------------------------------- linha acumulada

type LineProps = {
  current: number[];
  previous: number[];
  /** Até que dia a série atual vai (mês corrente = hoje). */
  untilDay: number;
  currentLabel: string;
  previousLabel: string;
};

/** Gasto acumulado no mês: este mês (linha cheia) x mês anterior (referência neutra, tracejada). */
export function PaceChart({ current, previous, untilDay, currentLabel, previousLabel }: LineProps) {
  const { colors } = useTheme();
  const { hideValues } = usePrefs();
  const [width, setWidth] = useState(0);
  const height = 140;
  const pad = 6;
  const days = Math.max(current.length, previous.length, 28);
  const cur = current.slice(0, untilDay);
  const max = Math.max(1, ...cur, ...previous);
  const x = (i: number) => pad + (i / (days - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - v / max) * (height - pad * 2);
  const pts = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const lastCur = cur[cur.length - 1] ?? 0;
  const prevSameDay = previous[Math.min(untilDay, previous.length) - 1] ?? 0;

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.legend}>
        <LegendItem color={colors.chartOut} label={currentLabel} />
        <LegendItem color={colors.chartRef} label={previousLabel} dashed />
      </View>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ height }}
        accessible
        accessibilityLabel={
          hideValues
            ? 'Gráfico do gasto acumulado no mês'
            : `Até o dia ${untilDay}: ${formatBRL(lastCur)} em ${currentLabel}; no mesmo dia de ${previousLabel}: ${formatBRL(prevSameDay)}`
        }
      >
        {width > 0 && (
          <Svg width={width} height={height}>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line
                key={f}
                x1={pad}
                x2={width - pad}
                y1={y(max * f)}
                y2={y(max * f)}
                stroke={colors.grid}
                strokeWidth={1}
              />
            ))}
            <Line
              x1={pad}
              x2={width - pad}
              y1={y(0)}
              y2={y(0)}
              stroke={colors.border}
              strokeWidth={1}
            />
            {previous.length > 1 && (
              <Polyline
                points={pts(previous)}
                fill="none"
                stroke={colors.chartRef}
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {cur.length > 1 && (
              <Polyline
                points={pts(cur)}
                fill="none"
                stroke={colors.chartOut}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {cur.length > 0 && (
              <Circle
                cx={x(cur.length - 1)}
                cy={y(lastCur)}
                r={4.5}
                fill={colors.chartOut}
                stroke={colors.surface}
                strokeWidth={2}
              />
            )}
          </Svg>
        )}
      </View>
      <Text variant="caption" tone="muted">
        Até o dia {untilDay}: <Money cents={lastCur} variant="caption" tone="default" />
        {previous.length > 0 && (
          <>
            {' '}
            (no mesmo dia do mês anterior:{' '}
            <Money cents={prevSameDay} variant="caption" tone="muted" />)
          </>
        )}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------- barras mensais

type FlowPoint = { month: MonthKey; incomeCents: number; expenseCents: number };

/** Entradas x saídas por mês. Toque num mês para ver os valores. */
export function FlowChart({ data, current }: { data: FlowPoint[]; current: MonthKey }) {
  const { colors } = useTheme();
  const { hideValues } = usePrefs();
  const [selected, setSelected] = useState<MonthKey>(current);
  const max = Math.max(1, ...data.flatMap((d) => [d.incomeCents, d.expenseCents]));
  const h = 130;
  const sel = data.find((d) => d.month === selected) ?? data[data.length - 1];

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.legend}>
        <LegendItem color={colors.chartIn} label="Entradas" />
        <LegendItem color={colors.chartOut} label="Saídas" />
      </View>
      {sel && (
        <View
          style={[styles.readout, { backgroundColor: colors.surfaceMuted }]}
          accessibilityLiveRegion="polite"
        >
          <Text variant="caption" tone="muted" style={{ textTransform: 'capitalize' }}>
            {formatMonthShort(sel.month)} {sel.month.slice(0, 4)}
          </Text>
          <Text variant="caption">
            Entradas{' '}
            <Money
              cents={sel.incomeCents}
              variant="caption"
              tone="default"
              style={{ fontWeight: '700' }}
            />
          </Text>
          <Text variant="caption">
            Saídas{' '}
            <Money
              cents={sel.expenseCents}
              variant="caption"
              tone="default"
              style={{ fontWeight: '700' }}
            />
          </Text>
        </View>
      )}
      <View style={[styles.plot, { height: h + 2, borderBottomColor: colors.border }]}>
        {data.map((d) => {
          const active = d.month === sel?.month;
          const label = `${formatMonthShort(d.month)}: entradas ${hideValues ? 'ocultas' : formatBRL(d.incomeCents)}, saídas ${hideValues ? 'ocultas' : formatBRL(d.expenseCents)}`;
          return (
            <Pressable
              key={d.month}
              onPress={() => setSelected(d.month)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              style={[
                styles.group,
                active && { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm },
              ]}
              hitSlop={4}
            >
              <Bar value={d.incomeCents} max={max} h={h} color={colors.chartIn} />
              <Bar value={d.expenseCents} max={max} h={h} color={colors.chartOut} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {data.map((d) => (
          <Text
            key={d.month}
            variant="micro"
            tone={d.month === sel?.month ? 'default' : 'subtle'}
            align="center"
            style={{ flex: 1, textTransform: 'capitalize' }}
          >
            {formatMonthShort(d.month).slice(0, 3)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Bar({ value, max, h, color }: { value: number; max: number; h: number; color: string }) {
  const height = value > 0 ? Math.max(3, (value / max) * (h - 6)) : 0;
  return (
    <View
      style={{
        width: 6,
        height,
        backgroundColor: color,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
      }}
    />
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {dashed ? (
        <View style={{ flexDirection: 'row', gap: 2 }}>
          <View style={{ width: 5, height: 2, backgroundColor: color }} />
          <View style={{ width: 5, height: 2, backgroundColor: color }} />
        </View>
      ) : (
        <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: color }} />
      )}
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  group: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    height: '100%',
    paddingBottom: 1,
  },
  readout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    padding: space.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
});
