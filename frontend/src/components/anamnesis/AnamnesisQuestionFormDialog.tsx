import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { anamnesisApi, type AnamnesisQuestionPayload } from '../../api/anamnesis';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import type { AnamnesisKind, AnamnesisQuestion, AnamnesisQuestionType } from '../../types';
import { DialogHeader, dialogActionsBorderSx } from '../DialogCloseButton';
import { LabeledField } from '../LabeledField';

export const QUESTION_TYPE_LABELS: Record<AnamnesisQuestionType, string> = {
  TEXT: 'Texto',
  BOOLEAN: 'Sim / não',
  SINGLE_CHOICE: 'Escolha única',
  MULTIPLE_CHOICE: 'Múltipla escolha',
  NUMBER: 'Número',
};

const isChoice = (type: AnamnesisQuestionType) => type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';

interface Props {
  open: boolean;
  onClose: () => void;
  kind: AnamnesisKind;
  question: AnamnesisQuestion | null;
  sections: string[];
}

export function AnamnesisQuestionFormDialog({ open, onClose, kind, question, sections }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const toast = useAppToast();
  const queryClient = useQueryClient();

  const [label, setLabel] = useState('');
  const [type, setType] = useState<AnamnesisQuestionType>('TEXT');
  const [options, setOptions] = useState<string[]>([]);
  const [optionDraft, setOptionDraft] = useState('');
  const [section, setSection] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [required, setRequired] = useState(false);
  const [active, setActive] = useState(true);

  const locked = !!question?.system;

  useEffect(() => {
    if (!open) return;
    setLabel(question?.label ?? '');
    setType(question?.type ?? 'TEXT');
    setOptions(question?.options ?? []);
    setOptionDraft('');
    setSection(question?.section ?? '');
    setPlaceholder(question?.placeholder ?? '');
    setRequired(question?.required ?? false);
    setActive(question?.active ?? true);
  }, [open, question]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Omit<AnamnesisQuestionPayload, 'kind'>> = locked
        ? { label: label.trim(), section: section.trim() || null, placeholder: placeholder.trim() || null }
        : {
            label: label.trim(),
            type,
            options: isChoice(type) ? options : [],
            section: section.trim() || null,
            placeholder: placeholder.trim() || null,
            required,
            active,
          };
      return question ? anamnesisApi.updateQuestion(question.id, payload) : anamnesisApi.createQuestion({ kind, ...payload } as AnamnesisQuestionPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anamnesis-questions', kind] });
      toast.success(question ? 'Pergunta atualizada.' : 'Pergunta criada.');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar a pergunta.')),
  });

  const addOption = () => {
    const value = optionDraft.trim();
    if (value && !options.includes(value)) setOptions([...options, value]);
    setOptionDraft('');
  };

  const valid = label.trim().length > 0 && (!isChoice(type) || locked || options.length >= 2);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogHeader
        onClose={onClose}
        isMobile={isMobile}
        title={question ? 'Editar pergunta' : 'Nova pergunta'}
        subtitle={kind === 'SKIN' ? 'Anamnese de pele' : 'Anamnese geral'}
        icon={<QuizOutlinedIcon fontSize="small" />}
      />
      <DialogContent sx={{ pt: 2.5 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {locked && (
            <Alert severity="info" variant="outlined">
              {kind === 'SKIN'
                ? 'Esta pergunta gera a rotina de skincare: só o texto pode mudar. As opções seguem as regras da rotina.'
                : 'Peso e altura alimentam o histórico de medidas: só o texto e a seção podem mudar.'}
            </Alert>
          )}
          <LabeledField label="Pergunta">
            <TextField size="small" fullWidth autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Usa lentes de contato?" />
          </LabeledField>
          <LabeledField label="Tipo de resposta">
            <TextField select size="small" fullWidth value={type} disabled={locked} onChange={(e) => setType(e.target.value as AnamnesisQuestionType)}>
              {(Object.keys(QUESTION_TYPE_LABELS) as AnamnesisQuestionType[]).map((t) => (
                <MenuItem key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </MenuItem>
              ))}
            </TextField>
          </LabeledField>
          {isChoice(type) && !locked && (
            <LabeledField label="Opções">
              <Stack spacing={1}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    fullWidth
                    value={optionDraft}
                    onChange={(e) => setOptionDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                    placeholder="Digite uma opção e tecle Enter"
                  />
                  <Button variant="outlined" onClick={addOption} disabled={!optionDraft.trim()}>
                    Adicionar
                  </Button>
                </Stack>
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {options.map((opt) => (
                    <Chip key={opt} label={opt} size="small" onDelete={() => setOptions(options.filter((o) => o !== opt))} />
                  ))}
                </Stack>
              </Stack>
            </LabeledField>
          )}
          {kind === 'GENERAL' && (
            <LabeledField label="Seção">
              <TextField
                select
                size="small"
                fullWidth
                value={section}
                onChange={(e) => setSection(e.target.value)}
                SelectProps={{ displayEmpty: true }}
              >
                <MenuItem value="">
                  <em>Outras perguntas</em>
                </MenuItem>
                {sections.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
            </LabeledField>
          )}
          {(type === 'TEXT' || type === 'NUMBER') && (
            <LabeledField label="Dica no campo (opcional)">
              <TextField size="small" fullWidth value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} placeholder="Ex.: Quais e com que frequência?" />
            </LabeledField>
          )}
          {!locked && (
            <Stack direction="row" spacing={3}>
              <FormControlLabel control={<Switch checked={required} onChange={(e) => setRequired(e.target.checked)} />} label="Obrigatória" />
              <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="Ativa" />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={dialogActionsBorderSx}>
        <Button onClick={onClose} variant="outlined" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => mutation.mutate()} variant="contained" disabled={!valid || mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
