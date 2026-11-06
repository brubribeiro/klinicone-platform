import * as THREE from 'three';

import type { ApplicationMapPoint, ApplicationMapStroke } from '../../../types';
import { formatQty, pointView, productDef, type Model3DView } from '../applicationMapModel';
import { buildBodyModel } from './body';
import type { SurfaceModel } from './common';
import { buildHeadModel } from './head';

export function buildModel(view: Model3DView): SurfaceModel {
  return view === 'head3d' ? buildHeadModel() : buildBodyModel();
}

const markerTextures = new Map<string, THREE.CanvasTexture>();

/** Desenho do ponto (cor do produto, borda branca, dose) numa textura reaproveitada. */
function markerTexture(color: string, label: string, selected: boolean, applicator: boolean) {
  const key = `${color}|${label}|${selected}|${applicator}`;
  let tex = markerTextures.get(key);
  if (tex) return tex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = applicator ? size * 2 : size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const r = size * 0.36;
  ctx.beginPath();
  if (applicator) ctx.roundRect(w / 2 - r * 2, size / 2 - r * 1.3, r * 4, r * 2.6, r * 0.8);
  else ctx.arc(w / 2, size / 2, r, 0, Math.PI * 2);
  if (selected) {
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = `${color}77`;
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = size * 0.07;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${size * (label.length > 3 ? 0.27 : 0.36)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, size / 2 + size * 0.02);
  }
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  markerTextures.set(key, tex);
  return tex;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Plano do ponto deitado na superfície, com o "para cima" do desenho alinhado ao do modelo. */
function placeOnSurface(obj: THREE.Object3D, position: THREE.Vector3, normal: THREE.Vector3, lift: number) {
  obj.position.copy(position).addScaledVector(normal, lift);
  const up = Math.abs(normal.dot(UP)) > 0.95 ? new THREE.Vector3(0, 0, -1) : UP;
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), normal, up);
  // lookAt aponta -z para o alvo; o plano olha para +z.
  obj.quaternion.setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI));
}

/** Pontos e traços sobre o modelo: refeitos a cada mudança (poucos objetos). */
export class MarksLayer {
  readonly group = new THREE.Group();
  private planes = new Map<string, THREE.PlaneGeometry>();

  constructor(
    private model: SurfaceModel,
    private view: Model3DView,
  ) {}

  private plane(applicator: boolean) {
    const key = String(applicator);
    let g = this.planes.get(key);
    if (!g) {
      const d = this.model.pointRadius * 2.8;
      g = new THREE.PlaneGeometry(applicator ? d * 2 : d, d);
      this.planes.set(key, g);
    }
    return g;
  }

  private clear() {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      const mesh = child as THREE.Mesh;
      if (mesh.userData.ownGeometry) mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }

  update(points: ApplicationMapPoint[], strokes: ApplicationMapStroke[], selected: number | null, draft?: DraftStroke) {
    this.clear();
    points.forEach((p, index) => {
      if (pointView(p) !== this.view) return;
      const at = this.model.pointAt(p.x, p.y);
      if (!at) return;
      const applicator = p.product === 'cryolipolysis';
      const material = new THREE.MeshBasicMaterial({
        map: markerTexture(
          productDef(p.product)?.color ?? '#5C6F6B',
          p.qty !== undefined ? formatQty(p.qty) : '',
          index === selected,
          applicator,
        ),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      });
      const mesh = new THREE.Mesh(this.plane(applicator), material);
      placeOnSurface(mesh, at.position, at.normal, this.model.pointRadius * 0.35);
      mesh.renderOrder = 2;
      this.group.add(mesh);
    });
    for (const s of strokes) if (s.view === this.view) this.addStroke(s.points, s.color, s.width);
    if (draft) this.addStroke(draft.points, draft.color, draft.width);
  }

  private addStroke(coords: number[], color: string, width: number) {
    const radius = Math.max(0.002, (width / 100) * this.model.scale) / 2;
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
    // Pontos na superfície, um pouco acima dela; um salto grande (costura, outra parte do corpo) quebra o traço.
    let run: THREE.Vector3[] = [];
    const flush = () => {
      if (run.length === 1) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.2, 12, 8), material);
        dot.position.copy(run[0]);
        dot.userData.ownGeometry = true;
        this.group.add(dot);
      } else if (run.length > 1) {
        const path = new THREE.CatmullRomCurve3(run, false, 'centripetal');
        const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.min(600, run.length * 3), radius, 6), material);
        tube.userData.ownGeometry = true;
        this.group.add(tube);
      }
      run = [];
    };
    const jump = this.model.scale * 0.08;
    for (let i = 0; i + 1 < coords.length; i += 2) {
      const at = this.model.pointAt(coords[i], coords[i + 1]);
      if (!at) continue;
      const p = at.position.clone().addScaledVector(at.normal, radius * 0.6);
      if (run.length && run[run.length - 1].distanceTo(p) > jump) flush();
      run.push(p);
    }
    flush();
  }

  dispose() {
    this.clear();
    this.planes.forEach((g) => g.dispose());
  }
}

export interface DraftStroke {
  points: number[];
  color: string;
  width: number;
}

export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf3e6df, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(1.2, 1.6, 2.4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.45);
  rim.position.set(-2, 0.4, -1);
  scene.add(rim);
}
