import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Pintura do modelo 3D com as próprias ilustrações 2D: cada vista desenhada (frente, perfil
 * esquerdo, perfil direito) é projetada na malha como um projetor de slide. A mistura depende
 * da normal da superfície e do ângulo da câmera, de modo que de frente ou de perfil a tela
 * mostra exatamente a ilustração, e entre elas a transição é contínua.
 */

/** Coordenadas (u, v) de cada vertice em cada ilustração. */
export interface ProjectorCoords {
  front: number[];
  left: number[];
  right: number[];
}

export interface ProjectedSources {
  front: string;
  left: string;
  right: string;
  /** Usa a imagem do perfil espelhada (o corpo só tem um perfil desenhado). */
  mirrorLeft?: boolean;
}

const LINE = '#4a3a33';

function loadTexture(src: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      src,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

const vertexShader = /* glsl */ `
  attribute vec2 uvFront;
  attribute vec2 uvLeft;
  attribute vec2 uvRight;
  attribute vec3 blendNormal;
  varying vec2 vF;
  varying vec2 vL;
  varying vec2 vR;
  varying vec3 vN;
  void main() {
    vF = uvFront;
    vL = uvLeft;
    vR = uvRight;
    vN = normalize(mat3(modelMatrix) * blendNormal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tFront;
  uniform sampler2D tLeft;
  uniform sampler2D tRight;
  uniform vec3 camWeights;
  uniform float ready;
  varying vec2 vF;
  varying vec2 vL;
  varying vec2 vR;
  varying vec3 vN;
  float paper(vec4 c) {
    return 1.0 - smoothstep(0.93, 0.985, min(c.r, min(c.g, c.b)));
  }
  void main() {
    vec3 n = normalize(vN);
    vec3 facing = vec3(max(n.z, 0.0), max(n.x, 0.0), max(-n.x, 0.0));
    vec4 cF = texture2D(tFront, vF);
    vec4 cL = texture2D(tLeft, vL);
    vec4 cR = texture2D(tRight, vR);
    // Fundo branco da ilustração (fora do desenho) não pinta: fica com as outras vistas.
    vec3 inside = vec3(paper(cF), paper(cL), paper(cR));
    vec3 facingW = pow(facing, vec3(8.0));
    vec3 w = facingW * camWeights * inside;
    float total = w.x + w.y + w.z;
    if (total < 1e-7) {
      // Só o fundo da vista da câmera: usa a vista desenhada para onde a superfície está virada.
      w = facingW * inside;
      total = w.x + w.y + w.z;
    }
    if (total < 1e-7) {
      w = step(max(facing.x, max(facing.y, facing.z)), facing);
      total = w.x + w.y + w.z;
    }
    vec4 c = cF * w.x + cL * w.y + cR * w.z;
    vec3 color = mix(vec3(0.97, 0.92, 0.88), c.rgb / total, ready);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const outlineVertex = /* glsl */ `
  uniform float thickness;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thickness, 1.0);
  }
`;

const outlineFragment = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  void main() {
    gl_FragColor = vec4(color, opacity);
    #include <colorspace_fragment>
  }
`;

/** Pesos de cada ilustração conforme o lado de onde a câmera olha (azimute em rad). */
function cameraWeights(azimuth: number, out: THREE.Vector3) {
  const c = Math.cos(azimuth);
  const s = Math.sin(azimuth);
  return out.set(c > 0 ? c * c : 0, s > 0 ? s * s : 0, s < 0 ? s * s : 0);
}

export interface ProjectedSurface {
  mesh: THREE.Mesh;
  outline: THREE.Mesh;
  ready: Promise<void>;
  dispose: () => void;
}

/**
 * Malha pintada pelas ilustrações + contorno de nanquim que só aparece entre as vistas
 * desenhadas (nelas o traço já está na própria arte).
 */
export function projectedSurface(
  geometry: THREE.BufferGeometry,
  coords: ProjectorCoords,
  /** Normal da forma sem nariz, lábios e orelhas: decide qual ilustração pinta cada ponto. */
  blendNormal: (u: number, v: number, out: THREE.Vector3) => THREE.Vector3,
  sources: ProjectedSources,
  target: THREE.Vector3,
  outlineThickness: number,
): ProjectedSurface {
  geometry.setAttribute('uvFront', new THREE.Float32BufferAttribute(coords.front, 2));
  geometry.setAttribute('uvLeft', new THREE.Float32BufferAttribute(coords.left, 2));
  geometry.setAttribute('uvRight', new THREE.Float32BufferAttribute(coords.right, 2));
  const uv = geometry.getAttribute('uv');
  const normals: number[] = [];
  const n = new THREE.Vector3();
  for (let i = 0; i < uv.count; i++) {
    blendNormal(uv.getX(i), 1 - uv.getY(i), n);
    normals.push(n.x, n.y, n.z);
  }
  geometry.setAttribute('blendNormal', new THREE.Float32BufferAttribute(normals, 3));

  const blank = new THREE.Texture();
  const uniforms = {
    tFront: { value: blank },
    tLeft: { value: blank },
    tRight: { value: blank },
    camWeights: { value: new THREE.Vector3(1, 0, 0) },
    ready: { value: 0 },
  };
  // Dos dois lados: entre as pernas e na virilha aparece o lado de dentro das peças.
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);

  const smooth = mergeVertices(new THREE.BufferGeometry().setAttribute('position', geometry.getAttribute('position')).setIndex(geometry.getIndex()), 1e-4);
  smooth.computeVertexNormals();
  const outlineUniforms = {
    color: { value: new THREE.Color(LINE) },
    thickness: { value: outlineThickness },
    opacity: { value: 0 },
  };
  const outline = new THREE.Mesh(
    smooth,
    new THREE.ShaderMaterial({
      uniforms: outlineUniforms,
      vertexShader: outlineVertex,
      fragmentShader: outlineFragment,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    }),
  );
  outline.userData.outline = true;
  outline.renderOrder = -1;

  // A câmera de cada render (editor ou miniatura) decide a mistura das ilustrações.
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    const az = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
    cameraWeights(az, uniforms.camWeights.value);
    // Traço de contorno só entre as vistas desenhadas, onde a arte não traz o próprio.
    const between = Math.min(Math.abs(Math.sin(az)), Math.abs(Math.cos(az)));
    outlineUniforms.opacity.value = Math.min(1, between * 3.5) * 0.85;
  };

  const textures: THREE.Texture[] = [];
  const ready = Promise.all([loadTexture(sources.front), loadTexture(sources.left), loadTexture(sources.right)])
    .then(([front, left, right]) => {
      textures.push(front, left, right);
      uniforms.tFront.value = front;
      uniforms.tLeft.value = left;
      uniforms.tRight.value = right;
      uniforms.ready.value = 1;
    })
    .catch((err) => console.warn('[ApplicationMap3D] ilustração não carregou', err));

  return {
    mesh,
    outline,
    ready,
    dispose: () => {
      geometry.dispose();
      smooth.dispose();
      material.dispose();
      (outline.material as THREE.Material).dispose();
      textures.forEach((t) => t.dispose());
    },
  };
}

/** Interpolação linear numa tabela [x, y] ordenada por x (extrapola nas pontas). */
export function piecewise(table: [number, number][], x: number): number {
  let i = 1;
  while (i < table.length - 1 && x > table[i][0]) i++;
  const [x0, y0] = table[i - 1];
  const [x1, y1] = table[i];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/** Valor da borda da silhueta na linha `y` (px), interpolado; `null` sem desenho. */
export function edgeAt(rows: number[], step: number, y: number, side: 0 | 1): number | null {
  const n = rows.length / 2;
  const f = Math.min(n - 1, Math.max(0, y / step));
  const i = Math.floor(f);
  const j = Math.min(n - 1, i + 1);
  const a = rows[i * 2 + side];
  const b = rows[j * 2 + side];
  if (a < 0 && b < 0) return null;
  if (a < 0) return b;
  if (b < 0) return a;
  return a + (b - a) * (f - i);
}
