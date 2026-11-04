import { alpha, Box } from '@mui/material';
import { fontSizes } from '../../theme/fontSizes';

/** Pílula monoespaçada de variável do modelo ({nome}, {data}...). */
export function VariableChip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Box
      component={onClick ? 'button' : 'span'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      sx={{
        fontSize: fontSizes.xs,
        fontWeight: 600,
        color: 'primary.main',
        bgcolor: (t) => alpha(t.palette.primary.main, 0.09),
        px: 1,
        py: 0.375,
        border: 'none',
        borderRadius: '8px',
        fontFamily: 'ui-monospace, monospace',
        lineHeight: 1.4,
        cursor: onClick ? 'pointer' : 'default',
        ...(onClick && { '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.16) } }),
      }}
    >
      {label}
    </Box>
  );
}
