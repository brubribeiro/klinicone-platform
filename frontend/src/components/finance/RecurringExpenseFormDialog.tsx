import { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { recurringExpensesApi, RecurringExpensePayload } from '../../api/recurring-expenses';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../DialogCloseButton';
import { LabeledField } from '../LabeledField';
import { MoneyField } from '../MoneyField';
import type { ExpenseType, RecurringExpense } from '../../types';
import { fontSizes } from '../../theme/fontSizes';

interface Props {
  open: boolean;
  onClose: () => void;
  expense?: RecurringExpense | null;
}

interface FormValues {
  name: string;
  description: string;
  amount: number;
  category: string;
  expenseType: ExpenseType;
  dueDay: number;
  active: boolean;
}

const empty: FormValues = {
  name: '',
  description: '',
  amount: 0,
  category: '',
  expenseType: 'FIXED',
  dueDay: 1,
  active: true,
};

const DIALOG_MAX_WIDTH = 640;

const TWO_COLUMNS_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
  gap: 1.75,
} as const;

export function RecurringExpenseFormDialog({ open, onClose, expense }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { control, handleSubmit, reset } = useForm<FormValues>({ defaultValues: empty });

  useEffect(() => {
    if (!open) return;
    reset(
      expense
        ? {
            name: expense.name,
            description: expense.description ?? '',
            amount: Number(expense.amount),
            category: expense.category ?? '',
            expenseType: expense.expenseType,
            dueDay: expense.dueDay,
            active: expense.active,
          }
        : empty,
    );
  }, [open, expense, reset]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: RecurringExpensePayload = {
        name: v.name,
        amount: Number(v.amount),
        expenseType: v.expenseType,
        dueDay: Number(v.dueDay),
        active: v.active,
        ...(v.description ? { description: v.description } : {}),
        ...(v.category ? { category: v.category } : {}),
      };
      return expense
        ? recurringExpensesApi.update(expense.id, payload)
        : recurringExpensesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast.success(expense ? 'Despesa atualizada.' : 'Despesa criada.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível salvar a despesa.'));
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          ...dialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          ...(isMobile
            ? { height: '100%', maxHeight: '100dvh' }
            : { maxWidth: DIALOG_MAX_WIDTH, maxHeight: '94dvh' }),
        },
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title={expense ? 'Editar despesa recorrente' : 'Nova despesa recorrente'}
          subtitle={expense ? expense.name : 'Valor, vencimento e tipo fixo ou variável'}
          icon={
            expense ? <EditOutlinedIcon fontSize="small" /> : <EventRepeatOutlinedIcon fontSize="small" />
          }
        />

        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            gap: 2.25,
            '&.MuiDialogContent-root': { pt: { xs: 2.75, sm: 3 } },
          }}
        >
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Nome obrigatório' }}
            render={({ field, fieldState }) => (
              <LabeledField label="Nome" required>
                <TextField
                  {...field}
                  fullWidth
                  autoFocus={!expense}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  placeholder="Ex.: Aluguel — Unidade Jardins"
                />
              </LabeledField>
            )}
          />

          <Box sx={TWO_COLUMNS_SX}>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <LabeledField label="Categoria">
                  <TextField {...field} fullWidth placeholder="Ex.: Instalações, Utilidades" />
                </LabeledField>
              )}
            />
            <Controller
              name="amount"
              control={control}
              rules={{ validate: (v) => Number(v) > 0 || 'Informe um valor maior que zero' }}
              render={({ field, fieldState }) => (
                <LabeledField label="Valor mensal" required>
                  <MoneyField
                    {...field}
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                </LabeledField>
              )}
            />
          </Box>

          <Box sx={TWO_COLUMNS_SX}>
            <Controller
              name="expenseType"
              control={control}
              render={({ field }) => (
                <LabeledField label="Tipo de despesa">
                  <TextField select fullWidth {...field}>
                    <MenuItem value="FIXED">Fixa</MenuItem>
                    <MenuItem value="VARIABLE">Variável</MenuItem>
                  </TextField>
                  <Typography
                    sx={{
                      mt: 0.75,
                      fontSize: fontSizes['2xs'],
                      color: 'text.secondary',
                      lineHeight: 1.35,
                    }}
                  >
                    Fixas entram no custo/hora mensal; variáveis podem ser incluídas no cálculo dos
                    procedimentos.
                  </Typography>
                </LabeledField>
              )}
            />
            <Controller
              name="dueDay"
              control={control}
              rules={{
                required: 'Informe o dia do vencimento',
                min: { value: 1, message: 'Use um dia entre 1 e 31' },
                max: { value: 31, message: 'Use um dia entre 1 e 31' },
              }}
              render={({ field, fieldState }) => (
                <LabeledField label="Dia do vencimento" required>
                  <TextField
                    {...field}
                    type="number"
                    fullWidth
                    inputProps={{ inputMode: 'numeric', min: 1, max: 31 }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? 'Dia do mês (1–31)'}
                  />
                </LabeledField>
              )}
            />
          </Box>

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <LabeledField label="Descrição">
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="Detalhes adicionais (opcional)"
                />
              </LabeledField>
            )}
          />

          <Controller
            name="active"
            control={control}
            render={({ field }) => (
              <Box
                component="label"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  px: 1.875,
                  py: 1.625,
                  borderRadius: '12px',
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'grey.50',
                  cursor: 'pointer',
                }}
              >
                <Box sx={{ lineHeight: 1.3 }}>
                  <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>Despesa ativa</Typography>
                  <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled' }}>
                    Entra no custo/hora e gera o lançamento a cada mês
                  </Typography>
                </Box>
                <Switch
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  inputProps={{ 'aria-label': 'Despesa ativa' }}
                />
              </Box>
            )}
          />

          {mutation.isError && (
            <Alert severity="error" variant="outlined">
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message ?? 'Erro ao salvar despesa'}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : expense ? 'Salvar' : 'Criar despesa'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
