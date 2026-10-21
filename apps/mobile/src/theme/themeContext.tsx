import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkColors, lightColors, colors, type ThemeColors } from './colors';
import { hapticSelection } from './haptics';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'uangku_theme_mode';

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  isDark: true,
  colors: darkColors,
  setTheme: async () => {},
  toggleTheme: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
          setThemeState(stored as ThemeMode);
        }
      })
      .catch((err) => {
        console.warn('Failed to load theme preference:', err);
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  const setTheme = useCallback(async (newMode: ThemeMode) => {
    hapticSelection();
    setThemeState(newMode);
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, newMode);
    } catch (err) {
      console.warn('Failed to persist theme preference:', err);
    }
  }, []);

  const isDark = useMemo(() => {
    if (theme === 'system') {
      return systemScheme === 'dark';
    }
    return theme === 'dark';
  }, [theme, systemScheme]);

  const activeColors = useMemo(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  useEffect(() => {
    Object.assign(colors, activeColors);
  }, [activeColors]);

  const toggleTheme = useCallback(async () => {
    const next = isDark ? 'light' : 'dark';
    await setTheme(next);
  }, [isDark, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      isDark,
      colors: activeColors,
      setTheme,
      toggleTheme,
    }),
    [theme, isDark, activeColors, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
