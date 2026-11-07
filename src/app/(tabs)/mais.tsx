import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { StyleSheet, Switch, View } from 'react-native';
import { Divider, Screen, SectionHeader, Segmented, Surface, Text } from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { getMeta } from '@/features/catalog/repository';
import { countTransactions } from '@/features/transactions/repository';
import { formatDateShort } from '@/lib/dates';
import { setHideValues, setThemePref, usePrefs, type ThemePref } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Mais() {
  const { colors } = useTheme();
  const prefs = usePrefs();
  const { data } = useDbQuery(
    (db) => ({
      count: countTransactions(db),
      legacyCount: Number(getMeta(db, 'legacy_imported_count') ?? 0),
      legacyAt: getMeta(db, 'legacy_imported_at'),
    }),
    ['transactions'],
  );

  return (
    <Screen title="Mais">
      <SectionHeader title="Aparência" />
      <Surface style={{ padding: space.lg, gap: space.lg }}>
        <Segmented<ThemePref>
          accessibilityLabel="Tema"
          value={prefs.theme}
          onChange={setThemePref}
          options={[
            { value: 'system', label: 'Sistema' },
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Escuro' },
          ]}
        />
        <Divider />
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">Ocultar valores</Text>
            <Text variant="caption" tone="muted">
              Esconde saldos e valores na tela. Útil em lugares públicos.
            </Text>
          </View>
          <Switch
            value={prefs.hideValues}
            onValueChange={setHideValues}
            accessibilityLabel="Ocultar valores"
            trackColor={{ true: colors.brand, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
      </Surface>

      <SectionHeader title="Seus dados" />
      <Surface>
        <InfoRow
          icon="phone-portrait-outline"
          title="Guardados neste aparelho"
          detail={`${data?.count ?? 0} transações. Funciona sem internet.`}
        />
        {!!data?.legacyCount && (
          <>
            <Divider inset={56} />
            <InfoRow
              icon="archive-outline"
              title="Importados da versão anterior"
              detail={`${data.legacyCount} transações${data.legacyAt ? ` em ${formatDateShort(data.legacyAt.slice(0, 10))}` : ''}. A tabela antiga foi mantida como cópia de segurança.`}
            />
          </>
        )}
        <Divider inset={56} />
        <InfoRow
          icon="cloud-outline"
          title="Backup e sincronização"
          detail="Em uma próxima versão: entrar com sua conta para guardar na nuvem e usar em mais de um aparelho."
          muted
        />
      </Surface>

      <Text variant="caption" tone="subtle" align="center" style={{ marginTop: space.lg }}>
        Finanças, versão {Constants.expoConfig?.version ?? '2.0.0'}
      </Text>
    </Screen>
  );
}

function InfoRow({
  icon,
  title,
  detail,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { padding: space.lg, alignItems: 'flex-start' }]}>
      <Ionicons
        name={icon}
        size={22}
        color={muted ? colors.textSubtle : colors.brand}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" tone={muted ? 'muted' : 'default'}>
          {title}
        </Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
});
