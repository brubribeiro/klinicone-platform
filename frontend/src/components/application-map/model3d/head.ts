import * as THREE from 'three';

import {
  HAIR,
  LINE,
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
 * Cabeça ilustrada genérica (vista `head3d`): superfície paramétrica com o rosto em relevo
 * (nariz, lábios, queixo, malar) e traços desenhados na textura (sobrancelhas, olhos fechados,
 * lábios). A textura cobre a cabeça em y = 0–80 % e o pescoço em 80–100 %; x dá a volta na
 * cabeça com a frente do rosto em x = 50 %.
 */

/** Parte da textura ocupada pela cabeça; o resto é o pescoço. */
const HEAD_V = 0.8;
const RY = 1.12;
const CENTER_Z = -0.12;
const TEX_W = 2048;
const TEX_H = 1792;

/** Meia-largura da cabeça pela altura (dy = y / RY): crânio largo, mandíbula afinando até o queixo. */
const RX_TABLE: [number, number][] = [
  [-1, 0.42],
  [-0.9, 0.52],
  [-0.62, 0.71],
  [-0.3, 0.8],
  [0, 0.8],
  [1, 0.76],
];
const rxAt = (dy: number) => curve(RX_TABLE, dy);

/** Relevo do rosto (somado ao z) em coordenadas do rosto: X para o lado, Y para cima. */
function faceRelief(X: number, Y: number): number {
  const ax = Math.abs(X);
  let d = 0;
  d -= 0.085 * gauss(ax, Y, 0.3, 0.05, 0.16, 0.1); // órbitas
  d += 0.05 * gauss(ax, Y, 0.28, 0.24, 0.22, 0.07); // arco da sobrancelha
  d += 0.06 * gauss(ax, Y, 0.45, -0.13, 0.16, 0.14); // malar
  d += 0.04 * gauss(X, Y, 0, -0.5, 0.32, 0.2); // maxila
  // Nariz: dorso subindo do radix até a ponta e caindo até a base da columela.
  let h = 0;
  if (Y <= 0.16 && Y >= -0.3) h = 0.29 * ((0.16 - Y) / 0.46) ** 1.25;
  else if (Y < -0.3) h = 0.29 * (1 - smoothstep(-0.3, -0.43, Y));
  const width = 0.055 + 0.06 * smoothstep(0.1, -0.32, Y);
  d += h * Math.exp(-((X / width) ** 2));
  d += 0.035 * gauss(X, Y, 0, -0.3, 0.07, 0.06); // ponta
  d += 0.06 * gauss(ax, Y, 0.1, -0.34, 0.055, 0.05); // asas
  // Lábios e queixo.
  d += 0.065 * gauss(X, Y, 0, -0.56, 0.2, 0.045);
  d += 0.075 * gauss(X, Y, 0, -0.655, 0.17, 0.045);
  d -= 0.03 * gauss(X, Y, 0, -0.605, 0.2, 0.012);
  d -= 0.03 * gauss(X, Y, 0, -0.76, 0.15, 0.04);
  d += 0.12 * gauss(X, Y, 0, -0.88, 0.17, 0.09);
  return d;
}

function headFn(u: number, v: number, out: THREE.Vector3) {
  const theta = (u - 0.5) * Math.PI * 2;
  const phi = v * Math.PI;
  const sinPhi = Math.sin(phi);
  const dy = Math.cos(phi);
  const dx = sinPhi * Math.sin(theta);
  const dz = sinPhi * Math.cos(theta);
  const X = rxAt(dy) * dx;
  const Y = RY * dy;
  // Frente um pouco achatada; nuca mais funda; mandíbula puxada para a frente.
  let z = dz > 0 ? 0.92 * dz * (1.25 - 0.25 * dz) : 0.98 * dz;
  z += CENTER_Z + 0.28 * smoothstep(0, -1, dy);
  z += faceRelief(X, Y) * smoothstep(0.3, 0.75, dz);
  out.set(X, Y, z);
}

function neckFn(u: number, s: number, out: THREE.Vector3) {
  const theta = (u - 0.5) * Math.PI * 2;
  const rx = 0.43 + 0.08 * s;
  const rz = 0.4 + 0.03 * s;
  out.set(rx * Math.sin(theta), -0.55 - 1.5 * s, -0.12 - 0.1 * s + rz * Math.cos(theta));
}

/** Linha do cabelo (y) pelo ângulo em volta da cabeça: testa, têmporas, acima da orelha, nuca. */
const HAIRLINE: [number, number][] = [
  [0, 0.74],
  [0.45, 0.7],
  [0.75, 0.58],
  [1.0, 0.5],
  [1.2, 0.45],
  [1.4, 0.42],
  [1.65, 0.3],
  [2.1, -0.3],
  [Math.PI, -0.5],
];

function hairMask(u: number, v: number) {
  const theta = Math.abs((u - 0.5) * Math.PI * 2);
  const Y = RY * Math.cos(v * Math.PI);
  return smoothstep(0, 0.06, Y - curve(HAIRLINE, theta));
}

function hairFn(u: number, v: number, out: THREE.Vector3) {
  headFn(u, v, out);
  const m = hairMask(u, v);
  const dir = new THREE.Vector3(out.x, out.y - 0.1, out.z - CENTER_Z).normalize();
  out.addScaledVector(dir, 0.012 + 0.05 * m);
}

/** Coordenadas do rosto → pixels da textura (inversa exata: o relevo só mexe no z). */
function faceToTex(X: number, Y: number): [number, number] {
  const dy = Math.min(1, Math.max(-1, Y / RY));
  const phi = Math.acos(dy);
  const s = Math.min(1, Math.max(-1, X / (rxAt(dy) * Math.sin(phi))));
  const u = Math.asin(s) / (Math.PI * 2) + 0.5;
  return [u * TEX_W, (phi / Math.PI) * HEAD_V * TEX_H];
}

/** Catmull-Rom pelos pontos de controle, amostrada para seguir a curvatura da textura. */
function smoothCurve(ctrl: [number, number][], samples = 16): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < samples; k++) {
      const t = k / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

function tracePath(ctx: CanvasRenderingContext2D, pts: [number, number][], close = false) {
  ctx.beginPath();
  pts.forEach(([X, Y], i) => {
    const [px, py] = faceToTex(X, Y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  if (close) ctx.closePath();
}

const mirror = (pts: [number, number][]) => pts.map(([x, y]) => [-x, y] as [number, number]);

/** Contorno de uma faixa que afina: `width(t)` em unidades do rosto ao longo da curva. */
function taperedShape(line: [number, number][], width: (t: number) => number): [number, number][] {
  const up: [number, number][] = [];
  const down: [number, number][] = [];
  line.forEach((p, i) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    const w = width(i / (line.length - 1)) / 2;
    up.push([p[0] - (ty / len) * w, p[1] + (tx / len) * w]);
    down.push([p[0] + (ty / len) * w, p[1] - (tx / len) * w]);
  });
  return [...up, ...down.reverse()];
}

function paintHeadTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = SKIN;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const side of [1, -1]) {
    const m = (pts: [number, number][]) => (side === 1 ? pts : mirror(pts));
    // Blush suave no malar.
    const [bx, by] = faceToTex(0.42 * side, -0.25);
    const blush = ctx.createRadialGradient(bx, by, 0, bx, by, 90);
    blush.addColorStop(0, 'rgba(232,140,130,.2)');
    blush.addColorStop(1, 'rgba(232,140,130,0)');
    ctx.fillStyle = blush;
    ctx.fillRect(bx - 100, by - 100, 200, 200);

    // Sobrancelha: traço que afina para a cauda.
    const brow = smoothCurve(
      m([
        [0.11, 0.215],
        [0.22, 0.258],
        [0.33, 0.282],
        [0.42, 0.268],
        [0.49, 0.228],
      ]),
    );
    tracePath(
      ctx,
      taperedShape(brow, (t) => 0.036 - 0.024 * t),
      true,
    );
    ctx.fillStyle = '#8a6252';
    ctx.fill();

    // Olho fechado: pálpebra, cílios e o vinco acima.
    const lid = smoothCurve(
      m([
        [0.15, 0.062],
        [0.22, 0.036],
        [0.3, 0.026],
        [0.38, 0.036],
        [0.455, 0.07],
      ]),
    );
    tracePath(ctx, lid);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 6;
    ctx.stroke();
    for (let i = Math.floor(lid.length * 0.4); i < lid.length; i += 5) {
      const [x, y] = lid[i];
      const t = i / (lid.length - 1);
      tracePath(ctx, [
        [x, y],
        [x + side * (0.006 + 0.02 * t), y - 0.03 + 0.008 * t],
      ]);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    tracePath(
      ctx,
      smoothCurve(
        m([
          [0.17, 0.1],
          [0.3, 0.085],
          [0.43, 0.11],
        ]),
      ),
    );
    ctx.strokeStyle = 'rgba(150,100,85,.35)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Narina e asa do nariz.
    const [nx, ny] = faceToTex(0.055 * side, -0.387);
    ctx.fillStyle = 'rgba(140,90,78,.75)';
    ctx.beginPath();
    ctx.ellipse(nx, ny, 13, 7, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    tracePath(
      ctx,
      smoothCurve(
        m([
          [0.09, -0.29],
          [0.125, -0.33],
          [0.12, -0.375],
          [0.085, -0.39],
        ]),
      ),
    );
    ctx.strokeStyle = 'rgba(150,100,85,.45)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Lábios: arco do cupido, lábio inferior e linha da boca.
  const upper = smoothCurve([
    [-0.2, -0.602],
    [-0.12, -0.565],
    [-0.05, -0.527],
    [0, -0.541],
    [0.05, -0.527],
    [0.12, -0.565],
    [0.2, -0.602],
  ]);
  const mouth = smoothCurve([
    [0.2, -0.602],
    [0.1, -0.612],
    [0, -0.606],
    [-0.1, -0.612],
    [-0.2, -0.602],
  ]);
  tracePath(ctx, [...upper, ...mouth], true);
  ctx.fillStyle = '#d58a83';
  ctx.fill();
  const lower = smoothCurve([
    [-0.2, -0.602],
    [-0.12, -0.665],
    [0, -0.692],
    [0.12, -0.665],
    [0.2, -0.602],
  ]);
  tracePath(ctx, [...lower, ...mouth], true);
  ctx.fillStyle = '#e09a92';
  ctx.fill();
  const [hx, hy] = faceToTex(0, -0.655);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath();
  ctx.ellipse(hx, hy, 46, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  tracePath(ctx, mouth);
  ctx.strokeStyle = '#a65e5a';
  ctx.lineWidth = 4;
  ctx.stroke();

  return canvas;
}

/** Textura do cabelo; o alfa recorta a linha do cabelo com borda lisa (a malha é mais larga). */
function paintHairTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = HAIR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const m = hairMask((x + 0.5) / canvas.width, (y + 0.5) / canvas.height);
      img.data[(y * canvas.width + x) * 4 + 3] = Math.round(m * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  // Fios penteados para trás (linhas que descem pelo meridiano).
  ctx.lineWidth = 3;
  for (let i = 0; i < 90; i++) {
    const x = (i / 90) * canvas.width + (i % 3) * 6;
    ctx.strokeStyle = i % 2 ? 'rgba(255,225,200,.10)' : 'rgba(40,20,10,.14)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 12, 240, x - 12, 520, x + 8, 820);
    ctx.stroke();
  }
  return canvas;
}

export function buildHeadModel(): SurfaceModel {
  const group = new THREE.Group();

  const skinMap = skinTexture(paintHeadTexture());
  const skin = toonMaterial({ map: skinMap });
  const plainSkin = toonMaterial({ color: SKIN });
  const headGeo = parametricGeometry(headFn, 288, 216, { x: 0, y: 0, w: 1, h: HEAD_V });
  const neckGeo = parametricGeometry(neckFn, 128, 24, { x: 0, y: HEAD_V, w: 1, h: 1 - HEAD_V });
  const head = new THREE.Mesh(headGeo, skin);
  const neck = new THREE.Mesh(neckGeo, skin);

  const hairMap = skinTexture(paintHairTexture());
  const hairGeo = parametricGeometry(hairFn, 192, 144, undefined, (u, v) => hairMask(u, v) > 0.005 || v < 0.25);
  const hairMaterial = toonMaterial({ map: hairMap, cutout: true });
  const hair = new THREE.Mesh(hairGeo, hairMaterial);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.33, 48, 32), toonMaterial({ color: HAIR }));
  bun.scale.set(1, 0.85, 0.8);
  bun.position.set(0, 0.62, -1.17);

  const ears = [1, -1].map((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), plainSkin);
    ear.scale.set(0.09, 0.29, 0.18);
    ear.position.set(0.78 * side, -0.02, -0.1);
    ear.rotation.set(-0.25, 0.3 * side, 0);
    return ear;
  });

  // Busto (ombros) cortado embaixo, como uma escultura.
  const bustGeo = new THREE.SphereGeometry(1, 72, 36, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const bust = new THREE.Mesh(bustGeo, plainSkin);
  bust.scale.set(1.75, 0.8, 0.82);
  bust.position.set(0, -2.3, -0.25);

  const solids = [head, neck, hair, bun, ...ears, bust];
  group.add(...solids);
  for (const mesh of solids) {
    const outline = outlineMesh(
      mesh.geometry,
      0.012 / Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z),
      undefined,
      mesh === hair ? hairMap : undefined,
    );
    outline.position.copy(mesh.position);
    outline.rotation.copy(mesh.rotation);
    outline.scale.copy(mesh.scale);
    group.add(outline);
  }

  const pointAt = (x: number, y: number) => {
    const u = Math.min(1, Math.max(0, x / 100));
    const v = Math.min(1, Math.max(0, y / 100));
    const fn =
      v <= HEAD_V
        ? (uu: number, vv: number, o: THREE.Vector3) => headFn(uu, vv / HEAD_V, o)
        : (uu: number, vv: number, o: THREE.Vector3) => neckFn(uu, (vv - HEAD_V) / (1 - HEAD_V), o);
    const position = new THREE.Vector3();
    fn(u, v, position);
    const normal = surfaceNormal(fn, u, v, new THREE.Vector3());
    return { position, normal };
  };

  return {
    group,
    markable: [head, neck],
    pointAt,
    scale: 2.4,
    pointRadius: 0.056,
    camera: {
      target: new THREE.Vector3(0, -0.2, 0),
      distance: 7.6,
      minDistance: 2.6,
      maxDistance: 11,
      fov: 30,
    },
    dispose: () => disposeGroup(group),
  };
}
