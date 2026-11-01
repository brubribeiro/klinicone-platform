import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { financeApi } from '../../api/finance';
import { metricsApi } from '../../api/metrics';

/** Métricas do período, do período anterior (deltas dos KPIs) e lançamentos financeiros. */
export function useMetricsData(dateFrom: string, dateTo: string, canSeeFinance: boolean) {
  const datesValid = useMemo(() => {
    const from = dayjs(dateFrom);
    const to = dayjs(dateTo);
    return from.isValid() && to.isValid() && !from.isAfter(to, 'day');
  }, [dateFrom, dateTo]);

  const fromIso = useMemo(() => {
    const from = dayjs(dateFrom);
    return from.isValid() ? from.startOf('day').toISOString() : undefined;
  }, [dateFrom]);

  const toIso = useMemo(() => {
    const to = dayjs(dateTo);
    return to.isValid() ? to.endOf('day').toISOString() : undefined;
  }, [dateTo]);

  // Período anterior com a mesma duração, para os deltas dos KPIs.
  const previousRange = useMemo(() => {
    if (!datesValid) return null;
    const from = dayjs(dateFrom);
    const days = dayjs(dateTo).diff(from, 'day') + 1;
    return {
      from: from.subtract(days, 'day').format('YYYY-MM-DD'),
      to: from.subtract(1, 'day').format('YYYY-MM-DD'),
    };
  }, [dateFrom, dateTo, datesValid]);

  const { data, isPending, isFetching, isPlaceholderData, error } = useQuery({
    queryKey: ['metrics', dateFrom, dateTo],
    queryFn: () => metricsApi.get(dateFrom, dateTo),
    enabled: datesValid,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const { data: previousData, isPlaceholderData: previousPlaceholder } = useQuery({
    queryKey: ['metrics', previousRange?.from, previousRange?.to],
    queryFn: () => metricsApi.get(previousRange!.from, previousRange!.to),
    enabled: !!previousRange,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const {
    data: financeEntries = [],
    isPending: financePending,
    isFetching: financeFetching,
    isPlaceholderData: financePlaceholder,
  } = useQuery({
    queryKey: ['finance', fromIso, toIso, 'metrics'],
    queryFn: () => financeApi.list(fromIso!, toIso!),
    enabled: canSeeFinance && datesValid && !!fromIso && !!toIso,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    datesValid,
    periodDays: datesValid ? dayjs(dateTo).diff(dayjs(dateFrom), 'day') + 1 : 0,
    data,
    previousData,
    error,
    metricsLoading: isPending || (isFetching && !data),
    /** Métricas (ou as do período anterior) ainda são do filtro anterior (keepPreviousData) enquanto o novo período carrega. */
    metricsStale: isPlaceholderData || previousPlaceholder,
    financeEntries,
    financeLoading: financePending || (financeFetching && financeEntries.length === 0),
    financeStale: financePlaceholder,
  };
}
