import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { anamnesisApi } from '../api/anamnesis';
import { AnamnesisQuestionFormDialog, QUESTION_TYPE_LABELS } from '../components/anamnesis/AnamnesisQuestionFormDialog';
import { ListCardHeader } from '../components/ListCardHeader';
import { useAuth } from '../contexts/AuthContext';
import { useAppToast } from '../contexts/AppToastContext';
import { useAnamnesisQuestions } from '../hooks/useAnamnesisQuestions';
import { fontSizes } from '../theme/fontSizes';
import { getApiErrorMessage } from '../utils/apiError';
import type { AnamnesisKind, AnamnesisQuestion } from '../types';

const ACTION_BUTTON_SX = {
  width: 30,
  height: 30,
  borderRadius: '9px',
  border: 1,
  borderColor: 'divider',
  color: 'text.secondary',
} as const;

const KIND_HINTS: Record<AnamnesisKind, string> = {
  GENERAL: 'Ficha da paciente e link que ela preenche pelo celular',
  SKIN: 'Assistente de anamnese de pele (agenda e ficha), que gera a rotina de skincare',
};

/** Cadastro das perguntas da anamnese geral e da de pele (só o administrador da clínica). */
export function AnamnesisQuestions() {
  const { user } = useAuth();
  const hasRoutines = (user?.features ?? []).includes('routines');
  const [kind, setKind] = useState<AnamnesisKind>('GENERAL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnamnesisQuestion | null>(null);
  const queryClient = useQueryClient();
  const toast = useAppToast();

  const { data: questions = [], isLoading } = useAnamnesisQuestions(kind);
  const sections = useMemo(
    () => [...new Set(questions.map((q) => q.section).filter((s): s is string => !!s))],
    [questions],
  );

  const setCache = (list: AnamnesisQuestion[]) => queryClient.setQueryData(['anamnesis-questions', kind], list);

  const reorder = useMutation({
    mutationFn: (ids: string[]) => anamnesisApi.reorderQuestions(kind, ids),
    onSuccess: setCache,
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível reordenar.'));
      queryClient.invalidateQueries({ queryKey: ['anamnesis-questions', kind] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: (q: AnamnesisQuestion) => anamnesisApi.updateQuestion(q.id, { active: !q.active }),
    onSuccess: (updated) => setCache(questions.map((q) => (q.id === updated.id ? updated : q))),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível alterar a pergunta.')),
  });

  const move = (index: number, delta: number) => {
    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setCache(next); // otimista: a lista não pisca enquanto salva
    reorder.mutate(next.map((q) => q.id));
  };

  const activeCount = questions.filter((q) => q.active).length;

  return (
    <Stack spacing={2.25}>
      {hasRoutines && (
        <Tabs value={kind} onChange={(_, v) => setKind(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="GENERAL" label="Anamnese geral" />
          <Tab value="SKIN" label="Anamnese de pele" />
        </Tabs>
      )}

      <ListCardHeader
        nowrapFrom="md"
        sx={{ px: 0, py: 0, borderBottom: 0 }}
        title={
          <Typography sx={{ fontSize: fontSizes.md, fontWeight: 600, color: 'text.secondary' }}>
            {KIND_HINTS[kind]}
            {!isLoading && (
              <Box component="span" sx={{ color: 'text.disabled', fontWeight: 500 }}>
                {` · ${activeCount} de ${questions.length} ativas`}
              </Box>
            )}
          </Typography>
        }
      >
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Nova pergunta
        </Button>
      </ListCardHeader>

      <Card variant="outlined" sx={{ borderRadius: '16px' }}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={56} sx={{ mx: 2 }} />)
          : questions.map((q, index) => (
              <Stack
                key={q.id}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{
                  px: { xs: 1.5, sm: 2 },
                  py: 1.25,
                  borderTop: index === 0 ? 0 : 1,
                  borderColor: 'divider',
                  opacity: q.active ? 1 : 0.55,
                }}
              >
                <Stack spacing={0.25} sx={{ flexShrink: 0 }}>
                  <IconButton size="small" aria-label="Subir" disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)} sx={{ p: 0.25 }}>
                    <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Descer"
                    disabled={index === questions.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                    sx={{ p: 0.25 }}
                  >
                    <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>
                    {q.label}
                    {q.required && (
                      <Box component="span" sx={{ color: 'error.main' }}>
                        {' *'}
                      </Box>
                    )}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.5 }}>
                    <Chip size="small" label={QUESTION_TYPE_LABELS[q.type]} />
                    {q.section && <Chip size="small" variant="outlined" label={q.section} />}
                    {q.options.length > 0 && (
                      <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', alignSelf: 'center' }} noWrap>
                        {q.options.join(' · ')}
                      </Typography>
                    )}
                    {q.system && (
                      <Chip size="small" color="primary" variant="outlined" label={kind === 'SKIN' ? 'Gera a rotina' : 'Histórico de medidas'} />
                    )}
                  </Stack>
                </Box>
                <Tooltip title={q.system ? 'Pergunta do sistema: sempre ativa' : q.active ? 'Desativar' : 'Ativar'}>
                  <span>
                    <Switch
                      checked={q.active}
                      disabled={q.system || toggleActive.isPending}
                      onChange={() => toggleActive.mutate(q)}
                      inputProps={{ 'aria-label': `Ativa: ${q.label}` }}
                    />
                  </span>
                </Tooltip>
                <Tooltip title="Editar">
                  <IconButton
                    size="small"
                    sx={ACTION_BUTTON_SX}
                    aria-label={`Editar ${q.label}`}
                    onClick={() => {
                      setEditing(q);
                      setFormOpen(true);
                    }}
                  >
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
      </Card>

      <AnamnesisQuestionFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        kind={kind}
        question={editing}
        sections={sections}
      />
    </Stack>
  );
}
