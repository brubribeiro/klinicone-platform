import * as THREE from 'three';

import type { ApplicationMapRegion } from '../../../types';

/** Ponto da superfície do modelo para coordenadas (x, y) em % da textura. */
export interface SurfacePoint {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

/**
 * Modelo 3D genérico (as ilustrações do mapa em volume, igual para todas as pacientes). Pontos e traços são gravados
 * em % da textura do modelo (coordenadas UV), por isso não dependem da câmera.
 */
export interface SurfaceModel {
  /** Tudo o que aparece na cena. */
  group: THREE.Group;
  /** Malhas que aceitam marcação; o resto (cabelo, mãos…) só gira o modelo. */
  markable: THREE.Mesh[];
  /** Posição e normal na superfície; `null` fora do modelo. */
  pointAt: (x: number, y: number) => SurfacePoint | null;
  /** Largura de referência (unidades da cena) para a espessura do traço, em %. */
  scale: number;
  /** Raio do ponto marcado, em unidades da cena. */
  pointRadius: number;
  camera: {
    target: THREE.Vector3;
    distance: number;
    minDistance: number;
    maxDistance: number;
    fov: number;
    /** Giro máximo para cada lado (rad); sem ele, a volta inteira. */
    maxAzimuth?: number;
  };
  /** Resolve quando as ilustrações que pintam o modelo carregaram. */
  ready?: Promise<void>;
  /** Região de tratamento deduzida do lugar do ponto. */
  regionAt?: (x: number, y: number) => ApplicationMapRegion | undefined;
  dispose: () => void;
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Grade paramétrica (u, v ∈ [0, 1]) com UV = (u, 1 − v): x/y do ponto em % são u·100 e v·100.
 * `uvBox` coloca a grade num pedaço da textura (atlas do corpo).
 */
export function parametricGeometry(
  fn: (u: number, v: number, out: THREE.Vector3) => void,
  segU: number,
  segV: number,
  uvBox = { x: 0, y: 0, w: 1, h: 1 },
  keep?: (u: number, v: number) => boolean,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      fn(u, v, p);
      positions.push(p.x, p.y, p.z);
      uvs.push(uvBox.x + u * uvBox.w, 1 - (uvBox.y + v * uvBox.h));
    }
  }
  const index: number[] = [];
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      const b = a + segU + 1;
      if (keep && !keep((i + 0.5) / segU, (j + 0.5) / segV)) continue;
      // u cresce para +x e v para baixo: (a, b, a+1) fica anti-horário visto de fora.
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  // A grade é fechada em u: a mesma normal nas duas bordas esconde a costura.
  const normals = g.getAttribute('normal') as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  for (let j = 0; j <= segV; j++) {
    const a = j * (segU + 1);
    const b = a + segU;
    n.fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, n.x, n.y, n.z);
    normals.setXYZ(b, n.x, n.y, n.z);
  }
  return g;
}

/** Normal pela derivada numérica da superfície paramétrica. */
export function surfaceNormal(
  fn: (u: number, v: number, out: THREE.Vector3) => void,
  u: number,
  v: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const e = 1e-3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const d = new THREE.Vector3();
  fn(Math.max(0, u - e), v, a);
  fn(Math.min(1, u + e), v, b);
  fn(u, Math.max(0, v - e), c);
  fn(u, Math.min(1, v + e), d);
  const du = b.sub(a);
  const dv = d.sub(c);
  out.crossVectors(dv, du);
  if (out.lengthSq() < 1e-24) return out.set(0, 0, 1);
  return out.normalize();
}
