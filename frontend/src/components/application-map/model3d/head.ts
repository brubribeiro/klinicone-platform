import * as THREE from 'three';

import faceFrontSrc from '../../../assets/application-map/face-frente.webp';
import faceLeftSrc from '../../../assets/application-map/face-perfil-e.webp';
import faceRightSrc from '../../../assets/application-map/face-perfil-d.webp';
import { parametricGeometry, smoothstep, surfaceNormal, type SurfaceModel } from './common';
import { edgeAt, piecewise, projectedSurface } from './projected';
import { FACE_FRONT, FACE_LEFT, FACE_RIGHT, SIL_STEP } from './silhouettes';

/**
 * Cabeça 3D feita das ilustrações 2D do mapa: a forma vem das silhuetas de frente e dos dois
 * perfis, e a pintura é a própria arte projetada. Pontos e traços ficam em % de uma grade
 * cilíndrica (x = volta em torno da cabeça, 50 = frente; y = altura).
 */

/** Ilustração de frente: px por unidade da cena, centro do rosto e altura de referência. */
const K = 400;
const FRONT = { w: 440, h: 680, cx: 226, cy: 300 };
const Y_TOP = 6;
const Y_BOTTOM = 610;

interface Profile {
  rows: number[];
  w: number;
  h: number;
  /** px do perfil por px da frente (os perfis foram desenhados um pouco menores). */
  scale: number;
  /** Coluna do centro da cabeça no perfil. */
  zc: number;
  /** O rosto aponta para a esquerda da imagem (perfil esquerdo) ou para a direita. */
  facesLeft: boolean;
  /** Linhas do perfil → linhas da frente (olhos, nariz, boca e queixo alinhados). */
  rowsToFront: [number, number][];
  /** Centro e meia largura da orelha, em unidades da cena (z). */
  earZ: number;
}

const LEFT: Profile = {
  rows: FACE_LEFT,
  w: 600,
  h: 620,
  scale: 1.02,
  zc: 280,
  facesLeft: true,
  rowsToFront: [
    [8, Y_TOP - 2],
    [283, 285],
    [370, 385],
    [395, 400],
    [450, 455],
    [470, 480],
    [540, 545],
    [616, 621],
  ],
  earZ: -0.21,
};

const RIGHT: Profile = {
  rows: FACE_RIGHT,
  w: 600,
  h: 620,
  scale: 1.05,
  zc: 279,
  facesLeft: false,
  rowsToFront: [
    [34, Y_TOP - 2],
    [300, 285],
    [382, 385],
    [405, 400],
    [462, 455],
    [480, 480],
    [550, 545],
    [616, 611],
  ],
  earZ: -0.1,
};

const frontToRows = (p: Profile) => p.rowsToFront.map(([a, b]) => [b, a] as [number, number]);
const LEFT_INV = frontToRows(LEFT);
const RIGHT_INV = frontToRows(RIGHT);

/** Linha do perfil para a linha `yf` da frente. */
const profileRow = (p: Profile, yf: number) => piecewise(p === LEFT ? LEFT_INV : RIGHT_INV, yf);

/** Bordas do perfil (frente do rosto e nuca) em z da cena, na linha `yf` da frente. */
function profileDepth(p: Profile, yf: number): { front: number; back: number } | null {
  const y = profileRow(p, yf);
  const a = edgeAt(p.rows, SIL_STEP, y, 0);
  const b = edgeAt(p.rows, SIL_STEP, y, 1);
  if (a === null || b === null) return null;
  const toZ = (x: number) => ((p.facesLeft ? p.zc - x : x - p.zc) * p.scale) / K;
  return p.facesLeft ? { front: toZ(a), back: toZ(b) } : { front: toZ(b), back: toZ(a) };
}

/** Bordas da frente (lado direito e esquerdo da paciente) em x da cena. */
function frontEdges(yf: number): { right: number; left: number } | null {
  const a = edgeAt(FACE_FRONT, SIL_STEP, yf, 0);
  const b = edgeAt(FACE_FRONT, SIL_STEP, yf, 1);
  if (a === null || b === null) return null;
  return { right: (a - FRONT.cx) / K, left: (b - FRONT.cx) / K };
}

// Orelhas: a silhueta de frente sem elas (lateral da cabeça) e o quanto elas saem.
const EAR = { from: 252, to: 408, bulge: 8 / K };
function headSides(yf: number) {
  const raw = frontEdges(yf);
  if (!raw || yf <= EAR.from || yf >= EAR.to) return { raw, base: raw };
  const a = frontEdges(EAR.from)!;
  const b = frontEdges(EAR.to)!;
  const t = (yf - EAR.from) / (EAR.to - EAR.from);
  const bulge = Math.sin(Math.PI * t) * EAR.bulge;
  const base = {
    right: Math.max(raw.right, a.right + (b.right - a.right) * t - bulge),
    left: Math.min(raw.left, a.left + (b.left - a.left) * t + bulge),
  };
  return { raw, base };
}

// Nariz e lábios: o perfil sem eles (plano do rosto) e o relevo, estreito, na linha média.
const NOSE = { from: 240, to: 400 };
/** Os olhos ficam atrás da linha sobrancelha–nariz do perfil. */
const EYES = { y: 292, spread: 42, depth: 0.07 };
const LIPS = { from: 400, to: 505 };
const BUN = { from: 262, to: 470 };
/** Queixo e mandíbula à frente do pescoço: o perfil desce reto até a garganta. */
const JAW = { from: 470, to: 600 };

function lerpRow(f: (y: number) => number, from: number, to: number, y: number) {
  const t = (y - from) / (to - from);
  return f(from) + (f(to) - f(from)) * t;
}

interface Row {
  right: number;
  left: number;
  earRight: number;
  earLeft: number;
  frontR: number;
  frontL: number;
  reliefR: number;
  reliefL: number;
  reliefWidth: number;
  jawR: number;
  jawL: number;
  jawWidth: number;
  frontPow: number;
  backR: number;
  backL: number;
  bunR: number;
  bunL: number;
}

function sideRow(p: Profile, yf: number) {
  const d = profileDepth(p, yf) ?? { front: 0, back: 0 };
  const front = (y: number) => profileDepth(p, y)?.front ?? 0;
  const back = (y: number) => profileDepth(p, y)?.back ?? 0;
  let base = d.front;
  if (yf > NOSE.from && yf < NOSE.to)
    base = lerpRow(front, NOSE.from, NOSE.to, yf) - EYES.depth * Math.exp(-(((yf - EYES.y) / EYES.spread) ** 2));
  else if (yf >= LIPS.from && yf < LIPS.to) base = lerpRow(front, LIPS.from, LIPS.to, yf);
  // Abaixo da boca, o corte é o pescoço; queixo e mandíbula são relevo da largura do rosto.
  let jaw = 0;
  if (yf > JAW.from && yf < JAW.to) {
    const throat = lerpRow(front, JAW.from, JAW.to, yf);
    const neck = Math.min(base, throat);
    jaw = base - neck;
    base = neck;
  }
  let backBase = d.back;
  if (yf > BUN.from && yf < BUN.to) backBase = Math.max(d.back, lerpRow(back, BUN.from, BUN.to, yf));
  return {
    front: Math.min(base, d.front),
    relief: Math.max(0, d.front - base - jaw),
    jaw,
    back: backBase,
    bun: Math.max(0, backBase - d.back),
  };
}

const ROWS = 320;
const rowCache: Row[] = [];
function buildRows() {
  if (rowCache.length) return rowCache;
  for (let j = 0; j <= ROWS; j++) {
    const yf = Y_TOP + ((Y_BOTTOM - Y_TOP) * j) / ROWS;
    const { raw, base } = headSides(yf);
    const l = sideRow(LEFT, yf);
    const r = sideRow(RIGHT, yf);
    const noseW = piecewise(
      [
        [NOSE.from, 0.05],
        [275, 0.035],
        [330, 0.05],
        [372, 0.1],
        [392, 0.115],
        [NOSE.to, 0.1],
        [420, 0.11],
        [LIPS.to, 0.1],
      ],
      yf,
    );
    rowCache.push({
      right: base?.right ?? 0,
      left: base?.left ?? 0,
      earRight: raw && base ? base.right - raw.right : 0,
      earLeft: raw && base ? raw.left - base.left : 0,
      frontR: r.front,
      frontL: l.front,
      reliefR: r.relief,
      reliefL: l.relief,
      reliefWidth: noseW,
      jawR: r.jaw,
      jawL: l.jaw,
      frontPow: piecewise(
        [
          [380, 1.9],
          [450, 1.7],
        ],
        yf,
      ),
      jawWidth: piecewise(
        [
          [JAW.from, 0.3],
          [520, 0.24],
          [550, 0.15],
          [580, 0.1],
          [JAW.to, 0.1],
        ],
        yf,
      ),
      backR: r.back,
      backL: l.back,
      bunR: r.bun,
      bunL: l.bun,
    });
  }
  return rowCache;
}

const rowY = (v: number) => Y_TOP + (Y_BOTTOM - Y_TOP) * v;
const sceneY = (yf: number) => -(yf - FRONT.cy) / K;

function rowAt(v: number): Row {
  const rows = buildRows();
  const f = Math.min(ROWS, Math.max(0, v * ROWS));
  const i = Math.min(ROWS - 1, Math.floor(f));
  const t = f - i;
  const a = rows[i];
  const b = rows[i + 1];
  const out = {} as Row;
  for (const k of Object.keys(a) as (keyof Row)[]) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

const superPow = (x: number, p: number) => Math.sign(x) * Math.abs(x) ** (2 / p);

/** Superfície: u = volta (0,5 = frente, cresce para o lado esquerdo da paciente), v = altura. */
function surface(u: number, v: number, out: THREE.Vector3, features = true) {
  const row = rowAt(v);
  const theta = (u - 0.5) * Math.PI * 2;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  // Cada metade usa o próprio perfil; na linha média, a média dos dois.
  const t = smoothstep(-0.25, 0.25, s);
  const mix = (r: number, l: number) => r + (l - r) * t;
  // Topo da cabeça fecha num ponto.
  const cap = v <= 0 ? 0 : smoothstep(0, 0.012, v);
  const xs = superPow(s, 2.2);
  const zs = superPow(c, c > 0 ? row.frontPow : 2.2);
  let x = (xs > 0 ? xs * row.left : -xs * row.right) * cap;
  let z = (zs > 0 ? zs * mix(row.frontR, row.frontL) : -zs * mix(row.backR, row.backL)) * cap;
  if (c > 0 && features) {
    z += mix(row.reliefR, row.reliefL) * Math.exp(-(Math.abs(x / row.reliefWidth) ** 2.6)) * c;
    z += mix(row.jawR, row.jawL) * Math.exp(-((x / row.jawWidth) ** 4)) * c;
  }
  if (c < 0) z -= mix(row.bunR, row.bunL) * Math.exp(-((x / 0.15) ** 2)) * -c;
  // Orelha: sai da lateral, na altura e na profundidade dela em cada perfil.
  const ear = s > 0 ? row.earLeft : row.earRight;
  if (ear > 0 && features) {
    const earZ = s > 0 ? LEFT.earZ : RIGHT.earZ;
    x += Math.sign(s) * ear * Math.exp(-(((z - earZ) / 0.085) ** 4)) * smoothstep(0.5, 0.85, Math.abs(s));
  }
  return out.set(x, sceneY(rowY(v)), z);
}

/** Coordenadas de cada vértice nas três ilustrações. */
function projectorCoords(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const front: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const yf = rowY(1 - uv.getY(i));
    const x = pos.getX(i);
    const z = pos.getZ(i);
    front.push((FRONT.cx + x * K) / FRONT.w, 1 - yf / FRONT.h);
    for (const [p, list] of [
      [LEFT, left],
      [RIGHT, right],
    ] as const) {
      const px = p.zc + ((p.facesLeft ? -z : z) * K) / p.scale;
      list.push(px / p.w, 1 - profileRow(p, yf) / p.h);
    }
  }
  return { front, left, right };
}

export function buildHeadModel(): SurfaceModel {
  const geometry = parametricGeometry(surface, 256, ROWS);
  const target = new THREE.Vector3(0, sceneY(330), 0);
  const painted = projectedSurface(
    geometry,
    projectorCoords(geometry),
    (u, v, out) => surfaceNormal((uu, vv, o) => surface(uu, vv, o, false), u, v, out),
    { front: faceFrontSrc, left: faceLeftSrc, right: faceRightSrc },
    target,
    0.006,
  );
  const group = new THREE.Group();
  group.add(painted.outline, painted.mesh);

  return {
    group,
    markable: [painted.mesh],
    pointAt: (x, y) => {
      const u = Math.min(1, Math.max(0, x / 100));
      const v = Math.min(1, Math.max(0, y / 100));
      const position = surface(u, v, new THREE.Vector3());
      return { position, normal: surfaceNormal(surface, u, v, new THREE.Vector3()) };
    },
    scale: 1.1,
    pointRadius: 0.03,
    camera: {
      target,
      distance: 5.6,
      minDistance: 2.6,
      maxDistance: 7.5,
      fov: 20,
      maxAzimuth: Math.PI / 2,
    },
    ready: painted.ready,
    dispose: painted.dispose,
  };
}
