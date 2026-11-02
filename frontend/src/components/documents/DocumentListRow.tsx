import type { MouseEvent } from 'react';
import { Box, IconButton, Stack, Typography, alpha, useTheme } from '@mui/material';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { canOpenDocument, categoryMeta, documentFileIcon, fmtFileSize, statusMeta } from './documentUtils';
import type { DocumentFile, DocumentStatus } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { clickableProps } from '../../utils/a11y';

export const DOCUMENT_GRID_COLS =
  'minmax(0, 2.6fr) minmax(0, 1.3fr) minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 0.9fr) 44px';
export const DOCUMENT_GRID_MIN_WIDTH = 860;

export function StatusPill({ status }: { status: DocumentStatus }) {
  const theme = useTheme();
  const meta = statusMeta(status);
  const color = theme.palette[meta.tone].main;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        fontSize: fontSizes.xs,
        fontWeight: 700,
        px: 1,
        py: 0.4,
        borderRadius: '8px',
        color: theme.palette[meta.tone].dark,
        bgcolor: alpha(color, 0.13),
        whiteSpace: 'nowrap',
      }}
    >
      <FiberManualRecordIcon sx={{ fontSize: 8, color }} />
      {meta.label}
    </Box>
  );
}

function LinkCell({ doc }: { doc: DocumentFile }) {
  const label = doc.patient?.name ?? doc.equipment?.name;
  if (!label) {
    return <Typography sx={{ fontSize: fontSizes.sm, color: 'text.disabled', fontWeight: 600 }}>Sem vínculo</Typography>;
  }
  const LinkIcon = doc.patient ? PersonOutlineIcon : BuildOutlinedIcon;
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <LinkIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
      <Typography noWrap title={label} sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>
        {label}
      </Typography>
    </Stack>
  );
}

interface DocumentListRowProps {
  doc: DocumentFile;
  canEdit: boolean;
  onClick: () => void;
  onOpenMenu: (anchor: HTMLElement) => void;
}

/** Linha da tabela de documentos (no celular vira título + resumo). */
export function DocumentListRow({ doc, canEdit, onClick, onOpenMenu }: DocumentListRowProps) {
  const theme = useTheme();
  const hasFile = canOpenDocument(doc);
  const { Icon, color } = hasFile
    ? documentFileIcon(doc.mimeType)
    : { Icon: ArticleOutlinedIcon, color: theme.palette.primary.main };
  const clickable = hasFile || !!doc.hasContent || canEdit;
  const subtitle = [
    hasFile ? fmtFileSize(doc.size) : 'Texto gerado de modelo',
    doc.notes,
  ].filter(Boolean);
  return (
    <Box
      {...(clickable && clickableProps(onClick))}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: DOCUMENT_GRID_COLS },
        minWidth: { md: DOCUMENT_GRID_MIN_WIDTH },
        gap: 1.5,
        px: { xs: 2, md: 2.75 },
        py: 1.75,
        borderBottom: 1,
        borderColor: 'grey.100',
        alignItems: 'center',
        cursor: clickable ? 'pointer' : 'default',
        '&:hover': { bgcolor: 'grey.50' },
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      {/* Documento */}
      <Stack direction="row" alignItems="center" spacing={1.6} sx={{ minWidth: 0 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            bgcolor: alpha(color, 0.1),
          }}
        >
          <Icon sx={{ fontSize: 19 }} />
        </Box>
        <Box sx={{ minWidth: 0, lineHeight: 1.3 }}>
          <Typography noWrap title={doc.name} sx={{ fontSize: fontSizes.md, fontWeight: 700 }}>
            {doc.name}
          </Typography>
          <Typography
            noWrap
            title={doc.notes || undefined}
            sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}
          >
            <Box component="span" sx={{ display: { md: 'none' } }}>
              {`${statusMeta(doc.status).label} · ${categoryMeta(doc.category).label} · ${dayjs(doc.createdAt).format('DD/MM/YY')}`}
              {(doc.patient?.name ?? doc.equipment?.name) && ` · ${doc.patient?.name ?? doc.equipment?.name}`}
              {' · '}
            </Box>
            {subtitle.join(' · ')}
          </Typography>
        </Box>
      </Stack>

      {/* Paciente / vínculo */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
        <LinkCell doc={doc} />
      </Box>

      {/* Tipo */}
      <Typography
        noWrap
        title={categoryMeta(doc.category).label}
        sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}
      >
        {categoryMeta(doc.category).label}
      </Typography>

      {/* Data */}
      <Typography
        sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}
        noWrap
      >
        {dayjs(doc.createdAt).locale('pt-br').format('DD MMM YYYY')}
      </Typography>

      {/* Status */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <StatusPill status={doc.status} />
      </Box>

      {/* Ações */}
      <IconButton
        aria-label="Ações"
        onClick={(ev: MouseEvent<HTMLElement>) => {
          ev.stopPropagation();
          onOpenMenu(ev.currentTarget);
        }}
        sx={{ width: 32, height: 32, borderRadius: '9px', color: 'text.disabled', justifySelf: 'end' }}
      >
        <MoreHorizIcon sx={{ fontSize: 19 }} />
      </IconButton>
    </Box>
  );
}
