import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material';

import { createAppTheme, type ColorMode } from '../theme';

const STORAGE_KEY = 'klinicone.colorMode';
const LEGACY_STORAGE_KEY = 'mila.colorMode';

// Primeira visita: tema claro (ignora o sistema); depois vale a escolha salva no botão da lua.
// Migra a chave antiga `mila.colorMode` sem perder a preferência.
function initialMode(): ColorMode {
  const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    if (localStorage.getItem(STORAGE_KEY) !== saved) {
      localStorage.setItem(STORAGE_KEY, saved);
    }
    if (localStorage.getItem(LEGACY_STORAGE_KEY) != null) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return saved;
  }
  return 'light';
}

type ColorModeContextValue = {
  mode: ColorMode;
  toggleColorMode: () => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(initialMode);

  const toggleColorMode = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggleColorMode }), [mode, toggleColorMode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within ColorModeProvider');
  return ctx;
}
