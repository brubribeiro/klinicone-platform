import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, useTheme } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { DOCUMENT_STATUSES, canOpenDocument } from './documentUtils';
import type { DocumentFile, DocumentStatus } from '../../types';

interface DocumentActionsMenuProps {
  anchor: HTMLElement | undefined;
  /** Documento do menu aberto; `undefined` fecha o menu. */
  doc: DocumentFile | undefined;
  onClose: () => void;
  canEdit: boolean;
  canDelete: boolean;
  attachPending: boolean;
  onOpenFile: (doc: DocumentFile) => void;
  onView: (doc: DocumentFile) => void;
  onAttach: (doc: DocumentFile) => void;
  onSend: (doc: DocumentFile) => void;
  onSetStatus: (doc: DocumentFile, status: DocumentStatus) => void;
  onEdit: (doc: DocumentFile) => void;
  onDelete: (doc: DocumentFile) => void;
}

/** Menu "..." da linha de documento: abrir, imprimir, enviar, anexar, status, editar e excluir. */
export function DocumentActionsMenu({
  anchor,
  doc,
  onClose,
  canEdit,
  canDelete,
  attachPending,
  onOpenFile,
  onView,
  onAttach,
  onSend,
  onSetStatus,
  onEdit,
  onDelete,
}: DocumentActionsMenuProps) {
  const theme = useTheme();
  // Fecha o menu antes de agir (a ação pode abrir um diálogo).
  const menuAction = (fn: (doc: DocumentFile) => void) => () => {
    onClose();
    if (doc) fn(doc);
  };

  return (
      <Menu
        anchorEl={anchor}
        open={!!doc}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 230, borderRadius: '12px' } } }}
        MenuListProps={{ dense: true }}
      >
        {doc && canOpenDocument(doc) && (
          <MenuItem onClick={menuAction(onOpenFile)}>
            <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Abrir arquivo</ListItemText>
          </MenuItem>
        )}
        {doc?.hasContent && (
          <MenuItem onClick={menuAction(onView)}>
            <ListItemIcon><PrintOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Visualizar e imprimir</ListItemText>
          </MenuItem>
        )}
        {doc?.patientId && canEdit && (
          <MenuItem onClick={menuAction(onSend)}>
            <ListItemIcon><SendOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Enviar ao paciente</ListItemText>
          </MenuItem>
        )}
        {doc && canEdit && (
          <MenuItem onClick={menuAction(onAttach)} disabled={attachPending}>
            <ListItemIcon><AttachFileIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{doc.storageKey ? 'Substituir arquivo' : 'Anexar versão assinada'}</ListItemText>
          </MenuItem>
        )}
        {doc && canEdit && <Divider />}
        {doc &&
          canEdit &&
          DOCUMENT_STATUSES.filter((s) => s.value !== doc.status).map((s) => (
            <MenuItem
              key={s.value}
              onClick={menuAction((d) => onSetStatus(d, s.value))}
            >
              <ListItemIcon>
                <FiberManualRecordIcon sx={{ fontSize: 12, color: theme.palette[s.tone].main }} />
              </ListItemIcon>
              <ListItemText>Marcar como {s.label.toLowerCase()}</ListItemText>
            </MenuItem>
          ))}
        {doc && canEdit && <Divider />}
        {doc && canEdit && (
          <MenuItem
            onClick={menuAction(onEdit)}
          >
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Editar</ListItemText>
          </MenuItem>
        )}
        {doc && canDelete && (
          <MenuItem onClick={menuAction(onDelete)} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Excluir</ListItemText>
          </MenuItem>
        )}
      </Menu>
  );
}
