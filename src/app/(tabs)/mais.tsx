import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import {
  Chip,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  Segmented,
  Surface,
  Text,
} from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { getMeta } from '@/features/catalog/meta';
import { countTransactions } from '@/features/transactions/repository';
import { formatDateShort } from '@/lib/dates';
import { requestPermission, remindersSupported } from '@/features/reminders/notifications';
import {
  setHideValues,
  setReminderPrefs,
  setThemePref,
  usePrefs,
  type ThemePref,
} from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Mais() {
  const { colors } = useTheme();
  const prefs = usePrefs();
  const [permissionDenied, setPermissionDenied] = useState(false);

  const toggleReminders = async (on: boolean) => {
    if (!on) {
      setReminderPrefs({ remindersEnabled: false });
      return;
    }
    const granted = await requestPermission();
    setPermissionDenied(!granted);
    setReminderPrefs({ remindersEnabled: granted });
  };
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
      <SectionHeader title="Organizar" />
      <Surface>
        <ListRow
          title="Categorias"
          subtitle="Criar, editar e arquivar categorias e subcategorias"
          left={<Ionicons name="pricetags-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/categorias')}
        />
        <Divider inset={56} />
        <ListRow
          title="Contas e cartões"
          subtitle="Saldos, transferências, faturas e limites"
          left={<Ionicons name="wallet-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/contas')}
        />
        <Divider inset={56} />
        <ListRow
          title="Câmbio"
          subtitle="Cotações e conversor de moedas"
          left={<Ionicons name="globe-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/cambio')}
        />
      </Surface>

      <SectionHeader title="Contas do mês" />
      <Surface>
        <ListRow
          title="A pagar e a receber"
          subtitle="Vencimentos, contas atrasadas e o que falta receber"
          left={<Ionicons name="calendar-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/pagamentos')}
        />
        <Divider inset={56} />
        <ListRow
          title="Recorrências"
          subtitle="Aluguel, luz, assinaturas, salário…"
          left={<Ionicons name="repeat" size={22} color={colors.brand} />}
          onPress={() => router.push('/recorrencias')}
        />
      </Surface>

      <SectionHeader title="Lembretes" />
      <Surface style={{ padding: space.lg, gap: space.lg }}>
        {remindersSupported ? (
          <>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">Avisar vencimentos</Text>
                <Text variant="caption" tone="muted">
                  Notificação no celular para contas a pagar, recebimentos e faturas de cartão.
                </Text>
              </View>
              <Switch
                value={prefs.remindersEnabled}
                onValueChange={toggleReminders}
                accessibilityLabel="Avisar vencimentos"
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
            {permissionDenied && (
              <Text variant="caption" tone="danger">
                As notificações estão bloqueadas para o app. Libere nas configurações do celular e
                ligue de novo.
              </Text>
            )}
            {prefs.remindersEnabled && (
              <>
                <Divider />
                <View style={{ gap: space.sm }}>
                  <Text variant="caption" tone="muted">
                    Horário do aviso
                  </Text>
                  <View style={styles.chips}>
                    {[7, 9, 12, 18, 20].map((h) => (
                      <Chip
                        key={h}
                        label={`${h}h`}
                        selected={prefs.reminderHour === h}
                        onPress={() => setReminderPrefs({ reminderHour: h })}
                      />
                    ))}
                  </View>
                </View>
                <View style={{ gap: space.sm }}>
                  <Text variant="caption" tone="muted">
                    Avisar também antes
                  </Text>
                  <View style={styles.chips}>
                    {[0, 1, 2, 3, 5, 7].map((d) => (
                      <Chip
                        key={d}
                        label={d === 0 ? 'Só no dia' : d === 1 ? '1 dia antes' : `${d} dias antes`}
                        selected={prefs.reminderDaysBefore === d}
                        onPress={() => setReminderPrefs({ reminderDaysBefore: d })}
                      />
                    ))}
                  </View>
                </View>
                <Text variant="caption" tone="subtle">
                  Com “Ocultar valores” ligado, os avisos não mostram valores na tela bloqueada.
                </Text>
              </>
            )}
          </>
        ) : (
          <Text variant="caption" tone="muted">
            Lembretes funcionam no app de celular (Android e iPhone).
          </Text>
        )}
      </Surface>

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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
