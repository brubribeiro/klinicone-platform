import * as THREE from 'three';

import type { ApplicationMapPoint, ApplicationMapStroke } from '../../../types';
import { pointView, type Model3DView } from '../applicationMapModel';
import type { SurfaceModel } from './common';
import { MarksLayer, addLights, buildModel } from './scene';

/** Um renderizador para todas as miniaturas (evita estourar o limite de contextos WebGL). */
let shared: {
  renderer: THREE.WebGLRenderer;
  scenes: Partial<Record<Model3DView, { scene: THREE.Scene; model: SurfaceModel; marks: MarksLayer }>>;
} | null = null;

function setup(view: Model3DView) {
  shared ??= {
    renderer: new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }),
    scenes: {},
  };
  shared.renderer.outputColorSpace = THREE.SRGBColorSpace;
  let entry = shared.scenes[view];
  if (!entry) {
    const model = buildModel(view);
    const scene = new THREE.Scene();
    scene.add(model.group);
    addLights(scene);
    const marks = new MarksLayer(model, view);
    scene.add(marks.group);
    entry = { scene, model, marks };
    shared.scenes[view] = entry;
  }
  return { renderer: shared.renderer, ...entry };
}

/** Resolve quando as ilustrações do modelo carregaram (as miniaturas esperam por elas). */
export function snapshotReady(view: Model3DView): Promise<void> {
  return setup(view).model.ready ?? Promise.resolve();
}

/** Miniatura (data URL) do modelo 3D com as marcações, vista do ângulo pedido. */
export function renderSnapshot(
  view: Model3DView,
  points: ApplicationMapPoint[],
  strokes: ApplicationMapStroke[],
  azimuth: number,
  width: number,
  height: number,
): string {
  const { renderer, scene, model, marks } = setup(view);
  renderer.setPixelRatio(2);
  renderer.setSize(width, height, false);
  marks.update(points, strokes, null);
  const { target, fov } = model.camera;
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.05, 100);
  // Miniatura um pouco mais justa que o editor.
  const distance = model.camera.distance * 0.92;
  camera.position.set(target.x + Math.sin(azimuth) * distance, target.y, target.z + Math.cos(azimuth) * distance);
  camera.lookAt(target);
  renderer.setClearColor(0xffffff, 1);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

/**
 * Ângulos das miniaturas: sempre a frente, mais o perfil de cada lado que tem marcação virada
 * para ele (pela normal da superfície no ponto; costas aparecem no perfil do mesmo lado).
 */
export function snapshotAngles(
  view: Model3DView,
  points: ApplicationMapPoint[],
  strokes: ApplicationMapStroke[],
): number[] {
  const { model } = setup(view);
  const coords: [number, number][] = [
    ...points.filter((p) => pointView(p) === view).map((p) => [p.x, p.y] as [number, number]),
    ...strokes
      .filter((s) => s.view === view && s.points.length >= 2)
      .map((s) => [s.points[0], s.points[1]] as [number, number]),
  ];
  const angles = new Set<number>([0]);
  for (const [x, y] of coords) {
    const n = model.pointAt(x, y)?.normal;
    if (!n) continue;
    const a = Math.atan2(n.x, n.z);
    if (Math.abs(a) < 0.9) continue;
    angles.add(Math.sign(a) * (Math.PI / 2));
  }
  // Ordem: lado direito da paciente, frente, lado esquerdo.
  return [-Math.PI / 2, 0, Math.PI / 2].filter((a) => angles.has(a));
}
