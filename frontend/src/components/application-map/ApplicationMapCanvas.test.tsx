import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApplicationMapCanvas } from './ApplicationMapCanvas';
import type { ApplicationMapPoint } from '../../types';
import { FULL_CROP, MAP_VIEWS } from './applicationMapModel';

vi.setConfig({ testTimeout: 30_000 });

// jsdom não tem PointerEvent: sem ele o React recebe um Event simples, sem button/clientX/pointerId.
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

function setup(props: Partial<Parameters<typeof ApplicationMapCanvas>[0]> = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onQtyChange: vi.fn(),
    onRemove: vi.fn(),
    onAddStroke: vi.fn(),
    onRemoveStroke: vi.fn(),
  };
  const points: ApplicationMapPoint[] = [
    { x: 40, y: 50, product: 'toxin', qty: 4 },
    { x: 60, y: 10, product: 'filler', view: 'left' },
  ];
  render(
    <ApplicationMapCanvas
      image={MAP_VIEWS.front}
      crop={FULL_CROP}
      strokes={[]}
      tool="point"
      strokeColor="#e53935"
      strokeWidth={1}
      points={points}
      view="front"
      selectedIndex={null}
      height={300}
      autoFocusQty={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

afterEach(() => {
  vi.restoreAllMocks();
});

function mockRect() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: 200, height: 400, right: 200, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
  );
}

describe('ApplicationMapCanvas', () => {
  it('no modo desenho grava o traço da vista com cor, espessura e pontos em %', () => {
    const { onAddStroke, onAdd } = setup({ tool: 'draw', strokeColor: '#1e88e5', strokeWidth: 2 });
    mockRect();
    const area = screen.getByRole('img', { name: 'Mapa de aplicação: frente' });
    area.setPointerCapture = vi.fn();
    fireEvent.pointerDown(area, { clientX: 20, clientY: 40, button: 0, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 100, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    expect(onAddStroke).toHaveBeenCalledTimes(1);
    const stroke = onAddStroke.mock.calls[0][0];
    expect(stroke).toMatchObject({ view: 'front', color: '#1e88e5', width: 2 });
    expect(stroke.points).toEqual([10, 10, 50, 50]);
    fireEvent.click(area, { clientX: 5, clientY: 5 });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('cancelar o ponteiro descarta o traço em andamento', () => {
    const { onAddStroke } = setup({ tool: 'draw' });
    mockRect();
    const area = screen.getByRole('img', { name: 'Mapa de aplicação: frente' });
    area.setPointerCapture = vi.fn();
    fireEvent.pointerDown(area, { clientX: 20, clientY: 40, button: 0, pointerId: 1 });
    fireEvent.pointerCancel(area);
    fireEvent.pointerUp(area);
    expect(onAddStroke).not.toHaveBeenCalled();
  });

  it('na borracha apaga ponto e traço pelo clique', async () => {
    const { onRemove, onRemoveStroke, onSelect } = setup({
      tool: 'erase',
      strokes: [{ view: 'front', color: '#e53935', width: 1, points: [10, 10, 20, 20] }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Apagar ponto 1 (Toxina Botulínica)' }));
    expect(onRemove).toHaveBeenCalledWith(0);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar traço 1' }));
    expect(onRemoveStroke).toHaveBeenCalledWith(0);
  });

  it('pontos sugeridos marcam o ponto na posição e ficam inertes fora do modo ponto', async () => {
    const guides = [{ x: 30, y: 40, label: 'Glabela' }];
    const { onAdd } = setup({ guides });
    await userEvent.click(screen.getByRole('button', { name: 'Marcar ponto sugerido: Glabela' }));
    expect(onAdd).toHaveBeenCalledWith({ x: 30, y: 40 });
  });

  it('mostra o toolbar e não tem pontos sugeridos clicáveis no desenho', () => {
    setup({ tool: 'draw', guides: [{ x: 1, y: 1, label: 'Testa' }], toolbar: <span>barra</span> });
    expect(screen.getByText('barra')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marcar ponto sugerido/ })).not.toBeInTheDocument();
  });

  it('clamp e arredonda as coordenadas do clique em porcentagem', () => {
    const { onAdd } = setup();
    const area = screen.getByRole('img', { name: 'Mapa de aplicação: frente' });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      { left: 10, top: 10, width: 300, height: 600, right: 310, bottom: 610, x: 10, y: 10, toJSON: () => ({}) } as DOMRect,
    );
    fireEvent.click(area, { clientX: 110, clientY: 310 });
    expect(onAdd).toHaveBeenLastCalledWith({ x: 33.33, y: 50 });
    fireEvent.click(area, { clientX: 0, clientY: 9999 });
    expect(onAdd).toHaveBeenLastCalledWith({ x: 0, y: 100 });
  });

  it('mostra só os pontos da vista atual, com dose, e seleciona ao clicar sem adicionar', async () => {
    const { onSelect, onAdd } = setup();
    expect(screen.queryByRole('button', { name: /Editar ponto 2/ })).not.toBeInTheDocument();
    const point = screen.getByRole('button', { name: 'Editar ponto 1 (Toxina Botulínica)' });
    expect(point).toHaveTextContent('4');
    await userEvent.click(point);
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('abre o editor do ponto selecionado: dose, remover e fechar', async () => {
    const { onQtyChange, onRemove, onSelect } = setup({ selectedIndex: 0 });
    const qty = screen.getByRole('textbox', { name: 'Quantidade do ponto 1 em U' });
    expect(qty).toHaveValue('4');
    await userEvent.type(qty, ',5a');
    expect(qty).toHaveValue('4,5');
    expect(onQtyChange).toHaveBeenLastCalledWith(0, 4.5);
    await userEvent.clear(qty);
    expect(onQtyChange).toHaveBeenLastCalledWith(0, undefined);
    await userEvent.type(qty, '{Enter}');
    expect(onSelect).toHaveBeenCalledWith(null);
    await userEvent.click(screen.getByRole('button', { name: 'Remover ponto 1' }));
    expect(onRemove).toHaveBeenCalledWith(0);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar editor do ponto' }));
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('exibe a anotação antiga do ponto sem produto no editor', () => {
    setup({ points: [{ x: 5, y: 5, note: 'Testa central' }], selectedIndex: 0 });
    expect(screen.getByText('Ponto 1')).toBeInTheDocument();
    expect(screen.getByText('Testa central')).toBeInTheDocument();
  });

  it('não mostra o editor quando o ponto selecionado é de outra vista', () => {
    setup({ selectedIndex: 1 });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('zoom respeita os limites', async () => {
    setup();
    const more = screen.getByRole('button', { name: 'Mais zoom' });
    const less = screen.getByRole('button', { name: 'Menos zoom' });
    for (let i = 0; i < 10; i++) await userEvent.click(more);
    expect(more).toBeDisabled();
    for (let i = 0; i < 12; i++) await userEvent.click(less);
    expect(less).toBeDisabled();
    expect(more).toBeEnabled();
  });
});
