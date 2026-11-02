import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  alpha,
  type IconButtonProps,
  type SxProps,
  type Theme,
} from '@mui/material';
import type { ReactNode } from 'react';
import { fontSizes } from '../theme/fontSizes';

type DialogCloseButtonProps = {
  onClose: () => void;
  'aria-label'?: string;
} & Omit<IconButtonProps, 'onClick' | 'children'>;

/** @deprecated Prefer DialogHeader */
export const dialogTitleCloseSx: SxProps<Theme> = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 1,
  pr: 1.5,
};

export const dialogHeaderTitleSx: SxProps<Theme> = {
  px: { xs: 2, sm: 3 },
  pt: { xs: 2, sm: 2.5 },
  pb: { xs: 1.75, sm: 2 },
  borderBottom: 1,
  borderColor: 'divider',
  flexShrink: 0,
};

export const dialogSimpleContentSx: SxProps<Theme> = {
  px: { xs: 2, sm: 3 },
  pb: { xs: 2.5, sm: 3 },
  '&.MuiDialogContent-root': {
    paddingTop: { xs: 2.5, sm: 3 },
  },
};

export const dialogPaperSx = (isMobile: boolean): SxProps<Theme> => ({
  borderRadius: isMobile ? 0 : '20px',
  overflow: 'hidden',
});

/** Scrollable body for flex-column dialogs on short viewports. */
export const dialogContentScrollSx: SxProps<Theme> = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

/** Switch + rótulo alinhados ao centro (modais de formulário). */
export const formSwitchLabelSx: SxProps<Theme> = {
  mx: 0,
  gap: 1,
  alignItems: 'center',
  '& .MuiFormControlLabel-label': {
    fontSize: fontSizes.sm,
    fontWeight: 600,
    lineHeight: 1.35,
  },
};

export const formSwitchRowSx: SxProps<Theme> = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 3,
  rowGap: 1,
};

export const dialogFormLayoutSx = (isMobile: boolean): SxProps<Theme> => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  ...(isMobile ? { height: '100%' } : {}),
});

export type FormDialogPaperOptions = {
  maxWidth: number;
  /** Altura fixa no desktop (miolo faz scroll). Padrão: min(86dvh, 720px). */
  height?: number | string;
  /** Teto da altura no desktop. Padrão: 94dvh. Com `height: 'auto'` o paper cresce até esse teto. */
  maxHeight?: number | string;
};

/** Paper de modal de formulário: altura estável ao abrir, header/footer fixos, conteúdo scrollável. */
export function formDialogPaperSx(
  isMobile: boolean,
  { maxWidth, height = 'min(86dvh, 720px)', maxHeight = '94dvh' }: FormDialogPaperOptions,
): SxProps<Theme> {
  return {
    ...dialogPaperSx(isMobile),
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    ...(isMobile
      ? { height: '100%', maxHeight: '100dvh' }
      : {
          maxWidth,
          width: maxWidth,
          height,
          maxHeight,
          overflow: 'hidden',
        }),
  };
}

export const dialogActionsBorderSx: SxProps<Theme> = {
  px: { xs: 2, sm: 3 },
  py: { xs: 1.5, sm: 2 },
  borderTop: 1,
  borderColor: 'divider',
  bgcolor: 'grey.50',
};

export function DialogCloseButton({
  onClose,
  'aria-label': ariaLabel = 'Fechar',
  size = 'small',
  sx,
  ...props
}: DialogCloseButtonProps) {
  return (
    <IconButton
      onClick={onClose}
      aria-label={ariaLabel}
      size={size}
      sx={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: '10px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'grey.50',
        color: 'text.secondary',
        '&:hover': { color: 'text.primary', bgcolor: 'grey.100' },
        ...sx,
      }}
      {...props}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  );
}

export function DialogHeaderIcon({
  children,
  tone = 'primary',
}: {
  children: ReactNode;
  tone?: 'primary' | 'error' | 'warning';
}) {
  const paletteKey = tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : 'primary';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: '11px',
        bgcolor: (theme) => alpha(theme.palette[paletteKey].main, 0.12),
        color: `${paletteKey}.main`,
        flexShrink: 0,
      }}
    >
      {children}
    </Box>
  );
}

export type DialogHeaderProps = {
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  bottom?: ReactNode;
  isMobile?: boolean;
  subtitleTitle?: string;
  subtitleWrap?: boolean;
  sx?: SxProps<Theme>;
};

export function DialogHeader({
  onClose,
  title,
  subtitle,
  icon,
  trailing,
  bottom,
  isMobile = false,
  subtitleTitle,
  subtitleWrap = false,
  sx,
}: DialogHeaderProps) {
  const titleSx = (
    subtitleWrap
      ? [dialogHeaderTitleSx, { overflow: 'visible' }, ...(sx ? [sx] : [])]
      : sx
        ? [dialogHeaderTitleSx, sx]
        : dialogHeaderTitleSx
  ) as SxProps<Theme>;

  return (
    <DialogTitle sx={titleSx}>
      <Stack spacing={bottom ? (isMobile ? 1.5 : 0) : 0}>
        <Stack
          direction="row"
          alignItems={subtitleWrap ? 'flex-start' : 'center'}
          spacing={1.5}
          sx={{ minWidth: 0 }}
        >
          {icon && !isMobile && (
            <Box sx={subtitleWrap ? { mt: 0.15, flexShrink: 0 } : undefined}>
              <DialogHeaderIcon>{icon}</DialogHeaderIcon>
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              component="h2"
              fontWeight={800}
              noWrap
              sx={{
                fontSize: { xs: '0.9375rem', sm: '1.0625rem' },
                letterSpacing: '-0.3px',
                lineHeight: 1.2,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap={!subtitleWrap}
                title={subtitleTitle ?? subtitle}
                sx={{
                  mt: 0.35,
                  ...(subtitleWrap
                    ? {
                        whiteSpace: 'normal',
                        overflow: 'visible',
                        textOverflow: 'unset',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                        pr: 0.5,
                      }
                    : {}),
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {trailing}
          <Box sx={subtitleWrap ? { flexShrink: 0, alignSelf: 'flex-start', mt: 0.15 } : undefined}>
            <DialogCloseButton onClose={onClose} />
          </Box>
        </Stack>
        {bottom}
      </Stack>
    </DialogTitle>
  );
}
