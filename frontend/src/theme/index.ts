import { createTheme } from '@mui/material/styles';
import { ptBR } from '@mui/material/locale';
import { fontSizes } from './fontSizes';

const baseTheme = createTheme();

export type ColorMode = 'light' | 'dark';
export type ThemeVariant = 'clinic' | 'console';

// Acento do Console KlinicOne (índigo), no lugar do verde-água da clínica.
const CONSOLE_ACCENT = {
  light: { primary: '#4F5BD5', primaryStrong: '#3B44A8', primarySoft: '#E0E3FA', primaryTint: '#EEF0FC', accent: '#7C86E8' },
  dark: { primary: '#6670E0', primaryStrong: '#A9B0F5', primarySoft: '#272B54', primaryTint: '#1E2244', accent: '#8F98F0' },
};

// Tokens do protótipo Aurora (claro). A paleta escura é derivada do mesmo verde-água,
// com superfícies em verde quase preto e textos claros.
const AURORA = {
  light: {
    primary: '#15998B',
    primaryStrong: '#0E7C7B',
    primarySoft: '#D8EFEB',
    primaryTint: '#EAF6F4',
    accent: '#5BC4B8',
    bg: '#EAF1EF',
    surface: '#FFFFFF',
    surface2: '#F3F8F6',
    surface3: '#ECF3F1',
    border: '#E0E8E5',
    borderSoft: '#EAF0EE',
    borderStrong: '#C8CFCC',
    text: '#0F1C1A',
    textMuted: '#5C6F6B',
    textSoft: '#94A4A0',
    shadow: '0 1px 2px rgba(16,40,37,.04),0 8px 24px -12px rgba(16,40,37,.10)',
    shadowLg: '0 8px 40px -16px rgba(16,40,37,.22)',
  },
  dark: {
    primary: '#15998B',
    primaryStrong: '#5FD3C6', // usado como "texto forte" sobre fundos tingidos: no escuro fica mais claro
    primarySoft: '#1B3F3A',
    primaryTint: '#163430',
    accent: '#5BC4B8',
    bg: '#0A1413',
    surface: '#111F1D',
    surface2: '#162623',
    surface3: '#1B2D2A',
    border: '#253B37',
    borderSoft: '#1D302D',
    borderStrong: '#34504B',
    text: '#E4EEEB',
    textMuted: '#A0B3AE',
    textSoft: '#6E837E',
    shadow: '0 1px 2px rgba(0,0,0,.3),0 8px 24px -12px rgba(0,0,0,.55)',
    shadowLg: '0 8px 40px -16px rgba(0,0,0,.7)',
  },
};

// Cores de status: no escuro o "dark" vira o tom mais claro, porque as telas usam
// `<cor>.dark` como texto sobre fundo tingido (pílulas, chips).
const STATUS = {
  light: {
    secondary: { main: '#8B8680', light: '#B5B1AC', dark: '#5C5854' },
    success: { main: '#5A9A7D', light: '#8FBFA8', dark: '#3F7058' },
    warning: { main: '#C99230', light: '#E0B065', dark: '#8E6620' },
    error: { main: '#C25A4C', light: '#D58A81', dark: '#8A3F33' },
    info: undefined,
  },
  dark: {
    secondary: { main: '#9C978F', light: '#5C5854', dark: '#CFCBC6' },
    success: { main: '#62A887', light: '#3F7058', dark: '#9ED3B9' },
    warning: { main: '#D29D3E', light: '#8E6620', dark: '#EBC27A' },
    error: { main: '#D06A5C', light: '#8A3F33', dark: '#F0A399' },
    info: { main: '#4C9BE0', light: '#2F6FA0', dark: '#9CCBF2' },
  },
};

// Alturas padrão dos controles (knobs únicos).
const CONTROL_HEIGHT = 32; // inputs e selects (compacto)
const BUTTON_HEIGHT = 38; // botões: altura única para todos

export function createAppTheme(mode: ColorMode, variant: ThemeVariant = 'clinic') {
  const aurora = variant === 'console' ? { ...AURORA[mode], ...CONSOLE_ACCENT[mode] } : AURORA[mode];
  const status = STATUS[mode];
  const dark = mode === 'dark';

  return createTheme(
    {
      palette: {
        mode,
        primary: {
          main: aurora.primary,
          light: aurora.accent,
          dark: aurora.primaryStrong,
          contrastText: '#FFFFFF',
        },
        secondary: { ...status.secondary, contrastText: '#FFFFFF' },
        success: status.success,
        warning: status.warning,
        error: status.error,
        ...(status.info && { info: status.info }),
        background: {
          default: aurora.bg,
          paper: aurora.surface,
        },
        text: {
          primary: aurora.text,
          secondary: aurora.textMuted,
          ...(dark && { disabled: aurora.textSoft }),
        },
        divider: aurora.border,
        // As telas usam grey.50/100 como superfícies tingidas e grey.200 como borda;
        // no escuro a escala é invertida para manter esse papel.
        grey: dark
          ? {
              50: aurora.surface2,
              100: aurora.surface3,
              200: aurora.border,
              300: aurora.borderStrong,
              400: '#4E6661',
              500: '#6E837E',
              600: aurora.textMuted,
              700: '#BFCDC9',
              800: '#D6E1DE',
              900: aurora.text,
            }
          : {
              50: aurora.surface2,
              100: aurora.surface3,
              200: aurora.border,
              300: aurora.borderStrong,
              400: '#A6B0AC',
              500: '#8B8680',
              600: aurora.textMuted,
              700: '#3F4E4A',
              800: '#2A3835',
              900: aurora.text,
            },
      },
      typography: {
        fontFamily: '"Plus Jakarta Sans", "Helvetica", "Arial", sans-serif',
        h1: { fontWeight: 800, letterSpacing: '-0.5px' },
        h2: { fontWeight: 800, letterSpacing: '-0.5px' },
        h3: {
          fontWeight: 800,
          letterSpacing: '-0.4px',
          [baseTheme.breakpoints.down('sm')]: { fontSize: fontSizes['5xl'] },
        },
        h4: {
          fontWeight: 700,
          letterSpacing: '-0.3px',
          [baseTheme.breakpoints.down('sm')]: { fontSize: fontSizes['4xl'] },
        },
        h5: {
          fontWeight: 700,
          [baseTheme.breakpoints.down('sm')]: { fontSize: fontSizes['2xl'] },
        },
        h6: { fontWeight: 700 },
        button: { textTransform: 'none', fontWeight: 700 },
      },
      shape: { borderRadius: 12 },
      components: {
        MuiCssBaseline: {
          defaultProps: { enableColorScheme: true },
          styleOverrides: {
            // Knob global da tipografia: como toda a UI usa rem, este font-size
            // da raiz controla o tamanho de TODAS as fontes de uma vez. Baixe o
            // valor base para deixar tudo menor em qualquer tela; os breakpoints
            // reduzem mais em telas menores. (Padrão do navegador = 16px.)
            html: {
              fontSize: '13px', // base compacta (telas pequenas, <900px)
              [baseTheme.breakpoints.up('md')]: { fontSize: '14px' }, // >=900
              [baseTheme.breakpoints.up('lg')]: { fontSize: '15px' }, // >=1200
              [baseTheme.breakpoints.up('xl')]: { fontSize: '16px' }, // >=1536: volta ao tamanho original
            },
            '*': {
              scrollbarWidth: 'thin',
              scrollbarColor: `${aurora.border} transparent`,
            },
            // Foco visível só para navegação por teclado (não aparece no clique).
            'button:focus-visible, a:focus-visible, [role="button"]:focus-visible, [tabindex]:not([tabindex="-1"]):focus-visible':
              {
                outline: `2px solid ${aurora.primary}`,
                outlineOffset: 2,
              },
            '*::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '*::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '*::-webkit-scrollbar-thumb': {
              backgroundColor: aurora.border,
              borderRadius: 8,
              border: '2px solid transparent',
              backgroundClip: 'content-box',
            },
            '*::-webkit-scrollbar-thumb:hover': {
              backgroundColor: aurora.borderStrong,
            },
          },
        },
        MuiButton: {
          // Controles compactos por padrão. Botões sem size explícito ficam ~32px.
          defaultProps: { size: 'small' },
          styleOverrides: {
            root: { boxShadow: 'none', borderRadius: 12 },
            // Todos os botões com a mesma altura (BUTTON_HEIGHT = 38px).
            sizeSmall: {
              minHeight: BUTTON_HEIGHT,
              paddingTop: 4,
              paddingBottom: 4,
              paddingLeft: 12,
              paddingRight: 12,
              fontSize: fontSizes.md,
            },
            sizeMedium: { minHeight: BUTTON_HEIGHT },
            sizeLarge: { minHeight: BUTTON_HEIGHT },
            containedPrimary: {
              backgroundColor: aurora.primary,
              '&:hover': {
                backgroundColor: aurora.primaryStrong,
                boxShadow: `0 6px 16px -6px ${aurora.primary}`,
              },
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: { backgroundImage: 'none' },
          },
        },
        // No escuro a MUI usa grey[700]/grey[300] nestes componentes; com a escala
        // invertida eles ficariam claros, então as cores são fixadas aqui.
        MuiTooltip: {
          styleOverrides: {
            tooltip: dark ? { backgroundColor: 'rgba(46,68,64,.96)', color: aurora.text } : {},
          },
        },
        MuiChip: {
          styleOverrides: {
            outlinedPrimary: {
              borderColor: aurora.primary,
              color: aurora.primaryStrong,
            },
          },
          variants: dark
            ? [{ props: { color: 'default', variant: 'filled' }, style: { backgroundColor: aurora.surface3 } }]
            : [],
        },
        MuiSwitch: {
          styleOverrides: dark
            ? {
                switchBase: { '&:not(.Mui-checked) .MuiSwitch-thumb': { backgroundColor: '#C9D6D2' } },
                track: { backgroundColor: '#5C726D' },
              }
            : {},
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              boxShadow: dark ? `0 1px 0 ${aurora.border}` : '0 1px 0 rgba(16,40,37,0.05)',
              backgroundColor: aurora.surface,
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 18,
              border: `1px solid ${aurora.border}`,
              boxShadow: aurora.shadow,
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              '&.Mui-selected': {
                backgroundColor: aurora.primaryTint,
                color: aurora.primaryStrong,
                '& .MuiListItemIcon-root': { color: aurora.primary },
                '&:hover': { backgroundColor: aurora.primarySoft },
              },
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 11,
              backgroundColor: aurora.surface2,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: aurora.border },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: aurora.primaryStrong },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: aurora.primary,
                borderWidth: 1,
              },
            },
            // Input de uma linha em size small -> altura compacta ~32px.
            // Textareas (multiline) mantêm o padding padrão para crescer com as linhas.
            inputSizeSmall: {
              '&:not(.MuiInputBase-inputMultiline)': {
                paddingTop: 6,
                paddingBottom: 6,
              },
            },
            input: {
              fontSize: fontSizes.md,
              '&:-webkit-autofill': {
                WebkitBoxShadow: `0 0 0 1000px ${aurora.surface2} inset`,
                WebkitTextFillColor: aurora.text,
                caretColor: aurora.text,
              },
              '&:-webkit-autofill:hover': {
                WebkitBoxShadow: `0 0 0 1000px ${aurora.surface2} inset`,
              },
              '&:-webkit-autofill:focus': {
                WebkitBoxShadow: `0 0 0 1000px ${aurora.surface2} inset`,
              },
              '&:autofill': {
                boxShadow: `0 0 0 1000px ${aurora.surface2} inset`,
                WebkitTextFillColor: aurora.text,
              },
            },
          },
        },
        MuiTextField: {
          // Todos os campos compactos por padrão (altura ~32px via OutlinedInput).
          defaultProps: { size: 'small' },
        },
        MuiSelect: {
          defaultProps: { size: 'small' },
        },
        MuiMenuItem: {
          styleOverrides: {
            root: { fontSize: fontSizes.md },
          },
        },
        MuiAutocomplete: {
          styleOverrides: {
            option: { fontSize: fontSizes.md },
            input: { fontSize: fontSizes.md },
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: {
              '& .MuiTableCell-head': {
                backgroundColor: aurora.surface2,
                fontWeight: 700,
                fontSize: fontSizes.xs,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: aurora.textMuted,
                borderBottom: `1px solid ${aurora.border}`,
              },
            },
          },
        },
        MuiTableRow: {
          styleOverrides: {
            root: {
              transition: 'background-color 0.15s ease',
              '&:nth-of-type(even)': {
                backgroundColor: dark ? 'rgba(21, 153, 139, 0.05)' : 'rgba(21, 153, 139, 0.025)',
              },
              '&:hover': {
                backgroundColor: dark ? 'rgba(21, 153, 139, 0.12)' : 'rgba(21, 153, 139, 0.07)',
              },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              borderBottom: `1px solid ${aurora.borderSoft}`,
              fontSize: fontSizes.md,
            },
          },
        },
      },
    },
    ptBR,
  );
}
