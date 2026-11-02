import { useMemo } from 'react';
import { Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { financeApi } from '../../api/finance';
import type { FinancialEntry } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { formatDateOnlyFromApi } from '../../utils/dateOnly';
import { brl } from '../../utils/money';
import { FinancePill } from '../finance/FinanceKpiCard';
import { EmptyBlock } from './EmptyBlock';

const RECENT_LIMIT = 8;

/** Resumo financeiro do paciente a partir de GET /finance?patientId= (lançamentos de todos os períodos). */
export function PatientFinanceTab({ patientId }: { patientId: string }) {
  const theme = useTheme();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['finance', 'patient', patientId],
    queryFn: () => financeApi.list(undefined, undefined, false, undefined, patientId),
    placeholderData: keepPreviousData,
  });

  const summary = useMemo(() => {
    let received = 0;
    let pending = 0;
    let pendingCount = 0;
    let lastPaidAt: string | undefined;
    for (const e of entries) {
      if (e.type !== 'INCOME') continue;
      const amount = Number(e.amount);
      if (e.paidAt) {
        received += amount;
        if (!lastPaidAt || e.paidAt > lastPaidAt) lastPaidAt = e.paidAt;
      } else {
        pending += amount;
        pendingCount += 1;
      }
    }
    return { received, pending, pendingCount, lastPaidAt };
  }, [entries]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const stats = [
    { label: 'recebido', value: brl.format(summary.received), tone: theme.palette.success.dark },
    {
      label: summary.pendingCount === 1 ? '1 a receber' : `${summary.pendingCount} a receber`,
      value: brl.format(summary.pending),
      tone: summary.pending > 0 ? theme.palette.warning.dark : theme.palette.text.primary,
    },
    {
      label: 'último pagamento',
      value: summary.lastPaidAt ? formatDateOnlyFromApi(summary.lastPaidAt) : '—',
      tone: theme.palette.text.primary,
    },
  ];

  const recent = entries.slice(0, RECENT_LIMIT);

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
        {stats.map((stat) => (
          <Box
            key={stat.label}
            sx={{ textAlign: 'center', p: 1.5, borderRadius: '14px', border: 1, borderColor: 'divider', bgcolor: 'grey.50' }}
          >
            <Typography noWrap sx={{ fontSize: '1.1rem', fontWeight: 800, color: stat.tone, fontVariantNumeric: 'tabular-nums' }}>
              {stat.value}
            </Typography>
            <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', fontWeight: 600, mt: 0.25 }}>
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {entries.length === 0 ? (
        <EmptyBlock message="Nenhum lançamento financeiro vinculado." />
      ) : (
        <>
          <Typography
            sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', pt: 0.5 }}
          >
            Lançamentos recentes
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: '14px', borderColor: 'divider', overflow: 'hidden' }}>
            {recent.map((entry, i) => (
              <EntryRow key={entry.id} entry={entry} last={i === recent.length - 1} />
            ))}
          </Paper>
          {entries.length > RECENT_LIMIT && (
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
              Mostrando {RECENT_LIMIT} de {entries.length} lançamentos.
            </Typography>
          )}
        </>
      )}
    </Stack>
  );
}

function EntryRow({ entry, last }: { entry: FinancialEntry; last: boolean }) {
  const theme = useTheme();
  const isIncome = entry.type === 'INCOME';
  const paid = !!entry.paidAt;
  const refDate = entry.paidAt ?? entry.dueDate;
  const meta = [
    refDate ? `${paid ? '' : 'vence '}${formatDateOnlyFromApi(refDate)}` : null,
    entry.paymentMethod?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{ px: 2, py: 1.25, borderBottom: last ? 0 : 1, borderColor: 'grey.100' }}
    >
      <Box sx={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <Typography noWrap title={entry.description} sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>
          {entry.description}
        </Typography>
        {meta && (
          <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
            {meta}
          </Typography>
        )}
      </Box>
      <FinancePill tone={paid ? theme.palette.success.main : theme.palette.warning.main}>
        {paid ? 'Pago' : 'Pendente'}
      </FinancePill>
      <Typography
        sx={{
          fontSize: fontSizes.sm,
          fontWeight: 800,
          flexShrink: 0,
          minWidth: 92,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: isIncome ? 'text.primary' : 'error.main',
        }}
      >
        {isIncome ? '' : '− '}
        {brl.format(Number(entry.amount))}
      </Typography>
    </Stack>
  );
}
