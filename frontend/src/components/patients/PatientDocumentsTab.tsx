import { useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { documentsApi } from '../../api/documents';
import { useAppToast } from '../../contexts/AppToastContext';
import { usePermissions } from '../../contexts/usePermissions';
import type { DocumentFile, DocumentStatus } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { clickableProps } from '../../utils/a11y';
import { StatusPill } from '../documents/DocumentListRow';
import { DocumentViewerDialog } from '../documents/DocumentViewerDialog';
import { SendDocumentDialog } from '../documents/SendDocumentDialog';
import { DOCUMENT_STATUSES, canOpenDocument, categoryMeta, documentFileIcon } from '../documents/documentUtils';
import { EmptyBlock } from './EmptyBlock';

interface PatientDocumentsTabProps {
  patientId: string;
  patientName: string;
  /** Chamado antes de sair para a lista de Documentos (ex.: fechar a gaveta). */
  onLeave?: () => void;
  /** z-index do visualizador quando a aba está dentro da gaveta */
  viewerZIndex?: number;
}

export function PatientDocumentsTab({ patientId, patientName, onLeave, viewerZIndex }: PatientDocumentsTabProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canEdit = has('documents:edit');
  const [viewing, setViewing] = useState<DocumentFile | null>(null);
  const [sending, setSending] = useState<DocumentFile | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', 'patient', patientId],
    queryFn: () => documentsApi.list({ patientId }),
    placeholderData: keepPreviousData,
  });

  const byStatus = useMemo(() => {
    const counts: Record<DocumentStatus, number> = { PENDING: 0, SENT: 0, SIGNED: 0 };
    for (const d of docs) counts[d.status] += 1;
    return counts;
  }, [docs]);

  const handleOpen = async (doc: DocumentFile) => {
    if (canOpenDocument(doc)) {
      try {
        const url = await documentsApi.getAccessUrl(doc.id);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        toast.error('Não foi possível gerar o link de acesso ao documento. Tente novamente.');
      }
    } else if (doc.hasContent) {
      setViewing(doc);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
        {DOCUMENT_STATUSES.map((s) => (
          <Box
            key={s.value}
            sx={{ textAlign: 'center', p: 1.5, borderRadius: '14px', border: 1, borderColor: 'divider', bgcolor: 'grey.50' }}
          >
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: byStatus[s.value] ? theme.palette[s.tone].dark : 'text.primary' }}>
              {byStatus[s.value]}
            </Typography>
            <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', fontWeight: 600, mt: 0.25 }}>
              {s.label.toLowerCase()}
              {byStatus[s.value] === 1 ? '' : 's'}
            </Typography>
          </Box>
        ))}
      </Box>

      {docs.length === 0 ? (
        <EmptyBlock message="Nenhum documento vinculado." />
      ) : (
        docs.map((doc) => {
          const { Icon, color } = documentFileIcon(doc.mimeType);
          const openable = canOpenDocument(doc) || !!doc.hasContent;
          return (
            <Paper
              key={doc.id}
              variant="outlined"
              {...(openable ? clickableProps(() => void handleOpen(doc), `Abrir ${doc.name}`) : {})}
              sx={{
                p: '12px 16px',
                borderRadius: '14px',
                bgcolor: 'grey.50',
                borderColor: 'divider',
                cursor: openable ? 'pointer' : 'default',
                '&:hover': openable ? { borderColor: 'primary.main' } : undefined,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Icon sx={{ fontSize: 22, color, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap title={doc.name} sx={{ fontSize: fontSizes.md, fontWeight: 700 }}>
                    {doc.name}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
                    {[categoryMeta(doc.category).label, dayjs(doc.createdAt).format('DD/MM/YYYY'), doc.template?.name]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
                <StatusPill status={doc.status} />
              </Stack>
            </Paper>
          );
        })
      )}

      <Box>
        <Button
          size="small"
          variant="text"
          endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />}
          onClick={() => {
            onLeave?.();
            navigate(`/documentos?busca=${encodeURIComponent(patientName)}`);
          }}
          sx={{ fontWeight: 700, fontSize: fontSizes.xs }}
        >
          Ver em Documentos
        </Button>
      </Box>

      <DocumentViewerDialog
        doc={viewing}
        onClose={() => setViewing(null)}
        onSend={canEdit ? setSending : undefined}
        sx={viewerZIndex ? { zIndex: viewerZIndex } : undefined}
      />
      <SendDocumentDialog
        doc={sending}
        onClose={() => setSending(null)}
        onSent={(saved) => setViewing((v) => (v?.id === saved.id ? saved : v))}
        sx={viewerZIndex ? { zIndex: viewerZIndex } : undefined}
      />
    </Stack>
  );
}
