import { Box, ButtonBase, Stack, Typography, alpha } from '@mui/material';

import { fontSizes } from '../../theme/fontSizes';

/** Atalho para o mapa de aplicação do agendamento (abre o editor em outra modal). */
export function ApplicationMapShortcut({
  pointsCount,
  strokesCount = 0,
  onClick,
}: {
  pointsCount: number;
  strokesCount?: number;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.25,
        px: 1.9,
        py: 1.6,
        borderRadius: '13px',
        border: 1,
        borderColor: (t) => alpha(t.palette.primary.main, 0.2),
        bgcolor: (t) => alpha(t.palette.primary.main, 0.09),
        width: '100%',
        textAlign: 'left',
        flexShrink: 0,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.4} sx={{ minWidth: 0 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            bgcolor: 'background.paper',
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="9" r="6" />
            <path d="M12 15v6M9 19h6" />
          </svg>
        </Box>
        <Box sx={{ lineHeight: 1.25, minWidth: 0 }}>
          <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800 }}>Mapa de aplicação</Typography>
          <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary' }}>
            {pointsCount === 0 && strokesCount === 0
              ? 'Marcar pontos e desenhar no rosto ou corpo'
              : [
                  pointsCount > 0 && `${pointsCount} ${pointsCount === 1 ? 'ponto marcado' : 'pontos marcados'}`,
                  strokesCount > 0 && `${strokesCount} ${strokesCount === 1 ? 'desenho' : 'desenhos'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ color: 'primary.main', display: 'flex' }}>
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Box>
    </ButtonBase>
  );
}
