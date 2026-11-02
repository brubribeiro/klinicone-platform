import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import { Box, Grid, Paper, Stack, Typography, alpha } from '@mui/material';
import { useMemo, type ReactNode } from 'react';

import { useAnamnesisQuestions } from '../../hooks/useAnamnesisQuestions';
import {
  MEASUREMENTS_SECTION,
  anamnesisSections,
  calcIMC,
  formatAnswer,
  hasAnamnesisData,
  hasAnswer,
  imcClassificacao,
  imcColor,
  type AnamnesisSection,
} from './anamnesisFields';
import { fontSizes } from '../../theme/fontSizes';

const SECTION_ICONS: Record<string, ReactNode> = {
  'Medidas corporais': <StraightenOutlinedIcon sx={{ fontSize: 18 }} />,
  'Saúde geral': <AssignmentOutlinedIcon sx={{ fontSize: 18 }} />,
  'Pele e estética': <PersonOutlineIcon sx={{ fontSize: 18 }} />,
  'Queixas e expectativas': <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />,
};

function HeaderIcon({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 1.5,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
        color: 'primary.main',
        flexShrink: 0,
      }}
    >
      {children}
    </Box>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
        <HeaderIcon>{icon}</HeaderIcon>
        <Typography variant="subtitle2" fontWeight={700} letterSpacing="-0.01em">
          {title}
        </Typography>
      </Stack>
      {children}
    </Paper>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <Stack direction="row" spacing={1.5} sx={{ py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 108, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} sx={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function BooleanRow({ label, value }: { label: string; value: boolean }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{
        px: 1.5,
        py: 1,
        minHeight: 40,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value ? 'Sim' : 'Não'}
      </Typography>
    </Stack>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <Box
      sx={{
        py: 4,
        px: 2,
        textAlign: 'center',
        borderRadius: 2,
        border: '1px dashed',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

interface AnamnesisViewProps {
  anamnesis?: Record<string, unknown> | null;
}

/**
 * Respostas salvas cuja pergunta não está mais ativa na anamnese geral (desativada ou movida para a
 * de pele). Só entram chaves que alguma pergunta cadastrada conhece; dados importados soltos ficam de fora.
 */
const PREVIOUS_ANSWERS_SECTION = 'Respostas anteriores';

function previousAnswersSection(
  anamnesis: Record<string, unknown>,
  activeKeys: Set<string>,
  labels: Map<string, string>,
): AnamnesisSection | null {
  const fields = Object.keys(anamnesis)
    .filter((key) => !activeKeys.has(key) && labels.has(key) && hasAnswer(anamnesis[key]))
    .map((key) => ({ key, label: labels.get(key)!, type: 'text' as const }));
  return fields.length ? { title: PREVIOUS_ANSWERS_SECTION, fields } : null;
}

export function AnamnesisView({ anamnesis }: AnamnesisViewProps) {
  const { data: general = [] } = useAnamnesisQuestions('GENERAL');
  const { data: skin = [] } = useAnamnesisQuestions('SKIN');

  const sections = useMemo(() => {
    const active = anamnesisSections(general);
    if (!anamnesis) return active;
    const activeKeys = new Set(active.flatMap((s) => s.fields.map((f) => f.key)));
    const labels = new Map([...skin, ...general].map((q) => [q.key, q.label]));
    const previous = previousAnswersSection(anamnesis, activeKeys, labels);
    return previous ? [...active, previous] : active;
  }, [general, skin, anamnesis]);

  if (!hasAnamnesisData(anamnesis)) {
    return <EmptyBlock message="Nenhuma anamnese registrada." />;
  }

  const imcVal = calcIMC(anamnesis!.peso, anamnesis!.altura);

  return (
    <Stack spacing={2.5}>
      {sections.map((section) => {
        const infoFields = section.fields.filter((f) => f.type !== 'boolean');
        const boolFields = section.fields.filter((f) => f.type === 'boolean');
        const isMedidas = section.title === MEASUREMENTS_SECTION;
        return (
          <Paper
            key={section.title}
            variant="outlined"
            sx={{
              p: { xs: 1.75, sm: 2.25 },
              borderRadius: '16px',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: '0 1px 2px rgba(16,40,37,0.03)',
            }}
          >
            <Typography
              sx={{
                fontSize: fontSizes.xs,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'text.disabled',
                mb: 1.75,
              }}
            >
              {section.title}
            </Typography>
            {section.title === PREVIOUS_ANSWERS_SECTION && (
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mt: -1, mb: 1.75 }}>
                Perguntas que saíram da anamnese geral (desativadas ou movidas para a anamnese de pele).
              </Typography>
            )}

            {infoFields.length > 0 && (
              <Grid container spacing={2}>
                {infoFields.map((field) => {
                  const filled = hasAnswer(anamnesis![field.key]);
                  return (
                    <Grid item key={field.key} xs={12} sm={field.fullWidth ? 12 : 6}>
                      <Typography
                        sx={{
                          fontSize: fontSizes['2xs'],
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: 'text.disabled',
                          mb: 0.25,
                        }}
                      >
                        {field.label}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: fontSizes.md,
                          fontWeight: 600,
                          lineHeight: 1.45,
                          whiteSpace: 'pre-wrap',
                          color: filled ? 'text.primary' : 'text.disabled',
                        }}
                      >
                        {filled ? formatAnswer(field, anamnesis![field.key]) : '—'}
                      </Typography>
                    </Grid>
                  );
                })}
              </Grid>
            )}

            {isMedidas && imcVal != null && (
              <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', mt: infoFields.length > 0 ? 1.5 : 0 }}>
                IMC:{' '}
                <Box component="span" sx={{ fontWeight: 800, color: imcColor(imcVal) }}>
                  {imcVal} · {imcClassificacao(imcVal)}
                </Box>
              </Typography>
            )}

            {boolFields.length > 0 && (
              <Grid container spacing={1.5} sx={{ mt: infoFields.length > 0 ? 1.75 : 0 }}>
                {boolFields.map((field) => {
                  const yes = !!anamnesis![field.key];
                  return (
                    <Grid item key={field.key} xs={12} sm={6}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          px: 1.5,
                          py: 1.1,
                          borderRadius: '11px',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'grey.50',
                        }}
                      >
                        <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>{field.label}</Typography>
                        <Box
                          component="span"
                          sx={{
                            flexShrink: 0,
                            fontSize: fontSizes.xs,
                            fontWeight: 800,
                            px: 1.1,
                            py: 0.35,
                            borderRadius: '8px',
                            color: yes ? 'error.dark' : 'success.dark',
                            bgcolor: (t) => alpha(yes ? t.palette.error.main : t.palette.success.main, 0.14),
                          }}
                        >
                          {yes ? 'Sim' : 'Não'}
                        </Box>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}

export { hasAnamnesisData };
