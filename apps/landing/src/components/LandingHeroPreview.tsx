import { Box, Stack, Typography } from '@mui/material';

import { AuroraIcon } from '../../../../frontend/src/components/AuroraIcon';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';

// Dados ilustrativos (não vêm da API): só para mostrar o produto no hero
const SAMPLE_APPOINTMENTS = [
  { time: '09:00', initials: 'AC', name: 'Ana Carolina', procedure: 'Limpeza de pele', status: 'Confirmado', color: '#5A9A7D' },
  { time: '10:30', initials: 'JM', name: 'Juliana Melo', procedure: 'Toxina botulínica', status: 'Em atendimento', color: '#15998B' },
  { time: '14:00', initials: 'RS', name: 'Renata Souza', procedure: 'Peeling químico', status: 'Agendado', color: '#C99230' },
];

/** Miniatura do painel (agenda do dia + faturamento) desenhada em CSS, sem captura de tela. */
export function LandingHeroPreview() {
  return (
    <Box aria-hidden="true" sx={{ position: 'relative', width: '100%', maxWidth: 440, mx: 'auto' }}>
      <Box
        sx={{
          bgcolor: '#fff',
          color: '#0F1C1A',
          borderRadius: '20px',
          p: { xs: 2, sm: 2.5 },
          boxShadow: '0 30px 70px -24px rgba(0,0,0,.55)',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ color: '#0E7C7B' }}>
            <AuroraIcon name="agenda" size={18} />
            <Typography sx={{ fontWeight: 800, fontSize: fontSizes.lg, color: '#0F1C1A' }}>Agenda de hoje</Typography>
          </Stack>
          <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 700, color: '#5C6F6B' }}>3 atendimentos</Typography>
        </Stack>
        <Stack spacing={1.25}>
          {SAMPLE_APPOINTMENTS.map((a) => (
            <Stack
              key={a.time}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ p: 1.25, borderRadius: '12px', bgcolor: '#F3F8F6', border: '1px solid #E0E8E5' }}
            >
              <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800, color: '#0E7C7B', width: 42, flexShrink: 0 }}>
                {a.time}
              </Typography>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: '#D8EFEB',
                  color: '#0E7C7B',
                  fontSize: fontSizes['2xs'],
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {a.initials}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>
                  {a.name}
                </Typography>
                <Typography noWrap sx={{ fontSize: fontSizes.xs, color: '#5C6F6B' }}>
                  {a.procedure}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  px: 1,
                  py: 0.25,
                  borderRadius: '999px',
                  fontSize: fontSizes['2xs'],
                  fontWeight: 700,
                  color: a.color,
                  bgcolor: `${a.color}1F`,
                  whiteSpace: 'nowrap',
                }}
              >
                {a.status}
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          // No celular fica abaixo da agenda; a partir de sm flutua sobre o canto, só no padding do card
          position: { xs: 'relative', sm: 'absolute' },
          width: 'fit-content',
          ml: { xs: 'auto', sm: 0 },
          mr: { xs: 1, sm: 0 },
          mt: { xs: -1.5, sm: 0 },
          right: { sm: -28 },
          bottom: { sm: -54 },
          bgcolor: '#fff',
          color: '#0F1C1A',
          borderRadius: '16px',
          px: 2,
          py: 1.5,
          boxShadow: '0 20px 50px -20px rgba(0,0,0,.6)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AuroraIcon name="relatorios" size={18} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: fontSizes['2xs'], fontWeight: 700, color: '#5C6F6B', textTransform: 'uppercase', letterSpacing: '.6px' }}>
            Faturamento do mês
          </Typography>
          <Typography sx={{ fontSize: fontSizes['2xl'], fontWeight: 800 }}>
            R$ 18.420{' '}
            <Box component="span" sx={{ fontSize: fontSizes.xs, color: '#3F7058' }}>
              +12%
            </Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
