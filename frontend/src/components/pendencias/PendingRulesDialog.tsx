import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pendenciasApi } from '../../api/pendencias';
import { usersApi } from '../../api/users';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../DialogCloseButton';
import { FieldAdornment } from '../FieldAdornment';
import { LabeledField } from '../LabeledField';
import type { PendingRuleConfig } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { CATEGORY_META, PendIcon, categoryColor, softBg, RULE_CATEGORY, RULE_META } from './pendenciasUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}

const DIALOG_MAX_WIDTH = 580;

const COMPACT_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    minHeight: 34,
    borderRadius: '10px',
    fontSize: fontSizes.sm,
    fontWeight: 500,
  },
  '& .MuiOutlinedInput-input': {
    py: 0.65,
    px: 1.25,
  },
  '& .MuiSelect-select': {
    py: 0.65,
    fontSize: fontSizes.sm,
  },
} as const;

const COMPACT_SWITCH_SX = {
  flexShrink: 0,
  m: 0,
  width: 40,
  height: 22,
  p: 0,
  '& .MuiSwitch-switchBase': {
    p: 0.25,
    '&.Mui-checked': { transform: 'translateX(18px)' },
  },
  '& .MuiSwitch-thumb': { width: 16, height: 16 },
  '& .MuiSwitch-track': { borderRadius: 11, opacity: 1 },
} as const;

/** Configuração das regras que geram pendências automaticamente. */
export function PendingRulesDialog({ open, onClose, canEdit }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [draft, setDraft] = useState<PendingRuleConfig[]>([]);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['pendencias', 'rules'],
    queryFn: pendenciasApi.getRules,
    enabled: open,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => usersApi.listActive(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (open && rules) setDraft(rules);
  }, [open, rules]);

  const saveMutation = useMutation({
    mutationFn: pendenciasApi.updateRules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendencias'] });
      toast.success('Regras salvas.');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar as regras.')),
  });

  const patch = (index: number, changes: Partial<PendingRuleConfig>) =>
    setDraft((prev) => prev.map((r, i) => (i === index ? { ...r, ...changes } : r)));

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
            : { maxWidth: DIALOG_MAX_WIDTH, maxHeight: 'min(86dvh, 620px)', overflow: 'hidden' }),
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...(isMobile ? { height: '100%' } : {}) }}>
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title="Regras de pendência"
          subtitle="Escolha o que gera pendência automaticamente nas outras telas"
          icon={<SettingsOutlinedIcon fontSize="small" />}
        />

        <DialogContent
          sx={{
            px: { xs: 2, sm: 2.5 },
            pb: { xs: 1.5, sm: 2 },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            bgcolor: 'background.default',
            '&.MuiDialogContent-root': { pt: { xs: 2, sm: 2.25 } },
          }}
        >
          {isLoading || draft.length === 0
            ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} height={52} sx={{ mb: 0.5 }} />)
            : draft.map((r, i) => {
                const meta = RULE_META[r.rule];
                const category = CATEGORY_META[RULE_CATEGORY[r.rule]];
                const categoryTone = categoryColor(theme, RULE_CATEGORY[r.rule]);
                const fieldsDisabled = !canEdit || !r.enabled;

                return (
                  <Box
                    key={r.rule}
                    sx={{
                      py: 1.1,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&:last-of-type': { borderBottom: 0 },
                      opacity: r.enabled ? 1 : 0.55,
                      transition: 'opacity .15s',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          mt: 0.15,
                          borderRadius: '9px',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: softBg(theme, categoryTone),
                          color: categoryTone,
                        }}
                      >
                        <PendIcon name={meta.icon} size={15} strokeWidth={1.65} />
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Stack direction="row" alignItems="center" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontSize: fontSizes.sm,
                                fontWeight: 700,
                                lineHeight: 1.3,
                                letterSpacing: '-0.01em',
                              }}
                            >
                              {meta.label}
                            </Typography>
                            <Box
                              component="span"
                              sx={{
                                fontSize: fontSizes['3xs'],
                                fontWeight: 600,
                                px: 0.55,
                                py: 0.1,
                                borderRadius: '5px',
                                lineHeight: 1.35,
                                bgcolor: softBg(theme, categoryTone),
                                color: categoryTone,
                              }}
                            >
                              {category.label}
                            </Box>
                          </Stack>
                          <Switch
                            checked={r.enabled}
                            disabled={!canEdit}
                            onChange={(e) => patch(i, { enabled: e.target.checked })}
                            inputProps={{ 'aria-label': meta.label }}
                            sx={COMPACT_SWITCH_SX}
                          />
                        </Stack>

                        <Typography
                          sx={{
                            fontSize: fontSizes['2xs'],
                            color: 'text.secondary',
                            lineHeight: 1.35,
                            mt: 0.2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {meta.description}
                        </Typography>

                        <Grid container spacing={1} sx={{ mt: 0.75 }} alignItems="flex-start">
                          {meta.param && (
                            <Grid item xs={12} sm={5}>
                              <LabeledField label={meta.param.label}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  type="number"
                                  value={r.param ?? ''}
                                  disabled={fieldsDisabled}
                                  onChange={(e) => {
                                    const v =
                                      e.target.value === ''
                                        ? null
                                        : Math.max(0, Math.min(365, Math.round(Number(e.target.value))));
                                    patch(i, { param: v });
                                  }}
                                  InputProps={{
                                    endAdornment: <FieldAdornment>{meta.param.suffix}</FieldAdornment>,
                                  }}
                                  inputProps={{ min: 0, max: 365, 'aria-label': meta.param.label }}
                                  sx={COMPACT_FIELD_SX}
                                />
                              </LabeledField>
                            </Grid>
                          )}
                          <Grid item xs={12} sm={meta.param ? 7 : 12}>
                            <LabeledField label="Responsável padrão">
                              <TextField
                                select
                                size="small"
                                fullWidth
                                value={r.assigneeId ?? ''}
                                disabled={fieldsDisabled}
                                onChange={(e) => patch(i, { assigneeId: e.target.value || null })}
                                SelectProps={{ displayEmpty: true }}
                                inputProps={{ 'aria-label': 'Responsável padrão' }}
                                sx={COMPACT_FIELD_SX}
                              >
                                <MenuItem value="" sx={{ fontSize: fontSizes.sm }}>
                                  <em>Automático</em>
                                </MenuItem>
                                {users.map((u) => (
                                  <MenuItem key={u.id} value={u.id} sx={{ fontSize: fontSizes.sm }}>
                                    {u.name}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </LabeledField>
                          </Grid>
                        </Grid>
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} disabled={saveMutation.isPending}>
            {canEdit ? 'Cancelar' : 'Fechar'}
          </Button>
          {canEdit && (
            <Button
              variant="contained"
              disabled={saveMutation.isPending || draft.length === 0}
              onClick={() => saveMutation.mutate(draft)}
            >
              {saveMutation.isPending ? 'Salvando…' : 'Salvar regras'}
            </Button>
          )}
        </DialogActions>
      </Box>
    </Dialog>
  );
}
