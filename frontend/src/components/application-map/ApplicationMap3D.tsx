import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { fontSizes } from '../../theme/fontSizes';
import type { ApplicationMapPoint, ApplicationMapRegion, ApplicationMapStroke } from '../../types';
import { MarkEditor, type MapTool } from './ApplicationMapCanvas';
import { pointView, type Model3DView } from './applicationMapModel';
import type { SurfaceModel } from './model3d/common';
import { MarksLayer, addLights, buildModel, type DraftStroke } from './model3d/scene';

/** Giro entre as vistas desenhadas: frente, ¾ e perfis (não há ilustração das costas). */
const PRESETS: Record<Model3DView, { label: string; azimuth: number }[]> = {
  head3d: [
    { label: 'Perfil dir.', azimuth: -Math.PI / 2 },
    { label: '¾ dir.', azimuth: -Math.PI / 4 },
    { label: 'Frente', azimuth: 0 },
    { label: '¾ esq.', azimuth: Math.PI / 4 },
    { label: 'Perfil esq.', azimuth: Math.PI / 2 },
  ],
  body3d: [
    { label: 'Lado dir.', azimuth: -Math.PI / 2 },
    { label: '¾ dir.', azimuth: -Math.PI / 4 },
    { label: 'Frente', azimuth: 0 },
    { label: '¾ esq.', azimuth: Math.PI / 4 },
    { label: 'Lado esq.', azimuth: Math.PI / 2 },
  ],
};

const LABEL: Record<Model3DView, string> = {
  head3d: 'Modelo 3D ilustrado da cabeça',
  body3d: 'Modelo 3D ilustrado do corpo',
};

/**
 * Modelo 3D genérico (as ilustrações 2D do mapa em volume, iguais para todas as pacientes) da
 * cabeça ou do corpo, girável entre as vistas desenhadas,
 * com pontos e desenho livre sobre a superfície. As marcações são gravadas em % da textura
 * do modelo (vistas `head3d` e `body3d`).
 */
export default function ApplicationMap3D({
  view,
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
  onUnavailable,
}: {
  view: Model3DView;
  points: ApplicationMapPoint[];
  strokes: ApplicationMapStroke[];
  tool: MapTool;
  strokeColor: string;
  strokeWidth: number;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onAdd: (point: { x: number; y: number; region?: ApplicationMapRegion }) => void;
  onQtyChange: (index: number, qty: number | undefined) => void;
  onRemove: (index: number) => void;
  onAddStroke: (stroke: ApplicationMapStroke) => void;
  onRemoveStroke: (index: number) => void;
  height: string | number;
  autoFocusQty: boolean;
  toolbar?: ReactNode;
  onUnavailable: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    model: SurfaceModel;
    render: () => void;
    paint: () => void;
  } | null>(null);
  /** Estado mais recente para os handlers do canvas, registrados uma vez só. */
  const latest = useRef({
    points,
    strokes,
    tool,
    strokeColor,
    strokeWidth,
    selectedIndex,
    onSelect,
    onAdd,
    onRemove,
    onAddStroke,
    onRemoveStroke,
  });
  latest.current = {
    points,
    strokes,
    tool,
    strokeColor,
    strokeWidth,
    selectedIndex,
    onSelect,
    onAdd,
    onRemove,
    onAddStroke,
    onRemoveStroke,
  };

  useEffect(() => {
    const host = hostRef.current!;
    setFailed(false);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      console.warn('[ApplicationMap3D] WebGL indisponível', err);
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const canvasEl = renderer.domElement;
    canvasEl.style.display = 'block';
    canvasEl.style.touchAction = 'none';

    const model = buildModel(view);
    const scene = new THREE.Scene();
    scene.add(model.group);
    addLights(scene);
    const marks = new MarksLayer(model, view);
    scene.add(marks.group);

    const cam = model.camera;
    const camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.05, 100);
    camera.position.set(cam.target.x, cam.target.y, cam.target.z + cam.distance);
    const pointRadius = model.pointRadius;
    let draft: DraftStroke | null = null;

    const raycaster = new THREE.Raycaster();
    const pickables = model.group.children.filter((o) => !o.userData.outline);
    /** Ponto do modelo sob o cursor; cabelo, mãos etc. na frente bloqueiam. */
    const hitModel = (clientX: number, clientY: number) => {
      const rect = canvasEl.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      if (!hit || !hit.uv || !model.markable.includes(hit.object as THREE.Mesh)) return null;
      return { x: round2(hit.uv.x * 100), y: round2((1 - hit.uv.y) * 100), world: hit.point.clone() };
    };

    const render = () => renderer.render(scene, camera);
    const paint = () => {
      const cur = latest.current;
      marks.update(cur.points, cur.strokes, cur.selectedIndex, draft ?? undefined);
      render();
    };

    const controls = new OrbitControls(camera, canvasEl);
    controls.target.copy(cam.target);
    controls.enablePan = false;
    controls.rotateSpeed = 0.5;
    controls.minDistance = cam.minDistance;
    controls.maxDistance = cam.maxDistance;
    // A arte é desenhada na altura dos olhos: inclinar muito mostraria o que ela não tem.
    controls.minPolarAngle = Math.PI / 2 - 0.22;
    controls.maxPolarAngle = Math.PI / 2 + 0.22;
    if (cam.maxAzimuth !== undefined) {
      controls.minAzimuthAngle = -cam.maxAzimuth;
      controls.maxAzimuthAngle = cam.maxAzimuth;
    }
    controls.update();
    controls.addEventListener('change', render);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const worldOf = (x: number, y: number) => model.pointAt(x, y)?.position;
    const nearestPoint = (at: THREE.Vector3, max: number) => {
      let best: number | null = null;
      let bestDist = max;
      latest.current.points.forEach((p, i) => {
        if (pointView(p) !== view) return;
        const d = worldOf(p.x, p.y)?.distanceTo(at) ?? Infinity;
        if (d <= bestDist) {
          best = i;
          bestDist = d;
        }
      });
      return best;
    };
    const nearestStroke = (at: THREE.Vector3, max: number) => {
      let best: number | null = null;
      let bestDist = max;
      latest.current.strokes.forEach((s, i) => {
        if (s.view !== view) return;
        for (let k = 0; k + 1 < s.points.length; k += 2) {
          const d = (worldOf(s.points[k], s.points[k + 1])?.distanceTo(at) ?? Infinity) - (s.width / 200) * model.scale;
          if (d <= bestDist) {
            best = i;
            bestDist = d;
          }
        }
      });
      return best;
    };

    // Clique marca/apaga e arrastar gira; no desenho, arrastar sobre a pele desenha e fora dela
    // (ou com o botão direito) gira.
    let down: { x: number; y: number; id: number; last?: THREE.Vector3 } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const hit = hitModel(e.clientX, e.clientY);
      if (!hit) return;
      down = { x: e.clientX, y: e.clientY, id: e.pointerId, last: hit.world };
      if (latest.current.tool === 'draw') {
        controls.enabled = false;
        canvasEl.setPointerCapture(e.pointerId);
        draft = {
          points: [round1(hit.x), round1(hit.y)],
          color: latest.current.strokeColor,
          width: latest.current.strokeWidth,
        };
        paint();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id || !draft) return;
      const hit = hitModel(e.clientX, e.clientY);
      if (!hit || draft.points.length >= 1000) return;
      if (down.last && down.last.distanceTo(hit.world) < model.scale * 0.004) return;
      down.last = hit.world;
      draft.points.push(round1(hit.x), round1(hit.y));
      paint();
    };
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5;
      down = null;
      controls.enabled = true;
      const cur = latest.current;
      if (draft) {
        const stroke = draft;
        draft = null;
        cur.onAddStroke({ view, color: stroke.color, width: stroke.width, points: stroke.points });
        return;
      }
      if (moved) return;
      const hit = hitModel(e.clientX, e.clientY);
      if (!hit) return;
      const near = nearestPoint(hit.world, pointRadius * 1.6);
      if (cur.tool === 'point') {
        if (near !== null) cur.onSelect(near);
        else cur.onAdd({ x: hit.x, y: hit.y, region: model.regionAt?.(hit.x, hit.y) });
      } else if (cur.tool === 'erase') {
        if (near !== null) cur.onRemove(near);
        else {
          const stroke = nearestStroke(hit.world, model.scale * 0.02);
          if (stroke !== null) cur.onRemoveStroke(stroke);
        }
      }
    };
    const onContext = (e: Event) => e.preventDefault();
    canvasEl.addEventListener('pointerdown', onDown, { capture: true });
    canvasEl.addEventListener('pointermove', onMove);
    canvasEl.addEventListener('pointerup', onUp);
    canvasEl.addEventListener('contextmenu', onContext);

    sceneRef.current = { camera, controls, model, render, paint };
    resize();
    paint();
    let disposed = false;
    // As ilustrações que pintam o modelo chegam depois: redesenha quando carregarem.
    model.ready?.then(() => {
      if (!disposed) render();
    });

    return () => {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      canvasEl.removeEventListener('pointerdown', onDown, { capture: true });
      canvasEl.removeEventListener('pointermove', onMove);
      canvasEl.removeEventListener('pointerup', onUp);
      canvasEl.removeEventListener('contextmenu', onContext);
      marks.dispose();
      model.dispose();
      renderer.dispose();
      canvasEl.remove();
      sceneRef.current = null;
    };
  }, [view]);

  // Redesenha as marcações quando pontos, traços ou a seleção mudam.
  useEffect(() => {
    sceneRef.current?.paint();
  }, [points, strokes, selectedIndex]);

  const rotateTo = (azimuth: number) => {
    const s = sceneRef.current;
    if (!s) return;
    const { target } = s.model.camera;
    const distance = s.camera.position.distanceTo(s.controls.target);
    s.camera.position.set(
      target.x + Math.sin(azimuth) * distance,
      target.y,
      target.z + Math.cos(azimuth) * distance,
    );
    s.controls.target.copy(target);
    s.controls.update();
    s.render();
  };

  const selected = selectedIndex !== null ? points[selectedIndex] : undefined;

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        width: '100%',
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
        overflow: 'hidden',
        bgcolor: '#fff',
      }}
    >
      <Box
        ref={hostRef}
        role="img"
        aria-label={LABEL[view]}
        sx={{
          position: 'absolute',
          inset: 0,
          cursor: tool === 'erase' ? 'cell' : 'crosshair',
        }}
      />

      {failed && (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1.5}
          sx={{ position: 'absolute', inset: 0, p: 3, textAlign: 'center' }}
        >
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', maxWidth: 360 }}>
            Não foi possível abrir o modelo 3D neste navegador.
          </Typography>
          <Button variant="outlined" onClick={onUnavailable}>
            Usar a ilustração 2D
          </Button>
        </Stack>
      )}

      {toolbar && (
        <Box
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

      {!failed && (
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          flexWrap="wrap"
          sx={{ position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 4, pointerEvents: 'none' }}
        >
          {PRESETS[view].map((p) => (
            <Button
              key={p.label}
              size="small"
              variant="outlined"
              onClick={() => rotateTo(p.azimuth)}
              sx={{
                minWidth: 0,
                px: 1.25,
                bgcolor: 'background.paper',
                fontSize: fontSizes['2xs'],
                fontWeight: 700,
                pointerEvents: 'auto',
                '&:hover': { bgcolor: 'background.paper' },
              }}
            >
              {p.label}
            </Button>
          ))}
        </Stack>
      )}

      {selected && selectedIndex !== null && pointView(selected) === view && (
        <MarkEditor
          key={selectedIndex}
          point={selected}
          position={{ x: 50, y: 86 }}
          index={selectedIndex}
          autoFocus={autoFocusQty}
          onQtyChange={(qty) => onQtyChange(selectedIndex, qty)}
          onRemove={() => onRemove(selectedIndex)}
          onClose={() => onSelect(null)}
        />
      )}
    </Box>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
