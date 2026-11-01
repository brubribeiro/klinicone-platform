import { Box, Checkbox, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { formatDateOnlyFromApi } from '../../utils/dateOnly';
import type { ExpenseType, FinancialEntry } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { brl } from '../../utils/money';
import { RowActionButton } from '../RowActionButton';
import { FinancePill } from './FinanceKpiCard';
import { formatInstallmentsLabel } from '../../utils/paymentMethodMeta';

const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  FIXED: 'Fixa',
  VARIABLE: 'Variável',
};

interface TransactionRowProps {
  entry: FinancialEntry;
  onEdit: () => void;
  onDelete: () => void;
  onToggleInvoice: (issued: boolean) => void;
}

export function TransactionRow({ entry, onEdit, onDelete, onToggleInvoice }: TransactionRowProps) {
  const theme = useTheme();
  const isIncome = entry.type === 'INCOME';
  const tone = isIncome ? theme.palette.success.main : theme.palette.error.main;
  const typeLabel = isIncome ? 'Receita' : 'Despesa';

  const details: string[] = [];
  if (!isIncome) {
    if (entry.expenseType) details.push(EXPENSE_TYPE_LABEL[entry.expenseType]);
  } else if (entry.appointmentId) {
    details.push('Agendamento');
  }

  const refDate = entry.paidAt ?? entry.dueDate;
  const dateLabel = refDate
    ? `${!entry.paidAt ? 'vence ' : ''}${formatDateOnlyFromApi(refDate)}`
    : null;
  const meta = [entry.category || typeLabel, ...details, dateLabel].filter(Boolean).join(' · ');

  const cardMeta = [
    formatInstallmentsLabel(entry.installments),
    entry.cardBrand,
    entry.authorizationCode ? `NSU ${entry.authorizationCode}` : null,
  ].filter(Boolean);

  const tooltip = [
    typeLabel,
    [...details, entry.recurringExpenseId ? 'Recorrente' : null].filter(Boolean).join(' · ') || null,
    cardMeta.length ? cardMeta.join(' · ') : null,
    entry.appointment?.procedure?.name ? `Procedimento: ${entry.appointment.procedure.name}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const margin = isIncome ? entry.profitMargin : null;
  const marginLow = margin != null && margin < 50;
  const marginTone = marginLow ? theme.palette.error.main : theme.palette.success.main;
  const net = isIncome && entry.netAmount != null ? Number(entry.netAmount) : null;
  const fee = entry.feePercent ? `${Number(entry.feePercent)}%` : '';
  const materialCost = isIncome ? entry.materialCost : null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: { xs: 'wrap', md: 'nowrap' },
        columnGap: 1.75,
        rowGap: 1,
        minHeight: 68,
        px: { xs: 2, sm: 2.75 },
        py: 1.5,
        borderBottom: 1,
        borderColor: 'grey.100',
        transition: 'background .12s',
        '&:hover': { bgcolor: 'grey.50' },
      }}
    >
      <Box sx={{ flex: { xs: '1 1 100%', md: 1 }, minWidth: 0, lineHeight: 1.3 }}>
        <Tooltip title={tooltip} placement="top-start" arrow>
          <Typography noWrap sx={{ fontSize: fontSizes.md, fontWeight: 700, lineHeight: 1.35 }}>
            {entry.description}
          </Typography>
        </Tooltip>
        <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.disabled', lineHeight: 1.35 }}>
          {meta}
        </Typography>
      </Box>

      <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, width: { md: 190 } }}>
        {entry.recurringExpenseId && <FinancePill tone={theme.palette.warning.main}>Recorrente</FinancePill>}
        {entry.paymentMethod?.name && (
          <Box
            component="span"
            sx={{
              fontSize: fontSizes['2xs'],
              fontWeight: 700,
              px: 1.1,
              py: '3px',
              borderRadius: '7px',
              color: 'text.secondary',
              bgcolor: 'grey.100',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.paymentMethod.name}
            {formatInstallmentsLabel(entry.installments)
              ? ` · ${formatInstallmentsLabel(entry.installments)}`
              : ''}
          </Box>
        )}
      </Stack>

      <Box sx={{ width: { md: 64 }, flexShrink: 0, textAlign: { md: 'right' } }}>
        {margin != null && (
          <Tooltip
            title={
              marginLow
                ? 'Margem abaixo de 50% — considere revisar o preço ou os custos. Calculada com a maior taxa de pagamento.'
                : 'Margem de lucro (materiais + despesas fixas + maior taxa de pagamento)'
            }
          >
            <Box component="span">
              <FinancePill tone={marginTone}>{margin.toFixed(1)}%</FinancePill>
            </Box>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ width: { md: 62 }, flexShrink: 0 }}>
        {isIncome && (
          <Tooltip title={entry.invoiceIssued ? 'Nota emitida. Click para reabrir.' : 'Marcar nota como emitida'}>
            <Stack
              component="label"
              direction="row"
              alignItems="center"
              sx={{ cursor: 'pointer', color: entry.invoiceIssued ? 'success.main' : 'text.disabled' }}
            >
              <Checkbox
                size="small"
                checked={!!entry.invoiceIssued}
                onChange={(e) => onToggleInvoice(e.target.checked)}
                sx={{ p: 0.5 }}
              />
              <Typography sx={{ fontSize: fontSizes['2xs'], fontWeight: 700, color: 'inherit' }}>NF</Typography>
            </Stack>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ width: { md: 190 }, flexShrink: 0, textAlign: 'right', ml: { xs: 'auto', md: 0 } }}>
        <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800, color: tone, whiteSpace: 'nowrap' }}>
          {isIncome ? '+' : '−'} {brl.format(Number(entry.amount))}
        </Typography>
        {(net != null || materialCost != null) && (
          <Stack direction="row" spacing={0.75} justifyContent="flex-end">
            {net != null && (
              <Tooltip title={fee ? `Taxa: ${fee}` : ''}>
                <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  líq. {brl.format(net)}
                </Typography>
              </Tooltip>
            )}
            {materialCost != null && (
              <Tooltip title="Custo de materiais do procedimento">
                <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.disabled', whiteSpace: 'nowrap' }}>
                  mat. {brl.format(materialCost)}
                </Typography>
              </Tooltip>
            )}
          </Stack>
        )}
      </Box>

      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
        <RowActionButton title="Editar" ariaLabel="Editar" onClick={onEdit}>
          <EditIcon sx={{ fontSize: 16 }} />
        </RowActionButton>
        <RowActionButton title="Excluir" ariaLabel="Excluir" danger onClick={onDelete}>
          <DeleteIcon sx={{ fontSize: 16 }} />
        </RowActionButton>
      </Stack>
    </Box>
  );
}
