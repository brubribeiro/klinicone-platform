import type { Theme } from '@mui/material';

export const DRAWER_WIDTH = 258;
export const DRAWER_COLLAPSED_WIDTH = 68;
/** Altura da faixa "Você está visualizando como…". */
export const IMPERSONATION_BAR_HEIGHT = 40;

// Paleta do sidebar Aurora (verde escuro)
export const SIDEBAR_BG = '#0E2926';
export const SIDEBAR_TEXT = '#8FAAA4';
export const SIDEBAR_ACTIVE = '#15998B';
export const SIDEBAR_HOVER = 'rgba(255,255,255,0.05)';
export const SIDEBAR_BORDER = 'rgba(255,255,255,0.07)';

/** Transição usada ao recolher/expandir o menu lateral. */
export function drawerTransition(theme: Theme, props: string | string[]) {
  return theme.transitions.create(props, {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  });
}
