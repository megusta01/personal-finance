import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { usePrefs } from '@/lib/prefs';
import { dark, light, type Palette } from './tokens';

type Theme = { colors: Palette; scheme: 'light' | 'dark' };

const ThemeContext = createContext<Theme>({ colors: light, scheme: 'light' });

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const { theme } = usePrefs();
  const scheme = theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : theme;
  const value = useMemo<Theme>(
    () => ({ scheme, colors: scheme === 'dark' ? dark : light }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
