import { useState } from 'react';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import dayjs from 'dayjs';

import { AppointmentsTab } from '../components/metrics/AppointmentsTab';
import { FinancialTab } from '../components/metrics/FinancialTab';
import { TAB_COLORS, TABS, type MetricsTab } from '../components/metrics/metricsConfig';
import { buildMetricsCsvRows, METRICS_CSV_HEADERS } from '../components/metrics/metricsCsv';
import { PackagesTab } from '../components/metrics/PackagesTab';
import { PatientsTab } from '../components/metrics/PatientsTab';
import { PeriodFilter } from '../components/metrics/PeriodFilter';
import { ProceduresTab } from '../components/metrics/ProceduresTab';
import { SummaryKpis } from '../components/metrics/SummaryKpis';
import { TabPill } from '../components/metrics/TabPill';
import { useMetricsData } from '../components/metrics/useMetricsData';
import { PageHeader } from '../components/PageHeader';
import { useAppToast } from '../contexts/AppToastContext';
import { usePermissions } from '../contexts/usePermissions';
import { fontSizes } from '../theme/fontSizes';
import { downloadCsv } from '../utils/csv';

function TabLoading() {
  return (
    <Box display="flex" justifyContent="center" py={8}>
      <CircularProgress />
    </Box>
  );
}

export function Metrics() {
  const { has } = usePermissions();
  const canSeeFinance = has('finance:view');
  const [tab, setTab] = useState<MetricsTab>('appointments');
  const [dateFrom, setDateFrom] = useState(() => dayjs().startOf('month').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(() => dayjs().format('YYYY-MM-DD'));

  const toast = useAppToast();
  const {
    datesValid,
    periodDays,
    data,
    previousData,
    error,
    metricsLoading,
    metricsStale,
    financeEntries,
    financeLoading,
    financeStale,
  } = useMetricsData(dateFrom, dateTo, canSeeFinance);
  const color = TAB_COLORS[tab];
  const canExport =
    datesValid && !!data && !metricsStale && (tab !== 'finance' || (!financeLoading && !financeStale));

  const exportCsv = () => {
    if (!data) return;
    const ok = downloadCsv(
      `metricas-${TABS.find((t) => t.value === tab)?.label.toLowerCase() ?? tab}-${dateFrom}_${dateTo}.csv`,
      buildMetricsCsvRows({ tab, dateFrom, dateTo, data, previous: previousData, financeEntries }),
      METRICS_CSV_HEADERS,
    );
    if (!ok) toast.info('Nenhuma métrica para exportar.');
  };

  return (
    <Box>
      <PageHeader
        title="Métricas"
        subtitle="Indicadores de agendamentos, pacientes, procedimentos, pacotes e financeiro"
      />

      <Stack gap={2.25}>
        <PeriodFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          periodDays={periodDays}
          datesValid={datesValid}
        />

        {!datesValid && (
          <Alert severity="warning">Informe um período válido (data inicial não pode ser posterior à final).</Alert>
        )}

        {error && <Alert severity="error">Erro ao carregar métricas. Verifique os filtros e tente novamente.</Alert>}

        <Box data-tour="metrics-kpis">
          <SummaryKpis data={data} previous={previousData} loading={metricsLoading && !data} />
        </Box>

        {/* Abas */}
        <Stack data-tour="metrics-tabs" direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.1}>
          <Stack direction="row" flexWrap="wrap" gap={1.1} role="tablist">
            {TABS.filter((t) => t.value !== 'finance' || canSeeFinance).map((t) => (
              <TabPill
                key={t.value}
                label={t.label}
                color={TAB_COLORS[t.value]}
                active={tab === t.value}
                onClick={() => setTab(t.value)}
              />
            ))}
          </Stack>
          <Button data-tour="metrics-export"
            variant="text"
            startIcon={<FileDownloadOutlinedIcon fontSize="small" />}
            onClick={exportCsv}
            disabled={!canExport}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: fontSizes.sm, fontWeight: 700 }}
          >
            Exportar CSV
          </Button>
        </Stack>

        <Box key={`${dateFrom}-${dateTo}-${tab}`}>
          {tab !== 'finance' && metricsLoading && !data && <TabLoading />}
          {tab === 'finance' && financeLoading && financeEntries.length === 0 && <TabLoading />}

          {data && tab === 'appointments' && <AppointmentsTab data={data} color={color} />}
          {data && tab === 'patients' && <PatientsTab data={data} color={color} />}
          {data && tab === 'procedures' && <ProceduresTab data={data} color={color} />}
          {data && tab === 'packages' && <PackagesTab data={data} color={color} />}
          {tab === 'finance' && canSeeFinance && !financeLoading && (
            <FinancialTab entries={financeEntries} color={color} />
          )}
        </Box>
      </Stack>
    </Box>
  );
}
