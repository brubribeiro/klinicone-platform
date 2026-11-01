import {
  Box,
  Button,
  Dialog,
  DialogActions,
  type DialogProps,
  DialogContent,
  Skeleton,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { useQuery } from '@tanstack/react-query';

import { documentsApi } from '../../api/documents';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../DialogCloseButton';
import { categoryMeta, statusMeta } from './documentUtils';
import type { DocumentFile } from '../../types';
import { fontSizes } from '../../theme/fontSizes';

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Abre uma janela só com o texto do documento e chama a impressão do navegador. */
function printDocument(title: string, content: string) {
  const win = window.open('', '_blank', 'width=820,height=900');
  if (!win) return;
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Georgia,'Times New Roman',serif;font-size:13pt;line-height:1.6;margin:2.5cm;color:#111;white-space:pre-wrap;}</style>
</head><body>${escapeHtml(content)}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

interface Props {
  doc: DocumentFile | null;
  onClose: () => void;
  /** Exibe "Anexar versão assinada" quando informado */
  onAttach?: (doc: DocumentFile) => void;
  /** Exibe "Enviar ao paciente" quando informado e o documento tem paciente */
  onSend?: (doc: DocumentFile) => void;
  /** Ex.: z-index acima da gaveta do paciente */
  sx?: DialogProps['sx'];
}

export function DocumentViewerDialog({ doc, onClose, onAttach, onSend, sx }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { data, isLoading } = useQuery({
    queryKey: ['documents', doc?.id],
    queryFn: () => documentsApi.get(doc!.id),
    enabled: !!doc,
  });
  const content = data?.content ?? '';

  return (
    <Dialog
      open={!!doc}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      sx={sx}
      PaperProps={{ sx: { ...dialogPaperSx(isMobile), display: 'flex', flexDirection: 'column', maxHeight: '94dvh' } }}
    >
      <DialogHeader
        onClose={onClose}
        isMobile={isMobile}
        title={doc?.name ?? ''}
        subtitle={
          doc
            ? [categoryMeta(doc.category).label, statusMeta(doc.status).label, doc.template?.name]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        icon={<ArticleOutlinedIcon fontSize="small" />}
      />
      <DialogContent sx={{ bgcolor: 'grey.50', '&.MuiDialogContent-root': { pt: 3 } }}>
        <Box
          sx={{
            mx: 'auto',
            maxWidth: 680,
            p: { xs: 2.5, sm: 4 },
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: '12px',
            whiteSpace: 'pre-wrap',
            fontSize: fontSizes.md,
            lineHeight: 1.7,
          }}
        >
          {isLoading ? (
            <Stack spacing={1}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="text" />
              ))}
            </Stack>
          ) : (
            content || 'Este documento não tem texto gerado.'
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ ...dialogActionsBorderSx, gap: 1 }}>
        {!isMobile && <Button onClick={onClose}>Fechar</Button>}
        {doc && onAttach && (
          <Button variant="outlined" startIcon={<AttachFileIcon />} onClick={() => onAttach(doc)}>
            {doc.storageKey ? 'Substituir versão assinada' : 'Anexar versão assinada'}
          </Button>
        )}
        {doc?.patientId && onSend && (
          <Button variant="outlined" startIcon={<SendOutlinedIcon />} onClick={() => onSend(doc)}>
            Enviar ao paciente
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={<PrintOutlinedIcon />}
          disabled={!content}
          onClick={() => doc && printDocument(doc.name, content)}
        >
          Imprimir
        </Button>
      </DialogActions>
    </Dialog>
  );
}
