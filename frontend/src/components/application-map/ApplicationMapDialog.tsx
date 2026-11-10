import { Suspense, lazy, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
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
  bodyRegionDef,
  faceRegionMap,
  formatProductTotal,
  is3DView,
  pointView,
  type ApplicationMapDraft,
  type FaceView,
  type IllustratedView,
} from './applicationMapModel';

/** three.js só carrega quando o 3D é aberto. */
const ApplicationMap3D = lazy(() => import('./ApplicationMap3D'));

type Area = 'face' | 'body';

const AREA_LABEL: Record<Area, string> = {
  face: 'Facial',
  body: 'Corporal',
};

type FaceMode = IllustratedView | 'head3d';
type BodyMode = 'body3d' | 'body';

/** Abre no 3D, a não ser que o mapa só tenha marcações na ilustração 2D daquela área. */
function initialMode(map: ApplicationMapDraft, area: Area): boolean {
  const views = [...map.points.map(pointView), ...map.strokes.map((s) => s.view)];
  const in3D = views.includes(area === 'face' ? 'head3d' : 'body3d');
  const in2D = area === 'face' ? views.some((v) => FACE_VIEWS.includes(v as FaceView)) : views.includes('body');
  return in3D || !in2D;
}

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
  isMobile,
}: {
  onClose: () => void;
  map: ApplicationMapDraft;
  setMap: Dispatch<SetStateAction<ApplicationMapDraft>>;
  products: ApplicationMapProduct[];
  defaultRegion: 'face' | 'body';
  regionLocked: boolean;
  isMobile: boolean;
}) {
  const [product, setProduct] = useState<ApplicationMapProduct>(products[0] ?? 'toxin');
  const [area, setArea] = useState<Area>(defaultRegion);
  const [faceView, setFaceView] = useState<FaceMode>(() => (initialMode(map, 'face') ? 'head3d' : 'front'));
  const [bodyMode, setBodyMode] = useState<BodyMode>(() => (initialMode(map, 'body') ? 'body3d' : 'body'));
  const [region, setRegion] = useState<ApplicationMapRegion | null>(null);
  const [tool, setTool] = useState<MapTool>('point');
  const [strokeColor, setStrokeColor] = useState<string>(STROKE_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(STROKE_WIDTHS[1].value);
  const [selected, setSelected] = useState<number | null>(null);

  const areas: Area[] = regionLocked ? [defaultRegion] : ['face', 'body'];

  // A região escolhida amplia a ilustração do rosto (frente ou perfil) ou do corpo 2D.
  const faceRegion = area === 'face' ? faceRegionMap(region) : undefined;
  const bodyRegion = area === 'body' && bodyMode === 'body' ? bodyRegionDef(region) : undefined;
  const view: ApplicationMapView = area === 'face' ? (faceRegion?.view ?? faceView) : bodyMode;
  const crop = faceRegion?.crop ?? bodyRegion?.crops.body ?? FULL_CROP;

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
  const addPoint = ({ x, y, region: hitRegion }: { x: number; y: number; region?: ApplicationMapRegion }) => {
    const pointRegion = faceRegion?.id ?? bodyRegion?.id ?? hitRegion;
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

  const changeFaceView = (next: FaceMode) => {
    setFaceView(next);
    setSelected(null);
  };
  const changeBodyMode = (next: BodyMode) => {
    setBodyMode(next);
    setRegion(null);
    setSelected(null);
  };
  const toolbar = faceRegion ? undefined : area === 'face' ? (
    <Segmented
      size="sm"
      options={[
        { key: 'head3d' as FaceMode, label: 'Modelo 3D' },
        ...FACE_VIEWS.map((key) => ({ key: key as FaceMode, label: MAP_VIEWS[key].label })),
      ]}
      value={faceView}
      onChange={changeFaceView}
    />
  ) : (
    <Segmented
      size="sm"
      options={[
        { key: 'body3d' as BodyMode, label: 'Modelo 3D' },
        { key: 'body' as BodyMode, label: 'Ilustração 2D' },
      ]}
      value={bodyMode}
      onChange={changeBodyMode}
    />
  );

  let canvas: ReactNode;
  if (is3DView(view)) {
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
          view={view}
          height={canvasHeight}
          toolbar={toolbar}
          onUnavailable={() => (view === 'head3d' ? changeFaceView('front') : changeBodyMode('body'))}
        />
      </Suspense>
    );
  } else {
    canvas = (
      <ApplicationMapCanvas
        {...editing}
        image={
          faceRegion
            ? { ...MAP_VIEWS[faceRegion.view], label: faceRegion.label }
            : MAP_VIEWS[view as IllustratedView]
        }
        view={view}
        crop={crop}
        height={canvasHeight}
        guides={faceRegion?.guides}
        toolbar={toolbar}
      />
    );
  }


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
          {area === 'face' && faceView === 'head3d' && !faceRegion && (
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
              Modelo ilustrado: clique para marcar, arraste para girar e use a roda do mouse (ou pinça) para aproximar.
            </Typography>
          )}
          {area === 'body' && bodyMode === 'body3d' && (
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
              Modelo ilustrado: clique para marcar e arraste para girar; a região de cada ponto (abdômen, flancos…) é
              anotada pelo lugar marcado.
            </Typography>
          )}
          {faceRegion && (
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
              Mapa de {faceRegion.label.toLowerCase()}: os círculos tracejados são pontos de aplicação sugeridos —
              clique num deles ou em qualquer lugar do mapa para marcar.
            </Typography>
          )}
          {area === 'body' && bodyMode === 'body' && (
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
