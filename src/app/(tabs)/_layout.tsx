import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(outline: IconName, filled: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={23} color={color as string} />;
  };
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62 + insets.bottom,
          paddingTop: 6,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: icon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="extrato"
        options={{ title: 'Extrato', tabBarIcon: icon('receipt-outline', 'receipt') }}
      />
      <Tabs.Screen
        name="novo"
        options={{
          title: 'Nova transação',
          tabBarButton: () => <AddButton />,
        }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tabs.Screen
        name="contas"
        options={{
          title: 'Contas',
          tabBarIcon: icon('wallet-outline', 'wallet'),
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{ title: 'Mais', tabBarIcon: icon('menu-outline', 'menu') }}
      />
    </Tabs>
  );
}

/** Botão central "+" que abre o formulário de nova transação. */
function AddButton() {
  const { colors } = useTheme();
  return (
    <View style={styles.addWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nova transação"
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/transacao/nova');
        }}
        style={({ pressed }) => [
          styles.add,
          { backgroundColor: colors.brand },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
      >
        <Ionicons name="add" size={28} color={colors.onBrand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  add: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
});
