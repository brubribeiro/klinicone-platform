import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { patientsApi } from '../../api/patients';
import { messagesApi } from '../../api/messages';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../DialogCloseButton';
import {
  renderTemplate,
  whatsappLink,
  TemplateVars,
  varsFromAppointment,
} from '../../utils/whatsapp';
import { triggerForCategory, triggerLabelMap } from './messageTemplateConstants';
import { usePlatformCatalog } from '../../hooks/usePlatformCatalog';
import type { Appointment, MessageTrigger } from '../../types';

interface SendWhatsAppDialogProps {
  open: boolean;
  onClose: () => void;
  phone?: string;
  vars: TemplateVars;
  patientId?: string | null;
  preferredCategory?: string;
  title?: string;
}

const CATEGORY_USES_APPOINTMENT = new Set(['confirmacao', 'retorno']);
const TRIGGER_USES_APPOINTMENT = new Set<MessageTrigger>(['ON_BOOKING', 'DAY_BEFORE', 'AFTER_APPOINTMENT']);

const statusLabelAppt: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou',
};

function appointmentOptionLabel(appt: Appointment): string {
  const when = dayjs(appt.startAt).format('DD/MM/YYYY [às] HH:mm');
  const proc = appt.procedure?.name ?? 'Procedimento';
  const st = statusLabelAppt[appt.status] ?? appt.status;
  return `${when} · ${proc} · ${st}`;
}

export function SendWhatsAppDialog({
  open,
  onClose,
  phone,
  vars,
  patientId,
  preferredCategory,
  title = 'Enviar mensagem por WhatsApp',
}: SendWhatsAppDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  usePlatformCatalog('message_category');
  usePlatformCatalog('message_trigger');
  const triggerLabel = triggerLabelMap();
  const [templateId, setTemplateId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const { data: allTemplates = [] } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => messagesApi.list(),
    enabled: open,
  });
  const templates = useMemo(() => allTemplates.filter((t) => t.active), [allTemplates]);

  const { data: patientDetail } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.findOne(patientId!),
    enabled: open && !!patientId,
  });

  const appointments = patientDetail?.appointments ?? [];

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const showAppointmentPicker =
    !!patientId &&
    !!selectedTemplate &&
    (TRIGGER_USES_APPOINTMENT.has(selectedTemplate.trigger) ||
      CATEGORY_USES_APPOINTMENT.has(selectedTemplate.category ?? ''));

  const mergedVars: TemplateVars = useMemo(() => {
    const base = { ...vars };
    if (!selectedAppointment || !patientDetail) return base;
    const fromAppt = varsFromAppointment({
      patient: selectedAppointment.patient ?? { name: patientDetail.name },
      procedure: selectedAppointment.procedure,
      professional: selectedAppointment.professional,
      startAt: selectedAppointment.startAt,
    });
    return { ...base, ...fromAppt };
  }, [vars, selectedAppointment, patientDetail]);

  useEffect(() => {
    if (!open) return;
    setSelectedAppointment(null);
  }, [open, patientId]);

  useEffect(() => {
    if (!open) return;
    if (templates.length === 0) return;
    const preferredTrigger = preferredCategory ? triggerForCategory(preferredCategory) : undefined;
    const preferred = preferredCategory
      ? (templates.find((t) => t.trigger === preferredTrigger) ??
        templates.find((t) => t.category === preferredCategory))
      : null;
    const chosen = preferred ?? templates[0];
    setTemplateId(chosen.id);
  }, [open, templates, preferredCategory]);

  useEffect(() => {
    if (!showAppointmentPicker) setSelectedAppointment(null);
  }, [showAppointmentPicker]);

  useEffect(() => {
    if (!open) return;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setMessage(renderTemplate(t.content, mergedVars));
  }, [open, templates, templateId, mergedVars]);

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
  };

  const handleSend = () => {
    if (!phone) return;
    window.open(whatsappLink(phone, message), '_blank');
    if (patientId && selectedTemplate) {
      messagesApi
        .recordManualDispatch({
          templateId: selectedTemplate.id,
          patientId,
          appointmentId: selectedAppointment?.id ?? null,
          phone,
          renderedMessage: message,
        })
        .catch(() => undefined);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ sx: dialogPaperSx(isMobile) }}
    >
      <DialogHeader
        onClose={onClose}
        isMobile={isMobile}
        title={title}
        subtitle="Escolha o template e revise a mensagem"
        icon={<WhatsAppIcon fontSize="small" />}
      />
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {!phone && (
            <Alert severity="warning">
              Esse paciente não tem telefone cadastrado.
            </Alert>
          )}

          <TextField
            select
            label="Template"
            value={templateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            disabled={templates.length === 0}
            helperText={
              templates.length === 0
                ? 'Crie modelos ativos na página de Mensagens'
                : 'Os modelos aceitam {nome}, {procedimento}, {data}, {hora}, {profissional}'
            }
            fullWidth
          >
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name} · {triggerLabel[t.trigger]}
              </MenuItem>
            ))}
          </TextField>

          {showAppointmentPicker && (
            <Autocomplete
              options={[...appointments].sort((a, b) => dayjs(b.startAt).valueOf() - dayjs(a.startAt).valueOf())}
              getOptionLabel={appointmentOptionLabel}
              value={selectedAppointment}
              onChange={(_, val) => setSelectedAppointment(val)}
              disabled={appointments.length === 0}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Agendamento"
                  helperText={
                    appointments.length === 0
                      ? 'Nenhum agendamento no histórico deste paciente'
                      : 'Usado para preencher procedimento, data, horário e profissional na mensagem'
                  }
                />
              )}
            />
          )}

          <TextField
            label="Mensagem"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            rows={6}
            fullWidth
          />

          {phone && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Será enviada para: {phone}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 } }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          startIcon={<WhatsAppIcon />}
          onClick={handleSend}
          disabled={!phone || !message.trim()}
          sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}
        >
          Abrir WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
}
