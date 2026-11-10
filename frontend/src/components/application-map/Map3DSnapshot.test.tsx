import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Map3DSnapshot from './Map3DSnapshot';
import * as snapshot from './model3d/snapshot';

vi.mock('./model3d/snapshot', () => ({
  snapshotReady: vi.fn(() => Promise.resolve()),
  snapshotAngles: vi.fn(() => [-Math.PI / 2, 0, Math.PI / 2]),
  renderSnapshot: vi.fn((_v, _p, _s, angle: number) => `data:image/png;base64,${angle}`),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Map3DSnapshot', () => {
  it('desenha uma miniatura por ângulo, com rótulo do lado, depois que o modelo carrega', async () => {
    render(<Map3DSnapshot view="head3d" points={[{ x: 1, y: 2, view: 'head3d' }]} strokes={[]} label="rosto" height={200} />);
    expect(await screen.findByRole('img', { name: 'Mapa de aplicação: rosto, frente' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: rosto, lado direito' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: rosto, lado esquerdo' })).toBeInTheDocument();
    expect(snapshot.renderSnapshot).toHaveBeenCalledWith('head3d', expect.any(Array), [], 0, 160, 200);
  });

  it('usa proporção de corpo e não redesenha quando só a identidade das listas muda', async () => {
    const { rerender } = render(<Map3DSnapshot view="body3d" points={[]} strokes={[]} label="corpo" height={300} />);
    await screen.findAllByRole('img');
    expect(snapshot.renderSnapshot).toHaveBeenCalledWith('body3d', [], [], 0, 180, 300);
    const calls = vi.mocked(snapshot.snapshotReady).mock.calls.length;
    rerender(<Map3DSnapshot view="body3d" points={[]} strokes={[]} label="corpo" height={300} />);
    expect(vi.mocked(snapshot.snapshotReady).mock.calls.length).toBe(calls);
  });

  it('sem WebGL (renderização falha) não mostra miniaturas e só avisa', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(snapshot.renderSnapshot).mockImplementationOnce(() => {
      throw new Error('sem webgl');
    });
    render(<Map3DSnapshot view="head3d" points={[]} strokes={[]} label="rosto" height={100} />);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('sem WebGL (preparo falha na hora) também não quebra', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(snapshot.snapshotReady).mockImplementationOnce(() => {
      throw new Error('sem webgl');
    });
    render(<Map3DSnapshot view="head3d" points={[]} strokes={[]} label="rosto" height={100} />);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('não desenha se desmontar antes de o modelo carregar', async () => {
    let release: () => void = () => undefined;
    vi.mocked(snapshot.snapshotReady).mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const { unmount } = render(<Map3DSnapshot view="head3d" points={[]} strokes={[]} label="rosto" height={100} />);
    unmount();
    release();
    await Promise.resolve();
    expect(snapshot.renderSnapshot).not.toHaveBeenCalled();
  });
});
