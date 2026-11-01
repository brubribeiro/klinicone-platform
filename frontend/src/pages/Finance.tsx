import { useMemo, useState } from 'react';
import { Box, Button, Card, MenuItem, Select, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { formatDateOnlyFromApi } from '../utils/dateOnly';

import { matchFields } from '../utils/listFilters';
import { useUrlState, urlDate, urlEnum } from '../hooks/useUrlState';
import { financeApi } from '../api/finance';
import { FinanceFormDialog } from '../components/finance/FinanceFormDialog';
import { FinanceKpiCard, FinancePill } from '../components/finance/FinanceKpiCard';
import { PeriodField } from '../components/finance/PeriodField';
import { TransactionRow } from '../components/finance/TransactionRow';
import {
  LIST_HEADER_COMPACT_SELECT_SX,
  LIST_HEADER_PRIMARY_ACTION_SX,
  ListCardHeader,
  ListSearchField,
} from '../components/ListCardHeader';
import { COMPACT_PAGE_ARROW_SX, ListPageButtons } from '../components/ListPageButtons';
import { ListEmptyState, ListSkeletonRows } from '../components/ListStates';
import { useFinanceBackgroundSync } from '../hooks/useFinanceBackgroundSync';
import { usePagination } from '../hooks/usePagination';
import type { FinancialEntry } from '../types';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { downloadCsv } from '../utils/csv';
import { fontSizes } from '../theme/fontSizes';
import { brl } from '../utils/money';

const PAGE_SIZE = 10;

type TypeFilter = 'ALL' | 'INCOME' | 'EXPENSE';
type InvoiceFilter = 'ALL' | 'PENDING' | 'ISSUED';
const TYPE_FILTER_CODEC = urlEnum<TypeFilter>(['ALL', 'INCOME', 'EXPENSE']);
const INVOICE_FILTER_CODEC = urlEnum<InvoiceFilter>(['ALL', 'PENDING', 'ISSUED']);

export function Finance() {
  const queryClient = useQueryClient();
  const { confirm, alert } = useAppDialog();
  const toast = useAppToast();
  const theme = useTheme();
  const [from, setFrom] = useUrlState('de', dayjs().startOf('month').format('YYYY-MM-DD'), urlDate);
  const [to, setTo] = useUrlState('ate', dayjs().endOf('month').format('YYYY-MM-DD'), urlDate);
  const [search, setSearch] = useUrlState('busca', '');
  const [typeFilter, setTypeFilter] = useUrlState<TypeFilter>('tipo', 'ALL', TYPE_FILTER_CODEC);
  const [invoiceFilter, setInvoiceFilter] = useUrlState<InvoiceFilter>(
    'notaFiscal',
    'ALL',
    INVOICE_FILTER_CODEC,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialEntry | null>(null);

  const fromIso = useMemo(() => {
    const parsed = dayjs(from);
    return (parsed.isValid() ? parsed : dayjs().startOf('month')).startOf('day').toISOString();
  }, [from]);
  const toIso = useMemo(() => {
    const parsed = dayjs(to);
    return (parsed.isValid() ? parsed : dayjs().endOf('month')).endOf('day').toISOString();
  }, [to]);

  useFinanceBackgroundSync(from, to);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['finance', fromIso, toIso],
    queryFn: () => financeApi.list(fromIso, toIso),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['finance-summary', fromIso, toIso],
    queryFn: () => financeApi.summary(fromIso, toIso),
  });

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== 'ALL' && e.type !== typeFilter) return false;
      if (invoiceFilter === 'PENDING' && (e.type !== 'INCOME' || e.invoiceIssued)) return false;
      if (invoiceFilter === 'ISSUED' && (e.type !== 'INCOME' || !e.invoiceIssued)) return false;
      return matchFields(
        search,
        e.description,
        e.category,
        e.paymentMethod?.name,
        e.type === 'INCOME' ? 'receita' : 'despesa',
      );
    });
  }, [entries, typeFilter, invoiceFilter, search]);

  const pendingInvoices = useMemo(
    () => entries.filter((e) => e.type === 'INCOME' && !e.invoiceIssued).length,
    [entries],
  );

  const profit = summary?.balance ?? 0;
  const profitMarginPct = useMemo(() => {
    const income = summary?.totalIncome ?? 0;
    if (income <= 0) return null;
    return (profit / income) * 100;
  }, [summary?.totalIncome, profit]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      toast.success('Lançamento excluído.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível excluir o lançamento.'));
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: ({ id, issued }: { id: string; issued: boolean }) =>
      financeApi.setInvoiceIssued(id, issued),
    onSuccess: (_data, { issued }) => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      toast.success(issued ? 'Nota fiscal marcada como emitida.' : 'Nota fiscal desmarcada.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível atualizar a nota fiscal.'));
    },
  });

  const { page: current, setPage, pageCount, rows, rangeStart, rangeEnd } = usePagination(filtered, PAGE_SIZE);

  const expenseCount = useMemo(() => entries.filter((e) => e.type === 'EXPENSE').length, [entries]);

  const handleEdit = (entry: FinancialEntry) => {
    setEditing(entry);
    setFormOpen(true);
  };

  const handleDelete = async (entry: FinancialEntry) => {
    const ok = await confirm({
      title: 'Excluir lançamento',
      message: 'Excluir este lançamento?',
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(entry.id);
  };

  const exportPeriodCsv = async () => {
    if (entries.length === 0) {
      await alert({
        title: 'Exportar',
        message: 'Nenhum lançamento no período para exportar.',
        severity: 'info',
      });
      return;
    }

    const filename = `financeiro-${dayjs(from).format('YYYY-MM-DD')}_${dayjs(to).format('YYYY-MM-DD')}.csv`;
    downloadCsv(
      filename,
      entries.map((e) => {
        const refDate = e.paidAt ?? e.dueDate;
        return {
          Data: refDate ? formatDateOnlyFromApi(refDate) : '',
          Tipo: e.type === 'INCOME' ? 'Receita' : 'Despesa',
          Descrição: e.description,
          Categoria: e.category ?? '',
          'Forma de pagamento': e.paymentMethod?.name ?? '',
          Valor: Number(e.amount).toFixed(2),
          'Data pagamento': e.paidAt ? formatDateOnlyFromApi(e.paidAt) : '',
          Vencimento: e.dueDate ? formatDateOnlyFromApi(e.dueDate) : '',
          'Nota emitida':
            e.type === 'INCOME' ? (e.invoiceIssued ? 'Sim' : 'Não') : '',
          Recorrente: e.recurringExpenseId ? 'Sim' : 'Não',
        };
      }),
      [
        'Data',
        'Tipo',
        'Descrição',
        'Categoria',
        'Forma de pagamento',
        'Valor',
        'Data pagamento',
        'Vencimento',
        'Nota emitida',
        'Recorrente',
      ],
    );
  };

  return (
    <Box>
      <Stack spacing={2.25}>
        {/* Resumo do período + ações */}
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
            {isLoading ? (
              <Skeleton width={260} />
            ) : (
              <>
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                  {entries.length}
                </Box>{' '}
                {entries.length === 1 ? 'lançamento no período' : 'lançamentos no período'}
                {'  ·  '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                  {pendingInvoices}
                </Box>{' '}
                {pendingInvoices === 1 ? 'nota pendente' : 'notas pendentes'}
              </>
            )}
          </Typography>

          <Stack
            data-tour="finance-period"
            direction="row"
            alignItems="center"
            spacing={1.25}
            flexWrap="wrap"
            useFlexGap
            justifyContent={{ lg: 'flex-end' }}
          >
            <PeriodField
              label="De"
              value={from}
              onChange={(v) => {
                setFrom(v);
                setPage(0);
              }}
            />
            <PeriodField
              label="Até"
              value={to}
              onChange={(v) => {
                setTo(v);
                setPage(0);
              }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              sx={LIST_HEADER_PRIMARY_ACTION_SX}
            >
              Novo lançamento
            </Button>
          </Stack>
        </Stack>

        {/* Indicadores */}
        <Box
          data-tour="finance-kpis"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: { xs: 1.5, md: 2.25 },
          }}
        >
          <FinanceKpiCard
            label="Receitas"
            tone={theme.palette.success.main}
            loading={summaryLoading}
            value={brl.format(summary?.totalIncome ?? 0)}
            footer={
              summary?.totalFees != null && summary.totalFees > 0 ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <FinancePill tone={theme.palette.success.main}>
                    Líquido {brl.format(summary.totalNetIncome ?? 0)}
                  </FinancePill>
                  <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600 }}>
                    Taxas {brl.format(summary.totalFees)}
                  </Typography>
                </Stack>
              ) : null
            }
          />
          <FinanceKpiCard
            label="Despesas"
            tone={theme.palette.error.main}
            loading={summaryLoading}
            value={brl.format(summary?.totalExpense ?? 0)}
            footer={
              <FinancePill tone={theme.palette.error.main}>
                {expenseCount} {expenseCount === 1 ? 'lançamento' : 'lançamentos'}
              </FinancePill>
            }
          />
          <FinanceKpiCard
            label="Lucro"
            tone={profit >= 0 ? theme.palette.success.main : theme.palette.error.main}
            loading={summaryLoading}
            value={brl.format(profit)}
            valueColor={profit < 0 ? 'error.main' : undefined}
            footer={
              profitMarginPct != null ? (
                <FinancePill tone={profitMarginPct >= 0 ? theme.palette.success.main : theme.palette.error.main}>
                  Margem {profitMarginPct.toFixed(1)}%
                </FinancePill>
              ) : null
            }
          />
          <Tooltip title="Click para filtrar notas pendentes" arrow>
            <Box>
              <FinanceKpiCard
                label="Notas pendentes"
                tone={theme.palette.warning.main}
                loading={isLoading}
                value={pendingInvoices}
                active={invoiceFilter === 'PENDING'}
                onClick={() => {
                  setInvoiceFilter('PENDING');
                  setPage(0);
                }}
                footer={
                  <FinancePill tone={theme.palette.warning.main}>
                    {invoiceFilter === 'PENDING' ? 'Filtro aplicado' : 'Ver pendentes'}
                  </FinancePill>
                }
              />
            </Box>
          </Tooltip>
        </Box>

        {/* Transações */}
        <Card data-tour="finance-transactions" sx={{ borderRadius: '18px', border: 1, borderColor: 'divider', overflow: 'hidden' }}>
          <ListCardHeader
            breakpoint="lg"
            nowrapFrom={null}
            sx={{ py: 2.25 }}
            title={
              <Typography component="h3" sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>
                Transações
              </Typography>
            }
          >
            <ListSearchField
              compact
              width={260}
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(0);
              }}
              placeholder="Buscar lançamento..."
              ariaLabel="Buscar por descrição, categoria ou forma de pagamento"
            />
            <Select
              size="small"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as TypeFilter);
                setPage(0);
              }}
              inputProps={{ 'aria-label': 'Tipo' }}
              sx={LIST_HEADER_COMPACT_SELECT_SX}
            >
              <MenuItem value="ALL">Todos os tipos</MenuItem>
              <MenuItem value="INCOME">Receitas</MenuItem>
              <MenuItem value="EXPENSE">Despesas</MenuItem>
            </Select>
            <Select
              size="small"
              value={invoiceFilter}
              onChange={(e) => {
                setInvoiceFilter(e.target.value as InvoiceFilter);
                setPage(0);
              }}
              inputProps={{ 'aria-label': 'Nota' }}
              sx={LIST_HEADER_COMPACT_SELECT_SX}
            >
              <MenuItem value="ALL">Todas as notas</MenuItem>
              <MenuItem value="PENDING">Notas pendentes</MenuItem>
              <MenuItem value="ISSUED">Notas emitidas</MenuItem>
            </Select>
            <Button
              variant="text"
              onClick={exportPeriodCsv}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: fontSizes.sm, fontWeight: 700 }}
            >
              Exportar período
            </Button>
          </ListCardHeader>

          {isLoading ? (
            <ListSkeletonRows height={36} px={2.75} py={1.5} />
          ) : rows.length === 0 ? (
            <ListEmptyState
              icon={ReceiptLongOutlinedIcon}
              sx={{ py: 7 }}
              title={entries.length === 0 ? 'Nenhum lançamento no período' : 'Nenhum lançamento encontrado com os filtros'}
              description={
                entries.length === 0 ? 'Ajuste o período ou registre um novo lançamento.' : 'Tente ajustar a busca ou os filtros.'
              }
            />
          ) : (
            rows.map((entry) => (
              <TransactionRow
                key={entry.id}
                entry={entry}
                onEdit={() => handleEdit(entry)}
                onDelete={() => handleDelete(entry)}
                onToggleInvoice={(issued) => invoiceMutation.mutate({ id: entry.id, issued })}
              />
            ))
          )}

          {!isLoading && filtered.length > 0 && (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              useFlexGap
              spacing={1.5}
              sx={{ px: { xs: 2, sm: 2.75 }, py: 1.75 }}
            >
              <Typography sx={{ fontSize: fontSizes.sm, color: 'text.disabled', fontWeight: 600 }}>
                Mostrando {rangeStart}–{rangeEnd} de{' '}
                {filtered.length} {filtered.length === 1 ? 'lançamento' : 'lançamentos'}
                {filtered.length !== entries.length && ` (de ${entries.length})`}
              </Typography>
              {pageCount > 1 && (
                <ListPageButtons
                  page={current}
                  pageCount={pageCount}
                  onChange={setPage}
                  windowed
                  size={34}
                  radius="9px"
                  px={0.75}
                  spacing={0.9}
                  arrowSx={COMPACT_PAGE_ARROW_SX}
                />
              )}
            </Stack>
          )}
        </Card>
      </Stack>

      <FinanceFormDialog open={formOpen} onClose={() => setFormOpen(false)} entry={editing} />
    </Box>
  );
}
