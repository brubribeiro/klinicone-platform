import { useState, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApplicationMapDialog } from './ApplicationMapDialog';
import type { ApplicationMapPoint, ApplicationMapProduct } from '../../types';
import type { ApplicationMapDraft } from './applicationMapModel';

// WebGL não existe no jsdom: o modelo 3D vira um stub que expõe os callbacks que o diálogo liga.
vi.mock('./ApplicationMap3D', () => ({
  default: (props: {
    view: string;
    toolbar?: ReactNode;
    onAdd: (p: { x: number; y: number; region?: string }) => void;
    onUnavailable: () => void;
  }) => (
    <div>
      {props.toolbar}
      <span>3D {props.view}</span>
      <button onClick={() => props.onAdd({ x: 12, y: 34, region: 'abdomen' })}>stub-add</button>
      <button onClick={props.onUnavailable}>stub-unavailable</button>
    </div>
  ),
}));

vi.setConfig({ testTimeout: 30_000 });

let latest: ApplicationMapDraft = { points: [], strokes: [] };

function Harness({
  initial = [],
  initialStrokes = [],
  products = [],
  defaultRegion = 'face',
  regionLocked = false,
  onClose = () => {},
}: {
  initial?: ApplicationMapPoint[];
  initialStrokes?: ApplicationMapDraft['strokes'];
  products?: ApplicationMapProduct[];
  defaultRegion?: 'face' | 'body';
  regionLocked?: boolean;
  onClose?: () => void;
}) {
  const [map, setMap] = useState<ApplicationMapDraft>({ points: initial, strokes: initialStrokes });
  latest = map;
  return (
    <ApplicationMapDialog
      open
      onClose={onClose}
      map={map}
      setMap={setMap}
      products={products}
      defaultRegion={defaultRegion}
      regionLocked={regionLocked}
    />
  );
}

function clickMap(label: string, x: number, y: number) {
  const area = screen.getByRole('img', { name: label });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: 200, height: 400, right: 200, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
  );
  fireEvent.click(area, { clientX: x, clientY: y });
}

beforeEach(() => {
  latest = { points: [], strokes: [] };
  vi.restoreAllMocks();
});

describe('ApplicationMapDialog', () => {
  it('marca um ponto no mapa com o produto escolhido e grava a dose digitada', async () => {
    render(<Harness products={['toxin', 'filler']} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Frente' }));
    expect(screen.getByText('Total de pontos')).toBeInTheDocument();
    expect(screen.queryByText('Skinbooster')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Preenchimento/ }));
    clickMap('Mapa de aplicação: frente', 100, 100);

    expect(latest.points).toEqual([{ x: 50, y: 25, product: 'filler', view: 'front' }]);
    const qty = screen.getByRole('textbox', { name: 'Quantidade do ponto 1 em ml' });
    await userEvent.type(qty, '1,5x');
    expect(qty).toHaveValue('1,5');
    expect(latest.points[0].qty).toBe(1.5);
    expect(screen.getByRole('button', { name: /Preenchimento.*1 pts · 1,5 ml/ })).toBeInTheDocument();

    await userEvent.clear(qty);
    expect(latest.points[0]).not.toHaveProperty('qty');
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
    expect(latest.points).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Limpar mapa' }));
    expect(latest.points).toEqual([]);
    expect(screen.getByRole('button', { name: 'Limpar mapa' })).toBeDisabled();
  });

  it('troca entre Facial e Corporal e entre vistas do rosto; esconde o seletor quando a região é fixa', async () => {
    const { unmount } = render(<Harness />);
    expect(screen.getByText('3D head3d')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Perfil esquerdo' }));
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: perfil esquerdo' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Corporal' }));
    expect(screen.getByText('3D body3d')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ilustração 2D' }));
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: corporal' })).toBeInTheDocument();
    clickMap('Mapa de aplicação: corporal', 20, 40);
    expect(latest.points[0]).toMatchObject({ view: 'body', x: 10, y: 10 });
    unmount();

    render(<Harness defaultRegion="body" regionLocked initialStrokes={[{ view: 'body', color: '#e53935', width: 1, points: [1, 1, 2, 2] }]} />);
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

  it('abre no 3D, grava ponto com a região e volta para a ilustração quando o 3D não está disponível', async () => {
    render(<Harness products={['toxin']} defaultRegion="body" />);
    await userEvent.click(screen.getByRole('button', { name: 'stub-add' }));
    expect(latest.points).toEqual([{ x: 12, y: 34, product: 'toxin', view: 'body3d', region: 'abdomen' }]);
    await userEvent.click(screen.getByRole('button', { name: 'stub-unavailable' }));
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: corporal' })).toBeInTheDocument();
  });

  it('cai para a frente do rosto quando o 3D do rosto não está disponível', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'stub-unavailable' }));
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: frente' })).toBeInTheDocument();
  });

  it('zoom por região do rosto grava a região no ponto e mostra os pontos sugeridos', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Frente' }));
    const group = screen.getByRole('group', { name: 'Zoom por região' });
    const chips = within(group).getAllByRole('button');
    await userEvent.click(chips[1]);
    expect(chips[1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/pontos de aplicação sugeridos/)).toBeInTheDocument();
    const guide = screen.getAllByRole('button', { name: /Marcar ponto sugerido/ })[0];
    await userEvent.click(guide);
    expect(latest.points[0]).toMatchObject({ product: 'toxin', region: expect.any(String) });
    await userEvent.click(within(group).getAllByRole('button')[0]);
    expect(screen.queryByText(/pontos de aplicação sugeridos/)).not.toBeInTheDocument();
  });

  it('zoom por região do corpo na ilustração 2D grava a região', async () => {
    render(<Harness defaultRegion="body" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ilustração 2D' }));
    const group = screen.getByRole('group', { name: 'Zoom por região' });
    await userEvent.click(within(group).getAllByRole('button')[1]);
    clickMap('Mapa de aplicação: corporal', 100, 100);
    expect(latest.points[0]).toMatchObject({ view: 'body', region: expect.any(String) });
  });

  it('desenha, escolhe cor e espessura e desfaz o último traço da vista', async () => {
    render(
      <Harness
        defaultRegion="body"
        initial={[{ x: 1, y: 1, view: 'body' }]}
        initialStrokes={[
          { view: 'body', color: '#e53935', width: 1, points: [1, 1, 2, 2] },
          { view: 'body', color: '#1e88e5', width: 1, points: [3, 3, 4, 4] },
          { view: 'front', color: '#1e88e5', width: 1, points: [3, 3, 4, 4] },
        ]}
      />,
    );
    const undo = () => screen.getByRole('button', { name: 'Desfazer último traço' });
    expect(screen.queryByRole('group', { name: 'Cor e espessura do traço' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desenho' }));
    expect(screen.getByText(/Arraste sobre o mapa para desenhar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cor #2e7d32' }));
    expect(screen.getByRole('button', { name: 'Cor #2e7d32' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Grosso' }));
    expect(screen.getByRole('button', { name: 'Grosso' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(undo());
    expect(latest.strokes.map((s) => s.color)).toEqual(['#e53935', '#1e88e5']);
    await userEvent.click(undo());
    await userEvent.click(screen.getByRole('button', { name: 'Borracha' }));
    expect(latest.strokes).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /Apagar ponto 1/ }));
    expect(latest.points).toEqual([]);
  });

  it('o botão Limpar mapa também apaga os traços', async () => {
    render(
      <Harness defaultRegion="body" initialStrokes={[{ view: 'body', color: '#e53935', width: 1, points: [1, 1, 2, 2] }]} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Limpar mapa' }));
    expect(latest.strokes).toEqual([]);
  });
});
