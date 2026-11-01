import { useMemo, useState } from 'react';
import { Box, Button, Card, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { useUrlState, urlEnum } from '../hooks/useUrlState';
import {
  ACTIVE_FILTER_CODEC,
  matchFields,
  matchesActiveFilter,
  type ActiveFilter,
} from '../utils/listFilters';
import { recurringExpensesApi } from '../api/recurring-expenses';
import { HourlyCostCard } from '../components/finance/HourlyCostCard';
import { RecurringExpenseFormDialog } from '../components/finance/RecurringExpenseFormDialog';
import { RECURRING_TABLE_COLUMNS, RecurringExpenseRow } from '../components/finance/RecurringExpenseRow';
import { RecurringSummaryCards } from '../components/finance/RecurringSummaryCards';
import { UPCOMING_DAYS, nextDueDate } from '../components/finance/recurringDue';
import {
  LIST_HEADER_PAPER_SELECT_SX,
  LIST_HEADER_PRIMARY_ACTION_SX,
  ListCardHeader,
  ListSearchField,
} from '../components/ListCardHeader';
import { ListPageButtons } from '../components/ListPageButtons';
import { ListEmptyState, ListSkeletonRows } from '../components/ListStates';
import { ListTableHeader } from '../components/ListTableHeader';
import { ROW_ACTION_BUTTON_SX } from '../components/RowActionButton';
import { usePagination } from '../hooks/usePagination';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import type { RecurringExpense } from '../types';
import { fontSizes } from '../theme/fontSizes';

const PAGE_SIZE = 8;

const PAGE_ARROW_SX = { ...ROW_ACTION_BUTTON_SX, width: 36, height: 36, borderRadius: '10px' } as const;

type ExpenseTypeFilter = 'ALL' | 'FIXED' | 'VARIABLE';
const TYPE_FILTER_CODEC = urlEnum<ExpenseTypeFilter>(['ALL', 'FIXED', 'VARIABLE']);

export function RecurringExpensesPage() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const [search, setSearch] = useUrlState('busca', '');
  const [activeFilter, setActiveFilter] = useUrlState<ActiveFilter>('status', 'ALL', ACTIVE_FILTER_CODEC);
  const [typeFilter, setTypeFilter] = useUrlState<ExpenseTypeFilter>('tipo', 'ALL', TYPE_FILTER_CODEC);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: () => recurringExpensesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recurringExpensesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast.success('Despesa excluída.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível excluir a despesa.'));
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => recurringExpensesApi.generate(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      if (result.generated === 0) {
        toast.info('Todos os lançamentos do mês já foram gerados.');
      } else {
        toast.success(
          `${result.generated} lançamento${result.generated > 1 ? 's' : ''} gerado${result.generated > 1 ? 's' : ''} para ${result.month}.`,
        );
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível gerar os lançamentos.'));
    },
  });

  const totalMonthly = useMemo(
    () => items.filter((i) => i.active).reduce((sum, i) => sum + Number(i.amount), 0),
    [items],
  );

  const activeFixedMonthly = useMemo(
    () =>
      items
        .filter((i) => i.active && i.expenseType === 'FIXED')
        .reduce((sum, i) => sum + Number(i.amount), 0),
    [items],
  );

  const activeVariableMonthly = useMemo(
    () =>
      items
        .filter((i) => i.active && i.expenseType === 'VARIABLE')
        .reduce((sum, i) => sum + Number(i.amount), 0),
    [items],
  );

  const fixedPct = totalMonthly > 0 ? Math.round((activeFixedMonthly / totalMonthly) * 100) : 0;
  const variablePct = totalMonthly > 0 ? 100 - fixedPct : 0;

  const dueStats = useMemo(() => {
    const today = dayjs().startOf('day');
    const dates = items
      .filter((i) => i.active)
      .map((i) => nextDueDate(i.dueDay))
      .sort((a, b) => a.valueOf() - b.valueOf());
    return {
      activeCount: dates.length,
      upcoming: dates.filter((d) => d.diff(today, 'day') <= UPCOMING_DAYS).length,
      next: dates[0] ?? null,
    };
  }, [items]);

  const filteredItems = useMemo(
    () =>
      items.filter((i) => {
        if (!matchesActiveFilter(i.active, activeFilter)) return false;
        if (typeFilter !== 'ALL' && i.expenseType !== typeFilter) return false;
        return matchFields(search, i.name, i.category, i.description);
      }),
    [items, search, activeFilter, typeFilter],
  );

  const { page: current, setPage, pageCount, rows, rangeStart, rangeEnd } = usePagination(
    filteredItems,
    PAGE_SIZE);

  const handleEdit = (expense: RecurringExpense) => {
    setEditing(expense);
    setFormOpen(true);
  };

  const handleDelete = async (expense: RecurringExpense) => {
    const ok = await confirm({
      title: 'Excluir despesa',
      message: `Excluir "${expense.name}"?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(expense.id);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.25 } }}>
      {/* Resumo */}
      <RecurringSummaryCards
        loading={isLoading}
        totalMonthly={totalMonthly}
        activeFixedMonthly={activeFixedMonthly}
        activeVariableMonthly={activeVariableMonthly}
        fixedPct={fixedPct}
        variablePct={variablePct}
        dueStats={dueStats}
      />

      {/* Custo por hora */}
      <HourlyCostCard activeFixedMonthly={activeFixedMonthly} activeVariableMonthly={activeVariableMonthly} />

      {/* Lista */}
      <Card data-tour="expenses-list" sx={{ borderRadius: '18px', overflow: 'hidden' }}>
        <ListCardHeader
          breakpoint="lg"
          nowrapFrom="md"
          sx={{ px: { xs: 2, sm: '22px' }, py: '18px' }}
          title={
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>Despesas fixas &amp; variáveis</Typography>
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600 }}>
                {filteredItems.length === items.length
                  ? `${items.length} ${items.length === 1 ? 'despesa cadastrada' : 'despesas cadastradas'}`
                  : `${filteredItems.length} de ${items.length} despesas`}
              </Typography>
            </Box>
          }
        >
          <TextField
            select
            size="small"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as ExpenseTypeFilter);
              setPage(0);
            }}
            sx={LIST_HEADER_PAPER_SELECT_SX}
            inputProps={{ 'aria-label': 'Tipo' }}
          >
            <MenuItem value="ALL">Todos os tipos</MenuItem>
            <MenuItem value="FIXED">Fixa</MenuItem>
            <MenuItem value="VARIABLE">Variável</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as ActiveFilter);
              setPage(0);
            }}
            sx={LIST_HEADER_PAPER_SELECT_SX}
            inputProps={{ 'aria-label': 'Status' }}
          >
            <MenuItem value="ALL">Todos os status</MenuItem>
            <MenuItem value="ACTIVE">Ativas</MenuItem>
            <MenuItem value="INACTIVE">Inativas</MenuItem>
          </TextField>
          <ListSearchField
            width={250}
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Buscar despesa, categoria..."
          />
          <Button data-tour="expenses-generate"
            variant="outlined"
            startIcon={<AutorenewIcon />}
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap', height: 38, px: 2, borderRadius: '12px' }}
          >
            {generateMutation.isPending ? 'Gerando...' : 'Gerar lançamentos do mês'}
          </Button>
          <Button data-tour="expenses-new"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            sx={LIST_HEADER_PRIMARY_ACTION_SX}
          >
            Nova despesa
          </Button>
        </ListCardHeader>

        {/* Cabeçalho da tabela */}
        <ListTableHeader
          columns={RECURRING_TABLE_COLUMNS}
          sx={{ display: { xs: 'none', md: 'grid' }, px: '22px', py: '13px' }}
        >
          <span>Descrição</span>
          <span>Tipo</span>
          <span>Categoria</span>
          <span>Valor</span>
          <span>Periodicidade</span>
          <span>Próx. venc.</span>
          <span>Status</span>
          <span />
        </ListTableHeader>

        {isLoading ? (
          <ListSkeletonRows count={5} height={34} px="22px" py={1.5} variant="rounded" />
        ) : filteredItems.length === 0 ? (
          <ListEmptyState
            icon={ReceiptLongOutlinedIcon}
            sx={{ p: 6 }}
            title={items.length === 0 ? 'Nenhuma despesa recorrente cadastrada' : 'Nenhuma despesa encontrada com os filtros'}
            description={
              items.length === 0
                ? 'Cadastre aluguel, salários e contas do mês para calcular o custo por hora.'
                : 'Tente ajustar a busca ou os filtros.'
            }
          />
        ) : (
          rows.map((d) => (
            <RecurringExpenseRow key={d.id} expense={d} onEdit={() => handleEdit(d)} onDelete={() => handleDelete(d)} />
          ))
        )}

        {/* Paginação */}
        {!isLoading && filteredItems.length > 0 && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            useFlexGap
            gap={1.5}
            sx={{ px: { xs: 2, sm: '22px' }, py: '14px' }}
          >
            <Typography sx={{ fontSize: fontSizes.sm, color: 'text.disabled', fontWeight: 600 }}>
              Mostrando {rangeStart}–{rangeEnd} de{' '}
              {filteredItems.length}
            </Typography>
            {pageCount > 1 && (
              <ListPageButtons
                page={current}
                pageCount={pageCount}
                onChange={setPage}
                size={36}
                radius="10px"
                px={1}
                spacing={0.875}
                arrowSx={PAGE_ARROW_SX}
                arrowSize="medium"
              />
            )}
          </Stack>
        )}
      </Card>

      <RecurringExpenseFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        expense={editing}
      />
    </Box>
  );
}
