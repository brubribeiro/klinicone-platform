import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm, Controller, useWatch } from 'react-hook-form';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { inventoryApi } from '../../api/inventory';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  DialogHeader,
  dialogActionsBorderSx,
  dialogFormLayoutSx,
  formDialogPaperSx,
} from '../DialogCloseButton';
import { MoneyField } from '../MoneyField';
import { dateOnlyToApiIso } from '../../utils/dateOnly';
import { fontSizes } from '../../theme/fontSizes';
import { ListTableHeader } from '../ListTableHeader';
import {
  allocateFreight,
  defaultValues,
  emptyLine,
  lineProductTotal,
  parseNum,
  type BulkPurchaseFormValues,
  type LineForm,
} from './bulkPurchase';
import { BULK_LINE_COLUMNS, BulkPurchaseLineRow } from './BulkPurchaseLineRow';
import { BulkPurchaseTotals } from './BulkPurchaseTotals';

interface BulkPurchaseDialogProps {
  open: boolean;
  onClose: () => void;
}

const DIALOG_MAX_WIDTH = 1180;

const LABEL_SX = { fontSize: fontSizes.sm, fontWeight: 700, mb: 0.9 } as const;

export function BulkPurchaseDialog({ open, onClose }: BulkPurchaseDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { control, handleSubmit, reset } = useForm<BulkPurchaseFormValues>({ defaultValues });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const { data: items = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    reset(defaultValues);
  }, [open, reset]);

  const watchedLines = (useWatch({ control, name: 'lines' }) ?? defaultValues.lines) as LineForm[];
  const watchedFreight = useWatch({ control, name: 'freight' });
  const freight = parseNum(watchedFreight);

  const lineTotals = useMemo(() => {
    const parsed = watchedLines.map((l) => ({
      productTotal: lineProductTotal(l),
      quantity: parseNum(l.quantity),
    }));
    const freightShares = allocateFreight(parsed, freight);
    return parsed.map((l, i) => {
      const freightShare = freightShares[i] ?? 0;
      const total = Math.round((l.productTotal + freightShare) * 100) / 100;
      const unitCost = l.quantity > 0 ? Math.round((total / l.quantity) * 100) / 100 : 0;
      return { ...l, freightShare, total, unitCost };
    });
  }, [watchedLines, freight]);

  const productsTotal = lineTotals.reduce((s, l) => s + l.productTotal, 0);
  const grandTotal = Math.round((productsTotal + freight) * 100) / 100;

  const mutation = useMutation({
    mutationFn: (values: BulkPurchaseFormValues) => {
      const payloadLines = values.lines.map((line) => {
        const base = {
          quantity: Number(line.quantity),
          productTotal: lineProductTotal(line),
          expiresAt: dateOnlyToApiIso(line.expiresAt),
        };
        if (line.mode === 'existing') {
          return { itemId: line.item!.id, ...base };
        }
        return {
          newItem: {
            name: line.newName.trim(),
            ...(line.newSku.trim() ? { sku: line.newSku.trim() } : {}),
            minQuantity: Number(line.newMinQuantity) || 0,
            unit: line.newUnit || undefined,
          },
          ...base,
        };
      });
      return inventoryApi.createBulkPurchase({
        ...(values.reason.trim() ? { reason: values.reason.trim() } : {}),
        ...(freight > 0 ? { freight } : {}),
        lines: payloadLines,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      toast.success('Compra registrada.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível registrar a compra.'));
    },
  });

  const canSubmit =
    productsTotal > 0 &&
    watchedLines.every((l, i) => {
      const qty = parseNum(l.quantity) > 0;
      const price = lineTotals[i].productTotal > 0;
      const itemOk = l.mode === 'existing' ? !!l.item : l.newName.trim().length > 0;
      return qty && price && itemOk && !!l.expiresAt && lineTotals[i].unitCost > 0;
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: formDialogPaperSx(isMobile, {
          maxWidth: DIALOG_MAX_WIDTH,
          height: 'min(86dvh, 720px)',
        }),
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        sx={dialogFormLayoutSx(isMobile)}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title="Compra em lote"
          subtitle="Vários materiais, validade por item e frete rateado no custo"
          icon={<ShoppingCartOutlinedIcon fontSize="small" />}
        />

        <DialogContent
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
            '&.MuiDialogContent-root': { pt: { xs: 2, sm: 2.25 } },
          }}
        >
          <Box sx={{ flexShrink: 0, mb: 2 }}>
            <Typography sx={LABEL_SX}>Descrição da compra</Typography>
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  placeholder="Opcional — ex.: fornecedor, nº da nota fiscal"
                  inputProps={{ 'aria-label': 'Descrição da compra' }}
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'grey.50' } }}
                />
              )}
            />
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              mb: 2,
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
              spacing={1}
              sx={{ flexShrink: 0, mb: 1.25 }}
            >
              <Typography
                sx={{ fontSize: fontSizes.sm, fontWeight: 800, color: 'text.disabled', letterSpacing: '0.6px' }}
              >
                ITENS DA COMPRA · {fields.length}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PostAddOutlinedIcon />}
                  onClick={() => append(emptyLine('new'))}
                  sx={{ height: 34, borderRadius: '10px', borderColor: 'divider', color: 'text.primary', fontSize: fontSizes.xs }}
                >
                  Cadastrar produto
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => append(emptyLine())}
                  sx={{
                    height: 34,
                    borderRadius: '10px',
                    fontSize: fontSizes.xs,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  }}
                >
                  Adicionar linha
                </Button>
              </Stack>
            </Stack>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                border: 1,
                borderColor: 'divider',
                borderRadius: '14px',
                overflow: 'auto',
              }}
            >
              <Box sx={{ minWidth: 980 }}>
                <ListTableHeader
                  columns={BULK_LINE_COLUMNS}
                  sx={{
                    gap: 0.9,
                    px: 1.5,
                    py: 1.25,
                    fontSize: fontSizes['3xs'],
                    letterSpacing: '0.3px',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <span>Produto</span>
                  <span>Validade do lote</span>
                  <span>Unidade</span>
                  <Box component="span" sx={{ textAlign: 'center' }}>Qtd</Box>
                  <Box component="span" sx={{ textAlign: 'center' }}>Est. mín</Box>
                  <Box component="span" sx={{ textAlign: 'right' }}>Valor un.</Box>
                  <Box component="span" sx={{ textAlign: 'right' }}>Frete rat.</Box>
                  <Box component="span" sx={{ textAlign: 'right' }}>Custo final</Box>
                  <span />
                </ListTableHeader>

                {fields.map((f, index) => (
                  <BulkPurchaseLineRow
                    key={f.id}
                    control={control}
                    index={index}
                    // useWatch lags one render behind append(); the new row has no totals yet
                    line={watchedLines[index] ?? f}
                    totals={lineTotals[index] ?? { freightShare: 0, unitCost: 0 }}
                    items={items}
                    isLast={index === fields.length - 1}
                    canRemove={fields.length > 1}
                    onRemove={() => remove(index)}
                  />
                ))}
              </Box>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                flexShrink: 0,
                mt: 1.25,
                px: 1.75,
                py: 1.4,
                bgcolor: 'grey.50',
                border: 1,
                borderColor: 'grey.100',
                borderRadius: '11px',
              }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
              <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', lineHeight: 1.4 }}>
                Selecione um produto cadastrado em cada linha — a compra gera uma{' '}
                <Box component="b" sx={{ color: 'success.main' }}>movimentação de entrada</Box> no item. Para um
                produto que ainda não existe, use{' '}
                <Box component="b" sx={{ color: 'text.primary' }}>Cadastrar produto</Box>: ele é criado ao
                confirmar a compra.
              </Typography>
            </Stack>
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box>
              <Typography sx={LABEL_SX}>Frete da compra</Typography>
              <Controller
                name="freight"
                control={control}
                render={({ field }) => (
                  <MoneyField
                    {...field}
                    fullWidth
                    inputProps={{ 'aria-label': 'Frete da compra' }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'grey.50', fontWeight: 700 } }}
                  />
                )}
              />
              <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', mt: 0.75 }}>
                Opcional. Diluído proporcionalmente ao valor de cada item.
              </Typography>
            </Box>

            <BulkPurchaseTotals productsTotal={productsTotal} freight={freight} grandTotal={grandTotal} />
          </Box>

          {mutation.isError && (
            <Alert severity="error" variant="outlined" sx={{ flexShrink: 0, mt: 2 }}>
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message ?? 'Erro ao registrar compra em lote'}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending ? 'Salvando…' : 'Confirmar compra'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
