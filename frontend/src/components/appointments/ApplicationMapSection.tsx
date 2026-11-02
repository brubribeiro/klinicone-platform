import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { fontSizes } from '../../theme/fontSizes';
import type { ApplicationMapPoint } from '../../types';
import { ApplicationMapDiagram } from '../application-map/ApplicationMapDiagram';
import { AppointmentFormSection } from './AppointmentFormSection';
import type { SectionControl } from './PatientSection';

export function ApplicationMapSection({
  section,
  points,
  setPoints,
}: {
  section: SectionControl;
  points: ApplicationMapPoint[];
  setPoints: Dispatch<SetStateAction<ApplicationMapPoint[]>>;
}) {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [selected, setSelected] = useState<number | null>(null);
  /** Só o ponto recém-marcado recebe foco (no celular o teclado cobriria o desenho). */
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const summary =
    points.length === 0
      ? 'Nenhum ponto marcado'
      : `${points.length} ${points.length === 1 ? 'ponto marcado' : 'pontos marcados'}`;

  const removePoint = (index: number) => {
    setPoints((rows) => rows.filter((_, i) => i !== index));
    setSelected(null);
    setFocusIndex(null);
  };

  return (
    <AppointmentFormSection
      {...section}
      title="Mapa de aplicação"
      summary={summary}
      action={
        points.length > 0 ? (
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              setPoints([]);
              setSelected(null);
            }}
            sx={{ color: 'text.secondary' }}
          >
            Limpar
          </Button>
        ) : undefined
      }
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'center', sm: 'flex-start' }}>
        <ApplicationMapDiagram
          points={points}
          width={isMobile ? 220 : 240}
          selectedIndex={selected}
          onSelect={setSelected}
          onAdd={(point) => {
            setPoints((rows) => [...rows, point]);
            setSelected(points.length);
            setFocusIndex(isMobile ? null : points.length);
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} component="p" sx={{ mb: 1 }}>
            Clique no rosto para marcar cada ponto de aplicação e anote produto ou dose.
          </Typography>
          {points.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum ponto marcado neste atendimento.
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ maxHeight: 280, overflowY: 'auto', pr: 0.5, pt: 0.75 }}>
              {points.map((p, index) => (
                <Stack key={index} direction="row" spacing={1} alignItems="center">
                  <Box
                    component="button"
                    type="button"
                    aria-label={`Destacar ponto ${index + 1} no mapa`}
                    onClick={() => setSelected(index)}
                    sx={{
                      width: 26,
                      height: 26,
                      flexShrink: 0,
                      border: 0,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontSize: fontSizes.xs,
                      fontWeight: 800,
                      color: '#fff',
                      bgcolor: 'primary.main',
                      boxShadow: (t) =>
                        selected === index ? `0 0 0 3px ${alpha(t.palette.primary.main, 0.3)}` : 'none',
                    }}
                  >
                    {index + 1}
                  </Box>
                  <TextField
                    size="small"
                    fullWidth
                    label={`Ponto ${index + 1}`}
                    placeholder="Produto / dose (ex.: Toxina 4U)"
                    value={p.note ?? ''}
                    autoFocus={focusIndex === index}
                    inputProps={{ maxLength: 120 }}
                    onFocus={() => setSelected(index)}
                    onChange={(e) => {
                      const note = e.target.value;
                      setPoints((rows) => rows.map((r, i) => (i === index ? { ...r, note } : r)));
                    }}
                  />
                  <Tooltip title="Remover ponto">
                    <IconButton
                      aria-label={`Remover ponto ${index + 1}`}
                      size="small"
                      onClick={() => removePoint(index)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </AppointmentFormSection>
  );
}
