import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { fontSizes } from '../../theme/fontSizes';
import type { ApplicationMapPoint, ApplicationMapProduct, ApplicationMapView } from '../../types';
import { DialogHeader, dialogActionsBorderSx } from '../DialogCloseButton';
import { ApplicationMapCanvas } from './ApplicationMapCanvas';
import { MAP_PRODUCTS, formatProductTotal } from './applicationMapModel';

type Region = 'face' | 'body';

const REGIONS: { key: Region; label: string }[] = [
  { key: 'face', label: 'Facial' },
  { key: 'body', label: 'Corporal' },
];

/** Editor do mapa de aplicação do atendimento; os pontos são gravados ao salvar o agendamento. */
export function ApplicationMapDialog({
  open,
  onClose,
  points,
  setPoints,
  products,
  defaultRegion,
  regionLocked,
}: {
  open: boolean;
  onClose: () => void;
  points: ApplicationMapPoint[];
  setPoints: Dispatch<SetStateAction<ApplicationMapPoint[]>>;
  /** Produtos do atendimento; vazio lista todos. */
  products: ApplicationMapProduct[];
  defaultRegion: Region;
  /** Esconde Facial/Corporal quando os procedimentos são de uma região só. */
  regionLocked: boolean;
}) {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: isMobile ? '100%' : 880,
          maxHeight: isMobile ? '100%' : '94vh',
          borderRadius: isMobile ? 0 : '20px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <ApplicationMapEditor
        onClose={onClose}
        points={points}
        setPoints={setPoints}
        products={products}
        defaultRegion={defaultRegion}
        regionLocked={regionLocked}
        isMobile={isMobile}
      />
    </Dialog>
  );
}

function ApplicationMapEditor({
  onClose,
  points,
  setPoints,
  products,
  defaultRegion,
  regionLocked,
  isMobile,
}: {
  onClose: () => void;
  points: ApplicationMapPoint[];
  setPoints: Dispatch<SetStateAction<ApplicationMapPoint[]>>;
  products: ApplicationMapProduct[];
  defaultRegion: Region;
  regionLocked: boolean;
  isMobile: boolean;
}) {
  const [product, setProduct] = useState<ApplicationMapProduct>(products[0] ?? 'toxin');
  const [view, setView] = useState<ApplicationMapView>(defaultRegion === 'body' ? 'body' : 'front');
  const [selected, setSelected] = useState<number | null>(null);
  const region: Region = view === 'body' ? 'body' : 'face';

  /** Pontos já marcados com outro produto mantêm a linha dele no resumo. */
  const productRows =
    products.length === 0
      ? MAP_PRODUCTS
      : MAP_PRODUCTS.filter((p) => products.includes(p.id) || points.some((point) => point.product === p.id));

  const changeView = (next: ApplicationMapView) => {
    setView(next);
    setSelected(null);
  };

  return (
    <>
      <DialogHeader
        onClose={onClose}
        isMobile={isMobile}
        title="Mapa de aplicação"
        subtitle="Marque os pontos e as doses deste atendimento"
      />

      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 }, '&&': { pt: { xs: 2, sm: 2.5 } } }}>
        <Stack spacing={1.75}>
          {!regionLocked && (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ bgcolor: 'grey.100', p: 0.5, borderRadius: '11px', alignSelf: 'flex-start' }}
            >
              {REGIONS.map((r) => {
                const active = r.key === region;
                return (
                  <ButtonBase
                    key={r.key}
                    aria-pressed={active}
                    onClick={() => changeView(r.key === 'body' ? 'body' : 'front')}
                    sx={{
                      height: 36,
                      px: 2.5,
                      fontSize: fontSizes.sm,
                      fontWeight: 700,
                      borderRadius: '9px',
                      bgcolor: active ? 'background.paper' : 'transparent',
                      color: active ? 'primary.main' : 'text.secondary',
                      boxShadow: active ? 1 : 'none',
                    }}
                  >
                    {r.label}
                  </ButtonBase>
                );
              })}
            </Stack>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 240px' },
              gap: 2.25,
              alignItems: 'start',
            }}
          >
            <ApplicationMapCanvas
              points={points}
              view={view}
              onViewChange={changeView}
              selectedIndex={selected}
              onSelect={setSelected}
              height={isMobile ? '58vh' : '52vh'}
              autoFocusQty={!isMobile}
              onAdd={({ x, y }) => {
                setPoints((rows) => [...rows, { x, y, product, view }]);
                setSelected(points.length);
              }}
              onQtyChange={(index, qty) =>
                setPoints((rows) =>
                  rows.map((row, i) => {
                    if (i !== index) return row;
                    const next = { ...row, qty };
                    if (qty === undefined) delete next.qty;
                    return next;
                  }),
                )
              }
              onRemove={(index) => {
                setPoints((rows) => rows.filter((_, i) => i !== index));
                setSelected(null);
              }}
            />

            <Stack spacing={1.1}>
              {productRows.map((p) => {
                const active = p.id === product;
                const count = points.filter((point) => point.product === p.id).length;
                return (
                  <ButtonBase
                    key={p.id}
                    aria-pressed={active}
                    onClick={() => setProduct(p.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 1.4,
                      p: '11px 13px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: active ? p.color : 'divider',
                      bgcolor: active ? `${p.color}14` : 'grey.50',
                      textAlign: 'left',
                    }}
                  >
                    <Box
                      sx={{
                        width: 13,
                        height: 13,
                        borderRadius: '50%',
                        bgcolor: p.color,
                        flexShrink: 0,
                        boxShadow: active ? `0 0 0 3px ${p.color}33` : 'none',
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                      <Typography noWrap sx={{ fontSize: fontSizes.sm, fontWeight: 700, lineHeight: 1.3 }}>
                        {p.label}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: fontSizes.xs,
                          fontWeight: 800,
                          lineHeight: 1.3,
                          color: count > 0 ? p.color : 'text.disabled',
                        }}
                      >
                        {count} pts · {formatProductTotal(p, points)}
                      </Typography>
                    </Box>
                  </ButtonBase>
                );
              })}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  mt: 0.5,
                  p: '12px 14px',
                  borderRadius: '12px',
                  bgcolor: 'grey.50',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
                  Total de pontos
                </Typography>
                <Typography sx={{ fontSize: fontSizes.lg, fontWeight: 800 }}>{points.length}</Typography>
              </Stack>
              <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.disabled', lineHeight: 1.45, px: 0.25 }}>
                Escolha o produto e clique no mapa para marcar. Clique num ponto para informar a dose ou
                removê-lo.
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ ...dialogActionsBorderSx, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<DeleteOutlineIcon />}
          disabled={points.length === 0}
          onClick={() => {
            setPoints([]);
            setSelected(null);
          }}
          sx={{ color: 'text.secondary', borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          Limpar pontos
        </Button>
        <Button variant="contained" onClick={onClose}>
          Concluir
        </Button>
      </DialogActions>
    </>
  );
}
