import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApplicationMapPoint, ApplicationMapStroke } from '../../../types';
import { edgeAt, piecewise } from './projected';
import { smoothstep } from './common';
import { MarksLayer, addLights, buildModel } from './scene';
import { renderSnapshot, snapshotAngles, snapshotReady } from './snapshot';

// jsdom não tem WebGL: o renderizador é um stub e o resto da cena (geometrias, shaders) roda de verdade.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = { toDataURL: () => 'data:image/png;base64,AAAA' };
    outputColorSpace = '';
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    setClearColor = vi.fn();
    render = vi.fn();
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

const ctxStub = new Proxy({}, { get: () => () => undefined, set: () => true });

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub as unknown as CanvasRenderingContext2D);
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_src, onLoad) => {
    const tex = new THREE.Texture() as THREE.Texture<HTMLImageElement>;
    onLoad?.(tex);
    return tex;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('helpers de superfície', () => {
  it('smoothstep limita em 0 e 1 e suaviza no meio', () => {
    expect(smoothstep(0, 1, -2)).toBe(0);
    expect(smoothstep(0, 1, 5)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });

  it('piecewise interpola e extrapola nas pontas', () => {
    const table: [number, number][] = [
      [0, 0],
      [10, 100],
      [20, 100],
    ];
    expect(piecewise(table, 5)).toBe(50);
    expect(piecewise(table, 15)).toBe(100);
    expect(piecewise(table, -10)).toBe(-100);
    expect(piecewise(table, 30)).toBe(100);
  });

  it('edgeAt interpola a borda da silhueta e devolve null sem desenho', () => {
    const rows = [-1, -1, 10, 20, 30, 40];
    expect(edgeAt(rows, 2, 0, 0)).toBe(10);
    expect(edgeAt(rows, 2, 2, 0)).toBe(10);
    expect(edgeAt(rows, 2, 3, 0)).toBe(20);
    expect(edgeAt(rows, 2, 3, 1)).toBe(30);
    expect(edgeAt(rows, 2, 99, 1)).toBe(40);
    expect(edgeAt([-1, -1, -1, -1], 2, 1, 0)).toBeNull();
  });
});

describe.each([['head3d' as const], ['body3d' as const]])('modelo %s', (view) => {
  it('monta a malha, acha pontos na superfície e descarta o que está fora', async () => {
    const model = buildModel(view);
    expect(model.markable.length).toBeGreaterThan(0);
    expect(model.camera.distance).toBeGreaterThan(0);
    expect(model.scale).toBeGreaterThan(0);
    await model.ready;

    let hits = 0;
    let misses = 0;
    let regions = 0;
    for (let x = 0; x <= 100; x += 5) {
      for (let y = 0; y <= 100; y += 5) {
        const at = model.pointAt(x, y);
        if (at) {
          hits++;
          expect(at.normal.length()).toBeGreaterThan(0.99);
          expect(at.normal.length()).toBeLessThan(1.01);
        } else misses++;
        if (model.regionAt?.(x, y)) regions++;
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(misses).toBeGreaterThanOrEqual(0);
    if (view === 'body3d') expect(regions).toBeGreaterThan(0);
    model.dispose();
  });

  it('segue funcionando quando as ilustrações não carregam', async () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_src, _ok, _p, onError) => {
      onError?.(new Error('falhou'));
      return new THREE.Texture() as THREE.Texture<HTMLImageElement>;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const model = buildModel(view);
    await model.ready;
    expect(warn).toHaveBeenCalled();
    model.dispose();
  });

  it('camada de marcas desenha pontos, aplicador, traços e rascunho só da vista', () => {
    const model = buildModel(view);
    const marks = new MarksLayer(model, view);
    const inside = findInside(model);
    const points: ApplicationMapPoint[] = [
      { x: inside[0], y: inside[1], product: 'toxin', qty: 4, view },
      { x: inside[0], y: inside[1], product: 'cryolipolysis', qty: 2, view },
      { x: inside[0], y: inside[1], view },
      { x: inside[0], y: inside[1], product: 'filler', view: 'front' },
      { x: -50, y: -50, product: 'toxin', view },
    ];
    const near = [inside[0], inside[1], inside[0] + 0.2, inside[1] + 0.2];
    const strokes: ApplicationMapStroke[] = [
      { view, color: '#e53935', width: 1, points: near },
      { view, color: '#1e88e5', width: 1, points: [inside[0], inside[1]] },
      { view: 'front', color: '#000000', width: 1, points: near },
    ];
    marks.update(points, strokes, 0, { points: near, color: '#2e7d32', width: 2 });
    // pontos da vista dentro do modelo + traços da vista + rascunho
    expect(marks.group.children).toHaveLength(7);
    marks.update([], [], null);
    expect(marks.group.children).toHaveLength(0);
    marks.update(points, [], 1);
    expect(marks.group.children).toHaveLength(4);
    marks.dispose();
    model.dispose();
  });

  it('miniaturas: ângulos pela normal das marcas e render devolve data URL', async () => {
    const [x, y] = findInside(buildModel(view));
    await snapshotReady(view);
    expect(snapshotAngles(view, [], [])).toEqual([0]);
    const angles = snapshotAngles(
      view,
      [{ x, y, product: 'toxin', view }],
      [{ view, color: '#000', width: 1, points: [x, y, x, y] }, { view, color: '#000', width: 1, points: [] }],
    );
    expect(angles).toContain(0);
    expect(renderSnapshot(view, [{ x, y, view }], [], 0, 200, 300)).toBe('data:image/png;base64,AAAA');
  });
});

describe('cena', () => {
  it('addLights adiciona três luzes', () => {
    const scene = new THREE.Scene();
    addLights(scene);
    expect(scene.children).toHaveLength(3);
  });
});

/** Coordenada (%) que cai dentro da superfície do modelo. */
function findInside(model: ReturnType<typeof buildModel>): [number, number] {
  for (let y = 50; y <= 100; y += 5) {
    for (let x = 20; x <= 80; x += 5) if (model.pointAt(x, y)) return [x, y];
  }
  for (let y = 0; y < 50; y += 5) {
    for (let x = 0; x <= 100; x += 5) if (model.pointAt(x, y)) return [x, y];
  }
  throw new Error('modelo sem superfície marcável');
}
