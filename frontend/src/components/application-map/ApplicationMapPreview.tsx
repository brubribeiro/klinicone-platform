import { Box, Stack, Typography } from '@mui/material';

import type { ApplicationMap, ApplicationMapView } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import {
  MAP_PRODUCTS,
  MAP_VIEWS,
  formatProductTotal,
  pointView,
  productDef,
  regionDef,
  strokePath,
  type MapViewDef,
} from './applicationMapModel';
import { useMapPhoto } from './useMapPhoto';

const PREVIEW_HEIGHT = 132;
const VIEW_ORDER: ApplicationMapView[] = ['photo', 'front', 'left', 'right', 'body'];

/** Mapa de aplicação do atendimento (somente leitura) para a ficha do paciente. */
export function ApplicationMapPreview({ map, patientId }: { map: ApplicationMap; patientId?: string }) {
  const strokes = map.strokes ?? [];
  const views = VIEW_ORDER.filter(
    (view) => map.points.some((p) => pointView(p) === view) || strokes.some((s) => s.view === view),
  );
  const photo = useMapPhoto(patientId, views.includes('photo') ? map.photoId : undefined);
  const products = MAP_PRODUCTS.filter((product) => map.points.some((p) => p.product === product.id));
  const regions = [...new Set(map.points.flatMap((p) => (p.region ? [p.region] : [])))];
  const notes = map.points.flatMap((p, i) => (p.note ? [{ index: i, note: p.note }] : []));

  return (
    <Box sx={{ mt: 1.25, pt: 1.25, borderTop: 1, borderColor: 'divider' }}>
      <Box
        component="b"
        sx={{
          display: 'block',
          mb: 0.75,
          color: 'text.disabled',
          fontSize: fontSizes['2xs'],
          letterSpacing: '0.3px',
        }}
      >
        MAPA DE APLICAÇÃO · {map.points.length} {map.points.length === 1 ? 'PONTO' : 'PONTOS'}
        {strokes.length > 0 && ` · ${strokes.length} ${strokes.length === 1 ? 'DESENHO' : 'DESENHOS'}`}
      </Box>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" useFlexGap flexWrap="wrap">
        {views.map((view) => {
          const image = view === 'photo' ? photo.image : MAP_VIEWS[view];
          return image ? <PreviewImage key={view} map={map} view={view} image={image} /> : null;
        })}
        <Stack component="ul" spacing={0.4} sx={{ m: 0, p: 0, listStyle: 'none', minWidth: 0 }}>
          {products.map((product) => (
            <Stack key={product.id} component="li" direction="row" alignItems="center" spacing={0.75}>
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: product.color,
                  flexShrink: 0,
                }}
              />
              <Typography
                sx={{
                  fontSize: fontSizes.xs,
                  color: 'text.secondary',
                  lineHeight: 1.45,
                }}
              >
                {product.label} · {map.points.filter((p) => p.product === product.id).length} pts ·{' '}
                {formatProductTotal(product, map.points)}
              </Typography>
            </Stack>
          ))}
          {regions.length > 0 && (
            <Typography
              component="li"
              sx={{
                fontSize: fontSizes.xs,
                color: 'text.secondary',
                lineHeight: 1.45,
              }}
            >
              Regiões: {regions.map((r) => regionDef(r)?.label ?? r).join(', ')}
            </Typography>
          )}
          {notes.map(({ index, note }) => (
            <Typography
              key={index}
              component="li"
              sx={{
                fontSize: fontSizes.xs,
                color: 'text.secondary',
                lineHeight: 1.45,
              }}
            >
              <Box component="b" sx={{ color: 'primary.main', mr: 0.5 }}>
                {index + 1}.
              </Box>
              {note}
            </Typography>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

function PreviewImage({ map, view, image }: { map: ApplicationMap; view: ApplicationMapView; image: MapViewDef }) {
  return (
    <Box
      role="img"
      aria-label={`Mapa de aplicação: ${image.label.toLowerCase()}`}
      sx={{
        position: 'relative',
        height: PREVIEW_HEIGHT,
        aspectRatio: `${image.width} / ${image.height}`,
        bgcolor: '#fff',
        border: 1,
        borderColor: 'divider',
        borderRadius: '10px',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Box component="img" src={image.src} alt="" sx={{ display: 'block', width: '100%', height: '100%' }} />
      <Box
        component="svg"
        viewBox={`0 0 ${image.width} ${image.height}`}
        preserveAspectRatio="none"
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {(map.strokes ?? []).map((s, i) =>
          s.view === view ? (
            <path
              key={i}
              d={strokePath(s.points, image.width, image.height)}
              fill="none"
              stroke={s.color}
              strokeWidth={(s.width * image.width) / 100}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          ) : null,
        )}
      </Box>
      {map.points.map((p, i) =>
        pointView(p) === view ? (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.product === 'cryolipolysis' ? 12 : 8,
              height: 8,
              borderRadius: p.product === 'cryolipolysis' ? '3px' : '50%',
              bgcolor: productDef(p.product)?.color ?? 'text.secondary',
              border: '1.5px solid #fff',
              boxShadow: '0 1px 3px rgba(0,0,0,.35)',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ) : null,
      )}
    </Box>
  );
}
