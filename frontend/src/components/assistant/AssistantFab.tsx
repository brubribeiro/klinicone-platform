import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Fab,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useMutation } from '@tanstack/react-query';

import { assistantApi, type AssistantAnswer } from '../../api/assistant';
import { getApiErrorMessage } from '../../utils/apiError';
import { AuroraIcon } from '../AuroraIcon';
import { DialogCloseButton, DialogHeaderIcon } from '../DialogCloseButton';
import { FeedbackReportDialog } from '../feedback/FeedbackReportDialog';

const PANEL_WIDTH = 440;

/** Abaixo de modais MUI (1300) para não cobrir dialogs; acima do conteúdo da página. */
const ASSISTANT_Z = (theme: { zIndex: { modal: number } }) => theme.zIndex.modal - 2;

type ChatEntry =
  | { role: 'user'; text: string }
  | { role: 'assistant'; reply: AssistantAnswer }
  | { role: 'error'; text: string };
type ChatMessage = ChatEntry & { id: number };

interface Props {
  /** Perguntas de exemplo exibidas antes da primeira pergunta. */
  suggestions: string[];
  /** Painel da clínica: oferece o Feedback quando a documentação não cobre a dúvida. */
  canSendFeedback?: boolean;
}

/** Chat de ajuda flutuante (canto inferior direito), minimizado por padrão. */
export function AssistantFab({ suggestions, canSendFeedback = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const nextId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const push = (entry: ChatEntry) => setMessages((prev) => [...prev, { ...entry, id: nextId.current++ }]);

  const ask = useMutation({
    mutationFn: assistantApi.ask,
    onSuccess: (reply) => push({ role: 'assistant', reply }),
    onError: (err) => push({ role: 'error', text: getApiErrorMessage(err, 'Não foi possível consultar o assistente.') }),
  });

  useEffect(() => {
    if (!expanded) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, ask.isPending, expanded]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2 || ask.isPending) return;
    push({ role: 'user', text: trimmed });
    setQuestion('');
    ask.mutate(trimmed);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(question);
  };

  const resetSession = () => {
    setMessages([]);
    setQuestion('');
    nextId.current = 0;
    ask.reset();
  };

  const minimize = () => {
    resetSession();
    setExpanded(false);
  };

  const toggleFab = () => {
    if (expanded) minimize();
    else setExpanded(true);
  };

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          zIndex: ASSISTANT_Z,
          bottom: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1.5,
          pointerEvents: 'none',
          '& > *': { pointerEvents: 'auto' },
        }}
      >
        {expanded && (
          <Paper
            role="dialog"
            aria-label="Assistente"
            elevation={8}
            sx={{
              width: { xs: 'min(calc(100vw - 32px), 400px)', sm: PANEL_WIDTH },
              maxHeight: { xs: 'min(70vh, 520px)', sm: 560 },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '16px',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}
            >
              <DialogHeaderIcon>
                <AuroraIcon name="assistant" size={20} strokeWidth={1.8} />
              </DialogHeaderIcon>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="h2" fontWeight={800} sx={{ fontSize: '1rem', letterSpacing: '-0.3px' }}>
                  Assistente
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  Responde com base na documentação
                </Typography>
              </Box>
              <DialogCloseButton onClose={minimize} aria-label="Minimizar assistente" />
            </Stack>

            <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5, minHeight: 0 }} aria-live="polite">
              {messages.length === 0 && (
                <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Pergunte sobre as telas e funcionalidades. As respostas vêm só da documentação — sem acesso a
                    dados de pacientes ou da agenda.
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                    {suggestions.map((s) => (
                      <Chip key={s} label={s} variant="outlined" onClick={() => send(s)} sx={{ fontWeight: 600 }} />
                    ))}
                  </Stack>
                </Stack>
              )}

              <Stack spacing={1.5}>
                {messages.map((m) => {
                  if (m.role === 'user') {
                    return (
                      <Box
                        key={m.id}
                        sx={{
                          alignSelf: 'flex-end',
                          maxWidth: '85%',
                          px: 1.75,
                          py: 1,
                          borderRadius: '14px 14px 4px 14px',
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {m.text}
                        </Typography>
                      </Box>
                    );
                  }
                  if (m.role === 'error') {
                    return (
                      <Typography key={m.id} variant="body2" color="error.main">
                        {m.text}
                      </Typography>
                    );
                  }
                  return (
                    <AssistantReply
                      key={m.id}
                      reply={m.reply}
                      onOpenFeedback={canSendFeedback ? () => setFeedbackOpen(true) : undefined}
                    />
                  );
                })}
                {ask.isPending && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2">Procurando na documentação…</Typography>
                  </Stack>
                )}
              </Stack>
            </Box>

            <Box
              component="form"
              onSubmit={onSubmit}
              sx={{
                px: 1.5,
                py: 1.25,
                borderTop: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                flexShrink: 0,
              }}
            >
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={1}
                maxRows={3}
                placeholder="Ex.: como ativo o modo escuro?"
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(question);
                  }
                }}
                inputProps={{ 'aria-label': 'Pergunta para o assistente' }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    minHeight: 40,
                    alignItems: 'center',
                    py: 0,
                  },
                  '& .MuiInputBase-inputMultiline': {
                    py: '9px',
                    boxSizing: 'border-box',
                  },
                }}
              />
              <IconButton
                type="submit"
                aria-label="Enviar pergunta"
                disabled={question.trim().length < 2 || ask.isPending}
                sx={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
                }}
              >
                <AuroraIcon name="chevronRight" size={20} strokeWidth={2.2} />
              </IconButton>
            </Box>
          </Paper>
        )}

        <Fab
          color="primary"
          aria-label={expanded ? 'Minimizar assistente' : 'Abrir assistente'}
          aria-expanded={expanded}
          onClick={toggleFab}
          sx={{
            width: 44,
            height: 44,
            minHeight: 44,
            opacity: 0.88,
            boxShadow: '0 4px 14px -6px rgba(21,153,139,.55)',
            transition: (theme) =>
              theme.transitions.create(['transform', 'opacity', 'box-shadow'], {
                duration: theme.transitions.duration.shorter,
              }),
            '&:hover': {
              opacity: 1,
              transform: 'scale(1.12)',
              boxShadow: '0 8px 22px -8px rgba(21,153,139,.75)',
            },
          }}
        >
          <AuroraIcon name="assistant" size={20} strokeWidth={1.8} />
        </Fab>
      </Box>

      {canSendFeedback && <FeedbackReportDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}

function AssistantReply({ reply, onOpenFeedback }: { reply: AssistantAnswer; onOpenFeedback?: () => void }) {
  return (
    <Stack spacing={0.75} sx={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
      <Box
        sx={{
          px: 1.75,
          py: 1,
          borderRadius: '14px 14px 14px 4px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {reply.answer}
        </Typography>
      </Box>
      {!reply.covered && onOpenFeedback && (
        <Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AuroraIcon name="feedback" size={16} />}
            onClick={onOpenFeedback}
          >
            Enviar feedback
          </Button>
        </Box>
      )}
    </Stack>
  );
}
