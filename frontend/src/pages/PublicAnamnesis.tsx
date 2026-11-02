import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';

import { anamnesisApi } from '../api/anamnesis';
import { QuestionField, isBlankAnswer, missingRequired } from '../components/anamnesis/QuestionField';
import { PANEL_SX, PRIMARY_BUTTON_SX } from '../components/skincare/skincareUi';
import { fontSizes } from '../theme/fontSizes';
import { getApiErrorMessage } from '../utils/apiError';
import type { AnamnesisAnswerValue, PublicAnamnesisForm } from '../types';

const OTHER_SECTION = 'Outras perguntas';

function Drop() {
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: '12px',
        background: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
        boxShadow: '0 8px 22px -6px rgba(15,124,123,.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M12 3c4.2 5 6.2 8.2 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 11.2 7.8 8 12 3z" />
      </svg>
    </Box>
  );
}

function Shell({ clinicName, children }: { clinicName?: string | null; children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          background: 'linear-gradient(155deg, #0B2A26 0%, #0E3F39 52%, #0E7C7B 130%)',
          color: '#fff',
          px: 2,
          pt: 'calc(env(safe-area-inset-top, 0px) + 20px)',
          pb: 7,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ maxWidth: 560, mx: 'auto' }}>
          <Drop />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: fontSizes.lg, lineHeight: 1.15 }} noWrap>
              {clinicName || 'Ficha de anamnese'}
            </Typography>
            <Typography sx={{ fontSize: fontSizes['2xs'], fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', opacity: 0.75 }}>
              Ficha de anamnese
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ maxWidth: 560, mx: 'auto', px: 2, mt: -5, pb: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>{children}</Box>
    </Box>
  );
}

function groupBySection(questions: PublicAnamnesisForm['questions']) {
  const groups: { title: string; questions: PublicAnamnesisForm['questions'] }[] = [];
  for (const q of questions) {
    const title = q.section?.trim() || OTHER_SECTION;
    let group = groups.find((g) => g.title === title);
    if (!group) {
      group = { title, questions: [] };
      groups.push(group);
    }
    group.questions.push(q);
  }
  return groups;
}

/** Página aberta pela paciente a partir do link do WhatsApp (sem login). */
export function PublicAnamnesis() {
  const { token = '' } = useParams();
  const [answers, setAnswers] = useState<Record<string, AnamnesisAnswerValue>>({});
  const [showErrors, setShowErrors] = useState(false);

  const { data: form, isLoading, error } = useQuery({
    queryKey: ['public-anamnesis', token],
    queryFn: () => anamnesisApi.getPublicForm(token),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const groups = useMemo(() => groupBySection(form?.questions ?? []), [form]);
  const missing = useMemo(() => missingRequired(form?.questions ?? [], answers), [form, answers]);

  const submit = useMutation({
    mutationFn: () => {
      const filled = Object.fromEntries(Object.entries(answers).filter(([, v]) => !isBlankAnswer(v)));
      return anamnesisApi.submitPublic(token, filled);
    },
    onSuccess: () => window.scrollTo({ top: 0 }),
  });

  const send = () => {
    if (missing.length) {
      setShowErrors(true);
      document.getElementById(`q-${missing[0].key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    submit.mutate();
  };

  if (isLoading) {
    return (
      <Shell>
        <Box sx={{ ...PANEL_SX, borderRadius: '20px', p: 5, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Shell>
    );
  }

  if (error || !form) {
    return (
      <Shell>
        <Box sx={{ ...PANEL_SX, borderRadius: '20px', p: 3 }}>
          <Typography sx={{ fontSize: fontSizes['2xl'], fontWeight: 800, mb: 1 }}>Link indisponível</Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {getApiErrorMessage(error, 'Não foi possível abrir este link. Peça um novo link à clínica.')}
          </Typography>
        </Box>
      </Shell>
    );
  }

  if (submit.isSuccess) {
    return (
      <Shell clinicName={form.clinicName}>
        <Box sx={{ ...PANEL_SX, borderRadius: '20px', p: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: fontSizes['3xl'], fontWeight: 800, mb: 1 }}>Obrigada, {form.firstName}!</Typography>
          <Typography sx={{ color: 'text.secondary' }}>Suas respostas foram enviadas para a clínica. Já pode fechar esta página.</Typography>
        </Box>
      </Shell>
    );
  }

  return (
    <Shell clinicName={form.clinicName}>
      <Stack spacing={2}>
        <Box sx={{ ...PANEL_SX, borderRadius: '20px', p: { xs: 2.25, sm: 3 } }}>
          <Typography component="h1" sx={{ fontSize: fontSizes['3xl'], fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.25 }}>
            Olá, {form.firstName}!
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: fontSizes.sm, color: 'text.secondary', lineHeight: 1.5 }}>
            Responda as perguntas abaixo antes da sua consulta. As marcadas com <b>*</b> são obrigatórias. Suas respostas vão
            direto para a sua ficha na clínica.
          </Typography>
        </Box>

        {groups.map((group) => (
          <Box key={group.title} sx={{ ...PANEL_SX, borderRadius: '20px', p: { xs: 2.25, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'primary.main' }}>
              {group.title}
            </Typography>
            {group.questions.map((q) => (
              <QuestionField
                key={q.key}
                question={q}
                value={answers[q.key]}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))}
                error={showErrors && missing.some((m) => m.key === q.key)}
              />
            ))}
          </Box>
        ))}

        {submit.isError && <Alert severity="error">{getApiErrorMessage(submit.error, 'Não foi possível enviar. Tente de novo.')}</Alert>}
        {showErrors && missing.length > 0 && (
          <Alert severity="warning">Faltam {missing.length === 1 ? '1 resposta obrigatória' : `${missing.length} respostas obrigatórias`}.</Alert>
        )}

        <Button onClick={send} disabled={submit.isPending} sx={{ ...PRIMARY_BUTTON_SX, height: 52, borderRadius: '14px', fontSize: fontSizes.md }}>
          {submit.isPending ? 'Enviando…' : 'Enviar respostas'}
        </Button>
      </Stack>
    </Shell>
  );
}
