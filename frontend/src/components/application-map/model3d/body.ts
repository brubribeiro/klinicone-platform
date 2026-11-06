import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import bodySrc from '../../../assets/application-map/corpo.webp';
import type { ApplicationMapRegion } from '../../../types';
import { parametricGeometry, smoothstep, surfaceNormal, type SurfaceModel } from './common';
import { piecewise, projectedSurface } from './projected';
import { BODY_FRONT, BODY_SIDE, SIL_STEP } from './silhouettes';

/**
 * Corpo 3D feito da ilustração corporal 2D (frente e perfil): cada parte (tronco com cabeça,
 * braços, pernas) tem a largura da silhueta de frente e a profundidade da de perfil, e é
 * pintada pela própria arte. O perfil desenhado é o esquerdo; o direito usa o mesmo, espelhado.
 * Marcações em % de um atlas: cada parte numa faixa de x (frente no meio dela), y = altura.
 */

const K = 400;
const IMG = { w: 929, h: 768 };
/** Linha média da figura de frente e eixo do corpo na figura de perfil (px). */
const CX = 214.5;
const Z0 = 705;
const CY = 400;

/** Linhas (px) de referência da ilustração. */
const TOP = 54;
const BOTTOM = 746;
const ARMPIT = 300;
/** Do punho para baixo o braço é a mão: larga de frente, fina de perfil. */
const WRIST = 400;
/** Eixo do braço desenhado no perfil (linha → coluna px): desce do ombro e a mão vem à frente da coxa. */
const ARM_AXIS: [number, number][] = [
  [250, 712],
  [330, 715],
  [400, 697],
  [440, 684],
  [470, 680],
];
/** Cabeça: o rosto é mais estreito que o crânio (frente mais pontuda). */
const HEAD_END = 140;
const FACE_DEPTH = 0.3;
const FACE_WIDTH = 0.035;
/** Topo do ombro: acima da axila o braço encosta no tronco e a silhueta é uma só. */
const ARM_TOP = 205;
const SHOULDER = 240;
const HAND_END = 468;
const CROTCH = 468;
const LEG_TOP = 420;

type PartId = 'torso' | 'armR' | 'armL' | 'legR' | 'legL';

interface PartDef {
  id: PartId;
  box: { x: number; w: number };
  from: number;
  to: number;
}

const PARTS: PartDef[] = [
  { id: 'torso', box: { x: 0, w: 0.4 }, from: TOP, to: CROTCH },
  { id: 'armR', box: { x: 0.4, w: 0.1 }, from: ARM_TOP, to: HAND_END },
  { id: 'armL', box: { x: 0.5, w: 0.1 }, from: ARM_TOP, to: HAND_END },
  { id: 'legR', box: { x: 0.6, w: 0.2 }, from: LEG_TOP, to: BOTTOM },
  { id: 'legL', box: { x: 0.8, w: 0.2 }, from: LEG_TOP, to: BOTTOM },
];

type Interval = [number, number];

const rowOf = (rows: number[][], y: number): Interval[] => {
  const r = rows[Math.min(rows.length - 1, Math.max(0, Math.round(y / SIL_STEP)))] ?? [];
  const out: Interval[] = [];
  for (let i = 0; i + 1 < r.length; i += 2) out.push([r[i], r[i + 1]]);
  return out;
};

const union = (list: Interval[]): Interval | null =>
  list.length ? [Math.min(...list.map((i) => i[0])), Math.max(...list.map((i) => i[1]))] : null;

/** Largura dos braços (px) logo abaixo da axila, onde a silhueta já os separa do tronco. */
let armWidths: { r: number; l: number } | null = null;
function armWidth() {
  if (armWidths) return armWidths;
  const ivs = rowOf(BODY_FRONT, ARMPIT + 4);
  const [r, , l] = ivs.length >= 3 ? ivs : [[0, 34], [], [0, 34]];
  return (armWidths = { r: r[1] - r[0], l: l[1] - l[0] });
}

/** Silhueta inteira na linha `y`, antes de separar tronco e braços. */
function wholeInterval(y: number): Interval | null {
  const ivs = rowOf(BODY_FRONT, y);
  if (!ivs.length) return null;
  if (y >= ARM_TOP && y < ARMPIT) return union(ivs);
  const hit = ivs.find(([a, b]) => a <= CX && b >= CX);
  if (hit) return hit;
  if (y >= ARMPIT) return null;
  return ivs.reduce((best, iv) => (Math.abs((iv[0] + iv[1]) / 2 - CX) < Math.abs((best[0] + best[1]) / 2 - CX) ? iv : best));
}

function torsoInterval(y: number): Interval | null {
  const whole = wholeInterval(y);
  if (!whole || y >= ARMPIT || y <= ARM_TOP) return whole;
  // Entre o ombro e a axila, o tronco é a silhueta sem os braços colados nele.
  const t = smoothstep(ARM_TOP, SHOULDER, y) * 0.9;
  const w = armWidth();
  return [whole[0] + w.r * t, whole[1] - w.l * t];
}

/** Largura da parte na figura de frente (px) na linha `y`. */
function frontInterval(id: PartId, y: number): Interval | null {
  const torso = torsoInterval(y);
  if (id === 'torso') return torso;
  const ivs = rowOf(BODY_FRONT, y);
  if (id === 'armR' || id === 'armL') {
    if (!torso) return null;
    if (y < ARMPIT) {
      const whole = wholeInterval(y)!;
      const w = armWidth();
      return id === 'armR' ? [whole[0], whole[0] + w.r] : [whole[1] - w.l, whole[1]];
    }
    return union(ivs.filter(([a, b]) => (id === 'armR' ? b < torso[0] : a > torso[1])));
  }
  if (y < CROTCH) {
    if (!torso) return null;
    return id === 'legR' ? [torso[0], CX] : [CX, torso[1]];
  }
  // Só os intervalos da perna (as pontas dos dedos ficam na mesma altura, de lado).
  const legs = ivs.filter(([a, b]) => Math.abs((a + b) / 2 - CX) < 95);
  return union(legs.filter(([a, b]) => (id === 'legR' ? (a + b) / 2 < CX : (a + b) / 2 >= CX)));
}

interface PartRows {
  def: PartDef;
  /** Por linha: centro e meia largura em x, centro e meia profundidade em z (cena). */
  xc: number[];
  a: number[];
  zc: number[];
  d: number[];
}

function buildPart(def: PartDef): PartRows {
  const n = Math.round((def.to - def.from) / SIL_STEP);
  const front: (Interval | null)[] = [];
  const side: (Interval | null)[] = [];
  for (let i = 0; i <= n; i++) {
    const y = def.from + i * SIL_STEP;
    front.push(frontInterval(def.id, y));
    side.push(union(rowOf(BODY_SIDE, y)));
  }
  // Linhas sem desenho (ombro do braço, ponta dos dedos) repetem a vizinha.
  const fill = (list: (Interval | null)[]) => {
    const first = list.findIndex(Boolean);
    for (let i = 0; i < list.length; i++) if (!list[i]) list[i] = i < first ? list[first] : list[i - 1];
    return list as Interval[];
  };
  const f = fill(front);
  const s = fill(side);
  const rows: PartRows = { def, xc: [], a: [], zc: [], d: [] };
  for (let i = 0; i <= n; i++) {
    const [x0, x1] = f[i];
    const [z0, z1] = s[i];
    rows.xc.push(((x0 + x1) / 2 - CX) / K);
    rows.a.push((x1 - x0) / 2 / K);
    if (def.id === 'armR' || def.id === 'armL') {
      // O braço fica no meio do perfil e é quase redondo.
      const y = def.from + i * SIL_STEP;
      rows.zc.push((Z0 - piecewise(ARM_AXIS, y)) / K);
      rows.d.push(((x1 - x0) / 2 / K) * (0.95 - 0.5 * smoothstep(WRIST - 20, WRIST + 10, y)));
    } else {
      const y = def.from + i * SIL_STEP;
      // Topo das pernas, ainda dentro do quadril: mais rasas, para não furar o tronco.
      const legTop = def.id === 'legR' || def.id === 'legL' ? 0.7 + 0.3 * smoothstep(LEG_TOP, CROTCH + 24, y) : 1;
      rows.zc.push((Z0 - (z0 + z1) / 2) / K);
      rows.d.push(((z1 - z0) / 2 / K) * legTop);
    }
  }
  // Silhueta extraída da arte tem serrilhado: média móvel de 5 linhas.
  for (const key of ['xc', 'a', 'zc', 'd'] as const) {
    const src = rows[key];
    rows[key] = src.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let k = Math.max(0, i - 2); k <= Math.min(src.length - 1, i + 2); k++, n++) sum += src[k];
      return sum / n;
    });
  }
  return rows;
}

let partsCache: PartRows[] | null = null;
const parts = () => (partsCache ??= PARTS.map(buildPart));

function sample(list: number[], v: number) {
  const f = Math.min(list.length - 1, Math.max(0, v * (list.length - 1)));
  const i = Math.min(list.length - 2, Math.floor(f));
  return list[i] + (list[i + 1] - list[i]) * (f - i);
}

const superPow = (x: number, p: number) => Math.sign(x) * Math.abs(x) ** (2 / p);
/** Fecha a ponta: o raio vai a zero nos últimos `w` de v. */
const capEnd = (t: number, w: number) => Math.sqrt(Math.max(0, 1 - Math.max(0, (t - (1 - w)) / w) ** 2));

function partSurface(p: PartRows, features = true) {
  return (u: number, v: number, out: THREE.Vector3) => {
    const theta = (u - 0.5) * Math.PI * 2;
    const id = p.def.id;
    let k = 1;
    if (id === 'torso') k = capEnd(1 - v, 0.012) * capEnd(v, 0.03);
    else if (id === 'armR' || id === 'armL') k = capEnd(v, 0.02) * capEnd(1 - v, 0.05);
    else k = capEnd(v, 0.006);
    const xs = superPow(Math.sin(theta), 2.2);
    const y = p.def.from + v * (p.def.to - p.def.from);
    const c = Math.cos(theta);
    const zs = superPow(c, 2.2);
    const x = xs * sample(p.a, v) * k;
    let z = zs * sample(p.d, v) * k;
    if (c > 0 && id === 'torso' && features) {
      // Rosto: o perfil vem do nariz, estreito; o resto da frente da cabeça fica para trás.
      const face = FACE_DEPTH * (1 - smoothstep(HEAD_END - 12, HEAD_END + 4, y)) * smoothstep(TOP + 14, TOP + 34, y);
      z = z * (1 - face) + sample(p.d, v) * k * face * c * Math.exp(-((x / FACE_WIDTH) ** 2));
    }
    return out.set(sample(p.xc, v) + x, -(y - CY) / K, sample(p.zc, v) + z);
  };
}

function partAt(x: number): PartRows {
  const u = x / 100;
  return parts().find((p) => u >= p.def.box.x && u <= p.def.box.x + p.def.box.w + 1e-9) ?? parts()[0];
}

const localU = (p: PartRows, x: number) => Math.min(1, Math.max(0, (x / 100 - p.def.box.x) / p.def.box.w));

function regionAt(x: number, y: number): ApplicationMapRegion | undefined {
  const p = partAt(x);
  const u = localU(p, x);
  const row = p.def.from + (y / 100) * (p.def.to - p.def.from);
  // Ângulo em torno da parte: 0 na frente, ± para os lados, π nas costas.
  const a = Math.abs((u - 0.5) * Math.PI * 2);
  const id = p.def.id;
  if (id === 'armR' || id === 'armL') return 'arms';
  if (id === 'legR' || id === 'legL') {
    if (row > 600) return undefined;
    const outer = (id === 'legL') === u > 0.5;
    return row < 545 && outer && a > Math.PI * 0.35 && a < Math.PI * 0.85 ? 'saddlebags' : 'thighs';
  }
  if (row >= 120 && row <= 146) return a < Math.PI * 0.6 ? 'submental' : undefined;
  if (a > Math.PI * 0.72) return row > 180 && row < 430 ? 'back' : undefined;
  if (row < 265 || row > 440) return undefined;
  return a > Math.PI * 0.3 ? 'flanks' : 'abdomen';
}

export function buildBodyModel(): SurfaceModel {
  const geometries = parts().map((p) =>
    parametricGeometry(partSurface(p), p.def.id === 'torso' ? 160 : 64, Math.round((p.def.to - p.def.from) / 2), {
      x: p.def.box.x,
      y: 0,
      w: p.def.box.w,
      h: 1,
    }),
  );
  const geometry = mergeGeometries(geometries)!;
  geometries.forEach((g) => g.dispose());

  const pos = geometry.getAttribute('position');
  const front: number[] = [];
  const side: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = -pos.getY(i) * K + CY;
    front.push((CX + pos.getX(i) * K) / IMG.w, 1 - y / IMG.h);
    side.push((Z0 - pos.getZ(i) * K) / IMG.w, 1 - y / IMG.h);
  }

  const target = new THREE.Vector3(0, -(400 - CY) / K, 0);
  const painted = projectedSurface(
    geometry,
    { front, left: side, right: side },
    (u, v, out) => {
      const p = partAt(u * 100);
      return surfaceNormal(partSurface(p, false), localU(p, u * 100), v, out);
    },
    { front: bodySrc, left: bodySrc, right: bodySrc },
    target,
    0.004,
  );
  const group = new THREE.Group();
  group.add(painted.outline, painted.mesh);

  return {
    group,
    markable: [painted.mesh],
    pointAt: (x, y) => {
      const p = partAt(x);
      const u = localU(p, x);
      const v = Math.min(1, Math.max(0, y / 100));
      const fn = partSurface(p);
      return { position: fn(u, v, new THREE.Vector3()), normal: surfaceNormal(fn, u, v, new THREE.Vector3()) };
    },
    scale: 1.5,
    pointRadius: 0.032,
    camera: {
      target,
      distance: 5.6,
      minDistance: 1.6,
      maxDistance: 7.5,
      fov: 20,
      maxAzimuth: Math.PI / 2,
    },
    regionAt,
    ready: painted.ready,
    dispose: painted.dispose,
  };
}
