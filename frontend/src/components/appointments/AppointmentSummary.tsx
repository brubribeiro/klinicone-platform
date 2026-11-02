import type { ReactNode } from 'react';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import { fontSizes } from '../../theme/fontSizes';
import { STATUS_DOT, STATUS_LABEL, brl } from './appointmentFormModel';

/** Promoção ativa no dia do atendimento (prévia antes de concluir). */
export interface PromotionSummary {
  name: string;
  originalPrice: number;
  discount: number;
}

/** Linhas "valor cheio" e "desconto" exibidas acima do valor final. */
export function PromotionPriceLines({ promotion }: { promotion: PromotionSummary }) {
  const lineSx = { fontSize: fontSizes.xs, color: 'text.secondary' } as const;
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography sx={lineSx}>Valor cheio</Typography>
        <Typography sx={{ ...lineSx, textDecoration: 'line-through' }}>
          {brl.format(promotion.originalPrice)}
        </Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography sx={{ ...lineSx, color: 'success.main', fontWeight: 700, minWidth: 0 }} noWrap>
          Promoção · {promotion.name}
        </Typography>
        <Typography sx={{ ...lineSx, color: 'success.main', fontWeight: 700, flexShrink: 0 }}>
          −{brl.format(promotion.discount)}
        </Typography>
      </Stack>
    </Stack>
  );
}

export interface AppointmentSummaryData {
  patientName?: string;
  serviceLabel: string;
  professionalName?: string;
  dateLabel?: string;
  timeLabel?: string;
  durationMinutes?: number;
  packageLabel: string;
  amount: number;
  promotion?: PromotionSummary;
  status?: string;
  blockingMessage: string | null;
  stockWarning: boolean;
}

function SummaryRow({ label, value, muted }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: fontSizes['3xs'],
          fontWeight: 700,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: fontSizes.sm,
          fontWeight: 700,
          color: muted ? 'text.disabled' : 'text.primary',
          mt: 0.25,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** Resumo fixo na lateral (telas largas). */
export function AppointmentSummaryPanel({
  data,
  children,
}: {
  data: AppointmentSummaryData;
  children?: ReactNode;
}) {
  return (
    <Stack spacing={1.5} sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
      {children}
      <Paper
        variant="outlined"
        sx={{
          p: 1.75,
          borderRadius: '14px',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: '0 1px 2px rgba(16,40,37,0.03)',
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: fontSizes.xs,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            mb: 1.5,
          }}
        >
          Resumo
        </Typography>
        <Stack spacing={1.25}>
          <SummaryRow label="Paciente" value={data.patientName ?? 'Não selecionado'} muted={!data.patientName} />
          <SummaryRow label="Atendimento" value={data.serviceLabel} />
          <SummaryRow
            label="Profissional"
            value={data.professionalName ?? 'Não definido'}
            muted={!data.professionalName}
          />
          <SummaryRow
            label="Data e horário"
            value={
              data.dateLabel ? (
                <>
                  {data.dateLabel}
                  <Box component="span" sx={{ display: 'block', fontWeight: 600, color: 'text.secondary' }}>
                    {data.timeLabel}
                    {data.durationMinutes ? ` · ${data.durationMinutes} min` : ''}
                  </Box>
                </>
              ) : (
                'Data ou horário inválidos'
              )
            }
            muted={!data.dateLabel}
          />
          <SummaryRow label="Pacote" value={data.packageLabel} />
          {data.status && (
            <SummaryRow
              label="Status"
              value={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    component="span"
                    sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_DOT[data.status] ?? 'grey.400' }}
                  />
                  {STATUS_LABEL[data.status] ?? data.status}
                </Box>
              }
            />
          )}
        </Stack>
        {data.promotion && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
            <PromotionPriceLines promotion={data.promotion} />
          </Box>
        )}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            mt: data.promotion ? 0.75 : 1.5,
            pt: data.promotion ? 0 : 1.5,
            borderTop: data.promotion ? 'none' : '1px dashed',
            borderColor: 'divider',
          }}
        >
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>Valor previsto</Typography>
          <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 800, color: 'primary.dark' }}>
            {data.amount > 0 ? brl.format(data.amount) : '—'}
          </Typography>
        </Stack>
      </Paper>
      {data.stockWarning && (
        <Alert severity="warning" sx={{ flexShrink: 0 }}>
          Estoque insuficiente para os materiais deste atendimento.
        </Alert>
      )}
      {data.blockingMessage && (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {data.blockingMessage}
        </Alert>
      )}
    </Stack>
  );
}

/** Resumo compacto acima do rodapé (celular e tablet). */
export function AppointmentSummaryBar({ data }: { data: AppointmentSummaryData }) {
  const when = data.dateLabel ? `${data.dateLabel} · ${data.timeLabel}` : 'Data ou horário inválidos';
  const problem = data.blockingMessage ?? (data.stockWarning ? 'Estoque insuficiente para os materiais.' : null);

  return (
    <Box
      sx={{
        px: { xs: 1.5, sm: 3 },
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flexShrink: 0,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{ fontSize: fontSizes.sm, fontWeight: 800 }}>
            {data.patientName ?? 'Paciente não selecionado'}
            <Box component="span" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              {' · '}
              {data.serviceLabel}
            </Box>
          </Typography>
          <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
            {when}
            {data.professionalName ? ` · ${data.professionalName}` : ''}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800, color: 'primary.dark' }}>
            {data.amount > 0 ? brl.format(data.amount) : ''}
          </Typography>
          {data.promotion && (
            <Typography sx={{ fontSize: fontSizes['3xs'], fontWeight: 700, color: 'success.main' }}>
              Promoção −{brl.format(data.promotion.discount)}
            </Typography>
          )}
        </Box>
      </Stack>
      {problem && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5, color: data.blockingMessage ? 'error.main' : 'warning.dark' }}>
          <WarningAmberRoundedIcon sx={{ fontSize: 15 }} />
          <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 700 }}>{problem}</Typography>
        </Stack>
      )}
    </Box>
  );
}
