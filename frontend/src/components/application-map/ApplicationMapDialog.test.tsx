import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApplicationMapDialog } from './ApplicationMapDialog';
import type { ApplicationMapPoint, ApplicationMapProduct } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

let latest: ApplicationMapPoint[] = [];

function Harness({
  initial = [],
  products = [],
  defaultRegion = 'face',
  regionLocked = false,
  onClose = () => {},
}: {
  initial?: ApplicationMapPoint[];
  products?: ApplicationMapProduct[];
  defaultRegion?: 'face' | 'body';
  regionLocked?: boolean;
  onClose?: () => void;
}) {
  const [points, setPoints] = useState<ApplicationMapPoint[]>(initial);
  latest = points;
  return (
    <ApplicationMapDialog
      open
      onClose={onClose}
      points={points}
      setPoints={setPoints}
      products={products}
      defaultRegion={defaultRegion}
      regionLocked={regionLocked}
    />
  );
}

function clickMap(label: string, x: number, y: number) {
  const area = screen.getByRole('img', { name: label });
  area.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 400, right: 200, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  fireEvent.click(area, { clientX: x, clientY: y });
}

beforeEach(() => {
  latest = [];
});

describe('ApplicationMapDialog', () => {
  it('marca um ponto no mapa com o produto escolhido e grava a dose digitada', async () => {
    render(<Harness products={['toxin', 'filler']} />);
    expect(screen.getByText('Total de pontos')).toBeInTheDocument();
    expect(screen.queryByText('Skinbooster')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Preenchimento/ }));
    clickMap('Mapa de aplicação: frente', 100, 100);

    expect(latest).toEqual([{ x: 50, y: 25, product: 'filler', view: 'front' }]);
    const qty = screen.getByRole('textbox', { name: 'Quantidade do ponto 1 em ml' });
    await userEvent.type(qty, '1,5x');
    expect(qty).toHaveValue('1,5');
    expect(latest[0].qty).toBe(1.5);
    expect(screen.getByRole('button', { name: /Preenchimento.*1 pts · 1,5 ml/ })).toBeInTheDocument();

    await userEvent.clear(qty);
    expect(latest[0]).not.toHaveProperty('qty');
  });

  it('remove o ponto pelo editor e limpa todos pelo rodapé', async () => {
    render(
      <Harness
        initial={[
          { x: 10, y: 10, product: 'toxin', qty: 3 },
          { x: 20, y: 50, product: 'toxin', qty: 2 },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Editar ponto 2/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Remover ponto 2' }));
    expect(latest).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Limpar pontos' }));
    expect(latest).toEqual([]);
    expect(screen.getByRole('button', { name: 'Limpar pontos' })).toBeDisabled();
  });

  it('troca entre Facial e Corporal e entre vistas do rosto; esconde o seletor quando a região é fixa', async () => {
    const { unmount } = render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Perfil esquerdo' }));
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: perfil esquerdo' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Corporal' }));
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: corporal' })).toBeInTheDocument();
    clickMap('Mapa de aplicação: corporal', 20, 40);
    expect(latest[0]).toMatchObject({ view: 'body', x: 10, y: 10 });
    unmount();

    render(<Harness defaultRegion="body" regionLocked />);
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: corporal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Facial' })).not.toBeInTheDocument();
  });

  it('mantém a linha de produtos já marcados fora da lista do atendimento e fecha em Concluir', async () => {
    const onClose = vi.fn();
    render(
      <Harness
        products={['toxin']}
        initial={[{ x: 1, y: 1, product: 'skinbooster' }]}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('button', { name: /^Skinbooster/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bioestimulador/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(onClose).toHaveBeenCalled();
  });
});
