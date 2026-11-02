import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, MenuItem, Select, Skeleton, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { patientsApi } from '../../api/patients';
import { skincareApi } from '../../api/skincare';
import { useAppToast } from '../../contexts/AppToastContext';
import { usePermissions } from '../../contexts/usePermissions';
import { useAnamnesisQuestions } from '../../hooks/useAnamnesisQuestions';
import { usePlatformCatalog } from '../../hooks/usePlatformCatalog';
import { fontSizes } from '../../theme/fontSizes';
import { getApiErrorMessage } from '../../utils/apiError';
import type { AnamnesisAnswerValue, SkinAnswers, SkincareAvoided, SkincareGuideline, SkincareMoment, SkincareRoutine, SkincareRoutineItem, SkincareStep } from '../../types';
import { QuestionField, answerText, missingRequired } from '../anamnesis/QuestionField';
import { SendRoutineDialog } from './SendRoutineDialog';
import {
  AGE_RANGES,
  DARK_CIRCLE_TYPES,
  MOMENT_ICON_PATHS,
  MOMENT_SLOTS,
  SKINCARE_MOMENTS,
  SKIN_CONDITIONS,
  SKIN_TYPES,
  buildSkinWizardSteps,
  canAdvanceCore,
  conditionsText,
  darkCirclesText,
  emptySkinAnswers,
  formatDateBR,
  generateRoutine,
  optionLabel,
  skincareTagsFromCatalog,
  productToItem,
  slotLabel,
  toggleCondition,
  type SkinCoreKey,
  type SkinWizardStep,
} from './skincareUtils';
import {
  BUTTON_SX,
  DANGER_TEXT,
  EYEBROW_SX,
  Field,
  ICON,
  OptionCard,
  PANEL_SX,
  PRIMARY_BUTTON_SX,
  SmallIconButton,
  Svg,
  TEXT_SOFT,
  BORDER_SOFT,
  TextInput,
  tint,
} from './skincareUi';

export interface SkinPatient {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface SkinAnamnesisWizardProps {
  patient: SkinPatient;
  /** Rotina já salva: abre direto no resultado. */
  routine?: SkincareRoutine | null;
  onSaved?: (routine: SkincareRoutine) => void;
}

const DEFAULT_CORE_TITLES: Record<SkinCoreKey, string> = {
  pele: 'Qual é o tipo de pele?',
  afec: 'Está em tratamento de alguma afecção de pele?',
  olheira: 'Tem olheiras?',
  idade: 'Qual é a faixa etária?',
};
const CORE_SUBTITLES: Record<SkinCoreKey, string> = {
  pele: 'Escolha a opção que melhor descreve a pele hoje.',
  afec: 'Selecione todas as que se aplicam.',
  olheira: 'Se sim, indique o tipo predominante.',
  idade: 'Usada para ajustar os ativos de prevenção e renovação.',
};
const CORE_REVIEW_LABELS: Record<SkinCoreKey, string> = {
  pele: 'Tipo de pele',
  afec: 'Afecções',
  olheira: 'Olheiras',
  idade: 'Faixa etária',
};

const optionGrid = (min: number) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
  gap: 1.5,
});

export function SkinAnamnesisWizard({ patient, routine, onSaved }: SkinAnamnesisWizardProps) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { has } = usePermissions();

  const [phase, setPhase] = useState<'wizard' | 'result'>(routine ? 'result' : 'wizard');
  // Com a paciente já definida (ficha/agenda), começa na primeira pergunta, como no protótipo.
  const [step, setStep] = useState(1);
  const [fromReview, setFromReview] = useState(false);
  const [answers, setAnswers] = useState<SkinAnswers>(() => ({ ...emptySkinAnswers(), ...(routine?.answers ?? {}) }));
  const [consultDate, setConsultDate] = useState(routine?.consultDate.slice(0, 10) ?? dayjs().format('YYYY-MM-DD'));
  const [items, setItems] = useState<SkincareRoutineItem[]>(routine?.items ?? []);
  const [avoided, setAvoided] = useState<SkincareAvoided[]>(routine?.avoided ?? []);
  const [guidelines, setGuidelines] = useState<SkincareGuideline[]>(routine?.guidelines ?? []);
  const [notes, setNotes] = useState(routine?.notes ?? '');
  const [editRoutine, setEditRoutine] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(routine?.id ?? null);
  const [dirty, setDirty] = useState(!routine);
  const [sendOpen, setSendOpen] = useState(false);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['skincare', 'products'],
    queryFn: skincareApi.listProducts,
    staleTime: 60_000,
  });
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['skincare', 'rules'],
    queryFn: skincareApi.listRules,
    staleTime: 60_000,
  });
  const { data: questions } = useAnamnesisQuestions('SKIN');
  const steps = useMemo(() => buildSkinWizardSteps(questions, DEFAULT_CORE_TITLES), [questions]);
  const reviewStep = steps.length - 1;
  const current = steps[Math.min(step, reviewStep)];
  const questionSteps = steps.filter((st) => st.kind === 'core' || st.kind === 'extra');
  const extraQuestions = useMemo(() => steps.flatMap((st) => (st.kind === 'extra' ? st.questions : [])), [steps]);

  // Anamnese nova: perguntas da clínica vêm preenchidas com a última rotina ou, nas que saíram da
  // anamnese geral (mesma chave), com a resposta antiga da ficha.
  const { data: previousRoutines } = useQuery({
    queryKey: ['skincare', 'routines', patient.id],
    queryFn: () => skincareApi.listRoutines(patient.id),
    enabled: !routine,
  });
  const { data: patientRecord } = useQuery({
    queryKey: ['patient', patient.id],
    queryFn: () => patientsApi.findOne(patient.id),
    enabled: !routine && has('patients:view'),
    retry: false,
  });
  const prefilled = useRef(!!routine);
  useEffect(() => {
    if (prefilled.current || !questions || !previousRoutines || (has('patients:view') && !patientRecord)) return;
    prefilled.current = true;
    const legacy = (patientRecord?.anamnesis ?? {}) as Record<string, AnamnesisAnswerValue>;
    const last = previousRoutines[0]?.answers.extra ?? {};
    const extra: Record<string, AnamnesisAnswerValue> = {};
    for (const q of questions) {
      const value = last[q.key] ?? legacy[q.key];
      if (value !== undefined && value !== '' && q.active && !q.system) extra[q.key] = value;
    }
    if (Object.keys(extra).length) setAnswers((a) => ({ ...a, extra: { ...extra, ...a.extra } }));
  }, [questions, previousRoutines, patientRecord, has]);

  const tagCatalog = usePlatformCatalog('skincare_tag');
  const tagOptions = useMemo(() => skincareTagsFromCatalog(tagCatalog), [tagCatalog]);
  const catalogLoading = productsLoading || rulesLoading;

  const canSave = has(savedId ? 'routines:edit' : 'routines:create');

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { patientId: patient.id, consultDate, answers, items, avoided, guidelines, notes: notes.trim() || null };
      return savedId ? skincareApi.updateRoutine(savedId, payload) : skincareApi.createRoutine(payload);
    },
    onSuccess: (saved) => {
      setSavedId(saved.id);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['skincare', 'routines', patient.id] });
      toast.success(`Rotina salva na ficha de ${patient.name}`);
      onSaved?.(saved);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar a rotina.')),
  });

  const setAns = <K extends keyof SkinAnswers>(key: K, value: SkinAnswers[K]) => setAnswers((a) => ({ ...a, [key]: value }));
  const setExtra = (key: string, value: AnamnesisAnswerValue) =>
    setAnswers((a) => ({ ...a, extra: { ...a.extra, [key]: value } }));
  const canNext =
    current.kind === 'patient'
      ? !!consultDate
      : current.kind === 'core'
        ? canAdvanceCore(current.key, answers)
        : current.kind === 'extra'
          ? missingRequired(current.questions, answers.extra ?? {}).length === 0
          : !catalogLoading;

  const generate = () => {
    const result = generateRoutine(answers, products, rules, tagOptions);
    setItems(result.items);
    setAvoided(result.avoided);
    setGuidelines(result.guidelines);
    setEditRoutine(false);
    setDirty(true);
    setPhase('result');
  };

  const next = () => {
    if (!canNext) return;
    if (current.kind === 'review') return generate();
    if (fromReview) {
      setStep(reviewStep);
      setFromReview(false);
      return;
    }
    setStep(step + 1);
  };
  const back = () => {
    if (fromReview) {
      setStep(reviewStep);
      setFromReview(false);
    } else if (step > 0) setStep(step - 1);
  };
  const goStep = (i: number) => {
    setStep(i);
    setFromReview(true);
  };
  const resetAll = () => {
    setPhase('wizard');
    setStep(1);
    setFromReview(false);
    setAnswers(emptySkinAnswers());
    setConsultDate(dayjs().format('YYYY-MM-DD'));
    setItems([]);
    setAvoided([]);
    setGuidelines([]);
    setNotes('');
    setEditRoutine(false);
    setSavedId(null);
    setDirty(true);
  };

  const removeItem = (target: SkincareRoutineItem) => {
    setItems((list) => list.filter((i) => i !== target));
    setDirty(true);
  };
  const addItem = (moment: SkincareMoment, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((list) => [...list, productToItem(p, moment)]);
    setDirty(true);
  };

  const sections = useMemo(
    () =>
      SKINCARE_MOMENTS.map(([m, label]) => {
        const steps = MOMENT_SLOTS[m].map((st: SkincareStep, i) => {
          const slotItems = items.filter((it) => it.moment === m && it.step === st);
          const used = new Set(slotItems.map((it) => it.productId));
          const addOptions = products.filter((p) => p.step === st && p.moments.includes(m) && !used.has(p.id));
          return { n: i + 1, key: `${m}.${st}`, label: slotLabel(m, st), items: slotItems, addOptions };
        });
        const filled = steps.filter((s) => s.items.length > 0).length;
        return { key: m, label, sub: `${filled} de ${steps.length} etapas`, steps };
      }),
    [items, products],
  );

  const coreValue: Record<SkinCoreKey, string> = {
    pele: optionLabel(SKIN_TYPES, answers.pele),
    afec: conditionsText(answers),
    olheira: darkCirclesText(answers),
    idade: optionLabel(AGE_RANGES, answers.idade),
  };
  const reviewRows = steps.flatMap((st, i) => {
    if (st.kind === 'patient') return [{ key: 'patient', label: 'Paciente', value: `${patient.name} · ${formatDateBR(consultDate)}`, step: i }];
    if (st.kind === 'core') return [{ key: st.key, label: CORE_REVIEW_LABELS[st.key], value: coreValue[st.key] || '—', step: i }];
    if (st.kind === 'extra') return st.questions.map((q) => ({ key: q.key, label: q.label, value: answerText(answers.extra?.[q.key]), step: i }));
    return [];
  });

  if (phase === 'wizard') {
    const nextLabel = current.kind === 'review' ? 'Gerar rotina' : fromReview ? 'Voltar à revisão' : 'Continuar';
    const questionIndex = (questionSteps as SkinWizardStep[]).indexOf(current) + 1;
    const eyebrow =
      current.kind === 'patient' ? 'Identificação' : current.kind === 'review' ? 'Revisão' : `Pergunta ${questionIndex} de ${questionSteps.length}`;
    const title =
      current.kind === 'patient'
        ? 'Dados da paciente'
        : current.kind === 'core'
          ? current.title
          : current.kind === 'extra'
            ? 'Mais sobre a pele'
            : 'Revise as respostas';
    const subtitle =
      current.kind === 'patient'
        ? 'Identifique a paciente e a data da consulta.'
        : current.kind === 'core'
          ? CORE_SUBTITLES[current.key]
          : current.kind === 'extra'
            ? 'Perguntas cadastradas pela clínica. As marcadas com * são obrigatórias.'
            : 'Confira tudo antes de gerar a rotina. Use Editar para corrigir uma resposta.';
    return (
      <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 2.5 }, pt: { xs: 2.5, sm: 4 }, pb: 7, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'primary.main' }}>
              {eyebrow}
            </Typography>
            <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 600, color: TEXT_SOFT }}>Etapa {step + 1} de {steps.length}</Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: 0.75 }}>
            {steps.map((_, i) => (
              <Box key={i} sx={{ height: 6, borderRadius: '6px', bgcolor: i <= step ? 'primary.main' : '#D5E0DC' }} />
            ))}
          </Box>
        </Box>

        <Box sx={{ ...PANEL_SX, borderRadius: '20px', p: { xs: 2.25, sm: 3.5 }, display: 'flex', flexDirection: 'column', gap: 2.75 }}>
          <Box>
            <Typography component="h1" sx={{ fontSize: { xs: fontSizes['3xl'], sm: fontSizes['5xl'] }, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.25, textWrap: 'pretty' }}>
              {title}
            </Typography>
            <Typography sx={{ mt: 0.75, fontSize: fontSizes.sm, color: 'text.secondary', lineHeight: 1.5 }}>{subtitle}</Typography>
          </Box>

          {current.kind === 'patient' && (
            <Box sx={optionGrid(220)}>
              <Field label="Nome da paciente">
                <TextInput value={patient.name} readOnly inputProps={{ 'aria-readonly': true }} sx={{ minHeight: 46, borderRadius: '12px', color: 'text.secondary' }} />
              </Field>
              <Field label="Data da consulta">
                <TextInput type="date" value={consultDate} onChange={(e) => setConsultDate(e.target.value)} sx={{ minHeight: 46, borderRadius: '12px' }} />
              </Field>
            </Box>
          )}

          {current.kind === 'core' && current.key === 'pele' && (
            <Box sx={optionGrid(210)}>
              {SKIN_TYPES.map(([k, label, desc]) => (
                <OptionCard key={k} selected={answers.pele === k} onClick={() => setAns('pele', k)} label={label} desc={desc} />
              ))}
            </Box>
          )}

          {current.kind === 'core' && current.key === 'afec' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              <Box sx={optionGrid(190)}>
                {SKIN_CONDITIONS.map(([k, label]) => (
                  <OptionCard key={k} kind="check" selected={answers.afec.includes(k)} onClick={() => setAns('afec', toggleCondition(answers.afec, k))} label={label} />
                ))}
              </Box>
              {answers.afec.includes('outra') && (
                <Field label="Qual afecção?">
                  <TextInput autoFocus value={answers.afecOutra} onChange={(e) => setAns('afecOutra', e.target.value)} placeholder="Ex.: dermatite seborreica" sx={{ minHeight: 46, borderRadius: '12px' }} />
                </Field>
              )}
            </Box>
          )}

          {current.kind === 'core' && current.key === 'olheira' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
              <Box sx={optionGrid(180)}>
                {(
                  [
                    ['sim', 'Sim'],
                    ['nao', 'Não'],
                  ] as const
                ).map(([k, label]) => (
                  <OptionCard
                    key={k}
                    size="lg"
                    selected={answers.olheira === k}
                    onClick={() => setAnswers((a) => ({ ...a, olheira: k, olheiraTipo: k === 'nao' ? '' : a.olheiraTipo }))}
                    label={label}
                  />
                ))}
              </Box>
              {answers.olheira === 'sim' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2.25, borderTop: `1px solid ${BORDER_SOFT}` }}>
                  <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800 }}>Qual o tipo de olheira?</Typography>
                  <Box sx={optionGrid(190)}>
                    {DARK_CIRCLE_TYPES.map(([k, label, desc]) => (
                      <OptionCard key={k} selected={answers.olheiraTipo === k} onClick={() => setAns('olheiraTipo', k)} label={label} desc={desc} />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {current.kind === 'core' && current.key === 'idade' && (
            <Box sx={optionGrid(160)}>
              {AGE_RANGES.map(([k, label]) => {
                const selected = answers.idade === k;
                return (
                  <Box
                    key={k}
                    role="radio"
                    aria-checked={selected}
                    tabIndex={0}
                    onClick={() => setAns('idade', k)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setAns('idade', k);
                      }
                    }}
                    sx={{
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      py: 2.75,
                      px: 2,
                      borderRadius: '14px',
                      border: '1.5px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected ? tint : 'background.paper',
                    }}
                  >
                    <Typography sx={{ fontSize: fontSizes['6xl'], fontWeight: 800, color: selected ? 'primary.main' : 'text.primary', lineHeight: 1.2 }}>
                      {label}
                    </Typography>
                    <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 600, color: 'text.secondary' }}>anos</Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          {current.kind === 'extra' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {current.questions.map((q) => (
                <QuestionField key={q.key} question={q} value={answers.extra?.[q.key]} onChange={(v) => setExtra(q.key, v)} />
              ))}
            </Box>
          )}

          {current.kind === 'review' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', border: 1, borderColor: 'divider', borderRadius: '14px', overflow: 'hidden' }}>
              {reviewRows.map((r) => (
                <Box
                  key={r.key}
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px 16px',
                    px: 2.25,
                    py: 1.9,
                    borderBottom: `1px solid ${BORDER_SOFT}`,
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  <Typography sx={{ flex: { xs: '1 0 100%', sm: '0 0 190px' }, fontSize: fontSizes.xs, fontWeight: 700, color: TEXT_SOFT, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {r.label}
                  </Typography>
                  <Typography sx={{ flex: '1 1 200px', minWidth: 0, fontSize: fontSizes.md, fontWeight: 700, textWrap: 'pretty' }}>{r.value}</Typography>
                  <Button onClick={() => goStep(r.step)} sx={{ ...BUTTON_SX, height: 32, px: 1.6, borderRadius: '9px', color: 'primary.main', fontSize: fontSizes.xs }}>
                    Editar
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          {(step > 0 || fromReview) && (
            <Button onClick={back} sx={{ ...BUTTON_SX, height: 46, px: 2.25, borderRadius: '12px', fontSize: fontSizes.md }}>
              <Svg d={ICON.back} size={16} stroke={2.2} />
              {fromReview ? 'Cancelar edição' : 'Voltar'}
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={next} disabled={!canNext} sx={{ ...PRIMARY_BUTTON_SX, height: 46, px: 2.75, borderRadius: '12px', fontSize: fontSizes.md }}>
            {nextLabel}
            <Svg d={ICON.next} size={16} stroke={2.2} />
          </Button>
        </Box>
      </Box>
    );
  }

  const profileChips = [
    { label: 'Tipo de pele', value: optionLabel(SKIN_TYPES, answers.pele) || '—' },
    { label: 'Afecções', value: conditionsText(answers) || '—' },
    { label: 'Olheiras', value: darkCirclesText(answers) || '—' },
    { label: 'Faixa etária', value: optionLabel(AGE_RANGES, answers.idade) || '—' },
  ];

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 2, sm: 2.5 }, pt: { xs: 2.5, sm: 3.5 }, pb: 7, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.75 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'primary.main' }}>
            Rotina de skincare personalizada
          </Typography>
          <Typography component="h1" sx={{ mt: 0.5, fontSize: { xs: fontSizes['4xl'], sm: fontSizes['6xl'] }, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.2 }}>
            {patient.name}
          </Typography>
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>Consulta de {formatDateBR(consultDate)}</Typography>
        </Box>
        <Box data-noprint="1" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={() => {
              setPhase('wizard');
              setStep(reviewStep);
              setFromReview(false);
            }}
            sx={{ ...BUTTON_SX, color: 'text.secondary' }}
          >
            Revisar respostas
          </Button>
          {editRoutine ? (
            <Button onClick={() => setEditRoutine(false)} sx={{ ...BUTTON_SX, border: '1.5px solid', borderColor: 'primary.main', bgcolor: tint, color: 'primary.dark', '&:hover': { bgcolor: tint } }}>
              <Svg d={ICON.check} stroke={2.4} />
              Concluir edição
            </Button>
          ) : (
            <Button onClick={() => setEditRoutine(true)} sx={BUTTON_SX}>
              <Svg d={ICON.edit} />
              Editar rotina
            </Button>
          )}
          <Button onClick={() => window.print()} sx={BUTTON_SX}>
            <Svg d={ICON.print}>
              <rect x="4" y="9" width="16" height="8" rx="2" />
            </Svg>
            Imprimir / PDF
          </Button>
          {canSave &&
            (dirty ? (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                sx={{ ...BUTTON_SX, border: '1.5px solid', borderColor: 'primary.main', color: 'primary.dark' }}
              >
                <Svg d={ICON.save} stroke={2} />
                {saveMutation.isPending ? 'Salvando…' : 'Salvar na ficha'}
              </Button>
            ) : (
              <Box component="span" sx={{ ...BUTTON_SX, border: 'none', bgcolor: tint, color: 'primary.dark', '&:hover': undefined }}>
                <Svg d={ICON.check} stroke={2.4} />
                Salvo na ficha
              </Box>
            ))}
          <Button onClick={() => setSendOpen(true)} sx={PRIMARY_BUTTON_SX}>
            <Svg d={ICON.send} stroke={2} />
            Enviar para paciente
          </Button>
        </Box>
      </Box>

      <Box
        data-print-flat="1"
        sx={{ ...PANEL_SX, px: 2.5, py: 2.25, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: '14px 20px' }}
      >
        {profileChips.map((c) => (
          <Box key={c.label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
            <Typography sx={EYEBROW_SX}>{c.label}</Typography>
            <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800, textWrap: 'pretty' }}>{c.value}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.25, alignItems: 'flex-start' }}>
        <Box sx={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {catalogLoading && editRoutine ? (
            <Skeleton variant="rounded" height={200} sx={{ borderRadius: '18px' }} />
          ) : (
            sections.map((sec) => (
              <Box key={sec.key} data-print-flat="1" sx={{ ...PANEL_SX, overflow: 'hidden', breakInside: 'avoid' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '11px', bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Svg d={MOMENT_ICON_PATHS[sec.key]} size={17} />
                  </Box>
                  <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 800 }}>{sec.label}</Typography>
                  <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 600, color: TEXT_SOFT }}>{sec.sub}</Typography>
                </Box>
                {sec.steps.map((st) => (
                  <Box key={st.key} sx={{ display: 'flex', gap: 1.75, px: 2.5, py: 2, borderBottom: `1px solid ${BORDER_SOFT}`, '&:last-of-type': { borderBottom: 0 } }}>
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        bgcolor: tint,
                        color: 'primary.main',
                        fontSize: fontSizes.xs,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {st.n}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                      <Typography sx={{ ...EYEBROW_SX, pt: '5px' }}>{st.label}</Typography>
                      {st.items.map((it) => (
                        <Box key={`${it.productId}-${it.name}`} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 8px' }}>
                              <Typography component="span" sx={{ fontSize: fontSizes.md, fontWeight: 800 }}>
                                {it.name}
                              </Typography>
                              {it.brand && (
                                <Typography component="span" sx={{ fontSize: fontSizes.xs, fontWeight: 600, color: 'text.secondary' }}>
                                  {it.brand}
                                </Typography>
                              )}
                            </Box>
                            {it.activeIngredient && (
                              <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 700, color: 'primary.dark', mt: 0.25 }}>{it.activeIngredient}</Typography>
                            )}
                            {it.howTo && <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', mt: 0.5, textWrap: 'pretty' }}>{it.howTo}</Typography>}
                            {it.note && (
                              <Box
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.75,
                                  mt: 0.9,
                                  px: 1.25,
                                  py: 0.6,
                                  borderRadius: '8px',
                                  bgcolor: '#FBF3E4',
                                  color: '#8A5A12',
                                  fontSize: fontSizes.xs,
                                  fontWeight: 700,
                                }}
                              >
                                <Svg d={ICON.info} size={13} stroke={2.2}>
                                  <circle cx="12" cy="12" r="9" />
                                </Svg>
                                {it.note}
                              </Box>
                            )}
                          </Box>
                          {editRoutine && (
                            <Box data-noprint="1">
                              <SmallIconButton title="Remover da rotina" danger icon={ICON.close} onClick={() => removeItem(it)} />
                            </Box>
                          )}
                        </Box>
                      ))}
                      {st.items.length === 0 && (
                        <Typography sx={{ fontSize: fontSizes.xs, color: TEXT_SOFT, fontWeight: 600 }}>Sem indicação pelas regras atuais.</Typography>
                      )}
                      {editRoutine && st.addOptions.length > 0 && (
                        <Select
                          data-noprint="1"
                          value=""
                          displayEmpty
                          onChange={(e) => addItem(sec.key, String(e.target.value))}
                          renderValue={() => '+ Adicionar produto a esta etapa'}
                          MenuProps={{ sx: { zIndex: (t) => t.zIndex.modal + 4 } }}
                          sx={{
                            height: 38,
                            maxWidth: 360,
                            borderRadius: '10px',
                            bgcolor: tint,
                            color: 'primary.dark',
                            fontSize: fontSizes.xs,
                            fontWeight: 700,
                            '& .MuiOutlinedInput-notchedOutline': { border: '1.5px dashed #9BCFC8' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                          }}
                        >
                          {st.addOptions.map((p) => (
                            <MenuItem key={p.id} value={p.id} sx={{ fontSize: fontSizes.sm }}>
                              {p.name}
                              {p.brand ? ` · ${p.brand}` : ''}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            ))
          )}
        </Box>

        <Box sx={{ flex: '1 1 280px', maxWidth: { md: 380 }, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {guidelines.length > 0 && (
            <Box data-print-flat="1" sx={{ ...PANEL_SX, px: 2.5, py: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800 }}>Orientações</Typography>
              {guidelines.map((g, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1.25, lineHeight: 1.45 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0, mt: '7px' }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 600, textWrap: 'pretty' }}>{g.text}</Typography>
                    <Typography sx={{ fontSize: fontSizes['2xs'], color: TEXT_SOFT, fontWeight: 600 }}>{g.source}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
          {avoided.length > 0 && (
            <Box data-print-flat="1" sx={{ ...PANEL_SX, px: 2.5, py: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800 }}>Evitados nesta rotina</Typography>
                <Box component="span" sx={{ fontSize: fontSizes['2xs'], fontWeight: 800, px: 1, py: 0.25, borderRadius: '7px', bgcolor: 'rgba(214,90,90,.12)', color: DANGER_TEXT }}>
                  {avoided.length}
                </Box>
              </Box>
              {avoided.map((av) => (
                <Box
                  key={`${av.productId}-${av.name}`}
                  sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, px: 1.5, py: 1.25, borderRadius: '11px', bgcolor: 'rgba(214,90,90,.06)', border: '1px solid rgba(214,90,90,.18)' }}
                >
                  <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800 }}>{av.name}</Typography>
                  <Typography sx={{ fontSize: fontSizes.xs, color: '#B04A45', fontWeight: 600, textWrap: 'pretty' }}>Evitado por {av.reason}</Typography>
                </Box>
              ))}
            </Box>
          )}
          <Box data-print-flat="1" sx={{ ...PANEL_SX, px: 2.5, py: 2.25, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800 }}>Observações da profissional</Typography>
            <TextInput
              multiline
              minRows={5}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              placeholder="Ex.: retorno em 30 dias para avaliar tolerância ao retinal."
              sx={{ borderRadius: '12px', fontSize: fontSizes.sm }}
            />
          </Box>
          <Button
            data-noprint="1"
            onClick={resetAll}
            sx={{ height: 42, borderRadius: '11px', border: 1, borderStyle: 'dashed', borderColor: 'divider', bgcolor: 'transparent', color: 'text.secondary', fontSize: fontSizes.sm, fontWeight: 700 }}
          >
            Iniciar nova anamnese
          </Button>
        </Box>
      </Box>

      <SendRoutineDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        patient={patient}
        consultDate={consultDate}
        items={items}
        guidelines={guidelines}
        notes={notes}
      />
    </Box>
  );
}
