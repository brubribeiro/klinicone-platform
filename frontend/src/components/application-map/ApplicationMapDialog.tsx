import { Suspense, lazy, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UndoIcon from '@mui/icons-material/Undo';
import { useQuery } from '@tanstack/react-query';

import { patientsApi } from '../../api/patients';
import { fontSizes } from '../../theme/fontSizes';
import type {
  ApplicationMapProduct,
  ApplicationMapRegion,
  ApplicationMapStroke,
  ApplicationMapView,
} from '../../types';
import { DialogHeader, dialogActionsBorderSx } from '../DialogCloseButton';
import { ApplicationMapCanvas, type MapTool } from './ApplicationMapCanvas';
import {
  BODY_REGIONS,
  FACE_REGIONS,
  FACE_VIEWS,
  FULL_CROP,
  MAP_PRODUCTS,
  MAP_VIEWS,
  STROKE_COLORS,
  STROKE_WIDTHS,
  formatProductTotal,
  regionDef,
  type ApplicationMapDraft,
  type IllustratedView,
} from './applicationMapModel';
import { useMapPhoto } from './useMapPhoto';

/** three.js + MediaPipe só carregam quando o 3D é aberto. */
const ApplicationMap3D = lazy(() => import('./ApplicationMap3D'));

type Area = 'face' | 'body' | 'photo';

const AREA_LABEL: Record<Area, string> = {
  face: 'Facial',
  body: 'Corporal',
  photo: 'Foto da paciente',
};

const TOOLS: { key: MapTool; label: string }[] = [
  { key: 'point', label: 'Pontos' },
  { key: 'draw', label: 'Desenho' },
  { key: 'erase', label: 'Borracha' },
];

/** Editor do mapa de aplicação do atendimento; o mapa é gravado ao salvar o agendamento. */
export function ApplicationMapDialog({
  open,
  onClose,
  map,
  setMap,
  products,
  defaultRegion,
  regionLocked,
  patientId,
}: {
  open: boolean;
  onClose: () => void;
  map: ApplicationMapDraft;
  setMap: Dispatch<SetStateAction<ApplicationMapDraft>>;
  /** Produtos do atendimento; vazio lista todos. */
  products: ApplicationMapProduct[];
  defaultRegion: 'face' | 'body';
  /** Esconde Facial/Corporal quando os procedimentos são de uma região só. */
  regionLocked: boolean;
  /** Paciente do atendimento: habilita marcar sobre a foto dela (2D e 3D). */
  patientId?: string;
}) {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // Mesma camada da anamnese de pele: acima da gaveta da paciente.
      sx={{ zIndex: (t) => t.zIndex.modal + 2 }}
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: isMobile ? '100%' : 960,
          maxHeight: isMobile ? '100%' : '96vh',
          borderRadius: isMobile ? 0 : '20px',
          boxShadow: '0 8px 40px -16px rgba(16,40,37,.22)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      slotProps={{
        backdrop: {
          sx: { bgcolor: 'rgba(7,18,17,.55)', backdropFilter: 'blur(3px)' },
        },
      }}
    >
      <ApplicationMapEditor
        onClose={onClose}
        map={map}
        setMap={setMap}
        products={products}
        defaultRegion={defaultRegion}
        regionLocked={regionLocked}
        patientId={patientId}
        isMobile={isMobile}
      />
    </Dialog>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        bgcolor: 'grey.100',
        p: 0.5,
        borderRadius: '11px',
        alignSelf: 'flex-start',
        maxWidth: '100%',
        overflowX: 'auto',
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <ButtonBase
            key={o.key}
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            sx={{
              height: size === 'sm' ? 32 : 36,
              px: size === 'sm' ? 1.5 : 2.25,
              whiteSpace: 'nowrap',
              fontSize: size === 'sm' ? fontSizes.xs : fontSizes.sm,
              fontWeight: 700,
              borderRadius: '9px',
              bgcolor: active ? 'background.paper' : 'transparent',
              color: active ? 'primary.main' : 'text.secondary',
              boxShadow: active ? 1 : 'none',
            }}
          >
            {o.label}
          </ButtonBase>
        );
      })}
    </Stack>
  );
}

function RegionChips({
  label,
  regions,
  value,
  onChange,
}: {
  label: string;
  regions: { id: ApplicationMapRegion; label: string }[];
  value: ApplicationMapRegion | null;
  onChange: (region: ApplicationMapRegion | null) => void;
}) {
  const chip = (key: ApplicationMapRegion | null, text: string) => {
    const active = key === value;
    return (
      <ButtonBase
        key={key ?? 'all'}
        aria-pressed={active}
        onClick={() => onChange(key)}
        sx={{
          height: 30,
          px: 1.4,
          flexShrink: 0,
          borderRadius: '15px',
          border: 1,
          borderColor: active ? 'primary.main' : 'divider',
          bgcolor: active ? 'primary.main' : 'background.paper',
          color: active ? 'primary.contrastText' : 'text.secondary',
          fontSize: fontSizes.xs,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </ButtonBase>
    );
  };
  return (
    <Stack
      direction="row"
      spacing={0.75}
      role="group"
      aria-label="Zoom por região"
      sx={{
        overflowX: 'auto',
        pb: 0.25,
        mx: { xs: -0.5, sm: 0 },
        px: { xs: 0.5, sm: 0 },
      }}
    >
      {chip(null, label)}
      {regions.map((r) => chip(r.id, r.label))}
    </Stack>
  );
}

function ApplicationMapEditor({
  onClose,
  map,
  setMap,
  products,
  defaultRegion,
  regionLocked,
  patientId,
  isMobile,
}: {
  onClose: () => void;
  map: ApplicationMapDraft;
  setMap: Dispatch<SetStateAction<ApplicationMapDraft>>;
  products: ApplicationMapProduct[];
  defaultRegion: 'face' | 'body';
  regionLocked: boolean;
  patientId?: string;
  isMobile: boolean;
}) {
  const [product, setProduct] = useState<ApplicationMapProduct>(products[0] ?? 'toxin');
  const [area, setArea] = useState<Area>(defaultRegion);
  const [faceView, setFaceView] = useState<IllustratedView>('front');
  const [region, setRegion] = useState<ApplicationMapRegion | null>(null);
  const [tool, setTool] = useState<MapTool>('point');
  const [strokeColor, setStrokeColor] = useState<string>(STROKE_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(STROKE_WIDTHS[1].value);
  const [photoMode, setPhotoMode] = useState<'2d' | '3d'>('3d');
  const [selected, setSelected] = useState<number | null>(null);

  const areas: Area[] = [
    ...(regionLocked ? [defaultRegion] : (['face', 'body'] as const)),
    ...(patientId && (!regionLocked || defaultRegion === 'face') ? (['photo'] as const) : []),
  ];

  const view: ApplicationMapView = area === 'face' ? faceView : area;
  const photo = useMapPhoto(patientId, area === 'photo' ? map.photoId : undefined);
  const image = view === 'photo' ? photo.image : MAP_VIEWS[view];
  const crop = (view !== 'photo' && regionDef(region ?? undefined)?.crops[view]) || FULL_CROP;

  /** Pontos já marcados com outro produto mantêm a linha dele no resumo. */
  const productRows =
    products.length === 0
      ? MAP_PRODUCTS
      : MAP_PRODUCTS.filter((p) => products.includes(p.id) || map.points.some((point) => point.product === p.id));

  const changeArea = (next: Area) => {
    setArea(next);
    setRegion(null);
    setSelected(null);
  };

  const viewStrokes = map.strokes.filter((s) => s.view === view);
  const addPoint = ({ x, y }: { x: number; y: number }) => {
    const pointRegion = region && view !== 'photo' && regionDef(region)?.crops[view] ? region : undefined;
    setMap((m) => ({
      ...m,
      points: [
        ...m.points,
        {
          x,
          y,
          product,
          view,
          ...(pointRegion ? { region: pointRegion } : {}),
        },
      ],
    }));
    setSelected(map.points.length);
  };
  const updateQty = (index: number, qty: number | undefined) =>
    setMap((m) => ({
      ...m,
      points: m.points.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, qty };
        if (qty === undefined) delete next.qty;
        return next;
      }),
    }));
  const removePoint = (index: number) => {
    setMap((m) => ({ ...m, points: m.points.filter((_, i) => i !== index) }));
    setSelected(null);
  };
  const addStroke = (stroke: ApplicationMapStroke) => setMap((m) => ({ ...m, strokes: [...m.strokes, stroke] }));
  const removeStroke = (index: number) => setMap((m) => ({ ...m, strokes: m.strokes.filter((_, i) => i !== index) }));
  const undoStroke = () =>
    setMap((m) => {
      const last = m.strokes.map((s) => s.view).lastIndexOf(view);
      return last < 0 ? m : { ...m, strokes: m.strokes.filter((_, i) => i !== last) };
    });

  const canvasHeight = isMobile ? '56vh' : '54vh';
  const editing = {
    points: map.points,
    strokes: map.strokes,
    tool,
    strokeColor,
    strokeWidth,
    selectedIndex: selected,
    onSelect: setSelected,
    onAdd: addPoint,
    onQtyChange: updateQty,
    onRemove: removePoint,
    onAddStroke: addStroke,
    onRemoveStroke: removeStroke,
    autoFocusQty: !isMobile,
  };

  let canvas: ReactNode;
  if (area === 'photo' && !map.photoId) {
    canvas = (
      <PhotoPicker
        patientId={patientId!}
        height={canvasHeight}
        onPick={(photoId) => setMap((m) => ({ ...m, photoId }))}
      />
    );
  } else if (!image) {
    canvas = (
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{
          height: canvasHeight,
          border: 1,
          borderColor: 'divider',
          borderRadius: '16px',
        }}
      >
        {photo.isError ? (
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
            Não foi possível carregar a foto.
          </Typography>
        ) : (
          <CircularProgress size={28} />
        )}
      </Stack>
    );
  } else if (area === 'photo' && photoMode === '3d') {
    canvas = (
      <Suspense
        fallback={
          <Stack alignItems="center" justifyContent="center" sx={{ height: canvasHeight }}>
            <CircularProgress size={28} />
          </Stack>
        }
      >
        <ApplicationMap3D
          {...editing}
          image={image}
          height={canvasHeight}
          toolbar={<PhotoModeSwitch value={photoMode} onChange={setPhotoMode} />}
          onUnavailable={() => setPhotoMode('2d')}
        />
      </Suspense>
    );
  } else {
    canvas = (
      <ApplicationMapCanvas
        {...editing}
        image={image}
        view={view}
        crop={crop}
        height={canvasHeight}
        toolbar={
          area === 'face' ? (
            <Segmented
              size="sm"
              options={FACE_VIEWS.map((key) => ({
                key,
                label: MAP_VIEWS[key].label,
              }))}
              value={faceView}
              onChange={(next) => {
                setFaceView(next);
                setSelected(null);
              }}
            />
          ) : area === 'photo' ? (
            <PhotoModeSwitch value={photoMode} onChange={setPhotoMode} />
          ) : undefined
        }
      />
    );
  }

  const photoHasMarks = map.points.some((p) => p.view === 'photo') || map.strokes.some((s) => s.view === 'photo');

  return (
    <>
      <DialogHeader
        onClose={onClose}
        isMobile={isMobile}
        title="Mapa de aplicação"
        subtitle="Marque os pontos, as doses e desenhe sobre o mapa deste atendimento"
      />

      <DialogContent
        sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 2.5 },
          '&&': { pt: { xs: 2, sm: 2.5 } },
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center">
            {areas.length > 1 && (
              <Segmented
                options={areas.map((key) => ({ key, label: AREA_LABEL[key] }))}
                value={area}
                onChange={changeArea}
              />
            )}
            <Segmented
              options={TOOLS}
              value={tool}
              onChange={(next) => {
                setTool(next);
                setSelected(null);
              }}
            />
            {tool === 'draw' && (
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                role="group"
                aria-label="Cor e espessura do traço"
              >
                {STROKE_COLORS.map((color) => (
                  <ButtonBase
                    key={color}
                    aria-label={`Cor ${color}`}
                    aria-pressed={color === strokeColor}
                    onClick={() => setStrokeColor(color)}
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: color,
                      border: '2px solid #fff',
                      boxShadow: color === strokeColor ? `0 0 0 2px ${color}` : '0 0 0 1px rgba(0,0,0,.15)',
                    }}
                  />
                ))}
                <Segmented
                  size="sm"
                  options={STROKE_WIDTHS.map((w) => ({
                    key: String(w.value),
                    label: w.label,
                  }))}
                  value={String(strokeWidth)}
                  onChange={(next) => setStrokeWidth(Number(next))}
                />
                <Tooltip title="Desfazer último traço">
                  <span>
                    <IconButton
                      aria-label="Desfazer último traço"
                      disabled={viewStrokes.length === 0}
                      onClick={undoStroke}
                      size="small"
                    >
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            )}
          </Stack>

          {area === 'face' && (
            <RegionChips
              label="Rosto todo"
              regions={FACE_REGIONS}
              value={region}
              onChange={(r) => {
                setRegion(r);
                setSelected(null);
              }}
            />
          )}
          {area === 'body' && (
            <RegionChips
              label="Corpo todo"
              regions={BODY_REGIONS}
              value={region}
              onChange={(r) => {
                setRegion(r);
                setSelected(null);
              }}
            />
          )}
          {area === 'photo' && map.photoId && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography
                sx={{
                  fontSize: fontSizes.xs,
                  color: 'text.secondary',
                  flex: 1,
                }}
              >
                {photoMode === '3d'
                  ? 'Modelo 3D gerado da foto: arraste fora do rosto (ou com o botão direito) para girar.'
                  : 'Marcação sobre a foto da paciente.'}
              </Typography>
              <Tooltip title={photoHasMarks ? 'Apague as marcações da foto para trocar de foto' : ''}>
                <span>
                  <Button
                    size="small"
                    disabled={photoHasMarks}
                    onClick={() => setMap((m) => ({ ...m, photoId: undefined }))}
                  >
                    Trocar foto
                  </Button>
                </span>
              </Tooltip>
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
            {canvas}

            <Stack spacing={1.1}>
              {productRows.map((p) => {
                const active = p.id === product;
                const count = map.points.filter((point) => point.product === p.id).length;
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
                      <Typography
                        noWrap
                        sx={{
                          fontSize: fontSizes.sm,
                          fontWeight: 700,
                          lineHeight: 1.3,
                        }}
                      >
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
                        {count} pts · {formatProductTotal(p, map.points)}
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
                <Typography
                  sx={{
                    fontSize: fontSizes.xs,
                    color: 'text.secondary',
                    fontWeight: 600,
                  }}
                >
                  Total de pontos
                </Typography>
                <Typography sx={{ fontSize: fontSizes.lg, fontWeight: 800 }}>{map.points.length}</Typography>
              </Stack>
              <Typography
                sx={{
                  fontSize: fontSizes['2xs'],
                  color: 'text.disabled',
                  lineHeight: 1.45,
                  px: 0.25,
                }}
              >
                {tool === 'draw'
                  ? 'Arraste sobre o mapa para desenhar. Use a borracha para apagar um traço ou ponto.'
                  : 'Escolha o produto e clique no mapa para marcar. Clique num ponto para informar a dose ou removê-lo.'}
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
          disabled={map.points.length === 0 && map.strokes.length === 0}
          onClick={() => {
            setMap((m) => ({ ...m, points: [], strokes: [] }));
            setSelected(null);
          }}
          sx={{
            color: 'text.secondary',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          Limpar mapa
        </Button>
        <Button variant="contained" onClick={onClose}>
          Concluir
        </Button>
      </DialogActions>
    </>
  );
}

function PhotoModeSwitch({ value, onChange }: { value: '2d' | '3d'; onChange: (mode: '2d' | '3d') => void }) {
  return (
    <Segmented
      size="sm"
      options={[
        { key: '3d', label: 'Modelo 3D' },
        { key: '2d', label: 'Foto 2D' },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

/** Escolha da foto (já salva no R2) sobre a qual o mapa será marcado. */
function PhotoPicker({
  patientId,
  height,
  onPick,
}: {
  patientId: string;
  height: string;
  onPick: (photoId: string) => void;
}) {
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['patient-photos', patientId],
    queryFn: () => patientsApi.listPhotos(patientId),
  });
  return (
    <Box
      sx={{
        height,
        overflowY: 'auto',
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
        p: 2,
      }}
    >
      <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700, mb: 0.5 }}>Escolha uma foto de frente</Typography>
      <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mb: 1.5 }}>
        O modelo 3D do rosto é gerado a partir dela. Funciona melhor com o rosto de frente, bem iluminado e sem cabelo
        cobrindo a testa.
      </Typography>
      {isLoading ? (
        <CircularProgress size={24} />
      ) : photos.length === 0 ? (
        <Alert severity="info">
          Esta paciente ainda não tem fotos. Adicione fotos de antes/depois no atendimento para marcar sobre elas.
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 1.25,
          }}
        >
          {photos.map((photo) => (
            <ButtonBase
              key={photo.id}
              onClick={() => onPick(photo.id)}
              aria-label={`Usar foto de ${new Date(photo.takenAt).toLocaleDateString('pt-BR')}`}
              sx={{
                display: 'block',
                borderRadius: '12px',
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'grey.100',
                aspectRatio: '3 / 4',
              }}
            >
              {photo.url ? (
                <Box
                  component="img"
                  src={photo.url}
                  alt=""
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <Typography
                  sx={{
                    fontSize: fontSizes['2xs'],
                    color: 'text.disabled',
                    p: 1,
                  }}
                >
                  Sem prévia
                </Typography>
              )}
              <Typography
                sx={{
                  position: 'relative',
                  mt: '-26px',
                  py: 0.5,
                  fontSize: fontSizes['2xs'],
                  fontWeight: 700,
                  color: '#fff',
                  bgcolor: 'rgba(0,0,0,.45)',
                }}
              >
                {photo.phase === 'BEFORE' ? 'Antes' : 'Depois'} · {new Date(photo.takenAt).toLocaleDateString('pt-BR')}
              </Typography>
            </ButtonBase>
          ))}
        </Box>
      )}
    </Box>
  );
}
