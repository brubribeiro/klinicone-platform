import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  IconButton,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useAppDialog } from '../../../../frontend/src/contexts/AppDialogContext';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { LIST_HEADER_ACTION_SX, LIST_HEADER_PRIMARY_ACTION_SX, ListCardHeader } from '../../../../frontend/src/components/ListCardHeader';
import { AnnouncementFormDialog } from '../components/AnnouncementFormDialog';
import { AnnouncementScheduleDialog } from '../components/AnnouncementScheduleDialog';
import {
  AnnouncementKindPill,
  AnnouncementStatusPill,
  announcementWhen,
} from '../components/announcementUi';
import { ROW_ACTION_SX } from '../components/adminUi';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import type { AnnouncementStatus, PlatformAnnouncement } from '../../../../frontend/src/types';

type StatusFilter = 'ALL' | AnnouncementStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'DRAFT', label: 'Rascunhos' },
  { value: 'SCHEDULED', label: 'Agendados' },
  { value: 'SENT', label: 'Enviados' },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Avisos de release para as clínicas: rascunho (do RELEASE_NOTES ou à mão) → enviar agora ou agendar. */
export function AdminAnnouncements() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformAnnouncement | null>(null);
  const [scheduling, setScheduling] = useState<PlatformAnnouncement | null>(null);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: adminApi.listAnnouncements,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
  };
  const onError = (fallback: string) => (err: unknown) => toast.error(getApiErrorMessage(err, fallback));

  const generateMutation = useMutation({
    mutationFn: adminApi.draftAnnouncementsFromRelease,
    onSuccess: (r) => {
      refresh();
      if (r.created.length) toast.success(`${plural(r.created.length, 'rascunho criado', 'rascunhos criados')} da versão ${r.version}.`);
      else toast.info(`A versão ${r.version} já tem avisos; nada novo para gerar.`);
    },
    onError: onError('Não foi possível gerar do release.'),
  });

  const sendMutation = useMutation({
    mutationFn: (a: PlatformAnnouncement) => adminApi.sendAnnouncement(a.id),
    onSuccess: (a) => {
      refresh();
      toast.success(`Aviso enviado para ${plural(a.recipientCount ?? 0, 'usuário', 'usuários')}.`);
    },
    onError: onError('Não foi possível enviar o aviso.'),
  });

  const unscheduleMutation = useMutation({
    mutationFn: (a: PlatformAnnouncement) => adminApi.unscheduleAnnouncement(a.id),
    onSuccess: () => {
      refresh();
      toast.success('Agendamento cancelado; o aviso voltou a rascunho.');
    },
    onError: onError('Não foi possível cancelar o agendamento.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (a: PlatformAnnouncement) => adminApi.deleteAnnouncement(a.id),
    onSuccess: () => {
      refresh();
      toast.success('Aviso excluído.');
    },
    onError: onError('Não foi possível excluir o aviso.'),
  });

  const pending =
    sendMutation.isPending || unscheduleMutation.isPending || deleteMutation.isPending || generateMutation.isPending;

  const sendNow = async (a: PlatformAnnouncement) => {
    const audience = await queryClient
      .fetchQuery({ queryKey: ['admin', 'announcements', 'audience'], queryFn: adminApi.getAnnouncementAudience, staleTime: 0 })
      .catch(() => null);
    const ok = await confirm({
      title: 'Enviar aviso',
      message: `Enviar “${a.title}” agora?`,
      details: [
        audience
          ? `Vai para ${plural(audience.users, 'usuário', 'usuários')} em ${plural(audience.tenants, 'clínica ativa', 'clínicas ativas')}, no sino de notificações.`
          : 'Vai para os usuários das clínicas ativas, no sino de notificações.',
        a.status === 'SCHEDULED' ? 'O agendamento é substituído pelo envio imediato.' : 'Depois de enviado não dá para editar.',
      ],
      confirmLabel: 'Enviar agora',
    });
    if (ok) sendMutation.mutate(a);
  };

  const remove = async (a: PlatformAnnouncement) => {
    const ok = await confirm({
      title: 'Excluir aviso',
      message: `Excluir “${a.title}”?`,
      details: a.version ? ['Para recriar, use “Gerar do release”.'] : undefined,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(a);
  };

  const openForm = (a: PlatformAnnouncement | null) => {
    setEditing(a);
    setFormOpen(true);
  };

  const counts = { DRAFT: 0, SCHEDULED: 0, SENT: 0 } as Record<AnnouncementStatus, number>;
  for (const a of announcements) counts[a.status] += 1;
  const visible = filter === 'ALL' ? announcements : announcements.filter((a) => a.status === filter);

  return (
    <Stack spacing={2.5}>
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <ListCardHeader
          title={
            <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
              {isLoading ? (
                <Skeleton width={220} />
              ) : (
                <>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                    {counts.DRAFT}
                  </Box>{' '}
                  {counts.DRAFT === 1 ? 'rascunho' : 'rascunhos'} · {plural(counts.SCHEDULED, 'agendado', 'agendados')} ·{' '}
                  {plural(counts.SENT, 'enviado', 'enviados')}
                </>
              )}
            </Typography>
          }
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, v: StatusFilter | null) => v && setFilter(v)}
            aria-label="Filtrar por status"
          >
            {FILTERS.map((f) => (
              <ToggleButton key={f.value} value={f.value}>
                {f.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeOutlinedIcon />}
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            sx={LIST_HEADER_ACTION_SX}
          >
            {generateMutation.isPending ? 'Gerando…' : 'Gerar do release'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm(null)} sx={LIST_HEADER_PRIMARY_ACTION_SX}>
            Novo aviso
          </Button>
        </ListCardHeader>

        {isLoading ? (
          <Stack spacing={1.25} sx={{ p: 2.5 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={92} sx={{ borderRadius: '14px' }} />
            ))}
          </Stack>
        ) : visible.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <CampaignOutlinedIcon sx={{ fontSize: 46, color: 'text.disabled', mb: 1 }} />
            <Typography sx={{ fontWeight: 700 }}>
              {announcements.length ? 'Nenhum aviso com este status' : 'Nenhum aviso ainda'}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: fontSizes.md, mt: 0.5 }}>
              {announcements.length
                ? 'Troque o filtro acima.'
                : 'Use “Gerar do release” para criar rascunhos a partir do RELEASE_NOTES da versão atual.'}
            </Typography>
          </Box>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {visible.map((a) => (
              <AnnouncementRow
                key={a.id}
                announcement={a}
                pending={pending}
                onOpen={() => openForm(a)}
                onSend={() => sendNow(a)}
                onSchedule={() => setScheduling(a)}
                onUnschedule={() => unscheduleMutation.mutate(a)}
                onDelete={() => remove(a)}
              />
            ))}
          </Box>
        )}
      </Card>

      <AnnouncementFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <AnnouncementScheduleDialog announcement={scheduling} onClose={() => setScheduling(null)} />
    </Stack>
  );
}

function AnnouncementRow({
  announcement: a,
  pending,
  onOpen,
  onSend,
  onSchedule,
  onUnschedule,
  onDelete,
}: {
  announcement: PlatformAnnouncement;
  pending: boolean;
  onOpen: () => void;
  onSend: () => void;
  onSchedule: () => void;
  onUnschedule: () => void;
  onDelete: () => void;
}) {
  const sent = a.status === 'SENT';
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { md: 'center' },
        gap: { xs: 1.25, md: 2 },
        px: { xs: 2, sm: 2.75 },
        py: 2,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <AnnouncementStatusPill status={a.status} />
          <AnnouncementKindPill kind={a.kind} />
          {a.version && (
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 700 }}>v{a.version}</Typography>
          )}
        </Stack>
        <Typography
          component="button"
          type="button"
          onClick={onOpen}
          title={a.title}
          noWrap
          sx={{
            display: 'block',
            maxWidth: '100%',
            mt: 0.75,
            p: 0,
            border: 0,
            bgcolor: 'transparent',
            font: 'inherit',
            fontSize: fontSizes.lg,
            fontWeight: 800,
            color: 'text.primary',
            textAlign: 'left',
            cursor: 'pointer',
            '&:hover': { color: 'primary.main' },
          }}
        >
          {a.title}
        </Typography>
        <Typography
          sx={{
            fontSize: fontSizes.sm,
            color: 'text.secondary',
            mt: 0.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            whiteSpace: 'pre-line',
          }}
        >
          {a.body}
        </Typography>
        <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600, mt: 0.5 }}>
          {announcementWhen(a)}
        </Typography>
      </Box>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
        {sent ? (
          <Tooltip title="Ver aviso">
            <IconButton aria-label={`Ver ${a.title}`} onClick={onOpen} sx={ROW_ACTION_SX}>
              <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <>
            <Tooltip title="Editar">
              <IconButton aria-label={`Editar ${a.title}`} onClick={onOpen} sx={ROW_ACTION_SX}>
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            {a.status === 'SCHEDULED' ? (
              <Tooltip title="Cancelar agendamento">
                <IconButton
                  aria-label={`Cancelar agendamento de ${a.title}`}
                  disabled={pending}
                  onClick={onUnschedule}
                  sx={ROW_ACTION_SX}
                >
                  <EventBusyOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip title="Excluir">
              <IconButton
                aria-label={`Excluir ${a.title}`}
                disabled={pending}
                onClick={onDelete}
                sx={{ ...ROW_ACTION_SX, color: 'error.main' }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EventOutlinedIcon />}
              disabled={pending}
              onClick={onSchedule}
              sx={{ borderRadius: '10px', whiteSpace: 'nowrap' }}
            >
              {a.status === 'SCHEDULED' ? 'Reagendar' : 'Agendar'}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<SendOutlinedIcon />}
              disabled={pending}
              onClick={onSend}
              sx={{ borderRadius: '10px', whiteSpace: 'nowrap' }}
            >
              Enviar agora
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
