import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  type DialogProps,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { documentsApi } from '../../api/documents';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { onlyDigits } from '../../utils/masks';
import { whatsappLink } from '../../utils/whatsapp';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx, formSwitchLabelSx } from '../DialogCloseButton';
import { LabeledField } from '../LabeledField';
import { fontSizes } from '../../theme/fontSizes';
import type { DocumentFile } from '../../types';

type Via = 'whatsapp' | 'email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  doc: DocumentFile | null;
  onClose: () => void;
  /** Documento já com o status novo (Pendente → Enviado). */
  onSent?: (doc: DocumentFile) => void;
  sx?: DialogProps['sx'];
}

/**
 * Abre o WhatsApp (wa.me) ou o app de e-mail (mailto) com a mensagem e, se houver, o texto do documento.
 * Não há envio pelo servidor: ao abrir, um documento Pendente passa a Enviado.
 */
export function SendDocumentDialog({ doc, onClose, onSent, sx }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [via, setVia] = useState<Via>('whatsapp');
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const [includeText, setIncludeText] = useState(true);
  const [error, setError] = useState('');

  // Mesma chave do visualizador: traz o texto e o contato do paciente.
  const { data, isLoading } = useQuery({
    queryKey: ['documents', doc?.id],
    queryFn: () => documentsApi.get(doc!.id),
    enabled: !!doc,
  });
  const patient = data?.patient;
  const content = data?.content ?? '';

  useEffect(() => {
    if (!doc || !data) return;
    const first = data.patient?.name.split(' ')[0] ?? '';
    const initialVia: Via = !data.patient?.phone && data.patient?.email ? 'email' : 'whatsapp';
    setVia(initialVia);
    setTarget((initialVia === 'whatsapp' ? data.patient?.phone : data.patient?.email) ?? '');
    setMessage(
      `Olá, ${first}! Segue o documento "${data.name}" para você ler e assinar. Qualquer dúvida, é só responder esta mensagem.`,
    );
    setIncludeText(true);
    setError('');
  }, [doc, data]);

  const markSent = useMutation({
    mutationFn: (id: string) => documentsApi.update(id, { status: 'SENT' }),
    onSuccess: (saved) => {
      queryClient.setQueriesData<DocumentFile[]>({ queryKey: ['documents'] }, (old) =>
        Array.isArray(old) ? old.map((d) => (d.id === saved.id ? { ...d, ...saved } : d)) : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['documents', saved.id], exact: true });
      onSent?.(saved);
      toast.success('Documento marcado como enviado.');
    },
    onError: (err) =>
      toast.error(getApiErrorMessage(err, 'O envio foi aberto, mas não foi possível marcar como enviado.')),
  });

  const pickVia = (v: Via) => {
    setVia(v);
    setTarget((v === 'whatsapp' ? patient?.phone : patient?.email) ?? '');
    setError('');
  };

  const missingContact =
    !!data && !(via === 'whatsapp' ? patient?.phone : patient?.email)
      ? via === 'whatsapp'
        ? 'Paciente sem telefone na ficha. Informe o WhatsApp abaixo ou atualize o cadastro.'
        : 'Paciente sem e-mail na ficha. Informe o e-mail abaixo ou atualize o cadastro.'
      : '';

  const send = () => {
    if (!doc || !data) return;
    const value = target.trim();
    if (via === 'whatsapp' && (onlyDigits(value).length < 10 || onlyDigits(value).length > 13)) {
      setError('Informe um WhatsApp com DDD, ex.: (11) 90000-0000');
      return;
    }
    if (via === 'email' && !EMAIL_RE.test(value)) {
      setError('Informe um e-mail válido');
      return;
    }
    const body = includeText && content ? `${message.trim()}\n\n${content}` : message.trim();
    const url =
      via === 'whatsapp'
        ? whatsappLink(value, body)
        : `mailto:${encodeURIComponent(value)}?subject=${encodeURIComponent(data.name)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
    if (data.status === 'PENDING') markSent.mutate(data.id);
    else toast.success(via === 'whatsapp' ? 'Documento aberto no WhatsApp.' : 'Documento aberto no seu e-mail.');
    onClose();
  };

  return (
    <Dialog
      open={!!doc}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      sx={sx}
      PaperProps={{ sx: dialogPaperSx(isMobile) }}
    >
      <DialogHeader
        onClose={onClose}
        isMobile={isMobile}
        title="Enviar ao paciente"
        subtitle={doc ? [doc.name, doc.patient?.name].filter(Boolean).join(' · ') : undefined}
        icon={<SendOutlinedIcon fontSize="small" />}
      />
      <DialogContent sx={{ '&.MuiDialogContent-root': { pt: 2.5 } }}>
        <Stack spacing={2}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={via}
            onChange={(_, v: Via | null) => v && pickVia(v)}
          >
            <ToggleButton value="whatsapp">WhatsApp</ToggleButton>
            <ToggleButton value="email">E-mail</ToggleButton>
          </ToggleButtonGroup>
          {missingContact && (
            <Alert severity="warning" variant="outlined">
              {missingContact}
            </Alert>
          )}
          <LabeledField label={via === 'whatsapp' ? 'WhatsApp do paciente' : 'E-mail do paciente'} required>
            <TextField
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setError('');
              }}
              placeholder={via === 'whatsapp' ? '(11) 90000-0000' : 'email@exemplo.com'}
              type={via === 'email' ? 'email' : 'tel'}
              inputProps={{ 'aria-label': via === 'whatsapp' ? 'WhatsApp do paciente' : 'E-mail do paciente' }}
              error={!!error}
              helperText={error || undefined}
              disabled={isLoading}
              fullWidth
            />
          </LabeledField>
          <LabeledField label="Mensagem">
            <TextField
              multiline
              minRows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              inputProps={{ 'aria-label': 'Mensagem' }}
              disabled={isLoading}
              fullWidth
            />
          </LabeledField>
          {content ? (
            <FormControlLabel
              sx={formSwitchLabelSx}
              control={<Switch checked={includeText} onChange={(e) => setIncludeText(e.target.checked)} />}
              label="Incluir o texto do documento na mensagem"
            />
          ) : (
            data?.storageKey && (
              <Alert severity="info" variant="outlined">
                O link abre só a conversa: anexe o arquivo do documento nela antes de enviar.
              </Alert>
            )
          )}
          {data?.status === 'PENDING' && (
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
              Ao abrir o envio, o documento passa de Pendente para Enviado.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsBorderSx}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={!data} onClick={send}>
          {via === 'whatsapp' ? 'Abrir WhatsApp' : 'Abrir e-mail'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
