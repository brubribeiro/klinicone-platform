import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  IconButton,
  InputBase,
  alpha,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { MessageTemplateFormDialog } from '../components/messages/MessageTemplateFormDialog';
import { PendingWhatsAppDispatches } from '../components/messages/PendingWhatsAppDispatches';
import { WhatsAppPreview } from '../components/messages/WhatsAppPreview';
import { VariableChip } from '../components/messages/VariableChip';
import {
  categoryLabelMap,
  TEMPLATE_VARIABLES,
  triggerLabelMap,
  triggerOrderMap,
} from '../components/messages/messageTemplateConstants';
import { usePlatformCatalog } from '../hooks/usePlatformCatalog';
import { useUrlState } from '../hooks/useUrlState';
import { matchFields } from '../utils/listFilters';
import { messagesApi } from '../api/messages';
import { proceduresApi } from '../api/procedures';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import type { MessageTemplate } from '../types';
import { fontSizes } from '../theme/fontSizes';

const WHATSAPP_GREEN = '#1DAE53';

const selectedRowBg = (th: Theme) => alpha(th.palette.primary.main, 0.09);

const CARD_SX = { borderRadius: '18px', overflow: 'hidden' } as const;

const ICON_BUTTON_SX = {
  flexShrink: 0,
  width: 36,
  height: 36,
  borderRadius: '10px',
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.secondary',
} as const;

function ChatIcon() {
  return (
    <Box
      component="span"
      sx={{
        width: 38,
        height: 38,
        borderRadius: '11px',
        bgcolor: 'rgba(37,211,102,.14)',
        color: WHATSAPP_GREEN,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.5 11.5a7.5 7.5 0 0 1-10.8 6.7L4 20l1.8-5.2A7.5 7.5 0 1 1 20.5 11.5z" />
        <path d="M8.5 11h7M8.5 8.5h4" />
      </svg>
    </Box>
  );
}

function StatusBadge({
  active,
  onClick,
  disabled,
}: {
  active: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const badge = (
    <Box
      component={onClick ? 'button' : 'span'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      sx={{
        fontFamily: 'inherit',
        fontSize: fontSizes.xs,
        fontWeight: 700,
        color: active ? WHATSAPP_GREEN : 'text.secondary',
        bgcolor: active ? 'rgba(37,211,102,.13)' : 'grey.100',
        px: 1.5,
        py: 0.625,
        border: 'none',
        borderRadius: '8px',
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {active ? 'Ativa' : 'Inativa'}
    </Box>
  );
  if (!onClick) return badge;
  return <Tooltip title={active ? 'Clique para desativar' : 'Clique para ativar'}>{badge}</Tooltip>;
}

export function Messages() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canCreate = has('messages:create');
  const canEdit = has('messages:edit');
  const canDelete = has('messages:delete');
  usePlatformCatalog('message_category');
  usePlatformCatalog('message_trigger');
  const categoryLabel = categoryLabelMap();
  const triggerLabel = triggerLabelMap();
  const triggerOrder = triggerOrderMap();

  const [search, setSearch] = useUrlState('busca', '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => messagesApi.list(),
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => proceduresApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => messagesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      setSelectedId(null);
      toast.success('Modelo excluído.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível excluir o modelo.'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (t: MessageTemplate) => messagesApi.update(t.id, { active: !t.active }),
    onMutate: async (t) => {
      await queryClient.cancelQueries({ queryKey: ['message-templates'] });
      const previous = queryClient.getQueryData<MessageTemplate[]>(['message-templates']);
      queryClient.setQueryData<MessageTemplate[]>(['message-templates'], (old) =>
        old?.map((x) => (x.id === t.id ? { ...x, active: !t.active } : x)),
      );
      return { previous };
    },
    onSuccess: (saved) => {
      toast.success(saved.active ? 'Modelo ativado.' : 'Modelo desativado.');
    },
    onError: (err, _t, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['message-templates'], ctx.previous);
      toast.error(getApiErrorMessage(err, 'Não foi possível alterar o status.'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    },
  });

  // Ordem da jornada do paciente (gatilho), inativos por último.
  const sortedTemplates = useMemo(
    () =>
      [...templates].sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          (triggerOrder[a.trigger] ?? 99) - (triggerOrder[b.trigger] ?? 99) ||
          a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [templates, triggerOrder],
  );

  const filteredTemplates = useMemo(
    () =>
      sortedTemplates.filter((t) =>
        matchFields(
          search,
          t.name,
          t.content,
          triggerLabel[t.trigger],
          t.category ? categoryLabel[t.category] : undefined,
          t.procedure?.name,
        ),
      ),
    [sortedTemplates, search],
  );

  const selected =
    filteredTemplates.find((t) => t.id === selectedId) ?? filteredTemplates[0] ?? null;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (t: MessageTemplate) => {
    setEditing(t);
    setFormOpen(true);
  };

  const handleDelete = async (t: MessageTemplate) => {
    const ok = await confirm({
      title: 'Excluir modelo',
      message: `Excluir o modelo ${t.name}?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(t.id);
  };

  return (
    <Box>
      <PendingWhatsAppDispatches />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' },
          gap: { xs: 2, sm: 2.25 },
          alignItems: 'start',
        }}
      >
        {/* Lista de modelos */}
        <Card data-tour="messages-list" sx={CARD_SX}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ px: { xs: 2, sm: 2.75 }, py: 2.25, borderBottom: 1, borderColor: 'divider' }}
          >
            <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700, whiteSpace: 'nowrap' }}>
              Modelos de mensagem
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1.125} sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  height: 36,
                  px: 1.5,
                  borderRadius: '10px',
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'grey.50',
                  width: { xs: '100%', sm: 170 },
                  minWidth: 0,
                }}
              >
                <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <InputBase
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar modelo..."
                  inputProps={{ 'aria-label': 'Buscar modelo' }}
                  sx={{ fontSize: fontSizes.sm, flex: 1, minWidth: 0 }}
                />
              </Stack>
              {canCreate && (
                <Button data-tour="messages-new"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreate}
                  sx={{
                    flexShrink: 0,
                    height: 36,
                    px: 1.75,
                    borderRadius: '10px',
                    fontSize: fontSizes.sm,
                    fontWeight: 700,
                  }}
                >
                  Novo
                </Button>
              )}
            </Stack>
          </Stack>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Stack
                key={i}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ px: 2.75, py: 1.75, borderBottom: 1, borderColor: 'grey.100' }}
              >
                <Skeleton variant="rounded" width={38} height={38} sx={{ borderRadius: '11px' }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="55%" />
                  <Skeleton variant="text" width="35%" />
                </Box>
              </Stack>
            ))
          ) : filteredTemplates.length === 0 ? (
            <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 700 }}>
                {templates.length === 0 ? 'Nenhum modelo cadastrado' : 'Nenhum modelo encontrado'}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: fontSizes.md, mt: 0.5 }}>
                {templates.length === 0
                  ? 'Crie modelos para agilizar confirmações, lembretes e aniversários.'
                  : 'Tente outra busca.'}
              </Typography>
            </Box>
          ) : (
            filteredTemplates.map((t) => {
              const isSelected = t.id === selected?.id;
              return (
                <Box
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(t.id);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: { xs: 2, sm: 2.75 },
                    py: 1.75,
                    borderBottom: 1,
                    borderColor: 'grey.100',
                    cursor: 'pointer',
                    bgcolor: isSelected ? selectedRowBg : 'transparent',
                    '&:last-of-type': { borderBottom: 0 },
                    '&:hover': { bgcolor: isSelected ? selectedRowBg : 'grey.50' },
                    outline: 'none',
                    '&:focus-visible': { boxShadow: (th) => `inset 0 0 0 2px ${th.palette.primary.main}` },
                  }}
                >
                  <Box sx={{ opacity: t.active ? 1 : 0.5, display: 'flex' }}>
                    <ChatIcon />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                    <Typography
                      noWrap
                      sx={{
                        fontSize: fontSizes.md,
                        fontWeight: 700,
                        color: t.active ? 'text.primary' : 'text.secondary',
                      }}
                    >
                      {t.name}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
                      Gatilho: {triggerLabel[t.trigger]}
                      {!t.active && ' · Inativa'}
                    </Typography>
                  </Box>
                  {isSelected && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Box>
              );
            })
          )}
        </Card>

        {/* Detalhe do modelo selecionado */}
        <Card data-tour="messages-detail" sx={{ ...CARD_SX, p: { xs: 2, sm: 2.75 }, position: { md: 'sticky' }, top: { md: 16 } }}>
          {isLoading ? (
            <>
              <Skeleton variant="text" width="45%" sx={{ fontSize: fontSizes.xl }} />
              <Skeleton variant="text" width="30%" sx={{ mb: 2 }} />
              <Skeleton variant="rounded" height={170} sx={{ borderRadius: '16px' }} />
            </>
          ) : !selected ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 700 }}>Nenhum modelo selecionado</Typography>
              <Typography color="text.secondary" sx={{ fontSize: fontSizes.md, mt: 0.5 }}>
                Escolha um modelo na lista para ver a prévia.
              </Typography>
            </Box>
          ) : (
            <>
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                spacing={1.5}
                sx={{ mb: 2 }}
              >
                <Box sx={{ minWidth: 0, lineHeight: 1.3 }}>
                  <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>
                    {selected.name}
                  </Typography>
                  <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
                    Enviada: {triggerLabel[selected.trigger]}
                    {selected.category && ` · ${categoryLabel[selected.category] ?? selected.category}`}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
                  <StatusBadge
                    active={selected.active}
                    onClick={canEdit ? () => toggleMutation.mutate(selected) : undefined}
                    disabled={toggleMutation.isPending}
                  />
                  {canDelete && (
                    <Tooltip title="Excluir modelo">
                      <IconButton
                        aria-label={`Excluir modelo ${selected.name}`}
                        onClick={() => handleDelete(selected)}
                        sx={{ ...ICON_BUTTON_SX, width: 30, height: 30, borderRadius: '9px' }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>

              <WhatsAppPreview
                content={selected.content}
                category={selected.category}
                procedure={selected.procedure}
              />

              <Box sx={{ mt: 2.25 }}>
                <Typography
                  sx={{ fontSize: fontSizes.xs, fontWeight: 700, color: 'text.secondary', mb: 1.125 }}
                >
                  Variáveis disponíveis
                </Typography>
                <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 0.875 }}>
                  {TEMPLATE_VARIABLES.map((v) => (
                    <VariableChip key={v} label={v} />
                  ))}
                </Stack>
              </Box>

              {canEdit && (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => openEdit(selected)}
                  sx={{ mt: 2.5, height: 44, borderRadius: '12px', fontSize: fontSizes.md, fontWeight: 700 }}
                >
                  Editar mensagem
                </Button>
              )}
            </>
          )}
        </Card>
      </Box>

      <MessageTemplateFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        template={editing}
        procedures={procedures}
        onSaved={(saved) => setSelectedId(saved.id)}
      />
    </Box>
  );
}
