import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

import { feedbackApi } from '../../api/feedback';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../DialogCloseButton';
import { LabeledField } from '../LabeledField';
import type { FeedbackType } from '../../types';

export type FeedbackReportInitial = {
  type?: FeedbackType;
  title?: string;
  description?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Valores iniciais ao abrir (ex.: solicitação de upgrade em Meu plano). */
  initial?: FeedbackReportInitial;
}

const DIALOG_MAX_WIDTH = 560;
/** Altura mínima do corpo — tipo + campos cabem sem o paper encolher/expandir. */
const CONTENT_MIN_HEIGHT = 360;

export function FeedbackReportDialog({ open, onClose, initial }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const toast = useAppToast();

  const [type, setType] = useState<FeedbackType>('SUGGESTION');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? 'SUGGESTION');
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setTitleError('');
    setDescriptionError('');
  }, [open, initial?.type, initial?.title, initial?.description]);

  const createMutation = useMutation({
    mutationFn: feedbackApi.create,
    onSuccess: () => {
      toast.success('Obrigada! Seu feedback foi enviado.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível enviar o feedback.'));
    },
  });

  const handleSubmit = () => {
    let valid = true;
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle.length < 3) {
      setTitleError('Informe um título com pelo menos 3 caracteres');
      valid = false;
    } else {
      setTitleError('');
    }

    if (trimmedDescription.length < 10) {
      setDescriptionError('Descreva com pelo menos 10 caracteres');
      valid = false;
    } else {
      setDescriptionError('');
    }

    if (!valid) return;

    createMutation.mutate({
      type,
      title: trimmedTitle,
      description: trimmedDescription,
      pageUrl: `${location.pathname}${location.search}`,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={createMutation.isPending ? undefined : onClose}
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
            : {
                maxWidth: DIALOG_MAX_WIDTH,
                width: DIALOG_MAX_WIDTH,
                maxHeight: '94dvh',
                overflow: 'hidden',
              }),
        },
      }}
    >
      <DialogHeader
        onClose={onClose}
        isMobile={isMobile}
        title="Enviar feedback"
        subtitle="Conte o que aconteceu ou o que você gostaria de ver"
        icon={<FeedbackOutlinedIcon fontSize="small" />}
      />

      <DialogContent
        sx={{
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2.5 },
          flex: 1,
          minHeight: isMobile ? 0 : CONTENT_MIN_HEIGHT,
          overflow: 'auto',
          '&.MuiDialogContent-root': { pt: { xs: 2.75, sm: 3 } },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, minHeight: isMobile ? undefined : CONTENT_MIN_HEIGHT - 24 }}>
          <LabeledField label="Tipo" required>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              color="primary"
              value={type}
              onChange={(_, val: FeedbackType | null) => {
                if (val) setType(val);
              }}
              aria-label="Tipo de feedback"
            >
              <ToggleButton value="SUGGESTION" sx={{ px: 1.5, gap: 0.75, textTransform: 'none', fontWeight: 700 }}>
                <LightbulbOutlinedIcon sx={{ fontSize: 18 }} />
                Sugestão
              </ToggleButton>
              <ToggleButton value="BUG" sx={{ px: 1.5, gap: 0.75, textTransform: 'none', fontWeight: 700 }}>
                <BugReportOutlinedIcon sx={{ fontSize: 18 }} />
                Bug
              </ToggleButton>
            </ToggleButtonGroup>
          </LabeledField>

          <LabeledField label="Título" required>
            <TextField
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={!!titleError}
              helperText={titleError || 'Resumo curto do problema ou da ideia'}
              placeholder="Ex.: Filtro da agenda não salva a data"
              fullWidth
              required
              autoFocus
              inputProps={{ maxLength: 200 }}
            />
          </LabeledField>

          <LabeledField label="Descrição" required>
            <TextField
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={!!descriptionError}
              helperText={
                descriptionError ||
                'Detalhe o contexto, os passos e o que você esperava. A página atual será anexada automaticamente.'
              }
              placeholder="Descreva o que aconteceu ou a melhoria desejada"
              fullWidth
              required
              multiline
              minRows={isMobile ? 5 : 6}
              inputProps={{ maxLength: 5000 }}
            />
          </LabeledField>

          <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
            Página atual: {location.pathname}
            {location.search}
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
        <Button type="button" onClick={onClose} disabled={createMutation.isPending}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="contained"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Enviando…' : 'Enviar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
