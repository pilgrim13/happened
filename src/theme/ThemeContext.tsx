import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from './tokens.shared';

type ThemeColors = typeof lightColors;

type ThemeContextValue = {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue>({
  scheme: 'light',
  colors: lightColors,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const raw = useColorScheme();
  const scheme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light';
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(() => ({ scheme, colors }), [scheme, colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 컴포넌트에서 `useTheme().colors`로 다크모드 대응 색상에 접근 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
