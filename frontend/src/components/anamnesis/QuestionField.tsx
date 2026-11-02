import { Box, Typography } from '@mui/material';

import { fontSizes } from '../../theme/fontSizes';
import type { AnamnesisAnswerValue, AnamnesisQuestion } from '../../types';
import { OptionCard, TextInput } from '../skincare/skincareUi';

export type QuestionLike = Pick<AnamnesisQuestion, 'key' | 'label' | 'type' | 'options' | 'placeholder' | 'required'>;

const optionGrid = (min: number) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
  gap: 1.25,
});

/** Resposta em branco? (sim/não respondido como "Não" conta como resposta) */
export function isBlankAnswer(value: AnamnesisAnswerValue | undefined | null): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return !value.trim();
  return false;
}

export function missingRequired(questions: QuestionLike[], answers: Record<string, AnamnesisAnswerValue | undefined>) {
  return questions.filter((q) => q.required && isBlankAnswer(answers[q.key]));
}

/** Texto de uma resposta para revisão. */
export function answerText(value: AnamnesisAnswerValue | undefined | null): string {
  if (isBlankAnswer(value)) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/**
 * Uma pergunta cadastrada no visual Aurora (cartões de opção do assistente de pele).
 * Usada no assistente de pele e na página pública da paciente.
 */
export function QuestionField({
  question,
  value,
  onChange,
  error,
}: {
  question: QuestionLike;
  value: AnamnesisAnswerValue | undefined;
  onChange: (value: AnamnesisAnswerValue) => void;
  error?: boolean;
}) {
  const labelId = `q-${question.key}`;
  const inputSx = { minHeight: 46, borderRadius: '12px', ...(error ? { borderColor: 'error.main' } : {}) };

  let input;
  if (question.type === 'BOOLEAN') {
    input = (
      <Box sx={optionGrid(120)} role="radiogroup" aria-labelledby={labelId}>
        {([
          [true, 'Sim'],
          [false, 'Não'],
        ] as const).map(([v, label]) => (
          <OptionCard key={label} selected={value === v} onClick={() => onChange(v)} label={label} />
        ))}
      </Box>
    );
  } else if (question.type === 'SINGLE_CHOICE') {
    input = (
      <Box sx={optionGrid(160)} role="radiogroup" aria-labelledby={labelId}>
        {question.options.map((opt) => (
          <OptionCard key={opt} selected={value === opt} onClick={() => onChange(value === opt ? '' : opt)} label={opt} />
        ))}
      </Box>
    );
  } else if (question.type === 'MULTIPLE_CHOICE') {
    const list = Array.isArray(value) ? value : [];
    input = (
      <Box sx={optionGrid(160)} role="group" aria-labelledby={labelId}>
        {question.options.map((opt) => (
          <OptionCard
            key={opt}
            kind="check"
            selected={list.includes(opt)}
            onClick={() => onChange(list.includes(opt) ? list.filter((o) => o !== opt) : [...list, opt])}
            label={opt}
          />
        ))}
      </Box>
    );
  } else if (question.type === 'NUMBER') {
    input = (
      <TextInput
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        placeholder={question.placeholder ?? ''}
        inputProps={{ inputMode: 'decimal', 'aria-labelledby': labelId }}
        sx={inputSx}
      />
    );
  } else {
    input = (
      <TextInput
        multiline
        minRows={2}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder ?? ''}
        inputProps={{ maxLength: 2000, 'aria-labelledby': labelId }}
        sx={{ ...inputSx, alignItems: 'flex-start', py: 1.25 }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography id={labelId} sx={{ fontSize: fontSizes.sm, fontWeight: 800, lineHeight: 1.4 }}>
        {question.label}
        {question.required && (
          <Box component="span" sx={{ color: 'error.main' }}>
            {' *'}
          </Box>
        )}
      </Typography>
      {input}
      {error && <Typography sx={{ fontSize: fontSizes.xs, color: 'error.main', fontWeight: 600 }}>Resposta obrigatória</Typography>}
    </Box>
  );
}
