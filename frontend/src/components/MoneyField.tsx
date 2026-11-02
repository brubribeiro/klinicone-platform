import { TextField, type TextFieldProps } from '@mui/material';
import { forwardRef } from 'react';
import { formatMoneyInput, parseMoneyInput } from '../utils/masks';
import { FieldAdornment } from './FieldAdornment';

type MoneyFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: number | string | null | undefined;
  onChange: (value: number | '') => void;
};

/** Campo em R$ com máscara "1.234,56": a digitação entra pelos centavos. */
export const MoneyField = forwardRef<HTMLDivElement, MoneyFieldProps>(function MoneyField(
  { value, onChange, InputProps, inputProps, ...rest },
  ref,
) {
  return (
    <TextField
      {...rest}
      ref={ref}
      value={formatMoneyInput(value)}
      onChange={(e) => onChange(parseMoneyInput(e.target.value))}
      placeholder={rest.placeholder ?? '0,00'}
      InputProps={{
        startAdornment: <FieldAdornment position="start">R$</FieldAdornment>,
        ...InputProps,
      }}
      inputProps={{ inputMode: 'numeric', autoComplete: 'off', ...inputProps }}
    />
  );
});
