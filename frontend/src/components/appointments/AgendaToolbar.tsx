import { Box, Button, IconButton, Stack, Typography, useTheme } from '@mui/material';

import { AuroraIcon } from '../AuroraIcon';
import { fontSizes } from '../../theme/fontSizes';
import { AGENDA_CATEGORIES, AGENDA_VIEWS } from './agendaConfig';

const NAV_BUTTON_SX = {
  width: 36,
  height: 36,
  borderRadius: '9px',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.secondary',
  '&:hover': { bgcolor: 'grey.50', borderColor: 'primary.light' },
} as const;

interface AgendaToolbarProps {
  periodLabel: string;
  currentView: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onChangeView: (view: string) => void;
}

/** Toolbar custom (fora do calendário): navegação, "Hoje", visões e legenda de categorias. */
export function AgendaToolbar({ periodLabel, currentView, onPrev, onNext, onToday, onChangeView }: AgendaToolbarProps) {
  const theme = useTheme();
  return (
    <Box
      data-tour="agenda-toolbar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        mb: 1.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
        <Stack direction="row" alignItems="center" spacing={0.25}>
          <IconButton onClick={onPrev} aria-label="Anterior" sx={NAV_BUTTON_SX}>
            <AuroraIcon name="chevronLeft" size={17} strokeWidth={2} />
          </IconButton>
          <Typography
            title={periodLabel}
            noWrap
            sx={{
              fontSize: fontSizes.xl,
              fontWeight: 700,
              px: 1,
              textTransform: 'capitalize',
              textAlign: 'center',
              // Largura fixa: trocar Dia/Semana/Mês não desloca Hoje e as visões.
              width: { xs: 'auto', sm: 280 },
              minWidth: { xs: 90, sm: 280 },
              flexShrink: 0,
            }}
          >
            {periodLabel}
          </Typography>
          <IconButton onClick={onNext} aria-label="Próximo" sx={NAV_BUTTON_SX}>
            <AuroraIcon name="chevronRight" size={17} strokeWidth={2} />
          </IconButton>
        </Stack>
        <Button
          onClick={onToday}
          sx={{
            bgcolor: `${theme.palette.primary.main}1F`,
            color: 'primary.main',
            fontWeight: 700,
            fontSize: fontSizes.sm,
            borderRadius: '10px',
            px: 2,
            '&:hover': { bgcolor: `${theme.palette.primary.main}2E` },
          }}
        >
          Hoje
        </Button>
        <Box sx={{ display: 'flex', gap: '3px', bgcolor: 'grey.100', p: '3px', borderRadius: '10px' }}>
          {AGENDA_VIEWS.map((opt) => {
            const active = currentView === opt.view;
            return (
              <Box
                key={opt.view}
                component="button"
                type="button"
                onClick={() => onChangeView(opt.view)}
                sx={{
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: fontSizes.sm,
                  fontWeight: 700,
                  px: 1.75,
                  py: 0.75,
                  borderRadius: '8px',
                  ...(active
                    ? {
                        bgcolor: 'background.paper',
                        color: 'primary.main',
                        boxShadow: '0 1px 3px rgba(16,40,37,.14)',
                      }
                    : { bgcolor: 'transparent', color: 'text.secondary' }),
                }}
              >
                {opt.label}
              </Box>
            );
          })}
        </Box>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" useFlexGap>
        {AGENDA_CATEGORIES.map((c) => (
          <LegendSwatch key={c.label} color={c.color} label={c.label} />
        ))}
      </Stack>
    </Box>
  );
}

export function LegendSwatch({ color, label }: { color: string | undefined; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.9}>
      <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color, flexShrink: 0 }} />
      <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 600, color: 'text.secondary' }}>
        {label}
      </Typography>
    </Stack>
  );
}
