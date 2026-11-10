import * as THREE from 'three';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ApplicationMap3D from './ApplicationMap3D';
import type { ApplicationMapPoint, ApplicationMapStroke } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

// jsdom não tem WebGL: o renderizador é um stub que só atualiza as matrizes (para o raycast) e o resto roda de verdade.
const webgl = vi.hoisted(() => ({ fail: false }));
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = document.createElement('canvas');
    outputColorSpace = '';
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
    constructor() {
      if (webgl.fail) throw new Error('sem webgl');
      this.domElement.setPointerCapture = vi.fn();
      this.domElement.releasePointerCapture = vi.fn();
      this.domElement.hasPointerCapture = vi.fn(() => false);
    }
    render(scene: THREE.Scene, camera: THREE.Camera) {
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
    }
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

if (!('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventPolyfill, configurable: true });
}

beforeEach(() => {
  webgl.fail = false;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_src, onLoad) => {
    const tex = new THREE.Texture() as THREE.Texture<HTMLImageElement>;
    onLoad?.(tex);
    return tex;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
  );
  // O host tem tamanho 0 no jsdom, e o resize ignora isso.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(props: Partial<Parameters<typeof ApplicationMap3D>[0]> = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onQtyChange: vi.fn(),
    onRemove: vi.fn(),
    onAddStroke: vi.fn(),
    onRemoveStroke: vi.fn(),
    onUnavailable: vi.fn(),
  };
  const utils = render(
    <ApplicationMap3D
      view="body3d"
      points={[]}
      strokes={[]}
      tool="point"
      strokeColor="#e53935"
      strokeWidth={1}
      selectedIndex={null}
      height={400}
      autoFocusQty={false}
      {...handlers}
      {...props}
    />,
  );
  const canvas = utils.container.querySelector('canvas') as HTMLCanvasElement;
  return { ...utils, ...handlers, canvas };
}

const fire = (canvas: HTMLCanvasElement, type: string, x: number, y: number, id = 1) =>
  act(() => {
    canvas.dispatchEvent(
      new PointerEvent(type, { clientX: x, clientY: y, button: 0, pointerId: id, bubbles: true, cancelable: true }),
    );
  });

/** Primeira posição na tela (grade de 400 px) em que o raio acerta o modelo. */
function findHit(canvas: HTMLCanvasElement, onAdd: ReturnType<typeof vi.fn>): [number, number] {
  for (let y = 60; y < 400; y += 40) {
    for (let x = 140; x < 280; x += 20) {
      onAdd.mockClear();
      fire(canvas, 'pointerdown', x, y);
      fire(canvas, 'pointerup', x, y);
      if (onAdd.mock.calls.length) return [x, y];
    }
  }
  throw new Error('nenhum acerto no modelo');
}

describe('ApplicationMap3D', () => {
  it('sem WebGL mostra o aviso e oferece voltar para a ilustração 2D', async () => {
    webgl.fail = true;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { onUnavailable } = setup();
    expect(screen.getByText(/Não foi possível abrir o modelo 3D/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usar a ilustração 2D' }));
    expect(onUnavailable).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Frente' })).not.toBeInTheDocument();
  });

  it('clique no modelo marca o ponto com x/y em % e região; arrastar não marca', () => {
    const { canvas, onAdd } = setup();
    expect(screen.getByRole('img', { name: 'Modelo 3D ilustrado do corpo' })).toBeInTheDocument();
    const [x, y] = findHit(canvas, onAdd);
    const arg = onAdd.mock.calls[0][0];
    expect(arg.x).toBeGreaterThanOrEqual(0);
    expect(arg.y).toBeLessThanOrEqual(100);
    onAdd.mockClear();
    fire(canvas, 'pointerdown', x, y);
    fire(canvas, 'pointerup', x + 30, y);
    expect(onAdd).not.toHaveBeenCalled();
    // botão direito gira, não marca
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 2, pointerId: 1, bubbles: true }));
    });
    fire(canvas, 'pointerup', x, y);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('clique fora do modelo é ignorado', () => {
    const { canvas, onAdd } = setup();
    fire(canvas, 'pointerdown', 0, 0);
    fire(canvas, 'pointerup', 0, 0);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('clicar num ponto existente seleciona; com a borracha apaga o ponto ou o traço', () => {
    const probe = setup();
    const [x, y] = findHit(probe.canvas, probe.onAdd);
    const at = probe.onAdd.mock.calls[0][0] as { x: number; y: number };
    probe.unmount();

    const points: ApplicationMapPoint[] = [{ x: at.x, y: at.y, product: 'toxin', view: 'body3d' }];
    const select = setup({ points });
    fire(select.canvas, 'pointerdown', x, y);
    fire(select.canvas, 'pointerup', x, y);
    expect(select.onSelect).toHaveBeenCalledWith(0);
    expect(select.onAdd).not.toHaveBeenCalled();
    select.unmount();

    const erase = setup({ points, tool: 'erase' });
    fire(erase.canvas, 'pointerdown', x, y);
    fire(erase.canvas, 'pointerup', x, y);
    expect(erase.onRemove).toHaveBeenCalledWith(0);
    erase.unmount();

    const strokes: ApplicationMapStroke[] = [{ view: 'body3d', color: '#e53935', width: 1, points: [at.x, at.y] }];
    const eraseStroke = setup({ strokes, tool: 'erase' });
    fire(eraseStroke.canvas, 'pointerdown', x, y);
    fire(eraseStroke.canvas, 'pointerup', x, y);
    expect(eraseStroke.onRemoveStroke).toHaveBeenCalledWith(0);
  });

  it('no desenho, arrastar sobre o modelo grava um traço com os pontos percorridos', () => {
    const probe = setup();
    const [x, y] = findHit(probe.canvas, probe.onAdd);
    probe.unmount();

    const { canvas, onAddStroke, onAdd } = setup({ tool: 'draw', strokeColor: '#1e88e5', strokeWidth: 2 });
    fire(canvas, 'pointerdown', x, y);
    fire(canvas, 'pointermove', x + 8, y + 8);
    fire(canvas, 'pointermove', x + 16, y + 16, 99); // outro ponteiro: ignorado
    fire(canvas, 'pointermove', 0, 0); // fora do modelo: ignorado
    fire(canvas, 'pointerup', x + 8, y + 8);
    expect(onAddStroke).toHaveBeenCalledTimes(1);
    expect(onAddStroke.mock.calls[0][0]).toMatchObject({ view: 'body3d', color: '#1e88e5', width: 2 });
    expect(onAddStroke.mock.calls[0][0].points.length).toBeGreaterThanOrEqual(2);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('botões de giro posicionam a câmera e o editor aparece para o ponto selecionado', async () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    setup({ view: 'head3d', points: [{ x: 50, y: 50, product: 'toxin', qty: 3, view: 'head3d' }], selectedIndex: 0, onSelect, onRemove });
    for (const label of ['Perfil dir.', '¾ dir.', 'Frente', '¾ esq.', 'Perfil esq.']) {
      await userEvent.click(screen.getByRole('button', { name: label }));
    }
    expect(screen.getByRole('textbox', { name: 'Quantidade do ponto 1 em U' })).toHaveValue('3');
    await userEvent.click(screen.getByRole('button', { name: 'Remover ponto 1' }));
    expect(onRemove).toHaveBeenCalledWith(0);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar editor do ponto' }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('mostra o toolbar, refaz a cena ao trocar de vista e limpa ao desmontar', () => {
    const { rerender, unmount, container } = setup({ toolbar: <span>barra</span> });
    expect(screen.getByText('barra')).toBeInTheDocument();
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    rerender(
      <ApplicationMap3D
        view="head3d"
        points={[]}
        strokes={[]}
        tool="erase"
        strokeColor="#000"
        strokeWidth={1}
        selectedIndex={null}
        height={400}
        autoFocusQty={false}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onQtyChange={vi.fn()}
        onRemove={vi.fn()}
        onAddStroke={vi.fn()}
        onRemoveStroke={vi.fn()}
        onUnavailable={vi.fn()}
      />,
    );
    expect(screen.getByRole('img', { name: 'Modelo 3D ilustrado da cabeça' })).toBeInTheDocument();
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    unmount();
  });
});
