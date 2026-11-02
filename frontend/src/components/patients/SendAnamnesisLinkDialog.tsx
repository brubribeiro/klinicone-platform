import { useEffect, useState } from 'react';
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { anamnesisApi } from '../../api/anamnesis';
import { useAppToast } from '../../contexts/AppToastContext';
import { appPath } from '../../utils/appPath';
import { getApiErrorMessage } from '../../utils/apiError';
import { whatsappLink } from '../../utils/whatsapp';
import { fontSizes } from '../../theme/fontSizes';
import { DialogHeader, dialogActionsBorderSx } from '../DialogCloseButton';
import { LabeledField } from '../LabeledField';

interface SendAnamnesisLinkDialogProps {
  open: boolean;
  onClose: () => void;
  patient: { id: string; name: string; phone?: string | null };
}

export function publicAnamnesisUrl(token: string) {
  return `${window.location.origin}${appPath(`/anamnese/${token}`)}`;
}

/**
 * Gera o link para a paciente preencher a anamnese sozinha e abre o WhatsApp (wa.me) com a mensagem.
 * Gerar de novo revoga o link anterior.
 */
export function SendAnamnesisLinkDialog({ open, onClose, patient }: SendAnamnesisLinkDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const toast = useAppToast();
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const first = patient.name.trim().split(/\s+/)[0];
    setPhone(patient.phone ?? '');
    setMessage(`Olá, ${first}! Para agilizar seu atendimento, preencha sua ficha de anamnese pelo link abaixo. Leva poucos minutos.`);
    setLink(null);
  }, [open, patient]);

  const generate = useMutation({
    mutationFn: () => anamnesisApi.createLink(patient.id),
    onSuccess: ({ token, expiresAt }) => setLink({ url: publicAnamnesisUrl(token), expiresAt }),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível gerar o link.')),
  });

  const openWhatsApp = () => {
    if (!link) return;
    if (!phone.trim()) {
      toast.error('Informe o WhatsApp da paciente');
      return;
    }
    window.open(whatsappLink(phone, `${message.trim()}\n\n${link.url}`), '_blank', 'noopener');
    toast.success('Mensagem aberta no WhatsApp');
    onClose();
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile} sx={{ zIndex: (t) => t.zIndex.modal + 2 }}>
      <DialogHeader
        onClose={onClose}
        isMobile={isMobile}
        title="Enviar anamnese para a paciente"
        subtitle={patient.name}
        icon={<LinkOutlinedIcon fontSize="small" />}
      />
      <DialogContent sx={{ pt: 2.5 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
            A paciente abre o link no celular, sem login, e as respostas entram nesta ficha. O link vale 7 dias e
            só pode ser enviado uma vez; gerar outro cancela o anterior.
          </Typography>
          <LabeledField label="WhatsApp da paciente">
            <TextField size="small" fullWidth type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 90000-0000" />
          </LabeledField>
          <LabeledField label="Mensagem">
            <TextField size="small" fullWidth multiline minRows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </LabeledField>
          {link && (
            <Alert severity="success" variant="outlined" icon={<LinkOutlinedIcon fontSize="small" />}>
              <Box sx={{ wordBreak: 'break-all', fontSize: fontSizes.sm, fontWeight: 600 }}>{link.url}</Box>
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mt: 0.5 }}>
                Válido até {dayjs(link.expiresAt).format('DD/MM/YYYY [às] HH:mm')}
              </Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsBorderSx}>
        {link ? (
          <>
            <Button onClick={copy} variant="outlined" startIcon={<ContentCopyOutlinedIcon />}>
              Copiar link
            </Button>
            <Button onClick={openWhatsApp} variant="contained" startIcon={<WhatsAppIcon />}>
              Abrir WhatsApp
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose} variant="outlined">
              Cancelar
            </Button>
            <Button onClick={() => generate.mutate()} variant="contained" disabled={generate.isPending}>
              {generate.isPending ? 'Gerando…' : 'Gerar link'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
