import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApplicationMapCanvas } from './ApplicationMapCanvas';
import type { ApplicationMapPoint } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

function setup(props: Partial<Parameters<typeof ApplicationMapCanvas>[0]> = {}) {
  const handlers = {
    onViewChange: vi.fn(),
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onQtyChange: vi.fn(),
    onRemove: vi.fn(),
  };
  const points: ApplicationMapPoint[] = [
    { x: 40, y: 50, product: 'toxin', qty: 4 },
    { x: 60, y: 10, product: 'filler', view: 'left' },
  ];
  render(
    <ApplicationMapCanvas
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

describe('ApplicationMapCanvas', () => {
  it('clamp e arredonda as coordenadas do clique em porcentagem', () => {
    const { onAdd } = setup();
    const area = screen.getByRole('img', { name: 'Mapa de aplicação: frente' });
    area.getBoundingClientRect = () =>
      ({ left: 10, top: 10, width: 300, height: 600, right: 310, bottom: 610, x: 10, y: 10, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(area, { clientX: 110, clientY: 310 });
    expect(onAdd).toHaveBeenLastCalledWith({ x: 33.3, y: 50 });
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

  it('troca de vista do rosto e esconde o seletor na vista corporal', async () => {
    const { onViewChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Perfil direito' }));
    expect(onViewChange).toHaveBeenCalledWith('right');
    expect(screen.getByRole('button', { name: 'Frente' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('esconde o seletor de vistas no corpo', () => {
    setup({ view: 'body' });
    expect(screen.queryByRole('button', { name: 'Frente' })).not.toBeInTheDocument();
  });

  it('zoom respeita os limites', async () => {
    setup();
    const more = screen.getByRole('button', { name: 'Mais zoom' });
    const less = screen.getByRole('button', { name: 'Menos zoom' });
    for (let i = 0; i < 5; i++) await userEvent.click(more);
    expect(more).toBeDisabled();
    for (let i = 0; i < 7; i++) await userEvent.click(less);
    expect(less).toBeDisabled();
    expect(more).toBeEnabled();
  });
});
