import { Box, Stack, Typography } from '@mui/material';

import type { ApplicationMap } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { ApplicationMapDiagram } from './ApplicationMapDiagram';

/** Mapa de aplicação do atendimento (somente leitura) para a ficha do paciente. */
export function ApplicationMapPreview({ map }: { map: ApplicationMap }) {
  return (
    <Box sx={{ mt: 1.25, pt: 1.25, borderTop: 1, borderColor: 'divider' }}>
      <Box
        component="b"
        sx={{ display: 'block', mb: 0.75, color: 'text.disabled', fontSize: fontSizes['2xs'], letterSpacing: '0.3px' }}
      >
        MAPA DE APLICAÇÃO · {map.points.length} {map.points.length === 1 ? 'PONTO' : 'PONTOS'}
      </Box>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <ApplicationMapDiagram points={map.points} width={132} />
        <Stack component="ol" spacing={0.4} sx={{ m: 0, p: 0, listStyle: 'none', minWidth: 0 }}>
          {map.points.map((p, i) => (
            <Typography
              key={i}
              component="li"
              sx={{ fontSize: fontSizes.xs, color: 'text.secondary', lineHeight: 1.45 }}
            >
              <Box component="b" sx={{ color: 'primary.main', mr: 0.5 }}>
                {i + 1}.
              </Box>
              {p.note || 'Sem anotação'}
            </Typography>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
