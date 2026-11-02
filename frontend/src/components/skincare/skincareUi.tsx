import type { ReactNode } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  Dialog,
  InputBase,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
  type InputBaseProps,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';

import { fontSizes } from '../../theme/fontSizes';

/** Peças visuais da anamnese de pele (protótipo Aurora "Anamnese de Pele"). */

export const TEXT_SOFT = '#94A4A0';
export const BORDER_SOFT = '#EAF0EE';
export const DARK_BG = '#0E2926';
export const DANGER = '#D65A5A';
export const DANGER_TEXT = '#C4544F';
export const UNCHECKED_BORDER = '#C9D6D2';

export const tint = (t: Theme) => alpha(t.palette.primary.main, 0.09);

export const PANEL_SX = {
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: '18px',
  boxShadow: '0 1px 2px rgba(16,40,37,.04), 0 8px 24px -12px rgba(16,40,37,.10)',
} as const;

export const EYEBROW_SX = {
  fontSize: fontSizes['2xs'],
  fontWeight: 800,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: TEXT_SOFT,
} as const;

export const INPUT_SX = {
  minHeight: 44,
  width: '100%',
  borderRadius: '11px',
  border: 1,
  borderColor: 'divider',
  bgcolor: 'grey.50',
  px: 1.75,
  fontSize: fontSizes.md,
  color: 'text.primary',
  '&.Mui-focused': { borderColor: 'primary.main' },
  '& input::placeholder, & textarea::placeholder': { color: TEXT_SOFT, opacity: 1 },
  '&.MuiInputBase-multiline': { py: 1.4, alignItems: 'flex-start', lineHeight: 1.5 },
} as const;

export const BUTTON_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.9,
  height: 42,
  px: 1.9,
  borderRadius: '11px',
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.primary',
  fontSize: fontSizes.sm,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  minWidth: 0,
  '&:hover': { bgcolor: 'grey.50', borderColor: 'divider' },
} as const;

export const PRIMARY_BUTTON_SX = {
  ...BUTTON_SX,
  border: 'none',
  bgcolor: 'primary.main',
  color: '#fff',
  boxShadow: (t: Theme) => `0 6px 16px -6px ${t.palette.primary.main}`,
  '&:hover': { bgcolor: 'primary.dark' },
  '&.Mui-disabled': { bgcolor: '#D5E0DC', color: '#fff', boxShadow: 'none' },
} as const;

export function Svg({ d, size = 15, stroke = 1.9, children }: { d?: string; size?: number; stroke?: number; children?: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {d && <path d={d} />}
      {children}
    </svg>
  );
}

export const ICON = {
  check: 'M20 6L9 17l-5-5',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  plus: 'M12 5v14M5 12h14',
  close: 'M18 6L6 18M6 6l12 12',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  print: 'M6 9V3h12v6M7 14h10v7H7z',
  info: 'M12 8v.1M12 11v5',
  drop: 'M12 3.5c3 3.6 5.5 6.6 5.5 9.8a5.5 5.5 0 0 1-11 0c0-3.2 2.5-6.2 5.5-9.8z',
};

/** Rótulo + campo, como nos formulários do protótipo. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 0.9, minWidth: 0 }}>
      <Typography component="span" sx={{ fontSize: fontSizes.xs, fontWeight: 700 }}>
        {label}
        {hint && (
          <Box component="span" sx={{ fontWeight: 600, color: TEXT_SOFT }}>
            {' '}
            · {hint}
          </Box>
        )}
      </Typography>
      {children}
    </Box>
  );
}

export function TextInput(props: InputBaseProps) {
  return <InputBase {...props} sx={{ ...INPUT_SX, ...(props.sx as object) }} />;
}

export const SKIN_AUTOCOMPLETE_SX = {
  '& .MuiOutlinedInput-root': {
    minHeight: 44,
    borderRadius: '11px',
    bgcolor: 'grey.50',
    fontSize: fontSizes.sm,
    py: 0.35,
    '& fieldset': { borderColor: 'divider' },
    '&:hover fieldset': { borderColor: 'divider' },
    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
  },
} as const;

export type SkincareLabeledOption = { value: string; label: string; hint?: string };

/** Multi-select com busca e chips compactos (produtos / tags das regras). */
export function SkincareMultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: SkincareLabeledOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const selected = options.filter((o) => value.includes(o.value));
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      filterSelectedOptions
      options={options}
      value={selected}
      onChange={(_, opts) => onChange(opts.map((o) => o.value))}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      renderOption={(props, option) => (
        <li {...props} key={option.value}>
          <Box sx={{ py: 0.25 }}>
            <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700, lineHeight: 1.35 }}>{option.label}</Typography>
            {option.hint && (
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', lineHeight: 1.35 }}>{option.hint}</Typography>
            )}
          </Box>
        </li>
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            {...getTagProps({ index })}
            key={option.value}
            label={option.label}
            size="small"
            sx={{ height: 26, fontSize: fontSizes.xs, fontWeight: 600 }}
          />
        ))
      }
      renderInput={(params) => (
        <TextField {...params} placeholder={value.length === 0 ? placeholder : undefined} size="small" />
      )}
      slotProps={{ popper: { sx: { zIndex: (t: Theme) => t.zIndex.modal + 4 } } }}
      sx={SKIN_AUTOCOMPLETE_SX}
    />
  );
}

/** Cartão de opção (radio ou checkbox) das perguntas da anamnese. */
export function OptionCard({
  selected,
  onClick,
  label,
  desc,
  kind = 'radio',
  size = 'md',
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
  kind?: 'radio' | 'check';
  size?: 'md' | 'lg';
}) {
  return (
    <Box
      role={kind === 'radio' ? 'radio' : 'checkbox'}
      aria-checked={selected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: desc ? 'flex-start' : 'center',
        gap: 1.5,
        p: size === 'lg' ? 2.25 : desc ? 2 : '15px 16px',
        height: '100%',
        borderRadius: '14px',
        border: '1.5px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? tint : 'background.paper',
        outline: 'none',
        transition: 'border-color .12s, background-color .12s',
        '&:hover': { borderColor: selected ? 'primary.main' : UNCHECKED_BORDER },
        '&:focus-visible': { boxShadow: (t) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.25)}` },
      }}
    >
      {kind === 'radio' ? (
        <Box
          component="span"
          sx={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: selected ? '6px solid' : '2px solid',
            borderColor: selected ? 'primary.main' : UNCHECKED_BORDER,
            bgcolor: '#fff',
            flexShrink: 0,
            mt: desc ? '1px' : 0,
          }}
        />
      ) : (
        <Box
          component="span"
          sx={{
            width: 20,
            height: 20,
            borderRadius: '6px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            ...(selected ? { bgcolor: 'primary.main' } : { border: `2px solid ${UNCHECKED_BORDER}`, bgcolor: '#fff' }),
          }}
        >
          {selected && <Svg d={ICON.check} size={12} stroke={3.2} />}
        </Box>
      )}
      <Box sx={{ lineHeight: 1.35, minWidth: 0 }}>
        <Typography sx={{ fontSize: size === 'lg' ? fontSizes.lg : fontSizes.md, fontWeight: 800, lineHeight: 1.35 }}>{label}</Typography>
        {desc && (
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mt: 0.4, lineHeight: 1.35, textWrap: 'pretty' }}>
            {desc}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** Chip selecionável (momentos, características, produtos das regras). */
export function ToggleChip({
  selected,
  onClick,
  children,
  tone = 'primary',
  compact = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: 'primary' | 'danger';
  compact?: boolean;
}) {
  const danger = tone === 'danger';
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        fontFamily: 'inherit',
        fontSize: compact ? fontSizes.xs : fontSizes.sm,
        fontWeight: 700,
        px: compact ? 1.5 : 1.75,
        py: compact ? 0.875 : 1,
        borderRadius: compact ? '9px' : '10px',
        border: '1.5px solid',
        cursor: 'pointer',
        textAlign: 'left',
        ...(selected
          ? danger
            ? { borderColor: DANGER, bgcolor: 'rgba(214,90,90,.08)', color: DANGER_TEXT }
            : { borderColor: 'primary.main', bgcolor: tint, color: 'primary.dark' }
          : { borderColor: 'divider', bgcolor: 'background.paper', color: 'text.secondary' }),
      }}
    >
      {children}
    </Box>
  );
}

export function Pill({ children, tone = 'primary' }: { children: ReactNode; tone?: 'primary' | 'neutral' | 'danger' }) {
  return (
    <Box
      component="span"
      sx={{
        fontSize: fontSizes['2xs'],
        fontWeight: tone === 'primary' ? 800 : 700,
        px: 1.1,
        py: 0.5,
        borderRadius: '7px',
        whiteSpace: 'nowrap',
        ...(tone === 'primary'
          ? { bgcolor: tint, color: 'primary.dark' }
          : tone === 'danger'
            ? { bgcolor: 'rgba(214,90,90,.1)', color: DANGER_TEXT }
            : { bgcolor: 'grey.100', color: 'text.secondary' }),
      }}
    >
      {children}
    </Box>
  );
}

export function SmallIconButton({ title, onClick, danger, icon }: { title: string; onClick: () => void; danger?: boolean; icon: string }) {
  return (
    <Box
      component="button"
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      sx={{
        width: 30,
        height: 30,
        borderRadius: '9px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        p: 0,
        ...(danger
          ? { border: '1px solid rgba(214,90,90,.35)', bgcolor: 'rgba(214,90,90,.08)', color: DANGER }
          : { border: 1, borderColor: 'divider', bgcolor: 'background.paper', color: TEXT_SOFT, '&:hover': { color: 'primary.main', borderColor: 'primary.main' } }),
      }}
    >
      <Svg d={icon} size={13} stroke={danger && icon === ICON.close ? 2.2 : 1.9} />
    </Box>
  );
}

/** Modal no estilo do protótipo: título + subtítulo, corpo rolável e rodapé com ações. */
export function SkinModal({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 640,
  actions,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: number;
  actions: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      sx={{ zIndex: (t) => t.zIndex.modal + 3 }}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth,
          m: isMobile ? 1.5 : 2.5,
          ...(isMobile
            ? { height: 'calc(100dvh - 24px)', maxHeight: 'calc(100dvh - 24px)' }
            : { height: 'min(86dvh, 720px)', maxHeight: 'min(86dvh, 720px)' }),
          borderRadius: '18px',
          boxShadow: '0 8px 40px -16px rgba(16,40,37,.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
      slotProps={{ backdrop: { sx: { bgcolor: 'rgba(7,18,17,.5)' } } }}
    >
      <Box sx={{ px: 2.75, py: 2.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Typography component="h2" sx={{ fontSize: fontSizes.xl, fontWeight: 800, textWrap: 'pretty' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mt: 0.4, lineHeight: 1.5 }}>{subtitle}</Typography>
        )}
      </Box>
      <Box sx={{ px: 2.75, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {children}
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1.25,
          px: 2.75,
          py: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'grey.50',
          flexShrink: 0,
        }}
      >
        {actions}
      </Box>
    </Dialog>
  );
}
