import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx, dialogSimpleContentSx } from '../components/DialogCloseButton';

const DIALOG_TRANSITION_MS = 180;

export type ConfirmOptions = {
  title?: string;
  message: string;
  subtitle?: string;
  detailsTitle?: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'inherit';
  disableConfirm?: boolean;
  /** Texto do aviso quando `disableConfirm` (padrão: "Remova os vínculos antes de excluir."). */
  blockedMessage?: string;
  /** Conteúdo extra abaixo da mensagem (ex.: lista de vínculos). */
  content?: ReactNode;
};

export type AlertOptions = {
  title?: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
};

type DialogSession<T> = {
  options: T;
  open: boolean;
};

type AppDialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

const dialogTransitionProps = { timeout: DIALOG_TRANSITION_MS };

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [confirmSession, setConfirmSession] = useState<DialogSession<ConfirmOptions> | null>(
    null,
  );
  const [alertSession, setAlertSession] = useState<DialogSession<AlertOptions> | null>(null);

  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);
  const alertResolveRef = useRef<(() => void) | null>(null);
  const confirmPendingResultRef = useRef<boolean | null>(null);
  const alertClosingRef = useRef(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      confirmPendingResultRef.current = null;
      setConfirmSession({ options, open: true });
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      alertResolveRef.current = resolve;
      alertClosingRef.current = false;
      setAlertSession({ options, open: true });
    });
  }, []);

  const beginCloseConfirm = useCallback((result: boolean) => {
    if (confirmPendingResultRef.current !== null) return;
    confirmPendingResultRef.current = result;
    setConfirmSession((prev) => (prev ? { ...prev, open: false } : null));
  }, []);

  const finishCloseConfirm = useCallback(() => {
    if (confirmPendingResultRef.current === null) return;
    const result = confirmPendingResultRef.current;
    confirmPendingResultRef.current = null;
    setConfirmSession(null);
    confirmResolveRef.current?.(result);
    confirmResolveRef.current = null;
  }, []);

  const beginCloseAlert = useCallback(() => {
    if (alertClosingRef.current) return;
    alertClosingRef.current = true;
    setAlertSession((prev) => (prev ? { ...prev, open: false } : null));
  }, []);

  const finishCloseAlert = useCallback(() => {
    if (!alertClosingRef.current) return;
    alertClosingRef.current = false;
    setAlertSession(null);
    alertResolveRef.current?.();
    alertResolveRef.current = null;
  }, []);

  const confirmOptions = confirmSession?.options;
  const confirmColor = confirmOptions?.confirmColor ?? 'primary';

  return (
    <AppDialogContext.Provider value={{ confirm, alert }}>
      {children}

      <Dialog
        open={confirmSession?.open ?? false}
        onClose={(_, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            beginCloseConfirm(false);
          }
        }}
        maxWidth="xs"
        fullWidth
        keepMounted={false}
        disableRestoreFocus
        TransitionProps={dialogTransitionProps}
        onTransitionExited={finishCloseConfirm}
        BackdropProps={{ transitionDuration: DIALOG_TRANSITION_MS }}
        PaperProps={{ sx: dialogPaperSx(isMobile) }}
      >
        <DialogHeader
          onClose={() => beginCloseConfirm(false)}
          title={confirmOptions?.title ?? 'Confirmar'}
          subtitle={
            confirmOptions?.disableConfirm
              ? 'Ação bloqueada'
              : (confirmOptions?.subtitle ?? 'Revise antes de continuar')
          }
          icon={<HelpOutlineIcon fontSize="small" />}
          isMobile={isMobile}
        />
        <DialogContent sx={dialogSimpleContentSx}>
          <Typography variant="body2" lineHeight={1.6}>
            {confirmOptions?.message}
          </Typography>

          {confirmOptions?.disableConfirm && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {confirmOptions.blockedMessage ?? 'Remova os vínculos antes de excluir.'}
            </Alert>
          )}

          {confirmOptions?.content}

          {confirmOptions?.details && confirmOptions.details.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              {confirmOptions?.detailsTitle && (
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                  {confirmOptions.detailsTitle}
                </Typography>
              )}
              <List dense disablePadding sx={{ listStyleType: 'disc', pl: 2.5, m: 0 }}>
                {confirmOptions?.details?.map((line) => (
                  <ListItem key={line} disablePadding sx={{ display: 'list-item', py: 0.25 }}>
                    <ListItemText
                      primary={line}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            ...dialogActionsBorderSx,
            gap: 1,
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            '& > button': isMobile ? { flex: '1 1 auto', minWidth: 0 } : undefined,
          }}
        >
          <Button type="button" onClick={() => beginCloseConfirm(false)} fullWidth={isMobile}>
            {confirmOptions?.disableConfirm
              ? 'Fechar'
              : (confirmOptions?.cancelLabel ?? 'Cancelar')}
          </Button>
          {!confirmOptions?.disableConfirm && (
            <Button
              type="button"
              variant="contained"
              color={confirmColor}
              onClick={() => beginCloseConfirm(true)}
              fullWidth={isMobile}
            >
              {confirmOptions?.confirmLabel ?? 'Confirmar'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={alertSession?.open ?? false}
        onClose={beginCloseAlert}
        maxWidth="xs"
        fullWidth
        keepMounted={false}
        disableRestoreFocus
        TransitionProps={dialogTransitionProps}
        onTransitionExited={finishCloseAlert}
        BackdropProps={{ transitionDuration: DIALOG_TRANSITION_MS }}
        PaperProps={{ sx: dialogPaperSx(isMobile) }}
      >
        <DialogHeader
          onClose={beginCloseAlert}
          title={alertSession?.options.title ?? 'Aviso'}
          subtitle="Informação do sistema"
          icon={<InfoOutlinedIcon fontSize="small" />}
          isMobile={isMobile}
        />
        <DialogContent sx={dialogSimpleContentSx}>
          {alertSession?.options.severity ? (
            <Alert severity={alertSession.options.severity}>{alertSession.options.message}</Alert>
          ) : (
            <Typography variant="body1" lineHeight={1.6}>
              {alertSession?.options.message}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsBorderSx}>
          <Button type="button" variant="contained" onClick={beginCloseAlert} fullWidth={isMobile}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error('useAppDialog deve ser usado dentro de AppDialogProvider');
  }
  return ctx;
}
