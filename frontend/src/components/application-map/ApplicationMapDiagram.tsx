import type { MouseEvent } from 'react';
import { Box, alpha, useTheme } from '@mui/material';

import type { ApplicationMapPoint } from '../../types';

const VIEW_W = 200;
const VIEW_H = 260;

/** Contorno frontal do rosto e pescoço (traço único, sem preenchimento além da pele). */
const FACE_PATHS = {
  head: 'M100 22 C148 22 166 60 165 108 C164 158 140 202 100 212 C60 202 36 158 35 108 C34 60 52 22 100 22 Z',
  ears: ['M36 98 C22 94 20 126 38 136', 'M164 98 C178 94 180 126 162 136'],
  neck: ['M74 200 C74 220 72 236 66 256', 'M126 200 C126 220 128 236 134 256'],
  hair: 'M42 82 C46 46 70 30 100 30 C130 30 154 46 158 82',
  brows: ['M56 88 Q72 79 89 86', 'M111 86 Q128 79 144 88'],
  eyes: ['M58 104 Q73 94 88 104 Q73 112 58 104 Z', 'M112 104 Q127 94 142 104 Q127 112 112 104 Z'],
  nose: 'M96 110 C95 126 88 136 90 143 Q100 150 110 143 C112 136 105 126 104 110',
  lips: [
    'M80 170 Q90 162 100 166 Q110 162 120 170',
    'M80 170 Q100 175 120 170',
    'M81 171 Q100 187 119 171',
  ],
};

export function ApplicationMapDiagram({
  points,
  width = 240,
  selectedIndex,
  onAdd,
  onSelect,
}: {
  points: ApplicationMapPoint[];
  width?: number | string;
  selectedIndex?: number | null;
  /** Ao informar, clicar no desenho marca um ponto (x/y em %). */
  onAdd?: (point: { x: number; y: number }) => void;
  onSelect?: (index: number) => void;
}) {
  const theme = useTheme();
  const stroke = alpha(theme.palette.text.primary, 0.45);
  const editable = !!onAdd;

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onAdd) return;
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
      component="svg"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={`Mapa de aplicação do rosto com ${points.length} ponto(s) marcado(s)`}
      onClick={handleClick}
      sx={{
        display: 'block',
        width,
        maxWidth: '100%',
        height: 'auto',
        flexShrink: 0,
        borderRadius: '14px',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'grey.50',
        cursor: editable ? 'crosshair' : 'default',
        userSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      <g fill="none" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <path d={FACE_PATHS.head} fill={alpha(theme.palette.primary.main, 0.05)} />
        {FACE_PATHS.ears.map((d) => <path key={d} d={d} />)}
        {FACE_PATHS.neck.map((d) => <path key={d} d={d} />)}
        <path d={FACE_PATHS.hair} strokeDasharray="3 4" opacity={0.6} />
        {FACE_PATHS.brows.map((d) => <path key={d} d={d} strokeWidth={2} />)}
        {FACE_PATHS.eyes.map((d) => <path key={d} d={d} />)}
        <circle cx={73} cy={103.5} r={3.6} fill={stroke} stroke="none" />
        <circle cx={127} cy={103.5} r={3.6} fill={stroke} stroke="none" />
        <path d={FACE_PATHS.nose} />
        {FACE_PATHS.lips.map((d) => <path key={d} d={d} />)}
      </g>

      {points.map((p, i) => {
        const selected = selectedIndex === i;
        return (
          <g
            key={i}
            transform={`translate(${(p.x / 100) * VIEW_W} ${(p.y / 100) * VIEW_H})`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(i);
            }}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
          >
            {selected && <circle r={9.5} fill="none" stroke={theme.palette.primary.main} strokeWidth={1.5} />}
            <circle r={6.5} fill={theme.palette.primary.main} stroke="#fff" strokeWidth={1.2} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={i >= 9 ? 6 : 7.5}
              fontWeight={800}
              fill="#fff"
              style={{ pointerEvents: 'none' }}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </Box>
  );
}
