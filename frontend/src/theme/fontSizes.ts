/**
 * Escala tipográfica centralizada do app.
 *
 * Todos os tamanhos de fonte devem sair daqui, em vez de valores rem soltos
 * espalhados pelas telas. Como os valores são em rem, eles encolhem junto com
 * o font-size da raiz (ver escala responsiva em theme/index.ts -> MuiCssBaseline).
 *
 * Uso:
 *   import { fontSizes } from '../theme/fontSizes';
 *   <Typography sx={{ fontSize: fontSizes.sm }} />
 *   <Box sx={{ fontSize: fontSizes['2xl'] }} />
 *
 * Referência (base 16px): rem * 16 = px.
 */
export const fontSizes = {
  '3xs': '0.625rem', // 10px
  '2xs': '0.6875rem', // 11px
  xs: '0.75rem', // 12px
  sm: '0.8125rem', // 13px
  md: '0.875rem', // 14px
  lg: '0.9375rem', // 15px
  xl: '1rem', // 16px
  '2xl': '1.125rem', // 18px
  '3xl': '1.25rem', // 20px
  '4xl': '1.375rem', // 22px
  '5xl': '1.5rem', // 24px
  '6xl': '1.75rem', // 28px
  '7xl': '2.125rem', // 34px
  '8xl': '2.375rem', // 38px
  '9xl': '3rem', // 48px (títulos de marketing)
} as const;

export type FontSizeToken = keyof typeof fontSizes;
