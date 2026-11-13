import { useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { documentTemplatesApi, type DocumentTemplatePayload } from '../../api/documentTemplates';
import { useAppDialog } from '../../contexts/AppDialogContext';
import { useAppToast } from '../../contexts/AppToastContext';
import { useDeleteWithDependencies } from '../../hooks/useDeleteWithDependencies';
import { getApiErrorMessage } from '../../utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../DialogCloseButton';
import { LabeledField } from '../LabeledField';
import { TEMPLATE_PLACEHOLDERS, categoryMeta } from './documentUtils';
import { usePlatformCatalog } from '../../hooks/usePlatformCatalog';
import type { DocumentTemplate } from '../../types';
import { fontSizes } from '../../theme/fontSizes';

const TEMPLATES_KEY = ['document-templates'];

const ROW_ACTION_SX = { width: 30, height: 30, borderRadius: '9px' } as const;

interface Props {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

type FormState = { id?: string; name: string; category: string; content: string; active: boolean };

const EMPTY_FORM: FormState = { name: '', category: 'consentimento', content: '', active: true };

export function DocumentTemplatesDialog({ open, onClose, canEdit, canDelete }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const deleteWithDependencies = useDeleteWithDependencies();
  const { confirm } = useAppDialog();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const documentCategories = usePlatformCatalog('document_category');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: documentTemplatesApi.list,
    enabled: open,
  });

  const replaceInCache = (saved: DocumentTemplate) =>
    queryClient.setQueryData<DocumentTemplate[]>(TEMPLATES_KEY, (old = []) => {
      const exists = old.some((t) => t.id === saved.id);
      const next = exists ? old.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)) : [...old, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    });

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: DocumentTemplatePayload }) =>
      id ? documentTemplatesApi.update(id, payload) : documentTemplatesApi.create(payload),
    onSuccess: (saved, { id }) => {
      replaceInCache(saved);
      toast.success(id ? 'Modelo atualizado.' : 'Modelo criado.');
      setForm(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar o modelo.')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => documentTemplatesApi.update(id, { active }),
    onMutate: ({ id, active }) => {
      const previous = queryClient.getQueryData<DocumentTemplate[]>(TEMPLATES_KEY);
      queryClient.setQueryData<DocumentTemplate[]>(TEMPLATES_KEY, (old = []) =>
        old.map((t) => (t.id === id ? { ...t, active } : t)),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      queryClient.setQueryData(TEMPLATES_KEY, ctx?.previous);
      toast.error(getApiErrorMessage(err, 'Não foi possível alterar o modelo.'));
    },
  });

  const handleClose = () => {
    setForm(null);
    onClose();
  };

  const insertPlaceholder = (key: string) => {
    if (!form) return;
    const token = `{{${key}}}`;
    const el = contentRef.current;
    const start = el?.selectionStart ?? form.content.length;
    const end = el?.selectionEnd ?? form.content.length;
    const content = form.content.slice(0, start) + token + form.content.slice(end);
    setForm({ ...form, content });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleDelete = async (t: DocumentTemplate) => {
    await deleteWithDependencies({
      title: 'Excluir modelo',
      message: `Excluir o modelo "${t.name}"?`,
      remove: (options) => documentTemplatesApi.remove(t.id, options),
      successMessage: 'Modelo excluído.',
      errorMessage: 'Não foi possível excluir o modelo.',
      onDeleted: () => {
        queryClient.setQueryData<DocumentTemplate[]>(TEMPLATES_KEY, (old = []) => old.filter((item) => item.id !== t.id));
      },
    });
  };

  const canSave = !!form && form.name.trim().length > 0 && form.content.trim().length > 0;

  const list = (
    <Stack spacing={1}>
      {isLoading &&
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={58} sx={{ borderRadius: '12px' }} />)}
      {!isLoading && templates.length === 0 && (
        <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary', fontSize: fontSizes.sm }}>
          Nenhum modelo cadastrado.
        </Typography>
      )}
      {templates.map((t) => {
        const cat = categoryMeta(t.category);
        const used = t._count?.documents ?? 0;
        return (
          <Stack
            key={t.id}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{
              px: 1.75,
              py: 1.25,
              border: 1,
              borderColor: 'grey.100',
              borderRadius: '12px',
              opacity: t.active ? 1 : 0.6,
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
              }}
            >
              <DescriptionOutlinedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }} noWrap title={t.name}>
                {t.name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                <Chip
                  label={cat.label}
                  size="small"
                  sx={{ height: 20, fontSize: fontSizes['2xs'], fontWeight: 700, bgcolor: 'grey.100' }}
                />
                <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
                  {used === 1 ? '1 documento gerado' : `${used} documentos gerados`}
                </Typography>
              </Stack>
            </Box>
            {canEdit && (
              <Tooltip title={t.active ? 'Desativar' : 'Ativar'}>
                <Switch
                  size="small"
                  checked={t.active}
                  onChange={() => toggleMutation.mutate({ id: t.id, active: !t.active })}
                />
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title="Editar">
                <IconButton
                  aria-label={`Editar modelo ${t.name}`}
                  sx={ROW_ACTION_SX}
                  onClick={() =>
                    setForm({ id: t.id, name: t.name, category: t.category ?? 'outro', content: t.content, active: t.active })
                  }
                >
                  <EditOutlinedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Excluir">
                <IconButton aria-label={`Excluir modelo ${t.name}`} sx={{ ...ROW_ACTION_SX, color: 'error.main' }} onClick={() => handleDelete(t)}>
                  <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      })}
    </Stack>
  );

  const formView = form && (
    <Stack spacing={1.75}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr' }, gap: 1.75 }}>
        <LabeledField label="Nome do modelo">
          <TextField
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Consentimento — Preenchimento"
            fullWidth
            autoFocus
          />
        </LabeledField>
        <LabeledField label="Tipo de documento">
          <TextField select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} fullWidth>
            {documentCategories.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
        </LabeledField>
      </Box>
      <LabeledField label="Conteúdo">
        <TextField
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          inputRef={contentRef}
          multiline
          minRows={10}
          maxRows={18}
          fullWidth
          placeholder="Eu, {{paciente}}, CPF {{cpf}}, declaro que…"
          InputProps={{ sx: { fontSize: fontSizes.sm, lineHeight: 1.6 } }}
        />
      </LabeledField>
      <Box>
        <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mb: 0.75 }}>
          Campos preenchidos automaticamente ao gerar o documento — clique para inserir:
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75}>
          {TEMPLATE_PLACEHOLDERS.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              size="small"
              onClick={() => insertPlaceholder(p.key)}
              sx={{
                height: 24,
                fontSize: fontSizes.xs,
                fontWeight: 600,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: 'primary.dark',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
              }}
            />
          ))}
        </Stack>
      </Box>
      <FormControlLabel
        control={<Switch checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />}
        label={<Typography sx={{ fontSize: fontSizes.sm }}>Ativo (aparece em “Novo documento”)</Typography>}
      />
    </Stack>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ sx: { ...dialogPaperSx(isMobile), maxWidth: { sm: 640 } } }}
    >
      <DialogHeader
        onClose={handleClose}
        isMobile={isMobile}
        title={form ? (form.id ? 'Editar modelo' : 'Novo modelo') : 'Modelos de documento'}
        subtitle={
          form
            ? 'O texto é preenchido com os dados do paciente ao gerar o documento'
            : `${templates.filter((t) => t.active).length} ativos de ${templates.length}`
        }
        icon={<DescriptionOutlinedIcon fontSize="small" />}
      />
      <DialogContent sx={{ '&.MuiDialogContent-root': { pt: 2.5 } }}>{form ? formView : list}</DialogContent>
      <DialogActions sx={{ ...dialogActionsBorderSx, gap: 1 }}>
        {form ? (
          <>
            <Button startIcon={<ArrowBackIcon />} onClick={() => setForm(null)} sx={{ mr: 'auto' }}>
              Voltar
            </Button>
            <Button
              variant="contained"
              disabled={!canSave || saveMutation.isPending}
              onClick={() =>
                form &&
                saveMutation.mutate({
                  id: form.id,
                  payload: {
                    name: form.name.trim(),
                    category: form.category,
                    content: form.content,
                    active: form.active,
                  },
                })
              }
            >
              {saveMutation.isPending ? 'Salvando…' : 'Salvar modelo'}
            </Button>
          </>
        ) : (
          <>
            {!isMobile && <Button onClick={handleClose}>Fechar</Button>}
            {canEdit && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setForm(EMPTY_FORM)}>
                Novo modelo
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
