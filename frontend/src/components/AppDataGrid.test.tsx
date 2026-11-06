import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppDataGrid } from './AppDataGrid';

vi.setConfig({ testTimeout: 30_000 });

const columns = [{ field: 'name', headerName: 'Nome', flex: 1 }];

function mockMobile(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  // @ts-expect-error restaura o padrão do jsdom (sem matchMedia)
  delete window.matchMedia;
});

describe('AppDataGrid', () => {
  it('renderiza cabeçalhos e linhas', async () => {
    render(<AppDataGrid rows={[{ id: 1, name: 'Maria' }, { id: 2, name: 'Joana' }]} columns={columns} />);
    expect(await screen.findByText('Maria')).toBeInTheDocument();
    expect(screen.getByText('Joana')).toBeInTheDocument();
    expect(screen.getByText('Nome')).toBeInTheDocument();
  });

  it('mostra o aviso de vazio sem altura fixa', async () => {
    const { container } = render(<AppDataGrid rows={[]} columns={columns} localeText={{ noRowsLabel: 'Nada aqui' }} />);
    expect(await screen.findByText('Nada aqui')).toBeInTheDocument();
    expect(container.firstChild).not.toHaveStyle({ height: '560px' });
  });

  it('usa a altura informada quando há linhas e a altura de carregamento quando vazio carregando', () => {
    const { container, rerender } = render(<AppDataGrid rows={[{ id: 1, name: 'A' }]} columns={columns} height={300} />);
    expect(container.firstChild).toHaveStyle({ height: '300px' });
    rerender(<AppDataGrid rows={[]} loading columns={columns} height={300} />);
    expect(container.firstChild).toHaveStyle({ height: '320px' });
  });

  it('fixedHeight mantém a altura mesmo vazio', () => {
    const { container } = render(<AppDataGrid rows={[]} columns={columns} fixedHeight height="400px" />);
    expect(container.firstChild).toHaveStyle({ height: '400px' });
  });

  it('no celular usa alturas reduzidas', () => {
    mockMobile(true);
    const { container, rerender } = render(<AppDataGrid rows={[{ id: 1, name: 'A' }]} columns={columns} />);
    expect(container.firstChild).toHaveStyle({ height: '420px' });
    rerender(<AppDataGrid rows={[]} loading columns={columns} />);
    expect(container.firstChild).toHaveStyle({ height: '280px' });
  });

  it('aceita sx em lista', async () => {
    render(<AppDataGrid rows={[{ id: 1, name: 'A' }]} columns={columns} sx={[{ color: 'red' }]} />);
    expect(await screen.findByText('A')).toBeInTheDocument();
  });
});
