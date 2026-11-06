import * as THREE from 'three';

import type { ApplicationMapRegion } from '../../../types';
import {
  HAIR,
  SKIN,
  curve,
  disposeGroup,
  gauss,
  outlineMesh,
  parametricGeometry,
  skinTexture,
  smoothstep,
  surfaceNormal,
  toonMaterial,
  type SurfaceModel,
} from './common';

/**
 * Corpo ilustrado genérico (vista `body3d`) para criolipólise: manequim feito de partes
 * paramétricas (tronco, cabeça, braços, pernas), cada uma numa faixa vertical da textura.
 * x dá a volta na parte (frente no meio da faixa), y desce do topo à ponta.
 */

type PartId = 'torso' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';

interface Part {
  id: PartId;
  /** Faixa da textura (x0, largura) em fração. */
  box: { x: number; w: number };
  fn: (u: number, t: number, out: THREE.Vector3) => void;
}

const TEX = 2048;
const SHORTS = '#cdb08e';

/** Arredonda as pontas: raio → 0 nas extremidades. */
const cap = (t: number, a: number, b = a) =>
  Math.sqrt(Math.max(0, 1 - Math.max(0, (a - t) / a) ** 2)) *
  Math.sqrt(Math.max(0, 1 - Math.max(0, (t - (1 - b)) / b) ** 2));

// Tronco: do pescoço (topo) ao gancho, meia-largura e profundidades frente/costas pela altura.
const TORSO_TOP = 5.62;
const TORSO_BOTTOM = 3.0;
const TORSO_RX: [number, number][] = [
  [3.0, 0.5],
  [3.2, 0.7],
  [3.5, 0.8],
  [3.9, 0.69],
  [4.15, 0.59],
  [4.5, 0.62],
  [4.85, 0.66],
  [5.12, 0.74],
  [5.3, 0.55],
  [5.42, 0.21],
  [5.62, 0.19],
];
const TORSO_FRONT: [number, number][] = [
  [3.0, 0.4],
  [3.3, 0.45],
  [3.6, 0.47],
  [3.9, 0.42],
  [4.15, 0.36],
  [4.5, 0.39],
  [4.85, 0.44],
  [5.15, 0.4],
  [5.3, 0.3],
  [5.42, 0.2],
  [5.62, 0.19],
];
const TORSO_BACK: [number, number][] = [
  [3.0, 0.4],
  [3.35, 0.55],
  [3.6, 0.5],
  [3.9, 0.36],
  [4.15, 0.32],
  [4.5, 0.35],
  [4.85, 0.38],
  [5.15, 0.38],
  [5.3, 0.3],
  [5.42, 0.2],
  [5.62, 0.19],
];

function torsoFn(u: number, t: number, out: THREE.Vector3) {
  const a = (u - 0.5) * Math.PI * 2;
  const y = TORSO_TOP - t * (TORSO_TOP - TORSO_BOTTOM);
  const k = cap(1 - t, 0.06, 0.0001);
  const rx = curve(TORSO_RX, y) * k;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = rx * s;
  let z = (c >= 0 ? curve(TORSO_FRONT, y) : curve(TORSO_BACK, y)) * c * k;
  // Busto e glúteos discretos.
  if (c > 0) z += 0.1 * c * gauss(Math.abs(x), y, 0.3, 4.86, 0.19, 0.17);
  else z += 0.08 * c * gauss(Math.abs(x), y, 0.3, 3.42, 0.22, 0.2);
  out.set(x, y, z - 0.02);
}

function headFn(u: number, t: number, out: THREE.Vector3) {
  const a = (u - 0.5) * Math.PI * 2;
  const top = 6.42;
  const bottom = 5.5;
  const y = top - t * (top - bottom);
  const k = cap(t, 0.32, 0.22);
  const jaw = smoothstep(0.55, 1, t);
  const rx = 0.33 * k * (1 - 0.18 * jaw);
  const c = Math.cos(a);
  const z = (c >= 0 ? 0.37 : 0.4) * k * c + 0.06 * jaw - 0.03;
  // Nariz discreto de manequim.
  const nose = c > 0.9 ? 0.05 * gauss(rx * Math.sin(a), y, 0, 5.88, 0.05, 0.07) : 0;
  out.set(rx * Math.sin(a), y, z + nose);
}

function limb(
  top: THREE.Vector3,
  bottom: THREE.Vector3,
  radius: (t: number, a: number) => number,
  depth = 0.95,
) {
  const d = bottom.clone().sub(top);
  const len = d.length();
  d.normalize();
  const front = new THREE.Vector3(0, 0, 1).addScaledVector(d, -d.z).normalize();
  const side = new THREE.Vector3().crossVectors(front, d);
  return (u: number, t: number, out: THREE.Vector3) => {
    const a = (u - 0.5) * Math.PI * 2;
    const r = radius(t, a);
    out
      .copy(top)
      .addScaledVector(d, t * len)
      .addScaledVector(side, r * Math.sin(a))
      .addScaledVector(front, r * depth * Math.cos(a));
  };
}

const LEG_R: [number, number][] = [
  [0, 0.4],
  [0.05, 0.44],
  [0.16, 0.41],
  [0.34, 0.31],
  [0.47, 0.235],
  [0.53, 0.235],
  [0.62, 0.26],
  [0.78, 0.2],
  [0.93, 0.135],
  [1, 0.13],
];

const ARM_R: [number, number][] = [
  [0, 0.19],
  [0.08, 0.205],
  [0.3, 0.165],
  [0.47, 0.13],
  [0.6, 0.145],
  [0.9, 0.1],
  [1, 0.095],
];

function legFn(side: 1 | -1) {
  return limb(new THREE.Vector3(0.38 * side, 3.55, 0), new THREE.Vector3(0.3 * side, 0.32, 0.02), (t, a) => {
    // Culote: volume na lateral de trás da coxa.
    const lateral = Math.max(0, Math.sin(a) * side) * Math.max(0, 0.4 - 0.6 * Math.cos(a));
    return curve(LEG_R, t) * cap(t, 0.0001, 0.03) + 0.07 * lateral * gauss(t, 0, 0.15, 0, 0.09, 1);
  });
}

function armFn(side: 1 | -1) {
  return limb(
    new THREE.Vector3(0.8 * side, 5.14, -0.03),
    new THREE.Vector3(1.32 * side, 3.28, 0.08),
    (t) => curve(ARM_R, t) * cap(t, 0.1, 0.02),
  );
}

const PARTS: Part[] = [
  { id: 'torso', box: { x: 0, w: 0.4 }, fn: torsoFn },
  { id: 'head', box: { x: 0.4, w: 0.1 }, fn: headFn },
  { id: 'armR', box: { x: 0.5, w: 0.125 }, fn: armFn(-1) },
  { id: 'armL', box: { x: 0.625, w: 0.125 }, fn: armFn(1) },
  { id: 'legR', box: { x: 0.75, w: 0.125 }, fn: legFn(-1) },
  { id: 'legL', box: { x: 0.875, w: 0.125 }, fn: legFn(1) },
];

function partAt(x: number): Part {
  const u = x / 100;
  return PARTS.find((p) => u >= p.box.x && u <= p.box.x + p.box.w + 1e-9) ?? PARTS[0];
}

function paintBodyTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEX;
  canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = SKIN;
  ctx.fillRect(0, 0, TEX, TEX);
  const band = (part: PartId, t0: number, t1: number, color: string) => {
    const p = PARTS.find((q) => q.id === part)!;
    ctx.fillStyle = color;
    ctx.fillRect(p.box.x * TEX, t0 * TEX, p.box.w * TEX, (t1 - t0) * TEX);
  };
  const torsoT = (y: number) => (TORSO_TOP - y) / (TORSO_TOP - TORSO_BOTTOM);
  // Top e short da ilustração 2D.
  band('torso', torsoT(5.02), torsoT(4.66), SHORTS);
  band('torso', torsoT(3.82), 1, SHORTS);
  band('legL', 0, 0.1, SHORTS);
  band('legR', 0, 0.1, SHORTS);
  ctx.strokeStyle = 'rgba(120,90,60,.35)';
  ctx.lineWidth = 4;
  for (const y of [5.02, 4.66, 3.82]) {
    ctx.beginPath();
    ctx.moveTo(0, torsoT(y) * TEX);
    ctx.lineTo(0.4 * TEX, torsoT(y) * TEX);
    ctx.stroke();
  }
  // Umbigo.
  ctx.fillStyle = 'rgba(150,100,85,.6)';
  ctx.beginPath();
  ctx.ellipse(0.2 * TEX, torsoT(3.98) * TEX, 7, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Olhos fechados e boca, só para orientar a frente.
  const head = PARTS.find((p) => p.id === 'head')!;
  const hx = (head.box.x + head.box.w / 2) * TEX;
  const ht = (y: number) => ((6.42 - y) / 0.92) * TEX;
  ctx.strokeStyle = 'rgba(90,64,56,.8)';
  ctx.lineWidth = 4;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + s * 14, ht(5.98));
    ctx.quadraticCurveTo(hx + s * 26, ht(5.96), hx + s * 38, ht(5.98));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(166,94,90,.8)';
  ctx.beginPath();
  ctx.moveTo(hx - 16, ht(5.73));
  ctx.quadraticCurveTo(hx, ht(5.71), hx + 16, ht(5.73));
  ctx.stroke();
  return canvas;
}

/** Região de criolipólise deduzida da parte e do lado em que o ponto foi marcado. */
function regionAt(x: number, y: number): ApplicationMapRegion | undefined {
  const part = partAt(x);
  const u = (x / 100 - part.box.x) / part.box.w;
  const t = y / 100;
  const a = Math.abs((u - 0.5) * Math.PI * 2);
  if (part.id === 'armL' || part.id === 'armR') return 'arms';
  if (part.id === 'head') return t > 0.72 ? 'submental' : undefined;
  if (part.id === 'legL' || part.id === 'legR') {
    if (t > 0.5) return undefined;
    return t < 0.22 && a > Math.PI * 0.4 && a < Math.PI * 0.85 ? 'saddlebags' : 'thighs';
  }
  const height = TORSO_TOP - t * (TORSO_TOP - TORSO_BOTTOM);
  if (a > Math.PI * 0.72) return height > 3.75 ? 'back' : undefined;
  if (a > Math.PI * 0.3) return height < 4.5 ? 'flanks' : undefined;
  return height < 4.4 ? 'abdomen' : undefined;
}

export function buildBodyModel(): SurfaceModel {
  const group = new THREE.Group();
  const skin = toonMaterial({ map: skinTexture(paintBodyTexture()) });
  const plainSkin = toonMaterial({ color: SKIN });

  const meshes = PARTS.map((p) => {
    const segU = p.id === 'torso' ? 160 : p.id === 'head' ? 64 : 56;
    const segV = p.id === 'torso' ? 160 : p.id.startsWith('leg') ? 140 : 90;
    return new THREE.Mesh(parametricGeometry(p.fn, segU, segV, { x: p.box.x, y: 0, w: p.box.w, h: 1 }), skin);
  });

  const decor: THREE.Mesh[] = [];
  for (const side of [1, -1] as const) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), plainSkin);
    hand.scale.set(0.07, 0.24, 0.13);
    hand.position.set(1.4 * side, 3.06, 0.1);
    hand.rotation.z = 0.28 * side;
    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), plainSkin);
    foot.scale.set(0.13, 0.1, 0.36);
    foot.position.set(0.3 * side, 0.12, 0.16);
    decor.push(hand, foot);
  }
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52),
    toonMaterial({ color: HAIR }),
  );
  hair.position.set(0, 6.08, -0.05);
  hair.rotation.x = -0.35;
  hair.scale.set(1.02, 1, 1.1);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), toonMaterial({ color: HAIR }));
  bun.position.set(0, 6.3, -0.36);
  decor.push(hair, bun);

  const solids = [...meshes, ...decor];
  group.add(...solids);
  for (const mesh of solids) {
    const outline = outlineMesh(mesh.geometry, 0.018 / Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z));
    outline.position.copy(mesh.position);
    outline.rotation.copy(mesh.rotation);
    outline.scale.copy(mesh.scale);
    group.add(outline);
  }

  const pointAt = (x: number, y: number) => {
    const part = partAt(x);
    const fn = (u: number, t: number, o: THREE.Vector3) => part.fn(u, t, o);
    const u = Math.min(1, Math.max(0, (x / 100 - part.box.x) / part.box.w));
    const t = Math.min(1, Math.max(0, y / 100));
    const position = new THREE.Vector3();
    fn(u, t, position);
    return { position, normal: surfaceNormal(fn, u, t, new THREE.Vector3()) };
  };

  return {
    group,
    markable: meshes,
    pointAt,
    scale: 6,
    pointRadius: 0.1,
    camera: {
      target: new THREE.Vector3(0, 3.25, 0),
      distance: 14.5,
      minDistance: 3.5,
      maxDistance: 20,
      fov: 30,
    },
    regionAt,
    dispose: () => disposeGroup(group),
  };
}
