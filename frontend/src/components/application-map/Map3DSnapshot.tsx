import { useEffect, useState } from 'react';
import { Box } from '@mui/material';

import type { ApplicationMapPoint, ApplicationMapStroke } from '../../types';
import type { Model3DView } from './applicationMapModel';
import { renderSnapshot, snapshotAngles, snapshotReady } from './model3d/snapshot';

const ANGLE_LABEL: Record<number, string> = {
  [-Math.PI / 2]: 'lado direito',
  0: 'frente',
  [Math.PI / 2]: 'lado esquerdo',
};

/** Miniaturas estáticas do modelo 3D com as marcações (ficha da paciente). */
export default function Map3DSnapshot({
  view,
  points,
  strokes,
  label,
  height,
}: {
  view: Model3DView;
  points: ApplicationMapPoint[];
  strokes: ApplicationMapStroke[];
  label: string;
  height: number;
}) {
  const width = Math.round(height * (view === 'head3d' ? 0.8 : 0.6));
  const [images, setImages] = useState<{ angle: number; src: string }[]>([]);
  // As listas chegam novas a cada render da ficha; só redesenha quando o conteúdo muda.
  const marksKey = JSON.stringify([points, strokes]);
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      try {
        setImages(
          snapshotAngles(view, points, strokes).map((angle) => ({
            angle,
            src: renderSnapshot(view, points, strokes, angle, width, height),
          })),
        );
      } catch (err) {
        console.warn('[Map3DSnapshot] WebGL indisponível', err);
        setImages([]);
      }
    };
    // Desenha só depois que as ilustrações que pintam o modelo carregaram.
    try {
      snapshotReady(view).then(draw);
    } catch (err) {
      console.warn('[Map3DSnapshot] WebGL indisponível', err);
      setImages([]);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, marksKey, width, height]);

  return (
    <>
      {images.map(({ angle, src }) => (
        <Box
          key={angle}
          role="img"
          aria-label={`Mapa de aplicação: ${label}, ${ANGLE_LABEL[angle]}`}
          sx={{
            height,
            width,
            bgcolor: '#fff',
            border: 1,
            borderColor: 'divider',
            borderRadius: '10px',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Box component="img" src={src} alt="" sx={{ display: 'block', width: '100%', height: '100%' }} />
        </Box>
      ))}
    </>
  );
}
