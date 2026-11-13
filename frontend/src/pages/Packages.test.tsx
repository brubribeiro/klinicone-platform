import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { packagesApi } from '../api/packages';
import type { Package } from '../types';
import { Packages } from './Packages';

vi.mock('../api/packages', () => ({ packagesApi: { list: vi.fn(), getStats: vi.fn(), remove: vi.fn() } }));
vi.mock('../components/packages/PackageFormDialog', () => ({
  PackageFormDialog: ({ open, pkg }: { open: boolean; pkg?: Package | null }) =>
    open ? <div role="dialog" aria-label="form">{pkg ? `Editar ${pkg.name}` : 'Novo pacote'}</div> : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'u', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const item = (id: string, name: string, quantity: number) => ({
  id,
  packageId: 'x',
  procedureId: id,
  quantity,
  sortOrder: 0,
  procedure: { id, name } as never,
});

const mk = (id: string, extra: Partial<Package>): Package => ({
  id,
  name: id,
  type: 'SESSIONS',
  sessionCount: 4,
  active: true,
  items: [],
  ...extra,
});

const pkgs: Package[] = [
  mk('Pacote Face', {
    description: 'Rejuvenescimento',
    totalPrice: 1800,
    originalPrice: 2000,
    salePrice: 1800,
    savingsPercent: 10,
    sessionCount: 6,
    highlight: 'BEST_SELLER',
    activePatientsCount: 3,
    items: [item('i1', 'Peeling', 4), item('i2', 'Limpeza', 1)],
  }),
  mk('Pacote Corpo', { totalPrice: 500, sessionCount: 1, highlight: 'RECURRING', activePatientsCount: 1 }),
  mk('Pacote Antigo', { totalPrice: 300, active: false }),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Packages />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const cardOf = (name: string) => screen.getByText(name).closest('.MuiCard-root') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/pacotes');
  auth.user.permissions = ['packages:create', 'packages:edit'];
  mocked(packagesApi.list).mockResolvedValue(pkgs);
  mocked(packagesApi.getStats).mockResolvedValue({ activePackages: 2, patientsWithPackage: 1 });
});

describe('Packages', () => {
  it('mostra estatísticas com singular/plural corretos', async () => {
    renderPage();
    expect(await screen.findByText(/^\s*pacotes ativos\s+·\s+paciente com pacote/)).toBeInTheDocument();
  });

  it('mostra preço cheio riscado, preço de venda, economia, sessões e pacientes', async () => {
    renderPage();
    await screen.findByText('Pacote Face');
    const face = within(cardOf('Pacote Face'));
    expect(face.getByText(/R\$\s*2\.000,00/)).toBeInTheDocument();
    expect(face.getByText(/R\$\s*1\.800,00/)).toBeInTheDocument();
    expect(face.getByText('economia 10%')).toBeInTheDocument();
    expect(face.getByText('6 sessões')).toBeInTheDocument();
    expect(face.getByText('3 pacientes ativos')).toBeInTheDocument();
    expect(face.getByText('Mais vendido')).toBeInTheDocument();
    expect(face.getByText('Peeling ×4')).toBeInTheDocument();
    expect(face.getByText('Limpeza')).toBeInTheDocument();

    const corpo = within(cardOf('Pacote Corpo'));
    expect(corpo.getByText('Recorrente')).toBeInTheDocument();
    expect(corpo.getByText('1 sessão')).toBeInTheDocument();
    expect(corpo.getByText('1 paciente ativo')).toBeInTheDocument();
    expect(corpo.queryByText(/economia/)).not.toBeInTheDocument();

    const antigo = within(cardOf('Pacote Antigo'));
    expect(antigo.getByText('Inativo')).toBeInTheDocument();
    expect(antigo.getByText(/R\$\s*300,00/)).toBeInTheDocument();
  });

  it('filtra por nome, descrição e procedimento', async () => {
    renderPage();
    await screen.findByText('Pacote Face');
    const search = screen.getByRole('textbox', { name: 'Buscar pacote' });
    await userEvent.type(search, 'rejuv');
    expect(screen.queryByText('Pacote Corpo')).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'limpeza');
    expect(screen.getByText('Pacote Face')).toBeInTheDocument();
    expect(screen.queryByText('Pacote Antigo')).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'zzz');
    expect(screen.getByText('Nenhum pacote encontrado')).toBeInTheDocument();
    expect(screen.getByText('Tente ajustar a busca.')).toBeInTheDocument();
  });

  it('estado vazio', async () => {
    mocked(packagesApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhum pacote cadastrado')).toBeInTheDocument();
  });

  it('abre o formulário para criar e editar', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Criar pacote' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Novo pacote');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Pacote Corpo' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Editar Pacote Corpo');
  });

  it('exclui após confirmar, não exclui se cancelar e mostra erro da API', async () => {
    renderPage();
    await screen.findByText('Pacote Face');
    mocked(dialogs.confirm).mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Pacote Corpo' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(1));
    expect(packagesApi.remove).not.toHaveBeenCalled();

    mocked(dialogs.confirm).mockResolvedValueOnce(true);
    mocked(packagesApi.remove).mockResolvedValueOnce(undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Pacote Corpo' }));
    expect(dialogs.confirm).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Excluir o pacote "Pacote Corpo"? Esta ação não pode ser desfeita.' }));
    await waitFor(() => expect(packagesApi.remove).toHaveBeenCalledWith('Pacote Corpo', {}));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pacote excluído.'));

    mocked(dialogs.confirm).mockResolvedValueOnce(true);
    mocked(packagesApi.remove).mockRejectedValueOnce({ response: { data: { message: 'Pacote vendido' } } });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Pacote Face' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Pacote vendido'));
  });

  it('sem permissões não há criar/editar/excluir', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Pacote Face');
    expect(screen.queryByRole('button', { name: 'Criar pacote' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
  });

  it('pagina de 8 em 8', async () => {
    mocked(packagesApi.list).mockResolvedValue(Array.from({ length: 10 }, (_, i) => mk(`Pkg ${String(i + 1).padStart(2, '0')}`, {})));
    renderPage();
    await screen.findByText('Pkg 01');
    expect(screen.queryByText('Pkg 09')).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1–8 de\s+10/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByText('Pkg 09')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 9–10 de\s+10/)).toBeInTheDocument();
  });
});
