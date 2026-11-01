import { MenuItem, TextField, type TextFieldProps } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import type { AdminPlanSummary } from '../../../../frontend/src/types';

type Props = Omit<TextFieldProps, 'select' | 'value' | 'onChange' | 'children'> & {
  /** '' = sem plano */
  value: string;
  onChange: (planId: string) => void;
  /** Plano atual da clínica: continua na lista mesmo se desativado. */
  currentPlan?: AdminPlanSummary | null;
};

/** Seletor de plano: só planos ativos (mais o atual da clínica, se já desativado). */
export function PlanSelect({ value, onChange, currentPlan, ...props }: Props) {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: adminApi.listPlans,
  });

  const options: AdminPlanSummary[] = plans.filter((p) => p.active);
  if (currentPlan && !options.some((p) => p.id === currentPlan.id)) options.push(currentPlan);
  // Evita aviso do MUI enquanto a lista carrega
  const safeValue = value && !options.some((p) => p.id === value) ? '' : value;

  return (
    <TextField
      {...props}
      select
      value={isLoading ? '' : safeValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={props.disabled || isLoading}
      SelectProps={{ displayEmpty: true, ...props.SelectProps }}
    >
      <MenuItem value="">
        <em>Sem plano</em>
      </MenuItem>
      {options.map((p) => (
        <MenuItem key={p.id} value={p.id}>
          {p.active ? p.name : `${p.name} (desativado)`}
        </MenuItem>
      ))}
    </TextField>
  );
}
