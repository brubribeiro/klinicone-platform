import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FaceLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

import { fontSizes } from '../../theme/fontSizes';
import type { ApplicationMapPoint, ApplicationMapStroke } from '../../types';
import { MarkEditor, type MapTool } from './ApplicationMapCanvas';
import { formatQty, pointView, productDef, type MapViewDef } from './applicationMapModel';
import { FACE_MESH_TRIANGLES } from './faceMeshTriangles';
import { buildHead, faceBlendWeights, faceMaterial, sampleSkinColor } from './headModel';

/** Vértices da malha canônica (os 10 landmarks seguintes são das íris e ficam de fora). */
const MESH_VERTICES = 468;
const TEXTURE_MAX = 2048;
/** Enquadra a cabeça inteira; o zoom aproxima do rosto para marcar. */
const CAMERA_DISTANCE = 9.5;
const TARGET_Y = 0.45;
/** Raio do ponto em % da largura do rosto na foto. */
const POINT_RADIUS = 1.7;

let landmarkerPromise: Promise<FaceLandmarker> | null = null;
const landmarksCache = new Map<string, NormalizedLandmark[] | null>();

/** Face Landmarker (MediaPipe) roda no navegador; modelo servido de /models, sem serviço externo. */
function getLandmarker() {
  landmarkerPromise ??= FaceLandmarker.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: {
        modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      numFaces: 1,
    },
  );
  landmarkerPromise.catch(() => {
    landmarkerPromise = null;
  });
  return landmarkerPromise;
}

async function detectFace(src: string): Promise<NormalizedLandmark[] | null> {
  if (landmarksCache.has(src)) return landmarksCache.get(src)!;
  const img = new Image();
  img.src = src;
  await img.decode();
  const landmarker = await getLandmarker();
  const face = landmarker.detect(img).faceLandmarks[0];
  const result = face && face.length >= MESH_VERTICES ? face : null;
  landmarksCache.set(src, result);
  return result;
}

const PRESETS = [
  { label: '¾ dir.', azimuth: -0.7 },
  { label: 'Frente', azimuth: 0 },
  { label: '¾ esq.', azimuth: 0.7 },
] as const;

type Status = 'loading' | 'ready' | 'noface' | 'error';

/**
 * Modelo 3D do rosto gerado da foto: os landmarks do MediaPipe viram uma malha com a própria
 * foto como textura. Pontos e traços são gravados nas coordenadas da foto (vista `photo`),
 * por isso aparecem iguais na foto 2D e no 3D.
 */
export default function ApplicationMap3D({
  image,
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
  image: MapViewDef;
  points: ApplicationMapPoint[];
  strokes: ApplicationMapStroke[];
  tool: MapTool;
  strokeColor: string;
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
  toolbar?: ReactNode;
  onUnavailable: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
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
  const draftRef = useRef<number[] | null>(null);
  /** Largura do rosto em % da largura da foto (tamanho dos pontos e da borracha). */
  const faceWidthRef = useRef(40);

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    let cleanup = () => {};
    setStatus('loading');

    (async () => {
      let landmarks: NormalizedLandmark[] | null;
      try {
        landmarks = await detectFace(image.src);
      } catch (err) {
        console.warn('[ApplicationMap3D] detecção do rosto falhou', err);
        if (!disposed) setStatus('error');
        return;
      }
      if (disposed) return;
      if (!landmarks) {
        setStatus('noface');
        return;
      }

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch (err) {
        console.warn('[ApplicationMap3D] WebGL indisponível', err);
        setStatus('error');
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'none';

      // Malha: x/y dos landmarks em pixels da foto, z na mesma escala de x (convenção do MediaPipe).
      const lms = landmarks.slice(0, MESH_VERTICES);
      const xs = lms.map((l) => l.x);
      const ys = lms.map((l) => l.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      faceWidthRef.current = (maxX - minX) * 100;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const zs = lms.map((l) => l.z);
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const scale = 3 / ((maxY - minY) * image.height);
      const positions = new Float32Array(MESH_VERTICES * 3);
      const uvs = new Float32Array(MESH_VERTICES * 2);
      lms.forEach((l, i) => {
        positions[i * 3] = (l.x - cx) * image.width * scale;
        positions[i * 3 + 1] = -(l.y - cy) * image.height * scale;
        positions[i * 3 + 2] = -(l.z - cz) * image.width * scale;
        uvs[i * 2] = l.x;
        uvs[i * 2 + 1] = 1 - l.y;
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(FACE_MESH_TRIANGLES, 1));
      const blend = faceBlendWeights(MESH_VERTICES, FACE_MESH_TRIANGLES);
      geometry.setAttribute('faceMix', new THREE.BufferAttribute(blend, 1));
      geometry.computeVertexNormals();

      // Textura = foto + desenho + pontos, redesenhada a cada mudança.
      const photo = new Image();
      photo.src = image.src;
      await photo.decode();
      if (disposed) {
        renderer.dispose();
        return;
      }
      const texScale = Math.min(1, TEXTURE_MAX / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * texScale);
      canvas.height = Math.round(image.height * texScale);
      const ctx = canvas.getContext('2d')!;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      // Cabeça inteira (crânio, orelhas, pescoço) na cor da pele; a foto fica só no rosto e
      // se mistura a essa cor nas bordas da malha.
      const skin = sampleSkinColor(photo, image.width, image.height, lms);
      const material = faceMaterial(texture, skin);
      const mesh = new THREE.Mesh(geometry, material);
      const head = buildHead(mesh, positions, blend);
      const skinMaterial = new THREE.MeshLambertMaterial({ color: skin });
      const headMeshes = [head.head, head.ears, head.neck].map((g) => new THREE.Mesh(g, skinMaterial));
      const scene = new THREE.Scene();
      scene.add(mesh, ...headMeshes);
      scene.add(new THREE.AmbientLight(0xffffff, 1.7));
      const light = new THREE.DirectionalLight(0xffffff, 1.35);
      light.position.set(0.6, 0.9, 2);
      scene.add(light);
      const fill = new THREE.DirectionalLight(0xffffff, 0.35);
      fill.position.set(-1.5, 0.2, 0.5);
      scene.add(fill);

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, TARGET_Y, CAMERA_DISTANCE);

      const raycaster = new THREE.Raycaster();
      const hitPhoto = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(ndc, camera);
        // Só vale o rosto visível: crânio, orelha ou pescoço na frente bloqueiam.
        const hit = raycaster.intersectObjects([mesh, ...headMeshes], false)[0];
        if (!hit || hit.object !== mesh || !hit.uv) return null;
        return { x: hit.uv.x * 100, y: (1 - hit.uv.y) * 100 };
      };

      const render = () => renderer.render(scene, camera);

      const paint = () => {
        const { points: pts, strokes: sks, selectedIndex: sel } = latest.current;
        const W = canvas.width;
        const H = canvas.height;
        ctx.drawImage(photo, 0, 0, W, H);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const drawLine = (coords: number[], color: string, width: number) => {
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = Math.max(1, (width / 100) * W);
          ctx.beginPath();
          for (let i = 0; i + 1 < coords.length; i += 2) {
            const x = (coords[i] / 100) * W;
            const y = (coords[i + 1] / 100) * H;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          if (coords.length === 2) ctx.lineTo((coords[0] / 100) * W + 0.1, (coords[1] / 100) * H);
          ctx.stroke();
          ctx.globalAlpha = 1;
        };
        sks.forEach((s) => s.view === 'photo' && drawLine(s.points, s.color, s.width));
        const draft = draftRef.current;
        if (draft)
          drawLine(draft, latest.current.strokeColor, (latest.current.strokeWidth * faceWidthRef.current) / 100);

        const r = (POINT_RADIUS / 100) * (faceWidthRef.current / 100) * W;
        pts.forEach((p, index) => {
          if (pointView(p) !== 'photo') return;
          const color = productDef(p.product)?.color ?? '#5C6F6B';
          const x = (p.x / 100) * W;
          const y = (p.y / 100) * H;
          const applicator = p.product === 'cryolipolysis';
          ctx.beginPath();
          if (applicator) ctx.roundRect(x - r * 2, y - r * 1.3, r * 4, r * 2.6, r * 0.8);
          else ctx.arc(x, y, r, 0, Math.PI * 2);
          if (index === sel) {
            ctx.lineWidth = r * 0.9;
            ctx.strokeStyle = `${color}66`;
            ctx.stroke();
          }
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = r * 0.25;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          if (p.qty !== undefined) {
            ctx.fillStyle = '#fff';
            ctx.font = `800 ${r * 1.05}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatQty(p.qty), x, y + r * 0.05);
          }
        });
        texture.needsUpdate = true;
        render();
      };

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, TARGET_Y, 0);
      controls.enablePan = false;
      controls.rotateSpeed = 0.45;
      controls.minDistance = 2.5;
      controls.maxDistance = 12;
      controls.minAzimuthAngle = -1.4;
      controls.maxAzimuthAngle = 1.4;
      controls.minPolarAngle = Math.PI / 2 - 0.9;
      controls.maxPolarAngle = Math.PI / 2 + 0.9;
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

      // Clique/arraste sobre o rosto marca ou desenha; fora dele (ou botão direito) gira o modelo.
      let down: { x: number; y: number; id: number } | null = null;
      const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const hit = hitPhoto(e.clientX, e.clientY);
        if (!hit) return;
        controls.enabled = false;
        down = { x: e.clientX, y: e.clientY, id: e.pointerId };
        renderer.domElement.setPointerCapture(e.pointerId);
        if (latest.current.tool === 'draw') {
          draftRef.current = [round1(hit.x), round1(hit.y)];
          paint();
        }
      };
      const onMove = (e: PointerEvent) => {
        const draft = draftRef.current;
        if (!down || e.pointerId !== down.id || !draft) return;
        const hit = hitPhoto(e.clientX, e.clientY);
        if (!hit || draft.length >= 1000) return;
        const lx = draft[draft.length - 2];
        const ly = draft[draft.length - 1];
        if (Math.hypot(hit.x - lx, ((hit.y - ly) * image.height) / image.width) < faceWidthRef.current * 0.004) return;
        draft.push(round1(hit.x), round1(hit.y));
        paint();
      };
      const onUp = (e: PointerEvent) => {
        if (!down || e.pointerId !== down.id) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5;
        down = null;
        controls.enabled = true;
        const cur = latest.current;
        const draft = draftRef.current;
        if (draft) {
          draftRef.current = null;
          cur.onAddStroke({
            view: 'photo',
            color: cur.strokeColor,
            width: Math.max(0.1, Math.round(cur.strokeWidth * faceWidthRef.current) / 100),
            points: draft,
          });
          return;
        }
        if (moved) return;
        const hit = hitPhoto(e.clientX, e.clientY);
        if (!hit) return;
        const near = nearestPoint(cur.points, hit, image, (POINT_RADIUS * 1.6 * faceWidthRef.current) / 100);
        if (cur.tool === 'point') {
          if (near !== null) cur.onSelect(near);
          else cur.onAdd({ x: round2(hit.x), y: round2(hit.y) });
        } else if (cur.tool === 'erase') {
          if (near !== null) cur.onRemove(near);
          else {
            const stroke = nearestStroke(cur.strokes, hit, image, faceWidthRef.current * 0.02);
            if (stroke !== null) cur.onRemoveStroke(stroke);
          }
        }
      };
      const canvasEl = renderer.domElement;
      canvasEl.addEventListener('pointerdown', onDown, { capture: true });
      canvasEl.addEventListener('pointermove', onMove);
      canvasEl.addEventListener('pointerup', onUp);
      canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

      sceneRef.current = { camera, controls, render, paint };
      resize();
      paint();
      setStatus('ready');

      cleanup = () => {
        observer.disconnect();
        controls.dispose();
        canvasEl.removeEventListener('pointerdown', onDown, { capture: true });
        canvasEl.removeEventListener('pointermove', onMove);
        canvasEl.removeEventListener('pointerup', onUp);
        geometry.dispose();
        material.dispose();
        headMeshes.forEach((m) => m.geometry.dispose());
        skinMaterial.dispose();
        texture.dispose();
        renderer.dispose();
        canvasEl.remove();
        sceneRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [image]);

  // Redesenha a textura quando pontos, traços ou a seleção mudam.
  useEffect(() => {
    sceneRef.current?.paint();
  }, [points, strokes, selectedIndex]);

  const rotateTo = (azimuth: number) => {
    const s = sceneRef.current;
    if (!s) return;
    const distance = s.camera.position.distanceTo(s.controls.target);
    s.camera.position.set(Math.sin(azimuth) * distance, TARGET_Y, Math.cos(azimuth) * distance);
    s.controls.target.set(0, TARGET_Y, 0);
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
        background: 'radial-gradient(circle at 50% 40%, #fff 0%, #EEF2F1 100%)',
      }}
    >
      <Box
        ref={hostRef}
        role="img"
        aria-label="Modelo 3D do rosto gerado a partir da foto"
        sx={{
          position: 'absolute',
          inset: 0,
          cursor: tool === 'erase' ? 'cell' : 'crosshair',
        }}
      />

      {status !== 'ready' && (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1.5}
          sx={{ position: 'absolute', inset: 0, p: 3, textAlign: 'center' }}
        >
          {status === 'loading' ? (
            <>
              <CircularProgress size={28} />
              <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
                Gerando o modelo 3D a partir da foto…
              </Typography>
            </>
          ) : (
            <>
              <Typography
                sx={{
                  fontSize: fontSizes.sm,
                  color: 'text.secondary',
                  maxWidth: 360,
                }}
              >
                {status === 'noface'
                  ? 'Não encontramos um rosto nesta foto. Use uma foto de frente, com o rosto inteiro visível.'
                  : 'Não foi possível gerar o modelo 3D neste navegador.'}
              </Typography>
              <Button variant="outlined" onClick={onUnavailable}>
                Marcar na foto 2D
              </Button>
            </>
          )}
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

      {status === 'ready' && (
        <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', bottom: 12, left: 12, zIndex: 4 }}>
          {PRESETS.map((p) => (
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
              }}
            >
              {p.label}
            </Button>
          ))}
        </Stack>
      )}

      {selected && selectedIndex !== null && pointView(selected) === 'photo' && (
        <MarkEditor
          key={selectedIndex}
          point={selected}
          position={{ x: 50, y: 92 }}
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

/** Distância entre dois pontos em % da largura da foto. */
function photoDistance(a: { x: number; y: number }, b: { x: number; y: number }, image: MapViewDef) {
  return Math.hypot(a.x - b.x, ((a.y - b.y) * image.height) / image.width);
}

function nearestPoint(points: ApplicationMapPoint[], at: { x: number; y: number }, image: MapViewDef, max: number) {
  let best: number | null = null;
  let bestDist = max;
  points.forEach((p, i) => {
    if (pointView(p) !== 'photo') return;
    const d = photoDistance(p, at, image);
    if (d <= bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

function nearestStroke(strokes: ApplicationMapStroke[], at: { x: number; y: number }, image: MapViewDef, max: number) {
  let best: number | null = null;
  let bestDist = max;
  strokes.forEach((s, i) => {
    if (s.view !== 'photo') return;
    for (let k = 0; k + 1 < s.points.length; k += 2) {
      const d = photoDistance({ x: s.points[k], y: s.points[k + 1] }, at, image) - s.width / 2;
      if (d <= bestDist) {
        best = i;
        bestDist = d;
      }
    }
  });
  return best;
}
