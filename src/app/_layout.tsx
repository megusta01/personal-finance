import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Suspense, useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui';
import { DATABASE_NAME, DbProvider } from '@/db/client';
import { migrate } from '@/db/migrations';
import { AppThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <Suspense fallback={<Loading />}>
            {/* O banco só é liberado para as telas depois das migrations: acabou a corrida da v1. */}
            <SQLiteProvider
              databaseName={DATABASE_NAME}
              options={{ enableChangeListener: true }}
              onInit={async (db) => {
                await migrate(db);
              }}
              useSuspense
            >
              <DbProvider>
                <ToastProvider>
                  <Navigation />
                </ToastProvider>
              </DbProvider>
            </SQLiteProvider>
          </Suspense>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const { colors, scheme } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.brand,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transacao/nova" options={{ presentation: 'modal' }} />
        <Stack.Screen name="transacao/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="conta/[id]" />
        <Stack.Screen name="conta/nova" options={{ presentation: 'modal' }} />
        <Stack.Screen name="conta/editar/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="conta/ajustar/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="categorias/index" />
        <Stack.Screen name="categorias/nova" options={{ presentation: 'modal' }} />
        <Stack.Screen name="categorias/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cambio" />
      </Stack>
    </ThemeProvider>
  );
}

function Loading() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
      }}
    >
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
