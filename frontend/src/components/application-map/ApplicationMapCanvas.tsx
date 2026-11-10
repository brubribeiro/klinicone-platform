import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { Box, IconButton, InputBase, Stack, Tooltip, Typography, alpha } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RemoveIcon from '@mui/icons-material/Remove';

import { fontSizes } from '../../theme/fontSizes';
import type { ApplicationMapPoint, ApplicationMapStroke, ApplicationMapView } from '../../types';
import {
  formatQty,
  parseQty,
  pointView,
  productDef,
  strokePath,
  type MapCrop,
  type MapGuide,
  type MapViewDef,
} from './applicationMapModel';

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.2;
/** Distância mínima entre dois pontos de um traço, em % da largura visível. */
const STROKE_MIN_STEP = 0.35;
const ZOOM_MS = 320;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sameCrop = (a: MapCrop, b: MapCrop) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/**
 * Recorte mostrado: anima a troca de recorte (rosto todo ↔ região) na mesma imagem. A cada
 * quadro a proporção do quadro sai do próprio recorte, então a imagem nunca aparece esticada;
 * ao trocar de imagem (frente → perfil), o novo recorte entra direto.
 */
function useCropTransition(target: MapCrop, src: string): MapCrop {
  const [state, setState] = useState({ crop: target, src });
  const shown = state.src === src ? state.crop : target;
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (state.src !== src || reduceMotion || sameCrop(from, target)) {
      if (state.src !== src || !sameCrop(state.crop, target)) setState({ crop: target, src });
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / ZOOM_MS);
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setState({
        crop: {
          x: lerp(from.x, target.x, k),
          y: lerp(from.y, target.y, k),
          w: lerp(from.w, target.w, k),
          h: lerp(from.h, target.h, k),
        },
        src,
      });
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anima só quando o recorte ou a imagem mudam
  }, [target.x, target.y, target.w, target.h, src]);

  return shown;
}

export type MapTool = 'point' | 'draw' | 'erase';

const floatingButtonSx = {
  width: 34,
  height: 34,
  borderRadius: '9px',
  border: 1,
  borderColor: 'divider',
  bgcolor: '#fff',
  color: '#0F1C1A',
  boxShadow: '0 2px 8px rgba(0,0,0,.12)',
  '&:hover': { bgcolor: '#F3F8F6' },
} as const;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp100 = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Imagem do mapa (ilustração ou foto) com pontos e desenho livre. `crop` amplia uma região:
 * as coordenadas continuam em % da imagem inteira, então o ponto marcado no zoom aparece
 * no mesmo lugar na vista completa.
 */
export function ApplicationMapCanvas({
  image,
  view,
  crop: targetCrop,
  points,
  strokes,
  tool,
  strokeColor,
  strokeWidth,
  selectedIndex,
  onSelect,
  onAdd,
  onQtyChange,
  onRemove,
  onAddStroke,
  onRemoveStroke,
  height,
  autoFocusQty,
  toolbar,
  guides,
}: {
  image: MapViewDef;
  view: ApplicationMapView;
  crop: MapCrop;
  points: ApplicationMapPoint[];
  strokes: ApplicationMapStroke[];
  tool: MapTool;
  strokeColor: string;
  /** Espessura em % da largura visível. */
  strokeWidth: number;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onAdd: (point: { x: number; y: number }) => void;
  onQtyChange: (index: number, qty: number | undefined) => void;
  onRemove: (index: number) => void;
  onAddStroke: (stroke: ApplicationMapStroke) => void;
  onRemoveStroke: (index: number) => void;
  height: string | number;
  autoFocusQty: boolean;
  /** Controles no topo do mapa (ex.: vistas do rosto). */
  toolbar?: ReactNode;
  /** Pontos de aplicação sugeridos (mapas por região): clicar marca o ponto ali. */
  guides?: MapGuide[];
}) {
  const [zoom, setZoom] = useState(1);
  const crop = useCropTransition(targetCrop, image.src);
  const stageRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<number[] | null>(null);
  const selected = selectedIndex !== null ? points[selectedIndex] : undefined;
  const aspect = (crop.w * image.width) / (crop.h * image.height);

  /** Posição do ponteiro em % da imagem inteira. */
  const toImage = (clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: clamp100(((clientX - rect.left) / rect.width) * 100),
      y: clamp100(((clientY - rect.top) / rect.height) * 100),
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (tool !== 'draw' || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toImage(e.clientX, e.clientY);
    setDraft([round1(x), round1(y)]);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    const { x, y } = toImage(e.clientX, e.clientY);
    const lx = draft[draft.length - 2];
    const ly = draft[draft.length - 1];
    const step = (STROKE_MIN_STEP * crop.w) / 100;
    if (Math.hypot(x - lx, ((y - ly) * image.height) / image.width) < step) return;
    if (draft.length >= 1000) return;
    setDraft([...draft, round1(x), round1(y)]);
  };

  const finishStroke = () => {
    if (!draft) return;
    onAddStroke({
      view,
      color: strokeColor,
      width: round2(Math.max(0.1, (strokeWidth * crop.w) / 100)),
      points: draft,
    });
    setDraft(null);
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (tool !== 'point') return;
    const { x, y } = toImage(e.clientX, e.clientY);
    onAdd({ x: round2(x), y: round2(y) });
  };

  const viewStrokes = strokes.map((s, index) => ({ s, index })).filter(({ s }) => s.view === view);
  /** Posição do ponto selecionado no recorte visível, para o editor não sair da tela. */
  const selectedInFrame = selected && {
    x: ((selected.x - crop.x) / crop.w) * 100,
    y: ((selected.y - crop.y) / crop.h) * 100,
  };

  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: '#fff',
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
        height,
        width: '100%',
        overflow: 'hidden',
        containerType: 'size',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          transition: 'transform .15s ease',
        }}
      >
        <Box
          role="img"
          aria-label={`Mapa de aplicação: ${image.label.toLowerCase()}`}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={() => setDraft(null)}
          sx={{
            position: 'relative',
            width: `min(100cqw, calc(100cqh * ${aspect}))`,
            aspectRatio: `${aspect}`,
            overflow: 'hidden',
            cursor: tool === 'erase' ? 'cell' : 'crosshair',
            userSelect: 'none',
            touchAction: tool === 'draw' ? 'none' : 'manipulation',
          }}
        >
          <Box
            ref={stageRef}
            sx={{
              position: 'absolute',
              left: `${(-crop.x / crop.w) * 100}%`,
              top: `${(-crop.y / crop.h) * 100}%`,
              width: `${(100 / crop.w) * 100}%`,
              height: `${(100 / crop.h) * 100}%`,
            }}
          >
            <Box
              component="img"
              // Elemento novo por imagem: o quadro anterior não aparece esticado enquanto a nova carrega.
              key={image.src}
              src={image.src}
              alt=""
              draggable={false}
              sx={{
                display: 'block',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            />
            <Box
              component="svg"
              viewBox={`0 0 ${image.width} ${image.height}`}
              preserveAspectRatio="none"
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {viewStrokes.map(({ s, index }) => {
                const d = strokePath(s.points, image.width, image.height);
                // Traço feito no zoom continua visível na vista inteira (mínimo de 0,3% da largura visível).
                const w = (Math.max(s.width, crop.w * 0.003) * image.width) / 100;
                return (
                  <g key={index}>
                    <path
                      d={d}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={w}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.9}
                    />
                    {tool === 'erase' && (
                      <path
                        d={d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={Math.max(w * 3, image.width * crop.w * 0.0003)}
                        strokeLinecap="round"
                        role="button"
                        aria-label={`Apagar traço ${index + 1}`}
                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveStroke(index);
                        }}
                      />
                    )}
                  </g>
                );
              })}
              {draft && (
                <path
                  d={strokePath(draft, image.width, image.height)}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={(strokeWidth * crop.w * image.width) / 10000}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.9}
                />
              )}
            </Box>
            {guides?.map((g, i) => (
              <Box
                key={`guide-${i}`}
                component="span"
                role={tool === 'point' ? 'button' : undefined}
                aria-label={tool === 'point' ? `Marcar ponto sugerido: ${g.label}` : undefined}
                title={`${g.label} (ponto sugerido)`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd({ x: g.x, y: g.y });
                }}
                sx={{
                  position: 'absolute',
                  left: `${g.x}%`,
                  top: `${g.y}%`,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px dashed',
                  borderColor: alpha('#1F7A6E', 0.75),
                  bgcolor: alpha('#fff', 0.45),
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: tool === 'point' ? 'auto' : 'none',
                  cursor: 'pointer',
                  zIndex: 1,
                  transition: 'transform .12s ease, background-color .12s ease',
                  '&:hover': {
                    bgcolor: alpha('#1F7A6E', 0.2),
                    transform: 'translate(-50%, -50%) scale(1.2)',
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    bgcolor: alpha('#1F7A6E', 0.8),
                    transform: 'translate(-50%, -50%)',
                  },
                }}
              />
            ))}
            {points.map((p, index) => {
              if (pointView(p) !== view) return null;
              const product = productDef(p.product);
              const color = product?.color ?? '#5C6F6B';
              const isSelected = index === selectedIndex;
              const applicator = p.product === 'cryolipolysis';
              return (
                <Box
                  key={index}
                  component="span"
                  role="button"
                  aria-label={`${tool === 'erase' ? 'Apagar' : 'Editar'} ponto ${index + 1}${product ? ` (${product.label})` : ''}`}
                  title={tool === 'erase' ? 'Apagar ponto' : 'Editar ponto'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === 'erase') onRemove(index);
                    else onSelect(index);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  sx={{
                    position: 'absolute',
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    minWidth: applicator ? 34 : 17,
                    height: applicator ? 22 : 17,
                    px: '3px',
                    borderRadius: applicator ? '7px' : '9px',
                    bgcolor: applicator ? alpha(color, 0.75) : color,
                    border: '2px solid #fff',
                    boxShadow: isSelected
                      ? `0 0 0 3px ${alpha(color, 0.4)}, 0 1px 4px rgba(0,0,0,.4)`
                      : '0 1px 4px rgba(0,0,0,.35)',
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: '#fff',
                    zIndex: isSelected ? 3 : 2,
                  }}
                >
                  {p.qty !== undefined ? formatQty(p.qty) : ''}
                </Box>
              );
            })}
          </Box>
          {selected && selectedInFrame && selectedIndex !== null && pointView(selected) === view && (
            <MarkEditor
              key={selectedIndex}
              point={selected}
              position={selectedInFrame}
              index={selectedIndex}
              autoFocus={autoFocusQty}
              onQtyChange={(qty) => onQtyChange(selectedIndex, qty)}
              onRemove={() => onRemove(selectedIndex)}
              onClose={() => onSelect(null)}
            />
          )}
        </Box>
      </Box>

      {toolbar && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 4,
            maxWidth: '92%',
          }}
        >
          {toolbar}
        </Box>
      )}

      <Stack spacing={0.75} sx={{ position: 'absolute', bottom: 12, right: 12, zIndex: 5 }}>
        <Tooltip title="Mais zoom" placement="left">
          <span>
            <IconButton
              aria-label="Mais zoom"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10))}
              sx={floatingButtonSx}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Menos zoom" placement="left">
          <span>
            <IconButton
              aria-label="Menos zoom"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10))}
              sx={floatingButtonSx}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

export function MarkEditor({
  point,
  position,
  index,
  autoFocus,
  onQtyChange,
  onRemove,
  onClose,
}: {
  point: ApplicationMapPoint;
  /** Posição do ponto em % do recorte visível. */
  position: { x: number; y: number };
  index: number;
  autoFocus: boolean;
  onQtyChange: (qty: number | undefined) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const product = productDef(point.product);
  const [text, setText] = useState(point.qty !== undefined ? formatQty(point.qty) : '');
  /** Perto do topo o editor abre abaixo do ponto para não ser cortado. */
  const below = position.y < 28;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      sx={{
        position: 'absolute',
        left: `${Math.min(Math.max(position.x, 18), 82)}%`,
        top: below ? `calc(${position.y}% + 14px)` : `calc(${position.y}% - 14px)`,
        transform: below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: '12px',
        boxShadow: '0 8px 40px -16px rgba(16,40,37,.22), 0 2px 10px rgba(16,40,37,.12)',
        p: '11px 12px',
        zIndex: 6,
        width: 180,
        cursor: 'default',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.1 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              bgcolor: product?.color ?? 'text.secondary',
              flexShrink: 0,
            }}
          />
          <Typography noWrap sx={{ fontSize: fontSizes['2xs'], fontWeight: 800 }}>
            {product?.label ?? `Ponto ${index + 1}`}
          </Typography>
        </Stack>
        <IconButton
          aria-label="Fechar editor do ponto"
          onClick={onClose}
          sx={{
            width: 22,
            height: 22,
            borderRadius: '7px',
            bgcolor: 'grey.100',
            color: 'text.disabled',
          }}
        >
          <CloseIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Stack>
      {point.note && (
        <Typography
          sx={{
            fontSize: fontSizes['2xs'],
            color: 'text.secondary',
            mb: 1,
            lineHeight: 1.35,
          }}
        >
          {point.note}
        </Typography>
      )}
      <Stack direction="row" alignItems="center" spacing={0.9}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.6}
          sx={{
            flex: 1,
            minWidth: 0,
            height: 38,
            borderRadius: '9px',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
            px: 1.4,
          }}
        >
          <InputBase
            value={text}
            autoFocus={autoFocus}
            placeholder="Qtd."
            inputProps={{
              inputMode: 'decimal',
              maxLength: 7,
              'aria-label': `Quantidade do ponto ${index + 1}${product ? ` em ${product.unit}` : ''}`,
            }}
            onKeyDown={handleKeyDown}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d.,]/g, '');
              setText(next);
              onQtyChange(next.trim() ? parseQty(next) : undefined);
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: fontSizes.md,
              fontWeight: 700,
            }}
          />
          {product && (
            <Typography
              sx={{
                fontSize: fontSizes['2xs'],
                color: 'text.disabled',
                fontWeight: 700,
              }}
            >
              {product.unit}
            </Typography>
          )}
        </Stack>
        <Tooltip title="Remover ponto">
          <IconButton
            aria-label={`Remover ponto ${index + 1}`}
            onClick={onRemove}
            sx={(t) => ({
              width: 38,
              height: 38,
              borderRadius: '9px',
              border: '1px solid',
              borderColor: alpha(t.palette.error.main, 0.4),
              bgcolor: alpha(t.palette.error.main, 0.08),
              color: 'error.main',
              '&:hover': { bgcolor: alpha(t.palette.error.main, 0.16) },
            })}
          >
            <DeleteOutlineIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
