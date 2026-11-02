import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Box, ButtonBase, IconButton, InputBase, Stack, Tooltip, Typography, alpha } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RemoveIcon from '@mui/icons-material/Remove';

import { fontSizes } from '../../theme/fontSizes';
import type { ApplicationMapPoint, ApplicationMapView } from '../../types';
import {
  FACE_VIEWS,
  MAP_VIEWS,
  formatQty,
  parseQty,
  pointView,
  productDef,
} from './applicationMapModel';

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.2;

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

export function ApplicationMapCanvas({
  points,
  view,
  onViewChange,
  selectedIndex,
  onSelect,
  onAdd,
  onQtyChange,
  onRemove,
  height,
  autoFocusQty,
}: {
  points: ApplicationMapPoint[];
  view: ApplicationMapView;
  onViewChange: (view: ApplicationMapView) => void;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onAdd: (point: { x: number; y: number }) => void;
  onQtyChange: (index: number, qty: number | undefined) => void;
  onRemove: (index: number) => void;
  height: string | number;
  autoFocusQty: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const image = MAP_VIEWS[view];
  const selected = selectedIndex !== null ? points[selectedIndex] : undefined;

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAdd({
      x: Math.round(Math.min(100, Math.max(0, x)) * 10) / 10,
      y: Math.round(Math.min(100, Math.max(0, y)) * 10) / 10,
    });
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
          sx={{
            position: 'relative',
            width: `min(100cqw, calc(100cqh * ${image.width} / ${image.height}))`,
            aspectRatio: `${image.width} / ${image.height}`,
            cursor: 'crosshair',
            userSelect: 'none',
            touchAction: 'manipulation',
          }}
        >
          <Box
            component="img"
            src={image.src}
            alt=""
            draggable={false}
            sx={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
          />
          {points.map((p, index) => {
            if (pointView(p) !== view) return null;
            const product = productDef(p.product);
            const color = product?.color ?? '#5C6F6B';
            const isSelected = index === selectedIndex;
            return (
              <Box
                key={index}
                component="span"
                role="button"
                aria-label={`Editar ponto ${index + 1}${product ? ` (${product.label})` : ''}`}
                title="Editar ponto"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(index);
                }}
                sx={{
                  position: 'absolute',
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  minWidth: 17,
                  height: 17,
                  px: '3px',
                  borderRadius: '9px',
                  bgcolor: color,
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
          {selected && selectedIndex !== null && pointView(selected) === view && (
            <MarkEditor
              key={selectedIndex}
              point={selected}
              index={selectedIndex}
              autoFocus={autoFocusQty}
              onQtyChange={(qty) => onQtyChange(selectedIndex, qty)}
              onRemove={() => onRemove(selectedIndex)}
              onClose={() => onSelect(null)}
            />
          )}
        </Box>
      </Box>

      {view !== 'body' && (
        <Stack
          direction="row"
          spacing={0.5}
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'grey.100',
            p: 0.5,
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,.12)',
            zIndex: 4,
            maxWidth: '92%',
          }}
        >
          {FACE_VIEWS.map((key) => {
            const active = key === view;
            return (
              <ButtonBase
                key={key}
                onClick={() => onViewChange(key)}
                aria-pressed={active}
                sx={{
                  flex: 1,
                  height: 34,
                  px: 1.5,
                  whiteSpace: 'nowrap',
                  fontSize: fontSizes.xs,
                  fontWeight: 700,
                  borderRadius: '8px',
                  bgcolor: active ? 'background.paper' : 'transparent',
                  color: active ? 'primary.main' : 'text.secondary',
                  boxShadow: active ? 1 : 'none',
                }}
              >
                {MAP_VIEWS[key].label}
              </ButtonBase>
            );
          })}
        </Stack>
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

function MarkEditor({
  point,
  index,
  autoFocus,
  onQtyChange,
  onRemove,
  onClose,
}: {
  point: ApplicationMapPoint;
  index: number;
  autoFocus: boolean;
  onQtyChange: (qty: number | undefined) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const product = productDef(point.product);
  const [text, setText] = useState(point.qty !== undefined ? formatQty(point.qty) : '');
  /** Perto do topo o editor abre abaixo do ponto para não ser cortado. */
  const below = point.y < 28;

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
      sx={{
        position: 'absolute',
        left: `${Math.min(Math.max(point.x, 18), 82)}%`,
        top: below ? `calc(${point.y}% + 14px)` : `calc(${point.y}% - 14px)`,
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
          sx={{ width: 22, height: 22, borderRadius: '7px', bgcolor: 'grey.100', color: 'text.disabled' }}
        >
          <CloseIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Stack>
      {point.note && (
        <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', mb: 1, lineHeight: 1.35 }}>
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
            sx={{ flex: 1, minWidth: 0, fontSize: fontSizes.md, fontWeight: 700 }}
          />
          {product && (
            <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.disabled', fontWeight: 700 }}>
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
