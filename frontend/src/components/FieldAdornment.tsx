import { InputAdornment, Typography, type InputAdornmentProps } from '@mui/material';
import type { ReactNode } from 'react';
import { fontSizes } from '../theme/fontSizes';

/** Tipografia dos sufixos/prefixos de campo (min, dias, R$, %). */
export const fieldAdornmentTypographySx = {
  fontSize: fontSizes.xs,
  fontWeight: 600,
  color: 'text.secondary',
  lineHeight: 1.2,
} as const;

type FieldAdornmentProps = {
  children: ReactNode;
  position?: InputAdornmentProps['position'];
};

/** Sufixo ou prefixo discreto alinhado aos inputs compactos Aurora. */
export function FieldAdornment({ children, position = 'end' }: FieldAdornmentProps) {
  return (
    <InputAdornment position={position}>
      <Typography component="span" sx={fieldAdornmentTypographySx}>
        {children}
      </Typography>
    </InputAdornment>
  );
}
