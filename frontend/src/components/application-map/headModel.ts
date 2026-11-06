import * as THREE from "three";

/** Contorno do rosto na malha do MediaPipe (FACEMESH_FACE_OVAL). */
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];
/** Peso da foto por anel a partir do contorno: a foto some em direção à borda e vira cor de pele. */
const RING_MIX = [0, 0.25, 0.55, 0.85];

const LM = {
  foreheadTop: 10,
  chin: 152,
  sideRight: 234,
  sideLeft: 454,
  eyeOuterRight: 33,
  eyeOuterLeft: 263,
  noseBottom: 2,
} as const;

const GRID_U = 96;
const GRID_V = 72;
/** Largura, em células da grade, da transição entre o rosto e o crânio. */
const FALLOFF_CELLS = 22;

/**
 * Peso da foto em cada vértice da malha do rosto: 0 no contorno, 1 a partir do 4º anel.
 * Assim a borda solta da máscara se mistura à cor de pele da cabeça.
 */
export function faceBlendWeights(
  vertexCount: number,
  triangles: ArrayLike<number>,
): Float32Array {
  const neighbors: Set<number>[] = Array.from(
    { length: vertexCount },
    () => new Set(),
  );
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]];
    neighbors[a].add(b).add(c);
    neighbors[b].add(a).add(c);
    neighbors[c].add(a).add(b);
  }
  const ring = new Int32Array(vertexCount).fill(-1);
  let frontier = FACE_OVAL.filter((i) => i < vertexCount);
  frontier.forEach((i) => (ring[i] = 0));
  for (let r = 1; r < RING_MIX.length && frontier.length; r++) {
    const next: number[] = [];
    for (const v of frontier)
      for (const n of neighbors[v])
        if (ring[n] < 0) {
          ring[n] = r;
          next.push(n);
        }
    frontier = next;
  }
  return Float32Array.from(ring, (r) => (r < 0 ? 1 : RING_MIX[r]));
}

/** Cor média da pele (bochechas e testa) lida da foto, já em espaço linear. */
export function sampleSkinColor(
  photo: CanvasImageSource,
  width: number,
  height: number,
  landmarks: { x: number; y: number }[],
): THREE.Color {
  const size = 512;
  const scale = size / Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
  const samples: [number, number, number][] = [];
  // Todos os pontos da malha: pele é a maioria (olhos, sobrancelhas e boca ficam fora da mediana).
  for (const l of landmarks) {
    const px = Math.round(l.x * canvas.width);
    const py = Math.round(l.y * canvas.height);
    const r = 2;
    const data = ctx.getImageData(
      Math.max(0, px - r),
      Math.max(0, py - r),
      r * 2 + 1,
      r * 2 + 1,
    ).data;
    for (let i = 0; i < data.length; i += 4)
      samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (!samples.length)
    return new THREE.Color().setRGB(0.93, 0.78, 0.68, THREE.SRGBColorSpace);
  // Faixa clara (70–92% por luminância): ignora barba, sobrancelhas, sombras e reflexos.
  samples.sort(
    (p, q) =>
      p[0] * 0.3 +
      p[1] * 0.59 +
      p[2] * 0.11 -
      (q[0] * 0.3 + q[1] * 0.59 + q[2] * 0.11),
  );
  const band = samples.slice(
    Math.floor(samples.length * 0.7),
    Math.ceil(samples.length * 0.92),
  );
  const mean = (k: 0 | 1 | 2) =>
    band.reduce((sum, p) => sum + p[k], 0) / band.length / 255;
  return new THREE.Color().setRGB(
    mean(0),
    mean(1),
    mean(2),
    THREE.SRGBColorSpace,
  );
}

export interface HeadParts {
  head: THREE.BufferGeometry;
  ears: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
}

/**
 * Cabeça inteira em volta da malha do rosto: um crânio (elipsoide assimétrico, mais estreito
 * na mandíbula) colado ao contorno da malha, orelhas e pescoço. Na região do rosto o crânio
 * fica logo atrás da malha; fora dela o deslocamento é suavizado para emendar sem degrau.
 */
export function buildHead(
  face: THREE.Mesh,
  positions: Float32Array,
  blend: Float32Array,
): HeadParts {
  const P = (i: number) =>
    new THREE.Vector3(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2],
    );
  const right = P(LM.sideRight);
  const left = P(LM.sideLeft);
  const top = P(LM.foreheadTop);
  const chin = P(LM.chin);
  const eyeY = (P(LM.eyeOuterRight).y + P(LM.eyeOuterLeft).y) / 2;
  const noseBottom = P(LM.noseBottom);
  const faceW = Math.abs(left.x - right.x);
  const faceH = top.y - chin.y;
  const sideZ = (right.z + left.z) / 2;

  const center = new THREE.Vector3(
    (left.x + right.x) / 2,
    eyeY,
    sideZ - 0.12 * faceW,
  );
  const a = 0.57 * faceW;
  const skullTop = top.y + 0.26 * faceH;
  const bUp = skullTop - center.y;
  const bDownFront = center.y - chin.y + 0.05 * faceH;
  const bDownBack = center.y - noseBottom.y + 0.12 * faceH;
  const cFront = Math.max(top.z - center.z, 0.45 * faceW);
  const cBack = 0.72 * faceW;

  /** Distância do centro à superfície do crânio na direção d (unitária). */
  const skullRadius = (d: THREE.Vector3) => {
    const front = Math.max(0, d.z);
    const b = d.y >= 0 ? bUp : bDownBack + (bDownFront - bDownBack) * front;
    const c = d.z >= 0 ? cFront : cBack;
    // Mandíbula mais estreita que o crânio.
    const ax = d.y < 0 ? a * (1 - 0.22 * d.y * d.y) : a;
    return 1 / Math.sqrt((d.x / ax) ** 2 + (d.y / b) ** 2 + (d.z / c) ** 2);
  };

  // Grade esférica a partir do centro; raios que acertam a malha do rosto prendem o crânio atrás dela.
  const nu = GRID_U;
  const nv = GRID_V;
  const dirs: THREE.Vector3[] = [];
  const base = new Float32Array((nu + 1) * (nv + 1));
  const offset = new Float32Array(base.length);
  const known = new Uint8Array(base.length);
  const hitDist = new Float32Array(base.length);
  const raycaster = new THREE.Raycaster();
  face.updateMatrixWorld();
  const behind = 0.03 * faceW;
  for (let j = 0; j <= nv; j++) {
    const phi = (j / nv) * Math.PI;
    for (let i = 0; i <= nu; i++) {
      // Costura da grade na nuca (θ = π), longe do rosto.
      const theta = Math.PI + (i / nu) * Math.PI * 2;
      const d = new THREE.Vector3(
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.cos(theta),
      );
      const k = j * (nu + 1) + i;
      dirs.push(d);
      base[k] = skullRadius(d);
      raycaster.set(center, d);
      const hits = raycaster.intersectObject(face);
      if (hits.length) {
        hitDist[k] = hits[hits.length - 1].distance;
        offset[k] = hitDist[k] - behind - base[k];
        known[k] = 1;
      }
    }
  }
  // Leva o deslocamento do contorno do rosto para fora (vizinho mais próximo + suavização) e
  // o atenua com a distância, para a emenda com o crânio não ter degrau.
  const idx = (i: number, j: number) => j * (nu + 1) + (((i % nu) + nu) % nu);
  const dist = new Float32Array(base.length).fill(Infinity);
  let frontier: [number, number][] = [];
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i < nu; i++)
      if (known[idx(i, j)]) {
        dist[idx(i, j)] = 0;
        frontier.push([i, j]);
      }
  for (let step = 1; frontier.length && step <= FALLOFF_CELLS; step++) {
    const next: [number, number][] = [];
    for (const [i, j] of frontier)
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nj = j + dj;
        if (nj < 0 || nj > nv) continue;
        const k = idx(i + di, nj);
        if (dist[k] !== Infinity) continue;
        dist[k] = step;
        offset[k] = offset[idx(i, j)];
        next.push([i + di, nj]);
      }
    frontier = next;
  }
  for (let it = 0; it < 30; it++) {
    const next = offset.slice();
    for (let j = 1; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const k = idx(i, j);
        if (known[k] || dist[k] === Infinity) continue;
        next[k] =
          (offset[idx(i - 1, j)] +
            offset[idx(i + 1, j)] +
            offset[idx(i, j - 1)] +
            offset[idx(i, j + 1)]) /
          4;
      }
    offset.set(next);
  }
  for (let k = 0; k < offset.length; k++) {
    if (known[k]) continue;
    const t = Math.min(1, dist[k] / FALLOFF_CELLS);
    offset[k] *= 1 - t * t * (3 - 2 * t);
  }
  // Suaviza também dentro do rosto: a borda da malha do MediaPipe costuma dobrar para a frente
  // (testa, têmporas), e o crânio deve seguir a forma geral, não essa aba.
  for (let it = 0; it < 14; it++) {
    const next = offset.slice();
    for (let j = 1; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const k = idx(i, j);
        if (dist[k] === Infinity) continue;
        next[k] =
          (offset[k] * 2 +
            offset[idx(i - 1, j)] +
            offset[idx(i + 1, j)] +
            offset[idx(i, j - 1)] +
            offset[idx(i, j + 1)]) /
          6;
      }
    offset.set(next);
  }
  for (let j = 0; j <= nv; j++)
    offset[j * (nu + 1) + nu] = offset[j * (nu + 1)];
  const smoothRadius = (k: number) => base[k] + offset[k];

  /** Raio suavizado do crânio numa direção qualquer (bilinear na grade). */
  const radiusAt = (d: THREE.Vector3) => {
    let theta = Math.atan2(d.x, d.z) - Math.PI;
    if (theta < 0) theta += Math.PI * 2;
    const fi = (theta / (Math.PI * 2)) * nu;
    const fj = (Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)) / Math.PI) * nv;
    const i0 = Math.min(nu - 1, Math.floor(fi));
    const j0 = Math.min(nv - 1, Math.floor(fj));
    const ti = fi - i0;
    const tj = fj - j0;
    const r = (i: number, j: number) => smoothRadius(j * (nu + 1) + i);
    return (
      (r(i0, j0) * (1 - ti) + r(i0 + 1, j0) * ti) * (1 - tj) +
      (r(i0, j0 + 1) * (1 - ti) + r(i0 + 1, j0 + 1) * ti) * tj
    );
  };

  // Borda da malha do rosto assenta no crânio suavizado (some a aba); o miolo não muda.
  const v = new THREE.Vector3();
  for (let i = 0; i < blend.length; i++) {
    const w = THREE.MathUtils.clamp(1 - blend[i] / 0.85, 0, 1);
    if (w <= 0) continue;
    v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).sub(
      center,
    );
    const len = v.length();
    v.divideScalar(len);
    const target = radiusAt(v) + behind * 0.6;
    const r = len + (target - len) * w;
    positions[i * 3] = center.x + v.x * r;
    positions[i * 3 + 1] = center.y + v.y * r;
    positions[i * 3 + 2] = center.z + v.z * r;
  }
  const faceGeometry = face.geometry as THREE.BufferGeometry;
  faceGeometry.getAttribute("position").needsUpdate = true;
  faceGeometry.computeVertexNormals();
  faceGeometry.computeBoundingSphere();

  const headPos = new Float32Array(base.length * 3);
  dirs.forEach((d, k) => {
    // Atrás do rosto o crânio nunca passa da malha.
    const r = known[k]
      ? Math.min(smoothRadius(k), hitDist[k] - behind)
      : smoothRadius(k);
    headPos[k * 3] = center.x + d.x * r;
    headPos[k * 3 + 1] = center.y + d.y * r;
    headPos[k * 3 + 2] = center.z + d.z * r;
  });
  const indices: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const p = j * (nu + 1) + i;
      const q = p + nu + 1;
      indices.push(p, q, p + 1, p + 1, q, q + 1);
    }
  const head = new THREE.BufferGeometry();
  head.setAttribute("position", new THREE.BufferAttribute(headPos, 3));
  head.setIndex(indices);
  head.computeVertexNormals();

  // Orelhas: elipsoide achatado com a concha escavada, na altura entre sobrancelha e base do nariz.
  const earTop = eyeY + 0.08 * faceH;
  const earBottom = noseBottom.y + 0.01 * faceH;
  const earH = earTop - earBottom;
  const earW = 0.52 * earH;
  const earT = 0.17 * earH;
  const earY = (earTop + earBottom) / 2;
  const earZ = center.z - 0.08 * faceW;
  const ears: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const g = new THREE.SphereGeometry(1, 28, 20);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      const rim = Math.max(0, 1 - (y * y + z * z) / 0.7);
      // Concha voltada para fora (+x local), lóbulo mais estreito embaixo.
      const lx = (x > 0 ? x - 1.3 * rim : x) * earT;
      const width = y < 0 ? 1 - 0.38 * y * y : 1 + 0.08 * y;
      pos.setXYZ(v, lx, y * (earH / 2), z * (earW / 2) * width);
    }
    const dir = new THREE.Vector3(
      side,
      (earY - center.y) / a,
      (earZ - center.z) / a,
    ).normalize();
    const surface = center.clone().addScaledVector(dir, skullRadius(dir));
    const m = new THREE.Matrix4()
      .makeTranslation(surface.x + side * earT * 0.15, earY, earZ)
      .multiply(new THREE.Matrix4().makeRotationY(side * 0.22))
      .multiply(new THREE.Matrix4().makeRotationZ(side * -0.08))
      .multiply(new THREE.Matrix4().makeScale(side, 1, 1));
    g.applyMatrix4(m);
    if (side < 0) {
      // Espelhar inverte a ordem dos triângulos.
      const index = g.getIndex()!;
      for (let t = 0; t < index.count; t += 3) {
        const tmp = index.getX(t);
        index.setX(t, index.getX(t + 2));
        index.setX(t + 2, tmp);
      }
    }
    g.computeVertexNormals();
    ears.push(g);
  }
  const earsGeometry = mergeGeometries(ears);

  // Pescoço: tronco de cone aberto, saindo de dentro do crânio para baixo do queixo.
  const neckTop = center.y - 0.2 * faceH;
  const neckBottom = chin.y - 0.9 * faceH;
  const neckR = 0.4 * faceW;
  const neck = new THREE.CylinderGeometry(
    neckR,
    neckR * 1.3,
    neckTop - neckBottom,
    40,
    8,
    true,
  );
  neck.translate(center.x, (neckTop + neckBottom) / 2, center.z - 0.22 * faceW);

  return { head, ears: earsGeometry, neck };
}

function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let offset = 0;
  for (const g of parts) {
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    const index = g.getIndex()!;
    for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + offset);
    offset += p.count;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

/** Material da malha do rosto: a foto vai para a cor de pele conforme o atributo `faceMix`. */
export function faceMaterial(
  texture: THREE.Texture,
  skin: THREE.Color,
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.skinColor = { value: skin };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float faceMix;\nvarying float vFaceMix;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFaceMix = faceMix;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 skinColor;\nvarying float vFaceMix;",
      )
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\ndiffuseColor.rgb = mix(skinColor, diffuseColor.rgb, smoothstep(0.0, 1.0, vFaceMix));",
      );
  };
  return material;
}
