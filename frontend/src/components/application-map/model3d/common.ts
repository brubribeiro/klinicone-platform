import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

import type { ApplicationMapRegion } from '../../../types';

/** Ponto da superfície do modelo para coordenadas (x, y) em % da textura. */
export interface SurfacePoint {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

/**
 * Modelo 3D genérico (desenho, igual para todas as pacientes). Pontos e traços são gravados
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
  };
  /** Região de tratamento deduzida do lugar do ponto. */
  regionAt?: (x: number, y: number) => ApplicationMapRegion | undefined;
  dispose: () => void;
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const gauss = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
  Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);

/** Interpolação suave numa tabela [x, y] ordenada por x. */
export function curve(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t * t * (3 - 2 * t);
    }
  }
  return table[table.length - 1][1];
}

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
  if (out.lengthSq() < 1e-12) return out.set(0, 0, 1);
  return out.normalize();
}

/** Tons do sombreado de desenho (cel shading suave). */
let toonRamp: THREE.DataTexture | null = null;
function toonGradient() {
  if (toonRamp) return toonRamp;
  const steps = [176, 212, 240, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((s, i) => data.set([s, s, s, 255], i * 4));
  toonRamp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  toonRamp.minFilter = THREE.NearestFilter;
  toonRamp.magFilter = THREE.NearestFilter;
  toonRamp.needsUpdate = true;
  return toonRamp;
}

export function toonMaterial(params: { color?: THREE.ColorRepresentation; map?: THREE.Texture; cutout?: boolean }) {
  return new THREE.MeshToonMaterial({
    color: params.color ?? 0xffffff,
    map: params.map ?? null,
    gradientMap: toonGradient(),
    alphaTest: params.cutout ? 0.5 : 0,
  });
}

/**
 * Contorno de ilustração: casca invertida empurrada pela normal. Com `alphaMap`, segue o
 * recorte da textura (borda do cabelo).
 */
export function outlineMesh(
  geometry: THREE.BufferGeometry,
  thickness: number,
  color = '#5a4038',
  alphaMap?: THREE.Texture,
): THREE.Mesh {
  const base = geometry.clone().deleteAttribute('normal');
  if (!alphaMap) base.deleteAttribute('uv');
  const smooth = mergeVertices(base, 1e-4);
  smooth.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      thickness: { value: thickness },
      alphaMap: { value: alphaMap ?? null },
    },
    defines: alphaMap ? { USE_CUTOUT: '' } : {},
    vertexShader: /* glsl */ `
      uniform float thickness;
      #ifdef USE_CUTOUT
      varying vec2 vUv;
      #endif
      void main() {
        #ifdef USE_CUTOUT
        vUv = uv;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thickness, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      #ifdef USE_CUTOUT
      uniform sampler2D alphaMap;
      varying vec2 vUv;
      #endif
      void main() {
        #ifdef USE_CUTOUT
        if (texture2D(alphaMap, vUv).a < 0.5) discard;
        #endif
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(smooth, material);
  mesh.userData.outline = true;
  return mesh;
}

export function skinTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Libera geometrias, materiais e texturas de um grupo. */
export function disposeGroup(group: THREE.Object3D) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of materials) {
      const map = (m as THREE.MeshToonMaterial).map;
      if (map) map.dispose();
      m.dispose();
    }
  });
}

export const SKIN = '#F2D2BE';
export const SKIN_SHADE = '#E7B9A2';
export const HAIR = '#6E4B3A';
export const LINE = '#5a4038';
